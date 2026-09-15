-- ==============================================================================
-- Migration: Fix Infinite Recursion in RLS Policies for Relation "businesses"
-- Date: 2026-09-15
-- Author: Senior Supabase + Database Engineer
--
-- ROOT CAUSE OF ERROR:
-- 1. "businesses" had a policy ("Staff can view assigned businesses") that queried "business_staff".
-- 2. "business_staff" had policies ("Staff and owners view business staff" / "Owners manage business staff")
--    that queried "businesses".
-- 3. PostgreSQL RLS evaluated "businesses" -> "business_staff" -> "businesses" -> ...,
--    hitting PostgreSQL recursion limit: "infinite recursion detected in policy for relation businesses".
--
-- FIX ARCHITECTURE:
-- 1. Use SECURITY DEFINER functions with SET search_path = public to check memberships and ownerships.
--    Because SECURITY DEFINER functions execute with table owner privileges, RLS is NOT evaluated
--    recursively within the function execution context.
-- 2. Ensure both "owner_user_id" and "owner_id" column conventions are supported.
-- 3. Ensure both "business_staff" and "business_members" tables are supported and accessible.
-- ==============================================================================

-- 1. Ensure owner_id column exists on public.businesses for full compatibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    -- Backfill owner_id from owner_user_id
    UPDATE public.businesses SET owner_id = owner_user_id WHERE owner_id IS NULL;
  END IF;
END $$;

-- 2. Create public.business_members table if not exists (synced with business_staff)
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

-- Enable RLS on business_members
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

-- 3. CREATE NON-RECURSIVE SECURITY DEFINER FUNCTIONS

-- Function A: Checks if a user is an active member or staff of a business (bypasses RLS)
CREATE OR REPLACE FUNCTION public.check_user_is_business_member(_business_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_staff
    WHERE business_id = _business_id
      AND (user_id = _user_id OR lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.business_members
    WHERE business_id = _business_id
      AND (user_id = _user_id OR lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      AND status = 'active'
  );
$$;

-- Function B: Checks if a user is the owner of a business (bypasses RLS)
CREATE OR REPLACE FUNCTION public.check_user_is_business_owner(_business_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = _business_id
      AND (owner_user_id = _user_id OR owner_id = _user_id)
  );
$$;

-- Function C: Check if user is platform admin or superadmin
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
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

-- 4. DROP OLD CONFLICTING / RECURSIVE POLICIES ON "businesses"
DROP POLICY IF EXISTS "Staff can view assigned businesses" ON public.businesses;
DROP POLICY IF EXISTS "Members can view assigned businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can read own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Admins can read all businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can update own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can delete own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can create own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Admins can update businesses" ON public.businesses;
DROP POLICY IF EXISTS "Admins can delete businesses" ON public.businesses;

-- 5. CREATE CLEAN, ZERO-RECURSION POLICIES ON "businesses"

-- Allow platform admins to view all businesses
CREATE POLICY "Admins can read all businesses"
  ON public.businesses FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Allow owners to view their own businesses
CREATE POLICY "Users can read own businesses"
  ON public.businesses FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id OR auth.uid() = owner_id);

-- Allow invited staff/members to view assigned businesses (NON-RECURSIVE via SECURITY DEFINER)
CREATE POLICY "Staff and members can view assigned businesses"
  ON public.businesses FOR SELECT TO authenticated
  USING (public.check_user_is_business_member(id, auth.uid()));

-- Allow authenticated users to create businesses
CREATE POLICY "Users can create own businesses"
  ON public.businesses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id OR auth.uid() = owner_id);

-- Allow owners and admins to update businesses
CREATE POLICY "Users can update own businesses"
  ON public.businesses FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id OR auth.uid() = owner_id OR public.is_platform_admin(auth.uid()))
  WITH CHECK (auth.uid() = owner_user_id OR auth.uid() = owner_id OR public.is_platform_admin(auth.uid()));

-- Allow owners and admins to delete businesses
CREATE POLICY "Users can delete own businesses"
  ON public.businesses FOR DELETE TO authenticated
  USING (auth.uid() = owner_user_id OR auth.uid() = owner_id OR public.is_platform_admin(auth.uid()));

-- 6. DROP OLD CONFLICTING / RECURSIVE POLICIES ON "business_staff"
DROP POLICY IF EXISTS "Staff and owners view business staff" ON public.business_staff;
DROP POLICY IF EXISTS "Owners manage business staff" ON public.business_staff;

-- CREATE CLEAN, ZERO-RECURSION POLICIES ON "business_staff"
CREATE POLICY "Staff and owners view business staff"
  ON public.business_staff FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id 
    OR auth.uid() = invited_by 
    OR lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR public.check_user_is_business_owner(business_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Owners manage business staff"
  ON public.business_staff FOR ALL TO authenticated
  USING (
    public.check_user_is_business_owner(business_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.check_user_is_business_owner(business_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

-- 7. CREATE CLEAN POLICIES ON "business_members"
DROP POLICY IF EXISTS "Members and owners view business members" ON public.business_members;
DROP POLICY IF EXISTS "Owners manage business members" ON public.business_members;

CREATE POLICY "Members and owners view business members"
  ON public.business_members FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id 
    OR lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR public.check_user_is_business_owner(business_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Owners manage business members"
  ON public.business_members FOR ALL TO authenticated
  USING (
    public.check_user_is_business_owner(business_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.check_user_is_business_owner(business_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

-- 8. Sync owner_id on businesses with trigger
CREATE OR REPLACE FUNCTION public.sync_businesses_owner_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_user_id IS NOT NULL AND NEW.owner_id IS NULL THEN
    NEW.owner_id := NEW.owner_user_id;
  ELSIF NEW.owner_id IS NOT NULL AND NEW.owner_user_id IS NULL THEN
    NEW.owner_user_id := NEW.owner_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_businesses_owner_columns ON public.businesses;
CREATE TRIGGER trg_sync_businesses_owner_columns
  BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.sync_businesses_owner_columns();

-- 9. Add social_links, footer_copyright, about_members to public_settings
ALTER TABLE public.public_settings 
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS footer_copyright jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS about_members jsonb DEFAULT '[]'::jsonb;

-- Update trigger function to sync them from platform_settings.alerts
CREATE OR REPLACE FUNCTION public.sync_public_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_general jsonb;
  v_social jsonb;
  v_copyright jsonb;
  v_members jsonb;
BEGIN
  v_general := NEW.alerts -> 'general_settings';
  
  -- Extract social_links
  IF v_general IS NOT NULL AND v_general -> 'social_links' IS NOT NULL THEN
    v_social := v_general -> 'social_links';
  ELSIF NEW.alerts -> 'social_links' IS NOT NULL THEN
    v_social := NEW.alerts -> 'social_links';
  ELSE
    v_social := '[]'::jsonb;
  END IF;

  -- Extract footer_copyright
  IF v_general IS NOT NULL AND v_general -> 'footer_copyright' IS NOT NULL THEN
    v_copyright := v_general -> 'footer_copyright';
  ELSIF NEW.alerts -> 'footer_copyright' IS NOT NULL THEN
    v_copyright := NEW.alerts -> 'footer_copyright';
  ELSE
    v_copyright := '{}'::jsonb;
  END IF;

  -- Extract about_members
  IF v_general IS NOT NULL AND v_general -> 'about_members' IS NOT NULL THEN
    v_members := v_general -> 'about_members';
  ELSIF NEW.alerts -> 'about_members' IS NOT NULL THEN
    v_members := NEW.alerts -> 'about_members';
  ELSE
    v_members := '[]'::jsonb;
  END IF;

  INSERT INTO public.public_settings (
    id, app_name, tagline, interface_language, logo_url, favicon_url,
    primary_accent, secondary_accent, default_theme, base_currency,
    universal_tax, invoice_prefix, system_timezone, maintenance_mode,
    maintenance_message, social_links, footer_copyright, about_members, updated_at
  )
  VALUES (
    NEW.id, NEW.app_name, NEW.tagline, NEW.interface_language, NEW.logo_url, NEW.favicon_url,
    NEW.primary_accent, NEW.secondary_accent, NEW.default_theme, NEW.base_currency,
    NEW.universal_tax, NEW.invoice_prefix, NEW.system_timezone, NEW.maintenance_mode,
    NEW.maintenance_message, v_social, v_copyright, v_members, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    app_name = EXCLUDED.app_name,
    tagline = EXCLUDED.tagline,
    interface_language = EXCLUDED.interface_language,
    logo_url = EXCLUDED.logo_url,
    favicon_url = EXCLUDED.favicon_url,
    primary_accent = EXCLUDED.primary_accent,
    secondary_accent = EXCLUDED.secondary_accent,
    default_theme = EXCLUDED.default_theme,
    base_currency = EXCLUDED.base_currency,
    universal_tax = EXCLUDED.universal_tax,
    invoice_prefix = EXCLUDED.invoice_prefix,
    system_timezone = EXCLUDED.system_timezone,
    maintenance_mode = EXCLUDED.maintenance_mode,
    maintenance_message = EXCLUDED.maintenance_message,
    social_links = EXCLUDED.social_links,
    footer_copyright = EXCLUDED.footer_copyright,
    about_members = EXCLUDED.about_members,
    updated_at = now();
  RETURN NEW;
END;
$$;
