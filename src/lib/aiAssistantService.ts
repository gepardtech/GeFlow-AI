import { supabase } from "@/integrations/supabase/client";
import { resolveSettingsHierarchy, getCachedUserMetadata } from "./settingsHierarchy";
import { currencySymbol } from "./currency";

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
    totalUnitsInStock: number;
    inventoryCostValue: number;
    inventoryRetailValue: number;
    estimatedGrossProfitMargin: number;
    outOfStockItems: string[];
    lowStockItems: { name: string; units: number; threshold: number }[];
    expiringItems: { name: string; expiryDate: string; units: number }[];
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
    const expiringList = activeProds.filter((p) => {
      if (!p.expiry_date) return false;
      const exp = new Date(p.expiry_date);
      return exp >= now && exp <= in30Days;
    });

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
        expiringCount: expiringList.length,
        totalUnitsInStock: totalUnits,
        inventoryCostValue: costVal,
        inventoryRetailValue: retailVal,
        estimatedGrossProfitMargin: estMargin,
        outOfStockItems: outOfStockList.slice(0, 10).map((p) => p.name),
        lowStockItems: lowStockList.slice(0, 10).map((p) => ({
          name: p.name,
          units: Number(p.stock_units),
          threshold: Number(p.min_stock_alert) || stockThresholdDefault,
        })),
        expiringItems: expiringList.slice(0, 10).map((p) => ({
          name: p.name,
          expiryDate: p.expiry_date!,
          units: Number(p.stock_units),
        })),
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
 */
export function generateLocalBusinessAnalysis(
  query: string,
  mode: AIMode,
  ctx: BusinessAnalyticsContext | null
): string {
  if (!ctx) {
    return "⚠️ Please select an active business in the workspace header so I can read your live sales, inventory, and profit data.";
  }

  const lang = detectQueryLanguage(query);
  const q = query.toLowerCase();
  const curr = ctx.business.currency;
  const fmt = (val: number) => formatCurrency(val, curr);

  // 1. PROFIT / EARNINGS QUERIES
  if (q.includes("profit") || q.includes("margin") || q.includes("munafa") || q.includes("kamai") || q.includes("faida") || q.includes("beneficio") || q.includes("ربح")) {
    if (lang === "roman_urdu") {
      return [
        `**${ctx.business.name} ka Profit Analysis (${curr}):**`,
        `• **Aaj Ka Munafa:** ${fmt(ctx.sales.todayProfit)} (${ctx.sales.todayTransactions} sales)`,
        `• **Pichle 30 Din Ka Munafa:** ${fmt(ctx.sales.monthProfit)} (Total Sales: ${fmt(ctx.sales.monthRevenue)})`,
        `• **Net Profit Margin:** ${ctx.sales.netProfitMargin.toFixed(1)}%`,
        `• **Overall Lifetime Profit:** ${fmt(ctx.sales.totalProfit)}`,
        ``,
        `💡 *Recommendation:* Margin behtar karne ke liye top-selling items ki wholesale bulk purchasing karein.`
      ].join("\n");
    }

    if (lang === "urdu") {
      return [
        `**${ctx.business.name} کا منافع جاتی تجزیہ (${curr}):**`,
        `• **آج کا منافع:** ${fmt(ctx.sales.todayProfit)} (${ctx.sales.todayTransactions} بل)`,
        `• **گزشتہ 30 دن کا منافع:** ${fmt(ctx.sales.monthProfit)} (کل فروخت: ${fmt(ctx.sales.monthRevenue)})`,
        `• **خالص منافع کا تناسب (Margin):** ${ctx.sales.netProfitMargin.toFixed(1)}%`,
        `• **مجموعی منافع:** ${fmt(ctx.sales.totalProfit)}`,
        ``,
        `💡 *تجویز:* زیادہ منافع بخش مصنوعات کی انوینٹری برقرار رکھیں۔`
      ].join("\n");
    }

    if (lang === "arabic") {
      return [
        `**تحليل الأرباح لـ ${ctx.business.name} (${curr}):**`,
        `• **أرباح اليوم:** ${fmt(ctx.sales.todayProfit)} (${ctx.sales.todayTransactions} معاملة)`,
        `• **أرباح آخر 30 يوماً:** ${fmt(ctx.sales.monthProfit)} (إجمالي المبيعات: ${fmt(ctx.sales.monthRevenue)})`,
        `• **هامش صافي الربح:** ${ctx.sales.netProfitMargin.toFixed(1)}%`,
        `• **إجمالي الأرباح الكلية:** ${fmt(ctx.sales.totalProfit)}`
      ].join("\n");
    }

    return [
      `### Profit & Margin Analysis for **${ctx.business.name}**`,
      `• **Today's Net Profit:** **${fmt(ctx.sales.todayProfit)}** across ${ctx.sales.todayTransactions} transaction(s)`,
      `• **Last 30 Days Profit:** **${fmt(ctx.sales.monthProfit)}** on **${fmt(ctx.sales.monthRevenue)}** revenue`,
      `• **Net Profit Margin:** **${ctx.sales.netProfitMargin.toFixed(1)}%**`,
      `• **All-Time Total Profit:** **${fmt(ctx.sales.totalProfit)}**`,
      ``,
      `**Operational Insight:** Your average sale value is **${fmt(ctx.sales.averageOrderValue)}**. Focus on fast-moving high-margin categories to sustain positive cashflow.`
    ].join("\n");
  }

  // 2. SALES / REVENUE QUERIES
  if (q.includes("sale") || q.includes("revenue") || q.includes("bikri") || q.includes("becha") || q.includes("ventas") || q.includes("مبيعات")) {
    if (lang === "roman_urdu") {
      return [
        `**${ctx.business.name} ki Sales Report:**`,
        `• **Aaj Ki Sales:** ${fmt(ctx.sales.todayRevenue)} (${ctx.sales.todayTransactions} transactions)`,
        `• **Pichle 7 Din:** ${fmt(ctx.sales.weekRevenue)} (${ctx.sales.weekTransactions} transactions)`,
        `• **Pichle 30 Din:** ${fmt(ctx.sales.monthRevenue)} (${ctx.sales.monthTransactions} transactions)`,
        `• **Average Order Value:** ${fmt(ctx.sales.averageOrderValue)}`,
        `• **Total Lifetime Sales:** ${fmt(ctx.sales.totalRevenue)}`
      ].join("\n");
    }

    return [
      `### Sales & Revenue Summary for **${ctx.business.name}**`,
      `• **Today's Revenue:** **${fmt(ctx.sales.todayRevenue)}** (${ctx.sales.todayTransactions} order(s))`,
      `• **Last 7 Days Revenue:** **${fmt(ctx.sales.weekRevenue)}** (${ctx.sales.weekTransactions} orders)`,
      `• **Last 30 Days Revenue:** **${fmt(ctx.sales.monthRevenue)}** (${ctx.sales.monthTransactions} orders)`,
      `• **Average Order Value (AOV):** **${fmt(ctx.sales.averageOrderValue)}**`,
      `• **Total Revenue:** **${fmt(ctx.sales.totalRevenue)}** from ${ctx.sales.totalTransactions} completed transactions.`
    ].join("\n");
  }

  // 3. INVENTORY / STOCK / LOW STOCK / OUT OF STOCK QUERIES
  if (q.includes("stock") || q.includes("inventory") || q.includes("product") || q.includes("reorder") || q.includes("maal") || q.includes("kam") || q.includes("khatam") || q.includes("مخزون")) {
    const lowStockDetails = ctx.inventory.lowStockItems.length > 0
      ? ctx.inventory.lowStockItems.map((i) => `  - **${i.name}**: ${i.units} units remaining (alert at ${i.threshold})`).join("\n")
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
        `• **Expiring within 30 days:** ${ctx.inventory.expiringCount} items`,
        ``,
        `💡 *Next Step:* Purchases tab se restock order create karein.`
      ].join("\n");
    }

    return [
      `### Inventory & Stock Health for **${ctx.business.name}**`,
      `• **Total Active Catalog:** **${ctx.inventory.activeProducts} products** (${ctx.inventory.totalUnitsInStock} total units on shelves)`,
      `• **Inventory Valuation:** **${fmt(ctx.inventory.inventoryCostValue)}** (Cost) | **${fmt(ctx.inventory.inventoryRetailValue)}** (Retail)`,
      `• **Out of Stock:** **${ctx.inventory.outOfStockCount} products**`,
      oosDetails,
      `• **Low Stock Alerts (Threshold: ≤ ${ctx.business.stockAlertLimit} units):** **${ctx.inventory.lowStockCount} products**`,
      lowStockDetails,
      `• **Expiring soon (< 30 days):** **${ctx.inventory.expiringCount} products**`,
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
  if (lang === "roman_urdu") {
    return [
      `**${ctx.business.name} ka Executive Business Summary:**`,
      `• **Active Currency:** ${ctx.business.currency} | **Tax Rate:** ${ctx.business.taxRate}%`,
      `• **Aaj Ki Sales:** ${fmt(ctx.sales.todayRevenue)} (${ctx.sales.todayTransactions} sales) | **Munafa:** ${fmt(ctx.sales.todayProfit)}`,
      `• **Pichle 30 Din Ka Revenue:** ${fmt(ctx.sales.monthRevenue)} | **Net Profit:** ${fmt(ctx.sales.monthProfit)} (${ctx.sales.netProfitMargin.toFixed(1)}% margin)`,
      `• **Inventory Worth:** ${fmt(ctx.inventory.inventoryCostValue)} (${ctx.inventory.activeProducts} products, ${ctx.inventory.totalUnitsInStock} units)`,
      `• **Stock Status:** ${ctx.inventory.outOfStockCount} out-of-stock, ${ctx.inventory.lowStockCount} low stock alerts`,
      ``,
      `Aap mujh se sales, profit, stock, ya tax rate ke bare mein mazeed tafseelat pooch sakte hain!`
    ].join("\n");
  }

  if (lang === "urdu") {
    return [
      `**${ctx.business.name} کا کاروباری خلاصہ:**`,
      `• **کرنسی:** ${ctx.business.currency} | **ٹیکس کی شرح:** ${ctx.business.taxRate}%`,
      `• **آج کی فروخت:** ${fmt(ctx.sales.todayRevenue)} | **منافع:** ${fmt(ctx.sales.todayProfit)}`,
      `• **گزشتہ 30 دن کی فروخت:** ${fmt(ctx.sales.monthRevenue)} | **خالص منافع:** ${fmt(ctx.sales.monthProfit)} (${ctx.sales.netProfitMargin.toFixed(1)}%)`,
      `• **انوینٹری کی قیمت:** ${fmt(ctx.inventory.inventoryCostValue)} (${ctx.inventory.activeProducts} مصنوعات)`,
      `• **اسٹاک الرٹس:** ${ctx.inventory.lowStockCount} مصنوعات کم اسٹاک پر ہیں، ${ctx.inventory.outOfStockCount} ختم ہیں۔`
    ].join("\n");
  }

  return [
    `### Comprehensive Performance Summary for **${ctx.business.name}**`,
    `• **Resolved Configuration:** Currency: **${ctx.business.currency}** | Tax Rate: **${ctx.business.taxRate}%** | Stock Alert: **${ctx.business.stockAlertLimit} units**`,
    `• **Today's Performance:** **${fmt(ctx.sales.todayRevenue)}** revenue (${ctx.sales.todayTransactions} orders) generating **${fmt(ctx.sales.todayProfit)}** net profit.`,
    `• **Trailing 30 Days:** **${fmt(ctx.sales.monthRevenue)}** revenue with **${fmt(ctx.sales.monthProfit)}** net profit (**${ctx.sales.netProfitMargin.toFixed(1)}% margin**).`,
    `• **Inventory Valuation:** **${fmt(ctx.inventory.inventoryCostValue)}** cost value across **${ctx.inventory.activeProducts} active products** (${ctx.inventory.totalUnitsInStock} total units).`,
    `• **Stock Health Alerts:** **${ctx.inventory.outOfStockCount}** out-of-stock items, **${ctx.inventory.lowStockCount}** low-stock items, and **${ctx.inventory.expiringCount}** expiring items.`,
    ``,
    `Ask me specific questions on profit breakdown, top sellers, supplier purchase orders, or operational strategies!`
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
