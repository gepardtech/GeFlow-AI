-- Migration: Create held_orders table and enhance stock_movements
-- Supports POS Cart Hold / Resume and full Stock Ledger tracking

-- 1. Create held_orders table for POS
CREATE TABLE IF NOT EXISTS public.held_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  customer_name text,
  customer_phone text,
  customer_note text,
  cart_data jsonb NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  item_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.held_orders TO authenticated;
GRANT ALL ON public.held_orders TO service_role;

ALTER TABLE public.held_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage held orders for their business"
  ON public.held_orders FOR ALL
  USING (
    auth.uid() = owner_user_id OR 
    EXISTS (
      SELECT 1 FROM public.business_staff 
      WHERE business_staff.business_id = held_orders.business_id 
        AND business_staff.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = owner_user_id OR 
    EXISTS (
      SELECT 1 FROM public.business_staff 
      WHERE business_staff.business_id = held_orders.business_id 
        AND business_staff.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_held_orders_business ON public.held_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_held_orders_created ON public.held_orders(created_at DESC);

-- 2. Enhance stock_movements with reference fields
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS reference_id text,
ADD COLUMN IF NOT EXISTS reference_type text,
ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON public.stock_movements(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_business_date ON public.stock_movements(business_id, created_at DESC);
