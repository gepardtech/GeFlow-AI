CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.business_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry_type text NOT NULL,
  internal_description text,
  enabled_modules text[] NOT NULL DEFAULT '{}',
  enabled_features text[] NOT NULL DEFAULT '{}',
  default_tax numeric(5,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  stock_alert_limit integer NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'draft',
  created_by_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX business_categories_name_idx ON public.business_categories (lower(name));
CREATE INDEX business_categories_industry_idx ON public.business_categories (industry_type);
CREATE INDEX business_categories_status_idx ON public.business_categories (status);

ALTER TABLE public.business_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all business categories"
ON public.business_categories
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read active business categories"
ON public.business_categories
FOR SELECT
TO authenticated
USING (status = 'active');

CREATE POLICY "Admins can create business categories"
ON public.business_categories
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update business categories"
ON public.business_categories
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete business categories"
ON public.business_categories
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  category_id uuid REFERENCES public.business_categories(id) ON DELETE SET NULL,
  business_name text NOT NULL,
  business_address text,
  status text NOT NULL DEFAULT 'active',
  listed_products integer NOT NULL DEFAULT 0,
  usage integer NOT NULL DEFAULT 0,
  last_active timestamp with time zone NOT NULL DEFAULT now(),
  currency text NOT NULL DEFAULT 'USD',
  default_tax numeric(5,2) NOT NULL DEFAULT 0,
  stock_alert_limit integer NOT NULL DEFAULT 10,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX businesses_owner_user_id_idx ON public.businesses (owner_user_id);
CREATE INDEX businesses_status_idx ON public.businesses (status);
CREATE INDEX businesses_category_id_idx ON public.businesses (category_id);
CREATE INDEX businesses_name_idx ON public.businesses (lower(business_name));

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_business_limit(_plan text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.apply_business_category_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.validate_business_record()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  owner_plan text;
  business_limit integer;
  existing_count integer;
BEGIN
  IF NEW.business_name IS NULL OR btrim(NEW.business_name) = '' THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  IF NEW.status NOT IN ('active', 'suspended', 'draft') THEN
    RAISE EXCEPTION 'Invalid business status';
  END IF;

  IF NEW.default_tax < 0 OR NEW.default_tax > 100 THEN
    RAISE EXCEPTION 'Default tax must be between 0 and 100';
  END IF;

  SELECT plan
  INTO owner_plan
  FROM public.profiles
  WHERE user_id = NEW.owner_user_id;

  IF owner_plan IS NULL THEN
    RAISE EXCEPTION 'Owner profile not found';
  END IF;

  business_limit := public.get_business_limit(owner_plan);

  IF business_limit IS NOT NULL THEN
    SELECT count(*)
    INTO existing_count
    FROM public.businesses
    WHERE owner_user_id = NEW.owner_user_id
      AND (TG_OP = 'INSERT' OR id <> OLD.id);

    IF existing_count >= business_limit THEN
      RAISE EXCEPTION 'Business limit reached for current plan';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_business_category_record()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS NULL OR btrim(NEW.name) = '' THEN
    RAISE EXCEPTION 'Category name is required';
  END IF;

  IF NEW.industry_type IS NULL OR btrim(NEW.industry_type) = '' THEN
    RAISE EXCEPTION 'Industry type is required';
  END IF;

  IF NEW.status NOT IN ('active', 'draft') THEN
    RAISE EXCEPTION 'Invalid category status';
  END IF;

  IF NEW.default_tax < 0 OR NEW.default_tax > 100 THEN
    RAISE EXCEPTION 'Default tax must be between 0 and 100';
  END IF;

  RETURN NEW;
END;
$$;

CREATE POLICY "Admins can read all businesses"
ON public.businesses
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own businesses"
ON public.businesses
FOR SELECT
TO authenticated
USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create own businesses"
ON public.businesses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Admins can update businesses"
ON public.businesses
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete businesses"
ON public.businesses
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_business_categories_updated_at
BEFORE UPDATE ON public.business_categories
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TRIGGER validate_business_category_record
BEFORE INSERT OR UPDATE ON public.business_categories
FOR EACH ROW
EXECUTE FUNCTION public.validate_business_category_record();

CREATE TRIGGER set_businesses_updated_at
BEFORE UPDATE ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TRIGGER apply_business_category_defaults
BEFORE INSERT OR UPDATE OF category_id ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.apply_business_category_defaults();

CREATE TRIGGER validate_business_record
BEFORE INSERT OR UPDATE ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.validate_business_record();

ALTER PUBLICATION supabase_realtime ADD TABLE public.business_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses;