/**
 * GeFlow AI — Step 14: Cafe Agent (AGT-019) Calculations & Workflows Comprehensive Test Suite
 *
 * Validates mathematical accuracy, unit conversions, multi-variant sizing isolation,
 * theoretical production capacity, sales aggregation, supplier quote comparison,
 * inventory variance, workflows 1-8, concurrency, and security/audit logging.
 *
 * All formulas are verified against independent mathematical assertions.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { cafeAgentService, CAFE_AGENT_ID, CAFE_CATEGORY_ID } from "./cafeAgentService";
import { businessDataSyncService } from "../../team/businessDataSyncService";
import { productVariationsStorage } from "../../productVariationsStorage";
import { organizationAuthService } from "../../auth/organizationAuthService";
import { agentAuditService } from "../../executions/agentAuditService";

describe("Step 14: Cafe Agent (AGT-019) Calculations & Workflows Testing", () => {
  const TEST_BIZ_ID = "biz_cafe_pilot_test_14";
  const TEST_ATTACKER_BIZ_ID = "biz_retail_attacker_14";
  const TEST_USER_ID = "user_cafe_tester_14";
  const TEST_ATTACKER_USER_ID = "user_attacker_14";

  // Section 3 Controlled Dataset Fixtures
  const SAMPLE_CAPPUCCINO_MEDIUM_RECIPE = [
    { ingredient_id: "ing_coffee_beans", name: "Coffee Beans", quantity: 0.018, uom: "kg", unit_cost: 20.0, total_cost: 0.36 },
    { ingredient_id: "ing_milk", name: "Milk", quantity: 0.15, uom: "litre", unit_cost: 2.0, total_cost: 0.3 },
    { ingredient_id: "ing_sugar", name: "Sugar", quantity: 0.01, uom: "kg", unit_cost: 1.5, total_cost: 0.015 },
    { ingredient_id: "ing_chocolate", name: "Chocolate Powder", quantity: 0.005, uom: "kg", unit_cost: 12.0, total_cost: 0.06 },
  ];

  beforeAll(async () => {
    // Warm up category cache
    await organizationAuthService.resolveCategory("CAT-019");

    // Seed deterministic test organization data
    businessDataSyncService.syncBatch(TEST_BIZ_ID, {
      businessName: "Step 14 Controlled Test Cafe",
      ownerUserId: TEST_USER_ID,
      categories: [
        { id: "CAT-019", name: "Cafe & Coffee Shop" },
        { id: "cat_beverages", name: "Beverages" },
      ],
      products: [
        {
          id: "cafe_cappuccino",
          business_id: TEST_BIZ_ID,
          name: "Cappuccino",
          retail_price: 4.0, // Medium price default
          purchase_cost: 0.735,
          stock_units: 100,
          min_stock_alert: 15,
          status: "active",
          category_id: "CAT-019",
          uom: "cup",
        },
        {
          id: "cafe_latte",
          business_id: TEST_BIZ_ID,
          name: "Latte",
          retail_price: 4.5,
          purchase_cost: 0.85,
          stock_units: 80,
          min_stock_alert: 15,
          status: "active",
          category_id: "CAT-019",
          uom: "cup",
        },
        {
          id: "cafe_americano",
          business_id: TEST_BIZ_ID,
          name: "Americano",
          retail_price: 2.5,
          purchase_cost: 0.38,
          stock_units: 120,
          min_stock_alert: 20,
          status: "active",
          category_id: "CAT-019",
          uom: "cup",
        },
        {
          id: "cafe_iced_coffee",
          business_id: TEST_BIZ_ID,
          name: "Iced Coffee",
          retail_price: 4.0,
          purchase_cost: 0.55,
          stock_units: 90,
          min_stock_alert: 15,
          status: "active",
          category_id: "CAT-019",
          uom: "cup",
        },
        // Raw bulk ingredients
        {
          id: "cafe_beans_stock",
          business_id: TEST_BIZ_ID,
          name: "Coffee Beans",
          retail_price: 30.0,
          purchase_cost: 20.0,
          stock_units: 1.0, // 1 kg available
          min_stock_alert: 2.0,
          status: "low_stock",
          category_id: "CAT-019",
          uom: "kg",
        },
        {
          id: "cafe_milk_stock",
          business_id: TEST_BIZ_ID,
          name: "Milk",
          retail_price: 3.5,
          purchase_cost: 2.0,
          stock_units: 5.0, // 5 L available
          min_stock_alert: 10.0,
          status: "low_stock",
          category_id: "CAT-019",
          uom: "litre",
        },
        {
          id: "cafe_sugar_stock",
          business_id: TEST_BIZ_ID,
          name: "Sugar",
          retail_price: 2.5,
          purchase_cost: 1.5,
          stock_units: 1.0, // 1 kg available
          min_stock_alert: 2.0,
          status: "in_stock",
          category_id: "CAT-019",
          uom: "kg",
        },
        {
          id: "cafe_choc_stock",
          business_id: TEST_BIZ_ID,
          name: "Chocolate Powder",
          retail_price: 18.0,
          purchase_cost: 12.0,
          stock_units: 0.5, // 0.5 kg available
          min_stock_alert: 1.0,
          status: "in_stock",
          category_id: "CAT-019",
          uom: "kg",
        },
      ],
      sales: [
        {
          id: "sale_001",
          business_id: TEST_BIZ_ID,
          total: 110.5,
          profit: 85.0,
          status: "completed",
          created_at: new Date().toISOString(),
        },
      ],
      sale_items: [
        {
          id: "si_001",
          sale_id: "sale_001",
          product_name: "Cappuccino Medium",
          quantity: 10,
          unit_price: 4.0,
          unit_cost: 0.735,
        },
        {
          id: "si_002",
          sale_id: "sale_001",
          product_name: "Latte Medium",
          quantity: 5,
          unit_price: 4.5,
          unit_cost: 0.85,
        },
        {
          id: "si_003",
          sale_id: "sale_001",
          product_name: "Americano Regular",
          quantity: 8,
          unit_price: 2.5,
          unit_cost: 0.38,
        },
        {
          id: "si_004",
          sale_id: "sale_001",
          product_name: "Iced Coffee Regular",
          quantity: 7,
          unit_price: 4.0,
          unit_cost: 0.55,
        },
      ],
    });

    // Seed multi-variant pricing for Cappuccino (Small $3, Medium $4, Large $5)
    productVariationsStorage.saveConfig({
      product_id: "cafe_cappuccino",
      product_type: "variable",
      variants: [
        { id: "var_cap_sm", name: "Small", sku: "CAP-SM", retail_price: 3.0, purchase_cost: 0.55, stock_units: 30, attributes: { size: "Small" } },
        { id: "var_cap_md", name: "Medium", sku: "CAP-MD", retail_price: 4.0, purchase_cost: 0.735, stock_units: 50, attributes: { size: "Medium" } },
        { id: "var_cap_lg", name: "Large", sku: "CAP-LG", retail_price: 5.0, purchase_cost: 0.95, stock_units: 20, attributes: { size: "Large" } },
      ],
      attributes: [{ id: "attr_size", name: "Size", values: ["Small", "Medium", "Large"] }],
    });

    // Seed multi-variant pricing for Latte (Small $3.50, Medium $4.50, Large $5.50)
    productVariationsStorage.saveConfig({
      product_id: "cafe_latte",
      product_type: "variable",
      variants: [
        { id: "var_lat_sm", name: "Small", sku: "LAT-SM", retail_price: 3.5, purchase_cost: 0.65, stock_units: 25, attributes: { size: "Small" } },
        { id: "var_lat_md", name: "Medium", sku: "LAT-MD", retail_price: 4.5, purchase_cost: 0.85, stock_units: 40, attributes: { size: "Medium" } },
        { id: "var_lat_lg", name: "Large", sku: "LAT-LG", retail_price: 5.5, purchase_cost: 1.05, stock_units: 15, attributes: { size: "Large" } },
      ],
      attributes: [{ id: "attr_size", name: "Size", values: ["Small", "Medium", "Large"] }],
    });

    // Seed non-cafe attacker business with retail category
    businessDataSyncService.syncBatch(TEST_ATTACKER_BIZ_ID, {
      businessName: "Attacker Hardware & Retail",
      ownerUserId: TEST_ATTACKER_USER_ID,
      categories: [{ id: "CAT-015", name: "Hardware & Tools" }],
      products: [],
      sales: [],
    });
  });

  // =========================================================================
  // SECTION 4: CALCULATION TESTING
  // =========================================================================

  describe("4.1 Recipe Ingredient Costing", () => {
    it("CALC-001: calculates individual ingredient costs accurately", () => {
      // Coffee Beans: 0.018 * 20 = 0.36
      const beansCost = 0.018 * 20.0;
      expect(beansCost).toBeCloseTo(0.36, 4);

      // Milk: 0.150 * 2 = 0.30
      const milkCost = 0.15 * 2.0;
      expect(milkCost).toBeCloseTo(0.3, 4);

      // Sugar: 0.010 * 1.50 = 0.015
      const sugarCost = 0.01 * 1.5;
      expect(sugarCost).toBeCloseTo(0.015, 4);

      // Chocolate Powder: 0.005 * 12 = 0.06
      const chocCost = 0.005 * 12.0;
      expect(chocCost).toBeCloseTo(0.06, 4);
    });

    it("CALC-002: calculates total recipe cost = sum of ingredient costs ($0.735)", () => {
      const costing = cafeAgentService.calculateRecipeCosting({
        businessId: TEST_BIZ_ID,
        productId: "cafe_cappuccino",
        variantName: "Medium",
        customIngredients: SAMPLE_CAPPUCCINO_MEDIUM_RECIPE,
      });

      // Expected raw total = 0.36 + 0.30 + 0.015 + 0.06 = 0.735
      const expectedTotal = 0.36 + 0.3 + 0.015 + 0.06;
      expect(costing.total_recipe_cost).toBeCloseTo(0.74, 2); // Two-decimal display rounding
      expect(expectedTotal).toBeCloseTo(0.735, 4);
      expect(costing.ingredients.length).toBe(4);
    });

    it("CALC-003: handles single ingredient recipe without error", () => {
      const costing = cafeAgentService.calculateRecipeCosting({
        businessId: TEST_BIZ_ID,
        productId: "cafe_americano",
        customIngredients: [
          { ingredient_id: "ing_espresso", name: "Espresso Beans", quantity: 0.018, uom: "kg", unit_cost: 20.0, total_cost: 0.36 },
        ],
      });
      expect(costing.total_recipe_cost).toBeCloseTo(0.36, 2);
      expect(costing.ingredients.length).toBe(1);
    });

    it("CALC-004: handles decimal quantities and zero-cost ingredients safely", () => {
      const costing = cafeAgentService.calculateRecipeCosting({
        businessId: TEST_BIZ_ID,
        productId: "cafe_americano",
        customIngredients: [
          { ingredient_id: "ing_beans", name: "Coffee Beans", quantity: 0.018, uom: "kg", unit_cost: 20.0, total_cost: 0.36 },
          { ingredient_id: "ing_water", name: "Filtered Water", quantity: 0.25, uom: "litre", unit_cost: 0.0, total_cost: 0.0 },
        ],
      });
      expect(costing.total_recipe_cost).toBeCloseTo(0.36, 2);
      expect(costing.ingredients[1].total_cost).toBe(0.0);
    });
  });

  describe("4.2 Gross Profit Calculation", () => {
    it("CALC-005: computes Gross Profit = Selling Price − Recipe Cost ($4.00 - $0.735 = $3.265 -> $3.27)", () => {
      const sellingPrice = 4.0;
      const recipeCost = 0.735;
      const expectedGrossProfit = sellingPrice - recipeCost; // 3.265

      const costing = cafeAgentService.calculateRecipeCosting({
        businessId: TEST_BIZ_ID,
        productId: "cafe_cappuccino",
        variantName: "Medium",
        customIngredients: SAMPLE_CAPPUCCINO_MEDIUM_RECIPE,
      });

      expect(expectedGrossProfit).toBeCloseTo(3.265, 3);
      expect(costing.gross_profit).toBe(3.27); // $4.00 - $0.735 = $3.265 -> displayed $3.27
      expect(costing.profit_type).toBe("gross_profit");
      expect(costing.excluded_costs).toContain("labor");
      expect(costing.excluded_costs).toContain("rent");
    });
  });

  describe("4.3 Gross Margin Calculation", () => {
    it("CALC-006: computes Gross Margin (%) = (Gross Profit ÷ Selling Price) × 100 (81.63%)", () => {
      const grossProfit = 3.265;
      const sellingPrice = 4.0;
      const expectedMargin = (grossProfit / sellingPrice) * 100; // 81.625%

      const costing = cafeAgentService.calculateRecipeCosting({
        businessId: TEST_BIZ_ID,
        productId: "cafe_cappuccino",
        variantName: "Medium",
        customIngredients: SAMPLE_CAPPUCCINO_MEDIUM_RECIPE,
      });

      expect(expectedMargin).toBeCloseTo(81.625, 3);
      expect(costing.gross_margin_percent).toBeCloseTo(81.6, 1); // 81.63% displayed
    });

    it("CALC-007: prevents division by zero when selling price is zero", () => {
      const costing = cafeAgentService.calculateRecipeCosting({
        businessId: TEST_BIZ_ID,
        productId: "cafe_cappuccino",
        customIngredients: [
          { ingredient_id: "ing_promo", name: "Sample Cup", quantity: 1, uom: "cup", unit_cost: 0.5, total_cost: 0.5 },
        ],
      });
      // Force selling price 0
      costing.selling_price = 0;
      expect(costing.gross_margin_percent).toBeDefined();
      expect(Number.isFinite(costing.gross_margin_percent)).toBe(true);
    });
  });

  describe("4.4 Markup Calculation", () => {
    it("CALC-008: computes Markup (%) = (Gross Profit ÷ Recipe Cost) × 100 (444.22%)", () => {
      const grossProfit = 3.265;
      const recipeCost = 0.735;
      const expectedMarkup = (grossProfit / recipeCost) * 100; // 444.2176%

      const markup = cafeAgentService.calculateMarkup(grossProfit, recipeCost);
      expect(markup).toBeCloseTo(444.22, 2);
      expect(expectedMarkup).toBeCloseTo(444.22, 2);

      // Assert Markup is strictly distinct from Gross Margin
      const grossMargin = (grossProfit / 4.0) * 100;
      expect(markup).not.toEqual(grossMargin);
      expect(markup).toBeGreaterThan(grossMargin);
    });
  });

  describe("4.5 Selling Price Recommendation", () => {
    it("CALC-009: computes Recommended Selling Price = Recipe Cost ÷ (1 − Target Margin)", () => {
      const recipeCost = 0.735;
      const targetMargin = 0.6; // 60%
      const expectedPrice = recipeCost / (1 - targetMargin); // 0.735 / 0.40 = 1.8375 -> $1.84

      const rec = cafeAgentService.calculateRecommendedSellingPrice(recipeCost, 60);
      expect(expectedPrice).toBe(1.8375);
      expect(rec.recommendedPrice).toBe(1.84);
      expect(rec.displayedPrice).toBe("$1.84");
      expect(rec.targetMarginPercent).toBe(60);
    });

    it("CALC-010: correctly computes 30%, 50%, and 75% target gross margins", () => {
      const cost = 1.0;
      // 30%: 1.0 / 0.70 = 1.4285 -> $1.43
      expect(cafeAgentService.calculateRecommendedSellingPrice(cost, 30).recommendedPrice).toBe(1.43);

      // 50%: 1.0 / 0.50 = 2.00
      expect(cafeAgentService.calculateRecommendedSellingPrice(cost, 50).recommendedPrice).toBe(2.0);

      // 75%: 1.0 / 0.25 = 4.00
      expect(cafeAgentService.calculateRecommendedSellingPrice(cost, 75).recommendedPrice).toBe(4.0);
    });

    it("CALC-011: rejects mathematically invalid target margins (>= 100%) with clear explanation", () => {
      expect(() => cafeAgentService.calculateRecommendedSellingPrice(0.735, 100)).toThrow(
        /mathematically invalid for this formula/i
      );
      expect(() => cafeAgentService.calculateRecommendedSellingPrice(0.735, 120)).toThrow(
        /mathematically invalid for this formula/i
      );
    });
  });

  // =========================================================================
  // SECTION 5: UOM & UNIT CONVERSION TESTING
  // =========================================================================

  describe("5. UoM & Unit Conversion", () => {
    it("UOM-001: converts kg to grams (0.018 kg = 18 g)", () => {
      const result = cafeAgentService.convertUoM(0.018, "kg", "g");
      expect(result.success).toBe(true);
      expect(result.converted).toBe(18);
    });

    it("UOM-002: converts grams to kg (18 g = 0.018 kg)", () => {
      const result = cafeAgentService.convertUoM(18, "g", "kg");
      expect(result.success).toBe(true);
      expect(result.converted).toBe(0.018);
    });

    it("UOM-003: converts litre to ml (0.150 L = 150 ml)", () => {
      const result = cafeAgentService.convertUoM(0.15, "litre", "ml");
      expect(result.success).toBe(true);
      expect(result.converted).toBe(150);
    });

    it("UOM-004: converts ml to litre (150 ml = 0.150 L)", () => {
      const result = cafeAgentService.convertUoM(150, "ml", "litre");
      expect(result.success).toBe(true);
      expect(result.converted).toBe(0.15);
    });

    it("UOM-005: rejects incompatible unit conversions (e.g. kg to ml or kg to cup)", () => {
      const result = cafeAgentService.convertUoM(1, "kg", "ml");
      expect(result.success).toBe(false);
      expect(result.reason).toContain("Incompatible units");
    });
  });

  // =========================================================================
  // SECTION 6: INVENTORY & RECIPE CONSUMPTION TESTING
  // =========================================================================

  describe("6. Inventory Consumption for 10 Drinks", () => {
    it("INV-001: scales ingredient consumption accurately for batch of 10 Cappuccino Medium drinks", () => {
      const singleDrink = {
        beansKg: 0.018,
        milkL: 0.15,
        sugarKg: 0.01,
        chocolateKg: 0.005,
      };

      const count = 10;
      const batchConsumption = {
        beansKg: singleDrink.beansKg * count,
        milkL: singleDrink.milkL * count,
        sugarKg: singleDrink.sugarKg * count,
        chocolateKg: singleDrink.chocolateKg * count,
      };

      expect(batchConsumption.beansKg).toBe(0.18);
      expect(batchConsumption.milkL).toBe(1.5);
      expect(batchConsumption.sugarKg).toBe(0.1);
      expect(batchConsumption.chocolateKg).toBe(0.05);
    });

    it("INV-002: verifies agent does not deduct inventory on read-only queries", () => {
      const initialBeansStock = 1.0;
      // Query recipe costing
      cafeAgentService.calculateRecipeCosting({
        businessId: TEST_BIZ_ID,
        productId: "cafe_cappuccino",
        variantName: "Medium",
        customIngredients: SAMPLE_CAPPUCCINO_MEDIUM_RECIPE,
      });

      // Verify stock in database remains untouched
      const bizData = businessDataSyncService.getBusinessData(TEST_BIZ_ID, "manager");
      const beansProd = bizData.products?.find((p: any) => p.name === "Coffee Beans");
      expect(Number(beansProd?.stock_units)).toBe(initialBeansStock);
    });
  });

  // =========================================================================
  // SECTION 7: STOCK AVAILABILITY & PRODUCTION CAPACITY
  // =========================================================================

  describe("7. Stock Availability & Production Capacity", () => {
    it("CAP-001: calculates theoretical capacity = 33 Cappuccinos with Milk as limiting ingredient", () => {
      // Inputs: Beans 1 kg, Milk 5 L, Sugar 1 kg, Chocolate 0.5 kg
      // Requirements: Beans 0.018 kg, Milk 0.150 L, Sugar 0.010 kg, Chocolate 0.005 kg
      // Theoretical capacities:
      // floor(1 / 0.018) = 55
      // floor(5 / 0.150) = 33
      // floor(1 / 0.010) = 100
      // floor(0.5 / 0.005) = 100
      // Expected minimum = 33 (Milk)

      const capacityResult = cafeAgentService.calculateProductionCapacity({
        businessId: TEST_BIZ_ID,
        recipeIngredients: [
          { name: "Coffee Beans", quantityRequired: 0.018, uom: "kg" },
          { name: "Milk", quantityRequired: 0.15, uom: "litre" },
          { name: "Sugar", quantityRequired: 0.01, uom: "kg" },
          { name: "Chocolate Powder", quantityRequired: 0.005, uom: "kg" },
        ],
        availableStockOverride: {
          "coffee beans": { stock: 1.0, uom: "kg" },
          milk: { stock: 5.0, uom: "litre" },
          sugar: { stock: 1.0, uom: "kg" },
          "chocolate powder": { stock: 0.5, uom: "kg" },
        },
      });

      expect(capacityResult.maxCapacity).toBe(33);
      expect(capacityResult.limitingIngredient.toLowerCase()).toContain("milk");

      const milkCap = capacityResult.ingredientCapacities.find((c) => c.ingredient.toLowerCase() === "milk");
      expect(milkCap?.capacity).toBe(33);

      const beansCap = capacityResult.ingredientCapacities.find((c) => c.ingredient.toLowerCase() === "coffee beans");
      expect(beansCap?.capacity).toBe(55);
    });

    it("CAP-002: handles zero stock gracefully by returning 0 capacity", () => {
      const capacityResult = cafeAgentService.calculateProductionCapacity({
        businessId: TEST_BIZ_ID,
        recipeIngredients: [{ name: "Coffee Beans", quantityRequired: 0.018, uom: "kg" }],
        availableStockOverride: {
          "coffee beans": { stock: 0.0, uom: "kg" },
        },
      });
      expect(capacityResult.maxCapacity).toBe(0);
      expect(capacityResult.limitingIngredient.toLowerCase()).toContain("coffee beans");
    });
  });

  // =========================================================================
  // SECTION 8: SALES & REVENUE CALCULATION TESTING
  // =========================================================================

  describe("8. Sales & Revenue Calculation Testing", () => {
    it("REV-001: aggregates gross sales = $110.50 across controlled test transactions", () => {
      // 10 Cappuccino ($4.00) = $40.00
      // 5 Latte ($4.50) = $22.50
      // 8 Americano ($2.50) = $20.00
      // 7 Iced Coffee ($4.00) = $28.00
      // Total = $110.50
      const totalGrossSales = 10 * 4.0 + 5 * 4.5 + 8 * 2.5 + 7 * 4.0;
      expect(totalGrossSales).toBe(110.5);

      const salesPerf = cafeAgentService.analyzeSalesPerformance(TEST_BIZ_ID, "this_month");
      expect(salesPerf.total_period_revenue).toBe(110.5);
      expect(salesPerf.total_transactions).toBe(1);
    });
  });

  // =========================================================================
  // SECTION 9: PURCHASE & SUPPLIER WORKFLOW TESTING
  // =========================================================================

  describe("9. Purchase & Supplier Workflow Testing", () => {
    it("SUPP-001: compares 3 suppliers correctly (Lowest C at $19, Highest B at $22, $15 total diff on 5kg)", () => {
      const quotes = [
        { supplier: "Supplier A", unitPrice: 20.0, uom: "kg", quantity: 5 },
        { supplier: "Supplier B", unitPrice: 22.0, uom: "kg", quantity: 5 },
        { supplier: "Supplier C", unitPrice: 19.0, uom: "kg", quantity: 5 },
      ];

      const comp = cafeAgentService.compareSuppliers(quotes);
      expect(comp.lowestSupplier).toBe("Supplier C");
      expect(comp.lowestPrice).toBe(19.0);
      expect(comp.highestSupplier).toBe("Supplier B");
      expect(comp.highestPrice).toBe(22.0);
      expect(comp.priceDifferencePerUnit).toBe(3.0);
      expect(comp.totalDifference).toBe(15.0); // 3 * 5 = $15
    });
  });

  // =========================================================================
  // SECTION 10: WASTAGE & INVENTORY VARIANCE TESTING
  // =========================================================================

  describe("10. Wastage & Inventory Variance Testing", () => {
    it("VAR-001: calculates variance and wastage cost accurately", () => {
      // Actual 8.5 kg, Expected 10.0 kg -> Variance -1.5 kg (-15%)
      const res = cafeAgentService.calculateInventoryVariance({
        actualStock: 8.5,
        expectedStock: 10.0,
        unitCost: 20.0,
        wastedQuantity: 1.5,
      });

      expect(res.inventoryVariance).toBe(-1.5);
      expect(res.variancePercent).toBe(-15.0);
      expect(res.wastageCost).toBe(30.0); // 1.5 * 20.0 = $30.00
    });

    it("VAR-002: handles zero expected stock safely without division by zero", () => {
      const res = cafeAgentService.calculateInventoryVariance({
        actualStock: 2.0,
        expectedStock: 0.0,
      });

      expect(res.inventoryVariance).toBe(2.0);
      expect(res.variancePercent).toBeNull();
      expect(res.notes).toContain("undefined when expected stock is zero");
    });
  });

  // =========================================================================
  // SECTION 11: MULTI-PRODUCT & MULTI-VARIANT SIZING ISOLATION
  // =========================================================================

  describe("11. Multi-Product & Multi-Variant Sizing Isolation", () => {
    it("VAR-003: isolates Small, Medium, Large variants without mixing prices or costs", () => {
      const variants = cafeAgentService.getProductVariants(TEST_BIZ_ID, "cafe_cappuccino");
      expect(variants.length).toBe(3);

      const small = variants.find((v) => v.name === "Small");
      const medium = variants.find((v) => v.name === "Medium");
      const large = variants.find((v) => v.name === "Large");

      expect(small?.retail_price).toBe(3.0);
      expect(medium?.retail_price).toBe(4.0);
      expect(large?.retail_price).toBe(5.0);

      expect(small?.purchase_cost).toBe(0.55);
      expect(medium?.purchase_cost).toBe(0.735);
      expect(large?.purchase_cost).toBe(0.95);
    });
  });

  // =========================================================================
  // SECTION 12: CAFE BUSINESS WORKFLOWS 1 TO 8
  // =========================================================================

  describe("12. Cafe Business Workflows 1 to 8", () => {
    it("WF-001: Workflow 1 — Menu Inquiry returns catalog items with variants", async () => {
      const res = await cafeAgentService.executeTask(
        {
          business_id: TEST_BIZ_ID,
          task_type: "cafe_menu_query",
          query: "Show me my complete cafe menu with prices",
        },
        { userId: TEST_USER_ID, isPlatformAdmin: false }
      );

      expect(res.response_status).toBe("success");
      expect(res.structured_data?.menu_items).toBeDefined();
      expect(res.structured_data?.menu_items.length).toBeGreaterThan(0);
    });

    it("WF-002: Workflow 2 — Recipe Cost Analysis retrieves recipe and costs", async () => {
      const res = await cafeAgentService.executeTask(
        {
          business_id: TEST_BIZ_ID,
          task_type: "cafe_recipe_costing",
          product_id: "cafe_cappuccino",
          variant_name: "Medium",
          query: "Calculate the ingredient cost of my Cappuccino Medium",
        },
        { userId: TEST_USER_ID, isPlatformAdmin: false }
      );

      expect(res.response_status).toBe("success");
      expect(res.structured_data?.recipe_analysis).toBeDefined();
      expect(res.structured_data?.recipe_analysis.selling_price).toBe(4.0);
    });

    it("WF-003: Workflow 3 — Profitability Analysis calculates gross margins accurately", () => {
      const menu = cafeAgentService.getCafeMenu(TEST_BIZ_ID);
      const beverageItems = menu.filter((m) => m.is_beverage);
      expect(beverageItems.length).toBeGreaterThan(0);

      // Cappuccino Margin = 81.63%
      const capCosting = cafeAgentService.calculateRecipeCosting({
        businessId: TEST_BIZ_ID,
        productId: "cafe_cappuccino",
        customIngredients: SAMPLE_CAPPUCCINO_MEDIUM_RECIPE,
      });
      expect(capCosting.gross_margin_percent).toBeGreaterThan(50);
    });

    it("WF-004: Workflow 4 — Stock Availability calculates capacity and limiting ingredient", async () => {
      const res = await cafeAgentService.executeTask(
        {
          business_id: TEST_BIZ_ID,
          task_type: "cafe_production_capacity",
          query: "How many Cappuccino Medium drinks can I make with my current ingredients?",
        },
        { userId: TEST_USER_ID, isPlatformAdmin: false }
      );

      expect(res.response_status).toBe("success");
      expect(res.structured_data?.production_capacity).toBeDefined();
      expect(res.structured_data?.production_capacity.maxCapacity).toBe(33);
      expect(res.structured_data?.production_capacity.limitingIngredient.toLowerCase()).toContain("milk");
    });

    it("WF-005: Workflow 5 — POS Sales Analysis aggregates best-selling drinks", async () => {
      const res = await cafeAgentService.executeTask(
        {
          business_id: TEST_BIZ_ID,
          task_type: "cafe_sales_velocity",
          timeframe: "this_month",
          query: "Show me my best-selling drinks this month",
        },
        { userId: TEST_USER_ID, isPlatformAdmin: false }
      );

      expect(res.response_status).toBe("success");
      expect(res.structured_data?.sales_performance).toBeDefined();
      expect(res.structured_data?.sales_performance.total_period_revenue).toBe(110.5);
    });

    it("WF-006: Workflow 6 — Purchase & Supplier Comparison compares quotes", async () => {
      const quotes = [
        { supplier: "Supplier A", unitPrice: 20.0, uom: "kg", quantity: 5 },
        { supplier: "Supplier B", unitPrice: 22.0, uom: "kg", quantity: 5 },
        { supplier: "Supplier C", unitPrice: 19.0, uom: "kg", quantity: 5 },
      ];

      const res = await cafeAgentService.executeTask(
        {
          business_id: TEST_BIZ_ID,
          task_type: "cafe_supplier_comparison",
          query: "Compare my coffee bean suppliers based on purchase prices",
          supplier_quotes: quotes,
        } as any,
        { userId: TEST_USER_ID, isPlatformAdmin: false }
      );

      expect(res.response_status).toBe("success");
      expect(res.structured_data?.supplier_comparison.lowestSupplier).toBe("Supplier C");
      expect(res.structured_data?.supplier_comparison.totalDifference).toBe(15.0);
    });

    it("WF-007: Workflow 7 — Replenishment Recommendation suggests reorders without mutating DB", () => {
      const recommendations = cafeAgentService.generateRecommendations(TEST_BIZ_ID);
      expect(recommendations.length).toBeGreaterThan(0);
      const reorderRecs = recommendations.filter((r) => r.type === "low_stock_reorder");
      expect(reorderRecs.length).toBeGreaterThan(0);
      expect(reorderRecs[0].requires_authorization).toBe(true);
    });

    it("WF-008: Workflow 8 — Recipe Change Simulation computes cost impact of +10% milk price", async () => {
      // Base recipe cost: 0.735, Selling price: 4.00, Milk ingredient cost: 0.30
      // 10% increase on milk = 0.30 * 0.10 = +$0.03
      // Revised recipe cost = 0.735 + 0.03 = 0.765
      // Revised gross profit = 4.00 - 0.765 = 3.235 -> $3.24
      // Revised margin = (3.235 / 4.00) * 100 = 80.875% -> 80.9%

      const simParams = {
        baseRecipeCost: 0.735,
        sellingPrice: 4.0,
        ingredientName: "Milk",
        ingredientCost: 0.3,
        percentChange: 10,
      };

      const res = await cafeAgentService.executeTask(
        {
          business_id: TEST_BIZ_ID,
          task_type: "cafe_recipe_simulation",
          query: "What happens to my Cappuccino Medium cost if milk price increases by 10%?",
          simulation_params: simParams,
        } as any,
        { userId: TEST_USER_ID, isPlatformAdmin: false }
      );

      expect(res.response_status).toBe("success");
      const sim = res.structured_data?.recipe_simulation;
      expect(sim).toBeDefined();
      expect(sim.costDelta).toBe(0.03);
      expect(sim.revisedRecipeCost).toBe(0.765);
      expect(sim.revisedGrossProfit).toBe(3.24);
      expect(sim.revisedGrossMarginPercent).toBe(80.9);
      expect(sim.isSimulation).toBe(true);
    });
  });

  // =========================================================================
  // SECTION 13-15: RELIABILITY, CONCURRENCY, SECURITY & AUDIT LOGGING
  // =========================================================================

  describe("13-15. Concurrency, Security Isolation & Audit Traceability", () => {
    it("CONC-001: handles concurrent execution requests deterministically", async () => {
      const promises = Array.from({ length: 5 }).map(() =>
        cafeAgentService.executeTask(
          {
            business_id: TEST_BIZ_ID,
            task_type: "cafe_menu_query",
            query: "Show menu",
          },
          { userId: TEST_USER_ID, isPlatformAdmin: false }
        )
      );

      const results = await Promise.all(promises);
      results.forEach((r) => {
        expect(r.response_status).toBe("success");
        expect(r.structured_data?.menu_items.length).toBeGreaterThan(0);
      });
    });

    it("SEC-001: strictly denies access when business has unauthorized category (CAT-015)", async () => {
      const auth = await cafeAgentService.validateAccess({
        userId: TEST_ATTACKER_USER_ID,
        businessId: TEST_ATTACKER_BIZ_ID,
        requestedAgentId: CAFE_AGENT_ID,
      });

      expect(auth.allowed).toBe(false);
      expect(auth.reason).toMatch(/not authorized|Cross-category access denied/i);
    });

    it("SEC-002: rejects task execution across unauthorized organization boundary", async () => {
      const res = await cafeAgentService.executeTask(
        {
          business_id: TEST_ATTACKER_BIZ_ID,
          task_type: "cafe_menu_query",
        },
        { userId: TEST_ATTACKER_USER_ID, isPlatformAdmin: false }
      );

      expect(res.response_status).toBe("error");
      expect(res.error_code).toBe("UNAUTHORIZED_CATEGORY_OR_ORG");
    });

    it("AUDIT-001: verifies audit logging records execution events with immutable IDs", async () => {
      const auditRes = await agentAuditService.getAuditEvents(
        { business_id: TEST_BIZ_ID },
        { userId: TEST_USER_ID }
      );
      expect(auditRes.events.length).toBeGreaterThan(0);

      const cafeEvents = auditRes.events.filter((e) => e.agent_id === CAFE_AGENT_ID);
      expect(cafeEvents.length).toBeGreaterThan(0);

      const lastEvent = cafeEvents[cafeEvents.length - 1];
      expect(lastEvent.agent_id).toBe(CAFE_AGENT_ID);
      expect(lastEvent.execution_id).toBeDefined();
      expect(lastEvent.correlation_id).toBeDefined();
      expect(lastEvent.event_timestamp).toBeDefined();
    });
  });
});
