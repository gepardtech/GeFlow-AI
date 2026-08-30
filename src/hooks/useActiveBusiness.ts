import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CategorySettings,
  EffectiveBusinessSettings,
  getCachedUserMetadata,
  resolveSettingsHierarchy,
} from "@/lib/settingsHierarchy";

export interface BusinessRow {
  id: string;
  business_name: string;
  business_address?: string | null;
  status: string;
  currency: string;
  base_currency?: string | null;
  default_tax: number;
  stock_alert_limit: number;
  category_id: string | null;
}

const LS_KEY = "geflow.activeBusinessId";

/**
 * Loads businesses owned by the current user and tracks the active one.
 * The active business id persists in localStorage and is used to scope
 * inventory, sales and stock data across the workspace.
 */
export const useActiveBusiness = () => {
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [industryType, setIndustryType] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [categorySettings, setCategorySettings] = useState<CategorySettings | null>(null);
  const [enabledModules, setEnabledModules] = useState<string[] | null>(null);
  const [enabledFeatures, setEnabledFeatures] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("businesses")
        .select("id, business_name, business_address, status, currency, base_currency, default_tax, stock_alert_limit, category_id")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: true });
      const rows = (data ?? []) as BusinessRow[];
      
      let finalRows = rows;
      // If no business found for current user, check if any global business exists, or auto-create a default one
      if (finalRows.length === 0) {
        const { data: anyBiz } = await supabase
          .from("businesses")
          .select("id, business_name, business_address, status, currency, base_currency, default_tax, stock_alert_limit, category_id")
          .limit(1);
        if (anyBiz && anyBiz.length > 0) {
          finalRows = anyBiz as BusinessRow[];
        } else {
          // Auto-create a default starter business so the workspace is immediately functional
          const { data: newBiz } = await supabase
            .from("businesses")
            .insert({
              business_name: "GeFlow Store (Main)",
              business_address: "Main Street, Suite 100",
              currency: "USD",
              status: "active",
              default_tax: 5,
              stock_alert_limit: 10,
              owner_user_id: user.id,
            })
            .select("id, business_name, business_address, status, currency, base_currency, default_tax, stock_alert_limit, category_id")
            .single();
          if (newBiz) {
            finalRows = [newBiz as BusinessRow];
          }
        }
      }

      setBusinesses(finalRows);
      const saved = localStorage.getItem(LS_KEY);
      const exists = finalRows.find((r) => r.id === saved);
      const chosen = exists ? saved : finalRows[0]?.id ?? null;
      setActiveId(chosen);

      const activeRow = finalRows.find((r) => r.id === chosen);
      if (activeRow?.category_id) {
        const { data: cat } = await supabase
          .from("business_categories")
          .select("id, industry_type, name, currency, default_tax, stock_alert_limit, enabled_modules, enabled_features")
          .eq("id", activeRow.category_id)
          .maybeSingle();
        setIndustryType((cat?.industry_type as string) ?? null);
        setCategoryName((cat?.name as string) ?? null);
        setCategorySettings(cat ? {
          id: cat.id,
          name: cat.name,
          industry_type: cat.industry_type,
          currency: cat.currency,
          default_tax: cat.default_tax,
          stock_alert_limit: cat.stock_alert_limit,
        } : null);
        setEnabledModules((cat?.enabled_modules as string[]) ?? null);
        setEnabledFeatures((cat?.enabled_features as string[]) ?? null);
      } else {
        setIndustryType(null);
        setCategoryName(null);
        setCategorySettings(null);
        setEnabledModules(null);
        setEnabledFeatures(null);
      }
    } catch (err) {
      console.warn("Failed to load active business:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onBusinessUpdated = () => { load(); };
    window.addEventListener("geflow:business-updated", onBusinessUpdated);
    window.addEventListener("geflow:business-changed", onBusinessUpdated);
    window.addEventListener("geflow:settings-changed", onBusinessUpdated);

    const channel = supabase
      .channel(`businesses_active_rt_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "businesses" }, () => {
        load();
      })
      .subscribe();

    return () => {
      window.removeEventListener("geflow:business-updated", onBusinessUpdated);
      window.removeEventListener("geflow:business-changed", onBusinessUpdated);
      window.removeEventListener("geflow:settings-changed", onBusinessUpdated);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const setActive = useCallback((id: string) => {
    localStorage.setItem(LS_KEY, id);
    setActiveId(id);
    window.dispatchEvent(new CustomEvent("geflow:business-changed"));
    load();
  }, [load]);

  const active = businesses.find((b) => b.id === activeId) ?? null;

  return {
    businesses, active, activeBusiness: active, activeId, setActive,
    industryType, categoryName, categorySettings, enabledModules, enabledFeatures,
    loading, reload: load, refresh: load,
  };
};

