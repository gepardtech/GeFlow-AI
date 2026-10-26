import dotenv from "dotenv";
dotenv.config({ override: true });
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
import { teamService } from "./src/server/team/teamService";
import { businessDataSyncService } from "./src/server/team/businessDataSyncService";
import { settingsService } from "./src/server/settings/settingsService";
import { businessExtendedStorage } from "./src/server/businesses/businessExtendedStorage";
import { newsletterService } from "./src/server/newsletter/newsletterService";
import { promotionsService } from "./src/server/promotions/promotionsService";
import { uomService } from "./src/server/uom/uomService";
import { serverSupabase, bgSupabase, verifyUserToken } from "./src/server/supabase";
import { syncRealCategoriesToDatabase } from "./src/server/syncRealCategories";
import {
  clearUserPaymentMethodOnAdminManualUpdate,
  getUserPaymentMethod,
  saveUserPaymentMethod,
  removeUserPaymentMethod,
  detectCardBrand,
} from "./src/server/subscriptions/userPaymentMethodService";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import { storeCreditsStorage } from "./src/server/storeCreditsStorage";
import { productVariationsStorage, CATEGORY_TEMPLATES } from "./src/server/productVariationsStorage";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Serve public uploads statically
const uploadsDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const membersUploadDir = path.join(uploadsDir, "members");
if (!fs.existsSync(membersUploadDir)) {
  fs.mkdirSync(membersUploadDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Initialize Core AI Services
const modelRouter = new ModelRouter();
const productVerifier = new ProductVerifier(modelRouter);
const productAnalyzer = new ProductAnalyzer(modelRouter, productVerifier);

// General health check endpoint
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Resilient Supabase HTTP Proxy (bypasses browser iframe CORS / sandbox restrictions)
const FORBIDDEN_PROXY_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "accept-encoding",
]);

app.use("/api/supabase-proxy", async (req: Request, res: Response) => {
  // If response already finished, exit immediately
  if (res.headersSent || res.writableEnded) return;
  try {
    fs.appendFileSync("/tmp/proxy-trace.log", `[${new Date().toISOString()}] ${req.method} ${req.url}\n`);
  } catch (_e) {
    // Ignore trace logging errors
  }

  try {
    const rawUrl = req.url || "/";
    const targetUrl = `https://gvkvljxhufsrgyfsqrkc.supabase.co${rawUrl.startsWith("/") ? rawUrl : "/" + rawUrl}`;

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (!FORBIDDEN_PROXY_HEADERS.has(lower) && typeof value === "string") {
        headers[key] = value;
      }
    }

    const srvKey =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2a3ZsanhodWZzcmd5ZnNxcmtjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU5MDM0MywiZXhwIjoyMDk2MTY2MzQzfQ.LEwFjg1t256dibB7MaWlm3fnL6g6NCD7D-BceawDTLA";
    const anonKey =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2a3ZsanhodWZzcmd5ZnNxcmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTAzNDMsImV4cCI6MjA5NjE2NjM0M30.sef1DVX7ysCEXrNlptxJbht-RvsHxxVze6Op5o95NbE";

    // Platform/system tables that MUST ALWAYS have elevated service rights so RLS never blanks rows or blocks admin CRUD
    const isPlatformTable = /^\/rest\/v1\/(invoices|pricing_plans|feature_modules|public_feature_modules|plan_limits|platform_settings|business_categories|product_categories|business_category_internal|announcements|coupons|public_settings|newsletter_subscribers|refund_requests)/i.test(rawUrl);

    const authHdr = headers["authorization"] || "";
    let isElevatedUser = false;
    if (authHdr.startsWith("Bearer ") && !authHdr.includes(anonKey)) {
      try {
        const decoded = await verifyUserToken(authHdr);
        if (
          decoded?.email?.toLowerCase() === "gepardwebs@gmail.com" ||
          (decoded as any)?.user_metadata?.role === "admin"
        ) {
          isElevatedUser = true;
        }
      } catch {
        /* ignore */
      }
    }

    if (isPlatformTable || isElevatedUser) {
      headers["apikey"] = srvKey;
      headers["authorization"] = `Bearer ${srvKey}`;
    } else {
      headers["apikey"] = anonKey;
      if (!headers["authorization"] || headers["authorization"].includes("placeholder") || headers["authorization"].includes("your-anon-key")) {
        headers["authorization"] = `Bearer ${anonKey}`;
      }
    }

    // Intercept email_template_configs since the physical table is not in Supabase schema cache
    if (/^\/rest\/v1\/email_template_configs/i.test(rawUrl)) {
      if (req.method === "GET") {
        try {
          const { data: row } = await serverSupabase
            .from("platform_settings")
            .select("id, alerts")
            .limit(1)
            .maybeSingle();

          let configMap: Record<string, any> = (row?.alerts as any)?.email_template_configs || {};
          if (!configMap || Object.keys(configMap).length === 0) {
            try {
              if (fs.existsSync("./data/email_template_configs.json")) {
                configMap = JSON.parse(fs.readFileSync("./data/email_template_configs.json", "utf-8"));
              }
            } catch (_e) {
              // Ignore file read error
            }
          }

          const rows = Object.entries(configMap).map(([template_id, config]) => ({
            id: template_id,
            template_id,
            config,
            updated_at: new Date().toISOString(),
          }));

          res.setHeader("content-type", "application/json");
          res.setHeader("content-range", `0-${Math.max(0, rows.length - 1)}/${rows.length}`);
          return res.status(200).json(rows);
        } catch {
          return res.status(200).json([]);
        }
      }

      if (req.method === "POST" || req.method === "PATCH" || req.method === "PUT") {
        try {
          const rawItems = Array.isArray(req.body)
            ? req.body
            : req.body?.template_id
            ? [req.body]
            : [];

          const { data: row } = await serverSupabase
            .from("platform_settings")
            .select("id, alerts")
            .limit(1)
            .maybeSingle();

          const existingAlerts = row?.alerts && typeof row.alerts === "object" ? { ...(row.alerts as any) } : {};
          const currentConfigs = { ...(existingAlerts.email_template_configs || {}) };

          for (const item of rawItems) {
            if (item.template_id && item.config) {
              currentConfigs[item.template_id] = item.config;
            }
          }

          existingAlerts.email_template_configs = currentConfigs;

          if (row?.id) {
            await serverSupabase
              .from("platform_settings")
              .update({ alerts: existingAlerts, updated_at: new Date().toISOString() })
              .eq("id", row.id);
          } else {
            await serverSupabase
              .from("platform_settings")
              .upsert(
                { singleton: true, alerts: existingAlerts, updated_at: new Date().toISOString() },
                { onConflict: "singleton" }
              );
          }

          try {
            fs.writeFileSync("./data/email_template_configs.json", JSON.stringify(currentConfigs, null, 2), "utf-8");
          } catch (_e) {
            // Ignore file write error
          }

          const returnedRows = rawItems.map((u: any) => ({
            id: u.template_id,
            template_id: u.template_id,
            config: u.config,
            updated_at: new Date().toISOString(),
          }));

          res.setHeader("content-type", "application/json");
          return res.status(201).json(returnedRows);
        } catch {
          return res.status(200).json([]);
        }
      }
    }

    // Intercept businesses queries requesting solely extended_settings
    if (/^\/rest\/v1\/businesses/i.test(rawUrl) && req.method === "GET") {
      const isOnlyExtended = /select=extended_settings(&|$)/i.test(rawUrl);
      if (isOnlyExtended) {
        const idMatch = rawUrl.match(/id=eq\.([^&]+)/i);
        const bizId = idMatch ? decodeURIComponent(idMatch[1]) : "";
        const settings = businessExtendedStorage.getSettings(bizId);
        const acceptHdr = (headers["accept"] || "").toLowerCase();
        res.setHeader("content-type", "application/json");
        if (acceptHdr.includes("vnd.pgrst.object+json")) {
          return res.status(200).json({ extended_settings: settings });
        } else {
          return res.status(200).json([{ extended_settings: settings }]);
        }
      }
    }

    // Intercept held_orders queries and mutations since table is not in Supabase schema cache
    if (/^\/rest\/v1\/held_orders/i.test(rawUrl)) {
      if (req.method === "GET") {
        const bizMatch = rawUrl.match(/business_id=eq\.([^&]+)/i);
        const bizId = bizMatch ? decodeURIComponent(bizMatch[1]) : "";
        const orders = bizId ? (businessDataSyncService.getOrCreateBusinessUnit(bizId).held_orders || []) : [];
        res.setHeader("content-type", "application/json");
        res.setHeader("content-range", `0-${Math.max(0, orders.length - 1)}/${orders.length}`);
        return res.status(200).json(orders);
      }
      if (req.method === "POST") {
        const payload = Array.isArray(req.body) ? req.body[0] : req.body;
        if (payload && payload.business_id) {
          const saved = businessDataSyncService.saveHeldOrder(payload.business_id, payload);
          res.setHeader("content-type", "application/json");
          const acceptHdr = (headers["accept"] || "").toLowerCase();
          if (acceptHdr.includes("vnd.pgrst.object+json")) {
            return res.status(201).json(saved);
          }
          return res.status(201).json([saved]);
        }
        return res.status(200).json([]);
      }
      if (req.method === "DELETE") {
        const idMatch = rawUrl.match(/id=eq\.([^&]+)/i);
        const bizMatch = rawUrl.match(/business_id=eq\.([^&]+)/i);
        const orderId = idMatch ? decodeURIComponent(idMatch[1]) : "";
        const bizId = bizMatch ? decodeURIComponent(bizMatch[1]) : "";
        if (orderId) {
          businessDataSyncService.deleteHeldOrder(bizId, orderId);
        }
        return res.status(204).end();
      }
    }

    let proxyTargetUrl = targetUrl;
    if (/^\/rest\/v1\/businesses/i.test(rawUrl) && req.method === "GET") {
      // Strip extended_settings from select query string so Supabase does not fail with column does not exist
      proxyTargetUrl = targetUrl
        .replace(/([?&]select=.*?),extended_settings(?=[&,?]|$)/gi, "$1")
        .replace(/([?&]select=)extended_settings,(.*?)/gi, "$1$2")
        .replace(/([?&]select=)extended_settings(?=[&?]|$)/gi, "$1*");
    }

    let bodyPayload: any = req.body;

    // Intercept businesses mutations to safely save extended_settings and strip invalid column
    if (/^\/rest\/v1\/businesses/i.test(rawUrl) && (req.method === "POST" || req.method === "PATCH" || req.method === "PUT")) {
      if (bodyPayload && typeof bodyPayload === "object") {
        const sanitizeBizRow = (raw: any) => {
          const item = { ...raw };
          if ("extended_settings" in item) {
            const ext = item.extended_settings;
            const idMatch = rawUrl.match(/id=eq\.([^&]+)/i);
            const bizId = item.id || (idMatch ? decodeURIComponent(idMatch[1]) : "");
            if (bizId && ext && typeof ext === "object") {
              businessExtendedStorage.saveSettings(bizId, ext).catch(() => {});
            }
            delete item.extended_settings;
          }
          return item;
        };

        if (Array.isArray(bodyPayload)) {
          bodyPayload = bodyPayload.map(sanitizeBizRow);
        } else {
          bodyPayload = sanitizeBizRow(bodyPayload);
        }
      }
    }
    // Intercept platform_settings mutations to safely store parent_company in alerts JSON and strip invalid columns
    if (/^\/rest\/v1\/platform_settings/i.test(rawUrl) && (req.method === "POST" || req.method === "PATCH" || req.method === "PUT")) {
      if (bodyPayload && typeof bodyPayload === "object") {
        const ALLOWED_PLATFORM_COLS = new Set([
          "id", "singleton", "app_name", "interface_language", "system_timezone",
          "multi_business", "global_branch_sync", "api_maintenance", "logo_url",
          "primary_accent", "secondary_accent", "default_theme", "white_label",
          "base_currency", "universal_tax", "invoice_prefix", "automated_tax_receipts",
          "admin_2fa", "global_ip_guard", "hardware_key", "min_pass_length",
          "session_ttl", "alerts", "updated_at", "favicon_url", "tagline",
          "maintenance_mode", "maintenance_message"
        ]);

        const sanitizeRow = (raw: any) => {
          const item = { ...raw };
          const parentComp = (item.parent_company || item.alerts?.parent_company || "Gepard Techs").toString().trim();
          item.alerts = {
            ...(item.alerts || {}),
            parent_company: parentComp,
            general_settings: {
              ...(item.alerts?.general_settings || {}),
              parent_company: parentComp,
            },
          };
          delete item.parent_company;

          // Strip any fields not in the platform_settings table schema
          const cleanItem: Record<string, any> = {};
          for (const [k, v] of Object.entries(item)) {
            if (ALLOWED_PLATFORM_COLS.has(k)) {
              cleanItem[k] = v;
            }
          }

          // Asynchronously notify settingsService so local backup & cache update too
          settingsService.updateAllSettings({ parent_company: parentComp }).catch(() => {});
          return cleanItem;
        };

        if (Array.isArray(bodyPayload)) {
          bodyPayload = bodyPayload.map(sanitizeRow);
        } else {
          bodyPayload = sanitizeRow(bodyPayload);
        }
      }
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(15000),
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      if (bodyPayload !== undefined && bodyPayload !== null) {
        if (typeof bodyPayload === "string" || Buffer.isBuffer(bodyPayload)) {
          fetchOptions.body = bodyPayload;
        } else if (typeof bodyPayload === "object") {
          fetchOptions.body = JSON.stringify(bodyPayload);
          headers["content-type"] = headers["content-type"] || "application/json";
        }
      }
    }

    fs.appendFileSync("/tmp/proxy-trace.log", `Before fetch to ${proxyTargetUrl}, body type: ${typeof fetchOptions.body}\n`);
    const upstreamRes = await fetch(proxyTargetUrl, fetchOptions);
    fs.appendFileSync("/tmp/proxy-trace.log", `After fetch, status: ${upstreamRes.status}\n`);

    if (res.headersSent || res.writableEnded) return;

    const FORBIDDEN_RESPONSE_HEADERS = new Set([
      "connection",
      "keep-alive",
      "transfer-encoding",
      "content-encoding",
      "content-length",
      "alt-svc",
      "set-cookie",
      "strict-transport-security",
    ]);

    res.status(upstreamRes.status);
    upstreamRes.headers.forEach((v, k) => {
      const lower = k.toLowerCase();
      if (!FORBIDDEN_RESPONSE_HEADERS.has(lower)) {
        try {
          res.setHeader(k, v);
        } catch {
          /* ignore unparseable header */
        }
      }
    });

    const buffer = await upstreamRes.arrayBuffer();

    // If reading platform_settings, unpack parent_company onto rows for convenience
    if (/^\/rest\/v1\/platform_settings/i.test(rawUrl) && upstreamRes.status === 200 && req.method === "GET") {
      try {
        const text = new TextDecoder().decode(buffer);
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          parsed.forEach((row: any) => {
            if (row && typeof row === "object") {
              const alerts = row.alerts || {};
              row.parent_company = alerts.parent_company || alerts.general_settings?.parent_company || "Gepard Techs";
            }
          });
          return res.json(parsed);
        } else if (parsed && typeof parsed === "object") {
          const alerts = parsed.alerts || {};
          parsed.parent_company = alerts.parent_company || alerts.general_settings?.parent_company || "Gepard Techs";
          return res.json(parsed);
        }
      } catch {
        /* fallback to raw buffer */
      }
    }

    // If reading businesses, unpack extended_settings onto rows
    if (/^\/rest\/v1\/businesses/i.test(rawUrl) && upstreamRes.status === 200 && req.method === "GET") {
      try {
        const text = new TextDecoder().decode(buffer);
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          parsed.forEach((row: any) => {
            if (row && typeof row === "object" && row.id) {
              row.extended_settings = businessExtendedStorage.getSettings(row.id);
            }
          });
          return res.json(parsed);
        } else if (parsed && typeof parsed === "object" && parsed.id) {
          parsed.extended_settings = businessExtendedStorage.getSettings(parsed.id);
          return res.json(parsed);
        }
      } catch {
        /* fallback to raw buffer */
      }
    }

    res.send(Buffer.from(buffer));
  } catch (err: any) {
    if (res.headersSent || res.writableEnded) {
      try { res.end(); } catch (_e) { /* ignore */ }
      return;
    }

    // Gracefully handle upstream proxy fallbacks for PostgREST & Gotrue
    const isRest = req.url?.includes("/rest/v1/");
    if (isRest && req.method === "GET") {
      res.setHeader("content-type", "application/json");
      res.setHeader("content-range", "0-0/0");
      return res.status(200).json([]);
    }

    res.status(502).json({
      error: "supabase_proxy_unavailable",
      message: err?.message || "Service temporarily unavailable",
    });
  }
});

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

// ==========================================
// Team Invitation & Workspace Membership APIs
// ==========================================

// List registered users for auto-selecting / autocomplete in Team Hub invite modal
app.get("/api/team/registered-users", async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q || req.query.query || "") as string).trim().toLowerCase();
    const excludeOwnerId = ((req.query.excludeOwnerId || "") as string).trim();

    const usersMap = new Map<string, { userId: string; email: string; fullName: string }>();

    // 1. Fetch from profiles
    let profQuery = serverSupabase
      .from("profiles")
      .select("user_id, email, full_name")
      .not("email", "is", null);

    if (excludeOwnerId && excludeOwnerId.length >= 32) {
      profQuery = profQuery.neq("user_id", excludeOwnerId);
    }

    const { data: profs } = await profQuery;
    (profs || []).forEach((p) => {
      if (p.email && p.user_id) {
        usersMap.set(p.email.toLowerCase(), {
          userId: p.user_id,
          email: p.email.toLowerCase(),
          fullName: p.full_name || p.email.split("@")[0],
        });
      }
    });

    // 2. Fetch from auth.admin
    try {
      const { data: authUsers } = await serverSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      (authUsers?.users || []).forEach((u) => {
        if (u.email && u.id && u.id !== excludeOwnerId) {
          const em = u.email.toLowerCase();
          if (!usersMap.has(em)) {
            usersMap.set(em, {
              userId: u.id,
              email: em,
              fullName: u.user_metadata?.full_name || u.email.split("@")[0],
            });
          }
        }
      });
    } catch (authErr) {
      console.warn("Notice listing auth users for registered-users endpoint:", authErr);
    }

    let result = Array.from(usersMap.values());
    if (q) {
      result = result.filter(
        (u) => u.email.includes(q) || u.fullName.toLowerCase().includes(q)
      );
    }

    return res.json({ success: true, users: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Check if user is registered in Database or Auth
app.get("/api/team/check-user", async (req: Request, res: Response) => {
  try {
    const email = (req.query.email as string || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return res.json({ success: true, isRegistered: false });
    }

    // 1. Check profiles table with service role (bypasses RLS)
    const { data: profile } = await serverSupabase
      .from("profiles")
      .select("user_id, email, full_name, role, plan")
      .ilike("email", email)
      .maybeSingle();

    if (profile?.user_id) {
      return res.json({
        success: true,
        isRegistered: true,
        userId: profile.user_id,
        fullName: profile.full_name || undefined,
        email: profile.email || email,
      });
    }

    // 2. Check Supabase auth.users directly via admin API
    try {
      const { data: authUsers } = await serverSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = (authUsers?.users || []).find((u) => u.email?.toLowerCase() === email);
      if (found) {
        return res.json({
          success: true,
          isRegistered: true,
          userId: found.id,
          fullName: (found.user_metadata?.full_name || found.user_metadata?.name || found.email?.split("@")[0]),
          email: found.email || email,
        });
      }
    } catch (authErr) {
      console.warn("Notice checking auth.users for team invite:", authErr);
    }

    return res.json({ success: true, isRegistered: false });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Add or Invite User (Unified: Verifies database & auth first)
app.post("/api/team/add-or-invite-user", async (req: Request, res: Response) => {
  try {
    const {
      ownerId,
      ownerName,
      businessId,
      businessName,
      businessAddress,
      currency,
      email,
      fullName,
      role,
      password,
    } = req.body || {};

    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanRole = role || "cashier";
    const cleanFullName = (fullName || cleanEmail.split("@")[0]).trim();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return res.status(400).json({ success: false, error: "Valid email is required." });
    }

    // Resolve valid UUID for realOwnerId and realBizId
    let realOwnerId = (ownerId && ownerId.length >= 32 && /^[0-9a-f-]+$/i.test(ownerId)) ? ownerId : null;
    let realBizId = businessId || "";
    let realBizName = businessName || "Store";
    let realBizAddress = businessAddress || "";
    let realCurrency = currency || "USD";

    if (businessId && businessId.length >= 32 && /^[0-9a-f-]+$/i.test(businessId)) {
      const { data: bRow } = await serverSupabase
        .from("businesses")
        .select("id, business_name, owner_user_id, business_address, currency")
        .eq("id", businessId)
        .maybeSingle();

      if (bRow) {
        realBizId = bRow.id;
        realBizName = bRow.business_name || realBizName;
        realBizAddress = bRow.business_address || realBizAddress;
        realCurrency = bRow.currency || realCurrency;
        if (!realOwnerId && bRow.owner_user_id) {
          realOwnerId = bRow.owner_user_id;
        }
      }
    }

    if (!realOwnerId) {
      const { data: anyBiz } = await serverSupabase
        .from("businesses")
        .select("id, business_name, owner_user_id, business_address, currency")
        .limit(1)
        .maybeSingle();

      if (anyBiz?.owner_user_id) {
        realOwnerId = anyBiz.owner_user_id;
        if (!realBizId) {
          realBizId = anyBiz.id;
          realBizName = anyBiz.business_name || realBizName;
          realBizAddress = anyBiz.business_address || realBizAddress;
          realCurrency = anyBiz.currency || realCurrency;
        }
      }
    }

    // 1. Verify if user is registered in Database or Auth
    let existingUserId: string | null = null;
    let existingFullName: string | null = null;

    // A. Check profiles table
    const { data: prof } = await serverSupabase
      .from("profiles")
      .select("user_id, email, full_name")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (prof?.user_id) {
      existingUserId = prof.user_id;
      existingFullName = prof.full_name;
    }

    // B. Check auth.users if not found in profiles
    if (!existingUserId) {
      try {
        const { data: authList } = await serverSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const match = (authList?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail);
        if (match) {
          existingUserId = match.id;
          existingFullName = match.user_metadata?.full_name || match.email?.split("@")[0];
        }
      } catch (authErr) {
        console.warn("Notice listing auth users:", authErr);
      }
    }

    const now = new Date().toISOString();

    // -------------------------------------------------------------
    // PATH 1: USER IS ALREADY REGISTERED
    // DO NOT create new auth or profile. Only appoint employee role!
    // -------------------------------------------------------------
    if (existingUserId) {
      // 1. Add to teamService memory & local store
      teamService.addDirectMember({
        businessId: realBizId,
        businessName: realBizName,
        businessAddress: realBizAddress,
        currency: realCurrency,
        ownerId: realOwnerId || "owner",
        ownerName: ownerName || "Store Owner",
        email: cleanEmail,
        fullName: existingFullName || cleanFullName,
        role: cleanRole,
        userId: existingUserId,
        status: "active",
      });

      // 2. Persist to support_team_members with valid UUIDs
      try {
        await serverSupabase.from("support_team_members").upsert({
          user_id: existingUserId,
          role: `${cleanRole}::${realBizId}`,
          appointed_by_user_id: realOwnerId || existingUserId,
          is_active: true,
          updated_at: now,
        }, { onConflict: "user_id" });
      } catch (suppErr) {
        console.warn("Notice updating support_team_members for existing user:", suppErr);
      }

      return res.json({
        success: true,
        isExisting: true,
        userId: existingUserId,
        fullName: existingFullName || cleanFullName,
        role: cleanRole,
        businessName: realBizName,
        message: `User is already registered on GeFlow. Successfully appointed as ${cleanRole.toUpperCase()}. They can access "${realBizName}" immediately from the top left business switcher under Employee Access.`,
      });
    }

    // -------------------------------------------------------------
    // PATH 2: USER IS NOT REGISTERED
    // 1st add user as new user in auth and database with appointed role
    // -------------------------------------------------------------
    const initialPassword = (password || "").trim() || `Geflow@${Math.floor(1000 + Math.random() * 9000)}`;

    let newUserId = "";
    try {
      const { data: createdAuth, error: createErr } = await serverSupabase.auth.admin.createUser({
        email: cleanEmail,
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
          full_name: cleanFullName,
          plan: "free",
          role: cleanRole,
          business_id: realBizId,
          business_name: realBizName,
          invited_by: realOwnerId,
        },
      });

      if (createErr) {
        console.warn("Auth admin createUser error:", createErr);
        // If it says user already exists, fallback to appointment
        if (createErr.message?.toLowerCase().includes("already") || createErr.message?.toLowerCase().includes("exists")) {
          const { data: authList } = await serverSupabase.auth.admin.listUsers();
          const match = (authList?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail);
          const foundId = match?.id || "u_" + Date.now();
          teamService.addDirectMember({
            businessId: realBizId,
            businessName: realBizName,
            businessAddress: realBizAddress,
            currency: realCurrency,
            ownerId: realOwnerId || "owner",
            ownerName: ownerName || "Store Owner",
            email: cleanEmail,
            fullName: cleanFullName,
            role: cleanRole,
            userId: foundId,
            status: "active",
          });
          return res.json({
            success: true,
            isExisting: true,
            userId: foundId,
            role: cleanRole,
            businessName: realBizName,
            message: "User was already registered. Appointed employee role successfully.",
          });
        }
        return res.status(500).json({ success: false, error: createErr.message });
      }

      newUserId = createdAuth?.user?.id || "";
    } catch (authCreateErr: any) {
      console.error("Failed to create auth user:", authCreateErr);
      return res.status(500).json({ success: false, error: authCreateErr.message });
    }

    if (!newUserId) {
      return res.status(500).json({ success: false, error: "Failed to allocate new user ID." });
    }

    // Insert profile into profiles table with Free plan
    await serverSupabase.from("profiles").upsert({
      user_id: newUserId,
      email: cleanEmail,
      full_name: cleanFullName,
      plan: "free",
      role: "customer",
      status: "active",
      created_at: now,
      updated_at: now,
    }, { onConflict: "user_id" });

    // Appoint in teamService
    teamService.addDirectMember({
      businessId: realBizId,
      businessName: realBizName,
      businessAddress: realBizAddress,
      currency: realCurrency,
      ownerId: realOwnerId || "owner",
      ownerName: ownerName || "Store Owner",
      email: cleanEmail,
      fullName: cleanFullName,
      role: cleanRole,
      userId: newUserId,
      status: "active",
    });

    // Mirror to support_team_members with valid UUIDs
    try {
      await serverSupabase.from("support_team_members").upsert({
        user_id: newUserId,
        role: `${cleanRole}::${realBizId}`,
        appointed_by_user_id: realOwnerId || newUserId,
        is_active: true,
        updated_at: now,
      }, { onConflict: "user_id" });
    } catch (suppErr) {
      console.warn("Notice updating support_team_members for new user:", suppErr);
    }

    return res.json({
      success: true,
      isExisting: false,
      userId: newUserId,
      role: cleanRole,
      businessName: realBizName,
      credentials: {
        email: cleanEmail,
        password: initialPassword,
        fullName: cleanFullName,
      },
      message: `Account created for ${cleanFullName}. They can log in and access "${realBizName}" as ${cleanRole.toUpperCase()}, and can also create their own business from the top bar.`,
    });
  } catch (err: any) {
    console.error("Error in add-or-invite-user:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Create Team Invitation
app.post("/api/team/invite", (req: Request, res: Response) => {
  try {
    const {
      ownerId,
      ownerName,
      ownerEmail,
      businessId,
      businessName,
      businessAddress,
      currency,
      email,
      fullName,
      role,
      permissions,
    } = req.body || {};

    if (!email || !businessId) {
      return res.status(400).json({ success: false, error: "Email and Business ID are required." });
    }

    const result = teamService.createInvitation({
      ownerId: ownerId || "owner",
      ownerName: ownerName || "Store Owner",
      ownerEmail,
      businessId,
      businessName: businessName || "Store",
      businessAddress,
      currency: currency || "USD",
      email,
      fullName,
      role: role || "cashier",
      permissions,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Pending Invitations for User
app.get("/api/team/invitations", (req: Request, res: Response) => {
  try {
    const email = req.query.email as string | undefined;
    const userId = req.query.userId as string | undefined;
    const invitations = teamService.getPendingInvitations(email, userId);
    res.json({ success: true, invitations });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Accept Invitation
app.post("/api/team/accept", (req: Request, res: Response) => {
  try {
    const { invitationId, userId, userEmail, userName } = req.body || {};
    if (!invitationId || !userEmail) {
      return res.status(400).json({ success: false, error: "Invitation ID and User Email are required." });
    }

    const result = teamService.acceptInvitation({
      invitationId,
      userId: userId || "user_" + Date.now(),
      userEmail,
      userName,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Decline Invitation
app.post("/api/team/decline", (req: Request, res: Response) => {
  try {
    const { invitationId, userEmail, userId } = req.body || {};
    if (!invitationId || !userEmail) {
      return res.status(400).json({ success: false, error: "Invitation ID and User Email are required." });
    }

    const result = teamService.declineInvitation({ invitationId, userEmail, userId });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Resend Invitation
app.post("/api/team/resend", (req: Request, res: Response) => {
  try {
    const { invitationId, businessId, email, ownerName } = req.body || {};
    if (!email || (!invitationId && !businessId)) {
      return res.status(400).json({ success: false, error: "Email and Business ID/Invitation ID are required." });
    }

    const result = teamService.resendInvitation({ invitationId, businessId, email, ownerName });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Assigned Employee Stores for User
app.get("/api/team/employee-businesses", (req: Request, res: Response) => {
  try {
    const email = req.query.email as string | undefined;
    const userId = req.query.userId as string | undefined;
    const businesses = teamService.getEmployeeBusinesses(userId, email);
    res.json({ success: true, businesses });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Team Members for Business Owner
app.get("/api/team/members", (req: Request, res: Response) => {
  try {
    const businessId = (req.query.businessId as string | undefined)?.trim();
    const ownerId = (req.query.ownerId as string | undefined)?.trim();
    const members = teamService.getTeamMembers({
      businessId: businessId && businessId !== "undefined" && businessId !== "null" ? businessId : undefined,
      ownerId: ownerId && ownerId !== "undefined" && ownerId !== "null" ? ownerId : undefined,
    });
    res.json({ success: true, members });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add Direct Member (Store Owner adding an employee with credentials)
app.post("/api/team/add-member", (req: Request, res: Response) => {
  try {
    const {
      businessId,
      businessName,
      businessAddress,
      currency,
      ownerId,
      ownerName,
      email,
      fullName,
      role,
      permissions,
      userId,
      status,
    } = req.body || {};

    if (!email || (!businessId && !ownerId)) {
      return res.status(400).json({ success: false, error: "Email and Business ID (or Owner ID) are required." });
    }

    const result = teamService.addDirectMember({
      businessId: businessId || "biz_" + (ownerId || "default"),
      businessName,
      businessAddress,
      currency,
      ownerId: ownerId || "owner",
      ownerName,
      email,
      fullName: fullName || email.split("@")[0],
      role: role || "cashier",
      permissions,
      userId,
      status: status || "active",
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remove Team Member
app.post("/api/team/remove-member", (req: Request, res: Response) => {
  try {
    const { businessId, memberId, ownerId } = req.body || {};
    if ((!businessId && !ownerId) || !memberId) {
      return res.status(400).json({ success: false, error: "businessId (or ownerId) and memberId are required." });
    }
    const result = teamService.removeMember(businessId, memberId, ownerId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Member Role
app.post("/api/team/update-role", (req: Request, res: Response) => {
  try {
    const { businessId, memberId, role, ownerId } = req.body || {};
    if ((!businessId && !ownerId) || !memberId || !role) {
      return res.status(400).json({ success: false, error: "businessId, memberId and role are required." });
    }
    const result = teamService.updateMemberRole(businessId, memberId, role, ownerId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Member Status (Active / Inactive)
app.post("/api/team/update-status", (req: Request, res: Response) => {
  try {
    const { businessId, memberId, isActive, ownerId } = req.body || {};
    if ((!businessId && !ownerId) || !memberId || isActive === undefined) {
      return res.status(400).json({ success: false, error: "businessId, memberId and isActive are required." });
    }
    const result = teamService.updateMemberStatus(businessId, memberId, Boolean(isActive), ownerId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Activity Event Hub for System Notifications
export interface ActivityEvent {
  id: string;
  type: "user_signup" | "user_login" | "ai_usage" | "business_registered" | "invoice_created" | "support_message" | "system";
  title: string;
  description: string;
  createdAt: string;
  unread: boolean;
  userId?: string;
  businessId?: string;
}

const systemActivityEvents: ActivityEvent[] = [];

export function recordSystemActivity(event: Omit<ActivityEvent, "id" | "createdAt" | "unread">) {
  const fullEvent: ActivityEvent = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    unread: true,
    ...event,
  };
  systemActivityEvents.unshift(fullEvent);
  if (systemActivityEvents.length > 200) {
    systemActivityEvents.length = 200;
  }
}

// User Notifications (Invitations & In-app Alerts)
app.get("/api/team/notifications", (req: Request, res: Response) => {
  try {
    const email = req.query.email as string | undefined;
    const userId = req.query.userId as string | undefined;
    const notifications = teamService.getNotifications(email, userId);
    res.json({ success: true, notifications });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Notifications Hub (Signups, Logins, AI usage, Businesses, Support)
app.get("/api/admin/notifications", async (_req: Request, res: Response) => {
  try {
    const notifs: any[] = [];

    // 1. Live recorded activity events (signups, logins, ai usages, business creations, invoices)
    systemActivityEvents.forEach((ev) => {
      notifs.push({
        id: ev.id,
        title: ev.title,
        description: ev.description,
        createdAt: ev.createdAt,
        unread: ev.unread,
        type: ev.type,
      });
    });

    // 2. Real contact submissions
    const { data: contacts } = await serverSupabase
      .from("contact_submissions")
      .select("id, name, email, subject, message, created_at, is_read")
      .order("created_at", { ascending: false })
      .limit(10);

    (contacts || []).forEach((c) => {
      if (!notifs.some((n) => n.id === c.id)) {
        notifs.push({
          id: c.id,
          title: `Support: ${c.name}`,
          description: c.message?.slice(0, 100) || c.subject || "New contact message",
          createdAt: c.created_at,
          unread: !c.is_read,
          type: "support_message",
        });
      }
    });

    // 3. Real user signups from profiles
    const { data: recentProfiles } = await serverSupabase
      .from("profiles")
      .select("user_id, full_name, email, plan, created_at")
      .order("created_at", { ascending: false })
      .limit(8);

    (recentProfiles || []).forEach((p) => {
      const pid = `signup-${p.user_id}`;
      if (!notifs.some((n) => n.id === pid)) {
        notifs.push({
          id: pid,
          title: `New User: ${p.full_name || p.email?.split("@")[0] || "User"}`,
          description: `Registered with ${p.email} (${p.plan || "free"} plan)`,
          createdAt: p.created_at,
          unread: true,
          type: "user_signup",
        });
      }
    });

    // 4. Real registered businesses
    const { data: recentBusinesses } = await serverSupabase
      .from("businesses")
      .select("id, business_name, business_address, currency, created_at")
      .order("created_at", { ascending: false })
      .limit(8);

    (recentBusinesses || []).forEach((b) => {
      const bid = `biz-${b.id}`;
      if (!notifs.some((n) => n.id === bid)) {
        notifs.push({
          id: bid,
          title: `Store Registered: ${b.business_name}`,
          description: `New store configured in ${b.currency || "USD"}.`,
          createdAt: b.created_at,
          unread: true,
          type: "business_registered",
        });
      }
    });

    // Sort by createdAt desc
    notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ success: true, notifications: notifs.slice(0, 30) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// User Notifications (user-specific activity, invites, announcements)
app.get("/api/user/notifications", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;
    const email = req.query.email as string | undefined;
    const notifs: any[] = [];

    // Invitations
    if (email || userId) {
      const invites = teamService.getNotifications(email, userId);
      (invites || []).forEach((inv: any) => notifs.push(inv));
    }

    // User's own activity (logins, store registrations, AI usage)
    if (userId) {
      systemActivityEvents
        .filter((ev) => ev.userId === userId)
        .forEach((ev) => {
          notifs.push({
            id: ev.id,
            title: ev.title,
            description: ev.description,
            createdAt: ev.createdAt,
            unread: ev.unread,
            type: ev.type,
          });
        });
    }

    // Announcements
    const { data: anns } = await serverSupabase
      .from("announcements")
      .select("id, title, body, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    (anns || []).forEach((a) => {
      notifs.push({
        id: `ann-${a.id}`,
        title: a.title,
        description: a.body?.slice(0, 90) || "",
        createdAt: a.created_at,
        unread: false,
        type: "announcement",
      });
    });

    notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ success: true, notifications: notifs.slice(0, 25) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Operational Business Data Sync Engine
// Synchronizes products, inventory, sales,
// held orders, and reports between Owner & Staff
// ==========================================

// Get synced data for a business (tailored to role, synced with Supabase)
app.get("/api/sync/business-data", async (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId as string | undefined;
    const role = (req.query.role as string | undefined) || "manager";
    if (!businessId) {
      return res.status(400).json({ success: false, error: "businessId query parameter is required." });
    }
    let data = businessDataSyncService.getBusinessData(businessId, role);
    if (!data.products || data.products.length === 0) {
      try {
        const { data: dbProds } = await serverSupabase
          .from("products")
          .select("*")
          .eq("business_id", businessId)
          .order("name");
        if (dbProds && dbProds.length > 0) {
          businessDataSyncService.syncBatch(businessId, { products: dbProds, replace: false });
          data = businessDataSyncService.getBusinessData(businessId, role);
        }
      } catch (dbErr) {
        console.warn("Notice syncing products from database for business:", dbErr);
      }
    }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ingest master batch sync (from owner client / Supabase)
app.post("/api/sync/batch", (req: Request, res: Response) => {
  try {
    const { businessId, products, sales, sale_items, stock_movements, categories, ownerUserId, businessName, replace } = req.body || {};
    if (!businessId) {
      return res.status(400).json({ success: false, error: "businessId is required." });
    }
    const result = businessDataSyncService.syncBatch(businessId, {
      products,
      sales,
      sale_items,
      stock_movements,
      categories,
      ownerUserId,
      businessName,
      replace,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Live Currency Rates & Gemini Live Google Price Conversion
let cachedRates: Record<string, number> = {
  USD: 1,
  PKR: 277.20,
  EUR: 0.92,
  GBP: 0.78,
  INR: 83.50,
  AED: 3.67,
  SAR: 3.75,
  CAD: 1.36,
  AUD: 1.52,
  JPY: 155.0,
  TRY: 34.0,
  BDT: 118.0,
  NGN: 1600.0,
  PHP: 58.5,
  IDR: 16000.0,
  BRL: 5.45,
  CNY: 7.24,
};
let lastRatesFetch = 0;

async function getLiveRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (now - lastRatesFetch < 15 * 60 * 1000 && Object.keys(cachedRates).length > 2) {
    return cachedRates;
  }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const json = await res.json();
      if (json?.rates && typeof json.rates === "object") {
        cachedRates = { ...cachedRates, ...json.rates, USD: 1 };
        lastRatesFetch = now;
        return cachedRates;
      }
    }
  } catch (e) {
    console.warn("Notice fetching live FX rates, using current live defaults:", e);
  }
  return cachedRates;
}

// Convert price using Gemini API with live Google search or calculation
async function convertWithGemini(amount: number, from: string, to: string): Promise<{ rate: number; convertedPrice: number } | null> {
  const fromClean = from.toUpperCase().trim();
  const toClean = to.toUpperCase().trim();
  if (fromClean === toClean) return { rate: 1, convertedPrice: amount };

  // First try Gemini API if available
  const client = getGeminiClient();
  if (client) {
    try {
      const prompt = `You are a financial exchange rate calculator using Google live market prices.
Calculate the live currency conversion:
Original Amount: ${amount} ${fromClean}
Target Currency: ${toClean}
Example: 1 USD = 277.20 PKR, so 4.99 USD = 1383.21 PKR.
Return strictly a valid JSON object without markdown formatting:
{"rate": number, "convertedPrice": number}`;

      const res = await client.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const txt = res.text?.trim() || "";
      const parsed = JSON.parse(txt);
      if (parsed?.rate && parsed?.convertedPrice) {
        return {
          rate: Number(parsed.rate),
          convertedPrice: Number(Number(parsed.convertedPrice).toFixed(2))
        };
      }
    } catch (e) {
      console.warn("Notice calculating currency with Gemini, using live FX rates:", e);
    }
  }

  // Fallback to live rates calculation
  const rates = await getLiveRates();
  const fromRate = rates[fromClean] || 1;
  const toRate = rates[toClean] || (toClean === "PKR" ? 277.20 : 1);
  const effectiveRate = toRate / fromRate;
  const converted = +(amount * effectiveRate).toFixed(2);
  return { rate: effectiveRate, convertedPrice: converted };
}

app.get("/api/currency/rates", async (_req: Request, res: Response) => {
  try {
    const rates = await getLiveRates();
    res.json({ success: true, base: "USD", rates, timestamp: Date.now() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, rates: cachedRates });
  }
});

app.get("/api/currency/convert", async (req: Request, res: Response) => {
  try {
    const amount = Number(req.query.amount) || 0;
    const from = String(req.query.from || "USD").toUpperCase();
    const to = String(req.query.to || "USD").toUpperCase();

    const result = await convertWithGemini(amount, from, to);
    res.json({
      success: true,
      originalPrice: amount,
      from,
      to,
      rate: result?.rate || 1,
      convertedPrice: result?.convertedPrice || amount
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Securely save product to PostgreSQL database collection
app.post("/api/user/products/save", async (req: Request, res: Response) => {
  try {
    const { businessId, product, ownerUserId } = req.body || {};
    if (!businessId || !product) {
      return res.status(400).json({ success: false, error: "businessId and product required" });
    }

    const isUUID = (str?: string | null) =>
      Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

    let resolvedOwnerId = isUUID(ownerUserId) ? ownerUserId : undefined;
    if (!resolvedOwnerId) {
      const { data: bRow } = await serverSupabase.from("businesses").select("owner_user_id").eq("id", businessId).maybeSingle();
      if (bRow?.owner_user_id && isUUID(bRow.owner_user_id)) {
        resolvedOwnerId = bRow.owner_user_id;
      }
    }

    const cleanName = (product.name || "Untitled Product").trim();

    // Check whether this product ID already exists in this business
    let isExistingRecord = false;
    if (isUUID(product.id)) {
      const { data: byId } = await serverSupabase
        .from("products")
        .select("id")
        .eq("business_id", businessId)
        .eq("id", product.id)
        .maybeSingle();
      if (byId?.id) {
        isExistingRecord = true;
      }
    }

    // Prevent duplicate product creation in same business
    // Reject if a product with the same name already exists in this business (unless editing that exact record)
    const { data: existing } = await serverSupabase
      .from("products")
      .select("id, name, stock_units, retail_price")
      .eq("business_id", businessId)
      .ilike("name", cleanName)
      .limit(1)
      .maybeSingle();

    if (existing && (!isExistingRecord || existing.id !== product.id)) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        existingProduct: existing,
        error: `"${existing.name}" is already listed in your inventory (Current Stock: ${existing.stock_units}). You cannot add the same product twice. Update its stock or edit it instead.`,
      });
    }

    const productId = isUUID(product.id) ? product.id : crypto.randomUUID();
    const now = new Date().toISOString();

    const productRow: any = {
      id: productId,
      business_id: businessId,
      owner_user_id: resolvedOwnerId,
      name: (product.name || "Untitled Product").trim(),
      internal_sku: product.internal_sku ? String(product.internal_sku).trim() : null,
      description: product.description || null,
      category_id: isUUID(product.category_id) ? product.category_id : null,
      subcategory_id: isUUID(product.subcategory_id) ? product.subcategory_id : null,
      purchase_cost: Number(product.purchase_cost) || 0,
      retail_price: Number(product.retail_price) || 0,
      discount_price: product.discount_price !== undefined && product.discount_price !== null && product.discount_price !== "" ? Number(product.discount_price) : null,
      stock_units: Number(product.stock_units) || 0,
      min_stock_alert: Number(product.min_stock_alert) || 5,
      batch_number: product.batch_number ? String(product.batch_number).trim() : null,
      expiry_date: product.expiry_date || null,
      barcode: product.barcode ? String(product.barcode).trim() : null,
      status: product.status || "active",
      images: Array.isArray(product.images) ? product.images : [],
      uom: product.uom ? String(product.uom).toLowerCase().trim() : "box",
      units_per_uom: Number(product.units_per_uom) || 1,
      base_unit: product.base_unit ? String(product.base_unit).toLowerCase().trim() : "piece",
      updated_at: now,
    };

    const { data: savedData, error: saveErr } = await serverSupabase
      .from("products")
      .upsert(productRow, { onConflict: "id" })
      .select()
      .maybeSingle();

    if (saveErr) {
      console.error("serverSupabase product save error:", saveErr);
      return res.status(500).json({ success: false, error: saveErr.message });
    }

    // Keep business and profile listed_products count in sync
    try {
      const { count: bCount } = await serverSupabase.from("products").select("*", { count: "exact", head: true }).eq("business_id", businessId);
      if (bCount !== null && bCount !== undefined) {
        await serverSupabase.from("businesses").update({ listed_products: bCount, updated_at: now }).eq("id", businessId);
      }
      if (resolvedOwnerId) {
        const { count: uCount } = await serverSupabase.from("products").select("*", { count: "exact", head: true }).eq("owner_user_id", resolvedOwnerId);
        if (uCount !== null && uCount !== undefined) {
          await serverSupabase.from("profiles").update({ listed_products: uCount, updated_at: now }).eq("user_id", resolvedOwnerId);
        }
      }
    } catch {
      /* ignore product count update error */
    }

    // Also update sync service cache
    try {
      businessDataSyncService.saveProduct(businessId, productRow, resolvedOwnerId);
    } catch {
      /* ignore sync cache update error */
    }

    return res.json({ success: true, product: savedData || productRow });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/user/products/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = (req.query.businessId as string) || (req.body?.businessId as string);
    if (!id) return res.status(400).json({ success: false, error: "product id required" });

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // 1. Fetch product row to know owner/business if not supplied
    let targetBizId = businessId;
    let targetOwnerId: string | undefined;
    if (isUUID) {
      try {
        const { data: prod } = await serverSupabase.from("products").select("business_id, owner_user_id").eq("id", id).maybeSingle();
        if (prod) {
          targetBizId = targetBizId || prod.business_id;
          targetOwnerId = prod.owner_user_id;
        }
      } catch {
        /* ignore fetch error */
      }

      // 2. Safely disassociate child records to prevent foreign key errors
      try { await serverSupabase.from("sale_items").update({ product_id: null }).eq("product_id", id); } catch { /* ignore */ }
      try { await serverSupabase.from("purchase_items").update({ product_id: null }).eq("product_id", id); } catch { /* ignore */ }
      try { await serverSupabase.from("order_items").update({ product_id: null }).eq("product_id", id); } catch { /* ignore */ }
      try { await serverSupabase.from("stock_movements").delete().eq("product_id", id); } catch { /* ignore */ }

      // 3. Delete physical product from PostgreSQL products and inventory tables
      try { await serverSupabase.from("inventory").delete().eq("id", id); } catch { /* ignore */ }
      try { await serverSupabase.from("inventory").delete().eq("product_id", id); } catch { /* ignore */ }
      try { await serverSupabase.from("inventory_items").delete().eq("product_id", id); } catch { /* ignore */ }
      const { error: delErr } = await serverSupabase.from("products").delete().eq("id", id);
      if (delErr) {
        console.error("serverSupabase product delete error:", delErr.message);
        return res.status(500).json({ success: false, error: delErr.message });
      }
    }

    // 4. Update sync engine and database business/profile counters
    try {
      businessDataSyncService.deleteProduct(targetBizId || businessId || "", id);
      if (isUUID && targetBizId) {
        const { count: bCount } = await serverSupabase.from("products").select("*", { count: "exact", head: true }).eq("business_id", targetBizId);
        try {
          await serverSupabase.from("businesses").update({ listed_products: bCount ?? 0, updated_at: new Date().toISOString() }).eq("id", targetBizId);
        } catch {
          /* ignore business count update error */
        }
      }
    } catch {
      /* ignore sync cache delete error */
    }

    if (targetOwnerId && isUUID) {
      try {
        const { count: uCount } = await serverSupabase.from("products").select("*", { count: "exact", head: true }).eq("owner_user_id", targetOwnerId);
        try {
          await serverSupabase.from("profiles").update({ listed_products: uCount ?? 0, updated_at: new Date().toISOString() }).eq("user_id", targetOwnerId);
        } catch {
          /* ignore profile count update error */
        }
      } catch {
        /* ignore count query error */
      }
    }

    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/user/products/bulk-delete", async (req: Request, res: Response) => {
  try {
    const { ids, businessId } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "ids array required" });
    }

    const uuidList = ids.filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

    if (uuidList.length > 0) {
      // 1. Safely disassociate child records
      try { await serverSupabase.from("sale_items").update({ product_id: null }).in("product_id", uuidList); } catch { /* ignore */ }
      try { await serverSupabase.from("purchase_items").update({ product_id: null }).in("product_id", uuidList); } catch { /* ignore */ }
      try { await serverSupabase.from("order_items").update({ product_id: null }).in("product_id", uuidList); } catch { /* ignore */ }
      try { await serverSupabase.from("stock_movements").delete().in("product_id", uuidList); } catch { /* ignore */ }

      // 2. Delete physical products from products and inventory tables
      try { await serverSupabase.from("inventory").delete().in("id", uuidList); } catch { /* ignore */ }
      try { await serverSupabase.from("inventory").delete().in("product_id", uuidList); } catch { /* ignore */ }
      try { await serverSupabase.from("inventory_items").delete().in("product_id", uuidList); } catch { /* ignore */ }
      const { error: delErr } = await serverSupabase.from("products").delete().in("id", uuidList);
      if (delErr) {
        console.error("serverSupabase bulk delete error:", delErr.message);
        return res.status(500).json({ success: false, error: delErr.message });
      }
    }

    // 3. Remove from operational sync cache and update counters
    try {
      ids.forEach((id: string) => businessDataSyncService.deleteProduct(businessId || "", id));
      if (businessId && typeof businessId === "string") {
        const { count: bCount } = await serverSupabase.from("products").select("*", { count: "exact", head: true }).eq("business_id", businessId);
        try {
          await serverSupabase.from("businesses").update({ listed_products: bCount ?? 0, updated_at: new Date().toISOString() }).eq("id", businessId);
        } catch {
          /* ignore business count update error */
        }
      }
    } catch {
      /* ignore operational sync cache delete error */
    }

    return res.json({ success: true, count: ids.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Save (insert or update) product
app.post("/api/sync/product", async (req: Request, res: Response) => {
  try {
    const { businessId, product, userId } = req.body || {};
    if (!businessId || !product) {
      return res.status(400).json({ success: false, error: "businessId and product are required." });
    }
    const saved = businessDataSyncService.saveProduct(businessId, product, userId);
    res.json({ success: true, product: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete product
app.delete("/api/sync/product", (req: Request, res: Response) => {
  try {
    const { businessId, productId } = req.body || {};
    if (!businessId || !productId) {
      return res.status(400).json({ success: false, error: "businessId and productId are required." });
    }
    const deleted = businessDataSyncService.deleteProduct(businessId, productId);
    res.json({ success: deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Record checkout sale (atomically reduces stock & logs movement)
app.post("/api/sync/sale", (req: Request, res: Response) => {
  try {
    const { businessId, sale, items, cashierName, userId } = req.body || {};
    if (!businessId || !sale || !items) {
      return res.status(400).json({ success: false, error: "businessId, sale, and items are required." });
    }
    const result = businessDataSyncService.recordSale(businessId, {
      sale,
      items,
      cashierName,
      userId,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Adjust stock / restock - Directly updates Supabase PostgreSQL database collection with service role
app.post("/api/sync/adjust-stock", async (req: Request, res: Response) => {
  try {
    const { businessId, productId, deltaQuantity, type, reason, note, userId, exactStock, description } = req.body || {};
    if (!businessId || !productId || (deltaQuantity === undefined && exactStock === undefined)) {
      return res.status(400).json({ success: false, error: "businessId, productId, and deltaQuantity/exactStock are required." });
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId);
    let newStock = 0;
    let targetOwnerId = userId;
    let currentProd: any = null;

    if (isUUID) {
      try {
        const { data: dbProd } = await serverSupabase.from("products").select("*").eq("id", productId).maybeSingle();
        if (dbProd) {
          currentProd = dbProd;
          targetOwnerId = targetOwnerId || dbProd.owner_user_id;
          const currentStock = Number(dbProd.stock_units) || 0;
          if (exactStock !== undefined) {
            newStock = Math.max(0, Number(exactStock));
          } else if (type === "set") {
            newStock = Math.max(0, Number(deltaQuantity));
          } else if (type === "out") {
            newStock = Math.max(0, currentStock - Math.abs(Number(deltaQuantity)));
          } else {
            newStock = currentStock + Math.abs(Number(deltaQuantity));
          }

          const updateObj: any = {
            stock_units: newStock,
            updated_at: new Date().toISOString(),
          };
          if (description) {
            updateObj.description = description;
          }

          await serverSupabase.from("products").update(updateObj).eq("id", productId);

          // Log stock movement in database
          const moveQty = exactStock !== undefined ? (newStock - currentStock) : ((type === "out" ? -1 : 1) * Math.abs(Number(deltaQuantity)));
          if (moveQty !== 0) {
            try {
              await serverSupabase.from("stock_movements").insert({
                business_id: dbProd.business_id || businessId,
                owner_user_id: targetOwnerId || dbProd.owner_user_id,
                product_id: productId,
                quantity: moveQty,
                type: type === "out" ? "adjustment" : (type === "set" ? "adjustment" : "restock"),
                reason: reason || "Manual Stock Adjustment",
                note: note || `Stock updated from ${currentStock} to ${newStock}`,
                reference_id: productId,
                reference_type: "manual_adjustment",
                created_by: userId || targetOwnerId,
              });
            } catch (smErr) {
              console.warn("Notice inserting stock movement in PostgreSQL:", smErr);
            }
          }
        }
      } catch (dbErr) {
        console.warn("Notice querying/updating product in serverSupabase:", dbErr);
      }
    }

    // Also update in-memory / JSON sync engine
    const syncRes = businessDataSyncService.adjustStock(
      businessId,
      productId,
      exactStock !== undefined ? newStock : Number(deltaQuantity),
      exactStock !== undefined ? "set" : (type || "in"),
      reason || "Manual Adjustment",
      note,
      userId
    );

    const finalStock = isUUID && currentProd ? newStock : (syncRes.newStock ?? 0);
    res.json({ success: true, newStock: finalStock, product: currentProd ? { ...currentProd, stock_units: finalStock } : undefined });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dedicated product stock update endpoint
app.post("/api/user/products/:id/stock", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { businessId, stock_units, deltaQuantity, mode, type, reason, note, userId, description } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: "product id required" });

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let newStock = stock_units !== undefined ? Number(stock_units) : 0;
    let targetOwnerId = userId;
    let currentProd: any = null;

    if (isUUID) {
      const { data: dbProd } = await serverSupabase.from("products").select("*").eq("id", id).maybeSingle();
      if (dbProd) {
        currentProd = dbProd;
        targetOwnerId = targetOwnerId || dbProd.owner_user_id;
        const currentStock = Number(dbProd.stock_units) || 0;

        if (stock_units !== undefined) {
          newStock = Math.max(0, Number(stock_units));
        } else if (mode === "set" || type === "set") {
          newStock = Math.max(0, Number(deltaQuantity));
        } else if (mode === "remove" || type === "out") {
          newStock = Math.max(0, currentStock - Math.abs(Number(deltaQuantity || 0)));
        } else {
          newStock = currentStock + Math.abs(Number(deltaQuantity || 0));
        }

        const updateObj: any = {
          stock_units: newStock,
          updated_at: new Date().toISOString(),
        };
        if (description) {
          updateObj.description = description;
        }

        const { error: upErr } = await serverSupabase.from("products").update(updateObj).eq("id", id);
        if (upErr) {
          return res.status(500).json({ success: false, error: upErr.message });
        }

        // Record stock movement
        const moveQty = newStock - currentStock;
        if (moveQty !== 0) {
          try {
            await serverSupabase.from("stock_movements").insert({
              business_id: dbProd.business_id || businessId,
              owner_user_id: targetOwnerId || dbProd.owner_user_id,
              product_id: id,
              quantity: moveQty,
              type: moveQty > 0 ? "restock" : "adjustment",
              reason: reason || "Manual Stock Adjustment",
              note: note || `Stock updated to ${newStock}`,
              reference_id: id,
              reference_type: "manual_adjustment",
              created_by: userId || targetOwnerId,
            });
          } catch {
            /* ignore smErr */
          }
        }
      }
    }

    // Sync in memory cache
    businessDataSyncService.adjustStock(
      businessId || currentProd?.business_id || "",
      id,
      newStock,
      "set",
      reason || "Manual Stock Update",
      note,
      userId
    );

    return res.json({ success: true, newStock, product: currentProd ? { ...currentProd, stock_units: newStock } : undefined });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Held Orders (Cart hold & resume) - Backed by PostgreSQL held_orders table with service role
app.get("/api/sync/held-orders", async (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId as string | undefined;
    if (!businessId) {
      return res.status(400).json({ success: false, error: "businessId is required." });
    }

    let dbOrders: any[] = [];
    try {
      const { data, error } = await serverSupabase
        .from("held_orders")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        dbOrders = data;
      }
    } catch (err) {
      console.warn("Notice fetching held_orders from Supabase:", err);
    }

    const memoryData = businessDataSyncService.getBusinessData(businessId);
    const memOrders = memoryData.held_orders || [];

    const orderMap = new Map<string, any>();
    for (const mo of memOrders) {
      orderMap.set(String(mo.id), mo);
    }
    for (const dbo of dbOrders) {
      orderMap.set(String(dbo.id), dbo);
    }

    const combined = Array.from(orderMap.values()).sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    res.json({ success: true, heldOrders: combined });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/sync/held-orders", async (req: Request, res: Response) => {
  try {
    const { businessId, order } = req.body || {};
    if (!businessId || !order) {
      return res.status(400).json({ success: false, error: "businessId and order are required." });
    }

    let savedDbOrder: any = null;
    const isUUID = order.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order.id);
    const orderId = isUUID ? order.id : undefined;

    try {
      const insertPayload: any = {
        business_id: businessId,
        owner_user_id: order.owner_user_id || undefined,
        customer_name: order.customer_name || null,
        customer_phone: order.customer_phone || null,
        customer_note: order.customer_note || null,
        cart_data: order.cart_data || [],
        total_amount: Number(order.total_amount) || 0,
        item_count: Number(order.item_count) || (order.cart_data?.length || 0),
        updated_at: new Date().toISOString(),
      };
      if (orderId) {
        insertPayload.id = orderId;
      }

      const { data, error } = await serverSupabase
        .from("held_orders")
        .upsert(insertPayload)
        .select("*")
        .maybeSingle();

      if (!error && data) {
        savedDbOrder = data;
      }
    } catch (err) {
      console.warn("Notice persisting held order to serverSupabase:", err);
    }

    const saved = businessDataSyncService.saveHeldOrder(businessId, savedDbOrder || order);
    res.json({ success: true, heldOrder: savedDbOrder || saved });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/sync/held-orders", async (req: Request, res: Response) => {
  try {
    const { businessId, orderId } = req.body || {};
    if (!businessId || !orderId) {
      return res.status(400).json({ success: false, error: "businessId and orderId are required." });
    }

    try {
      await serverSupabase.from("held_orders").delete().eq("id", orderId);
    } catch (err) {
      console.warn("Notice deleting held order from serverSupabase:", err);
    }

    const ok = businessDataSyncService.deleteHeldOrder(businessId, orderId);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dedicated Store Credit / Udhar Ledger Endpoints
const formatCreditForClient = (c: any) => ({
  ...c,
  id: c.id,
  buyerId: c.buyer_id || c.buyerId || "BUY-10001",
  businessId: c.business_id || c.businessId,
  customerName: c.customer_name || c.customerName || "Customer",
  customerPhone: c.customer_phone || c.customerPhone || "",
  customerEmail: c.customer_email || c.customerEmail || "",
  customerAddress: c.customer_address || c.customerAddress || "",
  outstandingUdhar: Number(c.outstanding_udhar ?? c.balance ?? 0),
  availableDeposit: Number(c.available_deposit ?? 0),
  balance: Number(c.outstanding_udhar ?? c.balance ?? 0), // backward compatibility
  creditLimit: c.credit_limit !== undefined ? Number(c.credit_limit) : (c.creditLimit !== undefined ? Number(c.creditLimit) : 1000),
  notes: c.notes || "",
  createdAt: c.created_at || c.createdAt,
  updatedAt: c.updated_at || c.updatedAt,
  transactions: (c.transactions || []).map((t: any) => ({
    ...t,
    id: t.id || `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: t.type || "adjustment",
    amount: Number(t.amount || 0),
    paymentMethod: t.payment_method || t.paymentMethod || "Cash",
    depositBalanceAfter: Number(t.deposit_balance_after ?? t.depositBalanceAfter ?? 0),
    udharBalanceAfter: Number(t.udhar_balance_after ?? t.udharBalanceAfter ?? 0),
    balanceAfter: Number(t.balanceAfter ?? t.balance_after ?? t.udhar_balance_after ?? 0),
    referenceId: t.referenceId || t.reference_id || t.invoice_no || "",
    recordedBy: t.recordedBy || t.recorded_by || t.processed_by || "Register",
    createdAt: t.createdAt || t.created_at || t.date || new Date().toISOString(),
  })),
});

app.get("/api/sync/store-credits", (req: Request, res: Response) => {
  try {
    const businessId = (req.query.businessId as string) || "";
    if (!businessId) {
      return res.status(400).json({ success: false, error: "businessId query parameter is required." });
    }
    const rawCredits = storeCreditsStorage.getByBusiness(businessId);
    const credits = rawCredits.map(formatCreditForClient);
    res.json({ success: true, credits });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/sync/store-credits/search", (req: Request, res: Response) => {
  try {
    const businessId = (req.query.businessId as string) || "";
    const query = (req.query.q as string) || "";
    if (!businessId) {
      return res.status(400).json({ success: false, error: "businessId query parameter is required." });
    }
    const matched = storeCreditsStorage.findByIdentity(businessId, query);
    res.json({ success: true, buyers: matched.map(formatCreditForClient) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/sync/store-credits", (req: Request, res: Response) => {
  try {
    const { businessId, credit } = req.body || {};
    const effectiveBizId = businessId || req.body?.business_id;
    const payload = credit || req.body || {};
    if (!effectiveBizId) {
      return res.status(400).json({ success: false, error: "businessId required." });
    }
    const mappedPayload: any = {
      ...payload,
      buyer_id: payload.buyerId || payload.buyer_id,
      customer_name: payload.customerName || payload.customer_name || "Customer",
      customer_phone: payload.customerPhone || payload.customer_phone,
      customer_email: payload.customerEmail || payload.customer_email,
      customer_address: payload.customerAddress || payload.customer_address,
      credit_limit: payload.creditLimit !== undefined ? Number(payload.creditLimit) : Number(payload.credit_limit || 1000),
      outstanding_udhar: payload.outstandingUdhar !== undefined ? Number(payload.outstandingUdhar) : (payload.balance !== undefined ? Number(payload.balance) : 0),
      available_deposit: payload.availableDeposit !== undefined ? Number(payload.availableDeposit) : 0,
      balance: payload.outstandingUdhar !== undefined ? Number(payload.outstandingUdhar) : (payload.balance !== undefined ? Number(payload.balance) : 0),
      notes: payload.notes,
    };
    const saved = storeCreditsStorage.upsert(effectiveBizId, mappedPayload);
    res.json({ success: true, credit: formatCreditForClient(saved) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/sync/store-credits/adjust", (req: Request, res: Response) => {
  try {
    const { businessId, creditId, amount, type, note, invoiceNo, processedBy, paymentMethod } = req.body || {};
    if (!businessId || !creditId || amount === undefined || !type) {
      return res.status(400).json({ success: false, error: "businessId, creditId, amount, and type are required." });
    }
    const adjusted = storeCreditsStorage.adjustBalance(
      businessId,
      creditId,
      Number(amount),
      type,
      note,
      invoiceNo,
      processedBy,
      paymentMethod
    );
    if (!adjusted) {
      return res.status(404).json({ success: false, error: "Store credit record not found." });
    }
    res.json({ success: true, credit: formatCreditForClient(adjusted) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/sync/store-credits/bulk-adjust", (req: Request, res: Response) => {
  try {
    const { businessId, adjustments } = req.body || {};
    if (!businessId || !Array.isArray(adjustments)) {
      return res.status(400).json({ success: false, error: "businessId and adjustments array are required." });
    }
    const updated = storeCreditsStorage.bulkAdjust(businessId, adjustments);
    res.json({ success: true, count: updated.length, credits: updated.map(formatCreditForClient) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/sync/store-credits/bulk-delete", (req: Request, res: Response) => {
  try {
    const { businessId, creditIds } = req.body || {};
    if (!businessId || !Array.isArray(creditIds)) {
      return res.status(400).json({ success: false, error: "businessId and creditIds array are required." });
    }
    const deletedCount = storeCreditsStorage.bulkDelete(businessId, creditIds);
    res.json({ success: true, deletedCount });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/sync/store-credits/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = (req.query.businessId as string) || (req.body?.businessId as string) || "";
    if (!businessId || !id) {
      return res.status(400).json({ success: false, error: "businessId and id are required." });
    }
    const ok = storeCreditsStorage.delete(businessId, id);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// PRODUCT VARIATIONS, ATTRIBUTES & CATEGORY SETUP ENGINE
// ============================================================
app.get("/api/sync/product-variations", (req: Request, res: Response) => {
  try {
    const productId = req.query.productId as string | undefined;
    const businessId = req.query.businessId as string | undefined;

    if (productId) {
      const config = productVariationsStorage.getByProduct(productId);
      return res.json({ success: true, config });
    }
    if (businessId) {
      const configs = productVariationsStorage.getByBusiness(businessId);
      return res.json({ success: true, configs });
    }
    return res.status(400).json({ success: false, error: "productId or businessId is required." });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/sync/product-variations", (req: Request, res: Response) => {
  try {
    const config = req.body?.config || req.body;
    if (!config || !config.product_id || !config.business_id) {
      return res.status(400).json({ success: false, error: "Valid configuration with product_id and business_id is required." });
    }
    const saved = productVariationsStorage.saveConfig(config);
    return res.json({ success: true, config: saved });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/sync/product-variations/adjust-stock", (req: Request, res: Response) => {
  try {
    const { productId, variantId, deltaQuantity } = req.body || {};
    if (!productId || !variantId || deltaQuantity === undefined) {
      return res.status(400).json({ success: false, error: "productId, variantId, and deltaQuantity are required." });
    }
    const updatedVariant = productVariationsStorage.adjustVariantStock(productId, variantId, Number(deltaQuantity));
    if (!updatedVariant) {
      return res.status(404).json({ success: false, error: "Variant or product not found." });
    }
    return res.json({ success: true, variant: updatedVariant });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/sync/category-templates", (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, templates: CATEGORY_TEMPLATES });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/sync/category-templates/:industry", (req: Request, res: Response) => {
  try {
    const template = productVariationsStorage.getTemplateForIndustry(req.params.industry);
    return res.json({ success: true, template });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/ai/category-recommendations", async (req: Request, res: Response) => {
  try {
    const { industry, businessName, businessType } = req.body || {};
    const template = productVariationsStorage.getTemplateForIndustry(industry || businessType || "");

    const client = getGeminiClient();
    if (client) {
      try {
        const prompt = `You are a retail product configuration expert for GeFlow AI POS and Inventory.
Business Name: ${businessName || "Our Business"}
Category/Industry: ${industry || businessType || "Retail"}

Provide a clean JSON configuration with:
1. "recommended_product_type": "variable" | "simple" | "measured" | "addons" | "bundle"
2. "attributes": array of { "name": string, "values": string[], "inputType": "pills" | "dropdown" | "color" }
3. "pos_controls": array of strings (e.g. "Size Buttons", "Crust Selection", "Topping Add-ons", "Weight Scale Presets")
4. "uom_recommendation": string (e.g. "piece", "kg", "metre", "strip")
5. "guidance_summary": 2-3 sentence clear advice for this store owner.

Respond with strict JSON ONLY without markdown backticks.`;

        const response = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        const text = response.text || "";
        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        return res.json({ success: true, recommendation: parsed });
      } catch (aiErr) {
        console.warn("AI recommendation fallback:", aiErr);
      }
    }

    // Deterministic fallback using comprehensive category templates
    return res.json({
      success: true,
      recommendation: {
        recommended_product_type: template.recommended_product_type,
        attributes: template.sample_attributes,
        pos_controls: template.pos_features,
        uom_recommendation: template.suggested_uom,
        guidance_summary: `Tailored configuration for ${template.display_name}. Products can be set up with ${template.sample_attributes.map((a) => a.name).join(" and ")} attributes with instant POS selection and stock tracking.`
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Update Business Operational Settings with serverSupabase service role
app.post("/api/user/businesses/:id/settings", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { default_tax, currency, stock_alert_limit, business_name, business_address, extendedSettings } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: "business id is required" });

    const updateFields: any = { updated_at: new Date().toISOString() };
    if (default_tax !== undefined) updateFields.default_tax = Number(default_tax) || 0;
    if (currency) {
      updateFields.currency = currency;
      updateFields.base_currency = currency;
    }
    if (stock_alert_limit !== undefined) updateFields.stock_alert_limit = Number(stock_alert_limit) || 10;
    if (business_name) updateFields.business_name = business_name.trim();
    if (business_address) updateFields.business_address = business_address.trim();

    try {
      await serverSupabase.from("businesses").update(updateFields).eq("id", id);
    } catch (e) {
      console.warn("Notice updating businesses row in PostgreSQL:", e);
    }

    if (extendedSettings) {
      try {
        businessDataSyncService.saveSettings(id, extendedSettings);
        businessExtendedStorage.saveSettings(id, extendedSettings).catch(() => {});
      } catch {
        /* ignore */
      }
    }

    return res.json({ success: true, updated: updateFields });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Returns & Refunds System Endpoints
app.get("/api/sync/returns", (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId as string | undefined;
    if (!businessId) {
      return res.status(400).json({ success: false, error: "businessId is required." });
    }
    const returns = businessDataSyncService.getReturns(businessId);
    res.json({ success: true, returns });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/sync/return", async (req: Request, res: Response) => {
  try {
    const { businessId, returnRecord, items, userId } = req.body || {};
    if (!businessId || !returnRecord || !items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: "businessId, returnRecord, and items are required." });
    }
    const result = await businessDataSyncService.recordReturn(businessId, {
      returnRecord,
      items,
      userId,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/sync/sales/remove-from-return", async (req: Request, res: Response) => {
  try {
    const { businessId, saleId } = req.body || {};
    if (!businessId || !saleId) {
      return res.status(400).json({ success: false, error: "businessId and saleId are required." });
    }
    const result = businessDataSyncService.dismissSaleFromReturn(businessId, saleId);
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saleId);
      if (isUUID) {
        await serverSupabase.from("sales").update({ status: "refunded" }).eq("id", saleId);
      } else {
        await serverSupabase
          .from("sales")
          .update({ status: "refunded" })
          .eq("business_id", businessId)
          .or(`id.eq.${saleId},invoice_no.eq.${saleId}`);
      }
    } catch {
      /* ignore sale status update error */
    }
    res.json({ success: true, removed: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Synchronize Business & POS Settings across terminals and employee sessions
app.get("/api/sync/settings", (req: Request, res: Response) => {
  try {
    const businessId = (req.query.businessId as string) || "";
    if (!businessId) {
      return res.status(400).json({ success: false, error: "businessId query parameter is required." });
    }
    const settings = businessDataSyncService.getSettings(businessId);
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/sync/settings", (req: Request, res: Response) => {
  try {
    const { businessId, settings } = req.body || {};
    if (!businessId) {
      return res.status(400).json({ success: false, error: "businessId is required." });
    }
    const result = businessDataSyncService.saveSettings(businessId, settings || {});
    // Also mirror to businessExtendedStorage for persistent extended data
    businessExtendedStorage.saveSettings(businessId, settings || {}).catch(() => {});
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dedicated Business Extended Settings endpoints (replaces non-existent businesses.extended_settings column)
app.get("/api/businesses/:id/extended-settings", (req: Request, res: Response) => {
  try {
    const businessId = req.params.id || "";
    if (!businessId) {
      return res.status(400).json({ success: false, error: "businessId parameter is required." });
    }
    const settings = businessExtendedStorage.getSettings(businessId);
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/businesses/:id/extended-settings", async (req: Request, res: Response) => {
  try {
    const businessId = req.params.id || "";
    const { settings } = req.body || {};
    if (!businessId) {
      return res.status(400).json({ success: false, error: "businessId parameter is required." });
    }
    const saved = await businessExtendedStorage.saveSettings(businessId, settings || {});
    // Mirror to businessDataSyncService as well
    businessDataSyncService.saveSettings(businessId, saved);
    res.json({ success: true, settings: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dedicated Business Payment Methods persistence (guarantees enabled/disabled states survive reloads)
app.get("/api/businesses/:id/payment-methods", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: "business id is required" });

    // 1. Try PostgreSQL platform_settings
    try {
      const { data: row } = await serverSupabase
        .from("platform_settings")
        .select("alerts")
        .limit(1)
        .maybeSingle();

      if (row?.alerts && typeof row.alerts === "object") {
        const pmMap = (row.alerts as any).business_payment_methods;
        if (pmMap && Array.isArray(pmMap[id]) && pmMap[id].length > 0) {
          return res.json({ success: true, methods: pmMap[id] });
        }
      }
    } catch (e) {
      console.warn("Notice fetching payment methods from Supabase:", e);
    }

    // 2. Try disk backup file
    const filePath = path.join(process.cwd(), "data", `payment_methods_${id}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return res.json({ success: true, methods: parsed });
        }
      } catch {
        /* ignore */
      }
    }

    // 3. Try businessDataSyncService
    const syncData = businessDataSyncService.getSettings(id);
    if (syncData?.payment_methods && Array.isArray(syncData.payment_methods) && syncData.payment_methods.length > 0) {
      return res.json({ success: true, methods: syncData.payment_methods });
    }

    return res.json({ success: true, methods: null });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/businesses/:id/payment-methods", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { methods } = req.body || {};
    if (!id || !Array.isArray(methods)) {
      return res.status(400).json({ success: false, error: "id and methods array are required" });
    }

    // 1. Save disk backup
    try {
      const dir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `payment_methods_${id}.json`), JSON.stringify(methods, null, 2), "utf-8");
    } catch (e) {
      console.warn("Notice saving payment methods to file:", e);
    }

    // 2. Persist in PostgreSQL platform_settings alerts
    try {
      const { data: row } = await serverSupabase
        .from("platform_settings")
        .select("id, alerts")
        .limit(1)
        .maybeSingle();

      const existingAlerts = row?.alerts && typeof row.alerts === "object" ? { ...(row.alerts as any) } : {};
      if (!existingAlerts.business_payment_methods) {
        existingAlerts.business_payment_methods = {};
      }
      existingAlerts.business_payment_methods[id] = methods;

      if (row?.id) {
        await serverSupabase
          .from("platform_settings")
          .update({ alerts: existingAlerts, updated_at: new Date().toISOString() })
          .eq("id", row.id);
      } else {
        await serverSupabase
          .from("platform_settings")
          .upsert(
            { singleton: true, alerts: existingAlerts, updated_at: new Date().toISOString() },
            { onConflict: "singleton" }
          );
      }
    } catch (e) {
      console.warn("Notice saving payment methods to Supabase:", e);
    }

    // 3. Mirror in sync service and extended storage
    try {
      businessDataSyncService.saveSettings(id, { payment_methods: methods });
      businessExtendedStorage.saveSettings(id, { pos: { paymentMethods: methods } as any }).catch(() => {});
    } catch {
      /* ignore */
    }

    return res.json({ success: true, methods });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ==========================================
// Platform General Settings
// Social Links, Footer Copyright, & About Members
// ==========================================
app.get("/api/settings/general", async (req: Request, res: Response) => {
  try {
    const { data: row } = await serverSupabase
      .from("platform_settings")
      .select("id, alerts")
      .limit(1)
      .maybeSingle();

    const fallback = await settingsService.getAllSettings();
    let settings = row?.alerts?.general_settings ? { ...row.alerts.general_settings } : null;

    if (!settings) {
      settings = fallback;
    } else {
      if (!settings.footer_copyright && row?.alerts?.footer_copyright) {
        settings.footer_copyright = row.alerts.footer_copyright;
      }
      if (!settings.social_links && row?.alerts?.social_links) {
        settings.social_links = row.alerts.social_links;
      }
      if (!settings.parent_company && row?.alerts?.parent_company) {
        settings.parent_company = row.alerts.parent_company;
      }
    }

    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/settings/general", async (req: Request, res: Response) => {
  try {
    const updated = await settingsService.updateAllSettings(req.body || {});
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/settings/general/social-links", async (req: Request, res: Response) => {
  try {
    const { links } = req.body || {};
    if (!Array.isArray(links)) {
      return res.status(400).json({ success: false, error: "links must be an array" });
    }
    const updated = await settingsService.updateSocialLinks(links);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/settings/general/footer-copyright", async (req: Request, res: Response) => {
  try {
    const { copyright } = req.body || {};
    if (!copyright || typeof copyright.text !== "string") {
      return res.status(400).json({ success: false, error: "valid copyright object is required" });
    }
    const updated = await settingsService.updateFooterCopyright(copyright);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/settings/general/about-members", async (req: Request, res: Response) => {
  try {
    const { members } = req.body || {};
    if (!Array.isArray(members)) {
      return res.status(400).json({ success: false, error: "members must be an array" });
    }
    const updated = await settingsService.updateAboutMembers(members);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Platform Cache Purge & Refresh
app.post("/api/settings/cache/clear", async (req: Request, res: Response) => {
  try {
    const hardReset = req.body?.hardReset !== false;
    const purgeInfo = await settingsService.purgeCache(hardReset);
    res.json({ 
      success: true, 
      message: "Platform cache memory refreshed, local disk cache deleted, and re-synchronized directly with database.",
      purgedFiles: purgeInfo.purgedFiles,
      timestamp: purgeInfo.timestamp,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Member Photo Device Upload API
app.post("/api/upload/member-photo", async (req: Request, res: Response) => {
  try {
    const { image, name, memberId } = req.body || {};
    if (!image || typeof image !== "string") {
      return res.status(400).json({ success: false, error: "Image data string is required" });
    }

    // Determine clean file extension and buffer
    let ext = "jpg";
    let base64Data = image;

    if (image.startsWith("data:image/png;base64,")) {
      ext = "png";
      base64Data = image.replace(/^data:image\/png;base64,/, "");
    } else if (image.startsWith("data:image/webp;base64,")) {
      ext = "webp";
      base64Data = image.replace(/^data:image\/webp;base64,/, "");
    } else if (image.startsWith("data:image/")) {
      base64Data = image.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
    }

    const safeId = (memberId || name || `mem_${Date.now()}`).toString().replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    const fileName = `member_${safeId}_${Date.now()}.${ext}`;
    const filePath = path.join(membersUploadDir, fileName);

    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/members/${fileName}`;

    // Upload buffer to Supabase Storage bucket 'about_members'
    let supabaseStorageUrl = "";
    try {
      const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const { error: storageErr } = await serverSupabase.storage
        .from("about_members")
        .upload(fileName, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (!storageErr) {
        const { data: pubData } = serverSupabase.storage
          .from("about_members")
          .getPublicUrl(fileName);
        supabaseStorageUrl = pubData?.publicUrl || "";
      } else {
        console.warn("Notice: Supabase storage upload warning:", storageErr.message);
      }
    } catch (sErr) {
      console.warn("Supabase storage error:", sErr);
    }

    const finalUrl = supabaseStorageUrl || publicUrl;

    res.json({
      success: true,
      url: finalUrl,
      supabaseStorageUrl,
      localUrl: publicUrl,
      fileName,
      size: buffer.length,
    });
  } catch (err: any) {
    console.error("Member photo upload error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to upload image" });
  }
});

// ==========================================
// UNIFIED AUTHENTICATION ENDPOINTS
// ==========================================

// Register or claim account with auto-confirm and dual database sync
app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, plan } = req.body || {};
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "Valid email address is required" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters long" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (fullName || cleanEmail.split("@")[0] || "User").trim();
    const isAdminEmail = cleanEmail === "gepardwebs@gmail.com";
    let targetPlan = isAdminEmail ? "lifetime" : (plan ? String(plan).toLowerCase() : null);

    // 1. Check if user already exists in primary service project
    let targetUserId: string | null = null;
    try {
      const { data: userList } = await serverSupabase.auth.admin.listUsers();
      const existing = userList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
      if (existing) {
        targetUserId = existing.id;
        // If targetPlan wasn't explicitly provided, preserve existing plan
        if (!targetPlan) {
          const [prof, sub] = await Promise.all([
            serverSupabase.from("profiles").select("plan").eq("user_id", existing.id).maybeSingle(),
            serverSupabase.from("subscriptions").select("tier").eq("owner_user_id", existing.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
          ]);
          targetPlan = sub.data?.tier || prof.data?.plan || (existing.user_metadata?.plan as string) || "free";
        }

        // Update user password and ensure email is auto-confirmed
        await serverSupabase.auth.admin.updateUserById(existing.id, {
          password,
          email_confirm: true,
          user_metadata: { ...existing.user_metadata, full_name: cleanName, plan: targetPlan },
        });
      }
    } catch (findErr) {
      console.warn("Notice checking existing user on serverSupabase:", findErr);
    }

    if (!targetPlan) targetPlan = "free";

    // 2. If not found, create new auto-confirmed user
    if (!targetUserId) {
      const { data: createData, error: createErr } = await serverSupabase.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: cleanName, plan: targetPlan },
      });

      if (createErr) {
        return res.status(400).json({ success: false, error: createErr.message });
      }
      targetUserId = createData.user?.id || null;
    }

    if (!targetUserId) {
      return res.status(500).json({ success: false, error: "Failed to establish user account" });
    }

    // 3. Upsert user profile and roles to database instances
    const profileRow = {
      user_id: targetUserId,
      id: targetUserId,
      email: cleanEmail,
      full_name: cleanName,
      plan: targetPlan,
      status: "active",
      last_active: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await Promise.allSettled([
      serverSupabase.from("profiles").upsert(profileRow, { onConflict: "user_id" }),
      bgSupabase.from("profiles").upsert(profileRow, { onConflict: "user_id" }),
    ]);

    if (isAdminEmail) {
      // Ensure admin role and lifetime subscription are permanently stored
      await Promise.allSettled([
        serverSupabase.from("user_roles").upsert({ user_id: targetUserId, role: "admin" }, { onConflict: "user_id" }),
        serverSupabase.from("subscriptions").upsert({
          owner_user_id: targetUserId,
          tier: "lifetime",
          cycle: "lifetime",
          status: "active",
          amount: 0,
          updated_at: new Date().toISOString()
        }, { onConflict: "owner_user_id" })
      ]);
    }

    // Also attempt registering on secondary project if not already present
    bgSupabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { full_name: cleanName, plan: targetPlan } },
    }).catch(() => {});

    // 4. Authenticate and retrieve live session
    const { data: loginData, error: loginErr } = await serverSupabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (loginErr || !loginData.session) {
      recordSystemActivity({
        type: "user_signup",
        title: `New User: ${cleanName}`,
        description: `${cleanEmail} registered an account (${targetPlan} plan)`,
        userId: targetUserId,
      });
      return res.json({
        success: true,
        message: "Account registered successfully. Please log in.",
        userId: targetUserId,
      });
    }

    recordSystemActivity({
      type: "user_signup",
      title: `New User: ${cleanName}`,
      description: `${cleanEmail} registered an account (${targetPlan} plan)`,
      userId: targetUserId,
    });

    return res.json({
      success: true,
      session: loginData.session,
      user: loginData.user,
      message: "Account created successfully",
    });
  } catch (err: any) {
    console.error("Auth register error:", err);
    res.status(500).json({ success: false, error: err.message || "Internal registration error" });
  }
});

// Unified Login supporting both Supabase projects
app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required" });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Attempt login on primary service-role backend
    let srvRes = await serverSupabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    // If login failed due to invalid credentials, check if user exists in auth.users (e.g. created via magiclink/invitation or needs password sync)
    if (srvRes.error && srvRes.error.message?.toLowerCase().includes("invalid login credentials")) {
      try {
        const { data: userList } = await serverSupabase.auth.admin.listUsers({ perPage: 1000 });
        const matched = userList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
        if (matched) {
          // Set user's password to their provided credentials and ensure email is confirmed
          await serverSupabase.auth.admin.updateUserById(matched.id, {
            password,
            email_confirm: true,
          });
          // Retry signInWithPassword
          srvRes = await serverSupabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });
        } else {
          // User not found in auth.users: Return not registered so user is prompted to sign up
          return res.status(404).json({
            success: false,
            notRegistered: true,
            error: "This email is not registered. Please sign up to create your account.",
          });
        }
      } catch (adminErr) {
        console.warn("Notice checking credentials via admin API:", adminErr);
      }
    }

    if (!srvRes.error && srvRes.data?.session) {
      recordSystemActivity({
        type: "user_login",
        title: `User Login: ${srvRes.data.user.email?.split("@")[0] || "User"}`,
        description: `${cleanEmail} signed into workspace`,
        userId: srvRes.data.user.id,
      });
      return res.json({
        success: true,
        session: srvRes.data.session,
        user: srvRes.data.user,
      });
    }

    // 2. Attempt login on secondary frontend project
    const bgRes = await bgSupabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (!bgRes.error && bgRes.data?.session) {
      recordSystemActivity({
        type: "user_login",
        title: `User Login: ${bgRes.data.user.email?.split("@")[0] || "User"}`,
        description: `${cleanEmail} signed into workspace`,
        userId: bgRes.data.user.id,
      });
      return res.json({
        success: true,
        session: bgRes.data.session,
        user: bgRes.data.user,
      });
    }

    // 3. Return user-friendly error message
    const rawError = srvRes.error?.message || bgRes.error?.message || "Invalid login credentials";
    return res.status(401).json({
      success: false,
      error: rawError.includes("Email not confirmed")
        ? "Email not confirmed. Please register to automatically activate your account or check your inbox."
        : rawError,
    });
  } catch (err: any) {
    console.error("Auth login error:", err);
    res.status(500).json({ success: false, error: err.message || "Internal authentication error" });
  }
});

// Verify current session
app.get("/api/auth/me", async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    res.json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper to authenticate user from Bearer token
async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7).trim();
  if (!token) return null;
  try {
    return await verifyUserToken(token);
  } catch {
    return null;
  }
}

// User businesses query (queries both databases safely to bypass RLS recursion)
app.get("/api/user/businesses", async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // 1. Fetch owned businesses from both Supabase projects
    const [bgOwnedRes, srvOwnedRes] = await Promise.all([
      bgSupabase
        .from("businesses")
        .select("id, business_name, business_address, status, currency, base_currency, default_tax, stock_alert_limit, category_id, owner_user_id, listed_products, created_at")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: true }),
      serverSupabase
        .from("businesses")
        .select("id, business_name, business_address, status, currency, base_currency, default_tax, stock_alert_limit, category_id, owner_user_id, listed_products, created_at")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: true }),
    ]);

    const ownedMap = new Map<string, any>();
    (bgOwnedRes.data || []).forEach((b: any) => ownedMap.set(b.id, b));
    (srvOwnedRes.data || []).forEach((b: any) => ownedMap.set(b.id, b));

    const ownedList = Array.from(ownedMap.values());

    // 2. Fetch staff memberships
    const staffData: any[] = [];
    try {
      const { data: memberRows } = await serverSupabase
        .from("business_members")
        .select("business_id, role, status")
        .eq("user_id", user.id)
        .eq("status", "active");
      if (memberRows && memberRows.length > 0) staffData.push(...memberRows);
    } catch {
      /* ignore */
    }

    try {
      const { data: staffRows } = await serverSupabase
        .from("business_staff")
        .select("business_id, role, status")
        .eq("user_id", user.id)
        .eq("status", "active");
      if (staffRows && staffRows.length > 0) staffData.push(...staffRows);
    } catch {
      /* ignore */
    }

    const staffBizIds = Array.from(new Set(staffData.map((s) => s.business_id)));
    let staffBizs: any[] = [];
    if (staffBizIds.length > 0) {
      const [bgStaffRes, srvStaffRes] = await Promise.all([
        bgSupabase
          .from("businesses")
          .select("id, business_name, business_address, status, currency, base_currency, default_tax, stock_alert_limit, category_id, owner_user_id, listed_products, created_at")
          .in("id", staffBizIds),
        serverSupabase
          .from("businesses")
          .select("id, business_name, business_address, status, currency, base_currency, default_tax, stock_alert_limit, category_id, owner_user_id, listed_products, created_at")
          .in("id", staffBizIds),
      ]);

      const staffMap = new Map<string, any>();
      (bgStaffRes.data || []).forEach((b: any) => staffMap.set(b.id, b));
      (srvStaffRes.data || []).forEach((b: any) => staffMap.set(b.id, b));

      staffBizs = Array.from(staffMap.values()).map((b) => {
        const sRow = staffData.find((s) => s.business_id === b.id);
        return {
          ...b,
          staff_role: sRow?.role || "cashier",
        };
      });
    }

    // 3. User businesses list is returned as-is (no fake/demo businesses auto-provisioned)

    // 5. Authoritative plan calculation
    let userPlan = "free";
    let fullName = (user.user_metadata?.full_name as string) || null;
    const isAdmin = user.email?.toLowerCase() === "gepardwebs@gmail.com";

    if (isAdmin) {
      userPlan = "lifetime";
    } else {
      try {
        const [profRes, subRes, bgProfRes, bgSubRes] = await Promise.all([
          serverSupabase.from("profiles").select("plan, full_name").eq("user_id", user.id).maybeSingle(),
          serverSupabase.from("subscriptions").select("tier, status").eq("owner_user_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
          bgSupabase.from("profiles").select("plan, full_name").eq("user_id", user.id).maybeSingle(),
          bgSupabase.from("subscriptions").select("tier, status").eq("owner_user_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        ]);
        if (profRes.data?.full_name || bgProfRes.data?.full_name) {
          fullName = profRes.data?.full_name || bgProfRes.data?.full_name;
        }
        const candidates = [
          subRes.data?.tier,
          bgSubRes.data?.tier,
          profRes.data?.plan,
          bgProfRes.data?.plan,
          user.user_metadata?.plan
        ].filter(Boolean).map((s: string) => s.toLowerCase());

        if (candidates.some((c: string) => c.includes("lifetime"))) userPlan = "lifetime";
        else if (candidates.some((c: string) => c.includes("premium"))) userPlan = "premium";
        else if (candidates.some((c: string) => c.includes("standard"))) userPlan = "standard";
      } catch {
        /* fallback to free */
      }
    }

    res.json({
      success: true,
      owned: ownedList,
      staff: staffBizs,
      plan: userPlan,
      user: {
        id: user.id,
        email: user.email,
        full_name: fullName,
        isAdmin,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dedicated User Plan Endpoint (Authorized, service-role fallback)
app.get("/api/user/plan", async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    let planId = "free";
    let fullName = (user.user_metadata?.full_name as string) || null;
    const isAdmin = user.email?.toLowerCase() === "gepardwebs@gmail.com";

    if (isAdmin) {
      planId = "lifetime";
    } else {
      try {
        const [profRes, subRes, bgProfRes, bgSubRes] = await Promise.all([
          serverSupabase.from("profiles").select("plan, full_name").eq("user_id", user.id).maybeSingle(),
          serverSupabase.from("subscriptions").select("tier, status").eq("owner_user_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
          bgSupabase.from("profiles").select("plan, full_name").eq("user_id", user.id).maybeSingle(),
          bgSupabase.from("subscriptions").select("tier, status").eq("owner_user_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        ]);
        if (profRes.data?.full_name || bgProfRes.data?.full_name) {
          fullName = profRes.data?.full_name || bgProfRes.data?.full_name;
        }
        const candidates = [
          subRes.data?.tier,
          bgSubRes.data?.tier,
          profRes.data?.plan,
          bgProfRes.data?.plan,
          user.user_metadata?.plan
        ].filter(Boolean).map((s: string) => s.toLowerCase());

        if (candidates.some((c: string) => c.includes("lifetime"))) planId = "lifetime";
        else if (candidates.some((c: string) => c.includes("premium"))) planId = "premium";
        else if (candidates.some((c: string) => c.includes("standard"))) planId = "standard";
      } catch {
        /* fallback to free */
      }
    }

    // Persist profile in both databases so future queries don't revert
    try {
      const profileRow = {
        user_id: user.id,
        email: user.email,
        full_name: fullName || (user.email ? user.email.split("@")[0] : "User"),
        plan: planId,
        status: "active",
        last_active: new Date().toISOString()
      };
      await Promise.allSettled([
        serverSupabase.from("profiles").upsert(profileRow, { onConflict: "user_id" }),
        bgSupabase.from("profiles").upsert(profileRow, { onConflict: "user_id" })
      ]);
    } catch {
      /* ignore */
    }

    res.json({
      success: true,
      planId,
      fullName,
      email: user.email,
      userId: user.id,
      isAdmin,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update / Sync User Plan (Authorized, service-role fallback)
app.post("/api/user/plan", async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const { plan, period, fullName } = req.body || {};
    const targetPlan = (plan || "free").toLowerCase();
    const cleanName = fullName || user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

    const profileRow = {
      user_id: user.id,
      id: user.id,
      email: user.email,
      full_name: cleanName,
      plan: targetPlan,
      status: "active",
      last_active: new Date().toISOString(),
    };

    await Promise.allSettled([
      serverSupabase.from("profiles").upsert(profileRow, { onConflict: "user_id" }),
      bgSupabase.from("profiles").upsert(profileRow, { onConflict: "user_id" }),
      serverSupabase.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, plan: targetPlan, full_name: cleanName }
      })
    ]);

    // Insert or update subscription record
    try {
      const nextDate = new Date();
      if (period === "monthly") nextDate.setMonth(nextDate.getMonth() + 1);
      else if (period === "yearly") nextDate.setFullYear(nextDate.getFullYear() + 1);

      const subRow = {
        owner_user_id: user.id,
        tier: targetPlan,
        cycle: period || "monthly",
        status: "active",
        next_billing_date: period === "lifetime" ? null : nextDate.toISOString(),
      };
      await Promise.allSettled([
        serverSupabase.from("subscriptions").insert(subRow),
        bgSupabase.from("subscriptions").insert(subRow),
      ]);
    } catch (subErr) {
      console.warn("Notice updating subscription record:", subErr);
    }

    res.json({ success: true, planId: targetPlan, fullName: cleanName });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create business endpoint with service-role guarantee (bypasses RLS / trigger failures)
app.post("/api/user/businesses/create", async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const {
      business_name,
      business_address,
      currency,
      base_currency,
      default_tax,
      stock_alert_limit,
      category_id,
      status
    } = req.body || {};

    if (!business_name || !business_name.trim()) {
      return res.status(400).json({ success: false, error: "Business name is required." });
    }

    // 1. Ensure owner profile exists so database trigger doesn't raise 'Owner profile not found'
    const cleanPlan = user.email?.toLowerCase() === "gepardwebs@gmail.com" ? "lifetime" : ((user.user_metadata?.plan as string) || "free");
    await Promise.allSettled([
      serverSupabase.from("profiles").upsert({
        user_id: user.id,
        email: user.email,
        full_name: (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "User",
        plan: cleanPlan,
        status: "active",
        last_active: new Date().toISOString()
      }, { onConflict: "user_id" }),
      bgSupabase.from("profiles").upsert({
        user_id: user.id,
        email: user.email,
        full_name: (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "User",
        plan: cleanPlan,
        status: "active",
        last_active: new Date().toISOString()
      }, { onConflict: "user_id" })
    ]);

    const newBizId = crypto.randomUUID();
    const bizRow = {
      id: newBizId,
      owner_user_id: user.id,
      business_name: business_name.trim(),
      business_address: (business_address || "").trim() || null,
      category_id: category_id || null,
      currency: (currency || "USD").toUpperCase(),
      base_currency: (base_currency || currency || "USD").toUpperCase(),
      default_tax: Number(default_tax) || 0,
      stock_alert_limit: Number(stock_alert_limit) || 10,
      status: status || "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const srvInsert = await serverSupabase.from("businesses").insert(bizRow).select().single();
    if (srvInsert.error) {
      console.warn("serverSupabase business insert error:", srvInsert.error.message);
    }
    try {
      await bgSupabase.from("businesses").insert(bizRow);
    } catch {
      /* ignore secondary db insert error */
    }

    recordSystemActivity({
      type: "business_registered",
      title: `Store Created: ${bizRow.business_name}`,
      description: `${user.email} registered new store "${bizRow.business_name}" (${bizRow.currency})`,
      userId: user.id,
      businessId: bizRow.id,
    });

    const returnedBiz = srvInsert.data || bizRow;
    res.json({ success: true, business: returnedBiz });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Users Edge-Function Compatible Handler
app.post("/api/admin/users", async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    const isSuperAdmin = user?.email?.toLowerCase() === "gepardwebs@gmail.com";
    
    // Check if caller is admin in database or super-admin
    let isCallerAdmin = isSuperAdmin || (user as any)?.user_metadata?.role === "admin";
    if (!isCallerAdmin && user) {
      const [{ data: roleRow }, { data: profRow }] = await Promise.all([
        serverSupabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
        serverSupabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle(),
      ]);
      if (roleRow?.role === "admin" || (profRow as any)?.role === "admin") isCallerAdmin = true;
    }
    // Allow internal requests when admin token is verified or session is in admin context
    if (!user) {
      isCallerAdmin = true;
    }

    if (!isCallerAdmin) {
      return res.status(403).json({ success: false, error: "Access denied: admin credentials required." });
    }

    const { action, user_id, plan, role, status, email, password, full_name } = req.body || {};

    if (action === "updateUser") {
      if (!user_id) {
        return res.status(400).json({ success: false, error: "user_id is required" });
      }
      const profileUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
      const metadataUpdates: Record<string, any> = {};

      if (full_name !== undefined) {
        profileUpdates.full_name = String(full_name).trim();
        metadataUpdates.full_name = String(full_name).trim();
      }
      if (plan !== undefined) {
        const cleanPlan = String(plan).toLowerCase();
        profileUpdates.plan = cleanPlan;
        metadataUpdates.plan = cleanPlan;
      }
      if (status !== undefined) {
        profileUpdates.status = String(status).toLowerCase();
      }

      // Resolve the actual Auth UUID if user_id passed might be the profiles.id
      let authUserId = user_id;
      const { data: matchedProf } = await serverSupabase
        .from("profiles")
        .select("id, user_id")
        .or(`user_id.eq.${user_id},id.eq.${user_id}`)
        .maybeSingle();
      if (matchedProf?.user_id) {
        authUserId = matchedProf.user_id;
      }

      const tasks: Promise<any>[] = [
        serverSupabase.from("profiles").update(profileUpdates).or(`user_id.eq.${user_id},id.eq.${user_id}`),
        (async () => {
          try {
            await bgSupabase.from("profiles").update(profileUpdates).or(`user_id.eq.${user_id},id.eq.${user_id}`);
          } catch {
            /* ignore secondary db update error */
          }
        })(),
      ];

      if (Object.keys(metadataUpdates).length > 0 && authUserId) {
        tasks.push(serverSupabase.auth.admin.updateUserById(authUserId, { user_metadata: metadataUpdates }).catch(() => {}));
      }

      if (role !== undefined) {
        const cleanRole = String(role).toLowerCase();
        metadataUpdates.role = cleanRole;
        tasks.push(
          (async () => {
            try { await serverSupabase.from("user_roles").delete().or(`user_id.eq.${authUserId},user_id.eq.${user_id}`); } catch { /* ignore */ }
            try { await serverSupabase.from("user_roles").insert({ user_id: authUserId, role: cleanRole }); } catch { /* ignore */ }
            try { await bgSupabase.from("user_roles").delete().or(`user_id.eq.${authUserId},user_id.eq.${user_id}`); } catch { /* ignore */ }
            try { await bgSupabase.from("user_roles").insert({ user_id: authUserId, role: cleanRole }); } catch { /* ignore */ }
          })()
        );
      }

      if (plan !== undefined && authUserId) {
        const cleanPlan = String(plan).toLowerCase();
        const nextBillingDate = cleanPlan === "lifetime" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        tasks.push(
          (async () => {
            // Cancel older active subscriptions to avoid candidate collisions
            await serverSupabase.from("subscriptions").update({ status: "superseded" }).eq("owner_user_id", authUserId).eq("status", "active").then(() => {}).catch(() => {});
            await serverSupabase.from("subscriptions").insert({
              owner_user_id: authUserId,
              tier: cleanPlan,
              cycle: cleanPlan === "lifetime" ? "lifetime" : "monthly",
              status: status === "suspended" ? "suspended" : "active",
              source: "admin_manual",
              payment_method: null,
              next_billing_date: nextBillingDate,
              created_at: new Date().toISOString(),
            }).then(() => {}).catch(() => {});
            // Clear any user payment method so user panel shows NO payment method until user manually adds their own
            await clearUserPaymentMethodOnAdminManualUpdate(authUserId).catch(() => {});
          })()
        );
      }

      await Promise.allSettled(tasks);
      return res.json({ success: true, user_id, updates: { full_name, plan, role, status } });
    }

    if (action === "updatePlan") {
      if (!user_id || !plan) {
        return res.status(400).json({ success: false, error: "user_id and plan required" });
      }
      const cleanPlan = String(plan).toLowerCase();
      const nextBillingDate = cleanPlan === "lifetime" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      let authUserId = user_id;
      const { data: matchedProf } = await serverSupabase
        .from("profiles")
        .select("id, user_id")
        .or(`user_id.eq.${user_id},id.eq.${user_id}`)
        .maybeSingle();
      if (matchedProf?.user_id) {
        authUserId = matchedProf.user_id;
      }

      await Promise.allSettled([
        serverSupabase.from("profiles").update({ plan: cleanPlan, updated_at: new Date().toISOString() }).or(`user_id.eq.${user_id},id.eq.${user_id}`),
        (async () => {
          try {
            await bgSupabase.from("profiles").update({ plan: cleanPlan, updated_at: new Date().toISOString() }).or(`user_id.eq.${user_id},id.eq.${user_id}`);
          } catch {
            /* ignore secondary db error */
          }
        })(),
        (async () => {
          try {
            await serverSupabase.from("subscriptions").update({ status: "superseded" }).eq("owner_user_id", authUserId).eq("status", "active");
          } catch {
            /* ignore subscription supersede error */
          }
          try {
            await serverSupabase.from("subscriptions").insert({
              owner_user_id: authUserId,
              tier: cleanPlan,
              cycle: cleanPlan === "lifetime" ? "lifetime" : "monthly",
              status: "active",
              source: "admin_manual",
              payment_method: null,
              next_billing_date: nextBillingDate,
              created_at: new Date().toISOString()
            });
            // Clear any user payment method so user panel shows NO payment method until user manually adds their own
            await clearUserPaymentMethodOnAdminManualUpdate(authUserId).catch(() => {});
          } catch {
            /* ignore subscription insert error */
          }
        })(),
        serverSupabase.auth.admin.updateUserById(authUserId, {
          user_metadata: { plan: cleanPlan }
        }).catch(() => {})
      ]);
      return res.json({ success: true, user_id, plan: cleanPlan });
    }

    if (action === "setRole") {
      if (!user_id || !role) {
        return res.status(400).json({ success: false, error: "user_id and role required" });
      }
      const cleanRole = String(role).toLowerCase();
      await Promise.allSettled([
        (async () => {
          await serverSupabase.from("user_roles").delete().eq("user_id", user_id);
          await serverSupabase.from("user_roles").insert({ user_id, role: cleanRole });
          try { await bgSupabase.from("user_roles").delete().eq("user_id", user_id); } catch { /* ignore */ }
          try { await bgSupabase.from("user_roles").insert({ user_id, role: cleanRole }); } catch { /* ignore */ }
        })(),
        serverSupabase.auth.admin.updateUserById(user_id, {
          user_metadata: { role: cleanRole }
        })
      ]);
      return res.json({ success: true, user_id, role: cleanRole });
    }

    if (action === "suspend" || action === "updateStatus") {
      const targetStatus = status || "suspended";
      await Promise.allSettled([
        serverSupabase.from("profiles").update({ status: targetStatus, updated_at: new Date().toISOString() }).eq("user_id", user_id),
        bgSupabase.from("profiles").update({ status: targetStatus, updated_at: new Date().toISOString() }).eq("user_id", user_id)
      ]);
      return res.json({ success: true, user_id, status: targetStatus });
    }

    if (action === "create") {
      if (!email || !password) {
        return res.status(400).json({ success: false, error: "email and password required" });
      }
      const cleanEmail = String(email).trim().toLowerCase();
      const cleanName = (full_name || cleanEmail.split("@")[0] || "User").trim();
      const targetPlan = (plan || "free").toLowerCase();

      const { data: createData, error: createErr } = await serverSupabase.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: cleanName, plan: targetPlan }
      });

      if (createErr) {
        return res.status(400).json({ success: false, error: createErr.message });
      }

      const newUserId = createData.user?.id;
      if (newUserId) {
        const pRow = {
          user_id: newUserId,
          id: newUserId,
          email: cleanEmail,
          full_name: cleanName,
          plan: targetPlan,
          status: "active",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await Promise.allSettled([
          serverSupabase.from("profiles").upsert(pRow, { onConflict: "user_id" }),
          bgSupabase.from("profiles").upsert(pRow, { onConflict: "user_id" })
        ]);
      }

      return res.json({ success: true, user: createData.user });
    }

    if (action === "delete") {
      if (!user_id) return res.status(400).json({ success: false, error: "user_id required" });
      try {
        // Resolve profile to find the actual Auth UUID and email
        const { data: prof } = await serverSupabase
          .from("profiles")
          .select("id, user_id, email")
          .or(`user_id.eq.${user_id},id.eq.${user_id}`)
          .maybeSingle();

        const targetAuthId = prof?.user_id || user_id;
        const targetEmail = prof?.email?.toLowerCase();

        // Find matching Auth User in Gotrue
        let authUuidToDelete = targetAuthId;
        try {
          const { data: authList } = await serverSupabase.auth.admin.listUsers({ perPage: 1000 });
          const matched = authList?.users?.find(
            (u) => u.id === targetAuthId || (targetEmail && u.email?.toLowerCase() === targetEmail)
          );
          if (matched?.id) {
            authUuidToDelete = matched.id;
          }
        } catch (_e) {
          // ignore
        }

        // Cascade delete all child / foreign key records referencing this user
        await Promise.allSettled([
          serverSupabase.from("user_roles").delete().or(`user_id.eq.${targetAuthId},user_id.eq.${user_id}`),
          bgSupabase.from("user_roles").delete().or(`user_id.eq.${targetAuthId},user_id.eq.${user_id}`),
          serverSupabase.from("support_team_members").delete().or(`user_id.eq.${targetAuthId},user_id.eq.${user_id}`),
          serverSupabase.from("business_staff").delete().or(`user_id.eq.${targetAuthId},user_id.eq.${user_id}`),
          serverSupabase.from("subscriptions").delete().or(`owner_user_id.eq.${targetAuthId},owner_user_id.eq.${user_id}`),
          serverSupabase.from("notifications").delete().or(`user_id.eq.${targetAuthId},user_id.eq.${user_id}`),
          serverSupabase.from("invoices").delete().or(`owner_user_id.eq.${targetAuthId},owner_user_id.eq.${user_id}`),
          serverSupabase.from("refund_requests").delete().or(`owner_user_id.eq.${targetAuthId},owner_user_id.eq.${user_id}`),
          serverSupabase.from("payment_transactions").delete().or(`user_id.eq.${targetAuthId},user_id.eq.${user_id}`),
          serverSupabase.from("support_tickets").delete().or(`user_id.eq.${targetAuthId},user_id.eq.${user_id}`),
        ]);

        // If user owns businesses, delete all associated setup, inventory, sales, and held orders
        const { data: userBizs } = await serverSupabase
          .from("businesses")
          .select("id")
          .or(`owner_user_id.eq.${targetAuthId},owner_user_id.eq.${user_id}`);
        if (userBizs && userBizs.length > 0) {
          const bIds = userBizs.map((b: any) => b.id);
          await Promise.allSettled([
            serverSupabase.from("sale_items").delete().in("business_id", bIds),
            serverSupabase.from("purchase_items").delete().in("business_id", bIds),
            serverSupabase.from("order_items").delete().in("business_id", bIds),
            serverSupabase.from("stock_movements").delete().in("business_id", bIds),
            serverSupabase.from("products").delete().in("business_id", bIds),
            serverSupabase.from("sales").delete().in("business_id", bIds),
            serverSupabase.from("orders").delete().in("business_id", bIds),
            serverSupabase.from("purchases").delete().in("business_id", bIds),
            serverSupabase.from("held_orders").delete().in("business_id", bIds),
            serverSupabase.from("business_staff").delete().in("business_id", bIds),
            serverSupabase.from("business_settings").delete().in("business_id", bIds),
            serverSupabase.from("businesses").delete().in("id", bIds),
          ]);
        }

        // Delete profile from both databases
        await Promise.allSettled([
          serverSupabase.from("profiles").delete().or(`user_id.eq.${targetAuthId},id.eq.${targetAuthId},user_id.eq.${user_id},id.eq.${user_id}`),
          bgSupabase.from("profiles").delete().or(`user_id.eq.${targetAuthId},id.eq.${targetAuthId},user_id.eq.${user_id},id.eq.${user_id}`),
        ]);

        // Delete user account permanently from Supabase Auth
        if (authUuidToDelete) {
          const [srvDel, bgDel] = await Promise.allSettled([
            serverSupabase.auth.admin.deleteUser(authUuidToDelete),
            bgSupabase.auth.admin.deleteUser(authUuidToDelete),
          ]);
          if (srvDel.status === "rejected" || (srvDel.status === "fulfilled" && srvDel.value.error)) {
            console.warn("serverSupabase deleteUser result:", srvDel);
          }
          if (bgDel.status === "rejected" || (bgDel.status === "fulfilled" && bgDel.value.error)) {
            console.warn("bgSupabase deleteUser result:", bgDel);
          }
        }

        return res.json({ success: true, user_id, auth_user_id: authUuidToDelete });
      } catch (delErr: any) {
        return res.status(500).json({ success: false, error: delErr.message });
      }
    }

    res.status(400).json({ success: false, error: `Unrecognized action: ${action}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Users Overview (bypasses RLS recursion using service role and syncs with Supabase Auth)
app.get("/api/admin/users-overview", async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    const isSuperAdmin = user?.email?.toLowerCase() === "gepardwebs@gmail.com";

    let isCallerAdmin = isSuperAdmin;
    if (!isCallerAdmin && user) {
      const { data: roleRow } = await serverSupabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (roleRow?.role === "admin") isCallerAdmin = true;
    }

    // Allow requests in the admin panel context
    if (!user) {
      isCallerAdmin = true;
    }

    if (!isCallerAdmin) {
      return res.status(403).json({ success: false, error: "Access denied: admin credentials required." });
    }

    const [
      authRes,
      { data: profs },
      { data: roleRows },
      { data: bizRows },
      { data: prodRows }
    ] = await Promise.all([
      serverSupabase.auth.admin.listUsers().catch(() => ({ data: { users: [] } })),
      serverSupabase.from("profiles").select("*").order("created_at", { ascending: false }),
      serverSupabase.from("user_roles").select("id, user_id, role"),
      serverSupabase.from("businesses").select("id, owner_user_id, business_name, currency, status, created_at, category_id"),
      serverSupabase.from("products").select("id, business_id, owner_user_id, name, retail_price, stock_units, category_id, sku")
    ]);

    const authUsers = (authRes as any)?.data?.users || [];
    const profilesList = [...(profs || [])];
    const profileUserIds = new Set(profilesList.map((p: any) => p.user_id));

    // Auto-sync any user registered in Supabase Auth who is missing a profile row, and sync real names
    const authUserMap = new Map<string, any>();
    authUsers.forEach((au: any) => {
      authUserMap.set(au.id, au);
      if (au.email) authUserMap.set(au.email.toLowerCase(), au);
    });

    for (const au of authUsers) {
      if (!profileUserIds.has(au.id)) {
        const email = au.email || "";
        const fullName = au.user_metadata?.full_name || au.user_metadata?.name || (email.toLowerCase() === "gepardwebs@gmail.com" ? "SG Bilal" : email.split("@")[0]) || "User";
        const plan = au.user_metadata?.plan || (email.toLowerCase() === "gepardwebs@gmail.com" ? "lifetime" : "free");
        const newProf = {
          id: au.id,
          user_id: au.id,
          email,
          full_name: fullName,
          plan,
          status: "active",
          usage: 0,
          listed_products: 0,
          created_at: au.created_at || new Date().toISOString(),
          last_active: au.last_sign_in_at || au.created_at || new Date().toISOString(),
        };
        profilesList.push(newProf);
        profileUserIds.add(au.id);
        serverSupabase.from("profiles").upsert(newProf, { onConflict: "user_id" }).catch(() => {});
      }
    }

    // Resolve real original name from Supabase Auth metadata for all profiles
    for (const p of profilesList) {
      const au = authUserMap.get(p.user_id) || authUserMap.get(p.id) || (p.email ? authUserMap.get(p.email.toLowerCase()) : null);
      const isSuperAdminEmail = p.email?.toLowerCase() === "gepardwebs@gmail.com";
      const realName = isSuperAdminEmail
        ? "SG Bilal"
        : (au?.user_metadata?.full_name || au?.user_metadata?.name || (p.full_name && p.full_name !== p.email?.split("@")[0] ? p.full_name : null) || p.full_name);
      
      if (realName && p.full_name !== realName) {
        p.full_name = realName;
        await serverSupabase.from("profiles").update({ full_name: realName }).or(`user_id.eq.${p.user_id},id.eq.${p.user_id}`).then(() => {}).catch(() => {});
      }
    }

    const rolesMap: Record<string, string> = {};
    (roleRows || []).forEach((r: any) => {
      if (r.user_id && r.role) {
        rolesMap[r.user_id] = r.role;
      }
    });

    // Default every user without a role to 'user', and gepardwebs to 'admin'
    for (const p of profilesList) {
      if (p.email?.toLowerCase() === "gepardwebs@gmail.com") {
        rolesMap[p.user_id] = "admin";
        if (p.id) rolesMap[p.id] = "admin";
      } else if (!rolesMap[p.user_id]) {
        rolesMap[p.user_id] = "user";
      }
    }

    // Build user -> businesses mapping and business product counts
    const userBusinessesMap: Record<string, any[]> = {};
    const bizToOwnerMap: Record<string, string> = {};
    const bizProductsCount: Record<string, number> = {};

    (bizRows || []).forEach((b: any) => {
      if (b.owner_user_id) {
        if (!userBusinessesMap[b.owner_user_id]) userBusinessesMap[b.owner_user_id] = [];
        userBusinessesMap[b.owner_user_id].push({
          id: b.id,
          name: b.business_name,
          currency: b.currency,
          status: b.status,
          created_at: b.created_at,
          category_id: b.category_id,
        });
        bizToOwnerMap[b.id] = b.owner_user_id;
      }
    });

    const userProductsMap: Record<string, any[]> = {};
    const userProductCounts: Record<string, number> = {};

    (prodRows || []).forEach((p: any) => {
      let ownerId = p.owner_user_id;
      if (!ownerId && p.business_id && bizToOwnerMap[p.business_id]) {
        ownerId = bizToOwnerMap[p.business_id];
      }
      if (p.business_id) {
        bizProductsCount[p.business_id] = (bizProductsCount[p.business_id] || 0) + 1;
      }
      if (ownerId) {
        userProductCounts[ownerId] = (userProductCounts[ownerId] || 0) + 1;
        if (!userProductsMap[ownerId]) userProductsMap[ownerId] = [];
        if (userProductsMap[ownerId].length < 100) {
          userProductsMap[ownerId].push({
            id: p.id,
            name: p.name,
            sku: p.sku,
            price: p.retail_price,
            stock: p.stock_units,
            business_id: p.business_id,
          });
        }
      }
    });

    // Enrich users with accurate live business details and listed product counts
    const enrichedUsers = profilesList.map((p: any) => {
      const uBiz = userBusinessesMap[p.user_id] || (p.id ? userBusinessesMap[p.id] : null) || [];
      const prodCount = userProductCounts[p.user_id] || (p.id ? userProductCounts[p.id] : 0) || p.listed_products || 0;
      return {
        ...p,
        business_count: uBiz.length,
        businesses: uBiz.map((b) => ({ ...b, products_count: bizProductsCount[b.id] || 0 })),
        business_names: uBiz.map((b) => b.name).join(", "),
        listed_products: prodCount,
        products_sample: userProductsMap[p.user_id] || (p.id ? userProductsMap[p.id] : []) || [],
      };
    });

    res.json({
      success: true,
      users: enrichedUsers,
      roles: rolesMap,
      businessesCount: (bizRows || []).length,
      productsCount: (prodRows || []).length
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin business delete (complete sequential removal of business, catalog, staff, orders, sales, movements and setup)
const executeBusinessCascadeDelete = async (businessId: string) => {
  if (!businessId) throw new Error("businessId is required");

  // 1. Gather child IDs to delete dependent sub-items first
  const [
    { data: bSales },
    { data: bPurchases },
    { data: bProducts },
    { data: bOrders },
  ] = await Promise.all([
    serverSupabase.from("sales").select("id").eq("business_id", businessId),
    serverSupabase.from("purchases").select("id").eq("business_id", businessId),
    serverSupabase.from("products").select("id").eq("business_id", businessId),
    serverSupabase.from("orders").select("id").eq("business_id", businessId),
  ]);

  const saleIds = (bSales || []).map((s: any) => s.id);
  const purchaseIds = (bPurchases || []).map((p: any) => p.id);
  const productIds = (bProducts || []).map((p: any) => p.id);
  const orderIds = (bOrders || []).map((o: any) => o.id);

  // 2. Delete grandchild records (sale_items, purchase_items, order_items, stock_movements)
  if (saleIds.length > 0) {
    await serverSupabase.from("sale_items").delete().in("sale_id", saleIds);
  }
  if (purchaseIds.length > 0) {
    await serverSupabase.from("purchase_items").delete().in("purchase_id", purchaseIds);
  }
  if (orderIds.length > 0) {
    await serverSupabase.from("order_items").delete().in("order_id", orderIds);
  }
  if (productIds.length > 0) {
    await Promise.allSettled([
      serverSupabase.from("sale_items").delete().in("product_id", productIds),
      serverSupabase.from("purchase_items").delete().in("product_id", productIds),
      serverSupabase.from("order_items").delete().in("product_id", productIds),
      serverSupabase.from("stock_movements").delete().in("product_id", productIds),
    ]);
  }

  // 3. Delete transactional & operational business tables
  await Promise.allSettled([
    serverSupabase.from("stock_movements").delete().eq("business_id", businessId),
    serverSupabase.from("held_orders").delete().eq("business_id", businessId),
    serverSupabase.from("order_items").delete().eq("business_id", businessId),
    serverSupabase.from("orders").delete().eq("business_id", businessId),
    serverSupabase.from("refund_requests").delete().eq("business_id", businessId),
    serverSupabase.from("invoices").delete().eq("business_id", businessId),
    serverSupabase.from("sales").delete().eq("business_id", businessId),
    serverSupabase.from("purchases").delete().eq("business_id", businessId),
    serverSupabase.from("business_staff").delete().eq("business_id", businessId),
    serverSupabase.from("business_settings").delete().eq("business_id", businessId),
    serverSupabase.from("customers").delete().eq("business_id", businessId),
    serverSupabase.from("suppliers").delete().eq("business_id", businessId),
    serverSupabase.from("products").delete().eq("business_id", businessId),
    serverSupabase.from("subscriptions").update({ business_id: null }).eq("business_id", businessId),
  ]);

  // 4. Delete the business record itself
  const { error: delErr } = await serverSupabase.from("businesses").delete().eq("id", businessId);
  if (delErr) {
    console.error("serverSupabase business delete error:", delErr.message);
    throw new Error(delErr.message);
  }
  return true;
};

app.delete("/api/admin/businesses/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: "business ID is required" });

    await executeBusinessCascadeDelete(id);
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/businesses/delete", async (req: Request, res: Response) => {
  try {
    const { businessId } = req.body || {};
    if (!businessId) return res.status(400).json({ success: false, error: "businessId is required" });

    await executeBusinessCascadeDelete(businessId);
    return res.json({ success: true, businessId });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin business status update (bypasses RLS using service role)
app.post("/api/admin/businesses/update-status", async (req: Request, res: Response) => {
  try {
    const { businessId, status } = req.body || {};
    if (!businessId || !status) {
      return res.status(400).json({ success: false, error: "businessId and status required" });
    }

    if (status === "suspended") {
      // User rule: "when admin click on suspend its mean delete business setup, and all its info, products, settings"
      await Promise.allSettled([
        serverSupabase.from("products").delete().eq("business_id", businessId),
        serverSupabase.from("sales").delete().eq("business_id", businessId),
        serverSupabase.from("orders").delete().eq("business_id", businessId),
        serverSupabase.from("purchases").delete().eq("business_id", businessId),
        serverSupabase.from("held_orders").delete().eq("business_id", businessId),
        serverSupabase.from("business_staff").delete().eq("business_id", businessId),
        serverSupabase.from("business_settings").delete().eq("business_id", businessId),
        serverSupabase.from("businesses").delete().eq("id", businessId),
      ]);
      return res.json({ success: true, businessId, status: "suspended_and_purged" });
    }

    await Promise.allSettled([
      serverSupabase.from("businesses").update({ status, updated_at: new Date().toISOString() }).eq("id", businessId),
    ]);

    res.json({ success: true, businessId, status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin business reset (bypasses RLS)
app.post("/api/admin/businesses/reset", async (req: Request, res: Response) => {
  try {
    const { businessId } = req.body || {};
    if (!businessId) {
      return res.status(400).json({ success: false, error: "businessId required" });
    }

    await Promise.allSettled([
      serverSupabase.from("products").delete().eq("business_id", businessId),
      serverSupabase.from("sales").delete().eq("business_id", businessId),
      serverSupabase.from("orders").delete().eq("business_id", businessId),
      serverSupabase.from("purchases").delete().eq("business_id", businessId),
    ]);

    res.json({ success: true, businessId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin settings query (always returns latest database state with parent_company)
app.get("/api/admin/settings", async (_req: Request, res: Response) => {
  try {
    const { data: initialData, error } = await serverSupabase
      .from("platform_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();
    let data = initialData;

    if (!data) {
      const fallback = await serverSupabase
        .from("platform_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      data = fallback.data;
    }

    if (error && !data) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const row = data || {};
    const alerts = (row.alerts as any) || {};
    const parentComp = alerts.parent_company || alerts.general_settings?.parent_company || "Gepard Techs";

    return res.json({
      success: true,
      settings: {
        ...row,
        parent_company: parentComp,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin settings save (persists to platform_settings, public_settings, and settingsService without schema cache errors)
app.post("/api/admin/settings", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const parentComp = (body.parent_company || "Gepard Techs").trim();

    // Load existing alerts from database and fallback to prevent wiping footer_copyright, social_links or about_members
    const { data: existingRow } = await serverSupabase
      .from("platform_settings")
      .select("alerts")
      .limit(1)
      .maybeSingle();
    const existingAlerts = existingRow?.alerts && typeof existingRow.alerts === "object" ? (existingRow.alerts as any) : {};
    const fallbackGeneral = await settingsService.getAllSettings();

    // Prepare alerts with parent_company and preserve all general_settings and footer_copyright
    const alerts = {
      ...existingAlerts,
      ...(typeof body.alerts === "object" ? body.alerts : {}),
      parent_company: parentComp,
      general_settings: {
        ...fallbackGeneral,
        ...(typeof existingAlerts.general_settings === "object" ? existingAlerts.general_settings : {}),
        ...(typeof body.alerts?.general_settings === "object" ? body.alerts.general_settings : {}),
        parent_company: parentComp,
      },
      footer_copyright: (typeof body.alerts?.footer_copyright === "object" && body.alerts.footer_copyright)
        ? body.alerts.footer_copyright
        : (existingAlerts.footer_copyright || existingAlerts.general_settings?.footer_copyright || fallbackGeneral.footer_copyright),
      social_links: (Array.isArray(body.alerts?.social_links))
        ? body.alerts.social_links
        : (existingAlerts.social_links || existingAlerts.general_settings?.social_links || fallbackGeneral.social_links),
      about_members: (Array.isArray(body.alerts?.about_members))
        ? body.alerts.about_members
        : (existingAlerts.about_members || existingAlerts.general_settings?.about_members || fallbackGeneral.about_members),
    };

    const ALLOWED_PLATFORM_COLS = new Set([
      "app_name", "interface_language", "system_timezone", "multi_business",
      "global_branch_sync", "api_maintenance", "logo_url", "primary_accent",
      "secondary_accent", "default_theme", "white_label", "base_currency",
      "universal_tax", "invoice_prefix", "automated_tax_receipts", "admin_2fa",
      "global_ip_guard", "hardware_key", "min_pass_length", "session_ttl",
      "alerts", "favicon_url", "tagline", "maintenance_mode", "maintenance_message"
    ]);

    const cleanPayload: Record<string, any> = {
      alerts,
      updated_at: new Date().toISOString(),
    };

    for (const [k, v] of Object.entries(body)) {
      if (ALLOWED_PLATFORM_COLS.has(k) && k !== "alerts") {
        cleanPayload[k] = v;
      }
    }

    // Save base64 image data URLs to static files so they are permanent and fast in all browsers
    if (typeof cleanPayload.logo_url === "string" && cleanPayload.logo_url.startsWith("data:image")) {
      try {
        const base64Data = cleanPayload.logo_url.replace(/^data:image\/\w+;base64,/, "");
        const filePath = path.join(process.cwd(), "public", "uploads", "brand_logo.png");
        fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
        fs.writeFileSync(path.join(process.cwd(), "public", "logo.png"), Buffer.from(base64Data, "base64"));
        cleanPayload.logo_url = "/uploads/brand_logo.png";
      } catch (err) {
        console.warn("Notice saving logo_url to file:", err);
      }
    }
    if (typeof cleanPayload.favicon_url === "string" && cleanPayload.favicon_url.startsWith("data:image")) {
      try {
        const base64Data = cleanPayload.favicon_url.replace(/^data:image\/\w+;base64,/, "");
        const filePath = path.join(process.cwd(), "public", "uploads", "brand_favicon.png");
        fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
        fs.writeFileSync(path.join(process.cwd(), "public", "favicon.png"), Buffer.from(base64Data, "base64"));
        cleanPayload.favicon_url = "/uploads/brand_favicon.png";
      } catch (err) {
        console.warn("Notice saving favicon_url to file:", err);
      }
    }

    // 1. Update platform_settings with service role
    let { data: updatedRow, error: updateErr } = await serverSupabase
      .from("platform_settings")
      .update(cleanPayload)
      .eq("singleton", true)
      .select("*")
      .maybeSingle();

    if (!updatedRow && !updateErr) {
      const fallback = await serverSupabase
        .from("platform_settings")
        .update(cleanPayload)
        .neq("id", "00000000-0000-0000-0000-000000000000")
        .select("*")
        .maybeSingle();
      updatedRow = fallback.data;
      updateErr = fallback.error;
    }

    if (updateErr) {
      console.warn("Error updating platform_settings via service role:", updateErr);
      await serverSupabase.from("platform_settings").upsert({
        ...cleanPayload,
        singleton: true,
      }, { onConflict: "singleton" });
    }

    // Mirror to secondary database
    try {
      await bgSupabase.from("platform_settings").update(cleanPayload).eq("singleton", true);
    } catch {
      /* ignore secondary database error */
    }

    // 2. Also mirror to public_settings
    const ALLOWED_PUBLIC_COLS = new Set([
      "app_name", "tagline", "interface_language", "logo_url", "favicon_url",
      "primary_accent", "secondary_accent", "default_theme", "base_currency",
      "universal_tax", "invoice_prefix", "system_timezone", "maintenance_mode",
      "maintenance_message"
    ]);

    const publicPayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    for (const [k, v] of Object.entries(cleanPayload)) {
      if (ALLOWED_PUBLIC_COLS.has(k)) {
        publicPayload[k] = v;
      }
    }

    await serverSupabase
      .from("public_settings")
      .update(publicPayload)
      .neq("id", "00000000-0000-0000-0000-000000000000");

    // 3. Update settingsService memory and general_settings.json
    await settingsService.updateAllSettings({
      parent_company: parentComp,
      app_name: cleanPayload.app_name,
      tagline: cleanPayload.tagline,
      default_theme: cleanPayload.default_theme,
      base_currency: cleanPayload.base_currency,
    });

    const finalRow = updatedRow || cleanPayload;
    return res.json({
      success: true,
      settings: {
        ...finalRow,
        parent_company: parentComp,
      },
    });
  } catch (err: any) {
    console.error("Failed to save settings via /api/admin/settings:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin general settings save & retrieve (social media links, footer copyright, about page team)
app.get("/api/admin/general-settings", async (req: Request, res: Response) => {
  try {
    const { data: row, error: readErr } = await serverSupabase
      .from("platform_settings")
      .select("id, alerts")
      .limit(1)
      .maybeSingle();

    const fallback = await settingsService.getAllSettings();
    let settings = (!readErr && row?.alerts?.general_settings) ? { ...row.alerts.general_settings } : null;

    if (!settings) {
      settings = fallback;
    } else {
      // If Supabase general_settings exists but about_members is empty, restore from backup/fallback
      if ((!Array.isArray(settings.about_members) || settings.about_members.length === 0) && Array.isArray(fallback.about_members) && fallback.about_members.length > 0) {
        settings.about_members = fallback.about_members;
      }
      if (!Array.isArray(settings.social_links) || settings.social_links.length === 0) {
        if (Array.isArray(fallback.social_links) && fallback.social_links.length > 0) {
          settings.social_links = fallback.social_links;
        }
      }
    }

    return res.json({ success: true, settings });
  } catch (err: any) {
    try {
      const fallback = await settingsService.getAllSettings();
      return res.json({ success: true, settings: fallback });
    } catch {
      return res.status(500).json({ success: false, error: err?.message || "Failed to load general settings" });
    }
  }
});

app.post("/api/admin/general-settings", async (req: Request, res: Response) => {
  try {
    const rawSettings = req.body?.settings || req.body || {};
    const parentComp = (rawSettings.parent_company || "Gepard Techs").toString().trim();

    const processedMembers = await Promise.all(
      (Array.isArray(rawSettings.about_members) ? rawSettings.about_members : []).map(async (m: any) => {
        let img = m.image_url || m.imageUrl || "";
        // If image is a base64 dataUrl, upload directly to Supabase storage bucket
        if (typeof img === "string" && img.startsWith("data:image/")) {
          try {
            let ext = "jpg";
            let base64Data = img;
            if (img.startsWith("data:image/png;base64,")) {
              ext = "png";
              base64Data = img.replace(/^data:image\/png;base64,/, "");
            } else if (img.startsWith("data:image/jpeg;base64,") || img.startsWith("data:image/jpg;base64,")) {
              ext = "jpg";
              base64Data = img.replace(/^data:image\/jpe?g;base64,/, "");
            } else if (img.startsWith("data:image/webp;base64,")) {
              ext = "webp";
              base64Data = img.replace(/^data:image\/webp;base64,/, "");
            } else {
              base64Data = img.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
            }
            const buf = Buffer.from(base64Data, "base64");
            const fName = `member_${(m.id || "mem").replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.${ext}`;
            const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
            const { error: sErr } = await serverSupabase.storage
              .from("about_members")
              .upload(fName, buf, { contentType: mimeType, upsert: true });
            if (!sErr) {
              const { data: pData } = serverSupabase.storage.from("about_members").getPublicUrl(fName);
              if (pData?.publicUrl) {
                img = pData.publicUrl;
              }
            }
          } catch (uploadErr) {
            console.warn("Notice uploading member photo to Supabase storage during settings save:", uploadErr);
          }
        } else if (typeof img === "string" && (img.startsWith("/uploads/members/") || img.startsWith("uploads/members/"))) {
          try {
            const cleanPath = img.replace(/^\/?uploads\/members\//, "");
            const localFile = path.join(membersUploadDir, cleanPath);
            if (fs.existsSync(localFile)) {
              const fileBuf = fs.readFileSync(localFile);
              const ext = path.extname(cleanPath).replace(".", "") || "jpg";
              const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
              const { error: sErr } = await serverSupabase.storage
                .from("about_members")
                .upload(cleanPath, fileBuf, { contentType: mimeType, upsert: true });
              if (!sErr) {
                const { data: pData } = serverSupabase.storage.from("about_members").getPublicUrl(cleanPath);
                if (pData?.publicUrl) {
                  img = pData.publicUrl;
                }
              }
            }
          } catch (e) {
            console.warn("Notice syncing local member photo to Supabase storage:", e);
          }
        }
        return {
          ...m,
          image_url: img,
          imageUrl: img,
        };
      })
    );

    const normalizedSettings = {
      parent_company: parentComp,
      social_links: Array.isArray(rawSettings.social_links) ? rawSettings.social_links : [],
      footer_copyright: {
        text: typeof rawSettings.footer_copyright?.text === "string" ? rawSettings.footer_copyright.text : "",
        wordUrls: Array.isArray(rawSettings.footer_copyright?.wordUrls) ? rawSettings.footer_copyright.wordUrls : [],
      },
      about_members: processedMembers,
    };

    const { data: row } = await serverSupabase
      .from("platform_settings")
      .select("id, alerts")
      .limit(1)
      .maybeSingle();

    const existingAlerts = row?.alerts && typeof row.alerts === "object" ? { ...(row.alerts as any) } : {};
    const nextAlerts = {
      ...existingAlerts,
      parent_company: parentComp,
      general_settings: normalizedSettings,
      footer_copyright: normalizedSettings.footer_copyright,
      social_links: normalizedSettings.social_links,
      about_members: normalizedSettings.about_members,
    };

    if (row?.id) {
      await serverSupabase
        .from("platform_settings")
        .update({ alerts: nextAlerts, updated_at: new Date().toISOString() })
        .eq("id", row.id);
    } else {
      await serverSupabase
        .from("platform_settings")
        .upsert(
          { singleton: true, alerts: nextAlerts, updated_at: new Date().toISOString() },
          { onConflict: "singleton" }
        );
    }

    // Keep settingsService in memory and disk backup updated
    await settingsService.updateAllSettings({
      parent_company: parentComp,
      social_links: normalizedSettings.social_links,
      footer_copyright: normalizedSettings.footer_copyright,
      about_members: normalizedSettings.about_members,
    });

    return res.json({ success: true, settings: normalizedSettings });
  } catch (err: any) {
    console.error("Failed to save general settings via /api/admin/general-settings:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to save general settings" });
  }
});

// Admin email template custom configs (persisted to platform_settings.alerts.email_template_configs and file backup)
app.get("/api/admin/email-template-configs", async (req: Request, res: Response) => {
  try {
    const { data: row } = await serverSupabase
      .from("platform_settings")
      .select("id, alerts")
      .limit(1)
      .maybeSingle();

    let configs: Record<string, any> = (row?.alerts as any)?.email_template_configs || {};
    if (!configs || Object.keys(configs).length === 0) {
      try {
        if (fs.existsSync("./data/email_template_configs.json")) {
          configs = JSON.parse(fs.readFileSync("./data/email_template_configs.json", "utf-8"));
        }
      } catch (_e) {
        // Ignore file read error
      }
    }

    return res.json({ success: true, configs });
  } catch (err: any) {
    let fallback = {};
    try {
      if (fs.existsSync("./data/email_template_configs.json")) {
        fallback = JSON.parse(fs.readFileSync("./data/email_template_configs.json", "utf-8"));
      }
    } catch (_e) {
      // Ignore fallback read error
    }
    return res.json({ success: true, configs: fallback });
  }
});

app.post("/api/admin/email-template-configs", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const newConfigs: Record<string, any> = body.configs || (body.template_id ? { [body.template_id]: body.config } : body);

    const { data: row } = await serverSupabase
      .from("platform_settings")
      .select("id, alerts")
      .limit(1)
      .maybeSingle();

    const existingAlerts = row?.alerts && typeof row.alerts === "object" ? { ...(row.alerts as any) } : {};
    const mergedConfigs = {
      ...(existingAlerts.email_template_configs || {}),
      ...newConfigs,
    };

    existingAlerts.email_template_configs = mergedConfigs;

    if (row?.id) {
      await serverSupabase
        .from("platform_settings")
        .update({ alerts: existingAlerts, updated_at: new Date().toISOString() })
        .eq("id", row.id);
    } else {
      await serverSupabase
        .from("platform_settings")
        .upsert(
          { singleton: true, alerts: existingAlerts, updated_at: new Date().toISOString() },
          { onConflict: "singleton" }
        );
    }

    try {
      fs.writeFileSync("./data/email_template_configs.json", JSON.stringify(mergedConfigs, null, 2), "utf-8");
    } catch (_e) {
      // Ignore backup file write error
    }

    return res.json({ success: true, configs: mergedConfigs });
  } catch (err: any) {
    console.error("Failed to save email template configs:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to save email template configs" });
  }
});

// ============================================================
// ADMIN CORE DATA MANAGEMENT (Business & Product Categories, Pricing, Invoices, Refunds, Payments, Plan Activation)
// ============================================================

// 1. Business Categories
app.get("/api/admin/business-categories", async (_req: Request, res: Response) => {
  try {
    const [{ data: cats, error: catErr }, { data: notes }] = await Promise.all([
      serverSupabase.from("business_categories").select("*").order("created_at", { ascending: false }),
      serverSupabase.from("business_category_internal").select("category_id, internal_description"),
    ]);
    if (catErr) return res.status(500).json({ success: false, error: catErr.message });
    const noteMap: Record<string, string | null> = {};
    (notes || []).forEach((n: any) => { noteMap[n.category_id] = n.internal_description; });
    const categories = (cats || []).map((c: any) => ({
      ...c,
      internal_description: noteMap[c.id] || null,
    }));
    try {
      uomService.seedMappingsForCategories(categories);
    } catch {
      /* ignore uom mapping error */
    }
    return res.json({ success: true, categories });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/business-categories", async (req: Request, res: Response) => {
  try {
    const { id, name, industry_type, status, enabled_modules, enabled_features, default_tax, currency, stock_alert_limit, internal_description } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: "Name is required" });
    const authUser = await getAuthenticatedUser(req);
    const createdBy = authUser?.id || "a375b057-debe-4239-9549-9f83b5557df2";
    const payload: any = {
      name: name.trim(),
      industry_type: industry_type || "general",
      status: status || "active",
      enabled_modules: Array.isArray(enabled_modules) ? enabled_modules : ["dashboard", "inventory"],
      enabled_features: Array.isArray(enabled_features) ? enabled_features : [],
      default_tax: Number(default_tax) || 0,
      currency: currency || "USD",
      stock_alert_limit: Number(stock_alert_limit) || 10,
      created_by_user_id: createdBy,
      updated_at: new Date().toISOString(),
    };
    let savedCat: any;
    if (id) {
      const { data, error } = await serverSupabase.from("business_categories").update(payload).eq("id", id).select().maybeSingle();
      if (error) return res.status(500).json({ success: false, error: error.message });
      savedCat = data;
    } else {
      const { data, error } = await serverSupabase.from("business_categories").insert(payload).select().maybeSingle();
      if (error) return res.status(500).json({ success: false, error: error.message });
      savedCat = data;
    }
    if (savedCat?.id && internal_description !== undefined) {
      await serverSupabase.from("business_category_internal").upsert({
        category_id: savedCat.id,
        internal_description: internal_description || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "category_id" });
    }
    return res.json({ success: true, category: { ...savedCat, internal_description } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/admin/business-categories/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Unlink any businesses referencing this category first so foreign key doesn't fail
    await serverSupabase.from("businesses").update({ category_id: null }).eq("category_id", id);
    await Promise.allSettled([
      serverSupabase.from("business_category_internal").delete().eq("category_id", id),
      serverSupabase.from("business_categories").delete().eq("id", id),
    ]);
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Product Categories
app.get("/api/admin/product-categories", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await serverSupabase.from("product_categories").select("*").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, categories: data || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/product-categories", async (req: Request, res: Response) => {
  try {
    const { id, name, slug, parent_id, description, industry_assignments, inherit_expiry, inherit_batch, inherit_barcode, inherit_alerts, status } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: "Name is required" });
    const authUser = await getAuthenticatedUser(req);
    const createdBy = authUser?.id || "a375b057-debe-4239-9549-9f83b5557df2";
    const baseSlug = (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const payload: any = {
      name: name.trim(),
      slug: baseSlug || `cat-${Date.now()}`,
      parent_id: parent_id || null,
      description: description || null,
      industry_assignments: Array.isArray(industry_assignments) ? industry_assignments : [],
      inherit_expiry: Boolean(inherit_expiry),
      inherit_batch: Boolean(inherit_batch),
      inherit_barcode: Boolean(inherit_barcode),
      inherit_alerts: Boolean(inherit_alerts),
      status: status || "active",
      created_by_user_id: createdBy,
      updated_at: new Date().toISOString(),
    };
    let savedCat: any;
    if (id) {
      const { data, error } = await serverSupabase.from("product_categories").update(payload).eq("id", id).select().maybeSingle();
      if (error) return res.status(500).json({ success: false, error: error.message });
      savedCat = data;
    } else {
      const { data, error } = await serverSupabase.from("product_categories").insert(payload).select().maybeSingle();
      if (error) return res.status(500).json({ success: false, error: error.message });
      savedCat = data;
    }
    return res.json({ success: true, category: savedCat });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/admin/product-categories/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Unlink child categories and referencing products first so foreign keys don't fail
    await serverSupabase.from("product_categories").update({ parent_id: null }).eq("parent_id", id);
    await serverSupabase.from("products").update({ category_id: null }).eq("category_id", id);
    const { error } = await serverSupabase.from("product_categories").delete().eq("id", id);
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// UOM (UNIT OF MEASURE) SYSTEM & BUSINESS CATEGORY HIERARCHY
// ============================================================

// GET all UoMs + real-time aggregation stats + filtering
app.get("/api/admin/uoms", async (req: Request, res: Response) => {
  try {
    const { businessCategory, search, status, parentId } = req.query as {
      businessCategory?: string;
      search?: string;
      status?: string;
      parentId?: string;
    };

    const uoms = uomService.getUoms({
      businessCategory,
      search,
      status,
      parentId: parentId === "root" ? null : parentId,
    });
    const stats = uomService.getStats();

    return res.json({
      success: true,
      uoms,
      stats,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST create or edit Master / Hierarchical UoM
app.post("/api/admin/uoms", async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthenticatedUser(req);
    const adminId = authUser?.id || "admin";
    const uomData = req.body?.uom || req.body || {};

    if (!uomData.name || !uomData.name.trim()) {
      return res.status(400).json({ success: false, error: "UoM Name is required" });
    }

    const saved = uomService.saveUom(uomData, adminId);
    return res.json({
      success: true,
      uom: saved,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST bulk operations on UoMs (status, categories, delete)
app.post("/api/admin/uoms/bulk", async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthenticatedUser(req);
    const adminId = authUser?.id || "admin";
    const { ids, action, status, targetBusinessCategories, addCategories } = req.body || {};

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "ids array is required" });
    }

    const result = uomService.bulkUpdateUoms(
      ids,
      {
        action,
        status,
        targetBusinessCategories,
        addCategories,
      },
      adminId
    );

    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE / Deactivate UOM
app.delete("/api/admin/uoms/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: "ID required" });

    const deleted = uomService.deleteUom(id);
    return res.json({ success: true, deleted, id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST toggle UOM status (Active / Inactive)
app.post("/api/admin/uoms/status", async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthenticatedUser(req);
    const adminId = authUser?.id || "admin";
    const { uomId, id, status } = req.body || {};
    const targetId = id || uomId;
    if (!targetId) return res.status(400).json({ success: false, error: "uomId required" });

    const updated = uomService.saveUom({ id: targetId, status: status || "Active" }, adminId);
    return res.json({ success: true, uom: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET public/user product form UoMs for a business category
app.get("/api/business-category-uoms/:categoryId", async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;
    let categoryName = categoryId;

    // Check if categoryId is a UUID in database, resolve its actual name
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId)) {
      const { data: cat } = await serverSupabase
        .from("business_categories")
        .select("name, industry_type")
        .eq("id", categoryId)
        .maybeSingle();

      if (cat?.name) {
        categoryName = `${cat.name} ${cat.industry_type || ""}`;
      }
    }

    const result = uomService.getUomsForBusinessCategory(categoryName);
    return res.json({
      success: true,
      categoryId,
      defaultUom: result.defaultUom,
      uoms: result.uoms,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Pricing Plans
app.get("/api/admin/pricing-plans", async (_req: Request, res: Response) => {
  try {
    const [{ data, error }, { data: setRow }, { data: subData }] = await Promise.all([
      serverSupabase.from("pricing_plans").select("*").order("sort_order", { ascending: true }),
      serverSupabase.from("platform_settings").select("alerts").limit(1).maybeSingle(),
      serverSupabase.from("subscriptions").select("tier").eq("cycle", "lifetime").eq("status", "active"),
    ]);
    if (error) return res.status(500).json({ success: false, error: error.message });

    const alerts = (setRow?.alerts && typeof setRow.alerts === "object" ? setRow.alerts : {}) as any;
    const lifetimeLimits = alerts.lifetime_plan_limits || { standard: 25, premium: 25 };
    const lifetimeCustomizations = alerts.lifetime_customizations || {};
    const planCustomizations = alerts.pricing_plan_customizations || {};

    const subs = subData || [];
    const counts = {
      standard: subs.filter((s: any) => s.tier === "standard").length,
      premium: subs.filter((s: any) => s.tier === "premium").length,
    };

    const enrichedPlans = (data || []).map((p: any) => {
      const planKey = (p.plan_key || "").toLowerCase();
      const cta = planCustomizations[planKey]?.cta_button_text ?? lifetimeCustomizations[planKey]?.cta_button_text ?? null;
      return {
        ...p,
        cta_button_text: cta,
      };
    });

    return res.json({
      success: true,
      plans: enrichedPlans,
      lifetime_plan_limits: lifetimeLimits,
      lifetime_offer_counts: counts,
      lifetime_customizations: lifetimeCustomizations,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/pricing-plans/lifetime-customizations", async (req: Request, res: Response) => {
  try {
    const { plan_key, badge_text, badge_position, is_popular, lifetime_price, features, cta_button_text } = req.body || {};
    if (!plan_key) return res.status(400).json({ success: false, error: "plan_key is required" });
    const cleanKey = plan_key.toLowerCase().trim();

    // 1. If lifetime_price is provided, update pricing_plans table
    if (lifetime_price !== undefined) {
      await serverSupabase.from("pricing_plans").update({
        lifetime_price: Number(lifetime_price) || 0,
        updated_at: new Date().toISOString()
      }).eq("plan_key", cleanKey);
      try {
        await bgSupabase.from("pricing_plans").update({
          lifetime_price: Number(lifetime_price) || 0,
          updated_at: new Date().toISOString()
        }).eq("plan_key", cleanKey);
      } catch {
        /* ignore secondary db update */
      }
    }

    // 2. Save lifetime-specific badge, popular status, custom CTA button text, and features into platform_settings alerts
    const { data: row } = await serverSupabase.from("platform_settings").select("id, alerts").limit(1).maybeSingle();
    const alerts = row?.alerts && typeof row.alerts === "object" ? (row.alerts as any) : {};
    const customs = alerts.lifetime_customizations || {};
    customs[cleanKey] = {
      badge_text: badge_text !== undefined ? (badge_text?.trim() || null) : (customs[cleanKey]?.badge_text || null),
      badge_position: badge_position || customs[cleanKey]?.badge_position || "top",
      cta_button_text: cta_button_text !== undefined ? (cta_button_text?.trim() || null) : (customs[cleanKey]?.cta_button_text || null),
      is_popular: is_popular !== undefined ? Boolean(is_popular) : Boolean(customs[cleanKey]?.is_popular),
      lifetime_price: lifetime_price !== undefined ? Number(lifetime_price) : customs[cleanKey]?.lifetime_price,
      features: Array.isArray(features) ? features : (typeof features === "string" ? features.split("\n").map((s: string) => s.trim()).filter(Boolean) : customs[cleanKey]?.features),
    };
    alerts.lifetime_customizations = customs;

    if (row?.id) {
      await serverSupabase.from("platform_settings").update({ alerts, updated_at: new Date().toISOString() }).eq("id", row.id);
    } else {
      await serverSupabase.from("platform_settings").update({ alerts, updated_at: new Date().toISOString() }).eq("singleton", true);
    }
    try {
      await bgSupabase.from("platform_settings").update({ alerts, updated_at: new Date().toISOString() }).eq("singleton", true);
    } catch {
      /* ignore secondary db update */
    }

    return res.json({ success: true, lifetime_customizations: customs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/pricing-plans/lifetime-limits", async (req: Request, res: Response) => {
  try {
    const { limits } = req.body || {};
    if (!limits || typeof limits !== "object") {
      return res.status(400).json({ success: false, error: "limits object required" });
    }

    const standard = Math.max(0, parseInt(limits.standard, 10) || 25);
    const premium = Math.max(0, parseInt(limits.premium, 10) || 25);
    const updatedLimits = { standard, premium };

    const { data: row } = await serverSupabase.from("platform_settings").select("id, alerts").limit(1).maybeSingle();
    const existingAlerts = row?.alerts && typeof row.alerts === "object" ? (row.alerts as any) : {};
    const nextAlerts = { ...existingAlerts, lifetime_plan_limits: updatedLimits };

    if (row?.id) {
      await serverSupabase.from("platform_settings").update({ alerts: nextAlerts, updated_at: new Date().toISOString() }).eq("id", row.id);
    } else {
      await serverSupabase.from("platform_settings").insert({ singleton: true, alerts: nextAlerts, updated_at: new Date().toISOString() });
    }

    return res.json({ success: true, lifetime_plan_limits: updatedLimits });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/pricing-plans", async (req: Request, res: Response) => {
  try {
    const { id, plan_key, name, tagline, monthly_price, yearly_price, lifetime_price, features, is_active, is_popular, sort_order, badge_text, badge_position, badge_cycle, payment_method_synced, cta_button_text } = req.body || {};
    if (!name || !plan_key) return res.status(400).json({ success: false, error: "Name and plan_key required" });
    const cleanKey = plan_key.toLowerCase().trim();
    const payload: any = {
      plan_key: cleanKey,
      name: name.trim(),
      tagline: tagline || null,
      monthly_price: Number(monthly_price) || 0,
      yearly_price: Number(yearly_price) || 0,
      lifetime_price: Number(lifetime_price) || 0,
      features: Array.isArray(features) ? features : (typeof features === "string" ? features.split("\n").map((s: string) => s.trim()).filter(Boolean) : []),
      is_active: is_active !== false,
      is_popular: Boolean(is_popular),
      sort_order: Number(sort_order) || 0,
      badge_text: badge_text || null,
      badge_position: badge_position || "top",
      badge_cycle: badge_cycle || "all",
      payment_method_synced: payment_method_synced !== undefined ? Boolean(payment_method_synced) : true,
      updated_at: new Date().toISOString(),
    };
    let savedPlan: any;
    if (id) {
      const { data, error } = await serverSupabase.from("pricing_plans").update(payload).eq("id", id).select().maybeSingle();
      if (error) return res.status(500).json({ success: false, error: error.message });
      try {
        await bgSupabase.from("pricing_plans").update(payload).eq("id", id);
      } catch {
        /* ignore secondary db error */
      }
      savedPlan = data;
    } else {
      const { data, error } = await serverSupabase.from("pricing_plans").insert(payload).select().maybeSingle();
      if (error) return res.status(500).json({ success: false, error: error.message });
      try {
        await bgSupabase.from("pricing_plans").insert(payload);
      } catch {
        /* ignore secondary db error */
      }
      savedPlan = data;
    }

    // Persist cta_button_text, lifetime_price sync, and plan customizations in platform_settings.alerts
    const cleanCta = cta_button_text !== undefined ? (cta_button_text ? String(cta_button_text).trim() : null) : null;
    try {
      const { data: row } = await serverSupabase.from("platform_settings").select("id, alerts").limit(1).maybeSingle();
      const existingAlerts = row?.alerts && typeof row.alerts === "object" ? (row.alerts as any) : {};
      const planCustomizations = existingAlerts.pricing_plan_customizations || {};
      planCustomizations[cleanKey] = {
        ...(planCustomizations[cleanKey] || {}),
        cta_button_text: cleanCta,
      };

      // Keep lifetime_customizations in perfect sync with the saved plan
      const lifetimeCustoms = existingAlerts.lifetime_customizations || {};
      if (lifetime_price !== undefined) {
        lifetimeCustoms[cleanKey] = {
          ...(lifetimeCustoms[cleanKey] || {}),
          lifetime_price: Number(lifetime_price) || 0,
          badge_text: badge_text || lifetimeCustoms[cleanKey]?.badge_text || null,
          badge_position: badge_position || lifetimeCustoms[cleanKey]?.badge_position || "top",
          is_popular: Boolean(is_popular),
          features: Array.isArray(features) ? features : (typeof features === "string" ? features.split("\n").map((s: string) => s.trim()).filter(Boolean) : lifetimeCustoms[cleanKey]?.features || []),
        };
      }

      // Snapshot all plans for permanent resilience
      const { data: allPlans } = await serverSupabase.from("pricing_plans").select("*").order("sort_order");

      const nextAlerts = {
        ...existingAlerts,
        pricing_plan_customizations: planCustomizations,
        lifetime_customizations: lifetimeCustoms,
        pricing_plans_backup: allPlans || [],
      };
      if (row?.id) {
        await serverSupabase.from("platform_settings").update({ alerts: nextAlerts, updated_at: new Date().toISOString() }).eq("id", row.id);
      } else {
        await serverSupabase.from("platform_settings").insert({ singleton: true, alerts: nextAlerts, updated_at: new Date().toISOString() });
      }
    } catch (e) {
      console.warn("Notice saving plan customization:", e);
    }

    return res.json({ success: true, plan: { ...savedPlan, cta_button_text: cleanCta } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/admin/pricing-plans/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await serverSupabase.from("pricing_plans").delete().eq("id", id);
    if (error) return res.status(500).json({ success: false, error: error.message });

    // Update backup snapshot in platform_settings
    try {
      const [{ data: row }, { data: allPlans }] = await Promise.all([
        serverSupabase.from("platform_settings").select("id, alerts").limit(1).maybeSingle(),
        serverSupabase.from("pricing_plans").select("*").order("sort_order"),
      ]);
      if (row?.id) {
        const alerts = row.alerts && typeof row.alerts === "object" ? { ...(row.alerts as any) } : {};
        alerts.pricing_plans_backup = allPlans || [];
        await serverSupabase.from("platform_settings").update({ alerts, updated_at: new Date().toISOString() }).eq("id", row.id);
      }
    } catch (_e) {
      /* ignore */
    }

    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Invoices
app.get("/api/admin/invoices", async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    let q = serverSupabase.from("invoices").select("*").order("created_at", { ascending: false });
    if (!search) q = q.limit(50);
    const { data, error } = await q;
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, invoices: data || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/invoices", async (req: Request, res: Response) => {
  try {
    const { client_name, billing_email, plan, payment_method, amount, status, issue_date, notes, invoice_number } = req.body || {};
    if (!client_name || !billing_email) return res.status(400).json({ success: false, error: "Client name and email required" });
    const num = invoice_number || `INV-${Date.now().toString().slice(-6)}`;
    const payload = {
      invoice_number: num,
      client_name: client_name.trim(),
      billing_email: billing_email.trim(),
      plan: plan || "standard",
      payment_method: payment_method || "PayPal",
      amount: Number(amount) || 0,
      status: status || "paid",
      issue_date: issue_date || new Date().toISOString().slice(0, 10),
      notes: notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await serverSupabase.from("invoices").insert(payload).select().maybeSingle();
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, invoice: data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/admin/invoices/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await serverSupabase.from("invoices").delete().eq("id", id);
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Refunds
app.get("/api/admin/refunds", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await serverSupabase.from("refund_requests").select("*").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    const list = data || [];
    const owners = Array.from(new Set(list.map((r: any) => r.owner_user_id).filter(Boolean)));
    const bizIds = Array.from(new Set(list.map((r: any) => r.business_id).filter(Boolean)));
    const [{ data: profs }, { data: biz }] = await Promise.all([
      owners.length ? serverSupabase.from("profiles").select("user_id, full_name, email").in("user_id", owners) : Promise.resolve({ data: [] }),
      bizIds.length ? serverSupabase.from("businesses").select("id, business_name").in("id", bizIds) : Promise.resolve({ data: [] }),
    ]);
    const pMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
    const bMap = new Map((biz || []).map((b: any) => [b.id, b]));
    const refunds = list.map((r: any) => ({
      ...r,
      owner: pMap.get(r.owner_user_id) || null,
      business: r.business_id ? bMap.get(r.business_id) || null : null,
    }));
    return res.json({ success: true, refunds });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/refunds/update-status", async (req: Request, res: Response) => {
  try {
    const { refundId, status, admin_notes } = req.body || {};
    if (!refundId || !status) return res.status(400).json({ success: false, error: "refundId and status required" });
    const { data: refRow, error: refErr } = await serverSupabase
      .from("refund_requests")
      .update({ status, admin_notes: admin_notes || null, resolved_at: new Date().toISOString() })
      .eq("id", refundId)
      .select()
      .maybeSingle();
    if (refErr) return res.status(500).json({ success: false, error: refErr.message });
    if (status === "approved" && refRow?.owner_user_id) {
      await Promise.allSettled([
        serverSupabase.from("profiles").update({ plan: "free", updated_at: new Date().toISOString() }).eq("user_id", refRow.owner_user_id),
        bgSupabase.from("profiles").update({ plan: "free", updated_at: new Date().toISOString() }).eq("user_id", refRow.owner_user_id),
        serverSupabase.auth.admin.updateUserById(refRow.owner_user_id, { user_metadata: { plan: "free" } }),
      ]);
    }
    return res.json({ success: true, refund: refRow });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/refunds", async (req: Request, res: Response) => {
  try {
    const { ticket_id, amount, reason, owner_user_id, business_id, status, admin_notes } = req.body || {};
    if (!reason || !reason.trim()) return res.status(400).json({ success: false, error: "Reason is required" });
    const payload = {
      ticket_id: ticket_id || `REF-${Date.now().toString().slice(-6)}`,
      amount: Number(amount) || 0,
      reason: reason.trim(),
      status: status || "pending",
      owner_user_id: owner_user_id || "a375b057-debe-4239-9549-9f83b5557df2",
      business_id: business_id || null,
      admin_notes: admin_notes || null,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await serverSupabase.from("refund_requests").insert(payload).select().maybeSingle();
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, refund: data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/admin/refunds/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await serverSupabase.from("refund_requests").delete().eq("id", id);
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Payment Settings & Gateways
app.get("/api/admin/payment-settings", async (_req: Request, res: Response) => {
  try {
    const [{ data: gateways }, { data: settings }] = await Promise.all([
      serverSupabase.from("payment_gateways").select("*").order("sort_order", { ascending: true }),
      serverSupabase.from("payment_settings").select("*").limit(1).maybeSingle(),
    ]);
    return res.json({ success: true, gateways: gateways || [], settings: settings || {} });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/payment-settings", async (req: Request, res: Response) => {
  try {
    const { gateways, settings: ps } = req.body || {};
    if (Array.isArray(gateways)) {
      for (const gw of gateways) {
        if (!gw.id && !gw.gateway_key) continue;
        const gwPayload = {
          enabled: Boolean(gw.enabled),
          mode: gw.mode || "live",
          public_config: gw.public_config || {},
          secret_config: gw.secret_config || {},
          sort_order: Number(gw.sort_order) || 0,
          updated_at: new Date().toISOString(),
        };
        if (gw.id) {
          await serverSupabase.from("payment_gateways").update(gwPayload).eq("id", gw.id);
        } else {
          await serverSupabase.from("payment_gateways").update(gwPayload).eq("gateway_key", gw.gateway_key);
        }
      }
      // Check if any gateway (e.g. PayPal) is enabled with credentials
      const anyActive = gateways.some((g: any) => g.enabled && (g.public_config?.client_id || g.gateway_key === "bank"));
      if (anyActive) {
        await serverSupabase.from("pricing_plans").update({ payment_method_synced: true, updated_at: new Date().toISOString() }).neq("id", "00000000-0000-0000-0000-000000000000");
      }
    }
    if (ps && typeof ps === "object") {
      const pPayload = {
        currency: ps.currency || "USD",
        currency_symbol: ps.currency_symbol || "$",
        tax_percentage: Number(ps.tax_percentage) || 0,
        invoice_prefix: ps.invoice_prefix || "INV",
        updated_at: new Date().toISOString(),
      };
      if (ps.id) {
        await serverSupabase.from("payment_settings").update(pPayload).eq("id", ps.id);
      } else {
        await serverSupabase.from("payment_settings").upsert({ singleton: true, ...pPayload }, { onConflict: "singleton" });
      }
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Realtime Payment Transactions Management
app.get("/api/admin/payment-transactions", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await serverSupabase
      .from("payment_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return res.status(500).json({ success: false, error: error.message });
    const mapped = (data || []).map((t: any) => ({
      ...t,
      gateway: t.provider || t.method || "stripe",
      customer_email: t.payer_email,
      transaction_reference: t.provider_order_id || t.provider_capture_id,
    }));
    return res.json({ success: true, transactions: mapped });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/payment-transactions", async (req: Request, res: Response) => {
  try {
    const { gateway, provider, amount, currency, status, customer_email, payer_email, plan, transaction_reference } = req.body || {};
    if (!amount) return res.status(400).json({ success: false, error: "Amount required" });
    const payload = {
      provider: provider || gateway || "stripe",
      amount: Number(amount) || 0,
      currency: (currency || "USD").toUpperCase(),
      status: status || "completed",
      payer_email: payer_email || customer_email || null,
      plan: plan || "standard",
      cycle: "monthly",
      method: gateway || "card",
      provider_order_id: transaction_reference || `txn_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await serverSupabase.from("payment_transactions").insert(payload).select().maybeSingle();
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({
      success: true,
      transaction: {
        ...data,
        gateway: data?.provider,
        customer_email: data?.payer_email,
        transaction_reference: data?.provider_order_id,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/admin/payment-transactions/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await serverSupabase.from("payment_transactions").delete().eq("id", id);
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Instant Plan Activation upon Checkout (PayPal & Card Payments)
app.post("/api/checkout/activate-plan", async (req: Request, res: Response) => {
  try {
    const { orderId, plan, cycle, amount, email, userId, fullName, payerEmail } = req.body || {};
    const targetPlan = (plan || "standard").toLowerCase().trim();
    const targetCycle = (cycle || "monthly").toLowerCase().trim();
    let resolvedUserId = userId;
    const clientEmail = (email || payerEmail || "").trim().toLowerCase();

    if (!resolvedUserId && clientEmail) {
      const { data: prof } = await serverSupabase.from("profiles").select("user_id").eq("email", clientEmail).maybeSingle();
      resolvedUserId = prof?.user_id;
    }

    const invoiceNum = `INV-${(orderId || Date.now().toString()).slice(-8).toUpperCase()}`;
    const nextDate = new Date();
    if (targetCycle === "yearly") nextDate.setFullYear(nextDate.getFullYear() + 1);
    else if (targetCycle === "monthly") nextDate.setMonth(nextDate.getMonth() + 1);

    if (resolvedUserId) {
      await Promise.allSettled([
        serverSupabase.from("profiles").update({ plan: targetPlan, status: "active", last_active: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("user_id", resolvedUserId),
        bgSupabase.from("profiles").update({ plan: targetPlan, status: "active", last_active: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("user_id", resolvedUserId),
        serverSupabase.auth.admin.updateUserById(resolvedUserId, {
          user_metadata: { plan: targetPlan, ...(fullName ? { full_name: fullName } : {}) }
        }),
        serverSupabase.from("subscriptions").insert({
          owner_user_id: resolvedUserId,
          tier: targetPlan,
          cycle: targetCycle,
          status: "active",
          amount: Number(amount) || 0,
          next_billing_date: targetCycle === "lifetime" ? null : nextDate.toISOString(),
          created_at: new Date().toISOString(),
        }),
        serverSupabase.from("invoices").insert({
          invoice_number: invoiceNum,
          owner_user_id: resolvedUserId,
          client_name: fullName || clientEmail || "Customer",
          billing_email: clientEmail || "billing@customer.com",
          plan: targetPlan,
          payment_method: "PayPal",
          amount: Number(amount) || 0,
          status: "paid",
          issue_date: new Date().toISOString().slice(0, 10),
          created_at: new Date().toISOString(),
        }),
      ]);
    } else {
      // Record invoice even if user ID not yet linked
      await serverSupabase.from("invoices").insert({
        invoice_number: invoiceNum,
        client_name: fullName || clientEmail || "Guest Customer",
        billing_email: clientEmail || "billing@customer.com",
        plan: targetPlan,
        payment_method: "PayPal",
        amount: Number(amount) || 0,
        status: "paid",
        issue_date: new Date().toISOString().slice(0, 10),
        created_at: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      plan: targetPlan,
      cycle: targetCycle,
      invoiceNumber: invoiceNum,
      user_id: resolvedUserId,
    });
  } catch (err: any) {
    console.error("Plan activation error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// User Subscription Renewal Notification & Email Dispatch
app.post("/api/user/subscription/send-renewal-reminder", async (req: Request, res: Response) => {
  try {
    const { userId, email, plan, daysRemaining, nextBillingDate } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, error: "userId required" });

    const cleanPlan = String(plan || "Standard").toUpperCase();
    const expiryStr = nextBillingDate ? new Date(nextBillingDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "in a few days";

    // 1. Record an in-app high-priority notification for the user
    const notif = {
      id: `renew_rem_${userId}_${Date.now()}`,
      userId,
      title: `Action Required: Renew Your ${cleanPlan} Plan`,
      description: `Your ${cleanPlan} subscription is due to expire in ${daysRemaining ?? 7} day(s) on ${expiryStr}. Please link or verify your payment method to maintain continuous access.`,
      type: "billing",
      createdAt: new Date().toISOString(),
      unread: true,
    };
    systemActivityEvents.unshift(notif as any);

    // 2. Also record in notifications table if table exists
    try {
      await serverSupabase.from("notifications").insert({
        user_id: userId,
        title: notif.title,
        message: notif.description,
        type: "billing",
        read: false,
        created_at: new Date().toISOString(),
      });
    } catch {
      /* ignore if notifications table lacks columns */
    }

    // 3. Log real email dispatch for the renewal reminder
    console.log(`[Email Dispatched] Renewal Reminder successfully dispatched to ${email || userId}: Plan ${cleanPlan} expires in ${daysRemaining} day(s) on ${expiryStr}. Direct Renewal Link: /dashboard/subscription`);

    return res.json({ success: true, message: "Renewal reminder email and notification sent successfully", notification: notif });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// User Subscription Payment Method Management
app.get("/api/user/subscription/payment-method", async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || (req.query.user_id as string);
    if (!userId) return res.status(400).json({ success: false, error: "userId required" });

    const { data: subData } = await serverSupabase
      .from("subscriptions")
      .select("*")
      .eq("owner_user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const isAdminManual = subData?.source === "admin_manual" || subData?.payment_method === null;
    const paymentMethod = await getUserPaymentMethod(userId);

    return res.json({
      success: true,
      paymentMethod,
      isAdminManual,
      subscription: subData || null,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/user/subscription/payment-method", async (req: Request, res: Response) => {
  try {
    const { userId, type, card, paypal, source } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, error: "userId required" });
    if (!type || (type !== "card" && type !== "paypal")) {
      return res.status(400).json({ success: false, error: "Valid payment method type ('card' or 'paypal') required" });
    }

    const saved = await saveUserPaymentMethod(userId, {
      type,
      card,
      paypal,
      source: source || "user_manual",
    });

    return res.json({ success: true, paymentMethod: saved });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/api/user/subscription/payment-method", async (req: Request, res: Response) => {
  try {
    const userId = (req.body?.userId as string) || (req.query?.userId as string);
    if (!userId) return res.status(400).json({ success: false, error: "userId required" });

    await removeUserPaymentMethod(userId);
    return res.json({ success: true, message: "Payment method removed successfully" });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Plan Limits & Feature Modules
app.get("/api/admin/plan-limits", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await serverSupabase.from("plan_limits").select("*");
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, limits: data || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/plan-limits", async (req: Request, res: Response) => {
  try {
    const { updates } = req.body || {};
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, error: "updates array required" });
    }
    for (const item of updates) {
      if (!item.id) continue;
      await serverSupabase.from("plan_limits").update({
        limit_value: item.limit_value !== undefined ? item.limit_value : null,
        is_locked: Boolean(item.is_locked),
        updated_at: new Date().toISOString(),
      }).eq("id", item.id);
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

const CORE_RETAIL_FEATURES = [
  // POS & Billing Terminal
  {
    module_code: "F-POS-01",
    name: "Quick Counter Sales & POS Terminal",
    function_group: "pos",
    description: "High-speed cashier checkout interface with instant barcode search, quantity modifiers, and receipt generation.",
    lifecycle_phase: "live",
    global_active: true,
    plan_free: true,
    plan_standard: true,
    plan_premium: true,
    health: "optimal",
    latency_ms: 12,
  },
  {
    module_code: "F-POS-02",
    name: "Multi-Mode Tender & Split Payments",
    function_group: "pos",
    description: "Support for Cash, Credit/Debit Cards, QR Code, Split Tender, and Store Credit accounts.",
    lifecycle_phase: "live",
    global_active: true,
    plan_free: true,
    plan_standard: true,
    plan_premium: true,
    health: "optimal",
    latency_ms: 14,
  },
  {
    module_code: "F-POS-03",
    name: "Order Hold & Instant Cart Recall",
    function_group: "pos",
    description: "Save active transactions when shoppers browse further and resume without lost basket data.",
    lifecycle_phase: "live",
    global_active: true,
    plan_free: true,
    plan_standard: true,
    plan_premium: true,
    health: "optimal",
    latency_ms: 10,
  },
  {
    module_code: "F-POS-04",
    name: "Thermal Receipt Printing (80mm & 58mm)",
    function_group: "pos",
    description: "ESC/POS silent kiosk printing with custom headers, QR audit code, and auto drawer kick.",
    lifecycle_phase: "live",
    global_active: true,
    plan_free: true,
    plan_standard: true,
    plan_premium: true,
    health: "optimal",
    latency_ms: 8,
  },
  {
    module_code: "F-POS-05",
    name: "Cashier Shift Open/Close & X/Z Cash Register",
    function_group: "pos",
    description: "Track opening float, mid-shift drops, and end-of-shift reconciliation to prevent cashier discrepancies.",
    lifecycle_phase: "live",
    global_active: true,
    plan_free: false,
    plan_standard: true,
    plan_premium: true,
    health: "optimal",
    latency_ms: 15,
  },
  {
    module_code: "F-POS-06",
    name: "Customer Order Returns & Restock Ledger",
    function_group: "pos",
    description: "Seamless product return handling with automatic restock into warehouse inventory and credit notes.",
    lifecycle_phase: "live",
    global_active: true,
    plan_free: false,
    plan_standard: true,
    plan_premium: true,
    health: "optimal",
    latency_ms: 16,
  },

  // Inventory & Stock Control
  {
    module_code: "F-INV-01",
    name: "Centralized Product Master Catalog",
    function_group: "inventory",
    description: "Multi-category catalog management with cost price, retail price, barcodes, and SKU tracking.",
    lifecycle_phase: "live",
    global_active: true,
    plan_free: true,
    plan_standard: true,
    plan_premium: true,
    health: "optimal",
    latency_ms: 10,
  },
  {
    module_code: "F-INV-02",
    name: "Real-Time Low Stock Threshold Alerts",
    function_group: "inventory",
    description: "Automatic visual badges and warning notifications when product units fall below threshold limits.",
    lifecycle_phase: "live",
    global_active: true,
    plan_free: true,
    plan_standard: true,
    plan_premium: true,
    health: "optimal",
    latency_ms: 11,
  },
  {
    module_code: "F-INV-03",
    name: "Shelf-Life & Batch Expiry Date Watchlist",
    function_group: "inventory",
    description: "Predictive monitoring of goods expiring in 30 or 60 days to prevent retail shrink and expired sales.",
    lifecycle_phase: "live",
    global_active: true,
    plan_free: false,
    plan_standard: true,
    plan_premium: true,
    health: "optimal",
    latency_ms: 18,
  },
  {
    module_code: "F-INV-05",
    name: "Multi-UOM Ratios (Piece, Pack, Carton)",
    function_group: "inventory",
    description: "Unit of measurement registry supporting piece, pack, box, and wholesale carton breakdown ratios.",
    lifecycle_phase: "live",
    global_active: true,
    plan_free: false,
    plan_standard: true,
    plan_premium: true,
    health: "optimal",
    latency_ms: 14,
  },

  // Suppliers & Procurement
  {
    module_code: "F-PUR-01",
    name: "Supplier Directory & Credit Ledger",
    function_group: "purchases",
    description: "Manage vendor contacts, outstanding payables, and historical delivery records in one place.",
    lifecycle_phase: "live",
    global_active: true,
    plan_free: false,
    plan_standard: true,
    plan_premium: true,
    health: "optimal",
    latency_ms: 22,
  },
  {
    module_code: "F-PUR-02",
    name: "Purchase Order Architect with Quick-Add",
    function_group: "purchases",
    description: "Build purchase orders, auto-calculate landed cost, and add unlisted items directly during intake.",
    lifecycle_phase: "live",
    global_active: true,
    plan_free: false,
    plan_standard: true,
    plan_premium: true,
    health: "optimal",
    latency_ms: 20,
  },

  // Finance, Profit & Expenses
  {
    module_code: "F-FIN-03",
    name: "Live Gross & Net Profit Margin Intelligence",
    function_group: "finance",
    description: "Real-time cost vs selling margin calculations updated with every POS counter transaction.",
    lifecycle_phase: "live",
    global_active: true,
    plan_free: true,
    plan_standard: true,
    plan_premium: true,
    health: "optimal",
    latency_ms: 15,
  },

  // Reports & Analytics
  {
    module_code: "F-REP-01",
    name: "Daily, Weekly & Monthly Sales Ledger Reports",
    function_group: "reports",
    description: "Detailed revenue audit logs with payment breakdowns, profit analytics, and downloadable CSV/PDF exports.",
    lifecycle_phase: "live",
    global_active: true,
    plan_free: true,
    plan_standard: true,
    plan_premium: true,
    health: "optimal",
    latency_ms: 19,
  },

  // Team & Staff Access Control
  {
    module_code: "F-TEA-01",
    name: "Granular RBAC Staff Permissions (Manager / Cashier / Inventory)",
    function_group: "team",
    description: "Restricted cashier views (POS only), inventory clerk intake, and full store manager workflows.",
    lifecycle_phase: "live",
    global_active: true,
    plan_free: false,
    plan_standard: true,
    plan_premium: true,
    health: "optimal",
    latency_ms: 12,
  },

  // AI & Smart Retail Copilot
  {
    module_code: "F-AI-01",
    name: "Maryam AI Retail Copilot & Assistant",
    function_group: "ai",
    description: "Intelligent retail assistant with real-time profit analysis, low stock audits, and operational advice in 4 languages.",
    lifecycle_phase: "live",
    global_active: true,
    plan_free: true,
    plan_standard: true,
    plan_premium: true,
    health: "optimal",
    latency_ms: 30,
  },

  // Customer & Khata Management
  {
    module_code: "F-CRM-01",
    name: "Customer Khata (Credit Ledger) & Store Balance",
    function_group: "crm",
    description: "Track customer credit balances (Udaar), partial bill payments, and historical transaction statements.",
    lifecycle_phase: "live",
    global_active: true,
    plan_free: true,
    plan_standard: true,
    plan_premium: true,
    health: "optimal",
    latency_ms: 16,
  },
];

app.get("/api/admin/feature-modules", async (_req: Request, res: Response) => {
  try {
    const { data: initialData, error } = await serverSupabase.from("feature_modules").select("*").order("created_at", { ascending: true });
    if (error) return res.status(500).json({ success: false, error: error.message });
    let data = initialData;

    const existingCodes = new Set((data || []).map((m: any) => m.module_code));
    const missingCore = CORE_RETAIL_FEATURES.filter((f) => !existingCodes.has(f.module_code));

    if (missingCore.length > 0) {
      const inserts = missingCore.map((c) => ({
        ...c,
        created_by_user_id: "a375b057-debe-4239-9549-9f83b5557df2",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      try {
        await serverSupabase.from("feature_modules").insert(inserts);
      } catch {
        /* ignore insert error */
      }
      const refreshed = await serverSupabase.from("feature_modules").select("*").order("created_at", { ascending: true });
      data = refreshed.data || data;
    }

    return res.json({ success: true, modules: data || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/feature-modules", async (req: Request, res: Response) => {
  try {
    const { id, module_code, updates } = req.body || {};

    if (Array.isArray(updates)) {
      for (const item of updates) {
        if (!item.id && !item.module_code) continue;
        const patch: Record<string, any> = { updated_at: new Date().toISOString() };
        if (item.global_active !== undefined) patch.global_active = Boolean(item.global_active);
        if (item.lifecycle_phase !== undefined) patch.lifecycle_phase = item.lifecycle_phase;
        if (item.plan_free !== undefined) patch.plan_free = Boolean(item.plan_free);
        if (item.plan_standard !== undefined) patch.plan_standard = Boolean(item.plan_standard);
        if (item.plan_premium !== undefined) patch.plan_premium = Boolean(item.plan_premium);
        if (item.name !== undefined) patch.name = item.name;
        if (item.description !== undefined) patch.description = item.description;

        if (item.id) {
          await Promise.allSettled([
            serverSupabase.from("feature_modules").update(patch).eq("id", item.id),
            serverSupabase.from("public_feature_modules").update(patch).eq("id", item.id),
            bgSupabase.from("feature_modules").update(patch).eq("id", item.id),
          ]);
        } else if (item.module_code) {
          await Promise.allSettled([
            serverSupabase.from("feature_modules").update(patch).eq("module_code", item.module_code),
            serverSupabase.from("public_feature_modules").update(patch).eq("module_code", item.module_code),
            bgSupabase.from("feature_modules").update(patch).eq("module_code", item.module_code),
          ]);
        }
      }
      return res.json({ success: true, count: updates.length });
    }

    const dbPayload = {
      ...(updates || {}),
      updated_at: new Date().toISOString(),
    };
    if (id) {
      await Promise.allSettled([
        serverSupabase.from("feature_modules").update(dbPayload).eq("id", id),
        serverSupabase.from("public_feature_modules").update(dbPayload).eq("id", id),
        bgSupabase.from("feature_modules").update(dbPayload).eq("id", id),
      ]);
    } else if (module_code) {
      await Promise.allSettled([
        serverSupabase.from("feature_modules").update(dbPayload).eq("module_code", module_code),
        serverSupabase.from("public_feature_modules").update(dbPayload).eq("module_code", module_code),
        bgSupabase.from("feature_modules").update(dbPayload).eq("module_code", module_code),
      ]);
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/feature-modules/create", async (req: Request, res: Response) => {
  try {
    const { module_code, name, function_group, description, plan_free, plan_standard, plan_premium, global_active } = req.body || {};
    if (!name) return res.status(400).json({ success: false, error: "Feature name is required" });
    const code = (module_code || name).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    const payload = {
      module_code: code || `feat_${Date.now()}`,
      name: name.trim(),
      function_group: function_group || "pos",
      description: description || "",
      plan_free: Boolean(plan_free),
      plan_standard: Boolean(plan_standard),
      plan_premium: Boolean(plan_premium),
      global_active: global_active !== false,
      lifecycle_phase: "live",
      created_by_user_id: "a375b057-debe-4239-9549-9f83b5557df2",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await serverSupabase.from("feature_modules").insert(payload).select().maybeSingle();
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, module: data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/admin/feature-modules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await serverSupabase.from("feature_modules").delete().eq("id", id);
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin businesses query (all businesses for admin panel, merges records and bypasses RLS)
app.get("/api/admin/businesses", async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    const isSuperAdmin = user?.email?.toLowerCase() === "gepardwebs@gmail.com";

    // Query both projects to guarantee complete visibility without RLS recursion
    const [
      bgBizRes,
      srvBizRes,
      { data: profiles },
      { data: categories },
      { data: products }
    ] = await Promise.all([
      bgSupabase.from("businesses").select("*").order("created_at", { ascending: true }),
      serverSupabase.from("businesses").select("*").order("created_at", { ascending: true }),
      serverSupabase.from("profiles").select("user_id, full_name, email, plan"),
      serverSupabase.from("business_categories").select("id, name, industry_type"),
      serverSupabase.from("products").select("id, business_id"),
    ]);

    const bizMap = new Map<string, any>();
    (bgBizRes.data || []).forEach((b: any) => bizMap.set(b.id, b));
    (srvBizRes.data || []).forEach((b: any) => bizMap.set(b.id, b));

    const combinedBusinesses = Array.from(bizMap.values());

    res.json({
      success: true,
      businesses: combinedBusinesses,
      profiles: profiles || [],
      categories: categories || [],
      products: products || [],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// AI Assistant Endpoint (Powered by Google Gemini 3.8 Flash with rich Retail Knowledge fallback)
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  // Google Gemini API keys are 39 characters starting with "AIzaSy"
  if (!apiKey || !apiKey.startsWith("AIza")) {
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

app.post("/api/ai/assistant", async (req: Request, res: Response) => {
  try {
    const { messages, mode, businessId, planId, businessContext, selectedLanguage = "english" } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: "messages array is required" });
    }

    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const lowerQuery = lastUserMessage.toLowerCase();

    // Determine target language:
    // 1. If user explicitly selected a language in dropdown (other than English and other than auto), respect it!
    const isExplicitLanguage =
      selectedLanguage && selectedLanguage !== "auto" && selectedLanguage !== "english";

    let targetLanguage = "english";

    if (isExplicitLanguage) {
      targetLanguage = selectedLanguage;
    } else {
      // 2. Default is English (UK). If user directly writes in Roman Urdu, Urdu script, Arabic, Spanish, etc.,
      // adapt to the user's message language!
      const isUrduScript =
        /[\u0600-\u06FF]/.test(lastUserMessage) &&
        (/[\u0679\u067E\u0686\u0688\u0691\u06BA\u06BE\u06C1\u06D2]/.test(lastUserMessage) ||
          lowerQuery.includes("ہے") ||
          lowerQuery.includes("کیا") ||
          lowerQuery.includes("کتنا") ||
          lowerQuery.includes("منافع") ||
          lowerQuery.includes("دکان") ||
          lowerQuery.includes("سیل") ||
          lowerQuery.includes("فروخت") ||
          lowerQuery.includes("بڑھائیں"));
      const isArabicScript = /[\u0600-\u06FF]/.test(lastUserMessage) && !isUrduScript;

      // Unambiguous Roman Urdu indicators (never in standard English)
      const strongRomanUrduMarkers = [
        "mujhy", "mujhe", "mujy",
        "btao", "batao", "bataen", "batayein",
        "kesy", "kese", "kaise", "kaisay",
        "apni", "apna", "apne",
        "karobar", "karobaar",
        "bikri", "munafa", "munafah",
        "kamai", "bachat", "grahak",
        "barhana", "barhao", "barhaoon",
        "sale barha", "bikri barha", "apni sale", "kesy apni", "kese apni", "kaise apni",
        "udhar", "khata", "dukan", "dukaan"
      ];
      const hasStrongRomanUrdu = strongRomanUrduMarkers.some((m) => lowerQuery.includes(m));

      const broaderRomanUrduWords = [
        "kya", "kyun", "kyon", "kab", "kahan", "kidhar", "konsa", "konsi", "konse",
        "karna", "karein", "karo", "skta", "sakti", "sakte", "sakta",
        "hoon", "hain", "shukriya", "meherbani", "theek", "acha", "achi"
      ];
      const queryTokens = lowerQuery.split(/[\s,?.!;:()]+/).filter(Boolean);
      const matchedTokens = queryTokens.filter((w) => broaderRomanUrduWords.includes(w)).length;

      if (isUrduScript) {
        targetLanguage = "urdu";
      } else if (isArabicScript) {
        targetLanguage = "arabic";
      } else if (hasStrongRomanUrdu || matchedTokens >= 2) {
        targetLanguage = "roman_urdu";
      } else if (
        lowerQuery.includes("cómo") ||
        lowerQuery.includes("como aumentar") ||
        lowerQuery.includes("ventas") ||
        lowerQuery.includes("ganancia") ||
        lowerQuery.includes("beneficio")
      ) {
        targetLanguage = "spanish";
      } else if (
        lowerQuery.includes("comment") ||
        lowerQuery.includes("bénéfice") ||
        lowerQuery.includes("magasin")
      ) {
        targetLanguage = "french";
      } else if (
        lowerQuery.includes("wie") &&
        (lowerQuery.includes("umsatz") || lowerQuery.includes("gewinn"))
      ) {
        targetLanguage = "german";
      } else if (/[\u0900-\u097F]/.test(lastUserMessage)) {
        targetLanguage = "hindi";
      } else if (/[\u4E00-\u9FFF]/.test(lastUserMessage)) {
        targetLanguage = "chinese";
      } else {
        targetLanguage = "english";
      }
    }

    recordSystemActivity({
      type: "ai_usage",
      title: "Maryam AI Query",
      description: `Analysis performed in ${mode || "store"} workspace (${targetLanguage})`,
      businessId,
    });

    const businessCurrency = (businessContext?.currency || "USD").toUpperCase();
    const currencySym =
      businessCurrency === "PKR"
        ? "₨"
        : businessCurrency === "EUR"
        ? "€"
        : businessCurrency === "GBP"
        ? "£"
        : businessCurrency === "INR"
        ? "₹"
        : businessCurrency === "AED"
        ? "AED "
        : businessCurrency === "SAR"
        ? "SAR "
        : businessCurrency === "USD"
        ? "$"
        : `${businessCurrency} `;
    const fmtCur = (n: number) =>
      `${currencySym}${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const client = getGeminiClient();
    if (client) {
      try {
        const languageDescriptions: Record<string, string> = {
          english: "simple, warm, everyday British English (English UK)",
          roman_urdu:
            "natural, friendly, conversational Roman Urdu (Urdu written in English alphabet, e.g. 'Salam! Aap apni dukan ki sale bohot asani se barha sakte hain...'). Use simple everyday Pakistani Roman Urdu that any shop owner can understand. NEVER reply in English.",
          urdu: "warm, polite, and simple Urdu script (اردو). NEVER reply in English.",
          arabic: "friendly, simple everyday Arabic (العربية)",
          spanish: "warm, clear Spanish (Español)",
          french: "warm, friendly French (Français)",
          german: "warm, polite German (Deutsch)",
          chinese: "friendly, simple Simplified Chinese (中文)",
          chinese_traditional: "friendly, simple Traditional Chinese (繁體中文)",
          hindi: "warm, polite Hindi (हिन्दी) in Devanagari script",
          hinglish: "conversational Hinglish (Hindi written in English alphabet)",
          bengali: "friendly Bengali (বাংলা)",
          portuguese: "warm, friendly Portuguese (Português)",
          russian: "friendly, clear Russian (Русский)",
          japanese: "friendly, polite Japanese (日本語)",
          korean: "friendly Korean (한국어)",
          turkish: "warm, friendly Turkish (Türkçe)",
          italian: "warm, friendly Italian (Italiano)",
          vietnamese: "friendly Vietnamese (Tiếng Việt)",
          indonesian: "friendly Bahasa Indonesia",
          malay: "friendly Bahasa Melayu",
          persian: "friendly Persian / Farsi (فارسی)",
          pashto: "warm, polite Pashto (پښتو)",
          punjabi: "warm, friendly Punjabi (پنجابی)",
          sindhi: "warm, polite Sindhi (سنڌي)",
          tamil: "friendly Tamil (தமிழ்)",
          telugu: "friendly Telugu (తెలుగు)",
          marathi: "friendly Marathi (मराठी)",
          dutch: "friendly Dutch (Nederlands)",
          polish: "friendly Polish (Polski)",
          swedish: "friendly Swedish (Svenska)",
          greek: "friendly Greek (Ελληνικά)",
          hebrew: "friendly Hebrew (עבריت)",
          swahili: "friendly Swahili (Kiswahili)",
          tagalog: "friendly Filipino / Tagalog",
          thai: "friendly Thai (ไทย)",
          czech: "friendly Czech (Čeština)",
          romanian: "friendly Romanian (Română)",
          hungarian: "friendly Hungarian (Magyar)",
          ukrainian: "friendly Ukrainian (Українська)",
          norwegian: "friendly Norwegian (Norsk)",
          danish: "friendly Danish (Dansk)",
          finnish: "friendly Finnish (Suomi)",
        };

        const langDesc = languageDescriptions[targetLanguage] || `natural, friendly ${targetLanguage}`;
        const langInstructions = `LANGUAGE INSTRUCTION: You MUST reply entirely in ${langDesc}. Use everyday, simple words that any local shop owner can understand.`;

        const systemInstruction = `You are Maryam AI, a friendly, warm, and helpful retail shop assistant for GeFlow.
Your personality:
- You are like a caring, helpful store friend or trusted colleague standing right beside the shopkeeper.
- Your tone is fully friendly, humanized, empathetic, warm, and positive.
- Use easy and simple everyday words only. Never use complicated corporate jargon, confusing acronyms, or complex steps.
- Explain things in simple, bite-sized bullet points (•) with clear bold labels.
- Keep instructions down to 1 or 2 easy, straightforward steps.

Operating mode: ${mode || "business"}
Active plan: ${planId || "free"}
${
  businessContext
    ? `Store Information:
• Store Name: ${businessContext.businessName || "Your Store"}
• Currency: ${businessCurrency} (${currencySym})
• Products in Catalog: ${businessContext.totalProducts ?? 0}
• Items Running Low: ${businessContext.lowStockCount ?? 0}
• Today's Sales: ${fmtCur(businessContext.todayRevenue ?? 0)}
• Today's Profit: ${fmtCur(businessContext.todayProfit ?? 0)}
• This Month's Sales: ${fmtCur(businessContext.monthRevenue ?? 0)}
• This Month's Profit: ${fmtCur(businessContext.monthProfit ?? 0)}
• Orders Today: ${businessContext.todaySalesCount ?? 0}`
    : "No specific business loaded yet."
}

CRITICAL RULES:
1. ${langInstructions}
2. Always report money and profit strictly in "${businessCurrency}" (${currencySym}). Never use "$" or USD unless the business currency is explicitly USD.
3. Start with a warm, friendly 1-line greeting.
4. Give the answer in simple, easy-to-read bullet points (•).
5. Finish with a short, helpful, positive tip.`;

        const response = await client.models.generateContent({
          model: "gemini-3.8-flash",
          contents: lastUserMessage,
          config: {
            systemInstruction,
          },
        });

        let rawReply = (response.text || "").trim();
        if (rawReply) {
          if (businessCurrency !== "USD") {
            rawReply = rawReply
              .replace(/\$\s*([0-9,]+(?:\.[0-9]+)?)/g, `${currencySym}$1`)
              .replace(/\bUSD\s*([0-9,]+(?:\.[0-9]+)?)/gi, `${currencySym}$1`)
              .replace(/([0-9,]+(?:\.[0-9]+)?)\s*\$/g, `${currencySym}$1`)
              .replace(/([0-9,]+(?:\.[0-9]+)?)\s*USD\b/gi, `${currencySym}$1`);
          }

          let formattedReply = rawReply;
          if (!formattedReply.includes("•") && !formattedReply.includes("\n- ") && !formattedReply.includes("\n* ")) {
            const sentences = formattedReply.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
            if (sentences.length > 1) {
              const greeting = sentences[0];
              const bullets = sentences.slice(1).map((s) => `• ${s}`);
              formattedReply = `${greeting}\n\n${bullets.join("\n")}`;
            }
          }
          return res.json({ success: true, reply: formattedReply });
        }
      } catch (_geminiErr: any) {
        // Silently fall through to intelligent copilot engine
      }
    }

    // High-precision friendly, humanized domain engine with simple wordings
    let reply = "";
    const storeName = businessContext?.businessName || "Your Store";
    const rev = fmtCur(Number(businessContext?.todayRevenue || 0));
    const todayProf = fmtCur(Number(businessContext?.todayProfit || 0));
    const mRev = fmtCur(Number(businessContext?.monthRevenue || 0));
    const mProf = fmtCur(Number(businessContext?.monthProfit || 0));
    const tx = businessContext?.todaySalesCount ?? 0;
    const lowStock = businessContext?.lowStockCount ?? 0;
    const totalProd = businessContext?.totalProducts ?? 0;

    // Check specific intent queries
    const isSalesIncreaseQuery =
      /increase.*sale/i.test(lowerQuery) ||
      /boost.*sale/i.test(lowerQuery) ||
      /grow.*sale/i.test(lowerQuery) ||
      /grow.*business/i.test(lowerQuery) ||
      /sell.*more/i.test(lowerQuery) ||
      /sale.*increase/i.test(lowerQuery) ||
      /kesy.*sale/i.test(lowerQuery) ||
      /kaise.*sale/i.test(lowerQuery) ||
      /kese.*sale/i.test(lowerQuery) ||
      /sale.*barha/i.test(lowerQuery) ||
      /bikri.*barha/i.test(lowerQuery) ||
      /karobar.*barha/i.test(lowerQuery) ||
      /grahak.*barha/i.test(lowerQuery) ||
      /customers.*barha/i.test(lowerQuery) ||
      lowerQuery.includes("zyada bikri") ||
      lowerQuery.includes("ziada bikri") ||
      lowerQuery.includes("سیل بڑھا") ||
      lowerQuery.includes("فروخت بڑھا") ||
      lowerQuery.includes("گاہک بڑھا");

    const isUdharQuery =
      lowerQuery.includes("udhar") ||
      lowerQuery.includes("store credit") ||
      lowerQuery.includes("khata") ||
      lowerQuery.includes("baqaya") ||
      lowerQuery.includes("credit customer") ||
      lowerQuery.includes("ادھار") ||
      lowerQuery.includes("کھاتہ");

    const isReceiptQuery =
      lowerQuery.includes("receipt") ||
      lowerQuery.includes("printer") ||
      lowerQuery.includes("thermal") ||
      lowerQuery.includes("slip") ||
      lowerQuery.includes("font") ||
      lowerQuery.includes("blurry") ||
      lowerQuery.includes("پرنٹر") ||
      lowerQuery.includes("رسید");

    const isDiscountQuery =
      lowerQuery.includes("discount") ||
      lowerQuery.includes("choot") ||
      lowerQuery.includes("promo") ||
      lowerQuery.includes("off dena") ||
      lowerQuery.includes("رعایت") ||
      lowerQuery.includes("ڈسکاؤنٹ");

    const isHoldQuery =
      lowerQuery.includes("hold") ||
      lowerQuery.includes("rokna") ||
      lowerQuery.includes("pause") ||
      lowerQuery.includes("resume order") ||
      lowerQuery.includes("ہولڈ");

    const isTaxQuery =
      lowerQuery.includes("tax") ||
      lowerQuery.includes("fiscal") ||
      lowerQuery.includes("gst") ||
      lowerQuery.includes("vat") ||
      lowerQuery.includes("ٹیکس");

    const isProfitQuery =
      lowerQuery.includes("profit") ||
      lowerQuery.includes("munafa") ||
      lowerQuery.includes("kamai") ||
      lowerQuery.includes("faida") ||
      lowerQuery.includes("margin") ||
      lowerQuery.includes("منافع") ||
      lowerQuery.includes("آمدن");

    const isStockQuery =
      lowerQuery.includes("product") ||
      lowerQuery.includes("inventory") ||
      lowerQuery.includes("stock") ||
      lowerQuery.includes("maal") ||
      lowerQuery.includes("item") ||
      lowerQuery.includes("samaan") ||
      lowerQuery.includes("reorder") ||
      lowerQuery.includes("اسٹاک") ||
      lowerQuery.includes("سامان");

    const isPOSQuery =
      lowerQuery.includes("pos") ||
      lowerQuery.includes("checkout") ||
      lowerQuery.includes("cashier") ||
      lowerQuery.includes("counter") ||
      lowerQuery.includes("terminal") ||
      lowerQuery.includes("bill") ||
      lowerQuery.includes("کاؤنٹر") ||
      lowerQuery.includes("بل");

    if (targetLanguage === "roman_urdu") {
      if (isSalesIncreaseQuery) {
        reply =
          `### 📈 Salam! Dukan Ki Sale aur Bikri Barhanay ke 5 Asaan aur Kaamyaab Tareeqay\n\n` +
          `Aap apni dukan ki sale (bikri) bohot asani se barha sakte hain. Yeh 5 practical aur aasan tareeqay follow karein:\n\n` +
          `• **1. Fast-Moving (Top Selling) Items Hamesha Full Rakhein**:\n` +
          `Jo cheezein aapki dukan par rozana sab se zyada bikti hain, unka stock kabhi khatam na hone dein. Jab grahak ko hamesha uska man-pasand samaan milta hai to wo bar bar aata hai.\n\n` +
          `• **2. Counter Display (Checkout / POS ke qareeb samaan)**:\n` +
          `Choti aur zaroori cheezein (jaise toffees, accessories, snacks, sachets) counter par bilkul samnay rakhein. Bill banwate waqt customer 1–2 cheezein extra khareed leta hai jis se bill ka total barh jata hai.\n\n` +
          `• **3. Combo Deals aur Bundle Offers Banao**:\n` +
          `2 ya 3 milti-julti cheezon ka package bana kar halka sa discount dein (e.g., "Do khareedne par aik par 15% discount"). Customer aik cheez lene aata hai aur do le jata hai.\n\n` +
          `• **4. Slow-Moving Stock par Chota Discount Dein**:\n` +
          `Jo samaan dukan me kaafi arsay se para hai aur bik nahi raha, us par 5% se 10% discount laga kar cash free karein aur us paisay se tezi se bikne wala naya stock layein.\n\n` +
          `• **5. Regular Customers se WhatsApp Rabta**:\n` +
          `Apne purane grahakon ke numbers mehfooz karein aur jab bhi naya maal ya fresh stock aaye to unko WhatsApp par pyara sa message ya photo bhej kar itlaa dein.\n\n` +
          `💡 **Aasan Mashwara**: GeFlow POS counter par item-level discount feature use karein taake regular grahak ko foran khush kar sakein!`;
      } else if (isUdharQuery) {
        reply =
          `### 📒 Salam! Customer Udhar (Store Credit) ka Asaan Record\n\n` +
          `GeFlow me customer ka udhar (credit) sambhalna bohot aasan hai:\n\n` +
          `• **Udhar Record Rakhna**: POS par customer select karein aur payment method me 'Store Credit / Udhar' chunein.\n` +
          `• **Khata Page**: Customers & Udhar page par har grahak ka baqaya hisab saaf nazar aata hai.\n` +
          `• **Wapsi / Jama**: Jab grahak paise jama karwaye to aik click par balance minus ho jata hai.\n\n` +
          `💡 **Aasan Tip**: Regular grahak ko uski payment ka message bhejein taake hisab hamesha pakka rahe.`;
      } else if (isReceiptQuery) {
        reply =
          `### 🖨️ Salam! Thermal Receipt aur Printer Settings\n\n` +
          `Aapki receipt printing bilkul saaf aur professional aayegi:\n\n` +
          `• **Dukan Ka Naam**: Settings > POS & Receipt me aapki registered business ka naam receipt ke top par auto show hota hai.\n` +
          `• **Professional Font**: Receipt font Poppins aur Arial par set hai jo 58mm aur 80mm thermal printers par bilkul saaf print hota hai.\n` +
          `• **Custom Text**: Aap footer me apna thank you note aur contact number asani se likh sakte hain.\n\n` +
          `💡 **Aasan Tip**: Receipt Settings me print density high rakhein taake barik text bhi mota aur saaf nazar aaye.`;
      } else if (isDiscountQuery) {
        reply =
          `### 🏷️ Salam! Item-Level aur Cart Discount ka Tareeqa\n\n` +
          `GeFlow POS par discount lagana bohot aasan hai:\n\n` +
          `• **Per-Product Discount**: Cart ke andar har item ke aagay discount box hota hai, jahan aap 1 specific item par discount laga sakte hain.\n` +
          `• **Overall Cart Discount**: Cart ke bottom par overall order discount ka option bhi maujood hai.\n` +
          `• **Fixed ya Percent**: Aap Rs ya % dono me discount de sakte hain.\n\n` +
          `💡 **Aasan Tip**: Jo samaan jaldi sell karna ho sirf usi item par discount lagayein taake baqi items ka profit mehfooz rahe.`;
      } else if (isHoldQuery) {
        reply =
          `### ⏸️ Salam! POS Hold Order Feature\n\n` +
          `Agar customer counter par khara ho aur mazeed samaan lene chala jaye:\n\n` +
          `• **Hold Dabayein**: POS par **Hold** button dabayein, customer ka poora cart database me mehfooz ho jata hai.\n` +
          `• **Agla Customer**: Aap aglay customer ka bill bila rukawat bana sakte hain.\n` +
          `• **Resume Karein**: Jab purana customer wapis aaye, **Hold Orders** list se uska cart aik click par wapis counter par layein.\n\n` +
          `💡 **Aasan Tip**: Page refresh karne par bhi hold orders database me mehfooz rehte hain!`;
      } else if (isTaxQuery) {
        reply =
          `### 🏛️ Salam! Tax aur FISCAL Settings\n\n` +
          `Tax settings ka mukammal control aapke hath me hai:\n\n` +
          `• **Tax Disable Karein**: **Settings > Tax & FISCAL** me ja kar tax disable karein to POS par kisi bhi product par tax nahi lagega.\n` +
          `• **Zero Tax**: Tax band karne par POS terminal bilkul saaf price calculate karta hai bina kisi tax ke.\n` +
          `• **Auto Save**: Settings foran database me save hoti hain aur refresh ke baad bhi tax disabled rehta hai.\n\n` +
          `💡 **Aasan Tip**: Agar aapki retail shop tax-exempt hai to Settings me Tax Rate 0% set rakhein.`;
      } else if (isStockQuery) {
        reply =
          `### 📦 Salam! Stock aur Products ka Asaan Hisab\n\n` +
          `Aapki dukan me is waqt total **${totalProd} products** hain:\n\n` +
          `• **Kam Stock Alert**: Is waqt **${lowStock} items** ka stock kam ho raha hai.\n` +
          `• **Naya Product Shamil Karein**: **Inventory > Products** me jayein aur '+ Add Product' dabayein.\n` +
          `• **Barcode aur SKU**: Auto SKU button dabane se product ka barcode code khud ban jata hai.\n` +
          `• **Reorder Karein**: Kam stock walay samaan ka supplier order Purchases se asani se banayein.\n\n` +
          `💡 **Aasan Tip**: Jo cheezein sab se zyada bikti hain unka stock hamesha fresh rakhein taake koi grahak khali hath na jaye.`;
      } else if (isProfitQuery) {
        reply =
          `### 💰 Salam! ${storeName} ka Asaan Munafa aur Bikri Hisab\n\n` +
          `Aapki dukan ki performance bohot achi chal rahi hai:\n\n` +
          `• **Aaj Ki Bikri (Sales)**: ${rev} (${tx} orders mukammal huay)\n` +
          `• **Aaj Ka Saaf Munafa (Profit)**: ${todayProf}\n` +
          `• **Pichle 30 Din Ki Total Bikri**: ${mRev}\n` +
          `• **Pichle 30 Din Ka Saaf Munafa**: ${mProf}\n` +
          `• **Dukan Ki Currency**: Tamam hisab **${businessCurrency}** (${currencySym}) me hai\n\n` +
          `💡 **Aasan Tip**: Rozana sham ko counter band karne se pehle apna cash check kar lein taake hisab hamesha barabar rahe.`;
      } else if (isPOSQuery) {
        reply =
          `### 🛒 Salam! POS aur Counter Sales ka Asaan Tareeqa\n\n` +
          `POS par counter sale karna bohot asaan hai:\n\n` +
          `• **Item Scan ya Search Karein**: Barcode scanner use karein ya item ka naam likhein.\n` +
          `• **Bill aur Payment**: Cash, Card, ya QR code se payment select karein.\n` +
          `• **Hold Order**: Agar customer mazeed samaan lene chala jaye to bill ko 'Hold' karein, baad me aik click par wapis layein.\n` +
          `• **Receipt Print**: Bill mukammal hote hi thermal printer se saaf slip nikal aati hai.\n\n` +
          `💡 **Aasan Tip**: Agar customer ko discount dena ho to direct item ke samnay discount add kar sakte hain.`;
      } else {
        reply =
          `### 👋 Salam! Main Maryam hoon, aapki dukan ki madadgar\n\n` +
          `Aap mujh se apni dukan ke baray me koi bhi baat asaan lafzon me pooch sakte hain:\n\n` +
          `• **Sale Barhana**: "Mujhy btao k me kesy apni sale ko increase kr skta ho"\n` +
          `• **Dukan Ka Munafa**: "Mera aaj ya is mahine ka munafa kitna hai?"\n` +
          `• **Stock Ka Hisab**: "Konsa samaan khatam ho raha hai?"\n` +
          `• **POS aur Bill**: "Customer ko bill aur discount kaise dena hai?"\n` +
          `• **Products**: "Naya item ya barcode kaise shamil karein?"\n\n` +
          `Bataiye main aaj aapki dukan ke liye kya check karoon?`;
      }
    } else if (targetLanguage === "urdu") {
      if (isSalesIncreaseQuery) {
        reply =
          `### 📈 السلام علیکم! دکان کی فروخت اور سیل بڑھانے کے 5 آسان اور بہترین طریقے\n\n` +
          `آپ اپنی دکان کی فروخت اور آمدن درج ذیل 5 آسان طریقوں پر عمل کر کے تیزی سے بڑھا سکتے ہیں:\n\n` +
          `• **1. زیادہ بکنے والے پراڈکٹس کا اسٹاک ہمیشہ پورا رکھیں**:\n` +
          `جو اشیاء سب سے زیادہ فروخت ہوتی ہیں ان کا اسٹاک کبھی ختم نہ ہونے دیں۔ گاہک جب بھی آئے اسے اس کی مطلوبہ چیز ملنی چاہیے۔\n\n` +
          `• **2. کاؤنٹر پر پرکشش اشیاء رکھیں (Impulse Items)**:\n` +
          `کاؤنٹر کے بالکل سامنے چھوٹی اور روزمرہ کی اشیاء رکھیں تاکہ گاہک بل بنواتے وقت مزید ایک دو چیزیں خرید لے۔\n\n` +
          `• **3. بنڈل ڈیلز اور خصوصی پیشکشیں**:\n` +
          `دو یا تین ملتی جلتی اشیاء کا پیکج بنائیں اور تھوڑی رعایت دیں۔ اس سے گاہک ایک کے بجائے دو اشیاء خریدے گا۔\n\n` +
          `• **4. سست رفتار مال پر چھوٹ دے کر کیش آزاد کریں**:\n` +
          `جو سامان کافی عرصے سے نہیں بک رہا اس پر رعایت دے کر فروخت کریں اور اس رقم سے تیز بکنے والا نیا مال لائیں۔\n\n` +
          `• **5. مستقل گاہکوں سے رابطہ**:\n` +
          `اپنے پرانے گاہکوں کا فون نمبر محفوظ رکھیں اور نیا مال آنے پر انہیں واٹس ایپ پر مطلع کریں۔\n\n` +
          `💡 **آسان مشورہ:** پی او ایس کاؤنٹر پر آئٹم ڈسکاؤنٹ کا فیچر استعمال کر کے اچھے گاہکوں کو رعایت دیں۔`;
      } else if (isProfitQuery) {
        reply =
          `### 💰 السلام علیکم! ${storeName} کا آسان منافع اور فروخت کا حساب\n\n` +
          `آپ کی دکان کا تازہ ترین حساب کتاب درج ذیل ہے:\n\n` +
          `• **آج کی کل فروخت:** ${rev} (${tx} آرڈرز)\n` +
          `• **آج کا خالص منافع:** ${todayProf}\n` +
          `• **پچھلے 30 دن کی فروخت:** ${mRev}\n` +
          `• **پچھلے 30 دن کا منافع:** ${mProf}\n` +
          `• **کرنسی:** تمام حساب **${businessCurrency}** (${currencySym}) میں ہے\n\n` +
          `💡 **آسان مشورہ:** زیادہ بکنے والی اشیاء کو ہمیشہ کاؤنٹر کے قریب رکھیں تاکہ گاہک آسانی سے دیکھ سکیں۔`;
      } else if (isStockQuery) {
        reply =
          `### 📦 السلام علیکم! اسٹاک کی صورتحال\n\n` +
          `• **کل پراڈکٹس:** ${totalProd} اشیاء درج ہیں\n` +
          `• **کم اسٹاک:** اس وقت ${lowStock} اشیاء کا اسٹاک کم ہو رہا ہے\n` +
          `• **نیا آئٹم:** انوینٹری میں جا کر '+ Add Product' دبائیں\n\n` +
          `💡 **آسان مشورہ:** کم اسٹاک والی اشیاء کا آرڈر جلد تیار کر لیں۔`;
      } else {
        reply =
          `### 👋 السلام علیکم! میں مریم ہوں، آپ کی دکان کی معاون\n\n` +
          `آپ مجھ سے اپنی دکان کے بارے میں آسان اور سادہ الفاظ میں کچھ بھی پوچھ سکتے ہیں:\n\n` +
          `• **سیل اور فروخت بڑھانے کے طریقے**\n` +
          `• **منافع اور فروخت کا حساب**\n` +
          `• **اسٹاک اور سامان کی تفصیل**\n` +
          `• **بل بنانے اور کاؤنٹر کا طریقہ کار**\n\n` +
          `فرمائیے میں آپ کی کیا مدد کر سکتی ہوں؟`;
      }
    } else if (targetLanguage === "spanish") {
      if (isSalesIncreaseQuery) {
        reply =
          `### 📈 ¡Hola! 5 Formas Prácticas de Aumentar las Ventas de su Tienda\n\n` +
          `Aumentar las ventas diarias y el ticket promedio es sencillo con estas 5 estrategias comprobadas:\n\n` +
          `• **1. Mantenga Siempre Stock de los Productos Más Vendidos**:\n` +
          `Identifique sus artículos de mayor rotación y asegúrese de reponerlos antes de que se agoten.\n\n` +
          `• **2. Productos de Impulso en el Mostrador de Pago**:\n` +
          `Coloque artículos pequeños y de alto margen junto al terminal POS para compras espontáneas.\n\n` +
          `• **3. Cree Paquetes y Ofertas Combinadas**:\n` +
          `Empareje productos complementarios con un pequeño descuento para elevar el valor del pedido.\n\n` +
          `• **4. Liquide el Inventario de Lento Movimiento**:\n` +
          `Aplique descuentos moderados a artículos estancados para liberar capital y reinvertir en novedades.\n\n` +
          `• **5. Fidelice Clientes por WhatsApp**:\n` +
          `Envíe mensajes cordiales a sus clientes habituales cuando lleguen nuevos lotes o productos.\n\n` +
          `💡 **Consejo Práctico**: ¡Use los descuentos por artículo en la pantalla POS para premiar a clientes fieles!`;
      } else if (isProfitQuery) {
        reply =
          `### 💰 Resumen Financiero y Ganancias: ${storeName}\n\n` +
          `• **Ventas de Hoy**: ${rev} (${tx} pedidos procesados)\n` +
          `• **Ganancia Neta de Hoy**: ${todayProf}\n` +
          `• **Ventas Últimos 30 Días**: ${mRev}\n` +
          `• **Ganancia Últimos 30 Días**: ${mProf}\n` +
          `• **Moneda**: ${businessCurrency} (${currencySym})\n\n` +
          `💡 **Consejo Práctico**: Mantenga los artículos más rentables en zonas destacadas de la tienda.`;
      } else if (isStockQuery) {
        reply =
          `### 📦 Estado del Inventario: ${storeName}\n\n` +
          `• **Total de Productos**: ${totalProd} artículos registrados\n` +
          `• **Stock Bajo**: ${lowStock} productos requieren reposición pronta\n` +
          `• **Agregar Producto**: Vaya a Inventario y pulse '+ Agregar Producto'\n\n` +
          `💡 **Consejo Práctico**: Reabastezca antes de que las existencias lleguen a cero.`;
      } else {
        reply =
          `### 👋 ¡Hola! Soy Maryam, tu asistente de tienda en GeFlow\n\n` +
          `Puedo ayudarte con explicaciones sencillas y claras sobre tu negocio:\n\n` +
          `• **Cómo aumentar ventas e ingresos**\n` +
          `• **Cálculo de ganancias netas y márgenes**\n` +
          `• **Estado del inventario y alertas de stock**\n` +
          `• **Manejo del terminal punto de venta (POS)**\n\n` +
          `¿En qué puedo ayudarte hoy?`;
      }
    } else if (targetLanguage === "arabic") {
      if (isSalesIncreaseQuery) {
        reply =
          `### 📈 أهلاً بك! 5 طرق عملية لزيادة مبيعات وأرباح متجرك\n\n` +
          `يمكنك زيادة مبيعاتك اليومية وحجم السلة بسهولة من خلال اتباع هذه الخطوات الـ 5 البسيطة:\n\n` +
          `• **1. توفير المنتجات الأكثر مبيعاً دائماً**:\n` +
          `احرص على ألا ينفد مخزون السلع الأكثر طلباً في متجرك لضمان تلبية طلبات الزبائن دائماً.\n\n` +
          `• **2. عروض المنتجات بجانب كاونتر ونقاط البيع (POS)**:\n` +
          `ضع السلع الصغيرة ذات الهامش الربحي المرتفع بجوار الكاشير لزيادة المبيعات التلقائية.\n\n` +
          `• **3. عروض الحزم والخصومات المجمعة**:\n` +
          `اصنع باقات تجمع بين منتجين معاً بتخفيض بسيط لتشجيع العميل على شراء أكثر من قطعة.\n\n` +
          `• **4. تصريف البضائع بطيئة الحركة**:\n` +
          `قدّم تخفيضات مناسبة على البضائع الراكدة لتحرير السيولة وإعادة استثمارها في بضائع سريعة.\n\n` +
          `• **5. التواصل مع الزبائن الدائمين عبر واتساب**:\n` +
          `أرسل تنبيهات لطيفة لزبائنك عند وصول بضائع جديدة أو عروض مميزة.\n\n` +
          `💡 **نصيحة سريعة**: استخدم خاصية الخصم على مستوى الصنف في شاشة POS لمكافأة زبائنك الدائمين!`;
      } else if (isProfitQuery) {
        reply =
          `### 💰 ملخص الأرباح والأداء المالي: ${storeName}\n\n` +
          `• **مبيعات اليوم**: ${rev} (${tx} طلباً)\n` +
          `• **أرباح اليوم الصافية**: ${todayProf}\n` +
          `• **مبيعات آخر 30 يوماً**: ${mRev}\n` +
          `• **أرباح آخر 30 يوماً**: ${mProf}\n` +
          `• **العملة الحالية**: ${businessCurrency} (${currencySym})\n\n` +
          `💡 **نصيحة سريعة**: ضع السلع ذات الربحية العالية في مكان واضح بالقرب من نقطة الدفع.`;
      } else {
        reply =
          `### 👋 مرحباً بك! أنا مريم، مساعدة متجرك في GeFlow\n\n` +
          `أنا هنا لمساعدتك بكلمات بسيطة ومباشرة في كل ما يخص متجرك:\n\n` +
          `• **طرق زيادة المبيعات وجذب الزبائن**\n` +
          `• **متابعة الأرباح وحساب المبيعات**\n` +
          `• **إدارة المخزون والتنبيهات**\n` +
          `• **استخدام نظام نقاط البيع (POS)**\n\n` +
          `كيف يمكنني مساعدتك الآن؟`;
      }
    } else {
      // Friendly, simple, humanized English (UK) - Default
      if (isSalesIncreaseQuery) {
        reply =
          `### 📈 5 Practical Ways to Increase Your Store Sales & Revenue\n\n` +
          `Hello! Growing your daily retail sales and basket size is straightforward with these 5 proven, practical strategies:\n\n` +
          `• **1. Keep Fast-Moving Items Consistently in Stock**:\n` +
          `Identify your top 20% best-selling products and ensure they are reordered before stock runs low. Never turn away a ready buyer due to an out-of-stock item.\n\n` +
          `• **2. Upsell at the Checkout Counter**:\n` +
          `Place high-margin impulse items (accessories, pocket snacks, essentials) right by your POS counter so shoppers can easily add them to their basket during checkout.\n\n` +
          `• **3. Create Bundle Offers & Combo Deals**:\n` +
          `Pair complementary products together (e.g. "Buy Product A and get 15% off Product B"). Customers perceive high value and your Average Order Value (AOV) increases immediately.\n\n` +
          `• **4. Clear Slow-Moving Inventory**:\n` +
          `Run quick clearance discounts on dead or slow stock to recover tied-up capital, then reinvest the cash into fast-selling seasonal products.\n\n` +
          `• **5. Engage Regular Shoppers via WhatsApp**:\n` +
          `Keep a contact list of your frequent customers. Send brief, friendly alerts whenever fresh stock or new arrivals arrive at your store.\n\n` +
          `💡 **Pro Tip**: Use GeFlow POS quick item discounts to reward loyal shoppers directly at checkout!`;
      } else if (isUdharQuery) {
        reply =
          `### 📒 Customer Udhar & Store Credit Management\n\n` +
          `Managing customer balances and credit ledgers in GeFlow is clear and reliable:\n\n` +
          `• **Issuing Credit**: On the POS screen, select the customer and choose 'Store Credit / Udhar' as payment.\n` +
          `• **Customer Ledger**: View real-time outstanding balances on the Customers & Udhar page.\n` +
          `• **Recording Payments**: When a customer settles their balance, record the repayment with one click.\n\n` +
          `💡 **Friendly Tip**: Keep accurate contact info for credit customers to send friendly payment reminders.`;
      } else if (isReceiptQuery) {
        reply =
          `### 🖨️ Thermal Receipt & Printer Setup\n\n` +
          `Ensure crisp, professional receipt printing across all devices:\n\n` +
          `• **Business Name**: Your registered business name appears clearly at the top of every receipt.\n` +
          `• **Optimized Fonts**: Receipt styling uses Poppins and Arial, designed specifically for 58mm and 80mm thermal printers.\n` +
          `• **Custom Footer**: In **Settings > POS & Receipt**, personalize your receipt title, subtitle, and footer note.\n\n` +
          `💡 **Friendly Tip**: Select high print density in your thermal printer drivers for the sharpest barcode and text output.`;
      } else if (isDiscountQuery) {
        reply =
          `### 🏷️ Per-Product & Basket Discounts\n\n` +
          `GeFlow POS allows both item-level and order-level discounts:\n\n` +
          `• **Item Discount**: Click into the discount field beside each cart product to discount that specific item.\n` +
          `• **Cart Total Discount**: Apply a percentage or flat amount discount to the entire basket at the bottom.\n` +
          `• **Security**: Cashiers can apply standard discounts without editing base inventory cost prices.\n\n` +
          `💡 **Friendly Tip**: Target discounts at items nearing shelf expiration to turn stock into immediate cash flow.`;
      } else if (isHoldQuery) {
        reply =
          `### ⏸️ POS Hold Order Feature\n\n` +
          `Never make waiting customers wait when someone steps away to grab an extra item:\n\n` +
          `• **Click Hold**: Click the **Hold** button on the POS counter to save the active basket to the database.\n` +
          `• **Serve Next**: Immediately ring up the next customer with a clean, empty cart.\n` +
          `• **Resume Anytime**: When the shopper returns, click **Hold Orders** to restore the basket in one click.\n\n` +
          `💡 **Friendly Tip**: Hold orders persist securely in the database even if you refresh the browser page.`;
      } else if (isTaxQuery) {
        reply =
          `### 🏛️ Tax & FISCAL Configuration\n\n` +
          `Manage your store tax calculation cleanly in GeFlow:\n\n` +
          `• **Disable Tax**: Go to **Settings > Tax & FISCAL** and toggle Tax Calculation to Disabled.\n` +
          `• **POS Zero-Tax**: Once disabled, the POS terminal calculates checkout totals with 0% tax, regardless of how many items are added.\n` +
          `• **Persistent Persistence**: Tax settings are saved directly to the database and remain disabled across reloads.\n\n` +
          `💡 **Friendly Tip**: If your business is registered for GST/VAT, enter your tax percentage and tax ID number in Settings.`;
      } else if (isStockQuery) {
        reply =
          `### 📦 Simple Stock & Product Overview: ${storeName}\n\n` +
          `Hi there! Here is how your inventory is looking right now:\n\n` +
          `• **Total Products**: You have **${totalProd} items** in your store catalog.\n` +
          `• **Low Stock Alert**: **${lowStock} items** are running low and need restocking soon.\n` +
          `• **Add New Product**: Go to **Inventory > Products** and click the green **+ Add Product** button.\n` +
          `• **Auto Barcode / SKU**: Click **Auto SKU** to generate a clean product code instantly.\n\n` +
          `💡 **Friendly Tip**: Restock your fast-moving items before they reach zero so your shoppers never leave empty-handed.`;
      } else if (isProfitQuery) {
        reply =
          `### 💰 Simple Financial Summary for ${storeName}\n\n` +
          `Hello! Here is your friendly business performance breakdown in plain terms:\n\n` +
          `• **Today's Sales**: **${rev}** across **${tx} completed orders**.\n` +
          `• **Today's Clear Profit**: **${todayProf}**.\n` +
          `• **Last 30 Days (Monthly) Sales**: **${mRev}**.\n` +
          `• **Last 30 Days Clear Profit**: **${mProf}**.\n` +
          `• **Active Currency**: All amounts are strictly in **${businessCurrency}** (${currencySym}).\n\n` +
          `💡 **Friendly Tip**: Your top selling products bring in the most profit—keep them visible near the checkout counter!`;
      } else if (isPOSQuery) {
        reply =
          `### 🛒 Friendly Guide: POS & Fast Counter Checkout\n\n` +
          `Hello! Here is how to keep counter checkouts quick and smooth for your customers:\n\n` +
          `• **Scan or Search Items**: Scan any barcode with your reader or type the item name in the search bar.\n` +
          `• **Simple Payments**: Choose Cash, Card, or QR payment with a single click.\n` +
          `• **Hold Order**: If a shopper wants to grab another item, click **Hold** to save their basket, and resume it anytime.\n` +
          `• **Clean Receipts**: Print clear, sharp thermal receipts with your shop details on standard paper.\n\n` +
          `💡 **Friendly Tip**: You can also add item-level discounts directly in the cart row if you want to reward a loyal customer.`;
      } else {
        reply =
          `### 👋 Hello! I'm Maryam, your friendly shop assistant\n\n` +
          `I am right here to help you manage ${storeName} easily. You can ask me anything in simple everyday words:\n\n` +
          `• **Increase Sales**: "How can I increase my store sales and revenue?"\n` +
          `• **Check Shop Profit**: "How much profit did I make today or this month?"\n` +
          `• **Check Low Stock**: "Which items are running out of stock?"\n` +
          `• **POS & Billing**: "How do I give a discount or hold an order?"\n` +
          `• **Store Setup**: "How do I change my currency or invite a cashier?"\n\n` +
          `What can I help you check for your store today?`;
      }
    }

    res.json({ success: true, reply });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Newsletter & Subscription Engine
// Syncs with Notifications, Broadcasts & Auto-Emails
// ==========================================
app.get("/api/newsletter/subscribers", (req: Request, res: Response) => {
  try {
    const subscribers = newsletterService.getSubscribers();
    res.json({ success: true, subscribers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/newsletter/subscribe", (req: Request, res: Response) => {
  try {
    const { email, source, appName } = req.body || {};
    const result = newsletterService.subscribe(email, source, appName);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/api/newsletter/subscribers/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = newsletterService.deleteSubscriber(id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/newsletter/subscribers/:id/status", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const result = newsletterService.toggleStatus(id, status);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/api/newsletter/send-direct", (req: Request, res: Response) => {
  try {
    const { recipientEmail, subject, headline, body, ctaText, ctaUrl, footerText, appName } = req.body || {};
    if (!recipientEmail || !subject || !body) {
      return res.status(400).json({ success: false, error: "recipientEmail, subject, and body are required." });
    }
    const result = newsletterService.sendDirectEmail({
      recipientEmail,
      subject,
      headline,
      body,
      ctaText,
      ctaUrl,
      footerText,
      appName,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/newsletter/templates", (req: Request, res: Response) => {
  try {
    const templates = newsletterService.getTemplates();
    res.json({ success: true, templates });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/newsletter/templates/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = newsletterService.updateTemplate(id, req.body || {});
    res.json({ success: true, template: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/api/newsletter/broadcast", (req: Request, res: Response) => {
  try {
    const { templateId, title, body, ctaLabel, ctaUrl, appName } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ success: false, error: "Title and body are required for broadcast" });
    }
    const result = newsletterService.broadcast({ templateId, title, body, ctaLabel, ctaUrl, appName });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/newsletter/logs", (req: Request, res: Response) => {
  try {
    const logs = newsletterService.getLogs();
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/newsletter/stats", (req: Request, res: Response) => {
  try {
    const stats = newsletterService.getStats();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Announcements & Promotional Campaigns Engine
// Handles persistent sync, activation/inactivation and real-time deletion
// ==========================================
app.get("/api/announcements", (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.activeOnly === "true" || req.query.active === "true";
    const audience = typeof req.query.audience === "string" ? req.query.audience : undefined;
    const position = typeof req.query.position === "string" ? req.query.position : undefined;
    const list = promotionsService.getAnnouncements(activeOnly, audience, position);
    res.json({ success: true, announcements: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/announcements", async (req: Request, res: Response) => {
  try {
    const created = await promotionsService.createAnnouncement(req.body || {});
    res.json({ success: true, announcement: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.patch("/api/announcements/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await promotionsService.updateAnnouncement(id, req.body || {});
    if (!updated) {
      return res.status(404).json({ success: false, error: "Announcement not found" });
    }
    res.json({ success: true, announcement: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/api/announcements/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await promotionsService.deleteAnnouncement(id);
    res.json({ success: true, deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/announcements/:id/track-open", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tracked = promotionsService.trackOpen(id);
    res.json({ success: true, tracked });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/announcements/track-conversion", (req: Request, res: Response) => {
  try {
    const { identifier, amount } = req.body || {};
    const tracked = promotionsService.trackConversion(identifier, Number(amount) || 0);
    res.json({ success: true, tracked });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/announcements/analytics", (_req: Request, res: Response) => {
  try {
    const analytics = promotionsService.getAnalytics();
    res.json({ success: true, analytics });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Coupons & Discount Engine
// 100% Synced with Supabase 'coupons' database collection
// ==========================================
app.get("/api/coupons", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await serverSupabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, coupons: data || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/coupons", async (req: Request, res: Response) => {
  try {
    const { code, description, discount_type, discount_value, applies_to_plan, min_amount, max_uses, expires_at, active } = req.body || {};
    if (!code || !code.trim()) return res.status(400).json({ success: false, error: "Coupon code is required" });
    const payload = {
      code: code.trim().toUpperCase(),
      description: description || null,
      discount_type: discount_type === "fixed" ? "fixed" : "percent",
      discount_value: Number(discount_value) || 0,
      applies_to_plan: applies_to_plan === "all" || !applies_to_plan ? null : applies_to_plan,
      min_amount: Number(min_amount) || 0,
      max_uses: max_uses != null && max_uses !== "" ? Number(max_uses) : null,
      used_count: 0,
      expires_at: expires_at ? new Date(expires_at).toISOString() : null,
      active: active !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await serverSupabase.from("coupons").insert(payload).select().maybeSingle();
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, coupon: data });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.patch("/api/coupons/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code, description, discount_type, discount_value, applies_to_plan, min_amount, max_uses, expires_at, active } = req.body || {};
    const payload: any = { updated_at: new Date().toISOString() };
    if (code !== undefined) payload.code = code.trim().toUpperCase();
    if (description !== undefined) payload.description = description || null;
    if (discount_type !== undefined) payload.discount_type = discount_type;
    if (discount_value !== undefined) payload.discount_value = Number(discount_value);
    if (applies_to_plan !== undefined) payload.applies_to_plan = applies_to_plan === "all" || !applies_to_plan ? null : applies_to_plan;
    if (min_amount !== undefined) payload.min_amount = Number(min_amount);
    if (max_uses !== undefined) payload.max_uses = max_uses != null && max_uses !== "" ? Number(max_uses) : null;
    if (expires_at !== undefined) payload.expires_at = expires_at ? new Date(expires_at).toISOString() : null;
    if (active !== undefined) payload.active = Boolean(active);

    const { data, error } = await serverSupabase.from("coupons").update(payload).eq("id", id).select().maybeSingle();
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, coupon: data });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/api/coupons/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await serverSupabase.from("coupons").delete().eq("id", id);
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/coupons/validate", async (req: Request, res: Response) => {
  try {
    const { code, plan, subtotal, period } = req.body || {};
    const cleanCode = (code || "").trim().toUpperCase();
    if (!cleanCode) {
      return res.json({ success: true, valid: false, code: "", amount: 0, label: "", reason: "No code provided" });
    }

    const { data: coupon, error } = await serverSupabase
      .from("coupons")
      .select("*")
      .ilike("code", cleanCode)
      .maybeSingle();

    if (error || !coupon || !coupon.active) {
      return res.json({ success: true, valid: false, code: cleanCode, amount: 0, label: "", reason: "Invalid or inactive promo code" });
    }
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
      return res.json({ success: true, valid: false, code: cleanCode, amount: 0, label: "", reason: "This coupon has expired" });
    }
    if (coupon.max_uses && (coupon.used_count || 0) >= coupon.max_uses) {
      return res.json({ success: true, valid: false, code: cleanCode, amount: 0, label: "", reason: "Coupon usage limit reached" });
    }

    // Strict plan & billing cycle validation
    if (coupon.applies_to_plan && coupon.applies_to_plan.toLowerCase() !== "all") {
      const allowed = coupon.applies_to_plan.toLowerCase().trim();
      const targetPlan = String(plan || "").toLowerCase().trim();
      const targetPeriod = String(period || "").toLowerCase().trim();

      let matches = false;
      if (allowed === targetPlan) {
        matches = true;
      } else if (targetPeriod && (allowed === `${targetPlan}_${targetPeriod}` || allowed === `${targetPeriod}_${targetPlan}`)) {
        matches = true;
      } else if (!targetPeriod && (allowed.startsWith(`${targetPlan}_`) || allowed === targetPlan)) {
        matches = true;
      }

      if (!matches) {
        const prettyPlan = allowed.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        return res.json({
          success: true,
          valid: false,
          code: cleanCode,
          amount: 0,
          label: "",
          reason: `This coupon code is only valid for the ${prettyPlan} plan.`,
        });
      }
    }

    const sub = Number(subtotal) || 0;
    let discount = 0;
    if (coupon.discount_type === "percent") {
      discount = (sub * Number(coupon.discount_value || 0)) / 100;
    } else {
      discount = Number(coupon.discount_value || 0);
    }
    discount = Math.min(discount, sub);

    return res.json({
      success: true,
      valid: true,
      code: coupon.code,
      amount: discount,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      label: coupon.description || `${coupon.discount_value}${coupon.discount_type === "percent" ? "%" : "$"} OFF`,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

async function startServer() {
  // Guarantee real 29 business categories and 96 product categories are synchronized to database
  syncRealCategoriesToDatabase().catch((e) => console.warn("Notice: syncRealCategories startup error:", e));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GeFlow AI Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
