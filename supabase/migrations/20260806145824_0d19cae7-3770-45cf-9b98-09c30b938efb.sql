
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

CREATE TABLE IF NOT EXISTS public.public_payment_gateways (
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
