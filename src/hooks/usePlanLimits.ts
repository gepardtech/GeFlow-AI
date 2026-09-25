import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/hooks/usePlan";

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

/** Map old caller aliases → DB resource_key */
const normalizeResourceKey = (resourceKey: string): string => {
  const k = resourceKey.toLowerCase().trim();
  if (k === "categories") return "business_categories";
  if (k === "items") return "products";
  if (k === "stores") return "branches";
  return k;
};

/** Default resource limits per plan when database row is not yet cached or offline */
const DEFAULT_FALLBACK_LIMITS: Record<string, Record<string, { limit_value: number | null; is_locked: boolean }>> = {
  free: {
    products: { limit_value: 50, is_locked: false },
    branches: { limit_value: 1, is_locked: false },
    low_stock: { limit_value: 5, is_locked: false },
    out_of_stock: { limit_value: 5, is_locked: false },
    reports_days: { limit_value: 7, is_locked: false },
    team_members: { limit_value: 0, is_locked: true },
    business_categories: { limit_value: 1, is_locked: false },
    businesses: { limit_value: 1, is_locked: false },
  },
  standard: {
    products: { limit_value: 100, is_locked: false },
    branches: { limit_value: 3, is_locked: false },
    low_stock: { limit_value: 25, is_locked: false },
    out_of_stock: { limit_value: 25, is_locked: false },
    reports_days: { limit_value: 30, is_locked: false },
    team_members: { limit_value: 5, is_locked: false },
    business_categories: { limit_value: 5, is_locked: false },
    businesses: { limit_value: 3, is_locked: false },
  },
  premium: {
    products: { limit_value: null, is_locked: false },
    branches: { limit_value: null, is_locked: false },
    low_stock: { limit_value: null, is_locked: false },
    out_of_stock: { limit_value: null, is_locked: false },
    reports_days: { limit_value: null, is_locked: false },
    team_members: { limit_value: null, is_locked: false },
    business_categories: { limit_value: null, is_locked: false },
    businesses: { limit_value: null, is_locked: false },
  },
  lifetime: {
    products: { limit_value: null, is_locked: false },
    branches: { limit_value: null, is_locked: false },
    low_stock: { limit_value: null, is_locked: false },
    out_of_stock: { limit_value: null, is_locked: false },
    reports_days: { limit_value: null, is_locked: false },
    team_members: { limit_value: null, is_locked: false },
    business_categories: { limit_value: null, is_locked: false },
    businesses: { limit_value: null, is_locked: false },
  },
};

/**
 * Live plan_limits from Supabase only (no local plans.ts fallback).
 * Realtime subscription keeps quotas in sync across the app.
 */
export const usePlanLimits = (): PlanLimitsState => {
  const { planId, loading: planLoading } = usePlan();
  const [rows, setRows] = useState<PlanLimitRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!planId) {
      setRows([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("plan_limits")
        .select("plan_key, resource_key, label, limit_value, is_locked")
        .eq("plan_key", planId);

      if (error) {
        console.error("Failed to load plan_limits from Supabase:", error.message);
        setRows([]);
      } else {
        setRows((data as PlanLimitRow[]) ?? []);
      }
    } catch (err) {
      console.error("plan_limits load exception:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    if (planLoading) return;

    setLoading(true);
    load();

    const channelName = `plan_limits_${planId ?? "none"}`;
    const ch = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plan_limits" },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [planId, planLoading, load]);

  const limits: Record<string, PlanLimitRow> = {};
  rows.forEach((r) => {
    limits[r.resource_key] = r;
  });

  const getRow = (resourceKey: string): PlanLimitRow | undefined => {
    const key = normalizeResourceKey(resourceKey);
    return limits[key];
  };

  /**
   * DB row missing → treat as locked quota (fail-closed).
   * limit_value null in DB → unlimited.
   */
  const getLimit = (resourceKey: string): number | null => {
    const row = getRow(resourceKey);
    if (row) return row.limit_value;

    const p = (planId || "free").toLowerCase();
    const fallback = DEFAULT_FALLBACK_LIMITS[p]?.[normalizeResourceKey(resourceKey)];
    if (fallback !== undefined) return fallback.limit_value;
    if (p === "premium" || p === "lifetime") return null;
    return null;
  };

  const isLocked = (resourceKey: string): boolean => {
    const row = getRow(resourceKey);
    if (row) return row.is_locked === true;

    const p = (planId || "free").toLowerCase();
    const fallback = DEFAULT_FALLBACK_LIMITS[p]?.[normalizeResourceKey(resourceKey)];
    if (fallback !== undefined) return fallback.is_locked;
    if (p === "premium" || p === "lifetime") return false;
    return false;
  };

  const isExceeded = (resourceKey: string, usage: number): boolean => {
    const row = getRow(resourceKey);
    if (row) {
      if (row.is_locked) return true;
      if (row.limit_value === null) return false;
      return usage >= row.limit_value;
    }

    const p = (planId || "free").toLowerCase();
    const fallback = DEFAULT_FALLBACK_LIMITS[p]?.[normalizeResourceKey(resourceKey)];
    if (fallback) {
      if (fallback.is_locked) return true;
      if (fallback.limit_value === null) return false;
      return usage >= fallback.limit_value;
    }
    if (p === "premium" || p === "lifetime") return false;
    return false;
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