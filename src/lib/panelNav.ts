import {
  Activity, Users, Building2, Tag, Package, CreditCard, Eye, BarChart3, Wallet,
  LifeBuoy, Settings, LayoutDashboard, AlertCircle, ShoppingCart, ShoppingBag,
  FileText, Settings as SettingsIcon, Repeat, DollarSign, Receipt, Undo2,
  SlidersHorizontal, Megaphone, TriangleAlert, Bell, ScrollText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PlanId } from "@/lib/plans";

export interface NavChild { label: string; to: string; }
export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  children?: NavChild[];
  /** Plans allowed to access this item. Undefined = all plans. */
  plans?: PlanId[];
  /** Business-category module id required to see this item. Undefined = always visible. */
  module?: string;
}

export const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", to: "/admin", icon: Activity },
  { label: "User Directory", to: "/admin/users", icon: Users },
  { label: "Businesses", to: "/admin/businesses", icon: Building2 },
  { label: "Business Categories", to: "/admin/business-categories", icon: Tag },
  { label: "Product Categories", to: "/admin/product-categories", icon: Package },
  {
    label: "Billing & Subs", to: "/admin/billing", icon: CreditCard,
    children: [
      { label: "Subscriptions", to: "/admin/billing/subscriptions" },
      { label: "Pricing Plans", to: "/admin/billing/pricing-plans" },
      { label: "Invoices", to: "/admin/billing/invoices" },
      { label: "Refunds", to: "/admin/billing/refunds" },
      { label: "Coupon Codes", to: "/admin/billing/coupons" },
    ],
  },
  { label: "Payment", to: "/admin/payments", icon: Wallet },
  { label: "Feature Control", to: "/admin/features", icon: Eye },
  { label: "Plan Limits", to: "/admin/plan-limits", icon: SlidersHorizontal },
  { label: "Logs", to: "/admin/logs", icon: ScrollText },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
  { label: "Notifications", to: "/admin/notifications", icon: Bell },
  { label: "Support", to: "/admin/support", icon: LifeBuoy },
  { label: "Settings", to: "/admin/settings", icon: Settings },
];

/**
 * Core GeFlow platform & account-level modules.
 * These modules represent fundamental SaaS infrastructure (account billing, subscription management,
 * workspace settings, support, notifications, multi-business directory, dashboard) and are NEVER gated
 * by business category mappings (e.g. Pharmacy, Retail, Grocery, etc. all have full access).
 */
export const CORE_MODULE_IDS = [
  "subscription",
  "billing",
  "businesses",
  "my_businesses",
  "dashboard",
  "settings",
  "workspace",
  "account",
  "support",
  "announcements",
  "notifications",
  "security",
] as const;

export type CoreModuleId = (typeof CORE_MODULE_IDS)[number];

/** Returns true if the given module is a platform-wide core module (not category-specific). */
export const isCoreModule = (moduleCode?: string | null): boolean => {
  if (!moduleCode) return true;
  const normalized = moduleCode.toLowerCase().trim();
  return (CORE_MODULE_IDS as readonly string[]).includes(normalized);
};

export const USER_NAV: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
  { label: "Inventory", to: "/dashboard/inventory", icon: Package, module: "inventory" },
  { label: "Low Stock", to: "/dashboard/low-stock", icon: TriangleAlert, module: "inventory" },
  { label: "Out of Stock", to: "/dashboard/out-of-stock", icon: AlertCircle, module: "inventory" },
  { label: "POS Terminal", to: "/dashboard/pos", icon: ShoppingCart, module: "pos" },
  { label: "Purchases", to: "/dashboard/purchases", icon: ShoppingBag, plans: ["standard", "premium", "lifetime"], module: "purchases" },
  { label: "Reports", to: "/dashboard/reports", icon: FileText, module: "reports" },
  { label: "Analytics", to: "/dashboard/analytics", icon: BarChart3, plans: ["premium", "lifetime"], module: "analytics" },
  { label: "My Businesses", to: "/dashboard/businesses", icon: Building2, module: "businesses" },
  { label: "Team Hub", to: "/dashboard/team", icon: Users, plans: ["standard", "premium", "lifetime"], module: "team" },
  { label: "Subscription", to: "/dashboard/subscription", icon: CreditCard, module: "subscription" },
  {
    label: "Announcements", to: "/dashboard/announcements", icon: Megaphone, module: "announcements",
    children: [
      { label: "All Updates", to: "/dashboard/announcements" },
      { label: "Notifications", to: "/dashboard/announcements/notifications" },
    ],
  },
  { label: "Support", to: "/dashboard/support", icon: LifeBuoy, module: "support" },
  { label: "Settings", to: "/dashboard/settings", icon: SettingsIcon, module: "settings" },
];

/** Returns the nav items a given plan is allowed to see. */
export const userNavForPlan = (planId: PlanId): NavItem[] =>
  USER_NAV.filter((item) => !item.plans || item.plans.includes(planId));

/**
 * Returns nav items allowed by BOTH the user's plan and the admin-appointed
 * modules for the active business category.
 * Core platform modules (Subscription, Settings, Support, Dashboard, etc.) ALWAYS bypass category gating.
 */
export const userNavForPlanAndModules = (
  planId: PlanId,
  modules: string[] | null,
  isFeatureEnabled: (code?: string | null) => boolean = () => true,
): NavItem[] =>
  USER_NAV.filter((item) => {
    // 1. Plan tier gating
    if (item.plans && !item.plans.includes(planId)) return false;

    // 2. Core platform modules are ALWAYS available and never restricted by business category
    if (item.module && isCoreModule(item.module)) {
      return true;
    }

    // 3. Category-specific module gating (e.g. inventory, pos, reports, purchases, team, analytics)
    if (item.module && modules !== null && !modules.includes(item.module)) return false;
    if (item.module && !isFeatureEnabled(item.module)) return false;
    return true;
  });



export const ADMIN_IDENTITY = {
  sidebarLabel: "SYSTEM ORCHESTRATION",
  identityName: "Admin Bilal",
  identityRole: "SYSTEM ADMIN",
  identityBadgeClass: "bg-rose-500/15 text-rose-500",
  initial: "A",
};

export const USER_IDENTITY = {
  sidebarLabel: "BUSINESS WORKSPACE",
  identityName: "Operator",
  identityRole: "ACCOUNT OWNER",
  identityBadgeClass: "bg-sky-400/15 text-sky-500",
  initial: "U",
};

// re-export icons used by other files if needed
export { Repeat, DollarSign, Receipt, Undo2 };
