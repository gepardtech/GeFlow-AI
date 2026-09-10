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

export function formatPlanTargetLabel(appliesTo: string | null | undefined): string {
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
    default: return appliesTo.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
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

  const target = appliesTo.trim().toLowerCase()
    .replace(/^plan\s*:\s*/i, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  const p = (currentPlan || "").trim().toLowerCase()
    .replace(/[^a-z0-9]/g, "_");
  const c = (currentPeriod || "").trim().toLowerCase()
    .replace(/[^a-z0-9]/g, "_");

  // If target matches entire tier, e.g. "standard" or "premium"
  if (target === p) {
    return { matches: true, label };
  }

  // If target matches specific plan + billing cycle, e.g. "premium_lifetime"
  if (c && target === `${p}_${c}`) {
    return { matches: true, label };
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
      }
    }
  } catch (err) {
    console.warn("API announcements notice:", err);
  }

  // 2. Also check Supabase for real-time sync
  try {
    let query = supabase.from("announcements").select("*");
    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    if (position) {
      query = query.eq("position", position);
    }
    const { data } = await query.order("created_at", { ascending: false });
    if (data && data.length > 0) {
      // Merge unique by ID with Supabase taking priority if active
      const sbItems = (data as unknown as AnnouncementItem[]).filter((a) => {
        if (activeOnly && !a.is_active) return false;
        if (audience && audience !== "all" && a.audience !== "all" && a.audience !== audience) return false;
        return true;
      });

      const map = new Map<string, AnnouncementItem>();
      apiItems.forEach((item) => map.set(item.id, item));
      sbItems.forEach((item) => map.set(item.id, item));
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
  } catch (err) {
    console.warn("Supabase announcements notice:", err);
  }

  return apiItems;
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

  // 2. Sync to Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const sbPayload: any = {
      title: payload.title,
      body: payload.body,
      audience: payload.audience,
      position: payload.position,
      variant: payload.variant,
      link_url: payload.link_url,
      link_label: payload.link_label,
      starts_at: payload.starts_at,
      ends_at: payload.ends_at,
      is_active: payload.is_active,
    };
    if (user?.id) sbPayload.created_by_user_id = user.id;

    if (editId) {
      await supabase.from("announcements").update(sbPayload).eq("id", editId);
    } else if (user?.id) {
      await supabase.from("announcements").insert(sbPayload);
    }
  } catch (err: any) {
    console.warn("Supabase announcement sync notice:", err?.message);
  }

  window.dispatchEvent(new CustomEvent("geflow:announcements-updated"));
  return { success: true, data: saved };
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
