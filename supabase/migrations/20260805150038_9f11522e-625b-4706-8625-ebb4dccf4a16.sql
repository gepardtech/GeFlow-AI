ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS base_currency text;
UPDATE public.businesses SET base_currency = COALESCE(base_currency, currency, 'USD');
ALTER TABLE public.businesses ALTER COLUMN base_currency SET DEFAULT 'USD';

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
    NEW.base_currency := COALESCE(NEW.base_currency, NEW.currency);
    RETURN NEW;
  END IF;

  SELECT * INTO category_row FROM public.business_categories WHERE id = NEW.category_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected business category does not exist';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.currency := COALESCE(NEW.currency, category_row.currency);
    NEW.base_currency := COALESCE(NEW.base_currency, NEW.currency);
    NEW.default_tax := category_row.default_tax;
    NEW.stock_alert_limit := category_row.stock_alert_limit;
  ELSIF NEW.category_id IS DISTINCT FROM OLD.category_id THEN
    NEW.currency := category_row.currency;
    NEW.base_currency := COALESCE(OLD.base_currency, NEW.currency);
    NEW.default_tax := category_row.default_tax;
    NEW.stock_alert_limit := category_row.stock_alert_limit;
  ELSE
    NEW.currency := COALESCE(NEW.currency, OLD.currency, category_row.currency);
    NEW.base_currency := COALESCE(OLD.base_currency, NEW.base_currency, NEW.currency);
  END IF;

  RETURN NEW;
END;
$function$;

ALTER TABLE public.businesses REPLICA IDENTITY FULL;
ALTER TABLE public.business_categories REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.business_categories;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;