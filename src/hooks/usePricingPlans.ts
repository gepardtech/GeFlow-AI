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
  cta_button_text?: string | null;
}

export type BillingCycle = "monthly" | "yearly" | "lifetime";

const DEFAULT_PLANS: PricingPlanRow[] = [
  {
    id: "66b1e1e9-c498-47bb-98c0-55c7f333b894",
    plan_key: "free",
    name: "Free",
    tagline: "Always free for small stores",
    monthly_price: 0,
    yearly_price: 0,
    lifetime_price: 0,
    features: ["50 items limit", "Basic POS", "Single user", "Real-time Profit"],
    is_active: true,
    is_popular: false,
    sort_order: 1,
    badge_text: "FOREVER FREE",
    badge_position: "top",
    badge_cycle: "all",
    cta_button_text: null,
  },
  {
    id: "00e49c70-0a74-4914-acaa-c5f2b81e8e92",
    plan_key: "standard",
    name: "Standard",
    tagline: null,
    monthly_price: 9.99,
    yearly_price: 49.99,
    lifetime_price: 299.99,
    features: ["1000 items limit", "Full POS & Returns", "Multi-user support", "Financial summaries", "Supplier Portal"],
    is_active: true,
    is_popular: true,
    sort_order: 2,
    badge_text: "58% Off",
    badge_position: "top",
    badge_cycle: "yearly",
    cta_button_text: null,
  },
  {
    id: "e965c79c-bd2b-4991-9c21-259d2cdc23b8",
    plan_key: "premium",
    name: "Premium",
    tagline: "For advanced operations",
    monthly_price: 14.99,
    yearly_price: 74.99,
    lifetime_price: 499.99,
    features: ["Unlimited items", "Everything in Standard", "Batch & expiry tracking", "Advanced analytics", "Multi-branch support", "Priority support"],
    is_active: true,
    is_popular: false,
    sort_order: 3,
    badge_text: "58% OFF",
    badge_position: "top",
    badge_cycle: "yearly",
    cta_button_text: null,
  },
];

export const usePricingPlans = () => {
  const [plans, setPlans] = useState<PricingPlanRow[]>(() => DEFAULT_PLANS);
  const [lifetimeCustomizations, setLifetimeCustomizations] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pricing-plans");
      const json = await res.json();
      if (json.success && Array.isArray(json.plans) && json.plans.length > 0) {
        const rows = json.plans as PricingPlanRow[];
        setPlans(rows.filter((p) => p.is_active !== false));
        if (json.lifetime_customizations) {
          setLifetimeCustomizations(json.lifetime_customizations);
        }
      } else {
        const { data, error } = await supabase
          .from("pricing_plans")
          .select("*")
          .order("sort_order", { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          const rows = data as unknown as PricingPlanRow[];
          setPlans(rows.filter((p) => p.is_active !== false));
        }
      }
    } catch (err) {
      console.warn("pricing_plans load notice:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();

    const channelId = `pricing_plans_rt_${Math.random().toString(36).slice(2, 9)}`;
    const ch = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pricing_plans" },
        () => {
          load();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_settings" },
        () => {
          load();
        }
      )
      .subscribe();

    const onPricingUpdate = () => load();
    window.addEventListener("geflow:pricing-updated", onPricingUpdate);
    window.addEventListener("panel:refresh", onPricingUpdate);

    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("geflow:pricing-updated", onPricingUpdate);
      window.removeEventListener("panel:refresh", onPricingUpdate);
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
    const k = key.toLowerCase();
    if (cycle === "lifetime") {
      const customPrice = lifetimeCustomizations[k]?.lifetime_price;
      if (customPrice !== undefined && Number(customPrice) >= 0) return Number(customPrice);
    }
    const p = byKey(key);
    if (!p) return fallback;
    if (cycle === "yearly") return Number(p.yearly_price ?? fallback);
    if (cycle === "lifetime") return Number(p.lifetime_price ?? fallback);
    return Number(p.monthly_price ?? fallback);
  };

  const featuresOf = (key: string, fallback: string[] = [], cycle?: BillingCycle): string[] => {
    const k = key.toLowerCase();
    if (cycle === "lifetime") {
      const customFeat = lifetimeCustomizations[k]?.features;
      if (Array.isArray(customFeat) && customFeat.length > 0) return customFeat;
    }
    const f = byKey(key)?.features;
    return f && f.length ? f : fallback;
  };

  const badgeOf = (key: string, cycle: BillingCycle): string | null => {
    const k = key.toLowerCase();
    if (cycle === "lifetime") {
      const custom = lifetimeCustomizations[k];
      if (custom?.badge_text && custom.badge_text.trim()) {
        return custom.badge_text.trim();
      }
      if (custom?.is_popular) {
        return "MOST POPULAR";
      }
    }

    const p = byKey(key);
    if (!p) return null;

    if (p.badge_text && p.badge_text.trim()) {
      if (!p.badge_cycle || p.badge_cycle === "all" || p.badge_cycle === cycle) {
        return p.badge_text.trim();
      }
    }

    if (p.is_popular) {
      return "MOST POPULAR";
    }

    return null;
  };

  const isPopular = (key: string, cycle?: BillingCycle): boolean => {
    const k = key.toLowerCase();
    if (cycle === "lifetime") {
      const custom = lifetimeCustomizations[k];
      if (custom?.is_popular !== undefined) return Boolean(custom.is_popular);
    }
    return Boolean(byKey(key)?.is_popular);
  };

  const badgePositionOf = (key: string): "top" | "bottom" => {
    const p = byKey(key);
    return p?.badge_position === "bottom" ? "bottom" : "top";
  };

  const ctaTextOf = (key: string, fallback = "", cycle?: BillingCycle): string => {
    const k = key.toLowerCase();
    if (cycle === "lifetime") {
      const customLifetimeCta = lifetimeCustomizations[k]?.cta_button_text;
      if (customLifetimeCta && customLifetimeCta.trim()) {
        return customLifetimeCta.trim();
      }
    }
    const custom = byKey(key)?.cta_button_text;
    return custom && custom.trim() ? custom.trim() : fallback;
  };

  return {
    plans,
    lifetimeCustomizations,
    loading,
    byKey,
    nameOf,
    taglineOf,
    priceOf,
    featuresOf,
    badgeOf,
    isPopular,
    badgePositionOf,
    ctaTextOf,
    reload: load,
  };
};