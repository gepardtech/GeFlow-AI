-- 1. Always create new users on the free plan; ignore any client-supplied plan metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, plan)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email,
    'free'
  );

  IF lower(NEW.email) = 'gepardwebs@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Prevent non-admin users from changing privileged profile columns
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Service role / system context (no JWT) and admins may change anything
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Non-admin self-updates: force privileged columns back to their stored values
  NEW.plan := OLD.plan;
  NEW.status := OLD.status;
  NEW.usage := OLD.usage;
  NEW.listed_products := OLD.listed_products;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_profile_columns_trg ON public.profiles;
CREATE TRIGGER protect_profile_columns_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_columns();