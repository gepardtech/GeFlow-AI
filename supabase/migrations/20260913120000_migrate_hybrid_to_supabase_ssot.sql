-- Migration: Shift from Hybrid JSON to Supabase Single Source of Truth
-- 1. Ensure businesses table has payment_methods column and proper owner RLS policies
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS payment_methods jsonb DEFAULT '[]'::jsonb;

-- Allow owners to update their own businesses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'businesses' AND policyname = 'Users can update own businesses'
  ) THEN
    CREATE POLICY "Users can update own businesses"
      ON public.businesses FOR UPDATE TO authenticated
      USING (auth.uid() = owner_user_id)
      WITH CHECK (auth.uid() = owner_user_id);
  END IF;
END $$;

-- Allow owners to delete their own businesses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'businesses' AND policyname = 'Users can delete own businesses'
  ) THEN
    CREATE POLICY "Users can delete own businesses"
      ON public.businesses FOR DELETE TO authenticated
      USING (auth.uid() = owner_user_id);
  END IF;
END $$;

-- 2. Create business_staff table for store-level team members
CREATE TABLE IF NOT EXISTS public.business_staff (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_email text NOT NULL,
  role text NOT NULL DEFAULT 'cashier', -- manager, cashier, stock_keeper
  permissions jsonb NOT NULL DEFAULT '["pos"]'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending, active, inactive
  invited_by uuid NOT NULL,
  invitation_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_staff_business ON public.business_staff(business_id);
CREATE INDEX IF NOT EXISTS idx_business_staff_user ON public.business_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_business_staff_email ON public.business_staff(lower(invited_email));

ALTER TABLE public.business_staff ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'business_staff' AND policyname = 'Staff and owners view business staff'
  ) THEN
    CREATE POLICY "Staff and owners view business staff"
      ON public.business_staff FOR SELECT TO authenticated
      USING (
        auth.uid() = user_id OR 
        auth.uid() = invited_by OR
        EXISTS (
          SELECT 1 FROM public.businesses 
          WHERE businesses.id = business_staff.business_id 
            AND businesses.owner_user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'business_staff' AND policyname = 'Owners manage business staff'
  ) THEN
    CREATE POLICY "Owners manage business staff"
      ON public.business_staff FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.businesses 
          WHERE businesses.id = business_staff.business_id 
            AND businesses.owner_user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.businesses 
          WHERE businesses.id = business_staff.business_id 
            AND businesses.owner_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Allow staff to see the business they belong to
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'businesses' AND policyname = 'Staff can view assigned businesses'
  ) THEN
    CREATE POLICY "Staff can view assigned businesses"
      ON public.businesses FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.business_staff 
          WHERE business_staff.business_id = businesses.id 
            AND (business_staff.user_id = auth.uid() OR lower(business_staff.invited_email) = lower(auth.jwt() ->> 'email'))
            AND business_staff.status = 'active'
        )
      );
  END IF;
END $$;

-- 3. Fix subscriptions table RLS so owners can insert/update during checkout
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'subscriptions' AND policyname = 'Users manage own subscriptions'
  ) THEN
    CREATE POLICY "Users manage own subscriptions"
      ON public.subscriptions FOR ALL TO authenticated
      USING (auth.uid() = owner_user_id)
      WITH CHECK (auth.uid() = owner_user_id);
  END IF;
END $$;

-- 4. Fix invoices table RLS so users can insert their checkout invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'invoices' AND policyname = 'Users insert own invoices'
  ) THEN
    CREATE POLICY "Users insert own invoices"
      ON public.invoices FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = owner_user_id);
  END IF;
END $$;

-- 5. Newsletter tables
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'subscribed',
  source text DEFAULT 'Landing Page',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_email_sent_at timestamptz,
  emails_delivered integer NOT NULL DEFAULT 0
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'newsletter_subscribers' AND policyname = 'Anyone can subscribe'
  ) THEN
    CREATE POLICY "Anyone can subscribe"
      ON public.newsletter_subscribers FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'newsletter_subscribers' AND policyname = 'Admins manage newsletter subscribers'
  ) THEN
    CREATE POLICY "Admins manage newsletter subscribers"
      ON public.newsletter_subscribers FOR ALL TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.newsletter_templates (
  id text NOT NULL PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'announcement',
  subject text NOT NULL,
  preview_text text,
  headline text,
  body text NOT NULL,
  cta_text text,
  cta_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'newsletter_templates' AND policyname = 'Admins manage newsletter templates'
  ) THEN
    CREATE POLICY "Admins manage newsletter templates"
      ON public.newsletter_templates FOR ALL TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.newsletter_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient text NOT NULL,
  template_id text REFERENCES public.newsletter_templates(id) ON DELETE SET NULL,
  template_name text,
  subject text NOT NULL,
  type text,
  status text NOT NULL DEFAULT 'delivered',
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'newsletter_logs' AND policyname = 'Admins manage newsletter logs'
  ) THEN
    CREATE POLICY "Admins manage newsletter logs"
      ON public.newsletter_logs FOR ALL TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- 6. Ensure default singleton row in platform_settings
INSERT INTO public.platform_settings (singleton, app_name, base_currency)
VALUES (true, 'GeFlow Enterprise', 'USD')
ON CONFLICT (singleton) DO NOTHING;
