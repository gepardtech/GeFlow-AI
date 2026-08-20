/**
 * GEFLOW AI — RESPONSE NORMALIZER (PHASE 3)
 *
 * Normalizes raw structured responses from Gemini, OpenAI, OpenRouter, or Heuristics
 * into the provider-neutral Phase 2 ProductSuggestion schema.
 */

import { ProductSuggestion, CategoryValidationContext, ProductUnitType } from "@/types/aiProductIntelligence";
import { normalizeToProductSuggestion } from "@/lib/ai/productIntelligenceNormalization";
import { AIProviderResponse } from "../types";

export function normalizeProviderOutput(
  providerResponse: AIProviderResponse,
  categoryContext: CategoryValidationContext,
  requestId: string
): ProductSuggestion {
  const raw = providerResponse.rawOutput || {};

  // If already structured as ProductSuggestion (e.g. from heuristic adapter)
  if (raw.identification && raw.classification && raw.uom && raw.confidence_level) {
    return {
      ...raw,
      ai_metadata: {
        provider: providerResponse.provider,
        model: providerResponse.model,
        generated_at: new Date().toISOString(),
        request_id: requestId,
        latency_ms: providerResponse.latencyMs,
      },
    };
  }

  // Handle flat/custom JSON returned by LLM models
  const unitTypeRaw = String(raw.unit_type || "quantity").toLowerCase();
  const unitType: ProductUnitType =
    unitTypeRaw === "weight" ? "weight" : unitTypeRaw === "volume" ? "volume" : "quantity";

  const rawSuggestion = {
    identification: {
      product_name: raw.product_name || raw.name || "",
      brand: raw.brand || null,
      product_type: raw.product_type || null,
      description: raw.description || null,
      barcode: raw.barcode || null,
    },
    classification: {
      primary_category_id: raw.primary_category_id || null,
      primary_category_name: raw.primary_category_name || null,
      subcategory_id: raw.subcategory_id || null,
      subcategory_name: raw.subcategory_name || null,
    },
    uom: {
      unit_type: unitType,
      stock_unit: (raw.stock_unit || "piece").toLowerCase(),
      pack_size: typeof raw.pack_size === "number" ? raw.pack_size : null,
      weight: raw.weight?.value ? { value: Number(raw.weight.value), unit: raw.weight.unit || "g" } : null,
      volume: raw.volume?.value ? { value: Number(raw.volume.value), unit: raw.volume.unit || "l" } : null,
    },
    attributes: {
      strength: raw.strength || null,
      form: raw.form || null,
      metadata: raw.metadata || {},
    },
    extracted_business_data: {
      purchase_cost: typeof raw.purchase_cost === "number" ? raw.purchase_cost : null,
      retail_price: typeof raw.retail_price === "number" ? raw.retail_price : null,
      stock_units: typeof raw.stock_units === "number" ? raw.stock_units : null,
      min_stock_alert: typeof raw.min_stock_alert === "number" ? raw.min_stock_alert : null,
      batch_number: raw.batch_number || null,
      expiry_date: raw.expiry_date || null,
      user_supplied: false,
    },
    overall_confidence: typeof raw.overall_confidence === "number" ? raw.overall_confidence : 0.85,
    field_confidence: raw.field_confidence || {},
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
  };

  const metadata = {
    provider: providerResponse.provider,
    model: providerResponse.model,
    generated_at: new Date().toISOString(),
    request_id: requestId,
    latency_ms: providerResponse.latencyMs,
  };

  return normalizeToProductSuggestion(rawSuggestion, metadata, categoryContext);
}
