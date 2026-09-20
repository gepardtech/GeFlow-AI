import { supabase } from "@/integrations/supabase/client";

export function isDemoProduct(p: any): boolean {
  if (!p) return false;
  const name = String(p.name || "").toLowerCase().trim();
  const sku = String(p.internal_sku || p.sku || "").toUpperCase().trim();
  const id = String(p.id || "");

  if (
    name.includes("barcode scanner handheld") ||
    name.includes("thermal receipt paper 80mm") ||
    name.includes("heavy duty cash drawer") ||
    name.includes("thermal pos receipt printer") ||
    name.includes("tablet countertop stand") ||
    name.includes("barcode price label stickers") ||
    name === "organic espresso roast" ||
    name === "caramel macchiato syrup" ||
    name === "butter croissant (pack of 4)" ||
    name === "earl grey reserve loose leaf" ||
    name === "ceramic artisan mug 12oz"
  ) {
    return true;
  }

  if (
    ["SCAN-WL-01", "PPR-THM-80", "CSH-DRW-HD", "PRN-POS-80", "STN-TAB-360", "LBL-STK-5030"].includes(sku)
  ) {
    return true;
  }

  if (
    (id.includes("_01") || id.includes("_02") || id.includes("_03") || id.includes("_04") || id.includes("_05") || id.includes("_06")) &&
    (id.startsWith("prod_2fa7e2a5") || id.startsWith("prod_bcf76970") || id.startsWith("prod_espresso") || id.startsWith("prod_latte") || id.startsWith("prod_croissant") || id.startsWith("prod_tea") || id.startsWith("prod_cup"))
  ) {
    return true;
  }

  return false;
}

export interface SyncedProductItem {
  id: string;
  business_id: string;
  owner_user_id?: string;
  name: string;
  description?: string | null;
  internal_sku?: string | null;
  barcode?: string | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  purchase_cost: number;
  retail_price: number;
  discount_price?: number | null;
  stock_units: number;
  min_stock_alert: number;
  batch_number?: string | null;
  expiry_date?: string | null;
  status: string;
  images?: string[];
  uom?: string | null;
  units_per_uom?: number | null;
  base_unit?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SyncedReportsPayload {
  products: any[];
  sales: any[];
  sale_items: any[];
  stock_movements: any[];
  purchases: any[];
  purchase_items: any[];
  categories: any[];
}

/**
 * Syncs the current business owner's catalog to the central sync server.
 * Ensures any invited employee can immediately see, scan, and sell these items.
 */
export async function syncOwnerDataToServer(businessId: string, ownerUserId?: string, businessName?: string) {
  if (!businessId) return;

  try {
    const [
      { data: products },
      { data: sales },
      { data: items },
      { data: movements },
      { data: categories },
    ] = await Promise.all([
      supabase.from("products").select("*").eq("business_id", businessId),
      supabase.from("sales").select("*").eq("business_id", businessId).limit(100),
      supabase.from("sale_items").select("*").limit(200),
      supabase.from("stock_movements").select("*").eq("business_id", businessId).limit(100),
      supabase.from("product_categories").select("*"),
    ]);

    if (products !== null && Array.isArray(products)) {
      const cleanProducts = products.filter((p: any) => !isDemoProduct(p));
      await fetch("/api/sync/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          ownerUserId,
          businessName,
          products: cleanProducts,
          replace: true,
          sales: sales || [],
          sale_items: items || [],
          stock_movements: movements || [],
          categories: categories || [],
        }),
      });
    }
  } catch (err) {
    console.warn("Notice in syncOwnerDataToServer:", err);
  }
}

/**
 * Fetch products for POS / Inventory / Low Stock.
 * Supports both Owner (Supabase direct) and Employees (Synchronized server engine).
 */
export async function fetchSyncedProducts(
  businessId: string,
  options: {
    role?: string;
    isStaff?: boolean;
    ownerUserId?: string;
    statusOnly?: string;
  } = {}
): Promise<SyncedProductItem[]> {
  if (!businessId) return [];

  // 1. ALWAYS query Supabase directly first for the business (real realtime database)
  try {
    let query = supabase.from("products").select("*").eq("business_id", businessId);
    if (options.statusOnly) {
      query = query.eq("status", options.statusOnly);
    }
    const { data, error } = await query.order("name");

    if (!error && data && data.length > 0) {
      const cleanData = (data as SyncedProductItem[]).filter((p) => !isDemoProduct(p));
      try {
        localStorage.setItem(`geflow_products_${businessId}`, JSON.stringify(cleanData));
      } catch {
        /* ignore */
      }
      return cleanData;
    }
  } catch (err) {
    console.warn("Supabase direct query:", err);
  }

  // 2. Fetch from the dedicated Operational Sync Engine
  try {
    const res = await fetch(`/api/sync/business-data?businessId=${encodeURIComponent(businessId)}&role=${encodeURIComponent(options.role || "manager")}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        const cleanProducts = (data.products as SyncedProductItem[]).filter((p) => !isDemoProduct(p));
        try {
          localStorage.setItem(`geflow_products_${businessId}`, JSON.stringify(cleanProducts));
        } catch {
          /* ignore */
        }
        return cleanProducts;
      }
    }
  } catch (err) {
    console.warn("Notice querying sync engine:", err);
  }

  // 3. Fallback to localStorage cache if network is offline
  try {
    const cached = localStorage.getItem(`geflow_products_${businessId}`);
    if (cached) {
      const parsed = JSON.parse(cached) as SyncedProductItem[];
      const cleaned = parsed.filter((p: any) => !isDemoProduct(p));
      return cleaned;
    }
  } catch {
    /* ignore */
  }

  return [];
}

// Global purge of legacy cached demo items in browser localStorage
if (typeof window !== "undefined") {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("geflow_products_") || key.startsWith("cached_reports_"))) {
        const val = localStorage.getItem(key);
        if (
          val &&
          (val.includes("prod_espresso") ||
            val.includes("Organic Espresso") ||
            val.includes("Caramel Macchiato") ||
            val.includes("Butter Croissant") ||
            val.includes("Barcode Scanner") ||
            val.includes("Receipt Paper") ||
            val.includes("Cash Drawer") ||
            val.includes("Receipt Printer") ||
            val.includes("Tablet Stand") ||
            val.includes("Price Label Stickers") ||
            val.includes("SCAN-WL-01") ||
            val.includes("PPR-THM-80") ||
            val.includes("CSH-DRW-HD") ||
            val.includes("PRN-POS-80"))
        ) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/**
 * Fetch synchronized operational dataset for Reports & Analytics
 */
export async function fetchSyncedReportsData(
  businessId: string,
  role = "manager",
  isStaff = false
): Promise<SyncedReportsPayload> {
  const fallback: SyncedReportsPayload = {
    products: [],
    sales: [],
    sale_items: [],
    stock_movements: [],
    purchases: [],
    purchase_items: [],
    categories: [],
  };

  if (!businessId) return fallback;

  // 1. ALWAYS query Supabase directly first (real operational database)
  try {
    const [
      { data: salesData },
      { data: itemsData },
      { data: productsData },
      { data: catData },
      { data: movementsData },
      { data: purchasesData },
      { data: purchaseItemsData },
    ] = await Promise.all([
      supabase.from("sales").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
      supabase.from("sale_items").select("*"),
      supabase.from("products").select("*").eq("business_id", businessId),
      supabase.from("product_categories").select("*"),
      supabase.from("stock_movements").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
      supabase.from("purchases").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
      supabase.from("purchase_items").select("*"),
    ]);

    if (salesData || productsData || purchasesData) {
      return {
        products: (productsData || []).filter((p: any) => !isDemoProduct(p)),
        sales: salesData || [],
        sale_items: itemsData || [],
        stock_movements: movementsData || [],
        purchases: purchasesData || [],
        purchase_items: purchaseItemsData || [],
        categories: catData || [],
      };
    }
  } catch (err) {
    console.warn("Direct Supabase reports query notice:", err);
  }

  // 2. Fetch from sync server
  try {
    const res = await fetch(`/api/sync/business-data?businessId=${encodeURIComponent(businessId)}&role=${encodeURIComponent(role)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return {
          products: (data.products || []).filter((p: any) => !isDemoProduct(p)),
          sales: data.sales || [],
          sale_items: data.sale_items || [],
          stock_movements: data.stock_movements || [],
          purchases: data.purchases || [],
          purchase_items: data.purchase_items || [],
          categories: data.categories || [],
        };
      }
    }
  } catch (err) {
    console.warn("Notice in fetchSyncedReportsData:", err);
  }

  return fallback;
}

/**
 * Record a finalized POS Sale with automatic inventory deduction and stock movement logging.
 */
export async function recordSyncedSale(
  businessId: string,
  payload: {
    sale: {
      id?: string;
      invoice_no?: string;
      receipt_no?: string;
      customer_name?: string;
      customer_phone?: string;
      total: number;
      profit?: number;
      status?: string;
      processed_by?: string;
      owner_user_id?: string;
    };
    items: {
      product_id?: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      unit_cost?: number;
      deductionUnits?: number;
      barcode?: string | null;
      batch_number?: string | null;
      internal_sku?: string | null;
    }[];
    cashierName?: string;
    userId?: string;
    isStaff?: boolean;
  }
) {
  // 1. Post to Central Sync Engine
  let syncResult: any = null;
  try {
    const res = await fetch("/api/sync/sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        sale: payload.sale,
        items: payload.items,
        cashierName: payload.cashierName,
        userId: payload.userId,
      }),
    });
    if (res.ok) {
      syncResult = await res.json();
    }
  } catch (err) {
    console.warn("Error posting sale to sync server:", err);
  }

  // 2. Always record in Supabase database
  try {
    const isUuid = (str?: string | null): boolean =>
      Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

    const saleRow: any = {
      business_id: businessId,
      owner_user_id: payload.userId,
      total: Number(payload.sale.total) || 0,
      profit: Number(payload.sale.profit) || 0,
      status: payload.sale.status || "completed",
      processed_by: payload.cashierName || "Cashier",
    };

    if (isUuid(payload.sale.id)) {
      saleRow.id = payload.sale.id;
    } else if (isUuid(syncResult?.sale?.id)) {
      saleRow.id = syncResult.sale.id;
    }

    const { data: insertedSale, error: saleInsertError } = await supabase
      .from("sales")
      .insert(saleRow)
      .select("id")
      .maybeSingle();

    if (saleInsertError) {
      console.warn("Notice recording sale in Supabase:", saleInsertError.message);
    }

    const finalSaleId = insertedSale?.id || (isUuid(saleRow.id) ? saleRow.id : null);

    if (finalSaleId && Array.isArray(payload.items) && payload.items.length > 0) {
      const itemsRows = payload.items.map((i) => ({
        sale_id: finalSaleId,
        owner_user_id: payload.userId,
        product_id: isUuid(i.product_id) ? i.product_id : null,
        product_name: i.product_name,
        quantity: Math.max(1, Math.round(Number(i.quantity) || 1)),
        unit_price: Number(i.unit_price) || 0,
        unit_cost: Number(i.unit_cost) || 0,
      }));
      await supabase.from("sale_items").insert(itemsRows);
    }
  } catch (supErr) {
    console.warn("Notice recording sale in Supabase:", supErr);
  }

  // 3. Dispatch window events for instant UI reactivity
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("geflow:sales-updated", { detail: { businessId } }));
    window.dispatchEvent(new CustomEvent("geflow:products-updated", { detail: { businessId } }));
    window.dispatchEvent(new CustomEvent("geflow:stock-updated", { detail: { businessId } }));
  }

  return syncResult;
}

/**
 * Save / Update a product across sync engine and Supabase
 */
export async function saveSyncedProduct(
  businessId: string,
  product: Partial<SyncedProductItem>,
  userId?: string,
  isStaff = false
) {
  // 1. Post to Sync Engine
  let savedProduct: SyncedProductItem | null = null;
  try {
    const res = await fetch("/api/sync/product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, product, userId }),
    });
    if (res.ok) {
      const data = await res.json();
      savedProduct = data.product;
    }
  } catch (err) {
    console.warn("Notice saving product to sync server:", err);
  }

  // 2. Always save to Supabase
  try {
    const isUuid = (str?: string | null): boolean =>
      Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

    const payload: any = {
      ...product,
      business_id: businessId,
      owner_user_id: userId,
    };
    // Strip non-column/client-only helper fields if any
    delete payload.displayText;
    delete payload.stockStatus;

    if (product.id && isUuid(product.id)) {
      await supabase.from("products").update(payload).eq("id", product.id);
    } else {
      if (!isUuid(payload.id)) {
        delete payload.id;
      }
      await supabase.from("products").insert(payload);
    }
  } catch (supErr) {
    console.warn("Notice saving product in Supabase:", supErr);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("geflow:products-updated", { detail: { businessId } }));
  }

  return savedProduct;
}

/**
 * Adjust stock units
 */
export async function adjustSyncedStock(
  businessId: string,
  productId: string,
  deltaQuantity: number,
  type: "in" | "out",
  reason: string,
  note?: string,
  userId?: string,
  isStaff = false
) {
  let result: any = null;
  try {
    const res = await fetch("/api/sync/adjust-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        productId,
        deltaQuantity,
        type,
        reason,
        note,
        userId,
      }),
    });
    if (res.ok) {
      result = await res.json();
    }
  } catch (err) {
    console.warn("Notice adjusting stock:", err);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("geflow:products-updated", { detail: { businessId } }));
    window.dispatchEvent(new CustomEvent("geflow:stock-updated", { detail: { businessId } }));
  }

  return result;
}

/**
 * Held Orders sync methods
 */
export async function getSyncedHeldOrders(businessId: string) {
  try {
    const res = await fetch(`/api/sync/held-orders?businessId=${encodeURIComponent(businessId)}`);
    if (res.ok) {
      const data = await res.json();
      return data.heldOrders || [];
    }
  } catch {
    /* ignore */
  }
  return [];
}

export async function saveSyncedHeldOrder(businessId: string, order: any) {
  try {
    const res = await fetch("/api/sync/held-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, order }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.heldOrder;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function deleteSyncedHeldOrder(businessId: string, orderId: string) {
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
