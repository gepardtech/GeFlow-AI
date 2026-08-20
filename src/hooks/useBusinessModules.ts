import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isCoreModule } from "@/lib/panelNav";

const LS_KEY = "geflow.activeBusinessId";

export interface BusinessModulesState {
  loading: boolean;
  /** enabled module ids for the active business category. null = no category yet (allow defaults) */
  modules: string[] | null;
  /** enabled feature ids for the active business category */
  features: string[];
  hasModule: (id: string) => boolean;
  hasFeature: (id: string) => boolean;
}

/**
 * Resolves which dashboard modules/features are appointed by the admin for the
 * active business's category (admin > Business Categories > enabled modules).
 * Core SaaS modules (Subscription, Settings, Support, Dashboard, etc.) are always granted.
 */
export const useBusinessModules = (): BusinessModulesState => {
  const [modules, setModules] = useState<string[] | null>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setModules(null); setFeatures([]); setLoading(false); return; }

    const { data: bizRows } = await supabase
      .from("businesses")
      .select("id, category_id, created_at")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: true });

    const rows = bizRows ?? [];
    const saved = localStorage.getItem(LS_KEY);
    const activeBiz = rows.find((r) => r.id === saved) ?? rows[0];

    if (!activeBiz?.category_id) { setModules(null); setFeatures([]); setLoading(false); return; }

    const { data: cat } = await supabase
      .from("business_categories")
      .select("enabled_modules, enabled_features")
      .eq("id", activeBiz.category_id)
      .maybeSingle();

    setModules((cat?.enabled_modules as string[]) ?? []);
    setFeatures((cat?.enabled_features as string[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener("geflow:business-changed", onChange);
    const ch = supabase
      .channel(`biz-modules-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "business_categories" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "businesses" }, () => load())
      .subscribe();
    return () => {
      window.removeEventListener("geflow:business-changed", onChange);
      supabase.removeChannel(ch);
    };
  }, [load]);

  return {
    loading,
    modules,
    features,
    hasModule: (id: string) => {
      if (isCoreModule(id)) return true;
      return modules === null ? true : modules.includes(id);
    },
    hasFeature: (id: string) => features.includes(id),
  };
};

