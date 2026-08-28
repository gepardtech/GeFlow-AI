import { CANONICAL_FIELDS } from "./canonicalFields";
import { CanonicalField, ColumnMapping } from "./types";

export interface MappingAnalysisResult {
  mappings: ColumnMapping[];
  hasProductName: boolean;
  warnings: string[];
  conflictFields: CanonicalField[];
}

const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[_\-./\\]/g, " ")
    .replace(/[^a-z0-9 %]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Analyzes uploaded columns, matches with canonical fields, and calculates confidence scores.
 */
export const analyzeColumnMappings = (
  headers: string[],
  sampleRows: string[][]
): MappingAnalysisResult => {
  const mappings: ColumnMapping[] = [];

  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const rawHeader = headers[colIdx] || `Column ${colIdx + 1}`;
    const cleanHeader = normalizeString(rawHeader);

    // Extract sample non-empty values for this column
    const sampleValues: string[] = [];
    for (const row of sampleRows) {
      if (row[colIdx] && row[colIdx].trim() !== "") {
        sampleValues.push(row[colIdx].trim());
        if (sampleValues.length >= 8) break;
      }
    }

    let bestField: CanonicalField = "ignore";
    let bestScore = 0;
    let reason = "Unrecognized column";

    for (const fieldDef of CANONICAL_FIELDS) {
      if (fieldDef.key === "ignore") continue;

      for (const alias of fieldDef.aliases) {
        const cleanAlias = normalizeString(alias);

        // 1. Exact match
        if (cleanHeader === cleanAlias) {
          const score = 100;
          if (score > bestScore) {
            bestScore = score;
            bestField = fieldDef.key;
            reason = `Exact match with "${alias}"`;
          }
        }
        // 2. Starts with / Ends with
        else if (
          cleanHeader.startsWith(cleanAlias + " ") ||
          cleanHeader.endsWith(" " + cleanAlias) ||
          cleanHeader.startsWith(cleanAlias)
        ) {
          const score = 92;
          if (score > bestScore) {
            bestScore = score;
            bestField = fieldDef.key;
            reason = `Close match with "${alias}"`;
          }
        }
        // 3. Contains phrase or token overlap
        else if (
          cleanHeader.includes(cleanAlias) ||
          cleanAlias.includes(cleanHeader) ||
          (cleanHeader.length > 3 && cleanAlias.split(" ").some((w) => w.length > 3 && cleanHeader.includes(w)))
        ) {
          const score = 82;
          if (score > bestScore) {
            bestScore = score;
            bestField = fieldDef.key;
            reason = `Keyword match with "${alias}"`;
          }
        }
      }
    }

    // Heuristics based on sample values
    if (sampleValues.length > 0) {
      // Check if price/currency
      const hasCurrencyOrDecimals = sampleValues.some(
        (v) => /[$€£₹]|Rs|PKR|\.\d{2}/i.test(v) && !Number.isNaN(Number(v.replace(/[^0-9.]/g, "")))
      );

      // Check if barcode-like (8-14 digit numbers)
      const isBarcodeLike = sampleValues.every((v) => /^\d{8,14}$/.test(v.replace(/\s+/g, "")));

      // Check if date-like
      const isDateLike = sampleValues.every((v) =>
        /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$|^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$|[a-z]{3,9}\s+\d{1,2},\s*\d{4}/i.test(v)
      );

      // Check if image URLs
      const isImageLike = sampleValues.some((v) => /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|svg)/i.test(v));

      // Check if purely textual product names (e.g. multi-word strings like "Paracetamol 500mg")
      const isLikelyProductName =
        sampleValues.some((v) => v.length > 3 && /[a-zA-Z]/.test(v) && !/^https?:\/\//.test(v)) &&
        (cleanHeader.includes("name") ||
          cleanHeader.includes("item") ||
          cleanHeader.includes("prod") ||
          cleanHeader.includes("desc") ||
          cleanHeader.includes("title") ||
          cleanHeader.includes("particular") ||
          cleanHeader === "");

      if (bestField === "ignore" || bestScore < 70) {
        if (isImageLike) {
          bestField = "images";
          bestScore = Math.max(bestScore, 88);
          reason = "Contains image web URLs";
        } else if (isBarcodeLike && (cleanHeader.includes("code") || cleanHeader.includes("num") || cleanHeader.includes("bar") || cleanHeader.includes("ean") || cleanHeader.includes("upc"))) {
          bestField = "barcode";
          bestScore = Math.max(bestScore, 90);
          reason = "Contains 8-14 digit numeric barcodes";
        } else if (isDateLike && (cleanHeader.includes("date") || cleanHeader.includes("exp") || cleanHeader.includes("val"))) {
          bestField = "expiry_date";
          bestScore = Math.max(bestScore, 88);
          reason = "Contains formatted date values";
        } else if (hasCurrencyOrDecimals && (cleanHeader.includes("rate") || cleanHeader.includes("price") || cleanHeader.includes("mrp") || cleanHeader.includes("amount") || cleanHeader.includes("cost"))) {
          if (cleanHeader.includes("cost") || cleanHeader.includes("pur") || cleanHeader.includes("buy")) {
            bestField = "purchase_cost";
          } else {
            bestField = "retail_price";
          }
          bestScore = Math.max(bestScore, 82);
          reason = "Contains currency & monetary amounts";
        } else if (isLikelyProductName && colIdx <= 2) {
          bestField = "name";
          bestScore = Math.max(bestScore, 75);
          reason = "Contains product descriptions";
        }
      }
    }

    const confidence = bestScore;
    const requiresReview = confidence > 0 && confidence < 80;
    const status: ColumnMapping["status"] =
      bestField === "ignore"
        ? "ignored"
        : requiresReview
        ? "review"
        : "matched";

    mappings.push({
      uploadedHeader: rawHeader,
      columnIndex: colIdx,
      sampleValues,
      mappedField: bestField,
      confidence,
      reason,
      requiresReview,
      status,
    });
  }

  // Detect and resolve collisions (two columns mapped to the same unique canonical field)
  const nonRepeatableFields: CanonicalField[] = [
    "name",
    "internal_sku",
    "purchase_cost",
    "retail_price",
    "discount_price",
    "stock_units",
    "min_stock_alert",
    "category",
    "subcategory",
    "barcode",
    "batch_number",
    "expiry_date",
  ];

  const conflictFields: CanonicalField[] = [];

  for (const field of nonRepeatableFields) {
    const matching = mappings.filter((m) => m.mappedField === field);
    if (matching.length > 1) {
      conflictFields.push(field);
      // Pick the one with the highest confidence; set others to review
      matching.sort((a, b) => b.confidence - a.confidence);
      for (let i = 1; i < matching.length; i++) {
        matching[i].mappedField = "ignore";
        matching[i].status = "ignored";
        matching[i].reason = `Conflict with Column "${matching[0].uploadedHeader}" (higher match score)`;
      }
    }
  }

  // If name is not assigned but column 0 or 1 contains descriptive text, auto-assign
  const hasProductName = mappings.some((m) => m.mappedField === "name");
  if (!hasProductName && mappings.length > 0) {
    // Find first non-ignored column or column 0
    const candidate = mappings.find((m) => m.sampleValues.some((s) => s.length > 2 && isNaN(Number(s)))) || mappings[0];
    if (candidate) {
      candidate.mappedField = "name";
      candidate.confidence = 70;
      candidate.status = "review";
      candidate.reason = "Auto-assigned as Product Name (First textual column)";
    }
  }

  const finalHasProductName = mappings.some((m) => m.mappedField === "name");
  const warnings: string[] = [];

  if (!finalHasProductName) {
    warnings.push("Product Name column was not detected. Please select which column contains product names.");
  }

  const hasPrice = mappings.some((m) => m.mappedField === "retail_price" || m.mappedField === "purchase_cost");
  if (!hasPrice) {
    warnings.push("No pricing column detected. Default pricing will be set to 0.00 if unmapped.");
  }

  return {
    mappings,
    hasProductName: finalHasProductName,
    warnings,
    conflictFields,
  };
};

export const updateSingleMapping = (
  mappings: ColumnMapping[],
  columnIndex: number,
  newField: CanonicalField
): ColumnMapping[] => {
  return mappings.map((m) => {
    if (m.columnIndex === columnIndex) {
      return {
        ...m,
        mappedField: newField,
        confidence: newField === "ignore" ? 0 : 100,
        status: newField === "ignore" ? "ignored" : "matched",
        requiresReview: false,
        reason: "Manually set by user",
      };
    }
    // If setting a unique field that another column had, reset that column
    if (
      newField !== "ignore" &&
      newField !== "images" &&
      newField !== "metadata" &&
      m.mappedField === newField
    ) {
      return {
        ...m,
        mappedField: "ignore",
        status: "ignored",
        reason: `Reassigned to Column ${columnIndex + 1}`,
      };
    }
    return m;
  });
};

export const updateColumnMapping = updateSingleMapping;

