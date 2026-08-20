/**
 * GEFLOW AI — SECURE FRONTEND CLIENT BRIDGE (PHASE 4)
 *
 * Calls the secure backend API (/api/ai/analyze-product, /api/ai/verify-product, /api/ai/providers, /api/ai/test-provider).
 * NEVER contains, requests, or transmits AI provider API keys.
 */

import { ProductSuggestion, CategoryValidationContext } from "@/types/aiProductIntelligence";
import { BusinessCatalogContext, AIVerificationResult, AIProviderType } from "@/server/ai/types";
import { ProviderConfigurationView, AIConnectionTestResult } from "@/types/aiConfiguration";
import { analyzeProductInput } from "./productIntelligenceEngine";

export interface AnalyzeOptions {
  preferredProvider?: AIProviderType;
  preferredModel?: string;
  temperature?: number;
}

export async function requestProductAnalysis(
  rawInput: string,
  businessContext: BusinessCatalogContext,
  authToken?: string,
  options?: AnalyzeOptions
): Promise<ProductSuggestion> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    headers["x-user-id"] = "active-user";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch("/api/ai/analyze-product", {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        rawInput,
        businessContext,
        options,
      }),
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data?.data) {
        return data.data as ProductSuggestion;
      }
    }
  } catch (err) {
    console.warn("Backend AI service unreachable, falling back to local engine:", err);
  }

  // Graceful client fallback to local heuristic engine
  const categoryContext: CategoryValidationContext = {
    allowedPrimaryCategories: businessContext.allowedCategories,
    allowedSubcategories: businessContext.allowedSubcategories,
  };

  return analyzeProductInput({
    rawText: rawInput,
    categoryContext,
    businessIndustry: businessContext.industryType,
    businessCurrency: businessContext.currency,
  });
}

export async function requestProductVerification(
  suggestion: ProductSuggestion,
  businessContext: BusinessCatalogContext,
  authToken?: string,
  originalInput?: string,
  searchEvidence?: string[]
): Promise<AIVerificationResult> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    headers["x-user-id"] = "active-user";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch("/api/ai/verify-product", {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        suggestion,
        businessContext,
        originalInput,
        searchEvidence,
      }),
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data?.data) {
        return data.data as AIVerificationResult;
      }
    }
  } catch (err) {
    console.warn("Backend AI verification unreachable, using local fallback:", err);
  }

  // Client-side local deterministic verification fallback
  const matchedCat = businessContext.allowedCategories.find(
    (c) => c.id === suggestion.classification.primary_category_id
  );
  const matchedSub = businessContext.allowedSubcategories.find(
    (s) => s.id === suggestion.classification.subcategory_id
  );

  const isCatValid = !!matchedCat;
  const isSubValid = !suggestion.classification.subcategory_id || !!matchedSub;
  const needsReview = !isCatValid || !isSubValid || (suggestion.uncertain_fields?.length || 0) > 0;

  return {
    isConsistent: !needsReview,
    confidenceScore: needsReview ? 0.65 : suggestion.overall_confidence,
    confidenceLevel: needsReview ? "low" : suggestion.confidence_level,
    needs_review: needsReview,
    critiqueNotes: !isCatValid ? ["Category could not be matched against business catalog."] : [],
    uncertainFields: suggestion.uncertain_fields || [],
    fieldVerifications: {
      product_name: {
        field: "product_name",
        label: "Product Name",
        status: suggestion.identification.product_name ? "verified" : "invalid",
        candidateValue: suggestion.identification.product_name,
        isConsistent: !!suggestion.identification.product_name,
      },
      primary_category: {
        field: "primary_category",
        label: "Primary Category",
        status: isCatValid ? "verified" : "invalid",
        candidateValue: suggestion.classification.primary_category_name || suggestion.classification.primary_category_id,
        isConsistent: isCatValid,
      },
      subcategory: {
        field: "subcategory",
        label: "Subcategory",
        status: isSubValid ? (suggestion.classification.subcategory_id ? "verified" : "not_identified") : "invalid",
        candidateValue: suggestion.classification.subcategory_name || suggestion.classification.subcategory_id,
        isConsistent: isSubValid,
      },
      stock_unit: {
        field: "stock_unit",
        label: "Unit of Measure (UOM)",
        status: "verified",
        candidateValue: suggestion.uom.stock_unit,
        isConsistent: true,
      },
      strength: {
        field: "strength",
        label: "Strength / Potency",
        status: suggestion.attributes.strength ? "verified" : "not_identified",
        candidateValue: suggestion.attributes.strength,
        isConsistent: true,
      },
      pack_size: {
        field: "pack_size",
        label: "Pack Size",
        status: suggestion.uom.pack_size ? "verified" : "not_identified",
        candidateValue: suggestion.uom.pack_size,
        isConsistent: true,
      },
      barcode: {
        field: "barcode",
        label: "Global Barcode",
        status: suggestion.identification.barcode ? "verified" : "not_identified",
        candidateValue: suggestion.identification.barcode,
        isConsistent: true,
      },
      pricing: {
        field: "pricing",
        label: "Price / Cost",
        status: suggestion.extracted_business_data?.retail_price ? "verified" : "not_identified",
        candidateValue: suggestion.extracted_business_data?.retail_price,
        isConsistent: true,
      },
    },
    categoryStatus: {
      status: isCatValid ? "verified" : "invalid",
      matchedId: matchedCat?.id || null,
      matchedName: matchedCat?.name || null,
    },
    subcategoryStatus: {
      status: isSubValid ? (matchedSub ? "verified" : "unmatched") : "invalid",
      matchedId: matchedSub?.id || null,
      matchedName: matchedSub?.name || null,
    },
    uomStatus: {
      status: "verified",
      matchedUnit: suggestion.uom.stock_unit,
    },
    contradictions: [],
    suggestedCorrections: {},
    verifiedAt: new Date().toISOString(),
    verifierMetadata: {
      provider: "client-local-audit",
      model: "deterministic-audit-v1",
      latencyMs: 1,
    },
  };
}

/**
 * Loads provider metadata & active models (Public view, strictly without secrets)
 */
export async function fetchAIProviders(): Promise<ProviderConfigurationView[]> {
  try {
    const response = await fetch("/api/ai/providers");
    if (response.ok) {
      const json = await response.json();
      return json.data || [];
    }
  } catch (err) {
    console.warn("Failed to fetch AI providers configuration:", err);
  }
  return [];
}

/**
 * Triggers a secure server-side connection test for a provider.
 */
export async function testAIProviderConnection(
  provider: AIProviderType,
  modelId?: string,
  authToken?: string
): Promise<AIConnectionTestResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  headers["x-user-id"] = "active-user";

  const response = await fetch("/api/ai/test-provider", {
    method: "POST",
    headers,
    body: JSON.stringify({ provider, modelId }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    return {
      success: false,
      provider,
      model: modelId || "default",
      latencyMs: 0,
      healthStatus: "unhealthy",
      errorCode: errorJson?.code || "AI_PROVIDER_UNAVAILABLE",
      message: errorJson?.message || "Connection test failed",
      testedAt: new Date().toISOString(),
    };
  }

  const json = await response.json();
  return json.data;
}
