-- ============================================================
-- FIX 1: product-images storage bucket access control
-- Add owner-scoped RLS policies on storage.objects so authenticated
-- users can only access files inside their own {auth.uid()} folder.
-- ============================================================

DROP POLICY IF EXISTS "Users can read own product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;

CREATE POLICY "Users can read own product images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload own product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- FIX 2: Stop broadcasting sensitive admin-only tables over Realtime
-- These tables hold platform security config, discount codes, and
-- internal admin content. Removing them from the Realtime publication
-- prevents any authenticated subscriber from receiving their change
-- payloads. Admin pages still load this data on mount via RLS-guarded
-- queries; only live auto-refresh is dropped for these config tables.
-- ============================================================

ALTER PUBLICATION supabase_realtime DROP TABLE public.platform_settings;
ALTER PUBLICATION supabase_realtime DROP TABLE public.coupons;
ALTER PUBLICATION supabase_realtime DROP TABLE public.business_category_internal;
ALTER PUBLICATION supabase_realtime DROP TABLE public.reply_templates;
ALTER PUBLICATION supabase_realtime DROP TABLE public.support_automation_settings;