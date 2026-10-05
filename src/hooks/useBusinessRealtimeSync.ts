import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBusiness } from "./useActiveBusiness";
import { isDemoProduct } from "@/lib/businessSync";

/**
 * Ensures continuous, realtime synchronization:
 * Business Owner (Database) -> Central Sync Engine -> Employees (POS & Inventory)
 */
export function useBusinessRealtimeSync() {
  const { active } = useActiveBusiness();
  const lastSyncHashRef = useRef<string>("");
  const initialSyncDoneRef = useRef<boolean>(false);
  const activeId = active?.id;
  const isStaff = Boolean(active?.is_staff);
  const ownerUserId = active?.owner_user_id;
  const businessName = active?.business_name || "";

  // 1. Business Owner Pipeline:
  // When owner is online or updates inventory, mirror Supabase directly to sync engine
  useEffect(() => {
    if (!activeId || isStaff) return;

    let isMounted = true;
    let syncTimeout: any = null;

    async function syncOwnerCatalog(isFromRealtimeEvent = false) {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("business_id", activeId)
          .order("name");

        if (!isMounted || error || !data) return;

        const cleanList = data.filter((p: any) => !isDemoProduct(p));
        const hash = JSON.stringify(
          cleanList.map((p: any) => [p.id, p.updated_at, p.stock_units, p.retail_price])
        );

        if (hash === lastSyncHashRef.current) return;
        const prevHash = lastSyncHashRef.current;
        lastSyncHashRef.current = hash;

        await fetch("/api/sync/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId: activeId,
            ownerUserId,
            businessName,
            products: cleanList,
            replace: true,
          }),
        }).catch(() => {});

        // Only dispatch products-updated if this is an actual change after initial load
        if (isFromRealtimeEvent || (initialSyncDoneRef.current && prevHash !== "")) {
          window.dispatchEvent(
            new CustomEvent("geflow:products-updated", { detail: { businessId: activeId } })
          );
        }
        initialSyncDoneRef.current = true;
      } catch (err) {
        console.warn("Realtime sync notice for owner catalog:", err);
      }
    }

    // Schedule initial sync without storming
    syncTimeout = setTimeout(() => {
      syncOwnerCatalog(false);
    }, 400);

    // Supabase Realtime channel for instant DB changes
    const channelId = `rt-products-${activeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let channel: any = null;
    try {
      channel = supabase
        .channel(channelId)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "products",
            filter: `business_id=eq.${activeId}`,
          },
          () => {
            syncOwnerCatalog(true);
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("Notice subscribing to product realtime sync:", err);
    }

    return () => {
      isMounted = false;
      if (syncTimeout) clearTimeout(syncTimeout);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* ignore cleanup */
        }
      }
    };
  }, [activeId, isStaff, ownerUserId]);

  // 2. Employee Pipeline:
  // Continuously pulls the authoritative business catalog from the sync engine
  useEffect(() => {
    if (!activeId || !isStaff) return;

    let isMounted = true;

    async function fetchStaffCatalog() {
      try {
        const res = await fetch(
          `/api/sync/business-data?businessId=${encodeURIComponent(activeId)}&role=${encodeURIComponent(
            active?.staff_role || "cashier"
          )}`
        );
        if (!res.ok || !isMounted) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.products)) {
          const cleanProducts = data.products.filter((p: any) => !isDemoProduct(p));
          const hash = JSON.stringify(
            cleanProducts.map((p: any) => [p.id, p.updated_at, p.stock_units, p.retail_price])
          );
          if (hash !== lastSyncHashRef.current) {
            lastSyncHashRef.current = hash;
            try {
              localStorage.setItem(`geflow_products_${activeId}`, JSON.stringify(cleanProducts));
            } catch {
              /* ignore */
            }
            window.dispatchEvent(
              new CustomEvent("geflow:products-updated", { detail: { businessId: activeId } })
            );
          }
        }
      } catch {
        // silent polling error
      }
    }

    fetchStaffCatalog();

    const onVisible = () => {
      if (document.visibilityState === "visible") fetchStaffCatalog();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [activeId, isStaff, active?.staff_role]);
}
