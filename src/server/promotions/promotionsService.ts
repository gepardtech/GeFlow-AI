import fs from "fs";
import path from "path";
import { serverSupabase } from "../supabase";

const ANNOUNCEMENTS_FILE = path.join(process.cwd(), "data", "announcements.json");

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
  priority_order?: number; // 1 = 1st, 2 = 2nd, etc.
  popup_opens?: number; // Count of user opening popup by clicking CTA
  conversions?: number; // Count of user completing coupon purchase/task
  earnings?: number; // Revenue in dollars generated through announcement
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
  applies_to_plan: string | null; // e.g. null / 'all', or comma-separated 'standard,premium', 'standard_monthly,premium_monthly'
  min_amount: number;
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function formatSinglePlanLabel(target: string): string {
  switch (target.toLowerCase().replace(/[-:]/g, "_")) {
    case "standard": return "Standard (All Cycles)";
    case "standard_monthly": return "Standard Monthly";
    case "standard_yearly": return "Standard Yearly";
    case "standard_lifetime": return "Standard Lifetime";
    case "premium": return "Premium (All Cycles)";
    case "premium_monthly": return "Premium Monthly";
    case "premium_yearly": return "Premium Yearly";
    case "premium_lifetime": return "Premium Lifetime";
    case "free": return "Free Plan";
    default: return target.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function formatPlanLabel(appliesTo: string | null | undefined): string {
  if (!appliesTo || appliesTo.toLowerCase() === "all") return "All Plans";
  const items = appliesTo.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  if (items.length <= 1) return formatSinglePlanLabel(items[0] || appliesTo);
  return items.map(formatSinglePlanLabel).join(", ");
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

  const targets = appliesTo
    .split(/[,;]+/)
    .map((t) =>
      t
        .trim()
        .toLowerCase()
        .replace(/^plan\s*:\s*/i, "")
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
    )
    .filter(Boolean);

  const planKey = (currentPlan || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
  const periodKey = (currentPeriod || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "_");

  for (const target of targets) {
    if (target === "all") return { matches: true, label };
    if (target === planKey) return { matches: true, label };
    if (periodKey && target === `${planKey}_${periodKey}`) return { matches: true, label };
    if (target.startsWith(`${planKey}_`) && periodKey && target === `${planKey}_${periodKey}`) return { matches: true, label };
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
    this.loadAnnouncements();
    this.syncFromSupabase();
    this.syncAnnouncementsFromSupabase();
  }

  private async syncAnnouncementsFromSupabase(): Promise<void> {
    try {
      // 1. Fetch persistent announcements & meta from platform_settings
      let alertsMeta: Record<string, any> = {};
      let alertsAnnouncements: ServerAnnouncement[] = [];
      try {
        const { data: setRow } = await serverSupabase
          .from("platform_settings")
          .select("id, alerts")
          .limit(1)
          .maybeSingle();
        if (setRow?.alerts && typeof setRow.alerts === "object") {
          const alertsObj = setRow.alerts as any;
          alertsMeta = alertsObj.announcements_meta || {};
          if (Array.isArray(alertsObj.system_announcements) && alertsObj.system_announcements.length > 0) {
            alertsAnnouncements = alertsObj.system_announcements;
          }
        }
      } catch {
        /* ignore */
      }

      const { data, error } = await serverSupabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });

      // If we have data in Supabase (either table or platform_settings alerts), that is authoritative!
      if ((!error && Array.isArray(data) && data.length > 0) || alertsAnnouncements.length > 0) {
        const map = new Map<string, ServerAnnouncement>();
        
        // Load from alertsAnnouncements first
        alertsAnnouncements.forEach((a) => {
          if (a?.id) map.set(a.id, a);
        });

        // Merge/enrich with table rows
        if (Array.isArray(data)) {
          data.forEach((r: any) => {
            const existing = map.get(r.id);
            const meta = alertsMeta[r.id] || {};
            map.set(r.id, {
              id: r.id,
              title: r.title,
              body: r.body,
              audience: r.audience || existing?.audience || "all",
              position: r.position || existing?.position || "top",
              variant: r.variant || existing?.variant || "info",
              link_url: r.link_url !== undefined ? r.link_url : (existing?.link_url ?? null),
              link_label: r.link_label !== undefined ? r.link_label : (existing?.link_label ?? null),
              coupon_code: r.coupon_code || existing?.coupon_code || meta.coupon_code || "",
              priority_order: existing?.priority_order ?? meta.priority_order ?? (r.priority_order != null ? Number(r.priority_order) : 1),
              popup_opens: existing?.popup_opens ?? meta.popup_opens ?? 0,
              conversions: existing?.conversions ?? meta.conversions ?? 0,
              earnings: existing?.earnings ?? meta.earnings ?? 0,
              starts_at: r.starts_at || existing?.starts_at || new Date().toISOString(),
              ends_at: r.ends_at !== undefined ? r.ends_at : (existing?.ends_at ?? null),
              is_active: r.is_active !== undefined ? Boolean(r.is_active) : (existing?.is_active ?? true),
              created_at: r.created_at || existing?.created_at || new Date().toISOString(),
              updated_at: r.updated_at || existing?.updated_at || new Date().toISOString(),
            });
          });
        }

        this.announcements = Array.from(map.values()).sort((a, b) => {
          const orderA = a.priority_order != null && a.priority_order > 0 ? a.priority_order : 9999;
          const orderB = b.priority_order != null && b.priority_order > 0 ? b.priority_order : 9999;
          if (orderA !== orderB) return orderA - orderB;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        
        // Write to disk as fallback cache
        try {
          const dir = path.dirname(ANNOUNCEMENTS_FILE);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(ANNOUNCEMENTS_FILE, JSON.stringify(this.announcements, null, 2), "utf-8");
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.warn("Notice syncing announcements from Supabase:", err);
    }
  }

  private loadAnnouncements(): void {
    try {
      if (fs.existsSync(ANNOUNCEMENTS_FILE)) {
        const raw = fs.readFileSync(ANNOUNCEMENTS_FILE, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          this.announcements = list;
        }
      }
    } catch (e) {
      console.warn("Notice loading announcements from disk:", e);
    }
  }

  private async saveAnnouncements(): Promise<void> {
    try {
      const dir = path.dirname(ANNOUNCEMENTS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(ANNOUNCEMENTS_FILE, JSON.stringify(this.announcements, null, 2), "utf-8");

      // Robust persistence to platform_settings.alerts.system_announcements
      const metaMap: Record<string, any> = {};
      this.announcements.forEach((a) => {
        metaMap[a.id] = {
          priority_order: a.priority_order || 1,
          coupon_code: a.coupon_code || "",
          popup_opens: a.popup_opens || 0,
          conversions: a.conversions || 0,
          earnings: a.earnings || 0,
        };
      });

      const { data: row } = await serverSupabase.from("platform_settings").select("id, alerts").limit(1).maybeSingle();
      if (row?.id) {
        const alerts = row.alerts && typeof row.alerts === "object" ? { ...(row.alerts as any) } : {};
        alerts.announcements_meta = metaMap;
        alerts.system_announcements = this.announcements;
        await serverSupabase.from("platform_settings").update({ alerts, updated_at: new Date().toISOString() }).eq("id", row.id);
      } else {
        const alerts: any = {
          announcements_meta: metaMap,
          system_announcements: this.announcements,
        };
        await serverSupabase.from("platform_settings").insert({ singleton: true, alerts, updated_at: new Date().toISOString() });
      }
    } catch (e) {
      console.warn("Notice saving announcements to database/disk:", e);
    }
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
    return this.announcements
      .filter((a) => {
        if (activeOnly) {
          if (!a.is_active) return false;
          if (a.starts_at && new Date(a.starts_at) > now) return false;
          if (a.ends_at && new Date(a.ends_at) < now) return false;
        }
        if (position && a.position !== position) return false;
        if (audience && audience !== "all" && a.audience !== "all" && a.audience !== audience) return false;
        return true;
      })
      .sort((a, b) => {
        const orderA = a.priority_order != null && a.priority_order > 0 ? a.priority_order : 9999;
        const orderB = b.priority_order != null && b.priority_order > 0 ? b.priority_order : 9999;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }

  public getAnnouncementById(id: string): ServerAnnouncement | undefined {
    return this.announcements.find((a) => a.id === id);
  }

  public async createAnnouncement(data: Partial<ServerAnnouncement> & { created_by_user_id?: string }): Promise<ServerAnnouncement> {
    const now = new Date().toISOString();
    const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : (await import("crypto")).randomUUID();
    const isUUID = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
    const adminUserId = (data.created_by_user_id && isUUID(data.created_by_user_id))
      ? data.created_by_user_id
      : "a375b057-debe-4239-9549-9f83b5557df2";

    const newAnn: ServerAnnouncement = {
      id: newId,
      title: data.title || "Announcement",
      body: data.body || "",
      audience: data.audience || "all",
      position: data.position || "top",
      variant: data.variant || "promo",
      link_url: data.link_url || null,
      link_label: data.link_label || null,
      coupon_code: data.coupon_code || "",
      priority_order: data.priority_order != null ? Number(data.priority_order) : 1,
      popup_opens: data.popup_opens != null ? Number(data.popup_opens) : 0,
      conversions: data.conversions != null ? Number(data.conversions) : 0,
      earnings: data.earnings != null ? Number(data.earnings) : 0,
      starts_at: data.starts_at || now,
      ends_at: data.ends_at || null,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      created_at: now,
      updated_at: now,
    };

    this.announcements.unshift(newAnn);
    await this.saveAnnouncements();

    // Persist to Supabase announcements table
    try {
      const { data: inserted, error } = await serverSupabase
        .from("announcements")
        .insert({
          id: newAnn.id,
          title: newAnn.title,
          body: newAnn.body,
          audience: newAnn.audience,
          position: newAnn.position,
          variant: newAnn.variant,
          link_url: newAnn.link_url,
          link_label: newAnn.link_label,
          starts_at: newAnn.starts_at,
          ends_at: newAnn.ends_at,
          is_active: newAnn.is_active,
          created_by_user_id: adminUserId,
        })
        .select()
        .maybeSingle();

      if (error) {
        console.warn("Supabase announcement insert warning:", error.message);
      } else if (inserted?.id) {
        newAnn.id = inserted.id;
        await this.saveAnnouncements();
      }
    } catch (err: any) {
      console.warn("Supabase announcement insert notice:", err?.message || err);
    }

    return newAnn;
  }

  public async updateAnnouncement(id: string, data: Partial<ServerAnnouncement>): Promise<ServerAnnouncement | null> {
    let idx = this.announcements.findIndex((a) => a.id === id);
    if (idx === -1) {
      // Check if id matches partial or title fallback
      idx = this.announcements.findIndex((a) => a.id?.toLowerCase() === id?.toLowerCase());
    }
    if (idx === -1) return null;

    const nextOrder = data.priority_order !== undefined ? Number(data.priority_order) : (this.announcements[idx].priority_order || 1);

    this.announcements[idx] = {
      ...this.announcements[idx],
      ...data,
      priority_order: nextOrder,
      popup_opens: data.popup_opens !== undefined ? Number(data.popup_opens) : this.announcements[idx].popup_opens,
      conversions: data.conversions !== undefined ? Number(data.conversions) : this.announcements[idx].conversions,
      earnings: data.earnings !== undefined ? Number(data.earnings) : this.announcements[idx].earnings,
      ends_at: data.ends_at !== undefined ? (data.ends_at || null) : this.announcements[idx].ends_at,
      updated_at: new Date().toISOString(),
    };
    await this.saveAnnouncements();

    const isUUID = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
    if (isUUID(id)) {
      try {
        const updatePayload: any = {
          updated_at: new Date().toISOString(),
        };
        if (data.title !== undefined) updatePayload.title = data.title;
        if (data.body !== undefined) updatePayload.body = data.body;
        if (data.audience !== undefined) updatePayload.audience = data.audience;
        if (data.position !== undefined) updatePayload.position = data.position;
        if (data.variant !== undefined) updatePayload.variant = data.variant;
        if (data.link_url !== undefined) updatePayload.link_url = data.link_url;
        if (data.link_label !== undefined) updatePayload.link_label = data.link_label;
        if (data.starts_at !== undefined) updatePayload.starts_at = data.starts_at;
        if (data.ends_at !== undefined) updatePayload.ends_at = data.ends_at || null;
        if (data.is_active !== undefined) updatePayload.is_active = data.is_active;

        const { error } = await serverSupabase
          .from("announcements")
          .update(updatePayload)
          .eq("id", id);
        if (error) {
          console.warn("Supabase announcement update notice:", error.message);
        }
      } catch (err: any) {
        console.warn("Supabase announcement update notice:", err?.message || err);
      }
    }

    return this.announcements[idx];
  }

  public trackOpen(id: string): boolean {
    const item = this.announcements.find((a) => a.id === id);
    if (item) {
      item.popup_opens = (item.popup_opens || 0) + 1;
      item.updated_at = new Date().toISOString();
      this.saveAnnouncements().catch(() => {});
      return true;
    }
    return false;
  }

  public trackConversion(idOrCoupon: string, amount: number): boolean {
    if (!idOrCoupon) return false;
    const clean = idOrCoupon.trim().toUpperCase();
    const item = this.announcements.find(
      (a) => a.id === idOrCoupon || (a.coupon_code && a.coupon_code.toUpperCase() === clean)
    );
    if (item) {
      item.conversions = (item.conversions || 0) + 1;
      item.earnings = Number(((item.earnings || 0) + (Number(amount) || 0)).toFixed(2));
      item.updated_at = new Date().toISOString();
      this.saveAnnouncements().catch(() => {});
      return true;
    }
    return false;
  }

  public getAnalytics() {
    let totalOpens = 0;
    let totalConversions = 0;
    let totalEarnings = 0;

    for (const a of this.announcements) {
      totalOpens += a.popup_opens || 0;
      totalConversions += a.conversions || 0;
      totalEarnings += a.earnings || 0;
    }

    return {
      totalOpens,
      totalConversions,
      totalEarnings: Number(totalEarnings.toFixed(2)),
      conversionRate: totalOpens > 0 ? Number(((totalConversions / totalOpens) * 100).toFixed(1)) : 0,
    };
  }

  public async deleteAnnouncement(id: string): Promise<boolean> {
    const prevLen = this.announcements.length;
    this.announcements = this.announcements.filter((a) => a.id !== id);
    if (this.announcements.length !== prevLen) {
      await this.saveAnnouncements();
      const isUUID = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
      if (isUUID(id)) {
        try {
          await serverSupabase
            .from("announcements")
            .delete()
            .eq("id", id);
        } catch (err) {
          console.warn("Supabase announcement delete notice:", err);
        }
      }
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
