import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PricingPlanRow {
  id: string;
  plan_key: string;
  name: string;
  tagline: string | null;
  monthly_price: number;
  yearly_price: number;
  lifetime_price: number;
  features: string[];
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
  badge_text: string | null;
  badge_position: string;
  badge_cycle: string;
}

export type BillingCycle = "monthly" | "yearly" | "lifetime";

/**
 * Live pricing plans from Supabase only (admin → Billing → Pricing).
 * Realtime: price / badge / feature edits update landing, checkout, upgrade instantly.
 * No local FALLBACK data.
 */
export const usePricingPlans = () => {
  const [plans, setPlans] = useState<PricingPlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pricing-plans");
      const json = await res.json();
      if (json.success && Array.isArray(json.plans)) {
        const rows = json.plans as PricingPlanRow[];
        setPlans(rows.filter((p) => p.is_active !== false));
      } else {
        const { data, error } = await supabase
          .from("pricing_plans")
          .select("*")
          .order("sort_order", { ascending: true });

        if (error) {
          console.error("Failed to load pricing_plans:", error.message);
          setPlans([]);
        } else {
          const rows = (data ?? []) as unknown as PricingPlanRow[];
          setPlans(rows.filter((p) => p.is_active !== false));
        }
      }
    } catch (err) {
      console.error("pricing_plans load exception:", err);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();

    const ch = supabase
      .channel("pricing_plans_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pricing_plans" },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const byKey = (key: string): PricingPlanRow | null => {
    const row = plans.find(
      (p) => p.plan_key?.toLowerCase() === key.toLowerCase()
    );
    return row ?? null;
  };

  const nameOf = (key: string, fallback = ""): string => {
    return byKey(key)?.name || fallback;
  };

  const taglineOf = (key: string, fallback = ""): string => {
    return byKey(key)?.tagline || fallback;
  };

  const priceOf = (key: string, cycle: BillingCycle, fallback = 0): number => {
    const p = byKey(key);
    if (!p) return fallback;
    if (cycle === "yearly") return Number(p.yearly_price ?? fallback);
    if (cycle === "lifetime") return Number(p.lifetime_price ?? fallback);
    return Number(p.monthly_price ?? fallback);
  };

  const featuresOf = (key: string, fallback: string[] = []): string[] => {
    const f = byKey(key)?.features;
    return f && f.length ? f : fallback;
  };

  const badgeOf = (key: string, cycle: BillingCycle): string | null => {
    const p = byKey(key);
    if (!p) return null;

    if (p.badge_text && p.badge_text.trim()) {
      if (!p.badge_cycle || p.badge_cycle === "all" || p.badge_cycle === cycle) {
        return p.badge_text.trim();
      }
      return null;
    }

    if (p.is_popular && (cycle === "monthly" || cycle === "lifetime")) {
      return "MOST POPULAR";
    }

    return null;
  };

  const isPopular = (key: string): boolean => {
    return Boolean(byKey(key)?.is_popular);
  };

  const badgePositionOf = (key: string): "top" | "bottom" => {
    const p = byKey(key);
    return p?.badge_position === "bottom" ? "bottom" : "top";
  };

  return {
    plans,
    loading,
    byKey,
    nameOf,
    taglineOf,
    priceOf,
    featuresOf,
    badgeOf,
    isPopular,
    badgePositionOf,
    reload: load,
  };
};