import { supabase } from "@/integrations/supabase/client";
import { normalizeReceiptQuery } from "@/lib/receiptUtils";

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
  barcode?: string | null;
  batch_number?: string | null;
}

export interface ReturnRecord {
  id: string;
  business_id: string;
  sale_id: string;
  invoice_no?: string | null;
  customer_name?: string | null;
  cashier_name?: string | null;
  total_refund: number;
  refund_method: string;
  reason: string;
  notes?: string | null;
  original_sale_total?: number | null;
  original_sale_date?: string | null;
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
  customer_name?: string | null;
  customer_phone?: string | null;
  invoice_no?: string | null;
  receipt_no?: string | null;
  payment_method?: string | null;
  created_at: string;
  items: {
    id: string;
    sale_id: string;
    product_id?: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    unit_cost: number;
    barcode?: string | null;
    batch_number?: string | null;
  }[];
}

export const getLocalReturns = (businessId: string): ReturnRecord[] => {
  try {
    const raw = localStorage.getItem(`geflow_returns_${businessId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
    }
  } catch {
    /* ignore */
  }
  return [];
};

export const saveLocalReturns = (businessId: string, records: ReturnRecord[]) => {
  try {
    const sorted = records.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    localStorage.setItem(`geflow_returns_${businessId}`, JSON.stringify(sorted));
  } catch {
    /* ignore */
  }
};

/**
 * Fetch all returns for a business (server + local merged, sorted New to Old)
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
        // Server records
        data.returns.forEach((r: ReturnRecord) => mergedMap.set(r.id, r));
        // Local records
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
 * Intelligent Search for Sales to Process Return:
 * Matches by:
 * 1. Slip No / Receipt # (e.g. RECEIPT #: GEF-ARCH-5SWQ88 or GEF-ARCH-5SWQ88 or sale_...)
 * 2. Client / Buyer Name (e.g. Ali)
 * 3. Product Name (e.g. Coca-Cola)
 * 4. Barcode (scanner input or typed barcode)
 * 5. Batch No (batch identifier)
 * 
 * Returns matching sales sorted New to Old.
 */
export async function searchSalesForReturn(
  businessId: string,
  searchQuery: string,
  searchType: "all" | "slip" | "customer" | "product" | "barcode" | "batch" = "all"
): Promise<SaleWithItems[]> {
  if (!businessId || !searchQuery.trim()) return [];

  const rawQuery = searchQuery.trim();
  const normalizedReceipt = normalizeReceiptQuery(rawQuery).toLowerCase();
  const queryLower = rawQuery.toLowerCase();

  const resultsMap = new Map<string, SaleWithItems>();

  // Helper to test if a sale matches
  const testSale = (sale: any, items: any[], catalogProducts?: any[]) => {
    const saleIdLower = (sale.id || "").toLowerCase();
    const invoiceLower = (sale.invoice_no || sale.receipt_no || "").toLowerCase();
    const customerLower = (sale.customer_name || "").toLowerCase();
    const customerPhoneLower = (sale.customer_phone || "").toLowerCase();

    // 1. Slip / Receipt match
    if (searchType === "all" || searchType === "slip") {
      if (
        saleIdLower === queryLower ||
        saleIdLower.includes(normalizedReceipt) ||
        invoiceLower === normalizedReceipt ||
        invoiceLower.includes(normalizedReceipt) ||
        normalizedReceipt.includes(invoiceLower && invoiceLower.length > 4 ? invoiceLower : "___")
      ) {
        return true;
      }
    }

    // 2. Client / Buyer Name match
    if (searchType === "all" || searchType === "customer") {
      if (
        customerLower.includes(queryLower) ||
        customerPhoneLower.includes(queryLower)
      ) {
        return true;
      }
    }

    // 3. Product Name match
    if (searchType === "all" || searchType === "product") {
      const matchItem = items.some((it) => {
        const pName = (it.product_name || "").toLowerCase();
        return pName.includes(queryLower) || queryLower.includes(pName);
      });
      if (matchItem) return true;
    }

    // 4. Barcode match
    if (searchType === "all" || searchType === "barcode") {
      const matchBarcode = items.some((it) => {
        const itBarcode = (it.barcode || "").toLowerCase();
        if (itBarcode && itBarcode === queryLower) return true;
        // Check catalog product
        if (catalogProducts && it.product_id) {
          const prod = catalogProducts.find((p) => p.id === it.product_id);
          if (prod && prod.barcode && prod.barcode.toLowerCase() === queryLower) return true;
        }
        return false;
      });
      if (matchBarcode) return true;
    }

    // 5. Batch No match
    if (searchType === "all" || searchType === "batch") {
      const matchBatch = items.some((it) => {
        const itBatch = (it.batch_number || "").toLowerCase();
        if (itBatch && (itBatch === queryLower || itBatch.includes(queryLower))) return true;
        // Check catalog product
        if (catalogProducts && it.product_id) {
          const prod = catalogProducts.find((p) => p.id === it.product_id);
          if (prod && prod.batch_number && prod.batch_number.toLowerCase().includes(queryLower)) return true;
        }
        return false;
      });
      if (matchBatch) return true;
    }

    return false;
  };

  // 1. Fetch from Sync Server
  try {
    const res = await fetch(`/api/sync/business-data?businessId=${encodeURIComponent(businessId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.sales)) {
        const sales = data.sales;
        const allItems = Array.isArray(data.sale_items) ? data.sale_items : [];
        const catalogProducts = Array.isArray(data.products) ? data.products : [];

        sales.forEach((s: any) => {
          const sItems = allItems
            .filter((i: any) => i.sale_id === s.id)
            .map((i: any) => ({
              id: i.id,
              sale_id: i.sale_id,
              product_id: i.product_id,
              product_name: i.product_name,
              quantity: Number(i.quantity) || 1,
              unit_price: Number(i.unit_price) || 0,
              unit_cost: Number(i.unit_cost) || 0,
              barcode: i.barcode || null,
              batch_number: i.batch_number || null,
            }));

          if (testSale(s, sItems, catalogProducts)) {
            resultsMap.set(s.id, {
              ...s,
              items: sItems,
            });
          }
        });
      }
    }
  } catch (syncErr) {
    console.warn("Notice querying sync server in searchSalesForReturn:", syncErr);
  }

  // 2. Fetch from Supabase as fallback/addition
  try {
    const { data: salesData, error } = await supabase
      .from("sales")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(60);

    if (!error && salesData && salesData.length > 0) {
      const saleIds = salesData.map((s) => s.id);
      const { data: allItems } = await supabase
        .from("sale_items")
        .select("*")
        .in("sale_id", saleIds);

      // Local products catalog for barcode/batch lookups
      let catalogProducts: any[] = [];
      try {
        const localProds = localStorage.getItem(`geflow_products_${businessId}`);
        if (localProds) catalogProducts = JSON.parse(localProds);
      } catch {
        /* ignore */
      }

      salesData.forEach((s) => {
        const sItems = (allItems || [])
          .filter((i) => i.sale_id === s.id)
          .map((i) => ({
            id: i.id,
            sale_id: i.sale_id,
            product_id: i.product_id,
            product_name: i.product_name,
            quantity: Number(i.quantity) || 1,
            unit_price: Number(i.unit_price) || 0,
            unit_cost: Number(i.unit_cost) || 0,
            barcode: (i as any).barcode || null,
            batch_number: (i as any).batch_number || null,
          }));

        if (testSale(s, sItems, catalogProducts)) {
          if (!resultsMap.has(s.id)) {
            resultsMap.set(s.id, {
              ...s,
              items: sItems,
            });
          }
        }
      });
    }
  } catch (supErr) {
    console.warn("Notice querying Supabase in searchSalesForReturn:", supErr);
  }

  // Return list sorted New to Old
  return Array.from(resultsMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Backward compatible single sale lookup
 */
export async function findSaleForReturn(
  businessId: string,
  searchQuery: string
): Promise<SaleWithItems | null> {
  const matches = await searchSalesForReturn(businessId, searchQuery, "all");
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Fetch recent sales for quick selection in the return interface
 */
export async function fetchRecentSalesForReturn(
  businessId: string,
  limit = 20
): Promise<SaleWithItems[]> {
  if (!businessId) return [];

  // Try sync server first for realtime data
  try {
    const res = await fetch(`/api/sync/business-data?businessId=${encodeURIComponent(businessId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.sales)) {
        const allItems = Array.isArray(data.sale_items) ? data.sale_items : [];
        return data.sales
          .slice()
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, limit)
          .map((s: any) => ({
            ...s,
            items: allItems
              .filter((i: any) => i.sale_id === s.id)
              .map((i: any) => ({
                id: i.id,
                sale_id: i.sale_id,
                product_id: i.product_id,
                product_name: i.product_name,
                quantity: Number(i.quantity) || 1,
                unit_price: Number(i.unit_price) || 0,
                unit_cost: Number(i.unit_cost) || 0,
                barcode: i.barcode || null,
                batch_number: i.batch_number || null,
              })),
          }));
      }
    }
  } catch (err) {
    console.warn("Notice fetching recent sales from sync server:", err);
  }

  // Fallback to Supabase
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
            barcode: (i as any).barcode || null,
            batch_number: (i as any).batch_number || null,
          })),
      }));
    }
  } catch (err) {
    console.warn("Notice fetching recent sales from Supabase:", err);
  }

  return [];
}

export interface ProcessReturnInput {
  businessId: string;
  saleId: string;
  invoiceNo?: string;
  customerName?: string;
  cashierName?: string;
  refundMethod: string;
  reason: string;
  notes?: string;
  items: ReturnItem[];
  userId?: string;
  originalSaleTotal?: number;
  originalSaleDate?: string;
}

/**
 * Execute a customer return:
 * 1. Restocks inventory in LocalStorage cache, Supabase, and Sync Server (if restock = true)
 * 2. Records Stock Movement logs in Supabase & Central Sync Server
 * 3. Adjusts Sale status to refunded
 * 4. Records return transaction and returns the final ReturnRecord
 * 5. Dispatches realtime reactivity events
 */
export async function executeReturnTransaction(input: ProcessReturnInput): Promise<ReturnRecord> {
  const {
    businessId,
    saleId,
    invoiceNo,
    customerName,
    cashierName,
    refundMethod,
    reason,
    notes,
    items,
    userId,
    originalSaleTotal,
    originalSaleDate,
  } = input;

  const totalRefund = items.reduce((sum, it) => sum + it.refund_amount, 0);
  const returnId = `ret_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const record: ReturnRecord = {
    id: returnId,
    business_id: businessId,
    sale_id: saleId,
    invoice_no: invoiceNo || null,
    customer_name: customerName || null,
    cashier_name: cashierName || "Cashier",
    total_refund: totalRefund,
    refund_method: refundMethod,
    reason,
    notes: notes || null,
    original_sale_total: originalSaleTotal || null,
    original_sale_date: originalSaleDate || null,
    items,
    created_at: now,
  };

  // 1. Post to Server Sync Engine & get updated products
  let syncUpdatedProducts: { id: string; stock_units: number }[] = [];
  try {
    const res = await fetch("/api/sync/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        returnRecord: record,
        items,
        userId,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.updatedProducts)) {
        syncUpdatedProducts = data.updatedProducts;
      }
    }
  } catch (err) {
    console.warn("Notice recording return on sync server:", err);
  }

  // 2. CRITICAL: Directly Restock LocalStorage inventory cache
  // This ensures POS and Inventory screens immediately reflect restored stock!
  try {
    const prodKey = `geflow_products_${businessId}`;
    const rawProds = localStorage.getItem(prodKey);
    if (rawProds) {
      const prods = JSON.parse(rawProds);
      if (Array.isArray(prods)) {
        let modified = false;

        // Apply any sync server calculated numbers
        syncUpdatedProducts.forEach((up) => {
          const target = prods.find((p: any) => p.id === up.id);
          if (target) {
            target.stock_units = up.stock_units;
            target.updated_at = now;
            modified = true;
          }
        });

        // Ensure each restocked item is incremented
        items.forEach((item) => {
          if (item.restock !== false) {
            let p = prods.find((x: any) => x.id === item.product_id);
            if (!p && item.product_name) {
              const cleanName = item.product_name.replace(/\[.*?\]/g, "").trim().toLowerCase();
              p = prods.find(
                (x: any) =>
                  (x.name && x.name.toLowerCase() === cleanName) ||
                  (x.name && x.name.toLowerCase() === item.product_name.toLowerCase())
              );
            }
            if (p) {
              p.stock_units = (Number(p.stock_units) || 0) + (Number(item.return_qty) || 0);
              p.updated_at = now;
              modified = true;
            }
          }
        });

        if (modified) {
          localStorage.setItem(prodKey, JSON.stringify(prods));
        }
      }
    }
  } catch (locErr) {
    console.warn("Notice restoring stock in local cache:", locErr);
  }

  // 3. Adjust Supabase Database (Products inventory & Stock movements) and Sync server
  for (const item of items) {
    if (item.restock !== false) {
      try {
        let targetProd: { id: string; stock_units?: number; name?: string } | null = null;

        // 3a. Lookup by product_id
        if (item.product_id) {
          const { data: prod } = await supabase
            .from("products")
            .select("id, stock_units, name")
            .eq("id", item.product_id)
            .maybeSingle();

          if (prod) {
            targetProd = prod;
          }
        }

        // 3b. Fallback lookup by product_name or barcode across business inventory
        if (!targetProd && item.product_name) {
          const cleanName = item.product_name.replace(/\[.*?\]/g, "").trim().toLowerCase();
          const { data: prodsList } = await supabase
            .from("products")
            .select("id, stock_units, name, barcode")
            .eq("business_id", businessId);

          if (prodsList && prodsList.length > 0) {
            targetProd = prodsList.find((p) => {
              const pName = (p.name || "").toLowerCase();
              if (pName === item.product_name.toLowerCase()) return true;
              if (pName === cleanName) return true;
              if (item.barcode && p.barcode && p.barcode.toLowerCase() === item.barcode.toLowerCase()) return true;
              return pName.includes(cleanName) || cleanName.includes(pName);
            }) || null;
          }
        }

        if (targetProd) {
          const currentStock = Number(targetProd.stock_units) || 0;
          const newStock = currentStock + Number(item.return_qty);

          // Update Supabase product stock
          await supabase
            .from("products")
            .update({ stock_units: newStock, updated_at: now })
            .eq("id", targetProd.id);

          // Log stock movement in Supabase
          await supabase.from("stock_movements").insert({
            business_id: businessId,
            product_id: targetProd.id,
            owner_user_id: userId || "",
            type: "return",
            quantity: item.return_qty,
            reason: `Customer Return: ${item.reason || reason}`,
            note: `Restocked ${item.return_qty}x for Return #${returnId} (Slip #${invoiceNo || saleId})`,
          });

          // Also trigger server-side stock adjustment for synchronized multi-device awareness
          fetch("/api/sync/adjust-stock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessId,
              productId: targetProd.id,
              deltaQuantity: Number(item.return_qty),
              type: "in",
              reason: `Customer Return: ${item.reason || reason}`,
              note: `Restocked ${item.return_qty}x for Return #${returnId} (Slip #${invoiceNo || saleId})`,
              userId,
            }),
          }).catch(() => {});
        }
      } catch (dbErr) {
        console.warn(`Notice updating inventory in Supabase for ${item.product_name}:`, dbErr);
      }
    }
  }

  // 4. Update sale status in Supabase
  try {
    await supabase
      .from("sales")
      .update({ status: "refunded" })
      .eq("id", saleId);
  } catch (saleErr) {
    console.warn("Notice updating sale status in Supabase:", saleErr);
  }

  // 5. Save to local returns cache (New to Old)
  const existingLocal = getLocalReturns(businessId);
  existingLocal.unshift(record);
  saveLocalReturns(businessId, existingLocal);

  // 6. Dispatch events across app for immediate UI updates
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("geflow:returns-updated", { detail: { businessId, returnId } }));
    window.dispatchEvent(new CustomEvent("geflow:products-updated", { detail: { businessId } }));
    window.dispatchEvent(new CustomEvent("geflow:sales-updated", { detail: { businessId } }));
    window.dispatchEvent(new CustomEvent("geflow:stock-updated", { detail: { businessId } }));
    window.dispatchEvent(new CustomEvent("panel:refresh"));
  }

  return record;
}
