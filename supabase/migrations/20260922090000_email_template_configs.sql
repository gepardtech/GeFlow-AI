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