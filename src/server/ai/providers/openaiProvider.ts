/**
 * GEFLOW AI — OPENAI PROVIDER ADAPTER (PHASE 3)
 *
 * Implements AIProviderInterface for OpenAI API.
 * Uses process.env.OPENAI_API_KEY with lazy evaluation.
 * Primary role: Product Verification, reasoning, taxonomy auditing, and analysis fallback.
 */

import {
  AIProviderInterface,
  AIAnalysisRequest,
  AIVerificationRequest,
  AIProviderResponse,
} from "../types";
import { AIServiceError } from "../errors";

export class OpenAIProvider implements AIProviderInterface {
  public readonly name = "openai" as const;
  public readonly defaultModel = "gpt-4o-mini";

  public isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  public async analyzeProduct(request: AIAnalysisRequest): Promise<AIProviderResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = request.options?.preferredModel || this.defaultModel;
    const startTime = Date.now();

    if (!apiKey) {
      throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", "OpenAI API key is not configured.", {
        statusCode: 503,
        retryable: false,
        requestId: request.requestId,
      });
    }

    const { allowedCategories, allowedSubcategories, allowedStockUnits, businessName, industryType } = request.businessContext;

    const systemPrompt = `You are GeFlow AI's Product Intelligence Engine.
Extract product name, brand, dosage/strength, stock unit, pack size, category IDs, volume/weight, and financials from raw text.

RULES:
- For bakery / biscuits / cookies / snacks / confectionery / grocery (e.g. "biscuit", "buscit", "oreo", "cookie", "cake", "chips", "crisps", "rusk", "chocolate", "candy"): stock_unit MUST be "pack", "packet", "box", or "piece" (STRICTLY FORBIDDEN to use "tablet", "capsule", "strip", or "vial").
- For beverages / drinks / juices / sodas: stock_unit is "bottle", "can", or "pack".
- ONLY for pharmaceutical medicines / drugs in pharmacy businesses (e.g. Panadol, Paracetamol 500mg, Amoxicillin pills): stock_unit may be "tablet", "capsule", "strip", "bottle", "vial", or "box".
- For general merchandise: "piece", "box", "set", "pair", or "pack".
- Packaging & Pack size: "box of 16 pack", "pack of 12", "20 tablets", "x10" represent pack_size. In "box of 16 pack", pack_size is 16, stock_unit is "pack" or "box".
- PRICING: If user provides prices like "20RS", "20 RS", "Rs 20", "PKR 20", "20/-", "$20", "20 rupees" without specifying cost/buy, assign this value directly to retail_price (e.g. 20). Never assign pack size (like 16 pack) to price or cost!
- WEIGHT & MASS: 1 Kilogram (kg) = 1,000 grams (g). 500 grams (500g) = 0.5 kg (Half a kg). 1 Mann = 40 kg = 40,000 grams. If input has "500g" or "250g", weight is {"value": 500, "unit": "g"}. NEVER set unit to "kg" with value 500!

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

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: request.rawInput },
          ],
          response_format: { type: "json_object" },
          temperature: request.options?.temperature ?? 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      const parsedJson = JSON.parse(content || "{}");

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
      throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", `OpenAI execution failed: ${err.message}`, {
        statusCode: 502,
        retryable: true,
        requestId: request.requestId,
        details: err,
      });
    }
  }

  public async verifyProduct(request: AIVerificationRequest): Promise<AIProviderResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = request.options?.preferredModel || this.defaultModel;
    const startTime = Date.now();

    if (!apiKey) {
      throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", "OpenAI API key is not configured.", {
        statusCode: 503,
        retryable: false,
        requestId: request.requestId,
      });
    }

    const { allowedCategories, allowedSubcategories, allowedStockUnits, businessName, industryType } =
      request.businessContext;

    const originalInput = request.originalInput || request.suggestion.identification.product_name;

    const systemPrompt = `You are GeFlow AI's Product Consistency & Verification Auditor.
Your role is to AUDIT and VERIFY a candidate product suggestion produced by an intake engine against the original user input, allowed business taxonomy, and supporting evidence.
You are a VERIFIER, NOT a generator. You must never invent unconfirmed data or accept arbitrary categories/UOMs not configured by the business.

VERIFICATION RULES:
1. FIELD-LEVEL VERIFICATION: Verify each field individually (product_name, primary_category, subcategory, stock_unit, strength, pack_size, barcode, pricing).
   Assign each field a status: "verified" | "suggested" | "uncertain" | "conflicting" | "invalid" | "not_identified".
2. CATEGORY VERIFICATION: Admin-configured categories are authoritative. If candidate category is not in allowedCategories, mark category as "invalid" (matched_id: null).
3. SUBCATEGORY VERIFICATION: Subcategory must exist in allowedSubcategories and be valid under the selected category. Otherwise mark "invalid".
4. UOM VERIFICATION: Candidate stock_unit must exist in allowedStockUnits. If not allowed, mark "invalid".
5. CONTRADICTION DETECTION: If candidate contradicts original input (e.g. input says "capsule" but candidate says "tablet", or input says "250mg" but candidate says "500mg"), flag as "conflicting", provide suggested_correction, and set needs_review = true.
6. MISSING / INVENTED INFO: If candidate has strength or pack_size that is completely absent from original input or evidence, mark as "uncertain", verified = false, and set needs_review = true. Do not claim fabricated data is confirmed.
7. SEARCH EVIDENCE: If search evidence is provided, evaluate it as auxiliary info. If it conflicts with input, set needs_review = true.

RETURN STRICT JSON FORMAT:
{
  "is_consistent": boolean,
  "confidence_score": number (0.0 to 1.0),
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

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          response_format: { type: "json_object" },
          temperature: 0.05,
        }),
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI verification HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      const parsedJson = JSON.parse(content || "{}");

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
      throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", `OpenAI verification error: ${err.message}`, {
        statusCode: 502,
        retryable: true,
        requestId: request.requestId,
        details: err,
      });
    }
  }
}
