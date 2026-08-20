CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  applies_to_plan TEXT,
  min_amount NUMERIC NOT NULL DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.coupons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Public (incl. unauthenticated checkout) can read only active coupons
CREATE POLICY "Active coupons are publicly readable"
ON public.coupons FOR SELECT
USING (active = true);

-- Admins can read everything
CREATE POLICY "Admins can view all coupons"
ON public.coupons FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create coupons"
ON public.coupons FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update coupons"
ON public.coupons FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete coupons"
ON public.coupons FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER PUBLICATION supabase_realtime ADD TABLE public.coupons;

INSERT INTO public.coupons (code, description, discount_type, discount_value, active) VALUES
('GEFLOW10', 'Launch discount', 'percent', 10, true),
('GEFLOW20', 'Loyalty discount', 'percent', 20, true),
('LAUNCH50', 'Mega launch offer', 'percent', 50, true);