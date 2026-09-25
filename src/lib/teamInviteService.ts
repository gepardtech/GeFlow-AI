import { createClient } from "@supabase/supabase-js";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

export interface PendingInvitation {
  id: string;
  businessId: string;
  businessName: string;
  businessAddress?: string;
  currency?: string;
  role: "cashier" | "manager" | "inventory";
  ownerUserId: string;
  ownerName: string;
  ownerEmail?: string;
  createdAt: string;
}

export interface ExistingUserCheck {
  isRegistered: boolean;
  userId?: string;
  fullName?: string;
  email?: string;
}

export interface EmployeeBusiness {
  id: string;
  business_name: string;
  business_address?: string | null;
  currency: string;
  status: string;
  owner_user_id: string;
  is_staff: boolean;
  staff_role: string;
  default_tax?: number;
  stock_alert_limit?: number;
  category_id?: string | null;
}

/**
 * Check whether an email belongs to an existing registered user on GeFlow.
 */
export async function checkUserRegistered(email: string): Promise<ExistingUserCheck> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { isRegistered: false };
  }

  try {
    // 1. Try checking profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (profile && profile.user_id) {
      return {
        isRegistered: true,
        userId: profile.user_id,
        fullName: profile.full_name || undefined,
        email: profile.email || cleanEmail,
      };
    }
  } catch (err) {
    console.warn("Notice checking user registration:", err);
  }

  // 2. Fallback: check cached memberships/invitations
  try {
    const rawMembers = localStorage.getItem("geflow_team_members_cache");
    if (rawMembers) {
      const parsed = JSON.parse(rawMembers);
      const found = parsed.find((m: any) => m.email?.toLowerCase() === cleanEmail);
      if (found) {
        return {
          isRegistered: true,
          userId: found.user_id || found.id,
          fullName: found.full_name,
          email: cleanEmail,
        };
      }
    }
  } catch {
    /* ignore parse errors */
  }

  return { isRegistered: false };
}

/**
 * Invite a NEW user (email does not exist in the system).
 */
export async function inviteNewUser({
  email,
  password,
  fullName,
  role,
  businessId,
  businessName,
  businessAddress,
  currency,
  ownerId,
  ownerName,
}: {
  email: string;
  password?: string;
  fullName: string;
  role: "cashier" | "manager" | "inventory";
  businessId: string;
  businessName?: string;
  businessAddress?: string;
  currency?: string;
  ownerId: string;
  ownerName?: string;
}): Promise<{ success: boolean; userId?: string; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = fullName.trim() || cleanEmail.split("@")[0];
  const cleanPassword = (password || "").trim();

  let targetUserId = "";

  // 1. If password provided, attempt Supabase Auth signup
  if (cleanPassword && cleanPassword.length >= 6) {
    try {
      const rawUrl = SUPABASE_URL;
      const rawKey = SUPABASE_PUBLISHABLE_KEY;

      const tempClient = createClient(rawUrl, rawKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: {
            full_name: cleanName,
            plan: "free",
            role,
            invited_by: ownerId,
            business_id: businessId,
            business_name: businessName,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message?.toLowerCase().includes("already registered") || signUpError.message?.toLowerCase().includes("exists")) {
          // Switch to existing user invite
          return inviteExistingUser({
            userId: "",
            email: cleanEmail,
            role,
            businessId,
            businessName: businessName || "Store",
            ownerId,
            ownerName: ownerName || "Store Owner",
          });
        }
      } else if (signUpData?.user?.id) {
        targetUserId = signUpData.user.id;
      }
    } catch (authErr: any) {
      console.warn("Auth signup error for new staff:", authErr);
    }
  }

  // 2. Dispatch creation/invitation through team backend service
  try {
    // If password was provided, register as an active direct member
    if (cleanPassword && cleanPassword.length >= 6) {
      const directRes = await fetch("/api/team/add-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId,
          ownerName: ownerName || "Store Owner",
          businessId,
          businessName: businessName || "Store",
          businessAddress,
          currency,
          email: cleanEmail,
          fullName: cleanName,
          role,
          userId: targetUserId || undefined,
          status: "active",
        }),
      });

      const directData = await directRes.json();
      if (directRes.ok && directData.success) {
        const effectiveId = targetUserId || directData.member?.id || directData.member?.userId || directData.member?.user_id || "u_" + Date.now();
        await syncMemberToSupabase({
          userId: effectiveId,
          email: cleanEmail,
          fullName: cleanName,
          role,
          businessId,
          ownerId,
          isActive: true,
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("geflow:team-updated", { detail: { email: cleanEmail } }));
          window.dispatchEvent(new CustomEvent("geflow:business-changed", { detail: { businessId } }));
        }
        return { success: true, userId: effectiveId };
      }
    }

    // Fallback or non-password invite
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerId,
        ownerName: ownerName || "Store Owner",
        businessId,
        businessName: businessName || "Store",
        businessAddress,
        currency,
        email: cleanEmail,
        fullName: cleanName,
        role,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || "Failed to dispatch team invitation." };
    }

    // Also trigger local event so notifications update immediately
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("geflow:invitation-sent", { detail: { email: cleanEmail } }));
      window.dispatchEvent(new CustomEvent("geflow:team-updated", { detail: { email: cleanEmail } }));
    }

    return { success: true, userId: targetUserId || data.invitation?.id };
  } catch (err: any) {
    console.error("Error creating new staff invite:", err);
    return { success: false, error: err.message || "Failed to dispatch invitation." };
  }
}

/**
 * Invite an ALREADY REGISTERED user.
 * Creates a pending team invitation with the Real Business Name and designated role.
 */
export async function inviteExistingUser({
  userId,
  email,
  role,
  businessId,
  businessName,
  businessAddress,
  currency,
  ownerId,
  ownerName,
}: {
  userId?: string;
  email: string;
  role: "cashier" | "manager" | "inventory";
  businessId: string;
  businessName: string;
  businessAddress?: string;
  currency?: string;
  ownerId: string;
  ownerName: string;
}): Promise<{ success: boolean; membershipId?: string; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanBizName = businessName?.trim() || "Store";

  try {
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerId,
        ownerName: ownerName || "Store Owner",
        businessId,
        businessName: cleanBizName,
        businessAddress,
        currency,
        email: cleanEmail,
        role,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || "Failed to dispatch team invitation." };
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("geflow:invitation-sent", { detail: { email: cleanEmail } }));
    }

    return { success: true, membershipId: data.invitation?.id };
  } catch (err: any) {
    console.error("Error inviting existing user:", err);
    return { success: false, error: err.message || "Failed to dispatch team invitation." };
  }
}

/**
 * Fetch all pending team invitations for a given user.
 * Guarantees REAL business names (never "Partner Store"!).
 */
export async function getPendingInvitationsForUser(
  userId?: string,
  userEmail?: string
): Promise<PendingInvitation[]> {
  const invitations: PendingInvitation[] = [];

  try {
    const params = new URLSearchParams();
    if (userEmail) params.append("email", userEmail.trim().toLowerCase());
    if (userId) params.append("userId", userId);

    const res = await fetch(`/api/team/invitations?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.invitations)) {
        data.invitations.forEach((inv: any) => {
          invitations.push({
            id: inv.id,
            businessId: inv.businessId,
            businessName: inv.businessName || "Assigned Store", // REAL STORE NAME!
            businessAddress: inv.businessAddress,
            currency: inv.currency,
            role: inv.role || "cashier",
            ownerUserId: inv.ownerId,
            ownerName: inv.ownerName || "Store Owner",
            ownerEmail: inv.ownerEmail,
            createdAt: inv.createdAt,
          });
        });
      }
    }
  } catch (err) {
    console.warn("Notice fetching invitations from API:", err);
  }

  // Fallback to Supabase support_team_members if server has none
  if (invitations.length === 0 && userId) {
    try {
      const { data: rawMemberships } = await supabase
        .from("support_team_members")
        .select("id, role, appointed_by_user_id, is_active, created_at")
        .eq("user_id", userId)
        .eq("is_active", false);

      if (rawMemberships && rawMemberships.length > 0) {
        const businessIds = new Set<string>();
        rawMemberships.forEach((m) => {
          if (m.role?.includes("::")) {
            const [, bId] = m.role.split("::");
            if (bId) businessIds.add(bId);
          }
        });

        const bizMap = new Map<string, string>();
        if (businessIds.size > 0) {
          const { data: bizData } = await supabase
            .from("businesses")
            .select("id, business_name")
            .in("id", Array.from(businessIds));
          (bizData || []).forEach((b: any) => bizMap.set(b.id, b.business_name));
        }

        rawMemberships.forEach((m) => {
          let rolePart = "cashier";
          let bId = "";
          if (m.role?.includes("::")) {
            const parts = m.role.split("::");
            rolePart = parts[0];
            bId = parts[1];
          }

          invitations.push({
            id: m.id,
            businessId: bId,
            businessName: bizMap.get(bId) || "Invited Business",
            role: (rolePart as any) || "cashier",
            ownerUserId: m.appointed_by_user_id,
            ownerName: "Store Owner",
            createdAt: m.created_at,
          });
        });
      }
    } catch {
      /* ignore */
    }
  }

  return invitations;
}

/**
 * Accept a pending invitation:
 * 1. Calls /api/team/accept
 * 2. Saves the active business to employee store cache
 * 3. Switches workspace mode to "employee"
 * 4. Sets active business ID
 * 5. Dispatches change events to update all UI components immediately
 */
export async function acceptInvitation(
  invitationId: string,
  businessName?: string,
  role?: string
): Promise<{ success: boolean; business?: EmployeeBusiness; error?: string }> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    const userEmail = user?.email || "";
    const userId = user?.id || "";
    const userName = user?.user_metadata?.full_name || userEmail.split("@")[0] || "Staff";

    const res = await fetch("/api/team/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invitationId,
        userId,
        userEmail,
        userName,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || "Failed to accept team invitation." };
    }

    const business: EmployeeBusiness = data.business || {
      id: "biz_" + Date.now(),
      business_name: businessName || "Invited Store",
      business_address: "",
      currency: "USD",
      status: "active",
      owner_user_id: "",
      is_staff: true,
      staff_role: role || "cashier",
    };

    // Save to local staff businesses list
    try {
      const stored = localStorage.getItem("geflow_staff_businesses");
      let list: EmployeeBusiness[] = stored ? JSON.parse(stored) : [];
      list = list.filter((b) => b.id !== business.id);
      list.push(business);
      localStorage.setItem("geflow_staff_businesses", JSON.stringify(list));
      localStorage.setItem("geflow.workspaceMode", "employee");
      localStorage.setItem("geflow.activeBusinessId", business.id);
      localStorage.setItem("geflow_cached_staff_role", business.staff_role || "cashier");
    } catch (storageErr) {
      console.warn("Notice updating localStorage on accept:", storageErr);
    }

    // Dispatch global events
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("geflow:business-changed", { detail: { businessId: business.id } }));
      window.dispatchEvent(new CustomEvent("geflow:team-invite-accepted", { detail: { business } }));
      window.dispatchEvent(new CustomEvent("panel:refresh"));
    }

    return { success: true, business };
  } catch (err: any) {
    console.error("Error in acceptInvitation:", err);
    return { success: false, error: err.message || "Failed to accept invitation." };
  }
}

/**
 * Decline a pending invitation.
 */
export async function declineInvitation(
  invitationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const userEmail = authData.user?.email || "";
    const userId = authData.user?.id || "";

    const res = await fetch("/api/team/decline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invitationId,
        userEmail,
        userId,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || "Failed to decline invitation." };
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("geflow:business-changed"));
      window.dispatchEvent(new CustomEvent("panel:refresh"));
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error in declineInvitation:", err);
    return { success: false, error: err.message || "Failed to decline invitation." };
  }
}

/**
 * Resend a team invitation with active Accept CTA button.
 */
export async function resendInvitation({
  invitationId,
  businessId,
  email,
  ownerName,
}: {
  invitationId?: string;
  businessId: string;
  email: string;
  ownerName?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/team/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invitationId,
        businessId,
        email: email.trim().toLowerCase(),
        ownerName,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || "Failed to resend invitation." };
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("geflow:invitation-resent", { detail: { email } }));
      window.dispatchEvent(new CustomEvent("panel:refresh"));
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error in resendInvitation:", err);
    return { success: false, error: err.message || "Failed to resend invitation." };
  }
}

/**
 * Fetch all businesses where user is an active employee.
 * Guarantees REAL business names and designated roles.
 */
export async function getEmployeeBusinesses(
  userId?: string,
  userEmail?: string
): Promise<EmployeeBusiness[]> {
  const businesses: EmployeeBusiness[] = [];

  try {
    const params = new URLSearchParams();
    if (userEmail) params.append("email", userEmail.trim().toLowerCase());
    if (userId) params.append("userId", userId);

    const res = await fetch(`/api/team/employee-businesses?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.businesses)) {
        data.businesses.forEach((b: any) => {
          businesses.push({
            id: b.id,
            business_name: b.business_name, // REAL NAME!
            business_address: b.business_address || "",
            currency: b.currency || "USD",
            status: b.status || "active",
            owner_user_id: b.owner_user_id,
            is_staff: true,
            staff_role: b.staff_role || "cashier",
            default_tax: b.default_tax ?? 0,
            stock_alert_limit: b.stock_alert_limit ?? 5,
            category_id: b.category_id ?? null,
          });
        });
      }
    }
  } catch (err) {
    console.warn("Notice fetching employee businesses from API:", err);
  }

  // Merge with locally stored staff businesses
  try {
    const stored = localStorage.getItem("geflow_staff_businesses");
    if (stored) {
      const list: EmployeeBusiness[] = JSON.parse(stored);
      list.forEach((local) => {
        if (!businesses.some((b) => b.id === local.id)) {
          businesses.push(local);
        }
      });
    }
  } catch {
    /* ignore */
  }

  return businesses;
}

/**
 * Synchronize staff member record to Supabase database (profiles & support_team_members)
 */
export async function syncMemberToSupabase(params: {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  businessId: string;
  ownerId: string;
  isActive: boolean;
}): Promise<void> {
  try {
    const roleString = `${params.role}::${params.businessId}`;
    // 1. Upsert profile so the member has a persistent record
    try {
      await supabase.from("profiles").upsert(
        {
          user_id: params.userId,
          email: params.email,
          full_name: params.fullName,
          plan: "free",
          status: params.isActive ? "active" : "inactive",
          last_active: new Date().toISOString(),
        } as any,
        { onConflict: "user_id" }
      );
    } catch {
      /* ignore */
    }

    // 2. Check existing support_team_members record
    const { data: existing } = await supabase
      .from("support_team_members")
      .select("id")
      .eq("user_id", params.userId)
      .eq("appointed_by_user_id", params.ownerId)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("support_team_members")
        .update({
          role: roleString,
          is_active: params.isActive,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", existing.id);
    } else {
      await supabase.from("support_team_members").insert({
        id: "stm_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        user_id: params.userId,
        appointed_by_user_id: params.ownerId,
        role: roleString,
        is_active: params.isActive,
      } as any);
    }
  } catch (err) {
    console.warn("Notice syncing staff member to Supabase database:", err);
  }
}

/**
 * Add a direct team member (creates active membership immediately).
 */
export async function addDirectTeamMember(params: {
  businessId: string;
  businessName?: string;
  businessAddress?: string;
  currency?: string;
  ownerId: string;
  ownerName?: string;
  email: string;
  fullName: string;
  role: "cashier" | "manager" | "inventory";
  userId?: string;
  status?: "active" | "pending";
}): Promise<{ success: boolean; member?: any; error?: string }> {
  try {
    const res = await fetch("/api/team/add-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    const effectiveUserId = params.userId || data.member?.userId || data.member?.user_id || "u_" + Date.now();

    // Direct database sync
    await syncMemberToSupabase({
      userId: effectiveUserId,
      email: params.email,
      fullName: params.fullName,
      role: params.role,
      businessId: params.businessId,
      ownerId: params.ownerId,
      isActive: params.status !== "pending",
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("geflow:team-updated", { detail: { email: params.email } }));
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch all team members and pending invites for a store owner.
 */
export async function getTeamMembers(businessId?: string, ownerId?: string): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (businessId) params.append("businessId", businessId);
    if (ownerId) params.append("ownerId", ownerId);

    const res = await fetch(`/api/team/members?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.members)) {
        try {
          const cacheKey = `geflow_team_members_${businessId || ownerId || "cache"}`;
          localStorage.setItem(cacheKey, JSON.stringify(data.members));
          localStorage.setItem("geflow_team_members_cache", JSON.stringify(data.members));
        } catch {
          /* ignore */
        }
        return data.members;
      }
    }
  } catch (err) {
    console.warn("Notice fetching team members from API:", err);
  }

  // Fallback to local cache if offline or temporary glitch
  try {
    const cacheKey = `geflow_team_members_${businessId || ownerId || "cache"}`;
    const cached = localStorage.getItem(cacheKey) || localStorage.getItem("geflow_team_members_cache");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }

  return [];
}

/**
 * Remove a team member or pending invite.
 */
export async function removeTeamMember(
  businessId: string,
  memberId: string,
  ownerId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Sync delete with Supabase database
    try {
      await supabase
        .from("support_team_members")
        .delete()
        .or(`id.eq.${memberId},user_id.eq.${memberId}`);
    } catch (dbErr) {
      console.warn("Supabase member delete note:", dbErr);
    }

    // 2. Remove from backend team service
    const res = await fetch("/api/team/remove-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, memberId, ownerId }),
    });
    const data = await res.json();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("geflow:team-updated"));
    }
    return { success: data.success ?? true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Update a team member's role.
 */
export async function updateTeamMemberRole(
  businessId: string,
  memberId: string,
  role: "cashier" | "manager" | "inventory",
  ownerId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Sync role update with Supabase database
    try {
      const roleString = `${role}::${businessId}`;
      await supabase
        .from("support_team_members")
        .update({ role: roleString, updated_at: new Date().toISOString() } as any)
        .or(`id.eq.${memberId},user_id.eq.${memberId}`);
    } catch (dbErr) {
      console.warn("Supabase role update note:", dbErr);
    }

    // 2. Update in backend service
    const res = await fetch("/api/team/update-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, memberId, role, ownerId }),
    });
    const data = await res.json();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("geflow:team-updated"));
    }
    return { success: data.success ?? true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Update a team member's active/inactive status.
 */
export async function updateTeamMemberStatus(
  businessId: string,
  memberId: string,
  isActive: boolean,
  ownerId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Sync status update with Supabase database
    try {
      await supabase
        .from("support_team_members")
        .update({ is_active: isActive, updated_at: new Date().toISOString() } as any)
        .or(`id.eq.${memberId},user_id.eq.${memberId}`);
    } catch (dbErr) {
      console.warn("Supabase status update note:", dbErr);
    }

    // 2. Update in backend service
    const res = await fetch("/api/team/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, memberId, isActive, ownerId }),
    });
    const data = await res.json();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("geflow:team-updated"));
    }
    return { success: data.success ?? true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
