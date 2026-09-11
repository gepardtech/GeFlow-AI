import { supabase } from "@/integrations/supabase/client";

export interface ReturnItem {
  product_id?: string | null;
  product_name: string;
  original_qty: number;
  return_qty: number;
  unit_price: number;
  unit_cost: number;
  refund_amount: number;
  reason: "damaged" | "expired" | "wrong_item" | "customer_change_mind" | "other";
  restock: boolean;
}

export interface ReturnRecord {
  id: string;
  business_id: string;
  sale_id: string;
  customer_name?: string | null;
  cashier_name?: string | null;
  total_refund: number;
  refund_method: string;
  reason: string;
  notes?: string | null;
  items: ReturnItem[];
  created_at: string;
}

export interface SaleWithItems {
  id: string;
  business_id: string;
  total: number;
  profit: number;
  status: string;
  processed_by?: string | null;
  created_at: string;
  items: {
    id: string;
    sale_id: string;
    product_id?: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    unit_cost: number;
  }[];
}

const getLocalReturns = (businessId: string): ReturnRecord[] => {
  try {
    const raw = localStorage.getItem(`geflow_returns_${businessId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return [];
};

const saveLocalReturns = (businessId: string, records: ReturnRecord[]) => {
  try {
    localStorage.setItem(`geflow_returns_${businessId}`, JSON.stringify(records));
  } catch {
    /* ignore */
  }
};

/**
 * Fetch all returns for a business (server + local merged)
 */
export async function fetchReturnsHistory(businessId: string): Promise<ReturnRecord[]> {
  if (!businessId) return [];

  const local = getLocalReturns(businessId);
  try {
    const res = await fetch(`/api/sync/returns?businessId=${encodeURIComponent(businessId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.returns)) {
        const mergedMap = new Map<string, ReturnRecord>();
        data.returns.forEach((r: ReturnRecord) => mergedMap.set(r.id, r));
        local.forEach((r: ReturnRecord) => {
          if (!mergedMap.has(r.id)) mergedMap.set(r.id, r);
        });
        const list = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        saveLocalReturns(businessId, list);
        return list;
      }
    }
  } catch (err) {
    console.warn("Notice fetching returns from server:", err);
  }

  return local.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Fetch a sale and its items by Sale ID / Receipt number
 */
export async function findSaleForReturn(
  businessId: string,
  searchQuery: string
): Promise<SaleWithItems | null> {
  if (!businessId || !searchQuery.trim()) return null;

  const cleanQuery = searchQuery.trim();

  // 1. Try Supabase query first
  try {
    const { data: sales, error } = await supabase
      .from("sales")
      .select("*")
      .eq("business_id", businessId)
      .or(`id.eq.${cleanQuery},id.ilike.%${cleanQuery}%`)
      .limit(1);

    if (!error && sales && sales.length > 0) {
      const sale = sales[0];
      const { data: items } = await supabase
        .from("sale_items")
        .select("*")
        .eq("sale_id", sale.id);

      return {
        ...sale,
        items: (items || []).map((i) => ({
          id: i.id,
          sale_id: i.sale_id,
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: Number(i.quantity) || 1,
          unit_price: Number(i.unit_price) || 0,
          unit_cost: Number(i.unit_cost) || 0,
        })),
      };
    }
  } catch (err) {
    console.warn("Notice querying Supabase for sale:", err);
  }

  // 2. Try sync server
  try {
    const res = await fetch(`/api/sync/business-data?businessId=${encodeURIComponent(businessId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.sales)) {
        const foundSale = data.sales.find(
          (s: any) => s.id === cleanQuery || String(s.id).includes(cleanQuery)
        );
        if (foundSale) {
          const items = (data.sale_items || []).filter((i: any) => i.sale_id === foundSale.id);
          return {
            ...foundSale,
            items: items.map((i: any) => ({
              id: i.id,
              sale_id: i.sale_id,
              product_id: i.product_id,
              product_name: i.product_name,
              quantity: Number(i.quantity) || 1,
              unit_price: Number(i.unit_price) || 0,
              unit_cost: Number(i.unit_cost) || 0,
            })),
          };
        }
      }
    }
  } catch (err) {
    console.warn("Notice querying sync server for sale:", err);
  }

  return null;
}

/**
 * Fetch recent sales for quick selection in the return interface
 */
export async function fetchRecentSalesForReturn(
  businessId: string,
  limit = 20
): Promise<SaleWithItems[]> {
  if (!businessId) return [];

  try {
    const { data: sales, error } = await supabase
      .from("sales")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!error && sales && sales.length > 0) {
      const saleIds = sales.map((s) => s.id);
      const { data: allItems } = await supabase
        .from("sale_items")
        .select("*")
        .in("sale_id", saleIds);

      return sales.map((s) => ({
        ...s,
        items: (allItems || [])
          .filter((i) => i.sale_id === s.id)
          .map((i) => ({
            id: i.id,
            sale_id: i.sale_id,
            product_id: i.product_id,
            product_name: i.product_name,
            quantity: Number(i.quantity) || 1,
            unit_price: Number(i.unit_price) || 0,
            unit_cost: Number(i.unit_cost) || 0,
          })),
      }));
    }
  } catch (err) {
    console.warn("Notice fetching recent sales from Supabase:", err);
  }

  // Fallback to sync server
  try {
    const res = await fetch(`/api/sync/business-data?businessId=${encodeURIComponent(businessId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.sales)) {
        return data.sales.slice(0, limit).map((s: any) => ({
          ...s,
          items: (data.sale_items || [])
            .filter((i: any) => i.sale_id === s.id)
            .map((i: any) => ({
              id: i.id,
              sale_id: i.sale_id,
              product_id: i.product_id,
              product_name: i.product_name,
              quantity: Number(i.quantity) || 1,
              unit_price: Number(i.unit_price) || 0,
              unit_cost: Number(i.unit_cost) || 0,
            })),
        }));
      }
    }
  } catch (err) {
    console.warn("Notice fetching recent sales from sync server:", err);
  }

  return [];
}

export interface ProcessReturnInput {
  businessId: string;
  saleId: string;
  customerName?: string;
  cashierName?: string;
  refundMethod: string;
  reason: string;
  notes?: string;
  items: ReturnItem[];
  userId?: string;
}

/**
 * Execute a customer return:
 * 1. Restocks inventory in Supabase and Sync Server (if restock = true)
 * 2. Records Stock Movement logs
 * 3. Adjusts Sale status
 * 4. Records return transaction and returns the final ReturnRecord
 */
export async function executeReturnTransaction(input: ProcessReturnInput): Promise<ReturnRecord> {
  const {
    businessId,
    saleId,
    customerName,
    cashierName,
    refundMethod,
    reason,
    notes,
    items,
    userId,
  } = input;

  const totalRefund = items.reduce((sum, it) => sum + it.refund_amount, 0);
  const returnId = `ret_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const record: ReturnRecord = {
    id: returnId,
    business_id: businessId,
    sale_id: saleId,
    customer_name: customerName || null,
    cashier_name: cashierName || "Cashier",
    total_refund: totalRefund,
    refund_method: refundMethod,
    reason,
    notes: notes || null,
    items,
    created_at: now,
  };

  // 1. Post to Server Sync Engine
  try {
    await fetch("/api/sync/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        returnRecord: record,
        items,
        userId,
      }),
    });
  } catch (err) {
    console.warn("Notice recording return on sync server:", err);
  }

  // 2. Adjust Supabase Database (Products inventory & Stock movements)
  for (const item of items) {
    if (item.product_id && item.restock !== false) {
      try {
        // Fetch current stock
        const { data: prod } = await supabase
          .from("products")
          .select("stock_units")
          .eq("id", item.product_id)
          .maybeSingle();

        if (prod) {
          const currentStock = Number(prod.stock_units) || 0;
          const newStock = currentStock + item.return_qty;

          await supabase
            .from("products")
            .update({ stock_units: newStock, updated_at: now })
            .eq("id", item.product_id);
        }

        // Log stock movement
        await supabase.from("stock_movements").insert({
          business_id: businessId,
          product_id: item.product_id,
          owner_user_id: userId || "",
          type: "return",
          quantity: item.return_qty,
          reason: `Return/Refund: ${item.reason || reason}`,
          note: `Refund for Sale #${saleId} (${item.return_qty}x returned)`,
        });
      } catch (dbErr) {
        console.warn(`Notice updating inventory in Supabase for ${item.product_id}:`, dbErr);
      }
    }
  }

  // 3. Update sale status in Supabase
  try {
    await supabase
      .from("sales")
      .update({ status: "refunded" })
      .eq("id", saleId);
  } catch (saleErr) {
    console.warn("Notice updating sale status in Supabase:", saleErr);
  }

  // 4. Save to local storage cache for instant reactivity
  const existingLocal = getLocalReturns(businessId);
  existingLocal.unshift(record);
  saveLocalReturns(businessId, existingLocal);

  // 5. Dispatch events across app
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("geflow:returns-updated", { detail: { businessId, returnId } }));
    window.dispatchEvent(new CustomEvent("geflow:products-updated", { detail: { businessId } }));
    window.dispatchEvent(new CustomEvent("geflow:sales-updated", { detail: { businessId } }));
    window.dispatchEvent(new CustomEvent("geflow:stock-updated", { detail: { businessId } }));
  }

  return record;
}
