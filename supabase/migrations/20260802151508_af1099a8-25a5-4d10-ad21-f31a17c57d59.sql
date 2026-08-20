CREATE OR REPLACE FUNCTION public.propagate_category_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.default_tax IS DISTINCT FROM OLD.default_tax
     OR NEW.stock_alert_limit IS DISTINCT FROM OLD.stock_alert_limit THEN
    UPDATE public.businesses
    SET currency = NEW.currency,
        default_tax = NEW.default_tax,
        stock_alert_limit = NEW.stock_alert_limit,
        updated_at = now()
    WHERE category_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_category_defaults ON public.business_categories;
CREATE TRIGGER trg_propagate_category_defaults
AFTER UPDATE ON public.business_categories
FOR EACH ROW EXECUTE FUNCTION public.propagate_category_defaults();