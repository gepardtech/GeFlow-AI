-- 1. Public, sanitized mirror of feature_modules
CREATE TABLE IF NOT EXISTS public.public_feature_modules (
  id uuid PRIMARY KEY,
  module_code text NOT NULL,
  name text NOT NULL,
  function_group text NOT NULL,
  description text,
  global_active boolean NOT NULL DEFAULT true,
  plan_free boolean NOT NULL DEFAULT false,
  plan_standard boolean NOT NULL DEFAULT false,
  plan_premium boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.public_feature_modules TO anon;
GRANT SELECT ON public.public_feature_modules TO authenticated;
GRANT ALL ON public.public_feature_modules TO service_role;

ALTER TABLE public.public_feature_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read public feature modules" ON public.public_feature_modules;
CREATE POLICY "Anyone can read public feature modules"
  ON public.public_feature_modules FOR SELECT USING (true);

-- 2. Sync trigger from feature_modules -> public_feature_modules
CREATE OR REPLACE FUNCTION public.sync_public_feature_modules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.public_feature_modules WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.public_feature_modules (
    id, module_code, name, function_group, description,
    global_active, plan_free, plan_standard, plan_premium, updated_at
  ) VALUES (
    NEW.id, NEW.module_code, NEW.name, NEW.function_group, NEW.description,
    NEW.global_active AND NEW.lifecycle_phase <> 'deactivated',
    NEW.plan_free, NEW.plan_standard, NEW.plan_premium, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    module_code = EXCLUDED.module_code,
    name = EXCLUDED.name,
    function_group = EXCLUDED.function_group,
    description = EXCLUDED.description,
    global_active = EXCLUDED.global_active,
    plan_free = EXCLUDED.plan_free,
    plan_standard = EXCLUDED.plan_standard,
    plan_premium = EXCLUDED.plan_premium,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_public_feature_modules ON public.feature_modules;
CREATE TRIGGER trg_sync_public_feature_modules
AFTER INSERT OR UPDATE OR DELETE ON public.feature_modules
FOR EACH ROW EXECUTE FUNCTION public.sync_public_feature_modules();

-- Backfill
INSERT INTO public.public_feature_modules (
  id, module_code, name, function_group, description,
  global_active, plan_free, plan_standard, plan_premium, updated_at
)
SELECT id, module_code, name, function_group, description,
       global_active AND lifecycle_phase <> 'deactivated',
       plan_free, plan_standard, plan_premium, now()
FROM public.feature_modules
ON CONFLICT (id) DO NOTHING;

-- 3. Lock down the internal table: admins only
DROP POLICY IF EXISTS "Authenticated can read feature modules" ON public.feature_modules;
DROP POLICY IF EXISTS "Admins can read feature modules" ON public.feature_modules;
CREATE POLICY "Admins can read feature modules"
  ON public.feature_modules FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Internal table no longer needs to be broadcast to every tenant
ALTER PUBLICATION supabase_realtime DROP TABLE public.feature_modules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.public_feature_modules;
ALTER TABLE public.public_feature_modules REPLICA IDENTITY FULL;

-- 4. Make sure config tables stream full change payloads
ALTER TABLE public.pricing_plans REPLICA IDENTITY FULL;
ALTER TABLE public.plan_limits REPLICA IDENTITY FULL;
ALTER TABLE public.public_settings REPLICA IDENTITY FULL;
ALTER TABLE public.business_categories REPLICA IDENTITY FULL;
ALTER TABLE public.businesses REPLICA IDENTITY FULL;
ALTER TABLE public.product_categories REPLICA IDENTITY FULL;

-- pricing_plans must be readable by anonymous visitors for landing pricing
DROP POLICY IF EXISTS "Anyone can view active pricing plans" ON public.pricing_plans;
CREATE POLICY "Anyone can view active pricing plans"
  ON public.pricing_plans FOR SELECT USING (true);
