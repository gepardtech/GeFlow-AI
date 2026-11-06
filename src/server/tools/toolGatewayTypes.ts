/**
 * GeFlow AI — Shared Tool Gateway Types & Interfaces (Step 10)
 *
 * Implements strict schemas, lifecycle statuses, execution contexts,
 * approval states, and audit models for the centralized Tool Gateway.
 */

export type ToolLifecycleStatus = "draft" | "active" | "inactive" | "deprecated" | "archived";
export type ToolOperationType = "read" | "write" | "destructive";

export interface ToolApprovalPolicy {
  requires_approval: boolean;
  approval_criteria?: {
    field?: string;
    threshold?: number;
    condition?: "greater_than" | "equals" | "always";
  };
  approver_role?: "owner" | "admin" | "manager";
}

export interface ToolExecutionPolicy {
  idempotent: boolean;
  max_payload_size_bytes?: number;
  rate_limit_per_minute?: number;
}

export interface ToolTimeoutPolicy {
  timeout_ms: number;
}

export interface ToolPropertySchema {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  items?: ToolPropertySchema;
  properties?: Record<string, ToolPropertySchema>;
}

export interface ToolSchemaContract {
  type: "object";
  properties: Record<string, ToolPropertySchema>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolDefinition {
  tool_id: string;
  tool_name: string;
  description: string;
  category: "inventory" | "pos" | "returns" | "reports" | "analytics" | "system";
  module_id: "inventory" | "pos" | "returns" | "reports" | "analytics" | "system";
  version: string;
  status: ToolLifecycleStatus;
  operation_type: ToolOperationType;
  input_schema: ToolSchemaContract;
  output_schema: Record<string, any>;
  required_permissions: string[];
  allowed_agent_ids: string[] | "*";
  approval_policy: ToolApprovalPolicy;
  execution_policy: ToolExecutionPolicy;
  timeout_policy: ToolTimeoutPolicy;
  is_test_fixture?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ToolExecutionContext {
  agent_id: string;
  agent_version: string;
  contract_version: string;
  organization_id?: string;
  business_id: string;
  category_id?: string;
  actor_id: string;
  actor_email?: string;
  user_role?: string;
  request_id: string;
  correlation_id?: string;
  is_platform_admin?: boolean;
}

export interface ToolInvocationRequest {
  tool_id: string;
  tool_version?: string;
  parameters: Record<string, any>;
  idempotency_key?: string;
  context?: Partial<ToolExecutionContext>;
}

export interface ToolInvocationResponse {
  success: boolean;
  tool_id: string;
  tool_version: string;
  request_id: string;
  data: any;
  error: {
    code: string;
    message: string;
    details?: any;
  } | null;
  metadata: {
    execution_status: "completed" | "pending_approval" | "failed" | "rejected" | "rate_limited" | "timeout";
    execution_duration_ms: number;
    timestamp: string;
    approval_id?: string;
  };
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "cancelled";

export interface ToolApprovalRecord {
  id: string;
  tool_id: string;
  tool_version: string;
  agent_id: string;
  business_id: string;
  actor_id: string;
  actor_email?: string;
  input_params: Record<string, any>;
  status: ApprovalStatus;
  reason: string;
  created_at: string;
  expires_at: string;
  decided_at?: string;
  decided_by?: string;
  decision_reason?: string;
  execution_result?: any;
  execution_error?: string;
}

export interface ToolAuditRecord {
  id: string;
  request_id: string;
  correlation_id: string;
  tool_id: string;
  tool_version: string;
  agent_id: string;
  agent_version: string;
  contract_version: string;
  business_id: string;
  category_id?: string;
  actor_id: string;
  actor_email?: string;
  action: string;
  status: "success" | "denied" | "pending_approval" | "failed" | "rate_limited" | "timeout";
  error_code?: string;
  error_message?: string;
  duration_ms: number;
  timestamp: string;
}

export interface ToolDiscoveryFilter {
  agent_id?: string;
  business_id?: string;
  user_id?: string;
  module_id?: string;
  category?: string;
}
