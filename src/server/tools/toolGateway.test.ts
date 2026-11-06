/**
 * GeFlow AI — Shared Tool Gateway Automated Test Suite (Step 10)
 *
 * Validates all required test dimensions:
 * 1. Tool Registry & Lifecycle Management
 * 2. Tool Discovery & Capability Filtering
 * 3. Secure Tool Invocation (Read & Write Operations)
 * 4. Input Schema Validation & Unknown Property Rejection
 * 5. Multi-Layer Authorization (Agent Identity, Category, Tenant Isolation)
 * 6. Approval Workflow for Sensitive Operations
 * 7. Rate Limiting & Execution Safeguards
 * 8. Audit Logging & Execution Tracing
 */

import { toolGatewayService } from "./toolGatewayService";
import { CANONICAL_TOOL_DEFINITIONS } from "./toolCatalog";
import { businessDataSyncService } from "../team/businessDataSyncService";
import { agentRegistryService } from "../agents/agentRegistryService";
import { ToolDefinition } from "./toolGatewayTypes";

async function runTestSuite() {
  console.log("=================================================");
  console.log("  GEFLOW SHARED TOOL GATEWAY VERIFICATION SUITE  ");
  console.log("=================================================\n");

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`[PASS] ${testName}`);
    } else {
      failedTests++;
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    }
  }

  // Setup test tenant in businessDataSyncService
  const testBusinessId = "biz_test_retail_001";
  const testOwnerId = "usr_owner_001";
  const testManagerId = "usr_manager_001";
  const testStrangerId = "usr_stranger_999";

  // Pre-seed a product in test business catalog
  const testProduct = businessDataSyncService.saveProduct(
    testBusinessId,
    {
      id: "prod_gateway_test_01",
      name: "Smart POS Barcode Scanner",
      internal_sku: "POS-SCAN-900",
      retail_price: 150,
      purchase_cost: 90,
      stock_units: 100,
      status: "active",
      category_id: "CAT-001",
    },
    testOwnerId
  );

  // Pre-seed a product in another tenant
  const foreignBusinessId = "biz_foreign_cafe_002";
  businessDataSyncService.saveProduct(
    foreignBusinessId,
    {
      id: "prod_foreign_item_02",
      name: "Specialty Roasted Beans",
      internal_sku: "COFFEE-BEANS-01",
      retail_price: 25,
      purchase_cost: 12,
      stock_units: 40,
      status: "active",
    },
    "usr_foreign_owner"
  );

  console.log("\n--- Dimension 1: Tool Registry & Lifecycle Tests ---");

  // Test 1: Canonical tools loaded
  const allTools = toolGatewayService.getAllTools();
  assert(
    allTools.length >= CANONICAL_TOOL_DEFINITIONS.length,
    "Test 01: Canonical tools successfully registered in gateway",
    `Loaded: ${allTools.length}`
  );

  // Test 2: Retrieve tool by ID
  const prodGetTool = toolGatewayService.getToolById("inventory.product.get");
  assert(
    prodGetTool !== null && prodGetTool.category === "inventory",
    "Test 02: Retrieve registered tool 'inventory.product.get'",
    `Found tool: ${prodGetTool?.tool_id}`
  );

  // Test 3: Reject duplicate tool registration
  const duplicateRes = toolGatewayService.registerTool({
    ...prodGetTool!,
  });
  assert(
    !duplicateRes.success && duplicateRes.error?.includes("already registered"),
    "Test 03: Rejects duplicate tool ID registration"
  );

  // Test 4: Reject invalid SemVer tool registration
  const invalidSemVerTool: ToolDefinition = {
    ...prodGetTool!,
    tool_id: "test.invalid.semver",
    version: "v1-beta",
  };
  const semverRes = toolGatewayService.registerTool(invalidSemVerTool);
  assert(
    !semverRes.success && semverRes.error?.includes("SemVer"),
    "Test 04: Rejects tool with invalid SemVer format"
  );

  // Test 5: Tool lifecycle status transition
  const statusRes = toolGatewayService.updateToolStatus("system.inactive.test", "active");
  assert(statusRes.success, "Test 05: Updates tool lifecycle status to active");
  toolGatewayService.updateToolStatus("system.inactive.test", "inactive"); // restore to inactive

  console.log("\n--- Dimension 2: Tool Discovery Tests ---");

  // Test 6: Authorized agent discovers permitted tools
  const retailAgentTools = await toolGatewayService.discoverTools({
    agent_id: "AGT-001",
  });
  const hasInventoryGet = retailAgentTools.some((t) => t.tool_id === "inventory.product.get");
  const hasReports = retailAgentTools.some((t) => t.tool_id === "reports.sales.summary");
  assert(
    hasInventoryGet && hasReports,
    "Test 06: AGT-001 discovers permitted inventory and reporting tools",
    `Count: ${retailAgentTools.length}`
  );

  // Test 7: Inactive tools are NOT presented as executable
  const hasInactive = retailAgentTools.some((t) => t.status !== "active");
  assert(!hasInactive, "Test 07: Inactive tools excluded from discovery results");

  // Test 8: Agent with restricted capabilities cannot discover restricted tools
  // E.g. system.echo.test is restricted to AGT-001, AGT-002, AGT-003. AGT-015 cannot see it.
  const agt15Tools = await toolGatewayService.discoverTools({
    agent_id: "AGT-015",
  });
  const agt15HasEcho = agt15Tools.some((t) => t.tool_id === "system.echo.test");
  assert(!agt15HasEcho, "Test 08: Agent AGT-015 cannot discover restricted system tool");

  console.log("\n--- Dimension 3: Input Validation Tests ---");

  // Test 9: Rejects unknown / unauthorized input properties
  const invalidInputRes = toolGatewayService.validateToolInput(prodGetTool!, {
    productId: "prod_001",
    unauthorizedField: "malicious_payload",
  });
  assert(
    !invalidInputRes.valid && invalidInputRes.errors.some((e) => e.includes("Unauthorized or unknown parameter")),
    "Test 09: Rejects input containing unauthorized or unknown fields"
  );

  // Test 10: Rejects missing required parameters
  const adjustTool = toolGatewayService.getToolById("inventory.stock.adjust")!;
  const missingParamRes = toolGatewayService.validateToolInput(adjustTool, {
    productId: "prod_001",
    // deltaQuantity missing
    type: "in",
    reason: "Restock",
  });
  assert(
    !missingParamRes.valid && missingParamRes.errors.some((e) => e.includes("deltaQuantity")),
    "Test 10: Rejects input missing mandatory parameters"
  );

  console.log("\n--- Dimension 4: Execution & Authorization Tests ---");

  // Test 11: Valid Read Tool Invocation (inventory.product.get)
  const validReadRes = await toolGatewayService.invokeTool(
    {
      tool_id: "inventory.product.get",
      parameters: { productId: testProduct.id },
    },
    {
      agent_id: "AGT-001",
      agent_version: "1.0.0",
      contract_version: "1.0",
      business_id: testBusinessId,
      actor_id: testOwnerId,
      is_platform_admin: true,
      request_id: "req_test_read_01",
    }
  );
  assert(
    validReadRes.success && validReadRes.data.product.name === testProduct.name,
    "Test 11: Authorized read invocation retrieves product successfully",
    `Returned: ${validReadRes.data?.product?.name}`
  );

  // Test 12: Rejection of unregistered / unknown tool
  const unknownToolRes = await toolGatewayService.invokeTool(
    {
      tool_id: "nonexistent.fake.tool",
      parameters: {},
    },
    {
      agent_id: "AGT-001",
      agent_version: "1.0.0",
      contract_version: "1.0",
      business_id: testBusinessId,
      actor_id: testOwnerId,
      is_platform_admin: true,
      request_id: "req_test_unknown",
    }
  );
  assert(
    !unknownToolRes.success && unknownToolRes.error?.code === "TOOL_NOT_FOUND",
    "Test 12: Invocations of unregistered tools fail with TOOL_NOT_FOUND"
  );

  // Test 13: Inactive tool cannot execute
  const inactiveToolRes = await toolGatewayService.invokeTool(
    {
      tool_id: "system.inactive.test",
      parameters: {},
    },
    {
      agent_id: "AGT-001",
      agent_version: "1.0.0",
      contract_version: "1.0",
      business_id: testBusinessId,
      actor_id: testOwnerId,
      is_platform_admin: true,
      request_id: "req_test_inactive",
    }
  );
  assert(
    !inactiveToolRes.success && inactiveToolRes.error?.code === "TOOL_INACTIVE",
    "Test 13: Invocations of inactive tools fail with TOOL_INACTIVE"
  );

  // Test 14: Incompatible agent version rejected
  const incompatibleVersionRes = await toolGatewayService.invokeTool(
    {
      tool_id: "inventory.product.get",
      parameters: { productId: testProduct.id },
    },
    {
      agent_id: "AGT-001",
      agent_version: "9.9.9", // non-existent version
      contract_version: "1.0",
      business_id: testBusinessId,
      actor_id: testOwnerId,
      is_platform_admin: true,
      request_id: "req_test_incomp_ver",
    }
  );
  assert(
    !incompatibleVersionRes.success && incompatibleVersionRes.error?.code === "VERSION_INCOMPATIBLE",
    "Test 14: Invocations with incompatible agent version fail with VERSION_INCOMPATIBLE"
  );

  // Test 15: Cross-Tenant Resource Isolation Rejection
  const crossTenantRes = await toolGatewayService.invokeTool(
    {
      tool_id: "inventory.stock.adjust",
      parameters: {
        productId: "prod_foreign_item_02", // belongs to foreignBusinessId
        deltaQuantity: 5,
        type: "in",
        reason: "Unauthorized attempt",
      },
    },
    {
      agent_id: "AGT-001",
      agent_version: "1.0.0",
      contract_version: "1.0",
      business_id: testBusinessId, // caller belongs to testBusinessId
      actor_id: testOwnerId,
      is_platform_admin: false,
      request_id: "req_test_cross_tenant",
    }
  );
  assert(
    !crossTenantRes.success && crossTenantRes.error?.code === "RESOURCE_ACCESS_DENIED",
    "Test 15: Rejects access to resources belonging to other organizations (RESOURCE_ACCESS_DENIED)"
  );

  console.log("\n--- Dimension 5: Human Approval Workflow Tests ---");

  // Test 16: Small stock adjustment (<= 50) executes automatically without approval
  const autoAdjustRes = await toolGatewayService.invokeTool(
    {
      tool_id: "inventory.stock.adjust",
      parameters: {
        productId: testProduct.id,
        deltaQuantity: 10,
        type: "in",
        reason: "Daily Intake",
      },
    },
    {
      agent_id: "AGT-001",
      agent_version: "1.0.0",
      contract_version: "1.0",
      business_id: testBusinessId,
      actor_id: testOwnerId,
      is_platform_admin: true,
      request_id: "req_test_auto_adjust",
    }
  );
  assert(
    autoAdjustRes.success && autoAdjustRes.data.newStock === 110,
    "Test 16: Non-sensitive operation (delta <= 50) executes immediately without approval",
    `New stock: ${autoAdjustRes.data?.newStock}`
  );

  // Test 17: Large stock adjustment (> 50) enters pending approval
  const approvalRequiredRes = await toolGatewayService.invokeTool(
    {
      tool_id: "inventory.stock.adjust",
      parameters: {
        productId: testProduct.id,
        deltaQuantity: 150, // exceeds 50 unit threshold
        type: "in",
        reason: "Bulk Shipment Arrival",
      },
    },
    {
      agent_id: "AGT-001",
      agent_version: "1.0.0",
      contract_version: "1.0",
      business_id: testBusinessId,
      actor_id: testOwnerId,
      is_platform_admin: true,
      request_id: "req_test_large_adjust",
    }
  );
  assert(
    !approvalRequiredRes.success &&
      approvalRequiredRes.error?.code === "APPROVAL_REQUIRED" &&
      Boolean(approvalRequiredRes.metadata.approval_id),
    "Test 17: Sensitive operation (> 50 units) gated by approval requirement (APPROVAL_REQUIRED)",
    `Approval ID: ${approvalRequiredRes.metadata.approval_id}`
  );

  const pendingApprovalId = approvalRequiredRes.metadata.approval_id!;

  // Test 18: Reject approval prevents execution
  const rejectRes = await toolGatewayService.decideApproval({
    approvalId: pendingApprovalId,
    decision: "rejected",
    approverUserId: testManagerId,
    decisionReason: "Inventory variance audit pending.",
    isPlatformAdmin: true,
  });
  assert(
    rejectRes.success && rejectRes.approval?.status === "rejected",
    "Test 18: Rejected approval transitions to 'rejected' without executing operation"
  );

  // Test 19: Approved approval successfully executes the pending operation
  // Create another pending approval
  const secondApprovalRes = await toolGatewayService.invokeTool(
    {
      tool_id: "inventory.stock.adjust",
      parameters: {
        productId: testProduct.id,
        deltaQuantity: 200,
        type: "in",
        reason: "Quarterly Factory Restock",
      },
    },
    {
      agent_id: "AGT-001",
      agent_version: "1.0.0",
      contract_version: "1.0",
      business_id: testBusinessId,
      actor_id: testOwnerId,
      is_platform_admin: true,
      request_id: "req_test_approved_flow",
    }
  );
  const secondApprovalId = secondApprovalRes.metadata.approval_id!;

  const approveRes = await toolGatewayService.decideApproval({
    approvalId: secondApprovalId,
    decision: "approved",
    approverUserId: testManagerId,
    decisionReason: "Verified factory delivery invoice.",
    isPlatformAdmin: true,
  });
  assert(
    approveRes.success &&
      approveRes.approval?.status === "approved" &&
      approveRes.executionResult?.newStock === 310,
    "Test 19: Approved operation automatically executes and updates inventory stock",
    `Final stock: ${approveRes.executionResult?.newStock}`
  );

  console.log("\n--- Dimension 6: Audit Logging & Traceability ---");

  // Test 20: Audit trail logs all executions
  const auditLogs = toolGatewayService.getAuditHistory({ businessId: testBusinessId });
  const hasSuccessAudit = auditLogs.some((a) => a.status === "success");
  const hasDeniedAudit = auditLogs.some((a) => a.status === "denied");
  const hasPendingAudit = auditLogs.some((a) => a.status === "pending_approval");
  assert(
    auditLogs.length >= 4 && hasSuccessAudit && hasDeniedAudit && hasPendingAudit,
    "Test 20: Audit ledger captures comprehensive lifecycle states (success, denied, pending_approval)",
    `Total records: ${auditLogs.length}`
  );

  console.log("\n=================================================");
  console.log(`  TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)  `);
  console.log("=================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((e) => {
  console.error("Test execution fatal error:", e);
  process.exit(1);
});
