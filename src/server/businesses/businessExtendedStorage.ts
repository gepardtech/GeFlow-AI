import fs from "fs";
import path from "path";
import { serverSupabase } from "../supabase";

export interface BusinessInventorySettings {
  enableInventory: boolean;
  enableBarcode: boolean;
  enableSku: boolean;
  enableLowStockAlerts: boolean;
  stockAlertLimit: number;
  enableBatchTracking: boolean;
  enableExpiryTracking: boolean;
}

export interface BusinessPOSSettings {
  enablePOS: boolean;
  paymentMethods: {
    cash: boolean;
    card: boolean;
    bankTransfer: boolean;
    mobileWallet: boolean;
    other: boolean;
  };
  receipt: {
    headerName: string;
    phone: string;
    address: string;
    showLogo: boolean;
    footerMessage: string;
  };
}

export interface BusinessLocation {
  country: string;
  stateProvince: string;
  city: string;
  areaLocality: string;
  address: string;
  postalZip: string;
}

export interface BusinessExtendedData {
  logoUrl?: string;
  description?: string;
  phone?: string;
  email?: string;
  website?: string;
  location?: BusinessLocation;
  timezone?: string;
  dateFormat?: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  numberFormat?: "1,234.56" | "1.234,56";
  language?: string;
  taxEnabled?: boolean;
  taxName?: string;
  inventory?: BusinessInventorySettings;
  pos?: BusinessPOSSettings;
  teamInvites?: any[];
}

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

export function mergeExtended(
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

const BACKUP_PATH = path.join(process.cwd(), "data", "businesses_extended_settings.json");

function readBackupFile(): Record<string, BusinessExtendedData> {
  try {
    if (fs.existsSync(BACKUP_PATH)) {
      const raw = fs.readFileSync(BACKUP_PATH, "utf8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not read businesses_extended_settings.json:", e);
  }
  return {};
}

function writeBackupFile(store: Record<string, BusinessExtendedData>) {
  try {
    const dir = path.dirname(BACKUP_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BACKUP_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch (e) {
    console.warn("Could not write businesses_extended_settings.json:", e);
  }
}

class BusinessExtendedStorage {
  private cache: Record<string, BusinessExtendedData> = {};
  private initialized = false;

  constructor() {
    this.cache = readBackupFile();
    this.syncFromSupabase();
  }

  private async syncFromSupabase(): Promise<void> {
    try {
      const { data, error } = await serverSupabase
        .from("platform_settings")
        .select("alerts")
        .limit(1)
        .maybeSingle();

      if (!error && data?.alerts) {
        const alerts = data.alerts as any;
        const cloudExt = alerts.businesses_extended_settings;
        if (cloudExt && typeof cloudExt === "object") {
          // Merge with memory cache
          for (const [bizId, dataObj] of Object.entries(cloudExt)) {
            if (dataObj && typeof dataObj === "object") {
              this.cache[bizId] = mergeExtended(
                this.cache[bizId] || EMPTY_EXTENDED_BUSINESS,
                dataObj as BusinessExtendedData
              );
            }
          }
          writeBackupFile(this.cache);
        }
      }
      this.initialized = true;
    } catch (err) {
      console.warn("Supabase businesses extended sync notice:", err);
      this.initialized = true;
    }
  }

  private async persistToSupabase(): Promise<void> {
    writeBackupFile(this.cache);
    try {
      const { data: existing } = await serverSupabase
        .from("platform_settings")
        .select("id, alerts")
        .limit(1)
        .maybeSingle();

      const existingAlerts = (existing?.alerts as any) || {};
      const updatedAlerts = {
        ...existingAlerts,
        businesses_extended_settings: this.cache,
      };

      if (existing?.id) {
        await serverSupabase
          .from("platform_settings")
          .update({ alerts: updatedAlerts, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await serverSupabase
          .from("platform_settings")
          .upsert(
            { singleton: true, alerts: updatedAlerts, updated_at: new Date().toISOString() },
            { onConflict: "singleton" }
          );
      }
    } catch (err) {
      console.warn("Failed persisting businesses extended settings to Supabase:", err);
    }
  }

  public getSettings(bizId: string): BusinessExtendedData {
    if (!bizId) return { ...EMPTY_EXTENDED_BUSINESS };
    const found = this.cache[bizId];
    if (found) {
      return mergeExtended(EMPTY_EXTENDED_BUSINESS, found);
    }
    return { ...EMPTY_EXTENDED_BUSINESS };
  }

  public getAll(): Record<string, BusinessExtendedData> {
    return { ...this.cache };
  }

  public async saveSettings(
    bizId: string,
    data: Partial<BusinessExtendedData>
  ): Promise<BusinessExtendedData> {
    if (!bizId) return { ...EMPTY_EXTENDED_BUSINESS };
    const current = this.getSettings(bizId);
    const merged = mergeExtended(current, data);
    this.cache[bizId] = merged;
    await this.persistToSupabase();
    return merged;
  }
}

export const businessExtendedStorage = new BusinessExtendedStorage();
