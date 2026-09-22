-- ============================================================================
-- GeFlow Phase 1 Step 1
-- Seed / upsert: pricing_plans + plan_limits + feature_modules
-- Source: src/lib/plans.ts + src/lib/featureCatalog.ts (latest values)
-- Safe to re-run (ON CONFLICT upsert)
-- public_feature_modules auto-fills via existing trigger
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1) pricing_plans
-- Prices admin panel se badal sakte ho; yeh starting values hain
-- --------------------------------------------------------------------------
INSERT INTO public.pricing_plans (
  plan_key,
  name,
  tagline,
  monthly_price,
  yearly_price,
  lifetime_price,
  features,
  is_active,
  is_popular,
  sort_order
) VALUES
  (
    'free',
    'Free',
    'Essential POS & inventory starter for solo store owners.',
    0,
    0,
    0,
    ARRAY[
      'Up to 50 products',
      '1 branch',
      'Basic POS',
      'Basic AI assistant',
      '7-day reports'
    ],
    true,
    false,
    1
  ),
  (
    'standard',
    'Standard',
    'Growing businesses with supplier procurement & up to 3 branches.',
    29,
    290,
    0,
    ARRAY[
      'Up to 500 products',
      '3 branches',
      'Purchases & suppliers',
      'Returns & refunds',
      '30-day reports'
    ],
    true,
    true,
    2
  ),
  (
    'premium',
    'Premium',
    'Complete retail powerhouse with Team Hub, deep analytics & up to 7 stores.',
    79,
    790,
    0,
    ARRAY[
      'Unlimited products',
      'Up to 7 branches',
      'Team Hub & RBAC',
      'Analytics dashboard',
      'Full AI suite'
    ],
    true,
    false,
    3
  ),
  (
    'lifetime',
    'Lifetime VIP',
    'Permanent VIP access, up to 10 branches & priority AI engine.',
    0,
    0,
    999,
    ARRAY[
      'Unlimited products',
      'Up to 10 branches',
      'Priority AI engine',
      'White label ready',
      'Lifetime reports'
    ],
    true,
    false,
    4
  )
ON CONFLICT (plan_key) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  monthly_price = EXCLUDED.monthly_price,
  yearly_price = EXCLUDED.yearly_price,
  lifetime_price = EXCLUDED.lifetime_price,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  is_popular = EXCLUDED.is_popular,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- --------------------------------------------------------------------------
-- 2) plan_limits  (matches latest src/lib/plans.ts)
-- limit_value NULL = unlimited
-- --------------------------------------------------------------------------
INSERT INTO public.plan_limits (plan_key, resource_key, label, limit_value, is_locked)
VALUES
  -- free
  ('free', 'products', 'Inventory Products', 50, false),
  ('free', 'branches', 'Branches', 1, false),
  ('free', 'low_stock', 'Low Stock Items', 5, false),
  ('free', 'out_of_stock', 'Out of Stock Items', 5, false),
  ('free', 'business_categories', 'Business Categories', 1, false),
  ('free', 'reports_days', 'Reports History (days)', 7, false),
  ('free', 'team_members', 'Team Members', 0, true),

  -- standard
  ('standard', 'products', 'Inventory Products', 500, false),
  ('standard', 'branches', 'Branches', 3, false),
  ('standard', 'low_stock', 'Low Stock Items', 50, false),
  ('standard', 'out_of_stock', 'Out of Stock Items', 50, false),
  ('standard', 'business_categories', 'Business Categories', 5, false),
  ('standard', 'reports_days', 'Reports History (days)', 30, false),
  ('standard', 'team_members', 'Team Members', 5, false),

  -- premium
  ('premium', 'products', 'Inventory Products', NULL, false),
  ('premium', 'branches', 'Branches', 7, false),
  ('premium', 'low_stock', 'Low Stock Items', NULL, false),
  ('premium', 'out_of_stock', 'Out of Stock Items', NULL, false),
  ('premium', 'business_categories', 'Business Categories', NULL, false),
  ('premium', 'reports_days', 'Reports History (days)', NULL, false),
  ('premium', 'team_members', 'Team Members', NULL, false),

  -- lifetime
  ('lifetime', 'products', 'Inventory Products', NULL, false),
  ('lifetime', 'branches', 'Branches', 10, false),
  ('lifetime', 'low_stock', 'Low Stock Items', NULL, false),
  ('lifetime', 'out_of_stock', 'Out of Stock Items', NULL, false),
  ('lifetime', 'business_categories', 'Business Categories', NULL, false),
  ('lifetime', 'reports_days', 'Reports History (days)', NULL, false),
  ('lifetime', 'team_members', 'Team Members', NULL, false)
ON CONFLICT (plan_key, resource_key) DO UPDATE SET
  label = EXCLUDED.label,
  limit_value = EXCLUDED.limit_value,
  is_locked = EXCLUDED.is_locked,
  updated_at = now();

-- --------------------------------------------------------------------------
-- 3) feature_modules  (all 36 from src/lib/featureCatalog.ts)
-- created_by_user_id: first admin if exists, else fixed system UUID
-- --------------------------------------------------------------------------
DO $$
DECLARE
  seed_user UUID;
BEGIN
  SELECT ur.user_id
    INTO seed_user
  FROM public.user_roles ur
  WHERE ur.role = 'admin'::public.app_role
  LIMIT 1;

  IF seed_user IS NULL THEN
    -- System seed UUID (no FK on created_by_user_id in current schema)
    seed_user := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  INSERT INTO public.feature_modules (
    module_code,
    name,
    function_group,
    description,
    lifecycle_phase,
    global_active,
    plan_free,
    plan_standard,
    plan_premium,
    health,
    latency_ms,
    created_by_user_id
  )
  SELECT
    v.module_code,
    v.name,
    v.function_group,
    v.description,
    v.lifecycle_phase,
    v.global_active,
    v.plan_free,
    v.plan_standard,
    v.plan_premium,
    v.health,
    v.latency_ms,
    seed_user
  FROM (
    VALUES
      ('F-POS-01', 'Fast POS Terminal', 'pos', 'Fast barcode scan, Cash/Card checkout, Split payments, WhatsApp & Thermal receipt printing.', 'live', true, true, true, true, 'optimal', 8),
      ('F-POS-02', 'Barcode Hardware Scanner Support', 'pos', 'USB & Bluetooth hardware barcode scanner support for instant product lookup in POS.', 'live', true, true, true, true, 'optimal', 10),
      ('F-POS-03', 'Simple POS Returns & Refund', 'pos', '1-Click return & refund button at POS for quick customer order adjustments.', 'live', true, true, true, true, 'optimal', 12),
      ('F-POS-04', 'Flat & Percentage Order Discounts', 'pos', 'Instant percentage or flat dollar discounts applied directly to checkout cart.', 'live', true, true, true, true, 'optimal', 5),
      ('F-INV-01', 'Core Inventory & Stock Control', 'inventory', 'Product catalog, categories, stock in/out adjustments and movement history.', 'live', true, true, true, true, 'optimal', 14),
      ('F-INV-02', 'Low Stock & Out-of-Stock Alerts', 'inventory', 'Configurable threshold alerts (e.g. stock < 5) to prevent sudden stock-outs.', 'live', true, true, true, true, 'optimal', 15),
      ('F-AI-01', 'Smart AI Product Autofill (Basic)', 'ai', 'Scan barcode or enter title to auto-suggest product name, category & standard pricing.', 'live', true, true, true, true, 'optimal', 60),
      ('F-AI-ANALYST', 'AI Assistant: Analyst Model', 'ai', 'Basic sales, profit & inventory intelligence. Answers real-time business health queries.', 'live', true, true, true, true, 'optimal', 45),
      ('F-AI-KNOWLEDGE', 'AI Assistant: Knowledge Model', 'ai', 'GeFlow documentation, POS setup, barcode scanner troubleshooting and system FAQs.', 'live', true, true, true, true, 'optimal', 40),
      ('F-AI-OPERATOR', 'AI Assistant: Operator Model', 'ai', 'Automated purchase drafting, stock-out reorder suggestions, and batch adjustments.', 'staging', false, false, true, true, 'high', 90),
      ('F-AI-ADVISOR', 'AI Assistant: Advisor Model', 'ai', 'Strategic margin recommendations, pricing elasticity, and predictive dead-stock warnings.', 'staging', false, false, false, true, 'high', 120),
      ('F-AI-02', '1-Click AI Summary on Reports', 'ai', 'Generate 2-sentence executive summary of today''s sales performance with 1 click.', 'live', true, true, true, true, 'optimal', 80),
      ('F-USR-01', 'Team Roles & Permissions (RBAC)', 'team', 'Role isolation: Cashier (Billing only), Inventory Clerk (Stock only), Store Owner/Manager.', 'live', true, false, true, true, 'optimal', 12),
      ('F-REP-01', 'Daily Sales & Profit Reports', 'reports', 'Daily sales totals, today''s gross profit, top selling items, and PDF/CSV downloads.', 'live', true, true, true, true, 'optimal', 22),
      ('F-COR-01', 'Multi-Branch Store Structure', 'enterprise', 'Multi-branch store architecture: 1 store on Free, 5 on Standard, up to 10 on Premium.', 'live', true, true, true, true, 'optimal', 18),
      ('F-CRM-01', 'Customer Directory & Profiles', 'crm', 'Store customer names, phone, purchase history and quick lookup at checkout.', 'live', true, false, true, true, 'optimal', 16),
      ('F-CRM-02', 'Customer Credit Khata (Udaar)', 'crm', 'Track customer credit balances, partial payments and outstanding Udaar ledger.', 'live', true, false, true, true, 'optimal', 20),
      ('F-MKT-01', 'Loyalty Points & Rewards', 'crm', 'Award loyalty points on sales and redeem rewards at POS.', 'live', true, false, true, true, 'optimal', 25),
      ('F-AI-03', 'AI Demand Forecast & Restock', 'ai', 'Predict next 30-day demand and suggest replenishment quantities.', 'live', true, false, true, true, 'high', 100),
      ('F-INV-03', 'Batch / Expiry Tracking', 'inventory', 'Track batch numbers and expiry dates with FEFO warnings.', 'live', true, false, true, true, 'optimal', 18),
      ('F-AI-04', 'AI Purchase Intelligence', 'ai', 'Smart supplier PO suggestions based on sales velocity and stock levels.', 'live', true, false, true, true, 'high', 95),
      ('F-PUR-01', 'Supplier & Purchase Orders', 'purchases', 'Supplier directory, purchase orders, receiving and purchase ledger.', 'live', true, false, true, true, 'optimal', 20),
      ('F-FIN-01', 'Profit, Expenses & Costing', 'finance', 'Gross/net profit, expense logging and product costing.', 'live', true, true, true, true, 'optimal', 18),
      ('F-REP-02', 'Scheduled AI Report Digests', 'reports', 'Email/WhatsApp scheduled digests of sales and stock health.', 'live', true, false, true, true, 'high', 40),
      ('F-INV-04', 'Barcode Label Designer', 'inventory', 'Design and batch-print custom price tag stickers & barcode labels on thermal printers.', 'staging', false, false, true, true, 'high', 25),
      ('F-ECO-01', '1-Click Online Storefront & WhatsApp Catalog', 'ecommerce', 'Instantly turn POS inventory into a customer-facing digital web catalog and WhatsApp store.', 'staging', false, false, false, true, 'high', 50),
      ('F-ECO-02', 'Live Online Order Pop-up in POS', 'ecommerce', 'Online orders from web/WhatsApp pop up in real-time on POS screen with sound alert.', 'staging', false, false, false, true, 'high', 15),
      ('F-FIN-02', 'Multi-Currency & International Tax Engine', 'finance', 'Compliant tax calculation (ZATCA e-invoicing for KSA, UAE FTA VAT, GST for India, US Sales Tax).', 'staging', false, false, true, true, 'high', 18),
      ('F-AI-05', 'AI Invoice Vision OCR Import', 'ai', 'Upload photo/PDF of paper supplier invoice to automatically extract items, qty & prices.', 'staging', false, false, false, true, 'high', 220),
      ('F-AI-06', 'AI Multi-Lingual Interface (10+ Languages)', 'ai', 'Automatic localized translation for Arabic, Urdu, Spanish, French, German, and Turkish.', 'staging', false, true, true, true, 'high', 20),
      ('F-HDW-01', 'Direct Hardware Integration (Scales & Customer Displays)', 'hardware', 'Direct RS232/USB connection for electronic weighing scales, cash drawers & dual customer monitors.', 'staging', false, false, false, true, 'high', 10),
      ('F-HDW-02', 'Offline-First PWA & Desktop App with Auto-Sync', 'hardware', 'Keep billing customers seamlessly even if internet drops; auto-syncs when online.', 'staging', false, false, true, true, 'high', 5),
      ('F-DEV-01', 'Public REST Developer API & Webhooks', 'developer', 'Connect custom ERPs, Shopify, WooCommerce, and courier delivery tracking apps.', 'staging', false, false, false, true, 'high', 12),
      ('F-INT-01', 'Accounting Software Sync (QuickBooks / Xero)', 'developer', 'Automatic end-of-day journal sync with QuickBooks, Xero, and Tally accounting ledger.', 'staging', false, false, false, true, 'high', 85),
      ('F-ENT-02', 'Enterprise Multi-Warehouse Hierarchy', 'enterprise', 'Central regional distribution warehouses supplying multiple subsidiary retail stores.', 'staging', false, false, false, true, 'high', 30),
      ('F-ENT-03', 'White Label & Custom Domain Branding', 'enterprise', 'Custom domain, custom brand logos, custom invoice color templates and removed GeFlow branding.', 'staging', false, false, false, true, 'high', 10)
  ) AS v(
    module_code, name, function_group, description, lifecycle_phase,
    global_active, plan_free, plan_standard, plan_premium, health, latency_ms
  )
  ON CONFLICT (module_code) DO UPDATE SET
    name = EXCLUDED.name,
    function_group = EXCLUDED.function_group,
    description = EXCLUDED.description,
    lifecycle_phase = EXCLUDED.lifecycle_phase,
    global_active = EXCLUDED.global_active,
    plan_free = EXCLUDED.plan_free,
    plan_standard = EXCLUDED.plan_standard,
    plan_premium = EXCLUDED.plan_premium,
    health = EXCLUDED.health,
    latency_ms = EXCLUDED.latency_ms,
    updated_at = now();
END $$;

-- --------------------------------------------------------------------------
-- 4) Ensure realtime is on for client-facing tables
-- --------------------------------------------------------------------------
ALTER TABLE public.pricing_plans REPLICA IDENTITY FULL;
ALTER TABLE public.plan_limits REPLICA IDENTITY FULL;
ALTER TABLE public.public_feature_modules REPLICA IDENTITY FULL;

-- Idempotent: add to publication if missing (ignore errors if already added)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pricing_plans;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_limits;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.public_feature_modules;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;