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
  owner_user_id?: string;
  is_staff?: boolean;
  staff_role?: string;
}

const LS_KEY = "geflow.activeBusinessId";
const LS_MODE_KEY = "geflow.workspaceMode";

/**
 * Loads businesses owned by the current user or invited as employee.
 * Supports switching between "business" (Owner) and "employee" (Staff) workspaces.
 */
// Shared in-memory cache to prevent layout flicker and flinching across multi-mounts
let globalCachedOwned: BusinessRow[] = [];
let globalCachedStaff: BusinessRow[] = [];
let globalCachedActiveId: string | null = null;
let globalHasLoaded = false;

export const useActiveBusiness = () => {
  const [businesses, setBusinesses] = useState<BusinessRow[]>(() => {
    const mode = (localStorage.getItem(LS_MODE_KEY) as "business" | "employee") || "business";
    if (mode === "employee" && globalCachedStaff.length > 0) return globalCachedStaff;
    return globalCachedOwned.length > 0 ? globalCachedOwned : globalCachedStaff;
  });
  const [ownedBusinesses, setOwnedBusinesses] = useState<BusinessRow[]>(globalCachedOwned);
  const [staffBusinesses, setStaffBusinesses] = useState<BusinessRow[]>(globalCachedStaff);
  const [workspaceMode, setWorkspaceModeState] = useState<"business" | "employee">(() => {
    return (localStorage.getItem(LS_MODE_KEY) as "business" | "employee") || "business";
  });
  const [activeId, setActiveId] = useState<string | null>(() => {
    return globalCachedActiveId || localStorage.getItem(LS_KEY) || null;
  });
  const [industryType, setIndustryType] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [categorySettings, setCategorySettings] = useState<CategorySettings | null>(null);
  const [enabledModules, setEnabledModules] = useState<string[] | null>(null);
  const [enabledFeatures, setEnabledFeatures] = useState<string[] | null>(null);
  const [loading, setLoading] = useState<boolean>(!globalHasLoaded);
  const [hasLoaded, setHasLoaded] = useState<boolean>(globalHasLoaded);

  const setWorkspaceMode = useCallback((mode: "business" | "employee") => {
    localStorage.setItem(LS_MODE_KEY, mode);
    setWorkspaceModeState(mode);
    const pool = mode === "employee" ? (globalCachedStaff.length > 0 ? globalCachedStaff : globalCachedOwned) : (globalCachedOwned.length > 0 ? globalCachedOwned : globalCachedStaff);
    setBusinesses(pool);
    if (pool.length > 0 && (!activeId || !pool.some((b) => b.id === activeId))) {
      const newChosen = pool[0].id;
      localStorage.setItem(LS_KEY, newChosen);
      globalCachedActiveId = newChosen;
      setActiveId(newChosen);
    }
    window.dispatchEvent(new CustomEvent("geflow:mode-changed", { detail: { mode } }));
  }, [activeId]);

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent && !globalHasLoaded) {
      setLoading(true);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setHasLoaded(true);
        globalHasLoaded = true;
        return;
      }

      // 1. Fetch businesses owned by current user
      const { data: ownedData } = await supabase
        .from("businesses")
        .select("id, business_name, business_address, status, currency, base_currency, default_tax, stock_alert_limit, category_id, owner_user_id")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: true });

      const ownedRows = (ownedData ?? []) as BusinessRow[];

      // 2. Fetch businesses where user is invited as staff member
      const { data: staffMemberships } = await supabase
        .from("support_team_members")
        .select("appointed_by_user_id, role, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true);

      let staffRows: BusinessRow[] = [];
      if (staffMemberships && staffMemberships.length > 0) {
        const ownerIds = staffMemberships.map((s) => s.appointed_by_user_id);
        const { data: staffBizData } = await supabase
          .from("businesses")
          .select("id, business_name, business_address, status, currency, base_currency, default_tax, stock_alert_limit, category_id, owner_user_id")
          .in("owner_user_id", ownerIds);

        if (staffBizData) {
          staffRows = staffBizData.map((b) => {
            const membership = staffMemberships.find((m) => m.appointed_by_user_id === b.owner_user_id);
            return {
              ...b,
              is_staff: true,
              staff_role: membership?.role || "cashier",
            };
          });
        }
      }

      globalCachedOwned = ownedRows;
      globalCachedStaff = staffRows;
      setOwnedBusinesses(ownedRows);
      setStaffBusinesses(staffRows);

      // Determine current mode
      let currentMode: "business" | "employee" = (localStorage.getItem(LS_MODE_KEY) as "business" | "employee") || "business";
      if (ownedRows.length === 0 && staffRows.length > 0) {
        currentMode = "employee";
        localStorage.setItem(LS_MODE_KEY, "employee");
        setWorkspaceModeState("employee");
      }

      const activePool = currentMode === "employee" ? (staffRows.length > 0 ? staffRows : ownedRows) : (ownedRows.length > 0 ? ownedRows : staffRows);

      setBusinesses(activePool);

      const saved = localStorage.getItem(LS_KEY);
      const exists = activePool.find((r) => r.id === saved);
      const chosen = exists ? saved : activePool[0]?.id ?? null;

      if (chosen && chosen !== saved) {
        localStorage.setItem(LS_KEY, chosen);
      }
      globalCachedActiveId = chosen;
      setActiveId(chosen);

      const activeRow = activePool.find((r) => r.id === chosen);
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
      setHasLoaded(true);
      globalHasLoaded = true;
    }
  }, []);

  useEffect(() => {
    load(true);
    const onBusinessUpdated = () => { load(true); };
    window.addEventListener("geflow:business-updated", onBusinessUpdated);
    window.addEventListener("geflow:business-changed", onBusinessUpdated);
    window.addEventListener("geflow:mode-changed", onBusinessUpdated);
    window.addEventListener("geflow:settings-changed", onBusinessUpdated);

    const channel = supabase
      .channel(`businesses_active_rt_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "businesses" }, () => {
        load(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "business_categories" }, () => {
        load(true);
      })
      .subscribe();

    return () => {
      window.removeEventListener("geflow:business-updated", onBusinessUpdated);
      window.removeEventListener("geflow:business-changed", onBusinessUpdated);
      window.removeEventListener("geflow:mode-changed", onBusinessUpdated);
      window.removeEventListener("geflow:settings-changed", onBusinessUpdated);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const setActive = useCallback((id: string) => {
    localStorage.setItem(LS_KEY, id);
    globalCachedActiveId = id;
    setActiveId(id);
    window.dispatchEvent(new CustomEvent("geflow:business-changed"));
    load(true);
  }, [load]);

  const active = businesses.find((b) => b.id === activeId) ?? null;

  return {
    businesses,
    ownedBusinesses,
    staffBusinesses,
    workspaceMode,
    setWorkspaceMode,
    active,
    activeBusiness: active,
    activeId,
    setActive,
    industryType,
    categoryName,
    categorySettings,
    enabledModules,
    enabledFeatures,
    loading,
    hasLoaded,
    reload: load,
    refresh: load,
  };
};

