-- Functional support auto-reply engine.
-- When a new ticket is created, if the admin has enabled auto-reply and chosen a
-- template, an automatic "Support Team" reply is posted instantly.
CREATE OR REPLACE FUNCTION public.support_auto_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.support_automation_settings%ROWTYPE;
  tmpl text;
  admin_id uuid;
BEGIN
  SELECT * INTO s FROM public.support_automation_settings LIMIT 1;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Feedback / contact-originated tickets first
  IF NEW.source IN ('contact_form', 'feedback')
     AND s.auto_feedback_reply_enabled
     AND array_length(s.auto_feedback_template_ids, 1) >= 1 THEN
    SELECT body INTO tmpl
    FROM public.reply_templates
    WHERE id = s.auto_feedback_template_ids[1];
  END IF;

  -- Standard auto-reply
  IF tmpl IS NULL AND s.auto_reply_enabled AND s.auto_reply_template_id IS NOT NULL THEN
    SELECT body INTO tmpl
    FROM public.reply_templates
    WHERE id = s.auto_reply_template_id;
  END IF;

  IF tmpl IS NULL OR btrim(tmpl) = '' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF admin_id IS NULL THEN
    admin_id := NEW.owner_user_id;
  END IF;

  INSERT INTO public.ticket_messages (ticket_id, author_user_id, is_admin, body)
  VALUES (NEW.id, admin_id, true, tmpl);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_auto_reply ON public.support_tickets;
CREATE TRIGGER trg_support_auto_reply
AFTER INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.support_auto_reply();