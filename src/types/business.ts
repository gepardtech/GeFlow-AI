export interface BusinessCategoryDef {
  id: string;
  name: string;
  industry_type: string;
  currency: string;
  default_tax: number;
  stock_alert_limit: number;
  status: string;
  enabled_modules: string[];
  enabled_features: string[];
  created_at?: string;
  updated_at?: string;
  internal_description?: string | null;
}

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

export interface TeamMemberInvite {
  name: string;
  email: string;
  role: "manager" | "cashier" | "inventory_clerk" | "staff";
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
  teamInvites?: TeamMemberInvite[];
}

export interface BusinessItem {
  id: string;
  business_name: string;
  business_address: string | null;
  category_id: string | null;
  currency: string;
  base_currency: string | null;
  default_tax: number;
  stock_alert_limit: number;
  owner_user_id: string;
  status: string;
  last_active: string;
  listed_products: number;
  usage: number;
  created_at: string;
  updated_at: string;
  
  // Relational / Extended fields
  category?: BusinessCategoryDef | null;
  category_name?: string;
  industry_type?: string;
  extended?: BusinessExtendedData;
  user_plan?: string;
}
