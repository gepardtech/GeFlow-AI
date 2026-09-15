import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPlan, normalizePlan, PlanId, PlanDefinition } from "@/lib/plans";

export interface PlanState {
  loading: boolean;
  planId: PlanId;
  plan: PlanDefinition;
  fullName: string | null;
  email: string | null;
  userId: string | null;
  isPremiumOrLifetime: boolean;
  isStandardOrHigher: boolean;
  isLifetime: boolean;
  isPaid: boolean;
  refreshPlan: () => Promise<void>;
}

interface InternalPlanStore {
  loading: boolean;
  hasLoadedFromSupabase: boolean;
  planId: PlanId;
  fullName: string | null;
  email: string | null;
  userId: string | null;
}

// Module-level singleton store to prevent duplicate queries, thrashing, and flickering
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
      /* ignore subscriber error */
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

      // 1. Fetch Profile Record directly from Supabase
      const { data: profData } = await supabase
        .from("profiles")
        .select("full_name, email, plan")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profData?.full_name) planStore.fullName = profData.full_name;
      if (profData?.email) planStore.email = profData.email;

      // 2. Check Admin role (Admins always get full lifetime enterprise access)
      let isAdmin = (user.email?.toLowerCase() === "gepardwebs@gmail.com");
      if (!isAdmin) {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        isAdmin = Boolean(roleRow);
      }

      // 3. Fetch Active Subscriptions directly from Supabase
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("tier, status")
        .eq("owner_user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Resolve authoritative plan from Supabase
      let resolvedPlan: PlanId = "free";

      if (isAdmin) {
        resolvedPlan = "lifetime";
      } else {
        const subPlan = subData?.tier ? normalizePlan(subData.tier) : null;
        const profPlan = profData?.plan ? normalizePlan(profData.plan) : null;
        const metaPlan = user.user_metadata?.plan ? normalizePlan(user.user_metadata.plan) : null;

        // Take highest valid plan found in Supabase
        const candidates = [subPlan, profPlan, metaPlan].filter(Boolean) as PlanId[];
        if (candidates.includes("lifetime")) {
          resolvedPlan = "lifetime";
        } else if (candidates.includes("premium")) {
          resolvedPlan = "premium";
        } else if (candidates.includes("standard")) {
          resolvedPlan = "standard";
        } else {
          resolvedPlan = "free";
        }
      }

      planStore.planId = resolvedPlan;
      planStore.hasLoadedFromSupabase = true;
      planStore.loading = false;
    } catch (err) {
      console.warn("Notice checking authoritative plan from Supabase:", err);
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

// Set up global single Realtime and Auth subscription
let isGlobalPlanSubscribed = false;
function setupGlobalPlanSubscriber() {
  if (isGlobalPlanSubscribed) return;
  isGlobalPlanSubscribed = true;

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
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

  // Supabase Realtime for profile & subscription changes
  supabase
    .channel("global_user_plan_sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
      fetchAuthoritativePlan();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () => {
      fetchAuthoritativePlan();
    })
    .subscribe();

  window.addEventListener("geflow:plan-changed", () => {
    fetchAuthoritativePlan();
  });
  window.addEventListener("geflow:cache-purged", () => {
    fetchAuthoritativePlan();
  });
}

/**
 * Loads the current user's plan and guarantees it comes directly from Supabase (not stale cache).
 * Eliminates UI flicker and locked screen glitches.
 */
export const usePlan = (): PlanState => {
  const [, setTick] = useState(0);

  useEffect(() => {
    setupGlobalPlanSubscriber();

    const handleChange = () => {
      setTick((t) => t + 1);
    };
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

  const planDef = getPlan(planStore.planId);
  const isPremiumOrLifetime = planStore.planId === "premium" || planStore.planId === "lifetime";
  const isStandardOrHigher = planStore.planId === "standard" || isPremiumOrLifetime;
  const isLifetime = planStore.planId === "lifetime";
  const isPaid = planStore.planId !== "free";

  return {
    loading: planStore.loading,
    planId: planStore.planId,
    plan: planDef,
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

