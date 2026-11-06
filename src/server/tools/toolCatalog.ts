/**
 * GeFlow AI — Centralized Tool Registry & Catalog (Step 10)
 *
 * Grounded in verified GeFlow business services (inventory, POS, returns, reports).
 * Enforces strict input schemas, lifecycle statuses, permission mappings,
 * and approval policies for every registered business tool.
 */

import { ToolDefinition } from "./toolGatewayTypes";

export const CANONICAL_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    tool_id: "inventory.product.get",
    tool_name: "Get Product by ID or SKU",
    description: "Retrieve product details, pricing, barcodes, and current stock units for the authorized business.",
    category: "inventory",
    module_id: "inventory",
    version: "1.0.0",
    status: "active",
    operation_type: "read",
    input_schema: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          description: "Internal ID or UUID of the product",
          minLength: 1,
          maxLength: 100,
        },
        sku: {
          type: "string",
          description: "Internal SKU or barcode of the product",
          minLength: 1,
          maxLength: 100,
        },
      },
      additionalProperties: false,
    },
    output_schema: {
      type: "object",
      properties: {
        product: { type: "object" },
      },
    },
    required_permissions: ["inventory.read"],
    allowed_agent_ids: "*",
    approval_policy: {
      requires_approval: false,
    },
    execution_policy: {
      idempotent: true,
      max_payload_size_bytes: 4096,
      rate_limit_per_minute: 60,
    },
    timeout_policy: {
      timeout_ms: 5000,
    },
    created_at: "2026-11-06T00:00:00Z",
    updated_at: "2026-11-06T00:00:00Z",
  },
  {
    tool_id: "inventory.products.list",
    tool_name: "List Products Catalog",
    description: "List catalog products for the authorized business with optional status filter and pagination.",
    category: "inventory",
    module_id: "inventory",
    version: "1.0.0",
    status: "active",
    operation_type: "read",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of products to return (1-100)",
          minimum: 1,
          maximum: 100,
        },
        offset: {
          type: "number",
          description: "Pagination offset index",
          minimum: 0,
        },
        status: {
          type: "string",
          description: "Product status filter",
          enum: ["active", "low_stock", "all"],
        },
      },
      additionalProperties: false,
    },
    output_schema: {
      type: "object",
      properties: {
        products: { type: "array" },
        total_count: { type: "number" },
      },
    },
    required_permissions: ["inventory.read"],
    allowed_agent_ids: "*",
    approval_policy: {
      requires_approval: false,
    },
    execution_policy: {
      idempotent: true,
      max_payload_size_bytes: 4096,
      rate_limit_per_minute: 60,
    },
    timeout_policy: {
      timeout_ms: 5000,
    },
    created_at: "2026-11-06T00:00:00Z",
    updated_at: "2026-11-06T00:00:00Z",
  },
  {
    tool_id: "inventory.stock.adjust",
    tool_name: "Adjust Product Stock",
    description: "Adjust inventory stock count for a product with mandatory reason and audit ledger movement.",
    category: "inventory",
    module_id: "inventory",
    version: "1.0.0",
    status: "active",
    operation_type: "write",
    input_schema: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          description: "Target product identifier",
          minLength: 1,
          maxLength: 100,
        },
        deltaQuantity: {
          type: "number",
          description: "Quantity to add (in), deduct (out), or set",
          minimum: 1,
          maximum: 10000,
        },
        type: {
          type: "string",
          description: "Adjustment type: in, out, or set",
          enum: ["in", "out", "set"],
        },
        reason: {
          type: "string",
          description: "Business justification for stock movement",
          minLength: 3,
          maxLength: 250,
        },
        note: {
          type: "string",
          description: "Optional supplementary notes or batch identifier",
          maxLength: 500,
        },
      },
      required: ["productId", "deltaQuantity", "type", "reason"],
      additionalProperties: false,
    },
    output_schema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        newStock: { type: "number" },
        product_id: { type: "string" },
      },
    },
    required_permissions: ["inventory.manage"],
    allowed_agent_ids: "*",
    approval_policy: {
      requires_approval: true,
      approval_criteria: {
        field: "deltaQuantity",
        threshold: 50,
        condition: "greater_than",
      },
      approver_role: "manager",
    },
    execution_policy: {
      idempotent: false,
      max_payload_size_bytes: 8192,
      rate_limit_per_minute: 30,
    },
    timeout_policy: {
      timeout_ms: 7000,
    },
    created_at: "2026-11-06T00:00:00Z",
    updated_at: "2026-11-06T00:00:00Z",
  },
  {
    tool_id: "pos.held_orders.list",
    tool_name: "List Held Orders",
    description: "Retrieve suspended POS cart orders and held customer baskets for resume or reconciliation.",
    category: "pos",
    module_id: "pos",
    version: "1.0.0",
    status: "active",
    operation_type: "read",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum held orders to fetch (1-50)",
          minimum: 1,
          maximum: 50,
        },
      },
      additionalProperties: false,
    },
    output_schema: {
      type: "object",
      properties: {
        held_orders: { type: "array" },
      },
    },
    required_permissions: ["pos.read"],
    allowed_agent_ids: "*",
    approval_policy: {
      requires_approval: false,
    },
    execution_policy: {
      idempotent: true,
      max_payload_size_bytes: 2048,
      rate_limit_per_minute: 60,
    },
    timeout_policy: {
      timeout_ms: 5000,
    },
    created_at: "2026-11-06T00:00:00Z",
    updated_at: "2026-11-06T00:00:00Z",
  },
  {
    tool_id: "pos.sale.create",
    tool_name: "Create POS Sale Transaction",
    description: "Record a completed sales checkout, update revenue metrics, and deduct stock units.",
    category: "pos",
    module_id: "pos",
    version: "1.0.0",
    status: "active",
    operation_type: "write",
    input_schema: {
      type: "object",
      properties: {
        sale: {
          type: "object",
          description: "Header details for sale transaction",
          properties: {
            total: { type: "number", minimum: 0 },
            payment_method: { type: "string" },
            customer_name: { type: "string" },
            customer_phone: { type: "string" },
          },
        },
        items: {
          type: "array",
          description: "Line items included in the purchase",
          items: {
            type: "object",
            properties: {
              product_id: { type: "string" },
              product_name: { type: "string" },
              quantity: { type: "number", minimum: 1 },
              unit_price: { type: "number", minimum: 0 },
              unit_cost: { type: "number", minimum: 0 },
            },
          },
        },
        cashierName: {
          type: "string",
          description: "Name or handle of the processing cashier",
          maxLength: 100,
        },
      },
      required: ["sale", "items"],
      additionalProperties: false,
    },
    output_schema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        sale: { type: "object" },
        updatedProducts: { type: "array" },
      },
    },
    required_permissions: ["pos.read"],
    allowed_agent_ids: "*",
    approval_policy: {
      requires_approval: false,
    },
    execution_policy: {
      idempotent: false,
      max_payload_size_bytes: 16384,
      rate_limit_per_minute: 30,
    },
    timeout_policy: {
      timeout_ms: 8000,
    },
    created_at: "2026-11-06T00:00:00Z",
    updated_at: "2026-11-06T00:00:00Z",
  },
  {
    tool_id: "returns.list",
    tool_name: "List Customer Returns & Refunds",
    description: "Fetch processed returns, refund values, restocked quantities, and return reasons.",
    category: "returns",
    module_id: "returns",
    version: "1.0.0",
    status: "active",
    operation_type: "read",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum returns to fetch (1-50)",
          minimum: 1,
          maximum: 50,
        },
      },
      additionalProperties: false,
    },
    output_schema: {
      type: "object",
      properties: {
        returns: { type: "array" },
      },
    },
    required_permissions: ["pos.read"],
    allowed_agent_ids: "*",
    approval_policy: {
      requires_approval: false,
    },
    execution_policy: {
      idempotent: true,
      max_payload_size_bytes: 2048,
      rate_limit_per_minute: 60,
    },
    timeout_policy: {
      timeout_ms: 5000,
    },
    created_at: "2026-11-06T00:00:00Z",
    updated_at: "2026-11-06T00:00:00Z",
  },
  {
    tool_id: "reports.sales.summary",
    tool_name: "Get Sales & Profit Summary",
    description: "Aggregate total sales revenue, net profit, order volumes, and average basket value for business reporting.",
    category: "reports",
    module_id: "reports",
    version: "1.0.0",
    status: "active",
    operation_type: "read",
    input_schema: {
      type: "object",
      properties: {
        timeframe: {
          type: "string",
          description: "Period of aggregation",
          enum: ["today", "this_week", "this_month", "all_time"],
        },
      },
      additionalProperties: false,
    },
    output_schema: {
      type: "object",
      properties: {
        summary: { type: "object" },
      },
    },
    required_permissions: ["reports.read"],
    allowed_agent_ids: "*",
    approval_policy: {
      requires_approval: false,
    },
    execution_policy: {
      idempotent: true,
      max_payload_size_bytes: 4096,
      rate_limit_per_minute: 60,
    },
    timeout_policy: {
      timeout_ms: 5000,
    },
    created_at: "2026-11-06T00:00:00Z",
    updated_at: "2026-11-06T00:00:00Z",
  },
  {
    tool_id: "system.echo.test",
    tool_name: "Diagnostic Echo Test Fixture",
    description: "Diagnostic test fixture tool for verifying gateway validation, latency, and context isolation.",
    category: "system",
    module_id: "system",
    version: "1.0.0",
    status: "active",
    operation_type: "read",
    input_schema: {
      type: "object",
      properties: {
        echo: {
          type: "string",
          description: "String to echo back",
          minLength: 1,
          maxLength: 100,
        },
      },
      required: ["echo"],
      additionalProperties: false,
    },
    output_schema: {
      type: "object",
      properties: {
        echo: { type: "string" },
        timestamp: { type: "string" },
      },
    },
    required_permissions: ["system.test"],
    allowed_agent_ids: ["AGT-001", "AGT-002", "AGT-003"],
    approval_policy: {
      requires_approval: false,
    },
    execution_policy: {
      idempotent: true,
      max_payload_size_bytes: 1024,
      rate_limit_per_minute: 100,
    },
    timeout_policy: {
      timeout_ms: 3000,
    },
    is_test_fixture: true,
    created_at: "2026-11-06T00:00:00Z",
    updated_at: "2026-11-06T00:00:00Z",
  },
  {
    tool_id: "system.inactive.test",
    tool_name: "Diagnostic Inactive Test Fixture",
    description: "Diagnostic test tool deliberately marked inactive to verify execution prevention.",
    category: "system",
    module_id: "system",
    version: "1.0.0",
    status: "inactive",
    operation_type: "read",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    output_schema: {
      type: "object",
      properties: {},
    },
    required_permissions: ["system.test"],
    allowed_agent_ids: "*",
    approval_policy: {
      requires_approval: false,
    },
    execution_policy: {
      idempotent: true,
      max_payload_size_bytes: 1024,
      rate_limit_per_minute: 10,
    },
    timeout_policy: {
      timeout_ms: 1000,
    },
    is_test_fixture: true,
    created_at: "2026-11-06T00:00:00Z",
    updated_at: "2026-11-06T00:00:00Z",
  },
];
