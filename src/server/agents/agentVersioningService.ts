/**
 * GeFlow AI — Agent Versioning Service (Step 09)
 *
 * Implements semantic versioning, configuration snapshots, SHA-256 integrity hashing,
 * approval workflows, atomic version activation, structured comparison diffing,
 * controlled rollbacks, and audit logging for GeFlow's 29 specialized agents.
 */

import crypto from "crypto";
import {
  AgentRegistryEntry,
  AgentVersionRecord,
  ContractVersionDefinition,
  ConfigurationComparisonResult,
  VersionChangeType,
  VersionLifecycleStatus,
} from "./agentRegistryTypes";
import { agentRegistryService } from "./agentRegistryService";

export const APPROVED_CONTRACT_VERSIONS: ContractVersionDefinition[] = [
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

export class AgentVersioningService {
  /**
   * Computes a deterministic SHA-256 fingerprint of an agent's configuration,
   * capabilities, and permissions to guarantee snapshot immutability.
   */
  public computeConfigurationHash(params: {
    configuration: AgentVersionRecord["configuration"];
    capabilities: string[];
    permissions: string[];
    contract_version: string;
  }): string {
    const canonicalObject: Record<string, any> = {
      contract_version: params.contract_version,
      specialized_domain: params.configuration.specialized_domain,
      default_risk_tier: params.configuration.default_risk_tier,
      responsibilities: [...(params.configuration.responsibilities || [])].sort(),
      operational_boundaries: [...(params.configuration.operational_boundaries || [])].sort(),
      supported_modules: [...(params.configuration.supported_modules || [])].sort(),
      capabilities: [...(params.capabilities || [])].sort(),
      permissions: [...(params.permissions || [])].sort(),
    };

    if (params.configuration.prompt_persona) {
      canonicalObject.prompt_persona = params.configuration.prompt_persona;
    }
    if (params.configuration.parameters && Object.keys(params.configuration.parameters).length > 0) {
      canonicalObject.parameters = params.configuration.parameters;
    }

    return crypto.createHash("sha256").update(JSON.stringify(canonicalObject)).digest("hex");
  }

  /**
   * Validates semantic version string format (MAJOR.MINOR.PATCH)
   */
  public parseSemanticVersion(v: string): { major: number; minor: number; patch: number } | null {
    if (!v || typeof v !== "string") return null;
    const parts = v.trim().split(".");
    if (parts.length !== 3) return null;
    const major = Number(parts[0]);
    const minor = Number(parts[1]);
    const patch = Number(parts[2]);
    if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch) || major < 0 || minor < 0 || patch < 0) {
      return null;
    }
    return { major, minor, patch };
  }

  /**
   * Validates whether candidate next version correctly follows SemVer rules
   * based on the current active version and proposed change type.
   */
  public validateVersionIncrement(
    currentVerStr: string,
    nextVerStr: string,
    changeType: VersionChangeType
  ): { valid: boolean; expected?: string; error?: string } {
    const cur = this.parseSemanticVersion(currentVerStr);
    const next = this.parseSemanticVersion(nextVerStr);

    if (!cur) return { valid: false, error: `Malformed current version: '${currentVerStr}'` };
    if (!next) return { valid: false, error: `Malformed proposed version: '${nextVerStr}'. Must be MAJOR.MINOR.PATCH.` };

    let expected: string;
    if (changeType === "major") {
      expected = `${cur.major + 1}.0.0`;
    } else if (changeType === "minor" || changeType === "rollback") {
      expected = `${cur.major}.${cur.minor + 1}.0`;
    } else {
      expected = `${cur.major}.${cur.minor}.${cur.patch + 1}`;
    }

    if (nextVerStr !== expected) {
      return {
        valid: false,
        expected,
        error: `Invalid version progression for ${changeType.toUpperCase()} change. Expected '${expected}', received '${nextVerStr}'.`,
      };
    }

    return { valid: true, expected };
  }

  /**
   * Checks whether contract version is approved and compatible.
   */
  public validateContractCompatibility(contractVersion: string): { compatible: boolean; error?: string } {
    const clean = (contractVersion || "").trim();
    const approved = APPROVED_CONTRACT_VERSIONS.find((c) => c.version === clean && c.status === "active");
    if (!approved) {
      return {
        compatible: false,
        error: `Contract version '${contractVersion}' is not an approved active contract specification.`,
      };
    }
    return { compatible: true };
  }

  /**
   * Retrieves all historical version snapshots for an agent.
   */
  public getAgentVersionHistory(agentId: string): AgentVersionRecord[] {
    const clean = (agentId || "").trim().toUpperCase();
    return agentRegistryService.getVersionRecords(clean);
  }

  /**
   * Retrieves a specific version record for an agent by semantic version string or version record ID.
   */
  public getAgentVersion(agentId: string, versionOrId: string): AgentVersionRecord | null {
    const cleanAgent = (agentId || "").trim().toUpperCase();
    const cleanVer = (versionOrId || "").trim();
    const records = agentRegistryService.getVersionRecords(cleanAgent);

    return (
      records.find(
        (r) => r.version === cleanVer || r.id === cleanVer || r.version === cleanVer.replace(/^v/i, "")
      ) || null
    );
  }

  /**
   * Retrieves the currently active configuration version for an agent.
   */
  public getActiveVersion(agentId: string): AgentVersionRecord | null {
    const cleanAgent = (agentId || "").trim().toUpperCase();
    const agent = agentRegistryService.getAgentById(cleanAgent);
    if (!agent) return null;

    const records = agentRegistryService.getVersionRecords(cleanAgent);
    return records.find((r) => r.status === "active") || records.find((r) => r.version === agent.version) || null;
  }

  /**
   * Structured comparison between two versions of an agent configuration.
   */
  public compareVersions(
    agentId: string,
    fromVersionStr: string,
    toVersionStr: string
  ): ConfigurationComparisonResult | null {
    const clean = (agentId || "").trim().toUpperCase();
    const fromVer = this.getAgentVersion(clean, fromVersionStr);
    const toVer = this.getAgentVersion(clean, toVersionStr);

    if (!fromVer || !toVer) return null;

    const addedResp = toVer.configuration.responsibilities.filter(
      (r) => !fromVer.configuration.responsibilities.includes(r)
    );
    const removedResp = fromVer.configuration.responsibilities.filter(
      (r) => !toVer.configuration.responsibilities.includes(r)
    );

    const addedBound = toVer.configuration.operational_boundaries.filter(
      (b) => !fromVer.configuration.operational_boundaries.includes(b)
    );
    const removedBound = fromVer.configuration.operational_boundaries.filter(
      (b) => !toVer.configuration.operational_boundaries.includes(b)
    );

    const addedMods = toVer.configuration.supported_modules.filter(
      (m) => !fromVer.configuration.supported_modules.includes(m)
    );
    const removedMods = fromVer.configuration.supported_modules.filter(
      (m) => !toVer.configuration.supported_modules.includes(m)
    );

    const addedCaps = toVer.capabilities.filter((c) => !fromVer.capabilities.includes(c));
    const removedCaps = fromVer.capabilities.filter((c) => !toVer.capabilities.includes(c));

    const addedPerms = toVer.permissions.filter((p) => !fromVer.permissions.includes(p));
    const removedPerms = fromVer.permissions.filter((p) => !toVer.permissions.includes(p));

    const domainChanged = fromVer.configuration.specialized_domain !== toVer.configuration.specialized_domain;
    const riskTierChanged = fromVer.configuration.default_risk_tier !== toVer.configuration.default_risk_tier;
    const contractChanged = fromVer.contract_version !== toVer.contract_version;

    // Check parameters diff
    const paramDiffs: Record<string, { from: any; to: any }> = {};
    const allParamKeys = Array.from(
      new Set([
        ...Object.keys(fromVer.configuration.parameters || {}),
        ...Object.keys(toVer.configuration.parameters || {}),
      ])
    );

    for (const key of allParamKeys) {
      const fromVal = (fromVer.configuration.parameters || {})[key];
      const toVal = (toVer.configuration.parameters || {})[key];
      if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
        paramDiffs[key] = { from: fromVal, to: toVal };
      }
    }

    const isCompatible =
      !domainChanged &&
      removedMods.length === 0 &&
      removedCaps.length === 0 &&
      (!contractChanged || toVer.contract_version === "1.0");

    const summaryParts: string[] = [];
    if (domainChanged) summaryParts.push(`Domain changed from ${fromVer.configuration.specialized_domain} to ${toVer.configuration.specialized_domain}`);
    if (contractChanged) summaryParts.push(`Contract changed from ${fromVer.contract_version} to ${toVer.contract_version}`);
    if (addedCaps.length) summaryParts.push(`Added ${addedCaps.length} capabilities`);
    if (removedCaps.length) summaryParts.push(`Removed ${removedCaps.length} capabilities`);
    if (addedMods.length) summaryParts.push(`Added ${addedMods.length} modules`);
    if (removedMods.length) summaryParts.push(`Removed ${removedMods.length} modules`);
    if (summaryParts.length === 0) summaryParts.push("Metadata and parameter adjustments only.");

    return {
      agent_id: clean,
      from_version: fromVer.version,
      to_version: toVer.version,
      is_compatible: isCompatible,
      contract_changed: contractChanged,
      from_contract: fromVer.contract_version,
      to_contract: toVer.contract_version,
      added_responsibilities: addedResp,
      removed_responsibilities: removedResp,
      added_boundaries: addedBound,
      removed_boundaries: removedBound,
      added_modules: addedMods,
      removed_modules: removedMods,
      added_capabilities: addedCaps,
      removed_capabilities: removedCaps,
      added_permissions: addedPerms,
      removed_permissions: removedPerms,
      domain_changed: domainChanged,
      from_domain: fromVer.configuration.specialized_domain,
      to_domain: toVer.configuration.specialized_domain,
      risk_tier_changed: riskTierChanged,
      from_risk_tier: fromVer.configuration.default_risk_tier,
      to_risk_tier: toVer.configuration.default_risk_tier,
      parameter_differences: paramDiffs,
      summary: summaryParts.join(". "),
    };
  }

  /**
   * Creates a new configuration version in 'draft' or 'validated' status.
   * Does NOT activate automatically.
   */
  public createVersion(params: {
    agentId: string;
    version: string;
    contractVersion?: string;
    changeType: VersionChangeType;
    changeSummary: string;
    configuration: Partial<AgentRegistryEntry["configuration"]>;
    capabilities?: string[];
    permissions?: string[];
    actorId?: string;
    actorEmail?: string;
  }): { success: boolean; versionRecord?: AgentVersionRecord; error?: string } {
    const cleanAgent = (params.agentId || "").trim().toUpperCase();
    const agent = agentRegistryService.getAgentById(cleanAgent);

    if (!agent) {
      return { success: false, error: `Agent '${cleanAgent}' not found in registry.` };
    }

    const proposedContract = (params.contractVersion || agent.contract_version || "1.0").trim();
    const contractCheck = this.validateContractCompatibility(proposedContract);
    if (!contractCheck.compatible) {
      return { success: false, error: contractCheck.error };
    }

    // Validate increment against current agent version
    const incrementCheck = this.validateVersionIncrement(agent.version, params.version, params.changeType);
    if (!incrementCheck.valid) {
      return { success: false, error: incrementCheck.error };
    }

    // Check for duplicate version in agent's history
    const existingVer = this.getAgentVersion(cleanAgent, params.version);
    if (existingVer) {
      return { success: false, error: `Version '${params.version}' already exists for agent '${cleanAgent}'.` };
    }

    // Merge configuration
    const mergedConfig: AgentRegistryEntry["configuration"] = {
      ...agent.configuration,
      ...params.configuration,
      responsibilities: params.configuration.responsibilities || agent.configuration.responsibilities,
      operational_boundaries: params.configuration.operational_boundaries || agent.configuration.operational_boundaries,
      supported_modules: params.configuration.supported_modules || agent.configuration.supported_modules,
      specialized_domain: params.configuration.specialized_domain || agent.configuration.specialized_domain,
      default_risk_tier: params.configuration.default_risk_tier || agent.configuration.default_risk_tier,
    };

    const mergedCaps = params.capabilities || agent.capabilities;
    const mergedPerms = params.permissions || agent.permissions;

    // Validate completeness
    if (!mergedConfig.responsibilities?.length) {
      return { success: false, error: "Configuration must include at least one responsibility." };
    }
    if (!mergedConfig.operational_boundaries?.length) {
      return { success: false, error: "Configuration must include operational boundaries." };
    }
    if (!mergedConfig.supported_modules?.length) {
      return { success: false, error: "Configuration must include supported modules." };
    }

    const configHash = this.computeConfigurationHash({
      configuration: mergedConfig,
      capabilities: mergedCaps,
      permissions: mergedPerms,
      contract_version: proposedContract,
    });

    const now = new Date().toISOString();
    const recordId = `ver_${cleanAgent.toLowerCase()}_${params.version.replace(/\./g, "_")}`;

    const newRecord: AgentVersionRecord = {
      id: recordId,
      agent_id: cleanAgent,
      version: params.version,
      contract_version: proposedContract,
      configuration: mergedConfig,
      capabilities: mergedCaps,
      permissions: mergedPerms,
      configuration_hash: configHash,
      status: "validated",
      change_type: params.changeType,
      change_summary: params.changeSummary || `Version ${params.version} created`,
      created_at: now,
      created_by: params.actorId || "admin",
      created_by_email: params.actorEmail || "admin@geflow.app",
      previous_version_id: agent.active_version_id,
    };

    agentRegistryService.saveVersionRecord(newRecord);

    return { success: true, versionRecord: newRecord };
  }

  /**
   * Approves a validated version, making it eligible for activation.
   */
  public approveVersion(params: {
    agentId: string;
    version: string;
    actorId?: string;
    actorEmail?: string;
    notes?: string;
  }): { success: boolean; versionRecord?: AgentVersionRecord; error?: string } {
    const cleanAgent = (params.agentId || "").trim().toUpperCase();
    const ver = this.getAgentVersion(cleanAgent, params.version);

    if (!ver) {
      return { success: false, error: `Version '${params.version}' not found for agent '${cleanAgent}'.` };
    }

    if (ver.status !== "draft" && ver.status !== "validated") {
      return { success: false, error: `Cannot approve version in '${ver.status}' state.` };
    }

    ver.status = "approved";
    ver.approved_at = new Date().toISOString();
    ver.approved_by = params.actorEmail || params.actorId || "admin";

    agentRegistryService.saveVersionRecord(ver);

    return { success: true, versionRecord: ver };
  }

  /**
   * Atomically activates an approved version.
   * Supersedes previous active version and updates the registry entry.
   */
  public activateVersion(params: {
    agentId: string;
    version: string;
    actorId?: string;
    actorEmail?: string;
    reason?: string;
  }): { success: boolean; activeVersion?: AgentVersionRecord; agent?: AgentRegistryEntry; error?: string } {
    const cleanAgent = (params.agentId || "").trim().toUpperCase();
    const agent = agentRegistryService.getAgentById(cleanAgent);

    if (!agent) {
      return { success: false, error: `Agent '${cleanAgent}' not found in registry.` };
    }

    const candidate = this.getAgentVersion(cleanAgent, params.version);
    if (!candidate) {
      return { success: false, error: `Version '${params.version}' not found for agent '${cleanAgent}'.` };
    }

    if (candidate.status === "active") {
      return { success: true, activeVersion: candidate, agent };
    }

    if (candidate.status !== "approved" && candidate.status !== "validated") {
      return {
        success: false,
        error: `Cannot activate version '${params.version}' with status '${candidate.status}'. Must be approved or validated.`,
      };
    }

    // Verify integrity hash
    const expectedHash = this.computeConfigurationHash({
      configuration: candidate.configuration,
      capabilities: candidate.capabilities,
      permissions: candidate.permissions,
      contract_version: candidate.contract_version,
    });

    if (expectedHash !== candidate.configuration_hash) {
      return {
        success: false,
        error: "Configuration integrity check failed! Computed fingerprint does not match snapshot record.",
      };
    }

    const now = new Date().toISOString();
    const history = agentRegistryService.getVersionRecords(cleanAgent);

    // 1. Mark existing active versions as superseded
    for (const record of history) {
      if (record.status === "active" && record.id !== candidate.id) {
        record.status = "superseded";
        agentRegistryService.saveVersionRecord(record);
      }
    }

    // 2. Mark candidate as active
    candidate.status = "active";
    candidate.published_at = now;
    candidate.published_by = params.actorEmail || params.actorId || "admin";
    agentRegistryService.saveVersionRecord(candidate);

    // 3. Atomically update the agent in master registry
    agent.version = candidate.version;
    agent.contract_version = candidate.contract_version;
    agent.active_version_id = candidate.id;
    agent.configuration = candidate.configuration;
    agent.capabilities = candidate.capabilities;
    agent.permissions = candidate.permissions;
    agent.updated_at = now;
    agent.updated_by = params.actorEmail || params.actorId || "admin";

    agentRegistryService.updateAgentInMemory(agent);

    return { success: true, activeVersion: candidate, agent };
  }

  /**
   * Controlled Rollback: Restores a previous valid configuration by creating
   * a NEW version record that points back to the rollback source, keeping history linear.
   */
  public rollbackVersion(params: {
    agentId: string;
    targetVersion: string;
    rollbackReason: string;
    actorId?: string;
    actorEmail?: string;
  }): { success: boolean; newVersionRecord?: AgentVersionRecord; agent?: AgentRegistryEntry; error?: string } {
    const cleanAgent = (params.agentId || "").trim().toUpperCase();
    const agent = agentRegistryService.getAgentById(cleanAgent);

    if (!agent) {
      return { success: false, error: `Agent '${cleanAgent}' not found in registry.` };
    }

    if (!params.rollbackReason || !params.rollbackReason.trim()) {
      return { success: false, error: "A rollback reason is mandatory for audit accountability." };
    }

    const targetHistorical = this.getAgentVersion(cleanAgent, params.targetVersion);
    if (!targetHistorical) {
      return {
        success: false,
        error: `Target historical version '${params.targetVersion}' does not exist for agent '${cleanAgent}'.`,
      };
    }

    if (targetHistorical.version === agent.version) {
      return { success: false, error: `Agent '${cleanAgent}' is already running version '${agent.version}'.` };
    }

    // Verify contract compatibility of the historical configuration
    const contractCheck = this.validateContractCompatibility(targetHistorical.contract_version);
    if (!contractCheck.compatible) {
      return {
        success: false,
        error: `Cannot rollback to '${targetHistorical.version}': ${contractCheck.error}`,
      };
    }

    // Rollback creates a new version increment (e.g. current 1.2.0 -> rollback creates 1.3.0)
    const curSem = this.parseSemanticVersion(agent.version);
    if (!curSem) {
      return { success: false, error: `Invalid current agent version: ${agent.version}` };
    }

    const nextRollbackVersion = `${curSem.major}.${curSem.minor + 1}.0`;
    const now = new Date().toISOString();
    const recordId = `ver_${cleanAgent.toLowerCase()}_${nextRollbackVersion.replace(/\./g, "_")}`;

    const configHash = this.computeConfigurationHash({
      configuration: targetHistorical.configuration,
      capabilities: targetHistorical.capabilities,
      permissions: targetHistorical.permissions,
      contract_version: targetHistorical.contract_version,
    });

    const rollbackRecord: AgentVersionRecord = {
      id: recordId,
      agent_id: cleanAgent,
      version: nextRollbackVersion,
      contract_version: targetHistorical.contract_version,
      configuration: targetHistorical.configuration,
      capabilities: targetHistorical.capabilities,
      permissions: targetHistorical.permissions,
      configuration_hash: configHash,
      status: "approved",
      change_type: "rollback",
      change_summary: `Rollback restoration based on historical version ${targetHistorical.version}. Reason: ${params.rollbackReason}`,
      created_at: now,
      created_by: params.actorId || "admin",
      created_by_email: params.actorEmail || "admin@geflow.app",
      approved_at: now,
      approved_by: params.actorEmail || params.actorId || "admin",
      previous_version_id: agent.active_version_id,
      rollback_source_version_id: targetHistorical.id,
    };

    agentRegistryService.saveVersionRecord(rollbackRecord);

    // Activate the newly created rollback version
    const activateRes = this.activateVersion({
      agentId: cleanAgent,
      version: nextRollbackVersion,
      actorId: params.actorId,
      actorEmail: params.actorEmail,
      reason: params.rollbackReason,
    });

    if (!activateRes.success) {
      return { success: false, error: `Rollback version created but failed activation: ${activateRes.error}` };
    }

    return {
      success: true,
      newVersionRecord: rollbackRecord,
      agent: activateRes.agent,
    };
  }
}

export const agentVersioningService = new AgentVersioningService();
