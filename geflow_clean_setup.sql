-- ========================================================
-- GEFLOW AI COMPREHENSIVE PRODUCTION SCHEMA MIGRATION
-- Target Project: jwdztevnodxoeyhcmrnf.supabase.co
-- ========================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- >>> Migration: 20260414170253_b92b0e69-e260-48b8-8490-2d3c22b3520f.sql <<< --

-- Create contact submissions table
CREATE TABLE public.contact_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a contact form
CREATE POLICY "Anyone can insert contact submissions"
ON public.contact_submissions
FOR INSERT
WITH CHECK (true);

-- Create admin role
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Admins can read contact submissions
CREATE POLICY "Admins can view contact submissions"
ON public.contact_submissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update contact submissions (mark as read)
CREATE POLICY "Admins can update contact submissions"
ON public.contact_submissions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can read their own roles
CREATE POLICY "Users can read own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can read all roles
CREATE POLICY "Admins can read all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();



-- >>> Migration: 20260417154819_f7612909-9afd-4389-baa0-ecbeaa05f638.sql <<< --
-- Add plan and usage columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS usage integer NOT NULL DEFAULT 0;

-- Replace handle_new_user to populate email + auto-assign admin role for gepardwebs@gmail.com
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, plan)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'plan', 'free')
  );

  IF lower(NEW.email) = 'gepardwebs@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Allow admins to read all profiles (for admin panel)
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow user_roles unique constraint (prevent duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_role_key
  ON public.user_roles(user_id, role);



-- >>> Migration: 20260419162150_458ad353-3eb6-4dce-98d1-1e03e7cdd28e.sql <<< --

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_active timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS listed_products integer NOT NULL DEFAULT 0;

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));



-- >>> Migration: 20260503202050_1c4a3278-79ad-4d62-9ff6-38364ef91831.sql <<< --
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.business_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry_type text NOT NULL,
  internal_description text,
  enabled_modules text[] NOT NULL DEFAULT '{}',
  enabled_features text[] NOT NULL DEFAULT '{}',
  default_tax numeric(5,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  stock_alert_limit integer NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'draft',
  created_by_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX business_categories_name_idx ON public.business_categories (lower(name));
CREATE INDEX business_categories_industry_idx ON public.business_categories (industry_type);
CREATE INDEX business_categories_status_idx ON public.business_categories (status);

ALTER TABLE public.business_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all business categories"
ON public.business_categories
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read active business categories"
ON public.business_categories
FOR SELECT
TO authenticated
USING (status = 'active');

CREATE POLICY "Admins can create business categories"
ON public.business_categories
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update business categories"
ON public.business_categories
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete business categories"
ON public.business_categories
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  category_id uuid REFERENCES public.business_categories(id) ON DELETE SET NULL,
  business_name text NOT NULL,
  business_address text,
  status text NOT NULL DEFAULT 'active',
  listed_products integer NOT NULL DEFAULT 0,
  usage integer NOT NULL DEFAULT 0,
  last_active timestamp with time zone NOT NULL DEFAULT now(),
  currency text NOT NULL DEFAULT 'USD',
  default_tax numeric(5,2) NOT NULL DEFAULT 0,
  stock_alert_limit integer NOT NULL DEFAULT 10,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX businesses_owner_user_id_idx ON public.businesses (owner_user_id);
CREATE INDEX businesses_status_idx ON public.businesses (status);
CREATE INDEX businesses_category_id_idx ON public.businesses (category_id);
CREATE INDEX businesses_name_idx ON public.businesses (lower(business_name));

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_business_limit(_plan text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_plan, 'free'))
    WHEN 'free' THEN 1
    WHEN 'standard' THEN 3
    WHEN 'premium' THEN 5
    WHEN 'lifetime' THEN NULL
    WHEN 'unlimited' THEN NULL
    ELSE 1
  END
$$;

CREATE OR REPLACE FUNCTION public.apply_business_category_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  category_row public.business_categories%ROWTYPE;
BEGIN
  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO category_row
  FROM public.business_categories
  WHERE id = NEW.category_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected business category does not exist';
  END IF;

  NEW.currency := category_row.currency;
  NEW.default_tax := category_row.default_tax;
  NEW.stock_alert_limit := category_row.stock_alert_limit;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_business_record()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  owner_plan text;
  business_limit integer;
  existing_count integer;
BEGIN
  IF NEW.business_name IS NULL OR btrim(NEW.business_name) = '' THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  IF NEW.status NOT IN ('active', 'suspended', 'draft') THEN
    RAISE EXCEPTION 'Invalid business status';
  END IF;

  IF NEW.default_tax < 0 OR NEW.default_tax > 100 THEN
    RAISE EXCEPTION 'Default tax must be between 0 and 100';
  END IF;

  SELECT plan
  INTO owner_plan
  FROM public.profiles
  WHERE user_id = NEW.owner_user_id;

  IF owner_plan IS NULL THEN
    RAISE EXCEPTION 'Owner profile not found';
  END IF;

  business_limit := public.get_business_limit(owner_plan);

  IF business_limit IS NOT NULL THEN
    SELECT count(*)
    INTO existing_count
    FROM public.businesses
    WHERE owner_user_id = NEW.owner_user_id
      AND (TG_OP = 'INSERT' OR id <> OLD.id);

    IF existing_count >= business_limit THEN
      RAISE EXCEPTION 'Business limit reached for current plan';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_business_category_record()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS NULL OR btrim(NEW.name) = '' THEN
    RAISE EXCEPTION 'Category name is required';
  END IF;

  IF NEW.industry_type IS NULL OR btrim(NEW.industry_type) = '' THEN
    RAISE EXCEPTION 'Industry type is required';
  END IF;

  IF NEW.status NOT IN ('active', 'draft') THEN
    RAISE EXCEPTION 'Invalid category status';
  END IF;

  IF NEW.default_tax < 0 OR NEW.default_tax > 100 THEN
    RAISE EXCEPTION 'Default tax must be between 0 and 100';
  END IF;

  RETURN NEW;
END;
$$;

CREATE POLICY "Admins can read all businesses"
ON public.businesses
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own businesses"
ON public.businesses
FOR SELECT
TO authenticated
USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create own businesses"
ON public.businesses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Admins can update businesses"
ON public.businesses
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete businesses"
ON public.businesses
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_business_categories_updated_at
BEFORE UPDATE ON public.business_categories
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TRIGGER validate_business_category_record
BEFORE INSERT OR UPDATE ON public.business_categories
FOR EACH ROW
EXECUTE FUNCTION public.validate_business_category_record();

CREATE TRIGGER set_businesses_updated_at
BEFORE UPDATE ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TRIGGER apply_business_category_defaults
BEFORE INSERT OR UPDATE OF category_id ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.apply_business_category_defaults();

CREATE TRIGGER validate_business_record
BEFORE INSERT OR UPDATE ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.validate_business_record();

ALTER PUBLICATION supabase_realtime ADD TABLE public.business_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses;


-- >>> Migration: 20260503202155_f6fbc874-2aed-409d-8d8c-e5b561751758.sql <<< --
CREATE OR REPLACE FUNCTION public.get_business_limit(_plan text)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_plan, 'free'))
    WHEN 'free' THEN 1
    WHEN 'standard' THEN 3
    WHEN 'premium' THEN 5
    WHEN 'lifetime' THEN NULL
    WHEN 'unlimited' THEN NULL
    ELSE 1
  END
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role, supabase_auth_admin;

REVOKE ALL ON FUNCTION public.get_business_limit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_business_limit(text) TO authenticated;


-- >>> Migration: 20260506042247_96665c77-424c-45f6-9daf-449f0d622400.sql <<< --

-- =========================
-- PRODUCT CATEGORIES (WordPress-style hierarchical)
-- =========================
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  description TEXT,
  industry_assignments TEXT[] NOT NULL DEFAULT '{}',
  inherit_expiry BOOLEAN NOT NULL DEFAULT false,
  inherit_batch BOOLEAN NOT NULL DEFAULT false,
  inherit_barcode BOOLEAN NOT NULL DEFAULT false,
  inherit_alerts BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage product categories - select"
  ON public.product_categories FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage product categories - insert"
  ON public.product_categories FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage product categories - update"
  ON public.product_categories FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage product categories - delete"
  ON public.product_categories FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Auth users can read active product categories"
  ON public.product_categories FOR SELECT TO authenticated
  USING (status = 'active');

CREATE TRIGGER product_categories_set_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================
-- PRICING PLANS
-- =========================
CREATE TABLE public.pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  monthly_price NUMERIC NOT NULL DEFAULT 0,
  yearly_price NUMERIC NOT NULL DEFAULT 0,
  lifetime_price NUMERIC NOT NULL DEFAULT 0,
  features TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  payment_method_synced BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage pricing plans - select" ON public.pricing_plans FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins manage pricing plans - insert" ON public.pricing_plans FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins manage pricing plans - update" ON public.pricing_plans FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins manage pricing plans - delete" ON public.pricing_plans FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Anyone can read active pricing plans" ON public.pricing_plans FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE TRIGGER pricing_plans_set_updated_at BEFORE UPDATE ON public.pricing_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================
-- SUBSCRIPTIONS
-- =========================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID,
  owner_user_id UUID NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  cycle TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'active',
  amount NUMERIC NOT NULL DEFAULT 0,
  next_billing_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins write subscriptions ins" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins write subscriptions upd" ON public.subscriptions FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins write subscriptions del" ON public.subscriptions FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Owners read own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);
CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================
-- INVOICES
-- =========================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  business_id UUID,
  owner_user_id UUID,
  client_name TEXT NOT NULL,
  billing_email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  payment_method TEXT NOT NULL DEFAULT 'N/A',
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read invoices" ON public.invoices FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins ins invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins upd invoices" ON public.invoices FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins del invoices" ON public.invoices FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Owners read own invoices" ON public.invoices FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);
CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================
-- REFUND REQUESTS
-- =========================
CREATE TABLE public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT NOT NULL UNIQUE,
  business_id UUID,
  owner_user_id UUID NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read refunds" ON public.refund_requests FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins upd refunds" ON public.refund_requests FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins del refunds" ON public.refund_requests FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Owners read own refunds" ON public.refund_requests FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "Owners create own refunds" ON public.refund_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);
CREATE TRIGGER refund_requests_set_updated_at BEFORE UPDATE ON public.refund_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pricing_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.refund_requests;



-- >>> Migration: 20260507041603_095ab2b0-f7f9-4754-becd-6f47f01db509.sql <<< --

-- =========================================================
-- SUPPORT TICKETS
-- =========================================================
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE DEFAULT ('T-' || lpad((floor(random()*90000)+10000)::text, 5, '0')),
  owner_user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to_user_id UUID,
  source TEXT NOT NULL DEFAULT 'user_panel',
  contact_submission_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own tickets" ON public.support_tickets FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "Owners create own tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Admins read all tickets" ON public.support_tickets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update tickets" ON public.support_tickets FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete tickets" ON public.support_tickets FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================================================
-- TICKET MESSAGES
-- =========================================================
CREATE TABLE public.ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own ticket messages" ON public.ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.owner_user_id = auth.uid()));
CREATE POLICY "Owners create own ticket messages" ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_user_id AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.owner_user_id = auth.uid()));
CREATE POLICY "Admins read all messages" ON public.ticket_messages FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins create messages" ON public.ticket_messages FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete messages" ON public.ticket_messages FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- REPLY TEMPLATES
-- =========================================================
-- [Dropped redundant table reply_templates] (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reply_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage reply templates - select" ON public.reply_templates FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage reply templates - insert" ON public.reply_templates FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage reply templates - update" ON public.reply_templates FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage reply templates - delete" ON public.reply_templates FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_reply_templates_updated_at BEFORE UPDATE ON public.reply_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================================================
-- ANNOUNCEMENTS
-- =========================================================
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all', -- all | public | users | admins
  position TEXT NOT NULL DEFAULT 'top',
  variant TEXT NOT NULL DEFAULT 'info', -- info | success | warning | promo
  link_url TEXT,
  link_label TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read active announcements" ON public.announcements FOR SELECT TO anon, authenticated
  USING (is_active = true AND (ends_at IS NULL OR ends_at > now()) AND starts_at <= now());
CREATE POLICY "Admins manage announcements - all" ON public.announcements FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================================================
-- KNOWLEDGE BASE ARTICLES
-- =========================================================
-- [Dropped redundant table knowledge_base_articles] (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  page_assignments TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active KB" ON public.knowledge_base_articles FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins manage KB - all" ON public.knowledge_base_articles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_kb_updated_at BEFORE UPDATE ON public.knowledge_base_articles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================================================
-- SUPPORT TEAM MEMBERS
-- =========================================================
-- [Dropped redundant table support_team_members] (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'agent', -- agent | lead | manager
  is_active BOOLEAN NOT NULL DEFAULT true,
  appointed_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.support_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage support team - all" ON public.support_team_members FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Members read own row" ON public.support_team_members FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_team_updated_at BEFORE UPDATE ON public.support_team_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================================================
-- SUPPORT AUTOMATION SETTINGS (single row)
-- =========================================================
-- [Dropped redundant table reply_templates](id) ON DELETE SET NULL,
  auto_feedback_reply_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_feedback_template_ids UUID[] NOT NULL DEFAULT '{}',
  ai_auto_reply_enabled BOOLEAN NOT NULL DEFAULT false,
  ai_auto_reply_after_hours INTEGER NOT NULL DEFAULT 24,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.support_automation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage automation - all" ON public.support_automation_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_automation_updated_at BEFORE UPDATE ON public.support_automation_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
INSERT INTO public.support_automation_settings (id) VALUES (gen_random_uuid());

-- =========================================================
-- FEATURE MODULES
-- =========================================================
CREATE TABLE public.feature_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  function_group TEXT NOT NULL DEFAULT 'core', -- inventory|pos|finance|ai|reports|users|core
  description TEXT,
  source_file_url TEXT,
  lifecycle_phase TEXT NOT NULL DEFAULT 'live', -- live|beta|staging|deactivated
  global_active BOOLEAN NOT NULL DEFAULT true,
  plan_free BOOLEAN NOT NULL DEFAULT false,
  plan_standard BOOLEAN NOT NULL DEFAULT false,
  plan_premium BOOLEAN NOT NULL DEFAULT true,
  health TEXT NOT NULL DEFAULT 'high', -- extreme|high|medium|low|none
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feature_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read active features" ON public.feature_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage features - all" ON public.feature_modules FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_features_updated_at BEFORE UPDATE ON public.feature_modules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================================================
-- PLAN LIMITS
-- =========================================================
CREATE TABLE public.plan_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_key TEXT NOT NULL, -- free|standard|premium|lifetime
  resource_key TEXT NOT NULL, -- products|branches|low_stock|out_of_stock|reports_days|team_members
  label TEXT NOT NULL,
  limit_value INTEGER, -- NULL means unlimited
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_key, resource_key)
);
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read plan limits" ON public.plan_limits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage plan limits - all" ON public.plan_limits FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_plan_limits_updated_at BEFORE UPDATE ON public.plan_limits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Seed default plan limits matching the original plan spec
INSERT INTO public.plan_limits (plan_key, resource_key, label, limit_value, is_locked) VALUES
  ('free','products','Inventory Products',50,false),
  ('free','branches','Branches',1,false),
  ('free','low_stock','Low Stock Items',5,false),
  ('free','out_of_stock','Out of Stock Items',5,false),
  ('free','reports_days','Reports History (days)',7,false),
  ('free','team_members','Team Members',0,true),
  ('standard','products','Inventory Products',100,false),
  ('standard','branches','Branches',3,false),
  ('standard','low_stock','Low Stock Items',25,false),
  ('standard','out_of_stock','Out of Stock Items',25,false),
  ('standard','reports_days','Reports History (days)',30,false),
  ('standard','team_members','Team Members',5,false),
  ('premium','products','Inventory Products',NULL,false),
  ('premium','branches','Branches',NULL,false),
  ('premium','low_stock','Low Stock Items',NULL,false),
  ('premium','out_of_stock','Out of Stock Items',NULL,false),
  ('premium','reports_days','Reports History (days)',NULL,false),
  ('premium','team_members','Team Members',NULL,false),
  ('lifetime','products','Inventory Products',NULL,false),
  ('lifetime','branches','Branches',NULL,false),
  ('lifetime','low_stock','Low Stock Items',NULL,false),
  ('lifetime','out_of_stock','Out of Stock Items',NULL,false),
  ('lifetime','reports_days','Reports History (days)',NULL,false),
  ('lifetime','team_members','Team Members',NULL,false);

-- =========================================================
-- PRICING PLANS: badge fields
-- =========================================================
ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS badge_text TEXT,
  ADD COLUMN IF NOT EXISTS badge_position TEXT NOT NULL DEFAULT 'top',
  ADD COLUMN IF NOT EXISTS badge_cycle TEXT NOT NULL DEFAULT 'all'; -- monthly|yearly|lifetime|all

-- =========================================================
-- REALTIME
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reply_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.knowledge_base_articles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_automation_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feature_modules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_limits;



-- >>> Migration: 20260602160459_4841be8b-dace-4e30-ab52-7415dc95483f.sql <<< --
-- Singleton global platform settings driving branding, fiscal, security & alert config
CREATE TABLE public.platform_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  -- General
  app_name text NOT NULL DEFAULT 'GeFlow Enterprise',
  interface_language text NOT NULL DEFAULT 'en-US',
  system_timezone text NOT NULL DEFAULT 'GMT+5:00',
  multi_business boolean NOT NULL DEFAULT true,
  global_branch_sync boolean NOT NULL DEFAULT true,
  api_maintenance boolean NOT NULL DEFAULT false,
  -- Branding
  logo_url text,
  primary_accent text NOT NULL DEFAULT '#50c8fb',
  secondary_accent text NOT NULL DEFAULT '#bf83ce',
  default_theme text NOT NULL DEFAULT 'light',
  white_label boolean NOT NULL DEFAULT false,
  -- Billing
  base_currency text NOT NULL DEFAULT 'USD',
  universal_tax numeric NOT NULL DEFAULT 15,
  invoice_prefix text NOT NULL DEFAULT 'GEF-ARCH-',
  automated_tax_receipts boolean NOT NULL DEFAULT true,
  -- Security
  admin_2fa boolean NOT NULL DEFAULT true,
  global_ip_guard boolean NOT NULL DEFAULT false,
  hardware_key boolean NOT NULL DEFAULT false,
  min_pass_length integer NOT NULL DEFAULT 14,
  session_ttl integer NOT NULL DEFAULT 12,
  -- Alerts (per-event channel toggles)
  alerts jsonb NOT NULL DEFAULT '{
    "global_instance_deploy": {"email": true, "push": true},
    "revenue_milestone": {"email": true, "push": true},
    "failed_payment": {"email": true, "push": true},
    "high_priority_ticket": {"email": true, "slack": true},
    "system_anomaly": {"email": true, "slack": true},
    "suspicious_auth": {"email": true, "slack": true}
  }'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert platform settings"
  ON public.platform_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update platform settings"
  ON public.platform_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Seed the singleton row
INSERT INTO public.platform_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_settings;


-- >>> Migration: 20260602162358_798b0f34-2e7b-44eb-a4f9-54b2e03b052c.sql <<< --
-- 1) Lock down SECURITY DEFINER helper functions from public/anon execution
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
-- has_role must remain callable by authenticated for RLS policy evaluation
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- 2) feature_modules: remove broad authenticated read; only admins read this table
DROP POLICY IF EXISTS "Auth read active features" ON public.feature_modules;

-- 3) business_categories: make the defaults trigger bypass RLS so we can restrict reads
CREATE OR REPLACE FUNCTION public.apply_business_category_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  category_row public.business_categories%ROWTYPE;
BEGIN
  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO category_row
  FROM public.business_categories
  WHERE id = NEW.category_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected business category does not exist';
  END IF;

  NEW.currency := category_row.currency;
  NEW.default_tax := category_row.default_tax;
  NEW.stock_alert_limit := category_row.stock_alert_limit;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.apply_business_category_defaults() FROM PUBLIC, anon, authenticated;

-- Remove the policy that exposed internal_description to all authenticated users
DROP POLICY IF EXISTS "Authenticated users can read active business categories" ON public.business_categories;

-- Safe, column-limited view for non-admin consumers (excludes internal_description)
CREATE OR REPLACE VIEW public.business_categories_public
WITH (security_invoker = false) AS
SELECT
  id,
  name,
  industry_type,
  currency,
  default_tax,
  stock_alert_limit,
  enabled_modules,
  enabled_features,
  status
FROM public.business_categories
WHERE status = 'active';

REVOKE ALL ON public.business_categories_public FROM PUBLIC, anon;
GRANT SELECT ON public.business_categories_public TO authenticated;


-- >>> Migration: 20260602162637_92b0d0e4-56b6-411c-aac9-2b738abe0a20.sql <<< --
-- Remove the definer view from the prior migration
DROP VIEW IF EXISTS public.business_categories_public;

-- Admin-only table to hold internal category notes
-- [Dropped redundant table business_category_internal] (
  category_id uuid PRIMARY KEY REFERENCES public.business_categories(id) ON DELETE CASCADE,
  internal_description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_category_internal TO authenticated;
GRANT ALL ON public.business_category_internal TO service_role;

ALTER TABLE public.business_category_internal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage category internal notes"
ON public.business_category_internal
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Migrate existing internal notes
INSERT INTO public.business_category_internal (category_id, internal_description)
SELECT id, internal_description
FROM public.business_categories
WHERE internal_description IS NOT NULL
ON CONFLICT (category_id) DO NOTHING;

-- Drop the sensitive column from the main table
ALTER TABLE public.business_categories DROP COLUMN IF EXISTS internal_description;

-- Restore safe read access for signed-in users (no sensitive column remains)
DROP POLICY IF EXISTS "Authenticated users can read active business categories" ON public.business_categories;
CREATE POLICY "Authenticated users can read active business categories"
ON public.business_categories
FOR SELECT
TO authenticated
USING (status = 'active');

-- Keep realtime for the new table consistent with the rest of the app
ALTER PUBLICATION supabase_realtime ADD TABLE public.business_category_internal;


-- >>> Migration: 20260602163950_e3729818-3890-43de-8974-63722d04955d.sql <<< --
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS favicon_url text;


-- >>> Migration: 20260603151607_055a8d6e-30af-41ff-b778-39c3b6b0586c.sql <<< --
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  applies_to_plan TEXT,
  min_amount NUMERIC NOT NULL DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.coupons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Public (incl. unauthenticated checkout) can read only active coupons
CREATE POLICY "Active coupons are publicly readable"
ON public.coupons FOR SELECT
USING (active = true);

-- Admins can read everything
CREATE POLICY "Admins can view all coupons"
ON public.coupons FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create coupons"
ON public.coupons FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update coupons"
ON public.coupons FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete coupons"
ON public.coupons FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER PUBLICATION supabase_realtime ADD TABLE public.coupons;

INSERT INTO public.coupons (code, description, discount_type, discount_value, active) VALUES
('GEFLOW10', 'Launch discount', 'percent', 10, true),
('GEFLOW20', 'Loyalty discount', 'percent', 20, true),
('LAUNCH50', 'Mega launch offer', 'percent', 50, true);


-- >>> Migration: 20260604150124_ef9963e8-ba74-4292-ab36-8489aaefd56c.sql <<< --
-- ============================================================
-- 1) PLATFORM SETTINGS: restrict full table to admins, expose
--    only branding/display fields via a public read-only view.
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;

CREATE POLICY "Admins can read platform settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Public branding view (only safe, display-facing columns)
CREATE OR REPLACE VIEW public.public_platform_settings
WITH (security_invoker = false) AS
SELECT
  id,
  app_name,
  interface_language,
  logo_url,
  favicon_url,
  primary_accent,
  secondary_accent,
  default_theme
FROM public.platform_settings;

GRANT SELECT ON public.public_platform_settings TO anon, authenticated;

-- ============================================================
-- 2) COUPONS: remove public table read; validate by code via
--    a SECURITY DEFINER function that returns only the result.
-- ============================================================
DROP POLICY IF EXISTS "Active coupons are publicly readable" ON public.coupons;

CREATE OR REPLACE FUNCTION public.validate_coupon(
  _code text,
  _plan text,
  _subtotal numeric
)
RETURNS TABLE (
  valid boolean,
  reason text,
  discount_type text,
  discount_value numeric,
  amount numeric,
  label text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.coupons%ROWTYPE;
  v_amount numeric := 0;
  v_label text := '';
BEGIN
  SELECT * INTO c
  FROM public.coupons
  WHERE upper(code) = upper(btrim(_code))
    AND active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid or expired coupon code.', NULL::text, NULL::numeric, NULL::numeric, NULL::text;
    RETURN;
  END IF;

  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN QUERY SELECT false, 'This coupon has expired.', NULL::text, NULL::numeric, NULL::numeric, NULL::text;
    RETURN;
  END IF;

  IF c.starts_at IS NOT NULL AND c.starts_at > now() THEN
    RETURN QUERY SELECT false, 'This coupon is not active yet.', NULL::text, NULL::numeric, NULL::numeric, NULL::text;
    RETURN;
  END IF;

  IF c.max_uses IS NOT NULL AND c.used_count >= c.max_uses THEN
    RETURN QUERY SELECT false, 'This coupon has reached its usage limit.', NULL::text, NULL::numeric, NULL::numeric, NULL::text;
    RETURN;
  END IF;

  IF c.applies_to_plan IS NOT NULL AND c.applies_to_plan <> _plan THEN
    RETURN QUERY SELECT false, 'This coupon only applies to the ' || c.applies_to_plan || ' plan.', NULL::text, NULL::numeric, NULL::numeric, NULL::text;
    RETURN;
  END IF;

  IF c.min_amount IS NOT NULL AND _subtotal < c.min_amount THEN
    RETURN QUERY SELECT false, 'Requires a minimum order of $' || to_char(c.min_amount, 'FM999999990.00') || '.', NULL::text, NULL::numeric, NULL::numeric, NULL::text;
    RETURN;
  END IF;

  IF c.discount_type = 'fixed' THEN
    v_amount := least(c.discount_value, _subtotal);
    v_label := '$' || to_char(c.discount_value, 'FM999999990.00') || ' off';
  ELSE
    v_amount := round(_subtotal * (c.discount_value / 100.0), 2);
    v_label := to_char(c.discount_value, 'FM999999990.##') || '% off';
  END IF;

  RETURN QUERY SELECT true, NULL::text, c.discount_type, c.discount_value, v_amount, v_label;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_coupon(text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, text, numeric) TO anon, authenticated;


-- >>> Migration: 20260604150201_48eb1562-4728-4cd2-b37b-b347ae11b10f.sql <<< --
DROP VIEW IF EXISTS public.public_platform_settings;

CREATE OR REPLACE FUNCTION public.get_public_platform_settings()
RETURNS TABLE (
  id uuid,
  app_name text,
  interface_language text,
  logo_url text,
  favicon_url text,
  primary_accent text,
  secondary_accent text,
  default_theme text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id,
    app_name,
    interface_language,
    logo_url,
    favicon_url,
    primary_accent,
    secondary_accent,
    default_theme
  FROM public.platform_settings
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_platform_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_platform_settings() TO anon, authenticated;


-- >>> Migration: 20260604163128_1df1e9a1-0181-4667-8b6c-acab40c7e3d5.sql <<< --

-- ========== PRODUCTS ==========
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  internal_sku text,
  description text,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  purchase_cost numeric NOT NULL DEFAULT 0,
  retail_price numeric NOT NULL DEFAULT 0,
  discount_price numeric,
  stock_units integer NOT NULL DEFAULT 0,
  min_stock_alert integer NOT NULL DEFAULT 10,
  batch_number text,
  expiry_date date,
  barcode text,
  status text NOT NULL DEFAULT 'active',
  images text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their products"
  ON public.products FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE INDEX idx_products_business ON public.products(business_id);
CREATE INDEX idx_products_owner ON public.products(owner_user_id);

-- ========== STOCK MOVEMENTS ==========
CREATE TABLE public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'in',
  quantity integer NOT NULL DEFAULT 0,
  reason text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their stock movements"
  ON public.stock_movements FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_owner ON public.stock_movements(owner_user_id);

-- ========== SALES ==========
CREATE TABLE public.sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  total numeric NOT NULL DEFAULT 0,
  profit numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  processed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their sales"
  ON public.sales FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE INDEX idx_sales_business ON public.sales(business_id);
CREATE INDEX idx_sales_owner ON public.sales(owner_user_id);

-- ========== SALE ITEMS ==========
CREATE TABLE public.sale_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  owner_user_id uuid NOT NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their sale items"
  ON public.sale_items FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);

-- ========== updated_at triggers ==========
CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ========== realtime ==========
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_items;



-- >>> Migration: 20260605153936_da93e189-74bf-46a1-9355-e23535805260.sql <<< --
-- 1. Always create new users on the free plan; ignore any client-supplied plan metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, plan)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email,
    'free'
  );

  IF lower(NEW.email) = 'gepardwebs@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Prevent non-admin users from changing privileged profile columns
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Service role / system context (no JWT) and admins may change anything
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Non-admin self-updates: force privileged columns back to their stored values
  NEW.plan := OLD.plan;
  NEW.status := OLD.status;
  NEW.usage := OLD.usage;
  NEW.listed_products := OLD.listed_products;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_profile_columns_trg ON public.profiles;
CREATE TRIGGER protect_profile_columns_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_columns();


-- >>> Migration: 20260607152053_22b7dbee-8244-4fcc-a668-20aefd8ccede.sql <<< --
-- 1. New columns on platform_settings
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS maintenance_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_message text;

-- 2. Public, safe mirror of user-facing settings
CREATE TABLE IF NOT EXISTS public.public_settings (
  id uuid PRIMARY KEY,
  app_name text,
  tagline text,
  interface_language text,
  logo_url text,
  favicon_url text,
  primary_accent text,
  secondary_accent text,
  default_theme text,
  base_currency text,
  universal_tax numeric,
  invoice_prefix text,
  system_timezone text,
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.public_settings TO anon, authenticated;
GRANT ALL ON public.public_settings TO service_role;

ALTER TABLE public.public_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read public settings" ON public.public_settings;
CREATE POLICY "Anyone can read public settings"
  ON public.public_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- 3. Keep the mirror in sync with platform_settings
CREATE OR REPLACE FUNCTION public.sync_public_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.public_settings (
    id, app_name, tagline, interface_language, logo_url, favicon_url,
    primary_accent, secondary_accent, default_theme, base_currency,
    universal_tax, invoice_prefix, system_timezone, maintenance_mode,
    maintenance_message, updated_at
  )
  VALUES (
    NEW.id, NEW.app_name, NEW.tagline, NEW.interface_language, NEW.logo_url, NEW.favicon_url,
    NEW.primary_accent, NEW.secondary_accent, NEW.default_theme, NEW.base_currency,
    NEW.universal_tax, NEW.invoice_prefix, NEW.system_timezone, NEW.maintenance_mode,
    NEW.maintenance_message, now()
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
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_public_settings ON public.platform_settings;
CREATE TRIGGER trg_sync_public_settings
  AFTER INSERT OR UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.sync_public_settings();

-- 4. Realtime for the mirror
ALTER PUBLICATION supabase_realtime ADD TABLE public.public_settings;

-- 5. Backfill from existing settings
INSERT INTO public.public_settings (
  id, app_name, tagline, interface_language, logo_url, favicon_url,
  primary_accent, secondary_accent, default_theme, base_currency,
  universal_tax, invoice_prefix, system_timezone, maintenance_mode,
  maintenance_message, updated_at
)
SELECT
  id, app_name, tagline, interface_language, logo_url, favicon_url,
  primary_accent, secondary_accent, default_theme, base_currency,
  universal_tax, invoice_prefix, system_timezone, maintenance_mode,
  maintenance_message, now()
FROM public.platform_settings
ON CONFLICT (id) DO UPDATE SET updated_at = now();

-- 6. Let authenticated users read feature flags (for live feature gating)
GRANT SELECT ON public.feature_modules TO authenticated;
DROP POLICY IF EXISTS "Authenticated can read feature modules" ON public.feature_modules;
CREATE POLICY "Authenticated can read feature modules"
  ON public.feature_modules FOR SELECT
  TO authenticated
  USING (true);


-- >>> Migration: 20260701180239_5655f787-f534-4377-8ce0-ca1c7c5e06f0.sql <<< --
-- ============================================================
-- FIX 1: product-images storage bucket access control
-- Add owner-scoped RLS policies on storage.objects so authenticated
-- users can only access files inside their own {auth.uid()} folder.
-- ============================================================

DROP POLICY IF EXISTS "Users can read own product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;

CREATE POLICY "Users can read own product images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload own product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- FIX 2: Stop broadcasting sensitive admin-only tables over Realtime
-- These tables hold platform security config, discount codes, and
-- internal admin content. Removing them from the Realtime publication
-- prevents any authenticated subscriber from receiving their change
-- payloads. Admin pages still load this data on mount via RLS-guarded
-- queries; only live auto-refresh is dropped for these config tables.
-- ============================================================

ALTER PUBLICATION supabase_realtime DROP TABLE public.platform_settings;
ALTER PUBLICATION supabase_realtime DROP TABLE public.coupons;
ALTER PUBLICATION supabase_realtime DROP TABLE public.business_category_internal;
ALTER PUBLICATION supabase_realtime DROP TABLE public.reply_templates;
ALTER PUBLICATION supabase_realtime DROP TABLE public.support_automation_settings;


-- >>> Migration: 20260704144246_09ffdb22-b8cf-47c6-8918-56d4a25597ef.sql <<< --
-- Functional support auto-reply engine.
-- When a new ticket is created, if the admin has enabled auto-reply and chosen a
-- template, an automatic "Support Team" reply is posted instantly.
CREATE OR REPLACE FUNCTION public.support_auto_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.support_automation_settings%ROWTYPE;
  tmpl text;
  admin_id uuid;
BEGIN
  SELECT * INTO s FROM public.support_automation_settings LIMIT 1;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Feedback / contact-originated tickets first
  IF NEW.source IN ('contact_form', 'feedback')
     AND s.auto_feedback_reply_enabled
     AND array_length(s.auto_feedback_template_ids, 1) >= 1 THEN
    SELECT body INTO tmpl
    FROM public.reply_templates
    WHERE id = s.auto_feedback_template_ids[1];
  END IF;

  -- Standard auto-reply
  IF tmpl IS NULL AND s.auto_reply_enabled AND s.auto_reply_template_id IS NOT NULL THEN
    SELECT body INTO tmpl
    FROM public.reply_templates
    WHERE id = s.auto_reply_template_id;
  END IF;

  IF tmpl IS NULL OR btrim(tmpl) = '' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF admin_id IS NULL THEN
    admin_id := NEW.owner_user_id;
  END IF;

  INSERT INTO public.ticket_messages (ticket_id, author_user_id, is_admin, body)
  VALUES (NEW.id, admin_id, true, tmpl);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_auto_reply ON public.support_tickets;
CREATE TRIGGER trg_support_auto_reply
AFTER INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.support_auto_reply();


-- >>> Migration: 20260705145359_ec0b6f14-ebc6-4b3c-856d-175d0dfb76d4.sql <<< --

CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  supplier_name TEXT NOT NULL DEFAULT '',
  invoice_ref TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchases_business ON public.purchases(business_id);
CREATE INDEX idx_purchases_owner ON public.purchases(owner_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their purchases"
  ON public.purchases FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE TABLE public.purchase_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  sale_price NUMERIC NOT NULL DEFAULT 0,
  batch_number TEXT,
  expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_items_purchase ON public.purchase_items(purchase_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;

ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their purchase items"
  ON public.purchase_items FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);



-- >>> Migration: 20260706144032_7b1cd3d1-aa90-4632-a40d-a0b7d3900d8a.sql <<< --
-- Keep public_settings mirror in sync with platform_settings
DROP TRIGGER IF EXISTS platform_settings_sync ON public.platform_settings;
CREATE TRIGGER platform_settings_sync
AFTER INSERT OR UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.sync_public_settings();

-- One-time backfill so public_settings reflects current config
UPDATE public.platform_settings SET updated_at = now();

-- Enable realtime for panel-subscribed tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'announcements','feature_modules','businesses','profiles',
    'platform_settings','public_settings','products','sales','sale_items'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;


-- >>> Migration: 20260707150107_fa3d761e-f5e4-45ca-877d-19e652ab1228.sql <<< --
CREATE OR REPLACE FUNCTION public.increment_business_ai_usage(_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.businesses
  SET usage = COALESCE(usage, 0) + 1,
      last_active = now()
  WHERE id = _business_id
    AND owner_user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_business_ai_usage(uuid) TO authenticated;


-- >>> Migration: 20260802151017_c549b78c-e03e-43be-9541-7f702cb850e5.sql <<< --
-- 1. Public, sanitized mirror of feature_modules
-- [Dropped redundant table public_feature_modules] (
  id uuid PRIMARY KEY,
  module_code text NOT NULL,
  name text NOT NULL,
  function_group text NOT NULL,
  description text,
  global_active boolean NOT NULL DEFAULT true,
  plan_free boolean NOT NULL DEFAULT false,
  plan_standard boolean NOT NULL DEFAULT false,
  plan_premium boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.public_feature_modules TO anon;
GRANT SELECT ON public.public_feature_modules TO authenticated;
GRANT ALL ON public.public_feature_modules TO service_role;

ALTER TABLE public.public_feature_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read public feature modules" ON public.public_feature_modules;
CREATE POLICY "Anyone can read public feature modules"
  ON public.public_feature_modules FOR SELECT USING (true);

-- 2. Sync trigger from feature_modules -> public_feature_modules
CREATE OR REPLACE FUNCTION public.sync_public_feature_modules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.public_feature_modules WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.public_feature_modules (
    id, module_code, name, function_group, description,
    global_active, plan_free, plan_standard, plan_premium, updated_at
  ) VALUES (
    NEW.id, NEW.module_code, NEW.name, NEW.function_group, NEW.description,
    NEW.global_active AND NEW.lifecycle_phase <> 'deactivated',
    NEW.plan_free, NEW.plan_standard, NEW.plan_premium, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    module_code = EXCLUDED.module_code,
    name = EXCLUDED.name,
    function_group = EXCLUDED.function_group,
    description = EXCLUDED.description,
    global_active = EXCLUDED.global_active,
    plan_free = EXCLUDED.plan_free,
    plan_standard = EXCLUDED.plan_standard,
    plan_premium = EXCLUDED.plan_premium,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_public_feature_modules ON public.feature_modules;
CREATE TRIGGER trg_sync_public_feature_modules
AFTER INSERT OR UPDATE OR DELETE ON public.feature_modules
FOR EACH ROW EXECUTE FUNCTION public.sync_public_feature_modules();

-- Backfill
INSERT INTO public.public_feature_modules (
  id, module_code, name, function_group, description,
  global_active, plan_free, plan_standard, plan_premium, updated_at
)
SELECT id, module_code, name, function_group, description,
       global_active AND lifecycle_phase <> 'deactivated',
       plan_free, plan_standard, plan_premium, now()
FROM public.feature_modules
ON CONFLICT (id) DO NOTHING;

-- 3. Lock down the internal table: admins only
DROP POLICY IF EXISTS "Authenticated can read feature modules" ON public.feature_modules;
DROP POLICY IF EXISTS "Admins can read feature modules" ON public.feature_modules;
CREATE POLICY "Admins can read feature modules"
  ON public.feature_modules FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Internal table no longer needs to be broadcast to every tenant
ALTER PUBLICATION supabase_realtime DROP TABLE public.feature_modules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.public_feature_modules;
ALTER TABLE public.public_feature_modules REPLICA IDENTITY FULL;

-- 4. Make sure config tables stream full change payloads
ALTER TABLE public.pricing_plans REPLICA IDENTITY FULL;
ALTER TABLE public.plan_limits REPLICA IDENTITY FULL;
ALTER TABLE public.public_settings REPLICA IDENTITY FULL;
ALTER TABLE public.business_categories REPLICA IDENTITY FULL;
ALTER TABLE public.businesses REPLICA IDENTITY FULL;
ALTER TABLE public.product_categories REPLICA IDENTITY FULL;

-- pricing_plans must be readable by anonymous visitors for landing pricing
DROP POLICY IF EXISTS "Anyone can view active pricing plans" ON public.pricing_plans;
CREATE POLICY "Anyone can view active pricing plans"
  ON public.pricing_plans FOR SELECT USING (true);



-- >>> Migration: 20260802151508_af1099a8-25a5-4d10-ad21-f31a17c57d59.sql <<< --
CREATE OR REPLACE FUNCTION public.propagate_category_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.default_tax IS DISTINCT FROM OLD.default_tax
     OR NEW.stock_alert_limit IS DISTINCT FROM OLD.stock_alert_limit THEN
    UPDATE public.businesses
    SET currency = NEW.currency,
        default_tax = NEW.default_tax,
        stock_alert_limit = NEW.stock_alert_limit,
        updated_at = now()
    WHERE category_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_category_defaults ON public.business_categories;
CREATE TRIGGER trg_propagate_category_defaults
AFTER UPDATE ON public.business_categories
FOR EACH ROW EXECUTE FUNCTION public.propagate_category_defaults();


-- >>> Migration: 20260804172324_3f9e9a75-b8a9-43fe-acea-c1c47a2d1135.sql <<< --
ALTER TABLE public.businesses ALTER COLUMN currency DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.apply_business_category_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  category_row public.business_categories%ROWTYPE;
BEGIN
  IF NEW.category_id IS NULL THEN
    NEW.currency := COALESCE(NEW.currency, 'USD');
    RETURN NEW;
  END IF;

  SELECT * INTO category_row FROM public.business_categories WHERE id = NEW.category_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected business category does not exist';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.currency := COALESCE(NEW.currency, category_row.currency);
    NEW.default_tax := category_row.default_tax;
    NEW.stock_alert_limit := category_row.stock_alert_limit;
  ELSIF NEW.category_id IS DISTINCT FROM OLD.category_id THEN
    NEW.currency := category_row.currency;
    NEW.default_tax := category_row.default_tax;
    NEW.stock_alert_limit := category_row.stock_alert_limit;
  ELSE
    NEW.currency := COALESCE(NEW.currency, OLD.currency, category_row.currency);
  END IF;

  RETURN NEW;
END;
$function$;

UPDATE public.businesses b
SET currency = c.currency,
    default_tax = c.default_tax,
    stock_alert_limit = c.stock_alert_limit,
    updated_at = now()
FROM public.business_categories c
WHERE b.category_id = c.id
  AND (b.currency IS DISTINCT FROM c.currency
       OR b.default_tax IS DISTINCT FROM c.default_tax
       OR b.stock_alert_limit IS DISTINCT FROM c.stock_alert_limit);


-- >>> Migration: 20260805150038_9f11522e-625b-4706-8625-ebb4dccf4a16.sql <<< --
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS base_currency text;
UPDATE public.businesses SET base_currency = COALESCE(base_currency, currency, 'USD');
ALTER TABLE public.businesses ALTER COLUMN base_currency SET DEFAULT 'USD';

CREATE OR REPLACE FUNCTION public.apply_business_category_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  category_row public.business_categories%ROWTYPE;
BEGIN
  IF NEW.category_id IS NULL THEN
    NEW.currency := COALESCE(NEW.currency, 'USD');
    NEW.base_currency := COALESCE(NEW.base_currency, NEW.currency);
    RETURN NEW;
  END IF;

  SELECT * INTO category_row FROM public.business_categories WHERE id = NEW.category_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected business category does not exist';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.currency := COALESCE(NEW.currency, category_row.currency);
    NEW.base_currency := COALESCE(NEW.base_currency, NEW.currency);
    NEW.default_tax := category_row.default_tax;
    NEW.stock_alert_limit := category_row.stock_alert_limit;
  ELSIF NEW.category_id IS DISTINCT FROM OLD.category_id THEN
    NEW.currency := category_row.currency;
    NEW.base_currency := COALESCE(OLD.base_currency, NEW.currency);
    NEW.default_tax := category_row.default_tax;
    NEW.stock_alert_limit := category_row.stock_alert_limit;
  ELSE
    NEW.currency := COALESCE(NEW.currency, OLD.currency, category_row.currency);
    NEW.base_currency := COALESCE(OLD.base_currency, NEW.base_currency, NEW.currency);
  END IF;

  RETURN NEW;
END;
$function$;

ALTER TABLE public.businesses REPLICA IDENTITY FULL;
ALTER TABLE public.business_categories REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.business_categories;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;


-- >>> Migration: 20260806145824_0d19cae7-3770-45cf-9b98-09c30b938efb.sql <<< --

CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_key text NOT NULL UNIQUE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'sandbox',
  public_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_gateways TO authenticated;
GRANT ALL ON public.payment_gateways TO service_role;
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payment gateways" ON public.payment_gateways FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER payment_gateways_updated_at BEFORE UPDATE ON public.payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- [Dropped redundant table public_payment_gateways] (
  id uuid PRIMARY KEY,
  gateway_key text NOT NULL UNIQUE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'sandbox',
  public_client_id text,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.public_payment_gateways TO anon, authenticated;
GRANT ALL ON public.public_payment_gateways TO service_role;
ALTER TABLE public.public_payment_gateways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read public gateways" ON public.public_payment_gateways FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.sync_public_payment_gateways()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.public_payment_gateways WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO public.public_payment_gateways (id, gateway_key, name, enabled, mode, public_client_id, sort_order, updated_at)
  VALUES (NEW.id, NEW.gateway_key, NEW.name, NEW.enabled, NEW.mode,
          COALESCE(NEW.public_config ->> 'client_id', NEW.public_config ->> 'publishable_key'), NEW.sort_order, now())
  ON CONFLICT (id) DO UPDATE SET
    gateway_key = EXCLUDED.gateway_key, name = EXCLUDED.name, enabled = EXCLUDED.enabled,
    mode = EXCLUDED.mode, public_client_id = EXCLUDED.public_client_id,
    sort_order = EXCLUDED.sort_order, updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sync_public_payment_gateways
AFTER INSERT OR UPDATE OR DELETE ON public.payment_gateways
FOR EACH ROW EXECUTE FUNCTION public.sync_public_payment_gateways();

CREATE TABLE IF NOT EXISTS public.payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retry_failed boolean NOT NULL DEFAULT true,
  retry_interval_hours integer NOT NULL DEFAULT 24,
  retry_count integer NOT NULL DEFAULT 3,
  notify_user_on_failure boolean NOT NULL DEFAULT true,
  enable_refunds boolean NOT NULL DEFAULT true,
  allow_partial_refunds boolean NOT NULL DEFAULT false,
  refund_window_days integer NOT NULL DEFAULT 14,
  include_branding boolean NOT NULL DEFAULT true,
  company_address text,
  tax_id text,
  invoice_footer text,
  multi_gateway_failover boolean NOT NULL DEFAULT true,
  sandbox_mode boolean NOT NULL DEFAULT false,
  fraud_detection boolean NOT NULL DEFAULT true,
  auto_send_invoices boolean NOT NULL DEFAULT false,
  payout_method text NOT NULL DEFAULT 'paypal',
  payout_account text,
  payout_min_amount numeric NOT NULL DEFAULT 50,
  payout_schedule text NOT NULL DEFAULT 'monthly',
  payout_currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_settings TO authenticated;
GRANT ALL ON public.payment_settings TO service_role;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payment settings" ON public.payment_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER payment_settings_updated_at BEFORE UPDATE ON public.payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
INSERT INTO public.payment_settings DEFAULT VALUES;

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  provider text NOT NULL DEFAULT 'paypal',
  provider_order_id text,
  provider_capture_id text,
  plan text NOT NULL DEFAULT 'standard',
  cycle text NOT NULL DEFAULT 'monthly',
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  payer_email text,
  method text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own transactions" ON public.payment_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins read all transactions" ON public.payment_transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER payment_transactions_updated_at BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

INSERT INTO public.payment_gateways (gateway_key, name, enabled, mode, sort_order)
VALUES ('paypal','PayPal', false, 'live', 1),
       ('stripe','Stripe', false, 'sandbox', 2),
       ('jazzcash','JazzCash', false, 'sandbox', 3),
       ('razorpay','Razorpay', false, 'sandbox', 4),
       ('bank','Manual Bank Transfer', false, 'live', 5)
ON CONFLICT (gateway_key) DO NOTHING;

ALTER TABLE public.payment_gateways REPLICA IDENTITY FULL;
ALTER TABLE public.public_payment_gateways REPLICA IDENTITY FULL;
ALTER TABLE public.payment_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.public_payment_gateways;



-- >>> Migration: 20260806145901_8eb4665b-e4fd-4642-b03a-f238198f77d9.sql <<< --

UPDATE public.payment_gateways
SET enabled = true,
    mode = 'live',
    public_config = jsonb_build_object('client_id','BAAxlkvHkBSK_FKe9MeTzSTeTyQGBrs3nTkbrWKlwRBgoy6iBFxfQtHQknHKoneEY_D-B22eJ1bjkX-LRo','card_fields', true),
    credentials = jsonb_build_object('secret','ENRaMOQHAN9R0m0zXhwNadzlveYSr4FHoxpM3NwytUwpOQ1ywPNHv9iZHco5GlG03r-kxYelpFSplgLK')
WHERE gateway_key = 'paypal';



-- >>> Migration: 20260817085000_ai_provider_configuration.sql <<< --
-- ==============================================================================
-- GEFLOW AI — PHASE 4: AI PROVIDER & MODEL CONFIGURATION MIGRATION
-- ==============================================================================

-- 1. AI Providers Registry Table
CREATE TABLE IF NOT EXISTS public.ai_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    provider_type TEXT NOT NULL DEFAULT 'model_provider', -- 'model_provider' | 'model_router'
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    health_status TEXT NOT NULL DEFAULT 'unknown', -- 'healthy' | 'unhealthy' | 'unknown'
    last_health_check TIMESTAMPTZ,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. AI Models Registry Table
CREATE TABLE IF NOT EXISTS public.ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    model_type TEXT NOT NULL DEFAULT 'text', -- 'multimodal' | 'reasoning' | 'text'
    capabilities TEXT[] NOT NULL DEFAULT '{"product_analysis", "product_verification"}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider_id, model_id)
);

-- 3. AI Provider Keys & Credential Metadata Table
-- Strictly protected: never exposed to public/anon queries
CREATE TABLE IF NOT EXISTS public.ai_provider_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL,
    key_source TEXT NOT NULL DEFAULT 'env', -- 'env' | 'database' | 'vault'
    masked_key TEXT,
    encrypted_key TEXT, -- nullable, for securely encrypted storage if needed
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider_id, key_name)
);

-- 4. API Requests Audit & Usage Log Table
CREATE TABLE IF NOT EXISTS public.api_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    business_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    task_type TEXT NOT NULL,
    status TEXT NOT NULL, -- 'success' | 'fallback' | 'error'
    latency_ms INTEGER NOT NULL DEFAULT 0,
    error_code TEXT,
    usage_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. API Daily Usage Summary Table
CREATE TABLE IF NOT EXISTS public.api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    day DATE NOT NULL DEFAULT CURRENT_DATE,
    total_requests INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    total_latency_ms BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(business_id, provider, model, day)
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all AI configuration & usage tables
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- ai_providers: Public / Authenticated read active records; Admins/Service manage
CREATE POLICY "Allow public read active ai_providers"
    ON public.ai_providers FOR SELECT
    USING (is_active = true);

-- ai_models: Public / Authenticated read active models; Admins/Service manage
CREATE POLICY "Allow public read active ai_models"
    ON public.ai_models FOR SELECT
    USING (is_active = true);

-- ai_provider_keys: STRICT SECURITY - NO PUBLIC OR ANON ACCESS
-- Only accessible via server-side service role or secure server operations
CREATE POLICY "Strict server-side only access for ai_provider_keys"
    ON public.ai_provider_keys FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- api_requests: Tenant isolation for read; Server inserts
CREATE POLICY "Allow users to read their own business api_requests"
    ON public.api_requests FOR SELECT
    TO authenticated
    USING (business_id IS NOT NULL);

-- api_usage: Tenant isolation for read; Server updates
CREATE POLICY "Allow users to read their own business api_usage"
    ON public.api_usage FOR SELECT
    TO authenticated
    USING (business_id IS NOT NULL);

-- ==============================================================================
-- SEED INITIAL PROVIDERS & MODELS
-- ==============================================================================

-- 1. Insert Providers
INSERT INTO public.ai_providers (id, name, slug, provider_type, is_active, is_default, description)
VALUES 
    ('11111111-1111-4111-a111-111111111111', 'Google Gemini', 'gemini', 'model_provider', true, true, 'Primary product extraction & categorization engine'),
    ('22222222-2222-4222-a222-222222222222', 'OpenAI', 'openai', 'model_provider', true, false, 'Primary consistency auditor & reasoning verifier'),
    ('33333333-3333-4333-a333-333333333333', 'OpenRouter', 'openrouter', 'model_router', true, false, 'Multi-model gateway & flexible fallback routing layer')
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    provider_type = EXCLUDED.provider_type,
    is_active = EXCLUDED.is_active,
    is_default = EXCLUDED.is_default,
    description = EXCLUDED.description;

-- 2. Insert Models
INSERT INTO public.ai_models (provider_id, model_id, display_name, model_type, capabilities, is_active, is_default)
VALUES
    -- Gemini models
    ('11111111-1111-4111-a111-111111111111', 'gemini-2.5-flash', 'Gemini 2.5 Flash', 'multimodal', '{"product_analysis", "product_verification"}', true, true),
    ('11111111-1111-4111-a111-111111111111', 'gemini-2.5-pro', 'Gemini 2.5 Pro', 'multimodal', '{"product_analysis", "product_verification"}', true, false),

    -- OpenAI models
    ('22222222-2222-4222-a222-222222222222', 'gpt-4o-mini', 'GPT-4o Mini', 'reasoning', '{"product_analysis", "product_verification"}', true, true),
    ('22222222-2222-4222-a222-222222222222', 'gpt-4o', 'GPT-4o', 'reasoning', '{"product_analysis", "product_verification"}', true, false),

    -- OpenRouter models
    ('33333333-3333-4333-a333-333333333333', 'meta-llama/llama-3.3-70b-instruct', 'Llama 3.3 70B Instruct', 'text', '{"product_analysis", "product_verification"}', true, true),
    ('33333333-3333-4333-a333-333333333333', 'anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet', 'multimodal', '{"product_analysis", "product_verification"}', true, false)
ON CONFLICT (provider_id, model_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    model_type = EXCLUDED.model_type,
    capabilities = EXCLUDED.capabilities,
    is_active = EXCLUDED.is_active,
    is_default = EXCLUDED.is_default;

-- 3. Insert Provider Keys Metadata (env-based sources)
INSERT INTO public.ai_provider_keys (provider_id, key_name, key_source, masked_key, is_active)
VALUES
    ('11111111-1111-4111-a111-111111111111', 'GEMINI_API_KEY', 'env', 'AIza...[ENV_CONFIGURED]', true),
    ('22222222-2222-4222-a222-222222222222', 'OPENAI_API_KEY', 'env', 'sk-...[ENV_CONFIGURED]', true),
    ('33333333-3333-4333-a333-333333333333', 'OPENROUTER_API_KEY', 'env', 'sk-or-...[ENV_CONFIGURED]', true)
ON CONFLICT (provider_id, key_name) DO UPDATE SET
    key_source = EXCLUDED.key_source,
    masked_key = EXCLUDED.masked_key,
    is_active = EXCLUDED.is_active;



-- >>> Migration: 20260904120000_add_uom_columns_to_products.sql <<< --
-- Migration: Add explicit UoM columns to public.products
-- Ensures stock_units is always tracked in Base Units (tablets, pieces, ml, etc.)

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS base_unit text DEFAULT 'piece',
ADD COLUMN IF NOT EXISTS uom text DEFAULT 'piece',
ADD COLUMN IF NOT EXISTS units_per_uom numeric DEFAULT 1;

-- Backfill from legacy description tags if available
-- 1. Extract [UOM: ...]
UPDATE public.products
SET uom = TRIM(LOWER(SUBSTRING(description FROM '\[UOM:\s*([^\]]+)\]')))
WHERE description ~* '\[UOM:\s*[^\]]+\]'
  AND (uom IS NULL OR uom = 'piece');

-- 2. Extract [SCALE: ...] or [UNITS_PER_UOM: ...] or [PACK_SIZE: ...]
UPDATE public.products
SET units_per_uom = CAST(NULLIF(TRIM(SUBSTRING(description FROM '\[(?:SCALE|UNITS_PER_UOM|PACK_SIZE):\s*([^\]]+)\]')), '') AS numeric)
WHERE description ~* '\[(?:SCALE|UNITS_PER_UOM|PACK_SIZE):\s*[^\]]+\]'
  AND (units_per_uom IS NULL OR units_per_uom = 1);

-- 3. Extract [BASE_UNIT: ...] or [SUB_UNIT: ...]
UPDATE public.products
SET base_unit = TRIM(LOWER(SUBSTRING(description FROM '\[(?:BASE_UNIT|SUB_UNIT):\s*([^\]]+)\]')))
WHERE description ~* '\[(?:BASE_UNIT|SUB_UNIT):\s*[^\]]+\]'
  AND (base_unit IS NULL OR base_unit = 'piece');

-- Add index for fast querying by UoM
CREATE INDEX IF NOT EXISTS idx_products_uom ON public.products (uom);



-- >>> Migration: 20260904121500_create_held_orders_and_ledger.sql <<< --
-- Migration: Create held_orders table and enhance stock_movements
-- Supports POS Cart Hold / Resume and full Stock Ledger tracking

-- 1. Create held_orders table for POS
CREATE TABLE IF NOT EXISTS public.held_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  customer_name text,
  customer_phone text,
  customer_note text,
  cart_data jsonb NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  item_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.held_orders TO authenticated;
GRANT ALL ON public.held_orders TO service_role;

ALTER TABLE public.held_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage held orders for their business"
  ON public.held_orders FOR ALL
  USING (
    auth.uid() = owner_user_id OR 
    EXISTS (
      SELECT 1 FROM public.business_staff 
      WHERE business_staff.business_id = held_orders.business_id 
        AND business_staff.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = owner_user_id OR 
    EXISTS (
      SELECT 1 FROM public.business_staff 
      WHERE business_staff.business_id = held_orders.business_id 
        AND business_staff.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_held_orders_business ON public.held_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_held_orders_created ON public.held_orders(created_at DESC);

-- 2. Enhance stock_movements with reference fields
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS reference_id text,
ADD COLUMN IF NOT EXISTS reference_type text,
ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON public.stock_movements(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_business_date ON public.stock_movements(business_id, created_at DESC);



-- >>> Migration: 20260913120000_migrate_hybrid_to_supabase_ssot.sql <<< --
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



-- >>> Migration: 20260915160000_fix_businesses_rls_infinite_recursion.sql <<< --
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



-- >>> Migration: 20260915170000_rewrite_businesses_rls_policies.sql <<< --
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



-- >>> Migration: 20260922080000_seed_plans_limits_features.sql <<< --
-- ============================================================================
-- GeFlow Phase 1 Step 1
-- Seed / upsert: pricing_plans + plan_limits + feature_modules
-- Source: src/lib/plans.ts + src/lib/featureCatalog.ts (latest values)
-- Safe to re-run (ON CONFLICT upsert)
-- public_feature_modules auto-fills via existing trigger
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1) pricing_plans
-- Prices admin panel se badal sakte ho; yeh starting values hain
-- --------------------------------------------------------------------------
INSERT INTO public.pricing_plans (
  plan_key,
  name,
  tagline,
  monthly_price,
  yearly_price,
  lifetime_price,
  features,
  is_active,
  is_popular,
  sort_order
) VALUES
  (
    'free',
    'Free',
    'Essential POS & inventory starter for solo store owners.',
    0,
    0,
    0,
    ARRAY[
      'Up to 50 products',
      '1 branch',
      'Basic POS',
      'Basic AI assistant',
      '7-day reports'
    ],
    true,
    false,
    1
  ),
  (
    'standard',
    'Standard',
    'Growing businesses with supplier procurement & up to 3 branches.',
    29,
    290,
    0,
    ARRAY[
      'Up to 500 products',
      '3 branches',
      'Purchases & suppliers',
      'Returns & refunds',
      '30-day reports'
    ],
    true,
    true,
    2
  ),
  (
    'premium',
    'Premium',
    'Complete retail powerhouse with Team Hub, deep analytics & up to 7 stores.',
    79,
    790,
    0,
    ARRAY[
      'Unlimited products',
      'Up to 7 branches',
      'Team Hub & RBAC',
      'Analytics dashboard',
      'Full AI suite'
    ],
    true,
    false,
    3
  ),
  (
    'lifetime',
    'Lifetime VIP',
    'Permanent VIP access, up to 10 branches & priority AI engine.',
    0,
    0,
    999,
    ARRAY[
      'Unlimited products',
      'Up to 10 branches',
      'Priority AI engine',
      'White label ready',
      'Lifetime reports'
    ],
    true,
    false,
    4
  )
ON CONFLICT (plan_key) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  monthly_price = EXCLUDED.monthly_price,
  yearly_price = EXCLUDED.yearly_price,
  lifetime_price = EXCLUDED.lifetime_price,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  is_popular = EXCLUDED.is_popular,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- --------------------------------------------------------------------------
-- 2) plan_limits  (matches latest src/lib/plans.ts)
-- limit_value NULL = unlimited
-- --------------------------------------------------------------------------
INSERT INTO public.plan_limits (plan_key, resource_key, label, limit_value, is_locked)
VALUES
  -- free
  ('free', 'products', 'Inventory Products', 50, false),
  ('free', 'branches', 'Branches', 1, false),
  ('free', 'low_stock', 'Low Stock Items', 5, false),
  ('free', 'out_of_stock', 'Out of Stock Items', 5, false),
  ('free', 'business_categories', 'Business Categories', 1, false),
  ('free', 'reports_days', 'Reports History (days)', 7, false),
  ('free', 'team_members', 'Team Members', 0, true),

  -- standard
  ('standard', 'products', 'Inventory Products', 500, false),
  ('standard', 'branches', 'Branches', 3, false),
  ('standard', 'low_stock', 'Low Stock Items', 50, false),
  ('standard', 'out_of_stock', 'Out of Stock Items', 50, false),
  ('standard', 'business_categories', 'Business Categories', 5, false),
  ('standard', 'reports_days', 'Reports History (days)', 30, false),
  ('standard', 'team_members', 'Team Members', 5, false),

  -- premium
  ('premium', 'products', 'Inventory Products', NULL, false),
  ('premium', 'branches', 'Branches', 7, false),
  ('premium', 'low_stock', 'Low Stock Items', NULL, false),
  ('premium', 'out_of_stock', 'Out of Stock Items', NULL, false),
  ('premium', 'business_categories', 'Business Categories', NULL, false),
  ('premium', 'reports_days', 'Reports History (days)', NULL, false),
  ('premium', 'team_members', 'Team Members', NULL, false),

  -- lifetime
  ('lifetime', 'products', 'Inventory Products', NULL, false),
  ('lifetime', 'branches', 'Branches', 10, false),
  ('lifetime', 'low_stock', 'Low Stock Items', NULL, false),
  ('lifetime', 'out_of_stock', 'Out of Stock Items', NULL, false),
  ('lifetime', 'business_categories', 'Business Categories', NULL, false),
  ('lifetime', 'reports_days', 'Reports History (days)', NULL, false),
  ('lifetime', 'team_members', 'Team Members', NULL, false)
ON CONFLICT (plan_key, resource_key) DO UPDATE SET
  label = EXCLUDED.label,
  limit_value = EXCLUDED.limit_value,
  is_locked = EXCLUDED.is_locked,
  updated_at = now();

-- --------------------------------------------------------------------------
-- 3) feature_modules  (all 36 from src/lib/featureCatalog.ts)
-- created_by_user_id: first admin if exists, else fixed system UUID
-- --------------------------------------------------------------------------
DO $$
DECLARE
  seed_user UUID;
BEGIN
  SELECT ur.user_id
    INTO seed_user
  FROM public.user_roles ur
  WHERE ur.role = 'admin'::public.app_role
  LIMIT 1;

  IF seed_user IS NULL THEN
    -- System seed UUID (no FK on created_by_user_id in current schema)
    seed_user := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  INSERT INTO public.feature_modules (
    module_code,
    name,
    function_group,
    description,
    lifecycle_phase,
    global_active,
    plan_free,
    plan_standard,
    plan_premium,
    health,
    latency_ms,
    created_by_user_id
  )
  SELECT
    v.module_code,
    v.name,
    v.function_group,
    v.description,
    v.lifecycle_phase,
    v.global_active,
    v.plan_free,
    v.plan_standard,
    v.plan_premium,
    v.health,
    v.latency_ms,
    seed_user
  FROM (
    VALUES
      ('F-POS-01', 'Fast POS Terminal', 'pos', 'Fast barcode scan, Cash/Card checkout, Split payments, WhatsApp & Thermal receipt printing.', 'live', true, true, true, true, 'optimal', 8),
      ('F-POS-02', 'Barcode Hardware Scanner Support', 'pos', 'USB & Bluetooth hardware barcode scanner support for instant product lookup in POS.', 'live', true, true, true, true, 'optimal', 10),
      ('F-POS-03', 'Simple POS Returns & Refund', 'pos', '1-Click return & refund button at POS for quick customer order adjustments.', 'live', true, true, true, true, 'optimal', 12),
      ('F-POS-04', 'Flat & Percentage Order Discounts', 'pos', 'Instant percentage or flat dollar discounts applied directly to checkout cart.', 'live', true, true, true, true, 'optimal', 5),
      ('F-INV-01', 'Core Inventory & Stock Control', 'inventory', 'Product catalog, categories, stock in/out adjustments and movement history.', 'live', true, true, true, true, 'optimal', 14),
      ('F-INV-02', 'Low Stock & Out-of-Stock Alerts', 'inventory', 'Configurable threshold alerts (e.g. stock < 5) to prevent sudden stock-outs.', 'live', true, true, true, true, 'optimal', 15),
      ('F-AI-01', 'Smart AI Product Autofill (Basic)', 'ai', 'Scan barcode or enter title to auto-suggest product name, category & standard pricing.', 'live', true, true, true, true, 'optimal', 60),
      ('F-AI-ANALYST', 'AI Assistant: Analyst Model', 'ai', 'Basic sales, profit & inventory intelligence. Answers real-time business health queries.', 'live', true, true, true, true, 'optimal', 45),
      ('F-AI-KNOWLEDGE', 'AI Assistant: Knowledge Model', 'ai', 'GeFlow documentation, POS setup, barcode scanner troubleshooting and system FAQs.', 'live', true, true, true, true, 'optimal', 40),
      ('F-AI-OPERATOR', 'AI Assistant: Operator Model', 'ai', 'Automated purchase drafting, stock-out reorder suggestions, and batch adjustments.', 'staging', false, false, true, true, 'high', 90),
      ('F-AI-ADVISOR', 'AI Assistant: Advisor Model', 'ai', 'Strategic margin recommendations, pricing elasticity, and predictive dead-stock warnings.', 'staging', false, false, false, true, 'high', 120),
      ('F-AI-02', '1-Click AI Summary on Reports', 'ai', 'Generate 2-sentence executive summary of today''s sales performance with 1 click.', 'live', true, true, true, true, 'optimal', 80),
      ('F-USR-01', 'Team Roles & Permissions (RBAC)', 'team', 'Role isolation: Cashier (Billing only), Inventory Clerk (Stock only), Store Owner/Manager.', 'live', true, false, true, true, 'optimal', 12),
      ('F-REP-01', 'Daily Sales & Profit Reports', 'reports', 'Daily sales totals, today''s gross profit, top selling items, and PDF/CSV downloads.', 'live', true, true, true, true, 'optimal', 22),
      ('F-COR-01', 'Multi-Branch Store Structure', 'enterprise', 'Multi-branch store architecture: 1 store on Free, 5 on Standard, up to 10 on Premium.', 'live', true, true, true, true, 'optimal', 18),
      ('F-CRM-01', 'Customer Directory & Profiles', 'crm', 'Store customer names, phone, purchase history and quick lookup at checkout.', 'live', true, false, true, true, 'optimal', 16),
      ('F-CRM-02', 'Customer Credit Khata (Udaar)', 'crm', 'Track customer credit balances, partial payments and outstanding Udaar ledger.', 'live', true, false, true, true, 'optimal', 20),
      ('F-MKT-01', 'Loyalty Points & Rewards', 'crm', 'Award loyalty points on sales and redeem rewards at POS.', 'live', true, false, true, true, 'optimal', 25),
      ('F-AI-03', 'AI Demand Forecast & Restock', 'ai', 'Predict next 30-day demand and suggest replenishment quantities.', 'live', true, false, true, true, 'high', 100),
      ('F-INV-03', 'Batch / Expiry Tracking', 'inventory', 'Track batch numbers and expiry dates with FEFO warnings.', 'live', true, false, true, true, 'optimal', 18),
      ('F-AI-04', 'AI Purchase Intelligence', 'ai', 'Smart supplier PO suggestions based on sales velocity and stock levels.', 'live', true, false, true, true, 'high', 95),
      ('F-PUR-01', 'Supplier & Purchase Orders', 'purchases', 'Supplier directory, purchase orders, receiving and purchase ledger.', 'live', true, false, true, true, 'optimal', 20),
      ('F-FIN-01', 'Profit, Expenses & Costing', 'finance', 'Gross/net profit, expense logging and product costing.', 'live', true, true, true, true, 'optimal', 18),
      ('F-REP-02', 'Scheduled AI Report Digests', 'reports', 'Email/WhatsApp scheduled digests of sales and stock health.', 'live', true, false, true, true, 'high', 40),
      ('F-INV-04', 'Barcode Label Designer', 'inventory', 'Design and batch-print custom price tag stickers & barcode labels on thermal printers.', 'staging', false, false, true, true, 'high', 25),
      ('F-ECO-01', '1-Click Online Storefront & WhatsApp Catalog', 'ecommerce', 'Instantly turn POS inventory into a customer-facing digital web catalog and WhatsApp store.', 'staging', false, false, false, true, 'high', 50),
      ('F-ECO-02', 'Live Online Order Pop-up in POS', 'ecommerce', 'Online orders from web/WhatsApp pop up in real-time on POS screen with sound alert.', 'staging', false, false, false, true, 'high', 15),
      ('F-FIN-02', 'Multi-Currency & International Tax Engine', 'finance', 'Compliant tax calculation (ZATCA e-invoicing for KSA, UAE FTA VAT, GST for India, US Sales Tax).', 'staging', false, false, true, true, 'high', 18),
      ('F-AI-05', 'AI Invoice Vision OCR Import', 'ai', 'Upload photo/PDF of paper supplier invoice to automatically extract items, qty & prices.', 'staging', false, false, false, true, 'high', 220),
      ('F-AI-06', 'AI Multi-Lingual Interface (10+ Languages)', 'ai', 'Automatic localized translation for Arabic, Urdu, Spanish, French, German, and Turkish.', 'staging', false, true, true, true, 'high', 20),
      ('F-HDW-01', 'Direct Hardware Integration (Scales & Customer Displays)', 'hardware', 'Direct RS232/USB connection for electronic weighing scales, cash drawers & dual customer monitors.', 'staging', false, false, false, true, 'high', 10),
      ('F-HDW-02', 'Offline-First PWA & Desktop App with Auto-Sync', 'hardware', 'Keep billing customers seamlessly even if internet drops; auto-syncs when online.', 'staging', false, false, true, true, 'high', 5),
      ('F-DEV-01', 'Public REST Developer API & Webhooks', 'developer', 'Connect custom ERPs, Shopify, WooCommerce, and courier delivery tracking apps.', 'staging', false, false, false, true, 'high', 12),
      ('F-INT-01', 'Accounting Software Sync (QuickBooks / Xero)', 'developer', 'Automatic end-of-day journal sync with QuickBooks, Xero, and Tally accounting ledger.', 'staging', false, false, false, true, 'high', 85),
      ('F-ENT-02', 'Enterprise Multi-Warehouse Hierarchy', 'enterprise', 'Central regional distribution warehouses supplying multiple subsidiary retail stores.', 'staging', false, false, false, true, 'high', 30),
      ('F-ENT-03', 'White Label & Custom Domain Branding', 'enterprise', 'Custom domain, custom brand logos, custom invoice color templates and removed GeFlow branding.', 'staging', false, false, false, true, 'high', 10)
  ) AS v(
    module_code, name, function_group, description, lifecycle_phase,
    global_active, plan_free, plan_standard, plan_premium, health, latency_ms
  )
  ON CONFLICT (module_code) DO UPDATE SET
    name = EXCLUDED.name,
    function_group = EXCLUDED.function_group,
    description = EXCLUDED.description,
    lifecycle_phase = EXCLUDED.lifecycle_phase,
    global_active = EXCLUDED.global_active,
    plan_free = EXCLUDED.plan_free,
    plan_standard = EXCLUDED.plan_standard,
    plan_premium = EXCLUDED.plan_premium,
    health = EXCLUDED.health,
    latency_ms = EXCLUDED.latency_ms,
    updated_at = now();
END $$;

-- --------------------------------------------------------------------------
-- 4) Ensure realtime is on for client-facing tables
-- --------------------------------------------------------------------------
ALTER TABLE public.pricing_plans REPLICA IDENTITY FULL;
ALTER TABLE public.plan_limits REPLICA IDENTITY FULL;
ALTER TABLE public.public_feature_modules REPLICA IDENTITY FULL;

-- Idempotent: add to publication if missing (ignore errors if already added)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pricing_plans;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_limits;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.public_feature_modules;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;


-- >>> Migration: 20260922090000_email_template_configs.sql <<< --
-- Email template custom configs (admin visual builder)
-- Source of truth for subject/branding/CTA overrides — no localStorage

CREATE TABLE IF NOT EXISTS public.email_template_configs (
  template_id TEXT PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.email_template_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read email template configs" ON public.email_template_configs;
CREATE POLICY "Anyone can read email template configs"
  ON public.email_template_configs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage email template configs" ON public.email_template_configs;
CREATE POLICY "Admins manage email template configs"
  ON public.email_template_configs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

ALTER TABLE public.email_template_configs REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.email_template_configs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;


-- >>> Migration: 20260922091000_businesses_extended_settings.sql <<< --
-- Store per-business extended settings (timezone, POS, inventory flags, etc.)
-- Replaces localStorage geflow.biz_ext.*

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS extended_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.businesses.extended_settings IS
  'BusinessExtendedData: timezone, tax, inventory toggles, POS receipt, location, etc.';



-- Drop any redundant collections
DROP TABLE IF EXISTS public.public_feature_modules CASCADE;
DROP TABLE IF EXISTS public.public_payment_gateways CASCADE;
DROP TABLE IF EXISTS public.business_category_internal CASCADE;
DROP TABLE IF EXISTS public.knowledge_base_articles CASCADE;
DROP TABLE IF EXISTS public.reply_templates CASCADE;
DROP TABLE IF EXISTS public.support_automation_settings CASCADE;
DROP TABLE IF EXISTS public.support_team_members CASCADE;
