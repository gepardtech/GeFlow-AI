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