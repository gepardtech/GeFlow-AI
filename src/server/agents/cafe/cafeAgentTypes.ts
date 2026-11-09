/**
 * GeFlow AI — Cafe & Coffee Shop Agent (AGT-019) Types (Step 13)
 *
 * Implements data structures, task contracts, and response schemas for the
 * specialized AGT-019 pilot, complying with the common Agent Contract.
 */

export interface CafeRecipeIngredient {
  ingredient_id: string;
  name: string;
  quantity: number;
  uom: string;
  unit_cost: number;
  total_cost: number;
  percentage_of_cost?: number;
}

export interface CafeRecipeAnalysis {
  product_id: string;
  product_name: string;
  variant_name?: string;
  selling_price: number;
  recipe_status: "complete" | "incomplete" | "missing";
  ingredients: CafeRecipeIngredient[];
  total_recipe_cost: number;
  gross_profit: number;
  gross_margin_percent: number;
  highest_cost_ingredient?: {
    name: string;
    total_cost: number;
    percentage: number;
  };
  excluded_costs: string[]; // ["labor", "rent", "electricity", "packaging"]
  profit_type: "gross_profit"; // explicit distinction from net profit
  notes?: string;
}

export interface CafeMenuItem {
  id: string;
  name: string;
  category_name?: string;
  retail_price: number;
  purchase_cost: number;
  stock_units: number;
  status: string;
  is_beverage: boolean;
  has_variants: boolean;
  variants_count?: number;
  variants_preview?: string[];
  uom?: string;
}

export interface CafeVariantPricing {
  variant_id: string;
  name: string;
  sku: string;
  retail_price: number;
  purchase_cost?: number;
  stock_units: number;
  attributes: Record<string, string>;
  active: boolean;
}

export interface CafeStockAuditItem {
  product_id: string;
  name: string;
  stock_units: number;
  min_stock_alert: number;
  uom: string;
  status: "in_stock" | "low_stock" | "out_of_stock";
  is_ingredient: boolean;
  affected_menu_items?: string[];
}

export interface CafeSalesPerformance {
  best_selling_items: Array<{
    product_id?: string;
    product_name: string;
    quantity_sold: number;
    total_revenue: number;
    estimated_profit?: number;
  }>;
  hot_vs_cold_comparison?: {
    hot_coffee_revenue: number;
    cold_coffee_revenue: number;
    hot_units: number;
    cold_units: number;
  };
  total_period_revenue: number;
  total_transactions: number;
  timeframe: string;
}

export interface CafeRecommendation {
  type: "low_stock_reorder" | "pricing_optimization" | "margin_warning" | "freshness_check";
  title: string;
  detail: string;
  action_suggestion: string;
  priority: "high" | "medium" | "low";
  requires_authorization: boolean;
}

export interface CafeAgentResponsePayload {
  execution_id: string;
  agent_id: "AGT-019";
  agent_name: "Cafe & Coffee Shop Agent";
  primary_category_id: "CAT-019";
  configuration_version: string;
  contract_version: string;
  task_type: string;
  response_status: "success" | "warning" | "error" | "awaiting_approval";
  response_message: string;
  structured_data?: {
    menu_items?: CafeMenuItem[];
    recipe_analysis?: CafeRecipeAnalysis;
    variants?: CafeVariantPricing[];
    stock_audit?: {
      low_stock_ingredients: CafeStockAuditItem[];
      adequate_ingredients: CafeStockAuditItem[];
      affected_menu_items: string[];
    };
    sales_performance?: CafeSalesPerformance;
    recommendations?: CafeRecommendation[];
    [key: string]: any;
  };
  data_references?: string[];
  warnings?: string[];
  approval_required?: boolean;
  approval_reference?: string;
  error_code?: string;
  correlation_id: string;
  timestamp: string;
}

export interface CafeChatRequest {
  business_id: string;
  query: string;
  task_type?: string;
  language?: string;
  product_id?: string;
  variant_name?: string;
  timeframe?: "today" | "this_week" | "this_month" | "all_time";
  correlation_id?: string;
}
