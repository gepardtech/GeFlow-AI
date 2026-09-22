import { ReactNode, useMemo } from "react";
import { useLocation, Navigate } from "react-router-dom";
import PanelLayout from "@/components/PanelLayout";
import { userNavForPlanAndModules } from "@/lib/panelNav";
import { usePlan, PlanId } from "@/hooks/usePlan";
import { useBusinessModules } from "@/hooks/useBusinessModules";
import { usePlatformFeatures } from "@/hooks/usePlatformFeatures";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useStaffRole, isPathAllowedForRole } from "@/hooks/useStaffRole";
import { usePlatformSettings } from "@/components/PlatformSettingsProvider";
import PlanLockedScreen from "@/components/PlanLockedScreen";
import RoleRestrictedScreen from "@/components/RoleRestrictedScreen";
import MaintenanceScreen from "@/components/MaintenanceScreen";

interface Props {
  children: ReactNode;
  pageTitle: string;
  module?: string;
}

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  standard: 1,
  premium: 2,
  lifetime: 3,
};

/** Minimum plan required for each dashboard route prefix */
const ROUTE_MIN_PLAN: { prefix: string; min: PlanId }[] = [
  { prefix: "/dashboard/purchases", min: "standard" },
  { prefix: "/dashboard/analytics", min: "premium" },
  { prefix: "/dashboard/team", min: "premium" },
];

export function isRouteLocked(planId: PlanId, path: string): boolean {
  const rank = PLAN_RANK[planId] ?? 0;
  return ROUTE_MIN_PLAN.some((rule) => {
    if (path === rule.prefix || path.startsWith(rule.prefix + "/")) {
      return rank < PLAN_RANK[rule.min];
    }
    return false;
  });
}

function lockedPathsForPlan(planId: PlanId): string[] {
  const rank = PLAN_RANK[planId] ?? 0;
  return ROUTE_MIN_PLAN.filter((r) => rank < PLAN_RANK[r.min]).map((r) => r.prefix);
}

const BADGE_CLASS: Record<PlanId, string> = {
  free: "bg-slate-400/15 text-slate-500",
  standard: "bg-sky-400/15 text-sky-500",
  premium: "bg-violet-400/15 text-violet-500",
  lifetime: "bg-amber-400/15 text-amber-500",
};

const UserPanelGate = ({ children, pageTitle }: Props) => {
  const { plan, planId, fullName, loading: planLoading } = usePlan();
  const { modules } = useBusinessModules();
  const { isEnabled } = usePlatformFeatures(planId);
  const { isAdmin } = useIsAdmin();
  const { staffRole, isCashier, isInventoryClerk, loading: roleLoading } = useStaffRole();
  const { settings } = usePlatformSettings();
  const location = useLocation();

  const firstName = fullName?.split(" ")[0] || "Operator";
  const initial = firstName.charAt(0).toUpperCase();

  const locked = isRouteLocked(planId, location.pathname);
  const showLocked = !planLoading && locked;

  const isAllowedForStaff = useMemo(() => {
    return isPathAllowedForRole(staffRole, location.pathname);
  }, [staffRole, location.pathname]);

  const filteredNavItems = useMemo(() => {
    const baseNav = userNavForPlanAndModules(planId, modules, isEnabled);
    if (staffRole === "owner" || staffRole === "admin") {
      return baseNav;
    }
    return baseNav.filter((item) => isPathAllowedForRole(staffRole, item.to));
  }, [planId, modules, isEnabled, staffRole]);

  const roleBadgeLabel = useMemo(() => {
    if (isInventoryClerk) return "INVENTORY CLERK";
    if (isCashier) return "CASHIER";
    if (staffRole === "manager") return "MANAGER";
    return `${(plan?.label || "Pro").toUpperCase()} PLAN`;
  }, [isInventoryClerk, isCashier, staffRole, plan?.label]);

  const roleBadgeClass = useMemo(() => {
    if (isInventoryClerk) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    if (isCashier) return "bg-sky-500/15 text-sky-600 dark:text-sky-400";
    if (staffRole === "manager") return "bg-purple-500/15 text-purple-600 dark:text-purple-400";
    return BADGE_CLASS[planId] || "bg-primary/10 text-primary";
  }, [isInventoryClerk, isCashier, staffRole, planId]);

  if (settings?.maintenance_mode && !isAdmin) {
    return <MaintenanceScreen />;
  }

  if (
    !roleLoading &&
    isCashier &&
    (location.pathname === "/dashboard" || location.pathname === "/dashboard/")
  ) {
    return <Navigate to="/dashboard/pos" replace />;
  }

  if (
    !roleLoading &&
    isInventoryClerk &&
    (location.pathname === "/dashboard" || location.pathname === "/dashboard/")
  ) {
    return <Navigate to="/dashboard/inventory" replace />;
  }

  return (
    <PanelLayout
      sidebarLabel={
        isCashier
          ? "POS WORKSPACE (CASHIER)"
          : isInventoryClerk
          ? "INVENTORY WORKSPACE"
          : staffRole === "manager"
          ? "MANAGER WORKSPACE"
          : "BUSINESS WORKSPACE (OWNER)"
      }
      navItems={filteredNavItems}
      identityName={`${
        isCashier ? "Cashier" : isInventoryClerk ? "Clerk" : plan?.label || "Workspace"
      } ${firstName}`}
      identityRole={roleBadgeLabel}
      identityBadgeClass={roleBadgeClass}
      initial={initial}
      lockedPaths={planLoading ? [] : lockedPathsForPlan(planId)}
    >
      {!roleLoading && !isAllowedForStaff ? (
        <RoleRestrictedScreen
          role={staffRole}
          pageTitle={pageTitle}
          path={location.pathname}
        />
      ) : showLocked ? (
        <PlanLockedScreen
          currentPlan={planId}
          path={location.pathname}
          pageTitle={pageTitle}
        />
      ) : (
        children
      )}
    </PanelLayout>
  );
};

export default UserPanelGate;