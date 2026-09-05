import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CategorySettings } from "@/lib/settingsHierarchy";

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

interface GlobalBusinessStore {
  owned: BusinessRow[];
  staff: BusinessRow[];
  mode: "business" | "employee";
  activeId: string | null;
  industryType: string | null;
  categoryName: string | null;
  categorySettings: CategorySettings | null;
  enabledModules: string[] | null;
  enabledFeatures: string[] | null;
  loading: boolean;
  hasLoaded: boolean;
  currentUserId: string | null;
}

const store: GlobalBusinessStore = {
  owned: [],
  staff: [],
  mode: (localStorage.getItem(LS_MODE_KEY) as "business" | "employee") || "business",
  activeId: localStorage.getItem(LS_KEY) || null,
  industryType: null,
  categoryName: null,
  categorySettings: null,
  enabledModules: null,
  enabledFeatures: null,
  loading: true,
  hasLoaded: false,
  currentUserId: null,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error("Error in useActiveBusiness listener:", e);
    }
  });
}

let isFetching = false;
let fetchPromise: Promise<void> | null = null;

async function fetchBusinessData(): Promise<void> {
  if (isFetching && fetchPromise) {
    return fetchPromise;
  }

  isFetching = true;
  fetchPromise = (async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        store.owned = [];
        store.staff = [];
        store.activeId = null;
        store.loading = false;
        store.hasLoaded = true;
        store.currentUserId = null;
        notifyListeners();
        return;
      }

      store.currentUserId = user.id;

      // 1. Fetch businesses owned by current user
      const { data: ownedData, error: ownedErr } = await supabase
        .from("businesses")
        .select("id, business_name, business_address, status, currency, base_currency, default_tax, stock_alert_limit, category_id, owner_user_id")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: true });

      if (ownedErr) {
        console.warn("Error fetching owned businesses:", ownedErr);
      }

      const ownedRows: BusinessRow[] = (ownedData ?? []) as BusinessRow[];

      // 2. Fetch businesses where user is invited as staff member
      // Find direct support_team_members for user.id
      const userIdsToCheck = new Set<string>([user.id]);

      // Also check if any profile with matching email exists that was invited before user signup
      if (user.email) {
        const { data: invitedProfiles } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("email", user.email);

        if (invitedProfiles) {
          invitedProfiles.forEach((p) => {
            if (p.user_id) userIdsToCheck.add(p.user_id);
          });
        }
      }

      const { data: staffMemberships, error: staffErr } = await supabase
        .from("support_team_members")
        .select("id, user_id, appointed_by_user_id, role, is_active")
        .in("user_id", Array.from(userIdsToCheck))
        .eq("is_active", true);

      if (staffErr) {
        console.warn("Error fetching staff memberships:", staffErr);
      }

      let staffRows: BusinessRow[] = [];
      if (staffMemberships && staffMemberships.length > 0) {
        // If any membership was stored under another user_id for the same email, link it to user.id
        for (const sm of staffMemberships) {
          if (sm.user_id !== user.id) {
            await supabase
              .from("support_team_members")
              .update({ user_id: user.id })
              .eq("id", sm.id);
          }
        }

        const specificBizIds = new Set<string>();
        const fallbackOwnerIds = new Set<string>();

        staffMemberships.forEach((sm) => {
          if (sm.role && sm.role.includes("::")) {
            const [, bId] = sm.role.split("::");
            if (bId) specificBizIds.add(bId);
          } else if (sm.appointed_by_user_id) {
            fallbackOwnerIds.add(sm.appointed_by_user_id);
          }
        });

        const bizQueries = [];
        if (specificBizIds.size > 0) {
          bizQueries.push(
            supabase
              .from("businesses")
              .select("id, business_name, business_address, status, currency, base_currency, default_tax, stock_alert_limit, category_id, owner_user_id")
              .in("id", Array.from(specificBizIds))
          );
        }
        if (fallbackOwnerIds.size > 0) {
          bizQueries.push(
            supabase
              .from("businesses")
              .select("id, business_name, business_address, status, currency, base_currency, default_tax, stock_alert_limit, category_id, owner_user_id")
              .in("owner_user_id", Array.from(fallbackOwnerIds))
          );
        }

        if (bizQueries.length > 0) {
          const results = await Promise.all(bizQueries);
          const combinedBizMap = new Map<string, any>();
          results.forEach((res) => {
            if (res.data) {
              res.data.forEach((b: any) => combinedBizMap.set(b.id, b));
            }
          });

          staffRows = Array.from(combinedBizMap.values()).map((b) => {
            const membership =
              staffMemberships.find((m) => m.role?.endsWith("::" + b.id)) ||
              staffMemberships.find((m) => m.appointed_by_user_id === b.owner_user_id);
            const rawRole = membership?.role || "cashier";
            const cleanRole = rawRole.includes("::") ? rawRole.split("::")[0] : rawRole;
            return {
              ...b,
              is_staff: true,
              staff_role: cleanRole,
            };
          });
        }
      }

      store.owned = ownedRows;
      store.staff = staffRows;

      // Determine active pool based on stored mode
      let currentMode = store.mode;
      // Auto switch mode if user has no stores in current mode but has stores in the other
      if (currentMode === "business" && ownedRows.length === 0 && staffRows.length > 0) {
        currentMode = "employee";
        store.mode = "employee";
        localStorage.setItem(LS_MODE_KEY, "employee");
      } else if (currentMode === "employee" && staffRows.length === 0 && ownedRows.length > 0) {
        currentMode = "business";
        store.mode = "business";
        localStorage.setItem(LS_MODE_KEY, "business");
      }

      const activePool = currentMode === "employee" ? staffRows : ownedRows;

      // Select active business ID
      const savedId = localStorage.getItem(LS_KEY);
      const exists = activePool.find((r) => r.id === savedId);
      const chosen = exists ? exists.id : activePool[0]?.id || null;

      store.activeId = chosen;
      if (chosen) {
        localStorage.setItem(LS_KEY, chosen);
      } else {
        localStorage.removeItem(LS_KEY);
      }

      // Load category settings if category_id exists
      const activeRow = activePool.find((r) => r.id === chosen);
      if (activeRow?.category_id) {
        const { data: cat } = await supabase
          .from("business_categories")
          .select("id, industry_type, name, currency, default_tax, stock_alert_limit, enabled_modules, enabled_features")
          .eq("id", activeRow.category_id)
          .maybeSingle();

        store.industryType = (cat?.industry_type as string) ?? null;
        store.categoryName = (cat?.name as string) ?? null;
        store.categorySettings = cat
          ? {
              id: cat.id,
              name: cat.name,
              industry_type: cat.industry_type,
              currency: cat.currency,
              default_tax: cat.default_tax,
              stock_alert_limit: cat.stock_alert_limit,
            }
          : null;
        store.enabledModules = (cat?.enabled_modules as string[]) ?? null;
        store.enabledFeatures = (cat?.enabled_features as string[]) ?? null;
      } else {
        store.industryType = null;
        store.categoryName = null;
        store.categorySettings = null;
        store.enabledModules = null;
        store.enabledFeatures = null;
      }

      store.loading = false;
      store.hasLoaded = true;
    } catch (err) {
      console.warn("Failed to load active business:", err);
      store.loading = false;
      store.hasLoaded = true;
    } finally {
      isFetching = false;
      fetchPromise = null;
      notifyListeners();
    }
  })();

  return fetchPromise;
}

// Initialize single realtime subscriber
let isRealtimeSubscribed = false;
function ensureRealtime() {
  if (isRealtimeSubscribed) return;
  isRealtimeSubscribed = true;

  supabase
    .channel("active_business_global_sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "businesses" }, () => {
      fetchBusinessData();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "support_team_members" }, () => {
      fetchBusinessData();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "business_categories" }, () => {
      fetchBusinessData();
    })
    .subscribe();

  const handleCustomSync = () => {
    fetchBusinessData();
  };

  window.addEventListener("geflow:business-updated", handleCustomSync);
  window.addEventListener("geflow:business-changed", handleCustomSync);
  window.addEventListener("geflow:mode-changed", handleCustomSync);
  window.addEventListener("geflow:settings-changed", handleCustomSync);
}

export const useActiveBusiness = () => {
  const [, setTick] = useState(0);

  useEffect(() => {
    ensureRealtime();
    const update = () => setTick((t) => t + 1);
    listeners.add(update);

    if (!store.hasLoaded && !isFetching) {
      fetchBusinessData();
    }

    return () => {
      listeners.delete(update);
    };
  }, []);

  const setWorkspaceMode = useCallback((newMode: "business" | "employee") => {
    localStorage.setItem(LS_MODE_KEY, newMode);
    store.mode = newMode;

    const pool = newMode === "employee" ? store.staff : store.owned;
    const stillThere = pool.find((b) => b.id === store.activeId);
    const newChosen = stillThere ? stillThere.id : pool[0]?.id || null;

    store.activeId = newChosen;
    if (newChosen) {
      localStorage.setItem(LS_KEY, newChosen);
    } else {
      localStorage.removeItem(LS_KEY);
    }

    notifyListeners();
    window.dispatchEvent(new CustomEvent("geflow:mode-changed", { detail: { mode: newMode } }));
    window.dispatchEvent(new CustomEvent("geflow:business-changed", { detail: { businessId: newChosen } }));
  }, []);

  const setActive = useCallback((id: string) => {
    localStorage.setItem(LS_KEY, id);
    store.activeId = id;
    notifyListeners();
    window.dispatchEvent(new CustomEvent("geflow:business-changed", { detail: { businessId: id } }));
  }, []);

  const reload = useCallback(() => {
    return fetchBusinessData();
  }, []);

  const pool = store.mode === "employee" ? store.staff : store.owned;
  const active = pool.find((b) => b.id === store.activeId) ?? null;

  return {
    businesses: pool,
    ownedBusinesses: store.owned,
    staffBusinesses: store.staff,
    workspaceMode: store.mode,
    setWorkspaceMode,
    active,
    activeBusiness: active,
    activeId: store.activeId,
    setActive,
    industryType: store.industryType,
    categoryName: store.categoryName,
    categorySettings: store.categorySettings,
    enabledModules: store.enabledModules,
    enabledFeatures: store.enabledFeatures,
    loading: store.loading,
    hasLoaded: store.hasLoaded,
    reload,
    refresh: reload,
  };
};
