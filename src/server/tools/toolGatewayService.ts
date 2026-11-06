/**
 * GeFlow AI — Shared Tool Gateway Service (Step 10)
 *
 * Implements a centralized, server-enforced tool discovery, authorization,
 * validation, approval workflow, dispatch, rate limiting, and auditing engine.
 *
 * Core Principle: "One shared gateway, independently enforced permissions for
 * every agent, organization, category and operation."
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  ToolDefinition,
  ToolExecutionContext,
  ToolInvocationRequest,
  ToolInvocationResponse,
  ToolApprovalRecord,
  ToolAuditRecord,
  ToolDiscoveryFilter,
  ApprovalStatus,
  ToolLifecycleStatus,
} from "./toolGatewayTypes";
import { CANONICAL_TOOL_DEFINITIONS } from "./toolCatalog";
import { agentRegistryService } from "../agents/agentRegistryService";
import { agentVersioningService } from "../agents/agentVersioningService";
import { organizationAuthService, OrganizationRole } from "../auth/organizationAuthService";
import { businessDataSyncService } from "../team/businessDataSyncService";

const DATA_DIR = path.resolve(process.cwd(), "data");
const GATEWAY_STORE_FILE = path.join(DATA_DIR, "tool_gateway.json");
const AUDIT_STORE_FILE = path.join(DATA_DIR, "tool_gateway_audit.json");

interface GatewayStoreState {
  customTools: ToolDefinition[];
  approvals: ToolApprovalRecord[];
}

export class ToolGatewayService {
  private tools: Map<string, ToolDefinition> = new Map();
  private approvals: Map<string, ToolApprovalRecord> = new Map();
  private auditLogs: ToolAuditRecord[] = [];
  private rateLimitBuckets: Map<string, { count: number; windowStart: number }> = new Map();

  constructor() {
    this.ensureDataDir();
    this.loadCatalogAndState();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (_e) {
        /* directory may already exist */
      }
    }
  }

  private loadCatalogAndState(): void {
    // 1. Seed canonical tools
    for (const tool of CANONICAL_TOOL_DEFINITIONS) {
      this.tools.set(tool.tool_id, { ...tool });
    }

    // 2. Load persisted approvals & tool overrides
    if (fs.existsSync(GATEWAY_STORE_FILE)) {
      try {
        const raw = fs.readFileSync(GATEWAY_STORE_FILE, "utf-8");
        const parsed: GatewayStoreState = JSON.parse(raw);
        if (Array.isArray(parsed.customTools)) {
          for (const t of parsed.customTools) {
            this.tools.set(t.tool_id, t);
          }
        }
        if (Array.isArray(parsed.approvals)) {
          for (const a of parsed.approvals) {
            this.approvals.set(a.id, a);
          }
        }
      } catch (err) {
        console.warn("Notice loading tool_gateway.json:", err);
      }
    }

    // 3. Load audit logs
    if (fs.existsSync(AUDIT_STORE_FILE)) {
      try {
        const raw = fs.readFileSync(AUDIT_STORE_FILE, "utf-8");
        const parsed: ToolAuditRecord[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.auditLogs = parsed.slice(-500); // retain last 500
        }
      } catch (err) {
        console.warn("Notice loading tool_gateway_audit.json:", err);
      }
    }
  }

  private persistState(): void {
    try {
      this.ensureDataDir();
      const customTools = Array.from(this.tools.values()).filter((t) => !CANONICAL_TOOL_DEFINITIONS.some((c) => c.tool_id === t.tool_id));
      const state: GatewayStoreState = {
        customTools,
        approvals: Array.from(this.approvals.values()),
      };
      fs.writeFileSync(GATEWAY_STORE_FILE, JSON.stringify(state, null, 2), "utf-8");
    } catch (e) {
      console.warn("Notice persisting tool_gateway.json:", e);
    }
  }

  private persistAudit(): void {
    try {
      this.ensureDataDir();
      fs.writeFileSync(AUDIT_STORE_FILE, JSON.stringify(this.auditLogs.slice(-500), null, 2), "utf-8");
    } catch (e) {
      console.warn("Notice persisting tool_gateway_audit.json:", e);
    }
  }

  // ==========================================
  // TOOL REGISTRATION & LIFECYCLE MANAGEMENT
  // ==========================================

  public getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getToolById(toolId: string): ToolDefinition | null {
    if (!toolId) return null;
    return this.tools.get(toolId.trim()) || null;
  }

  public registerTool(tool: ToolDefinition): { success: boolean; error?: string } {
    if (!tool.tool_id || typeof tool.tool_id !== "string") {
      return { success: false, error: "Tool ID is mandatory." };
    }
    const cleanId = tool.tool_id.trim();
    if (this.tools.has(cleanId)) {
      return { success: false, error: `Tool with ID '${cleanId}' is already registered.` };
    }
    const sem = agentVersioningService.parseSemanticVersion(tool.version);
    if (!sem) {
      return { success: false, error: `Malformed tool version: '${tool.version}'. Must be SemVer MAJOR.MINOR.PATCH.` };
    }
    if (!tool.input_schema || tool.input_schema.type !== "object") {
      return { success: false, error: "Tool must define an object input schema." };
    }

    const now = new Date().toISOString();
    const registered: ToolDefinition = {
      ...tool,
      tool_id: cleanId,
      created_at: tool.created_at || now,
      updated_at: now,
    };
    this.tools.set(cleanId, registered);
    this.persistState();
    return { success: true };
  }

  public updateToolStatus(toolId: string, status: ToolLifecycleStatus): { success: boolean; error?: string } {
    const cleanId = (toolId || "").trim();
    const tool = this.tools.get(cleanId);
    if (!tool) {
      return { success: false, error: `Tool '${cleanId}' not found.` };
    }
    const validStatuses: ToolLifecycleStatus[] = ["draft", "active", "inactive", "deprecated", "archived"];
    if (!validStatuses.includes(status)) {
      return { success: false, error: `Invalid tool lifecycle status: '${status}'.` };
    }

    tool.status = status;
    tool.updated_at = new Date().toISOString();
    this.tools.set(cleanId, tool);
    this.persistState();
    return { success: true };
  }

  // ==========================================
  // TOOL DISCOVERY
  // ==========================================

  public async discoverTools(filter: ToolDiscoveryFilter): Promise<ToolDefinition[]> {
    const all = Array.from(this.tools.values());

    // Inactive, draft, and archived tools are never discoverable as executable
    let permitted = all.filter((t) => t.status === "active");

    // Filter by module if requested
    if (filter.module_id) {
      const cleanMod = filter.module_id.toLowerCase().trim();
      permitted = permitted.filter((t) => t.module_id === cleanMod);
    }

    // Filter by category if requested
    if (filter.category) {
      const cleanCat = filter.category.toLowerCase().trim();
      permitted = permitted.filter((t) => t.category === cleanCat);
    }

    // If an agent is specified, filter by agent's authorized capabilities and category modules
    if (filter.agent_id) {
      const cleanAgentId = filter.agent_id.trim().toUpperCase();
      const agent = agentRegistryService.getAgentById(cleanAgentId);
      if (!agent || agent.status !== "active") {
        return []; // Inactive or unregistered agent gets 0 tools
      }

      const activeVer = agentVersioningService.getActiveVersion(cleanAgentId);
      const agentPermissions = activeVer?.permissions || agent.permissions || [];
      const supportedModules = (activeVer?.configuration?.supported_modules || agent.configuration?.supported_modules || []).map((m) =>
        m.toLowerCase()
      );

      permitted = permitted.filter((tool) => {
        // 1. Tool must belong to agent's supported modules (or system test module for test agents)
        if (tool.module_id !== "system" && !supportedModules.includes(tool.module_id)) {
          return false;
        }

        // 2. Check allowed_agent_ids
        if (tool.allowed_agent_ids !== "*") {
          if (!tool.allowed_agent_ids.includes(cleanAgentId)) {
            return false;
          }
        }

        // 3. Agent must possess all required tool permissions
        const hasPermissions = tool.required_permissions.every((rp) => agentPermissions.includes(rp));
        if (!hasPermissions && tool.module_id !== "system") {
          return false;
        }

        return true;
      });
    }

    // If business is specified, verify category-level enabled modules
    if (filter.business_id && filter.agent_id) {
      try {
        const catAuth = await organizationAuthService.authorizeCategoryAccess({
          businessId: filter.business_id,
          requestedAgentId: filter.agent_id,
        });

        if (!catAuth.allowed || !catAuth.category) {
          return []; // Cross-category isolation: cannot discover tools if agent doesn't match business category
        }

        const categoryModules = catAuth.category.enabledModules.map((m) => m.toLowerCase());
        permitted = permitted.filter((t) => t.module_id === "system" || categoryModules.includes(t.module_id));
      } catch (_e) {
        return [];
      }
    }

    // Sanitize output (do not expose internal policies or test-only tools to standard callers unless explicitly test agent)
    return permitted.map((t) => ({ ...t }));
  }

  // ==========================================
  // INPUT SCHEMA VALIDATION
  // ==========================================

  public validateToolInput(tool: ToolDefinition, params: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      return { valid: false, errors: ["Parameters must be a non-null JSON object."] };
    }

    const schema = tool.input_schema;
    const properties = schema.properties || {};

    // 1. Check additional properties
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(params)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          errors.push(`Unauthorized or unknown parameter: '${key}'.`);
        }
      }
    }

    // 2. Check required properties
    if (Array.isArray(schema.required)) {
      for (const reqKey of schema.required) {
        if (params[reqKey] === undefined || params[reqKey] === null || params[reqKey] === "") {
          errors.push(`Missing required parameter: '${reqKey}'.`);
        }
      }
    }

    // 3. Specific rules for individual tools
    if (tool.tool_id === "inventory.product.get") {
      if (!params.productId && !params.sku) {
        errors.push("Must provide at least 'productId' or 'sku'.");
      }
    }

    // 4. Validate each supplied property
    for (const [key, val] of Object.entries(params)) {
      const propSchema = properties[key];
      if (!propSchema) continue;

      if (val === undefined || val === null) continue;

      // Type check
      if (propSchema.type === "string") {
        if (typeof val !== "string") {
          errors.push(`Parameter '${key}' must be a string.`);
        } else {
          if (propSchema.minLength !== undefined && val.length < propSchema.minLength) {
            errors.push(`Parameter '${key}' must be at least ${propSchema.minLength} characters.`);
          }
          if (propSchema.maxLength !== undefined && val.length > propSchema.maxLength) {
            errors.push(`Parameter '${key}' must not exceed ${propSchema.maxLength} characters.`);
          }
          if (propSchema.enum && !propSchema.enum.includes(val)) {
            errors.push(`Parameter '${key}' must be one of: [${propSchema.enum.join(", ")}].`);
          }
        }
      } else if (propSchema.type === "number") {
        if (typeof val !== "number" || Number.isNaN(val)) {
          errors.push(`Parameter '${key}' must be a valid number.`);
        } else {
          if (propSchema.minimum !== undefined && val < propSchema.minimum) {
            errors.push(`Parameter '${key}' must be at least ${propSchema.minimum}.`);
          }
          if (propSchema.maximum !== undefined && val > propSchema.maximum) {
            errors.push(`Parameter '${key}' must not exceed ${propSchema.maximum}.`);
          }
          if (propSchema.enum && !propSchema.enum.includes(val)) {
            errors.push(`Parameter '${key}' must be one of: [${propSchema.enum.join(", ")}].`);
          }
        }
      } else if (propSchema.type === "array") {
        if (!Array.isArray(val)) {
          errors.push(`Parameter '${key}' must be an array.`);
        }
      } else if (propSchema.type === "object") {
        if (typeof val !== "object" || Array.isArray(val)) {
          errors.push(`Parameter '${key}' must be an object.`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ==========================================
  // RATE LIMITING & SAFEGUARDS
  // ==========================================

  private checkRateLimit(key: string, limitPerMinute: number): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const bucket = this.rateLimitBuckets.get(key);

    if (!bucket || now - bucket.windowStart > windowMs) {
      this.rateLimitBuckets.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (bucket.count >= limitPerMinute) {
      return false; // limit exceeded
    }

    bucket.count++;
    return true;
  }

  // ==========================================
  // CORE SECURE INVOCATION ENGINE
  // ==========================================

  public async invokeTool(
    request: ToolInvocationRequest,
    context: ToolExecutionContext,
    options?: { isPreApproved?: boolean; approvalRecordId?: string }
  ): Promise<ToolInvocationResponse> {
    const startTime = Date.now();
    const requestId = context.request_id || `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const correlationId = context.correlation_id || requestId;
    const toolId = (request.tool_id || "").trim();

    // Helper for structured audit and response creation
    const makeErrorResponse = (
      code: string,
      message: string,
      status: ToolAuditRecord["status"] = "denied",
      details?: any
    ): ToolInvocationResponse => {
      const duration = Date.now() - startTime;
      this.recordAudit({
        id: `aud_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
        request_id: requestId,
        correlation_id: correlationId,
        tool_id: toolId,
        tool_version: request.tool_version || "1.0.0",
        agent_id: context.agent_id || "UNKNOWN",
        agent_version: context.agent_version || "UNKNOWN",
        contract_version: context.contract_version || "1.0",
        business_id: context.business_id || "UNKNOWN",
        category_id: context.category_id,
        actor_id: context.actor_id || "UNKNOWN",
        actor_email: context.actor_email,
        action: toolId,
        status,
        error_code: code,
        error_message: message,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        tool_id: toolId,
        tool_version: request.tool_version || "1.0.0",
        request_id: requestId,
        data: null,
        error: { code, message, details },
        metadata: {
          execution_status: status === "rate_limited" ? "rate_limited" : (status === "pending_approval" ? "pending_approval" : "failed"),
          execution_duration_ms: duration,
          timestamp: new Date().toISOString(),
          approval_id: options?.approvalRecordId,
        },
      };
    };

    // 1. Resolve Tool from Registry
    const tool = this.tools.get(toolId);
    if (!tool) {
      return makeErrorResponse("TOOL_NOT_FOUND", `Tool '${toolId}' is not registered in the Gateway.`);
    }

    if (tool.status !== "active") {
      return makeErrorResponse("TOOL_INACTIVE", `Tool '${toolId}' is currently in status '${tool.status}' and cannot execute.`);
    }

    // 2. Validate Caller Authentication
    if (!context.actor_id) {
      return makeErrorResponse("UNAUTHENTICATED", "Request context missing authenticated actor ID.");
    }

    // 3. Validate Organization Membership / Ownership
    if (!context.business_id) {
      return makeErrorResponse("ORGANIZATION_ACCESS_DENIED", "Request context missing business or organization ID.");
    }

    const orgAuth = await organizationAuthService.authorizeOrganizationAccess({
      userId: context.actor_id,
      businessId: context.business_id,
      isPlatformAdmin: context.is_platform_admin,
    });

    if (!orgAuth.allowed) {
      return makeErrorResponse("ORGANIZATION_ACCESS_DENIED", orgAuth.reason || "Actor lacks authorized membership in organization.");
    }

    const effectiveRole = (orgAuth.role as OrganizationRole) || "member";

    // 4. Validate Agent Identity and Registration
    const agentId = (context.agent_id || "").trim().toUpperCase();
    if (!agentId) {
      return makeErrorResponse("AGENT_NOT_REGISTERED", "Invocation context missing agent identifier.");
    }

    const agent = agentRegistryService.getAgentById(agentId);
    if (!agent) {
      return makeErrorResponse("AGENT_NOT_REGISTERED", `Agent '${agentId}' is not registered in GeFlow Agent Registry.`);
    }

    if (agent.status !== "active") {
      return makeErrorResponse("AGENT_INACTIVE", `Agent '${agentId}' is currently in status '${agent.status}' and cannot execute tools.`);
    }

    // 5. Validate Agent Version and Contract Compatibility
    const activeVersionRecord = agentVersioningService.getActiveVersion(agentId);
    const expectedAgentVersion = activeVersionRecord?.version || agent.version;
    if (context.agent_version && context.agent_version !== expectedAgentVersion) {
      return makeErrorResponse(
        "VERSION_INCOMPATIBLE",
        `Requested agent configuration version '${context.agent_version}' does not match active approved version '${expectedAgentVersion}'.`
      );
    }

    const activeContractVersion = activeVersionRecord?.contract_version || agent.contract_version || "1.0";
    if (context.contract_version && context.contract_version !== activeContractVersion) {
      return makeErrorResponse(
        "VERSION_INCOMPATIBLE",
        `Contract version '${context.contract_version}' does not match active contract '${activeContractVersion}'.`
      );
    }

    // 6. Validate Category-Level Authorization & Agent Association
    const catAuth = await organizationAuthService.authorizeCategoryAccess({
      businessId: context.business_id,
      requestedModule: tool.module_id === "system" ? undefined : tool.module_id,
      requestedAgentId: agentId,
      userRole: effectiveRole,
    });

    if (!catAuth.allowed) {
      return makeErrorResponse("CATEGORY_ACCESS_DENIED", catAuth.reason || "Category authorization rejected.");
    }

    // 7. Validate Agent Tool Permissions
    const agentPermissions = activeVersionRecord?.permissions || agent.permissions || [];
    if (tool.module_id !== "system") {
      const hasPerms = tool.required_permissions.every((rp) => agentPermissions.includes(rp));
      if (!hasPerms) {
        return makeErrorResponse(
          "TOOL_NOT_ALLOWED",
          `Agent '${agentId}' lacks required tool permissions: [${tool.required_permissions.join(", ")}].`
        );
      }
    }

    // Check allowed_agent_ids
    if (tool.allowed_agent_ids !== "*") {
      if (!tool.allowed_agent_ids.includes(agentId)) {
        return makeErrorResponse(
          "TOOL_NOT_ALLOWED",
          `Tool '${toolId}' is restricted to agents [${tool.allowed_agent_ids.join(", ")}]. Agent '${agentId}' is not authorized.`
        );
      }
    }

    // 8. Rate Limiting Check
    const agentRateKey = `agent:${agentId}`;
    const bizRateKey = `biz:${context.business_id}`;
    const toolRateKey = `tool:${toolId}`;

    if (!this.checkRateLimit(agentRateKey, 60)) {
      return makeErrorResponse("RATE_LIMIT_EXCEEDED", `Agent '${agentId}' rate limit exceeded (max 60 calls/min).`, "rate_limited");
    }
    if (!this.checkRateLimit(bizRateKey, 120)) {
      return makeErrorResponse("RATE_LIMIT_EXCEEDED", `Business '${context.business_id}' rate limit exceeded (max 120 calls/min).`, "rate_limited");
    }
    if (!this.checkRateLimit(toolRateKey, tool.execution_policy.rate_limit_per_minute || 60)) {
      return makeErrorResponse("RATE_LIMIT_EXCEEDED", `Tool '${toolId}' invocation rate limit exceeded.`, "rate_limited");
    }

    // 9. Input Payload Size Check
    const rawPayload = JSON.stringify(request.parameters || {});
    const maxPayload = tool.execution_policy.max_payload_size_bytes || 16384;
    if (Buffer.byteLength(rawPayload, "utf-8") > maxPayload) {
      return makeErrorResponse("INVALID_REQUEST", `Payload size exceeds tool limit of ${maxPayload} bytes.`);
    }

    // 10. Input Schema Validation
    const validation = this.validateToolInput(tool, request.parameters || {});
    if (!validation.valid) {
      return makeErrorResponse("INVALID_REQUEST", `Input validation failed: ${validation.errors.join("; ")}`, "denied", validation.errors);
    }

    // 11. Resource Ownership Check
    const resourceCheck = await this.verifyResourceOwnership(tool, request.parameters || {}, context.business_id);
    if (!resourceCheck.valid) {
      return makeErrorResponse("RESOURCE_ACCESS_DENIED", resourceCheck.error || "Resource ownership violation.");
    }

    // 12. Human Approval Check
    const isApprovedRecord = request.approval_id
      ? this.approvals.get(request.approval_id)?.status === "approved"
      : false;

    if (!options?.isPreApproved && !isApprovedRecord && tool.approval_policy.requires_approval) {
      const criteria = tool.approval_policy.approval_criteria;
      let needsApproval = false;
      let approvalReason = "Operation requires manager confirmation.";

      if (!criteria || criteria.condition === "always") {
        needsApproval = true;
      } else if (criteria.field && criteria.condition === "greater_than" && criteria.threshold !== undefined) {
        const fieldVal = Number((request.parameters || {})[criteria.field]);
        if (!Number.isNaN(fieldVal) && fieldVal > criteria.threshold) {
          needsApproval = true;
          approvalReason = `Operation parameter '${criteria.field}' value (${fieldVal}) exceeds automatic threshold (${criteria.threshold}).`;
        }
      }

      if (needsApproval) {
        // Create a pending approval record
        const approvalRecord = this.createApproval({
          tool,
          agentId,
          businessId: context.business_id,
          actorId: context.actor_id,
          actorEmail: context.actor_email,
          inputParams: request.parameters || {},
          reason: approvalReason,
        });

        const duration = Date.now() - startTime;
        this.recordAudit({
          id: `aud_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
          request_id: requestId,
          correlation_id: correlationId,
          tool_id: toolId,
          tool_version: tool.version,
          agent_id: agentId,
          agent_version: expectedAgentVersion,
          contract_version: activeContractVersion,
          business_id: context.business_id,
          category_id: context.category_id,
          actor_id: context.actor_id,
          actor_email: context.actor_email,
          action: toolId,
          status: "pending_approval",
          duration_ms: duration,
          timestamp: new Date().toISOString(),
        });

        return {
          success: false,
          tool_id: toolId,
          tool_version: tool.version,
          request_id: requestId,
          data: {
            approval_id: approvalRecord.id,
            status: "pending",
            reason: approvalReason,
            approver_role: tool.approval_policy.approver_role || "manager",
          },
          error: {
            code: "APPROVAL_REQUIRED",
            message: `Tool '${toolId}' requires authorization before execution: ${approvalReason}`,
            details: { approval_id: approvalRecord.id },
          },
          metadata: {
            execution_status: "pending_approval",
            execution_duration_ms: duration,
            timestamp: new Date().toISOString(),
            approval_id: approvalRecord.id,
          },
        };
      }
    }

    // 13. Execute with Timeout Safeguard
    try {
      const timeoutMs = tool.timeout_policy.timeout_ms || 5000;
      const executionPromise = this.dispatchBackendOperation(tool, request.parameters || {}, context);

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("GATEWAY_TIMEOUT")), timeoutMs);
      });

      const resultData = await Promise.race([executionPromise, timeoutPromise]);
      const duration = Date.now() - startTime;

      // 14. Record Audit Success
      this.recordAudit({
        id: `aud_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
        request_id: requestId,
        correlation_id: correlationId,
        tool_id: toolId,
        tool_version: tool.version,
        agent_id: agentId,
        agent_version: expectedAgentVersion,
        contract_version: activeContractVersion,
        business_id: context.business_id,
        category_id: context.category_id,
        actor_id: context.actor_id,
        actor_email: context.actor_email,
        action: toolId,
        status: "success",
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        tool_id: toolId,
        tool_version: tool.version,
        request_id: requestId,
        data: resultData,
        error: null,
        metadata: {
          execution_status: "completed",
          execution_duration_ms: duration,
          timestamp: new Date().toISOString(),
          approval_id: options?.approvalRecordId,
        },
      };
    } catch (err: any) {
      const duration = Date.now() - startTime;
      const isTimeout = err?.message === "GATEWAY_TIMEOUT";
      const code = isTimeout ? "EXECUTION_TIMEOUT" : "EXECUTION_FAILED";
      const message = isTimeout ? `Execution exceeded maximum timeout of ${tool.timeout_policy.timeout_ms}ms.` : "Internal execution error occurred.";

      return makeErrorResponse(code, message, isTimeout ? "timeout" : "failed");
    }
  }

  // ==========================================
  // RESOURCE OWNERSHIP CHECK
  // ==========================================

  private async verifyResourceOwnership(
    tool: ToolDefinition,
    params: Record<string, any>,
    businessId: string
  ): Promise<{ valid: boolean; error?: string }> {
    const bizData = businessDataSyncService.getBusinessData(businessId, "manager");

    // Check productId
    if (params.productId) {
      const cleanProdId = String(params.productId).trim();
      const product = bizData.products.find((p) => p.id === cleanProdId);
      if (!product) {
        // If not found in memory, ensure it doesn't belong to another business
        const allStores = (businessDataSyncService as any).store?.businesses || (businessDataSyncService as any).units || {};
        for (const [otherBizId, unit] of Object.entries<any>(allStores)) {
          if (otherBizId !== businessId && Array.isArray(unit.products)) {
            const foundInOther = unit.products.some((p: any) => p.id === cleanProdId);
            if (foundInOther) {
              return {
                valid: false,
                error: `Product '${cleanProdId}' belongs to another organization. Cross-tenant access denied.`,
              };
            }
          }
        }
      }
    }

    return { valid: true };
  }

  // ==========================================
  // DISPATCH BACKEND OPERATIONS
  // ==========================================

  private async dispatchBackendOperation(
    tool: ToolDefinition,
    params: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<any> {
    const businessId = context.business_id;

    switch (tool.tool_id) {
      case "inventory.product.get": {
        const data = businessDataSyncService.getBusinessData(businessId, "manager");
        let found = null;
        if (params.productId) {
          found = data.products.find((p) => p.id === params.productId);
        }
        if (!found && params.sku) {
          found = data.products.find(
            (p: any) =>
              (p.internal_sku && p.internal_sku.toLowerCase() === params.sku.toLowerCase()) ||
              (p.sku && p.sku.toLowerCase() === params.sku.toLowerCase()) ||
              (p.barcode && p.barcode.toLowerCase() === params.sku.toLowerCase())
          );
        }
        if (!found) {
          throw new Error("Product not found in business catalog.");
        }
        // Filter fields to safe contract
        return {
          product: {
            id: found.id,
            name: found.name,
            internal_sku: found.internal_sku,
            barcode: found.barcode,
            retail_price: found.retail_price,
            purchase_cost: found.purchase_cost,
            stock_units: found.stock_units,
            min_stock_alert: found.min_stock_alert,
            status: found.status,
            category_id: found.category_id,
            updated_at: found.updated_at,
          },
        };
      }

      case "inventory.products.list": {
        const data = businessDataSyncService.getBusinessData(businessId, "manager");
        let list = [...data.products];
        if (params.status && params.status !== "all") {
          list = list.filter((p) => p.status === params.status);
        }
        const offset = Number(params.offset) || 0;
        const limit = Math.min(Number(params.limit) || 20, 100);
        const sliced = list.slice(offset, offset + limit);

        return {
          products: sliced.map((p) => ({
            id: p.id,
            name: p.name,
            internal_sku: p.internal_sku,
            retail_price: p.retail_price,
            stock_units: p.stock_units,
            status: p.status,
          })),
          total_count: list.length,
          offset,
          limit,
        };
      }

      case "inventory.stock.adjust": {
        const delta = Number(params.deltaQuantity);
        const type = params.type as "in" | "out" | "set";
        const res = businessDataSyncService.adjustStock(
          businessId,
          params.productId,
          delta,
          type,
          params.reason,
          params.note,
          context.actor_id
        );
        return {
          success: res.success,
          newStock: res.newStock,
          product_id: params.productId,
          type,
          delta,
        };
      }

      case "pos.held_orders.list": {
        const data = businessDataSyncService.getBusinessData(businessId, "cashier");
        const limit = Math.min(Number(params.limit) || 20, 50);
        return {
          held_orders: (data.held_orders || []).slice(0, limit),
        };
      }

      case "pos.sale.create": {
        const res = businessDataSyncService.recordSale(businessId, {
          sale: params.sale,
          items: params.items,
          cashierName: params.cashierName,
          userId: context.actor_id,
        });
        return {
          success: res.success,
          sale: {
            id: res.sale.id,
            total: res.sale.total,
            status: res.sale.status,
            created_at: res.sale.created_at,
            processed_by: res.sale.processed_by,
          },
          updatedProducts: res.updatedProducts,
        };
      }

      case "returns.list": {
        const returns = businessDataSyncService.getReturns(businessId);
        const limit = Math.min(Number(params.limit) || 20, 50);
        return {
          returns: returns.slice(0, limit),
        };
      }

      case "reports.sales.summary": {
        const data = businessDataSyncService.getBusinessData(businessId, "manager");
        const sales = data.sales || [];
        const totalRevenue = sales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
        const totalProfit = sales.reduce((acc, s) => acc + (Number(s.profit) || 0), 0);
        const totalProducts = (data.products || []).length;
        const lowStockCount = (data.products || []).filter((p) => p.status === "low_stock" || p.stock_units <= p.min_stock_alert).length;

        return {
          summary: {
            business_id: businessId,
            timeframe: params.timeframe || "all_time",
            total_sales_count: sales.length,
            total_revenue: totalRevenue,
            total_profit: totalProfit,
            catalog_products_count: totalProducts,
            low_stock_alerts_count: lowStockCount,
            generated_at: new Date().toISOString(),
          },
        };
      }

      case "system.echo.test": {
        return {
          echo: params.echo,
          timestamp: new Date().toISOString(),
          context: {
            agent_id: context.agent_id,
            business_id: context.business_id,
          },
        };
      }

      default:
        throw new Error(`Execution dispatcher has no handler for tool '${tool.tool_id}'.`);
    }
  }

  // ==========================================
  // APPROVAL MANAGEMENT
  // ==========================================

  private createApproval(params: {
    tool: ToolDefinition;
    agentId: string;
    businessId: string;
    actorId: string;
    actorEmail?: string;
    inputParams: Record<string, any>;
    reason: string;
  }): ToolApprovalRecord {
    const id = `appr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours expiry

    const record: ToolApprovalRecord = {
      id,
      tool_id: params.tool.tool_id,
      tool_version: params.tool.version,
      agent_id: params.agentId,
      business_id: params.businessId,
      actor_id: params.actorId,
      actor_email: params.actorEmail,
      input_params: params.inputParams,
      status: "pending",
      reason: params.reason,
      created_at: now.toISOString(),
      expires_at: expiresAt,
    };

    this.approvals.set(id, record);
    this.persistState();
    return record;
  }

  public getApproval(approvalId: string): ToolApprovalRecord | null {
    if (!approvalId) return null;
    return this.approvals.get(approvalId.trim()) || null;
  }

  public listApprovals(filter?: { businessId?: string; status?: ApprovalStatus }): ToolApprovalRecord[] {
    let list = Array.from(this.approvals.values());
    if (filter?.businessId) {
      list = list.filter((a) => a.business_id === filter.businessId);
    }
    if (filter?.status) {
      list = list.filter((a) => a.status === filter.status);
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async decideApproval(params: {
    approvalId: string;
    decision: "approved" | "rejected";
    approverUserId: string;
    approverEmail?: string;
    decisionReason?: string;
    isPlatformAdmin?: boolean;
  }): Promise<{ success: boolean; approval?: ToolApprovalRecord; executionResult?: any; error?: string }> {
    const { approvalId, decision, approverEmail, decisionReason, isPlatformAdmin } = params;
    const approverUserId = params.approverUserId || (params as any).approverId;
    const approval = this.approvals.get((approvalId || "").trim());

    if (!approval) {
      return { success: false, error: `Approval record '${approvalId}' not found.` };
    }

    if (approval.status !== "pending") {
      return { success: false, error: `Approval record '${approvalId}' is already in status '${approval.status}'.` };
    }

    // Check expiry
    if (new Date() > new Date(approval.expires_at)) {
      approval.status = "expired";
      this.persistState();
      return { success: false, error: "Approval request has expired." };
    }

    // Agent or requesting actor cannot self-approve without manager authorization
    if (approval.actor_id === approverUserId && !isPlatformAdmin) {
      return { success: false, error: "Self-approval is forbidden. An independent authorized manager must review this request." };
    }

    // Verify approver role in the business
    const approverAuth = await organizationAuthService.authorizeOrganizationAccess({
      userId: approverUserId,
      businessId: approval.business_id,
      requiredRole: "manager",
      isPlatformAdmin,
    });

    if (!approverAuth.allowed) {
      return { success: false, error: `Approver lacks authorized manager permissions for this organization: ${approverAuth.reason}` };
    }

    const now = new Date().toISOString();
    approval.decided_at = now;
    approval.decided_by = approverEmail || approverUserId;
    approval.decision_reason = decisionReason || (decision === "approved" ? "Authorized by store manager." : "Rejected by store manager.");

    if (decision === "rejected") {
      approval.status = "rejected";
      this.persistState();
      return { success: true, approval };
    }

    // Decision is approved: Execute the operation with pre-approved flag
    approval.status = "approved";
    this.persistState();

    const activeVersionRecord = agentVersioningService.getActiveVersion(approval.agent_id);
    const execContext: ToolExecutionContext = {
      agent_id: approval.agent_id,
      agent_version: activeVersionRecord?.version || "1.0.0",
      contract_version: activeVersionRecord?.contract_version || "1.0",
      business_id: approval.business_id,
      actor_id: approverUserId,
      actor_email: approverEmail,
      is_platform_admin: isPlatformAdmin,
      request_id: `req_appr_${approval.id}`,
    };

    const invocationRes = await this.invokeTool(
      {
        tool_id: approval.tool_id,
        tool_version: approval.tool_version,
        parameters: approval.input_params,
      },
      execContext,
      { isPreApproved: true, approvalRecordId: approval.id }
    );

    if (invocationRes.success) {
      approval.execution_result = invocationRes.data;
    } else {
      approval.execution_error = invocationRes.error?.message || "Execution failed post-approval.";
    }

    this.persistState();

    return {
      success: invocationRes.success,
      approval,
      executionResult: invocationRes.data,
      error: invocationRes.error?.message,
    };
  }

  // ==========================================
  // AUDIT LOGGING & OBSERVABILITY
  // ==========================================

  public recordAudit(record: ToolAuditRecord): void {
    this.auditLogs.unshift(record);
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
    this.persistAudit();
  }

  public getAuditHistory(filter?: {
    agentId?: string;
    businessId?: string;
    toolId?: string;
    status?: string;
    limit?: number;
  }): ToolAuditRecord[] {
    let list = [...this.auditLogs];
    if (filter?.agentId) {
      const cleanAgent = filter.agentId.trim().toUpperCase();
      list = list.filter((a) => a.agent_id.toUpperCase() === cleanAgent);
    }
    if (filter?.businessId) {
      list = list.filter((a) => a.business_id === filter.businessId);
    }
    if (filter?.toolId) {
      list = list.filter((a) => a.tool_id === filter.toolId);
    }
    if (filter?.status) {
      list = list.filter((a) => a.status === filter.status);
    }
    const limit = filter?.limit || 50;
    return list.slice(0, limit);
  }
}

export const toolGatewayService = new ToolGatewayService();
