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