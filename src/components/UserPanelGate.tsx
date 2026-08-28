import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import PanelLayout from "@/components/PanelLayout";
import { userNavForPlanAndModules } from "@/lib/panelNav";
import { usePlan } from "@/hooks/usePlan";
import { useBusinessModules } from "@/hooks/useBusinessModules";
import { usePlatformFeatures } from "@/hooks/usePlatformFeatures";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePlatformSettings } from "@/components/PlatformSettingsProvider";
import { isRouteLocked } from "@/lib/plans";
import PlanLockedScreen from "@/components/PlanLockedScreen";
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
 * - Renders the user PanelLayout with plan-aware identity
 * - Keeps navigation and pages fully accessible, functional, and responsive
 * - Shuts the panel down for non-admins when maintenance mode is on
 */
const UserPanelGate = ({ children, pageTitle }: Props) => {
  const { plan, planId, fullName, loading } = usePlan();
  const { modules } = useBusinessModules();
  const { isEnabled } = usePlatformFeatures(planId);
  const { isAdmin } = useIsAdmin();
  const { settings } = usePlatformSettings();
  const location = useLocation();

  // Maintenance mode: block non-admins only when explicitly enabled in platform settings
  if (settings?.maintenance_mode && !isAdmin) {
    return <MaintenanceScreen />;
  }

  const firstName = fullName?.split(" ")[0] || "Operator";
  const initial = firstName.charAt(0).toUpperCase();
  const locked = isRouteLocked(planId, location.pathname);
  const showLocked = !loading && locked;

  return (
    <PanelLayout
      sidebarLabel="BUSINESS WORKSPACE"
      navItems={userNavForPlanAndModules(planId, modules, isEnabled)}
      identityName={`${plan?.label || "Workspace"} ${firstName}`}
      identityRole={`${(plan?.label || "Pro").toUpperCase()} PLAN`}
      identityBadgeClass={plan?.badgeClass || "bg-primary/10 text-primary"}
      initial={initial}
      lockedPaths={loading ? [] : plan?.lockedRoutes || []}
    >
      {showLocked ? (
        <PlanLockedScreen currentPlan={planId} path={location.pathname} pageTitle={pageTitle} />
      ) : (
        children
      )}
    </PanelLayout>
  );
};

export default UserPanelGate;


