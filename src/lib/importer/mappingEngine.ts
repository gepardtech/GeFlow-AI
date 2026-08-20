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
    .replace(/[_-]/g, " ")
    .replace(/[^a-z0-9 %]/g, "")
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
  const assignedFields = new Map<CanonicalField, { colIndex: number; score: number }>();
  const conflictFields: CanonicalField[] = [];

  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const rawHeader = headers[colIdx] || `Column ${colIdx + 1}`;
    const cleanHeader = normalizeString(rawHeader);

    // Extract sample non-empty values for this column
    const sampleValues: string[] = [];
    for (const row of sampleRows) {
      if (row[colIdx] && row[colIdx].trim() !== "") {
        sampleValues.push(row[colIdx].trim());
        if (sampleValues.length >= 5) break;
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
        else if (cleanHeader.startsWith(cleanAlias + " ") || cleanHeader.endsWith(" " + cleanAlias)) {
          const score = 92;
          if (score > bestScore) {
            bestScore = score;
            bestField = fieldDef.key;
            reason = `Close prefix/suffix match with "${alias}"`;
          }
        }
        // 3. Contains phrase
        else if (cleanHeader.includes(cleanAlias) || cleanAlias.includes(cleanHeader)) {
          const score = 84;
          if (score > bestScore) {
            bestScore = score;
            bestField = fieldDef.key;
            reason = `Partial match with "${alias}"`;
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
        /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$|^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$|[a-z]{3,9}\s+\d{1,2},\s*\d{4}/i.test(v)
      );

      // Check if image URLs
      const isImageLike = sampleValues.some((v) => /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|svg)/i.test(v));

      if (bestField === "ignore" || bestScore < 70) {
        if (isImageLike) {
          bestField = "images";
          bestScore = Math.max(bestScore, 85);
          reason = "Contains web image URLs";
        } else if (isBarcodeLike && (cleanHeader.includes("code") || cleanHeader.includes("num") || cleanHeader.includes("bar"))) {
          bestField = "barcode";
          bestScore = Math.max(bestScore, 88);
          reason = "Header & 8-14 digit numeric barcode sample values";
        } else if (isDateLike && (cleanHeader.includes("date") || cleanHeader.includes("exp") || cleanHeader.includes("val"))) {
          bestField = "expiry_date";
          bestScore = Math.max(bestScore, 85);
          reason = "Contains formatted date values";
        } else if (hasCurrencyOrDecimals && (cleanHeader.includes("rate") || cleanHeader.includes("price") || cleanHeader.includes("amount"))) {
          bestField = "retail_price";
          bestScore = Math.max(bestScore, 75);
          reason = "Contains currency & monetary values";
        }
      }
    }

    const confidence = bestScore;
    const requiresReview = confidence > 0 && confidence < 90;
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

  for (const field of nonRepeatableFields) {
    const matching = mappings.filter((m) => m.mappedField === field);
    if (matching.length > 1) {
      conflictFields.push(field);
      // Sort matching by confidence descending
      matching.sort((a, b) => b.confidence - a.confidence);

      // Keep the first one as matched, flag the second one for review / conflict
      for (let i = 1; i < matching.length; i++) {
        matching[i].status = "conflict";
        matching[i].requiresReview = true;
        matching[i].reason = `Multiple columns mapped to ${field}. Review recommended.`;
      }
    }
  }

  const hasProductName = mappings.some((m) => m.mappedField === "name");
  const warnings: string[] = [];

  if (!hasProductName) {
    warnings.push("No column was automatically identified as 'Product Name'. Please map a column to Product Name.");
  }
  if (conflictFields.length > 0) {
    warnings.push(`Multiple columns appear to represent: ${conflictFields.join(", ")}. Please review.`);
  }

  return {
    mappings,
    hasProductName,
    warnings,
    conflictFields,
  };
};

/**
 * Updates a column mapping with user manual override.
 */
export const updateColumnMapping = (
  mappings: ColumnMapping[],
  columnIndex: number,
  newField: CanonicalField
): ColumnMapping[] => {
  return mappings.map((m) => {
    if (m.columnIndex !== columnIndex) return m;

    const isIgnored = newField === "ignore";
    return {
      ...m,
      mappedField: newField,
      confidence: isIgnored ? 0 : 100,
      reason: isIgnored ? "Ignored by user" : "Manually assigned by user",
      requiresReview: false,
      status: isIgnored ? "ignored" : "matched",
    };
  });
};
