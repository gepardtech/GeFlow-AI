import { supabase } from "@/integrations/supabase/client";
import { NormalizedProduct } from "./types";

export interface ExistingProductSummary {
  id: string;
  name: string;
  internal_sku: string | null;
  barcode: string | null;
  stock_units: number;
  purchase_cost: number;
  retail_price: number;
  category_id: string | null;
}

/**
 * Checks for duplicate rows within the uploaded file itself.
 */
export const detectInFileDuplicates = (products: NormalizedProduct[]): NormalizedProduct[] => {
  const seenBarcodes = new Map<string, number>(); // barcode -> first seen index
  const seenSkus = new Map<string, number>(); // sku -> first seen index

  return products.map((p, idx) => {
    let isDupe = false;
    const dupeWarnings: string[] = [...p.warnings];

    if (p.canonical.barcode) {
      const code = p.canonical.barcode.toLowerCase();
      if (seenBarcodes.has(code)) {
        isDupe = true;
        dupeWarnings.push(`Duplicate barcode "${p.canonical.barcode}" found in row ${products[seenBarcodes.get(code)!].rowIndex}`);
      } else {
        seenBarcodes.set(code, idx);
      }
    }

    if (p.canonical.internal_sku && !isDupe) {
      const sku = p.canonical.internal_sku.toLowerCase();
      if (seenSkus.has(sku)) {
        isDupe = true;
        dupeWarnings.push(`Duplicate SKU "${p.canonical.internal_sku}" found in row ${products[seenSkus.get(sku)!].rowIndex}`);
      } else {
        seenSkus.set(sku, idx);
      }
    }

    if (isDupe && p.status !== "error") {
      return {
        ...p,
        isDuplicateInFile: true,
        status: "duplicate",
        warnings: dupeWarnings,
        duplicateAction: "skip",
      };
    }

    return {
      ...p,
      warnings: dupeWarnings,
    };
  });
};

/**
 * Queries database for existing products in the active business and correlates with uploaded products.
 */
export const correlateWithExistingDatabaseProducts = async (
  products: NormalizedProduct[],
  businessId: string
): Promise<NormalizedProduct[]> => {
  if (!businessId || products.length === 0) return products;

  // Collect all barcodes and SKUs to query
  const barcodes = products
    .map((p) => p.canonical.barcode)
    .filter((b): b is string => !!b && b.trim() !== "");
  const skus = products
    .map((p) => p.canonical.internal_sku)
    .filter((s): s is string => !!s && s.trim() !== "");
  const names = products
    .map((p) => p.canonical.name)
    .filter((n): n is string => !!n && n.trim() !== "");

  // Query existing products for this business
  const { data: dbProducts, error } = await supabase
    .from("products")
    .select("id, name, internal_sku, barcode, stock_units, purchase_cost, retail_price, category_id")
    .eq("business_id", businessId);

  if (error || !dbProducts) {
    console.error("Error checking existing products:", error);
    return products;
  }

  const byBarcode = new Map<string, ExistingProductSummary>();
  const bySku = new Map<string, ExistingProductSummary>();
  const byName = new Map<string, ExistingProductSummary>();

  for (const item of dbProducts as ExistingProductSummary[]) {
    if (item.barcode) byBarcode.set(item.barcode.toLowerCase(), item);
    if (item.internal_sku) bySku.set(item.internal_sku.toLowerCase(), item);
    if (item.name) byName.set(item.name.toLowerCase().trim(), item);
  }

  return products.map((p) => {
    let match: ExistingProductSummary | null = null;
    let matchReason = "";

    // 1. Match by Global Barcode (Highest priority)
    if (p.canonical.barcode && byBarcode.has(p.canonical.barcode.toLowerCase())) {
      match = byBarcode.get(p.canonical.barcode.toLowerCase())!;
      matchReason = `Existing product found with barcode "${p.canonical.barcode}"`;
    }
    // 2. Match by SKU
    else if (p.canonical.internal_sku && bySku.has(p.canonical.internal_sku.toLowerCase())) {
      match = bySku.get(p.canonical.internal_sku.toLowerCase())!;
      matchReason = `Existing product found with SKU "${p.canonical.internal_sku}"`;
    }
    // 3. Match by exact Name (Lower priority signal)
    else if (p.canonical.name && byName.has(p.canonical.name.toLowerCase().trim())) {
      const candidate = byName.get(p.canonical.name.toLowerCase().trim())!;
      // Only treat name as duplicate if either no barcodes/skus were provided or they match
      if (!p.canonical.barcode && !p.canonical.internal_sku) {
        match = candidate;
        matchReason = `Existing product found with exact name "${candidate.name}"`;
      }
    }

    if (match) {
      const warnings = [...p.warnings];
      warnings.push(matchReason);

      return {
        ...p,
        existingProductId: match.id,
        existingProductData: match,
        status: p.status === "error" ? "error" : "duplicate",
        duplicateAction: "skip", // Default safe option
        warnings,
      };
    }

    return p;
  });
};
