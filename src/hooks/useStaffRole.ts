import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { getEmployeeBusinesses } from "@/lib/teamInviteService";

export type StaffRole = "owner" | "admin" | "manager" | "cashier" | "inventory";

export interface StaffRoleState {
  staffRole: StaffRole;
  isOwner: boolean;
  isAdminUser: boolean;
  isManager: boolean;
  isCashier: boolean;
  isInventoryClerk: boolean;
  isActiveStaff: boolean;
  loading: boolean;
  refreshRole: () => Promise<void>;
  canAccessPath: (path: string) => boolean;
}

/**
 * Allowed path configurations for each role:
 * - Cashier: POS terminal (full business inventory sync), Reports, Announcements, Support
 * - Manager: Full operational access across POS, Inventory, Purchases & Reports
 * - Inventory Clerk: Stock intake (Purchases), SKU catalog (Inventory, Low stock, Out of stock), Announcements, Support
 * - Store Owner / Platform Admin: Master business ownership, billing management, settings, team, and full access
 */
export const isPathAllowedForRole = (role: StaffRole, path: string): boolean => {
  const cleanPath = path.toLowerCase().split("?")[0].replace(/\/$/, "");

  // Owner and Platform Admin have unrestricted access
  if (role === "owner" || role === "admin") {
    return true;
  }

  // Manager: Full operational access across POS, Inventory, Purchases, Returns & Reports
  if (role === "manager") {
    const allowed = [
      "/dashboard",
      "/dashboard/pos",
      "/dashboard/returns",
      "/dashboard/inventory",
      "/dashboard/low-stock",
      "/dashboard/out-of-stock",
      "/dashboard/purchases",
      "/dashboard/reports",
      "/dashboard/report",
      "/dashboard/analytics",
      "/dashboard/announcements",
      "/dashboard/support",
    ];
    return allowed.some((p) => cleanPath === p || cleanPath.startsWith(p + "/"));
  }

  // Inventory Clerk: Stock intake, SKU catalog, returns, and out-of-stock monitoring
  if (role === "inventory") {
    const allowed = [
      "/dashboard/inventory",
      "/dashboard/returns",
      "/dashboard/low-stock",
      "/dashboard/out-of-stock",
      "/dashboard/purchases",
      "/dashboard/announcements",
      "/dashboard/support",
    ];
    return allowed.some((p) => cleanPath === p || cleanPath.startsWith(p + "/"));
  }

  // Cashier: POS, Returns, and Reports
  if (role === "cashier") {
    const allowed = [
      "/dashboard/pos",
      "/dashboard/returns",
      "/dashboard/reports",
      "/dashboard/report",
      "/dashboard/announcements",
      "/dashboard/support",
    ];
    return allowed.some((p) => cleanPath === p || cleanPath.startsWith(p + "/"));
  }

  return true;
};

export const useStaffRole = (): StaffRoleState => {
  const { isAdmin } = useIsAdmin();
  const [role, setRole] = useState<StaffRole>(() => {
    try {
      const mode = localStorage.getItem("geflow.workspaceMode") || "business";
      if (mode === "employee") {
        const emp = localStorage.getItem("geflow_employee_role") || localStorage.getItem("geflow_cached_staff_role");
        if (emp === "manager" || emp === "cashier" || emp === "inventory") return emp as StaffRole;
        return "cashier";
      }
      const cached = localStorage.getItem("geflow_cached_staff_role");
      if (cached === "manager" || cached === "cashier" || cached === "inventory" || cached === "admin" || cached === "owner") {
        return cached as StaffRole;
      }
    } catch {
      /* ignore storage errors */
    }
    return "owner";
  });
  const [isActive, setIsActive] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchRole = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setRole("owner");
        setLoading(false);
        return;
      }

      // Check if user is a platform admin
      if (isAdmin) {
        setRole("admin");
        setIsActive(true);
        setLoading(false);
        return;
      }

      const activeBizId = localStorage.getItem("geflow.activeBusinessId");
      let currentMode = localStorage.getItem("geflow.workspaceMode") || "business";

      // Check support_team_members and owned businesses
      const [teamMembersRes, ownedRes] = await Promise.all([
        supabase
          .from("support_team_members")
          .select("appointed_by_user_id, role, is_active")
          .eq("user_id", user.id),
        supabase
          .from("businesses")
          .select("id, owner_user_id")
          .eq("owner_user_id", user.id)
          .limit(1),
      ]);

      const teamMembers = teamMembersRes.data || [];
      const hasOwnedBusinesses = (ownedRes.data?.length ?? 0) > 0;

      // If user has no owned businesses but has team memberships, force employee mode
      if (!hasOwnedBusinesses && teamMembers.length > 0) {
        currentMode = "employee";
        localStorage.setItem("geflow.workspaceMode", "employee");
      }

      // If user is in "business" mode (Owner):
      if (currentMode === "business") {
        setRole("owner");
        setIsActive(true);
        localStorage.setItem("geflow_cached_staff_role", "owner");
        setLoading(false);
        return;
      }

      // In employee mode: resolve the EXACT role appointed by Store Owner
      if (currentMode === "employee") {
        let resolved: StaffRole = "cashier";
        let activeStatus = true;
        let foundRole = false;

        // 1. Check verified employee businesses from team service API
        try {
          const apiStaff = await getEmployeeBusinesses(user.id, user.email);
          if (apiStaff && apiStaff.length > 0) {
            const currentStaffBiz = activeBizId
              ? apiStaff.find((b) => b.id === activeBizId) || apiStaff[0]
              : apiStaff[0];

            if (currentStaffBiz?.staff_role) {
              const r = String(currentStaffBiz.staff_role).toLowerCase().trim();
              if (r === "manager" || r === "admin") {
                resolved = "manager";
                foundRole = true;
              } else if (r === "inventory" || r === "clerk" || r.includes("inventory")) {
                resolved = "inventory";
                foundRole = true;
              } else if (r === "cashier" || r.startsWith("cash")) {
                resolved = "cashier";
                foundRole = true;
              }
            }
          }
        } catch (apiErr) {
          console.warn("Notice checking staff role via team service API:", apiErr);
        }

        // 2. Check Supabase support_team_members
        if (!foundRole && teamMembers.length > 0) {
          let matchingMembership = teamMembers[0];

          if (activeBizId) {
            // First look for role explicitly tagged with ::businessId
            const roleMatch = teamMembers.find((m) => m.role?.endsWith("::" + activeBizId));
            if (roleMatch) {
              matchingMembership = roleMatch;
            } else {
              const { data: activeBiz } = await supabase
                .from("businesses")
                .select("owner_user_id")
                .eq("id", activeBizId)
                .maybeSingle();

              if (activeBiz?.owner_user_id) {
                const match = teamMembers.find((m) => m.appointed_by_user_id === activeBiz.owner_user_id);
                if (match) matchingMembership = match;
              }
            }
          }

          const rawRole = (matchingMembership.role || "").toLowerCase().trim();
          const cleanRole = rawRole.includes("::") ? rawRole.split("::")[0] : rawRole;
          if (cleanRole === "manager" || cleanRole === "admin") {
            resolved = "manager";
            foundRole = true;
          } else if (cleanRole === "inventory" || cleanRole === "clerk" || cleanRole.includes("inventory")) {
            resolved = "inventory";
            foundRole = true;
          } else if (cleanRole === "cashier" || cleanRole.startsWith("cash")) {
            resolved = "cashier";
            foundRole = true;
          }
          activeStatus = matchingMembership.is_active !== false;
        }

        // 3. Fallback to localStorage cached staff business or role
        if (!foundRole) {
          try {
            const rawStored = localStorage.getItem("geflow_staff_businesses");
            if (rawStored) {
              const parsed = JSON.parse(rawStored);
              const bizMatch = activeBizId ? parsed.find((b: any) => b.id === activeBizId) : parsed[0];
              if (bizMatch?.staff_role) {
                const r = String(bizMatch.staff_role).toLowerCase().trim();
                if (r === "manager" || r === "admin") resolved = "manager";
                else if (r === "inventory" || r === "clerk" || r.includes("inventory")) resolved = "inventory";
                else if (r === "cashier" || r.startsWith("cash")) resolved = "cashier";
                foundRole = true;
              }
            }
          } catch (storageErr) {
            console.debug("Failed reading staff businesses:", storageErr);
          }
        }

        // 4. Default to explicit employee role preference or cashier
        if (!foundRole) {
          const storedRole = (localStorage.getItem("geflow_employee_role") || "cashier").toLowerCase().trim();
          if (storedRole === "manager") resolved = "manager";
          else if (storedRole === "inventory") resolved = "inventory";
          else resolved = "cashier";
        }

        setRole(resolved);
        setIsActive(activeStatus);
        localStorage.setItem("geflow_cached_staff_role", resolved);
        localStorage.setItem("geflow_employee_role", resolved);
      } else {
        setRole("owner");
        setIsActive(true);
        localStorage.setItem("geflow_cached_staff_role", "owner");
      }
    } catch (err) {
      console.error("Failed to resolve user staff role:", err);
      setRole("owner");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchRole();

    const onModeChange = () => fetchRole();
    window.addEventListener("geflow:mode-changed", onModeChange);
    window.addEventListener("geflow:business-changed", onModeChange);

    const channel = supabase
      .channel(`staff_role_realtime_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_team_members" }, () => {
        fetchRole();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => {
        fetchRole();
      })
      .subscribe();

    return () => {
      window.removeEventListener("geflow:mode-changed", onModeChange);
      window.removeEventListener("geflow:business-changed", onModeChange);
      supabase.removeChannel(channel);
    };
  }, [fetchRole]);

  return {
    staffRole: role,
    isOwner: role === "owner",
    isAdminUser: role === "admin",
    isManager: role === "manager" || role === "owner" || role === "admin",
    isCashier: role === "cashier",
    isInventoryClerk: role === "inventory",
    isActiveStaff: isActive,
    loading,
    refreshRole: fetchRole,
    canAccessPath: (path: string) => isPathAllowedForRole(role, path),
  };
};
