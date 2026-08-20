ALTER TABLE public.businesses ALTER COLUMN currency DROP DEFAULT;

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
    NEW.currency := COALESCE(NEW.currency, 'USD');
    RETURN NEW;
  END IF;

  SELECT * INTO category_row FROM public.business_categories WHERE id = NEW.category_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected business category does not exist';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.currency := COALESCE(NEW.currency, category_row.currency);
    NEW.default_tax := category_row.default_tax;
    NEW.stock_alert_limit := category_row.stock_alert_limit;
  ELSIF NEW.category_id IS DISTINCT FROM OLD.category_id THEN
    NEW.currency := category_row.currency;
    NEW.default_tax := category_row.default_tax;
    NEW.stock_alert_limit := category_row.stock_alert_limit;
  ELSE
    NEW.currency := COALESCE(NEW.currency, OLD.currency, category_row.currency);
  END IF;

  RETURN NEW;
END;
$function$;

UPDATE public.businesses b
SET currency = c.currency,
    default_tax = c.default_tax,
    stock_alert_limit = c.stock_alert_limit,
    updated_at = now()
FROM public.business_categories c
WHERE b.category_id = c.id
  AND (b.currency IS DISTINCT FROM c.currency
       OR b.default_tax IS DISTINCT FROM c.default_tax
       OR b.stock_alert_limit IS DISTINCT FROM c.stock_alert_limit);