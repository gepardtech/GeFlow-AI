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
  const activeId = active?.id;
  const isStaff = Boolean(active?.is_staff);
  const ownerUserId = active?.owner_user_id;
  const businessName = active?.name;

  // 1. Business Owner Pipeline:
  // When owner is online or updates inventory, mirror Supabase directly to sync engine
  useEffect(() => {
    if (!activeId || isStaff) return;

    let isMounted = true;

    async function syncOwnerCatalog() {
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
        });

        window.dispatchEvent(
          new CustomEvent("geflow:products-updated", { detail: { businessId: activeId } })
        );
      } catch (err) {
        console.warn("Realtime sync notice for owner catalog:", err);
      }
    }

    syncOwnerCatalog();

    // Supabase Realtime channel for instant DB changes
    const channel = supabase
      .channel(`rt-products-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `business_id=eq.${activeId}`,
        },
        () => {
          syncOwnerCatalog();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [activeId, isStaff, ownerUserId, businessName]);

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
