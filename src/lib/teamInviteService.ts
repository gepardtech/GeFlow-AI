import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface PendingInvitation {
  id: string;
  businessId: string;
  businessName: string;
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

/**
 * Check whether an email belongs to an existing registered user on GeFlow.
 */
export async function checkUserRegistered(email: string): Promise<ExistingUserCheck> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { isRegistered: false };
  }

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (error) {
      console.warn("Error checking existing user profile:", error);
    }

    if (profile && profile.user_id) {
      return {
        isRegistered: true,
        userId: profile.user_id,
        fullName: profile.full_name || undefined,
        email: profile.email || cleanEmail,
      };
    }
  } catch (err) {
    console.warn("Exception checking user registration:", err);
  }

  return { isRegistered: false };
}

/**
 * Invite a NEW user (email does NOT exist in the system).
 * Creates Auth account with owner-provided password, updates profile,
 * and sets membership as active for the specified business.
 */
export async function inviteNewUser({
  email,
  password,
  fullName,
  role,
  businessId,
  ownerId,
}: {
  email: string;
  password: string;
  fullName: string;
  role: "cashier" | "manager" | "inventory";
  businessId: string;
  ownerId: string;
}): Promise<{ success: boolean; userId?: string; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = fullName.trim();
  const cleanPassword = password.trim();

  if (!cleanEmail || !cleanPassword || cleanPassword.length < 6) {
    return { success: false, error: "Valid email and a password of at least 6 characters are required." };
  }

  let targetUserId = "";

  // 1. Try secondary client signup without persisting session
  try {
    const rawUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder-project.supabase.co";
    const rawKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "placeholder-anon-key";

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
        },
      },
    });

    if (signUpError) {
      // If user already registered was returned by Auth, signal that
      if (signUpError.message?.toLowerCase().includes("already registered") || signUpError.message?.toLowerCase().includes("exists")) {
        return {
          success: false,
          error: "This email is already registered in the authentication system. Please invite as an existing user.",
        };
      }
      throw signUpError;
    }

    if (signUpData?.user?.id) {
      targetUserId = signUpData.user.id;
    }
  } catch (authErr: any) {
    console.warn("Secondary auth signup error:", authErr);
    // If we couldn't signup via client, generate target id fallback
    if (!targetUserId) {
      targetUserId = crypto.randomUUID();
    }
  }

  try {
    // 2. Upsert profile with free plan
    await supabase.from("profiles").upsert(
      {
        user_id: targetUserId,
        full_name: cleanName,
        email: cleanEmail,
        status: "active",
        plan: "free",
      },
      { onConflict: "user_id" }
    );

    // 3. Ensure standard user role (never platform admin)
    await supabase.from("user_roles").upsert(
      {
        user_id: targetUserId,
        role: "user",
      },
      { onConflict: "user_id" }
    );

    // 4. Create active membership linked to specific business
    const roleString = `${role}::${businessId}`;
    const { error: insertErr } = await supabase.from("support_team_members").insert({
      user_id: targetUserId,
      appointed_by_user_id: ownerId,
      role: roleString,
      is_active: true,
    });

    if (insertErr) {
      console.error("Failed to insert active membership:", insertErr);
      return { success: false, error: insertErr.message || "Failed to save team membership." };
    }

    return { success: true, userId: targetUserId };
  } catch (dbErr: any) {
    console.error("Database sync error for new user invite:", dbErr);
    return { success: false, error: dbErr?.message || "Failed to persist new team member record." };
  }
}

/**
 * Invite an ALREADY REGISTERED user.
 * Creates a PENDING membership (is_active: false) and creates an in-app notification.
 */
export async function inviteExistingUser({
  userId,
  email,
  role,
  businessId,
  businessName,
  ownerId,
  ownerName,
}: {
  userId: string;
  email: string;
  role: "cashier" | "manager" | "inventory";
  businessId: string;
  businessName: string;
  ownerId: string;
  ownerName: string;
}): Promise<{ success: boolean; membershipId?: string; error?: string }> {
  try {
    const roleString = `${role}::${businessId}`;

    // Check if membership already exists for this user and business
    const { data: existingMemberships } = await supabase
      .from("support_team_members")
      .select("id, role, is_active")
      .eq("user_id", userId)
      .eq("appointed_by_user_id", ownerId);

    const match = (existingMemberships || []).find((m) => {
      if (m.role?.includes("::")) {
        return m.role.split("::")[1] === businessId;
      }
      return false;
    });

    if (match) {
      if (match.is_active) {
        return {
          success: false,
          error: `This user already has active access to "${businessName}" as ${match.role.split("::")[0].toUpperCase()}.`,
        };
      }
      // If pending, update the role and refresh
      const { error: updErr } = await supabase
        .from("support_team_members")
        .update({
          role: roleString,
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", match.id);

      if (updErr) {
        return { success: false, error: updErr.message };
      }

      await sendInvitationNotification({
        userId,
        businessName,
        ownerName,
        role,
        businessId,
      });

      return { success: true, membershipId: match.id };
    }

    // Insert new pending membership
    const { data: inserted, error: insErr } = await supabase
      .from("support_team_members")
      .insert({
        user_id: userId,
        appointed_by_user_id: ownerId,
        role: roleString,
        is_active: false, // Pending until accepted!
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("Failed to insert pending membership:", insErr);
      return { success: false, error: insErr.message || "Failed to create pending membership." };
    }

    // Dispatch notification
    await sendInvitationNotification({
      userId,
      businessName,
      ownerName,
      role,
      businessId,
    });

    return { success: true, membershipId: inserted?.id };
  } catch (err: any) {
    console.error("Error inviting existing user:", err);
    return { success: false, error: err?.message || "Failed to dispatch team invitation." };
  }
}

/**
 * Internal helper to record notification for the invited user.
 */
async function sendInvitationNotification({
  userId,
  businessName,
  ownerName,
  role,
}: {
  userId: string;
  businessName: string;
  ownerName: string;
  role: string;
  businessId: string;
}) {
  try {
    const roleTitle = role === "cashier" ? "Cashier" : role === "inventory" ? "Inventory Clerk" : "Manager";
    await supabase.from("announcements").insert({
      title: `Team Invitation: ${businessName}`,
      body: `${ownerName || "A business owner"} invited you to join "${businessName}" as a ${roleTitle}. Click Accept below to activate your workspace access.`,
      audience: `user:${userId}`,
      link_label: "Accept Invitation",
      link_url: "/dashboard/announcements/notifications",
      created_by_user_id: userId, // associate or owner
      is_active: true,
      variant: "info",
      position: "top",
      starts_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Notice inserting notification announcement:", err);
  }

  // Dispatch local notification event so if recipient is in the same browser, it updates immediately
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("geflow:invitation-received", { detail: { userId } }));
  }
}

/**
 * Fetch all pending team invitations for a given user.
 */
export async function getPendingInvitationsForUser(userId: string): Promise<PendingInvitation[]> {
  try {
    const { data: rawMemberships, error } = await supabase
      .from("support_team_members")
      .select("id, role, appointed_by_user_id, is_active, created_at")
      .eq("user_id", userId)
      .eq("is_active", false);

    if (error || !rawMemberships || rawMemberships.length === 0) {
      return [];
    }

    const invitations: PendingInvitation[] = [];
    const businessIds = new Set<string>();
    const ownerIds = new Set<string>();

    rawMemberships.forEach((m) => {
      if (m.role?.includes("::")) {
        const [, bId] = m.role.split("::");
        if (bId) businessIds.add(bId);
      }
      if (m.appointed_by_user_id) {
        ownerIds.add(m.appointed_by_user_id);
      }
    });

    const [bizRes, profRes] = await Promise.all([
      businessIds.size > 0
        ? supabase.from("businesses").select("id, business_name").in("id", Array.from(businessIds))
        : Promise.resolve({ data: [] as any[] }),
      ownerIds.size > 0
        ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", Array.from(ownerIds))
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const bizMap = new Map<string, string>();
    (bizRes.data || []).forEach((b: any) => bizMap.set(b.id, b.business_name));

    const profMap = new Map<string, { name: string; email: string }>();
    (profRes.data || []).forEach((p: any) => profMap.set(p.user_id, { name: p.full_name || "Store Owner", email: p.email || "" }));

    rawMemberships.forEach((m) => {
      let rolePart = "cashier";
      let bId = "";

      if (m.role?.includes("::")) {
        const parts = m.role.split("::");
        rolePart = parts[0];
        bId = parts[1];
      }

      const businessName = bizMap.get(bId) || "Partner Store";
      const ownerInfo = profMap.get(m.appointed_by_user_id) || { name: "Store Owner", email: "" };

      invitations.push({
        id: m.id,
        businessId: bId,
        businessName,
        role: (rolePart as any) || "cashier",
        ownerUserId: m.appointed_by_user_id,
        ownerName: ownerInfo.name,
        ownerEmail: ownerInfo.email,
        createdAt: m.created_at,
      });
    });

    return invitations;
  } catch (err) {
    console.error("Error fetching pending invitations:", err);
    return [];
  }
}

/**
 * Accept a pending invitation: converts membership to is_active = true.
 */
export async function acceptInvitation(membershipId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("support_team_members")
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", membershipId);

    if (error) {
      return { success: false, error: error.message };
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("geflow:business-changed"));
      window.dispatchEvent(new CustomEvent("geflow:team-invite-accepted"));
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to accept invitation." };
  }
}

/**
 * Decline a pending invitation: removes the membership row.
 */
export async function declineInvitation(membershipId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("support_team_members")
      .delete()
      .eq("id", membershipId);

    if (error) {
      return { success: false, error: error.message };
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("geflow:business-changed"));
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to decline invitation." };
  }
}
