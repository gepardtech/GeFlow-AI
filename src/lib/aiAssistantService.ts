import { supabase } from "@/integrations/supabase/client";
import { resolveSettingsHierarchy, getCachedUserMetadata } from "./settingsHierarchy";
import { currencySymbol } from "./currency";
import { PlanId } from "./plans";
import { computeProductStock, parseProductUOM } from "./uomRegistry";

export const formatCurrency = (val: number, code: string = "USD") => {
  const sym = currencySymbol(code);
  const formattedNum = Number(val || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sym}${formattedNum}`;
};

export interface AIChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  meta?: {
    intent?: string;
    language?: string;
    model?: string;
  };
}

export type AIMode = "analyst" | "operator" | "knowledge" | "advisor";

export function isModeAllowedForPlan(mode: AIMode, planId: PlanId = "free"): boolean {
  if (planId === "premium" || planId === "lifetime") return true;
  if (planId === "standard") return mode === "analyst" || mode === "operator";
  // free
  return mode === "analyst";
}

export function getRequiredPlanForMode(mode: AIMode): { requiredPlan: "free" | "standard" | "premium"; label: string } {
  switch (mode) {
    case "operator":
      return { requiredPlan: "standard", label: "Standard+" };
    case "knowledge":
    case "advisor":
      return { requiredPlan: "premium", label: "Premium" };
    default:
      return { requiredPlan: "free", label: "All Plans" };
  }
}

export interface BusinessAnalyticsContext {
  business: {
    id: string;
    name: string;
    currency: string;
    taxRate: number;
    stockAlertLimit: number;
    status: string;
    categoryName?: string;
  };
  inventory: {
    totalProducts: number;
    activeProducts: number;
    outOfStockCount: number;
    lowStockCount: number;
    expiringCount: number;
    expiring30Count: number;
    expiring60Count: number;
    totalUnitsInStock: number;
    inventoryCostValue: number;
    inventoryRetailValue: number;
    estimatedGrossProfitMargin: number;
    outOfStockItems: string[];
    lowStockItems: {
      name: string;
      units: number;
      threshold: number;
      packsDisplay: string;
      uom: string;
    }[];
    expiringItems: {
      name: string;
      expiryDate: string;
      daysRemaining: number;
      units: number;
      packsDisplay: string;
    }[];
    expiring60Items: {
      name: string;
      expiryDate: string;
      daysRemaining: number;
      units: number;
      packsDisplay: string;
    }[];
  };
  sales: {
    todayRevenue: number;
    todayProfit: number;
    todayTransactions: number;
    weekRevenue: number;
    weekProfit: number;
    weekTransactions: number;
    monthRevenue: number;
    monthProfit: number;
    monthTransactions: number;
    totalRevenue: number;
    totalProfit: number;
    totalTransactions: number;
    averageOrderValue: number;
    netProfitMargin: number;
    topSellingItems: { name: string; units: number; revenue: number; profit: number }[];
    recentSales: { id: string; total: number; profit: number; date: string; status: string; processedBy?: string }[];
  };
  purchases: {
    totalPurchasesCount: number;
    totalPurchasesCost: number;
  };
}

/**
 * Fetch complete live, authorized data for the active business from Supabase.
 */
export async function fetchLiveBusinessAnalytics(businessId: string): Promise<BusinessAnalyticsContext | null> {
  if (!businessId) return null;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Fetch business record & category
    const { data: biz } = await supabase
      .from("businesses")
      .select("*, business_categories(id, name, industry_type, currency, default_tax, stock_alert_limit)")
      .eq("id", businessId)
      .maybeSingle();

    if (!biz) return null;

    // Resolve 4-tier effective settings
    const userMeta = getCachedUserMetadata(user?.id);
    const categoryDef = Array.isArray(biz.business_categories)
      ? biz.business_categories[0]
      : (biz.business_categories as any);

    const effective = resolveSettingsHierarchy({
      business: biz,
      userMeta,
      category: categoryDef,
    });

    const stockThresholdDefault = effective.stockAlertLimit;

    // 2. Fetch products
    const { data: products } = await supabase
      .from("products")
      .select("*")
      .eq("business_id", businessId);

    const prods = products || [];
    const activeProds = prods.filter((p) => p.status === "active");

    const outOfStockList = activeProds.filter((p) => Number(p.stock_units) <= 0);
    const lowStockList = activeProds.filter((p) => {
      const u = Number(p.stock_units);
      const threshold = Number(p.min_stock_alert) > 0 ? Number(p.min_stock_alert) : stockThresholdDefault;
      return u > 0 && u <= threshold;
    });

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const in60Days = new Date(now.getTime() + 60 * 24 * 3600 * 1000);

    const expiring30List = activeProds.filter((p) => {
      if (!p.expiry_date) return false;
      const exp = new Date(p.expiry_date);
      return exp >= now && exp <= in30Days;
    });

    const expiring60List = activeProds.filter((p) => {
      if (!p.expiry_date) return false;
      const exp = new Date(p.expiry_date);
      return exp > in30Days && exp <= in60Days;
    });

    const formatDualStock = (p: any, baseUnits: number): string => {
      const parsed = parseProductUOM(p.name, p.uom, p.units_per_uom, p.base_unit);
      const info = computeProductStock(baseUnits, parsed);
      if (info.packSize > 1) {
        return `${info.packs} ${info.uomLabel}${info.packs !== 1 ? "s" : ""} (${info.baseUnits} ${info.subUnitName}${info.baseUnits !== 1 ? "s" : ""})`;
      }
      return `${info.baseUnits} ${info.uomLabel}${info.baseUnits !== 1 ? "s" : ""}`;
    };

    const totalUnits = activeProds.reduce((acc, p) => acc + (Number(p.stock_units) || 0), 0);
    const costVal = activeProds.reduce(
      (acc, p) => acc + (Number(p.stock_units) || 0) * (Number(p.purchase_cost) || 0),
      0
    );
    const retailVal = activeProds.reduce((acc, p) => {
      const price = p.discount_price !== null && p.discount_price !== undefined && Number(p.discount_price) > 0
        ? Number(p.discount_price)
        : Number(p.retail_price) || 0;
      return acc + (Number(p.stock_units) || 0) * price;
    }, 0);

    const estMargin = retailVal > 0 ? ((retailVal - costVal) / retailVal) * 100 : 0;

    // 3. Fetch sales & sale items
    const { data: sales } = await supabase
      .from("sales")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    const completedSales = (sales || []).filter((s) => s.status === "completed");

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const monthStart = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    const todaySales = completedSales.filter((s) => new Date(s.created_at) >= todayStart);
    const weekSales = completedSales.filter((s) => new Date(s.created_at) >= weekStart);
    const monthSales = completedSales.filter((s) => new Date(s.created_at) >= monthStart);

    const sumTotal = (list: any[]) => list.reduce((a, s) => a + Number(s.total || 0), 0);
    const sumProfit = (list: any[]) => list.reduce((a, s) => a + Number(s.profit || 0), 0);

    const totalRev = sumTotal(completedSales);
    const totalProf = sumProfit(completedSales);
    const aov = completedSales.length > 0 ? totalRev / completedSales.length : 0;
    const netMargin = totalRev > 0 ? (totalProf / totalRev) * 100 : 0;

    // 4. Fetch Sale Items for top sellers
    const { data: saleItems } = await supabase
      .from("sale_items")
      .select("product_name, quantity, unit_price, unit_cost")
      .eq("owner_user_id", user?.id || biz.owner_user_id)
      .limit(200);

    const itemAgg: Record<string, { units: number; revenue: number; profit: number }> = {};
    (saleItems || []).forEach((it) => {
      const name = it.product_name || "Unknown Product";
      const q = Number(it.quantity) || 1;
      const price = Number(it.unit_price) || 0;
      const cost = Number(it.unit_cost) || 0;
      if (!itemAgg[name]) itemAgg[name] = { units: 0, revenue: 0, profit: 0 };
      itemAgg[name].units += q;
      itemAgg[name].revenue += price * q;
      itemAgg[name].profit += (price - cost) * q;
    });

    const topItems = Object.entries(itemAgg)
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);

    // 5. Fetch Purchases
    const { data: purchases } = await supabase
      .from("purchases")
      .select("total, status")
      .eq("business_id", businessId);

    const completedPurchases = (purchases || []).filter((p) => p.status === "completed" || p.status === "received");
    const totalPurchasesCost = completedPurchases.reduce((a, p) => a + Number(p.total || 0), 0);

    return {
      business: {
        id: biz.id,
        name: biz.business_name,
        currency: effective.currency,
        taxRate: effective.taxRate,
        stockAlertLimit: effective.stockAlertLimit,
        status: biz.status,
        categoryName: categoryDef?.name || "General Business",
      },
      inventory: {
        totalProducts: prods.length,
        activeProducts: activeProds.length,
        outOfStockCount: outOfStockList.length,
        lowStockCount: lowStockList.length,
        expiringCount: expiring30List.length,
        expiring30Count: expiring30List.length,
        expiring60Count: expiring60List.length,
        totalUnitsInStock: totalUnits,
        inventoryCostValue: costVal,
        inventoryRetailValue: retailVal,
        estimatedGrossProfitMargin: estMargin,
        outOfStockItems: outOfStockList.slice(0, 10).map((p) => p.name),
        lowStockItems: lowStockList.slice(0, 10).map((p) => {
          const u = Number(p.stock_units);
          return {
            name: p.name,
            units: u,
            threshold: Number(p.min_stock_alert) || stockThresholdDefault,
            packsDisplay: formatDualStock(p, u),
            uom: p.uom || "piece",
          };
        }),
        expiringItems: expiring30List.slice(0, 10).map((p) => {
          const u = Number(p.stock_units);
          const exp = new Date(p.expiry_date!);
          const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
          return {
            name: p.name,
            expiryDate: p.expiry_date!,
            daysRemaining: diffDays,
            units: u,
            packsDisplay: formatDualStock(p, u),
          };
        }),
        expiring60Items: expiring60List.slice(0, 10).map((p) => {
          const u = Number(p.stock_units);
          const exp = new Date(p.expiry_date!);
          const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
          return {
            name: p.name,
            expiryDate: p.expiry_date!,
            daysRemaining: diffDays,
            units: u,
            packsDisplay: formatDualStock(p, u),
          };
        }),
      },
      sales: {
        todayRevenue: sumTotal(todaySales),
        todayProfit: sumProfit(todaySales),
        todayTransactions: todaySales.length,
        weekRevenue: sumTotal(weekSales),
        weekProfit: sumProfit(weekSales),
        weekTransactions: weekSales.length,
        monthRevenue: sumTotal(monthSales),
        monthProfit: sumProfit(monthSales),
        monthTransactions: monthSales.length,
        totalRevenue: totalRev,
        totalProfit: totalProf,
        totalTransactions: completedSales.length,
        averageOrderValue: aov,
        netProfitMargin: netMargin,
        topSellingItems: topItems,
        recentSales: completedSales.slice(0, 5).map((s) => ({
          id: s.id,
          total: Number(s.total),
          profit: Number(s.profit),
          date: s.created_at,
          status: s.status,
          processedBy: s.processed_by || "System",
        })),
      },
      purchases: {
        totalPurchasesCount: completedPurchases.length,
        totalPurchasesCost,
      },
    };
  } catch (err) {
    console.error("Error fetching live analytics for AI Assistant:", err);
    return null;
  }
}

/**
 * Detect language of user query (English, Roman Urdu, Urdu script, Arabic, Spanish, etc.)
 */
export function detectQueryLanguage(text: string): "english" | "roman_urdu" | "urdu" | "arabic" | "spanish" | "other" {
  const t = text.trim().toLowerCase();

  // Arabic / Urdu unicode scripts
  if (/[\u0600-\u06FF]/.test(t)) {
    // Check for Urdu specific characters or words
    if (/[\u0679\u067E\u0686\u0688\u0691\u06BA\u06BE\u06C1\u06D2]/.test(t) || t.includes("ہے") || t.includes("کیا") || t.includes("میرا") || t.includes("کتنا")) {
      return "urdu";
    }
    return "arabic";
  }

  // Roman Urdu keyword heuristics
  const romanUrduKeywords = [
    "mera", "meri", "mere", "kitna", "kitni", "kitne", "hai", "hain", "kaisa", "kaisi", "kaise",
    "chal", "raha", "rahi", "batao", "bataen", "btao", "konsi", "konsa", "kya", "kyun", "karo",
    "bik", "bikne", "wali", "cheez", "munafa", "bikri", "karobar", "dukan", "maal", "bacha", "kamai",
    "faida", "nuksan", "kharid", "becha", "aaj", "kal", "mahina", "hafta"
  ];

  const words = t.split(/\s+/);
  const matchedUrdu = words.filter((w) => romanUrduKeywords.includes(w)).length;
  if (matchedUrdu >= 1 || (words.length <= 4 && matchedUrdu >= 1)) {
    return "roman_urdu";
  }

  // Spanish heuristics
  const spanishKeywords = ["que", "cual", "cómo", "beneficio", "ganancia", "ventas", "inventario", "stock", "cuanto", "hoy", "mes"];
  const matchedSpanish = words.filter((w) => spanishKeywords.includes(w)).length;
  if (matchedSpanish >= 2) {
    return "spanish";
  }

  return "english";
}

/**
 * Intelligent Client-Side fallback analyzer & synthesizer using actual business data.
 * Respects user plan capabilities:
 * - Free: only basic assistance, only Monthly profit report, only Analyst mode (not operator, knowledge, advisor).
 * - Standard: Monthly & Weekly report, basic operator mode (not knowledge, advisor).
 * - Premium / Lifetime: Full access, all 4 models, Lifetime, monthly, weekly, and daily reports and full supportive assistant.
 */
export function generateLocalBusinessAnalysis(
  query: string,
  mode: AIMode,
  ctx: BusinessAnalyticsContext | null,
  planId: PlanId = "free"
): string {
  if (!ctx) {
    return "⚠️ Please select an active business in the workspace header so I can read your live sales, inventory, and profit data.";
  }

  const lang = detectQueryLanguage(query);
  const q = query.toLowerCase();
  const curr = ctx.business.currency;
  const fmt = (val: number) => formatCurrency(val, curr);

  // 0. PLAN MODE RESTRICTION CHECK
  if (!isModeAllowedForPlan(mode, planId)) {
    if (planId === "free") {
      return `🔒 **Model Restricted (Free Plan)**\n\nThe **${mode.toUpperCase()}** model is available on **Standard** (Operator) and **Premium** (Knowledge & Advisor) plans. On the Free Plan, you have full access to **Analyst** mode with monthly business intelligence.\n\n*Upgrade your subscription to unlock this specialized AI model.*`;
    }
    if (planId === "standard" && (mode === "knowledge" || mode === "advisor")) {
      return `🔒 **Model Restricted (Standard Plan)**\n\nThe **${mode.toUpperCase()}** model is exclusive to the **Premium Plan** with multi-branch predictive intelligence and strategic advisors. On the Standard Plan, you have full access to **Analyst** and **Operator** modes.\n\n*Upgrade to Premium in the Subscription tab to unlock this model.*`;
    }
  }

  const isFree = planId === "free";
  const isStandard = planId === "standard";
  const isPremiumOrLifetime = planId === "premium" || planId === "lifetime";

  // Check if query is explicitly asking for today/daily or weekly reports
  const asksDaily = q.includes("today") || q.includes("aaj") || q.includes("daily") || q.includes("din") || q.includes("hoy") || q.includes("يوم");
  const asksWeekly = q.includes("week") || q.includes("hafta") || q.includes("semana") || q.includes("أسبوع") || q.includes("7 day");
  const asksLifetime = q.includes("lifetime") || q.includes("all time") || q.includes("total") || q.includes("overall");

  // 1. PROFIT / EARNINGS QUERIES
  if (q.includes("profit") || q.includes("margin") || q.includes("munafa") || q.includes("kamai") || q.includes("faida") || q.includes("beneficio") || q.includes("ربح")) {
    // Plan restriction on Free Plan (Monthly only, not daily/weekly)
    if (isFree) {
      const notice = (asksDaily || asksWeekly)
        ? `📅 *Plan Notice: Daily and Weekly breakdowns are available on Standard & Premium plans. Showing your Monthly Profit Performance:*\n\n`
        : "";

      if (lang === "roman_urdu") {
        return [
          `${notice}**${ctx.business.name} ka Monthly Profit Analysis (${curr}):**`,
          `• **Pichle 30 Din Ka Munafa:** ${fmt(ctx.sales.monthProfit)} (Total Sales: ${fmt(ctx.sales.monthRevenue)})`,
          `• **Net Profit Margin:** ${ctx.sales.netProfitMargin.toFixed(1)}%`,
          `• **Total Completed Orders (30 Days):** ${ctx.sales.monthTransactions} orders`,
          ``,
          `💡 *Free Plan Info:* Daily aur Weekly profit reports Standard aur Premium plans par dastiyab hain.`
        ].join("\n");
      }

      return [
        `${notice}### Monthly Profit & Margin Analysis: ${ctx.business.name}`,
        `• **Last 30 Days Profit:** ${fmt(ctx.sales.monthProfit)} on ${fmt(ctx.sales.monthRevenue)} revenue`,
        `• **Net Profit Margin:** ${ctx.sales.netProfitMargin.toFixed(1)}%`,
        `• **Monthly Completed Orders:** ${ctx.sales.monthTransactions} transactions`,
        `• **Average Order Value:** ${fmt(ctx.sales.averageOrderValue)}`,
        ``,
        `Upgrade to Standard or Premium to unlock real-time Daily and 7-Day Weekly profit trends.`
      ].join("\n");
    }

    // Plan restriction on Standard Plan (Monthly & Weekly, not daily breakdown)
    if (isStandard) {
      const notice = asksDaily
        ? `📅 Plan Notice: Daily real-time tracking is exclusive to the Premium Plan. Showing Weekly & Monthly Profit Performance:\n\n`
        : "";

      if (lang === "roman_urdu") {
        return [
          `${notice}**${ctx.business.name} ka Weekly & Monthly Profit Analysis (${curr}):**`,
          `• **Pichle 7 Din Ka Munafa:** ${fmt(ctx.sales.weekProfit)} (Sales: ${fmt(ctx.sales.weekRevenue)}, ${ctx.sales.weekTransactions} orders)`,
          `• **Pichle 30 Din Ka Munafa:** ${fmt(ctx.sales.monthProfit)} (Sales: ${fmt(ctx.sales.monthRevenue)}, ${ctx.sales.monthTransactions} orders)`,
          `• **Net Profit Margin:** ${ctx.sales.netProfitMargin.toFixed(1)}%`,
          ``,
          `💡 Standard Plan Info: Real-time daily reports aur lifetime deep audit Premium plan par dastiyab hain.`
        ].join("\n");
      }

      return [
        `${notice}### Weekly & Monthly Profit Analysis: ${ctx.business.name}`,
        `• **Last 7 Days (Weekly) Profit:** ${fmt(ctx.sales.weekProfit)} on ${fmt(ctx.sales.weekRevenue)} revenue (${ctx.sales.weekTransactions} orders)`,
        `• **Last 30 Days (Monthly) Profit:** ${fmt(ctx.sales.monthProfit)} on ${fmt(ctx.sales.monthRevenue)} revenue (${ctx.sales.monthTransactions} orders)`,
        `• **Net Profit Margin:** ${ctx.sales.netProfitMargin.toFixed(1)}%`,
        `• **Average Order Value:** ${fmt(ctx.sales.averageOrderValue)}`,
        ``,
        `Upgrade to Premium to unlock full Daily real-time tracking, lifetime reports, and AI strategic advisors.`
      ].join("\n");
    }

    // Premium / Lifetime Plan: Full access, daily, weekly, monthly, lifetime!
    if (lang === "roman_urdu") {
      return [
        `**${ctx.business.name} ka Full Comprehensive Profit Report (${curr}) [VIP]:**`,
        `• **Aaj Ka Munafa (Daily):** ${fmt(ctx.sales.todayProfit)} (${ctx.sales.todayTransactions} sales, ${fmt(ctx.sales.todayRevenue)} revenue)`,
        `• **Pichle 7 Din Ka Munafa (Weekly):** ${fmt(ctx.sales.weekProfit)} (Sales: ${fmt(ctx.sales.weekRevenue)})`,
        `• **Pichle 30 Din Ka Munafa (Monthly):** ${fmt(ctx.sales.monthProfit)} (Sales: ${fmt(ctx.sales.monthRevenue)})`,
        `• **Net Profit Margin:** ${ctx.sales.netProfitMargin.toFixed(1)}%`,
        `• **Overall Lifetime Profit:** ${fmt(ctx.sales.totalProfit)} across ${ctx.sales.totalTransactions} transactions`,
        ``,
        `💡 Premium Strategy: Margin behtar karne ke liye top-selling items ki wholesale bulk purchasing karein.`
      ].join("\n");
    }

    if (lang === "urdu") {
      return [
        `**${ctx.business.name} کا مکمل منافع جاتی تجزیہ (${curr}) [پریمیم]:**`,
        `• **آج کا منافع (Daily):** ${fmt(ctx.sales.todayProfit)} (${ctx.sales.todayTransactions} بل)`,
        `• **گزشتہ 7 دن کا منافع (Weekly):** ${fmt(ctx.sales.weekProfit)} (فروخت: ${fmt(ctx.sales.weekRevenue)})`,
        `• **گزشتہ 30 دن کا منافع (Monthly):** ${fmt(ctx.sales.monthProfit)} (فروخت: ${fmt(ctx.sales.monthRevenue)})`,
        `• **خالص منافع کا تناسب (Margin):** ${ctx.sales.netProfitMargin.toFixed(1)}%`,
        `• **مجموعی لائف ٹائم منافع:** ${fmt(ctx.sales.totalProfit)}`
      ].join("\n");
    }

    if (lang === "arabic") {
      return [
        `**تحليل الأرباح الشامل لـ ${ctx.business.name} (${curr}) [بريميوم]:**`,
        `• **أرباح اليوم:** ${fmt(ctx.sales.todayProfit)} (${ctx.sales.todayTransactions} معاملة)`,
        `• **أرباح آخر 7 أيام:** ${fmt(ctx.sales.weekProfit)} (المبيعات: ${fmt(ctx.sales.weekRevenue)})`,
        `• **أرباح آخر 30 يوماً:** ${fmt(ctx.sales.monthProfit)} (المبيعات: ${fmt(ctx.sales.monthRevenue)})`,
        `• **هامش صافي الربح:** ${ctx.sales.netProfitMargin.toFixed(1)}%`,
        `• **إجمالي الأرباح الكلية:** ${fmt(ctx.sales.totalProfit)}`
      ].join("\n");
    }

    return [
      `### Complete Profit & Margin Audit: ${ctx.business.name}`,
      `• **Today's Net Profit (Daily):** ${fmt(ctx.sales.todayProfit)} on ${fmt(ctx.sales.todayRevenue)} revenue (${ctx.sales.todayTransactions} orders)`,
      `• **Last 7 Days (Weekly):** ${fmt(ctx.sales.weekProfit)} profit on ${fmt(ctx.sales.weekRevenue)} revenue`,
      `• **Last 30 Days (Monthly):** ${fmt(ctx.sales.monthProfit)} profit on ${fmt(ctx.sales.monthRevenue)} revenue`,
      `• **Net Profit Margin:** ${ctx.sales.netProfitMargin.toFixed(1)}%`,
      `• **All-Time Lifetime Profit:** ${fmt(ctx.sales.totalProfit)} across ${ctx.sales.totalTransactions} transactions`,
      ``,
      `**Executive Recommendation:** Your average order value is ${fmt(ctx.sales.averageOrderValue)}. Fast-moving items yield strong returns—consider restocking high margin items.`
    ].join("\n");
  }

  // 2. SALES / REVENUE QUERIES
  if (q.includes("sale") || q.includes("revenue") || q.includes("bikri") || q.includes("becha") || q.includes("ventas") || q.includes("مبيعات")) {
    if (isFree) {
      const notice = (asksDaily || asksWeekly)
        ? `📅 Plan Notice: Daily and Weekly breakdown reports are available on Standard & Premium. Showing Monthly Performance:\n\n`
        : "";

      if (lang === "roman_urdu") {
        return [
          `${notice}**${ctx.business.name} ki Monthly Sales Report:**`,
          `• **Pichle 30 Din Ki Sales:** ${fmt(ctx.sales.monthRevenue)} (${ctx.sales.monthTransactions} transactions)`,
          `• **Average Order Value:** ${fmt(ctx.sales.averageOrderValue)}`,
          `• **Active Products in Catalog:** ${ctx.inventory.activeProducts} items`
        ].join("\n");
      }

      return [
        `${notice}### Monthly Sales Summary: ${ctx.business.name}`,
        `• **Last 30 Days Revenue:** ${fmt(ctx.sales.monthRevenue)} (${ctx.sales.monthTransactions} orders)`,
        `• **Average Order Value (AOV):** ${fmt(ctx.sales.averageOrderValue)}`,
        `• **Catalog Size:** ${ctx.inventory.activeProducts} products`,
        ``,
        `Upgrade to Standard or Premium to view 7-Day Weekly and Real-time Daily sales logs.`
      ].join("\n");
    }

    if (isStandard) {
      const notice = asksDaily
        ? `📅 Plan Notice: Daily live logs are exclusive to the Premium Plan. Showing Weekly & Monthly Sales:\n\n`
        : "";

      if (lang === "roman_urdu") {
        return [
          `${notice}**${ctx.business.name} ki Weekly & Monthly Sales Report:**`,
          `• **Pichle 7 Din (Weekly):** ${fmt(ctx.sales.weekRevenue)} (${ctx.sales.weekTransactions} transactions)`,
          `• **Pichle 30 Din (Monthly):** ${fmt(ctx.sales.monthRevenue)} (${ctx.sales.monthTransactions} transactions)`,
          `• **Average Order Value:** ${fmt(ctx.sales.averageOrderValue)}`
        ].join("\n");
      }

      return [
        `${notice}### Weekly & Monthly Sales Summary: ${ctx.business.name}`,
        `• **Last 7 Days (Weekly):** ${fmt(ctx.sales.weekRevenue)} (${ctx.sales.weekTransactions} orders)`,
        `• **Last 30 Days (Monthly):** ${fmt(ctx.sales.monthRevenue)} (${ctx.sales.monthTransactions} orders)`,
        `• **Average Order Value (AOV):** ${fmt(ctx.sales.averageOrderValue)}`,
        ``,
        `Upgrade to Premium to unlock daily breakdown logs, lifetime analytics, and AI Strategic Advisor.`
      ].join("\n");
    }

    // Premium
    if (lang === "roman_urdu") {
      return [
        `**${ctx.business.name} ki Full Sales Report [VIP]:**`,
        `• **Aaj Ki Sales (Daily):** ${fmt(ctx.sales.todayRevenue)} (${ctx.sales.todayTransactions} transactions)`,
        `• **Pichle 7 Din (Weekly):** ${fmt(ctx.sales.weekRevenue)} (${ctx.sales.weekTransactions} transactions)`,
        `• **Pichle 30 Din (Monthly):** ${fmt(ctx.sales.monthRevenue)} (${ctx.sales.monthTransactions} transactions)`,
        `• **Average Order Value:** ${fmt(ctx.sales.averageOrderValue)}`,
        `• **Total Lifetime Sales:** ${fmt(ctx.sales.totalRevenue)} (${ctx.sales.totalTransactions} transactions)`
      ].join("\n");
    }

    return [
      `### Full Sales & Revenue Audit: ${ctx.business.name}`,
      `• **Today's Revenue (Daily):** ${fmt(ctx.sales.todayRevenue)} (${ctx.sales.todayTransactions} order(s))`,
      `• **Last 7 Days (Weekly):** ${fmt(ctx.sales.weekRevenue)} (${ctx.sales.weekTransactions} orders)`,
      `• **Last 30 Days (Monthly):** ${fmt(ctx.sales.monthRevenue)} (${ctx.sales.monthTransactions} orders)`,
      `• **Average Order Value (AOV):** ${fmt(ctx.sales.averageOrderValue)}`,
      `• **Total Lifetime Revenue:** ${fmt(ctx.sales.totalRevenue)} from ${ctx.sales.totalTransactions} completed transactions.`
    ].join("\n");
  }

  // 2.5. NEAR EXPIRY & SHELF-LIFE AUDIT QUERIES
  if (q.includes("expir") || q.includes("tareekh") || q.includes("shelf") || q.includes("khatam hone") || q.includes("صلاحية")) {
    const expiring30Details = ctx.inventory.expiringItems.length > 0
      ? ctx.inventory.expiringItems.map((i) => `  - 🔴 **${i.name}**: ${i.packsDisplay} — expires in **${i.daysRemaining} days** (${i.expiryDate})`).join("\n")
      : "  - No products expiring within 30 days.";

    const expiring60Details = (ctx.inventory.expiring60Items || []).length > 0
      ? ctx.inventory.expiring60Items.map((i) => `  - 🟡 **${i.name}**: ${i.packsDisplay} — expires in **${i.daysRemaining} days** (${i.expiryDate})`).join("\n")
      : "  - No products expiring in 31–60 days.";

    if (lang === "roman_urdu") {
      return [
        `🚨 **${ctx.business.name} ka Expiry & Shelf-Life Watchlist:**`,
        `• **Urgent Expiry (< 30 Din):** ${ctx.inventory.expiring30Count} items`,
        expiring30Details,
        `• **Moderate Alert (31–60 Din):** ${ctx.inventory.expiring60Count} items`,
        expiring60Details,
        ``,
        `💡 **Tadbeer:** Urgent items ko POS par promotional clearance discount de kar jaldi sell karein ya vendor ko return batch issue karein.`
      ].join("\n");
    }

    return [
      `### 🛡️ Product Expiry & Shelf-Life Audit: ${ctx.business.name}`,
      `• **Urgent Expiry (< 30 Days):** ${ctx.inventory.expiring30Count} product(s) requiring immediate attention`,
      expiring30Details,
      `• **Upcoming Expiry (31–60 Days Watchlist):** ${ctx.inventory.expiring60Count} product(s)`,
      expiring60Details,
      ``,
      `**Recommended Action:** Apply clearance pricing in POS terminal or coordinate return-to-vendor / credit note for near-expiry batches.`
    ].join("\n");
  }

  // 3. INVENTORY / STOCK / LOW STOCK / OUT OF STOCK QUERIES
  if (q.includes("stock") || q.includes("inventory") || q.includes("product") || q.includes("reorder") || q.includes("maal") || q.includes("kam") || q.includes("khatam") || q.includes("مخزون")) {
    const lowStockDetails = ctx.inventory.lowStockItems.length > 0
      ? ctx.inventory.lowStockItems.map((i) => `  - **${i.name}**: ${i.packsDisplay} remaining (alert threshold: ${i.threshold})`).join("\n")
      : "  - No items currently below low stock threshold.";

    const oosDetails = ctx.inventory.outOfStockItems.length > 0
      ? ctx.inventory.outOfStockItems.map((name) => `  - **${name}** (0 units)`).join("\n")
      : "  - Zero out-of-stock items currently.";

    if (lang === "roman_urdu") {
      return [
        `**Inventory & Stock Status for ${ctx.business.name}:**`,
        `• **Total Active Products:** ${ctx.inventory.activeProducts} items (${ctx.inventory.totalUnitsInStock} total units in stock)`,
        `• **Inventory Worth (Purchase Cost):** ${fmt(ctx.inventory.inventoryCostValue)}`,
        `• **Inventory Retail Value:** ${fmt(ctx.inventory.inventoryRetailValue)}`,
        `• **Out of Stock:** ${ctx.inventory.outOfStockCount} items`,
        oosDetails,
        `• **Low Stock Alert (≤ ${ctx.business.stockAlertLimit} units):** ${ctx.inventory.lowStockCount} items`,
        lowStockDetails,
        `• **Expiring within 30 days:** ${ctx.inventory.expiring30Count} items`,
        `• **Expiring in 31–60 days:** ${ctx.inventory.expiring60Count} items`,
        ``,
        `💡 Next Step: Purchases tab se restock order create karein.`
      ].join("\n");
    }

    return [
      `### Inventory & Stock Health: ${ctx.business.name}`,
      `• **Total Active Catalog:** ${ctx.inventory.activeProducts} products (${ctx.inventory.totalUnitsInStock} total units on shelves)`,
      `• **Inventory Valuation:** ${fmt(ctx.inventory.inventoryCostValue)} (Cost) | ${fmt(ctx.inventory.inventoryRetailValue)} (Retail)`,
      `• **Out of Stock:** ${ctx.inventory.outOfStockCount} products`,
      oosDetails,
      `• **Low Stock Alerts (Threshold: ≤ ${ctx.business.stockAlertLimit} units):** ${ctx.inventory.lowStockCount} products`,
      lowStockDetails,
      `• **Expiring within 30 days:** ${ctx.inventory.expiring30Count} products`,
      `• **Expiring in 31–60 days:** ${ctx.inventory.expiring60Count} products`,
      ``,
      `**Action Item:** Navigate to **Inventory → Low Stock** or **Purchases** to trigger restocking orders.`
    ].join("\n");
  }

  // 4. TAX & CURRENCY & SETTINGS QUERIES
  if (q.includes("tax") || q.includes("currency") || q.includes("setting") || q.includes("rate") || q.includes("vat") || q.includes("gst")) {
    if (lang === "roman_urdu") {
      return [
        `**${ctx.business.name} ke Effective Business Settings:**`,
        `• **Base Currency:** ${ctx.business.currency}`,
        `• **Active Tax Rate:** ${ctx.business.taxRate}%`,
        `• **Stock Alert Threshold:** ${ctx.business.stockAlertLimit} units`,
        `• **Business Category:** ${ctx.business.categoryName}`,
        ``,
        `Ye settings aap **Settings tab** se kisi bhi waqt customize kar sakte hain.`
      ].join("\n");
    }

    return [
      `### Effective Settings for **${ctx.business.name}**`,
      `• **Operating Currency:** **${ctx.business.currency}**`,
      `• **Effective Tax Rate:** **${ctx.business.taxRate}%**`,
      `• **Default Stock Alert Threshold:** **${ctx.business.stockAlertLimit} units**`,
      `• **Industry Category:** **${ctx.business.categoryName}**`,
      `• **Operating Status:** **${ctx.business.status.toUpperCase()}**`,
      ``,
      `All transactions, POS receipts, and inventory alerts strictly apply these resolved settings.`
    ].join("\n");
  }

  // 4.5. LIVE GEFLOW SYSTEM KNOWLEDGE & FAQS
  if (q.includes("maryam") || q.includes("who are you") || q.includes("kaun ho") || q.includes("ap kaun") || q.includes("introduce")) {
    if (lang === "roman_urdu") {
      return [
        `👋 **Salam! Main hoon Maryam AI — aapki dedicated GeFlow Live Store Assistant.**`,
        `Main aapke active store (${ctx.business.name}) ke live sales, real-time profits, low-stock inventory alerts, aur configuration settings ki mukammal maloomat rakhti hoon.`,
        ``,
        `**Live Version Features jin par main madad kar sakti hoon:**`,
        `• **POS Terminal**: Barcode scanning, discount calculation, split payments aur 80mm thermal receipts.`,
        `• **Inventory**: Auto SKU generator, low stock alerts, aur quick product purchase.`,
        `• **Team Hub**: Staff roles (Manager, Cashier, Inventory) aur secure invite links.`,
        `• **Analytics**: Aapke active store ka real-time profit, revenue aur order trends.`,
      ].join("\n");
    }
    return [
      `👋 **Hello! I am Maryam AI — your dedicated GeFlow Live Store Assistant.**`,
      `I have real-time access to your active store (**${ctx.business.name}**) metrics, inventory stock, sales ledger, and operational configurations.`,
      ``,
      `**Live System Capabilities I support:**`,
      `• **POS & Checkout**: Fast barcode scanning, multi-mode payments (Cash/Card/Split), and ESC/POS thermal receipts.`,
      `• **Inventory & Procurement**: One-click SKU generation, threshold alerts, and supplier purchase orders with quick-add.`,
      `• **Team & Workspace**: Multi-business switching and granular staff roles (Manager, Cashier, Inventory).`,
      `• **Store Analytics**: Live profit margins, order velocity, and cost valuation strictly scoped to your active store.`,
    ].join("\n");
  }

  // Quick Add Product in Purchase Dialog
  if (q.includes("purchase") && (q.includes("new product") || q.includes("quick add") || q.includes("unlisted") || q.includes("naya product") || q.includes("add product"))) {
    return [
      `📦 **Adding New Products during Purchase in GeFlow (Live Version):**`,
      `1. Open **Purchases** from the navigation sidebar and click **New Purchase** (or Purchase Architect).`,
      `2. In the item selection row, click the **+ Quick Add Product** button or choose '+ Add New Product' from the dropdown.`,
      `3. Enter the product title, purchase cost, retail selling price, and category in the popup.`,
      `4. Once saved, it is immediately listed in the purchase order and added to your store's inventory catalog!`,
    ].join("\n");
  }

  // SKU Generation in Inventory
  if (q.includes("sku") || (q.includes("inventory") && q.includes("code"))) {
    return [
      `🏷️ **Auto SKU Generation in GeFlow (Live Version):**`,
      `1. Navigate to **Inventory** in your store panel.`,
      `2. Click **Add Product** (or edit an existing item).`,
      `3. Next to the SKU field, click the **Auto SKU** button. GeFlow will instantly generate a unique 8-character SKU code (e.g. \`SKU-XXXX-XX\`).`,
      `4. You can also print barcode labels directly from the inventory product actions.`,
    ].join("\n");
  }

  // Business Limit according to plan
  if (q.includes("limit") || q.includes("kitne business") || q.includes("store limit") || q.includes("how many business")) {
    return [
      `🏢 **GeFlow Store Registration Limits by Subscription Plan:**`,
      `• **Free Plan:** 1 Business / Store`,
      `• **Standard Plan:** Up to 3 Businesses / Stores`,
      `• **Premium Plan:** Up to 7 Businesses / Stores`,
      `• **Lifetime Plan:** Up to 10 Businesses / Stores (Enterprise capacity)`,
      ``,
      `You can register and switch between your owned stores from the **Workspace Switcher** in the top-left sidebar.`,
    ].join("\n");
  }

  // Scheduled reports / future feature explanation
  if (q.includes("schedule") || q.includes("scheduled report") || q.includes("email report") || q.includes("shedule")) {
    return [
      `📊 **Reports & Analytics (Live Release):**`,
      `In the current live release of GeFlow, you have full access to on-demand sales, profit, and inventory analytics scoped strictly to your active store.`,
      ``,
      `*Note: Automated AI scheduled email reporting is an upcoming future roadmap feature and is not included in the current live build.*`,
    ].join("\n");
  }

  // 5. TOP PERFORMING / BEST SELLING ITEMS
  if (q.includes("best") || q.includes("top") || q.includes("performing") || q.includes("slow") || q.includes("zyada") || q.includes("popul")) {
    const topList = ctx.sales.topSellingItems.length > 0
      ? ctx.sales.topSellingItems.map((it, idx) => `${idx + 1}. **${it.name}**: ${it.units} units sold (${fmt(it.revenue)} revenue | ${fmt(it.profit)} profit)`).join("\n")
      : "No detailed item sale logs found yet.";

    if (lang === "roman_urdu") {
      return [
        `**Top Selling Products for ${ctx.business.name}:**`,
        topList,
        ``,
        `💡 In items ka stock hamesha safe level par rakhein taake sales drop na hon.`
      ].join("\n");
    }

    return [
      `### Top Performing Products for **${ctx.business.name}**`,
      topList,
      ``,
      `**Recommendation:** Maintain ample safety stock on these high-velocity items to maximize throughput.`
    ].join("\n");
  }

  // 6. GENERAL BUSINESS OVERVIEW / PERFORMANCE
  if (isFree) {
    if (lang === "roman_urdu") {
      return [
        `**${ctx.business.name} ka Monthly Summary (Free Plan):**`,
        `• **Active Currency:** ${ctx.business.currency} | **Tax Rate:** ${ctx.business.taxRate}%`,
        `• **Pichle 30 Din Ka Revenue:** ${fmt(ctx.sales.monthRevenue)} | **Net Profit:** ${fmt(ctx.sales.monthProfit)} (${ctx.sales.netProfitMargin.toFixed(1)}% margin)`,
        `• **Inventory Valuation:** ${fmt(ctx.inventory.inventoryCostValue)} (${ctx.inventory.activeProducts} products)`,
        `• **Stock Status:** ${ctx.inventory.outOfStockCount} out-of-stock, ${ctx.inventory.lowStockCount} low stock alerts`,
        ``,
        `Aap mujh se monthly profit, inventory, aur business settings ke bare mein pooch sakte hain!`
      ].join("\n");
    }

    return [
      `### Monthly Business Overview for **${ctx.business.name}** *(Free Plan)*`,
      `• **Configuration:** Currency: **${ctx.business.currency}** | Tax Rate: **${ctx.business.taxRate}%** | Stock Alert: **${ctx.business.stockAlertLimit} units**`,
      `• **Trailing 30 Days (Monthly):** **${fmt(ctx.sales.monthRevenue)}** revenue with **${fmt(ctx.sales.monthProfit)}** net profit (**${ctx.sales.netProfitMargin.toFixed(1)}% margin**).`,
      `• **Inventory Valuation:** **${fmt(ctx.inventory.inventoryCostValue)}** cost value across **${ctx.inventory.activeProducts} active products** (${ctx.inventory.totalUnitsInStock} units).`,
      `• **Stock Health Alerts:** **${ctx.inventory.outOfStockCount}** out-of-stock, **${ctx.inventory.lowStockCount}** low-stock items.`,
      ``,
      `*Note: Upgrade to Standard or Premium to unlock 7-day weekly, daily real-time reports, and all 4 AI operational models.*`
    ].join("\n");
  }

  if (isStandard) {
    if (lang === "roman_urdu") {
      return [
        `**${ctx.business.name} ka Weekly & Monthly Summary (Standard Plan):**`,
        `• **Pichle 7 Din (Weekly):** ${fmt(ctx.sales.weekRevenue)} (Munafa: ${fmt(ctx.sales.weekProfit)})`,
        `• **Pichle 30 Din (Monthly):** ${fmt(ctx.sales.monthRevenue)} (Munafa: ${fmt(ctx.sales.monthProfit)}, ${ctx.sales.netProfitMargin.toFixed(1)}% margin)`,
        `• **Inventory Valuation:** ${fmt(ctx.inventory.inventoryCostValue)} (${ctx.inventory.activeProducts} products)`,
        `• **Stock Status:** ${ctx.inventory.outOfStockCount} out-of-stock, ${ctx.inventory.lowStockCount} low stock alerts`,
        ``,
        `💡 *Standard Access:* Analyst aur Operator modes active hain.`
      ].join("\n");
    }

    return [
      `### Weekly & Monthly Business Overview for **${ctx.business.name}** *(Standard Plan)*`,
      `• **Last 7 Days (Weekly):** **${fmt(ctx.sales.weekRevenue)}** revenue with **${fmt(ctx.sales.weekProfit)}** profit (${ctx.sales.weekTransactions} orders).`,
      `• **Last 30 Days (Monthly):** **${fmt(ctx.sales.monthRevenue)}** revenue with **${fmt(ctx.sales.monthProfit)}** profit (**${ctx.sales.netProfitMargin.toFixed(1)}% margin**).`,
      `• **Inventory Valuation:** **${fmt(ctx.inventory.inventoryCostValue)}** across **${ctx.inventory.activeProducts} active products**.`,
      `• **Stock Health:** **${ctx.inventory.outOfStockCount}** out-of-stock items, **${ctx.inventory.lowStockCount}** low stock alerts.`,
      ``,
      `*Upgrade to Premium to unlock daily real-time reports, lifetime data, Knowledge mode, and Advisor mode.*`
    ].join("\n");
  }

  // Premium / Lifetime
  if (lang === "roman_urdu") {
    return [
      `**${ctx.business.name} ka Complete Executive Summary [Premium / Lifetime]:**`,
      `• **Active Currency:** ${ctx.business.currency} | **Tax Rate:** ${ctx.business.taxRate}%`,
      `• **Aaj Ki Sales (Daily):** ${fmt(ctx.sales.todayRevenue)} (${ctx.sales.todayTransactions} sales) | **Munafa:** ${fmt(ctx.sales.todayProfit)}`,
      `• **Pichle 7 Din (Weekly):** ${fmt(ctx.sales.weekRevenue)} | **Munafa:** ${fmt(ctx.sales.weekProfit)}`,
      `• **Pichle 30 Din (Monthly):** ${fmt(ctx.sales.monthRevenue)} | **Munafa:** ${fmt(ctx.sales.monthProfit)} (${ctx.sales.netProfitMargin.toFixed(1)}% margin)`,
      `• **Lifetime Profit:** ${fmt(ctx.sales.totalProfit)} on ${fmt(ctx.sales.totalRevenue)} revenue`,
      `• **Inventory Valuation:** ${fmt(ctx.inventory.inventoryCostValue)} (${ctx.inventory.activeProducts} products, ${ctx.inventory.totalUnitsInStock} units)`,
      `• **Stock Status:** ${ctx.inventory.outOfStockCount} out-of-stock, ${ctx.inventory.lowStockCount} low stock alerts`,
      ``,
      `Aap tamam 4 AI models (Analyst, Operator, Knowledge, Advisor) se full assistance le sakte hain!`
    ].join("\n");
  }

  return [
    `### Comprehensive Performance Audit for **${ctx.business.name}** *(Premium / Lifetime VIP)*`,
    `• **Configuration:** Currency: **${ctx.business.currency}** | Tax Rate: **${ctx.business.taxRate}%** | Stock Alert: **${ctx.business.stockAlertLimit} units**`,
    `• **Today's Real-Time Performance (Daily):** **${fmt(ctx.sales.todayRevenue)}** revenue (${ctx.sales.todayTransactions} orders) generating **${fmt(ctx.sales.todayProfit)}** net profit.`,
    `• **Trailing 7 Days (Weekly):** **${fmt(ctx.sales.weekRevenue)}** revenue with **${fmt(ctx.sales.weekProfit)}** profit.`,
    `• **Trailing 30 Days (Monthly):** **${fmt(ctx.sales.monthRevenue)}** revenue with **${fmt(ctx.sales.monthProfit)}** profit (**${ctx.sales.netProfitMargin.toFixed(1)}% margin**).`,
    `• **All-Time Lifetime Totals:** **${fmt(ctx.sales.totalProfit)}** net profit on **${fmt(ctx.sales.totalRevenue)}** lifetime revenue.`,
    `• **Inventory Valuation:** **${fmt(ctx.inventory.inventoryCostValue)}** cost value across **${ctx.inventory.activeProducts} active products** (${ctx.inventory.totalUnitsInStock} total units).`,
    `• **Stock Health Alerts:** **${ctx.inventory.outOfStockCount}** out-of-stock items, **${ctx.inventory.lowStockCount}** low-stock items, and **${ctx.inventory.expiringCount}** expiring items.`,
    ``,
    `Ask me specific questions across all 4 intelligence models: profit breakdowns, operator drafting, industry knowledge, or multi-branch growth advisory!`
  ].join("\n");
}

/**
 * Storage helpers for AI Assistant conversations in Supabase / User Cache.
 */
const CONV_CACHE_PREFIX = "geflow_ai_conv_";

export function loadStoredAIConversation(businessId?: string | null, userId?: string | null): AIChatMessage[] {
  const key = `${CONV_CACHE_PREFIX}${businessId || "global"}_${userId || "anon"}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveAIConversation(
  messages: AIChatMessage[],
  businessId?: string | null,
  userId?: string | null
): Promise<void> {
  const key = `${CONV_CACHE_PREFIX}${businessId || "global"}_${userId || "anon"}`;
  try {
    const trimmed = messages.slice(-40);
    localStorage.setItem(key, JSON.stringify(trimmed));

    // Also sync to Supabase user metadata asynchronously
    if (userId && businessId) {
      try {
        await supabase.auth.updateUser({
          data: {
            [`ai_last_chat_${businessId}`]: trimmed.slice(-10),
          },
        });
      } catch (err) {
        console.debug("User metadata AI conversation sync:", err);
      }
    }
  } catch (e) {
    console.debug("Failed to store AI conversation:", e);
  }
}
