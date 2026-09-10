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

// Get synced data for a business (tailored to role)
app.get("/api/sync/business-data", (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId as string | undefined;
    const role = (req.query.role as string | undefined) || "manager";
    if (!businessId) {
      return res.status(400).json({ success: false, error: "businessId query parameter is required." });
    }
    const data = businessDataSyncService.getBusinessData(businessId, role);
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

app.post("/api/settings/general", (req: Request, res: Response) => {
  try {
    const updated = settingsService.updateAllSettings(req.body || {});
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/settings/general/social-links", (req: Request, res: Response) => {
  try {
    const { links } = req.body || {};
    if (!Array.isArray(links)) {
      return res.status(400).json({ success: false, error: "links must be an array" });
    }
    const updated = settingsService.updateSocialLinks(links);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/settings/general/footer-copyright", (req: Request, res: Response) => {
  try {
    const { copyright } = req.body || {};
    if (!copyright || typeof copyright.text !== "string") {
      return res.status(400).json({ success: false, error: "valid copyright object is required" });
    }
    const updated = settingsService.updateFooterCopyright(copyright);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/settings/general/about-members", (req: Request, res: Response) => {
  try {
    const { members } = req.body || {};
    if (!Array.isArray(members)) {
      return res.status(400).json({ success: false, error: "members must be an array" });
    }
    const updated = settingsService.updateAboutMembers(members);
    res.json({ success: true, settings: updated });
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
// Live sync, plan-specific matching, active/inactive toggling
// ==========================================
app.get("/api/coupons", (req: Request, res: Response) => {
  try {
    const coupons = promotionsService.getCoupons();
    res.json({ success: true, coupons });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/coupons", (req: Request, res: Response) => {
  try {
    const created = promotionsService.createCoupon(req.body || {});
    res.json({ success: true, coupon: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.patch("/api/coupons/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = promotionsService.updateCoupon(id, req.body || {});
    if (!updated) {
      return res.status(404).json({ success: false, error: "Coupon not found" });
    }
    res.json({ success: true, coupon: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/api/coupons/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = promotionsService.deleteCoupon(id);
    res.json({ success: true, deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/coupons/validate", (req: Request, res: Response) => {
  try {
    const { code, plan, subtotal, period } = req.body || {};
    const result = promotionsService.validateCoupon(
      code || "",
      plan || "standard",
      Number(subtotal) || 0,
      period || "monthly"
    );
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
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
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GeFlow AI Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
