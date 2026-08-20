/**
 * GEFLOW AI — PRODUCT INTELLIGENCE CONTRACT CONSTANTS & FACTORIES (PHASE 2)
 *
 * Provider-Neutral UOM catalogs, confidence boundaries, and default factories.
 */

import {
  ProductSuggestion,
  ProductIdentification,
  ProductClassification,
  UOMContract,
  ProductAttributes,
  ConfidenceLevel,
} from "@/types/aiProductIntelligence";

/**
 * Baseline Standard UOM catalogs across retail, pharma, FMCG, and general inventory
 */
export const STANDARD_STOCK_UNITS = [
  "piece",
  "item",
  "box",
  "bottle",
  "pack",
  "strip",
  "tablet",
  "capsule",
  "vial",
  "ampoule",
  "tube",
  "jar",
  "can",
  "bag",
  "sachet",
  "carton",
  "roll",
  "pair",
  "set",
  "dozen",
  "unit",
  "kg",
  "g",
  "liter",
  "meter",
] as const;

export { CONFIDENCE_THRESHOLDS, getConfidenceLevel } from "./confidenceThresholds";
import { CONFIDENCE_THRESHOLDS, getConfidenceLevel } from "./confidenceThresholds";

/**
 * Map numerical confidence to standard human-readable tier
 */
export function calculateConfidenceLevel(score: number): ConfidenceLevel {
  return getConfidenceLevel(score);
}

/**
 * Factory to create an empty, blank ProductSuggestion envelope
 */
export function createEmptyProductSuggestion(
  provider = "gecore-ai-engine",
  model = "neutral-contract-v1"
): ProductSuggestion {
  return {
    id: `sug_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    identification: {
      product_name: "",
      brand: null,
      product_type: null,
      description: null,
      barcode: null,
    },
    classification: {
      primary_category_id: null,
      primary_category_name: null,
      subcategory_id: null,
      subcategory_name: null,
      matched_by: "unmatched",
    },
    uom: {
      unit_type: "quantity",
      stock_unit: "piece",
      quantity: 1,
      weight: null,
      volume: null,
      pack_size: null,
    },
    attributes: {
      strength: null,
      form: null,
      metadata: {},
    },
    overall_confidence: 0,
    confidence_level: "low",
    field_confidence: {},
    needs_review: true,
    uncertain_fields: ["product_name"],
    warnings: [],
    ai_metadata: {
      provider,
      model,
      generated_at: new Date().toISOString(),
    },
    field_sources: {
      product_name: "system",
      stock_unit: "system",
    },
  };
}
