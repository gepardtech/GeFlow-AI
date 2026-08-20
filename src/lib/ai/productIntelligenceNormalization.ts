/**
 * GEFLOW AI — PRODUCT INTELLIGENCE NORMALIZATION & ADAPTERS (PHASE 2)
 *
 * Provider-neutral normalization pipeline and user override merge helpers.
 * Ensures AI outputs conform to the standard data contract before entering the UI.
 */

import {
  ProductSuggestion,
  AIMetadata,
  CategoryValidationContext,
  FieldSource,
  ConfidenceLevel,
} from "@/types/aiProductIntelligence";
import {
  createEmptyProductSuggestion,
  calculateConfidenceLevel,
} from "./productIntelligenceContract";
import { validateProductSuggestion } from "./productIntelligenceValidation";

/**
 * Normalizes a raw structured object from any provider into a compliant ProductSuggestion
 */
export function normalizeToProductSuggestion(
  raw: any,
  metadata: AIMetadata,
  context?: CategoryValidationContext
): ProductSuggestion {
  const base = createEmptyProductSuggestion(metadata.provider, metadata.model);
  base.ai_metadata = metadata;

  if (!raw || typeof raw !== "object") {
    return base;
  }

  // 1. Identification
  const idRaw = raw.identification || raw;
  base.identification = {
    product_name: String(idRaw.product_name || idRaw.name || idRaw.title || "").trim(),
    brand: idRaw.brand ? String(idRaw.brand).trim() : null,
    product_type: idRaw.product_type || idRaw.type ? String(idRaw.product_type || idRaw.type).trim() : null,
    description: idRaw.description ? String(idRaw.description).trim() : null,
    barcode: idRaw.barcode ? String(idRaw.barcode).trim() : null,
  };

  // 2. Classification
  const classRaw = raw.classification || raw;
  base.classification = {
    primary_category_id: classRaw.primary_category_id || classRaw.category_id || null,
    primary_category_name: classRaw.primary_category_name || classRaw.category_name || classRaw.category || null,
    subcategory_id: classRaw.subcategory_id || null,
    subcategory_name: classRaw.subcategory_name || classRaw.subcategory || null,
    matched_by: "unmatched",
  };

  // 3. UOM
  const uomRaw = raw.uom || raw;
  const rawUnitType = String(uomRaw.unit_type || "quantity").toLowerCase();
  const unit_type = (rawUnitType === "weight" || rawUnitType === "volume") ? rawUnitType : "quantity";

  base.uom = {
    unit_type,
    stock_unit: String(uomRaw.stock_unit || uomRaw.unit || "piece").trim().toLowerCase(),
    quantity: typeof uomRaw.quantity === "number" ? uomRaw.quantity : null,
    weight: uomRaw.weight && typeof uomRaw.weight === "object" ? {
      value: Number(uomRaw.weight.value) || 0,
      unit: uomRaw.weight.unit || "g",
    } : null,
    volume: uomRaw.volume && typeof uomRaw.volume === "object" ? {
      value: Number(uomRaw.volume.value) || 0,
      unit: uomRaw.volume.unit || "ml",
    } : null,
    pack_size: typeof uomRaw.pack_size === "number" ? Math.round(uomRaw.pack_size) : null,
  };

  // 4. Attributes
  const attrRaw = raw.attributes || raw;
  base.attributes = {
    strength: attrRaw.strength ? String(attrRaw.strength).trim() : null,
    form: attrRaw.form ? String(attrRaw.form).trim() : null,
    metadata: typeof attrRaw.metadata === "object" && attrRaw.metadata !== null ? attrRaw.metadata : {},
  };

  // 5. Explicit User Supplied Business Context (never invented by AI)
  if (raw.extracted_business_data && typeof raw.extracted_business_data === "object") {
    base.extracted_business_data = {
      purchase_cost: typeof raw.extracted_business_data.purchase_cost === "number" ? raw.extracted_business_data.purchase_cost : null,
      retail_price: typeof raw.extracted_business_data.retail_price === "number" ? raw.extracted_business_data.retail_price : null,
      stock_units: typeof raw.extracted_business_data.stock_units === "number" ? raw.extracted_business_data.stock_units : null,
      min_stock_alert: typeof raw.extracted_business_data.min_stock_alert === "number" ? raw.extracted_business_data.min_stock_alert : null,
      batch_number: raw.extracted_business_data.batch_number ? String(raw.extracted_business_data.batch_number) : null,
      expiry_date: raw.extracted_business_data.expiry_date ? String(raw.extracted_business_data.expiry_date) : null,
      user_supplied: true,
    };
  }

  // 6. Confidence & Review State
  base.overall_confidence = typeof raw.overall_confidence === "number" ? Math.max(0, Math.min(1, raw.overall_confidence)) : 0.85;
  base.confidence_level = calculateConfidenceLevel(base.overall_confidence);
  base.field_confidence = typeof raw.field_confidence === "object" && raw.field_confidence !== null ? raw.field_confidence : {};

  // Set all initial field sources to 'ai'
  base.field_sources = {
    product_name: "ai",
    brand: "ai",
    primary_category: "ai",
    subcategory: "ai",
    stock_unit: "ai",
    pack_size: "ai",
    strength: "ai",
    form: "ai",
    description: "ai",
  };

  // Run validation & sanitization
  const validation = validateProductSuggestion(base, context);
  return validation.sanitizedSuggestion || base;
}

/**
 * Merges user edits directly into a ProductSuggestion envelope.
 * STRICT RULE: User-provided values MUST take absolute priority over AI suggestions.
 */
export function applyUserOverrides(
  suggestion: ProductSuggestion,
  overrides: {
    product_name?: string;
    brand?: string | null;
    primary_category_id?: string | null;
    primary_category_name?: string | null;
    subcategory_id?: string | null;
    subcategory_name?: string | null;
    stock_unit?: string;
    pack_size?: number | null;
    strength?: string | null;
    form?: string | null;
    description?: string | null;
    barcode?: string | null;
  }
): ProductSuggestion {
  const updated: ProductSuggestion = JSON.parse(JSON.stringify(suggestion));

  if (overrides.product_name !== undefined) {
    updated.identification.product_name = overrides.product_name;
    updated.field_sources["product_name"] = "user";
  }
  if (overrides.brand !== undefined) {
    updated.identification.brand = overrides.brand;
    updated.field_sources["brand"] = "user";
  }
  if (overrides.description !== undefined) {
    updated.identification.description = overrides.description;
    updated.field_sources["description"] = "user";
  }
  if (overrides.barcode !== undefined) {
    updated.identification.barcode = overrides.barcode;
    updated.field_sources["barcode"] = "user";
  }

  if (overrides.primary_category_id !== undefined || overrides.primary_category_name !== undefined) {
    updated.classification.primary_category_id = overrides.primary_category_id ?? updated.classification.primary_category_id;
    updated.classification.primary_category_name = overrides.primary_category_name ?? updated.classification.primary_category_name;
    updated.field_sources["primary_category"] = "user";
  }

  if (overrides.subcategory_id !== undefined || overrides.subcategory_name !== undefined) {
    updated.classification.subcategory_id = overrides.subcategory_id ?? updated.classification.subcategory_id;
    updated.classification.subcategory_name = overrides.subcategory_name ?? updated.classification.subcategory_name;
    updated.field_sources["subcategory"] = "user";
  }

  if (overrides.stock_unit !== undefined) {
    updated.uom.stock_unit = overrides.stock_unit;
    updated.field_sources["stock_unit"] = "user";
  }
  if (overrides.pack_size !== undefined) {
    updated.uom.pack_size = overrides.pack_size;
    updated.field_sources["pack_size"] = "user";
  }

  if (overrides.strength !== undefined) {
    updated.attributes.strength = overrides.strength;
    updated.field_sources["strength"] = "user";
  }
  if (overrides.form !== undefined) {
    updated.attributes.form = overrides.form;
    updated.field_sources["form"] = "user";
  }

  // Clear overridden fields from uncertain_fields list since human verified them
  const overriddenKeys = Object.keys(overrides);
  updated.uncertain_fields = updated.uncertain_fields.filter((f) => !overriddenKeys.includes(f));

  if (updated.uncertain_fields.length === 0) {
    updated.needs_review = false;
  }

  return updated;
}

/**
 * Maps a validated ProductSuggestion to the existing ProductDialog form fields.
 * Preserves existing user inputs and maps cleanly without forcing database changes.
 */
export function mapSuggestionToProductFormFields(
  suggestion: ProductSuggestion,
  existingForm?: Record<string, any>
): Record<string, any> {
  const mapped: Record<string, any> = { ...existingForm };

  if (suggestion.identification.product_name && (!existingForm?.name || existingForm.name === "")) {
    mapped.name = suggestion.identification.product_name;
  }

  if (suggestion.identification.description && (!existingForm?.description || existingForm.description === "")) {
    mapped.description = suggestion.identification.description;
  }

  if (suggestion.identification.barcode && (!existingForm?.barcode || existingForm.barcode === "")) {
    mapped.barcode = suggestion.identification.barcode;
  }

  if (suggestion.classification.primary_category_id && (!existingForm?.category_id || existingForm.category_id === "")) {
    mapped.category_id = suggestion.classification.primary_category_id;
  }

  if (suggestion.classification.subcategory_id && (!existingForm?.subcategory_id || existingForm.subcategory_id === "")) {
    mapped.subcategory_id = suggestion.classification.subcategory_id;
  }

  // If user provided prices in input and they were parsed
  if (suggestion.extracted_business_data?.purchase_cost !== undefined && suggestion.extracted_business_data.purchase_cost !== null) {
    mapped.purchase_cost = String(suggestion.extracted_business_data.purchase_cost);
  }
  if (suggestion.extracted_business_data?.retail_price !== undefined && suggestion.extracted_business_data.retail_price !== null) {
    mapped.retail_price = String(suggestion.extracted_business_data.retail_price);
  }

  return mapped;
}

/**
 * UI visual helper to render confidence badges
 */
export function getConfidenceBadgeConfig(level: ConfidenceLevel): {
  label: string;
  badgeClass: string;
  iconColor: string;
} {
  switch (level) {
    case "high":
      return {
        label: "High Confidence",
        badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        iconColor: "text-emerald-500",
      };
    case "medium":
      return {
        label: "Review Suggested",
        badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
        iconColor: "text-amber-500",
      };
    case "low":
    default:
      return {
        label: "Manual Verification Required",
        badgeClass: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
        iconColor: "text-rose-500",
      };
  }
}
