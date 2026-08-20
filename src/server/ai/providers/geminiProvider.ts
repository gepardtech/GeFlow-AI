/**
 * GEFLOW AI — GEMINI PROVIDER ADAPTER (PHASE 3)
 *
 * Implements AIProviderInterface using Google Gen AI SDK (@google/genai).
 * Uses server-side process.env.GEMINI_API_KEY with lazy initialization.
 * Focuses on fast, deep product extraction and categorization.
 */

import { GoogleGenAI } from "@google/genai";
import {
  AIProviderInterface,
  AIAnalysisRequest,
  AIVerificationRequest,
  AIProviderResponse,
} from "../types";
import { AIServiceError } from "../errors";

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

export class GeminiProvider implements AIProviderInterface {
  public readonly name = "gemini" as const;
  public readonly defaultModel = "gemini-2.5-flash";

  public isConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  public async analyzeProduct(request: AIAnalysisRequest): Promise<AIProviderResponse> {
    const client = getGeminiClient();
    const modelName = request.options?.preferredModel || this.defaultModel;
    const startTime = Date.now();

    if (!client) {
      throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", "Gemini API key is not configured.", {
        statusCode: 503,
        retryable: false,
        requestId: request.requestId,
      });
    }

    const { allowedCategories, allowedSubcategories, allowedStockUnits, businessName, industryType } = request.businessContext;

    const systemPrompt = `You are GeFlow AI's Product Intelligence Engine for an inventory management system.
Your job is to parse raw product titles, descriptions, supplier invoices, or barcode lookups into a structured JSON schema.

RULES:
1. NEVER invent barcodes or SKUs. If not present in the input, return null.
2. Distinguish stock_unit (e.g. tablet, bottle, box, strip, can, piece) from volume/weight (e.g. 1.5L, 500g) and formulation strength (e.g. 500mg).
3. Do NOT set stock_unit to "liter" just because the product is 1.5 liters. The stock unit is "bottle" or "pack".
4. Pack size (e.g., 20 tablets per pack) must only be set if clearly specified or deduced. Otherwise return null.
5. Match primary_category_name and subcategory_name ONLY from the allowed catalog list below when relevant. If none match confidently, return null.
6. Extract pricing and stock counts ONLY if explicitly provided in the input (e.g. "buy:2.5 sell:5.0 qty:100"). Never invent prices or stock.

BUSINESS CATALOG CONTEXT:
- Business: "${businessName}" (Industry: ${industryType || "General Retail/Pharmacy"})
- Allowed Categories: ${JSON.stringify(allowedCategories.map((c) => ({ id: c.id, name: c.name })))}
- Allowed Subcategories: ${JSON.stringify(allowedSubcategories.map((s) => ({ id: s.id, parentId: s.parentId, name: s.name })))}
- Standard Stock Units: ${JSON.stringify(allowedStockUnits || ["piece", "box", "bottle", "strip", "tablet", "capsule", "can", "bag", "pack"])}

RESPONSE SCHEMA (Return strictly JSON):
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
  "overall_confidence": number (0.0 to 1.0),
  "field_confidence": {
    "product_name": number,
    "primary_category": number,
    "subcategory": number,
    "stock_unit": number,
    "strength": number,
    "brand": number
  },
  "warnings": string[]
}`;

    const prompt = `Input Product Text to analyze: "${request.rawInput}"`;

    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\n${prompt}` }] },
        ],
        config: {
          responseMimeType: "application/json",
          temperature: request.options?.temperature ?? 0.1,
        },
      });

      const responseText = response.text || "";
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(responseText);
      } catch (parseErr) {
        throw new AIServiceError("AI_INVALID_RESPONSE", "Gemini returned non-JSON payload.", {
          statusCode: 502,
          retryable: true,
          requestId: request.requestId,
        });
      }

      return {
        rawOutput: parsedJson,
        provider: this.name,
        model: modelName,
        latencyMs: Date.now() - startTime,
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount,
          completionTokens: response.usageMetadata?.candidatesTokenCount,
          totalTokens: response.usageMetadata?.totalTokenCount,
        },
      };
    } catch (err: any) {
      if (err instanceof AIServiceError) throw err;
      throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", `Gemini API execution failed: ${err.message}`, {
        statusCode: 502,
        retryable: true,
        requestId: request.requestId,
        details: err,
      });
    }
  }

  public async verifyProduct(request: AIVerificationRequest): Promise<AIProviderResponse> {
    const client = getGeminiClient();
    const modelName = request.options?.preferredModel || this.defaultModel;
    const startTime = Date.now();

    if (!client) {
      throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", "Gemini API key is not configured.", {
        statusCode: 503,
        retryable: false,
        requestId: request.requestId,
      });
    }

    const systemPrompt = `You are GeFlow AI's Product Consistency Auditor.
Verify whether the proposed product suggestion has logical consistency, valid UOM distinctions, and correct taxonomy.

Check specifically:
- Does stock_unit contradict the product type or volume/weight?
- Is strength distinct from pack size or stock count?
- Are categories within the business's industry context?

RETURN JSON:
{
  "is_consistent": boolean,
  "confidence_score": number (0.0 to 1.0),
  "critique_notes": string[],
  "uncertain_fields": string[],
  "corrections": {
    "product_name"?: string,
    "stock_unit"?: string,
    "pack_size"?: number,
    "strength"?: string
  }
}`;

    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt}\n\nProduct Suggestion:\n${JSON.stringify(request.suggestion, null, 2)}`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      const parsedJson = JSON.parse(response.text || "{}");
      return {
        rawOutput: parsedJson,
        provider: this.name,
        model: modelName,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      if (err instanceof AIServiceError) throw err;
      throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", `Gemini verification error: ${err.message}`, {
        statusCode: 502,
        retryable: true,
        requestId: request.requestId,
      });
    }
  }
}
