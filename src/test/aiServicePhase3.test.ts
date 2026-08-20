import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModelRouter } from "@/server/ai/router/modelRouter";
import { ProductAnalyzer } from "@/server/ai/analyzer/productAnalyzer";
import { ProductVerifier } from "@/server/ai/verifier/productVerifier";
import { HeuristicFallbackProvider } from "@/server/ai/providers/heuristicFallbackProvider";
import { AIProviderInterface, AIAnalysisRequest, AIVerificationRequest } from "@/server/ai/types";
import { normalizeProviderOutput } from "@/server/ai/normalizers/responseNormalizer";
import { AIServiceError } from "@/server/ai/errors";
import { enforceRateLimit, resetRateLimits } from "@/server/ai/rateLimiter";
import { verifyTenantAccess } from "@/server/ai/auth";

const mockBusinessContext = {
  businessId: "biz_pharmacy_001",
  businessName: "CarePlus Pharmacy",
  industryType: "Pharmacy",
  currency: "$",
  allowedCategories: [
    { id: "cat_meds", name: "Medicines & Treatments" },
    { id: "cat_vitamins", name: "Vitamins & Supplements" },
  ],
  allowedSubcategories: [
    { id: "sub_pain", parentId: "cat_meds", name: "Pain Relief" },
    { id: "sub_anti", parentId: "cat_meds", name: "Antibiotics" },
  ],
  allowedStockUnits: ["tablet", "capsule", "bottle", "strip", "piece"],
};

describe("Phase 3: AI Service Layer Architecture", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.restoreAllMocks();
  });

  describe("1. Provider Abstraction Contract", () => {
    it("should instantiate heuristic provider and adhere to AIProviderInterface", async () => {
      const provider = new HeuristicFallbackProvider();
      expect(provider.name).toBe("heuristic_fallback");
      expect(provider.isConfigured()).toBe(true);

      const res = await provider.analyzeProduct({
        requestId: "test-req-1",
        userId: "user-1",
        businessId: "biz-1",
        rawInput: "Panadol 500mg 20 tablets",
        businessContext: mockBusinessContext,
      });

      expect(res.provider).toBe("heuristic_fallback");
      expect(res.rawOutput).toBeDefined();
    });

    it("should allow custom mock providers to plug into the provider interface", async () => {
      const mockCustomProvider: AIProviderInterface = {
        name: "mock" as any,
        defaultModel: "mock-v1",
        isConfigured: () => true,
        analyzeProduct: async (req) => ({
          rawOutput: {
            product_name: "Mock Product",
            stock_unit: "box",
            pack_size: 10,
            overall_confidence: 0.95,
          },
          provider: "mock" as any,
          model: "mock-v1",
          latencyMs: 15,
        }),
        verifyProduct: async () => ({
          rawOutput: { is_consistent: true, critique_notes: [] },
          provider: "mock" as any,
          model: "mock-v1",
          latencyMs: 10,
        }),
      };

      const router = new ModelRouter([mockCustomProvider, new HeuristicFallbackProvider()]);
      const analyzer = new ProductAnalyzer(router);

      const suggestion = await analyzer.analyze({
        requestId: "test-mock-req",
        userId: "user-test",
        businessId: "biz_pharmacy_001",
        rawInput: "Test input",
        businessContext: mockBusinessContext,
      });

      expect(suggestion.identification.product_name).toBe("Mock Product");
      expect(suggestion.uom.stock_unit).toBe("box");
      expect(suggestion.uom.pack_size).toBe(10);
    });
  });

  describe("2. Response Normalizer", () => {
    it("should convert arbitrary provider outputs into the Phase 2 ProductSuggestion schema", () => {
      const providerOutput = {
        rawOutput: {
          product_name: "Amoxicillin 500mg",
          brand: "GSK",
          stock_unit: "capsule",
          pack_size: 30,
          strength: "500mg",
          primary_category_name: "Medicines & Treatments",
          purchase_cost: 12.5,
          retail_price: 20.0,
          overall_confidence: 0.92,
        },
        provider: "gemini" as const,
        model: "gemini-2.5-flash",
        latencyMs: 120,
      };

      const normalized = normalizeProviderOutput(
        providerOutput,
        {
          allowedPrimaryCategories: mockBusinessContext.allowedCategories,
          allowedSubcategories: mockBusinessContext.allowedSubcategories,
        },
        "req-normalizer-test"
      );

      expect(normalized.identification.product_name).toBe("Amoxicillin 500mg");
      expect(normalized.identification.brand).toBe("GSK");
      expect(normalized.uom.stock_unit).toBe("capsule");
      expect(normalized.uom.pack_size).toBe(30);
      expect(normalized.classification.primary_category_id).toBe("cat_meds");
      expect(normalized.extracted_business_data.purchase_cost).toBe(12.5);
      expect(normalized.ai_metadata.provider).toBe("gemini");
      expect(normalized.ai_metadata.model).toBe("gemini-2.5-flash");
      expect(normalized.ai_metadata.request_id).toBe("req-normalizer-test");
    });
  });

  describe("3. Product Verifier & Taxonomy Audit", () => {
    it("should flag inconsistent product data like negative profit margin and missing categories", async () => {
      const router = new ModelRouter([new HeuristicFallbackProvider()]);
      const verifier = new ProductVerifier(router);

      const invalidSuggestion: any = {
        identification: { product_name: "A" },
        classification: { primary_category_id: "non-existent-cat" },
        uom: { unit_type: "volume", stock_unit: "bottle", volume: null },
        attributes: {},
        extracted_business_data: {
          purchase_cost: 50.0,
          retail_price: 30.0, // negative margin
        },
        overall_confidence: 0.8,
        warnings: [],
        uncertain_fields: [],
        confidence_level: "medium",
        needs_review: false,
      };

      const result = await verifier.verify(
        invalidSuggestion,
        mockBusinessContext,
        "user-audit-1",
        "req-audit-1"
      );

      expect(result.critiqueNotes.length).toBeGreaterThan(0);
      expect(result.critiqueNotes.some((n) => n.includes("negative profit margin"))).toBe(true);
      expect(result.uncertainFields).toContain("primary_category");
      expect(result.uncertainFields).toContain("volume");
      expect(result.isConsistent).toBe(false);
    });
  });

  describe("4. Model Router Fallback & Controlled Retries", () => {
    it("should gracefully fall back to heuristic engine when primary cloud providers fail", async () => {
      const failingProvider: AIProviderInterface = {
        name: "gemini",
        defaultModel: "gemini-2.5-flash",
        isConfigured: () => true,
        analyzeProduct: async () => {
          throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", "Gemini API unavailable");
        },
        verifyProduct: async () => {
          throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", "Gemini API unavailable");
        },
      };

      const router = new ModelRouter([failingProvider, new HeuristicFallbackProvider()]);
      const analyzer = new ProductAnalyzer(router);

      const res = await analyzer.analyze({
        requestId: "req-fallback-test",
        userId: "user-1",
        businessId: "biz_pharmacy_001",
        rawInput: "Coca Cola 1.5L bottle",
        businessContext: mockBusinessContext,
      });

      expect(res).toBeDefined();
      expect(res.identification.product_name.toLowerCase()).toContain("coca");
      expect(res.uom.stock_unit).toBe("bottle");
    });
  });

  describe("5. Tenant Isolation & Auth Boundaries", () => {
    it("should reject unauthorized or malformed business queries", () => {
      const user = { userId: "user-123" };
      expect(() => verifyTenantAccess(user, "", "req-1")).toThrowError(AIServiceError);
      expect(() => verifyTenantAccess(user, "biz/../hack", "req-2")).toThrowError(AIServiceError);
      expect(() => verifyTenantAccess(user, "biz_valid_001", "req-3")).not.toThrow();
    });
  });

  describe("6. Rate Limiting", () => {
    it("should enforce sliding window rate limiting per user", () => {
      const user = "rate_limited_user";
      const biz = "rate_limited_biz";

      for (let i = 0; i < 30; i++) {
        enforceRateLimit(user, biz, `req-${i}`);
      }

      expect(() => enforceRateLimit(user, biz, "req-overflow")).toThrowError(AIServiceError);
    });
  });
});
