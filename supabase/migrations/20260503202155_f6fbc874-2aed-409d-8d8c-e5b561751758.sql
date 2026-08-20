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