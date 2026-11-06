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

/**
 * Ensures AI responses are structured in professional, scannable bullet points
 * rather than single paragraphs or walls of text.
 */
export function formatToProfessionalBullets(rawText: string): string {
  if (!rawText || !rawText.trim()) return "";
  const trimmed = rawText.trim();

  // If already contains bullet characters or numbered lists with newlines
  const hasStructuredBullets = /(?:^|\n)\s*[-*•]\s+|(?:^|\n)\s*\d+\.\s+/m.test(trimmed);
  if (hasStructuredBullets) {
    // Ensure proper newlines before bullets so markdown renders a true list
    return trimmed
      .replace(/([^\n])\n([-*•]\s+)/g, "$1\n\n$2")
      .replace(/([^\n])\n(\d+\.\s+)/g, "$1\n\n$2");
  }

  // Split into paragraphs
  const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  // If single paragraph, split into sentences
  if (paragraphs.length === 1) {
    const singlePara = paragraphs[0];
    const sentences = singlePara
      .split(/(?<=[.?!])\s+(?=[A-Z0-9#•-])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (sentences.length <= 1) {
      return `### ⚡ Executive Summary\n\n• **Core Insight**: ${singlePara}`;
    }

    const title = sentences[0];
    const bulletItems = sentences.slice(1).map((s) => {
      const colonMatch = s.match(/^([^:]{3,30}):\s*(.*)$/);
      if (colonMatch) {
        return `• **${colonMatch[1].trim()}**: ${colonMatch[2].trim()}`;
      }
      return `• **Detail**: ${s}`;
    });

    return [
      `### ⚡ Executive Analysis\n`,
      `**${title}**\n`,
      ...bulletItems,
    ].join("\n");
  }

  // Multi-paragraph text: convert paragraphs into distinct bullet points
  const header = paragraphs[0].length < 90 && !paragraphs[0].includes(":")
    ? `### ⚡ ${paragraphs[0]}\n\n`
    : "";
  
  const startIdx = header ? 1 : 0;
  const bulletItems = paragraphs.slice(startIdx).map((p) => {
    if (p.startsWith("•") || p.startsWith("-") || p.startsWith("*")) {
      return p;
    }
    const colonMatch = p.match(/^([^:]{3,30}):\s*(.*)$/);
    if (colonMatch) {
      return `• **${colonMatch[1].trim()}**: ${colonMatch[2].trim()}`;
    }
    return `• ${p}`;
  });

  return `${header}${bulletItems.join("\n\n")}`;
}

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

    // 1. Fetch business record & category with resilient fallbacks
    let biz: any = null;
    try {
      const { data } = await supabase
        .from("businesses")
        .select("*, business_categories(id, name, industry_type, currency, default_tax, stock_alert_limit)")
        .eq("id", businessId)
        .maybeSingle();
      biz = data;
    } catch {
      /* ignore */
    }

    if (!biz) {
      try {
        const { data } = await supabase
          .from("businesses")
          .select("*")
          .eq("id", businessId)
          .maybeSingle();
        biz = data;
      } catch {
        /* ignore */
      }
    }

    if (!biz) {
      biz = {
        id: businessId,
        business_name: "Active Store",
        currency: "USD",
        default_tax: 0,
        stock_alert_limit: 5,
        status: "active",
      };
    }

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
 * Detect language of user query (English, French, Hindi, Urdu, Roman Urdu, Arabic, Spanish, etc.)
 */
export function detectQueryLanguage(text: string): string {
  const t = text.trim().toLowerCase();

  // 1. Devanagari script (Hindi / Marathi / Sanskrit)
  if (/[\u0900-\u097F]/.test(t)) {
    return "hindi";
  }

  // 2. Chinese characters
  if (/[\u4E00-\u9FFF]/.test(t)) {
    return "chinese";
  }

  // 3. Perso-Arabic / Urdu script
  if (/[\u0600-\u06FF]/.test(t)) {
    // Check specific Arabic vocabulary
    const arabicSpecificWords = ["كيف", "مرحبا", "ارباح", "مبيعات", "متجر", "مخزون", "كم", "شكرا", "فاتورة", "تسجيل"];
    const isExplicitArabic = arabicSpecificWords.some((w) => t.includes(w));
    if (isExplicitArabic && !/[\u0679\u067E\u0686\u0688\u0691\u06BA\u06BE\u06C1\u06D2]/.test(t)) {
      return "arabic";
    }
    // Default to Urdu for Perso-Arabic in GeFlow workspace
    return "urdu";
  }

  // 4. French detection (Vocabulary, interrogatives, business terms, accents)
  const frenchMarkers = [
    "bonjour", "salut", "merci", "s'il vous plaît", "s'il vous plait", "svp",
    "comment", "pourquoi", "combien", "quel", "quelle", "quels", "quelles",
    "est-ce", "aidez", "aider", "aide", "ventes", "vente", "bénéfice", "bénéfices",
    "profit", "profits", "magasin", "boutique", "produit", "produits", "stock",
    "stocks", "caisse", "caissier", "facture", "prix", "argent", "chiffre d'affaires",
    "mon magasin", "mes ventes", "mon profit", "mon bénéfice", "notre magasin",
    "augmenter", "recette", "dépense", "coût", "trésorerie", "client", "clients"
  ];
  const hasFrenchMarker = frenchMarkers.some((m) => t.includes(m));
  const frenchAccents = /[éèêëàâäôöûüç]/i;
  const hasFrenchAccent = frenchAccents.test(t);
  const frenchWords = t.split(/[\s,?.!;:()]+/).filter(Boolean);
  const commonFrenchSmallWords = ["le", "la", "les", "un", "une", "des", "du", "de", "dans", "en", "pour", "avec", "est", "sont", "mon", "ma", "mes", "ce", "cette"];
  const matchedSmallFrench = frenchWords.filter((w) => commonFrenchSmallWords.includes(w)).length;

  if (hasFrenchMarker || (hasFrenchAccent && matchedSmallFrench >= 1) || matchedSmallFrench >= 3) {
    return "french";
  }

  // 5. Distinctive Roman Urdu markers that NEVER appear in valid English sentences
  const strongRomanUrduMarkers = [
    "mujhy", "mujhe", "mujy",
    "btao", "batao", "bataen", "batayein",
    "kesy", "kese", "kaise", "kaisay",
    "apni", "apna", "apne",
    "karobar", "karobaar",
    "bikri", "munafa", "munafah",
    "kamai", "bachat", "grahak",
    "barhana", "barhao", "barhaoon",
    "sale barha", "bikri barha", "apni sale", "kesy apni", "kese apni", "kaise apni",
    "udhar", "khata", "dukan", "dukaan"
  ];

  if (strongRomanUrduMarkers.some((marker) => t.includes(marker))) {
    return "roman_urdu";
  }

  // 6. Roman Hindi / Hinglish indicators
  const romanHindiMarkers = [
    "namaste", "namaskar", "dhanyawad", "dhanyavad", "shukriya",
    "meri bikri", "mera munafa", "mera profit", "kaise badhaye", "kaise badhayein",
    "aaj ki sale", "aaj ka munafa", "aaj kitna", "kitna hai", "kripya", "kripa",
    "madad karein", "madad karo", "paisa", "kamai", "dukaan me", "dukan me"
  ];
  if (romanHindiMarkers.some((m) => t.includes(m))) {
    return "hindi";
  }

  // 7. Broader Roman Urdu / Hindi shared words
  const broaderRomanUrduWords = [
    "kya", "kyun", "kyon", "kab", "kahan", "kidhar", "konsa", "konsi", "konse",
    "karna", "karein", "karo", "skta", "sakti", "sakte", "sakta",
    "hoon", "hain", "shukriya", "meherbani", "theek", "acha", "achi"
  ];
  const words = t.split(/[\s,?.!;:()]+/).filter(Boolean);
  const matchedUrduWords = words.filter((w) => broaderRomanUrduWords.includes(w)).length;
  if (matchedUrduWords >= 2) {
    return "roman_urdu";
  }

  // 8. Spanish heuristics
  const spanishMarkers = ["cómo", "como aumentar", "ventas", "ganancia", "beneficio", "tienda", "hola", "inventario", "cuanto", "cuánto", "ayuda", "por favor", "gracias"];
  if (spanishMarkers.some((m) => t.includes(m))) {
    return "spanish";
  }

  // 9. German heuristics
  const germanMarkers = ["wie", "umsatz", "gewinn", "geschäft", "hallo", "wieviel", "bitte", "danke"];
  if (germanMarkers.some((m) => t.includes(m))) {
    return "german";
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
  rawCtx: BusinessAnalyticsContext | null,
  planId: PlanId = "free",
  preferredCurrency?: string,
  selectedLanguage: string = "english"
): string {
  const defaultCurrency = preferredCurrency || "PKR";
  const ctx: BusinessAnalyticsContext = rawCtx || {
    business: {
      id: "store_default",
      name: "Workspace Store",
      currency: defaultCurrency,
      taxRate: 0,
      stockAlertLimit: 5,
      status: "active",
      categoryName: "Retail Store",
    },
    inventory: {
      totalProducts: 0,
      activeProducts: 0,
      outOfStockCount: 0,
      lowStockCount: 0,
      expiringCount: 0,
      expiring30Count: 0,
      expiring60Count: 0,
      totalUnitsInStock: 0,
      inventoryCostValue: 0,
      inventoryRetailValue: 0,
      estimatedGrossProfitMargin: 0,
      outOfStockItems: [],
      lowStockItems: [],
      expiringItems: [],
      expiring60Items: [],
    },
    sales: {
      todayRevenue: 0,
      todayProfit: 0,
      todayTransactions: 0,
      weekRevenue: 0,
      weekProfit: 0,
      weekTransactions: 0,
      monthRevenue: 0,
      monthProfit: 0,
      monthTransactions: 0,
      totalRevenue: 0,
      totalProfit: 0,
      totalTransactions: 0,
      averageOrderValue: 0,
      netProfitMargin: 0,
      topSellingItems: [],
      recentSales: [],
    },
    purchases: {
      totalPurchasesCount: 0,
      totalPurchasesCost: 0,
    },
  };

  const detected = detectQueryLanguage(query);
  // Determine effective response language:
  // 1. If user explicitly chose a language in dropdown (other than English and other than auto), respect it!
  // 2. Otherwise (default is English), if user writes in Roman Urdu, Urdu script, Arabic, Spanish, etc., match user's language!
  let lang = "english";
  const isExplicitLanguage =
    selectedLanguage && selectedLanguage !== "auto" && selectedLanguage !== "english";

  if (isExplicitLanguage) {
    lang = selectedLanguage;
  } else if (detected && detected !== "english" && detected !== "other") {
    lang = detected;
  } else {
    lang = "english";
  }
  const q = query.toLowerCase();
  const curr = ctx.business.currency;
  const fmt = (val: number) => formatCurrency(val, curr);

  // 0. PLAN MODE RESTRICTION CHECK
  if (!isModeAllowedForPlan(mode, planId)) {
    if (planId === "free") {
      if (lang === "roman_urdu") {
        return `🔒 **Model Restricted (Free Plan)**\n\n**${mode.toUpperCase()}** model sirf **Standard** aur **Premium** plans me dastiyab hai. Free plan par aap **Analyst** mode use kar sakte hain.\n\n*Agli barhi features ke liye apna plan upgrade kar sakte hain.*`;
      }
      return `🔒 **Model Restricted (Free Plan)**\n\nThe **${mode.toUpperCase()}** model is available on **Standard** and **Premium** plans. On the Free Plan, you have full access to **Analyst** mode with monthly business intelligence.\n\n*Upgrade your subscription to unlock this specialized AI model.*`;
    }
    if (planId === "standard" && (mode === "knowledge" || mode === "advisor")) {
      if (lang === "roman_urdu") {
        return `🔒 **Model Restricted (Standard Plan)**\n\nYeh model **Premium Plan** par available hai. Standard plan par aap **Analyst** aur **Operator** use kar sakte hain.`;
      }
      return `🔒 **Model Restricted (Standard Plan)**\n\nThe **${mode.toUpperCase()}** model is exclusive to the **Premium Plan**. On the Standard Plan, you have full access to **Analyst** and **Operator** modes.`;
    }
  }

  // 0.5. SALES INCREASE / HOW TO GROW STORE QUERY
  const isSalesIncreaseQuery =
    /increase.*sale/i.test(q) ||
    /boost.*sale/i.test(q) ||
    /grow.*sale/i.test(q) ||
    /grow.*business/i.test(q) ||
    /sell.*more/i.test(q) ||
    /sale.*increase/i.test(q) ||
    /kesy.*sale/i.test(q) ||
    /kaise.*sale/i.test(q) ||
    /kese.*sale/i.test(q) ||
    /sale.*barha/i.test(q) ||
    /bikri.*barha/i.test(q) ||
    /karobar.*barha/i.test(q) ||
    /grahak.*barha/i.test(q) ||
    /customers.*barha/i.test(q) ||
    q.includes("zyada bikri") ||
    q.includes("ziada bikri") ||
    q.includes("سیل بڑھا") ||
    q.includes("فروخت بڑھا") ||
    q.includes("گاہک بڑھا");

  const isCookingOrRestaurantQuery =
    q.includes("cook") ||
    q.includes("kitchen") ||
    q.includes("restaurant") ||
    q.includes("dish") ||
    q.includes("food") ||
    q.includes("on order") ||
    q.includes("made on order") ||
    q.includes("recipe") ||
    q.includes("pizza") ||
    q.includes("burger") ||
    q.includes("chef") ||
    q.includes("dine") ||
    q.includes("takeaway") ||
    q.includes("کھانا") ||
    q.includes("پکانا") ||
    q.includes("ریستوران") ||
    q.includes("طعام") ||
    q.includes("مطبخ");

  const isVarietyOrVariantsQuery =
    q.includes("variet") ||
    q.includes("variant") ||
    q.includes("variation") ||
    q.includes("variable") ||
    q.includes("size") ||
    q.includes("matrix") ||
    q.includes("small") ||
    q.includes("medium") ||
    q.includes("large") ||
    q.includes("رنگ") ||
    q.includes("سائز") ||
    q.includes("انواع");

  const isPermissionsOrStaffQuery =
    q.includes("permission") ||
    q.includes("role") ||
    q.includes("cashier") ||
    q.includes("staff") ||
    q.includes("employee") ||
    q.includes("invite") ||
    q.includes("manager") ||
    q.includes("access") ||
    q.includes("restrict") ||
    q.includes("pin") ||
    q.includes("صلاحيات") ||
    q.includes("موظف") ||
    q.includes("ملازم") ||
    q.includes("اجازت");

  const isPaymentGatewayQuery =
    q.includes("payment gateway") ||
    q.includes("gateway") ||
    q.includes("paypal") ||
    q.includes("stripe") ||
    q.includes("sync gateway") ||
    q.includes("بوابة دفع") ||
    q.includes("ادائیگی گیٹ وے");

  if (isCookingOrRestaurantQuery) {
    if (lang === "roman_urdu") {
      return [
        `### 🍳 GeFlow AI Agent: Live Cooking & Made-on-Order Management`,
        ``,
        `• **Made on Order Dish Tag**: Restaurant ya kitchen dishes (pizza, burger, fresh pasta) ko Product Dialog me 'Live Cooking / Made on Order Dish' switch se tag karein.`,
        `• **Stock Count Bypass**: Aisi dishes par opening stock ki pabandi nahi hoti aur system unhe kabhi '0 units' ya 'Out of Stock' mark nahi karta.`,
        `• **Direct POS Routing**: POS counter par cashier bina kisi stock blockage ke item punch kar sakta hai.`,
        `• **Food Costing**: Raw items (cheese, dough, meat) ko Purchases me log karein taake accurate dish margins calculate hon.`
      ].join("\n");
    }
    return [
      `### 🍳 GeFlow AI Agent: Live Cooking & Made-on-Order Kitchen Operations`,
      ``,
      `• **On-Demand Preparation**: Freshly prepared restaurant dishes (pizzas, burgers, handcrafted meals) bypass inventory opening counts and are never flagged as "0 Units / Out of Stock".`,
      `• **POS Counter Throughput**: Cashiers can add made-on-order dishes to cart instantly with a clear \`🍳 MADE ON ORDER\` badge and zero inventory locks.`,
      `• **Food Costing & Margin Control**: Log raw ingredient purchases (produce, meat, dairy) under Purchases & Expenses to calculate precise plate cost margins.`,
      `• **Kitchen Ticket Flow**: Order line items print or display directly with customer notes for kitchen prep.`
    ].join("\n");
  }

  if (isVarietyOrVariantsQuery) {
    if (lang === "roman_urdu") {
      return [
        `### 🏷️ GeFlow AI Agent: Product Varieties & Pricing Matrix`,
        ``,
        `• **Independent Variant Pricing**: Agar aapne Small, Medium, Large varieties par alag prices set ki hain to main base retail price add karne ki zaroorat nahi hoti.`,
        `• **Inventory Table Badges**: Har product ke aagay uski varieties ka count aur price range (e.g. ₨500 – ₨1,200) auto show hota hai.`,
        `• **POS Variety Selection Modal**: POS par click karne par dedicated search popup khulta hai jahan se exact variant select ki jati hai.`
      ].join("\n");
    }
    return [
      `### 🏷️ GeFlow AI Agent: Product Variations & Dynamic Pricing Matrices`,
      ``,
      `• **Individual Variety Pricing**: When variant prices are defined in the Variations Matrix (e.g. Small $12, Medium $18, Large $24), the system automatically validates them without requiring a base retail price.`,
      `• **Inventory Table Transparency**: Products with active variants display a clean \`{N} Varieties\` badge along with the dynamic price span (\`$12.00 – $24.00\`).`,
      `• **Interactive POS Variety Modal**: Clicking any variable product in POS launches a dedicated modal with live search, SKU inspection, and variant-specific pricing.`
    ].join("\n");
  }

  if (isPermissionsOrStaffQuery) {
    return [
      `### 👥 GeFlow AI Agent: Role-Based Access Control & Staff Security`,
      ``,
      `• **Cashier Permissions**: Cashiers are limited to POS checkout and receipts; cost prices and profit reports remain strictly protected.`,
      `• **Manager Overrides**: Managers can approve custom discounts and review active drawer shift sessions.`,
      `• **Session Balancing**: Cash counts at opening and closing ensure strict cash register reconciliation.`
    ].join("\n");
  }

  if (isPaymentGatewayQuery) {
    return [
      `### 💳 GeFlow AI Agent: Payment Gateways & PayPal Integration`,
      ``,
      `• **Verified Gateways**: PayPal is integrated for plan subscriptions and customer POS checkouts.`,
      `• **Synchronization**: Real-time webhook listeners continuously reconcile transaction status.`,
      `• **Multi-Tender POS**: Split tender across Cash, Card, QR, and Online Payment Gateways without counter delays.`
    ].join("\n");
  }

  if (isSalesIncreaseQuery) {
    if (lang === "roman_urdu") {
      return [
        `### 📈 Salam! Dukan Ki Sale aur Bikri Barhanay ke 5 Asaan aur Kaamyaab Tareeqay`,
        ``,
        `Aap apni dukan ki sale (bikri) bohot asani se barha sakte hain. Yeh 5 practical aur aasan tareeqay follow karein:`,
        ``,
        `• **1. Fast-Moving (Top Selling) Items Hamesha Full Rakhein**:`,
        `Jo cheezein aapki dukan par rozana sab se zyada bikti hain, unka stock kabhi khatam na hone dein. Jab customer ko hamesha uska man-pasand samaan milta hai to wo bar bar aata hai.`,
        ``,
        `• **2. Counter Display (Checkout / POS ke qareeb samaan)**:`,
        `Choti aur zaroori cheezein (jaise toffees, accessories, snacks, sachets) counter par bilkul samnay rakhein. Bill banwate waqt customer 1–2 cheezein extra khareed leta hai jis se bill ka total barh jata hai.`,
        ``,
        `• **3. Combo Deals aur Bundle Offers Banao**:`,
        `2 ya 3 milti-julti cheezon ka package bana kar halka sa discount dein (e.g., "Do khareedne par aik par 15% discount"). Customer aik cheez lene aata hai aur do le jata hai.`,
        ``,
        `• **4. Slow-Moving Stock par Chota Discount Dein**:`,
        `Jo samaan dukan me kaafi arsay se para hai aur bik nahi raha, us par 5% se 10% discount laga kar cash free karein aur us paisay se tezi se bikne wala naya stock layein.`,
        ``,
        `• **5. Regular Customers se WhatsApp Rabta**:`,
        `Apne purane grahakon ke numbers mehfooz karein aur jab bhi naya maal ya fresh stock aaye to unko WhatsApp par pyara sa message ya photo bhej kar itlaa dein.`,
        ``,
        `💡 **Aasan Mashwara**: GeFlow POS counter par item-level discount feature use karein taake regular grahak ko foran khush kar sakein!`
      ].join("\n");
    }

    if (lang === "urdu") {
      return [
        `### 📈 السلام علیکم! دکان کی فروخت اور سیل بڑھانے کے 5 آسان اور بہترین طریقے`,
        ``,
        `آپ اپنی دکان کی فروخت اور آمدن درج ذیل 5 آسان طریقوں پر عمل کر کے تیزی سے بڑھا سکتے ہیں:`,
        ``,
        `• **1. زیادہ بکنے والے پراڈکٹس کا اسٹاک ہمیشہ پورا رکھیں**:`,
        `جو اشیاء سب سے زیادہ فروخت ہوتی ہیں ان کا اسٹاک کبھی ختم نہ ہونے دیں۔ گاہک جب بھی آئے اسے اس کی مطلوبہ چیز ملنی چاہیے۔`,
        ``,
        `• **2. کاؤنٹر پر پرکشش اشیاء رکھیں (Impulse Items)**:`,
        `کاؤنٹر کے بالکل سامنے چھوٹی اور روزمرہ کی اشیاء رکھیں تاکہ گاہک بل بنواتے وقت مزید ایک دو چیزیں خرید لے۔`,
        ``,
        `• **3. بنڈل ڈیلز اور خصوصی پیشکشیں**:`,
        `دو یا تین ملتی جلتی اشیاء کا پیکج بنائیں اور تھوڑی رعایت دیں۔ اس سے گاہک ایک کے بجائے دو اشیاء خریدے گا۔`,
        ``,
        `• **4. سست رفتار مال پر چھوٹ دے کر کیش آزاد کریں**:`,
        `جو سامان کافی عرصے سے نہیں بک رہا اس پر رعایت دے کر فروخت کریں اور اس رقم سے تیز بکنے والا نیا مال لائیں۔`,
        ``,
        `• **5. مستقل گاہکوں سے رابطہ**:`,
        `اپنے پرانے گاہکوں کا فون نمبر محفوظ رکھیں اور نیا مال آنے پر انہیں واٹس ایپ پر مطلع کریں۔`,
        ``,
        `💡 **آسان مشورہ:** پی او ایس کاؤنٹر پر آئٹم ڈسکاؤنٹ کا فیچر استعمال کر کے اچھے گاہکوں کو رعایت دیں۔`
      ].join("\n");
    }

    if (lang === "spanish") {
      return [
        `### 📈 ¡Hola! 5 Formas Prácticas de Aumentar las Ventas de su Tienda`,
        ``,
        `Aumentar las ventas diarias y el ticket promedio es sencillo con estas 5 estrategias comprobadas:`,
        ``,
        `• **1. Mantenga Siempre Stock de los Productos Más Vendidos**:`,
        `Identifique sus artículos de mayor rotación y asegúrese de reponerlos antes de que se agoten.`,
        ``,
        `• **2. Productos de Impulso en el Mostrador de Pago**:`,
        `Coloque artículos pequeños y de alto margen junto al terminal POS para compras espontáneas.`,
        ``,
        `• **3. Cree Paquetes y Ofertas Combinadas**:`,
        `Empareje productos complementarios con un pequeño descuento para elevar el valor del pedido.`,
        ``,
        `• **4. Liquide el Inventario de Lento Movimiento**:`,
        `Aplique descuentos moderados a artículos estancados para liberar capital y reinvertir en novedades.`,
        ``,
        `• **5. Fidelice Clientes por WhatsApp**:`,
        `Envíe mensajes cordiales a sus clientes habituales cuando lleguen nuevos lotes o productos.`,
        ``,
        `💡 **Consejo Práctico**: ¡Use los descuentos por artículo en la pantalla POS para premiar a clientes fieles!`
      ].join("\n");
    }

    if (lang === "arabic") {
      return [
        `### 📈 أهلاً بك! 5 طرق عملية لزيادة مبيعات وأرباح متجرك`,
        ``,
        `يمكنك زيادة مبيعاتك اليومية وحجم السلة بسهولة من خلال اتباع هذه الخطوات الـ 5 البسيطة:`,
        ``,
        `• **1. توفير المنتجات الأكثر مبيعاً دائماً**:`,
        `احرص على ألا ينفد مخزون السلع الأكثر طلباً في متجرك لضمان تلبية طلبات الزبائن دائماً.`,
        ``,
        `• **2. عروض المنتجات بجانب كاونتر ونقاط البيع (POS)**:`,
        `ضع السلع الصغيرة ذات الهامش الربحي المرتفع بجوار الكاشير لزيادة المبيعات التلقائية.`,
        ``,
        `• **3. عروض الحزم والخصومات المجمعة**:`,
        `اصنع باقات تجمع بين منتجين معاً بتخفيض بسيط لتشجيع العميل على شراء أكثر من قطعة.`,
        ``,
        `• **4. تصريف البضائع بطيئة الحركة**:`,
        `قدّم تخفيضات مناسبة على البضائع الراكدة لتحرير السيولة وإعادة استثمارها في بضائع سريعة.`,
        ``,
        `• **5. التواصل مع الزبائن الدائمين عبر واتساب**:`,
        `أرسل تنبيهات لطيفة لزبائنك عند وصول بضائع جديدة أو عروض مميزة.`,
        ``,
        `💡 **نصيحة سريعة**: استخدم خاصية الخصم على مستوى الصنف في شاشة POS لمكافأة زبائنك الدائمين!`
      ].join("\n");
    }

    if (lang === "french") {
      return [
        `### 📈 Bonjour ! 5 Stratégies Pratiques pour Augmenter les Ventes de Votre Magasin`,
        ``,
        `Développer vos ventes quotidiennes est accessible grâce à ces 5 méthodes simples et éprouvées :`,
        ``,
        `• **1. Gardez vos Meilleures Ventes Toujours en Stock**:`,
        `Ne laissez jamais vos articles phares tomber en rupture pour satisfaire chaque client.`,
        ``,
        `• **2. Présentation d'Articles Coup de Cœur en Caisse**:`,
        `Placez des accessoires ou petits articles à forte marge près du terminal POS.`,
        ``,
        `• **3. Offres Groupées et Packs Avantageux**:`,
        `Associez deux produits complémentaires avec une légère réduction pour augmenter le panier moyen.`,
        ``,
        `• **4. Déstockez les Produits à Rotation Lente**:`,
        `Appliquez une remise ciblée sur les articles dormants pour libérer de la trésorerie.`,
        ``,
        `• **5. Contactez vos Clients Réguliers via WhatsApp**:`,
        `Prévenez vos fidèles clients dès la réception de nouveaux arrivages ou promotions.`,
        ``,
        `💡 **Astuce Pro**: Utilisez la remise par article directement sur le terminal POS pour fidéliser !`
      ].join("\n");
    }

    if (lang === "german") {
      return [
        `### 📈 Hallo! 5 Praktische Tipps zur Steigerung Ihres Ladenumsatzes`,
        ``,
        `Steigern Sie Ihren täglichen Verkauf und Warenkorb mit diesen 5 bewährten Schritten:`,
        ``,
        `• **1. Bestseller Stets Vorrätig Halten**:`,
        `Vermeiden Sie Lieferengpässe bei Ihren meistverkauften Artikeln.`,
        ``,
        `• **2. Spontankäufe am Kassenbereich Fördern**:`,
        `Platzieren Sie margenstarke Kleinartikel direkt am POS-Terminal.`,
        ``,
        `• **3. Paketangebote und Bundles Schnüren**:`,
        `Kombinieren Sie passende Produkte mit einem kleinen Rabatt für höhere Umsätze pro Kunde.`,
        ``,
        `• **4. Langsamdreher Gezielt Abverkaufen**:`,
        `Geben Sie Rabatte auf Altbestände, um gebundenes Kapital für neue Schnelldreher freizusetzen.`,
        ``,
        `• **5. Stammkunden per WhatsApp Informieren**:`,
        `Informieren Sie Stammkunden freundlich über neue Wareneingänge.`,
        ``,
        `💡 **Praxistipp**: Nutzen Sie Positionsrabatte direkt in der POS-Kasse für zufriedene Kunden!`
      ].join("\n");
    }

    return [
      `### 📈 5 Practical Ways to Increase Your Store Sales & Revenue`,
      ``,
      `Hello! Growing your daily retail sales and basket size is straightforward with these 5 proven, practical strategies:`,
      ``,
      `• **1. Keep Fast-Moving Items Consistently in Stock**:`,
      `Identify your top 20% best-selling products and ensure they are reordered before stock runs low. Never turn away a ready buyer due to an out-of-stock item.`,
      ``,
      `• **2. Upsell at the Checkout Counter**:`,
      `Place high-margin impulse items (accessories, pocket snacks, essentials) right by your POS counter so shoppers can easily add them to their basket during checkout.`,
      ``,
      `• **3. Create Bundle Offers & Combo Deals**:`,
      `Pair complementary products together (e.g. "Buy Product A and get 15% off Product B"). Customers perceive high value and your Average Order Value (AOV) increases immediately.`,
      ``,
      `• **4. Clear Slow-Moving Inventory**:`,
      `Run quick clearance discounts on dead or slow stock to recover tied-up capital, then reinvest the cash into fast-selling seasonal products.`,
      ``,
      `• **5. Engage Regular Shoppers via WhatsApp**:`,
      `Keep a contact list of your frequent customers. Send brief, friendly alerts whenever fresh stock or new arrivals arrive at your store.`,
      ``,
      `💡 **Pro Tip**: Use GeFlow POS quick item discounts to reward loyal shoppers directly at checkout!`
    ].join("\n");
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
      if (lang === "roman_urdu") {
        return [
          `👋 **Salam! ${ctx.business.name} ka Monthly Munafa:**`,
          `• **Pichle 30 Din Ka Saaf Munafa:** ${fmt(ctx.sales.monthProfit)} (Total Bikri: ${fmt(ctx.sales.monthRevenue)})`,
          `• **Munafay Ki Sharah (Margin):** ${ctx.sales.netProfitMargin.toFixed(1)}%`,
          `• **Grahak / Orders:** ${ctx.sales.monthTransactions} orders mukammal huay`,
          ``,
          `💡 **Aasan Tip:** Rozana aur weekly hisab ke liye Standard ya Premium plan upgrade kar sakte hain.`
        ].join("\n");
      }
      if (lang === "urdu") {
        return [
          `👋 **السلام علیکم! ${ctx.business.name} کا ماہانہ منافع:**`,
          `• **پچھلے 30 دن کا خالص منافع:** ${fmt(ctx.sales.monthProfit)} (کل فروخت: ${fmt(ctx.sales.monthRevenue)})`,
          `• **منافع کی شرح:** ${ctx.sales.netProfitMargin.toFixed(1)}%`,
          `• **کل آرڈرز:** ${ctx.sales.monthTransactions} مکمل ہوئے`,
          ``,
          `💡 **آسان مشورہ:** زیادہ بکنے والی چیزوں کا اسٹاک ہمیشہ تیار رکھیں۔`
        ].join("\n");
      }
      return [
        `👋 **Hello! Here is your 30-day profit summary for ${ctx.business.name}:**`,
        `• **Last 30 Days Clear Profit:** ${fmt(ctx.sales.monthProfit)} from ${fmt(ctx.sales.monthRevenue)} in sales`,
        `• **Net Profit Margin:** ${ctx.sales.netProfitMargin.toFixed(1)}%`,
        `• **Total Orders Completed:** ${ctx.sales.monthTransactions} orders`,
        `• **Average Order Value:** ${fmt(ctx.sales.averageOrderValue)} per customer`,
        ``,
        `💡 **Friendly Tip:** Keep popular items in stock to help sales grow easily.`
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

  // 4.5. LIVE GEFLOW SYSTEM KNOWLEDGE & IDENTITY
  if (q.includes("maryam") || q.includes("who are you") || q.includes("kaun ho") || q.includes("ap kaun") || q.includes("introduce") || q.includes("what can you do")) {
    if (lang === "roman_urdu") {
      return [
        `### ⚡ GeFlow Business AI Agent: Executive System Intelligence`,
        `Main aapke active store (**${ctx.business.name}**) ka autonomous enterprise business agent hoon. Mera kaam aapke real-time sales ledger, live profits, POS cashier rules, aur inventory controls ko analyze kar ke solid business decisions aur actions lena hai.`,
        ``,
        `• **Financial & Profit Intelligence**: Real-time gross & net profit margins, today's sales velocity (${fmt(ctx.sales.todayRevenue)}), aur monthly cash balance.`,
        `• **Inventory & Made-on-Order Engine**: Low-stock items (${ctx.inventory.lowStockCount} alerts), auto-SKU, live kitchen cooking bypass, aur variant price matrix.`,
        `• **POS Terminal Operations**: Barcode scan, split tender, customer Khata / Udhar management, aur thermal receipt formatting.`,
        `• **RBAC Staff Permissions**: Cashier vs Manager controls aur PayPal gateway transactions.`
      ].join("\n");
    }
    return [
      `### ⚡ GeFlow Business AI Agent: Executive Operations Intelligence`,
      `I am the autonomous GeFlow Business AI Agent for **${ctx.business.name}**. Rather than a basic conversational chatbot, I operate as an executive decision engine grounded in your live store metrics, backend policies, and operational workflows.`,
      ``,
      `• **Real-Time Financial Diagnostics**: Live sales velocity (${fmt(ctx.sales.todayRevenue)} today / ${fmt(ctx.sales.monthRevenue)} monthly), net margins (${ctx.sales.netProfitMargin.toFixed(1)}%), and multi-currency accounting.`,
      `• **Inventory & Kitchen Engine**: Threshold alerts (${ctx.inventory.lowStockCount} items), batch expiry watchlist, auto SKU generation, and made-on-order dish routing.`,
      `• **POS & Counter Flow**: Fast barcode lookup, split payments, customer store credit / Udhar balances, and ESC/POS thermal printing.`,
      `• **Access Control & Multi-Store**: Granular staff permissions (Cashier vs Manager vs Admin) and automated multi-location sync.`
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

  // Plan Renewal or Billing Cycle Query
  const isPlanRenewal =
    q.includes("expir") ||
    q.includes("renew") ||
    q.includes("after expiry") ||
    q.includes("monthly or yearly") ||
    q.includes("yearly or monthly") ||
    q.includes("pay as monthly") ||
    q.includes("pay as yearly") ||
    q.includes("billing cycle") ||
    q.includes("auto-renew") ||
    q.includes("cycle") ||
    q.includes("khatam hone") ||
    q.includes("tajdeed") ||
    q.includes("تجديد") ||
    q.includes("انتهاء");

  if (isPlanRenewal) {
    if (lang === "roman_urdu") {
      return [
        `### 🔄 GeFlow AI Agent: Plan Renewal & Billing Cycle Rules`,
        `Aapke subscription plan ke renewal aur billing cycle ka rule bilkul clear hai:`,
        ``,
        `• **Same Cycle Auto-Renewal**: Agar aapka plan Yearly hai, to expiry par woh automatically **Yearly plan** ke tor par hi renew hoga (discounted annual rate ke sath).`,
        `• **Cycle Switch Option**: Expiry se pehle aap chahein to apna cycle **Yearly se Monthly** ya vice versa tabdeel kar sakte hain (**Subscription > Manage Cycle** se).`,
        `• **Guaranteed Preservation**: Agar aap koi tabdeeli nahi karte to aapka same Yearly plan seamlessly jari rahega, koi unexpected plan change ya interruption nahi aayegi.`,
        ``,
        `💡 **Customer Guidance**: Expiry date aur billing cycle check karne ke liye **Subscription** page par jayein.`
      ].join("\n");
    }

    if (lang === "urdu") {
      return [
        `### 🔄 تجدید اور بلنگ سائیکل کے قواعد`,
        `آپ کے سبسکرپشن پلان کی تجدید کا طریقہ کار انتہائی واضح اور شفاف ہے:`,
        ``,
        `• **اسی پلان کی تجدید:** اگر آپ کا پلان سالانہ (Yearly) ہے، تو مدت ختم ہونے پر یہ خودکار طور پر سالانہ پلان کے تحت ہی تجدید ہوگا تاکہ آپ کو ڈسکاؤنٹ ریٹ ملتا رہے۔`,
        `• **سائیکل تبدیل کرنے کی سہولت:** ختم ہونے سے قبل آپ جب چاہیں سالانہ سے ماہانہ یا ماہانہ سے سالانہ سائیکل تبدیل کر سکتے ہیں۔`,
        `• **بغیر کسی رکاوٹ کے تسلسل:** اگر آپ کوئی تبدیلی نہیں کرتے تو آپ کا موجودہ سالانہ پلان ہی جاری رہے گا اور سسٹم میں کوئی رکاوٹ نہیں آئے گی۔`,
        ``,
        `💡 **رہنمائی:** اپنے پلان کی تفصیلات کے لیے یوزر پینل میں **سبسکرپشن** پیج وزٹ کریں۔`
      ].join("\n");
    }

    return [
      `### 🔄 GeFlow AI Agent: Plan Renewal & Billing Cycle Architecture`,
      `Clear answers regarding your subscription renewal and billing cycles:`,
      ``,
      `• **Same-Cycle Auto-Renewal**: If your subscription is on a **Yearly plan**, it automatically renews as **Yearly** upon expiry at the discounted annual rate. You will not be randomly switched to a monthly rate.`,
      `• **Flexible Cycle Switch**: Before your renewal date, you can easily change your upcoming billing cadence from **Yearly to Monthly** (or vice versa) under **Subscription > Manage Plan & Cycle**.`,
      `• **Guaranteed Preservation**: If you make no changes, your plan seamlessly continues with the exact same Yearly terms with zero interruption to your store POS, inventory, or AI agent operations.`,
      ``,
      `💡 **Customer Guidance**: View your renewal countdown, invoice history, and billing cadence at any time under **Subscription** in your navigation menu.`
    ].join("\n");
  }

  // Pricing Plan Tiers Query
  if (q.includes("pricing") || (q.includes("plan") && !q.includes("product") && !q.includes("action")) || q.includes("subscription tier") || q.includes("standard plan") || q.includes("premium plan") || q.includes("lifetime plan")) {
    if (lang === "roman_urdu") {
      return [
        `### 🌟 GeFlow AI Agent: Subscription Plans & Capabilities Overview`,
        `GeFlow business subscription tiers aur feature details:`,
        ``,
        `• **Free Tier**: 1 Business/Store, Analyst AI intelligence model, basic sales reporting, aur POS checkout.`,
        `• **Standard Plan**: Up to 3 Businesses/Stores, Analyst + Operator AI models, 10 active chat histories, aur weekly deep audits.`,
        `• **Premium Plan**: Up to 7 Businesses/Stores, tamam 4 AI models (Analyst, Operator, Knowledge, Advisor), 20 chat histories, daily VIP audits, aur priority synchronization.`,
        `• **Lifetime Plan**: Unlimited chat sessions, up to 10 Businesses/Stores, VIP perpetual access, aur priority roadmap features.`,
        ``,
        `💡 **Customer Guidance**: Apna plan check ya upgrade karne ke liye navigation se **Subscription** page open karein.`
      ].join("\n");
    }

    return [
      `### 🌟 GeFlow AI Agent: Subscription Tiers & Feature Comparison`,
      `GeFlow subscription plans designed for independent businesses and growing retail chains:`,
      ``,
      `• **Free Tier**: 1 Business / Store location, Analyst AI intelligence model (2 active chats), basic sales reporting, and counter POS checkout.`,
      `• **Standard Plan**: Up to 3 Stores, Analyst + Operator AI models, 10 active chat sessions, and weekly deep business performance reports.`,
      `• **Premium Plan**: Up to 7 Stores, full unlock of all 4 AI models (Analyst, Operator, Knowledge Base, Executive Advisor), 20 chat sessions, daily VIP business audits, and multi-tender split payments.`,
      `• **Lifetime Plan**: Unlimited chat sessions, up to 10 Stores, perpetual access, VIP direct support, and all future AI roadmap releases.`,
      ``,
      `💡 **Customer Guidance**: To compare options, upgrade, or switch cycles, navigate to the **Subscription** page in your user panel.`
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
      : "No detailed item sale logs recorded yet for this period.";

    if (lang === "roman_urdu") {
      return [
        `### 🏆 Top Performing Products for ${ctx.business.name}`,
        topList,
        ``,
        `• **Action Item**: Top items ka buffer stock hamesha safe level par rakhein taake peak hours me stock out na ho.`
      ].join("\n");
    }

    return [
      `### 🏆 Top Performing Products for **${ctx.business.name}**`,
      topList,
      ``,
      `• **Action Item**: Maintain ample safety stock on high-velocity items to maximize throughput and counter conversion.`
    ].join("\n");
  }

  // 6. ADAPTIVE BUSINESS AUDIT & TARGETED RESOLUTION
  if (lang === "french") {
    return [
      `### ⚡ GeFlow AI Agent: Audit Opérationnel Exécutif pour **${ctx.business.name}**`,
      `• **Profil du Magasin**: Établissement: **${ctx.business.name}** | Devise: **${ctx.business.currency}** | Taux de Taxe: **${ctx.business.taxRate}%** | Alerte Stock: **${ctx.business.stockAlertLimit} unités**`,
      `• **Performance Financière**: Ventes du Jour: **${fmt(ctx.sales.todayRevenue)}** (${ctx.sales.todayTransactions} commandes) | Bénéfice Net du Jour: **${fmt(ctx.sales.todayProfit)}** | Ventes 30 Jours: **${fmt(ctx.sales.monthRevenue)}** (${fmt(ctx.sales.monthProfit)} de profit, marge de **${ctx.sales.netProfitMargin.toFixed(1)}%**)`,
      `• **État du Stock**: **${ctx.inventory.activeProducts} produits actifs** au catalogue (${ctx.inventory.totalUnitsInStock} unités). Valorisation au Coût: **${fmt(ctx.inventory.inventoryCostValue)}** | **${ctx.inventory.lowStockCount} articles** sous le seuil d'alerte`,
      `• **Directives Opérationnelles**: Les plats préparés à la commande fonctionnent sans blocage de stock, les matrices de variantes gèrent les prix par taille et la caisse POS gère les paiements fractionnés.`,
      `• **Recommandation**: Posez toute question spécifique sur les marges, stocks, caisse, recettes ou gestion des employés pour un guidage instantané.`
    ].join("\n");
  }

  if (lang === "urdu") {
    return [
      `### ⚡ GeFlow AI Agent: کاروباری آڈٹ برائے **${ctx.business.name}**`,
      `• **اسٹور تفصیلات**: ادارہ: **${ctx.business.name}** | کرنسی: **${ctx.business.currency}** | ٹیکس کی شرح: **${ctx.business.taxRate}%** | اسٹاک الرٹ: **${ctx.business.stockAlertLimit} اشیاء**`,
      `• **مالیاتی کارکردگی**: آج کی فروخت: **${fmt(ctx.sales.todayRevenue)}** (${ctx.sales.todayTransactions} آرڈرز) | آج کا خالص منافع: **${fmt(ctx.sales.todayProfit)}** | 30 دن کی فروخت: **${fmt(ctx.sales.monthRevenue)}** (${fmt(ctx.sales.monthProfit)} منافع، **${ctx.sales.netProfitMargin.toFixed(1)}% مارجن**)`,
      `• **اسٹاک کی صورتحال**: **${ctx.inventory.activeProducts} فعال پراڈکٹس** کیٹلاگ میں موجود ہیں (${ctx.inventory.totalUnitsInStock} کل یونٹس)۔ لاگت ویلیو: **${fmt(ctx.inventory.inventoryCostValue)}** | **${ctx.inventory.lowStockCount} اشیاء** کا اسٹاک کم ہے۔`,
      `• **سسٹم کنٹرول**: آرڈر پر تیار ہونے والی ڈشز بغیر اسٹاک رکاوٹ کے چلتی ہیں، ورائٹیز میٹرکس لاگو ہے اور پی او ایس مکمل فعال ہے۔`,
      `• **رہنمائی**: انوینٹری، منافع، کاؤنٹر آپریشنز یا عملے کی اجازتوں کے بارے میں کوئی بھی مخصوص سوال پوچھ سکتے ہیں۔`
    ].join("\n");
  }

  if (lang === "hindi") {
    return [
      `### ⚡ GeFlow AI Agent: कार्यकारी व्यवसाय ऑडिट रिपोर्ट - **${ctx.business.name}**`,
      `• **स्टोर प्रोफाइल**: प्रतिष्ठान: **${ctx.business.name}** | मुद्रा: **${ctx.business.currency}** | टैक्स दर: **${ctx.business.taxRate}%** | स्टॉक अलर्ट सीमा: **${ctx.business.stockAlertLimit} यूनिट्स**`,
      `• **वित्तीय प्रदर्शन**: आज की बिक्री: **${fmt(ctx.sales.todayRevenue)}** (${ctx.sales.todayTransactions} ऑर्डर्स) | आज का शुद्ध मुनाफा: **${fmt(ctx.sales.todayProfit)}** | 30 दिनों की कुल बिक्री: **${fmt(ctx.sales.monthRevenue)}** (${fmt(ctx.sales.monthProfit)} मुनाफा, **${ctx.sales.netProfitMargin.toFixed(1)}% मार्जिन**)`,
      `• **इन्वेंटरी स्थिति**: कैटलॉग में **${ctx.inventory.activeProducts} सक्रिय उत्पाद** हैं (${ctx.inventory.totalUnitsInStock} कुल इकाइयाँ)। लागत मूल्य: **${fmt(ctx.inventory.inventoryCostValue)}** | **${ctx.inventory.lowStockCount} उत्पाद** न्यूनतम स्तर से नीचे हैं।`,
      `• **परिचालन नियंत्रण**: ऑर्डर पर तैयार होने वाले व्यंजन बिना स्टॉक बाधा के चलते हैं, वैरायटी प्राइसिंग मैट्रिक्स सक्रिय है और पीओएस काउंटर सुचारू रूप से कार्य कर रहा है।`,
      `• **निर्देश**: मुनाफे, स्टॉक, रसीद प्रिंटिंग, कर्मचारियों की अनुमति या डिस्काउंट से संबंधित कोई भी विशिष्ट प्रश्न पूछें।`
    ].join("\n");
  }

  if (lang === "roman_urdu") {
    return [
      `### ⚡ GeFlow AI Agent: Executive Operations Audit for **${ctx.business.name}**`,
      `• **Active Store Profile**: Currency: **${ctx.business.currency}** | Tax Rate: **${ctx.business.taxRate}%** | Stock Alert Limit: **${ctx.business.stockAlertLimit} units**`,
      `• **Financial Performance**: Today's Sales: **${fmt(ctx.sales.todayRevenue)}** (${ctx.sales.todayTransactions} orders) | Today's Net Profit: **${fmt(ctx.sales.todayProfit)}** | 30-Day Sales: **${fmt(ctx.sales.monthRevenue)}** (${fmt(ctx.sales.monthProfit)} profit, ${ctx.sales.netProfitMargin.toFixed(1)}% margin)`,
      `• **Inventory Health**: **${ctx.inventory.activeProducts} active products** in catalog (${ctx.inventory.totalUnitsInStock} total units). Cost Valuation: **${fmt(ctx.inventory.inventoryCostValue)}** | **${ctx.inventory.lowStockCount} items** need reordering`,
      `• **System Rules & Operations**: Live cooking dishes bypass stock blockage, variety pricing matrix handles independent size prices, and POS terminal supports multi-tender split payments.`,
      `• **Agent Directive**: Agar aap kisi specific item, discount setting, receipt print, ya staff permission ke baray me jan-na chahte hain to foran poochiye.`
    ].join("\n");
  }

  return [
    `### ⚡ GeFlow AI Agent: Executive Operations Audit for **${ctx.business.name}**`,
    `• **Active Store Profile**: Organization: **${ctx.business.name}** | Currency: **${ctx.business.currency}** | Tax Rate: **${ctx.business.taxRate}%** | Stock Alert: **${ctx.business.stockAlertLimit} units**`,
    `• **Financial Performance**: Today's Revenue: **${fmt(ctx.sales.todayRevenue)}** (${ctx.sales.todayTransactions} orders) | Today's Net Profit: **${fmt(ctx.sales.todayProfit)}** | 30-Day Revenue: **${fmt(ctx.sales.monthRevenue)}** (${fmt(ctx.sales.monthProfit)} net profit, **${ctx.sales.netProfitMargin.toFixed(1)}% margin**)`,
    `• **Inventory Valuation & Health**: **${ctx.inventory.activeProducts} active products** in catalog (${ctx.inventory.totalUnitsInStock} shelf units). Cost Valuation: **${fmt(ctx.inventory.inventoryCostValue)}** | Retail Worth: **${fmt(ctx.inventory.inventoryRetailValue)}** | **${ctx.inventory.lowStockCount} items** below safety threshold`,
    `• **Operational Controls**: Made-on-order dishes (kitchen prep) run without stock locks, product variety matrices apply independent prices, and POS cashier splits are active.`,
    `• **Agent Directive**: Ask any specific question regarding margins, menu costing, cashier drawer balancing, receipt templates, or product variants for instant precision guidance.`
  ].join("\n");
}

/**
 * Storage helpers for AI Assistant conversations in Supabase / User Cache.
 */
export interface AIChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AIChatMessage[];
  mode: AIMode;
  businessId?: string;
}

export const PLAN_CHAT_LIMITS: Record<PlanId, number> = {
  free: 2,
  standard: 10,
  premium: 20,
  lifetime: Infinity,
};

export function getPlanChatLimit(planId: PlanId = "free"): number {
  return PLAN_CHAT_LIMITS[planId] ?? 2;
}

const SESSIONS_CACHE_PREFIX = "geflow_ai_sessions_";
const CONV_CACHE_PREFIX = "geflow_ai_conv_";

export function loadStoredAISessions(businessId?: string | null, userId?: string | null): AIChatSession[] {
  const key = `${SESSIONS_CACHE_PREFIX}${businessId || "global"}_${userId || "anon"}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.debug("Failed to read stored AI sessions:", e);
  }

  // Fallback: check if legacy single conversation exists and migrate it
  const legacy = loadStoredAIConversation(businessId, userId);
  if (legacy && legacy.length > 0) {
    const migrated: AIChatSession = {
      id: `session_${Date.now()}`,
      title: legacy.find((m) => m.role === "user")?.content.slice(0, 32) || "Business Intelligence Chat",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: legacy,
      mode: "analyst",
      businessId: businessId || undefined,
    };
    saveStoredAISessions([migrated], businessId, userId);
    return [migrated];
  }

  return [];
}

export function saveStoredAISessions(
  sessions: AIChatSession[],
  businessId?: string | null,
  userId?: string | null
): void {
  const key = `${SESSIONS_CACHE_PREFIX}${businessId || "global"}_${userId || "anon"}`;
  try {
    localStorage.setItem(key, JSON.stringify(sessions));
  } catch (e) {
    console.debug("Failed to persist AI sessions:", e);
  }
}

export function createNewAISession(
  title?: string,
  mode: AIMode = "analyst",
  businessId?: string | null
): AIChatSession {
  return {
    id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: title || "New Business Query",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    mode,
    businessId: businessId || undefined,
  };
}

export function deleteStoredAISession(
  sessionId: string,
  businessId?: string | null,
  userId?: string | null
): AIChatSession[] {
  const sessions = loadStoredAISessions(businessId, userId);
  const remaining = sessions.filter((s) => s.id !== sessionId);
  saveStoredAISessions(remaining, businessId, userId);
  return remaining;
}

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
  } catch (e) {
    console.debug("Failed to store AI conversation:", e);
  }
}
