/**
 * GeFlow AI — Agent Registry & Versioning Definitions (Step 08 & Step 09)
 *
 * Implements the data models, contracts, semantic versioning rules,
 * configuration snapshots, and lifecycle statuses for the 29-Agent Master Registry.
 */

export type AgentLifecycleStatus = "registered" | "active" | "inactive" | "deprecated" | "archived";

export type VersionLifecycleStatus =
  | "draft"
  | "validated"
  | "approved"
  | "active"
  | "superseded"
  | "deprecated"
  | "archived";

export type VersionChangeType = "major" | "minor" | "patch" | "rollback";

export interface AgentConfigurationDetails {
  responsibilities: string[];
  operational_boundaries: string[];
  supported_modules: string[];
  specialized_domain: string;
  default_risk_tier: "low" | "medium" | "high";
  prompt_persona?: string;
  parameters?: Record<string, any>;
}

export interface AgentRegistryEntry {
  id: string; // Internal UUID
  agent_id: string; // Permanent canonical identifier (AGT-001 .. AGT-029)
  name: string; // Official Agent Name
  description: string; // Agent functional purpose
  agent_type: "category_specialized";
  primary_category_id: string; // Standard Category ID (CAT-001 .. CAT-029)
  database_category_id?: string; // Resolved Supabase UUID of business category
  status: AgentLifecycleStatus;
  version: string; // Active Semantic configuration version (e.g. "1.0.0")
  contract_version: string; // Active Compatible contract version (e.g. "1.0")
  active_version_id?: string; // Pointer to current active AgentVersionRecord
  capabilities: string[]; // Declared capability identifiers
  permissions: string[]; // Declared permission references
  configuration: AgentConfigurationDetails;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

/**
 * Immutable historical configuration version record for an agent.
 */
export interface AgentVersionRecord {
  id: string; // Unique Version Record ID (e.g. ver_agt001_1_0_0)
  agent_id: string; // Permanent Agent ID (AGT-001 .. AGT-029)
  version: string; // Semantic version string "MAJOR.MINOR.PATCH"
  contract_version: string; // Declared contract version (e.g. "1.0")
  configuration: AgentConfigurationDetails; // Complete snapshot of configuration
  capabilities: string[]; // Snapshot of capabilities
  permissions: string[]; // Snapshot of permissions
  configuration_hash: string; // Deterministic SHA-256 fingerprint of the configuration
  status: VersionLifecycleStatus;
  change_type: VersionChangeType;
  change_summary: string;
  created_at: string;
  created_by?: string;
  created_by_email?: string;
  approved_at?: string;
  approved_by?: string;
  published_at?: string;
  published_by?: string;
  previous_version_id?: string;
  rollback_source_version_id?: string; // If created by rollback, points to original historical version
}

/**
 * Contract specification definition record.
 */
export interface ContractVersionDefinition {
  contract_version_id: string; // e.g. "contract_v1_0"
  version: string; // "1.0"
  schema_definition: {
    request_envelope_version: string;
    response_envelope_version: string;
    required_context_fields: string[];
    allowed_risk_tiers: string[];
  };
  compatibility_policy: "strict" | "backward_compatible";
  status: "active" | "deprecated";
  created_at: string;
  created_by: string;
  change_summary: string;
}

/**
 * Category-to-Agent 1:1 Association with mapping versioning.
 */
export interface CategoryToAgentAssociation {
  id: string; // Association UUID
  category_id: string; // Standard CAT-XXX ID or Supabase category UUID
  standard_category_id: string; // Standard CAT-001 .. CAT-029
  category_name: string;
  agent_id: string; // AGT-001 .. AGT-029
  agent_name: string;
  is_primary: boolean;
  mapping_version: string; // e.g. "1.0"
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  previous_mapping_id?: string;
}

/**
 * Audit log entry for versioning and registry mutations.
 */
export interface AgentRegistryAuditEntry {
  id: string;
  agent_id: string;
  version_id?: string;
  version_number?: string;
  actor_id?: string;
  actor_email?: string;
  action:
    | "register"
    | "update_metadata"
    | "create_version"
    | "validate_version"
    | "approve_version"
    | "activate_version"
    | "rollback_version"
    | "deprecate_version"
    | "archive_version"
    | "update_configuration"
    | "update_status"
    | "update_mapping";
  previous_state?: Partial<AgentRegistryEntry> | Partial<AgentVersionRecord>;
  new_state: Partial<AgentRegistryEntry> | Partial<AgentVersionRecord>;
  timestamp: string;
  reason?: string;
  result?: "allowed" | "denied" | "success" | "failed";
}

/**
 * Detailed configuration diff report between two versions.
 */
export interface ConfigurationComparisonResult {
  agent_id: string;
  from_version: string;
  to_version: string;
  is_compatible: boolean;
  contract_changed: boolean;
  from_contract: string;
  to_contract: string;
  added_responsibilities: string[];
  removed_responsibilities: string[];
  added_boundaries: string[];
  removed_boundaries: string[];
  added_modules: string[];
  removed_modules: string[];
  added_capabilities: string[];
  removed_capabilities: string[];
  added_permissions: string[];
  removed_permissions: string[];
  domain_changed: boolean;
  from_domain: string;
  to_domain: string;
  risk_tier_changed: boolean;
  from_risk_tier: string;
  to_risk_tier: string;
  parameter_differences: Record<string, { from: any; to: any }>;
  summary: string;
}

export interface AgentRegistryDataStore {
  version: string;
  agents: AgentRegistryEntry[];
  associations: CategoryToAgentAssociation[];
  version_records: AgentVersionRecord[];
  contract_versions: ContractVersionDefinition[];
  audit_logs: AgentRegistryAuditEntry[];
  last_updated: string;
}
