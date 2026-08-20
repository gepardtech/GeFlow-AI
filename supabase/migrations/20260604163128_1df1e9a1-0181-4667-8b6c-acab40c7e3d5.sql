
-- ========== PRODUCTS ==========
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  internal_sku text,
  description text,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  purchase_cost numeric NOT NULL DEFAULT 0,
  retail_price numeric NOT NULL DEFAULT 0,
  discount_price numeric,
  stock_units integer NOT NULL DEFAULT 0,
  min_stock_alert integer NOT NULL DEFAULT 10,
  batch_number text,
  expiry_date date,
  barcode text,
  status text NOT NULL DEFAULT 'active',
  images text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their products"
  ON public.products FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE INDEX idx_products_business ON public.products(business_id);
CREATE INDEX idx_products_owner ON public.products(owner_user_id);

-- ========== STOCK MOVEMENTS ==========
CREATE TABLE public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'in',
  quantity integer NOT NULL DEFAULT 0,
  reason text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their stock movements"
  ON public.stock_movements FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_owner ON public.stock_movements(owner_user_id);

-- ========== SALES ==========
CREATE TABLE public.sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  total numeric NOT NULL DEFAULT 0,
  profit numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  processed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their sales"
  ON public.sales FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE INDEX idx_sales_business ON public.sales(business_id);
CREATE INDEX idx_sales_owner ON public.sales(owner_user_id);

-- ========== SALE ITEMS ==========
CREATE TABLE public.sale_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  owner_user_id uuid NOT NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their sale items"
  ON public.sale_items FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);

-- ========== updated_at triggers ==========
CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ========== realtime ==========
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_items;
