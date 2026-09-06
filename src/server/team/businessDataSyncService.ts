import fs from "fs";
import path from "path";

export interface SyncedProduct {
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
  created_at: string;
  updated_at: string;
}

export interface SyncedSale {
  id: string;
  business_id: string;
  owner_user_id?: string;
  total: number;
  profit: number;
  status: string;
  processed_by?: string;
  created_at: string;
}

export interface SyncedSaleItem {
  id: string;
  sale_id: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  owner_user_id?: string;
  created_at: string;
}

export interface SyncedStockMovement {
  id: string;
  business_id: string;
  product_id: string;
  owner_user_id?: string;
  type: string;
  quantity: number;
  reason?: string | null;
  note?: string | null;
  reference_id?: string | null;
  reference_type?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface SyncedHeldOrder {
  id: string;
  business_id: string;
  owner_user_id?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_note?: string | null;
  cart_data: any[];
  total_amount: number;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessDataUnit {
  businessId: string;
  businessName?: string;
  ownerUserId?: string;
  products: SyncedProduct[];
  sales: SyncedSale[];
  sale_items: SyncedSaleItem[];
  stock_movements: SyncedStockMovement[];
  held_orders: SyncedHeldOrder[];
  purchases: any[];
  purchase_items: any[];
  categories: any[];
  lastSyncedAt: string;
}

interface DataStoreSchema {
  businesses: Record<string, BusinessDataUnit>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "business_data_store.json");

export class BusinessDataSyncService {
  private store: DataStoreSchema;

  constructor() {
    this.store = this.loadStorage();
  }

  private loadStorage(): DataStoreSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        const businesses = parsed.businesses || {};
        // Purge any legacy fake coffee products
        Object.keys(businesses).forEach((bizId) => {
          if (businesses[bizId] && Array.isArray(businesses[bizId].products)) {
            businesses[bizId].products = businesses[bizId].products.filter(
              (p: any) =>
                !p.id?.startsWith("prod_espresso") &&
                !p.id?.startsWith("prod_latte") &&
                !p.id?.startsWith("prod_croissant") &&
                !p.id?.startsWith("prod_tea") &&
                !p.id?.startsWith("prod_cup") &&
                p.name !== "Organic Espresso Roast" &&
                p.name !== "Caramel Macchiato Syrup" &&
                p.name !== "Butter Croissant (Pack of 4)" &&
                p.name !== "Earl Grey Reserve Loose Leaf" &&
                p.name !== "Ceramic Artisan Mug 12oz"
            );
          }
        });
        return {
          businesses,
        };
      }
    } catch (err) {
      console.warn("Notice reading business data storage, initializing fresh store:", err);
    }
    return { businesses: {} };
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.store, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to persist business data store:", err);
    }
  }

  public getOrCreateBusinessUnit(businessId: string, ownerUserId?: string, businessName?: string): BusinessDataUnit {
    if (!this.store.businesses[businessId]) {
      this.store.businesses[businessId] = {
        businessId,
        businessName: businessName || "Store",
        ownerUserId: ownerUserId || "",
        products: [],
        sales: [],
        sale_items: [],
        stock_movements: [],
        held_orders: [],
        purchases: [],
        purchase_items: [],
        categories: [],
        lastSyncedAt: new Date().toISOString(),
      };
      this.persist();
    } else {
      if (ownerUserId && !this.store.businesses[businessId].ownerUserId) {
        this.store.businesses[businessId].ownerUserId = ownerUserId;
      }
      if (businessName) {
        this.store.businesses[businessId].businessName = businessName;
      }
      // Ensure no mock coffee items exist
      if (Array.isArray(this.store.businesses[businessId].products)) {
        this.store.businesses[businessId].products = this.store.businesses[businessId].products.filter(
          (p: any) =>
            !p.id?.startsWith("prod_espresso") &&
            !p.id?.startsWith("prod_latte") &&
            !p.id?.startsWith("prod_croissant") &&
            !p.id?.startsWith("prod_tea") &&
            !p.id?.startsWith("prod_cup") &&
            p.name !== "Organic Espresso Roast" &&
            p.name !== "Caramel Macchiato Syrup" &&
            p.name !== "Butter Croissant (Pack of 4)" &&
            p.name !== "Earl Grey Reserve Loose Leaf" &&
            p.name !== "Ceramic Artisan Mug 12oz"
        );
      }
    }
    return this.store.businesses[businessId];
  }

  /**
   * Return synced operational data filtered by role
   */
  public getBusinessData(businessId: string, role?: string): {
    success: boolean;
    businessId: string;
    role: string;
    products: SyncedProduct[];
    sales: SyncedSale[];
    sale_items: SyncedSaleItem[];
    stock_movements: SyncedStockMovement[];
    held_orders: SyncedHeldOrder[];
    purchases: any[];
    purchase_items: any[];
    categories: any[];
  } {
    const unit = this.getOrCreateBusinessUnit(businessId);
    const cleanRole = (role || "manager").toLowerCase();

    // Role-based tailoring:
    // 1. Cashier: needs products (active catalog), sales (for receipts/daily reconciliation), held_orders
    if (cleanRole === "cashier") {
      return {
        success: true,
        businessId,
        role: cleanRole,
        products: unit.products.filter((p) => p.status === "active" || p.status === "low_stock"),
        sales: unit.sales,
        sale_items: unit.sale_items,
        stock_movements: unit.stock_movements.slice(0, 50),
        held_orders: unit.held_orders,
        purchases: [],
        purchase_items: [],
        categories: unit.categories,
      };
    }

    // 2. Inventory Clerk: needs all products, stock ledger (movements), purchases, purchase items
    if (cleanRole === "inventory") {
      return {
        success: true,
        businessId,
        role: cleanRole,
        products: unit.products,
        sales: [],
        sale_items: [],
        stock_movements: unit.stock_movements,
        held_orders: [],
        purchases: unit.purchases,
        purchase_items: unit.purchase_items,
        categories: unit.categories,
      };
    }

    // 3. Manager / Owner / Admin: Full access
    return {
      success: true,
      businessId,
      role: cleanRole,
      products: unit.products,
      sales: unit.sales,
      sale_items: unit.sale_items,
      stock_movements: unit.stock_movements,
      held_orders: unit.held_orders,
      purchases: unit.purchases,
      purchase_items: unit.purchase_items,
      categories: unit.categories,
    };
  }

  /**
   * Ingest a batch sync from owner/client (e.g. Supabase data or local master catalog)
   */
  public syncBatch(
    businessId: string,
    payload: {
      products?: SyncedProduct[];
      sales?: SyncedSale[];
      sale_items?: SyncedSaleItem[];
      stock_movements?: SyncedStockMovement[];
      held_orders?: SyncedHeldOrder[];
      purchases?: any[];
      purchase_items?: any[];
      categories?: any[];
      ownerUserId?: string;
      businessName?: string;
    }
  ): { success: boolean; syncedCounts: Record<string, number> } {
    const unit = this.getOrCreateBusinessUnit(businessId, payload.ownerUserId, payload.businessName);
    const now = new Date().toISOString();

    let pCount = 0;
    if (Array.isArray(payload.products) && payload.products.length > 0) {
      payload.products.forEach((p) => {
        const idx = unit.products.findIndex((existing) => existing.id === p.id);
        const normalized: SyncedProduct = {
          ...p,
          business_id: businessId,
          owner_user_id: p.owner_user_id || unit.ownerUserId || payload.ownerUserId,
          purchase_cost: Number(p.purchase_cost) || 0,
          retail_price: Number(p.retail_price) || 0,
          stock_units: Number(p.stock_units) || 0,
          min_stock_alert: Number(p.min_stock_alert) || 5,
          status: p.status || "active",
          created_at: p.created_at || now,
          updated_at: p.updated_at || now,
        };
        if (idx >= 0) {
          unit.products[idx] = normalized;
        } else {
          unit.products.push(normalized);
        }
        pCount++;
      });
    }

    let sCount = 0;
    if (Array.isArray(payload.sales) && payload.sales.length > 0) {
      payload.sales.forEach((s) => {
        const idx = unit.sales.findIndex((existing) => existing.id === s.id);
        const normalized: SyncedSale = {
          ...s,
          business_id: businessId,
          owner_user_id: s.owner_user_id || unit.ownerUserId,
          total: Number(s.total) || 0,
          profit: Number(s.profit) || 0,
          status: s.status || "completed",
          created_at: s.created_at || now,
        };
        if (idx >= 0) {
          unit.sales[idx] = normalized;
        } else {
          unit.sales.push(normalized);
        }
        sCount++;
      });
    }

    let iCount = 0;
    if (Array.isArray(payload.sale_items) && payload.sale_items.length > 0) {
      payload.sale_items.forEach((item) => {
        const idx = unit.sale_items.findIndex((existing) => existing.id === item.id);
        if (idx >= 0) {
          unit.sale_items[idx] = { ...unit.sale_items[idx], ...item };
        } else {
          unit.sale_items.push({
            id: item.id || `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            sale_id: item.sale_id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: Number(item.quantity) || 1,
            unit_price: Number(item.unit_price) || 0,
            unit_cost: Number(item.unit_cost) || 0,
            created_at: item.created_at || now,
          });
        }
        iCount++;
      });
    }

    let mCount = 0;
    if (Array.isArray(payload.stock_movements) && payload.stock_movements.length > 0) {
      payload.stock_movements.forEach((sm) => {
        const idx = unit.stock_movements.findIndex((existing) => existing.id === sm.id);
        if (idx >= 0) {
          unit.stock_movements[idx] = { ...unit.stock_movements[idx], ...sm };
        } else {
          unit.stock_movements.push(sm);
        }
        mCount++;
      });
    }

    if (Array.isArray(payload.categories) && payload.categories.length > 0) {
      unit.categories = payload.categories;
    }

    unit.lastSyncedAt = now;
    this.persist();

    return {
      success: true,
      syncedCounts: {
        products: pCount,
        sales: sCount,
        sale_items: iCount,
        stock_movements: mCount,
      },
    };
  }

  /**
   * Save (insert or update) a product
   */
  public saveProduct(businessId: string, product: Partial<SyncedProduct>, userId?: string): SyncedProduct {
    const unit = this.getOrCreateBusinessUnit(businessId);
    const now = new Date().toISOString();

    const productId = product.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const existingIndex = unit.products.findIndex((p) => p.id === productId);

    let finalProduct: SyncedProduct;

    if (existingIndex >= 0) {
      const prev = unit.products[existingIndex];
      finalProduct = {
        ...prev,
        ...product,
        id: productId,
        business_id: businessId,
        purchase_cost: product.purchase_cost !== undefined ? Number(product.purchase_cost) : prev.purchase_cost,
        retail_price: product.retail_price !== undefined ? Number(product.retail_price) : prev.retail_price,
        stock_units: product.stock_units !== undefined ? Number(product.stock_units) : prev.stock_units,
        updated_at: now,
      };
      unit.products[existingIndex] = finalProduct;

      // Check for stock adjustment
      const delta = finalProduct.stock_units - prev.stock_units;
      if (delta !== 0) {
        unit.stock_movements.unshift({
          id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          business_id: businessId,
          product_id: productId,
          owner_user_id: unit.ownerUserId,
          type: delta > 0 ? "in" : "out",
          quantity: Math.abs(delta),
          reason: "Manual Stock Adjustment",
          note: `Stock changed from ${prev.stock_units} to ${finalProduct.stock_units}`,
          created_by: userId,
          created_at: now,
        });
      }
    } else {
      finalProduct = {
        id: productId,
        business_id: businessId,
        owner_user_id: unit.ownerUserId || userId,
        name: product.name || "Untitled Product",
        description: product.description || null,
        internal_sku: product.internal_sku || null,
        barcode: product.barcode || null,
        category_id: product.category_id || null,
        subcategory_id: product.subcategory_id || null,
        purchase_cost: Number(product.purchase_cost) || 0,
        retail_price: Number(product.retail_price) || 0,
        discount_price: product.discount_price ? Number(product.discount_price) : null,
        stock_units: Number(product.stock_units) || 0,
        min_stock_alert: Number(product.min_stock_alert) || 5,
        batch_number: product.batch_number || null,
        expiry_date: product.expiry_date || null,
        status: product.status || "active",
        images: product.images || [],
        uom: product.uom || null,
        units_per_uom: product.units_per_uom || null,
        base_unit: product.base_unit || null,
        created_at: now,
        updated_at: now,
      };
      unit.products.unshift(finalProduct);

      if (finalProduct.stock_units > 0) {
        unit.stock_movements.unshift({
          id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          business_id: businessId,
          product_id: productId,
          owner_user_id: unit.ownerUserId,
          type: "in",
          quantity: finalProduct.stock_units,
          reason: "Initial Stock",
          note: `New product intake of ${finalProduct.stock_units} units`,
          created_by: userId,
          created_at: now,
        });
      }
    }

    unit.lastSyncedAt = now;
    this.persist();
    return finalProduct;
  }

  /**
   * Delete product
   */
  public deleteProduct(businessId: string, productId: string): boolean {
    const unit = this.getOrCreateBusinessUnit(businessId);
    const prevLen = unit.products.length;
    unit.products = unit.products.filter((p) => p.id !== productId);
    if (unit.products.length !== prevLen) {
      this.persist();
      return true;
    }
    return false;
  }

  /**
   * Record a sale checkout from POS (Cashier, Manager, or Owner)
   * Automatically deducts product stock units and registers stock movements!
   */
  public recordSale(
    businessId: string,
    payload: {
      sale: {
        id?: string;
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
      }[];
      cashierName?: string;
      userId?: string;
    }
  ): {
    success: boolean;
    sale: SyncedSale;
    items: SyncedSaleItem[];
    updatedProducts: { id: string; stock_units: number }[];
  } {
    const unit = this.getOrCreateBusinessUnit(businessId);
    const now = new Date().toISOString();

    const saleId = payload.sale.id || `sale_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const processedBy = payload.cashierName || payload.sale.processed_by || "POS Cashier";

    let totalProfit = 0;
    const saleItemsList: SyncedSaleItem[] = [];
    const updatedProducts: { id: string; stock_units: number }[] = [];

    // Process each line item and deduct stock
    for (const item of payload.items) {
      const unitCost = Number(item.unit_cost) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const qty = Number(item.quantity) || 1;
      const profit = (unitPrice - unitCost) * qty;
      totalProfit += profit;

      const saleItemId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const savedItem: SyncedSaleItem = {
        id: saleItemId,
        sale_id: saleId,
        product_id: item.product_id || null,
        product_name: item.product_name,
        quantity: qty,
        unit_price: unitPrice,
        unit_cost: unitCost,
        owner_user_id: unit.ownerUserId,
        created_at: now,
      };
      saleItemsList.push(savedItem);
      unit.sale_items.push(savedItem);

      // Deduct inventory stock
      if (item.product_id) {
        const prodIndex = unit.products.findIndex((p) => p.id === item.product_id);
        if (prodIndex >= 0) {
          const prod = unit.products[prodIndex];
          const deductionUnits = item.deductionUnits !== undefined ? item.deductionUnits : qty;
          const newStock = Math.max(0, prod.stock_units - deductionUnits);
          unit.products[prodIndex] = {
            ...prod,
            stock_units: newStock,
            updated_at: now,
          };
          updatedProducts.push({ id: prod.id, stock_units: newStock });

          // Record stock movement
          unit.stock_movements.unshift({
            id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            business_id: businessId,
            product_id: prod.id,
            owner_user_id: unit.ownerUserId,
            type: "out",
            quantity: deductionUnits,
            reason: "POS Sale",
            note: `Sold via POS by ${processedBy} (Sale ${saleId.slice(0, 8)})`,
            reference_id: saleId,
            reference_type: "pos_sale",
            created_by: payload.userId,
            created_at: now,
          });
        }
      }
    }

    const savedSale: SyncedSale = {
      id: saleId,
      business_id: businessId,
      owner_user_id: unit.ownerUserId || payload.userId,
      total: Number(payload.sale.total) || 0,
      profit: payload.sale.profit !== undefined ? Number(payload.sale.profit) : totalProfit,
      status: payload.sale.status || "completed",
      processed_by: processedBy,
      created_at: now,
    };

    unit.sales.unshift(savedSale);
    unit.lastSyncedAt = now;
    this.persist();

    return {
      success: true,
      sale: savedSale,
      items: saleItemsList,
      updatedProducts,
    };
  }

  /**
   * Adjust stock for a single product
   */
  public adjustStock(
    businessId: string,
    productId: string,
    deltaQuantity: number,
    type: "in" | "out",
    reason: string,
    note?: string,
    userId?: string
  ): { success: boolean; newStock: number } {
    const unit = this.getOrCreateBusinessUnit(businessId);
    const prodIndex = unit.products.findIndex((p) => p.id === productId);
    if (prodIndex < 0) {
      return { success: false, newStock: 0 };
    }

    const prod = unit.products[prodIndex];
    const now = new Date().toISOString();
    const qty = Math.abs(deltaQuantity);
    const newStock = type === "in" ? prod.stock_units + qty : Math.max(0, prod.stock_units - qty);

    unit.products[prodIndex] = {
      ...prod,
      stock_units: newStock,
      updated_at: now,
    };

    unit.stock_movements.unshift({
      id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      business_id: businessId,
      product_id: productId,
      owner_user_id: unit.ownerUserId,
      type,
      quantity: qty,
      reason: reason || (type === "in" ? "Restock Intake" : "Stock Adjustment"),
      note: note || `Adjusted stock by ${type === "in" ? "+" : "-"}${qty}`,
      created_by: userId,
      created_at: now,
    });

    unit.lastSyncedAt = now;
    this.persist();
    return { success: true, newStock };
  }

  /**
   * Held Orders (POS Cart Hold / Resume)
   */
  public saveHeldOrder(businessId: string, order: Partial<SyncedHeldOrder>): SyncedHeldOrder {
    const unit = this.getOrCreateBusinessUnit(businessId);
    const now = new Date().toISOString();
    const orderId = order.id || `held_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const saved: SyncedHeldOrder = {
      id: orderId,
      business_id: businessId,
      owner_user_id: unit.ownerUserId,
      customer_name: order.customer_name || null,
      customer_phone: order.customer_phone || null,
      customer_note: order.customer_note || null,
      cart_data: order.cart_data || [],
      total_amount: Number(order.total_amount) || 0,
      item_count: Number(order.item_count) || 0,
      created_at: order.created_at || now,
      updated_at: now,
    };

    const idx = unit.held_orders.findIndex((h) => h.id === orderId);
    if (idx >= 0) {
      unit.held_orders[idx] = saved;
    } else {
      unit.held_orders.unshift(saved);
    }

    this.persist();
    return saved;
  }

  public deleteHeldOrder(businessId: string, orderId: string): boolean {
    const unit = this.getOrCreateBusinessUnit(businessId);
    const prev = unit.held_orders.length;
    unit.held_orders = unit.held_orders.filter((h) => h.id !== orderId);
    if (unit.held_orders.length !== prev) {
      this.persist();
      return true;
    }
    return false;
  }
}

export const businessDataSyncService = new BusinessDataSyncService();
