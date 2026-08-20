-- Remove the definer view from the prior migration
DROP VIEW IF EXISTS public.business_categories_public;

-- Admin-only table to hold internal category notes
CREATE TABLE IF NOT EXISTS public.business_category_internal (
  category_id uuid PRIMARY KEY REFERENCES public.business_categories(id) ON DELETE CASCADE,
  internal_description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_category_internal TO authenticated;
GRANT ALL ON public.business_category_internal TO service_role;

ALTER TABLE public.business_category_internal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage category internal notes"
ON public.business_category_internal
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Migrate existing internal notes
INSERT INTO public.business_category_internal (category_id, internal_description)
SELECT id, internal_description
FROM public.business_categories
WHERE internal_description IS NOT NULL
ON CONFLICT (category_id) DO NOTHING;

-- Drop the sensitive column from the main table
ALTER TABLE public.business_categories DROP COLUMN IF EXISTS internal_description;

-- Restore safe read access for signed-in users (no sensitive column remains)
DROP POLICY IF EXISTS "Authenticated users can read active business categories" ON public.business_categories;
CREATE POLICY "Authenticated users can read active business categories"
ON public.business_categories
FOR SELECT
TO authenticated
USING (status = 'active');

-- Keep realtime for the new table consistent with the rest of the app
ALTER PUBLICATION supabase_realtime ADD TABLE public.business_category_internal;