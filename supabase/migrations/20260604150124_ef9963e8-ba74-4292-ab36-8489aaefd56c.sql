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