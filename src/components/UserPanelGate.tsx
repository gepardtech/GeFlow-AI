import { ReactNode, useMemo } from "react";
import { useLocation, Navigate } from "react-router-dom";
import PanelLayout from "@/components/PanelLayout";
import { userNavForPlanAndModules } from "@/lib/panelNav";
import { usePlan } from "@/hooks/usePlan";
import { useBusinessModules } from "@/hooks/useBusinessModules";
import { usePlatformFeatures } from "@/hooks/usePlatformFeatures";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useStaffRole, isPathAllowedForRole } from "@/hooks/useStaffRole";
import { usePlatformSettings } from "@/components/PlatformSettingsProvider";
import { isRouteLocked } from "@/lib/plans";
import PlanLockedScreen from "@/components/PlanLockedScreen";
import RoleRestrictedScreen from "@/components/RoleRestrictedScreen";
import MaintenanceScreen from "@/components/MaintenanceScreen";

interface Props {
  children: ReactNode;
  pageTitle: string;
  /** Module id this page belongs to. Category gating only applies to category-specific modules. */
  module?: string;
}

/**
 * Shared wrapper for ALL /dashboard/* pages.
 * - Loads plan in realtime
 * - Enforces Team Role Permissions (Cashier, Manager, Inventory Clerk, Owner)
 * - Renders the user PanelLayout with role and plan-aware identity
 * - Enforces Plan Tier limits & unlocks (Free / Standard / Premium / Lifetime)
 * - Shuts the panel down for non-admins when maintenance mode is on
 */
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

  // Check Staff Role access permission for the current path
  const isAllowedForStaff = useMemo(() => {
    return isPathAllowedForRole(staffRole, location.pathname);
  }, [staffRole, location.pathname]);

  // Filter sidebar navigation items based on active staff role
  const filteredNavItems = useMemo(() => {
    const baseNav = userNavForPlanAndModules(planId, modules, isEnabled);
    if (staffRole === "owner" || staffRole === "admin") {
      return baseNav;
    }
    return baseNav.filter((item) => isPathAllowedForRole(staffRole, item.to));
  }, [planId, modules, isEnabled, staffRole]);

  // Identity role badge text & styles
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
    return plan?.badgeClass || "bg-primary/10 text-primary";
  }, [isInventoryClerk, isCashier, staffRole, plan?.badgeClass]);

  // Maintenance mode: block non-admins only when explicitly enabled in platform settings
  if (settings?.maintenance_mode && !isAdmin) {
    return <MaintenanceScreen />;
  }

  // Auto redirect cashier directly to POS Terminal if landing on /dashboard
  if (!roleLoading && isCashier && (location.pathname === "/dashboard" || location.pathname === "/dashboard/")) {
    return <Navigate to="/dashboard/pos" replace />;
  }

  // Auto redirect inventory clerk directly to Inventory if landing on /dashboard
  if (!roleLoading && isInventoryClerk && (location.pathname === "/dashboard" || location.pathname === "/dashboard/")) {
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
      identityName={`${isCashier ? "Cashier" : isInventoryClerk ? "Clerk" : plan?.label || "Workspace"} ${firstName}`}
      identityRole={roleBadgeLabel}
      identityBadgeClass={roleBadgeClass}
      initial={initial}
      lockedPaths={planLoading ? [] : plan?.lockedRoutes || []}
    >
      {!roleLoading && !isAllowedForStaff ? (
        <RoleRestrictedScreen role={staffRole} pageTitle={pageTitle} path={location.pathname} />
      ) : showLocked ? (
        <PlanLockedScreen currentPlan={planId} path={location.pathname} pageTitle={pageTitle} />
      ) : (
        children
      )}
    </PanelLayout>
  );
};

export default UserPanelGate;



