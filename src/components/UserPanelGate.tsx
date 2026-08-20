import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import PanelLayout from "@/components/PanelLayout";
import { userNavForPlanAndModules, isCoreModule } from "@/lib/panelNav";
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
 * - Filters the sidebar to admin-appointed modules for the active business
 * - Ensures Core GeFlow modules (Subscription, Settings, Support, Businesses, Dashboard) are ALWAYS accessible
 * - Applies business-category-specific gating ONLY to operational category modules
 * - Blocks locked routes with an upgrade screen
 * - Shuts the panel down for non-admins when maintenance mode is on
 */
const UserPanelGate = ({ children, pageTitle, module }: Props) => {
  const { plan, planId, fullName, loading } = usePlan();
  const { modules, loading: modulesLoading } = useBusinessModules();
  const { isEnabled, loading: featuresLoading } = usePlatformFeatures(planId);
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { settings, loading: settingsLoading } = usePlatformSettings();
  const location = useLocation();

  if (loading || modulesLoading || featuresLoading || adminLoading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading workspace...
      </div>
    );
  }

  // Maintenance mode: block everyone except admins.
  if (settings?.maintenance_mode && !isAdmin) {
    return <MaintenanceScreen />;
  }

  const firstName = fullName?.split(" ")[0] || "Operator";
  const initial = firstName.charAt(0).toUpperCase();
  const locked = isRouteLocked(planId, location.pathname);

  // Core GeFlow platform modules (Subscription, Billing, Settings, Support, Businesses, Dashboard)
  // are SaaS account-level capabilities and are NEVER blocked by business category mappings.
  const isCore = isCoreModule(module);
  const categoryBlocked = !!module && !isCore && modules !== null && !modules.includes(module);
  const platformFeatureBlocked = !!module && !isCore && !isEnabled(module);
  const moduleBlocked = categoryBlocked || platformFeatureBlocked;

  return (
    <PanelLayout
      sidebarLabel="BUSINESS WORKSPACE"
      navItems={userNavForPlanAndModules(planId, modules, isEnabled)}
      identityName={`${plan.label} ${firstName}`}
      identityRole={`${plan.label.toUpperCase()} PLAN`}
      identityBadgeClass={plan.badgeClass}
      initial={initial}
      lockedPaths={plan.lockedRoutes}
    >
      {moduleBlocked ? (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
          <h2 className="text-2xl font-bold mb-2">{pageTitle} is not available</h2>
          <p className="text-muted-foreground max-w-md">
            This module hasn't been enabled for your business category. Contact your administrator to request access.
          </p>
        </div>
      ) : locked ? (
        <PlanLockedScreen currentPlan={planId} path={location.pathname} pageTitle={pageTitle} />
      ) : (
        children
      )}
    </PanelLayout>
  );
};

export default UserPanelGate;

