// Single source of truth for GeFlow plan capabilities.
// Used by sidebar, page gates, dashboard, admin and feature modules.

export type PlanId = "free" | "standard" | "premium" | "lifetime";

export interface PlanLimits {
  productsMax: number | "unlimited";
  lowStockMax: number | "unlimited";
  outOfStockMax: number | "unlimited";
  branchesMax: number | "unlimited";
  businessCategoriesMax: number | "unlimited";
  reportsWindowDays: number | "lifetime";
}

export interface PlanDefinition {
  id: PlanId;
  label: string;
  tagline: string;
  badgeClass: string;
  limits: PlanLimits;
  /** route paths that are locked for this plan */
  lockedRoutes: string[];
  /** modules this plan unlocks (see MODULE_CATALOG) */
  modules: string[];
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    label: "Free",
    tagline: "Essential POS & inventory starter for solo store owners.",
    badgeClass: "bg-slate-400/15 text-slate-500",
    limits: {
      productsMax: 50,
      lowStockMax: 5,
      outOfStockMax: 5,
      branchesMax: 1,
      businessCategoriesMax: 1,
      reportsWindowDays: 7,
    },
    lockedRoutes: [
      "/dashboard/purchases",
      "/dashboard/reports",
      "/dashboard/analytics",
      "/dashboard/team",
    ],
    modules: [
      "product_master",
      "stock_ledger",
      "stock_adjustment",
      "basic_pos",
      "basic_profit",
      "basic_stock_view",
      "single_user",
      "basic_dashboard",
      "basic_ai_assistant",
      "category_management",
    ],
  },
  standard: {
    id: "standard",
    label: "Standard",
    tagline: "Growing businesses with supplier procurement & up to 3 branches.",
    badgeClass: "bg-sky-400/15 text-sky-500",
    limits: {
      productsMax: 500,
      lowStockMax: 50,
      outOfStockMax: 50,
      branchesMax: 3,
      businessCategoriesMax: 5,
      reportsWindowDays: 30,
    },
    lockedRoutes: [
      "/dashboard/analytics",
      "/dashboard/team",
    ],
    modules: [
      "product_master",
      "stock_ledger",
      "stock_adjustment",
      "multi_unit",
      "supplier_management",
      "purchase_entry",
      "purchase_intelligence",
      "advanced_pos",
      "customer_management",
      "return_refund",
      "profit_calc",
      "expense_tracking",
      "basic_stock_view",
      "stock_ledger_full",
      "smart_low_stock",
      "basic_dashboard",
      "report_generator",
      "multi_business",
      "category_management",
      "basic_ai_assistant",
      "ai_product_desc",
    ],
  },
  premium: {
    id: "premium",
    label: "Premium",
    tagline: "Complete retail powerhouse with Team Hub, deep analytics & 10 branches.",
    badgeClass: "bg-violet-400/15 text-violet-500",
    limits: {
      productsMax: "unlimited",
      lowStockMax: "unlimited",
      outOfStockMax: "unlimited",
      branchesMax: 10,
      businessCategoriesMax: "unlimited",
      reportsWindowDays: "lifetime",
    },
    lockedRoutes: [],
    modules: [
      "product_master",
      "stock_ledger",
      "stock_adjustment",
      "multi_unit",
      "batch_expiry",
      "fifo_engine",
      "supplier_management",
      "purchase_entry",
      "supplier_credit",
      "purchase_intelligence",
      "advanced_pos",
      "customer_management",
      "return_refund",
      "profit_calc",
      "net_profit",
      "expense_tracking",
      "basic_stock_view",
      "stock_ledger_full",
      "smart_low_stock",
      "multi_branch_sync",
      "stock_transfer",
      "role_based_access",
      "advanced_permissions",
      "audit_logs",
      "team_hub",
      "basic_dashboard",
      "report_generator",
      "analytics_dashboard",
      "realtime_insights",
      "api_access",
      "webhooks",
      "multi_business",
      "category_management",
      "business_rules",
      "full_ai_suite",
    ],
  },
  lifetime: {
    id: "lifetime",
    label: "Lifetime VIP",
    tagline: "Permanent VIP access, unlimited branches & priority AI engine.",
    badgeClass: "bg-amber-400/15 text-amber-500",
    limits: {
      productsMax: "unlimited",
      lowStockMax: "unlimited",
      outOfStockMax: "unlimited",
      branchesMax: "unlimited",
      businessCategoriesMax: "unlimited",
      reportsWindowDays: "lifetime",
    },
    lockedRoutes: [],
    modules: [
      "unlimited_usage",
      "priority_tier",
      "white_label",
      "early_access",
      "product_master",
      "stock_ledger",
      "stock_adjustment",
      "multi_unit",
      "batch_expiry",
      "fifo_engine",
      "supplier_management",
      "purchase_entry",
      "supplier_credit",
      "purchase_intelligence",
      "advanced_pos",
      "customer_management",
      "return_refund",
      "profit_calc",
      "net_profit",
      "expense_tracking",
      "basic_stock_view",
      "stock_ledger_full",
      "smart_low_stock",
      "multi_branch_sync",
      "stock_transfer",
      "role_based_access",
      "advanced_permissions",
      "audit_logs",
      "team_hub",
      "basic_dashboard",
      "report_generator",
      "analytics_dashboard",
      "realtime_insights",
      "api_access",
      "webhooks",
      "multi_business",
      "category_management",
      "business_rules",
      "full_ai_suite",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "standard", "premium", "lifetime"];

export const normalizePlan = (raw?: string | null): PlanId => {
  const p = (raw || "free").toLowerCase().trim();
  if (p === "standard") return "standard";
  if (p === "premium") return "premium";
  if (p === "lifetime" || p === "unlimited") return "lifetime";
  return "free";
};

export const getPlan = (raw?: string | null) => PLANS[normalizePlan(raw)];

export const isRouteLocked = (planRaw: string | null | undefined, path: string) => {
  const plan = getPlan(planRaw);
  return plan.lockedRoutes.some((p) => path === p || path.startsWith(p + "/"));
};

export const hasModule = (planRaw: string | null | undefined, moduleId: string) => {
  return getPlan(planRaw).modules.includes(moduleId);
};

export const minPlanForRoute = (path: string): PlanId => {
  for (const id of PLAN_ORDER) {
    if (!PLANS[id].lockedRoutes.some((p) => path === p || path.startsWith(p + "/"))) return id;
  }
  return "premium";
};
