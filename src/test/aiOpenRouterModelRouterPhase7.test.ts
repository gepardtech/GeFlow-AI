/**
 * GEFLOW AI — PHASE 7: OPENROUTER INTEGRATION & AI MODEL ROUTER TEST SUITE
 *
 * Comprehensive integration, unit, safety, fallback, security, and routing tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ModelRouter } from "@/server/ai/router/modelRouter";
import { ProductAnalyzer } from "@/server/ai/analyzer/productAnalyzer";
import { ProductVerifier } from "@/server/ai/verifier/productVerifier";
import { OpenRouterProvider } from "@/server/ai/providers/openrouterProvider";
import { GeminiProvider } from "@/server/ai/providers/geminiProvider";
import { OpenAIProvider } from "@/server/ai/providers/openaiProvider";
import { HeuristicFallbackProvider } from "@/server/ai/providers/heuristicFallbackProvider";
import { aiConfigurationService } from "@/server/ai/config/aiConfigurationService";
import { credentialService } from "@/server/ai/config/credentialService";
import { generateRequestId, logTrace, getRecentTraces } from "@/server/ai/tracing";
import { extractAuthContext, verifyTenantAccess } from "@/server/ai/auth";
import { AIServiceError } from "@/server/ai/errors";
import { resetRateLimits } from "@/server/ai/rateLimiter";
import { usageLogger } from "@/server/ai/usage/usageLogger";
import { AIProviderInterface, AIAnalysisRequest } from "@/server/ai/types";

const mockBusinessContext = {
  businessId: "biz_pharma_007",
  businessName: "Al-Shifa Healthcare Pharmacy",
  industryType: "Pharmacy",
  currency: "USD",
  allowedCategories: [
    { id: "cat_analgesics", name: "Analgesics & Pain Relief", slug: "analgesics" },
    { id: "cat_antibiotics", name: "Antibiotics", slug: "antibiotics" },
    { id: "cat_gastro", name: "Gastrointestinal", slug: "gastro" },
  ],
  allowedSubcategories: [
    { id: "sub_nsaids", parentId: "cat_analgesics", name: "NSAIDs", slug: "nsaids" },
    { id: "sub_antacids", parentId: "cat_gastro", name: "Antacids", slug: "antacids" },
  ],
  allowedStockUnits: ["tablet", "capsule", "box", "strip", "bottle", "vial", "pack"],
};

describe("Phase 7: OpenRouter Integration & AI Model Router Suite", () => {
  beforeEach(() => {
    resetRateLimits();
    usageLogger.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. OpenRouter Provider Adapter & Multi-Model Registration", () => {
    it("should instantiate OpenRouterProvider and report configuration status based on environment", () => {
      const provider = new OpenRouterProvider();
      expect(provider.name).toBe("openrouter");
      expect(provider.defaultModel).toBe("meta-llama/llama-3.3-70b-instruct");
    });

    it("should have OpenRouter models registered in AIConfigurationService", () => {
      const models = aiConfigurationService.getModelsForProvider("openrouter");
      expect(models.length).toBeGreaterThanOrEqual(4);

      const llama = models.find((m) => m.model_id === "meta-llama/llama-3.3-70b-instruct");
      const claude = models.find((m) => m.model_id === "anthropic/claude-3.5-sonnet");
      const mistral = models.find((m) => m.model_id === "mistralai/mistral-large-2411");
      const deepseek = models.find((m) => m.model_id === "deepseek/deepseek-chat");

      expect(llama).toBeDefined();
      expect(claude).toBeDefined();
      expect(mistral).toBeDefined();
      expect(deepseek).toBeDefined();
    });

    it("should support dynamic model switching without changing frontend code", () => {
      expect(aiConfigurationService.getDefaultModel("openrouter")).toBe("meta-llama/llama-3.3-70b-instruct");

      // Switch default to Claude 3.5 Sonnet
      aiConfigurationService.setDefaultModel("openrouter", "anthropic/claude-3.5-sonnet");
      expect(aiConfigurationService.getDefaultModel("openrouter")).toBe("anthropic/claude-3.5-sonnet");

      // Register a brand new OpenRouter model dynamically
      aiConfigurationService.registerModel({
        id: "m_openrouter_qwen",
        provider_id: "33333333-3333-4333-a333-333333333333",
        provider_slug: "openrouter",
        model_id: "qwen/qwen-2.5-72b-instruct",
        display_name: "Qwen 2.5 72B Instruct",
        model_type: "text",
        capabilities: ["product_analysis", "product_verification"],
        is_active: true,
        is_default: true,
      });

      expect(aiConfigurationService.getDefaultModel("openrouter")).toBe("qwen/qwen-2.5-72b-instruct");

      // Restore
      aiConfigurationService.setDefaultModel("openrouter", "meta-llama/llama-3.3-70b-instruct");
    });
  });

  describe("2. Task-Based Routing & Provider Sequence Resolution", () => {
    it("should resolve task routing sequence for product_analysis", () => {
      const router = new ModelRouter();
      const seq = router.resolveProviderSequence("product_analysis");
      expect(seq.length).toBeGreaterThanOrEqual(4);
      expect(seq).toContain("gemini");
      expect(seq).toContain("openrouter");
      expect(seq).toContain("heuristic_fallback");
    });

    it("should respect preferredProvider override when requested", () => {
      const router = new ModelRouter();
      const seq = router.resolveProviderSequence("product_analysis", "openrouter");
      expect(seq[0]).toBe("openrouter");
    });

    it("should support custom routing preferences per task type", () => {
      aiConfigurationService.setTaskRouting("vision_analysis", {
        primaryProvider: "gemini",
        primaryModel: "gemini-3.1-pro-preview",
        fallbackProvider: "openrouter",
        fallbackModel: "anthropic/claude-3.5-sonnet",
      });

      const visionRouting = aiConfigurationService.getTaskRouting("vision_analysis");
      expect(visionRouting.primaryProvider).toBe("gemini");
      expect(visionRouting.primaryModel).toBe("gemini-3.1-pro-preview");
      expect(visionRouting.fallbackProvider).toBe("openrouter");
      expect(visionRouting.fallbackModel).toBe("anthropic/claude-3.5-sonnet");
    });
  });

  describe("3. Execution Flow: Primary Provider Success (No Unnecessary Calls)", () => {
    it("should execute primary Gemini provider and not call OpenRouter fallback when primary succeeds", async () => {
      const geminiCalls: string[] = [];
      const openrouterCalls: string[] = [];

      const mockGemini: AIProviderInterface = {
        name: "gemini",
        defaultModel: "gemini-3.7-flash",
        isConfigured: () => true,
        analyzeProduct: async (req) => {
          geminiCalls.push(req.rawInput);
          return {
            rawOutput: {
              product_name: "Ibuprofen 400mg",
              brand: "Advil",
              primary_category_id: "cat_analgesics",
              primary_category_name: "Analgesics & Pain Relief",
              subcategory_id: "sub_nsaids",
              subcategory_name: "NSAIDs",
              stock_unit: "box",
              pack_size: 24,
              strength: "400mg",
              overall_confidence: 0.96,
            },
            provider: "gemini",
            model: "gemini-3.7-flash",
            latencyMs: 120,
          };
        },
        verifyProduct: async () => ({
          rawOutput: { is_consistent: true, critique_notes: [] },
          provider: "gemini",
          model: "gemini-3.7-flash",
          latencyMs: 50,
        }),
      };

      const mockOpenRouter: AIProviderInterface = {
        name: "openrouter",
        defaultModel: "meta-llama/llama-3.3-70b-instruct",
        isConfigured: () => true,
        analyzeProduct: async (req) => {
          openrouterCalls.push(req.rawInput);
          return {
            rawOutput: { product_name: "Fallback Product" },
            provider: "openrouter",
            model: "meta-llama/llama-3.3-70b-instruct",
            latencyMs: 150,
          };
        },
        verifyProduct: async () => ({
          rawOutput: { is_consistent: true },
          provider: "openrouter",
          model: "meta-llama/llama-3.3-70b-instruct",
          latencyMs: 80,
        }),
      };

      const router = new ModelRouter([mockGemini, mockOpenRouter, new HeuristicFallbackProvider()]);
      const analyzer = new ProductAnalyzer(router);

      const suggestion = await analyzer.analyze({
        requestId: "GF-AI-TEST-PRIMARY-001",
        userId: "user-1",
        businessId: mockBusinessContext.businessId,
        rawInput: "Advil Ibuprofen 400mg box of 24",
        businessContext: mockBusinessContext,
      });

      expect(geminiCalls.length).toBe(1);
      expect(openrouterCalls.length).toBe(0); // OpenRouter NOT called
      expect(suggestion.identification.product_name).toBe("Ibuprofen 400mg");
      expect(suggestion.uom.stock_unit).toBe("box");
      expect(suggestion.uom.pack_size).toBe(24);
    });
  });

  describe("4. Execution Flow: Primary Technical Failure -> OpenRouter Fallback", () => {
    it("should automatically fail over to OpenRouter when Gemini encounters a technical timeout or network error", async () => {
      let openrouterAttempted = false;

      const mockGeminiFailing: AIProviderInterface = {
        name: "gemini",
        defaultModel: "gemini-3.7-flash",
        isConfigured: () => true,
        analyzeProduct: async () => {
          throw new AIServiceError("AI_REQUEST_TIMEOUT", "Gemini upstream gateway timeout", {
            statusCode: 504,
            retryable: true,
          });
        },
        verifyProduct: async () => {
          throw new Error("Timeout");
        },
      };

      const mockOpenRouterSucceeding: AIProviderInterface = {
        name: "openrouter",
        defaultModel: "meta-llama/llama-3.3-70b-instruct",
        isConfigured: () => true,
        analyzeProduct: async () => {
          openrouterAttempted = true;
          return {
            rawOutput: {
              product_name: "Augmentin 625mg",
              brand: "GSK",
              primary_category_id: "cat_antibiotics",
              primary_category_name: "Antibiotics",
              stock_unit: "strip",
              pack_size: 14,
              strength: "625mg",
              overall_confidence: 0.92,
            },
            provider: "openrouter",
            model: "meta-llama/llama-3.3-70b-instruct",
            latencyMs: 210,
          };
        },
        verifyProduct: async () => ({
          rawOutput: { is_consistent: true, critique_notes: [] },
          provider: "openrouter",
          model: "meta-llama/llama-3.3-70b-instruct",
          latencyMs: 100,
        }),
      };

      const router = new ModelRouter([mockGeminiFailing, mockOpenRouterSucceeding, new HeuristicFallbackProvider()]);
      const analyzer = new ProductAnalyzer(router);

      const suggestion = await analyzer.analyze({
        requestId: "GF-AI-TEST-FALLBACK-002",
        userId: "user-1",
        businessId: mockBusinessContext.businessId,
        rawInput: "Augmentin 625mg strip 14 tablets",
        businessContext: mockBusinessContext,
      });

      expect(openrouterAttempted).toBe(true);
      expect(suggestion.identification.product_name).toBe("Augmentin 625mg");
      expect(suggestion.uom.stock_unit).toBe("strip");
      expect(suggestion.uom.pack_size).toBe(14);
    });
  });

  describe("5. Execution Flow: Dual Failure -> Local Heuristic Engine & Infinite Loop Prevention", () => {
    it("should gracefully fall back to local heuristic engine and never loop endlessly when all cloud providers fail", async () => {
      const mockGeminiFailing: AIProviderInterface = {
        name: "gemini",
        defaultModel: "gemini-3.7-flash",
        isConfigured: () => true,
        analyzeProduct: async () => {
          throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", "Gemini 503 Outage");
        },
        verifyProduct: async () => {
          throw new Error("Failed");
        },
      };

      const mockOpenRouterFailing: AIProviderInterface = {
        name: "openrouter",
        defaultModel: "meta-llama/llama-3.3-70b-instruct",
        isConfigured: () => true,
        analyzeProduct: async () => {
          throw new AIServiceError("AI_RATE_LIMITED", "OpenRouter 429 Rate Limit");
        },
        verifyProduct: async () => {
          throw new Error("Failed");
        },
      };

      const router = new ModelRouter([
        mockGeminiFailing,
        mockOpenRouterFailing,
        new HeuristicFallbackProvider(),
      ]);
      const analyzer = new ProductAnalyzer(router);

      const suggestion = await analyzer.analyze({
        requestId: "GF-AI-TEST-DUAL-FAIL-003",
        userId: "user-1",
        businessId: mockBusinessContext.businessId,
        rawInput: "Paracetamol 500mg box of 20 tablets",
        businessContext: mockBusinessContext,
      });

      // Must return deterministic parsed suggestion without crashing or throwing unhandled exception
      expect(suggestion).toBeDefined();
      expect(suggestion.identification.product_name).toContain("Paracetamol 500mg");
      expect(mockBusinessContext.allowedStockUnits).toContain(suggestion.uom.stock_unit);
    });
  });

  describe("6. Low Confidence vs. Technical Failure", () => {
    it("should NOT treat low confidence as a technical failure and should run verification workflow", async () => {
      let openrouterFallbackCalled = false;

      const mockGeminiLowConfidence: AIProviderInterface = {
        name: "gemini",
        defaultModel: "gemini-3.7-flash",
        isConfigured: () => true,
        analyzeProduct: async () => ({
          rawOutput: {
            product_name: "Mystery Med",
            stock_unit: "tablet",
            overall_confidence: 0.42,
            warnings: ["Uncertain packaging"],
          },
          provider: "gemini",
          model: "gemini-3.7-flash",
          latencyMs: 90,
        }),
        verifyProduct: async () => ({
          rawOutput: { is_consistent: false, critique_notes: ["Unclear dosage"] },
          provider: "gemini",
          model: "gemini-3.7-flash",
          latencyMs: 40,
        }),
      };

      const mockOpenRouter: AIProviderInterface = {
        name: "openrouter",
        defaultModel: "meta-llama/llama-3.3-70b-instruct",
        isConfigured: () => true,
        analyzeProduct: async () => {
          openrouterFallbackCalled = true;
          return {
            rawOutput: { product_name: "Other" },
            provider: "openrouter",
            model: "meta-llama/llama-3.3-70b-instruct",
            latencyMs: 100,
          };
        },
        verifyProduct: async () => ({
          rawOutput: { is_consistent: true },
          provider: "openrouter",
          model: "meta-llama/llama-3.3-70b-instruct",
          latencyMs: 50,
        }),
      };

      const router = new ModelRouter([mockGeminiLowConfidence, mockOpenRouter, new HeuristicFallbackProvider()]);
      const verifier = new ProductVerifier(router);
      const analyzer = new ProductAnalyzer(router, verifier);

      const suggestion = await analyzer.analyze({
        requestId: "GF-AI-TEST-LOWCONF-004",
        userId: "user-1",
        businessId: mockBusinessContext.businessId,
        rawInput: "Mystery Med",
        businessContext: mockBusinessContext,
      });

      expect(openrouterFallbackCalled).toBe(false); // Should NOT trigger technical fallback
      expect(suggestion.identification.product_name).toBe("Mystery Med");
      expect(suggestion.needs_review).toBe(true);
      expect(suggestion.confidence_level).toBe("low");
    });
  });

  describe("7. Authoritative Taxonomy Validation (Admin Categories & UOMs)", () => {
    it("should flag invalid/unmatched category with needs_review=true and not auto-create it", async () => {
      const mockProvider: AIProviderInterface = {
        name: "openrouter",
        defaultModel: "meta-llama/llama-3.3-70b-instruct",
        isConfigured: () => true,
        analyzeProduct: async () => ({
          rawOutput: {
            product_name: "Exotic Elixir",
            primary_category_id: "unknown_category_999",
            primary_category_name: "Space Alchemy",
            stock_unit: "tablet",
            overall_confidence: 0.9,
          },
          provider: "openrouter",
          model: "meta-llama/llama-3.3-70b-instruct",
          latencyMs: 80,
        }),
        verifyProduct: async () => ({
          rawOutput: {
            is_consistent: false,
            critique_notes: ["Category Space Alchemy does not exist in business catalog."],
          },
          provider: "openrouter",
          model: "meta-llama/llama-3.3-70b-instruct",
          latencyMs: 40,
        }),
      };

      const router = new ModelRouter([mockProvider, new HeuristicFallbackProvider()]);
      const verifier = new ProductVerifier(router);
      const analyzer = new ProductAnalyzer(router, verifier);

      const suggestion = await analyzer.analyze({
        requestId: "GF-AI-TEST-CAT-VALID-005",
        userId: "user-1",
        businessId: mockBusinessContext.businessId,
        rawInput: "Exotic Elixir Space Alchemy",
        businessContext: mockBusinessContext,
      });

      expect(suggestion.needs_review).toBe(true);
      expect(suggestion.classification.primary_category_id).toBeNull();
    });

    it("should flag invalid UOM not configured in business catalog with needs_review=true", async () => {
      const mockProvider: AIProviderInterface = {
        name: "openrouter",
        defaultModel: "meta-llama/llama-3.3-70b-instruct",
        isConfigured: () => true,
        analyzeProduct: async () => ({
          rawOutput: {
            product_name: "Engine Fluid",
            primary_category_id: "cat_analgesics",
            primary_category_name: "Analgesics & Pain Relief",
            stock_unit: "drum", // Not in pharmacy allowedStockUnits
            overall_confidence: 0.95,
          },
          provider: "openrouter",
          model: "meta-llama/llama-3.3-70b-instruct",
          latencyMs: 80,
        }),
        verifyProduct: async () => ({
          rawOutput: { is_consistent: false },
          provider: "openrouter",
          model: "meta-llama/llama-3.3-70b-instruct",
          latencyMs: 40,
        }),
      };

      const router = new ModelRouter([mockProvider, new HeuristicFallbackProvider()]);
      const verifier = new ProductVerifier(router);
      const analyzer = new ProductAnalyzer(router, verifier);

      const suggestion = await analyzer.analyze({
        requestId: "GF-AI-TEST-UOM-VALID-006",
        userId: "user-1",
        businessId: mockBusinessContext.businessId,
        rawInput: "Engine Fluid in 50 gallon drum",
        businessContext: mockBusinessContext,
      });

      expect(suggestion.needs_review).toBe(true);
      expect(suggestion.uncertain_fields).toContain("stock_unit");
    });
  });

  describe("8. Security & Business Isolation", () => {
    it("should never expose OpenRouter or Gemini API keys in responses or traces", () => {
      process.env.OPENROUTER_API_KEY = "sk-or-v1-9876543210abcdef9876543210abcdef";
      const status = credentialService.getCredentialStatus("openrouter");

      expect(status.isConfigured).toBe(true);
      expect(status.maskedKey).toBe("sk-o...cdef");
      expect(status.maskedKey).not.toContain("9876543210abcdef9876");

      const traceId = generateRequestId("GF-AI");
      expect(traceId).toMatch(/^GF-AI-\d+-[A-Z0-9]+$/);

      logTrace({
        requestId: traceId,
        userId: "u-1",
        businessId: "b-1",
        taskType: "product_analysis",
        provider: "openrouter",
        model: "meta-llama/llama-3.3-70b-instruct",
        status: "success",
        latencyMs: 140,
        createdAt: new Date().toISOString(),
      });

      const traces = getRecentTraces("b-1");
      expect(traces.length).toBeGreaterThan(0);
      const str = JSON.stringify(traces);
      expect(str).not.toContain("sk-or-v1-9876543210abcdef");
    });

    it("should reject cross-tenant business access during AI execution", () => {
      const auth = { userId: "user-tenant-a", email: "user@tenant-a.com" };

      expect(() => {
        verifyTenantAccess(auth, "biz_tenant_a", "GF-AI-REQ-1");
      }).not.toThrow();

      expect(() => {
        verifyTenantAccess(auth, "", "GF-AI-REQ-2");
      }).toThrow(AIServiceError);

      expect(() => {
        verifyTenantAccess(auth, "biz_target/../malicious", "GF-AI-REQ-3");
      }).toThrow(AIServiceError);
    });
  });
});
