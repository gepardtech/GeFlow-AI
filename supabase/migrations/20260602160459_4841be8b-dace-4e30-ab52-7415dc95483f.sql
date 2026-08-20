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