import { supabase } from "@/integrations/supabase/client";

export interface StockMovementInput {
  product_id: string;
  business_id: string;
  owner_user_id?: string;
  quantity: number; // ALWAYS in Base Units (can be positive for in/return or positive count)
  type: "in" | "out" | "adjustment" | "transfer" | "waste" | "return";
  reason?: string;
  note?: string;
  reference_id?: string;
  reference_type?: "pos_sale" | "purchase_intake" | "manual_adjustment" | "bulk_import" | "branch_transfer";
  created_by?: string;
}

export interface StockMovementRecord {
  id: string;
  product_id: string;
  business_id: string;
  owner_user_id: string;
  quantity: number;
  type: string;
  reason: string | null;
  note: string | null;
  reference_id: string | null;
  reference_type: string | null;
  created_by: string | null;
  created_at: string;
  products?: {
    name: string;
    internal_sku: string | null;
    barcode: string | null;
    uom?: string | null;
    units_per_uom?: number | null;
    base_unit?: string | null;
  };
}

/**
 * Record a guaranteed stock movement in Base Units into `stock_movements`.
 * Handles resilient column additions (reference_id, reference_type, created_by).
 */
export async function recordStockMovement(movement: StockMovementInput): Promise<boolean> {
  if (!movement.product_id || !movement.business_id) return false;

  let ownerId = movement.owner_user_id;
  if (!ownerId) {
    const { data: authData } = await supabase.auth.getUser();
    ownerId = authData?.user?.id || "";
  }

  const payload: any = {
    product_id: movement.product_id,
    business_id: movement.business_id,
    owner_user_id: ownerId,
    quantity: Math.round(Number(movement.quantity) || 0),
    type: movement.type,
    reason: movement.reason || null,
    note: movement.note || null,
    created_at: new Date().toISOString(),
  };

  // Attempt with enhanced schema
  try {
    const enhancedPayload = {
      ...payload,
      reference_id: movement.reference_id || null,
      reference_type: movement.reference_type || null,
      created_by: movement.created_by || ownerId || null,
    };

    const { error } = await supabase.from("stock_movements").insert(enhancedPayload);
    if (!error) return true;

    // Fallback if reference columns not yet migrated
    const { error: fallbackErr } = await supabase.from("stock_movements").insert(payload);
    if (!fallbackErr) return true;
    console.error("Failed to insert stock_movement:", fallbackErr);
    return false;
  } catch (err) {
    console.error("Error inserting stock movement:", err);
    return false;
  }
}

/**
 * Fetch complete stock ledger history for a business.
 */
export async function fetchStockLedger(
  businessId: string,
  options?: {
    productId?: string;
    movementType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): Promise<StockMovementRecord[]> {
  if (!businessId) return [];

  try {
    let query = supabase
      .from("stock_movements")
      .select("*, products(name, internal_sku, barcode, uom, units_per_uom, base_unit)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (options?.productId && options.productId !== "all") {
      query = query.eq("product_id", options.productId);
    }

    if (options?.movementType && options.movementType !== "all") {
      query = query.eq("type", options.movementType);
    }

    if (options?.startDate) {
      query = query.gte("created_at", options.startDate);
    }

    if (options?.endDate) {
      query = query.lte("created_at", options.endDate);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(300);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("Could not fetch stock ledger with joins:", error);
      // Fallback query without product join
      const fallback = await supabase
        .from("stock_movements")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(options?.limit || 300);
      return (fallback.data as any) || [];
    }

    return (data as any) || [];
  } catch (err) {
    console.error("Error fetching stock movements:", err);
    return [];
  }
}
