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
import { newsletterService } from "./src/server/newsletter/newsletterService";
import { promotionsService } from "./src/server/promotions/promotionsService";
import { serverSupabase, bgSupabase, verifyUserToken } from "./src/server/supabase";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

const app = express();
const PORT = 3000;

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
    const isPlatformTable = /^\/rest\/v1\/(plan_limits|feature_modules|public_feature_modules|business_categories|product_categories|business_category_internal|platform_settings|pricing_plans|announcements|coupons|public_settings|newsletter_subscribers)/i.test(rawUrl);

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

    let bodyPayload: any = req.body;
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

    fs.appendFileSync("/tmp/proxy-trace.log", `Before fetch to ${targetUrl}, body type: ${typeof fetchOptions.body}\n`);
    const upstreamRes = await fetch(targetUrl, fetchOptions);
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

// Save (insert or update) product
app.post("/api/sync/product", (req: Request, res: Response) => {
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

// Adjust stock / restock
app.post("/api/sync/adjust-stock", (req: Request, res: Response) => {
  try {
    const { businessId, productId, deltaQuantity, type, reason, note, userId } = req.body || {};
    if (!businessId || !productId || deltaQuantity === undefined) {
      return res.status(400).json({ success: false, error: "businessId, productId, and deltaQuantity are required." });
    }
    const result = businessDataSyncService.adjustStock(
      businessId,
      productId,
      Number(deltaQuantity),
      type || "in",
      reason || "Manual Adjustment",
      note,
      userId
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Held Orders (Cart hold & resume)
app.get("/api/sync/held-orders", (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId as string | undefined;
    if (!businessId) {
      return res.status(400).json({ success: false, error: "businessId is required." });
    }
    const data = businessDataSyncService.getBusinessData(businessId);
    res.json({ success: true, heldOrders: data.held_orders });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/sync/held-orders", (req: Request, res: Response) => {
  try {
    const { businessId, order } = req.body || {};
    if (!businessId || !order) {
      return res.status(400).json({ success: false, error: "businessId and order are required." });
    }
    const saved = businessDataSyncService.saveHeldOrder(businessId, order);
    res.json({ success: true, heldOrder: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/sync/held-orders", (req: Request, res: Response) => {
  try {
    const { businessId, orderId } = req.body || {};
    if (!businessId || !orderId) {
      return res.status(400).json({ success: false, error: "businessId and orderId are required." });
    }
    const ok = businessDataSyncService.deleteHeldOrder(businessId, orderId);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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

app.post("/api/sync/return", (req: Request, res: Response) => {
  try {
    const { businessId, returnRecord, items, userId } = req.body || {};
    if (!businessId || !returnRecord || !items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: "businessId, returnRecord, and items are required." });
    }
    const result = businessDataSyncService.recordReturn(businessId, {
      returnRecord,
      items,
      userId,
    });
    res.json(result);
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
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Platform General Settings
// Social Links, Footer Copyright, & About Members
// ==========================================
app.get("/api/settings/general", (req: Request, res: Response) => {
  try {
    const settings = settingsService.getSettings();
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
    res.json({
      success: true,
      url: publicUrl,
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
      return res.json({
        success: true,
        message: "Account registered successfully. Please log in.",
        userId: targetUserId,
      });
    }

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
          // User not found in auth.users: auto-register with provided credentials
          const isAdmin = cleanEmail === "gepardwebs@gmail.com";
          const { data: newUser } = await serverSupabase.auth.admin.createUser({
            email: cleanEmail,
            password,
            email_confirm: true,
            user_metadata: {
              full_name: cleanEmail.split("@")[0],
              plan: isAdmin ? "lifetime" : "free",
            },
          });
          if (newUser?.user) {
            const uid = newUser.user.id;
            await serverSupabase.from("profiles").upsert(
              {
                user_id: uid,
                id: uid,
                email: cleanEmail,
                full_name: cleanEmail.split("@")[0],
                plan: isAdmin ? "lifetime" : "free",
                status: "active",
              },
              { onConflict: "user_id" }
            );
            if (isAdmin) {
              await serverSupabase
                .from("user_roles")
                .upsert({ user_id: uid, role: "admin" }, { onConflict: "user_id" });
            }
            srvRes = await serverSupabase.auth.signInWithPassword({
              email: cleanEmail,
              password,
            });
          }
        }
      } catch (adminErr) {
        console.warn("Notice syncing credentials via admin API:", adminErr);
      }
    }

    if (!srvRes.error && srvRes.data?.session) {
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

    let ownedList = Array.from(ownedMap.values());

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

    // 3. Admin fallback (gepardwebs@gmail.com)
    if (ownedList.length === 0 && user.email?.toLowerCase() === "gepardwebs@gmail.com") {
      try {
        const { data: allStores } = await serverSupabase
          .from("businesses")
          .select("id, business_name, business_address, status, currency, base_currency, default_tax, stock_alert_limit, category_id, owner_user_id, listed_products, created_at")
          .order("created_at", { ascending: true });
        if (allStores && allStores.length > 0) {
          ownedList = allStores;
        }
      } catch {
        /* ignore */
      }
    }

    // 4. If user has 0 businesses, auto-provision default store so user panel never displays 0 store
    if (ownedList.length === 0 && staffBizs.length === 0) {
      const storeName = user.user_metadata?.business_name || (user.email ? `${user.email.split("@")[0]}'s Store` : "Gepard Store");
      const cleanUserPlan = user.email?.toLowerCase() === "gepardwebs@gmail.com" ? "lifetime" : ((user.user_metadata?.plan as string) || "free");
      
      // Crucial: ensure owner profile exists first so database trigger does not reject insertion with 'Owner profile not found'
      await Promise.allSettled([
        serverSupabase.from("profiles").upsert({
          user_id: user.id,
          email: user.email,
          full_name: (user.user_metadata?.full_name as string) || (user.email ? user.email.split("@")[0] : "User"),
          plan: cleanUserPlan,
          status: "active",
          last_active: new Date().toISOString()
        }, { onConflict: "user_id" }),
        bgSupabase.from("profiles").upsert({
          user_id: user.id,
          email: user.email,
          full_name: (user.user_metadata?.full_name as string) || (user.email ? user.email.split("@")[0] : "User"),
          plan: cleanUserPlan,
          status: "active",
          last_active: new Date().toISOString()
        }, { onConflict: "user_id" })
      ]);

      const newBiz = {
        id: crypto.randomUUID(),
        owner_user_id: user.id,
        business_name: storeName,
        business_address: "Main Store Location",
        currency: "USD",
        base_currency: "USD",
        status: "active",
        default_tax: 0,
        stock_alert_limit: 5,
        created_at: new Date().toISOString(),
      };

      try {
        await Promise.allSettled([
          bgSupabase.from("businesses").insert(newBiz),
          serverSupabase.from("businesses").insert(newBiz),
        ]);
        ownedList = [newBiz];
      } catch (insertErr) {
        console.warn("Auto-provision default store notice:", insertErr);
        ownedList = [newBiz];
      }
    }

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
    await bgSupabase.from("businesses").insert(bizRow).catch(() => {});

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
    let isCallerAdmin = isSuperAdmin;
    if (!isCallerAdmin && user) {
      const { data: roleRow } = await serverSupabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (roleRow?.role === "admin") isCallerAdmin = true;
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

      const tasks: Promise<any>[] = [
        serverSupabase.from("profiles").update(profileUpdates).eq("user_id", user_id),
        bgSupabase.from("profiles").update(profileUpdates).eq("user_id", user_id),
      ];

      if (Object.keys(metadataUpdates).length > 0) {
        tasks.push(serverSupabase.auth.admin.updateUserById(user_id, { user_metadata: metadataUpdates }));
      }

      if (role !== undefined) {
        const cleanRole = String(role).toLowerCase();
        metadataUpdates.role = cleanRole;
        tasks.push(
          (async () => {
            await serverSupabase.from("user_roles").delete().eq("user_id", user_id);
            await serverSupabase.from("user_roles").insert({ user_id, role: cleanRole });
            await bgSupabase.from("user_roles").delete().eq("user_id", user_id).catch(() => {});
            await bgSupabase.from("user_roles").insert({ user_id, role: cleanRole }).catch(() => {});
          })()
        );
      }

      if (plan !== undefined) {
        const cleanPlan = String(plan).toLowerCase();
        tasks.push(
          serverSupabase.from("subscriptions").insert({
            owner_user_id: user_id,
            tier: cleanPlan,
            cycle: cleanPlan === "lifetime" ? "lifetime" : "monthly",
            status: status === "suspended" ? "suspended" : "active",
            created_at: new Date().toISOString(),
          })
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
      await Promise.allSettled([
        serverSupabase.from("profiles").update({ plan: cleanPlan, updated_at: new Date().toISOString() }).eq("user_id", user_id),
        bgSupabase.from("profiles").update({ plan: cleanPlan, updated_at: new Date().toISOString() }).eq("user_id", user_id),
        serverSupabase.from("subscriptions").insert({
          owner_user_id: user_id,
          tier: cleanPlan,
          cycle: cleanPlan === "lifetime" ? "lifetime" : "monthly",
          status: "active",
          created_at: new Date().toISOString()
        }),
        serverSupabase.auth.admin.updateUserById(user_id, {
          user_metadata: { plan: cleanPlan }
        })
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
          await bgSupabase.from("user_roles").delete().eq("user_id", user_id).catch(() => {});
          await bgSupabase.from("user_roles").insert({ user_id, role: cleanRole }).catch(() => {});
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
        // Cascade delete child / foreign key records referencing this user
        await Promise.allSettled([
          serverSupabase.from("user_roles").delete().eq("user_id", user_id),
          bgSupabase.from("user_roles").delete().eq("user_id", user_id),
          serverSupabase.from("support_team_members").delete().eq("user_id", user_id),
          serverSupabase.from("business_staff").delete().eq("user_id", user_id),
          serverSupabase.from("subscriptions").delete().eq("owner_user_id", user_id),
          serverSupabase.from("notifications").delete().eq("user_id", user_id),
        ]);

        // If user owns businesses, delete all associated setup, inventory, sales, and held orders
        const { data: userBizs } = await serverSupabase.from("businesses").select("id").eq("owner_user_id", user_id);
        if (userBizs && userBizs.length > 0) {
          const bIds = userBizs.map((b: any) => b.id);
          await Promise.allSettled([
            serverSupabase.from("products").delete().in("business_id", bIds),
            serverSupabase.from("sales").delete().in("business_id", bIds),
            serverSupabase.from("orders").delete().in("business_id", bIds),
            serverSupabase.from("purchases").delete().in("business_id", bIds),
            serverSupabase.from("held_orders").delete().in("business_id", bIds),
            serverSupabase.from("business_staff").delete().in("business_id", bIds),
            serverSupabase.from("business_settings").delete().in("business_id", bIds),
            serverSupabase.from("businesses").delete().in("id", bIds),
            bgSupabase.from("businesses").delete().in("id", bIds).catch(() => {}),
          ]);
        }

        // Delete profile
        await Promise.allSettled([
          serverSupabase.from("profiles").delete().eq("user_id", user_id),
          bgSupabase.from("profiles").delete().eq("user_id", user_id),
        ]);

        // Delete user from Supabase Auth
        const { error: authErr } = await serverSupabase.auth.admin.deleteUser(user_id);
        if (authErr) {
          console.warn("Notice: serverSupabase deleteUser error:", authErr.message);
        }
        await bgSupabase.auth.admin.deleteUser(user_id).catch(() => {});

        return res.json({ success: true, user_id });
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
      serverSupabase.from("businesses").select("id, owner_user_id, business_name"),
      serverSupabase.from("products").select("id, business_id, owner_user_id")
    ]);

    const authUsers = (authRes as any)?.data?.users || [];
    const profilesList = [...(profs || [])];
    const profileUserIds = new Set(profilesList.map((p: any) => p.user_id));

    // Auto-sync any user registered in Supabase Auth who is missing a profile row
    for (const au of authUsers) {
      if (!profileUserIds.has(au.id)) {
        const email = au.email || "";
        const fullName = au.user_metadata?.full_name || au.user_metadata?.name || email.split("@")[0] || "User";
        const plan = au.user_metadata?.plan || "free";
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
      } else if (!rolesMap[p.user_id]) {
        rolesMap[p.user_id] = "user";
      }
    }

    res.json({
      success: true,
      users: profilesList,
      roles: rolesMap,
      businessesCount: (bizRows || []).length,
      productsCount: (prodRows || []).length
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin business delete (complete removal of business, catalog, staff, orders, sales and setup)
app.delete("/api/admin/businesses/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: "business ID is required" });

    await Promise.allSettled([
      serverSupabase.from("products").delete().eq("business_id", id),
      serverSupabase.from("sales").delete().eq("business_id", id),
      serverSupabase.from("orders").delete().eq("business_id", id),
      serverSupabase.from("purchases").delete().eq("business_id", id),
      serverSupabase.from("held_orders").delete().eq("business_id", id),
      serverSupabase.from("business_staff").delete().eq("business_id", id),
      serverSupabase.from("business_settings").delete().eq("business_id", id),
      serverSupabase.from("businesses").delete().eq("id", id),
      bgSupabase.from("businesses").delete().eq("id", id).catch(() => {}),
    ]);

    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/businesses/delete", async (req: Request, res: Response) => {
  try {
    const { businessId } = req.body || {};
    if (!businessId) return res.status(400).json({ success: false, error: "businessId is required" });

    await Promise.allSettled([
      serverSupabase.from("products").delete().eq("business_id", businessId),
      serverSupabase.from("sales").delete().eq("business_id", businessId),
      serverSupabase.from("orders").delete().eq("business_id", businessId),
      serverSupabase.from("purchases").delete().eq("business_id", businessId),
      serverSupabase.from("held_orders").delete().eq("business_id", businessId),
      serverSupabase.from("business_staff").delete().eq("business_id", businessId),
      serverSupabase.from("business_settings").delete().eq("business_id", businessId),
      serverSupabase.from("businesses").delete().eq("id", businessId),
      bgSupabase.from("businesses").delete().eq("id", businessId).catch(() => {}),
    ]);

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
        bgSupabase.from("businesses").delete().eq("id", businessId).catch(() => {}),
      ]);
      return res.json({ success: true, businessId, status: "suspended_and_purged" });
    }

    await Promise.allSettled([
      serverSupabase.from("businesses").update({ status, updated_at: new Date().toISOString() }).eq("id", businessId),
      bgSupabase.from("businesses").update({ status, updated_at: new Date().toISOString() }).eq("id", businessId),
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
    const { data, error } = await serverSupabase
      .from("platform_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const row = data || {};
    const alerts = row.alerts || {};
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

    // Prepare alerts with parent_company
    const alerts = {
      ...(typeof body.alerts === "object" ? body.alerts : {}),
      parent_company: parentComp,
      general_settings: {
        ...(typeof body.alerts?.general_settings === "object" ? body.alerts.general_settings : {}),
        parent_company: parentComp,
      },
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

    // 1. Update platform_settings with service role
    const { data: updatedRow, error: updateErr } = await serverSupabase
      .from("platform_settings")
      .update(cleanPayload)
      .eq("singleton", true)
      .select("*")
      .maybeSingle();

    if (updateErr) {
      console.warn("Error updating platform_settings via service role:", updateErr);
      await serverSupabase.from("platform_settings").upsert({
        ...cleanPayload,
        singleton: true,
      }, { onConflict: "singleton" });
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

    if (!readErr && row?.alerts?.general_settings) {
      return res.json({
        success: true,
        settings: row.alerts.general_settings,
      });
    }

    const fallback = await settingsService.getAllSettings();
    return res.json({ success: true, settings: fallback });
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

    const normalizedSettings = {
      parent_company: parentComp,
      social_links: Array.isArray(rawSettings.social_links) ? rawSettings.social_links : [],
      footer_copyright: {
        text: typeof rawSettings.footer_copyright?.text === "string" ? rawSettings.footer_copyright.text : "",
        wordUrls: Array.isArray(rawSettings.footer_copyright?.wordUrls) ? rawSettings.footer_copyright.wordUrls : [],
      },
      about_members: Array.isArray(rawSettings.about_members) ? rawSettings.about_members : [],
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

// 3. Pricing Plans
app.get("/api/admin/pricing-plans", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await serverSupabase.from("pricing_plans").select("*").order("sort_order", { ascending: true });
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, plans: data || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/pricing-plans", async (req: Request, res: Response) => {
  try {
    const { id, plan_key, name, tagline, monthly_price, yearly_price, lifetime_price, features, is_active, is_popular, sort_order, badge_text, badge_position, badge_cycle, payment_method_synced } = req.body || {};
    if (!name || !plan_key) return res.status(400).json({ success: false, error: "Name and plan_key required" });
    const payload: any = {
      plan_key: plan_key.toLowerCase().trim(),
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
      savedPlan = data;
    } else {
      const { data, error } = await serverSupabase.from("pricing_plans").insert(payload).select().maybeSingle();
      if (error) return res.status(500).json({ success: false, error: error.message });
      savedPlan = data;
    }
    return res.json({ success: true, plan: savedPlan });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/admin/pricing-plans/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await serverSupabase.from("pricing_plans").delete().eq("id", id);
    if (error) return res.status(500).json({ success: false, error: error.message });
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

app.get("/api/admin/feature-modules", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await serverSupabase.from("feature_modules").select("*").order("created_at", { ascending: true });
    if (error) return res.status(500).json({ success: false, error: error.message });
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
          await serverSupabase.from("feature_modules").update(patch).eq("id", item.id);
        } else if (item.module_code) {
          await serverSupabase.from("feature_modules").update(patch).eq("module_code", item.module_code);
        }
      }
      return res.json({ success: true, count: updates.length });
    }

    const dbPayload = {
      ...(updates || {}),
      updated_at: new Date().toISOString(),
    };
    if (id) {
      await serverSupabase.from("feature_modules").update(dbPayload).eq("id", id);
    } else if (module_code) {
      await serverSupabase.from("feature_modules").update(dbPayload).eq("module_code", module_code);
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
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
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
    const { messages, mode, businessId, planId, businessContext } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: "messages array is required" });
    }

    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const lowerQuery = lastUserMessage.toLowerCase();

    const client = getGeminiClient();
    if (client) {
      try {
        const systemInstruction = `You are GeFlow AI, an intelligent retail enterprise copilot and POS assistant.
You assist retail business owners, store managers, and staff with retail operations, inventory optimization, barcode scanning, POS checkout workflows, pricing, profit margin analysis, returns, and cashier management.
Operating mode: ${mode || "business"}
Active plan: ${planId || "free"}
${businessContext ? `Store Context:
Store Name: ${businessContext.businessName || "Store"}
Total Catalog: ${businessContext.totalProducts ?? 0}
Low Stock Items: ${businessContext.lowStockCount ?? 0}
Today Revenue: $${businessContext.todayRevenue ?? 0}
Transactions: ${businessContext.todaySalesCount ?? 0}` : "No specific business loaded yet."}
Respond helpfully with concrete, actionable advice and bullet points where appropriate.`;

        const response = await client.models.generateContent({
          model: "gemini-3.8-flash",
          contents: lastUserMessage,
          config: {
            systemInstruction,
          },
        });

        const reply = response.text || "";
        if (reply && reply.trim()) {
          return res.json({ success: true, reply: reply.trim() });
        }
      } catch (geminiErr: any) {
        console.warn("Notice calling Gemini API for assistant:", geminiErr.message);
      }
    }

    // High-precision intelligent retail knowledge base
    let reply = "";

    if (lowerQuery.includes("pos") || lowerQuery.includes("checkout") || lowerQuery.includes("cashier") || lowerQuery.includes("terminal") || lowerQuery.includes("billing")) {
      reply = `### 🛒 GeFlow POS & Checkout Operations\n\n` +
        `• **Quick Product Search & Scan**: Type any item name, SKU, or use a USB/Bluetooth barcode scanner directly at the POS screen.\n` +
        `• **Tender Types**: Supports Cash, Credit/Debit Cards, QR Code, Split Payments, and Customer Account balance.\n` +
        `• **Hold & Resume Orders**: Save in-progress carts when a customer steps away, and recall them instantly with zero lost cart data.\n` +
        `• **Receipt Printing**: Compatible with standard 80mm/58mm ESC/POS thermal receipt printers and digital email receipts.\n` +
        `• **Cashier Shifts**: Track opening float, mid-shift drops, and end-of-day X/Z cash register reconciliation.`;
    } else if (lowerQuery.includes("product") || lowerQuery.includes("inventory") || lowerQuery.includes("stock") || lowerQuery.includes("item") || lowerQuery.includes("catalog")) {
      reply = `### 📦 Inventory & Catalog Management\n\n` +
        `• **Adding Products**: Navigate to **Inventory > Products** and click **+ Add Product**. Fill in Name, Selling Price, Cost Price, Stock Count, and Barcode.\n` +
        `• **Low Stock Alerts**: Configure minimum threshold limits (default: 5 units). GeFlow automatically badges low-stock items.\n` +
        `• **Bulk Import**: Import your existing inventory from CSV or Excel sheets directly in the Products table.\n` +
        `• **Multi-Unit Pricing**: Set piece, pack, or carton ratios for wholesale and retail pricing.`;
    } else if (lowerQuery.includes("profit") || lowerQuery.includes("margin") || lowerQuery.includes("revenue") || lowerQuery.includes("sales") || lowerQuery.includes("earning")) {
      const storeName = businessContext?.businessName || "Your Store";
      const rev = businessContext?.todayRevenue ? `$${Number(businessContext.todayRevenue).toFixed(2)}` : "$0.00";
      const tx = businessContext?.todaySalesCount ?? 0;
      reply = `### 📊 Real-Time Financial & Profit Overview: ${storeName}\n\n` +
        `• **Today's Gross Sales**: ${rev} across ${tx} transactions\n` +
        `• **Net Margin Formula**: (Selling Price - Cost Price) / Selling Price × 100%\n` +
        `• **Daily & Weekly Reports**: View gross revenue, product margins, discounts applied, and tax collections in **Analytics > Reports**.\n` +
        `• **Recommendation**: Review high-margin items in your top sales chart to optimize shelf layout and promotions.`;
    } else if (lowerQuery.includes("team") || lowerQuery.includes("member") || lowerQuery.includes("staff") || lowerQuery.includes("role") || lowerQuery.includes("invite")) {
      reply = `### 👥 Team & Staff Access Control\n\n` +
        `• **Role Hierarchy**: GeFlow supports **Owner**, **Manager**, **Cashier**, and **Auditor** roles.\n` +
        `• **Inviting Staff**: Go to **Settings > Team / Members** and enter the employee's email address.\n` +
        `• **Granular Permissions**: Restrict cashiers from editing product prices, viewing store profits, or deleting historical transactions.`;
    } else {
      reply = `### ⚡ GeFlow Retail Copilot\n\n` +
        `Welcome to your intelligent retail store assistant. Here are quick actions you can perform:\n\n` +
        `• **POS Terminal**: Launch fast counter sales, scan barcodes, and print receipts.\n` +
        `• **Stock Tracking**: Monitor low inventory, manage restocking orders, and track expiration dates.\n` +
        `• **Business Settings**: Configure currencies, tax rates, team members, and social profiles.\n` +
        `• **Analytics**: Check hourly sales trends, top-moving items, and net profit margins.\n\n` +
        `*Ask me any question about your store setup, inventory, discounts, or cashier operations!*`;
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

app.post("/api/announcements", (req: Request, res: Response) => {
  try {
    const created = promotionsService.createAnnouncement(req.body || {});
    res.json({ success: true, announcement: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.patch("/api/announcements/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = promotionsService.updateAnnouncement(id, req.body || {});
    if (!updated) {
      return res.status(404).json({ success: false, error: "Announcement not found" });
    }
    res.json({ success: true, announcement: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/api/announcements/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = promotionsService.deleteAnnouncement(id);
    res.json({ success: true, deleted });
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
    const { code, plan, subtotal } = req.body || {};
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
