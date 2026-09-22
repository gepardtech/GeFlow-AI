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
 * Live platform Feature Control from Supabase only.
 * Table: public_feature_modules (synced from feature_modules via trigger).
 * Realtime: admin toggles update across all clients instantly.
 * No local featureCatalog fallback.
 */
export const usePlatformFeatures = (planId?: string) => {
  const [rows, setRows] = useState<PublicFeatureModule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("public_feature_modules")
        .select(
          "id, module_code, name, function_group, description, global_active, plan_free, plan_standard, plan_premium"
        );

      if (error) {
        console.error("Failed to load public_feature_modules:", error.message);
        setRows([]);
      } else {
        setRows((data as PublicFeatureModule[]) ?? []);
      }
    } catch (err) {
      console.error("public_feature_modules load exception:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();

    const ch = supabase
      .channel("public_feature_modules_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "public_feature_modules" },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  /** Feature codes that are globally off, or off for the given plan. */
  const disabledCodes = rows
    .filter((r) => {
      if (!r.global_active) return true;
      const p = (planId ?? "free").toLowerCase();
      if (p === "premium" || p === "lifetime" || p === "unlimited") {
        return !r.plan_premium;
      }
      if (p === "standard") return !r.plan_standard;
      return !r.plan_free;
    })
    .map((r) => (r.module_code ?? "").toLowerCase());

  const isEnabled = (code?: string | null) => {
    if (!code) return true;
    const c = code.toLowerCase();

    const matched = rows.find(
      (r) =>
        (r.module_code ?? "").toLowerCase() === c ||
        r.id.toLowerCase() === c ||
        r.name.toLowerCase().replace(/\s+/g, "_") === c
    );

    // No matching row in DB → treat as disabled (fail-closed)
    if (!matched) return false;

    return !disabledCodes.includes((matched.module_code ?? "").toLowerCase());
  };

  return { rows, loading, disabledCodes, isEnabled, reload: load };
};