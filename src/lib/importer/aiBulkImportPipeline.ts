/**
 * GEFLOW AI — BULK IMPORT AI PIPELINE (PHASE 12)
 *
 * Integrates AI Product Intelligence with Bulk Import:
 * 1. Column Detection & Normalization
 * 2. Product Intelligence Extraction (Batched, Deduplicated, Resilient Timeout Protected)
 * 3. Smart Local Regex Heuristics (Extracts dosage, strength, packaging, and UOM)
 * 4. Admin Category Matching & Intelligent Fallback
 * 5. Subcategory Tree Validation
 * 6. Business Category UOM Resolution
 * 7. Packaging & Stock Separation
 * 8. Value Normalization (Prices, Barcodes, Dates)
 * 9. Field-Level & Row-Level Confidence Scoring
 * 10. Review & Error Flagging
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

  // 4. Token overlap
  const queryTokens = cleanQuery.split(/[\s,/-]+/).filter((t) => t.length > 2);
  let bestTokenMatch: CategoryLookupItem | null = null;
  let maxTokens = 0;

  for (const cat of categories) {
    const catTokens = cat.name.toLowerCase().split(/[\s,/-]+/);
    const overlap = queryTokens.filter((qt) => catTokens.some((ct) => ct.includes(qt) || qt.includes(ct))).length;
    if (overlap > maxTokens) {
      maxTokens = overlap;
      bestTokenMatch = cat;
    }
  }

  if (bestTokenMatch && maxTokens > 0) {
    return { category: bestTokenMatch, confidence: 0.75, isExact: false };
  }

  return { category: null, confidence: 0, isExact: false };
}

/**
 * Local heuristic extractor to instantly identify strength, packaging, UOM and cleaner names
 * when AI is slow or offline
 */
function extractLocalHeuristics(rawName: string): {
  cleanName: string;
  strength: string | null;
  uom: string | null;
  packageType: string | null;
  packSize: number | null;
} {
  const cleanName = rawName.trim();
  let strength: string | null = null;
  let uom: string | null = null;
  let packageType: string | null = null;
  let packSize: number | null = null;

  // Extract strength e.g., 500mg, 100mcg, 10ml, 2.5mg, 5%
  const strengthMatch = cleanName.match(/\b(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|iu|%|gm|ug))\b/i);
  if (strengthMatch) {
    strength = strengthMatch[1].trim();
  }

  // Extract pack size e.g. 10x10, Pack of 10, 10's, 10 Tabs, 100ml
  const packSizeMatch = cleanName.match(/\b(?:pack\s+of\s+|box\s+of\s+|strip\s+of\s+)?(\d+)\s*(?:tabs?|caps?|tablets?|capsules?|pcs?|pieces?|vials?|ampoules?|'s|s)\b/i);
  if (packSizeMatch) {
    packSize = parseInt(packSizeMatch[1], 10);
  }

  // Infer UOM
  const lower = cleanName.toLowerCase();
  if (lower.includes("syrup") || lower.includes("suspension") || lower.includes("liquid") || lower.includes("oil") || lower.includes("shampoo")) {
    uom = "bottle";
    packageType = "Bottle";
  } else if (lower.includes("tablet") || lower.includes("tab") || lower.includes("caplet")) {
    uom = "strip";
    packageType = "Blister Pack";
  } else if (lower.includes("capsule") || lower.includes("cap")) {
    uom = "strip";
    packageType = "Blister Pack";
  } else if (lower.includes("cream") || lower.includes("ointment") || lower.includes("gel") || lower.includes("paste")) {
    uom = "tube";
    packageType = "Tube";
  } else if (lower.includes("injection") || lower.includes("vial")) {
    uom = "vial";
    packageType = "Vial";
  } else if (lower.includes("drop") || lower.includes("eye drop") || lower.includes("ear drop")) {
    uom = "bottle";
    packageType = "Dropper Bottle";
  } else if (lower.includes("sachet") || lower.includes("powder")) {
    uom = "sachet";
    packageType = "Sachet";
  } else if (lower.includes("inhaler") || lower.includes("rotacap")) {
    uom = "inhaler";
    packageType = "Inhaler";
  } else if (lower.includes("soap") || lower.includes("bar")) {
    uom = "piece";
    packageType = "Box";
  } else if (lower.includes("bottle") || lower.includes("spray")) {
    uom = "bottle";
    packageType = "Bottle";
  } else if (lower.includes("box") || lower.includes("carton")) {
    uom = "box";
    packageType = "Box";
  } else if (lower.includes("can") || lower.includes("tin")) {
    uom = "can";
    packageType = "Can";
  } else if (lower.includes("kg") || lower.includes("kilo")) {
    uom = "kg";
    packageType = "Bag";
  } else {
    uom = "piece";
    packageType = "Unit";
  }

  return { cleanName, strength, uom, packageType, packSize };
}

/**
 * Runs the full end-to-end AI Product Intelligence Bulk Pipeline.
 */
export const runAIBulkProductPipeline = async (
  options: AIBulkPipelineOptions
): Promise<NormalizedProduct[]> => {
  const {
    mappings,
    dataRows,
    headerRowIndex,
    existingCategories,
    businessContext,
    onProgress,
  } = options;

  // 1. Resolve column indices from mappings
  const nameIdx = mappings.find((m) => m.mappedField === "name")?.columnIndex;
  const skuIdx = mappings.find((m) => m.mappedField === "internal_sku")?.columnIndex;
  const costIdx = mappings.find((m) => m.mappedField === "purchase_cost")?.columnIndex;
  const priceIdx = mappings.find((m) => m.mappedField === "retail_price")?.columnIndex;
  const discIdx = mappings.find((m) => m.mappedField === "discount_price")?.columnIndex;
  const stockIdx = mappings.find((m) => m.mappedField === "stock_units")?.columnIndex;
  const alertIdx = mappings.find((m) => m.mappedField === "min_stock_alert")?.columnIndex;
  const catIdx = mappings.find((m) => m.mappedField === "category")?.columnIndex;
  const subcatIdx = mappings.find((m) => m.mappedField === "subcategory")?.columnIndex;
  const uomIdx = mappings.find((m) => m.mappedField === "uom")?.columnIndex;
  const pkgIdx = mappings.find((m) => m.mappedField === "packaging")?.columnIndex;
  const packSizeIdx = mappings.find((m) => m.mappedField === "pack_size")?.columnIndex;
  const strengthIdx = mappings.find((m) => m.mappedField === "strength")?.columnIndex;
  const brandIdx = mappings.find((m) => m.mappedField === "brand")?.columnIndex;
  const barcodeIdx = mappings.find((m) => m.mappedField === "barcode")?.columnIndex;
  const batchIdx = mappings.find((m) => m.mappedField === "batch_number")?.columnIndex;
  const expiryIdx = mappings.find((m) => m.mappedField === "expiry_date")?.columnIndex;
  const imagesIdx = mappings.find((m) => m.mappedField === "images")?.columnIndex;
  const statusIdx = mappings.find((m) => m.mappedField === "status")?.columnIndex;
  const metaIdx = mappings.find((m) => m.mappedField === "metadata")?.columnIndex;

  // Build category hierarchy
  const primaryCategories = existingCategories.filter((c) => !c.parent_id);
  const subcategoryMap = new Map<string, CategoryLookupItem[]>();
  for (const cat of existingCategories) {
    if (cat.parent_id) {
      const subs = subcategoryMap.get(cat.parent_id) || [];
      subs.push(cat);
      subcategoryMap.set(cat.parent_id, subs);
    }
  }

  // Allowed UOMs for the business context
  const allowedUOMs =
    businessContext.allowedUOMs?.map((u) => u.toLowerCase().trim()) ||
    DEFAULT_ALLOWED_UOMS[businessContext.industryType?.toLowerCase() || "general"] ||
    DEFAULT_ALLOWED_UOMS.general;

  // 2. Parse raw rows starting AFTER header row
  const rawDataRows = dataRows.slice(headerRowIndex + 1);
  const validParsedRows: Array<{
    rowIndex: number;
    raw: string[];
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
    metadataJson: Record<string, string>;
  }> = [];

  for (let r = 0; r < rawDataRows.length; r++) {
    const row = rawDataRows[r];
    if (!row || row.length === 0) continue;

    // Check if entire row is empty
    const hasData = row.some((cell) => cell && cell.trim().length > 0);
    if (!hasData) continue;

    const rawName = (nameIdx !== undefined ? row[nameIdx] : "") || "";
    // If rawName is empty, look for any non-empty cell in first 3 columns
    const resolvedName = rawName.trim() || row.find((c) => c && c.trim().length > 0) || "";
    if (!resolvedName) continue;

    // Collect unmapped columns into metadata
    const metadataJson: Record<string, string> = {};
    if (metaIdx !== undefined && row[metaIdx]) {
      try {
        const parsed = JSON.parse(row[metaIdx]);
        if (typeof parsed === "object" && parsed !== null) {
          Object.assign(metadataJson, parsed);
        }
      } catch {
        metadataJson["remarks"] = row[metaIdx];
      }
    }

    mappings.forEach((m) => {
      if (m.mappedField === "ignore" && row[m.columnIndex]?.trim()) {
        metadataJson[m.uploadedHeader || `Col_${m.columnIndex + 1}`] = row[m.columnIndex].trim();
      }
    });

    validParsedRows.push({
      rowIndex: headerRowIndex + 1 + r,
      raw: row,
      rawName: resolvedName,
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

  // Process unique product queries in controlled batches of 8 with timeout safety
  const BATCH_SIZE = 8;
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
          // Timeout race after 4.5 seconds so no single item blocks the batch
          const suggestionPromise = requestProductAnalysis(query, businessContext);
          const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("AI Analysis timeout")), 4500)
          );
          const suggestion = await Promise.race([suggestionPromise, timeoutPromise]);
          if (suggestion) {
            aiSuggestionCache.set(query.toLowerCase(), suggestion as ProductSuggestion);
          }
        } catch (err) {
          // Fallback to local heuristic parsing
          console.warn(`AI Analysis fallback for "${query}":`, err);
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
    const cleanRawName = row.rawName.trim() || `Product ${r + 1}`;
    const local = extractLocalHeuristics(cleanRawName);
    const aiSuggestion = aiSuggestionCache.get(cleanRawName.toLowerCase());

    // Normalized Product Title
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

    // Priority 1: Explicit sheet category
    if (row.rawCat.trim()) {
      const match = findBestCategoryMatch(row.rawCat, primaryCategories);
      if (match.category) {
        categoryId = match.category.id;
        categoryName = match.category.name;
      } else {
        categoryName = row.rawCat.trim();
        warnings.push(`Category "${row.rawCat}" not in Catalog (mapped to default)`);
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
        }
      }
    }

    // Priority 3: Fuzzy title match against existing categories
    if (!categoryId && primaryCategories.length > 0) {
      const titleMatch = findBestCategoryMatch(cleanRawName, primaryCategories);
      if (titleMatch.category) {
        categoryId = titleMatch.category.id;
        categoryName = titleMatch.category.name;
        aiNormalized = true;
      } else {
        // Safe default: assign first category to ensure insertion never fails
        categoryId = primaryCategories[0].id;
        categoryName = primaryCategories[0].name;
      }
    }

    // 4.6 Subcategory Resolution (Must belong to selected category)
    let subcategoryId: string | null = null;
    let subcategoryName: string | null = null;

    if (row.rawSubcat.trim() && categoryId) {
      const allowedSubs = subcategoryMap.get(categoryId) || [];
      const matchSub = allowedSubs.find((s) => s.name.toLowerCase() === row.rawSubcat.trim().toLowerCase());
      if (matchSub) {
        subcategoryId = matchSub.id;
        subcategoryName = matchSub.name;
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
    const finalUom = (
      row.rawUom.trim() ||
      aiSuggestion?.uom?.base_stock_unit ||
      local.uom ||
      "piece"
    ).toLowerCase();

    if (!row.rawUom.trim() && (aiSuggestion?.uom?.base_stock_unit || local.uom)) {
      aiNormalized = true;
    }

    const isUomAllowed = allowedUOMs.includes(finalUom) || finalUom === "piece" || finalUom === "unit";

    // 4.8 Packaging Type & Pack Size
    const finalPkg =
      row.rawPkg.trim() ||
      aiSuggestion?.packaging?.package_type ||
      local.packageType ||
      null;

    let finalPackSize: number | null = row.rawPackSize
      ? parseInt(row.rawPackSize, 10)
      : aiSuggestion?.packaging?.units_per_package || local.packSize || null;

    if (isNaN(Number(finalPackSize))) finalPackSize = null;

    // 4.9 Strength & Formulation
    const finalStrength =
      row.rawStrength.trim() ||
      aiSuggestion?.attributes?.strength ||
      local.strength ||
      null;

    const finalBrand =
      row.rawBrand.trim() ||
      aiSuggestion?.identification?.brand_name ||
      null;

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
    let rowConfidence = 0.88;
    let rowConfidenceLevel: "high" | "medium" | "low" = "high";
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
      // Deterministic scoring for local heuristic rows
      if (cleanRawName && categoryId && priceRes.value >= 0) {
        rowConfidence = 0.92;
        rowConfidenceLevel = "high";
      } else {
        rowConfidence = 0.75;
        rowConfidenceLevel = "medium";
      }
    }

    // 4.13 Row Status Determination
    let status: RowStatus = "ready";
    if (errors.length > 0) {
      status = "error";
    } else if (
      warnings.length > 0 ||
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
        units_per_package: finalPackSize,
        strength: finalStrength,
        brand_name: finalBrand,
        purchase_cost: costRes.value,
        retail_price: priceRes.value,
        discount_price: discRes.value,
        stock_units: stockRes.value,
        min_stock_alert: alertRes.value,
        barcode: barcodeRes.value,
        batch_number: cleanBatch,
        expiry_date: expiryRes.value,
        images: imagesRes.value,
        status: finalStatus,
        metadata: row.metadataJson,
      },
      aiSuggestion: aiSuggestion || null,
      confidence: {
        overall: rowConfidence,
        level: rowConfidenceLevel,
        fieldScores: fieldConfidenceDetails,
      },
      status,
      errors,
      warnings,
      aiNormalized,
      selected: status !== "error", // Auto-select all ready and review rows
    });
  }

  return normalizedProducts;
};
