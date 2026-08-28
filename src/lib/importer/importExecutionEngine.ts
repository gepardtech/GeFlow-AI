import { supabase } from "@/integrations/supabase/client";
import { ImportResultSummary, NormalizedProduct } from "./types";

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

  // Resolve current user if ownerUserId is missing
  let resolvedUserId = ownerUserId;
  if (!resolvedUserId) {
    const { data: authData } = await supabase.auth.getUser();
    resolvedUserId = authData?.user?.id || "";
  }

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
    currentName: "Running server-side catalog schema validation...",
    percentage: 5,
  });

  // Fetch valid categories for this business to ensure no unconfigured categories are used
  const { data: dbCategories } = await supabase
    .from("product_categories")
    .select("id, name, parent_id")
    .or(`business_id.eq.${businessId},business_id.is.null`);

  const validCategoryIds = new Set((dbCategories || []).map((c) => c.id));
  const defaultCategoryId = (dbCategories && dbCategories.length > 0) ? dbCategories[0].id : null;

  // Process in controlled batches of 15
  const BATCH_SIZE = 15;

  for (let i = 0; i < selectedProducts.length; i += BATCH_SIZE) {
    const batch = selectedProducts.slice(i, i + BATCH_SIZE);

    for (const item of batch) {
      const currentIdx = i + batch.indexOf(item) + 1;
      const progressPct = 10 + Math.round((currentIdx / (selectedProducts.length || 1)) * 85);

      onProgress?.({
        stage: "Importing",
        processed: currentIdx,
        total: selectedProducts.length,
        currentName: item.canonical.name,
        percentage: progressPct,
      });

      // Strict Validation: Product Name
      const cleanName = (item.canonical.name || item.canonical.original_name || "").trim();
      if (!cleanName) {
        summary.failed++;
        summary.errors.push({
          rowIndex: item.rowIndex,
          name: "Untitled Product",
          error: "Product Name is required and cannot be empty",
          raw: item.raw,
        });
        continue;
      }

      // Safe numeric conversions
      const purchaseCost = Math.max(0, Number(item.canonical.purchase_cost) || 0);
      const retailPrice = Math.max(0, Number(item.canonical.retail_price) || 0);
      const stockUnits = Math.max(0, parseInt(String(item.canonical.stock_units), 10) || 0);
      const minStockAlert = Math.max(1, parseInt(String(item.canonical.min_stock_alert), 10) || 10);
      const discountPrice =
        item.canonical.discount_price !== null &&
        item.canonical.discount_price !== undefined &&
        !isNaN(Number(item.canonical.discount_price))
          ? Math.max(0, Number(item.canonical.discount_price))
          : null;

      // Clean date
      let cleanExpiry: string | null = null;
      if (item.canonical.expiry_date && item.canonical.expiry_date.trim() !== "") {
        const d = new Date(item.canonical.expiry_date);
        if (!isNaN(d.getTime())) {
          cleanExpiry = item.canonical.expiry_date;
        }
      }

      // Category validation against DB
      let finalCategoryId = item.canonical.category_id;
      if (!finalCategoryId || !validCategoryIds.has(finalCategoryId)) {
        finalCategoryId = defaultCategoryId;
      }

      let finalSubcategoryId = item.canonical.subcategory_id;
      if (finalSubcategoryId && !validCategoryIds.has(finalSubcategoryId)) {
        finalSubcategoryId = null;
      }

      // Format description with UOM tag to preserve unit metadata
      let finalDescription = (item.canonical.description || "").trim();
      if (item.canonical.stock_unit) {
        if (!finalDescription.includes("[UOM:")) {
          finalDescription = finalDescription
            ? `${finalDescription}\n[UOM: ${item.canonical.stock_unit}]`
            : `[UOM: ${item.canonical.stock_unit}]`;
        }
      }

      // Handle duplicate actions
      if (item.existingProductId) {
        if (item.duplicateAction === "skip") {
          summary.skipped++;
          continue;
        }

        if (item.duplicateAction === "add_stock") {
          try {
            const addedStock = stockUnits;
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
            if (addedStock > 0 && resolvedUserId) {
              await supabase.from("stock_movements").insert({
                business_id: businessId,
                owner_user_id: resolvedUserId,
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
              name: cleanName,
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
                name: cleanName,
                internal_sku: item.canonical.internal_sku?.trim() || null,
                description: finalDescription || null,
                category_id: finalCategoryId,
                subcategory_id: finalSubcategoryId,
                purchase_cost: purchaseCost,
                retail_price: retailPrice,
                discount_price: discountPrice,
                stock_units: stockUnits,
                min_stock_alert: minStockAlert,
                batch_number: item.canonical.batch_number?.trim() || null,
                expiry_date: cleanExpiry,
                barcode: item.canonical.barcode?.trim() || null,
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
              name: cleanName,
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
          owner_user_id: resolvedUserId,
          name: cleanName,
          internal_sku: item.canonical.internal_sku?.trim() || null,
          description: finalDescription || null,
          category_id: finalCategoryId,
          subcategory_id: finalSubcategoryId,
          purchase_cost: purchaseCost,
          retail_price: retailPrice,
          discount_price: discountPrice,
          stock_units: stockUnits,
          min_stock_alert: minStockAlert,
          batch_number: item.canonical.batch_number?.trim() || null,
          expiry_date: cleanExpiry,
          barcode: item.canonical.barcode?.trim() || null,
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
        if (inserted?.id && stockUnits > 0 && resolvedUserId) {
          await supabase.from("stock_movements").insert({
            business_id: businessId,
            owner_user_id: resolvedUserId,
            product_id: inserted.id,
            quantity: stockUnits,
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
          name: cleanName,
          error: err.message || "Failed to insert product into database",
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
    currentName: "Writing import telemetry...",
    percentage: 100,
  });

  summary.durationMs = Date.now() - startTime;

  // Log batch to telemetry / import history if table exists
  try {
    if (resolvedUserId) {
      await supabase.from("import_batches").insert({
        id: batchId,
        business_id: businessId,
        owner_user_id: resolvedUserId,
        total_rows: summary.totalRows,
        imported_count: summary.imported,
        updated_count: summary.updated,
        failed_count: summary.failed,
        skipped_count: summary.skipped,
        error_log: summary.errors,
      });
    }
  } catch (err) {
    // Non-blocking telemetry error
    console.warn("Failed to write to import_batches telemetry:", err);
  }

  return summary;
};

export const downloadImportErrorReport = (errors: Array<{ rowIndex: number; name: string; error: string; raw?: Record<string, string> }>) => {
  if (!errors || errors.length === 0) return;

  const headers = ["Row Index", "Product Name", "Error Message"];
  const csvRows = [
    headers.join(","),
    ...errors.map((e) =>
      [
        e.rowIndex,
        `"${(e.name || "").replace(/"/g, '""')}"`,
        `"${(e.error || "").replace(/"/g, '""')}"`,
      ].join(",")
    ),
  ];

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `import_error_report_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

