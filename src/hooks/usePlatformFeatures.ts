import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PublicFeatureModule {
  id: string;
  module_code: string;
  name: string;
  function_group: string;
  description: string | null;
  global_active: boolean;
  plan_free: boolean;
  plan_standard: boolean;
  plan_premium: boolean;
}

/**
 * Live platform-wide Feature Control (admin → Features).
 * Reads the sanitized public mirror so any global/plan toggle the admin flips
 * hides or reveals the matching module in the user panel within a second.
 */
export const usePlatformFeatures = (planId?: string) => {
  const [rows, setRows] = useState<PublicFeatureModule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.from("public_feature_modules").select("*");
      setRows((data ?? []) as unknown as PublicFeatureModule[]);
    } catch (err) {
      console.warn("Failed to load platform features:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`public_feature_modules_rt_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "public_feature_modules" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  /** Feature codes that are globally off, or off for the given plan. */
  const disabledCodes = rows
    .filter((r) => {
      if (!r.global_active) return true;
      const p = (planId ?? "free").toLowerCase();
      if (p === "premium" || p === "lifetime" || p === "unlimited") return !r.plan_premium;
      if (p === "standard") return !r.plan_standard;
      return !r.plan_free;
    })
    .map((r) => (r.module_code ?? "").toLowerCase());

  const isEnabled = (code?: string | null) => {
    if (!code) return true;
    const c = code.toLowerCase();
    // Unknown codes are allowed — only explicitly configured modules are gated.
    if (!rows.some((r) => (r.module_code ?? "").toLowerCase() === c)) return true;
    return !disabledCodes.includes(c);
  };

  return { rows, loading, disabledCodes, isEnabled, reload: load };
};
