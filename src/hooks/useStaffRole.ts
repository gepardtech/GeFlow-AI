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

  // Owner, Manager, and Platform Admin have full access
  if (role === "owner" || role === "admin" || role === "manager") {
    return true;
  }

  // Inventory Clerk: ONLY Inventory, Low & Out of Stock pages
  if (role === "inventory") {
    const allowed = [
      "/dashboard/inventory",
      "/dashboard/low-stock",
      "/dashboard/out-of-stock",
      "/dashboard/support",
    ];
    return allowed.some((p) => cleanPath === p || cleanPath.startsWith(p + "/"));
  }

  // Cashier: POS, Dashboard, Analytics, Reports, Announcements, Support
  if (role === "cashier") {
    const allowed = [
      "/dashboard/pos",
      "/dashboard",
      "/dashboard/analytics",
      "/dashboard/reports",
      "/dashboard/announcements",
      "/dashboard/support",
    ];
    return allowed.some((p) => cleanPath === p || cleanPath.startsWith(p + "/"));
  }

  return true;
};

export const useStaffRole = (): StaffRoleState => {
  const { isAdmin } = useIsAdmin();
  const [role, setRole] = useState<StaffRole>("owner");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

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

      // Check support_team_members for assigned operational role
      const { data: teamMember, error } = await supabase
        .from("support_team_members")
        .select("role, is_active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && teamMember) {
        const rawRole = (teamMember.role || "").toLowerCase().trim();
        if (rawRole === "manager") setRole("manager");
        else if (rawRole === "cashier") setRole("cashier");
        else if (rawRole === "inventory") setRole("inventory");
        else if (rawRole === "admin") setRole("manager"); // Map store admin to manager at user level
        else setRole("cashier");

        setIsActive(teamMember.is_active !== false);
      } else {
        // If not listed as a team member, this user is the primary workspace owner
        setRole("owner");
        setIsActive(true);
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

    const channel = supabase
      .channel("staff_role_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_team_members" }, () => {
        fetchRole();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => {
        fetchRole();
      })
      .subscribe();

    return () => {
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
