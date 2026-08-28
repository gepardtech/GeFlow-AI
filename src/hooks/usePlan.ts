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

const CACHE_KEY = "geflow_cached_plan_state";

const getInitialCachedState = (): {
  planId: PlanId;
  fullName: string | null;
  email: string | null;
  userId: string | null;
} => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.planId) {
        return {
          planId: normalizePlan(parsed.planId),
          fullName: parsed.fullName ?? null,
          email: parsed.email ?? null,
          userId: parsed.userId ?? null,
        };
      }
    }
  } catch (e) {
    // Ignore JSON error
  }
  return {
    planId: "free",
    fullName: null,
    email: null,
    userId: null,
  };
};

/**
 * Loads the current user's plan and keeps it in sync via realtime and cache.
 * Fully activates all Premium & Lifetime features without UI flicker or locked screen glitches.
 */
export const usePlan = (): PlanState => {
  const cached = getInitialCachedState();
  const [loading, setLoading] = useState<boolean>(true);
  const [planId, setPlanId] = useState<PlanId>(cached.planId);
  const [fullName, setFullName] = useState<string | null>(cached.fullName);
  const [email, setEmail] = useState<string | null>(cached.email);
  const [userId, setUserId] = useState<string | null>(cached.userId);

  const applyPlanData = useCallback((newPlanRaw: string | null | undefined, name: string | null, mail: string | null, uid: string | null) => {
    const resolvedId = normalizePlan(newPlanRaw);
    setPlanId(resolvedId);
    if (name !== undefined) setFullName(name);
    if (mail !== undefined) setEmail(mail);
    if (uid !== undefined) setUserId(uid);
    setLoading(false);

    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          planId: resolvedId,
          fullName: name,
          email: mail,
          userId: uid,
          updatedAt: Date.now(),
        })
      );
    } catch (e) {
      // Ignore storage errors
    }
  }, []);

  const fetchCurrentPlan = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // 1. Fetch Profile Record
      const { data: profData } = await supabase
        .from("profiles")
        .select("full_name, email, plan")
        .eq("user_id", user.id)
        .maybeSingle();

      // 2. Fetch Latest Active Subscription to resolve any desync
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("tier, status")
        .eq("owner_user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let effectivePlan = profData?.plan;
      if (subData?.tier && normalizePlan(subData.tier) !== "free") {
        const subPlan = normalizePlan(subData.tier);
        if (normalizePlan(effectivePlan) === "free" || subPlan === "premium" || subPlan === "lifetime") {
          effectivePlan = subPlan;
          // Auto-heal profile plan
          if (profData?.plan !== subPlan) {
            supabase
              .from("profiles")
              .update({ plan: subPlan })
              .eq("user_id", user.id)
              .then(() => {});
          }
        }
      }

      applyPlanData(
        effectivePlan,
        profData?.full_name ?? user.user_metadata?.full_name ?? null,
        profData?.email ?? user.email ?? null,
        user.id
      );
    } catch (err) {
      console.warn("Failed to load user plan:", err);
      setLoading(false);
    }
  }, [applyPlanData]);

  useEffect(() => {
    let active = true;
    let profilesChannel: ReturnType<typeof supabase.channel> | null = null;
    let subsChannel: ReturnType<typeof supabase.channel> | null = null;

    fetchCurrentPlan();

    // Listen to local in-tab updates
    const handlePlanChanged = (e: any) => {
      if (!active) return;
      if (e.detail?.planId) {
        applyPlanData(e.detail.planId, fullName, email, userId);
      } else {
        fetchCurrentPlan();
      }
    };
    window.addEventListener("geflow:plan-changed", handlePlanChanged);

    // Setup realtime postgres listeners
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !active) return;

      profilesChannel = supabase
        .channel(`profile-plan-${user.id}-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
          (payload: any) => {
            if (payload.new) {
              applyPlanData(payload.new.plan, payload.new.full_name, payload.new.email, user.id);
            }
          }
        )
        .subscribe();

      subsChannel = supabase
        .channel(`subs-plan-${user.id}-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "subscriptions", filter: `owner_user_id=eq.${user.id}` },
          () => {
            fetchCurrentPlan();
          }
        )
        .subscribe();
    });

    return () => {
      active = false;
      window.removeEventListener("geflow:plan-changed", handlePlanChanged);
      if (profilesChannel) supabase.removeChannel(profilesChannel);
      if (subsChannel) supabase.removeChannel(subsChannel);
    };
  }, [fetchCurrentPlan, applyPlanData, fullName, email, userId]);

  const planDef = getPlan(planId);
  const isPremiumOrLifetime = planId === "premium" || planId === "lifetime";
  const isStandardOrHigher = planId === "standard" || isPremiumOrLifetime;
  const isLifetime = planId === "lifetime";
  const isPaid = planId !== "free";

  return {
    loading,
    planId,
    plan: planDef,
    fullName,
    email,
    userId,
    isPremiumOrLifetime,
    isStandardOrHigher,
    isLifetime,
    isPaid,
    refreshPlan: fetchCurrentPlan,
  };
};
