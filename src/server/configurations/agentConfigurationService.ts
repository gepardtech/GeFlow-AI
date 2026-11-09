/**
 * GeFlow AI — Centralized Agent Configuration Service (Step 12)
 *
 * Implements centralized schema validation, normalization, default resolution,
 * explicit precedence inheritance, tenant-isolated organization overrides,
 * configuration lifecycle transitions, and immutable runtime snapshots.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  AgentConfigurationSchema,
  CommonAgentConfiguration,
  ConfigurationValidationResult,
  OrganizationAgentConfigurationOverride,
  ResolvedAgentConfigurationSnapshot,
} from "./agentConfigurationTypes";
import {
  COMMON_BASE_CONFIGURATION_SCHEMA,
  CANONICAL_AGENT_SCHEMAS,
} from "./agentConfigurationSchemas";
import { agentRegistryService } from "../agents/agentRegistryService";
import { agentVersioningService } from "../agents/agentVersioningService";
import { organizationAuthService, OrganizationRole } from "../auth/organizationAuthService";
import { toolGatewayService } from "../tools/toolGatewayService";
import { agentAuditService } from "../executions/agentAuditService";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CONFIG_STORE_FILE = path.join(DATA_DIR, "agent_configurations.json");
const ORG_OVERRIDES_STORE_FILE = path.join(DATA_DIR, "agent_org_overrides.json");

export class AgentConfigurationService {
  private schemas: Map<string, AgentConfigurationSchema> = new Map();
  private configurations: Map<string, CommonAgentConfiguration> = new Map();
  private orgOverrides: Map<string, OrganizationAgentConfigurationOverride> = new Map(); // key: `${businessId}:${agentId}`

  constructor() {
    this.ensureDataDir();
    this.initSchemas();
    this.loadState();
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

  private initSchemas(): void {
    this.schemas = new Map(CANONICAL_AGENT_SCHEMAS);
  }

  private loadState(): void {
    // 1. Load Configurations
    if (fs.existsSync(CONFIG_STORE_FILE)) {
      try {
        const raw = fs.readFileSync(CONFIG_STORE_FILE, "utf-8");
        const parsed: CommonAgentConfiguration[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const cfg of parsed) {
            if (cfg.identity?.agent_id) {
              this.configurations.set(cfg.identity.agent_id, cfg);
            }
          }
        }
      } catch (e) {
        console.error("[AgentConfigurationService] Error loading configurations:", e);
      }
    }

    // 2. Load Organization Overrides
    if (fs.existsSync(ORG_OVERRIDES_STORE_FILE)) {
      try {
        const raw = fs.readFileSync(ORG_OVERRIDES_STORE_FILE, "utf-8");
        const parsed: OrganizationAgentConfigurationOverride[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const ovr of parsed) {
            if (ovr.business_id && ovr.agent_id) {
              this.orgOverrides.set(`${ovr.business_id}:${ovr.agent_id.toUpperCase()}`, ovr);
            }
          }
        }
      } catch (e) {
        console.error("[AgentConfigurationService] Error loading organization overrides:", e);
      }
    }

    // 3. Ensure baseline configuration exists for all 29 agents
    this.seedDefaultConfigurations();
  }

  private persistConfigurations(): void {
    try {
      const records = Array.from(this.configurations.values());
      fs.writeFileSync(CONFIG_STORE_FILE, JSON.stringify(records, null, 2), "utf-8");
    } catch (e) {
      console.error("[AgentConfigurationService] Failed to persist configurations:", e);
    }
  }

  private persistOrgOverrides(): void {
    try {
      const records = Array.from(this.orgOverrides.values());
      fs.writeFileSync(ORG_OVERRIDES_STORE_FILE, JSON.stringify(records, null, 2), "utf-8");
    } catch (e) {
      console.error("[AgentConfigurationService] Failed to persist organization overrides:", e);
    }
  }

  /**
   * Seeds standardized default configurations for all 29 agents if missing.
   */
  private seedDefaultConfigurations(): void {
    const allAgents = agentRegistryService.getAllAgents();
    let mutated = false;
    const now = "2026-11-04T00:00:00Z";

    for (const agent of allAgents) {
      if (!this.configurations.has(agent.agent_id)) {
        const schema = this.schemas.get(agent.agent_id) || COMMON_BASE_CONFIGURATION_SCHEMA;
        const activeVer = agentVersioningService.getActiveVersion(agent.agent_id);

        const defaultConfig: CommonAgentConfiguration = {
          identity: {
            agent_id: agent.agent_id,
            agent_name: agent.name,
            agent_type: "category_specialized",
            primary_category_id: agent.primary_category_id,
            configuration_id: `cfg_${agent.agent_id.toLowerCase()}_1_0_0`,
            configuration_version: activeVer?.version || agent.version || "1.0.0",
            contract_version: activeVer?.contract_version || agent.contract_version || "1.0",
          },
          general: {
            display_name: agent.name,
            description: agent.description,
            enabled_status: true,
            supported_languages: ["en", "fr", "ur", "hi"],
            default_locale: "en-US",
            timezone_behavior: "business_local",
          },
          behavior: {
            response_style: "analytical",
            response_detail_level: "standard",
            task_handling_preferences: {
              auto_execute_read_only: true,
              require_confirmation_for_write: true,
              strict_schema_enforcement: true,
            },
            confirmation_behavior: "always_confirm_high_risk",
            error_handling_preferences: {
              retry_transient_failures: true,
              fallback_to_safe_mode: true,
              expose_internal_traces: false,
            },
          },
          capabilities: {
            enabled_capabilities: [...agent.capabilities],
            disabled_capabilities: [],
            capability_limits: {
              max_items_per_query: 100,
              max_audit_lookback_days: 365,
            },
            supported_task_types: [
              "inventory_audit",
              "stock_adjustment",
              "sales_summary",
              "held_orders_review",
              "returns_inspection",
              "catalog_lookup",
              "pos_transaction",
              "diagnostic_echo",
              "custom_tool_run",
            ],
          },
          tools: {
            allowed_tool_ids: [
              "inventory.product.get",
              "inventory.products.list",
              "inventory.stock.adjust",
              "reports.sales.summary",
              "pos.held_orders.list",
              "pos.sale.create",
              "returns.list",
              "system.echo.test",
            ],
            restricted_tool_ids: [],
            tool_configuration: {},
            tool_execution_preferences: {
              timeout_override_ms: 30000,
              max_retries: 2,
              enforce_rate_limits: true,
            },
          },
          execution: {
            execution_timeout: 30000,
            retry_policy_reference: "standard_exponential",
            concurrency_policy_reference: "sequential",
            approval_policy_reference: "gateway_risk_tier",
            execution_mode: "standard",
          },
          context: {
            organization_context_policy: "strict_tenant_isolation",
            category_context_policy: "strict_category_boundary",
            data_access_scope: "business_operational_only",
            context_visibility_rules: {
              allow_cross_location: false,
              allow_historical_lookback_days: 90,
            },
          },
          metadata: {
            created_at: now,
            updated_at: now,
            created_by: "system_master_seed",
            schema_version: "1.0.0",
            configuration_status: "active",
          },
          agent_specific_parameters: schema.default_values?.agent_specific_parameters || {},
        };

        this.configurations.set(agent.agent_id, defaultConfig);
        mutated = true;
      }
    }

    if (mutated || !fs.existsSync(CONFIG_STORE_FILE)) {
      this.persistConfigurations();
    }
  }

  /**
   * Retrieves the schema for a specific agent or the common base schema.
   */
  public getSchema(agentIdOrCommon?: string): AgentConfigurationSchema {
    if (!agentIdOrCommon || agentIdOrCommon === "*") {
      return COMMON_BASE_CONFIGURATION_SCHEMA;
    }
    const cleanId = agentIdOrCommon.trim().toUpperCase();
    return this.schemas.get(cleanId) || COMMON_BASE_CONFIGURATION_SCHEMA;
  }

  /**
   * Retrieves the current stored base configuration for an agent.
   */
  public getConfiguration(agentId: string): CommonAgentConfiguration {
    const cleanId = (agentId || "").trim().toUpperCase();
    return this.configurations.get(cleanId) || this.normalizeConfiguration({}, cleanId);
  }

  /**
   * Validates a candidate configuration object against an agent's schema.
   * Supports either (config, agentId) or (agentId, config).
   */
  public validateConfiguration(
    arg1: any,
    arg2?: any
  ): ConfigurationValidationResult {
    let config: any;
    let agentId: string;
    if (typeof arg1 === "string") {
      agentId = arg1;
      config = arg2;
    } else {
      config = arg1;
      agentId = typeof arg2 === "string" ? arg2 : "common";
    }
    const schema = this.getSchema(agentId);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config || typeof config !== "object") {
      return {
        is_valid: false,
        schema_id: schema.schema_id,
        schema_version: schema.schema_version,
        validation_errors: ["Configuration payload must be a non-null object."],
        validation_warnings: [],
      };
    }

    // 1. Required Fields Check
    for (const reqField of schema.required_fields) {
      const parts = reqField.split(".");
      let cur = config;
      let missing = false;
      for (const p of parts) {
        if (cur === undefined || cur === null || typeof cur !== "object" || !(p in cur)) {
          missing = true;
          break;
        }
        cur = cur[p];
      }
      if (missing || cur === undefined || cur === "") {
        errors.push(`Missing required configuration field: '${reqField}'.`);
      }
    }

    // 2. Identity Verification
    if (config.identity) {
      if (config.identity.agent_id && config.identity.agent_id.toUpperCase() !== agentId.toUpperCase()) {
        errors.push(
          `Configuration identity.agent_id '${config.identity.agent_id}' does not match target agent '${agentId}'.`
        );
      }
      const agent = agentRegistryService.getAgentById(agentId);
      if (agent && config.identity.primary_category_id && config.identity.primary_category_id !== agent.primary_category_id) {
        errors.push(
          `Configuration identity.primary_category_id '${config.identity.primary_category_id}' does not match registered category '${agent.primary_category_id}'.`
        );
      }
    }

    // 3. Execution Timeout Bounds
    if (config.execution?.execution_timeout !== undefined) {
      const timeout = Number(config.execution.execution_timeout);
      if (
        Number.isNaN(timeout) ||
        timeout < schema.validation_rules.min_execution_timeout_ms ||
        timeout > schema.validation_rules.max_execution_timeout_ms
      ) {
        errors.push(
          `execution.execution_timeout must be a number between ${schema.validation_rules.min_execution_timeout_ms} and ${schema.validation_rules.max_execution_timeout_ms} ms.`
        );
      }
    }

    // 4. Allowed Value Enums
    const validStyles = ["concise", "detailed", "analytical", "instructional"];
    if (config.behavior?.response_style && !validStyles.includes(config.behavior.response_style)) {
      errors.push(
        `Invalid behavior.response_style '${config.behavior.response_style}'. Allowed: ${validStyles.join(", ")}.`
      );
    }

    const validDetails = ["summary", "standard", "exhaustive"];
    if (config.behavior?.response_detail_level && !validDetails.includes(config.behavior.response_detail_level)) {
      errors.push(
        `Invalid behavior.response_detail_level '${config.behavior.response_detail_level}'. Allowed: ${validDetails.join(", ")}.`
      );
    }

    // 5. Capability References Check
    const agent = agentRegistryService.getAgentById(agentId);
    const registeredCaps = agent?.capabilities || [];
    if (Array.isArray(config.capabilities?.enabled_capabilities)) {
      for (const cap of config.capabilities.enabled_capabilities) {
        if (!registeredCaps.includes(cap)) {
          errors.push(
            `Declared capability '${cap}' is not registered for agent '${agentId}'. Agent capabilities cannot be expanded via configuration.`
          );
        }
      }
    }

    // 6. Tool References Check
    if (Array.isArray(config.tools?.allowed_tool_ids)) {
      for (const t of config.tools.allowed_tool_ids) {
        const toolDef = toolGatewayService.getToolById(t);
        if (!toolDef) {
          warnings.push(`Tool '${t}' is not currently discovered in Shared Tool Catalog.`);
        }
      }
    }

    // Produce normalized configuration if valid
    let normalized: CommonAgentConfiguration | undefined = undefined;
    if (errors.length === 0) {
      normalized = this.normalizeConfiguration(config, agentId);
    }

    return {
      is_valid: errors.length === 0,
      schema_id: schema.schema_id,
      schema_version: schema.schema_version,
      validation_errors: errors,
      validation_warnings: warnings,
      normalized_configuration: normalized,
    };
  }

  /**
   * Normalizes a configuration by populating missing optional properties with schema defaults.
   */
  public normalizeConfiguration(
    raw: Partial<CommonAgentConfiguration>,
    agentId: string
  ): CommonAgentConfiguration {
    const schema = this.getSchema(agentId);
    const defaults = schema.default_values || {};
    const agent = agentRegistryService.getAgentById(agentId);

    return {
      identity: {
        agent_id: agentId.toUpperCase(),
        agent_name: agent?.name || raw.identity?.agent_name || "Unknown Agent",
        agent_type: "category_specialized",
        primary_category_id: agent?.primary_category_id || raw.identity?.primary_category_id || "CAT-001",
        configuration_id: raw.identity?.configuration_id || `cfg_${agentId.toLowerCase()}_${Date.now()}`,
        configuration_version: raw.identity?.configuration_version || "1.0.0",
        contract_version: raw.identity?.contract_version || "1.0",
      },
      general: {
        display_name: raw.general?.display_name || agent?.name || "Agent",
        description: raw.general?.description || agent?.description || "",
        enabled_status: raw.general?.enabled_status !== undefined ? raw.general.enabled_status : true,
        supported_languages: raw.general?.supported_languages || defaults["general.supported_languages"] || ["en", "fr", "ur", "hi"],
        default_locale: raw.general?.default_locale || defaults["general.default_locale"] || "en-US",
        timezone_behavior: raw.general?.timezone_behavior || defaults["general.timezone_behavior"] || "business_local",
      },
      behavior: {
        response_style: raw.behavior?.response_style || defaults["behavior.response_style"] || "analytical",
        response_detail_level: raw.behavior?.response_detail_level || defaults["behavior.response_detail_level"] || "standard",
        task_handling_preferences: {
          auto_execute_read_only: raw.behavior?.task_handling_preferences?.auto_execute_read_only ?? true,
          require_confirmation_for_write: raw.behavior?.task_handling_preferences?.require_confirmation_for_write ?? true,
          strict_schema_enforcement: raw.behavior?.task_handling_preferences?.strict_schema_enforcement ?? true,
        },
        confirmation_behavior: raw.behavior?.confirmation_behavior || defaults["behavior.confirmation_behavior"] || "always_confirm_high_risk",
        error_handling_preferences: {
          retry_transient_failures: raw.behavior?.error_handling_preferences?.retry_transient_failures ?? true,
          fallback_to_safe_mode: raw.behavior?.error_handling_preferences?.fallback_to_safe_mode ?? true,
          expose_internal_traces: raw.behavior?.error_handling_preferences?.expose_internal_traces ?? false,
        },
      },
      capabilities: {
        enabled_capabilities: raw.capabilities?.enabled_capabilities || [...(agent?.capabilities || [])],
        disabled_capabilities: raw.capabilities?.disabled_capabilities || [],
        capability_limits: raw.capabilities?.capability_limits || { max_items_per_query: 100 },
        supported_task_types: raw.capabilities?.supported_task_types || [
          "inventory_audit",
          "stock_adjustment",
          "sales_summary",
          "held_orders_review",
          "returns_inspection",
          "catalog_lookup",
          "pos_transaction",
          "diagnostic_echo",
          "custom_tool_run",
        ],
      },
      tools: {
        allowed_tool_ids: raw.tools?.allowed_tool_ids || [
          "inventory.product.get",
          "inventory.products.list",
          "inventory.stock.adjust",
          "reports.sales.summary",
          "pos.held_orders.list",
          "pos.sale.create",
          "returns.list",
          "system.echo.test",
        ],
        restricted_tool_ids: raw.tools?.restricted_tool_ids || [],
        tool_configuration: raw.tools?.tool_configuration || {},
        tool_execution_preferences: {
          timeout_override_ms: raw.tools?.tool_execution_preferences?.timeout_override_ms || 30000,
          max_retries: raw.tools?.tool_execution_preferences?.max_retries ?? 2,
          enforce_rate_limits: raw.tools?.tool_execution_preferences?.enforce_rate_limits ?? true,
        },
      },
      execution: {
        execution_timeout: raw.execution?.execution_timeout || defaults["execution.execution_timeout"] || 30000,
        retry_policy_reference: raw.execution?.retry_policy_reference || defaults["execution.retry_policy_reference"] || "standard_exponential",
        concurrency_policy_reference: raw.execution?.concurrency_policy_reference || defaults["execution.concurrency_policy_reference"] || "sequential",
        approval_policy_reference: raw.execution?.approval_policy_reference || defaults["execution.approval_policy_reference"] || "gateway_risk_tier",
        execution_mode: raw.execution?.execution_mode || "standard",
      },
      context: {
        organization_context_policy: raw.context?.organization_context_policy || defaults["context.organization_context_policy"] || "strict_tenant_isolation",
        category_context_policy: raw.context?.category_context_policy || defaults["context.category_context_policy"] || "strict_category_boundary",
        data_access_scope: raw.context?.data_access_scope || defaults["context.data_access_scope"] || "business_operational_only",
        context_visibility_rules: {
          allow_cross_location: raw.context?.context_visibility_rules?.allow_cross_location ?? false,
          allow_historical_lookback_days: raw.context?.context_visibility_rules?.allow_historical_lookback_days ?? 90,
        },
      },
      metadata: {
        created_at: raw.metadata?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: raw.metadata?.created_by || "system",
        schema_version: raw.metadata?.schema_version || "1.0.0",
        configuration_status: raw.metadata?.configuration_status || "active",
      },
      agent_specific_parameters: {
        ...(defaults.agent_specific_parameters || {}),
        ...(raw.agent_specific_parameters || {}),
      },
    };
  }

  /**
   * Resolves the final immutable Effective Configuration Snapshot for an agent execution.
   *
   * Precedence:
   * Platform Defaults -> Common Defaults -> Agent-Specific Defaults -> Active Configuration Version -> Authorized Organization Override.
   */
  public async resolveEffectiveConfiguration(params: {
    agentId: string;
    businessId: string;
    version?: string;
    caller: { userId: string; email?: string; isPlatformAdmin?: boolean };
  }): Promise<ResolvedAgentConfigurationSnapshot> {
    const { agentId, businessId, version, caller } = params;
    const cleanAgentId = agentId.trim().toUpperCase();

    // 1. Verify registered agent
    const agent = agentRegistryService.getAgentById(cleanAgentId);
    if (!agent) {
      throw new Error(`Agent '${cleanAgentId}' is not registered in GeFlow Agent Registry.`);
    }

    if (agent.status !== "active") {
      throw new Error(`Agent '${cleanAgentId}' is currently in status '${agent.status}' and cannot resolve configuration.`);
    }

    // 2. Resolve active configuration version
    const activeVerRecord = agentVersioningService.getActiveVersion(cleanAgentId);
    const resolvedVersion = version || activeVerRecord?.version || agent.version || "1.0.0";
    const contractVersion = activeVerRecord?.contract_version || agent.contract_version || "1.0";

    // 3. Resolve applicable schema
    const schema = this.getSchema(cleanAgentId);

    // 4. Load base configuration for agent
    const baseConfig = this.configurations.get(cleanAgentId) || this.normalizeConfiguration({}, cleanAgentId);

    // Deep clone to guarantee execution isolation
    const effective: CommonAgentConfiguration = JSON.parse(JSON.stringify(baseConfig));
    effective.identity.configuration_version = resolvedVersion;
    effective.identity.contract_version = contractVersion;

    // 5. Check and apply Organization Overrides if businessId provided
    let appliedOverrideId: string | undefined = undefined;
    if (businessId) {
      // Authorize Level 1 Organization access
      const orgAuth = await organizationAuthService.authorizeOrganizationAccess({
        userId: caller.userId,
        businessId,
        isPlatformAdmin: caller.isPlatformAdmin,
      });

      if (!orgAuth.allowed) {
        throw new Error(`Organization access denied: ${orgAuth.reason || "Unauthorized"}`);
      }

      // Authorize Level 2 Category assignment
      const catAuth = await organizationAuthService.authorizeCategoryAccess({
        businessId,
        requestedAgentId: cleanAgentId,
        userRole: (orgAuth.role as OrganizationRole) || "member",
      });

      if (!catAuth.allowed) {
        throw new Error(`Category boundary violation: ${catAuth.reason || "Agent not permitted in category"}`);
      }

      const override = this.orgOverrides.get(`${businessId}:${cleanAgentId}`);
      if (override && override.status === "active") {
        appliedOverrideId = override.override_id;

        // Apply authorized overrides strictly conforming to security policy
        if (override.display_name_override) {
          effective.general.display_name = override.display_name_override;
        }
        if (override.response_style_override) {
          effective.behavior.response_style = override.response_style_override;
        }
        if (override.response_detail_level_override) {
          effective.behavior.response_detail_level = override.response_detail_level_override;
        }
        if (override.execution_timeout_override) {
          const timeout = Number(override.execution_timeout_override);
          if (
            !Number.isNaN(timeout) &&
            timeout >= schema.validation_rules.min_execution_timeout_ms &&
            timeout <= schema.validation_rules.max_execution_timeout_ms
          ) {
            effective.execution.execution_timeout = timeout;
          }
        }

        // Subtractive only: Organizations may disable capabilities, but never add new ones
        if (Array.isArray(override.disabled_capabilities_override)) {
          effective.capabilities.disabled_capabilities = [
            ...new Set([
              ...effective.capabilities.disabled_capabilities,
              ...override.disabled_capabilities_override,
            ]),
          ];
          effective.capabilities.enabled_capabilities = effective.capabilities.enabled_capabilities.filter(
            (c) => !override.disabled_capabilities_override!.includes(c)
          );
        }

        // Subtractive only: Organizations may restrict tools, but never add new ones
        if (Array.isArray(override.restricted_tool_ids_override)) {
          effective.tools.restricted_tool_ids = [
            ...new Set([
              ...effective.tools.restricted_tool_ids,
              ...override.restricted_tool_ids_override,
            ]),
          ];
          effective.tools.allowed_tool_ids = effective.tools.allowed_tool_ids.filter(
            (t) => !override.restricted_tool_ids_override!.includes(t)
          );
        }

        // Domain parameter overrides
        if (override.custom_parameters && typeof override.custom_parameters === "object") {
          effective.agent_specific_parameters = {
            ...(effective.agent_specific_parameters || {}),
            ...override.custom_parameters,
          };
        }
      }
    }

    // 6. Validate the final resolved configuration
    const validation = this.validateConfiguration(effective, cleanAgentId);
    if (!validation.is_valid) {
      throw new Error(`Resolved configuration failed validation: ${validation.validation_errors.join("; ")}`);
    }

    const now = new Date().toISOString();
    const snapshotId = `snap_${cleanAgentId.toLowerCase()}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

    // 7. Compute deterministic integrity hash
    const canonicalPayload = JSON.stringify({
      agent_id: cleanAgentId,
      business_id: businessId || "",
      configuration_version: resolvedVersion,
      contract_version: contractVersion,
      effective_configuration: effective,
      applied_override_id: appliedOverrideId || "",
    });

    const integrity_hash = crypto.createHash("sha256").update(canonicalPayload).digest("hex");

    return {
      snapshot_id: snapshotId,
      agent_id: cleanAgentId,
      agent_name: agent.name,
      business_id: businessId || "",
      category_id: agent.primary_category_id,
      configuration_version: resolvedVersion,
      contract_version: contractVersion,
      schema_version: schema.schema_version,
      effective_configuration: effective,
      applied_organization_override_id: appliedOverrideId,
      resolved_at: now,
      integrity_hash,
    };
  }

  /**
   * Saves or updates an Organization Agent Configuration Override.
   */
  public async saveOrganizationOverride(
    params: {
      businessId: string;
      agentId: string;
      displayNameOverride?: string;
      responseStyleOverride?: CommonAgentConfiguration["behavior"]["response_style"];
      responseDetailLevelOverride?: CommonAgentConfiguration["behavior"]["response_detail_level"];
      executionTimeoutOverride?: number;
      disabledCapabilitiesOverride?: string[];
      restrictedToolIdsOverride?: string[];
      customParameters?: Record<string, any>;
    },
    caller: { userId: string; email?: string; isPlatformAdmin?: boolean }
  ): Promise<OrganizationAgentConfigurationOverride> {
    const { businessId, agentId } = params;
    const cleanAgentId = agentId.trim().toUpperCase();

    // 1. Authorize Manager, Admin, or Owner privilege
    const orgAuth = await organizationAuthService.authorizeOrganizationAccess({
      userId: caller.userId,
      businessId,
      requiredRole: "manager",
      isPlatformAdmin: caller.isPlatformAdmin,
    });

    if (!orgAuth.allowed) {
      agentAuditService.recordEvent({
        event_type: "security_denial",
        event_category: "security",
        agent_id: cleanAgentId,
        business_id: businessId,
        actor_type: "user",
        actor_id: caller.userId,
        target_type: "policy",
        target_id: cleanAgentId,
        action: "save_organization_override",
        authorization_decision: "denied",
        result_status: "rejected",
        sanitized_metadata: { reason: orgAuth.reason },
      });
      throw new Error(`Unauthorized override attempt: ${orgAuth.reason || "Manager access required"}`);
    }

    // 2. Validate agent exists & belongs to business category
    const agent = agentRegistryService.getAgentById(cleanAgentId);
    if (!agent) {
      throw new Error(`Agent '${cleanAgentId}' is not registered in GeFlow Agent Registry.`);
    }

    const catAuth = await organizationAuthService.authorizeCategoryAccess({
      businessId,
      requestedAgentId: cleanAgentId,
      userRole: orgAuth.role || "manager",
    });

    if (!catAuth.allowed) {
      throw new Error(`Agent '${cleanAgentId}' cannot be configured for this organization: ${catAuth.reason}`);
    }

    // 3. Validate timeout bounds
    const schema = this.getSchema(cleanAgentId);
    if (params.executionTimeoutOverride !== undefined) {
      const timeout = Number(params.executionTimeoutOverride);
      if (
        Number.isNaN(timeout) ||
        timeout < schema.validation_rules.min_execution_timeout_ms ||
        timeout > schema.validation_rules.max_execution_timeout_ms
      ) {
        throw new Error(
          `executionTimeoutOverride must be between ${schema.validation_rules.min_execution_timeout_ms} and ${schema.validation_rules.max_execution_timeout_ms} ms.`
        );
      }
    }

    // 4. Security Check: Reject attempts to grant non-existent capabilities
    if (params.disabledCapabilitiesOverride) {
      for (const cap of params.disabledCapabilitiesOverride) {
        if (!agent.capabilities.includes(cap)) {
          throw new Error(`Cannot disable unassigned capability '${cap}' on agent '${cleanAgentId}'.`);
        }
      }
    }

    const key = `${businessId}:${cleanAgentId}`;
    const existing = this.orgOverrides.get(key);
    const now = new Date().toISOString();

    const override: OrganizationAgentConfigurationOverride = {
      override_id: existing?.override_id || `ovr_${businessId.slice(0, 8)}_${cleanAgentId.toLowerCase()}_${Date.now()}`,
      business_id: businessId,
      agent_id: cleanAgentId,
      category_id: agent.primary_category_id,
      display_name_override: params.displayNameOverride !== undefined ? params.displayNameOverride : existing?.display_name_override,
      response_style_override: params.responseStyleOverride || existing?.response_style_override,
      response_detail_level_override: params.responseDetailLevelOverride || existing?.response_detail_level_override,
      execution_timeout_override: params.executionTimeoutOverride !== undefined ? params.executionTimeoutOverride : existing?.execution_timeout_override,
      disabled_capabilities_override: params.disabledCapabilitiesOverride || existing?.disabled_capabilities_override || [],
      restricted_tool_ids_override: params.restrictedToolIdsOverride || existing?.restricted_tool_ids_override || [],
      custom_parameters: params.customParameters || existing?.custom_parameters || {},
      created_at: existing?.created_at || now,
      updated_at: now,
      created_by: existing?.created_by || caller.userId,
      updated_by: caller.userId,
      status: "active",
    };

    this.orgOverrides.set(key, override);
    this.persistOrgOverrides();

    // Audit log
    agentAuditService.recordEvent({
      event_type: existing ? "configuration_updated" : "configuration_created",
      event_category: "governance",
      agent_id: cleanAgentId,
      business_id: businessId,
      category_id: agent.primary_category_id,
      actor_type: caller.isPlatformAdmin ? "admin" : "user",
      actor_id: caller.userId,
      actor_email: caller.email,
      target_type: "agent",
      target_id: override.override_id,
      action: "save_organization_override",
      authorization_decision: "allowed",
      result_status: "success",
      sanitized_metadata: {
        agent_id: cleanAgentId,
        business_id: businessId,
        override_id: override.override_id,
      },
    });

    return override;
  }

  /**
   * Retrieves an Organization Agent Configuration Override.
   */
  public async getOrganizationOverride(
    businessId: string,
    agentId: string,
    caller: { userId: string; isPlatformAdmin?: boolean }
  ): Promise<OrganizationAgentConfigurationOverride | null> {
    const cleanAgentId = agentId.trim().toUpperCase();

    const auth = await organizationAuthService.authorizeOrganizationAccess({
      userId: caller.userId,
      businessId,
      isPlatformAdmin: caller.isPlatformAdmin,
    });

    if (!auth.allowed) {
      throw new Error(`Access denied: ${auth.reason || "Unauthorized"}`);
    }

    return this.orgOverrides.get(`${businessId}:${cleanAgentId}`) || null;
  }

  /**
   * Deletes an Organization Agent Configuration Override, restoring default agent configuration.
   */
  public async deleteOrganizationOverride(
    businessId: string,
    agentId: string,
    caller: { userId: string; email?: string; isPlatformAdmin?: boolean }
  ): Promise<{ success: boolean }> {
    const cleanAgentId = agentId.trim().toUpperCase();

    const auth = await organizationAuthService.authorizeOrganizationAccess({
      userId: caller.userId,
      businessId,
      requiredRole: "manager",
      isPlatformAdmin: caller.isPlatformAdmin,
    });

    if (!auth.allowed) {
      throw new Error(`Unauthorized override deletion: ${auth.reason || "Manager access required"}`);
    }

    const key = `${businessId}:${cleanAgentId}`;
    const existing = this.orgOverrides.get(key);
    if (!existing) {
      return { success: false };
    }

    this.orgOverrides.delete(key);
    this.persistOrgOverrides();

    agentAuditService.recordEvent({
      event_type: "configuration_updated",
      event_category: "governance",
      agent_id: cleanAgentId,
      business_id: businessId,
      actor_type: caller.isPlatformAdmin ? "admin" : "user",
      actor_id: caller.userId,
      actor_email: caller.email,
      target_type: "agent",
      target_id: existing.override_id,
      action: "delete_organization_override",
      authorization_decision: "allowed",
      result_status: "success",
      sanitized_metadata: {
        agent_id: cleanAgentId,
        business_id: businessId,
      },
    });

    return { success: true };
  }
}

export const agentConfigurationService = new AgentConfigurationService();
