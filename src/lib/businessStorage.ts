import { BusinessExtendedData, BusinessItem } from "@/types/business";

const LS_EXTENDED_PREFIX = "geflow.biz_ext.";

export const getExtendedBusinessData = (bizId: string): BusinessExtendedData => {
  try {
    const raw = localStorage.getItem(`${LS_EXTENDED_PREFIX}${bizId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error reading extended business data", e);
  }
  return {
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
};

export const saveExtendedBusinessData = (bizId: string, data: BusinessExtendedData) => {
  try {
    const existing = getExtendedBusinessData(bizId);
    const merged = { ...existing, ...data };
    localStorage.setItem(`${LS_EXTENDED_PREFIX}${bizId}`, JSON.stringify(merged));
  } catch (e) {
    console.error("Error saving extended business data", e);
  }
};
