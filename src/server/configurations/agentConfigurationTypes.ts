/**
 * GeFlow AI — Agent Configuration Framework Types (Step 12)
 *
 * Defines the standardized configuration contract (Sections A–H),
 * schema interfaces, validation structures, organization override models,
 * and immutable resolved runtime configuration snapshots for all 29 agents.
 */

export type ConfigurationLifecycleStatus =
  | "draft"
  | "validating"
  | "validated"
  | "approved"
  | "active"
  | "superseded"
  | "deprecated"
  | "archived";

export type TimezoneBehavior = "business_local" | "utc" | "user_device";
export type ResponseStyle = "concise" | "detailed" | "analytical" | "instructional";
export type ResponseDetailLevel = "summary" | "standard" | "exhaustive";
export type ConfirmationBehavior = "always_confirm_high_risk" | "standard" | "autonomous";
export type RetryPolicyRef = "standard_exponential" | "no_retry" | "linear";
export type ConcurrencyPolicyRef = "sequential" | "concurrent_read";
export type ApprovalPolicyRef = "gateway_risk_tier" | "manager_only" | "automatic";
export type ExecutionMode = "standard" | "dry_run" | "simulation";
export type OrganizationContextPolicy = "strict_tenant_isolation" | "read_tenant_catalog";
export type CategoryContextPolicy = "strict_category_boundary" | "permissive_category_read";
export type DataAccessScope = "business_operational_only" | "full_organization";

// ==========================================
// SECTION A–H: COMMON CONFIGURATION CONTRACT
// ==========================================

export interface AgentConfigurationIdentity {
  agent_id: string; // Permanent canonical ID (AGT-001 .. AGT-029)
  agent_name: string; // Official Agent Name
  agent_type: "category_specialized";
  primary_category_id: string; // Standard Category ID (CAT-001 .. CAT-029)
  configuration_id: string; // Unique configuration ID (e.g. cfg_agt001_1_0_0)
  configuration_version: string; // Semantic version (e.g. 1.0.0)
  contract_version: string; // Standardized contract version (e.g. 1.0)
}

export interface AgentGeneralSettings {
  display_name: string;
  description: string;
  enabled_status: boolean;
  supported_languages: string[];
  default_locale: string;
  timezone_behavior: TimezoneBehavior;
}

export interface AgentBehaviorSettings {
  response_style: ResponseStyle;
  response_detail_level: ResponseDetailLevel;
  task_handling_preferences: {
    auto_execute_read_only: boolean;
    require_confirmation_for_write: boolean;
    strict_schema_enforcement: boolean;
  };
  confirmation_behavior: ConfirmationBehavior;
  error_handling_preferences: {
    retry_transient_failures: boolean;
    fallback_to_safe_mode: boolean;
    expose_internal_traces: boolean;
  };
}

export interface AgentCapabilitySettings {
  enabled_capabilities: string[];
  disabled_capabilities: string[];
  capability_limits: Record<string, number>;
  supported_task_types: string[];
}

export interface AgentToolSettings {
  allowed_tool_ids: string[];
  restricted_tool_ids: string[];
  tool_configuration: Record<string, any>;
  tool_execution_preferences: {
    timeout_override_ms?: number;
    max_retries?: number;
    enforce_rate_limits: boolean;
  };
}

export interface AgentExecutionSettings {
  execution_timeout: number; // in milliseconds
  retry_policy_reference: RetryPolicyRef;
  concurrency_policy_reference: ConcurrencyPolicyRef;
  approval_policy_reference: ApprovalPolicyRef;
  execution_mode: ExecutionMode;
}

export interface AgentContextSettings {
  organization_context_policy: OrganizationContextPolicy;
  category_context_policy: CategoryContextPolicy;
  data_access_scope: DataAccessScope;
  context_visibility_rules: {
    allow_cross_location: boolean;
    allow_historical_lookback_days: number;
  };
}

export interface AgentMetadataSettings {
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
  schema_version: string;
  configuration_status: ConfigurationLifecycleStatus;
}

/**
 * Standardized Common Configuration Contract shared by all 29 agents.
 */
export interface CommonAgentConfiguration {
  identity: AgentConfigurationIdentity;
  general: AgentGeneralSettings;
  behavior: AgentBehaviorSettings;
  capabilities: AgentCapabilitySettings;
  tools: AgentToolSettings;
  execution: AgentExecutionSettings;
  context: AgentContextSettings;
  metadata: AgentMetadataSettings;
  agent_specific_parameters?: Record<string, any>;
}

// ==========================================
// CONFIGURATION SCHEMA DEFINITION
// ==========================================

export interface ConfigurationFieldDefinition {
  field_name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required: boolean;
  default_value?: any;
  allowed_values?: any[];
  min_value?: number;
  max_value?: number;
  min_length?: number;
  max_length?: number;
  is_protected?: boolean; // Cannot be altered by organization override
}

export interface AgentConfigurationSchema {
  schema_id: string; // e.g. schema_agt001_v1_0_0
  schema_version: string; // e.g. 1.0.0
  agent_id: string; // Canonical Agent ID or "*" for base common schema
  primary_category_id?: string;
  required_fields: string[];
  optional_fields: string[];
  field_definitions: Record<string, ConfigurationFieldDefinition>;
  validation_rules: {
    max_execution_timeout_ms: number;
    min_execution_timeout_ms: number;
    disallowed_override_fields: string[];
  };
  default_values: Record<string, any>;
  compatibility_rules: {
    minimum_contract_version: string;
    maximum_contract_version?: string;
  };
  schema_status: "active" | "deprecated";
  created_at: string;
}

export interface ConfigurationValidationResult {
  is_valid: boolean;
  schema_id: string;
  schema_version: string;
  validation_errors: string[];
  validation_warnings: string[];
  normalized_configuration?: CommonAgentConfiguration;
}

// ==========================================
// ORGANIZATION-LEVEL CONFIGURATION OVERRIDE
// ==========================================

export interface OrganizationAgentConfigurationOverride {
  override_id: string; // ovr_biz_agt_xxx
  business_id: string;
  agent_id: string;
  category_id: string;
  display_name_override?: string;
  response_style_override?: ResponseStyle;
  response_detail_level_override?: ResponseDetailLevel;
  execution_timeout_override?: number;
  disabled_capabilities_override?: string[]; // May only disable, cannot add new capabilities
  restricted_tool_ids_override?: string[]; // May only restrict, cannot add new tools
  custom_parameters?: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
  status: "active" | "disabled";
}

// ==========================================
// RESOLVED IMMUTABLE EXECUTION SNAPSHOT
// ==========================================

export interface ResolvedAgentConfigurationSnapshot {
  snapshot_id: string;
  agent_id: string;
  agent_name: string;
  business_id: string;
  category_id: string;
  configuration_version: string;
  contract_version: string;
  schema_version: string;
  effective_configuration: CommonAgentConfiguration;
  applied_organization_override_id?: string;
  resolved_at: string;
  integrity_hash: string; // SHA-256 fingerprint of the snapshot
}
