import { supabase } from "@/integrations/supabase/client";
import { HeldOrderRecord } from "@/components/pos/HeldOrdersModal";

const LOCAL_STORAGE_KEY_PREFIX = "geflow_held_orders_";

export async function fetchHeldOrders(businessId: string): Promise<HeldOrderRecord[]> {
  if (!businessId) return [];

  // 1. Primary: Fetch from backend API which reads from PostgreSQL held_orders table with service role
  try {
    const res = await fetch(`/api/sync/held-orders?businessId=${encodeURIComponent(businessId)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.heldOrders) && json.heldOrders.length > 0) {
        localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${businessId}`, JSON.stringify(json.heldOrders));
        return json.heldOrders as HeldOrderRecord[];
      }
    }
  } catch (err) {
    console.warn("Notice fetching held_orders from sync server:", err);
  }

  // 2. Secondary: Query Supabase directly
  try {
    const { data, error } = await supabase
      .from("held_orders" as any)
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${businessId}`, JSON.stringify(data));
      return data as unknown as HeldOrderRecord[];
    }
  } catch (err) {
    console.warn("Notice fetching held_orders from Supabase:", err);
  }

  // 3. Fallback to localStorage without overwriting it if server was temporarily empty
  try {
    const cached = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${businessId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore JSON errors
  }

  return [];
}

export async function saveHeldOrder(payload: {
  business_id: string;
  owner_user_id?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_note?: string | null;
  cart_data: any[];
  total_amount: number;
  item_count: number;
}): Promise<HeldOrderRecord> {
  const localRecord: HeldOrderRecord = {
    id: `held_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 1. Save to backend service-role API which writes to PostgreSQL held_orders table
  try {
    const res = await fetch("/api/sync/held-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: payload.business_id, order: localRecord }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.heldOrder) {
        syncLocalHeldOrder(data.heldOrder, payload.business_id);
        return data.heldOrder;
      }
    }
  } catch (err) {
    console.warn("Notice saving held_order via sync server:", err);
  }

  // 2. Secondary: Insert to Supabase directly
  try {
    const { data, error } = await supabase
      .from("held_orders" as any)
      .insert({
        business_id: payload.business_id,
        owner_user_id: payload.owner_user_id,
        customer_name: payload.customer_name || null,
        customer_phone: payload.customer_phone || null,
        customer_note: payload.customer_note || null,
        cart_data: payload.cart_data,
        total_amount: payload.total_amount,
        item_count: payload.item_count,
      })
      .select("*")
      .single();

    if (!error && data) {
      const record = data as unknown as HeldOrderRecord;
      syncLocalHeldOrder(record, payload.business_id);
      return record;
    }
  } catch (err) {
    console.warn("Notice inserting held_order to Supabase:", err);
  }

  syncLocalHeldOrder(localRecord, payload.business_id);
  return localRecord;
}

export async function deleteHeldOrder(orderId: string, businessId?: string): Promise<boolean> {
  // 1. Delete on server API
  if (businessId) {
    try {
      await fetch("/api/sync/held-orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, orderId }),
      });
    } catch {
      /* ignore */
    }
  }

  // 2. Delete on Supabase
  try {
    await supabase.from("held_orders" as any).delete().eq("id", orderId);
  } catch {
    // Ignore error
  }

  // 3. Clean from localStorage
  if (businessId) {
    try {
      const key = `${LOCAL_STORAGE_KEY_PREFIX}${businessId}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        const list: HeldOrderRecord[] = JSON.parse(cached);
        const filtered = list.filter((o) => o.id !== orderId);
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    } catch {
      // Ignore errors
    }
  }
  return true;
}

function syncLocalHeldOrder(record: HeldOrderRecord, businessId: string) {
  try {
    const key = `${LOCAL_STORAGE_KEY_PREFIX}${businessId}`;
    const cached = localStorage.getItem(key);
    const list: HeldOrderRecord[] = cached ? JSON.parse(cached) : [];
    const updated = [record, ...list.filter((i) => i.id !== record.id)];
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}
