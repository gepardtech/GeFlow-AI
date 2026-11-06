/**
 * GeFlow AI — Agent Registry Service (Step 08)
 *
 * The authoritative backend source for managing, validating, retrieving,
 * and maintaining the 29-Agent Master Registry and Category Associations.
 *
 * Persists to data/agent_registry.json and syncs with Supabase platform_settings.
 */

import fs from "fs";
import path from "path";
import { serverSupabase } from "../supabase";
import {
  AgentRegistryEntry,
  CategoryToAgentAssociation,
  AgentRegistryAuditEntry,
  AgentRegistryDataStore,
  AgentLifecycleStatus,
  AgentVersionRecord,
  ContractVersionDefinition,
} from "./agentRegistryTypes";
import { CANONICAL_29_AGENTS } from "./canonicalAgentsData";

const REGISTRY_STORE_PATH = path.join(process.cwd(), "data", "agent_registry.json");
const CURRENT_REGISTRY_VERSION = "1.0.0";
const CURRENT_CONTRACT_VERSION = "1.0";

export class AgentRegistryService {
  private store: AgentRegistryDataStore = {
    version: CURRENT_REGISTRY_VERSION,
    agents: [],
    associations: [],
    version_records: [],
    contract_versions: [
      {
        contract_version_id: "contract_v1_0",
        version: "1.0",
        schema_definition: {
          request_envelope_version: "1.0",
          response_envelope_version: "1.0",
          required_context_fields: ["tenant", "agent", "actor", "request"],
          allowed_risk_tiers: ["low", "medium", "high"],
        },
        compatibility_policy: "backward_compatible",
        status: "active",
        created_at: "2026-11-04T00:00:00Z",
        created_by: "system_architecture",
        change_summary: "Initial standardized contract specification v1.0",
      },
    ],
    audit_logs: [],
    last_updated: new Date().toISOString(),
  };

  private isInitialized = false;

  constructor() {
    this.seedInitialStore();
    this.initializeRegistry();
  }

  /**
   * Synchronously populates all 29 canonical agents and associations from memory
   * and local disk before asynchronous Supabase sync completes.
   */
  private seedInitialStore(): void {
    if (fs.existsSync(REGISTRY_STORE_PATH)) {
      try {
        const raw = fs.readFileSync(REGISTRY_STORE_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.agents) && parsed.agents.length === 29) {
          this.store = parsed;
          return;
        }
      } catch (e) {
        console.warn("Notice reading agent_registry.json in seedInitialStore:", e);
      }
    }

    const now = new Date().toISOString();
    this.store.agents = CANONICAL_29_AGENTS.map((seed) => {
      const activeVersionId = `ver_${seed.agent_id.toLowerCase()}_1_0_0`;
      return {
        id: `agent_${seed.agent_id.toLowerCase()}_init`,
        agent_id: seed.agent_id,
        name: seed.name,
        description: seed.description,
        agent_type: "category_specialized",
        primary_category_id: seed.standard_category_id,
        status: "active",
        version: CURRENT_REGISTRY_VERSION,
        contract_version: CURRENT_CONTRACT_VERSION,
        active_version_id: activeVersionId,
        capabilities: seed.capabilities,
        permissions: seed.permissions,
        configuration: {
          responsibilities: seed.responsibilities,
          operational_boundaries: seed.operational_boundaries,
          supported_modules: seed.supported_modules,
          specialized_domain: seed.industry_type,
          default_risk_tier: "low",
        },
        created_at: now,
        updated_at: now,
        created_by: "system_master_seed",
      };
    });

    this.store.associations = CANONICAL_29_AGENTS.map((seed) => ({
      id: `assoc_${seed.standard_category_id.toLowerCase()}_${seed.agent_id.toLowerCase()}`,
      category_id: seed.standard_category_id,
      standard_category_id: seed.standard_category_id,
      category_name: seed.category_name,
      agent_id: seed.agent_id,
      agent_name: seed.name,
      is_primary: true,
      mapping_version: "1.0",
      status: "active",
      created_at: now,
      updated_at: now,
    }));

    // Ensure initial version_records exist for all 29 agents
    if (!this.store.version_records || this.store.version_records.length === 0) {
      this.store.version_records = CANONICAL_29_AGENTS.map((seed) => {
        const canonicalConfig = {
          responsibilities: seed.responsibilities,
          operational_boundaries: seed.operational_boundaries,
          supported_modules: seed.supported_modules,
          specialized_domain: seed.industry_type,
          default_risk_tier: "low" as const,
          prompt_persona: "",
          parameters: {},
        };
        const configHash = require("crypto")
          .createHash("sha256")
          .update(
            JSON.stringify({
              contract_version: CURRENT_CONTRACT_VERSION,
              specialized_domain: seed.industry_type,
              default_risk_tier: "low",
              prompt_persona: "",
              parameters: {},
              responsibilities: [...seed.responsibilities].sort(),
              operational_boundaries: [...seed.operational_boundaries].sort(),
              supported_modules: [...seed.supported_modules].sort(),
              capabilities: [...seed.capabilities].sort(),
              permissions: [...seed.permissions].sort(),
            })
          )
          .digest("hex");

        return {
          id: `ver_${seed.agent_id.toLowerCase()}_1_0_0`,
          agent_id: seed.agent_id,
          version: CURRENT_REGISTRY_VERSION,
          contract_version: CURRENT_CONTRACT_VERSION,
          configuration: canonicalConfig,
          capabilities: seed.capabilities,
          permissions: seed.permissions,
          configuration_hash: configHash,
          status: "active" as const,
          change_type: "patch" as const,
          change_summary: "Initial baseline configuration v1.0.0",
          created_at: now,
          created_by: "system_master_seed",
          created_by_email: "system@geflow.app",
          approved_at: now,
          approved_by: "system_master_seed",
          published_at: now,
          published_by: "system_master_seed",
        };
      });
    }

    this.persist();
  }

  /**
   * Initializes or loads the agent registry.
   * Loads from disk backup, syncs with Supabase platform_settings,
   * and runs an idempotent seed if agents are missing.
   */
  public async initializeRegistry(): Promise<void> {
    try {
      // 1. Read from local persistent disk
      if (fs.existsSync(REGISTRY_STORE_PATH)) {
        try {
          const raw = fs.readFileSync(REGISTRY_STORE_PATH, "utf-8");
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed?.agents) && parsed.agents.length > 0) {
            this.store = parsed;
          }
        } catch (e) {
          console.warn("Notice reading agent_registry.json:", e);
        }
      }

      // 2. Sync from Supabase platform_settings
      try {
        const { data: row } = await serverSupabase
          .from("platform_settings")
          .select("id, alerts")
          .limit(1)
          .maybeSingle();

        if (row?.alerts && typeof row.alerts === "object") {
          const cloudStore = (row.alerts as any).agent_registry as AgentRegistryDataStore;
          if (Array.isArray(cloudStore?.agents) && cloudStore.agents.length > 0) {
            // Merge cloud entries if newer or richer
            if (this.store.agents.length === 0 || cloudStore.agents.length >= this.store.agents.length) {
              this.store = cloudStore;
            }
          }
        }
      } catch (cloudErr) {
        console.warn("Notice syncing agent_registry from platform_settings:", cloudErr);
      }

      // 3. Resolve database category UUIDs from business_categories table
      const dbCatMap = new Map<string, string>(); // Name/standard ID -> Database UUID
      try {
        const { data: dbCategories } = await serverSupabase
          .from("business_categories")
          .select("id, name, industry_type");

        (dbCategories || []).forEach((c) => {
          dbCatMap.set(c.name.trim().toLowerCase(), c.id);
          if (c.industry_type) {
            dbCatMap.set(c.industry_type.trim().toLowerCase(), c.id);
          }
        });
      } catch (dbErr) {
        console.warn("Notice fetching business_categories for agent mapping:", dbErr);
      }

      // 4. Idempotent Seed: Ensure all 29 Canonical Agents and Associations exist
      let didMutate = false;
      const now = new Date().toISOString();

      for (const seed of CANONICAL_29_AGENTS) {
        const existingIdx = this.store.agents.findIndex((a) => a.agent_id === seed.agent_id);
        const resolvedDbCatId = dbCatMap.get(seed.category_name.trim().toLowerCase()) || undefined;

        if (existingIdx === -1) {
          const newAgent: AgentRegistryEntry = {
            id: `agent_${seed.agent_id.toLowerCase()}_${Date.now()}`,
            agent_id: seed.agent_id,
            name: seed.name,
            description: seed.description,
            agent_type: "category_specialized",
            primary_category_id: seed.standard_category_id,
            database_category_id: resolvedDbCatId,
            status: "active",
            version: CURRENT_REGISTRY_VERSION,
            contract_version: CURRENT_CONTRACT_VERSION,
            capabilities: seed.capabilities,
            permissions: seed.permissions,
            configuration: {
              responsibilities: seed.responsibilities,
              operational_boundaries: seed.operational_boundaries,
              supported_modules: seed.supported_modules,
              specialized_domain: seed.industry_type,
              default_risk_tier: "low",
            },
            created_at: now,
            updated_at: now,
            created_by: "system_master_seed",
          };
          this.store.agents.push(newAgent);
          didMutate = true;
        } else {
          // Keep database category ID synced if newly resolved
          if (resolvedDbCatId && !this.store.agents[existingIdx].database_category_id) {
            this.store.agents[existingIdx].database_category_id = resolvedDbCatId;
            didMutate = true;
          }
        }

        // Check 1:1 Primary Association
        const assocIdx = this.store.associations.findIndex(
          (m) => m.agent_id === seed.agent_id && m.standard_category_id === seed.standard_category_id
        );
        if (assocIdx === -1) {
          const newAssoc: CategoryToAgentAssociation = {
            id: `assoc_${seed.standard_category_id.toLowerCase()}_${seed.agent_id.toLowerCase()}`,
            category_id: resolvedDbCatId || seed.standard_category_id,
            standard_category_id: seed.standard_category_id,
            category_name: seed.category_name,
            agent_id: seed.agent_id,
            agent_name: seed.name,
            is_primary: true,
            mapping_version: "1.0",
            status: "active",
            created_at: now,
            updated_at: now,
          };
          this.store.associations.push(newAssoc);
          didMutate = true;
        } else if (resolvedDbCatId && this.store.associations[assocIdx].category_id === seed.standard_category_id) {
          this.store.associations[assocIdx].category_id = resolvedDbCatId;
          didMutate = true;
        }

        // Step 09: Ensure baseline version record exists for this agent
        if (!this.store.version_records) {
          this.store.version_records = [];
        }
        const hasVersion = this.store.version_records.some((v) => v.agent_id === seed.agent_id);
        const activeVerId = `ver_${seed.agent_id.toLowerCase()}_1_0_0`;

        if (!hasVersion) {
          const canonicalConfig = {
            responsibilities: seed.responsibilities,
            operational_boundaries: seed.operational_boundaries,
            supported_modules: seed.supported_modules,
            specialized_domain: seed.industry_type,
            default_risk_tier: "low" as const,
            prompt_persona: "",
            parameters: {},
          };
          const configHash = require("crypto")
            .createHash("sha256")
            .update(
              JSON.stringify({
                contract_version: CURRENT_CONTRACT_VERSION,
                specialized_domain: seed.industry_type,
                default_risk_tier: "low",
                prompt_persona: "",
                parameters: {},
                responsibilities: [...seed.responsibilities].sort(),
                operational_boundaries: [...seed.operational_boundaries].sort(),
                supported_modules: [...seed.supported_modules].sort(),
                capabilities: [...seed.capabilities].sort(),
                permissions: [...seed.permissions].sort(),
              })
            )
            .digest("hex");

          this.store.version_records.push({
            id: activeVerId,
            agent_id: seed.agent_id,
            version: CURRENT_REGISTRY_VERSION,
            contract_version: CURRENT_CONTRACT_VERSION,
            configuration: canonicalConfig,
            capabilities: seed.capabilities,
            permissions: seed.permissions,
            configuration_hash: configHash,
            status: "active",
            change_type: "patch",
            change_summary: "Initial baseline configuration v1.0.0",
            created_at: now,
            created_by: "system_master_seed",
            created_by_email: "system@geflow.app",
            approved_at: now,
            approved_by: "system_master_seed",
            published_at: now,
            published_by: "system_master_seed",
          });
          didMutate = true;
        }

        // Ensure agent pointer is set
        const agentEntry = this.store.agents.find((a) => a.agent_id === seed.agent_id);
        if (agentEntry && !agentEntry.active_version_id) {
          agentEntry.active_version_id = activeVerId;
          didMutate = true;
        }
      }

      if (didMutate || !fs.existsSync(REGISTRY_STORE_PATH)) {
        this.persist();
      }

      this.isInitialized = true;
    } catch (err) {
      console.error("Critical error in AgentRegistryService initialization:", err);
      this.isInitialized = true;
    }
  }

  /**
   * Persists the registry to disk and cloud platform_settings.
   */
  public persist(): void {
    try {
      this.store.last_updated = new Date().toISOString();
      const dir = path.dirname(REGISTRY_STORE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(REGISTRY_STORE_PATH, JSON.stringify(this.store, null, 2), "utf-8");

      (async () => {
        try {
          const { data: row } = await serverSupabase
            .from("platform_settings")
            .select("id, alerts")
            .limit(1)
            .maybeSingle();

          if (row?.id) {
            const alerts = row.alerts && typeof row.alerts === "object" ? { ...(row.alerts as any) } : {};
            alerts.agent_registry = this.store;
            await serverSupabase
              .from("platform_settings")
              .update({ alerts, updated_at: new Date().toISOString() })
              .eq("id", row.id);
          }
        } catch (dbErr) {
          console.warn("Notice updating platform_settings with agent_registry:", dbErr);
        }
      })();
    } catch (e) {
      console.error("Error persisting agent_registry.json:", e);
    }
  }

  private ensureReady(): void {
    if (!this.isInitialized) {
      this.initializeRegistry();
    }
  }

  // ==========================================
  // READ OPERATIONS
  // ==========================================

  /**
   * Retrieves all registered agents, with optional status and category filtering.
   */
  public getAllAgents(filter?: {
    status?: AgentLifecycleStatus;
    categoryId?: string;
  }): AgentRegistryEntry[] {
    this.ensureReady();
    return this.store.agents.filter((a) => {
      if (filter?.status && a.status !== filter.status) return false;
      if (filter?.categoryId) {
        const cleanCat = filter.categoryId.trim().toLowerCase();
        const matchesStandard = a.primary_category_id.toLowerCase() === cleanCat;
        const matchesDb = a.database_category_id?.toLowerCase() === cleanCat;
        if (!matchesStandard && !matchesDb) return false;
      }
      return true;
    });
  }

  /**
   * Retrieves an agent by permanent agent ID (e.g. AGT-001) or internal database ID.
   */
  public getAgentById(agentIdOrInternalId: string): AgentRegistryEntry | null {
    this.ensureReady();
    if (!agentIdOrInternalId) return null;
    const clean = agentIdOrInternalId.trim().toUpperCase();
    return (
      this.store.agents.find((a) => a.agent_id.toUpperCase() === clean || a.id === agentIdOrInternalId) || null
    );
  }

  /**
   * Resolves the authoritative primary agent for a category (accepts standard ID CAT-001, DB UUID, or Category Name).
   */
  public getPrimaryAgentForCategory(categoryIdOrName: string): AgentRegistryEntry | null {
    this.ensureReady();
    if (!categoryIdOrName) return null;
    const clean = categoryIdOrName.trim().toLowerCase();

    // 1. Check in category associations
    const assoc = this.store.associations.find(
      (m) =>
        m.is_primary &&
        (m.standard_category_id.toLowerCase() === clean ||
          m.category_id.toLowerCase() === clean ||
          m.category_name.toLowerCase() === clean)
    );

    if (assoc) {
      const agent = this.getAgentById(assoc.agent_id);
      if (agent && agent.status === "active") return agent;
    }

    // 2. Direct agent search by primary category
    const directAgent = this.store.agents.find(
      (a) =>
        a.primary_category_id.toLowerCase() === clean ||
        a.database_category_id?.toLowerCase() === clean
    );

    if (directAgent && directAgent.status === "active") return directAgent;

    return null;
  }

  /**
   * Retrieves all verified 1:1 category associations.
   */
  public getAllAssociations(): CategoryToAgentAssociation[] {
    this.ensureReady();
    return this.store.associations;
  }

  /**
   * Retrieves an agent's approved operational configuration.
   */
  public getAgentConfiguration(agentId: string): AgentRegistryEntry["configuration"] | null {
    const agent = this.getAgentById(agentId);
    return agent ? agent.configuration : null;
  }

  /**
   * Retrieves registry metadata and versions.
   */
  public getRegistryVersionInfo(): {
    registryVersion: string;
    contractVersion: string;
    totalAgents: number;
    activeAgents: number;
    totalAssociations: number;
    lastUpdated: string;
  } {
    this.ensureReady();
    const activeCount = this.store.agents.filter((a) => a.status === "active").length;
    return {
      registryVersion: this.store.version,
      contractVersion: CURRENT_CONTRACT_VERSION,
      totalAgents: this.store.agents.length,
      activeAgents: activeCount,
      totalAssociations: this.store.associations.length,
      lastUpdated: this.store.last_updated,
    };
  }

  // ==========================================
  // MANAGEMENT OPERATIONS (AUTHORIZED ADMINS)
  // ==========================================

  /**
   * Updates an agent's lifecycle status (e.g. active, inactive, deprecated).
   * Validates valid transitions and records audit logs.
   */
  public updateAgentStatus(params: {
    agentId: string;
    newStatus: AgentLifecycleStatus;
    actorId?: string;
    actorEmail?: string;
    reason?: string;
  }): { success: boolean; agent?: AgentRegistryEntry; error?: string } {
    this.ensureReady();
    const { agentId, newStatus, actorId, actorEmail, reason } = params;

    const allowedStatuses: AgentLifecycleStatus[] = ["registered", "active", "inactive", "deprecated", "archived"];
    if (!allowedStatuses.includes(newStatus)) {
      return { success: false, error: `Invalid status '${newStatus}'. Allowed: ${allowedStatuses.join(", ")}` };
    }

    const agent = this.getAgentById(agentId);
    if (!agent) {
      return { success: false, error: `Agent '${agentId}' not found in registry.` };
    }

    const previousState = { status: agent.status };
    agent.status = newStatus;
    agent.updated_at = new Date().toISOString();
    agent.updated_by = actorEmail || actorId || "admin";

    // Also update associated mapping status if inactive/archived
    this.store.associations.forEach((assoc) => {
      if (assoc.agent_id === agent.agent_id) {
        assoc.status = newStatus === "active" ? "active" : "inactive";
        assoc.updated_at = agent.updated_at;
      }
    });

    // Audit log
    this.recordAudit({
      agent_id: agent.agent_id,
      action: "update_status",
      actor_id: actorId,
      actor_email: actorEmail,
      previous_state: previousState,
      new_state: { status: newStatus },
      reason,
    });

    this.persist();
    return { success: true, agent };
  }

  /**
   * Updates an agent's operational configuration and capabilities.
   */
  public updateAgentConfiguration(params: {
    agentId: string;
    configuration: Partial<AgentRegistryEntry["configuration"]>;
    capabilities?: string[];
    permissions?: string[];
    actorId?: string;
    actorEmail?: string;
    reason?: string;
  }): { success: boolean; agent?: AgentRegistryEntry; error?: string } {
    this.ensureReady();
    const { agentId, configuration, capabilities, permissions, actorId, actorEmail, reason } = params;

    const agent = this.getAgentById(agentId);
    if (!agent) {
      return { success: false, error: `Agent '${agentId}' not found in registry.` };
    }

    const previousState = {
      configuration: { ...agent.configuration },
      capabilities: [...agent.capabilities],
      permissions: [...agent.permissions],
    };

    if (configuration) {
      agent.configuration = { ...agent.configuration, ...configuration };
    }
    if (Array.isArray(capabilities)) {
      agent.capabilities = capabilities;
    }
    if (Array.isArray(permissions)) {
      agent.permissions = permissions;
    }

    agent.updated_at = new Date().toISOString();
    agent.updated_by = actorEmail || actorId || "admin";

    // Bump minor version on config update
    const [maj, min, patch] = agent.version.split(".").map(Number);
    agent.version = `${maj || 1}.${(min || 0) + 1}.${patch || 0}`;

    this.recordAudit({
      agent_id: agent.agent_id,
      action: "update_configuration",
      actor_id: actorId,
      actor_email: actorEmail,
      previous_state: previousState,
      new_state: {
        configuration: agent.configuration,
        capabilities: agent.capabilities,
        permissions: agent.permissions,
        version: agent.version,
      },
      reason,
    });

    this.persist();
    return { success: true, agent };
  }

  /**
   * Updates an agent's description or metadata.
   */
  public updateAgentMetadata(params: {
    agentId: string;
    name?: string;
    description?: string;
    actorId?: string;
    actorEmail?: string;
    reason?: string;
  }): { success: boolean; agent?: AgentRegistryEntry; error?: string } {
    this.ensureReady();
    const { agentId, name, description, actorId, actorEmail, reason } = params;

    const agent = this.getAgentById(agentId);
    if (!agent) {
      return { success: false, error: `Agent '${agentId}' not found in registry.` };
    }

    const previousState = { name: agent.name, description: agent.description };
    if (name && name.trim()) agent.name = name.trim();
    if (description && description.trim()) agent.description = description.trim();

    agent.updated_at = new Date().toISOString();
    agent.updated_by = actorEmail || actorId || "admin";

    this.recordAudit({
      agent_id: agent.agent_id,
      action: "update_metadata",
      actor_id: actorId,
      actor_email: actorEmail,
      previous_state: previousState,
      new_state: { name: agent.name, description: agent.description },
      reason,
    });

    this.persist();
    return { success: true, agent };
  }

  /**
   * Retrieves audit history for an agent or entire registry.
   */
  public getAuditHistory(agentId?: string): AgentRegistryAuditEntry[] {
    this.ensureReady();
    if (agentId) {
      const clean = agentId.trim().toUpperCase();
      return this.store.audit_logs.filter((log) => log.agent_id.toUpperCase() === clean);
    }
    return this.store.audit_logs;
  }

  /**
   * Records a timestamped audit event for registry modifications.
   */
  private recordAudit(entry: Omit<AgentRegistryAuditEntry, "id" | "timestamp">): void {
    const auditRecord: AgentRegistryAuditEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    this.store.audit_logs.unshift(auditRecord);
    // Keep max 500 audit items
    if (this.store.audit_logs.length > 500) {
      this.store.audit_logs = this.store.audit_logs.slice(0, 500);
    }
  }

  /**
   * Runs complete integrity check on the registry.
   */
  public validateRegistryIntegrity(): {
    valid: boolean;
    errors: string[];
    metrics: {
      totalAgents: number;
      uniqueAgentIds: number;
      totalAssociations: number;
      uniqueCategories: number;
    };
  } {
    this.ensureReady();
    const errors: string[] = [];

    // Check count
    if (this.store.agents.length !== 29) {
      errors.push(`Expected 29 registered agents, found ${this.store.agents.length}.`);
    }

    // Check unique agent IDs
    const agentIds = new Set<string>();
    for (const a of this.store.agents) {
      if (agentIds.has(a.agent_id)) {
        errors.push(`Duplicate agent_id found: ${a.agent_id}`);
      }
      agentIds.add(a.agent_id);
    }

    // Check associations
    if (this.store.associations.length !== 29) {
      errors.push(`Expected 29 category-to-agent associations, found ${this.store.associations.length}.`);
    }

    const mappedCategories = new Set<string>();
    for (const m of this.store.associations) {
      if (mappedCategories.has(m.standard_category_id)) {
        errors.push(`Duplicate primary mapping for category: ${m.standard_category_id}`);
      }
      mappedCategories.add(m.standard_category_id);

      // Verify agent exists
      if (!agentIds.has(m.agent_id)) {
        errors.push(`Association references non-existent agent: ${m.agent_id}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      metrics: {
        totalAgents: this.store.agents.length,
        uniqueAgentIds: agentIds.size,
        totalAssociations: this.store.associations.length,
        uniqueCategories: mappedCategories.size,
      },
    };
  }

  // ==========================================
  // VERSION SNAPSHOT STORAGE OPERATIONS (STEP 09)
  // ==========================================

  /**
   * Retrieves all version records for a given agent.
   */
  public getVersionRecords(agentId?: string): AgentVersionRecord[] {
    this.ensureReady();
    if (!this.store.version_records) {
      this.store.version_records = [];
    }
    if (agentId) {
      const clean = agentId.trim().toUpperCase();
      return this.store.version_records.filter((v) => v.agent_id.toUpperCase() === clean);
    }
    return this.store.version_records;
  }

  /**
   * Saves or updates a version record in persistent storage.
   */
  public saveVersionRecord(record: AgentVersionRecord): void {
    this.ensureReady();
    if (!this.store.version_records) {
      this.store.version_records = [];
    }
    const idx = this.store.version_records.findIndex((v) => v.id === record.id);
    if (idx >= 0) {
      this.store.version_records[idx] = record;
    } else {
      this.store.version_records.unshift(record);
    }
    this.persist();
  }

  /**
   * Updates an agent entry in memory and persists changes.
   */
  public updateAgentInMemory(agent: AgentRegistryEntry): void {
    this.ensureReady();
    const idx = this.store.agents.findIndex((a) => a.agent_id === agent.agent_id);
    if (idx >= 0) {
      this.store.agents[idx] = agent;
      this.persist();
    }
  }

  /**
   * Retrieves contract version specifications.
   */
  public getContractVersions(): ContractVersionDefinition[] {
    this.ensureReady();
    if (!this.store.contract_versions || this.store.contract_versions.length === 0) {
      this.store.contract_versions = [
        {
          contract_version_id: "contract_v1_0",
          version: "1.0",
          schema_definition: {
            request_envelope_version: "1.0",
            response_envelope_version: "1.0",
            required_context_fields: ["tenant", "agent", "actor", "request"],
            allowed_risk_tiers: ["low", "medium", "high"],
          },
          compatibility_policy: "backward_compatible",
          status: "active",
          created_at: "2026-11-04T00:00:00Z",
          created_by: "system_architecture",
          change_summary: "Initial standardized contract specification v1.0",
        },
      ];
      this.persist();
    }
    return this.store.contract_versions;
  }
}

export const agentRegistryService = new AgentRegistryService();
