import { supabase } from "@/integrations/supabase/client";
import { BusinessRow } from "@/hooks/useActiveBusiness";

export interface CategorySettings {
  id?: string;
  name?: string;
  industry_type?: string | null;
  currency?: string | null;
  default_tax?: number | null;
  stock_alert_limit?: number | null;
}

export interface PlatformSettingsState {
  base_currency?: string | null;
  universal_tax?: number | null;
  invoice_prefix?: string | null;
}

export interface UserSettingsMetadata {
  user_currency?: string | null;
  user_default_tax?: number | null;
  user_stock_alert_limit?: number | null;
  theme?: string | null;
  [key: string]: any;
}

export interface EffectiveBusinessSettings {
  currency: string;
  taxRate: number;
  stockAlertLimit: number;
  // Resolution source tracking
  currencySource: "business" | "user" | "category" | "platform";
  taxRateSource: "business" | "user" | "category" | "platform";
  stockAlertLimitSource: "business" | "user" | "category" | "platform";
  // Raw values
  businessCurrency?: string | null;
  userCurrency?: string | null;
  categoryDefaultCurrency?: string | null;
  platformDefaultCurrency?: string | null;
  businessTaxRate?: number | null;
  userTaxRate?: number | null;
  categoryDefaultTax?: number | null;
  platformDefaultTax?: number | null;
  businessStockAlertLimit?: number | null;
  userStockAlertLimit?: number | null;
  categoryDefaultStockAlert?: number | null;
}

const USER_SETTINGS_CACHE_PREFIX = "geflow_user_meta_";

/**
 * Cache user metadata in localStorage for instant synchronous reads on boot/render.
 */
export function getCachedUserMetadata(userId?: string | null): UserSettingsMetadata {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(`${USER_SETTINGS_CACHE_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setCachedUserMetadata(userId: string, meta: UserSettingsMetadata) {
  try {
    const existing = getCachedUserMetadata(userId);
    const updated = { ...existing, ...meta };
    localStorage.setItem(`${USER_SETTINGS_CACHE_PREFIX}${userId}`, JSON.stringify(updated));
  } catch (e) {
    console.debug("Failed to write user metadata cache", e);
  }
}

/**
 * Pure function to resolve effective settings following the 4-tier hierarchy:
 * 1. Business Setting Override (businesses table)
 * 2. User Setting Override (auth.users metadata & user cache)
 * 3. Admin Category Default (business_categories table)
 * 4. Platform Default (platform_settings / fallback)
 */
export function resolveSettingsHierarchy(params: {
  business?: Partial<BusinessRow> | null;
  userMeta?: UserSettingsMetadata | null;
  category?: CategorySettings | null;
  platformSettings?: PlatformSettingsState | null;
}): EffectiveBusinessSettings {
  const { business, userMeta, category, platformSettings } = params;

  const platformCurrency = (platformSettings?.base_currency || "USD").toUpperCase();
  const categoryCurrency = category?.currency ? category.currency.toUpperCase() : null;
  const userCurrency = userMeta?.user_currency ? userMeta.user_currency.toUpperCase() : null;
  const businessCurrency = business?.currency ? business.currency.toUpperCase() : (business?.base_currency ? business.base_currency.toUpperCase() : null);

  let effectiveCurrency = "USD";
  let currencySource: "business" | "user" | "category" | "platform" = "platform";

  if (businessCurrency) {
    effectiveCurrency = businessCurrency;
    currencySource = "business";
  } else if (userCurrency) {
    effectiveCurrency = userCurrency;
    currencySource = "user";
  } else if (categoryCurrency) {
    effectiveCurrency = categoryCurrency;
    currencySource = "category";
  } else {
    effectiveCurrency = platformCurrency;
    currencySource = "platform";
  }

  // Tax Rate Resolution
  const platformTax = Number(platformSettings?.universal_tax ?? 0);
  const categoryTax = category?.default_tax !== undefined && category?.default_tax !== null ? Number(category.default_tax) : null;
  const userTax = userMeta?.user_default_tax !== undefined && userMeta?.user_default_tax !== null ? Number(userMeta.user_default_tax) : null;
  const businessTax = business?.default_tax !== undefined && business?.default_tax !== null ? Number(business.default_tax) : null;

  let effectiveTaxRate = 0;
  let taxRateSource: "business" | "user" | "category" | "platform" = "platform";

  if (businessTax !== null) {
    effectiveTaxRate = businessTax;
    taxRateSource = "business";
  } else if (userTax !== null) {
    effectiveTaxRate = userTax;
    taxRateSource = "user";
  } else if (categoryTax !== null) {
    effectiveTaxRate = categoryTax;
    taxRateSource = "category";
  } else {
    effectiveTaxRate = platformTax;
    taxRateSource = "platform";
  }

  // Stock Alert Limit Resolution
  const categoryStockAlert = category?.stock_alert_limit !== undefined && category?.stock_alert_limit !== null ? Number(category.stock_alert_limit) : null;
  const userStockAlert = userMeta?.user_stock_alert_limit !== undefined && userMeta?.user_stock_alert_limit !== null ? Number(userMeta.user_stock_alert_limit) : null;
  const businessStockAlert = business?.stock_alert_limit !== undefined && business?.stock_alert_limit !== null ? Number(business.stock_alert_limit) : null;

  let effectiveStockAlertLimit = 10;
  let stockAlertLimitSource: "business" | "user" | "category" | "platform" = "platform";

  if (businessStockAlert !== null && businessStockAlert > 0) {
    effectiveStockAlertLimit = businessStockAlert;
    stockAlertLimitSource = "business";
  } else if (userStockAlert !== null && userStockAlert > 0) {
    effectiveStockAlertLimit = userStockAlert;
    stockAlertLimitSource = "user";
  } else if (categoryStockAlert !== null && categoryStockAlert > 0) {
    effectiveStockAlertLimit = categoryStockAlert;
    stockAlertLimitSource = "category";
  } else {
    effectiveStockAlertLimit = 10;
    stockAlertLimitSource = "platform";
  }

  return {
    currency: effectiveCurrency,
    taxRate: effectiveTaxRate,
    stockAlertLimit: effectiveStockAlertLimit,
    currencySource,
    taxRateSource,
    stockAlertLimitSource,
    businessCurrency,
    userCurrency,
    categoryDefaultCurrency: categoryCurrency,
    platformDefaultCurrency: platformCurrency,
    businessTaxRate: businessTax,
    userTaxRate: userTax,
    categoryDefaultTax: categoryTax,
    platformDefaultTax: platformTax,
    businessStockAlertLimit: businessStockAlert,
    userStockAlertLimit: userStockAlert,
    categoryDefaultStockAlert: categoryStockAlert,
  };
}

/**
 * Save user-level setting overrides to Supabase user metadata and local cache.
 */
export async function saveUserSettingsOverrides(overrides: UserSettingsMetadata) {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    setCachedUserMetadata(user.id, overrides);
    try {
      await supabase.auth.updateUser({
        data: {
          ...overrides,
        },
      });
    } catch (err) {
      console.warn("Failed to sync user metadata to Supabase auth:", err);
    }
  }

  // Dispatch global notifications so all components update immediately
  window.dispatchEvent(new CustomEvent("geflow:settings-changed", { detail: overrides }));
  window.dispatchEvent(new CustomEvent("geflow:currency-changed"));
}

/**
 * Save business-specific setting overrides to the Supabase `businesses` table.
 */
export async function saveBusinessSettingsOverrides(
  businessId: string,
  overrides: {
    business_name?: string;
    business_address?: string | null;
    currency?: string;
    base_currency?: string;
    default_tax?: number;
    stock_alert_limit?: number;
    category_id?: string | null;
    status?: string;
  }
) {
  const { data, error } = await supabase
    .from("businesses")
    .update({
      ...overrides,
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessId)
    .select()
    .single();

  if (error) throw error;

  window.dispatchEvent(new CustomEvent("geflow:business-updated", { detail: data }));
  window.dispatchEvent(new CustomEvent("geflow:business-changed", { detail: data }));
  window.dispatchEvent(new CustomEvent("geflow:currency-changed"));

  return data;
}
