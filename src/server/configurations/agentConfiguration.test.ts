/**
 * GeFlow AI — Agent Configuration Framework Automated Test Suite (Step 12)
 *
 * Validates all required test dimensions:
 * 1. Base Common Schema & 29 Agent-Specific Schemas
 * 2. Configuration Validation & Normalization
 * 3. Configuration Resolution & Explicit Precedence
 * 4. Organization Overrides & Multi-Tenant Isolation
 * 5. Capability Expansion Denial & Protected Field Enforcement
 * 6. Role-Based Security & Authorization (Owner/Manager vs Member)
 * 7. Runtime Integration with Agent Execution Engine
 * 8. Centralized Cryptographic Audit Ledger Integration
 */

import { describe, it, beforeAll, expect } from "vitest";
import { agentConfigurationService } from "./agentConfigurationService";
import { CANONICAL_AGENT_SCHEMAS, COMMON_BASE_CONFIGURATION_SCHEMA } from "./agentConfigurationSchemas";
import { businessDataSyncService } from "../team/businessDataSyncService";
import { teamService } from "../team/teamService";
import { agentExecutionEngine } from "../executions/agentExecutionEngine";
import { agentAuditService } from "../executions/agentAuditService";
import { organizationAuthService } from "../auth/organizationAuthService";

describe("GeFlow AI — Step 12: Agent Configuration Framework Test Suite", () => {
  const TEST_BUSINESS_ID = "biz_step12_config_test";
  const ALT_BUSINESS_ID = "biz_step12_alt_test";
  const TEST_OWNER_ID = "user_step12_owner";
  const TEST_MANAGER_ID = "user_step12_manager";
  const TEST_MEMBER_ID = "user_step12_member";
  const OUTSIDER_USER_ID = "user_step12_outsider";

  beforeAll(async () => {
    // 1. Seed primary test business unit (Supermarket CAT-001)
    const unit = businessDataSyncService.getOrCreateBusinessUnit(TEST_BUSINESS_ID, TEST_OWNER_ID);
    unit.ownerUserId = TEST_OWNER_ID;
    unit.businessName = "Step 12 Retail Store";
    unit.categoryId = "CAT-001"; // Supermarket / General Retail (AGT-001)
    unit.products = [
      {
        id: "prod_juice",
        business_id: TEST_BUSINESS_ID,
        name: "Fresh Orange Juice 1L",
        sku: "JUICE-001",
        price: 4.5,
        stock_units: 50,
        status: "active",
      },
    ];

    // Seed alternate business unit (Pharmacy CAT-029)
    const altUnit = businessDataSyncService.getOrCreateBusinessUnit(ALT_BUSINESS_ID, "alt_owner");
    altUnit.ownerUserId = "alt_owner";
    altUnit.businessName = "Step 12 Alternate Pharmacy";
    altUnit.categoryId = "CAT-029"; // Pharmacy

    // Add manager and member to test business
    teamService.addDirectMember({
      businessId: TEST_BUSINESS_ID,
      ownerId: TEST_OWNER_ID,
      email: "manager@geflow.test",
      fullName: "Config Manager",
      role: "manager",
      userId: TEST_MANAGER_ID,
      status: "active",
    });

    teamService.addDirectMember({
      businessId: TEST_BUSINESS_ID,
      ownerId: TEST_OWNER_ID,
      email: "member@geflow.test",
      fullName: "Config Cashier",
      role: "cashier",
      userId: TEST_MEMBER_ID,
      status: "active",
    });

    // Warm up category cache
    await organizationAuthService.resolveCategory("CAT-001");
  }, 15000);

  // ==========================================
  // 1. SCHEMA DEFINITIONS & COVERAGE
  // ==========================================
  describe("1. Schema Definitions & 29-Agent Coverage", () => {
    it("defines the common base configuration schema correctly", () => {
      expect(COMMON_BASE_CONFIGURATION_SCHEMA.schema_id).toBe("schema_base_common_v1_0_0");
      expect(COMMON_BASE_CONFIGURATION_SCHEMA.required_fields.length).toBeGreaterThan(5);
      expect(COMMON_BASE_CONFIGURATION_SCHEMA.validation_rules.min_execution_timeout_ms).toBe(3000);
      expect(COMMON_BASE_CONFIGURATION_SCHEMA.validation_rules.max_execution_timeout_ms).toBe(120000);
    });

    it("registers explicit schemas for all 29 canonical agents", () => {
      expect(CANONICAL_AGENT_SCHEMAS.size).toBe(30); // 29 agents + base schema ("*")
      for (let i = 1; i <= 29; i++) {
        const agentId = `AGT-${String(i).padStart(3, "0")}`;
        const schema = agentConfigurationService.getSchema(agentId);
        expect(schema).toBeDefined();
        expect(schema.agent_id).toBe(agentId);
        expect(schema.primary_category_id).toBeDefined();
        expect(schema.schema_status).toBe("active");
      }
    });

    it("retrieves specialized domain schema for AGT-029 (Pharmacy)", () => {
      const schema = agentConfigurationService.getSchema("AGT-029");
      expect(schema.primary_category_id).toBe("CAT-029");
      expect(schema.default_values?.agent_specific_parameters?.prescription_rx_validation_mandatory).toBe(true);
      expect(schema.default_values?.agent_specific_parameters?.batch_expiry_quarantine_days).toBe(90);
    });
  });

  // ==========================================
  // 2. VALIDATION & NORMALIZATION
  // ==========================================
  describe("2. Configuration Validation & Normalization", () => {
    it("validates a fully compliant configuration successfully", () => {
      const validConfig = {
        identity: {
          agent_id: "AGT-001",
          agent_name: "General Retail Agent",
          agent_type: "category_specialized",
          primary_category_id: "CAT-001",
          configuration_id: "cfg_test_001",
          configuration_version: "1.0.0",
          contract_version: "1.0",
        },
        general: {
          display_name: "Custom Supermarket Bot",
          enabled_status: true,
        },
        behavior: {
          response_style: "concise",
          response_detail_level: "summary",
        },
        execution: {
          execution_timeout: 45000,
        },
      };

      const result = agentConfigurationService.validateConfiguration(validConfig, "AGT-001");
      expect(result.is_valid).toBe(true);
      expect(result.validation_errors.length).toBe(0);
      expect(result.normalized_configuration).toBeDefined();
      expect(result.normalized_configuration?.general.display_name).toBe("Custom Supermarket Bot");
    });

    it("rejects configuration missing required fields", () => {
      const invalidConfig = {
        identity: {
          agent_id: "AGT-001",
          // missing primary_category_id, configuration_version, etc.
        },
      };

      const result = agentConfigurationService.validateConfiguration(invalidConfig, "AGT-001");
      expect(result.is_valid).toBe(false);
      expect(result.validation_errors.some((e) => e.includes("Missing required configuration field"))).toBe(true);
    });

    it("rejects invalid execution timeout outside allowed limits", () => {
      const invalidConfig = {
        identity: {
          agent_id: "AGT-001",
          agent_name: "General Retail Agent",
          primary_category_id: "CAT-001",
          configuration_version: "1.0.0",
          contract_version: "1.0",
        },
        general: { display_name: "Agent", enabled_status: true },
        behavior: { response_style: "analytical", response_detail_level: "standard" },
        execution: { execution_timeout: 999999 }, // exceeds 120,000 ms
      };

      const result = agentConfigurationService.validateConfiguration(invalidConfig, "AGT-001");
      expect(result.is_valid).toBe(false);
      expect(result.validation_errors.some((e) => e.includes("execution.execution_timeout"))).toBe(true);
    });

    it("rejects invalid enum values for response_style", () => {
      const invalidConfig = {
        identity: {
          agent_id: "AGT-001",
          agent_name: "General Retail Agent",
          primary_category_id: "CAT-001",
          configuration_version: "1.0.0",
          contract_version: "1.0",
        },
        general: { display_name: "Agent", enabled_status: true },
        behavior: { response_style: "aggressive_mode", response_detail_level: "standard" },
        execution: { execution_timeout: 30000 },
      };

      const result = agentConfigurationService.validateConfiguration(invalidConfig, "AGT-001");
      expect(result.is_valid).toBe(false);
      expect(result.validation_errors.some((e) => e.includes("Invalid behavior.response_style"))).toBe(true);
    });

    it("rejects unauthorized capability expansion beyond agent registry", () => {
      const invalidConfig = {
        identity: {
          agent_id: "AGT-001",
          agent_name: "General Retail Agent",
          primary_category_id: "CAT-001",
          configuration_version: "1.0.0",
          contract_version: "1.0",
        },
        general: { display_name: "Agent", enabled_status: true },
        behavior: { response_style: "analytical", response_detail_level: "standard" },
        capabilities: {
          enabled_capabilities: ["unauthorized.alien_telepathy.scan"], // Fake capability
        },
        execution: { execution_timeout: 30000 },
      };

      const result = agentConfigurationService.validateConfiguration(invalidConfig, "AGT-001");
      expect(result.is_valid).toBe(false);
      expect(result.validation_errors.some((e) => e.includes("is not registered for agent"))).toBe(true);
    });
  });

  // ==========================================
  // 3. RESOLUTION & PRECEDENCE HIERARCHY
  // ==========================================
  describe("3. Resolution Engine & Precedence Hierarchy", () => {
    it("resolves baseline configuration snapshot for registered agent", async () => {
      const snapshot = await agentConfigurationService.resolveEffectiveConfiguration({
        agentId: "AGT-001",
        businessId: TEST_BUSINESS_ID,
        caller: { userId: TEST_OWNER_ID },
      });

      expect(snapshot).toBeDefined();
      expect(snapshot.agent_id).toBe("AGT-001");
      expect(snapshot.category_id).toBe("CAT-001");
      expect(snapshot.configuration_version).toBe("1.0.0");
      expect(snapshot.contract_version).toBe("1.0");
      expect(snapshot.integrity_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(snapshot.effective_configuration.execution.execution_timeout).toBe(30000);
    }, 15000);

    it("fails configuration resolution for unknown agent ID", async () => {
      await expect(
        agentConfigurationService.resolveEffectiveConfiguration({
          agentId: "AGT-999",
          businessId: TEST_BUSINESS_ID,
          caller: { userId: TEST_OWNER_ID },
        })
      ).rejects.toThrow(/not registered/);
    });

    it("fails configuration resolution if caller lacks organization access", async () => {
      await expect(
        agentConfigurationService.resolveEffectiveConfiguration({
          agentId: "AGT-001",
          businessId: TEST_BUSINESS_ID,
          caller: { userId: OUTSIDER_USER_ID },
        })
      ).rejects.toThrow(/access denied/i);
    });
  });

  // ==========================================
  // 4. ORGANIZATION-LEVEL OVERRIDES & ISOLATION
  // ==========================================
  describe("4. Organization Overrides & Tenant Isolation", () => {
    it("allows Manager to save valid organization override", async () => {
      const override = await agentConfigurationService.saveOrganizationOverride(
        {
          businessId: TEST_BUSINESS_ID,
          agentId: "AGT-001",
          displayNameOverride: "My Local Retail Assistant",
          responseStyleOverride: "concise",
          executionTimeoutOverride: 25000,
          customParameters: { department_reorder_multiplier: 1.25 },
        },
        { userId: TEST_MANAGER_ID }
      );

      expect(override.display_name_override).toBe("My Local Retail Assistant");
      expect(override.response_style_override).toBe("concise");
      expect(override.execution_timeout_override).toBe(25000);

      // Verify effective snapshot applies the override
      const snapshot = await agentConfigurationService.resolveEffectiveConfiguration({
        agentId: "AGT-001",
        businessId: TEST_BUSINESS_ID,
        caller: { userId: TEST_OWNER_ID },
      });

      expect(snapshot.applied_organization_override_id).toBe(override.override_id);
      expect(snapshot.effective_configuration.general.display_name).toBe("My Local Retail Assistant");
      expect(snapshot.effective_configuration.behavior.response_style).toBe("concise");
      expect(snapshot.effective_configuration.execution.execution_timeout).toBe(25000);
      expect(snapshot.effective_configuration.agent_specific_parameters?.department_reorder_multiplier).toBe(1.25);
    });

    it("verifies organization override isolation: Business A override does not leak to Business B", async () => {
      // Resolve for ALT_BUSINESS_ID (Pharmacy)
      const altSnapshot = await agentConfigurationService.resolveEffectiveConfiguration({
        agentId: "AGT-029",
        businessId: ALT_BUSINESS_ID,
        caller: { userId: "alt_owner" },
      });

      expect(altSnapshot.applied_organization_override_id).toBeUndefined();
      expect(altSnapshot.effective_configuration.general.display_name).toBe("Pharmacy & Health Store Agent");
    });

    it("denies Member role from saving organization override", async () => {
      await expect(
        agentConfigurationService.saveOrganizationOverride(
          {
            businessId: TEST_BUSINESS_ID,
            agentId: "AGT-001",
            displayNameOverride: "Hacked Name",
          },
          { userId: TEST_MEMBER_ID }
        )
      ).rejects.toThrow(/Manager access required|Unauthorized/);
    });

    it("rejects organization override for agent in incompatible category", async () => {
      // AGT-029 (Pharmacy) against Supermarket business (CAT-001)
      await expect(
        agentConfigurationService.saveOrganizationOverride(
          {
            businessId: TEST_BUSINESS_ID,
            agentId: "AGT-029",
            displayNameOverride: "Incompatible Category",
          },
          { userId: TEST_OWNER_ID }
        )
      ).rejects.toThrow(/Category authorization rejected|cannot be configured/);
    });

    it("restores default configuration upon override deletion", async () => {
      const delRes = await agentConfigurationService.deleteOrganizationOverride(
        TEST_BUSINESS_ID,
        "AGT-001",
        { userId: TEST_OWNER_ID }
      );
      expect(delRes.success).toBe(true);

      const snapshot = await agentConfigurationService.resolveEffectiveConfiguration({
        agentId: "AGT-001",
        businessId: TEST_BUSINESS_ID,
        caller: { userId: TEST_OWNER_ID },
      });

      expect(snapshot.applied_organization_override_id).toBeUndefined();
      expect(snapshot.effective_configuration.general.display_name).toBe("General Retail Agent");
    });
  });

  // ==========================================
  // 5. RUNTIME INTEGRATION WITH EXECUTION ENGINE
  // ==========================================
  describe("5. Runtime Integration with Execution Engine", () => {
    it("attaches immutable configuration snapshot and integrity hash to execution", async () => {
      const res = await agentExecutionEngine.submitExecution(
        {
          agent_id: "AGT-001",
          business_id: TEST_BUSINESS_ID,
          task_type: "inventory_audit",
          task_input: { sku: "JUICE-001" },
        },
        { userId: TEST_OWNER_ID, email: "owner@geflow.test" }
      );

      expect(res.execution.status).toBe("completed");
      expect(res.execution.resolved_configuration_snapshot).toBeDefined();
      expect(res.execution.configuration_snapshot_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(res.execution.resolved_configuration_snapshot.agent_id).toBe("AGT-001");
      expect(res.execution.resolved_configuration_snapshot.effective_configuration).toBeDefined();
    });
  });

  // ==========================================
  // 6. CRYPTOGRAPHIC AUDIT LEDGER INTEGRATION
  // ==========================================
  describe("6. Cryptographic Audit Ledger Integration", () => {
    it("captures configuration lifecycle and override events in audit ledger", async () => {
      // Save an override to trigger audit
      await agentConfigurationService.saveOrganizationOverride(
        {
          businessId: TEST_BUSINESS_ID,
          agentId: "AGT-001",
          displayNameOverride: "Audited Assistant",
        },
        { userId: TEST_OWNER_ID }
      );

      const auditQuery = await agentAuditService.getAuditEvents(
        { business_id: TEST_BUSINESS_ID, event_category: "governance" },
        { userId: TEST_OWNER_ID }
      );

      expect(auditQuery.events.length).toBeGreaterThan(0);
      const configEvt = auditQuery.events.find(
        (e) => e.action === "save_organization_override"
      );
      expect(configEvt).toBeDefined();
      expect(configEvt?.target_type).toBe("agent");

      // Verify audit ledger integrity holds across all events
      const integrity = agentAuditService.verifyAuditIntegrity();
      expect(integrity.valid).toBe(true);
    });
  });
});
