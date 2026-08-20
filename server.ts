import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";

import { generateRequestId, getRecentTraces } from "./src/server/ai/tracing";
import { ModelRouter } from "./src/server/ai/router/modelRouter";
import { ProductAnalyzer } from "./src/server/ai/analyzer/productAnalyzer";
import { ProductVerifier } from "./src/server/ai/verifier/productVerifier";
import { extractAuthContext, verifyTenantAccess } from "./src/server/ai/auth";
import { AIServiceError, sanitizeError } from "./src/server/ai/errors";
import { aiConfigurationService } from "./src/server/ai/config/aiConfigurationService";
import { credentialService } from "./src/server/ai/config/credentialService";
import { providerConnectionTester } from "./src/server/ai/tester/providerConnectionTester";
import { usageLogger } from "./src/server/ai/usage/usageLogger";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Initialize Core AI Services
const modelRouter = new ModelRouter();
const productVerifier = new ProductVerifier(modelRouter);
const productAnalyzer = new ProductAnalyzer(modelRouter, productVerifier);

// Health check endpoint
app.get("/api/ai/health", (req: Request, res: Response) => {
  const providerViews = aiConfigurationService.getAllProviderViews();
  res.json({
    status: "ok",
    service: "GeFlow AI Product Intelligence Layer (Phase 4)",
    providers: providerViews.map((pv) => ({
      slug: pv.provider.slug,
      name: pv.provider.name,
      isActive: pv.provider.is_active,
      isDefault: pv.provider.is_default,
      healthStatus: pv.provider.health_status,
      isConfigured: pv.isConfigured,
      defaultModel: pv.defaultModel?.model_id,
      maskedKey: pv.maskedKeySummary,
    })),
    timestamp: new Date().toISOString(),
  });
});

// Providers & Models Configuration View Endpoint
app.get("/api/ai/providers", (req: Request, res: Response) => {
  const providerViews = aiConfigurationService.getAllProviderViews();
  res.json({
    success: true,
    data: providerViews,
  });
});

// Provider Connection Test Endpoint
app.post("/api/ai/test-provider", async (req: Request, res: Response) => {
  const requestId = generateRequestId();
  try {
    const authContext = extractAuthContext(req, requestId);
    const { provider, modelId } = req.body || {};

    if (!provider) {
      throw new AIServiceError("AI_VALIDATION_FAILED", "Provider name is required.", {
        statusCode: 400,
        requestId,
      });
    }

    const testResult = await providerConnectionTester.testProvider(provider, modelId);
    res.json({
      success: true,
      requestId,
      data: testResult,
    });
  } catch (err: any) {
    const sanitized = sanitizeError(err, requestId);
    res.status(sanitized.statusCode).json(sanitized.toJSON());
  }
});

// Admin Configuration Update Endpoint (Status, Defaults)
app.post("/api/ai/config/update-status", (req: Request, res: Response) => {
  const requestId = generateRequestId();
  try {
    const authContext = extractAuthContext(req, requestId);
    const { providerSlug, isActive, isDefault, defaultModelId, modelId, modelActive } = req.body || {};

    if (providerSlug) {
      if (typeof isActive === "boolean") {
        aiConfigurationService.setProviderStatus(providerSlug, isActive);
      }
      if (isDefault) {
        aiConfigurationService.setDefaultProvider(providerSlug);
      }
      if (defaultModelId) {
        aiConfigurationService.setDefaultModel(providerSlug, defaultModelId);
      }
      if (modelId && typeof modelActive === "boolean") {
        aiConfigurationService.setModelStatus(providerSlug, modelId, modelActive);
      }
    }

    res.json({
      success: true,
      requestId,
      data: aiConfigurationService.getAllProviderViews(),
    });
  } catch (err: any) {
    const sanitized = sanitizeError(err, requestId);
    res.status(sanitized.statusCode).json(sanitized.toJSON());
  }
});

// Usage & Analytics Endpoint (Tenant Isolated)
app.get("/api/ai/usage", (req: Request, res: Response) => {
  const requestId = generateRequestId();
  try {
    const authContext = extractAuthContext(req, requestId);
    const businessId = (req.query.businessId as string) || "biz_default";

    verifyTenantAccess(authContext, businessId, requestId);

    const summaries = usageLogger.getBusinessUsageSummary(businessId);
    const recentRequests = usageLogger.getBusinessRecentRequests(businessId);

    res.json({
      success: true,
      businessId,
      summaries,
      recentRequests,
    });
  } catch (err: any) {
    const sanitized = sanitizeError(err, requestId);
    res.status(sanitized.statusCode).json(sanitized.toJSON());
  }
});

// Product Analysis Endpoint
app.post("/api/ai/analyze-product", async (req: Request, res: Response) => {
  const requestId = generateRequestId();
  try {
    const authContext = extractAuthContext(req, requestId);
    const { rawInput, businessContext, currentFormState, options } = req.body || {};

    if (!businessContext?.businessId) {
      throw new AIServiceError("AI_VALIDATION_FAILED", "businessContext with businessId is required", {
        statusCode: 400,
        requestId,
      });
    }

    verifyTenantAccess(authContext, businessContext.businessId, requestId);

    const suggestion = await productAnalyzer.analyze({
      requestId,
      userId: authContext.userId,
      businessId: businessContext.businessId,
      rawInput: rawInput || "",
      businessContext,
      currentFormState,
      options,
    });

    res.json({
      success: true,
      requestId,
      data: suggestion,
    });
  } catch (err: any) {
    const sanitized = sanitizeError(err, requestId);
    res.status(sanitized.statusCode).json(sanitized.toJSON());
  }
});

// Product Verification Endpoint
app.post("/api/ai/verify-product", async (req: Request, res: Response) => {
  const requestId = generateRequestId();
  try {
    const authContext = extractAuthContext(req, requestId);
    const { suggestion, businessContext, originalInput, searchEvidence, options } = req.body || {};

    if (!suggestion) {
      throw new AIServiceError("AI_VALIDATION_FAILED", "Suggestion payload is required for verification.", {
        statusCode: 400,
        requestId,
      });
    }

    if (!businessContext?.businessId) {
      throw new AIServiceError("AI_VALIDATION_FAILED", "businessContext with businessId is required", {
        statusCode: 400,
        requestId,
      });
    }

    verifyTenantAccess(authContext, businessContext.businessId, requestId);

    const result = await productVerifier.verify(
      suggestion,
      businessContext,
      authContext.userId,
      requestId,
      originalInput,
      searchEvidence
    );

    res.json({
      success: true,
      requestId,
      data: result,
    });
  } catch (err: any) {
    const sanitized = sanitizeError(err, requestId);
    res.status(sanitized.statusCode).json(sanitized.toJSON());
  }
});

// Recent traces for auditing/debugging
app.get("/api/ai/traces", (req: Request, res: Response) => {
  const businessId = req.query.businessId as string | undefined;
  res.json({
    traces: getRecentTraces(businessId),
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GeFlow AI Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
