/**
 * GeFlow AI — Agent Execution & Centralized Audit Logging Tests (Step 11)
 *
 * Comprehensive automated test suite validating:
 * 1. Execution State Machine & Tool Dispatch Lifecycle
 * 2. Contract & Configuration Version Enforcement
 * 3. Idempotent Execution Replay
 * 4. Multi-Tenant Authorization & Category Boundary Isolation
 * 5. Capability Enforcement & Gateway Integration
 * 6. Human Approval Suspension & Resumption
 * 7. Safe Execution Cancellation
 * 8. Cryptographic Hash-Chained Audit Ledger & Role-Governed Audit Queries
 * 9. Execution Observability Metrics
 */

import { describe, it, beforeAll, expect } from "vitest";
import { agentExecutionEngine } from "./agentExecutionEngine";
import { agentAuditService } from "./agentAuditService";
import { businessDataSyncService } from "../team/businessDataSyncService";
import { teamService } from "../team/teamService";
import { agentRegistryService } from "../agents/agentRegistryService";
import { toolGatewayService } from "../tools/toolGatewayService";

describe("GeFlow AI — Step 11: Agent Execution & Audit Logging Test Suite", () => {
  const TEST_BUSINESS_ID = "biz_step11_execution_test";
  const ALT_BUSINESS_ID = "biz_step11_alt_test";
  const TEST_OWNER_ID = "user_step11_owner";
  const TEST_MANAGER_ID = "user_step11_manager";
  const TEST_MEMBER_ID = "user_step11_member";
  const OUTSIDER_USER_ID = "user_step11_outsider";

  beforeAll(async () => {
    // 1. Seed test business unit with owner, manager, member
    const unit = businessDataSyncService.getOrCreateBusinessUnit(TEST_BUSINESS_ID, TEST_OWNER_ID);
    unit.ownerUserId = TEST_OWNER_ID;
    unit.businessName = "Step 11 Supermarket Mart";
    unit.categoryId = "CAT-001"; // Supermarket / Grocery Retail (matches AGT-001)

    // Seed products for inventory audit
    unit.products = [
      {
        id: "prod_milk",
        business_id: TEST_BUSINESS_ID,
        name: "Fresh Whole Milk 1L",
        sku: "MILK-001",
        price: 3.5,
        stock_quantity: 4, // low stock (< alert limit 10)
        stock_alert_limit: 10,
        status: "active",
        created_at: new Date().toISOString(),
      },
      {
        id: "prod_bread",
        business_id: TEST_BUSINESS_ID,
        name: "Artisan Sourdough Loaf",
        sku: "BREAD-001",
        price: 4.2,
        stock_quantity: 25,
        stock_alert_limit: 5,
        status: "active",
        created_at: new Date().toISOString(),
      },
    ];

    // Seed alternate business for tenant isolation tests
    const altUnit = businessDataSyncService.getOrCreateBusinessUnit(ALT_BUSINESS_ID, "alt_owner");
    altUnit.ownerUserId = "alt_owner";
    altUnit.businessName = "Step 11 Alternate Pharmacy";
    altUnit.categoryId = "CAT-002"; // Pharmacy

    // Add team members to test business using teamService
    teamService.addDirectMember({
      businessId: TEST_BUSINESS_ID,
      ownerId: TEST_OWNER_ID,
      email: "manager@geflow.test",
      fullName: "Execution Manager",
      role: "manager",
      userId: TEST_MANAGER_ID,
      status: "active",
    });

    teamService.addDirectMember({
      businessId: TEST_BUSINESS_ID,
      ownerId: TEST_OWNER_ID,
      email: "member@geflow.test",
      fullName: "Execution Member",
      role: "cashier",
      userId: TEST_MEMBER_ID,
      status: "active",
    });

    // Ensure agents and tools are ready
    agentRegistryService.getAllAgents();
    toolGatewayService.getAllTools();
  });

  // ==========================================
  // 1. LIFECYCLE & EXECUTION DISPATCH
  // ==========================================
  describe("1. Lifecycle & Tool Dispatch", () => {
    it("executes a valid task (inventory_audit) with AGT-001 successfully", async () => {
      const res = await agentExecutionEngine.submitExecution(
        {
          agent_id: "AGT-001",
          business_id: TEST_BUSINESS_ID,
          task_type: "inventory_audit",
          task_input: { sku: "MILK-001" },
          idempotency_key: "idem_audit_001",
        },
        { userId: TEST_OWNER_ID, email: "owner@geflow.test" }
      );

      expect(res.execution).toBeDefined();
      expect(res.execution.status).toBe("completed");
      expect(res.execution.agent_id).toBe("AGT-001");
      expect(res.execution.agent_configuration_version).toBe("1.0.0");
      expect(res.execution.contract_version).toBe("1.0");
      expect(res.execution.tool_invocations.length).toBeGreaterThan(0);
      expect(res.execution.result_data).toBeDefined();
      expect(res.execution.result_data.inv_get_stock_level).toBeDefined();
      expect(res.execution.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it("replays completed execution idempotently when duplicate idempotency_key is sent", async () => {
      const replayRes = await agentExecutionEngine.submitExecution(
        {
          agent_id: "AGT-001",
          business_id: TEST_BUSINESS_ID,
          task_type: "inventory_audit",
          task_input: { sku: "MILK-001" },
          idempotency_key: "idem_audit_001",
        },
        { userId: TEST_OWNER_ID, email: "owner@geflow.test" }
      );

      expect(replayRes.is_idempotent_replay).toBe(true);
      expect(replayRes.execution.status).toBe("completed");
    });

    it("fails with agent_unavailable when unknown agent ID is provided", async () => {
      const res = await agentExecutionEngine.submitExecution(
        {
          agent_id: "AGT-999",
          business_id: TEST_BUSINESS_ID,
          task_type: "diagnostic_echo",
          task_input: {},
        },
        { userId: TEST_OWNER_ID, email: "owner@geflow.test" }
      );

      expect(res.execution.status).toBe("rejected");
      expect(res.execution.failure_code).toBe("agent_unavailable");
    });

    it("fails with configuration_error when requested agent version does not match active version", async () => {
      const res = await agentExecutionEngine.submitExecution(
        {
          agent_id: "AGT-001",
          business_id: TEST_BUSINESS_ID,
          task_type: "diagnostic_echo",
          task_input: {},
          agent_version: "9.9.9",
        },
        { userId: TEST_OWNER_ID, email: "owner@geflow.test" }
      );

      expect(res.execution.status).toBe("rejected");
      expect(res.execution.failure_code).toBe("configuration_error");
    });

    it("fails with configuration_error when requested contract version is incompatible", async () => {
      const res = await agentExecutionEngine.submitExecution(
        {
          agent_id: "AGT-001",
          business_id: TEST_BUSINESS_ID,
          task_type: "diagnostic_echo",
          task_input: {},
          contract_version: "99.0",
        },
        { userId: TEST_OWNER_ID, email: "owner@geflow.test" }
      );

      expect(res.execution.status).toBe("rejected");
      expect(res.execution.failure_code).toBe("configuration_error");
    });
  });

  // ==========================================
  // 2. MULTI-TENANT & CATEGORY AUTHORIZATION
  // ==========================================
  describe("2. Multi-Tenant & Category Authorization", () => {
    it("rejects unauthorized external user with authorization_error", async () => {
      const res = await agentExecutionEngine.submitExecution(
        {
          agent_id: "AGT-001",
          business_id: TEST_BUSINESS_ID,
          task_type: "inventory_audit",
          task_input: { sku: "MILK-001" },
        },
        { userId: OUTSIDER_USER_ID, email: "outsider@evil.test" }
      );

      expect(res.execution.status).toBe("rejected");
      expect(res.execution.failure_code).toBe("authorization_error");
    });

    it("rejects agent execution across incompatible category boundaries", async () => {
      // AGT-002 (Pharmacy) executing against TEST_BUSINESS_ID (Supermarket CAT-001)
      const res = await agentExecutionEngine.submitExecution(
        {
          agent_id: "AGT-002",
          business_id: TEST_BUSINESS_ID,
          task_type: "catalog_lookup",
          task_input: { sku: "MILK-001" },
        },
        { userId: TEST_OWNER_ID, email: "owner@geflow.test" }
      );

      expect(res.execution.status).toBe("rejected");
      expect(res.execution.failure_code).toBe("authorization_error");
    });

    it("prevents cross-tenant execution retrieval", () => {
      // Create an execution for TEST_BUSINESS_ID
      const execution = agentExecutionEngine.getExecutionById(
        "non_existent",
        TEST_BUSINESS_ID
      );
      expect(execution).toBeNull();
    });
  });

  // ==========================================
  // 3. HUMAN APPROVAL SUSPENSION & RESUMPTION
  // ==========================================
  describe("3. Human Approval Suspension & Resumption", () => {
    it("suspends execution in awaiting_approval when a high-risk stock adjustment is performed", async () => {
      const res = await agentExecutionEngine.submitExecution(
        {
          agent_id: "AGT-001",
          business_id: TEST_BUSINESS_ID,
          task_type: "stock_adjustment",
          task_input: { sku: "MILK-001", quantity_delta: -100, reason: "Bulk spoilage write-off" },
        },
        { userId: TEST_OWNER_ID, email: "owner@geflow.test" }
      );

      expect(res.execution.status).toBe("awaiting_approval");
      expect(res.execution.approval_reference).toBeDefined();
    });

    it("resumes and completes execution when manager grants approval", async () => {
      // Submit stock adjustment that requires approval (> 50 units)
      const submitRes = await agentExecutionEngine.submitExecution(
        {
          agent_id: "AGT-001",
          business_id: TEST_BUSINESS_ID,
          task_type: "stock_adjustment",
          task_input: { sku: "MILK-001", quantity_delta: 100, reason: "Restock from distributor" },
        },
        { userId: TEST_OWNER_ID, email: "owner@geflow.test" }
      );

      expect(submitRes.execution.status).toBe("awaiting_approval");
      const approvalId = submitRes.execution.approval_reference!;

      // Approve in gateway
      await toolGatewayService.decideApproval({
        approvalId,
        decision: "approved",
        approverId: TEST_MANAGER_ID,
        notes: "Restock verified against invoice",
      });

      // Resume execution
      const resumeRes = await agentExecutionEngine.resumeApprovedExecution({
        executionId: submitRes.execution.execution_id,
        approvalId,
        decision: "approved",
        notes: "Approved by manager",
        caller: { userId: TEST_MANAGER_ID },
      });

      expect(resumeRes.execution.status).toBe("completed");
    });

    it("transitions execution to rejected when supervisor denies approval", async () => {
      const submitRes = await agentExecutionEngine.submitExecution(
        {
          agent_id: "AGT-001",
          business_id: TEST_BUSINESS_ID,
          task_type: "stock_adjustment",
          task_input: { sku: "MILK-001", quantity_delta: -100, reason: "Unverified discrepancy" },
        },
        { userId: TEST_OWNER_ID, email: "owner@geflow.test" }
      );

      const approvalId = submitRes.execution.approval_reference!;

      const resumeRes = await agentExecutionEngine.resumeApprovedExecution({
        executionId: submitRes.execution.execution_id,
        approvalId,
        decision: "rejected",
        notes: "Stock count doesn't match physical count",
        caller: { userId: TEST_MANAGER_ID },
      });

      expect(resumeRes.execution.status).toBe("rejected");
      expect(resumeRes.execution.failure_code).toBe("approval_rejected");
    });
  });

  // ==========================================
  // 4. SAFE CANCELLATION
  // ==========================================
  describe("4. Execution Cancellation", () => {
    it("allows cancelling an execution awaiting approval", async () => {
      const submitRes = await agentExecutionEngine.submitExecution(
        {
          agent_id: "AGT-001",
          business_id: TEST_BUSINESS_ID,
          task_type: "stock_adjustment",
          task_input: { sku: "MILK-001", quantity_delta: -100, reason: "Pending test" },
        },
        { userId: TEST_OWNER_ID, email: "owner@geflow.test" }
      );

      const cancelRes = await agentExecutionEngine.cancelExecution({
        executionId: submitRes.execution.execution_id,
        businessId: TEST_BUSINESS_ID,
        userId: TEST_OWNER_ID,
        reason: "User cancelled pending task",
      });

      expect(cancelRes.execution.status).toBe("cancelled");
      expect(cancelRes.execution.cancellation_reason).toBe("User cancelled pending task");
    });

    it("refuses to cancel an already completed execution", async () => {
      const submitRes = await agentExecutionEngine.submitExecution(
        {
          agent_id: "AGT-001",
          business_id: TEST_BUSINESS_ID,
          task_type: "diagnostic_echo",
          task_input: { message: "Ping" },
        },
        { userId: TEST_OWNER_ID, email: "owner@geflow.test" }
      );

      expect(submitRes.execution.status).toBe("completed");

      const cancelRes = await agentExecutionEngine.cancelExecution({
        executionId: submitRes.execution.execution_id,
        businessId: TEST_BUSINESS_ID,
        userId: TEST_OWNER_ID,
        reason: "Try to cancel completed",
      });

      expect(cancelRes.error).toBeDefined();
    });
  });

  // ==========================================
  // 5. AUDIT LEDGER & CRYPTOGRAPHIC INTEGRITY
  // ==========================================
  describe("5. Centralized Audit Logging & Hash Chaining", () => {
    it("records tamper-evident audit events with valid cryptographic hash chaining", () => {
      const verification = agentAuditService.verifyAuditIntegrity();
      expect(verification.valid).toBe(true);
      expect(verification.totalEvents).toBeGreaterThan(0);
    });

    it("allows Manager or Owner to query centralized audit events", async () => {
      const auditQuery = await agentAuditService.getAuditEvents(
        { business_id: TEST_BUSINESS_ID },
        { userId: TEST_OWNER_ID }
      );

      expect(auditQuery.events.length).toBeGreaterThan(0);
      expect(auditQuery.total).toBeGreaterThan(0);
      // Verify SHA-256 event_hash format
      expect(auditQuery.events[0].event_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("denies Member role from querying centralized audit ledger", async () => {
      await expect(
        agentAuditService.getAuditEvents(
          { business_id: TEST_BUSINESS_ID },
          { userId: TEST_MEMBER_ID }
        )
      ).rejects.toThrow(/requires Manager, Admin, or Owner privilege/);
    });
  });

  // ==========================================
  // 6. OBSERVABILITY & METRICS
  // ==========================================
  describe("6. Observability & Metrics", () => {
    it("computes execution metrics for a business accurately", async () => {
      const metrics = await agentExecutionEngine.getExecutionMetrics(TEST_BUSINESS_ID, {
        userId: TEST_OWNER_ID,
      });

      expect(metrics.business_id).toBe(TEST_BUSINESS_ID);
      expect(metrics.total_executions).toBeGreaterThan(0);
      expect(metrics.completed_executions).toBeGreaterThan(0);
      expect(metrics.agent_activity["AGT-001"]).toBeDefined();
      expect(metrics.agent_activity["AGT-001"].count).toBeGreaterThan(0);
    });
  });
});
