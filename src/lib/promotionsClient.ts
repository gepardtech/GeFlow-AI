import { supabase } from "@/integrations/supabase/client";

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  audience: string;
  position: string;
  variant: string;
  link_url: string | null;
  link_label: string | null;
  coupon_code?: string;
  priority_order?: number; // 1 = 1st, 2 = 2nd, etc.
  popup_opens?: number; // Clicks on CTA opening popup
  conversions?: number; // Purchases / coupons redeemed
  earnings?: number; // Revenue generated ($)
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CouponItem {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed" | string;
  discount_value: number;
  applies_to_plan: string | null;
  min_amount: number;
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  updated_at?: string;
}

export function formatSinglePlanTargetLabel(target: string): string {
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

export function formatPlanTargetLabel(appliesTo: string | null | undefined): string {
  if (!appliesTo || appliesTo.toLowerCase() === "all") return "All Plans";
  const items = appliesTo.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  if (items.length <= 1) return formatSinglePlanTargetLabel(items[0] || appliesTo);
  return items.map(formatSinglePlanTargetLabel).join(", ");
}

export function isPlanMatching(
  appliesTo: string | null | undefined,
  currentPlan: string,
  currentPeriod?: string
): { matches: boolean; label: string } {
  const label = formatPlanTargetLabel(appliesTo);
  if (!appliesTo || appliesTo.toLowerCase() === "all") {
    return { matches: true, label };
  }

  const targets = appliesTo
    .split(/[,;]+/)
    .map((s) =>
      s
        .trim()
        .toLowerCase()
        .replace(/^plan\s*:\s*/i, "")
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
    )
    .filter(Boolean);

  const p = (currentPlan || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
  const c = (currentPeriod || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "_");

  for (const target of targets) {
    if (target === "all") return { matches: true, label };
    if (target === p) return { matches: true, label };
    if (c && target === `${p}_${c}`) return { matches: true, label };
    if (target.startsWith(`${p}_`) && c && target === `${p}_${c}`) return { matches: true, label };
  }

  return { matches: false, label };
}

// -------------------------------------------------------------
// ANNOUNCEMENTS CLIENT OPERATIONS
// -------------------------------------------------------------
export async function getLiveAnnouncements(
  activeOnly: boolean = false,
  audience?: string,
  position?: string
): Promise<AnnouncementItem[]> {
  let apiItems: AnnouncementItem[] = [];

  // 1. Try server API first
  try {
    const q = new URLSearchParams();
    if (activeOnly) q.set("activeOnly", "true");
    if (audience && audience !== "all") q.set("audience", audience);
    if (position) q.set("position", position);

    const res = await fetch(`/api/announcements?${q.toString()}`);
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.announcements)) {
        apiItems = json.announcements;
        try {
          localStorage.setItem("geflow_cached_announcements", JSON.stringify(apiItems));
        } catch {
          /* ignore */
        }
      }
    }
  } catch (err) {
    console.warn("API announcements notice:", err);
  }

  // Fallback to local cache if API failed
  if (apiItems.length === 0) {
    try {
      const cached = localStorage.getItem("geflow_cached_announcements");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          apiItems = parsed;
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Helper filter function
  const matchFilter = (a: AnnouncementItem) => {
    if (activeOnly && !a.is_active) return false;
    if (audience && audience !== "all" && a.audience && a.audience !== "all") {
      if (a.audience.toLowerCase() !== audience.toLowerCase()) return false;
    }
    if (position) {
      const itemPos = (a.position || "top").toLowerCase();
      if (itemPos !== position.toLowerCase()) return false;
    }
    return true;
  };

  // 2. Also check Supabase for real-time sync
  try {
    let query = supabase.from("announcements").select("*");
    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    if (position) {
      query = query.eq("position", position.toLowerCase());
    }
    const { data } = await query.order("created_at", { ascending: false });
    if (data && data.length > 0) {
      // Merge unique by ID with Supabase taking priority if active
      const sbItems = (data as unknown as AnnouncementItem[]).filter(matchFilter);

      const map = new Map<string, AnnouncementItem>();
      apiItems.filter(matchFilter).forEach((item) => map.set(item.id, item));
      sbItems.forEach((item) => {
        const existing = map.get(item.id);
        map.set(item.id, {
          ...existing,
          ...item,
          priority_order: existing?.priority_order ?? (item as any).priority_order ?? 1,
          coupon_code: existing?.coupon_code || (item as any).coupon_code || "",
          popup_opens: existing?.popup_opens ?? (item as any).popup_opens ?? 0,
          conversions: existing?.conversions ?? (item as any).conversions ?? 0,
          earnings: existing?.earnings ?? (item as any).earnings ?? 0,
        });
      });
      const merged = Array.from(map.values())
        .filter(matchFilter)
        .sort((a, b) => {
          const orderA = a.priority_order != null && a.priority_order > 0 ? a.priority_order : 9999;
          const orderB = b.priority_order != null && b.priority_order > 0 ? b.priority_order : 9999;
          if (orderA !== orderB) return orderA - orderB;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      return merged;
    }
  } catch (err) {
    console.warn("Supabase announcements notice:", err);
  }

  return apiItems
    .filter(matchFilter)
    .sort((a, b) => {
      const orderA = a.priority_order != null && a.priority_order > 0 ? a.priority_order : 9999;
      const orderB = b.priority_order != null && b.priority_order > 0 ? b.priority_order : 9999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

export async function saveLiveAnnouncement(
  payload: Partial<AnnouncementItem>,
  editId?: string
): Promise<{ success: boolean; data?: AnnouncementItem; error?: string }> {
  // 1. Save to API
  let saved: AnnouncementItem | undefined;
  try {
    const url = editId ? `/api/announcements/${editId}` : `/api/announcements`;
    const method = editId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const json = await res.json();
      saved = json.announcement;
    }
  } catch (err: any) {
    console.warn("API announcement save notice:", err?.message);
  }

  // Ensure saved record is locally cached immediately
  try {
    const cached = localStorage.getItem("geflow_cached_announcements");
    let list: AnnouncementItem[] = cached ? JSON.parse(cached) : [];
    if (!Array.isArray(list)) list = [];

    const effectiveItem: AnnouncementItem = saved || {
      id: editId || `ann_${Date.now()}`,
      title: payload.title || "Announcement",
      body: payload.body || "",
      audience: payload.audience || "all",
      position: payload.position || "top",
      variant: payload.variant || "promo",
      link_url: payload.link_url || null,
      link_label: payload.link_label || null,
      coupon_code: payload.coupon_code || "",
      priority_order: payload.priority_order != null ? Number(payload.priority_order) : 1,
      popup_opens: payload.popup_opens != null ? Number(payload.popup_opens) : 0,
      conversions: payload.conversions != null ? Number(payload.conversions) : 0,
      earnings: payload.earnings != null ? Number(payload.earnings) : 0,
      starts_at: payload.starts_at || new Date().toISOString(),
      ends_at: payload.ends_at || null,
      is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (editId) {
      const idx = list.findIndex((a) => a.id === editId);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...effectiveItem };
      } else {
        list.unshift(effectiveItem);
      }
    } else {
      list.unshift(effectiveItem);
    }
    // Re-sort cached list by priority
    list.sort((a, b) => {
      const orderA = a.priority_order != null && a.priority_order > 0 ? a.priority_order : 9999;
      const orderB = b.priority_order != null && b.priority_order > 0 ? b.priority_order : 9999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    localStorage.setItem("geflow_cached_announcements", JSON.stringify(list));
    if (!saved) saved = effectiveItem;
  } catch (e) {
    console.warn("Local storage announcement cache notice:", e);
  }

  // 2. Sync core columns to Supabase if valid UUID (omit non-existent columns)
  try {
    const isUUID = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
    const { data: { user } } = await supabase.auth.getUser();
    const sbPayload: any = {};
    if (payload.title !== undefined) sbPayload.title = payload.title;
    if (payload.body !== undefined) sbPayload.body = payload.body;
    if (payload.audience !== undefined) sbPayload.audience = payload.audience;
    if (payload.position !== undefined) sbPayload.position = payload.position;
    if (payload.variant !== undefined) sbPayload.variant = payload.variant;
    if (payload.link_url !== undefined) sbPayload.link_url = payload.link_url;
    if (payload.link_label !== undefined) sbPayload.link_label = payload.link_label;
    if (payload.starts_at !== undefined) sbPayload.starts_at = payload.starts_at;
    if (payload.ends_at !== undefined) sbPayload.ends_at = payload.ends_at;
    if (payload.is_active !== undefined) sbPayload.is_active = payload.is_active;
    if (user?.id) sbPayload.created_by_user_id = user.id;

    if (Object.keys(sbPayload).length > 0) {
      if (editId && isUUID(editId)) {
        await supabase.from("announcements").update(sbPayload).eq("id", editId);
      } else if (!saved && user?.id && !editId) {
        // Only fallback insert if backend API failed to respond
        await supabase.from("announcements").insert(sbPayload);
      }
    }
  } catch (err: any) {
    console.warn("Supabase announcement sync notice:", err?.message);
  }

  window.dispatchEvent(new CustomEvent("geflow:announcements-updated"));
  return { success: true, data: saved };
}

export async function trackAnnouncementPopupOpen(id: string): Promise<void> {
  if (!id) return;
  try {
    // 1. Call server API
    fetch(`/api/announcements/${id}/track-open`, { method: "POST" }).catch(() => {});

    // 2. Update local storage
    const cached = localStorage.getItem("geflow_cached_announcements");
    if (cached) {
      const list: AnnouncementItem[] = JSON.parse(cached);
      const item = list.find((a) => a.id === id);
      if (item) {
        item.popup_opens = (item.popup_opens || 0) + 1;
        localStorage.setItem("geflow_cached_announcements", JSON.stringify(list));
      }
    }

    // 3. Increment analytics store
    const analyticsRaw = localStorage.getItem("geflow_announcement_analytics") || "{}";
    const analytics = JSON.parse(analyticsRaw);
    if (!analytics[id]) {
      analytics[id] = { popup_opens: 0, conversions: 0, earnings: 0 };
    }
    analytics[id].popup_opens = (analytics[id].popup_opens || 0) + 1;
    localStorage.setItem("geflow_announcement_analytics", JSON.stringify(analytics));
    window.dispatchEvent(new CustomEvent("geflow:announcement-analytics-updated"));
  } catch {
    /* ignore */
  }
}

export async function trackAnnouncementConversion(idOrCoupon: string, orderAmount: number): Promise<void> {
  if (!idOrCoupon) return;
  try {
    const clean = idOrCoupon.trim().toUpperCase();
    // 1. Call server API
    fetch(`/api/announcements/track-conversion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: clean, amount: orderAmount }),
    }).catch(() => {});

    // 2. Update local cache
    const cached = localStorage.getItem("geflow_cached_announcements");
    if (cached) {
      const list: AnnouncementItem[] = JSON.parse(cached);
      const item = list.find((a) => a.id === idOrCoupon || (a.coupon_code && a.coupon_code.toUpperCase() === clean));
      if (item) {
        item.conversions = (item.conversions || 0) + 1;
        item.earnings = Number(((item.earnings || 0) + orderAmount).toFixed(2));
        localStorage.setItem("geflow_cached_announcements", JSON.stringify(list));

        const analyticsRaw = localStorage.getItem("geflow_announcement_analytics") || "{}";
        const analytics = JSON.parse(analyticsRaw);
        if (!analytics[item.id]) {
          analytics[item.id] = { popup_opens: 0, conversions: 0, earnings: 0 };
        }
        analytics[item.id].conversions = (analytics[item.id].conversions || 0) + 1;
        analytics[item.id].earnings = Number(((analytics[item.id].earnings || 0) + orderAmount).toFixed(2));
        localStorage.setItem("geflow_announcement_analytics", JSON.stringify(analytics));
        window.dispatchEvent(new CustomEvent("geflow:announcement-analytics-updated"));
      }
    }
  } catch {
    /* ignore */
  }
}

export async function toggleLiveAnnouncementActive(
  id: string,
  nextActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await fetch(`/api/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: nextActive }),
    });
  } catch (err) {
    console.warn("API toggle notice:", err);
  }

  try {
    await supabase.from("announcements").update({ is_active: nextActive }).eq("id", id);
  } catch (err) {
    console.warn("Supabase toggle notice:", err);
  }

  window.dispatchEvent(new CustomEvent("geflow:announcements-updated"));
  return { success: true };
}

export async function deleteLiveAnnouncement(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await fetch(`/api/announcements/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("API delete notice:", err);
  }

  try {
    await supabase.from("announcements").delete().eq("id", id);
  } catch (err) {
    console.warn("Supabase delete notice:", err);
  }

  window.dispatchEvent(new CustomEvent("geflow:announcements-updated"));
  return { success: true };
}

// -------------------------------------------------------------
// COUPONS CLIENT OPERATIONS
// -------------------------------------------------------------
export async function getLiveCoupons(): Promise<CouponItem[]> {
  let apiCoupons: CouponItem[] = [];

  try {
    const res = await fetch("/api/coupons");
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.coupons)) {
        apiCoupons = json.coupons;
      }
    }
  } catch (err) {
    console.warn("API coupons notice:", err);
  }

  try {
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    if (data && data.length > 0) {
      const map = new Map<string, CouponItem>();
      apiCoupons.forEach((c) => map.set(c.code.toUpperCase(), c));
      (data as unknown as CouponItem[]).forEach((c) => map.set(c.code.toUpperCase(), c));
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
  } catch (err) {
    console.warn("Supabase coupons notice:", err);
  }

  return apiCoupons;
}

export async function saveLiveCoupon(
  payload: Partial<CouponItem>,
  editId?: string
): Promise<{ success: boolean; data?: CouponItem; error?: string }> {
  let saved: CouponItem | undefined;

  try {
    const url = editId ? `/api/coupons/${editId}` : `/api/coupons`;
    const method = editId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const json = await res.json();
      saved = json.coupon;
    }
  } catch (err: any) {
    console.warn("API coupon save notice:", err?.message);
  }

  try {
    const sbPayload: any = {
      code: payload.code?.trim().toUpperCase(),
      description: payload.description || null,
      discount_type: payload.discount_type,
      discount_value: Number(payload.discount_value) || 0,
      applies_to_plan: payload.applies_to_plan === "all" ? null : payload.applies_to_plan,
      min_amount: Number(payload.min_amount) || 0,
      max_uses: payload.max_uses != null && payload.max_uses !== ("" as any) ? Number(payload.max_uses) : null,
      expires_at: payload.expires_at ? new Date(payload.expires_at).toISOString() : null,
      active: payload.active,
    };

    if (editId) {
      await supabase.from("coupons").update(sbPayload).eq("id", editId);
    } else {
      await supabase.from("coupons").insert(sbPayload);
    }
  } catch (err: any) {
    console.warn("Supabase coupon save notice:", err?.message);
  }

  window.dispatchEvent(new CustomEvent("geflow:coupons-updated"));
  return { success: true, data: saved };
}

export async function toggleLiveCouponActive(
  id: string,
  nextActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await fetch(`/api/coupons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: nextActive }),
    });
  } catch (err) {
    console.warn("API toggle coupon notice:", err);
  }

  try {
    await supabase.from("coupons").update({ active: nextActive }).eq("id", id);
  } catch (err) {
    console.warn("Supabase toggle coupon notice:", err);
  }

  window.dispatchEvent(new CustomEvent("geflow:coupons-updated"));
  return { success: true };
}

export async function deleteLiveCoupon(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await fetch(`/api/coupons/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("API delete coupon notice:", err);
  }

  try {
    await supabase.from("coupons").delete().eq("id", id);
  } catch (err) {
    console.warn("Supabase delete coupon notice:", err);
  }

  window.dispatchEvent(new CustomEvent("geflow:coupons-updated"));
  return { success: true };
}
