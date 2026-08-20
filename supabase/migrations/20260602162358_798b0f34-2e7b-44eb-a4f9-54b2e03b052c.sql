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