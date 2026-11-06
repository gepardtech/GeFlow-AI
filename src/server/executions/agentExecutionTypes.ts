/**
 * GeFlow AI — Agent Execution & Centralized Audit Logging Types (Step 11)
 *
 * Implements strict request contracts, execution state machines, tool invocation
 * tracking, idempotency records, and centralized audit event schemas for all 29 agents.
 */

export type ExecutionStatus =
  | "pending"
  | "validating"
  | "awaiting_approval"
  | "approved"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "rejected"
  | "cancelled"
  | "timed_out";

export type ExecutionFailureCode =
  | "authentication_error"
  | "authorization_error"
  | "validation_error"
  | "approval_required"
  | "approval_rejected"
  | "agent_unavailable"
  | "configuration_error"
  | "tool_execution_error"
  | "business_rule_error"
  | "timeout_error"
  | "dependency_error"
  | "internal_error";

export type TaskType =
  | "inventory_audit"
  | "stock_adjustment"
  | "sales_summary"
  | "held_orders_review"
  | "returns_inspection"
  | "catalog_lookup"
  | "pos_transaction"
  | "diagnostic_echo"
  | "custom_tool_run";

export interface ToolInvocationRecord {
  invocation_id: string;
  execution_id: string;
  tool_id: string;
  tool_version: string;
  parameters: Record<string, any>;
  status: "success" | "failed" | "pending_approval" | "rate_limited" | "timed_out";
  duration_ms: number;
  result_data?: any;
  error_message?: string;
  approval_id?: string;
  timestamp: string;
}

export interface ExecutionEventRecord {
  event_id: string;
  execution_id: string;
  event_type:
    | "execution_requested"
    | "execution_validated"
    | "execution_rejected"
    | "execution_queued"
    | "execution_started"
    | "execution_paused"
    | "approval_requested"
    | "approval_granted"
    | "approval_rejected"
    | "tool_invoked"
    | "tool_succeeded"
    | "tool_failed"
    | "retry_attempted"
    | "execution_completed"
    | "execution_failed"
    | "execution_cancelled"
    | "execution_timed_out";
  from_status?: ExecutionStatus;
  to_status?: ExecutionStatus;
  detail: string;
  actor_id?: string;
  timestamp: string;
}

export interface AgentExecutionRecord {
  execution_id: string;
  agent_id: string;
  agent_name: string;
  agent_configuration_version: string;
  contract_version: string;
  organization_id?: string;
  business_id: string;
  category_id: string;
  category_name?: string;
  requesting_user_id: string;
  requesting_user_email?: string;
  task_type: TaskType;
  task_input: Record<string, any>;
  requested_tool_ids: string[];
  status: ExecutionStatus;
  failure_code?: ExecutionFailureCode;
  failure_reason?: string;
  approval_reference?: string;
  idempotency_key?: string;
  correlation_id: string;
  retry_count: number;
  max_retries: number;
  timeout_ms: number;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  cancellation_reason?: string;
  cancelled_by?: string;
  result_data?: any;
  tool_invocations: ToolInvocationRecord[];
  events: ExecutionEventRecord[];
  created_at: string;
  updated_at: string;
}

export type AuditEventCategory = "execution" | "security" | "governance";

export interface AgentAuditEventRecord {
  audit_event_id: string;
  event_type: string;
  event_category: AuditEventCategory;
  event_timestamp: string;
  execution_id?: string;
  correlation_id: string;
  agent_id?: string;
  agent_configuration_version?: string;
  business_id: string;
  category_id?: string;
  actor_type: "user" | "agent" | "system" | "admin";
  actor_id: string;
  actor_email?: string;
  target_type: "execution" | "agent" | "tool" | "approval" | "policy";
  target_id: string;
  action: string;
  authorization_decision: "allowed" | "denied" | "pending_approval";
  approval_reference?: string;
  tool_id?: string;
  result_status: "success" | "failed" | "rejected" | "cancelled" | "timeout";
  failure_code?: string;
  sanitized_metadata: Record<string, any>;
  previous_event_hash?: string;
  event_hash: string;
}

export interface ExecutionRequestPayload {
  agent_id: string;
  business_id: string;
  task_type: TaskType;
  task_input: Record<string, any>;
  requested_tool_ids?: string[];
  agent_version?: string;
  contract_version?: string;
  idempotency_key?: string;
  approval_reference?: string;
  correlation_id?: string;
  timeout_ms?: number;
}

export interface ExecutionFilterOptions {
  business_id?: string;
  agent_id?: string;
  category_id?: string;
  status?: ExecutionStatus;
  requesting_user_id?: string;
  task_type?: TaskType;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface ExecutionMetrics {
  business_id: string;
  total_executions: number;
  completed_executions: number;
  failed_executions: number;
  rejected_executions: number;
  cancelled_executions: number;
  timed_out_executions: number;
  awaiting_approval_executions: number;
  average_duration_ms: number;
  total_tool_invocations: number;
  failed_tool_invocations: number;
  total_retries: number;
  agent_activity: Record<string, { count: number; completed: number; failed: number }>;
  generated_at: string;
}
