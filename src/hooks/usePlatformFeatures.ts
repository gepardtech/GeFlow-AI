import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLocalFeatureCatalog, FeatureModuleDefinition } from "@/lib/featureCatalog";

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
 * Reads Supabase with local fallback so any global/plan toggle the admin flips
 * updates instantaneously across the app.
 */
export const usePlatformFeatures = (planId?: string) => {
  const [rows, setRows] = useState<PublicFeatureModule[]>(() => {
    return getLocalFeatureCatalog() as unknown as PublicFeatureModule[];
  });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("public_feature_modules").select("*");
      if (!error && data && data.length > 0) {
        setRows(data as unknown as PublicFeatureModule[]);
      } else {
        setRows(getLocalFeatureCatalog() as unknown as PublicFeatureModule[]);
      }
    } catch (err) {
      console.warn("Failed to load platform features from DB, using catalog:", err);
      setRows(getLocalFeatureCatalog() as unknown as PublicFeatureModule[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const handleStorage = () => {
      setRows(getLocalFeatureCatalog() as unknown as PublicFeatureModule[]);
    };
    window.addEventListener("storage", handleStorage);

    const ch = supabase
      .channel(`public_feature_modules_rt_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "public_feature_modules" }, () => load())
      .subscribe();

    return () => {
      window.removeEventListener("storage", handleStorage);
      supabase.removeChannel(ch);
    };
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
    // Check by module_code or matching name/id
    const matched = rows.find(
      (r) =>
        (r.module_code ?? "").toLowerCase() === c ||
        r.id.toLowerCase() === c ||
        r.name.toLowerCase().replace(/\s+/g, "_") === c
    );
    if (!matched) return true;
    return !disabledCodes.includes(matched.module_code.toLowerCase());
  };

  return { rows, loading, disabledCodes, isEnabled, reload: load };
};

