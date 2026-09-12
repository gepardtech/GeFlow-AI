import { supabase } from "@/integrations/supabase/client";

export type PaymentMethodType = "cash" | "card" | "wallet" | "digital" | "bank" | "credit";

export interface BusinessPaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  iconName?: string;
  enabled: boolean;
  isDefault?: boolean;
  accountDetails?: string;
  sortOrder: number;
}

export const COUNTRY_DEFAULT_PAYMENT_METHODS: Record<
  string,
  Array<{ id: string; name: string; type: PaymentMethodType; iconName: string }>
> = {
  pakistan: [
    { id: "cash", name: "Cash", type: "cash", iconName: "Banknote" },
    { id: "card", name: "Debit / Credit Card", type: "card", iconName: "CreditCard" },
    { id: "jazzcash", name: "JazzCash", type: "wallet", iconName: "Smartphone" },
    { id: "easypaisa", name: "Easypaisa", type: "wallet", iconName: "Smartphone" },
    { id: "bank_transfer", name: "Bank Transfer", type: "bank", iconName: "Building2" },
    { id: "credit", name: "Store Credit / Udhar", type: "credit", iconName: "FileText" },
  ],
  india: [
    { id: "cash", name: "Cash", type: "cash", iconName: "Banknote" },
    { id: "card", name: "Debit / Credit Card", type: "card", iconName: "CreditCard" },
    { id: "upi", name: "UPI QR / VPA", type: "digital", iconName: "QrCode" },
    { id: "paytm", name: "Paytm", type: "wallet", iconName: "Smartphone" },
    { id: "phonepe", name: "PhonePe / GPay", type: "wallet", iconName: "Smartphone" },
    { id: "bank_transfer", name: "Bank Transfer (NEFT/IMPS)", type: "bank", iconName: "Building2" },
    { id: "credit", name: "Khata / Store Credit", type: "credit", iconName: "FileText" },
  ],
  uae: [
    { id: "cash", name: "Cash", type: "cash", iconName: "Banknote" },
    { id: "card", name: "Debit / Credit Card", type: "card", iconName: "CreditCard" },
    { id: "apple_pay", name: "Apple Pay", type: "digital", iconName: "Smartphone" },
    { id: "bank_transfer", name: "Bank Transfer", type: "bank", iconName: "Building2" },
    { id: "tabby", name: "Tabby (Buy Now Pay Later)", type: "digital", iconName: "Zap" },
    { id: "tamara", name: "Tamara", type: "digital", iconName: "Zap" },
  ],
  saudi: [
    { id: "cash", name: "Cash", type: "cash", iconName: "Banknote" },
    { id: "card", name: "Mada / Credit Card", type: "card", iconName: "CreditCard" },
    { id: "apple_pay", name: "Apple Pay", type: "digital", iconName: "Smartphone" },
    { id: "bank_transfer", name: "Bank Transfer", type: "bank", iconName: "Building2" },
    { id: "tabby", name: "Tabby", type: "digital", iconName: "Zap" },
    { id: "tamara", name: "Tamara", type: "digital", iconName: "Zap" },
  ],
  us: [
    { id: "cash", name: "Cash", type: "cash", iconName: "Banknote" },
    { id: "card", name: "Credit Card", type: "card", iconName: "CreditCard" },
    { id: "debit_card", name: "Debit Card", type: "card", iconName: "CreditCard" },
    { id: "apple_pay", name: "Apple Pay", type: "digital", iconName: "Smartphone" },
    { id: "google_pay", name: "Google Pay", type: "digital", iconName: "Smartphone" },
    { id: "bank_transfer", name: "ACH / Wire Transfer", type: "bank", iconName: "Building2" },
    { id: "credit", name: "Store Credit", type: "credit", iconName: "FileText" },
  ],
  uk: [
    { id: "cash", name: "Cash", type: "cash", iconName: "Banknote" },
    { id: "card", name: "Debit / Credit Card", type: "card", iconName: "CreditCard" },
    { id: "apple_pay", name: "Apple Pay", type: "digital", iconName: "Smartphone" },
    { id: "google_pay", name: "Google Pay", type: "digital", iconName: "Smartphone" },
    { id: "bank_transfer", name: "BACS / Faster Payments", type: "bank", iconName: "Building2" },
    { id: "credit", name: "Store Credit", type: "credit", iconName: "FileText" },
  ],
  default: [
    { id: "cash", name: "Cash", type: "cash", iconName: "Banknote" },
    { id: "card", name: "Debit / Credit Card", type: "card", iconName: "CreditCard" },
    { id: "digital_wallet", name: "Digital Wallet / Mobile Pay", type: "digital", iconName: "Smartphone" },
    { id: "bank_transfer", name: "Bank Transfer", type: "bank", iconName: "Building2" },
    { id: "credit", name: "Store Credit", type: "credit", iconName: "FileText" },
  ],
};

export function resolveBusinessCountry(business: any): string {
  if (!business) return "default";
  const rawCountry = (business.country || "").toLowerCase().trim();
  const rawCurrency = (business.currency || "").toUpperCase().trim();

  if (rawCountry.includes("pakistan") || rawCountry === "pk" || rawCurrency === "PKR") return "pakistan";
  if (rawCountry.includes("india") || rawCountry === "in" || rawCurrency === "INR") return "india";
  if (rawCountry.includes("emirates") || rawCountry.includes("uae") || rawCountry === "ae" || rawCurrency === "AED") return "uae";
  if (rawCountry.includes("saudi") || rawCountry === "sa" || rawCurrency === "SAR") return "saudi";
  if (rawCountry.includes("united states") || rawCountry === "usa" || rawCountry === "us" || rawCurrency === "USD") return "us";
  if (rawCountry.includes("united kingdom") || rawCountry === "uk" || rawCountry === "gb" || rawCurrency === "GBP") return "uk";

  return "default";
}

export function getDefaultPaymentMethodsForCountry(countryKey: string): BusinessPaymentMethod[] {
  const defs = COUNTRY_DEFAULT_PAYMENT_METHODS[countryKey] || COUNTRY_DEFAULT_PAYMENT_METHODS.default;
  return defs.map((d, idx) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    iconName: d.iconName,
    enabled: true,
    isDefault: idx === 0,
    accountDetails: "",
    sortOrder: idx + 1,
  }));
}

const STORAGE_PREFIX = "geflow_payment_methods_";

export function getBusinessPaymentMethods(business: any): BusinessPaymentMethod[] {
  if (!business) return getDefaultPaymentMethodsForCountry("default");

  // 1. Check client-side configured payment methods in localStorage FIRST (user settings source of truth)
  if (typeof window !== "undefined" && business?.id) {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${business.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }

      const settingsRaw = localStorage.getItem(`geflow_settings_${business.id}`);
      if (settingsRaw) {
        const parsedSettings = JSON.parse(settingsRaw);
        if (parsedSettings?.payment_methods && Array.isArray(parsedSettings.payment_methods) && parsedSettings.payment_methods.length > 0) {
          return parsedSettings.payment_methods;
        }
      }
    } catch {
      // Fallback
    }
  }

  // 2. Check if configured in business object from DB
  if (business.payment_methods && Array.isArray(business.payment_methods) && business.payment_methods.length > 0) {
    return business.payment_methods;
  }

  // 2b. Check if inside business settings or extended metadata
  if (business.settings?.payment_methods && Array.isArray(business.settings.payment_methods) && business.settings.payment_methods.length > 0) {
    return business.settings.payment_methods;
  }

  // 3. Resolve by country
  const countryKey = resolveBusinessCountry(business);
  return getDefaultPaymentMethodsForCountry(countryKey);
}

export async function saveBusinessPaymentMethods(
  businessId: string,
  methods: BusinessPaymentMethod[]
): Promise<void> {
  if (!businessId) return;

  // 1. Cache in localStorage immediately for instant reactivity
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${businessId}`, JSON.stringify(methods));
      
      // Update geflow_settings_${businessId} as well so POS and reports settings inherit them
      const settingsKey = `geflow_settings_${businessId}`;
      const existingSettingsRaw = localStorage.getItem(settingsKey);
      const existingSettings = existingSettingsRaw ? JSON.parse(existingSettingsRaw) : {};
      existingSettings.payment_methods = methods;
      localStorage.setItem(settingsKey, JSON.stringify(existingSettings));

      window.dispatchEvent(
        new CustomEvent("geflow:payment-methods-updated", {
          detail: { businessId, methods },
        })
      );
      window.dispatchEvent(
        new CustomEvent("geflow:settings-changed", {
          detail: existingSettings,
        })
      );
    } catch (e) {
      console.warn("Failed to store payment methods in localStorage", e);
    }
  }

  // 2. Synchronize to node sync server
  try {
    fetch("/api/sync/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        settings: { payment_methods: methods },
      }),
    }).catch(() => {});
  } catch {
    // ignore offline sync
  }

  // 3. Persist to Supabase if column exists
  try {
    const { error } = await supabase
      .from("businesses")
      .update({ payment_methods: methods } as any)
      .eq("id", businessId);

    if (error && (error.code === "42703" || String(error.message).toLowerCase().includes("column"))) {
      // Column does not exist on table; fallback to settings_overrides or local persistence
    }
  } catch (err) {
    console.warn("Supabase businesses.payment_methods update warning:", err);
  }
}
