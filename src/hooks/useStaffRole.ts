import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";

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
 * - Cashier: POS Page, Dashboard, Analytics & Reports (read-only), Announcements, Support
 * - Inventory Clerk: ONLY Inventory, Low Stock, Out of Stock, Support
 * - Manager / Owner / Admin: Full Access
 */
export const isPathAllowedForRole = (role: StaffRole, path: string): boolean => {
  const cleanPath = path.toLowerCase().split("?")[0].replace(/\/$/, "");

  // Owner and Platform Admin have unrestricted access
  if (role === "owner" || role === "admin") {
    return true;
  }

  // Manager: Full operational access across POS, Inventory, Purchases & Reports
  if (role === "manager") {
    const allowed = [
      "/dashboard",
      "/dashboard/pos",
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

  // Inventory Clerk: Stock intake (Purchases), SKU catalog (Inventory, Low stock, Out of stock)
  if (role === "inventory") {
    const allowed = [
      "/dashboard/inventory",
      "/dashboard/low-stock",
      "/dashboard/out-of-stock",
      "/dashboard/purchases",
      "/dashboard/announcements",
      "/dashboard/support",
    ];
    return allowed.some((p) => cleanPath === p || cleanPath.startsWith(p + "/"));
  }

  // Cashier: POS terminal checkout, receipt dispatch, and daily sales counter
  if (role === "cashier") {
    const allowed = [
      "/dashboard/pos",
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

      // In employee mode:
      if (currentMode === "employee") {
        let resolved: StaffRole = "cashier";
        let activeStatus = true;

        if (teamMembers.length > 0) {
          let matchingMembership = teamMembers[0];

          if (activeBizId) {
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

          const rawRole = (matchingMembership.role || "").toLowerCase().trim();
          if (rawRole === "manager" || rawRole === "admin") resolved = "manager";
          else if (rawRole === "inventory" || rawRole.includes("inventory")) resolved = "inventory";
          else resolved = "cashier";
          activeStatus = matchingMembership.is_active !== false;
        } else {
          // Employee mode default (e.g. Retail Store Cashier)
          const storedRole = (localStorage.getItem("geflow_employee_role") || "cashier").toLowerCase().trim();
          if (storedRole === "manager" || storedRole === "inventory") {
            resolved = storedRole as StaffRole;
          } else {
            resolved = "cashier";
          }
        }

        setRole(resolved);
        setIsActive(activeStatus);
        localStorage.setItem("geflow_cached_staff_role", resolved);
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
