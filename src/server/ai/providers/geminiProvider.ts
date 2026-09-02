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
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

export class GeminiProvider implements AIProviderInterface {
  public readonly name = "gemini" as const;
  public readonly defaultModel = "gemini-3.7-flash";

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
2. Contextually determine stock_unit (e.g. piece, pack, packet, box, bottle, can, strip, tablet, capsule, kg, g, liter):
   - For bakery / biscuits / cookies / snacks / confectionery / grocery (e.g. "biscuit", "buscit", "oreo", "cookie", "cake", "chips", "crisps", "rusk", "chocolate", "candy", "noodles", "pasta"): stock_unit MUST be "pack", "packet", "box", or "piece" (STRICTLY FORBIDDEN to use "tablet", "capsule", "strip", or "vial").
   - For beverages / drinks / juices / sodas: stock_unit is "bottle", "can", or "pack".
   - ONLY for pharmaceutical medicines / drugs in pharmacy businesses (e.g. Panadol, Paracetamol 500mg, Amoxicillin pills): stock_unit may be "tablet", "capsule", "strip", "bottle", "vial", or "box".
   - For general merchandise / electronics / apparel / hardware: "piece", "box", "set", "pair", or "pack".
3. Distinguish stock_unit from volume/weight (e.g. 1.5L, 500g, 100ml) and formulation strength (e.g. 500mg).
4. Do NOT set stock_unit to "liter" just because the product is 1.5 liters. The stock unit is "bottle" or "pack".
5. Packaging and Pack size: "box of 16 pack", "pack of 12", "20 tablets", "x10" represent packaging counts (pack_size). In "box of 16 pack", pack_size is 16, stock_unit is "pack" or "box". NEVER confuse pack size with price or purchase cost!
6. Match primary_category_name and subcategory_name ONLY from the allowed catalog list below when relevant. If none match confidently, return null.
7. PRICING EXTRACTION:
   - If user provides currency prices (e.g. "20RS", "20 RS", "Rs 20", "PKR 20", "20/-", "$20", "20 rupees", "price: 20", "sell: 20") without specifying cost/buy, assign this value directly to retail_price (e.g. 20).
   - If user explicitly writes "buy: 15" or "cost: 15", assign to purchase_cost.
   - Never confuse packaging counts (like "box of 16 pack") with purchase cost or retail price! Example: "Sooper biscuit 20RS box of 16 pack" -> product_name: "Sooper Biscuit", retail_price: 20, pack_size: 16, purchase_cost: null, stock_unit: "pack".
8. WEIGHT & MASS UNITS:
   - 1 Kilogram (kg) = 1,000 grams (g).
   - 500 grams (500g) = 0.5 kg (Half kg). It is NOT 500 kg, NOT 1 Mann, and NOT more than 1 kg!
   - 1 Mann (Maund) = 40 kg = 40,000 grams.
   - If input has "500g" or "250g", weight is {"value": 500, "unit": "g"}. NEVER set unit to "kg" with value 500!

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
