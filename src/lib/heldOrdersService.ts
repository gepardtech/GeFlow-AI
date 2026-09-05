import { supabase } from "@/integrations/supabase/client";
import { HeldOrderRecord } from "@/components/pos/HeldOrdersModal";

const LOCAL_STORAGE_KEY_PREFIX = "geflow_held_orders_";

export async function fetchHeldOrders(businessId: string): Promise<HeldOrderRecord[]> {
  if (!businessId) return [];

  try {
    const { data, error } = await supabase
      .from("held_orders" as any)
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Sync local storage copy for offline resilience
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${businessId}`, JSON.stringify(data));
      return data as unknown as HeldOrderRecord[];
    }
  } catch (err) {
    console.warn("Could not fetch held_orders from Supabase, checking local fallback:", err);
  }

  // Fallback to localStorage
  try {
    const cached = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${businessId}`);
    if (cached) {
      return JSON.parse(cached);
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
    console.warn("Could not insert held_order to Supabase, using local fallback:", err);
  }

  syncLocalHeldOrder(localRecord, payload.business_id);
  return localRecord;
}

export async function deleteHeldOrder(orderId: string, businessId?: string): Promise<boolean> {
  try {
    await supabase.from("held_orders" as any).delete().eq("id", orderId);
  } catch {
    // Ignore error
  }

  // Clean from localStorage across keys
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
      // Ignore
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
