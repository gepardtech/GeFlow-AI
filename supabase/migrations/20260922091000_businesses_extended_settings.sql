-- Store per-business extended settings (timezone, POS, inventory flags, etc.)
-- Replaces localStorage geflow.biz_ext.*

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS extended_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.businesses.extended_settings IS
  'BusinessExtendedData: timezone, tax, inventory toggles, POS receipt, location, etc.';