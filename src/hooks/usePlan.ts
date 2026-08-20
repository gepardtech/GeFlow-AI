import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPlan, normalizePlan, PlanId } from "@/lib/plans";

export interface PlanState {
  loading: boolean;
  planId: PlanId;
  plan: ReturnType<typeof getPlan>;
  fullName: string | null;
  email: string | null;
  userId: string | null;
}

/**
 * Loads the current user's plan and keeps it in sync via realtime.
 * Admins changing a user's plan will reflect instantly here.
 */
export const usePlan = (): PlanState => {
  const [state, setState] = useState<PlanState>({
    loading: true,
    planId: "free",
    plan: getPlan("free"),
    fullName: null,
    email: null,
    userId: null,
  });

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    const apply = (row: any, userId: string, email: string | null) => {
      if (!active) return;
      const planId = normalizePlan(row?.plan);
      setState({
        loading: false,
        planId,
        plan: getPlan(planId),
        fullName: row?.full_name ?? null,
        email: row?.email ?? email,
        userId,
      });
    };

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState((s) => ({ ...s, loading: false })); return; }

      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, plan")
        .eq("user_id", user.id)
        .maybeSingle();

      apply(data, user.id, user.email ?? null);

      channel = supabase
        .channel(`profile-plan-${user.id}-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
          (payload) => apply(payload.new, user.id, user.email ?? null),
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return state;
};
