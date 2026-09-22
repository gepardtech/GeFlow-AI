import { supabase } from "@/integrations/supabase/client";
import { BusinessExtendedData } from "@/types/business";

/** Empty defaults only — no localStorage, no demo fluff */
export const EMPTY_EXTENDED_BUSINESS: BusinessExtendedData = {
  timezone: "UTC",
  dateFormat: "DD/MM/YYYY",
  numberFormat: "1,234.56",
  language: "en",
  taxEnabled: false,
  taxName: "VAT",
  inventory: {
    enableInventory: true,
    enableBarcode: true,
    enableSku: true,
    enableLowStockAlerts: true,
    stockAlertLimit: 10,
    enableBatchTracking: false,
    enableExpiryTracking: false,
  },
  pos: {
    enablePOS: true,
    paymentMethods: {
      cash: true,
      card: true,
      bankTransfer: true,
      mobileWallet: true,
      other: false,
    },
    receipt: {
      headerName: "",
      phone: "",
      address: "",
      showLogo: true,
      footerMessage: "Thank you for your business!",
    },
  },
};

function mergeExtended(
  base: BusinessExtendedData,
  patch: Partial<BusinessExtendedData> | null | undefined
): BusinessExtendedData {
  if (!patch) return { ...base };
  return {
    ...base,
    ...patch,
    inventory: { ...base.inventory!, ...(patch.inventory || {}) },
    pos: {
      ...base.pos!,
      ...(patch.pos || {}),
      paymentMethods: {
        ...base.pos!.paymentMethods,
        ...(patch.pos?.paymentMethods || {}),
      },
      receipt: {
        ...base.pos!.receipt,
        ...(patch.pos?.receipt || {}),
      },
    },
    location: patch.location
      ? { ...(base.location || ({} as any)), ...patch.location }
      : base.location,
  };
}

/**
 * Load extended settings from Supabase businesses.extended_settings
 */
export async function fetchExtendedBusinessData(
  bizId: string
): Promise<BusinessExtendedData> {
  if (!bizId) return { ...EMPTY_EXTENDED_BUSINESS };

  try {
    const { data, error } = await supabase
      .from("businesses")
      .select("extended_settings")
      .eq("id", bizId)
      .maybeSingle();

    if (error) {
      console.error("fetch extended_settings failed:", error.message);
      return { ...EMPTY_EXTENDED_BUSINESS };
    }

    const raw = data?.extended_settings;
    if (raw && typeof raw === "object") {
      return mergeExtended(EMPTY_EXTENDED_BUSINESS, raw as BusinessExtendedData);
    }
  } catch (e) {
    console.error("fetchExtendedBusinessData exception:", e);
  }

  return { ...EMPTY_EXTENDED_BUSINESS };
}

/**
 * Save / merge extended settings to Supabase.
 */
export async function saveExtendedBusinessData(
  bizId: string,
  data: Partial<BusinessExtendedData>
): Promise<BusinessExtendedData> {
  if (!bizId) return { ...EMPTY_EXTENDED_BUSINESS };

  const existing = await fetchExtendedBusinessData(bizId);
  const merged = mergeExtended(existing, data);

  try {
    const { error } = await supabase
      .from("businesses")
      .update({
        extended_settings: merged,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bizId);

    if (error) {
      console.error("save extended_settings failed:", error.message);
      throw error;
    }
  } catch (e) {
    console.error("saveExtendedBusinessData exception:", e);
    throw e;
  }

  return merged;
}

/**
 * @deprecated Sync helper for gradual migration — returns empty defaults.
 * Prefer fetchExtendedBusinessData (async).
 */
export const getExtendedBusinessData = (_bizId: string): BusinessExtendedData => {
  return { ...EMPTY_EXTENDED_BUSINESS };
};