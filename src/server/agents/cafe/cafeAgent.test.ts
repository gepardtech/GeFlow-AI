/**
 * GeFlow AI — AGT-019 Cafe & Coffee Shop Agent Pilot Test Suite (Step 13)
 *
 * Validates agent identity, CAT-019 association, configuration schema,
 * recipe costing calculations, stock availability audits, sales analytics,
 * organization isolation, and centralized audit logging.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { cafeAgentService, CAFE_AGENT_ID, CAFE_CATEGORY_ID, CAFE_PILOT_STATUS } from "./cafeAgentService";
import { agentRegistryService } from "../agentRegistryService";
import { agentVersioningService } from "../agentVersioningService";
import { agentConfigurationService } from "../../configurations/agentConfigurationService";
import { businessDataSyncService } from "../../team/businessDataSyncService";
import { productVariationsStorage } from "../../productVariationsStorage";
import { agentAuditService } from "../../executions/agentAuditService";
import { organizationAuthService } from "../../auth/organizationAuthService";

describe("Step 13: Cafe Agent (AGT-019) Pilot Implementation", () => {
  const TEST_BUSINESS_CAFE = "biz_cafe_artisan_01";
  const TEST_USER_OWNER = "user_cafe_owner_01";
  const TEST_USER_ATTACKER = "user_attacker_02";

  beforeAll(async () => {
    // Warm up cache & seed test business data
    await organizationAuthService.resolveCategory("CAT-019");

    // Seed mock business with CAT-019 for cafe tests
    businessDataSyncService.syncBatch(TEST_BUSINESS_CAFE, {
      businessName: "Artisan Roasters & Cafe",
      ownerUserId: TEST_USER_OWNER,
      categories: [
        { id: "CAT-019", name: "Cafe & Coffee Shop" },
        { id: "cat_bev", name: "Hot Beverages" },
      ],
      products: [
        {
          id: "cafe_cappuccino_01",
          business_id: TEST_BUSINESS_CAFE,
          name: "Signature Cappuccino",
          retail_price: 4.5,
          purchase_cost: 1.2,
          stock_units: 40,
          min_stock_alert: 10,
          status: "active",
          category_id: "CAT-019",
          uom: "cup",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "cafe_espresso_beans_01",
          business_id: TEST_BUSINESS_CAFE,
          name: "Arabica Espresso Beans 1kg",
          retail_price: 24.0,
          purchase_cost: 14.0,
          stock_units: 3, // Low stock (< 5)
          min_stock_alert: 5,
          status: "low_stock",
          category_id: "CAT-019",
          uom: "kg",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "cafe_whole_milk_01",
          business_id: TEST_BUSINESS_CAFE,
          name: "Whole Barista Milk 1L",
          retail_price: 3.0,
          purchase_cost: 1.5,
          stock_units: 1, // Critically low (< 10)
          min_stock_alert: 10,
          status: "low_stock",
          category_id: "CAT-019",
          uom: "L",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "cafe_pastry_croissant_01",
          business_id: TEST_BUSINESS_CAFE,
          name: "Butter Croissant",
          retail_price: 3.5,
          purchase_cost: 1.2,
          stock_units: 15,
          min_stock_alert: 5,
          status: "active",
          category_id: "CAT-019",
          uom: "piece",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      sales: [
        {
          id: "sale_cafe_01",
          business_id: TEST_BUSINESS_CAFE,
          total: 12.5,
          profit: 8.0,
          status: "completed",
          created_at: new Date().toISOString(),
        },
        {
          id: "sale_cafe_02",
          business_id: TEST_BUSINESS_CAFE,
          total: 8.0,
          profit: 5.3,
          status: "completed",
          created_at: new Date().toISOString(),
        },
      ],
      sale_items: [
        {
          id: "item_01",
          sale_id: "sale_cafe_01",
          product_name: "Signature Cappuccino",
          quantity: 2,
          unit_price: 4.5,
          unit_cost: 1.2,
          created_at: new Date().toISOString(),
        },
        {
          id: "item_02",
          sale_id: "sale_cafe_01",
          product_name: "Butter Croissant",
          quantity: 1,
          unit_price: 3.5,
          unit_cost: 1.2,
          created_at: new Date().toISOString(),
        },
        {
          id: "item_03",
          sale_id: "sale_cafe_02",
          product_name: "Signature Cappuccino",
          quantity: 1,
          unit_price: 4.5,
          unit_cost: 1.2,
          created_at: new Date().toISOString(),
        },
        {
          id: "item_04",
          sale_id: "sale_cafe_02",
          product_name: "Iced Latte",
          quantity: 1,
          unit_price: 3.5,
          unit_cost: 1.0,
          created_at: new Date().toISOString(),
        },
      ],
    });

    // Ensure category_id is set on the in-memory unit
    const unit = (businessDataSyncService as any).units?.[TEST_BUSINESS_CAFE];
    if (unit) {
      unit.category_id = "CAT-019";
      unit.categoryId = "CAT-019";
    }

    // Seed product variants for Signature Cappuccino (Small, Medium, Large)
    productVariationsStorage.saveConfig({
      product_id: "cafe_cappuccino_01",
      business_id: TEST_BUSINESS_CAFE,
      product_type: "variable",
      attributes: [
        {
          id: "attr_size",
          name: "Size",
          values: ["Small (8oz)", "Medium (12oz)", "Large (16oz)"],
          generatesVariants: true,
        },
      ],
      variants: [
        {
          id: "var_cap_small",
          parent_id: "cafe_cappuccino_01",
          name: "Small (8oz)",
          sku: "CAP-SM",
          retail_price: 3.8,
          purchase_cost: 0.95,
          stock_units: 50,
          attributes: { Size: "Small (8oz)" },
          active: true,
        },
        {
          id: "var_cap_med",
          parent_id: "cafe_cappuccino_01",
          name: "Medium (12oz)",
          sku: "CAP-MD",
          retail_price: 4.5,
          purchase_cost: 1.2,
          stock_units: 40,
          attributes: { Size: "Medium (12oz)" },
          active: true,
        },
        {
          id: "var_cap_large",
          parent_id: "cafe_cappuccino_01",
          name: "Large (16oz)",
          sku: "CAP-LG",
          retail_price: 5.2,
          purchase_cost: 1.5,
          stock_units: 30,
          attributes: { Size: "Large (16oz)" },
          active: true,
        },
      ],
      modifiers: [],
      updated_at: new Date().toISOString(),
    });
  }, 20000);

  // ==========================================
  // 1. AGENT IDENTITY & REGISTRY TESTS
  // ==========================================
  describe("1. Agent Identity & Registry Integrity", () => {
    it("verifies AGT-019 is registered with stable ID and CAT-019 mapping", () => {
      const agent = agentRegistryService.getAgentById(CAFE_AGENT_ID);
      expect(agent).toBeDefined();
      expect(agent?.agent_id).toBe("AGT-019");
      expect(agent?.name).toBe("Cafe & Coffee Shop Agent");
      expect(agent?.primary_category_id).toBe(CAFE_CATEGORY_ID);
      expect(agent?.status).toBe("active");
    });

    it("ensures AGT-019 has active configuration version 1.0.0 and contract 1.0", () => {
      const activeVersion = agentVersioningService.getActiveVersion(CAFE_AGENT_ID);
      expect(activeVersion).toBeDefined();
      expect(activeVersion?.version).toBe("1.0.0");
      expect(activeVersion?.contract_version).toBe("1.0");
    });

    it("verifies pilot status metadata exposes development_testing status", async () => {
      const pilotStatus = await cafeAgentService.getPilotStatus(TEST_BUSINESS_CAFE);
      expect(pilotStatus.agent_id).toBe("AGT-019");
      expect(pilotStatus.pilot_status).toBe(CAFE_PILOT_STATUS);
      expect(pilotStatus.primary_category_id).toBe("CAT-019");
      expect(pilotStatus.supported_task_categories).toContain("recipe_analysis");
      expect(pilotStatus.supported_task_categories).toContain("ingredient_cost_analysis");
      expect(pilotStatus.supported_task_categories).toContain("stock_availability");
    });
  });

  // ==========================================
  // 2. CONFIGURATION & SCHEMA TESTS
  // ==========================================
  describe("2. Configuration Schema & Domain Parameters", () => {
    it("validates AGT-019 configuration against canonical schema", () => {
      const config = agentConfigurationService.getConfiguration(CAFE_AGENT_ID);
      expect(config).toBeDefined();
      expect(config?.identity?.agent_id).toBe(CAFE_AGENT_ID);
      expect(config?.agent_specific_parameters).toBeDefined();
      expect(config?.agent_specific_parameters.coffee_roast_date_freshness_window_days).toBe(21);
      expect(config?.agent_specific_parameters.dairy_alternative_milk_surcharge).toBe(0.5);
      expect(config?.agent_specific_parameters.barista_speed_of_service_target_seconds).toBe(90);
    });

    it("validates configuration schema rules for AGT-019", () => {
      const baseConfig = agentConfigurationService.getConfiguration(CAFE_AGENT_ID);
      const validation = agentConfigurationService.validateConfiguration(baseConfig, CAFE_AGENT_ID);
      expect(validation.is_valid).toBe(true);
      expect(validation.validation_errors).toHaveLength(0);
    });
  });

  // ==========================================
  // 3. CAFE BUSINESS DOMAIN & RECIPE COSTING
  // ==========================================
  describe("3. Cafe Business Logic & Recipe Costing Formulas", () => {
    it("retrieves cafe menu items separating finished goods from bulk ingredients", () => {
      const menu = cafeAgentService.getCafeMenu(TEST_BUSINESS_CAFE);
      expect(menu.length).toBeGreaterThan(0);
      const cap = menu.find((m) => m.id === "cafe_cappuccino_01");
      expect(cap).toBeDefined();
      expect(cap?.is_beverage).toBe(true);
      expect(cap?.has_variants).toBe(true);
      expect(cap?.variants_count).toBe(3);
    });

    it("retrieves product size variants with independent pricing", () => {
      const variants = cafeAgentService.getProductVariants(TEST_BUSINESS_CAFE, "cafe_cappuccino_01");
      expect(variants).toHaveLength(3);
      const small = variants.find((v) => v.name.includes("Small"));
      const large = variants.find((v) => v.name.includes("Large"));
      expect(small?.retail_price).toBe(3.8);
      expect(large?.retail_price).toBe(5.2);
    });

    it("calculates exact recipe costing, gross profit, and gross margin %", () => {
      // Test formula:
      // Total Recipe Cost = sum(qty * unit_cost)
      // Gross Profit = Selling Price - Recipe Cost
      // Gross Margin % = (Gross Profit / Selling Price) * 100
      const customIngredients: CafeRecipeIngredient[] = [
        {
          ingredient_id: "ing_espresso",
          name: "Espresso Dose (18g)",
          quantity: 1,
          uom: "dose",
          unit_cost: 0.45,
          total_cost: 0.45,
        },
        {
          ingredient_id: "ing_milk",
          name: "Steamed Whole Milk (200ml)",
          quantity: 1,
          uom: "serving",
          unit_cost: 0.35,
          total_cost: 0.35,
        },
        {
          ingredient_id: "ing_cup",
          name: "Paper Cup & Lid",
          quantity: 1,
          uom: "piece",
          unit_cost: 0.15,
          total_cost: 0.15,
        },
      ];

      const costing = cafeAgentService.calculateRecipeCosting({
        businessId: TEST_BUSINESS_CAFE,
        productId: "cafe_cappuccino_01",
        customIngredients,
      });

      expect(costing.selling_price).toBe(4.5);
      expect(costing.total_recipe_cost).toBe(0.95); // 0.45 + 0.35 + 0.15
      expect(costing.gross_profit).toBe(3.55); // 4.50 - 0.95
      expect(costing.gross_margin_percent).toBe(78.9); // (3.55 / 4.5) * 100 = 78.88% -> 78.9%
      expect(costing.highest_cost_ingredient?.name).toBe("Espresso Dose (18g)");
      expect(costing.highest_cost_ingredient?.total_cost).toBe(0.45);
      expect(costing.excluded_costs).toEqual(["labor", "rent", "electricity", "packaging"]);
      expect(costing.profit_type).toBe("gross_profit");
    });

    it("calculates recipe costing for a specific variant size", () => {
      const costingSmall = cafeAgentService.calculateRecipeCosting({
        businessId: TEST_BUSINESS_CAFE,
        productId: "cafe_cappuccino_01",
        variantName: "Small (8oz)",
      });

      expect(costingSmall.selling_price).toBe(3.8);
      expect(costingSmall.variant_name).toBe("Small (8oz)");
      expect(costingSmall.gross_profit).toBeGreaterThan(0);
    });

    it("handles incomplete recipe with transparent warning note", () => {
      const costingIncomplete = cafeAgentService.calculateRecipeCosting({
        businessId: TEST_BUSINESS_CAFE,
        productId: "cafe_pastry_croissant_01",
      });

      expect(costingIncomplete.recipe_status).toBe("incomplete");
      expect(costingIncomplete.notes).toBeDefined();
      expect(costingIncomplete.notes).toContain("Bill of Materials (BOM) is not fully itemized");
    });
  });

  // ==========================================
  // 4. STOCK AUDIT & INVENTORY AWARENESS
  // ==========================================
  describe("4. Stock Availability & Ingredient Shortage Audit", () => {
    it("identifies low stock cafe ingredients and maps affected menu drinks", () => {
      const audit = cafeAgentService.auditStockAvailability(TEST_BUSINESS_CAFE);
      expect(audit.summary.low_stock_count).toBeGreaterThan(0);

      const lowBean = audit.low_stock_ingredients.find((i) => i.name.includes("Espresso Beans"));
      expect(lowBean).toBeDefined();
      expect(lowBean?.status).toBe("low_stock");
      expect(lowBean?.affected_menu_items).toBeDefined();
      expect(lowBean?.affected_menu_items).toContain("Cappuccino");
      expect(lowBean?.affected_menu_items).toContain("Latte");

      expect(audit.affected_menu_items).toContain("Cappuccino");
    });

    it("generates actionable recommendations without executing unapproved actions", () => {
      const recommendations = cafeAgentService.generateRecommendations(TEST_BUSINESS_CAFE);
      expect(recommendations.length).toBeGreaterThan(0);
      const reorderRec = recommendations.find((r) => r.type === "low_stock_reorder");
      expect(reorderRec).toBeDefined();
      expect(reorderRec?.requires_authorization).toBe(true);
      expect(reorderRec?.action_suggestion).toContain("Draft purchase order");
    });
  });

  // ==========================================
  // 5. SALES ANALYSIS & VELOCITY
  // ==========================================
  describe("5. Sales Analytics & Velocity", () => {
    it("aggregates best-selling drinks and hot vs cold coffee revenue", () => {
      const sales = cafeAgentService.analyzeSalesPerformance(TEST_BUSINESS_CAFE, "this_month");
      expect(sales.total_transactions).toBe(2);
      expect(sales.total_period_revenue).toBe(20.5); // 12.5 + 8.0

      expect(sales.best_selling_items.length).toBeGreaterThan(0);
      expect(sales.best_selling_items[0].product_name).toBe("Signature Cappuccino");
      expect(sales.best_selling_items[0].quantity_sold).toBe(3);

      expect(sales.hot_vs_cold_comparison?.hot_units).toBe(3); // 3 cappuccinos
      expect(sales.hot_vs_cold_comparison?.cold_units).toBe(1); // 1 iced latte
    });
  });

  // ==========================================
  // 6. SECURITY, ISOLATION & AUDIT LOGGING
  // ==========================================
  describe("6. Security, Multi-Tenant Isolation & Audit Logging", () => {
    it("rejects agent identity spoofing (requesting AGT-001 through cafe service)", async () => {
      const access = await cafeAgentService.validateAccess({
        userId: TEST_USER_OWNER,
        businessId: TEST_BUSINESS_CAFE,
        requestedAgentId: "AGT-001",
      });
      expect(access.allowed).toBe(false);
      expect(access.reason).toContain("Agent identity mismatch");
    });

    it("rejects unauthorized user attempting to access cafe data", async () => {
      const taskRes = await cafeAgentService.executeTask(
        {
          business_id: "biz_other_unowned_88",
          query: "Show me my cafe menu",
        },
        {
          userId: TEST_USER_ATTACKER,
          isPlatformAdmin: false,
        }
      );
      expect(taskRes.response_status).toBe("error");
      expect(taskRes.error_code).toBe("UNAUTHORIZED_CATEGORY_OR_ORG");
    });

    it("executes valid cafe task and generates standard response contract with audit events", async () => {
      const taskRes = await cafeAgentService.executeTask(
        {
          business_id: TEST_BUSINESS_CAFE,
          query: "Calculate recipe cost of cappuccino",
          task_type: "cafe_recipe_costing",
        },
        {
          userId: TEST_USER_OWNER,
          isPlatformAdmin: false,
        }
      );

      expect(taskRes.response_status).toBe("success");
      expect(taskRes.agent_id).toBe("AGT-019");
      expect(taskRes.agent_name).toBe("Cafe & Coffee Shop Agent");
      expect(taskRes.configuration_version).toBe("1.0.0");
      expect(taskRes.contract_version).toBe("1.0");
      expect(taskRes.structured_data?.recipe_analysis).toBeDefined();

      // Verify execution events were recorded in audit log
      const auditResult = await agentAuditService.getAuditEvents(
        {
          business_id: TEST_BUSINESS_CAFE,
          agent_id: "AGT-019",
          limit: 10,
        },
        {
          userId: TEST_USER_OWNER,
          isPlatformAdmin: false,
        }
      );

      expect(auditResult.events.length).toBeGreaterThan(0);
      const executionEvent = auditResult.events.find((e) => e.agent_id === "AGT-019");
      expect(executionEvent).toBeDefined();
    });

    it("handles conversational chat queries in Roman Urdu with verified calculations", async () => {
      const chatRes = await cafeAgentService.handleCafeChat(
        {
          business_id: TEST_BUSINESS_CAFE,
          query: "Cappuccino ka recipe cost aur munafa kitna hai?",
          language: "roman_urdu",
        },
        {
          userId: TEST_USER_OWNER,
          isPlatformAdmin: false,
        }
      );

      expect(chatRes.reply).toContain("Signature Cappuccino");
      expect(chatRes.reply).toContain("Farokht Qimat");
      expect(chatRes.reply).toContain("Gross Margin");
      expect(chatRes.task_response.agent_id).toBe("AGT-019");
    });
  });
});
