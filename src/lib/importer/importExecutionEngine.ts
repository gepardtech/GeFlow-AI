import { supabase } from "@/integrations/supabase/client";
import { ImportResultSummary, NormalizedProduct } from "./types";
import { isUomAllowedForIndustry } from "./uomCatalog";

export interface ImportExecutionParams {
  products: NormalizedProduct[];
  businessId: string;
  ownerUserId: string;
  industryType?: string | null;
  onProgress?: (progress: {
    stage?: string;
    processed: number;
    total: number;
    currentName: string;
    percentage: number;
  }) => void;
}

export const generateImportBatchId = (): string => {
  const year = new Date().getFullYear();
  const randomSuffix = Math.random().toString(36).substring(2, 9).toUpperCase();
  return `IMP-${year}-${randomSuffix}`;
};

export const executeProductImport = async ({
  products,
  businessId,
  ownerUserId,
  industryType,
  onProgress,
}: ImportExecutionParams): Promise<ImportResultSummary> => {
  const startTime = Date.now();
  const batchId = generateImportBatchId();

  const summary: ImportResultSummary = {
    batchId,
    totalRows: products.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    durationMs: 0,
    importedProductIds: [],
  };

  const selectedProducts = products.filter((p) => p.selected && p.status !== "skipped");
  const unselectedCount = products.length - selectedProducts.length;
  summary.skipped += unselectedCount;

  // 1. Pre-validation Phase: Verify Business & Categories
  onProgress?.({
    stage: "Validating",
    processed: 0,
    total: selectedProducts.length,
    currentName: "Running final server-side schema validation...",
    percentage: 5,
  });

  // Fetch valid categories for this business to ensure no unconfigured categories are used
  const { data: dbCategories } = await supabase
    .from("product_categories")
    .select("id, name, parent_id")
    .or(`business_id.eq.${businessId},business_id.is.null`);

  const validCategoryIds = new Set((dbCategories || []).map((c) => c.id));

  // Process in controlled batches of 20
  const BATCH_SIZE = 20;

  for (let i = 0; i < selectedProducts.length; i += BATCH_SIZE) {
    const batch = selectedProducts.slice(i, i + BATCH_SIZE);

    for (const item of batch) {
      const currentIdx = i + batch.indexOf(item) + 1;
      const progressPct = 10 + Math.round((currentIdx / selectedProducts.length) * 85);

      onProgress?.({
        stage: "Importing",
        processed: currentIdx,
        total: selectedProducts.length,
        currentName: item.canonical.name,
        percentage: progressPct,
      });

      // Strict Validation: Product Name
      if (!item.canonical.name || !item.canonical.name.trim()) {
        summary.failed++;
        summary.errors.push({
          rowIndex: item.rowIndex,
          name: item.canonical.name || "Untitled Product",
          error: "Product Name is required and cannot be empty",
          raw: item.raw,
        });
        continue;
      }

      // Strict Validation: Price sanity
      if (item.canonical.retail_price < 0 || item.canonical.purchase_cost < 0) {
        summary.failed++;
        summary.errors.push({
          rowIndex: item.rowIndex,
          name: item.canonical.name,
          error: "Prices cannot be negative numbers",
          raw: item.raw,
        });
        continue;
      }

      // Category validation against DB
      let finalCategoryId = item.canonical.category_id;
      if (finalCategoryId && !validCategoryIds.has(finalCategoryId)) {
        // Unverified category ID - fallback to null
        finalCategoryId = null;
      }

      let finalSubcategoryId = item.canonical.subcategory_id;
      if (finalSubcategoryId && !validCategoryIds.has(finalSubcategoryId)) {
        finalSubcategoryId = null;
      }

      // Handle duplicate actions
      if (item.existingProductId) {
        if (item.duplicateAction === "skip") {
          summary.skipped++;
          continue;
        }

        if (item.duplicateAction === "add_stock") {
          try {
            const addedStock = item.canonical.stock_units;
            const currentStock = item.existingProductData?.stock_units ?? 0;
            const newStock = Math.max(0, currentStock + addedStock);

            const { error: updateErr } = await supabase
              .from("products")
              .update({
                stock_units: newStock,
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.existingProductId)
              .eq("business_id", businessId);

            if (updateErr) throw updateErr;

            // Record stock movement
            if (addedStock > 0) {
              await supabase.from("stock_movements").insert({
                business_id: businessId,
                owner_user_id: ownerUserId,
                product_id: item.existingProductId,
                quantity: addedStock,
                type: "in",
                reason: `Bulk import stock addition (${batchId})`,
                note: `Spreadsheet row ${item.rowIndex} [Batch: ${batchId}]`,
              });
            }

            summary.updated++;
            summary.importedProductIds.push(item.existingProductId);
          } catch (err: any) {
            summary.failed++;
            summary.errors.push({
              rowIndex: item.rowIndex,
              name: item.canonical.name,
              error: err.message || "Failed to update existing product stock",
              raw: item.raw,
            });
          }
          continue;
        }

        if (item.duplicateAction === "update") {
          try {
            const { error: updateErr } = await supabase
              .from("products")
              .update({
                name: item.canonical.name.trim(),
                internal_sku: item.canonical.internal_sku || null,
                description: item.canonical.description || null,
                category_id: finalCategoryId,
                subcategory_id: finalSubcategoryId,
                purchase_cost: item.canonical.purchase_cost || 0,
                retail_price: item.canonical.retail_price || 0,
                discount_price: item.canonical.discount_price,
                stock_units: Math.max(0, item.canonical.stock_units || 0),
                min_stock_alert: item.canonical.min_stock_alert || 10,
                batch_number: item.canonical.batch_number || null,
                expiry_date: item.canonical.expiry_date || null,
                barcode: item.canonical.barcode || null,
                status: item.canonical.status || "active",
                images: item.canonical.images || [],
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.existingProductId)
              .eq("business_id", businessId);

            if (updateErr) throw updateErr;

            summary.updated++;
            summary.importedProductIds.push(item.existingProductId);
          } catch (err: any) {
            summary.failed++;
            summary.errors.push({
              rowIndex: item.rowIndex,
              name: item.canonical.name,
              error: err.message || "Failed to update existing product",
              raw: item.raw,
            });
          }
          continue;
        }
      }

      // Handle insertion of new product
      try {
        const insertPayload = {
          business_id: businessId,
          owner_user_id: ownerUserId,
          name: item.canonical.name.trim(),
          internal_sku: item.canonical.internal_sku || null,
          description: item.canonical.description || null,
          category_id: finalCategoryId,
          subcategory_id: finalSubcategoryId,
          purchase_cost: item.canonical.purchase_cost || 0,
          retail_price: item.canonical.retail_price || 0,
          discount_price: item.canonical.discount_price,
          stock_units: Math.max(0, item.canonical.stock_units || 0),
          min_stock_alert: item.canonical.min_stock_alert || 10,
          batch_number: item.canonical.batch_number || null,
          expiry_date: item.canonical.expiry_date || null,
          barcode: item.canonical.barcode || null,
          status: item.canonical.status || "active",
          images: item.canonical.images || [],
        };

        const { data: inserted, error: insertErr } = await supabase
          .from("products")
          .insert(insertPayload)
          .select("id")
          .single();

        if (insertErr) throw insertErr;

        // Record initial stock movement if quantity > 0
        if (inserted?.id && item.canonical.stock_units > 0) {
          await supabase.from("stock_movements").insert({
            business_id: businessId,
            owner_user_id: ownerUserId,
            product_id: inserted.id,
            quantity: item.canonical.stock_units,
            type: "in",
            reason: `Initial bulk import (${batchId})`,
            note: `Spreadsheet row ${item.rowIndex} [Batch: ${batchId}]`,
          });
        }

        summary.imported++;
        if (inserted?.id) {
          summary.importedProductIds.push(inserted.id);
        }
      } catch (err: any) {
        summary.failed++;
        summary.errors.push({
          rowIndex: item.rowIndex,
          name: item.canonical.name,
          error: err.message || "Failed to insert product",
          raw: item.raw,
        });
      }
    }
  }

  // Finalizing Phase
  onProgress?.({
    stage: "Finalizing",
    processed: selectedProducts.length,
    total: selectedProducts.length,
    currentName: "Writing import history and telemetry...",
    percentage: 100,
  });

  summary.durationMs = Date.now() - startTime;
  return summary;
};

/**
 * Generates and downloads a CSV error report for any failed rows.
 */
export const downloadImportErrorReport = (errors: ImportResultSummary["errors"]) => {
  if (!errors || errors.length === 0) return;

  let csvContent = "Row Number,Product Name,Error Reason,Raw Data\n";
  for (const err of errors) {
    const safeName = `"${(err.name || "Unknown").replace(/"/g, '""')}"`;
    const safeError = `"${(err.error || "").replace(/"/g, '""')}"`;
    const safeRaw = `"${JSON.stringify(err.raw || {}).replace(/"/g, '""')}"`;
    csvContent += `${err.rowIndex},${safeName},${safeError},${safeRaw}\n`;
  }

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `import_errors_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
