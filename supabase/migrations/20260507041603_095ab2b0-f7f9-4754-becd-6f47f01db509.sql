
-- =========================================================
-- SUPPORT TICKETS
-- =========================================================
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE DEFAULT ('T-' || lpad((floor(random()*90000)+10000)::text, 5, '0')),
  owner_user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to_user_id UUID,
  source TEXT NOT NULL DEFAULT 'user_panel',
  contact_submission_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own tickets" ON public.support_tickets FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "Owners create own tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Admins read all tickets" ON public.support_tickets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update tickets" ON public.support_tickets FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete tickets" ON public.support_tickets FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================================================
-- TICKET MESSAGES
-- =========================================================
CREATE TABLE public.ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own ticket messages" ON public.ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.owner_user_id = auth.uid()));
CREATE POLICY "Owners create own ticket messages" ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_user_id AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.owner_user_id = auth.uid()));
CREATE POLICY "Admins read all messages" ON public.ticket_messages FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins create messages" ON public.ticket_messages FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete messages" ON public.ticket_messages FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- REPLY TEMPLATES
-- =========================================================
CREATE TABLE public.reply_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reply_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage reply templates - select" ON public.reply_templates FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage reply templates - insert" ON public.reply_templates FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage reply templates - update" ON public.reply_templates FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage reply templates - delete" ON public.reply_templates FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_reply_templates_updated_at BEFORE UPDATE ON public.reply_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================================================
-- ANNOUNCEMENTS
-- =========================================================
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all', -- all | public | users | admins
  position TEXT NOT NULL DEFAULT 'top',
  variant TEXT NOT NULL DEFAULT 'info', -- info | success | warning | promo
  link_url TEXT,
  link_label TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read active announcements" ON public.announcements FOR SELECT TO anon, authenticated
  USING (is_active = true AND (ends_at IS NULL OR ends_at > now()) AND starts_at <= now());
CREATE POLICY "Admins manage announcements - all" ON public.announcements FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================================================
-- KNOWLEDGE BASE ARTICLES
-- =========================================================
CREATE TABLE public.knowledge_base_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  page_assignments TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active KB" ON public.knowledge_base_articles FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins manage KB - all" ON public.knowledge_base_articles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_kb_updated_at BEFORE UPDATE ON public.knowledge_base_articles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================================================
-- SUPPORT TEAM MEMBERS
-- =========================================================
CREATE TABLE public.support_team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'agent', -- agent | lead | manager
  is_active BOOLEAN NOT NULL DEFAULT true,
  appointed_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.support_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage support team - all" ON public.support_team_members FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Members read own row" ON public.support_team_members FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_team_updated_at BEFORE UPDATE ON public.support_team_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================================================
-- SUPPORT AUTOMATION SETTINGS (single row)
-- =========================================================
CREATE TABLE public.support_automation_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_reply_template_id UUID REFERENCES public.reply_templates(id) ON DELETE SET NULL,
  auto_feedback_reply_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_feedback_template_ids UUID[] NOT NULL DEFAULT '{}',
  ai_auto_reply_enabled BOOLEAN NOT NULL DEFAULT false,
  ai_auto_reply_after_hours INTEGER NOT NULL DEFAULT 24,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.support_automation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage automation - all" ON public.support_automation_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_automation_updated_at BEFORE UPDATE ON public.support_automation_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
INSERT INTO public.support_automation_settings (id) VALUES (gen_random_uuid());

-- =========================================================
-- FEATURE MODULES
-- =========================================================
CREATE TABLE public.feature_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  function_group TEXT NOT NULL DEFAULT 'core', -- inventory|pos|finance|ai|reports|users|core
  description TEXT,
  source_file_url TEXT,
  lifecycle_phase TEXT NOT NULL DEFAULT 'live', -- live|beta|staging|deactivated
  global_active BOOLEAN NOT NULL DEFAULT true,
  plan_free BOOLEAN NOT NULL DEFAULT false,
  plan_standard BOOLEAN NOT NULL DEFAULT false,
  plan_premium BOOLEAN NOT NULL DEFAULT true,
  health TEXT NOT NULL DEFAULT 'high', -- extreme|high|medium|low|none
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feature_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read active features" ON public.feature_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage features - all" ON public.feature_modules FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_features_updated_at BEFORE UPDATE ON public.feature_modules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================================================
-- PLAN LIMITS
-- =========================================================
CREATE TABLE public.plan_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_key TEXT NOT NULL, -- free|standard|premium|lifetime
  resource_key TEXT NOT NULL, -- products|branches|low_stock|out_of_stock|reports_days|team_members
  label TEXT NOT NULL,
  limit_value INTEGER, -- NULL means unlimited
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_key, resource_key)
);
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read plan limits" ON public.plan_limits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage plan limits - all" ON public.plan_limits FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_plan_limits_updated_at BEFORE UPDATE ON public.plan_limits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Seed default plan limits matching the original plan spec
INSERT INTO public.plan_limits (plan_key, resource_key, label, limit_value, is_locked) VALUES
  ('free','products','Inventory Products',50,false),
  ('free','branches','Branches',1,false),
  ('free','low_stock','Low Stock Items',5,false),
  ('free','out_of_stock','Out of Stock Items',5,false),
  ('free','reports_days','Reports History (days)',7,false),
  ('free','team_members','Team Members',0,true),
  ('standard','products','Inventory Products',100,false),
  ('standard','branches','Branches',3,false),
  ('standard','low_stock','Low Stock Items',25,false),
  ('standard','out_of_stock','Out of Stock Items',25,false),
  ('standard','reports_days','Reports History (days)',30,false),
  ('standard','team_members','Team Members',5,false),
  ('premium','products','Inventory Products',NULL,false),
  ('premium','branches','Branches',NULL,false),
  ('premium','low_stock','Low Stock Items',NULL,false),
  ('premium','out_of_stock','Out of Stock Items',NULL,false),
  ('premium','reports_days','Reports History (days)',NULL,false),
  ('premium','team_members','Team Members',NULL,false),
  ('lifetime','products','Inventory Products',NULL,false),
  ('lifetime','branches','Branches',NULL,false),
  ('lifetime','low_stock','Low Stock Items',NULL,false),
  ('lifetime','out_of_stock','Out of Stock Items',NULL,false),
  ('lifetime','reports_days','Reports History (days)',NULL,false),
  ('lifetime','team_members','Team Members',NULL,false);

-- =========================================================
-- PRICING PLANS: badge fields
-- =========================================================
ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS badge_text TEXT,
  ADD COLUMN IF NOT EXISTS badge_position TEXT NOT NULL DEFAULT 'top',
  ADD COLUMN IF NOT EXISTS badge_cycle TEXT NOT NULL DEFAULT 'all'; -- monthly|yearly|lifetime|all

-- =========================================================
-- REALTIME
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reply_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.knowledge_base_articles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_automation_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feature_modules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_limits;
