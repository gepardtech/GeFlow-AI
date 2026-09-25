import { serverSupabase } from "../supabase";

export interface ServerAnnouncement {
  id: string;
  title: string;
  body: string;
  audience: "all" | "public" | "users" | "admins";
  position: "top" | "bottom";
  variant: "promo" | "info" | "success" | "warning";
  link_url: string | null;
  link_label: string | null;
  coupon_code?: string;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServerCoupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  applies_to_plan: string | null; // e.g. null / 'all', 'standard', 'standard_monthly', 'standard_yearly', 'standard_lifetime', 'premium', 'premium_monthly', 'premium_yearly', 'premium_lifetime'
  min_amount: number;
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function formatPlanLabel(appliesTo: string | null | undefined): string {
  if (!appliesTo || appliesTo.toLowerCase() === "all") return "All Plans";
  switch (appliesTo.toLowerCase().replace(/[-:]/g, "_")) {
    case "standard": return "Standard (All Cycles)";
    case "standard_monthly": return "Standard Monthly";
    case "standard_yearly": return "Standard Yearly";
    case "standard_lifetime": return "Standard Lifetime";
    case "premium": return "Premium (All Cycles)";
    case "premium_monthly": return "Premium Monthly";
    case "premium_yearly": return "Premium Yearly";
    case "premium_lifetime": return "Premium Lifetime";
    default: return appliesTo;
  }
}

export function checkPlanMatch(
  appliesTo: string | null | undefined,
  currentPlan: string,
  currentPeriod?: string
): { matches: boolean; label: string } {
  const label = formatPlanLabel(appliesTo);
  if (!appliesTo || appliesTo.toLowerCase() === "all") {
    return { matches: true, label };
  }

  const target = appliesTo.trim().toLowerCase()
    .replace(/^plan\s*:\s*/i, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  const planKey = (currentPlan || "").trim().toLowerCase()
    .replace(/[^a-z0-9]/g, "_");
  const periodKey = (currentPeriod || "").trim().toLowerCase()
    .replace(/[^a-z0-9]/g, "_");

  // If matches whole tier, e.g. "standard" or "premium"
  if (target === planKey) {
    return { matches: true, label };
  }

  // If matches specific plan + billing cycle, e.g. "premium_lifetime"
  if (periodKey && target === `${planKey}_${periodKey}`) {
    return { matches: true, label };
  }

  return { matches: false, label };
}

class PromotionsService {
  private announcements: ServerAnnouncement[] = [];
  private coupons: ServerCoupon[] = [
    {
      id: "cpn_promo20",
      code: "PROMO20",
      description: "20% off all plans promotion",
      discount_type: "percent",
      discount_value: 20,
      applies_to_plan: "all",
      min_amount: 0,
      max_uses: null,
      used_count: 0,
      starts_at: null,
      expires_at: null,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "cpn_prem_life_50",
      code: "LIFETIME50",
      description: "50% off Premium Lifetime only",
      discount_type: "percent",
      discount_value: 50,
      applies_to_plan: "premium_lifetime",
      min_amount: 0,
      max_uses: 100,
      used_count: 0,
      starts_at: null,
      expires_at: null,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  constructor() {
    this.syncFromSupabase();
  }

  private async syncFromSupabase(): Promise<void> {
    try {
      const { data, error } = await serverSupabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        this.coupons = data.map((c: any) => ({
          id: c.id,
          code: c.code,
          description: c.description,
          discount_type: c.discount_type,
          discount_value: Number(c.discount_value) || 0,
          applies_to_plan: c.applies_to_plan,
          min_amount: Number(c.min_amount) || 0,
          max_uses: c.max_uses,
          used_count: Number(c.used_count) || 0,
          starts_at: c.starts_at,
          expires_at: c.expires_at,
          active: Boolean(c.active),
          created_at: c.created_at,
          updated_at: c.updated_at,
        }));
      } else {
        // Seed default coupons to Supabase
        for (const c of this.coupons) {
          await serverSupabase.from("coupons").upsert({
            id: c.id,
            code: c.code,
            description: c.description,
            discount_type: c.discount_type,
            discount_value: c.discount_value,
            applies_to_plan: c.applies_to_plan,
            min_amount: c.min_amount,
            max_uses: c.max_uses,
            used_count: c.used_count,
            active: c.active,
          });
        }
      }
    } catch (err) {
      console.warn("Notice syncing coupons with Supabase:", err);
    }
  }

  private saveAnnouncements(): void {
    // Announcements maintained in memory
  }

  private saveCoupons(): void {
    // Sync coupons with Supabase
    for (const c of this.coupons) {
      serverSupabase
        .from("coupons")
        .upsert({
          id: c.id,
          code: c.code,
          description: c.description,
          discount_type: c.discount_type,
          discount_value: c.discount_value,
          applies_to_plan: c.applies_to_plan,
          min_amount: c.min_amount,
          max_uses: c.max_uses,
          used_count: c.used_count,
          active: c.active,
          updated_at: new Date().toISOString(),
        })
        .then();
    }
  }

  // --- ANNOUNCEMENTS ---
  public getAnnouncements(activeOnly: boolean = false, audience?: string, position?: string): ServerAnnouncement[] {
    const now = new Date();
    return this.announcements.filter((a) => {
      if (activeOnly) {
        if (!a.is_active) return false;
        if (a.starts_at && new Date(a.starts_at) > now) return false;
        if (a.ends_at && new Date(a.ends_at) < now) return false;
      }
      if (position && a.position !== position) return false;
      if (audience && audience !== "all" && a.audience !== "all" && a.audience !== audience) return false;
      return true;
    });
  }

  public getAnnouncementById(id: string): ServerAnnouncement | undefined {
    return this.announcements.find((a) => a.id === id);
  }

  public createAnnouncement(data: Partial<ServerAnnouncement>): ServerAnnouncement {
    const now = new Date().toISOString();
    const newAnn: ServerAnnouncement = {
      id: "ann_" + Math.random().toString(36).slice(2, 11),
      title: data.title || "Announcement",
      body: data.body || "",
      audience: data.audience || "all",
      position: data.position || "top",
      variant: data.variant || "promo",
      link_url: data.link_url || null,
      link_label: data.link_label || null,
      coupon_code: data.coupon_code || "",
      starts_at: data.starts_at || now,
      ends_at: data.ends_at || null,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      created_at: now,
      updated_at: now,
    };
    this.announcements.unshift(newAnn);
    this.saveAnnouncements();
    return newAnn;
  }

  public updateAnnouncement(id: string, data: Partial<ServerAnnouncement>): ServerAnnouncement | null {
    const idx = this.announcements.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    this.announcements[idx] = {
      ...this.announcements[idx],
      ...data,
      updated_at: new Date().toISOString(),
    };
    this.saveAnnouncements();
    return this.announcements[idx];
  }

  public deleteAnnouncement(id: string): boolean {
    const prevLen = this.announcements.length;
    this.announcements = this.announcements.filter((a) => a.id !== id);
    if (this.announcements.length !== prevLen) {
      this.saveAnnouncements();
      return true;
    }
    return false;
  }

  // --- COUPONS ---
  public getCoupons(): ServerCoupon[] {
    return [...this.coupons];
  }

  public getCouponById(id: string): ServerCoupon | undefined {
    return this.coupons.find((c) => c.id === id);
  }

  public getCouponByCode(code: string): ServerCoupon | undefined {
    const clean = (code || "").trim().toUpperCase();
    return this.coupons.find((c) => c.code.toUpperCase() === clean);
  }

  public createCoupon(data: Partial<ServerCoupon>): ServerCoupon {
    const cleanCode = (data.code || "").trim().toUpperCase();
    const now = new Date().toISOString();
    const newCoupon: ServerCoupon = {
      id: "cpn_" + Math.random().toString(36).slice(2, 11),
      code: cleanCode,
      description: data.description || null,
      discount_type: data.discount_type === "fixed" ? "fixed" : "percent",
      discount_value: Number(data.discount_value) || 0,
      applies_to_plan: data.applies_to_plan && data.applies_to_plan !== "all" ? data.applies_to_plan : null,
      min_amount: Number(data.min_amount) || 0,
      max_uses: data.max_uses != null && data.max_uses !== ("" as any) ? Number(data.max_uses) : null,
      used_count: 0,
      starts_at: data.starts_at || null,
      expires_at: data.expires_at || null,
      active: data.active !== undefined ? Boolean(data.active) : true,
      created_at: now,
      updated_at: now,
    };
    this.coupons.unshift(newCoupon);
    this.saveCoupons();
    return newCoupon;
  }

  public updateCoupon(id: string, data: Partial<ServerCoupon>): ServerCoupon | null {
    const idx = this.coupons.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const current = this.coupons[idx];
    this.coupons[idx] = {
      ...current,
      ...data,
      code: data.code !== undefined ? data.code.trim().toUpperCase() : current.code,
      applies_to_plan: data.applies_to_plan !== undefined ? (data.applies_to_plan === "all" ? null : data.applies_to_plan) : current.applies_to_plan,
      updated_at: new Date().toISOString(),
    };
    this.saveCoupons();
    return this.coupons[idx];
  }

  public deleteCoupon(id: string): boolean {
    const prevLen = this.coupons.length;
    this.coupons = this.coupons.filter((c) => c.id !== id);
    if (this.coupons.length !== prevLen) {
      serverSupabase
        .from("coupons")
        .delete()
        .eq("id", id)
        .then();
      return true;
    }
    return false;
  }

  public validateCoupon(
    code: string,
    plan: string,
    subtotal: number,
    period?: string
  ): {
    valid: boolean;
    code: string;
    amount: number;
    label: string;
    discountType: "percent" | "amount";
    discountValue: number;
    reason?: string;
  } {
    const cleanCode = (code || "").trim().toUpperCase();
    if (!cleanCode) {
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

    const coupon = this.getCouponByCode(cleanCode);
    if (!coupon) {
      return {
        valid: false,
        code: cleanCode,
        amount: 0,
        label: "",
        discountType: "percent",
        discountValue: 0,
        reason: "The coupon code provided does not exist or is invalid.",
      };
    }

    if (!coupon.active) {
      return {
        valid: false,
        code: cleanCode,
        amount: 0,
        label: "",
        discountType: "percent",
        discountValue: 0,
        reason: "This coupon code is currently inactive.",
      };
    }

    const now = new Date();
    if (coupon.starts_at && new Date(coupon.starts_at) > now) {
      return {
        valid: false,
        code: cleanCode,
        amount: 0,
        label: "",
        discountType: "percent",
        discountValue: 0,
        reason: "This coupon promotion has not started yet.",
      };
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < now) {
      return {
        valid: false,
        code: cleanCode,
        amount: 0,
        label: "",
        discountType: "percent",
        discountValue: 0,
        reason: "This coupon code has expired.",
      };
    }

    if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) {
      return {
        valid: false,
        code: cleanCode,
        amount: 0,
        label: "",
        discountType: "percent",
        discountValue: 0,
        reason: "This coupon code has reached its maximum usage limit.",
      };
    }

    if (coupon.min_amount && subtotal < coupon.min_amount) {
      return {
        valid: false,
        code: cleanCode,
        amount: 0,
        label: "",
        discountType: "percent",
        discountValue: 0,
        reason: `Minimum order amount of $${coupon.min_amount} required for this coupon.`,
      };
    }

    // Plan & billing cycle matching validation
    const planMatch = checkPlanMatch(coupon.applies_to_plan, plan, period);
    if (!planMatch.matches) {
      return {
        valid: false,
        code: cleanCode,
        amount: 0,
        label: "",
        discountType: "percent",
        discountValue: 0,
        reason: `This coupon code is only valid for the ${planMatch.label} plan.`,
      };
    }

    const discountType = coupon.discount_type === "fixed" ? "amount" : "percent";
    const discountValue = Number(coupon.discount_value) || 0;
    const discountAmount = discountType === "percent"
      ? (subtotal * discountValue) / 100
      : discountValue;
    const label = discountType === "percent"
      ? `${discountValue}% OFF`
      : `$${discountValue.toFixed(2)} OFF`;

    return {
      valid: true,
      code: cleanCode,
      amount: +discountAmount.toFixed(2),
      label,
      discountType,
      discountValue,
    };
  }
}

export const promotionsService = new PromotionsService();
