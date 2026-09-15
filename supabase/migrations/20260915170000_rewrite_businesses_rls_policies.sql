-- ==============================================================================
-- Migration: Rewrite Supabase RLS policies for relation 'businesses'
-- Specifically designed to:
-- 1. Use auth.uid() = owner_id (and owner_user_id) for owners
-- 2. Check 'business_members' via a SECURITY DEFINER helper function (not the table directly)
-- 3. Eliminate all policies that query 'businesses' from within 'businesses' RLS
-- 4. Completely eliminate PostgreSQL infinite recursion
-- ==============================================================================

-- 1. Ensure owner_id column exists on public.businesses and is populated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Backfill owner_id from owner_user_id if owner_id is NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'owner_user_id'
  ) THEN
    UPDATE public.businesses SET owner_id = owner_user_id WHERE owner_id IS NULL;
  END IF;
END $$;

-- 2. Ensure synchronization trigger between owner_id and owner_user_id
CREATE OR REPLACE FUNCTION public.sync_businesses_owner_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL AND (NEW.owner_user_id IS NULL OR NEW.owner_user_id != NEW.owner_id) THEN
    NEW.owner_user_id := NEW.owner_id;
  ELSIF NEW.owner_user_id IS NOT NULL AND NEW.owner_id IS NULL THEN
    NEW.owner_id := NEW.owner_user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_businesses_owner_columns ON public.businesses;
CREATE TRIGGER trg_sync_businesses_owner_columns
  BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_businesses_owner_columns();

-- 3. Ensure public.business_members table exists
CREATE TABLE IF NOT EXISTS public.business_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email text,
  role text NOT NULL DEFAULT 'cashier',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_members_biz ON public.business_members(business_id);
CREATE INDEX IF NOT EXISTS idx_business_members_usr ON public.business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_business_members_email ON public.business_members(lower(invited_email));

ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

-- 4. NON-RECURSIVE SECURITY DEFINER HELPER FUNCTIONS

-- Helper A: Check if a user is a member/staff of a business (Bypasses RLS)
CREATE OR REPLACE FUNCTION public.check_is_business_member(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE business_id = _business_id
      AND (
        user_id = auth.uid()
        OR lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
      AND status = 'active'
  )
  OR (
    EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'business_staff'
    ) AND EXISTS (
      SELECT 1 FROM public.business_staff
      WHERE business_id = _business_id
        AND (
          user_id = auth.uid()
          OR lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
        AND status = 'active'
    )
  );
$$;

-- Alias for convenience
CREATE OR REPLACE FUNCTION public.is_business_member(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.check_is_business_member(_business_id);
$$;

-- Helper B: Check if a user is the owner of a business (Bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_business_owner(_business_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = _business_id
      AND (owner_id = _user_id OR owner_user_id = _user_id)
  );
$$;

-- Helper C: Check if a user is a platform admin (Bypasses RLS, does NOT query businesses)
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'gepardwebs@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = 'admin'::app_role
    )
  );
$$;

-- 5. DROP ALL OLD POLICIES ON "businesses"
DROP POLICY IF EXISTS "Staff can view assigned businesses" ON public.businesses;
DROP POLICY IF EXISTS "Members can view assigned businesses" ON public.businesses;
DROP POLICY IF EXISTS "Staff and members can view assigned businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can read own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Owners can view own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Admins can read all businesses" ON public.businesses;
DROP POLICY IF EXISTS "Admins can view all businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can create own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Owners can create own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can update own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Owners and admins can update own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Admins can update businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can delete own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Owners and admins can delete own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Admins can delete businesses" ON public.businesses;

-- 6. CREATE CLEAN, ZERO-RECURSION REWRITTEN POLICIES ON "businesses"

-- (A) Owner SELECT Policy: Checks auth.uid() = owner_id directly
CREATE POLICY "Owners can view own businesses"
  ON public.businesses
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR auth.uid() = owner_user_id
  );

-- (B) Member SELECT Policy: Checks 'business_members' via helper function (no table recursion)
CREATE POLICY "Members can view assigned businesses"
  ON public.businesses
  FOR SELECT
  TO authenticated
  USING (
    public.check_is_business_member(id)
  );

-- (C) Admin SELECT Policy: Uses admin helper function (does not query businesses)
CREATE POLICY "Admins can view all businesses"
  ON public.businesses
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
  );

-- (D) Owner INSERT Policy
CREATE POLICY "Owners can create own businesses"
  ON public.businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    OR auth.uid() = owner_user_id
  );

-- (E) Owner and Admin UPDATE Policy
CREATE POLICY "Owners and admins can update own businesses"
  ON public.businesses
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR auth.uid() = owner_user_id
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    auth.uid() = owner_id
    OR auth.uid() = owner_user_id
    OR public.is_platform_admin(auth.uid())
  );

-- (F) Owner and Admin DELETE Policy
CREATE POLICY "Owners and admins can delete own businesses"
  ON public.businesses
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR auth.uid() = owner_user_id
    OR public.is_platform_admin(auth.uid())
  );

-- 7. REWRITE POLICIES ON "business_members" TO AVOID CALLING BACK INTO "businesses" RLS
DROP POLICY IF EXISTS "Members and owners can view memberships" ON public.business_members;
DROP POLICY IF EXISTS "Owners can manage business members" ON public.business_members;
DROP POLICY IF EXISTS "Staff and owners view business members" ON public.business_members;

CREATE POLICY "Members and owners can view memberships"
  ON public.business_members
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR public.is_business_owner(business_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Owners can manage business members"
  ON public.business_members
  FOR ALL
  TO authenticated
  USING (
    public.is_business_owner(business_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.is_business_owner(business_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

-- 8. REWRITE POLICIES ON "business_staff" IF PRESENT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'business_staff'
  ) THEN
    DROP POLICY IF EXISTS "Staff and owners view business staff" ON public.business_staff;
    DROP POLICY IF EXISTS "Owners manage business staff" ON public.business_staff;

    CREATE POLICY "Staff and owners view business staff"
      ON public.business_staff
      FOR SELECT
      TO authenticated
      USING (
        auth.uid() = user_id
        OR auth.uid() = invited_by
        OR lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        OR public.is_business_owner(business_id, auth.uid())
        OR public.is_platform_admin(auth.uid())
      );

    CREATE POLICY "Owners manage business staff"
      ON public.business_staff
      FOR ALL
      TO authenticated
      USING (
        public.is_business_owner(business_id, auth.uid())
        OR public.is_platform_admin(auth.uid())
      )
      WITH CHECK (
        public.is_business_owner(business_id, auth.uid())
        OR public.is_platform_admin(auth.uid())
      );
  END IF;
END $$;
