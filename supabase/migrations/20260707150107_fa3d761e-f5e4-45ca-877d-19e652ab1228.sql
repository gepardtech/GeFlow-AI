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