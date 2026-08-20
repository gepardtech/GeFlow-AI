/**
 * GEFLOW AI — PRODUCT INTELLIGENCE VALIDATION ENGINE (PHASE 2)
 *
 * Strict validation and sanitization for ProductSuggestion payloads.
 * Validates against authoritative Admin business category catalogs,
 * checks UOM consistency, enforces anti-invention rules, and calculates
 * review/uncertainty flags.
 */

import {
  ProductSuggestion,
  CategoryValidationContext,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "@/types/aiProductIntelligence";
import {
  STANDARD_STOCK_UNITS,
  CONFIDENCE_THRESHOLDS,
  calculateConfidenceLevel,
} from "./productIntelligenceContract";
import { evaluateProductSuggestionConfidence } from "./confidenceEvaluator";

/**
 * Validates and sanitizes a ProductSuggestion against the authoritative business catalog
 */
export function validateProductSuggestion(
  suggestion: ProductSuggestion,
  context?: CategoryValidationContext
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Deep clone for sanitization so original is not directly mutated
  const sanitized: ProductSuggestion = JSON.parse(JSON.stringify(suggestion));

  // ---------------------------------------------------------------------------
  // 1. Identification Validation
  // ---------------------------------------------------------------------------
  if (!sanitized.identification || typeof sanitized.identification !== "object") {
    errors.push({
      field: "identification",
      code: "MISSING_IDENTIFICATION",
      message: "Product identification structure is required.",
    });
  } else {
    // Product Name
    if (!sanitized.identification.product_name || typeof sanitized.identification.product_name !== "string" || !sanitized.identification.product_name.trim()) {
      errors.push({
        field: "identification.product_name",
        code: "INVALID_PRODUCT_NAME",
        message: "Product name is required and must be a non-empty string.",
      });
    } else {
      sanitized.identification.product_name = sanitized.identification.product_name.trim();
    }

    // Barcode Anti-Invention & Format Check
    if (sanitized.identification.barcode) {
      const cleanBarcode = String(sanitized.identification.barcode).trim();
      // Check for placeholder or obvious fake patterns
      const isFakeOrPlaceholder = /^(000000|123456|fake|none|null|n\/a|test)/i.test(cleanBarcode);
      if (isFakeOrPlaceholder || cleanBarcode.length < 4) {
        warnings.push({
          field: "identification.barcode",
          code: "UNRELIABLE_BARCODE",
          message: "Potential hallucinated or placeholder barcode detected. Resetting to null.",
          severity: "warning",
        });
        sanitized.identification.barcode = null;
        sanitized.uncertain_fields = Array.from(new Set([...sanitized.uncertain_fields, "barcode"]));
      } else {
        sanitized.identification.barcode = cleanBarcode;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Classification Validation (Against Authoritative Admin Catalog)
  // ---------------------------------------------------------------------------
  if (context && sanitized.classification) {
    const { allowedPrimaryCategories, allowedSubcategories } = context;

    // Validate Primary Category
    if (sanitized.classification.primary_category_id || sanitized.classification.primary_category_name) {
      const matchedPrimary = allowedPrimaryCategories.find((cat) => {
        if (sanitized.classification.primary_category_id && cat.id === sanitized.classification.primary_category_id) {
          return true;
        }
        if (sanitized.classification.primary_category_name && cat.name.toLowerCase() === sanitized.classification.primary_category_name.toLowerCase()) {
          return true;
        }
        if (cat.slug && sanitized.classification.primary_category_name && cat.slug.toLowerCase() === sanitized.classification.primary_category_name.toLowerCase()) {
          return true;
        }
        return false;
      });

      if (matchedPrimary) {
        sanitized.classification.primary_category_id = matchedPrimary.id;
        sanitized.classification.primary_category_name = matchedPrimary.name;
        sanitized.classification.matched_by = "id";
      } else {
        // AI suggested an unknown category not in the business's configuration
        warnings.push({
          field: "classification.primary_category",
          code: "UNKNOWN_CATEGORY",
          message: `Category "${sanitized.classification.primary_category_name || sanitized.classification.primary_category_id}" is not configured for this business.`,
          severity: "warning",
        });
        sanitized.classification.primary_category_id = null;
        sanitized.classification.primary_category_name = null;
        sanitized.classification.subcategory_id = null;
        sanitized.classification.subcategory_name = null;
        sanitized.classification.matched_by = "unmatched";
        sanitized.needs_review = true;
        sanitized.uncertain_fields = Array.from(new Set([...sanitized.uncertain_fields, "primary_category", "subcategory"]));
      }
    }

    // Validate Subcategory
    if (sanitized.classification.primary_category_id && (sanitized.classification.subcategory_id || sanitized.classification.subcategory_name)) {
      const matchedSub = allowedSubcategories.find((sub) => {
        const parentMatches = !sub.parentId || sub.parentId === sanitized.classification.primary_category_id;
        if (!parentMatches) return false;

        if (sanitized.classification.subcategory_id && sub.id === sanitized.classification.subcategory_id) {
          return true;
        }
        if (sanitized.classification.subcategory_name && sub.name.toLowerCase() === sanitized.classification.subcategory_name.toLowerCase()) {
          return true;
        }
        return false;
      });

      if (matchedSub) {
        sanitized.classification.subcategory_id = matchedSub.id;
        sanitized.classification.subcategory_name = matchedSub.name;
      } else {
        warnings.push({
          field: "classification.subcategory",
          code: "UNKNOWN_SUBCATEGORY",
          message: `Subcategory "${sanitized.classification.subcategory_name || sanitized.classification.subcategory_id}" is not available under selected primary category.`,
          severity: "info",
        });
        sanitized.classification.subcategory_id = null;
        sanitized.classification.subcategory_name = null;
        sanitized.uncertain_fields = Array.from(new Set([...sanitized.uncertain_fields, "subcategory"]));
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. UOM Validation
  // ---------------------------------------------------------------------------
  if (!sanitized.uom || typeof sanitized.uom !== "object") {
    errors.push({
      field: "uom",
      code: "MISSING_UOM",
      message: "Unit of Measure specification is required.",
    });
  } else {
    // Valid unit_type
    const validTypes = ["quantity", "weight", "volume"];
    if (!validTypes.includes(sanitized.uom.unit_type)) {
      warnings.push({
        field: "uom.unit_type",
        code: "INVALID_UNIT_TYPE",
        message: `Unit type "${sanitized.uom.unit_type}" is invalid. Defaulting to "quantity".`,
        severity: "warning",
      });
      sanitized.uom.unit_type = "quantity";
    }

    // Stock Unit
    if (!sanitized.uom.stock_unit || typeof sanitized.uom.stock_unit !== "string") {
      sanitized.uom.stock_unit = "piece";
      sanitized.uncertain_fields = Array.from(new Set([...sanitized.uncertain_fields, "stock_unit"]));
    } else {
      sanitized.uom.stock_unit = sanitized.uom.stock_unit.trim().toLowerCase();
      const allowedUnits = context?.allowedUomUnits || STANDARD_STOCK_UNITS;
      const isKnownUnit = allowedUnits.some((u) => u.toLowerCase() === sanitized.uom.stock_unit.toLowerCase());
      if (!isKnownUnit) {
        warnings.push({
          field: "uom.stock_unit",
          code: "UNRECOGNIZED_UOM_UNIT",
          message: `Unit "${sanitized.uom.stock_unit}" is not in the standard catalog. Human review recommended.`,
          severity: "info",
        });
        sanitized.needs_review = true;
        sanitized.uncertain_fields = Array.from(new Set([...sanitized.uncertain_fields, "stock_unit"]));
      }
    }

    // Pack Size checks
    if (sanitized.uom.pack_size !== undefined && sanitized.uom.pack_size !== null) {
      const ps = Number(sanitized.uom.pack_size);
      if (isNaN(ps) || ps <= 0 || !Number.isInteger(ps)) {
        warnings.push({
          field: "uom.pack_size",
          code: "INVALID_PACK_SIZE",
          message: "Pack size must be a positive integer. Clearing invalid value.",
          severity: "warning",
        });
        sanitized.uom.pack_size = null;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Field-Level Confidence & Uncertainty Resolution (Phase 10)
  // ---------------------------------------------------------------------------
  const evalResult = evaluateProductSuggestionConfidence(sanitized, {
    categoryContext: context,
    rawInput: sanitized.identification?.product_name,
  });

  sanitized.overall_confidence = evalResult.overall_confidence;
  sanitized.confidence_level = evalResult.confidence_level;
  sanitized.field_confidence = evalResult.field_confidence;
  sanitized.field_confidence_details = evalResult.field_confidence_details;
  sanitized.field_sources = evalResult.field_sources;
  sanitized.uncertain_fields = Array.from(new Set([...sanitized.uncertain_fields, ...evalResult.uncertain_fields]));
  sanitized.needs_review = evalResult.needs_review || errors.length > 0;

  // ---------------------------------------------------------------------------
  // 5. Aggregate Warnings into Suggestion Envelope
  // ---------------------------------------------------------------------------
  sanitized.warnings = Array.from(
    new Set([...(sanitized.warnings || []), ...warnings.map((w) => w.message), ...evalResult.warnings])
  );

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedSuggestion: sanitized,
  };
}
