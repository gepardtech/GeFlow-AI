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

/** Fallback used only until the live rows arrive (prevents empty flash). */
const FALLBACK: Record<string, Partial<PricingPlanRow>> = {
  free: {
    name: "Free",
    tagline: "Always free",
    monthly_price: 0,
    yearly_price: 0,
    lifetime_price: 0,
    badge_text: "FOREVER FREE",
    badge_position: "top",
    badge_cycle: "all",
    is_popular: false,
  },
  standard: {
    name: "Standard",
    tagline: "For growing retailers",
    monthly_price: 4.99,
    yearly_price: 14.99,
    lifetime_price: 49.99,
    badge_text: "MOST POPULAR",
    badge_position: "top",
    badge_cycle: "monthly",
    is_popular: true,
  },
  premium: {
    name: "Premium",
    tagline: "For advanced operations",
    monthly_price: 9.99,
    yearly_price: 24.99,
    lifetime_price: 99.99,
    badge_text: "20% OFF",
    badge_position: "top",
    badge_cycle: "yearly",
    is_popular: false,
  },
};

/**
 * Live pricing plans straight from the admin Billing → Pricing Plans table.
 * Subscribes to realtime so any admin price/feature/badge edit lands on the
 * landing page, checkout and user upgrade screens within a second.
 */
export const usePricingPlans = () => {
  const [plans, setPlans] = useState<PricingPlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("pricing_plans")
        .select("*")
        .order("sort_order", { ascending: true });
      setPlans(((data ?? []) as unknown as PricingPlanRow[]).filter((p) => p.is_active));
    } catch (err) {
      console.warn("Failed to load pricing plans:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`pricing_plans_rt_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pricing_plans" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const byKey = (key: string): PricingPlanRow | null => {
    const row = plans.find((p) => p.plan_key?.toLowerCase() === key.toLowerCase());
    if (row) return row;
    const fb = FALLBACK[key];
    return fb ? ({ plan_key: key, features: [], is_active: true, ...fb } as PricingPlanRow) : null;
  };

  const nameOf = (key: string, fallback = ""): string => {
    const p = byKey(key);
    return p?.name || fallback;
  };

  const taglineOf = (key: string, fallback = ""): string => {
    const p = byKey(key);
    return p?.tagline || fallback;
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
    // If no custom badge_text is specified, but plan is marked popular
    if (p.is_popular && (cycle === "monthly" || cycle === "lifetime")) {
      return "MOST POPULAR";
    }
    return null;
  };

  const isPopular = (key: string): boolean => {
    const p = byKey(key);
    return Boolean(p?.is_popular);
  };

  const badgePositionOf = (key: string): "top" | "bottom" => {
    const p = byKey(key);
    return (p?.badge_position === "bottom") ? "bottom" : "top";
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
