/**
 * Feature UI metadata only (group labels + roadmap versions).
 * Actual feature modules live in Supabase: public.feature_modules
 * / public.public_feature_modules — no local MASTER catalog, no localStorage.
 */

export interface FeatureModuleDefinition {
  id: string;
  module_code: string;
  name: string;
  function_group:
    | "pos"
    | "inventory"
    | "ai"
    | "crm"
    | "finance"
    | "purchases"
    | "reports"
    | "team"
    | "ecommerce"
    | "enterprise"
    | "hardware"
    | "developer";
  group_title: string;
  description: string;
  version_target: "v1" | "v2" | "v3" | "v4" | "v5";
  version_title: string;
  lifecycle_phase: "live" | "beta" | "staging" | "deactivated";
  global_active: boolean;
  plan_free: boolean;
  plan_standard: boolean;
  plan_premium: boolean;
  health: "optimal" | "high" | "moderate" | "experimental";
  latency_ms: number;
  source_file_url?: string;
  test_scenario?: {
    input_sample: string;
    expected_output: string;
    simulated_payload: Record<string, any>;
  };
}

export interface FeatureGroupMeta {
  key: FeatureModuleDefinition["function_group"];
  title: string;
  iconName: string;
  description: string;
  accent: string;
}

export const FEATURE_GROUPS: FeatureGroupMeta[] = [
  {
    key: "pos",
    title: "POS & Billing Terminal",
    iconName: "ShoppingCart",
    description: "Fast checkout, barcode scan, thermal receipts, discounts, and payment methods.",
    accent: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    key: "inventory",
    title: "Inventory & Stock Control",
    iconName: "Package",
    description: "Products, categories, stock tracking, UOM units, low stock triggers & label generator.",
    accent: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  },
  {
    key: "ai",
    title: "AI & Smart Automation",
    iconName: "Brain",
    description: "AI product autofill, report summaries, forecasting, vision invoice OCR & Copilot.",
    accent: "text-violet-500 bg-violet-500/10 border-violet-500/20",
  },
  {
    key: "crm",
    title: "Customer Khata & Loyalty",
    iconName: "Users",
    description: "Credit ledger (Udaar), loyalty reward points, store credit & customer directories.",
    accent: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  {
    key: "finance",
    title: "Finance, Profit & Expenses",
    iconName: "DollarSign",
    description: "Daily net profit, operational expense logging, tax engines (VAT/GST/ZATCA) & costing.",
    accent: "text-teal-500 bg-teal-500/10 border-teal-500/20",
  },
  {
    key: "purchases",
    title: "Suppliers & Procurement",
    iconName: "Truck",
    description: "Supplier directories, purchase orders (PO), stock receiving & automated replenishment.",
    accent: "text-orange-500 bg-orange-500/10 border-orange-500/20",
  },
  {
    key: "reports",
    title: "Reports & Analytics",
    iconName: "BarChart3",
    description: "Daily sales summaries, top items, margin reports, scheduled digests & CSV/PDF exports.",
    accent: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
  },
  {
    key: "team",
    title: "Team & Role Access (RBAC)",
    iconName: "Shield",
    description: "Staff accounts, granular role permissions (Cashier, Clerk, Manager, Owner) & audit logs.",
    accent: "text-rose-500 bg-rose-500/10 border-rose-500/20",
  },
  {
    key: "ecommerce",
    title: "Omnichannel & E-Commerce",
    iconName: "Globe",
    description: "1-Click Online Storefront, WhatsApp catalog sync, online orders & live POS alerts.",
    accent: "text-pink-500 bg-pink-500/10 border-pink-500/20",
  },
  {
    key: "enterprise",
    title: "Multi-Branch & Enterprise",
    iconName: "Layers",
    description: "Multi-branch store hierarchies, stock inter-transfers, white labeling & workflow rules.",
    accent: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  },
  {
    key: "hardware",
    title: "Hardware & Offline PWA",
    iconName: "Cpu",
    description: "Offline-first PWA mode, weighing scales, cash drawers & customer facing secondary displays.",
    accent: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
  },
  {
    key: "developer",
    title: "Developer API & Integrations",
    iconName: "Code2",
    description: "REST Webhook APIs, QuickBooks, Xero, Tally & third-party logistics integrations.",
    accent: "text-slate-500 bg-slate-500/10 border-slate-500/20",
  },
];

export const VERSION_ROADMAP_META = [
  {
    version: "v1" as const,
    title: "Version 1.0 — Rock-Solid Core MVP",
    badge: "Core Launch (V1.0)",
    focus: "Speed, Simplicity & Reliability",
    activeByDefault: true,
  },
  {
    version: "v2" as const,
    title: "Version 2.0 — Customer Retention & Store Growth",
    badge: "Growth (V2.0)",
    focus: "Sales Boost, Khata & Loyalty",
    activeByDefault: false,
  },
  {
    version: "v3" as const,
    title: "Version 3.0 — Smart Automation & Supply Chain",
    badge: "Automation (V3.0)",
    focus: "AI Forecasting & Expenses",
    activeByDefault: false,
  },
  {
    version: "v4" as const,
    title: "Version 4.0 — Omnichannel & E-Commerce Sync",
    badge: "Omnichannel (V4.0)",
    focus: "Selling Online & Offline Together",
    activeByDefault: false,
  },
  {
    version: "v5" as const,
    title: "Version 5.0 — Enterprise, Hardware & Ecosystem",
    badge: "Enterprise (V5.0)",
    focus: "Scale, Offline PWA & Integrations",
    activeByDefault: false,
  },
];