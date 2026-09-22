import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlanId = "free" | "standard" | "premium" | "lifetime";

export interface PlanSummary {
  id: PlanId;
  label: string;
}

export interface PlanState {
  loading: boolean;
  planId: PlanId;
  plan: PlanSummary;
  fullName: string | null;
  email: string | null;
  userId: string | null;
  isPremiumOrLifetime: boolean;
  isStandardOrHigher: boolean;
  isLifetime: boolean;
  isPaid: boolean;
  refreshPlan: () => Promise<void>;
}

const PLAN_LABELS: Record<PlanId, string> = {
  free: "Free",
  standard: "Standard",
  premium: "Premium",
  lifetime: "Lifetime VIP",
};

export const normalizePlan = (raw?: string | null): PlanId => {
  const p = (raw || "free").toLowerCase().trim();
  if (p === "standard") return "standard";
  if (p === "premium") return "premium";
  if (p === "lifetime" || p === "unlimited") return "lifetime";
  return "free";
};

const toSummary = (id: PlanId): PlanSummary => ({
  id,
  label: PLAN_LABELS[id],
});

interface InternalPlanStore {
  loading: boolean;
  hasLoadedFromSupabase: boolean;
  planId: PlanId;
  fullName: string | null;
  email: string | null;
  userId: string | null;
}

const planStore: InternalPlanStore = {
  loading: true,
  hasLoadedFromSupabase: false,
  planId: "free",
  fullName: null,
  email: null,
  userId: null,
};

const listeners = new Set<() => void>();

function notifyPlanListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
}

let isPlanFetching = false;
let planFetchPromise: Promise<void> | null = null;

async function fetchAuthoritativePlan(): Promise<void> {
  if (isPlanFetching && planFetchPromise) {
    return planFetchPromise;
  }

  isPlanFetching = true;
  planFetchPromise = (async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        planStore.loading = false;
        planStore.hasLoadedFromSupabase = true;
        planStore.planId = "free";
        planStore.fullName = null;
        planStore.email = null;
        planStore.userId = null;
        notifyPlanListeners();
        return;
      }

      planStore.userId = user.id;
      planStore.email = user.email ?? null;
      planStore.fullName = (user.user_metadata?.full_name as string) || null;

      // 1. Profile from Supabase
      const { data: profData } = await supabase
        .from("profiles")
        .select("full_name, email, plan")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profData?.full_name) planStore.fullName = profData.full_name;
      if (profData?.email) planStore.email = profData.email;

      // 2. Admin → lifetime
      let isAdmin = user.email?.toLowerCase() === "gepardwebs@gmail.com";
      if (!isAdmin) {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        isAdmin = Boolean(roleRow);
      }

      // 3. Active subscription from Supabase
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("tier, status")
        .eq("owner_user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let resolvedPlan: PlanId = "free";

      if (isAdmin) {
        resolvedPlan = "lifetime";
      } else {
        const subPlan = subData?.tier ? normalizePlan(subData.tier) : null;
        const profPlan = profData?.plan ? normalizePlan(profData.plan) : null;
        const metaPlan = user.user_metadata?.plan
          ? normalizePlan(user.user_metadata.plan as string)
          : null;

        const candidates = [subPlan, profPlan, metaPlan].filter(Boolean) as PlanId[];
        if (candidates.includes("lifetime")) resolvedPlan = "lifetime";
        else if (candidates.includes("premium")) resolvedPlan = "premium";
        else if (candidates.includes("standard")) resolvedPlan = "standard";
        else resolvedPlan = "free";

        // Optional server route if RLS blocks client reads
        if (resolvedPlan === "free") {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (token) {
              const planRes = await fetch("/api/user/plan", {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (planRes.ok) {
                const planJson = await planRes.json();
                if (planJson?.success && planJson.planId) {
                  resolvedPlan = normalizePlan(planJson.planId);
                  if (planJson.fullName) planStore.fullName = planJson.fullName;
                }
              }
            }
          } catch {
            /* ignore */
          }
        }
      }

      planStore.planId = resolvedPlan;
      planStore.hasLoadedFromSupabase = true;
      planStore.loading = false;
    } catch (err) {
      console.error("Failed to resolve plan from Supabase:", err);
      planStore.loading = false;
      planStore.hasLoadedFromSupabase = true;
    } finally {
      isPlanFetching = false;
      planFetchPromise = null;
      notifyPlanListeners();
    }
  })();

  return planFetchPromise;
}

let isGlobalPlanSubscribed = false;
function setupGlobalPlanSubscriber() {
  if (isGlobalPlanSubscribed) return;
  isGlobalPlanSubscribed = true;

  supabase.auth.onAuthStateChange((event) => {
    if (
      event === "SIGNED_IN" ||
      event === "TOKEN_REFRESHED" ||
      event === "USER_UPDATED"
    ) {
      fetchAuthoritativePlan();
    } else if (event === "SIGNED_OUT") {
      planStore.planId = "free";
      planStore.fullName = null;
      planStore.email = null;
      planStore.userId = null;
      planStore.loading = false;
      planStore.hasLoadedFromSupabase = true;
      notifyPlanListeners();
    }
  });

  supabase
    .channel("global_user_plan_sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "profiles" },
      () => fetchAuthoritativePlan()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "subscriptions" },
      () => fetchAuthoritativePlan()
    )
    .subscribe();

  window.addEventListener("geflow:plan-changed", () => {
    fetchAuthoritativePlan();
  });
  window.addEventListener("geflow:cache-purged", () => {
    fetchAuthoritativePlan();
  });
}

/**
 * Current user plan — Supabase only (subscriptions + profiles + roles).
 * Limits/modules ab usePlanLimits + usePlatformFeatures se aate hain.
 */
export const usePlan = (): PlanState => {
  const [, setTick] = useState(0);

  useEffect(() => {
    setupGlobalPlanSubscriber();

    const handleChange = () => setTick((t) => t + 1);
    listeners.add(handleChange);

    if (!planStore.hasLoadedFromSupabase && !isPlanFetching) {
      fetchAuthoritativePlan();
    }

    return () => {
      listeners.delete(handleChange);
    };
  }, []);

  const refreshPlan = useCallback(async () => {
    await fetchAuthoritativePlan();
  }, []);

  const planId = planStore.planId;
  const isPremiumOrLifetime = planId === "premium" || planId === "lifetime";
  const isStandardOrHigher = planId === "standard" || isPremiumOrLifetime;
  const isLifetime = planId === "lifetime";
  const isPaid = planId !== "free";

  return {
    loading: planStore.loading,
    planId,
    plan: toSummary(planId),
    fullName: planStore.fullName,
    email: planStore.email,
    userId: planStore.userId,
    isPremiumOrLifetime,
    isStandardOrHigher,
    isLifetime,
    isPaid,
    refreshPlan,
  };
};