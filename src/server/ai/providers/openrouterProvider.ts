/**
 * GEFLOW AI — OPENROUTER PROVIDER ADAPTER (PHASE 7)
 *
 * Implements AIProviderInterface via OpenRouter as a first-class AI provider.
 * Supports configurable models (Llama 3.3, Claude 3.5, Mistral Large, DeepSeek, Gemini, etc.),
 * robust JSON response parsing, timeout abort signals, rate-limit recovery, token usage tracking,
 * and comprehensive verification auditing.
 */

import {
  AIProviderInterface,
  AIAnalysisRequest,
  AIVerificationRequest,
  AIProviderResponse,
} from "../types";
import { AIServiceError } from "../errors";

function extractJsonFromContent(content: string): any {
  if (!content || typeof content !== "string") {
    return {};
  }
  const trimmed = content.trim();

  // Try direct parse first
  try {
    return JSON.parse(trimmed);
  } catch {
    // Attempt markdown code block extraction
    const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // Continue searching
      }
    }

    // Attempt substring from first '{' to last '}'
    const startIdx = trimmed.indexOf("{");
    const endIdx = trimmed.lastIndexOf("}");
    if (startIdx !== -1 && endIdx > startIdx) {
      try {
        return JSON.parse(trimmed.substring(startIdx, endIdx + 1));
      } catch {
        // Fallback
      }
    }
  }

  return {};
}

export class OpenRouterProvider implements AIProviderInterface {
  public readonly name = "openrouter" as const;
  public readonly defaultModel = "meta-llama/llama-3.3-70b-instruct";

  public isConfigured(): boolean {
    return !!process.env.OPENROUTER_API_KEY;
  }

  public async analyzeProduct(request: AIAnalysisRequest): Promise<AIProviderResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = request.options?.preferredModel || this.defaultModel;
    const startTime = Date.now();

    if (!apiKey) {
      throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", "OpenRouter API key is not configured.", {
        statusCode: 503,
        retryable: false,
        requestId: request.requestId,
      });
    }

    const { allowedCategories, allowedSubcategories, allowedStockUnits, businessName, industryType } =
      request.businessContext;

    const systemPrompt = `You are GeFlow AI's Product Intelligence Engine running via OpenRouter.
Extract product name, brand, dosage/strength, stock unit, pack size, category IDs, volume/weight, and financials from raw text.
Return strictly JSON matching:
{
  "product_name": string,
  "brand": string | null,
  "product_type": string | null,
  "description": string | null,
  "barcode": string | null,
  "primary_category_id": string | null,
  "primary_category_name": string | null,
  "subcategory_id": string | null,
  "subcategory_name": string | null,
  "stock_unit": string,
  "unit_type": "quantity" | "weight" | "volume",
  "pack_size": number | null,
  "weight": { "value": number, "unit": "kg" | "g" | "mg" | "lb" | "oz" } | null,
  "volume": { "value": number, "unit": "l" | "ml" | "fl_oz" } | null,
  "strength": string | null,
  "form": string | null,
  "purchase_cost": number | null,
  "retail_price": number | null,
  "stock_units": number | null,
  "overall_confidence": number,
  "field_confidence": {
    "product_name": number,
    "primary_category": number,
    "subcategory": number,
    "stock_unit": number,
    "strength": number,
    "brand": number
  },
  "warnings": string[]
}

CONTEXT:
Business: "${businessName}" (${industryType || "General"})
Allowed Categories: ${JSON.stringify(allowedCategories.map((c) => ({ id: c.id, name: c.name })))}
Allowed Subcategories: ${JSON.stringify(allowedSubcategories.map((s) => ({ id: s.id, parentId: s.parentId, name: s.name })))}
Allowed Stock Units: ${JSON.stringify(allowedStockUnits || ["piece", "box", "bottle", "strip", "tablet", "capsule", "can", "bag", "pack"])}`;

    const controller = new AbortController();
    const timeoutMs = request.options?.timeoutMs || 15000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://geflow.app",
          "X-Title": "GeFlow AI Product Intelligence",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: request.rawInput },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1200,
          temperature: request.options?.temperature ?? 0.1,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429) {
          throw new AIServiceError("AI_RATE_LIMITED", "OpenRouter rate limit or credit quota reached.", {
            statusCode: 429,
            retryable: true,
            requestId: request.requestId,
          });
        }
        if (response.status === 401 || response.status === 403) {
          throw new AIServiceError("AI_UNAUTHORIZED", "OpenRouter authentication failed. Check API key.", {
            statusCode: 401,
            retryable: false,
            requestId: request.requestId,
          });
        }
        throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", `OpenRouter API error (${response.status}): ${errorText}`, {
          statusCode: 502,
          retryable: true,
          requestId: request.requestId,
        });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      const parsedJson = extractJsonFromContent(content || "{}");

      return {
        rawOutput: parsedJson,
        provider: this.name,
        model,
        latencyMs: Date.now() - startTime,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
      };
    } catch (err: any) {
      if (err instanceof AIServiceError) throw err;
      if (err.name === "AbortError" || String(err.message).toLowerCase().includes("aborted")) {
        throw new AIServiceError("AI_REQUEST_TIMEOUT", `OpenRouter request timed out after ${timeoutMs}ms`, {
          statusCode: 504,
          retryable: true,
          requestId: request.requestId,
        });
      }
      throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", `OpenRouter execution failed: ${err.message}`, {
        statusCode: 502,
        retryable: true,
        requestId: request.requestId,
        details: err,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public async verifyProduct(request: AIVerificationRequest): Promise<AIProviderResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = request.options?.preferredModel || this.defaultModel;
    const startTime = Date.now();

    if (!apiKey) {
      throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", "OpenRouter API key is not configured.", {
        statusCode: 503,
        retryable: false,
        requestId: request.requestId,
      });
    }

    const { allowedCategories, allowedSubcategories, allowedStockUnits, businessName, industryType } =
      request.businessContext;

    const originalInput = request.originalInput || request.suggestion.identification.product_name;

    const systemPrompt = `You are GeFlow AI's Product Consistency & Verification Auditor running via OpenRouter.
Your role is to AUDIT and VERIFY a candidate product suggestion against the original user input, allowed business taxonomy, and supporting evidence.
You are a VERIFIER, NOT a generator. Never invent unconfirmed data or accept arbitrary categories/UOMs not configured by the business.

VERIFICATION RULES:
1. FIELD-LEVEL VERIFICATION: Verify each field individually (product_name, primary_category, subcategory, stock_unit, strength, pack_size, barcode, pricing).
   Assign each field a status: "verified" | "suggested" | "uncertain" | "conflicting" | "invalid" | "not_identified".
2. CATEGORY VERIFICATION: Admin-configured categories are authoritative. If candidate category is not in allowedCategories, mark category as "invalid" (matched_id: null).
3. SUBCATEGORY VERIFICATION: Subcategory must exist in allowedSubcategories and be valid under the selected category. Otherwise mark "invalid".
4. UOM VERIFICATION: Candidate stock_unit must exist in allowedStockUnits. If not allowed, mark "invalid".
5. CONTRADICTION DETECTION: If candidate contradicts original input, flag as "conflicting", provide suggested_correction, and set needs_review = true.
6. MISSING / INVENTED INFO: If candidate has strength or pack_size completely absent from original input, mark "uncertain", verified = false, and set needs_review = true.

RETURN STRICT JSON FORMAT:
{
  "is_consistent": boolean,
  "confidence_score": number,
  "needs_review": boolean,
  "critique_notes": string[],
  "uncertain_fields": string[],
  "field_verifications": {
    "product_name": { "status": "verified" | "suggested" | "uncertain" | "conflicting" | "invalid" | "not_identified", "candidate_value": string, "suggested_correction": string | null, "reason": string },
    "primary_category": { "status": "verified" | "invalid" | "unmatched" | "uncertain", "candidate_value": string | null, "reason": string },
    "subcategory": { "status": "verified" | "invalid" | "unmatched" | "uncertain", "candidate_value": string | null, "reason": string },
    "stock_unit": { "status": "verified" | "invalid" | "uncertain", "candidate_value": string, "suggested_correction": string | null, "reason": string },
    "strength": { "status": "verified" | "uncertain" | "conflicting" | "not_identified", "candidate_value": string | null, "suggested_correction": string | null, "reason": string },
    "pack_size": { "status": "verified" | "uncertain" | "not_identified", "candidate_value": number | null, "reason": string },
    "barcode": { "status": "verified" | "uncertain" | "not_identified", "candidate_value": string | null, "reason": string }
  },
  "category_status": {
    "status": "verified" | "invalid" | "unmatched" | "uncertain",
    "matched_id": string | null,
    "matched_name": string | null,
    "reason": string
  },
  "subcategory_status": {
    "status": "verified" | "invalid" | "unmatched" | "uncertain",
    "matched_id": string | null,
    "matched_name": string | null,
    "reason": string
  },
  "uom_status": {
    "status": "verified" | "invalid" | "uncertain",
    "matched_unit": string | null,
    "reason": string
  },
  "contradictions": [
    {
      "field": string,
      "original_input": string,
      "candidate_value": string,
      "suggested_correction": string | null,
      "reason": string
    }
  ],
  "corrections": {
    "product_name"?: string,
    "stock_unit"?: string,
    "pack_size"?: number,
    "strength"?: string
  }
}

ALLOWED TAXONOMY CONSTRAINTS:
Business: "${businessName}" (${industryType || "General"})
Allowed Categories: ${JSON.stringify(allowedCategories.map((c) => ({ id: c.id, name: c.name })))}
Allowed Subcategories: ${JSON.stringify(allowedSubcategories.map((s) => ({ id: s.id, parentId: s.parentId, name: s.name })))}
Allowed Stock Units: ${JSON.stringify(allowedStockUnits || ["piece", "box", "bottle", "strip", "tablet", "capsule", "can", "bag", "pack"])}`;

    const userContent = JSON.stringify(
      {
        original_user_input: originalInput,
        candidate_product: {
          product_name: request.suggestion.identification.product_name,
          brand: request.suggestion.identification.brand,
          description: request.suggestion.identification.description,
          barcode: request.suggestion.identification.barcode,
          primary_category_id: request.suggestion.classification.primary_category_id,
          primary_category_name: request.suggestion.classification.primary_category_name,
          subcategory_id: request.suggestion.classification.subcategory_id,
          subcategory_name: request.suggestion.classification.subcategory_name,
          stock_unit: request.suggestion.uom.stock_unit,
          pack_size: request.suggestion.uom.pack_size,
          unit_type: request.suggestion.uom.unit_type,
          strength: request.suggestion.attributes.strength,
          form: request.suggestion.attributes.form,
          extracted_business_data: request.suggestion.extracted_business_data,
        },
        search_evidence: request.searchEvidence || null,
      },
      null,
      2
    );

    const controller = new AbortController();
    const timeoutMs = request.options?.timeoutMs || 10000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://geflow.app",
          "X-Title": "GeFlow AI Product Intelligence",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          response_format: { type: "json_object" },
          max_tokens: 800,
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new AIServiceError("AI_RATE_LIMITED", "OpenRouter verification rate limited.", {
            statusCode: 429,
            retryable: true,
            requestId: request.requestId,
          });
        }
        throw new Error(`OpenRouter verification error (${response.status})`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      const parsedJson = extractJsonFromContent(content || "{}");

      return {
        rawOutput: parsedJson,
        provider: this.name,
        model,
        latencyMs: Date.now() - startTime,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
      };
    } catch (err: any) {
      if (err instanceof AIServiceError) throw err;
      if (err.name === "AbortError" || String(err.message).toLowerCase().includes("aborted")) {
        throw new AIServiceError("AI_REQUEST_TIMEOUT", `OpenRouter verification timed out after ${timeoutMs}ms`, {
          statusCode: 504,
          retryable: true,
          requestId: request.requestId,
        });
      }
      throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", `OpenRouter verification error: ${err.message}`, {
        statusCode: 502,
        retryable: true,
        requestId: request.requestId,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
