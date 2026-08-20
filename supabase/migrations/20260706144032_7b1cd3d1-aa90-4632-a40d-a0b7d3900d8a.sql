-- Keep public_settings mirror in sync with platform_settings
DROP TRIGGER IF EXISTS platform_settings_sync ON public.platform_settings;
CREATE TRIGGER platform_settings_sync
AFTER INSERT OR UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.sync_public_settings();

-- One-time backfill so public_settings reflects current config
UPDATE public.platform_settings SET updated_at = now();

-- Enable realtime for panel-subscribed tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'announcements','feature_modules','businesses','profiles',
    'platform_settings','public_settings','products','sales','sale_items'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;