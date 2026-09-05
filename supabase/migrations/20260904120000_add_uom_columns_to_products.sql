-- Migration: Add explicit UoM columns to public.products
-- Ensures stock_units is always tracked in Base Units (tablets, pieces, ml, etc.)

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS base_unit text DEFAULT 'piece',
ADD COLUMN IF NOT EXISTS uom text DEFAULT 'piece',
ADD COLUMN IF NOT EXISTS units_per_uom numeric DEFAULT 1;

-- Backfill from legacy description tags if available
-- 1. Extract [UOM: ...]
UPDATE public.products
SET uom = TRIM(LOWER(SUBSTRING(description FROM '\[UOM:\s*([^\]]+)\]')))
WHERE description ~* '\[UOM:\s*[^\]]+\]'
  AND (uom IS NULL OR uom = 'piece');

-- 2. Extract [SCALE: ...] or [UNITS_PER_UOM: ...] or [PACK_SIZE: ...]
UPDATE public.products
SET units_per_uom = CAST(NULLIF(TRIM(SUBSTRING(description FROM '\[(?:SCALE|UNITS_PER_UOM|PACK_SIZE):\s*([^\]]+)\]')), '') AS numeric)
WHERE description ~* '\[(?:SCALE|UNITS_PER_UOM|PACK_SIZE):\s*[^\]]+\]'
  AND (units_per_uom IS NULL OR units_per_uom = 1);

-- 3. Extract [BASE_UNIT: ...] or [SUB_UNIT: ...]
UPDATE public.products
SET base_unit = TRIM(LOWER(SUBSTRING(description FROM '\[(?:BASE_UNIT|SUB_UNIT):\s*([^\]]+)\]')))
WHERE description ~* '\[(?:BASE_UNIT|SUB_UNIT):\s*[^\]]+\]'
  AND (base_unit IS NULL OR base_unit = 'piece');

-- Add index for fast querying by UoM
CREATE INDEX IF NOT EXISTS idx_products_uom ON public.products (uom);
