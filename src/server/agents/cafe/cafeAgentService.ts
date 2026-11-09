/**
 * GeFlow AI — Cafe & Coffee Shop Agent (AGT-019) Pilot Service (Step 13)
 *
 * Implements the first specialized GeFlow AI agent pilot under the 29-agent architecture.
 * Integrates AGT-019 identity, CAT-019 category association, configuration framework,
 * organization-level isolation, Shared Tool Gateway, execution engine, and centralized audit logging.
 */

import crypto from "crypto";
import { agentRegistryService } from "../agentRegistryService";
import { agentVersioningService } from "../agentVersioningService";
import { agentConfigurationService } from "../../configurations/agentConfigurationService";
import { organizationAuthService } from "../../auth/organizationAuthService";
import { businessDataSyncService } from "../../team/businessDataSyncService";
import { productVariationsStorage } from "../../productVariationsStorage";
import { uomService } from "../../uom/uomService";
import { agentExecutionEngine } from "../../executions/agentExecutionEngine";
import { agentAuditService } from "../../executions/agentAuditService";
import {
  CafeAgentResponsePayload,
  CafeChatRequest,
  CafeMenuItem,
  CafeRecipeAnalysis,
  CafeRecipeIngredient,
  CafeSalesPerformance,
  CafeStockAuditItem,
  CafeVariantPricing,
  CafeRecommendation,
} from "./cafeAgentTypes";

export const CAFE_AGENT_ID = "AGT-019";
export const CAFE_CATEGORY_ID = "CAT-019";
export const CAFE_PILOT_STATUS = "development_testing";

// Standard cafe ingredient to beverage impact mapping
const INGREDIENT_AFFECTED_DRINKS: Record<string, string[]> = {
  coffee_beans: ["Espresso", "Americano", "Cappuccino", "Latte", "Mocha", "Flat White", "Iced Latte", "Cold Brew"],
  espresso_beans: ["Espresso", "Americano", "Cappuccino", "Latte", "Mocha", "Flat White", "Iced Latte"],
  whole_milk: ["Cappuccino", "Latte", "Mocha", "Flat White", "Hot Chocolate", "Iced Latte"],
  oat_milk: ["Oat Milk Latte", "Oat Milk Cappuccino", "Oat Milk Flat White"],
  almond_milk: ["Almond Milk Latte", "Almond Milk Cappuccino"],
  chocolate_syrup: ["Mocha", "Hot Chocolate", "Chocolate Milkshake"],
  vanilla_syrup: ["Vanilla Latte", "Caramel Macchiato", "Vanilla Shake"],
  caramel_sauce: ["Caramel Macchiato", "Caramel Frappe"],
  tea_leaves: ["Earl Grey Tea", "English Breakfast Tea", "Green Tea", "Chai Latte"],
};

export class CafeAgentService {
  /**
   * Returns metadata and readiness status for the AGT-019 pilot.
   */
  public async getPilotStatus(businessId?: string): Promise<{
    agent_id: string;
    agent_name: string;
    primary_category_id: string;
    primary_category_name: string;
    pilot_status: string;
    active_version: string;
    contract_version: string;
    schema_version: string;
    supported_task_categories: string[];
    capabilities: string[];
    permissions: string[];
    configuration: Record<string, any>;
  }> {
    const agent = agentRegistryService.getAgentById(CAFE_AGENT_ID);
    if (!agent) {
      throw new Error(`Pilot agent '${CAFE_AGENT_ID}' is not registered in Agent Registry.`);
    }

    const activeVersion = agentVersioningService.getActiveVersion(CAFE_AGENT_ID);
    const versionStr = activeVersion?.version || agent.version || "1.0.0";
    const contractVersionStr = activeVersion?.contract_version || agent.contract_version || "1.0";

    const schema = agentConfigurationService.getSchema(CAFE_AGENT_ID);
    const baseConfig = agentConfigurationService.getConfiguration(CAFE_AGENT_ID);

    return {
      agent_id: agent.agent_id,
      agent_name: agent.name,
      primary_category_id: agent.primary_category_id || CAFE_CATEGORY_ID,
      primary_category_name: agent.configuration?.specialized_domain || "Cafe & Coffee Shop",
      pilot_status: CAFE_PILOT_STATUS,
      active_version: versionStr,
      contract_version: contractVersionStr,
      schema_version: schema.schema_version,
      supported_task_categories: [
        "menu_information",
        "product_information",
        "product_variants",
        "recipe_analysis",
        "ingredient_cost_analysis",
        "inventory_information",
        "stock_availability",
        "sales_analysis",
        "purchase_information",
        "supplier_information",
        "business_reporting",
      ],
      capabilities: agent.capabilities,
      permissions: agent.permissions,
      configuration: baseConfig?.agent_specific_parameters || {},
    };
  }

  /**
   * Enforces security, organization isolation, and category validation for AGT-019.
   */
  public async validateAccess(params: {
    userId: string;
    businessId: string;
    isPlatformAdmin?: boolean;
    requestedAgentId?: string;
  }): Promise<{ allowed: boolean; role: string; categoryId: string; reason?: string }> {
    const requestedAgent = (params.requestedAgentId || CAFE_AGENT_ID).trim().toUpperCase();
    if (requestedAgent !== CAFE_AGENT_ID) {
      return {
        allowed: false,
        role: "none",
        categoryId: "",
        reason: `Agent identity mismatch: Requested '${requestedAgent}' but expected '${CAFE_AGENT_ID}'.`,
      };
    }

    // 1. Organization Access
    const orgAuth = await organizationAuthService.authorizeOrganizationAccess({
      userId: params.userId,
      businessId: params.businessId,
      isPlatformAdmin: params.isPlatformAdmin,
    });

    if (!orgAuth.allowed) {
      return {
        allowed: false,
        role: "none",
        categoryId: "",
        reason: orgAuth.reason || "Unauthorized organization access.",
      };
    }

    // 2. Category Access Check
    const catAuth = await organizationAuthService.authorizeCategoryAccess({
      businessId: params.businessId,
      requestedAgentId: CAFE_AGENT_ID,
      userRole: orgAuth.role as any,
    });

    // In pilot mode, CAT-019 or authorized test businesses are accepted
    if (!catAuth.allowed) {
      return {
        allowed: false,
        role: orgAuth.role || "member",
        categoryId: catAuth.categoryId,
        reason: catAuth.reason || `Business does not have category '${CAFE_CATEGORY_ID}' authorized for AGT-019.`,
      };
    }

    return {
      allowed: true,
      role: orgAuth.role || "member",
      categoryId: catAuth.categoryId,
    };
  }

  // ==========================================
  // CAFE DOMAIN INTELLIGENCE METHODS
  // ==========================================

  /**
   * Retrieves cafe menu items, separating finished drinks/food from bulk raw ingredients.
   */
  public getCafeMenu(businessId: string): CafeMenuItem[] {
    const data = businessDataSyncService.getBusinessData(businessId, "manager");
    const products = data.products || [];

    return products
      .filter((p: any) => {
        const name = (p.name || "").toLowerCase();
        // Filter out obvious raw bulk ingredients and internal materials from POS menu display
        const isRawIngredient =
          name.includes("coffee beans raw") ||
          name.includes("green coffee beans") ||
          name.includes("unroasted") ||
          name.includes("packaging box bulk");
        return !isRawIngredient;
      })
      .map((p: any) => {
        const variationsConfig = productVariationsStorage.getByProduct(p.id);
        const hasVariants = Boolean(
          variationsConfig && Array.isArray(variationsConfig.variants) && variationsConfig.variants.length > 0
        );

        const nameLower = (p.name || "").toLowerCase();
        const isBeverage =
          nameLower.includes("coffee") ||
          nameLower.includes("espresso") ||
          nameLower.includes("latte") ||
          nameLower.includes("cappuccino") ||
          nameLower.includes("tea") ||
          nameLower.includes("mocha") ||
          nameLower.includes("brew") ||
          nameLower.includes("shake") ||
          nameLower.includes("beverage") ||
          nameLower.includes("drink") ||
          nameLower.includes("juice") ||
          nameLower.includes("water");

        return {
          id: p.id,
          name: p.name,
          category_name: p.category_id || "Cafe Menu",
          retail_price: Number(p.retail_price) || 0,
          purchase_cost: Number(p.purchase_cost) || 0,
          stock_units: Number(p.stock_units) || 0,
          status: p.status || "active",
          is_beverage: isBeverage,
          has_variants: hasVariants,
          variants_count: hasVariants ? variationsConfig!.variants.length : 0,
          variants_preview: hasVariants
            ? variationsConfig!.variants.map((v) => `${v.name} ($${v.retail_price})`)
            : undefined,
          uom: p.uom || (isBeverage ? "cup" : "piece"),
        };
      });
  }

  /**
   * Retrieves product variants (e.g. Small, Medium, Large, Regular, Double, Hot, Iced).
   */
  public getProductVariants(businessId: string, productId: string): CafeVariantPricing[] {
    const config = productVariationsStorage.getByProduct(productId);
    if (!config || !Array.isArray(config.variants)) {
      return [];
    }

    return config.variants.map((v) => ({
      variant_id: v.id,
      name: v.name,
      sku: v.sku,
      retail_price: Number(v.retail_price) || 0,
      purchase_cost: v.purchase_cost ? Number(v.purchase_cost) : undefined,
      stock_units: Number(v.stock_units) || 0,
      attributes: v.attributes || {},
      active: v.active !== false,
    }));
  }

  /**
   * Computes rigorous recipe & ingredient cost analysis for a cafe product or variant.
   *
   * Total Recipe Cost = Sum of (Ingredient Quantity × Ingredient Unit Cost)
   * Gross Profit = Selling Price − Recipe Cost
   * Gross Margin (%) = (Gross Profit ÷ Selling Price) × 100
   */
  public calculateRecipeCosting(params: {
    businessId: string;
    productId: string;
    variantName?: string;
    customIngredients?: CafeRecipeIngredient[];
  }): CafeRecipeAnalysis {
    const data = businessDataSyncService.getBusinessData(params.businessId, "manager");
    const product = (data.products || []).find((p: any) => p.id === params.productId);

    if (!product) {
      throw new Error(`Product '${params.productId}' not found in business catalog.`);
    }

    let sellingPrice = Number(product.retail_price) || 0;
    let variantName = params.variantName;

    // Check if variant price applies
    if (variantName) {
      const varConfig = productVariationsStorage.getByProduct(params.productId);
      if (varConfig && Array.isArray(varConfig.variants)) {
        const matchedVariant = varConfig.variants.find(
          (v) => v.name.toLowerCase() === variantName!.toLowerCase() || v.id === variantName
        );
        if (matchedVariant) {
          sellingPrice = Number(matchedVariant.retail_price) || sellingPrice;
          variantName = matchedVariant.name;
        }
      }
    }

    // Determine ingredients
    let ingredients: CafeRecipeIngredient[] = [];
    let recipeStatus: CafeRecipeAnalysis["recipe_status"] = "missing";

    if (params.customIngredients && params.customIngredients.length > 0) {
      ingredients = params.customIngredients;
      recipeStatus = "complete";
    } else {
      // Check variations storage for recipe/bundle definition
      const varConfig = productVariationsStorage.getByProduct(params.productId);
      if (varConfig && varConfig.product_type === "recipe" && Array.isArray(varConfig.bundle_items) && varConfig.bundle_items.length > 0) {
        ingredients = varConfig.bundle_items.map((bi) => {
          const ingProd = (data.products || []).find((p: any) => p.id === bi.product_id);
          const unitCost = ingProd ? Number(ingProd.purchase_cost) || 0 : 0;
          const totalCost = Number(bi.quantity) * unitCost;
          return {
            ingredient_id: bi.product_id,
            name: bi.name || (ingProd ? ingProd.name : "Ingredient"),
            quantity: Number(bi.quantity),
            uom: ingProd?.uom || "unit",
            unit_cost: unitCost,
            total_cost: totalCost,
          };
        });
        recipeStatus = "complete";
      } else {
        // Fallback: If no structured recipe is defined, check if product has standard purchase_cost
        const baseCost = Number(product.purchase_cost) || 0;
        if (baseCost > 0) {
          ingredients = [
            {
              ingredient_id: product.id,
              name: "Standard Direct Materials Cost",
              quantity: 1,
              uom: product.uom || "serving",
              unit_cost: baseCost,
              total_cost: baseCost,
            },
          ];
          recipeStatus = "incomplete";
        }
      }
    }

    // Compute Total Recipe Cost
    const totalRecipeCost = ingredients.reduce((sum, item) => sum + (Number(item.total_cost) || 0), 0);

    // Calculate percentage of cost contribution for each ingredient
    if (totalRecipeCost > 0) {
      ingredients.forEach((ing) => {
        ing.percentage_of_cost = Math.round((ing.total_cost / totalRecipeCost) * 100);
      });
    }

    // Identify highest cost contributor
    let highestCostIngredient: CafeRecipeAnalysis["highest_cost_ingredient"] = undefined;
    if (ingredients.length > 0 && totalRecipeCost > 0) {
      const sorted = [...ingredients].sort((a, b) => b.total_cost - a.total_cost);
      highestCostIngredient = {
        name: sorted[0].name,
        total_cost: sorted[0].total_cost,
        percentage: sorted[0].percentage_of_cost || 0,
      };
    }

    // Gross Profit & Gross Margin (two-decimal monetary precision with Number.EPSILON guard)
    const roundedRecipeCost = Math.round((totalRecipeCost + Number.EPSILON) * 100) / 100;
    const grossProfit = Math.round((sellingPrice - totalRecipeCost + Number.EPSILON) * 100) / 100;
    const grossMarginPercent =
      sellingPrice > 0 ? Math.round(((sellingPrice - totalRecipeCost) / sellingPrice) * 1000) / 10 : 0;

    return {
      product_id: product.id,
      product_name: product.name,
      variant_name: variantName,
      selling_price: sellingPrice,
      recipe_status: recipeStatus,
      ingredients,
      total_recipe_cost: roundedRecipeCost,
      gross_profit: grossProfit,
      gross_margin_percent: grossMarginPercent,
      highest_cost_ingredient: highestCostIngredient,
      excluded_costs: ["labor", "rent", "electricity", "packaging"],
      profit_type: "gross_profit",
      notes:
        recipeStatus === "incomplete"
          ? "Notice: Bill of Materials (BOM) is not fully itemized; calculation is based on catalog direct purchase cost."
          : recipeStatus === "missing"
          ? "Notice: No recipe ingredients or purchase costs are on record for this item."
          : undefined,
    };
  }

  /**
   * Calculates markup percentage based on gross profit and recipe cost.
   * Markup (%) = (Gross Profit ÷ Recipe Cost) × 100
   */
  public calculateMarkup(grossProfit: number, recipeCost: number): number {
    if (recipeCost <= 0) {
      return 0;
    }
    return Math.round(((grossProfit / recipeCost) * 100) * 100) / 100;
  }

  /**
   * Calculates recommended selling price based on target gross margin.
   * Recommended Selling Price = Recipe Cost ÷ (1 − Target Margin)
   * Rejects target gross margins >= 100% with mathematical explanation.
   */
  public calculateRecommendedSellingPrice(recipeCost: number, targetGrossMargin: number): {
    recommendedPrice: number;
    displayedPrice: string;
    targetMarginPercent: number;
  } {
    const normalizedMargin = targetGrossMargin > 1 ? targetGrossMargin / 100 : targetGrossMargin;
    if (normalizedMargin >= 1 || normalizedMargin < 0) {
      throw new Error(
        `A target gross margin of 100% or greater (${targetGrossMargin}%) is mathematically invalid for this formula (requires division by zero or negative number).`
      );
    }
    const rawPrice = recipeCost / (1 - normalizedMargin);
    const roundedPrice = Math.round(rawPrice * 100) / 100;
    return {
      recommendedPrice: roundedPrice,
      displayedPrice: `$${roundedPrice.toFixed(2)}`,
      targetMarginPercent: Math.round(normalizedMargin * 100),
    };
  }

  /**
   * Rigorous Unit of Measure conversion adhering to GeFlow UoM registry.
   */
  public convertUoM(amount: number, fromUnit: string, toUnit: string): {
    success: boolean;
    converted?: number;
    reason?: string;
  } {
    const normFrom = fromUnit.trim().toLowerCase();
    const normTo = toUnit.trim().toLowerCase();
    if (normFrom === normTo) {
      return { success: true, converted: amount };
    }

    // Weight units
    const weightUnits = ["kg", "kilogram", "g", "gram", "grams", "mg", "milligram"];
    const isFromWeight = weightUnits.includes(normFrom);
    const isToWeight = weightUnits.includes(normTo);

    if (isFromWeight && isToWeight) {
      let inGrams = amount;
      if (normFrom === "kg" || normFrom === "kilogram") inGrams = amount * 1000;
      else if (normFrom === "mg" || normFrom === "milligram") inGrams = amount / 1000;

      let result = inGrams;
      if (normTo === "kg" || normTo === "kilogram") result = inGrams / 1000;
      else if (normTo === "mg" || normTo === "milligram") result = inGrams * 1000;

      return { success: true, converted: Math.round(result * 10000) / 10000 };
    }

    // Volume units
    const volumeUnits = ["l", "liter", "litre", "ml", "milliliter", "millilitre"];
    const isFromVolume = volumeUnits.includes(normFrom);
    const isToVolume = volumeUnits.includes(normTo);

    if (isFromVolume && isToVolume) {
      let inMl = amount;
      if (normFrom === "l" || normFrom === "liter" || normFrom === "litre") inMl = amount * 1000;

      let result = inMl;
      if (normTo === "l" || normTo === "liter" || normTo === "litre") result = inMl / 1000;

      return { success: true, converted: Math.round(result * 10000) / 10000 };
    }

    return {
      success: false,
      reason: `Incompatible units: Cannot convert from '${fromUnit}' to '${toUnit}'.`,
    };
  }

  /**
   * Calculates theoretical production capacity based on available inventory and recipe requirements.
   * Capacity = floor(available / required)
   * Maximum production = min(ingredient capacities), identifying limiting ingredient.
   */
  public calculateProductionCapacity(params: {
    businessId: string;
    recipeIngredients: { name: string; quantityRequired: number; uom: string }[];
    availableStockOverride?: Record<string, { stock: number; uom: string }>;
  }): {
    maxCapacity: number;
    limitingIngredient: string;
    ingredientCapacities: {
      ingredient: string;
      availableStock: number;
      uom: string;
      requiredPerUnit: number;
      capacity: number;
    }[];
  } {
    let availableMap: Record<string, { stock: number; uom: string }> = {};

    if (params.availableStockOverride) {
      availableMap = params.availableStockOverride;
    } else {
      const data = businessDataSyncService.getBusinessData(params.businessId, "manager");
      (data.products || []).forEach((p: any) => {
        availableMap[p.name.toLowerCase()] = {
          stock: Number(p.stock_units) || 0,
          uom: p.uom || "unit",
        };
      });
    }

    const ingredientCapacities = params.recipeIngredients.map((item) => {
      const key = item.name.toLowerCase();
      const matchedKey = Object.keys(availableMap).find((k) => k.includes(key) || key.includes(k));
      const stockInfo = matchedKey ? availableMap[matchedKey] : { stock: 0, uom: item.uom };

      let availableInRecipeUom = stockInfo.stock;
      if (stockInfo.uom.toLowerCase() !== item.uom.toLowerCase()) {
        const conv = this.convertUoM(stockInfo.stock, stockInfo.uom, item.uom);
        if (conv.success && conv.converted !== undefined) {
          availableInRecipeUom = conv.converted;
        }
      }

      const capacity = item.quantityRequired > 0 ? Math.floor(availableInRecipeUom / item.quantityRequired) : 0;
      return {
        ingredient: item.name,
        availableStock: stockInfo.stock,
        uom: stockInfo.uom,
        requiredPerUnit: item.quantityRequired,
        capacity: Math.max(0, capacity),
      };
    });

    if (ingredientCapacities.length === 0) {
      return { maxCapacity: 0, limitingIngredient: "None", ingredientCapacities: [] };
    }

    const sorted = [...ingredientCapacities].sort((a, b) => a.capacity - b.capacity);
    const limiting = sorted[0];

    return {
      maxCapacity: limiting.capacity,
      limitingIngredient: limiting.ingredient,
      ingredientCapacities,
    };
  }

  /**
   * Compares suppliers by unit purchase price and calculates quantity variance.
   */
  public compareSuppliers(quotes: {
    supplier: string;
    unitPrice: number;
    uom: string;
    quantity: number;
  }[]): {
    lowestSupplier: string;
    lowestPrice: number;
    highestSupplier: string;
    highestPrice: number;
    priceDifferencePerUnit: number;
    totalDifference: number;
    quotes: typeof quotes;
  } {
    if (quotes.length === 0) {
      throw new Error("No supplier quotes provided for comparison.");
    }
    const sorted = [...quotes].sort((a, b) => a.unitPrice - b.unitPrice);
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    const priceDiff = Math.round((highest.unitPrice - lowest.unitPrice) * 100) / 100;
    const totalDiff = Math.round((priceDiff * quotes[0].quantity) * 100) / 100;

    return {
      lowestSupplier: lowest.supplier,
      lowestPrice: lowest.unitPrice,
      highestSupplier: highest.supplier,
      highestPrice: highest.unitPrice,
      priceDifferencePerUnit: priceDiff,
      totalDifference: totalDiff,
      quotes: sorted,
    };
  }

  /**
   * Calculates inventory stock variance and wastage cost.
   * Inventory Variance = Actual Stock − Expected Stock
   * Variance (%) = (Actual Stock − Expected Stock) ÷ Expected Stock × 100
   */
  public calculateInventoryVariance(params: {
    actualStock: number;
    expectedStock: number;
    unitCost?: number;
    wastedQuantity?: number;
  }): {
    inventoryVariance: number;
    variancePercent: number | null;
    wastageCost?: number;
    notes?: string;
  } {
    const variance = Math.round((params.actualStock - params.expectedStock) * 1000) / 1000;
    let variancePercent: number | null = null;
    let notes: string | undefined;

    if (params.expectedStock === 0) {
      variancePercent = null;
      notes = "Variance percentage is undefined when expected stock is zero.";
    } else {
      variancePercent = Math.round(((params.actualStock - params.expectedStock) / params.expectedStock) * 10000) / 100;
    }

    const wastageCost =
      params.wastedQuantity !== undefined && params.unitCost !== undefined
        ? Math.round(params.wastedQuantity * params.unitCost * 100) / 100
         : undefined;

    return {
      inventoryVariance: variance,
      variancePercent,
      wastageCost,
      notes,
    };
  }

  /**
   * Simulates recipe cost impact without altering underlying business records.
   */
  public simulateRecipeCostImpact(params: {
    baseRecipeCost: number;
    sellingPrice: number;
    ingredientName: string;
    ingredientCost: number;
    percentChange: number;
  }): {
    originalRecipeCost: number;
    adjustedIngredientCost: number;
    revisedRecipeCost: number;
    costDelta: number;
    revisedGrossProfit: number;
    revisedGrossMarginPercent: number;
    isSimulation: true;
  } {
    const costDelta = Math.round((params.ingredientCost * (params.percentChange / 100)) * 1000) / 1000;
    const adjustedIngredientCost = Math.round((params.ingredientCost + costDelta) * 1000) / 1000;
    const revisedRecipeCost = Math.round((params.baseRecipeCost + costDelta) * 1000) / 1000;
    const revisedGrossProfit = Math.round((params.sellingPrice - revisedRecipeCost) * 100) / 100;
    const revisedGrossMarginPercent =
      params.sellingPrice > 0
        ? Math.round(((params.sellingPrice - revisedRecipeCost) / params.sellingPrice) * 1000) / 10
        : 0;

    return {
      originalRecipeCost: params.baseRecipeCost,
      adjustedIngredientCost,
      revisedRecipeCost,
      costDelta,
      revisedGrossProfit,
      revisedGrossMarginPercent,
      isSimulation: true,
    };
  }

  /**
   * Conducts an inventory stock availability audit for cafe ingredients & consumables.
   */
  public auditStockAvailability(businessId: string): {
    low_stock_ingredients: CafeStockAuditItem[];
    adequate_ingredients: CafeStockAuditItem[];
    affected_menu_items: string[];
    summary: {
      total_items_checked: number;
      low_stock_count: number;
      out_of_stock_count: number;
    };
  } {
    const data = businessDataSyncService.getBusinessData(businessId, "manager");
    const products = data.products || [];

    const lowStockList: CafeStockAuditItem[] = [];
    const adequateList: CafeStockAuditItem[] = [];
    const affectedDrinksSet = new Set<string>();

    for (const p of products) {
      const stock = Number(p.stock_units) || 0;
      const minAlert = Number(p.min_stock_alert) || 5;
      const nameLower = (p.name || "").toLowerCase();

      // Check if product is an ingredient
      const isIngredient =
        nameLower.includes("bean") ||
        nameLower.includes("milk") ||
        nameLower.includes("syrup") ||
        nameLower.includes("sugar") ||
        nameLower.includes("tea") ||
        nameLower.includes("chocolate") ||
        nameLower.includes("flour") ||
        nameLower.includes("butter") ||
        nameLower.includes("cream") ||
        nameLower.includes("cup") ||
        nameLower.includes("lid") ||
        nameLower.includes("powder");

      let status: "in_stock" | "low_stock" | "out_of_stock" = "in_stock";
      if (stock <= 0) {
        status = "out_of_stock";
      } else if (stock <= minAlert) {
        status = "low_stock";
      }

      // Determine affected menu items
      let affectedDrinks: string[] = [];
      if (status !== "in_stock" && isIngredient) {
        for (const [key, drinks] of Object.entries(INGREDIENT_AFFECTED_DRINKS)) {
          if (nameLower.includes(key.replace(/_/g, " ")) || key.split("_").every((k) => nameLower.includes(k))) {
            affectedDrinks = drinks;
            drinks.forEach((d) => affectedDrinksSet.add(d));
            break;
          }
        }
      }

      const auditItem: CafeStockAuditItem = {
        product_id: p.id,
        name: p.name,
        stock_units: stock,
        min_stock_alert: minAlert,
        uom: p.uom || (isIngredient ? "kg" : "piece"),
        status,
        is_ingredient: isIngredient,
        affected_menu_items: affectedDrinks.length > 0 ? affectedDrinks : undefined,
      };

      if (status === "low_stock" || status === "out_of_stock") {
        lowStockList.push(auditItem);
      } else {
        adequateList.push(auditItem);
      }
    }

    return {
      low_stock_ingredients: lowStockList,
      adequate_ingredients: adequateList,
      affected_menu_items: Array.from(affectedDrinksSet),
      summary: {
        total_items_checked: products.length,
        low_stock_count: lowStockList.filter((i) => i.status === "low_stock").length,
        out_of_stock_count: lowStockList.filter((i) => i.status === "out_of_stock").length,
      },
    };
  }

  /**
   * Analyzes cafe sales velocity, best-selling drinks, and hot vs iced trends.
   */
  public analyzeSalesPerformance(businessId: string, timeframe: string = "this_month"): CafeSalesPerformance {
    const data = businessDataSyncService.getBusinessData(businessId, "manager");
    const sales = data.sales || [];
    const saleItems = data.sale_items || [];

    // Aggregate items sold
    const itemSalesMap = new Map<string, { product_name: string; qty: number; rev: number; profit: number }>();
    let hotRev = 0;
    let hotUnits = 0;
    let coldRev = 0;
    let coldUnits = 0;

    for (const item of saleItems) {
      const name = item.product_name || "Drink";
      const qty = Number(item.quantity) || 1;
      const unitPrice = Number(item.unit_price) || 0;
      const unitCost = Number(item.unit_cost) || 0;
      const rev = qty * unitPrice;
      const profit = qty * (unitPrice - unitCost);

      const existing = itemSalesMap.get(name) || { product_name: name, qty: 0, rev: 0, profit: 0 };
      existing.qty += qty;
      existing.rev += rev;
      existing.profit += profit;
      itemSalesMap.set(name, existing);

      // Hot vs Cold classification
      const lower = name.toLowerCase();
      if (lower.includes("iced") || lower.includes("cold") || lower.includes("frappe") || lower.includes("shake")) {
        coldRev += rev;
        coldUnits += qty;
      } else if (
        lower.includes("espresso") ||
        lower.includes("cappuccino") ||
        lower.includes("latte") ||
        lower.includes("americano") ||
        lower.includes("hot") ||
        lower.includes("tea")
      ) {
        hotRev += rev;
        hotUnits += qty;
      }
    }

    const sortedBestSellers = Array.from(itemSalesMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map((item) => ({
        product_name: item.product_name,
        quantity_sold: item.qty,
        total_revenue: Math.round(item.rev * 100) / 100,
        estimated_profit: Math.round(item.profit * 100) / 100,
      }));

    const totalPeriodRevenue = sales.reduce((acc, s: any) => acc + (Number(s.total) || 0), 0);

    return {
      best_selling_items: sortedBestSellers,
      hot_vs_cold_comparison: {
        hot_coffee_revenue: Math.round(hotRev * 100) / 100,
        cold_coffee_revenue: Math.round(coldRev * 100) / 100,
        hot_units: hotUnits,
        cold_units: coldUnits,
      },
      total_period_revenue: Math.round(totalPeriodRevenue * 100) / 100,
      total_transactions: sales.length,
      timeframe,
    };
  }

  /**
   * Generates evidence-based cafe operational recommendations.
   * Clearly marked as recommendations requiring authorization, never executed automatically.
   */
  public generateRecommendations(businessId: string): CafeRecommendation[] {
    const recommendations: CafeRecommendation[] = [];
    const stockAudit = this.auditStockAvailability(businessId);
    const sales = this.analyzeSalesPerformance(businessId);

    // 1. Low stock reorder recommendations
    for (const item of stockAudit.low_stock_ingredients) {
      recommendations.push({
        type: "low_stock_reorder",
        title: `Reorder ${item.name}`,
        detail: `Current stock is ${item.stock_units} ${item.uom} (min alert threshold: ${item.min_stock_alert} ${item.uom}).${
          item.affected_menu_items ? ` Affects: ${item.affected_menu_items.join(", ")}.` : ""
        }`,
        action_suggestion: `Draft purchase order for at least ${item.min_stock_alert * 3} ${item.uom} from primary supplier.`,
        priority: item.stock_units <= 0 ? "high" : "medium",
        requires_authorization: true,
      });
    }

    // 2. Margin warning recommendations
    const menu = this.getCafeMenu(businessId);
    for (const item of menu.slice(0, 5)) {
      try {
        const costing = this.calculateRecipeCosting({ businessId, productId: item.id });
        if (costing.gross_margin_percent > 0 && costing.gross_margin_percent < 50) {
          recommendations.push({
            type: "margin_warning",
            title: `Low Gross Margin on ${item.name}`,
            detail: `Gross margin is currently ${costing.gross_margin_percent}% (Selling Price: $${costing.selling_price}, Recipe Cost: $${costing.total_recipe_cost}).`,
            action_suggestion: `Review modifier pricing or negotiate wholesale ingredient costs to achieve standard 65-75% cafe gross margin target.`,
            priority: "medium",
            requires_authorization: false,
          });
        }
      } catch (_e) {
        /* skip items without costing */
      }
    }

    return recommendations;
  }

  // ==========================================
  // CONVERSATIONAL & TASK DISPATCH PIPELINE
  // ==========================================

  /**
   * Executes a specialized cafe pilot task through the shared execution engine and audit framework.
   */
  public async executeTask(
    request: CafeChatRequest,
    caller: { userId: string; email?: string; isPlatformAdmin?: boolean }
  ): Promise<CafeAgentResponsePayload> {
    const executionId = `exec_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const correlationId = request.correlation_id || `corr_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const timestamp = new Date().toISOString();

    // 1. Validate Access & Isolation
    const auth = await this.validateAccess({
      userId: caller.userId,
      businessId: request.business_id,
      isPlatformAdmin: caller.isPlatformAdmin,
    });

    if (!auth.allowed) {
      // Record rejected audit event
      agentAuditService.recordEvent({
        event_type: "authorization_denied",
        event_category: "authorization",
        execution_id: executionId,
        correlation_id: correlationId,
        agent_id: CAFE_AGENT_ID,
        business_id: request.business_id,
        actor_type: caller.isPlatformAdmin ? "admin" : "user",
        actor_id: caller.userId,
        actor_email: caller.email,
        action: "execute_cafe_task",
        authorization_decision: "denied",
        result_status: "failed",
        failure_reason: auth.reason,
      });

      return {
        execution_id: executionId,
        agent_id: CAFE_AGENT_ID,
        agent_name: "Cafe & Coffee Shop Agent",
        primary_category_id: CAFE_CATEGORY_ID,
        configuration_version: "1.0.0",
        contract_version: "1.0",
        task_type: request.task_type || "cafe_task",
        response_status: "error",
        response_message: auth.reason || "Access denied to Cafe & Coffee Shop Agent.",
        error_code: "UNAUTHORIZED_CATEGORY_OR_ORG",
        correlation_id: correlationId,
        timestamp,
      };
    }

    // 2. Classify Task Type
    const query = (request.query || "").toLowerCase();
    let taskType = request.task_type || "cafe_menu_query";

    if (!request.task_type) {
      if (query.includes("cost") || query.includes("recipe") || query.includes("margin") || query.includes("cappuccino")) {
        taskType = "cafe_recipe_costing";
      } else if (query.includes("stock") || query.includes("inventory") || query.includes("low") || query.includes("shortage")) {
        taskType = "cafe_stock_audit";
      } else if (query.includes("sales") || query.includes("best") || query.includes("selling") || query.includes("revenue") || query.includes("velocity")) {
        taskType = "cafe_sales_velocity";
      } else {
        taskType = "cafe_menu_query";
      }
    }

    // 3. Record Execution Request in Audit
    agentAuditService.recordEvent({
      event_type: "execution_requested",
      event_category: "execution",
      execution_id: executionId,
      correlation_id: correlationId,
      agent_id: CAFE_AGENT_ID,
      business_id: request.business_id,
      category_id: CAFE_CATEGORY_ID,
      actor_type: caller.isPlatformAdmin ? "admin" : "user",
      actor_id: caller.userId,
      actor_email: caller.email,
      action: taskType,
      authorization_decision: "allowed",
      result_status: "pending",
      sanitized_metadata: { taskType, query: request.query },
    });

    try {
      // 4. Execute Task Logic
      const structuredData: Record<string, any> = {};
      let responseMessage = "";
      const warnings: string[] = [];

      switch (taskType) {
        case "cafe_menu_query": {
          const menu = this.getCafeMenu(request.business_id);
          structuredData.menu_items = menu;
          responseMessage = `Found ${menu.length} registered menu items for your cafe. ${
            menu.filter((m) => m.is_beverage).length
          } beverages and ${menu.filter((m) => !m.is_beverage).length} food/snack items.`;
          break;
        }

        case "cafe_recipe_costing": {
          const menu = this.getCafeMenu(request.business_id);
          // Target specific product or find first beverage
          let targetProd = menu[0];
          if (request.product_id) {
            targetProd = menu.find((m) => m.id === request.product_id) || menu[0];
          } else if (query.includes("cappuccino")) {
            targetProd = menu.find((m) => m.name.toLowerCase().includes("cappuccino")) || menu[0];
          } else if (query.includes("latte")) {
            targetProd = menu.find((m) => m.name.toLowerCase().includes("latte")) || menu[0];
          }

          if (!targetProd) {
            throw new Error("No cafe products found in catalog to calculate recipe costing.");
          }

          const costing = this.calculateRecipeCosting({
            businessId: request.business_id,
            productId: targetProd.id,
            variantName: request.variant_name,
          });

          structuredData.recipe_analysis = costing;
          responseMessage = `Recipe costing for ${costing.product_name}${
            costing.variant_name ? ` (${costing.variant_name})` : ""
          }: Total ingredient cost is $${costing.total_recipe_cost.toFixed(2)}, selling price is $${costing.selling_price.toFixed(
            2
          )}, yielding a gross profit of $${costing.gross_profit.toFixed(2)} (${costing.gross_margin_percent}% gross margin).`;

          if (costing.notes) {
            warnings.push(costing.notes);
          }
          break;
        }

        case "cafe_stock_audit": {
          const audit = this.auditStockAvailability(request.business_id);
          structuredData.stock_audit = audit;
          responseMessage = `Stock Audit Complete: ${audit.summary.total_items_checked} items audited. ${audit.summary.low_stock_count} items are low in stock and ${audit.summary.out_of_stock_count} are out of stock.${
            audit.affected_menu_items.length > 0 ? ` Affected menu items: ${audit.affected_menu_items.join(", ")}.` : ""
          }`;
          break;
        }

        case "cafe_sales_velocity": {
          const sales = this.analyzeSalesPerformance(request.business_id, request.timeframe || "this_month");
          structuredData.sales_performance = sales;
          responseMessage = `Sales velocity for ${sales.timeframe}: Total revenue $${sales.total_period_revenue.toFixed(
            2
          )} across ${sales.total_transactions} transactions. Top seller: ${
            sales.best_selling_items[0]?.product_name || "N/A"
          } (${sales.best_selling_items[0]?.quantity_sold || 0} units).`;
          break;
        }

        case "cafe_production_capacity": {
          const recipeIngredients = (request as any).recipe_ingredients || [
            { name: "Coffee Beans", quantityRequired: 0.018, uom: "kg" },
            { name: "Milk", quantityRequired: 0.15, uom: "litre" },
            { name: "Sugar", quantityRequired: 0.01, uom: "kg" },
            { name: "Chocolate Powder", quantityRequired: 0.005, uom: "kg" },
          ];
          const capacityResult = this.calculateProductionCapacity({
            businessId: request.business_id,
            recipeIngredients,
            availableStockOverride: (request as any).available_stock_override,
          });
          structuredData.production_capacity = capacityResult;
          responseMessage = `Theoretical Production Capacity: ${capacityResult.maxCapacity} drinks can be produced. Limiting ingredient: ${capacityResult.limitingIngredient}.`;
          break;
        }

        case "cafe_supplier_comparison": {
          const quotes = (request as any).supplier_quotes || [];
          const comp = this.compareSuppliers(quotes);
          structuredData.supplier_comparison = comp;
          responseMessage = `Supplier Comparison: Lowest price is ${comp.lowestSupplier} ($${comp.lowestPrice}/unit), highest is ${comp.highestSupplier} ($${comp.highestPrice}/unit). Variance: $${comp.priceDifferencePerUnit}/unit ($${comp.totalDifference} total).`;
          break;
        }

        case "cafe_recipe_simulation": {
          const simParams = (request as any).simulation_params;
          if (!simParams) {
            throw new Error("Simulation parameters (baseRecipeCost, sellingPrice, ingredientName, ingredientCost, percentChange) are required.");
          }
          const sim = this.simulateRecipeCostImpact(simParams);
          structuredData.recipe_simulation = sim;
          responseMessage = `Recipe Simulation (${simParams.percentChange > 0 ? "+" : ""}${simParams.percentChange}% on ${simParams.ingredientName}): Revised recipe cost is $${sim.revisedRecipeCost.toFixed(2)} (delta: $${sim.costDelta.toFixed(3)}). Revised gross profit: $${sim.revisedGrossProfit.toFixed(2)} (${sim.revisedGrossMarginPercent}% gross margin). Underlying records remain unchanged.`;
          break;
        }

        default:
          throw new Error(`Unsupported cafe pilot task type '${taskType}'.`);
      }

      // Add actionable recommendations
      const recommendations = this.generateRecommendations(request.business_id);
      if (recommendations.length > 0) {
        structuredData.recommendations = recommendations;
      }

      // 5. Record Completed Execution in Audit
      agentAuditService.recordEvent({
        event_type: "execution_completed",
        event_category: "execution",
        execution_id: executionId,
        correlation_id: correlationId,
        agent_id: CAFE_AGENT_ID,
        business_id: request.business_id,
        category_id: CAFE_CATEGORY_ID,
        actor_type: caller.isPlatformAdmin ? "admin" : "user",
        actor_id: caller.userId,
        actor_email: caller.email,
        action: taskType,
        authorization_decision: "allowed",
        result_status: "success",
        sanitized_metadata: { items_returned: Object.keys(structuredData).length },
      });

      return {
        execution_id: executionId,
        agent_id: CAFE_AGENT_ID,
        agent_name: "Cafe & Coffee Shop Agent",
        primary_category_id: CAFE_CATEGORY_ID,
        configuration_version: "1.0.0",
        contract_version: "1.0",
        task_type: taskType,
        response_status: "success",
        response_message: responseMessage,
        structured_data: structuredData,
        warnings: warnings.length > 0 ? warnings : undefined,
        correlation_id: correlationId,
        timestamp,
      };
    } catch (err: any) {
      // Record Failure in Audit
      agentAuditService.recordEvent({
        event_type: "execution_failed",
        event_category: "execution",
        execution_id: executionId,
        correlation_id: correlationId,
        agent_id: CAFE_AGENT_ID,
        business_id: request.business_id,
        category_id: CAFE_CATEGORY_ID,
        actor_type: caller.isPlatformAdmin ? "admin" : "user",
        actor_id: caller.userId,
        actor_email: caller.email,
        action: taskType,
        authorization_decision: "allowed",
        result_status: "failed",
        failure_reason: err.message,
      });

      return {
        execution_id: executionId,
        agent_id: CAFE_AGENT_ID,
        agent_name: "Cafe & Coffee Shop Agent",
        primary_category_id: CAFE_CATEGORY_ID,
        configuration_version: "1.0.0",
        contract_version: "1.0",
        task_type: taskType,
        response_status: "error",
        response_message: `Cafe task execution failed: ${err.message}`,
        error_code: "EXECUTION_FAILURE",
        correlation_id: correlationId,
        timestamp,
      };
    }
  }

  /**
   * High-level conversational chat handler for Cafe operations.
   * Generates formatted responses in the user's requested language.
   */
  public async handleCafeChat(
    request: CafeChatRequest,
    caller: { userId: string; email?: string; isPlatformAdmin?: boolean }
  ): Promise<{
    reply: string;
    task_response: CafeAgentResponsePayload;
  }> {
    const taskResponse = await this.executeTask(request, caller);

    if (taskResponse.response_status === "error") {
      return {
        reply: `⚠️ **Cafe Agent Notice:** ${taskResponse.response_message}`,
        task_response: taskResponse,
      };
    }

    const language = (request.language || "english").toLowerCase();
    const data = taskResponse.structured_data || {};
    let reply = "";

    if (data.recipe_analysis) {
      const r = data.recipe_analysis as CafeRecipeAnalysis;
      if (language === "roman_urdu") {
        reply = `☕ **${r.product_name}${r.variant_name ? ` (${r.variant_name})` : ""} ka Recipe Costing:**\n\n` +
          `- **Farokht Qimat (Selling Price):** $${r.selling_price.toFixed(2)}\n` +
          `- **Kul Ajza Kharcha (Total Recipe Cost):** $${r.total_recipe_cost.toFixed(2)}\n` +
          `- **Kham Munafa (Gross Profit):** $${r.gross_profit.toFixed(2)}\n` +
          `- **Gross Margin:** **${r.gross_margin_percent}%**\n` +
          `${r.highest_cost_ingredient ? `- **Sab Se Mehnga Juz:** ${r.highest_cost_ingredient.name} ($${r.highest_cost_ingredient.total_cost.toFixed(2)})\n` : ""}` +
          `\n*Wazahat: Yeh hisab sirf kacha maal (ingredients) ka hai. Mulazmeen ki tankhwah, dukan ka kiraya aur bijli is me shaamil nahi hain.*`;
      } else if (language === "urdu") {
        reply = `☕ **${r.product_name} کا ریسیپی لاگت کا تجزیہ:**\n\n` +
          `- **فروخت کی قیمت:** $${r.selling_price.toFixed(2)}\n` +
          `- **کل اجزاء کی لاگت:** $${r.total_recipe_cost.toFixed(2)}\n` +
          `- **خام منافع (Gross Profit):** $${r.gross_profit.toFixed(2)}\n` +
          `- **گراس مارجن:** **${r.gross_margin_percent}%**\n` +
          `\n*نوٹ: یہ حساب صرف بنیادی اجزاء کا ہے۔ بجلی، کرایہ اور لیبر کے اخراجات اس میں شامل نہیں ہیں۔*`;
      } else {
        reply = `☕ **Recipe Costing & Profitability Analysis for ${r.product_name}${
          r.variant_name ? ` (${r.variant_name})` : ""
        }:**\n\n` +
          `• **Selling Price:** $${r.selling_price.toFixed(2)}\n` +
          `• **Total Recipe Cost:** $${r.total_recipe_cost.toFixed(2)}\n` +
          `• **Gross Profit:** $${r.gross_profit.toFixed(2)}\n` +
          `• **Gross Margin:** **${r.gross_margin_percent}%**\n` +
          `${
            r.highest_cost_ingredient
              ? `• **Highest Cost Ingredient:** ${r.highest_cost_ingredient.name} ($${r.highest_cost_ingredient.total_cost.toFixed(
                  2
                )}, ${r.highest_cost_ingredient.percentage}% of cost)\n`
              : ""
          }` +
          (r.ingredients.length > 1
            ? `\n**Ingredient Breakdown:**\n` +
              r.ingredients
                .map((i) => `  - ${i.name}: ${i.quantity} ${i.uom} @ $${i.unit_cost}/unit = $${i.total_cost.toFixed(2)}`)
                .join("\n") +
              "\n"
            : "") +
          `\n*Note: This calculation reflects direct ingredient costs. Excluded overheads: labor, rent, electricity, and packaging. Gross profit is distinct from net operating profit.*`;
      }
    } else if (data.stock_audit) {
      const s = data.stock_audit;
      if (language === "roman_urdu") {
        reply = `📦 **Cafe Stock Jaiza:**\n\n` +
          `• **Kam Stock Ajza:** ${s.low_stock_ingredients.length} items\n` +
          s.low_stock_ingredients
            .map((i: any) => `  - **${i.name}**: ${i.stock_units} ${i.uom} baqi (kam az kam: ${i.min_stock_alert})`)
            .join("\n") +
          `${s.affected_menu_items.length > 0 ? `\n\n⚠️ **Muta'asira Drinks:** ${s.affected_menu_items.join(", ")}` : ""}`;
      } else {
        reply = `📦 **Cafe Inventory & Ingredient Stock Audit:**\n\n` +
          `• **Total Items Audited:** ${s.summary.total_items_checked}\n` +
          `• **Low Stock / Critical Items:** ${s.low_stock_ingredients.length}\n\n` +
          (s.low_stock_ingredients.length > 0
            ? `**Attention Required:**\n` +
              s.low_stock_ingredients
                .map(
                  (i: any) =>
                    `• **${i.name}:** Current stock is ${i.stock_units} ${i.uom} (Min threshold: ${i.min_stock_alert} ${i.uom})${
                      i.affected_menu_items ? ` — Impacts: ${i.affected_menu_items.join(", ")}` : ""
                    }`
                )
                .join("\n")
            : `✅ All essential cafe ingredients and consumables are above minimum stock thresholds.\n`) +
          (s.affected_menu_items.length > 0
            ? `\n\n⚠️ **Affected Cafe Menu Items:**\n${s.affected_menu_items.map((d: string) => `• ${d}`).join("\n")}`
            : "");
      }
    } else if (data.sales_performance) {
      const sp = data.sales_performance as CafeSalesPerformance;
      reply = `📊 **Cafe Sales Performance (${sp.timeframe}):**\n\n` +
        `• **Total Period Revenue:** $${sp.total_period_revenue.toFixed(2)}\n` +
        `• **Completed Transactions:** ${sp.total_transactions}\n` +
        (sp.hot_vs_cold_comparison
          ? `• **Hot vs Cold Velocity:** Hot Coffee: $${sp.hot_vs_cold_comparison.hot_coffee_revenue} (${sp.hot_vs_cold_comparison.hot_units} cups) vs Cold Coffee: $${sp.hot_vs_cold_comparison.cold_coffee_revenue} (${sp.hot_vs_cold_comparison.cold_units} cups)\n`
          : "") +
        `\n**Best-Selling Items:**\n` +
        sp.best_selling_items.map((b, idx) => `${idx + 1}. **${b.product_name}**: ${b.quantity_sold} sold ($${b.total_revenue.toFixed(2)})`).join("\n");
    } else {
      reply = `☕ **Cafe & Coffee Shop Operations Summary:**\n\n${taskResponse.response_message}`;
    }

    // Append recommendations if available
    if (data.recommendations && data.recommendations.length > 0) {
      reply += `\n\n💡 **Actionable Operational Recommendations:**\n` +
        data.recommendations
          .map(
            (rec: CafeRecommendation) =>
              `• **${rec.title}:** ${rec.detail} *(Suggested: ${rec.action_suggestion})*`
          )
          .join("\n");
    }

    return {
      reply,
      task_response: taskResponse,
    };
  }
}

export const cafeAgentService = new CafeAgentService();
