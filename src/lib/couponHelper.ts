import { supabase } from "@/integrations/supabase/client";
import { isPlanMatching, formatPlanTargetLabel } from "@/lib/promotionsClient";

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
const PENDING_COUPON_FROM_CTA_KEY = "geflow_pending_coupon_from_cta";

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
 * Checks if the pending coupon was set by an Announcement CTA button click
 */
export function isPendingCouponFromCta(): boolean {
  try {
    return (
      localStorage.getItem(PENDING_COUPON_FROM_CTA_KEY) === "1" ||
      sessionStorage.getItem("geflow_from_announcement_cta") === "1"
    );
  } catch {
    return false;
  }
}

/**
 * Sets a pending promo coupon to be picked up
 */
export function setPendingCoupon(code: string, fromAnnouncementCta: boolean = false): void {
  try {
    const clean = code.trim().toUpperCase();
    if (clean) {
      localStorage.setItem(PENDING_COUPON_KEY, clean);
      if (fromAnnouncementCta) {
        localStorage.setItem(PENDING_COUPON_FROM_CTA_KEY, "1");
        sessionStorage.setItem("geflow_from_announcement_cta", "1");
      } else {
        localStorage.removeItem(PENDING_COUPON_FROM_CTA_KEY);
      }
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
    localStorage.removeItem(PENDING_COUPON_FROM_CTA_KEY);
    sessionStorage.removeItem("geflow_from_announcement_cta");
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
  coupon_code?: string | null;
} | null): { code: string; percent?: number; amount?: number } | null {
  if (!a) return null;

  // 1. Explicit coupon_code field if set
  if (a.coupon_code && a.coupon_code.trim().length >= 3) {
    return { code: a.coupon_code.trim().toUpperCase() };
  }

  // 2. From link_url query param
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

  // 3. From body or title regex
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
      .select("id, title, body, variant, link_url, link_label, created_at, is_active, starts_at, ends_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data && data.length > 0) {
      const now = new Date();
      const validAnnouncements = (data as any[]).filter((a) => {
        if (!a.is_active) return false;
        if (a.starts_at && new Date(a.starts_at) > now) return false;
        if (a.ends_at && new Date(a.ends_at) < now) return false;
        return true;
      });

      for (const ann of validAnnouncements) {
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
 * Validates a coupon code strictly against plan, cycle/period, active status,
 * limits, and expiration date.
 */
export async function validateCoupon(
  codeToValidate: string,
  plan: string,
  subtotal: number,
  period?: string
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

  // 1. Check Server API endpoint first for real-time coupon sync
  try {
    const apiRes = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, plan, subtotal, period }),
    });
    if (apiRes.ok) {
      const apiData = await apiRes.json();
      if (apiData.success) {
        if (apiData.valid) {
          return {
            valid: true,
            code: apiData.code,
            amount: apiData.amount,
            label: apiData.label,
            discountType: apiData.discountType,
            discountValue: apiData.discountValue,
          };
        } else if (apiData.reason && !apiData.reason.includes("does not exist")) {
          // Explicit failure reason (e.g. inactive, wrong plan, expired)
          return {
            valid: false,
            code,
            amount: 0,
            label: "",
            discountType: "percent",
            discountValue: 0,
            reason: apiData.reason,
          };
        }
      }
    }
  } catch (err) {
    console.warn("API coupon validation notice:", err);
  }

  // 2. Direct table check on `coupons` table in Supabase
  try {
    const { data: directCoupon } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (directCoupon) {
      // 2a. Check if deactivated by admin
      if (!directCoupon.active) {
        return {
          valid: false,
          code,
          amount: 0,
          label: "",
          discountType: "percent",
          discountValue: 0,
          reason: "This coupon code is currently inactive.",
        };
      }

      // 2b. Check plan and billing cycle matching
      const planCheck = isPlanMatching(directCoupon.applies_to_plan, plan, period);
      if (!planCheck.matches) {
        return {
          valid: false,
          code,
          amount: 0,
          label: "",
          discountType: "percent",
          discountValue: 0,
          reason: `This coupon code is only valid for the ${planCheck.label} plan.`,
        };
      }

      // 2c. Check start time
      if (directCoupon.starts_at && new Date(directCoupon.starts_at) > new Date()) {
        return {
          valid: false,
          code,
          amount: 0,
          label: "",
          discountType: "percent",
          discountValue: 0,
          reason: "This coupon promotion has not started yet.",
        };
      }

      // 2d. Check expiration
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

      // 2e. Check max uses
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

      // 2f. Check min order amount
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

  // 3. Check active announcements (ONLY if currently active and valid in DB)
  try {
    const { data: annData } = await supabase
      .from("announcements")
      .select("id, title, body, variant, link_url, is_active, starts_at, ends_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10);

    if (annData && annData.length > 0) {
      const now = new Date();
      for (const ann of annData as any[]) {
        if (!ann.is_active) continue;
        if (ann.starts_at && new Date(ann.starts_at) > now) continue;
        if (ann.ends_at && new Date(ann.ends_at) < now) continue;

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

