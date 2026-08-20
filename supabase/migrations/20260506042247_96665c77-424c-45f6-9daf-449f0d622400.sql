
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
