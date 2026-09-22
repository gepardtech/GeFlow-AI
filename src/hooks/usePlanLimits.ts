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
  if (resourceKey === "categories") return "business_categories";
  return resourceKey;
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
    if (!row) return 0;
    return row.limit_value;
  };

  const isLocked = (resourceKey: string): boolean => {
    const row = getRow(resourceKey);
    if (!row) return true;
    return row.is_locked === true;
  };

  const isExceeded = (resourceKey: string, usage: number): boolean => {
    const row = getRow(resourceKey);
    if (!row) return true;
    if (row.is_locked) return true;
    if (row.limit_value === null) return false;
    return usage >= row.limit_value;
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