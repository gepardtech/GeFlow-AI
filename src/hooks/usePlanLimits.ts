import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/hooks/usePlan";
import { PLANS, PlanId } from "@/lib/plans";

export interface PlanLimitRow {
  plan_key: string;
  resource_key: string;
  label: string;
  limit_value: number | null; // null = unlimited
  is_locked: boolean;
}

export interface PlanLimitsState {
  loading: boolean;
  /** resource_key -> row for the current user's plan */
  limits: Record<string, PlanLimitRow>;
  /** returns the numeric limit for a resource, or null when unlimited */
  getLimit: (resourceKey: string) => number | null;
  /** true when the resource is fully locked for this plan */
  isLocked: (resourceKey: string) => boolean;
  /** true when usage has reached/exceeded the limit */
  isExceeded: (resourceKey: string, usage: number) => boolean;
  /** remaining items that can be created (null if unlimited) */
  remaining: (resourceKey: string, usage: number) => number | null;
  reload: () => Promise<void>;
}

const getFallbackLimit = (planId: PlanId, resourceKey: string): number | null => {
  const planDef = PLANS[planId] || PLANS.free;
  if (resourceKey === "products") {
    const v = planDef.limits.productsMax;
    return v === "unlimited" ? null : v;
  }
  if (resourceKey === "low_stock") {
    const v = planDef.limits.lowStockMax;
    return v === "unlimited" ? null : v;
  }
  if (resourceKey === "out_of_stock") {
    const v = planDef.limits.outOfStockMax;
    return v === "unlimited" ? null : v;
  }
  if (resourceKey === "branches") {
    const v = planDef.limits.branchesMax;
    return v === "unlimited" ? null : v;
  }
  if (resourceKey === "categories") {
    const v = planDef.limits.businessCategoriesMax;
    return v === "unlimited" ? null : v;
  }
  if (resourceKey === "reports_days") {
    const v = planDef.limits.reportsWindowDays;
    return v === "lifetime" ? null : v;
  }
  if (resourceKey === "ai_requests") {
    if (planId === "free") return 20;
    if (planId === "standard") return 200;
    return null;
  }
  return null;
};

/**
 * Loads the live plan_limits rows for the current user's plan and keeps
 * them in sync via realtime. Used to enforce quotas on Inventory, POS etc.
 */
export const usePlanLimits = (): PlanLimitsState => {
  const { planId, loading: planLoading } = usePlan();
  const [rows, setRows] = useState<PlanLimitRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!planId) return;
    const { data } = await supabase
      .from("plan_limits")
      .select("plan_key, resource_key, label, limit_value, is_locked")
      .eq("plan_key", planId);
    setRows((data as PlanLimitRow[]) ?? []);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    if (planLoading) return;
    load();
    const ch = supabase
      .channel(`plan_limits_${planId}_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_limits" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [planId, planLoading, load]);

  const limits: Record<string, PlanLimitRow> = {};
  rows.forEach((r) => { limits[r.resource_key] = r; });

  const getLimit = (resourceKey: string): number | null => {
    const row = limits[resourceKey];
    if (row !== undefined) return row.limit_value;
    return getFallbackLimit(planId, resourceKey);
  };

  const isLocked = (resourceKey: string): boolean => {
    const row = limits[resourceKey];
    if (row !== undefined) return row.is_locked;
    return false;
  };

  const isExceeded = (resourceKey: string, usage: number): boolean => {
    const row = limits[resourceKey];
    if (row) {
      if (row.is_locked) return true;
      if (row.limit_value === null) return false;
      return usage >= row.limit_value;
    }
    const fallback = getFallbackLimit(planId, resourceKey);
    if (fallback === null) return false;
    return usage >= fallback;
  };

  const remaining = (resourceKey: string, usage: number): number | null => {
    const limit = getLimit(resourceKey);
    if (limit === null) return null;
    return Math.max(0, limit - usage);
  };

  return {
    loading: loading || planLoading,
    limits,
    getLimit,
    isLocked,
    isExceeded,
    remaining,
    reload: load,
  };
};
