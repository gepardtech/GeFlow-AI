import { format, parse, isValid } from "date-fns";

export interface NormalizationResult<T> {
  value: T;
  raw: string;
  isValid: boolean;
  warning?: string;
  error?: string;
}

/**
 * Normalizes numeric monetary strings into float numbers.
 * Handles "Rs. 1,250.50", "PKR 500", "$15.99", "1,250", etc.
 */
export const normalizePrice = (raw: string | number | null | undefined): NormalizationResult<number> => {
  if (raw == null || String(raw).trim() === "") {
    return { value: 0, raw: "", isValid: true };
  }

  const str = String(raw).trim();

  // Strip currency words, symbols, and whitespace
  // Replace comma decimal separators if used like 12,50 (European) or 1,250.50
  let clean = str.replace(/[$€£₹]|Rs\.?|PKR|USD|EUR|GBP|AED|SAR/gi, "").trim();

  // Handle thousand commas: 1,250.50 -> 1250.50
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(clean)) {
    clean = clean.replace(/,/g, "");
  } else if (/^\d+(,\d{2})$/.test(clean)) {
    // European style: 15,50 -> 15.50
    clean = clean.replace(/,/, ".");
  } else {
    // general comma strip
    clean = clean.replace(/,/g, "");
  }

  const num = parseFloat(clean);

  if (Number.isNaN(num)) {
    return {
      value: 0,
      raw: str,
      isValid: false,
      error: `Invalid price format: "${str}"`,
    };
  }

  if (num < 0) {
    return {
      value: 0,
      raw: str,
      isValid: false,
      error: `Price cannot be negative (${str})`,
    };
  }

  return {
    value: Math.round(num * 100) / 100,
    raw: str,
    isValid: true,
  };
};

/**
 * Normalizes quantity / stock into positive integers.
 * Handles "100", "1,000", "50 pcs", "100 units".
 */
export const normalizeQuantity = (
  raw: string | number | null | undefined,
  defaultVal = 0
): NormalizationResult<number> => {
  if (raw == null || String(raw).trim() === "") {
    return { value: defaultVal, raw: "", isValid: true };
  }

  const str = String(raw).trim();
  const clean = str.replace(/,/g, "").replace(/\s*(pcs|units|box|boxes|nos|items|pk|packs|strip|strips)\b/gi, "").trim();

  const num = parseInt(clean, 10);

  if (Number.isNaN(num)) {
    return {
      value: defaultVal,
      raw: str,
      isValid: false,
      error: `Invalid quantity: "${str}"`,
    };
  }

  if (num < 0) {
    return {
      value: 0,
      raw: str,
      isValid: false,
      error: `Stock units cannot be negative (${str})`,
    };
  }

  return {
    value: num,
    raw: str,
    isValid: true,
  };
};

/**
 * Normalizes discount into a numeric discount price or calculated fixed value.
 */
export const normalizeDiscount = (
  raw: string | number | null | undefined,
  retailPrice = 0
): NormalizationResult<number | null> => {
  if (raw == null || String(raw).trim() === "") {
    return { value: null, raw: "", isValid: true };
  }

  const str = String(raw).trim();

  // Check if percentage (e.g. 10% or 15 %)
  if (str.includes("%")) {
    const pct = parseFloat(str.replace(/[^0-9.]/g, ""));
    if (!Number.isNaN(pct) && pct >= 0 && pct <= 100) {
      const discountPrice = retailPrice > 0 ? retailPrice * (1 - pct / 100) : null;
      return {
        value: discountPrice ? Math.round(discountPrice * 100) / 100 : null,
        raw: str,
        isValid: true,
        warning: `Converted ${pct}% discount to discounted price`,
      };
    }
  }

  // Otherwise treat as numeric fixed discount / discounted price
  const res = normalizePrice(str);
  if (!res.isValid) {
    return {
      value: null,
      raw: str,
      isValid: false,
      error: `Invalid discount value: "${str}"`,
    };
  }

  return {
    value: res.value > 0 ? res.value : null,
    raw: str,
    isValid: true,
  };
};

/**
 * Normalizes date strings into ISO format (YYYY-MM-DD).
 * Supports Excel serial numbers, "YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY", "31-Dec-2027", etc.
 */
export const normalizeDate = (raw: string | number | null | undefined): NormalizationResult<string | null> => {
  if (raw == null || String(raw).trim() === "") {
    return { value: null, raw: "", isValid: true };
  }

  const str = String(raw).trim();

  // Check if Excel Serial Date Number (e.g. 45000 to 55000)
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str, 10);
    // Excel epoch starts Dec 30 1899
    const utcDays = serial - 25569;
    const date = new Date(utcDays * 86400 * 1000);
    if (isValid(date)) {
      return {
        value: format(date, "yyyy-MM-dd"),
        raw: str,
        isValid: true,
      };
    }
  }

  // Standard ISO: 2027-12-31
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str);
    if (isValid(d)) {
      return { value: str, raw: str, isValid: true };
    }
  }

  // Patterns to try
  const formats = [
    "yyyy/MM/dd",
    "dd/MM/yyyy",
    "MM/dd/yyyy",
    "dd-MM-yyyy",
    "yyyy-MM-dd",
    "dd-MMM-yyyy",
    "dd MMM yyyy",
    "MMMM d, yyyy",
    "d MMMM yyyy",
    "MM/dd/yy",
    "dd/MM/yy",
  ];

  for (const fmt of formats) {
    try {
      const parsed = parse(str, fmt, new Date());
      if (isValid(parsed) && parsed.getFullYear() > 1990 && parsed.getFullYear() < 2100) {
        return {
          value: format(parsed, "yyyy-MM-dd"),
          raw: str,
          isValid: true,
        };
      }
    } catch {
      // continue
    }
  }

  // Direct Date constructor fallback
  const direct = new Date(str);
  if (isValid(direct) && direct.getFullYear() > 1990 && direct.getFullYear() < 2100) {
    return {
      value: format(direct, "yyyy-MM-dd"),
      raw: str,
      isValid: true,
      warning: "Date parsed using fallback parser, verify format",
    };
  }

  return {
    value: null,
    raw: str,
    isValid: false,
    error: `Unrecognized date format: "${str}"`,
  };
};

/**
 * Normalizes barcode string while strictly preserving leading zeros!
 */
export const normalizeBarcode = (raw: string | number | null | undefined): NormalizationResult<string | null> => {
  if (raw == null || String(raw).trim() === "") {
    return { value: null, raw: "", isValid: true };
  }

  // Treat strictly as string, remove spaces and hyphens
  const str = String(raw).trim().replace(/[\s-]/g, "");

  if (str.length === 0) {
    return { value: null, raw: "", isValid: true };
  }

  // Check if reasonable barcode string (e.g. alphanumeric or digits)
  return {
    value: str,
    raw: String(raw),
    isValid: true,
  };
};

/**
 * Normalizes image URL(s).
 */
export const normalizeImages = (raw: string | null | undefined): NormalizationResult<string[]> => {
  if (!raw || raw.trim() === "") {
    return { value: [], raw: "", isValid: true };
  }

  const str = raw.trim();
  const split = str.split(/[|,;\s]+/).map((u) => u.trim()).filter((u) => u.length > 0);

  const validUrls: string[] = [];
  const invalidUrls: string[] = [];

  for (const url of split) {
    if (/^https?:\/\/.+/i.test(url)) {
      validUrls.push(url);
    } else {
      invalidUrls.push(url);
    }
  }

  if (invalidUrls.length > 0 && validUrls.length === 0) {
    return {
      value: [],
      raw: str,
      isValid: false,
      warning: `Images not valid URLs: ${invalidUrls.join(", ")}`,
    };
  }

  return {
    value: validUrls,
    raw: str,
    isValid: true,
    warning: invalidUrls.length > 0 ? `Ignored invalid image URLs: ${invalidUrls.join(", ")}` : undefined,
  };
};
