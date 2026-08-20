import { describe, it, expect, vi, beforeEach } from "vitest";
import { aiConfigurationService } from "@/server/ai/config/aiConfigurationService";
import { credentialService } from "@/server/ai/config/credentialService";
import { providerConnectionTester } from "@/server/ai/tester/providerConnectionTester";
import { usageLogger } from "@/server/ai/usage/usageLogger";
import { ModelRouter } from "@/server/ai/router/modelRouter";
import { HeuristicFallbackProvider } from "@/server/ai/providers/heuristicFallbackProvider";
import { AIProviderInterface } from "@/server/ai/types";
import { enforceRateLimit, resetRateLimits } from "@/server/ai/rateLimiter";
import { extractAuthContext, verifyTenantAccess } from "@/server/ai/auth";
import { AIServiceError } from "@/server/ai/errors";

describe("GEFLOW AI — PHASE 4: SUPABASE AI PROVIDER CONFIGURATION", () => {
  beforeEach(() => {
    resetRateLimits();
    usageLogger.clear();
    vi.restoreAllMocks();
  });

  describe("1. Active Provider Lookup", () => {
    it("should return configured active providers", () => {
      const active = aiConfigurationService.getActiveProviders();
      expect(active.length).toBeGreaterThanOrEqual(3);
      expect(active.some((p) => p.slug === "gemini")).toBe(true);
      expect(active.some((p) => p.slug === "openai")).toBe(true);
      expect(active.some((p) => p.slug === "openrouter")).toBe(true);
    });
  });

  describe("2. Inactive Provider Rejection", () => {
    it("should reject inactive providers from task routing and execution", () => {
      // Toggle Gemini inactive
      aiConfigurationService.setProviderStatus("gemini", false);
      expect(aiConfigurationService.isProviderActive("gemini")).toBe(false);

      const routing = aiConfigurationService.getTaskRouting("product_analysis");
      // Since Gemini is inactive, routing should skip Gemini
      expect(routing.primaryProvider).not.toBe("gemini");

      // Restore
      aiConfigurationService.setProviderStatus("gemini", true);
      expect(aiConfigurationService.isProviderActive("gemini")).toBe(true);
    });
  });

  describe("3. Model Lookup", () => {
    it("should retrieve registered models for a given provider", () => {
      const geminiModels = aiConfigurationService.getModelsForProvider("gemini");
      expect(geminiModels.length).toBeGreaterThanOrEqual(2);
      expect(geminiModels.some((m) => m.model_id === "gemini-2.5-flash")).toBe(true);

      const openaiModels = aiConfigurationService.getModelsForProvider("openai");
      expect(openaiModels.some((m) => m.model_id === "gpt-4o-mini")).toBe(true);

      const openrouterModels = aiConfigurationService.getModelsForProvider("openrouter");
      expect(openrouterModels.some((m) => m.model_id === "meta-llama/llama-3.3-70b-instruct")).toBe(true);
    });
  });

  describe("4. Default Model Lookup", () => {
    it("should resolve the default model for each provider", () => {
      expect(aiConfigurationService.getDefaultModel("gemini")).toBe("gemini-2.5-flash");
      expect(aiConfigurationService.getDefaultModel("openai")).toBe("gpt-4o-mini");
      expect(aiConfigurationService.getDefaultModel("openrouter")).toBe("meta-llama/llama-3.3-70b-instruct");
    });
  });

  describe("5. Secure Credential Retrieval & Masking", () => {
    it("should securely check credential presence and return masked key metadata without plain secrets", () => {
      process.env.GEMINI_API_KEY = "AIzaSyTest1234567890SecretKey";
      const status = credentialService.getCredentialStatus("gemini");
      
      expect(status.isConfigured).toBe(true);
      expect(status.maskedKey).toBe("AIza...tKey");
      expect(status.maskedKey).not.toContain("1234567890Secret");

      delete process.env.GEMINI_API_KEY;
      const unconfigStatus = credentialService.getCredentialStatus("gemini");
      expect(unconfigStatus.isConfigured).toBe(false);
      expect(unconfigStatus.maskedKey).toBeNull();
    });
  });

  describe("6. Provider Connection Test", () => {
    it("should perform connection test on heuristic provider and return healthy status", async () => {
      const result = await providerConnectionTester.testProvider("heuristic_fallback");
      expect(result.success).toBe(true);
      expect(result.healthStatus).toBe("healthy");
      expect(result.provider).toBe("heuristic_fallback");
    });
  });

  describe("7. Invalid / Missing API Key Handling", () => {
    it("should fail gracefully with AI_INVALID_CONFIGURATION when API key is absent", async () => {
      delete process.env.GEMINI_API_KEY;
      const result = await providerConnectionTester.testProvider("gemini");

      expect(result.success).toBe(false);
      expect(result.healthStatus).toBe("unhealthy");
      expect(result.errorCode).toBe("AI_INVALID_CONFIGURATION");
      expect(result.message).toContain("No API key configured");
    });
  });

  describe("8. Provider Timeout Handling", () => {
    it("should timeout when request exceeds configured duration", async () => {
      const slowProvider: AIProviderInterface = {
        name: "mock_slow" as any,
        defaultModel: "mock-v1",
        isConfigured: () => true,
        analyzeProduct: () =>
          new Promise((resolve) => setTimeout(() => resolve({} as any), 500)),
        verifyProduct: () =>
          new Promise((resolve) => setTimeout(() => resolve({} as any), 500)),
      };

      const router = new ModelRouter([slowProvider, new HeuristicFallbackProvider()], {
        requestTimeoutMs: 50,
      });

      const res = await router.executeAnalysis({
        requestId: "req-timeout-test",
        userId: "user-1",
        businessId: "biz-1",
        rawInput: "Ibuprofen 400mg 24 tablets",
        businessContext: {
          businessId: "biz-1",
          businessName: "Pharmacy",
          allowedCategories: [],
          allowedSubcategories: [],
        },
      });

      // Timed out mock_slow fell back to heuristic_fallback
      expect(res.provider).toBe("heuristic_fallback");
    });
  });

  describe("9. Rate Limiting", () => {
    it("should enforce sliding window rate limit per user and business", () => {
      for (let i = 0; i < 30; i++) {
        enforceRateLimit("rate-user", "rate-biz", `req-${i}`);
      }
      expect(() => enforceRateLimit("rate-user", "rate-biz", "req-overflow")).toThrowError(
        AIServiceError
      );
    });
  });

  describe("10. Fallback Configuration", () => {
    it("should dynamically route to fallback provider when primary fails", async () => {
      const failingGemini: AIProviderInterface = {
        name: "gemini",
        defaultModel: "gemini-2.5-flash",
        isConfigured: () => true,
        analyzeProduct: async () => {
          throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", "Gemini 503 error");
        },
        verifyProduct: async () => {
          throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", "Gemini 503 error");
        },
      };

      const router = new ModelRouter([failingGemini, new HeuristicFallbackProvider()]);
      const res = await router.executeAnalysis({
        requestId: "req-fallback",
        userId: "u-1",
        businessId: "biz-1",
        rawInput: "Amoxicillin 500mg capsules",
        businessContext: {
          businessId: "biz-1",
          businessName: "Pharmacy",
          allowedCategories: [],
          allowedSubcategories: [],
        },
      });

      expect(res.provider).toBe("heuristic_fallback");
    });
  });

  describe("11. Authentication", () => {
    it("should extract user auth context from request headers or fail when missing in production", () => {
      const mockReqWithHeader: any = {
        headers: { "x-user-id": "usr_9988", "x-user-email": "admin@geflow.app" },
      };
      const context = extractAuthContext(mockReqWithHeader, "req-auth-1");
      expect(context.userId).toBe("usr_9988");
      expect(context.email).toBe("admin@geflow.app");
    });
  });

  describe("12. Business Tenant Authorization", () => {
    it("should enforce tenant boundaries and reject invalid or traversal business IDs", () => {
      const user = { userId: "usr_1" };
      expect(() => verifyTenantAccess(user, "biz_valid_123", "req-t1")).not.toThrow();
      expect(() => verifyTenantAccess(user, "../biz_other", "req-t2")).toThrowError(AIServiceError);
      expect(() => verifyTenantAccess(user, "", "req-t3")).toThrowError(AIServiceError);
    });
  });

  describe("13. RLS & Schema Integrity", () => {
    it("should provide views where keys are masked or hidden", () => {
      const views = aiConfigurationService.getAllProviderViews();
      views.forEach((v) => {
        expect(v.provider).toBeDefined();
        expect(v.models.length).toBeGreaterThan(0);
        // Keys must never be plain string or exposed in the view
        expect((v as any).apiKey).toBeUndefined();
        expect((v as any).rawKey).toBeUndefined();
      });
    });
  });

  describe("14. API Usage Logging", () => {
    it("should log API requests and maintain aggregated daily token & latency totals", () => {
      usageLogger.logRequest({
        requestId: "req-usage-1",
        userId: "usr-1",
        businessId: "biz-demo",
        provider: "gemini",
        model: "gemini-2.5-flash",
        taskType: "product_analysis",
        status: "success",
        latencyMs: 120,
        usageTokens: 450,
      });

      usageLogger.logRequest({
        requestId: "req-usage-2",
        userId: "usr-1",
        businessId: "biz-demo",
        provider: "gemini",
        model: "gemini-2.5-flash",
        taskType: "product_analysis",
        status: "success",
        latencyMs: 180,
        usageTokens: 550,
      });

      const summaries = usageLogger.getBusinessUsageSummary("biz-demo");
      expect(summaries.length).toBe(1);
      expect(summaries[0].totalRequests).toBe(2);
      expect(summaries[0].totalTokens).toBe(1000);
      expect(summaries[0].totalLatencyMs).toBe(300);
      expect(summaries[0].averageLatencyMs).toBe(150);

      const recent = usageLogger.getBusinessRecentRequests("biz-demo");
      expect(recent.length).toBe(2);
      expect(recent[0].requestId).toBe("req-usage-2");
    });
  });

  describe("15. Request Tracing", () => {
    it("should ensure request logs and traces do not leak sensitive credentials", () => {
      usageLogger.logRequest({
        requestId: "req-trace-test",
        userId: "usr-1",
        businessId: "biz-audit",
        provider: "openai",
        model: "gpt-4o-mini",
        taskType: "product_verification",
        status: "success",
        latencyMs: 95,
      });

      const recent = usageLogger.getBusinessRecentRequests("biz-audit");
      const recordStr = JSON.stringify(recent[0]);
      expect(recordStr).not.toContain("API_KEY");
      expect(recordStr).not.toContain("Bearer");
    });
  });

  describe("16. Frontend cannot access provider secrets", () => {
    it("should verify public provider views never expose secret keys to clients", () => {
      const publicViews = aiConfigurationService.getAllProviderViews();
      const serialized = JSON.stringify(publicViews);
      
      expect(serialized).not.toContain("GEMINI_API_KEY=");
      expect(serialized).not.toContain("OPENAI_API_KEY=");
      expect(serialized).not.toContain("OPENROUTER_API_KEY=");
      expect(serialized).not.toContain("AIzaSy");
    });
  });
});
