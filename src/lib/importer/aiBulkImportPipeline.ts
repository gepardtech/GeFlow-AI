/**
 * GEFLOW AI — BULK IMPORT AI PIPELINE (PHASE 12)
 *
 * Integrates AI Product Intelligence with Bulk Import:
 * 1. Column Detection & Normalization
 * 2. Product Intelligence Extraction (Batched & Deduplicated)
 * 3. Admin Category Matching & Verification (No Auto-Create)
 * 4. Subcategory Tree Validation
 * 5. Business Category UOM Resolution
 * 6. Packaging & Stock Separation
 * 7. Value Normalization (Prices, Barcodes, Dates)
 * 8. Field-Level & Row-Level Confidence Scoring
 * 9. Review & Error Flagging
 */

import { ColumnMapping, NormalizedProduct, RowStatus } from "./types";
import {
  normalizeBarcode,
  normalizeDate,
  normalizeDiscount,
  normalizeImages,
  normalizePrice,
  normalizeQuantity,
} from "./normalizationEngine";
import { requestProductAnalysis } from "@/lib/ai/aiServiceClient";
import { BusinessCatalogContext } from "@/server/ai/types";
import { CategoryValidationContext, ProductSuggestion } from "@/types/aiProductIntelligence";
import { evaluateProductSuggestionConfidence } from "@/lib/ai/confidenceEvaluator";
import { CONFIDENCE_THRESHOLDS } from "@/lib/ai/confidenceThresholds";

export interface CategoryLookupItem {
  id: string;
  name: string;
  parent_id: string | null;
  slug?: string;
}

export interface AIBulkPipelineOptions {
  mappings: ColumnMapping[];
  dataRows: string[][];
  headerRowIndex: number;
  existingCategories: CategoryLookupItem[];
  businessContext: BusinessCatalogContext;
  onProgress?: (progress: {
    stage: string;
    current: number;
    total: number;
    percentage: number;
    currentName?: string;
  }) => void;
}

/**
 * Standard business allowed UOMs fallback if business catalog does not specify
 */
const DEFAULT_ALLOWED_UOMS: Record<string, string[]> = {
  pharmacy: [
    "tablet", "capsule", "syrup", "bottle", "strip", "box", "pack", "vial",
    "ampoule", "tube", "sachet", "drop", "inhaler", "piece", "patch", "cream"
  ],
  retail: [
    "piece", "pack", "box", "kg", "gram", "liter", "ml", "bottle", "can",
    "packet", "bag", "carton", "pair", "set", "dozen", "meter", "roll"
  ],
  grocery: [
    "kg", "gram", "liter", "ml", "piece", "pack", "box", "bag", "bottle",
    "can", "jar", "pouch", "packet", "carton", "dozen"
  ],
  electronics: [
    "piece", "unit", "box", "pack", "set", "pair", "meter", "roll", "kit"
  ],
  general: [
    "piece", "unit", "pack", "box", "kg", "gram", "liter", "ml", "bottle",
    "can", "bag", "carton", "set", "pair", "item"
  ],
};

/**
 * Fuzzy matching helper for categories
 */
function findBestCategoryMatch(
  query: string,
  categories: CategoryLookupItem[]
): { category: CategoryLookupItem | null; confidence: number; isExact: boolean } {
  if (!query || query.trim() === "") {
    return { category: null, confidence: 0, isExact: false };
  }

  const cleanQuery = query.toLowerCase().trim();

  // 1. Exact Name match
  const exact = categories.find((c) => c.name.toLowerCase().trim() === cleanQuery);
  if (exact) {
    return { category: exact, confidence: 1.0, isExact: true };
  }

  // 2. Slug match
  const slugMatch = categories.find(
    (c) => c.slug && c.slug.toLowerCase().trim() === cleanQuery.replace(/\s+/g, "-")
  );
  if (slugMatch) {
    return { category: slugMatch, confidence: 0.95, isExact: true };
  }

  // 3. Normalized plural/singular match (e.g. "Pain Killers" vs "Pain Killer")
  const strippedQuery = cleanQuery.replace(/s$/i, "").replace(/killers/i, "relief");
  const normalizedMatch = categories.find((c) => {
    const cName = c.name.toLowerCase().trim();
    return (
      cName.includes(cleanQuery) ||
      cleanQuery.includes(cName) ||
      cName.includes(strippedQuery) ||
      strippedQuery.includes(cName)
    );
  });

  if (normalizedMatch) {
    return { category: normalizedMatch, confidence: 0.85, isExact: false };
  }

  return { category: null, confidence: 0, isExact: false };
}

/**
 * Executes the full AI-powered Bulk Import processing pipeline.
 */
export async function runAIBulkProductPipeline({
  mappings,
  dataRows,
  headerRowIndex,
  existingCategories,
  businessContext,
  onProgress,
}: AIBulkPipelineOptions): Promise<NormalizedProduct[]> {
  const startTime = Date.now();

  // 1. Build lookup tables for Admin Categories
  const primaryCategories = existingCategories.filter((c) => !c.parent_id);
  const subcategoryMap = new Map<string, CategoryLookupItem[]>();

  for (const cat of existingCategories) {
    if (cat.parent_id) {
      const list = subcategoryMap.get(cat.parent_id) || [];
      list.push(cat);
      subcategoryMap.set(cat.parent_id, list);
    }
  }

  // Determine allowed UOM list based on business industry type
  const industryKey = (businessContext.industryType || "general").toLowerCase();
  const allowedUOMs =
    businessContext.allowedStockUnits && businessContext.allowedStockUnits.length > 0
      ? businessContext.allowedStockUnits.map((u) => u.toLowerCase().trim())
      : DEFAULT_ALLOWED_UOMS[industryKey] || DEFAULT_ALLOWED_UOMS["general"];

  // Index mapped columns
  const colByField = new Map<string, number>();
  const metadataCols: number[] = [];

  for (const m of mappings) {
    if (m.mappedField === "ignore") continue;
    if (m.mappedField === "metadata") {
      metadataCols.push(m.columnIndex);
    } else {
      colByField.set(m.mappedField, m.columnIndex);
    }
  }

  const nameIdx = colByField.get("name");
  const skuIdx = colByField.get("internal_sku");
  const costIdx = colByField.get("purchase_cost");
  const priceIdx = colByField.get("retail_price");
  const discIdx = colByField.get("discount_price");
  const stockIdx = colByField.get("stock_units");
  const alertIdx = colByField.get("min_stock_alert");
  const catIdx = colByField.get("category");
  const subcatIdx = colByField.get("subcategory");
  const uomIdx = colByField.get("uom");
  const pkgIdx = colByField.get("packaging");
  const packSizeIdx = colByField.get("pack_size");
  const strengthIdx = colByField.get("strength");
  const brandIdx = colByField.get("brand");
  const barcodeIdx = colByField.get("barcode");
  const batchIdx = colByField.get("batch_number");
  const expiryIdx = colByField.get("expiry_date");
  const imagesIdx = colByField.get("images");
  const statusIdx = colByField.get("status");

  // 2. Pre-parse rows and collect unique product texts for batched AI analysis
  interface ParsedRowInfo {
    rowIndex: number;
    raw: Record<string, string>;
    rawName: string;
    rawSku: string;
    rawCost: string;
    rawPrice: string;
    rawDisc: string;
    rawStock: string;
    rawAlert: string;
    rawCat: string;
    rawSubcat: string;
    rawUom: string;
    rawPkg: string;
    rawPackSize: string;
    rawStrength: string;
    rawBrand: string;
    rawBarcode: string;
    rawBatch: string;
    rawExpiry: string;
    rawImages: string;
    rawStatus: string;
    metadataJson: Record<string, any>;
  }

  const validParsedRows: ParsedRowInfo[] = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    if (!row || row.every((c) => !c || c.trim() === "")) continue;

    const actualLine = headerRowIndex + 1 + r + 1;
    const rawDict: Record<string, string> = {};
    mappings.forEach((m) => {
      rawDict[m.uploadedHeader] = row[m.columnIndex] ?? "";
    });

    const metadataJson: Record<string, any> = {};
    for (const col of metadataCols) {
      const header = mappings.find((m) => m.columnIndex === col)?.uploadedHeader || `Col_${col}`;
      const val = row[col];
      if (val && val.trim() !== "") {
        metadataJson[header] = val.trim();
      }
    }

    validParsedRows.push({
      rowIndex: actualLine,
      raw: rawDict,
      rawName: (nameIdx !== undefined ? row[nameIdx] : "") || "",
      rawSku: (skuIdx !== undefined ? row[skuIdx] : "") || "",
      rawCost: (costIdx !== undefined ? row[costIdx] : "") || "",
      rawPrice: (priceIdx !== undefined ? row[priceIdx] : "") || "",
      rawDisc: (discIdx !== undefined ? row[discIdx] : "") || "",
      rawStock: (stockIdx !== undefined ? row[stockIdx] : "") || "",
      rawAlert: (alertIdx !== undefined ? row[alertIdx] : "") || "",
      rawCat: (catIdx !== undefined ? row[catIdx] : "") || "",
      rawSubcat: (subcatIdx !== undefined ? row[subcatIdx] : "") || "",
      rawUom: (uomIdx !== undefined ? row[uomIdx] : "") || "",
      rawPkg: (pkgIdx !== undefined ? row[pkgIdx] : "") || "",
      rawPackSize: (packSizeIdx !== undefined ? row[packSizeIdx] : "") || "",
      rawStrength: (strengthIdx !== undefined ? row[strengthIdx] : "") || "",
      rawBrand: (brandIdx !== undefined ? row[brandIdx] : "") || "",
      rawBarcode: (barcodeIdx !== undefined ? row[barcodeIdx] : "") || "",
      rawBatch: (batchIdx !== undefined ? row[batchIdx] : "") || "",
      rawExpiry: (expiryIdx !== undefined ? row[expiryIdx] : "") || "",
      rawImages: (imagesIdx !== undefined ? row[imagesIdx] : "") || "",
      rawStatus: (statusIdx !== undefined ? row[statusIdx] : "") || "",
      metadataJson,
    });
  }

  // 3. Deduplicate unique product titles to minimize AI requests
  const uniqueProductQueries = Array.from(
    new Set(
      validParsedRows
        .map((p) => p.rawName.trim())
        .filter((n) => n.length > 0)
    )
  );

  const aiSuggestionCache = new Map<string, ProductSuggestion>();

  // Process unique product queries in controlled batches of 10
  const BATCH_SIZE = 10;
  const totalQueries = uniqueProductQueries.length;

  for (let i = 0; i < uniqueProductQueries.length; i += BATCH_SIZE) {
    const batch = uniqueProductQueries.slice(i, i + BATCH_SIZE);

    onProgress?.({
      stage: "Analyzing product intelligence with AI",
      current: Math.min(i + batch.length, totalQueries),
      total: totalQueries,
      percentage: Math.round((Math.min(i + batch.length, totalQueries) / (totalQueries || 1)) * 50),
      currentName: batch[0],
    });

    await Promise.all(
      batch.map(async (query) => {
        try {
          const suggestion = await requestProductAnalysis(query, businessContext);
          aiSuggestionCache.set(query.toLowerCase(), suggestion);
        } catch (err) {
          console.warn(`AI Analysis skipped for "${query}":`, err);
        }
      })
    );
  }

  // 4. Construct Normalized Products with AI Intelligence, Validation, and Confidence
  const normalizedProducts: NormalizedProduct[] = [];
  const categoryContext: CategoryValidationContext = {
    allowedPrimaryCategories: businessContext.allowedCategories,
    allowedSubcategories: businessContext.allowedSubcategories,
  };

  const totalRows = validParsedRows.length;

  for (let r = 0; r < validParsedRows.length; r++) {
    const row = validParsedRows[r];
    const errors: string[] = [];
    const warnings: string[] = [];
    let aiNormalized = false;

    onProgress?.({
      stage: "Normalizing & validating product rows",
      current: r + 1,
      total: totalRows,
      percentage: 50 + Math.round(((r + 1) / (totalRows || 1)) * 50),
      currentName: row.rawName,
    });

    // 4.1 Product Name & AI Suggestion Match
    const cleanRawName = row.rawName.trim();
    if (!cleanRawName) {
      errors.push("Product Name is required");
    }

    const aiSuggestion = aiSuggestionCache.get(cleanRawName.toLowerCase());

    // Normalized Product Title (clean dosage/package duplicates if AI safely identified)
    let finalTitle = cleanRawName;
    if (aiSuggestion?.identification?.product_name && aiSuggestion.identification.product_name !== cleanRawName) {
      finalTitle = aiSuggestion.identification.product_name;
      aiNormalized = true;
    }

    // 4.2 SKU / Item Code
    const cleanSku = row.rawSku.trim() || null;

    // 4.3 Prices
    const costRes = normalizePrice(row.rawCost);
    if (!costRes.isValid) errors.push(costRes.error || "Invalid purchase price");

    const priceRes = normalizePrice(row.rawPrice);
    if (!priceRes.isValid) errors.push(priceRes.error || "Invalid retail price");

    const discRes = normalizeDiscount(row.rawDisc, priceRes.value);
    if (!discRes.isValid) errors.push(discRes.error || "Invalid discount");
    if (discRes.warning) warnings.push(discRes.warning);

    // 4.4 Stock & Alert
    const stockRes = normalizeQuantity(row.rawStock, 0);
    if (!stockRes.isValid) errors.push(stockRes.error || "Invalid stock units");

    const alertRes = normalizeQuantity(row.rawAlert, 10);
    if (!alertRes.isValid) errors.push(alertRes.error || "Invalid min stock alert");

    // 4.5 Category Resolution (Admin Catalog is Truth)
    let categoryId: string | null = null;
    let categoryName: string | null = null;
    let categoryMatchedExact = false;

    // Priority 1: Explicit sheet category
    if (row.rawCat.trim()) {
      const match = findBestCategoryMatch(row.rawCat, primaryCategories);
      if (match.category) {
        categoryId = match.category.id;
        categoryName = match.category.name;
        categoryMatchedExact = match.isExact;
      } else {
        categoryName = row.rawCat.trim();
        warnings.push(`Category "${row.rawCat}" not found in Admin Catalog (needs review)`);
      }
    }
    // Priority 2: AI suggested category
    else if (aiSuggestion?.classification?.primary_category_id) {
      const adminCat = primaryCategories.find((c) => c.id === aiSuggestion.classification.primary_category_id);
      if (adminCat) {
        categoryId = adminCat.id;
        categoryName = adminCat.name;
        aiNormalized = true;
      } else if (aiSuggestion.classification.primary_category_name) {
        const match = findBestCategoryMatch(aiSuggestion.classification.primary_category_name, primaryCategories);
        if (match.category) {
          categoryId = match.category.id;
          categoryName = match.category.name;
          aiNormalized = true;
        } else {
          categoryName = aiSuggestion.classification.primary_category_name;
          warnings.push(`AI suggested category "${categoryName}" is not in Admin Catalog`);
        }
      }
    } else {
      warnings.push("Category not assigned (select from Admin Catalog)");
    }

    // 4.6 Subcategory Resolution (Must belong to selected category)
    let subcategoryId: string | null = null;
    let subcategoryName: string | null = null;

    if (row.rawSubcat.trim()) {
      if (categoryId) {
        const allowedSubs = subcategoryMap.get(categoryId) || [];
        const matchSub = allowedSubs.find((s) => s.name.toLowerCase() === row.rawSubcat.trim().toLowerCase());
        if (matchSub) {
          subcategoryId = matchSub.id;
          subcategoryName = matchSub.name;
        } else {
          subcategoryName = row.rawSubcat.trim();
          warnings.push(`Subcategory "${row.rawSubcat}" does not belong to selected category`);
        }
      } else {
        subcategoryName = row.rawSubcat.trim();
      }
    } else if (aiSuggestion?.classification?.subcategory_id && categoryId) {
      const allowedSubs = subcategoryMap.get(categoryId) || [];
      const matchSub = allowedSubs.find((s) => s.id === aiSuggestion.classification.subcategory_id);
      if (matchSub) {
        subcategoryId = matchSub.id;
        subcategoryName = matchSub.name;
        aiNormalized = true;
      }
    }

    // 4.7 Base Unit of Measure (UOM) Resolution
    const finalUom = (row.rawUom.trim() || aiSuggestion?.uom?.base_stock_unit || "piece").toLowerCase();
    if (!row.rawUom.trim() && aiSuggestion?.uom?.base_stock_unit) {
      aiNormalized = true;
    }

    const isUomAllowed = allowedUOMs.includes(finalUom);
    if (!isUomAllowed) {
      warnings.push(`UOM "${finalUom}" is not configured for ${businessContext.industryType || "this"} business`);
    }

    // 4.8 Packaging Type & Pack Size (Separate from stock quantity)
    const finalPkg = row.rawPkg.trim() || aiSuggestion?.packaging?.package_type || null;
    let finalPackSize: number | null = row.rawPackSize ? parseInt(row.rawPackSize, 10) : aiSuggestion?.packaging?.units_per_package || null;
    if (isNaN(Number(finalPackSize))) finalPackSize = null;

    // 4.9 Strength & Formulation
    const finalStrength = row.rawStrength.trim() || aiSuggestion?.attributes?.strength || null;
    const finalBrand = row.rawBrand.trim() || aiSuggestion?.identification?.brand_name || null;

    // 4.10 Barcode, Batch, Expiry
    const barcodeRes = normalizeBarcode(row.rawBarcode);
    if (!barcodeRes.isValid) errors.push(barcodeRes.error || "Invalid barcode format");

    const cleanBatch = row.rawBatch.trim() || null;
    const expiryRes = normalizeDate(row.rawExpiry);
    if (!expiryRes.isValid && row.rawExpiry.trim() !== "") {
      errors.push(expiryRes.error || "Invalid expiry date");
    }
    if (expiryRes.warning) warnings.push(expiryRes.warning);

    // 4.11 Images & Status
    const imagesRes = normalizeImages(row.rawImages);
    if (!imagesRes.isValid) errors.push(imagesRes.warning || "Invalid image URLs");

    const rawStatus = (row.rawStatus || "").trim().toLowerCase();
    const finalStatus: "active" | "draft" | "archived" = ["active", "draft", "archived"].includes(rawStatus)
      ? (rawStatus as any)
      : "active";

    // 4.12 Confidence Evaluation
    let rowConfidence = 0.85;
    let rowConfidenceLevel: "high" | "medium" | "low" = "medium";
    let fieldConfidenceDetails: Record<string, any> = {};

    if (aiSuggestion) {
      const evalResult = evaluateProductSuggestionConfidence(aiSuggestion, {
        rawInput: cleanRawName,
        categoryContext,
      });
      rowConfidence = evalResult.overall_confidence;
      rowConfidenceLevel = evalResult.confidence_level;
      fieldConfidenceDetails = evalResult.field_confidence_details;

      if (evalResult.warnings && evalResult.warnings.length > 0) {
        warnings.push(...evalResult.warnings);
      }
    } else {
      // Deterministic scoring for non-AI / manual rows
      if (cleanRawName && categoryId && isUomAllowed && priceRes.value > 0) {
        rowConfidence = 0.95;
        rowConfidenceLevel = "high";
      } else if (!categoryId || !isUomAllowed) {
        rowConfidence = 0.55;
        rowConfidenceLevel = "low";
      }
    }

    // 4.13 Row Status Determination
    let status: RowStatus = "ready";
    if (errors.length > 0) {
      status = "error";
    } else if (
      warnings.length > 0 ||
      !categoryId ||
      !isUomAllowed ||
      rowConfidence < CONFIDENCE_THRESHOLDS.AUTO_REVIEW_THRESHOLD
    ) {
      status = "review";
    }

    normalizedProducts.push({
      id: crypto.randomUUID(),
      rowIndex: row.rowIndex,
      raw: row.raw,
      canonical: {
        name: finalTitle,
        original_name: cleanRawName,
        internal_sku: cleanSku,
        description: Object.keys(row.metadataJson).length > 0 ? JSON.stringify(row.metadataJson) : null,
        category_id: categoryId,
        category_name: categoryName,
        subcategory_id: subcategoryId,
        subcategory_name: subcategoryName,
        stock_unit: finalUom,
        package_type: finalPkg,
        pack_size: finalPackSize,
        strength: finalStrength,
        brand: finalBrand,
        purchase_cost: costRes.value,
        retail_price: priceRes.value,
        discount_price: discRes.value,
        stock_units: stockRes.value,
        min_stock_alert: alertRes.value,
        batch_number: cleanBatch,
        expiry_date: expiryRes.value,
        barcode: barcodeRes.value,
        status: finalStatus,
        images: imagesRes.value,
        metadata_json: row.metadataJson,
      },
      ai_normalized: aiNormalized,
      ai_confidence: rowConfidence,
      ai_confidence_level: rowConfidenceLevel,
      ai_field_confidence: fieldConfidenceDetails,
      ai_suggestion: aiSuggestion,
      status,
      errors: Array.from(new Set(errors)),
      warnings: Array.from(new Set(warnings)),
      isDuplicateInFile: false,
      existingProductId: null,
      existingProductData: null,
      duplicateAction: "skip",
      selected: status !== "error",
    });
  }

  return normalizedProducts;
}
