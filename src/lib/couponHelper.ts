import { supabase } from "@/integrations/supabase/client";

export interface ValidatedCouponResult {
  valid: boolean;
  code: string;
  amount: number;
  label: string;
  discountType: "percent" | "amount";
  discountValue: number;
  reason?: string;
  isAnnouncementPromo?: boolean;
}

const PENDING_COUPON_KEY = "geflow_pending_coupon";

/**
 * Reads any saved promo coupon waiting in local browser storage
 */
export function getPendingCoupon(): string {
  try {
    return (localStorage.getItem(PENDING_COUPON_KEY) || "").trim().toUpperCase();
  } catch {
    return "";
  }
}

/**
 * Sets a pending promo coupon to be automatically picked up on checkout or subscription pages
 */
export function setPendingCoupon(code: string): void {
  try {
    const clean = code.trim().toUpperCase();
    if (clean) {
      localStorage.setItem(PENDING_COUPON_KEY, clean);
    }
  } catch (e) {
    console.warn("Failed to set pending coupon:", e);
  }
}

/**
 * Clears the pending coupon from storage
 */
export function clearPendingCoupon(): void {
  try {
    localStorage.removeItem(PENDING_COUPON_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Intelligently scans text and URLs from an announcement to extract promotional codes
 * and discount percentages/amounts.
 */
export function detectAnnouncementCoupon(a: {
  link_url?: string | null;
  body?: string | null;
  title?: string | null;
  variant?: string | null;
} | null): { code: string; percent?: number; amount?: number } | null {
  if (!a) return null;

  // 1. From link_url query param
  if (a.link_url) {
    try {
      const u = new URL(a.link_url, "http://localhost");
      const code = u.searchParams.get("coupon") || u.searchParams.get("code") || u.searchParams.get("promo");
      if (code && code.trim().length >= 3) {
        return { code: code.trim().toUpperCase() };
      }
    } catch {
      const match = a.link_url.match(/[?&](?:coupon|code|promo)=([^&#]+)/i);
      if (match && match[1]) {
        return { code: decodeURIComponent(match[1]).trim().toUpperCase() };
      }
    }
  }

  // 2. From body or title regex
  const text = `${a.title || ""} ${a.body || ""}`;

  // Check for discount magnitude in text (e.g. 20%, 30%, 50%, $10)
  const percentMatch = text.match(/(\d{1,2})\s*%\s*(?:off|discount)?/i);
  const detectedPercent = percentMatch ? parseInt(percentMatch[1], 10) : undefined;

  const dollarMatch = text.match(/\$\s*(\d{1,3})\s*(?:off|discount)?/i);
  const detectedAmount = dollarMatch ? parseFloat(dollarMatch[1]) : undefined;

  const patterns = [
    /(?:coupon|promo|discount|voucher|offer)[\s:*-]+code[\s:*-]+([A-Z0-9_-]{3,20})/i,
    /(?:code|coupon|promo|voucher)[\s:*-]+([A-Z0-9_-]{3,20})/i,
    /\buse\s+code\s+([A-Z0-9_-]{3,20})/i,
    /\bcode\s*:\s*([A-Z0-9_-]{3,20})/i,
    /\bcoupon\s*:\s*([A-Z0-9_-]{3,20})/i,
    /\bpromo\s*:\s*([A-Z0-9_-]{3,20})/i,
    /["']([A-Z0-9_-]{4,15})["']\s*(?:for|to get|\bat checkout)/i,
    /\b([A-Z0-9]{4,15})\s*(?:at checkout)/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const candidate = match[1].trim().toUpperCase();
      const forbidden = ["NOW", "TODAY", "HERE", "PAGE", "CHECKOUT", "STORE", "THIS", "PLAN", "USER", "ADMIN", "FREE", "MORE", "CLICK", "LINK"];
      if (!forbidden.includes(candidate) && candidate.length >= 3) {
        return {
          code: candidate,
          percent: detectedPercent,
          amount: detectedAmount,
        };
      }
    }
  }

  // If announcement is variant "promo", check for words in uppercase that look like coupon codes
  if (a.variant === "promo") {
    const promoMatch = text.match(/\b([A-Z0-9]{4,15})\b/);
    if (promoMatch && !["PROMO", "SPECIAL", "UPDATE", "NOTICE"].includes(promoMatch[1])) {
      return {
        code: promoMatch[1].trim().toUpperCase(),
        percent: detectedPercent || 20,
      };
    }
  }

  return null;
}

/**
 * Searches active platform announcements for any active promotional coupon
 */
export async function findActiveAnnouncementCoupon(): Promise<{ code: string; percent?: number; amount?: number; title: string } | null> {
  try {
    const { data } = await supabase
      .from("announcements")
      .select("id, title, body, variant, link_url, link_label, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (data && data.length > 0) {
      for (const ann of data) {
        const detected = detectAnnouncementCoupon(ann);
        if (detected && detected.code) {
          return {
            ...detected,
            title: ann.title || "Special Promotion",
          };
        }
      }
    }
  } catch (err) {
    console.warn("Failed to check active announcements for promo coupons:", err);
  }
  return null;
}

/**
 * Validates a coupon against Supabase RPC, direct coupons table,
 * active announcement campaign, or standard built-in promotional codes.
 */
export async function validateCoupon(
  codeToValidate: string,
  plan: string,
  subtotal: number
): Promise<ValidatedCouponResult> {
  const code = codeToValidate.trim().toUpperCase();
  if (!code) {
    return {
      valid: false,
      code: "",
      amount: 0,
      label: "",
      discountType: "percent",
      discountValue: 0,
      reason: "Please enter a coupon code.",
    };
  }

  // 1. Try secure database RPC if present
  try {
    const { data, error } = await supabase.rpc("validate_coupon", {
      _code: code,
      _plan: plan,
      _subtotal: subtotal,
    });

    const result = Array.isArray(data) ? data[0] : data;
    if (!error && result?.valid) {
      const amount = Number(result.amount) || 0;
      const label = result.label || `${result.discount_value}% OFF`;
      const discountType = (result.discount_type === "amount" ? "amount" : "percent") as "percent" | "amount";
      const discountValue = Number(result.discount_value) || 0;
      return {
        valid: true,
        code,
        amount: +amount.toFixed(2),
        label,
        discountType,
        discountValue,
      };
    }
  } catch {
    // RPC failed or not configured, proceed to fallback validation
  }

  // 2. Direct table check on `coupons` table
  try {
    const { data: directCoupon } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();

    if (directCoupon) {
      if (directCoupon.applies_to_plan && directCoupon.applies_to_plan !== "all" && directCoupon.applies_to_plan !== plan) {
        return {
          valid: false,
          code,
          amount: 0,
          label: "",
          discountType: "percent",
          discountValue: 0,
          reason: `This coupon code only applies to the ${directCoupon.applies_to_plan} plan.`,
        };
      }

      if (directCoupon.expires_at && new Date(directCoupon.expires_at) < new Date()) {
        return {
          valid: false,
          code,
          amount: 0,
          label: "",
          discountType: "percent",
          discountValue: 0,
          reason: "This coupon code has expired.",
        };
      }

      if (directCoupon.max_uses && directCoupon.used_count >= directCoupon.max_uses) {
        return {
          valid: false,
          code,
          amount: 0,
          label: "",
          discountType: "percent",
          discountValue: 0,
          reason: "This coupon has reached its maximum usage limit.",
        };
      }

      if (directCoupon.min_amount && subtotal < directCoupon.min_amount) {
        return {
          valid: false,
          code,
          amount: 0,
          label: "",
          discountType: "percent",
          discountValue: 0,
          reason: `Minimum cart amount of $${directCoupon.min_amount} required for this coupon.`,
        };
      }

      const discountType = directCoupon.discount_type === "amount" ? "amount" : "percent";
      const discountValNum = Number(directCoupon.discount_value) || 0;
      const discountAmount = discountType === "percent"
        ? (subtotal * discountValNum) / 100
        : discountValNum;
      const label = discountType === "percent"
        ? `${discountValNum}% OFF`
        : `$${discountValNum.toFixed(2)} OFF`;

      return {
        valid: true,
        code,
        amount: +discountAmount.toFixed(2),
        label,
        discountType,
        discountValue: discountValNum,
      };
    }
  } catch (err) {
    console.warn("Direct coupon check failed:", err);
  }

  // 3. Check active announcements (so any announced promo code automatically validates)
  try {
    const { data: annData } = await supabase
      .from("announcements")
      .select("id, title, body, variant, link_url")
      .order("created_at", { ascending: false })
      .limit(10);

    if (annData && annData.length > 0) {
      for (const ann of annData) {
        const detected = detectAnnouncementCoupon(ann);
        if (detected && detected.code === code) {
          const pct = detected.percent || 20;
          const discountAmount = detected.amount ? detected.amount : (subtotal * pct) / 100;
          const label = detected.amount ? `$${detected.amount.toFixed(2)} OFF` : `${pct}% OFF`;

          return {
            valid: true,
            code,
            amount: +discountAmount.toFixed(2),
            label,
            discountType: detected.amount ? "amount" : "percent",
            discountValue: detected.amount || pct,
            isAnnouncementPromo: true,
          };
        }
      }
    }
  } catch (err) {
    console.warn("Announcement coupon check error:", err);
  }

  // 4. Built-in promo code fallbacks (e.g. platform launch & standard coupons)
  const builtInMap: Record<string, { type: "percent" | "amount"; value: number; label: string }> = {
    LAUNCH20: { type: "percent", value: 20, label: "20% OFF (Launch Special)" },
    PROMO20: { type: "percent", value: 20, label: "20% OFF (Promotional Code)" },
    PROMO: { type: "percent", value: 20, label: "20% OFF" },
    GEFLOW: { type: "percent", value: 20, label: "20% OFF" },
    GEFLOW20: { type: "percent", value: 20, label: "20% OFF" },
    SPECIAL50: { type: "percent", value: 50, label: "50% OFF (Special Voucher)" },
    WELCOME10: { type: "percent", value: 10, label: "10% OFF (Welcome Code)" },
  };

  if (builtInMap[code]) {
    const info = builtInMap[code];
    const discountAmount = info.type === "percent"
      ? (subtotal * info.value) / 100
      : info.value;

    return {
      valid: true,
      code,
      amount: +discountAmount.toFixed(2),
      label: info.label,
      discountType: info.type,
      discountValue: info.value,
      isAnnouncementPromo: true,
    };
  }

  return {
    valid: false,
    code,
    amount: 0,
    label: "",
    discountType: "percent",
    discountValue: 0,
    reason: "The coupon code provided is invalid, expired, or not applicable.",
  };
}
