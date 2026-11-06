/**
 * GeFlow AI — Centralized Agent Execution Engine (Step 11)
 *
 * Implements a unified, secure, traceable execution runtime for all 29 registered agents.
 * Integrates identity, active configuration versioning, contract compliance,
 * 2-tier organizational authorization, capability boundaries, tool gateway dispatch,
 * approval suspension/resumption, idempotent replay, and centralized audit logging.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  AgentExecutionRecord,
  ExecutionEventRecord,
  ExecutionFailureCode,
  ExecutionFilterOptions,
  ExecutionMetrics,
  ExecutionRequestPayload,
  ExecutionStatus,
  TaskType,
  ToolInvocationRecord,
} from "./agentExecutionTypes";
import { agentRegistryService } from "../agents/agentRegistryService";
import { agentVersioningService } from "../agents/agentVersioningService";
import { organizationAuthService, OrganizationRole } from "../auth/organizationAuthService";
import { toolGatewayService } from "../tools/toolGatewayService";
import { ToolExecutionContext, ToolInvocationRequest } from "../tools/toolGatewayTypes";
import { agentAuditService } from "./agentAuditService";
import { businessDataSyncService } from "../team/businessDataSyncService";

const DATA_DIR = path.resolve(process.cwd(), "data");
const EXECUTIONS_STORE_FILE = path.join(DATA_DIR, "agent_executions.json");

export const TOOL_ALIASES: Record<string, string> = {
  inv_get_stock_level: "inventory.product.get",
  inv_list_low_stock: "inventory.products.list",
  inv_adjust_stock: "inventory.stock.adjust",
  sales_get_daily_summary: "reports.sales.summary",
  sales_list_held_orders: "pos.held_orders.list",
  returns_list_requests: "returns.list",
  catalog_get_product: "inventory.product.get",
  pos_process_cart: "pos.sale.create",
  sys_diagnostic_echo: "system.echo.test",
};

export const REVERSE_TOOL_ALIASES: Record<string, string> = {
  "inventory.product.get": "inv_get_stock_level",
  "inventory.products.list": "inv_list_low_stock",
  "inventory.stock.adjust": "inv_adjust_stock",
  "reports.sales.summary": "sales_get_daily_summary",
  "pos.held_orders.list": "sales_list_held_orders",
  "returns.list": "returns_list_requests",
  "pos.sale.create": "pos_process_cart",
  "system.echo.test": "sys_diagnostic_echo",
};

const VALID_STATE_TRANSITIONS: Record<ExecutionStatus, ExecutionStatus[]> = {
  pending: ["validating", "rejected", "cancelled", "failed"],
  validating: ["queued", "awaiting_approval", "running", "rejected", "failed", "cancelled"],
  awaiting_approval: ["approved", "rejected", "cancelled", "timed_out"],
  approved: ["queued", "running", "cancelled"],
  queued: ["running", "cancelled", "timed_out", "failed"],
  running: ["completed", "failed", "awaiting_approval", "cancelled", "timed_out"],
  completed: [],
  failed: [],
  rejected: [],
  cancelled: [],
  timed_out: [],
};

const TASK_DEFAULT_TOOLS: Record<TaskType, string[]> = {
  inventory_audit: ["inventory.product.get"],
  stock_adjustment: ["inventory.stock.adjust"],
  sales_summary: ["reports.sales.summary"],
  held_orders_review: ["pos.held_orders.list"],
  returns_inspection: ["returns.list"],
  catalog_lookup: ["inventory.product.get"],
  pos_transaction: ["pos.sale.create"],
  diagnostic_echo: ["system.echo.test"],
  custom_tool_run: [],
};

export class AgentExecutionEngine {
  private executions: Map<string, AgentExecutionRecord> = new Map();
  private idempotencyIndex: Map<string, string> = new Map(); // businessId:key -> execution_id

  constructor() {
    this.ensureDataDir();
    this.loadExecutions();
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

  private loadExecutions(): void {
    if (fs.existsSync(EXECUTIONS_STORE_FILE)) {
      try {
        const raw = fs.readFileSync(EXECUTIONS_STORE_FILE, "utf-8");
        const parsed: AgentExecutionRecord[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            this.executions.set(item.execution_id, item);
            if (item.idempotency_key && item.business_id) {
              this.idempotencyIndex.set(`${item.business_id}:${item.idempotency_key}`, item.execution_id);
            }
          }
        }
      } catch (e) {
        console.error("[AgentExecutionEngine] Error loading executions, starting fresh:", e);
      }
    }
  }

  private persistExecutions(): void {
    try {
      const records = Array.from(this.executions.values());
      fs.writeFileSync(EXECUTIONS_STORE_FILE, JSON.stringify(records, null, 2), "utf-8");
    } catch (e) {
      console.error("[AgentExecutionEngine] Failed to persist executions:", e);
    }
  }

  private recordEvent(
    execution: AgentExecutionRecord,
    eventType: ExecutionEventRecord["event_type"],
    detail: string,
    fromStatus?: ExecutionStatus,
    toStatus?: ExecutionStatus,
    actorId?: string
  ): void {
    const event: ExecutionEventRecord = {
      event_id: `evt_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
      execution_id: execution.execution_id,
      event_type: eventType,
      detail,
      from_status: fromStatus,
      to_status: toStatus,
      actor_id: actorId || execution.requesting_user_id,
      timestamp: new Date().toISOString(),
    };
    execution.events.push(event);
    execution.updated_at = new Date().toISOString();
  }

  private validateTransition(current: ExecutionStatus, next: ExecutionStatus): boolean {
    const allowed = VALID_STATE_TRANSITIONS[current] || [];
    return allowed.includes(next);
  }

  /**
   * Submits and drives an agent task execution.
   */
  public async submitExecution(
    payload: ExecutionRequestPayload,
    caller: { userId: string; email?: string; isPlatformAdmin?: boolean }
  ): Promise<{
    execution: AgentExecutionRecord;
    is_idempotent_replay?: boolean;
    in_progress?: boolean;
  }> {
    const correlation_id = payload.correlation_id || `corr_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const business_id = (payload.business_id || "").trim();
    const agent_id = (payload.agent_id || "").trim().toUpperCase();

    // 1. Idempotency Check
    if (payload.idempotency_key && business_id) {
      const existingId = this.idempotencyIndex.get(`${business_id}:${payload.idempotency_key}`);
      if (existingId) {
        const existing = this.executions.get(existingId);
        if (existing) {
          if (existing.status === "completed") {
            return { execution: existing, is_idempotent_replay: true };
          }
          if (["pending", "validating", "queued", "running", "awaiting_approval"].includes(existing.status)) {
            return { execution: existing, in_progress: true };
          }
        }
      }
    }

    const now = new Date().toISOString();
    const executionId = `exec_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // Temporary stub record for validation failure reporting
    const execution: AgentExecutionRecord = {
      execution_id: executionId,
      agent_id: agent_id,
      agent_name: "Unknown Agent",
      agent_configuration_version: payload.agent_version || "1.0.0",
      contract_version: payload.contract_version || "1.0",
      business_id,
      category_id: "",
      requesting_user_id: caller.userId,
      requesting_user_email: caller.email,
      task_type: payload.task_type,
      task_input: payload.task_input || {},
      requested_tool_ids: payload.requested_tool_ids || [],
      status: "pending",
      correlation_id,
      idempotency_key: payload.idempotency_key,
      retry_count: 0,
      max_retries: 2,
      timeout_ms: Math.min(120000, Math.max(5000, payload.timeout_ms || 30000)),
      tool_invocations: [],
      events: [],
      created_at: now,
      updated_at: now,
    };

    this.recordEvent(execution, "execution_requested", `Execution requested for task ${payload.task_type}`);

    // Audit log: execution requested
    agentAuditService.recordEvent({
      event_type: "execution_requested",
      event_category: "execution",
      execution_id: executionId,
      correlation_id,
      agent_id,
      business_id,
      actor_type: caller.isPlatformAdmin ? "admin" : "user",
      actor_id: caller.userId,
      actor_email: caller.email,
      target_type: "execution",
      target_id: executionId,
      action: `submit_execution:${payload.task_type}`,
      authorization_decision: "allowed",
      result_status: "success",
      sanitized_metadata: { task_type: payload.task_type },
    });

    // 2. Validate payload fields
    if (!business_id) {
      return this.failExecution(execution, "validation_error", "Missing required field: business_id", "rejected");
    }
    if (!agent_id) {
      return this.failExecution(execution, "validation_error", "Missing required field: agent_id", "rejected");
    }
    if (!payload.task_type) {
      return this.failExecution(execution, "validation_error", "Missing required field: task_type", "rejected");
    }

    // Move to validating
    execution.status = "validating";
    this.recordEvent(execution, "execution_validated", "Starting identity, version, and authorization checks", "pending", "validating");

    // 3. Agent Identity & Lifecycle Check
    const agent = agentRegistryService.getAgentById(agent_id);
    if (!agent) {
      return this.failExecution(
        execution,
        "agent_unavailable",
        `Agent '${agent_id}' is not registered in the 29-Agent Master Registry.`,
        "rejected"
      );
    }
    execution.agent_name = agent.name;
    execution.category_id = agent.primary_category_id;
    execution.category_name = agent.category_name;

    if (agent.status !== "active") {
      return this.failExecution(
        execution,
        "agent_unavailable",
        `Agent '${agent_id}' is currently '${agent.status}' and unavailable for task execution.`,
        "rejected"
      );
    }

    // 4. Configuration Version & Contract Check
    const activeVersionRecord = agentVersioningService.getActiveVersion(agent_id);
    const expectedAgentVersion = activeVersionRecord?.version || agent.version;
    const expectedContractVersion = activeVersionRecord?.contract_version || agent.contract_version || "1.0";

    execution.agent_configuration_version = expectedAgentVersion;
    execution.contract_version = expectedContractVersion;

    if (payload.agent_version && payload.agent_version !== expectedAgentVersion) {
      return this.failExecution(
        execution,
        "configuration_error",
        `Requested agent configuration version '${payload.agent_version}' does not match active approved version '${expectedAgentVersion}'.`,
        "rejected"
      );
    }

    if (payload.contract_version && payload.contract_version !== expectedContractVersion) {
      return this.failExecution(
        execution,
        "configuration_error",
        `Requested contract version '${payload.contract_version}' is incompatible with active contract '${expectedContractVersion}'.`,
        "rejected"
      );
    }

    // 5. Level 1: Organization Access Check
    const orgAuth = await organizationAuthService.authorizeOrganizationAccess({
      userId: caller.userId,
      businessId: business_id,
      isPlatformAdmin: caller.isPlatformAdmin,
    });

    if (!orgAuth.allowed) {
      return this.failExecution(
        execution,
        "authorization_error",
        `Organization authorization denied: ${orgAuth.reason || "Unauthorized"}`,
        "rejected"
      );
    }

    const effectiveRole = (orgAuth.role as OrganizationRole) || "member";

    // 6. Level 2: Category Access Check
    const catAuth = await organizationAuthService.authorizeCategoryAccess({
      businessId: business_id,
      requestedAgentId: agent_id,
      userRole: effectiveRole,
    });

    if (!catAuth.allowed) {
      return this.failExecution(
        execution,
        "authorization_error",
        `Category authorization denied for ${agent.primary_category_id}: ${catAuth.reason || "Access restricted"}`,
        "rejected"
      );
    }

    // 7. Resolve Tools to Execute
    let toolsToExecute: string[] = [];
    if (payload.task_type === "custom_tool_run") {
      toolsToExecute = payload.requested_tool_ids || [];
    } else {
      toolsToExecute = TASK_DEFAULT_TOOLS[payload.task_type] || [];
      if (payload.requested_tool_ids && payload.requested_tool_ids.length > 0) {
        for (const t of payload.requested_tool_ids) {
          if (!toolsToExecute.includes(t)) toolsToExecute.push(t);
        }
      }
    }

    execution.requested_tool_ids = toolsToExecute;

    // 8. Capability & Permission Verification
    const agentPermissions = activeVersionRecord?.permissions || agent.permissions || [];
    for (const toolId of toolsToExecute) {
      const canonicalToolId = TOOL_ALIASES[toolId] || toolId;
      const toolDef = toolGatewayService.getToolById(canonicalToolId);
      if (!toolDef) {
        return this.failExecution(
          execution,
          "tool_execution_error",
          `Required tool '${toolId}' is not found in the Shared Tool Catalog.`,
          "failed"
        );
      }

      if (toolDef.module_id !== "system") {
        const hasAllPerms = toolDef.required_permissions.every((p) => agentPermissions.includes(p));
        if (!hasAllPerms) {
          return this.failExecution(
            execution,
            "authorization_error",
            `Agent '${agent_id}' configuration lacks required permissions for tool '${toolId}': [${toolDef.required_permissions.join(", ")}].`,
            "rejected"
          );
        }
      }
    }

    // Store execution in active map
    this.executions.set(execution.execution_id, execution);
    if (payload.idempotency_key) {
      this.idempotencyIndex.set(`${business_id}:${payload.idempotency_key}`, execution.execution_id);
    }

    // 9. Transition to queued -> running
    execution.status = "queued";
    this.recordEvent(execution, "execution_queued", "Execution validated and placed in run queue", "validating", "queued");

    execution.status = "running";
    execution.started_at = new Date().toISOString();
    this.recordEvent(execution, "execution_started", "Starting execution of tools", "queued", "running");

    agentAuditService.recordEvent({
      event_type: "execution_started",
      event_category: "execution",
      execution_id: execution.execution_id,
      correlation_id,
      agent_id,
      agent_configuration_version: execution.agent_configuration_version,
      business_id,
      category_id: execution.category_id,
      actor_type: caller.isPlatformAdmin ? "admin" : "user",
      actor_id: caller.userId,
      actor_email: caller.email,
      target_type: "execution",
      target_id: execution.execution_id,
      action: "run_execution",
      authorization_decision: "allowed",
      result_status: "success",
      sanitized_metadata: { tools: toolsToExecute },
    });

    this.persistExecutions();

    // 10. Execute Tools Dispatch Loop
    return this.runToolDispatchLoop(execution, toolsToExecute, caller);
  }

  /**
   * Internal tool dispatch loop with retry handling and approval suspension.
   */
  private async runToolDispatchLoop(
    execution: AgentExecutionRecord,
    toolsToExecute: string[],
    caller: { userId: string; email?: string; isPlatformAdmin?: boolean }
  ): Promise<{ execution: AgentExecutionRecord }> {
    const startTime = Date.now();
    const results: Record<string, any> = {};

    const execContext: ToolExecutionContext = {
      actor_id: caller.userId,
      actor_email: caller.email,
      business_id: execution.business_id,
      agent_id: execution.agent_id,
      agent_version: execution.agent_configuration_version,
      contract_version: execution.contract_version,
      is_platform_admin: caller.isPlatformAdmin,
      correlation_id: execution.correlation_id,
    };

    for (const toolId of toolsToExecute) {
      // Check for execution timeout
      if (Date.now() - startTime > execution.timeout_ms) {
        execution.status = "timed_out";
        execution.failure_code = "timeout_error";
        execution.failure_reason = `Execution timed out after ${execution.timeout_ms}ms limit.`;
        this.recordEvent(execution, "execution_timed_out", execution.failure_reason, "running", "timed_out");
        this.finalizeExecution(execution, startTime);
        return { execution };
      }

      const canonicalToolId = TOOL_ALIASES[toolId] || toolId;
      const toolDef = toolGatewayService.getToolById(canonicalToolId);
      const toolVersion = toolDef?.version || "1.0.0";

      // Prepare invocation payload strictly conforming to tool schema
      const schemaProps = toolDef?.input_schema?.properties || {};
      const toolParameters: Record<string, any> = {};

      for (const [key, val] of Object.entries(execution.task_input || {})) {
        if (schemaProps[key]) {
          toolParameters[key] = val;
        }
      }

      // Handle common parameter aliases
      if (schemaProps.echo && !toolParameters.echo) {
        toolParameters.echo = execution.task_input.message || execution.task_input.text || "ping";
      }
      if (schemaProps.productId && !toolParameters.productId) {
        if (execution.task_input.productId || execution.task_input.id) {
          toolParameters.productId = execution.task_input.productId || execution.task_input.id;
        } else if (execution.task_input.sku) {
          const unit = businessDataSyncService.getOrCreateBusinessUnit(execution.business_id);
          const p = (unit.products || []).find(
            (item: any) =>
              (item.sku && item.sku.toLowerCase() === execution.task_input.sku.toLowerCase()) ||
              (item.internal_sku && item.internal_sku.toLowerCase() === execution.task_input.sku.toLowerCase())
          );
          if (p) toolParameters.productId = p.id;
        }
      }
      if (schemaProps.sku && !toolParameters.sku && execution.task_input.sku) {
        toolParameters.sku = execution.task_input.sku;
      }
      if (schemaProps.deltaQuantity && toolParameters.deltaQuantity === undefined) {
        toolParameters.deltaQuantity = Math.abs(execution.task_input.quantity_delta !== undefined ? execution.task_input.quantity_delta : 1);
      }
      if (schemaProps.type && !toolParameters.type) {
        toolParameters.type = (execution.task_input.quantity_delta || 0) < 0 ? "out" : (execution.task_input.type || "in");
      }
      if (schemaProps.reason && !toolParameters.reason) {
        toolParameters.reason = execution.task_input.reason || "Operational adjustment";
      }

      const toolRequest: ToolInvocationRequest = {
        tool_id: canonicalToolId,
        parameters: toolParameters,
        approval_id: execution.approval_reference,
      };

      let attempt = 0;
      let invocationSuccess = false;
      let lastToolResponse: any = null;

      while (attempt <= execution.max_retries && !invocationSuccess) {
        attempt++;
        const toolStart = Date.now();

        this.recordEvent(
          execution,
          "tool_invoked",
          `Invoking tool '${canonicalToolId}' (attempt ${attempt}/${execution.max_retries + 1})`
        );

        const response = await toolGatewayService.invokeTool(toolRequest, execContext);
        const duration = Date.now() - toolStart;
        lastToolResponse = response;

        const isApprovalRequired =
          response.error?.code === "APPROVAL_REQUIRED" ||
          response.metadata?.execution_status === "pending_approval" ||
          Boolean(response.metadata?.approval_id || response.data?.approval_id);

        const invocationRecord: ToolInvocationRecord = {
          invocation_id: `invk_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
          execution_id: execution.execution_id,
          tool_id: canonicalToolId,
          tool_version: toolVersion,
          parameters: toolParameters,
          status: response.success ? "success" : isApprovalRequired ? "pending_approval" : "failed",
          duration_ms: duration,
          result_data: response.data,
          error_message: response.error?.message,
          approval_id: response.metadata?.approval_id || response.data?.approval_id,
          timestamp: new Date().toISOString(),
        };

        execution.tool_invocations.push(invocationRecord);

        // Check if approval is required
        if (isApprovalRequired) {
          const approvalId =
            response.metadata?.approval_id ||
            response.data?.approval_id ||
            response.error?.details?.approval_id;
          execution.status = "awaiting_approval";
          execution.approval_reference = approvalId;
          this.recordEvent(
            execution,
            "approval_requested",
            `Tool '${canonicalToolId}' requires approval. Approval ID: ${approvalId}`,
            "running",
            "awaiting_approval"
          );

          agentAuditService.recordEvent({
            event_type: "approval_requested",
            event_category: "governance",
            execution_id: execution.execution_id,
            correlation_id: execution.correlation_id,
            agent_id: execution.agent_id,
            business_id: execution.business_id,
            category_id: execution.category_id,
            actor_type: "system",
            actor_id: caller.userId,
            target_type: "approval",
            target_id: approvalId || canonicalToolId,
            action: `require_approval:${canonicalToolId}`,
            authorization_decision: "pending_approval",
            approval_reference: approvalId,
            tool_id: canonicalToolId,
            result_status: "success",
            sanitized_metadata: { required_level: toolDef?.risk_tier },
          });

          this.persistExecutions();
          return { execution };
        }

        if (response.success) {
          invocationSuccess = true;
          results[canonicalToolId] = response.data;
          results[toolId] = response.data;
          const rev = REVERSE_TOOL_ALIASES[canonicalToolId];
          if (rev) results[rev] = response.data;
          this.recordEvent(execution, "tool_succeeded", `Tool '${canonicalToolId}' completed successfully in ${duration}ms.`);
          break;
        }

        // Retryable failure check
        const isTransient = response.error?.code === "RATE_LIMIT_EXCEEDED" || response.error?.code === "TIMEOUT";
        if (isTransient && attempt <= execution.max_retries) {
          execution.retry_count++;
          this.recordEvent(execution, "retry_attempted", `Transient failure '${response.error?.code}'. Retrying in 200ms...`);
          await new Promise((r) => setTimeout(r, 200 * attempt));
        } else {
          // Permanent failure or exhausted retries
          break;
        }
      }

      if (!invocationSuccess) {
        execution.status = "failed";
        execution.failure_code = "tool_execution_error";
        execution.failure_reason = `Tool '${canonicalToolId}' failed: ${lastToolResponse?.error?.message || "Execution error"}`;
        this.recordEvent(execution, "tool_failed", execution.failure_reason, "running", "failed");
        this.finalizeExecution(execution, startTime);
        return { execution };
      }
    }

    // All tools completed successfully
    execution.status = "completed";
    execution.result_data = results;
    this.recordEvent(execution, "execution_completed", "All requested tasks and tools executed successfully.", "running", "completed");
    this.finalizeExecution(execution, startTime);

    return { execution };
  }

  /**
   * Resumes an execution that was paused in 'awaiting_approval' once human approval is granted.
   */
  public async resumeApprovedExecution(params: {
    executionId: string;
    approvalId: string;
    decision: "approved" | "rejected";
    notes?: string;
    caller: { userId: string; email?: string; isPlatformAdmin?: boolean };
  }): Promise<{ execution: AgentExecutionRecord; error?: string }> {
    const execution = this.executions.get(params.executionId);
    if (!execution) {
      return { execution: null as any, error: `Execution '${params.executionId}' not found.` };
    }

    if (execution.status !== "awaiting_approval") {
      return {
        execution,
        error: `Execution is in state '${execution.status}' and cannot be resumed (must be 'awaiting_approval').`,
      };
    }

    if (params.decision === "rejected") {
      execution.status = "rejected";
      execution.failure_code = "approval_rejected";
      execution.failure_reason = params.notes || "Human supervisor rejected tool execution approval.";
      this.recordEvent(execution, "approval_rejected", execution.failure_reason, "awaiting_approval", "rejected", params.caller.userId);

      agentAuditService.recordEvent({
        event_type: "approval_rejected",
        event_category: "governance",
        execution_id: execution.execution_id,
        correlation_id: execution.correlation_id,
        agent_id: execution.agent_id,
        business_id: execution.business_id,
        actor_type: params.caller.isPlatformAdmin ? "admin" : "user",
        actor_id: params.caller.userId,
        target_type: "approval",
        target_id: params.approvalId,
        action: "reject_approval",
        authorization_decision: "denied",
        approval_reference: params.approvalId,
        result_status: "rejected",
        sanitized_metadata: { notes: params.notes },
      });

      this.persistExecutions();
      return { execution };
    }

    // Transition to approved
    execution.status = "approved";
    this.recordEvent(
      execution,
      "approval_granted",
      `Approval granted by user ${params.caller.userId}. Resuming tool execution.`,
      "awaiting_approval",
      "approved",
      params.caller.userId
    );

    agentAuditService.recordEvent({
      event_type: "approval_granted",
      event_category: "governance",
      execution_id: execution.execution_id,
      correlation_id: execution.correlation_id,
      agent_id: execution.agent_id,
      business_id: execution.business_id,
      actor_type: params.caller.isPlatformAdmin ? "admin" : "user",
      actor_id: params.caller.userId,
      target_type: "approval",
      target_id: params.approvalId,
      action: "grant_approval",
      authorization_decision: "allowed",
      approval_reference: params.approvalId,
      result_status: "success",
      sanitized_metadata: { notes: params.notes },
    });

    // Move to running and dispatch tools
    execution.status = "running";
    this.recordEvent(execution, "execution_started", "Resuming tool execution after approval", "approved", "running");
    this.persistExecutions();

    execution.approval_reference = params.approvalId;

    // Determine pending tools (tools not yet successful)
    const succeededTools = new Set(
      execution.tool_invocations.filter((t) => t.status === "success").map((t) => t.tool_id)
    );
    const remainingTools = execution.requested_tool_ids.filter((t) => {
      const canonical = TOOL_ALIASES[t] || t;
      return !succeededTools.has(t) && !succeededTools.has(canonical);
    });

    const result = await this.runToolDispatchLoop(execution, remainingTools, params.caller);
    return { execution: result.execution };
  }

  /**
   * Cancels an active or pending execution safely.
   */
  public async cancelExecution(params: {
    executionId: string;
    businessId: string;
    userId: string;
    reason?: string;
    isPlatformAdmin?: boolean;
  }): Promise<{ execution: AgentExecutionRecord; error?: string }> {
    const execution = this.executions.get(params.executionId);
    if (!execution) {
      return { execution: null as any, error: `Execution '${params.executionId}' not found.` };
    }

    if (execution.business_id !== params.businessId && !params.isPlatformAdmin) {
      return { execution: null as any, error: "Access denied: Execution belongs to a different organization." };
    }

    const cancelableStatuses: ExecutionStatus[] = ["pending", "validating", "queued", "running", "awaiting_approval"];
    if (!cancelableStatuses.includes(execution.status)) {
      return {
        execution,
        error: `Cannot cancel execution in state '${execution.status}'. Only pending, queued, running, or awaiting_approval executions can be cancelled.`,
      };
    }

    const prevStatus = execution.status;
    execution.status = "cancelled";
    execution.cancellation_reason = params.reason || "Cancelled by user or operator.";
    execution.cancelled_by = params.userId;
    execution.completed_at = new Date().toISOString();

    this.recordEvent(
      execution,
      "execution_cancelled",
      `Execution cancelled by ${params.userId}. Reason: ${execution.cancellation_reason}`,
      prevStatus,
      "cancelled",
      params.userId
    );

    agentAuditService.recordEvent({
      event_type: "execution_cancelled",
      event_category: "execution",
      execution_id: execution.execution_id,
      correlation_id: execution.correlation_id,
      agent_id: execution.agent_id,
      business_id: execution.business_id,
      actor_type: params.isPlatformAdmin ? "admin" : "user",
      actor_id: params.userId,
      target_type: "execution",
      target_id: execution.execution_id,
      action: "cancel_execution",
      authorization_decision: "allowed",
      result_status: "cancelled",
      sanitized_metadata: { reason: execution.cancellation_reason },
    });

    this.persistExecutions();
    return { execution };
  }

  /**
   * Organization-scoped single execution retrieval.
   */
  public getExecutionById(
    executionId: string,
    businessId: string,
    isPlatformAdmin?: boolean
  ): AgentExecutionRecord | null {
    const execution = this.executions.get(executionId);
    if (!execution) return null;
    if (execution.business_id !== businessId && !isPlatformAdmin) {
      return null;
    }
    return execution;
  }

  /**
   * Paginated, filtered execution query with organization boundary enforcement.
   */
  public async listExecutions(
    filter: ExecutionFilterOptions,
    caller: { userId: string; isPlatformAdmin?: boolean }
  ): Promise<{
    executions: AgentExecutionRecord[];
    total: number;
    offset: number;
    limit: number;
  }> {
    if (!filter.business_id) {
      throw new Error("business_id is required to list executions.");
    }

    const auth = await organizationAuthService.authorizeOrganizationAccess({
      userId: caller.userId,
      businessId: filter.business_id,
      isPlatformAdmin: caller.isPlatformAdmin,
    });

    if (!auth.allowed) {
      throw new Error(`Execution list access denied: ${auth.reason || "Unauthorized"}`);
    }

    let records = Array.from(this.executions.values()).filter(
      (r) => r.business_id === filter.business_id
    );

    if (filter.agent_id) {
      const cleanAgentId = filter.agent_id.trim().toUpperCase();
      records = records.filter((r) => r.agent_id.toUpperCase() === cleanAgentId);
    }
    if (filter.category_id) {
      records = records.filter((r) => r.category_id === filter.category_id);
    }
    if (filter.status) {
      records = records.filter((r) => r.status === filter.status);
    }
    if (filter.task_type) {
      records = records.filter((r) => r.task_type === filter.task_type);
    }
    if (filter.requesting_user_id) {
      records = records.filter((r) => r.requesting_user_id === filter.requesting_user_id);
    }
    if (filter.start_date) {
      const startMs = new Date(filter.start_date).getTime();
      records = records.filter((r) => new Date(r.created_at).getTime() >= startMs);
    }
    if (filter.end_date) {
      const endMs = new Date(filter.end_date).getTime();
      records = records.filter((r) => new Date(r.created_at).getTime() <= endMs);
    }

    // Newest first
    records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = records.length;
    const offset = Math.max(0, filter.offset || 0);
    const limit = Math.min(100, Math.max(1, filter.limit || 50));
    const paginated = records.slice(offset, offset + limit);

    return {
      executions: paginated,
      total,
      offset,
      limit,
    };
  }

  /**
   * Computes execution metrics and agent observability stats.
   */
  public async getExecutionMetrics(
    businessId: string,
    caller: { userId: string; isPlatformAdmin?: boolean }
  ): Promise<ExecutionMetrics> {
    const auth = await organizationAuthService.authorizeOrganizationAccess({
      userId: caller.userId,
      businessId,
      isPlatformAdmin: caller.isPlatformAdmin,
    });

    if (!auth.allowed) {
      throw new Error(`Metrics access denied: ${auth.reason || "Unauthorized"}`);
    }

    const records = Array.from(this.executions.values()).filter((r) => r.business_id === businessId);

    let completed = 0;
    let failed = 0;
    let rejected = 0;
    let cancelled = 0;
    let timed_out = 0;
    let awaiting_approval = 0;
    let totalDurationMs = 0;
    let completedWithDuration = 0;
    let totalToolInvocations = 0;
    let failedToolInvocations = 0;
    let totalRetries = 0;

    const agentActivity: Record<string, { count: number; completed: number; failed: number }> = {};

    for (const rec of records) {
      switch (rec.status) {
        case "completed":
          completed++;
          if (rec.duration_ms) {
            totalDurationMs += rec.duration_ms;
            completedWithDuration++;
          }
          break;
        case "failed":
          failed++;
          break;
        case "rejected":
          rejected++;
          break;
        case "cancelled":
          cancelled++;
          break;
        case "timed_out":
          timed_out++;
          break;
        case "awaiting_approval":
          awaiting_approval++;
          break;
      }

      totalRetries += rec.retry_count || 0;
      totalToolInvocations += rec.tool_invocations?.length || 0;
      failedToolInvocations += (rec.tool_invocations || []).filter((t) => t.status === "failed").length;

      if (!agentActivity[rec.agent_id]) {
        agentActivity[rec.agent_id] = { count: 0, completed: 0, failed: 0 };
      }
      agentActivity[rec.agent_id].count++;
      if (rec.status === "completed") agentActivity[rec.agent_id].completed++;
      if (rec.status === "failed") agentActivity[rec.agent_id].failed++;
    }

    const avgDuration = completedWithDuration > 0 ? Math.round(totalDurationMs / completedWithDuration) : 0;

    return {
      business_id: businessId,
      total_executions: records.length,
      completed_executions: completed,
      failed_executions: failed,
      rejected_executions: rejected,
      cancelled_executions: cancelled,
      timed_out_executions: timed_out,
      awaiting_approval_executions: awaiting_approval,
      average_duration_ms: avgDuration,
      total_tool_invocations: totalToolInvocations,
      failed_tool_invocations: failedToolInvocations,
      total_retries: totalRetries,
      agent_activity: agentActivity,
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Helper to mark execution as failed/rejected and record audit logs.
   */
  private failExecution(
    execution: AgentExecutionRecord,
    code: ExecutionFailureCode,
    reason: string,
    terminalStatus: "rejected" | "failed"
  ): { execution: AgentExecutionRecord } {
    execution.status = terminalStatus;
    execution.failure_code = code;
    execution.failure_reason = reason;
    execution.completed_at = new Date().toISOString();

    const eventType = terminalStatus === "rejected" ? "execution_rejected" : "execution_failed";
    this.recordEvent(execution, eventType, reason, "validating", terminalStatus);

    this.executions.set(execution.execution_id, execution);
    this.persistExecutions();

    agentAuditService.recordEvent({
      event_type: eventType,
      event_category: code.includes("auth") ? "security" : "execution",
      execution_id: execution.execution_id,
      correlation_id: execution.correlation_id,
      agent_id: execution.agent_id,
      business_id: execution.business_id,
      category_id: execution.category_id,
      actor_type: "system",
      actor_id: execution.requesting_user_id,
      target_type: "execution",
      target_id: execution.execution_id,
      action: `fail_execution:${code}`,
      authorization_decision: terminalStatus === "rejected" ? "denied" : "allowed",
      result_status: terminalStatus,
      failure_code: code,
      sanitized_metadata: { reason },
    });

    return { execution };
  }

  /**
   * Helper to complete or terminate execution with duration calculation.
   */
  private finalizeExecution(execution: AgentExecutionRecord, startTime: number): void {
    execution.completed_at = new Date().toISOString();
    execution.duration_ms = Date.now() - startTime;
    execution.updated_at = execution.completed_at;

    this.executions.set(execution.execution_id, execution);
    this.persistExecutions();

    agentAuditService.recordEvent({
      event_type: execution.status === "completed" ? "execution_completed" : "execution_failed",
      event_category: "execution",
      execution_id: execution.execution_id,
      correlation_id: execution.correlation_id,
      agent_id: execution.agent_id,
      agent_configuration_version: execution.agent_configuration_version,
      business_id: execution.business_id,
      category_id: execution.category_id,
      actor_type: "agent",
      actor_id: execution.agent_id,
      target_type: "execution",
      target_id: execution.execution_id,
      action: `finalize_execution:${execution.status}`,
      authorization_decision: "allowed",
      result_status: execution.status === "completed" ? "success" : "failed",
      failure_code: execution.failure_code,
      sanitized_metadata: {
        duration_ms: execution.duration_ms,
        tool_count: execution.tool_invocations.length,
        retries: execution.retry_count,
      },
    });
  }
}

export const agentExecutionEngine = new AgentExecutionEngine();
