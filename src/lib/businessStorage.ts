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

function getLocalCachedExtended(bizId: string): BusinessExtendedData | null {
  try {
    const raw = localStorage.getItem(`geflow.biz_ext.${bizId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return mergeExtended(EMPTY_EXTENDED_BUSINESS, parsed);
      }
    }
  } catch {
    /* ignore parse error */
  }
  return null;
}

function setLocalCachedExtended(bizId: string, data: BusinessExtendedData) {
  try {
    localStorage.setItem(`geflow.biz_ext.${bizId}`, JSON.stringify(data));
  } catch {
    /* ignore storage quota errors */
  }
}

/**
 * Load extended settings for a business with multi-layer resilience:
 * 1. Dedicated /api/businesses/:id/extended-settings endpoint
 * 2. Supabase proxy layer
 * 3. Local cached storage
 */
export async function fetchExtendedBusinessData(
  bizId: string
): Promise<BusinessExtendedData> {
  if (!bizId) return { ...EMPTY_EXTENDED_BUSINESS };

  const localCached = getLocalCachedExtended(bizId);

  // 1. Try dedicated server API endpoint
  try {
    const res = await fetch(`/api/businesses/${encodeURIComponent(bizId)}/extended-settings`);
    if (res.ok) {
      const json = await res.json();
      if (json?.settings && typeof json.settings === "object") {
        const merged = mergeExtended(EMPTY_EXTENDED_BUSINESS, json.settings as BusinessExtendedData);
        setLocalCachedExtended(bizId, merged);
        return merged;
      }
    }
  } catch (_e) {
    // Proceed to fallback
  }

  // 2. Fallback to locally cached data or default
  if (localCached) {
    return localCached;
  }

  return { ...EMPTY_EXTENDED_BUSINESS };
}

/**
 * Save / merge extended settings with multi-layer resilience:
 * 1. Dedicated /api/businesses/:id/extended-settings endpoint (persisted to backend store and cloud alerts)
 * 2. Local storage cache for zero-latency UI updates
 */
export async function saveExtendedBusinessData(
  bizId: string,
  data: Partial<BusinessExtendedData>
): Promise<BusinessExtendedData> {
  if (!bizId) return { ...EMPTY_EXTENDED_BUSINESS };

  const existing = await fetchExtendedBusinessData(bizId);
  const merged = mergeExtended(existing, data);

  // Always update local cache immediately for zero latency
  setLocalCachedExtended(bizId, merged);

  // 1. Save to dedicated server endpoint
  try {
    await fetch(`/api/businesses/${encodeURIComponent(bizId)}/extended-settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: merged }),
    });
  } catch (err) {
    // Silently continue with local cache
  }

  return merged;
}

/**
 * @deprecated Sync helper for gradual migration — returns local cached or empty defaults.
 * Prefer fetchExtendedBusinessData (async).
 */
export const getExtendedBusinessData = (bizId: string): BusinessExtendedData => {
  if (!bizId) return { ...EMPTY_EXTENDED_BUSINESS };
  const cached = getLocalCachedExtended(bizId);
  return cached || { ...EMPTY_EXTENDED_BUSINESS };
};
