import { serverSupabase } from "../supabase";

export interface TeamInvitation {
  id: string;
  businessId: string;
  businessName: string;
  businessAddress?: string;
  currency?: string;
  role: "cashier" | "manager" | "inventory";
  permissions?: string[];
  ownerId: string;
  ownerName: string;
  ownerEmail?: string;
  inviteeEmail: string;
  inviteeUserId?: string;
  inviteeName?: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  updatedAt: string;
}

export interface TeamMembership {
  id: string;
  businessId: string;
  businessName: string;
  businessAddress?: string;
  currency?: string;
  userId: string;
  userEmail: string;
  userName: string;
  ownerId: string;
  role: "cashier" | "manager" | "inventory";
  permissions?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamNotification {
  id: string;
  targetEmail: string;
  targetUserId?: string;
  type: "team_invite" | "invite_accepted" | "general";
  title: string;
  message: string;
  inviteId?: string;
  businessId: string;
  businessName: string;
  role: string;
  ownerName: string;
  isRead: boolean;
  createdAt: string;
}

interface TeamDataStore {
  invitations: TeamInvitation[];
  memberships: TeamMembership[];
  notifications: TeamNotification[];
}

export class TeamService {
  private store: TeamDataStore = {
    invitations: [],
    memberships: [],
    notifications: [],
  };
  private isInitialized = false;

  constructor() {
    this.syncFromSupabase();
  }

  private async syncFromSupabase(): Promise<void> {
    try {
      const { data: staffList, error } = await serverSupabase
        .from("business_staff")
        .select("*, businesses(id, business_name, business_address, currency, owner_user_id)");

      if (!error && Array.isArray(staffList)) {
        staffList.forEach((s: any) => {
          const biz = s.businesses || {};
          const bizId = s.business_id;
          const bizName = biz.business_name || "Store";
          const ownerId = biz.owner_user_id || s.invited_by || "";
          const role = (s.role || "cashier") as "cashier" | "manager" | "inventory";
          const perms = Array.isArray(s.permissions) ? s.permissions : ["pos"];

          if (s.status === "pending") {
            const exists = this.store.invitations.some(
              (i) => i.businessId === bizId && i.inviteeEmail.toLowerCase() === s.invited_email.toLowerCase()
            );
            if (!exists) {
              this.store.invitations.push({
                id: s.id,
                businessId: bizId,
                businessName: bizName,
                businessAddress: biz.business_address || undefined,
                currency: biz.currency || "USD",
                role,
                permissions: perms,
                ownerId,
                ownerName: "Store Owner",
                inviteeEmail: s.invited_email,
                inviteeUserId: s.user_id || undefined,
                status: "pending",
                createdAt: s.created_at || new Date().toISOString(),
                updatedAt: s.updated_at || new Date().toISOString(),
              });
            }
          } else {
            const exists = this.store.memberships.some(
              (m) => m.businessId === bizId && (m.userEmail.toLowerCase() === s.invited_email.toLowerCase() || (s.user_id && m.userId === s.user_id))
            );
            if (!exists) {
              this.store.memberships.push({
                id: s.id,
                businessId: bizId,
                businessName: bizName,
                businessAddress: biz.business_address || undefined,
                currency: biz.currency || "USD",
                userId: s.user_id || s.id,
                userEmail: s.invited_email,
                userName: s.invited_email.split("@")[0],
                ownerId,
                role,
                permissions: perms,
                isActive: s.status === "active",
                createdAt: s.created_at || new Date().toISOString(),
                updatedAt: s.updated_at || new Date().toISOString(),
              });
            }
          }
        });
      }
      this.isInitialized = true;
    } catch (err) {
      console.warn("Supabase staff sync notice:", err);
      this.isInitialized = true;
    }
  }

  private refresh() {
    if (!this.isInitialized) {
      this.syncFromSupabase();
    }
  }

  public createInvitation(params: {
    ownerId: string;
    ownerName: string;
    ownerEmail?: string;
    businessId: string;
    businessName: string;
    businessAddress?: string;
    currency?: string;
    email: string;
    fullName?: string;
    role: "cashier" | "manager" | "inventory";
    permissions?: string[];
  }): { success: boolean; invitation?: TeamInvitation; error?: string } {
    this.refresh();
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanBizName = params.businessName?.trim() || "Store";
    const cleanRole = params.role || "cashier";

    // Check if user already has an active membership for this business
    const existingMembership = this.store.memberships.find(
      (m) =>
        m.businessId === params.businessId &&
        m.userEmail.toLowerCase() === cleanEmail &&
        m.isActive
    );

    if (existingMembership) {
      return {
        success: false,
        error: `User "${cleanEmail}" already has active access to "${cleanBizName}" as ${existingMembership.role.toUpperCase()}.`,
      };
    }

    // Check for existing pending invitation
    const existingIndex = this.store.invitations.findIndex(
      (inv) =>
        inv.businessId === params.businessId &&
        inv.inviteeEmail.toLowerCase() === cleanEmail &&
        inv.status === "pending"
    );

    const now = new Date().toISOString();
    let invitation: TeamInvitation;

    if (existingIndex >= 0) {
      invitation = {
        ...this.store.invitations[existingIndex],
        businessName: cleanBizName,
        businessAddress: params.businessAddress || this.store.invitations[existingIndex].businessAddress,
        currency: params.currency || this.store.invitations[existingIndex].currency,
        role: cleanRole,
        permissions: params.permissions || this.store.invitations[existingIndex].permissions,
        ownerName: params.ownerName || this.store.invitations[existingIndex].ownerName,
        ownerEmail: params.ownerEmail || this.store.invitations[existingIndex].ownerEmail,
        updatedAt: now,
      };
      this.store.invitations[existingIndex] = invitation;
    } else {
      invitation = {
        id: "inv_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
        businessId: params.businessId,
        businessName: cleanBizName,
        businessAddress: params.businessAddress,
        currency: params.currency || "USD",
        role: cleanRole,
        permissions: params.permissions || (cleanRole === "cashier" ? ["pos", "inventory"] : cleanRole === "inventory" ? ["inventory", "purchases"] : ["full"]),
        ownerId: params.ownerId,
        ownerName: params.ownerName || "Store Owner",
        ownerEmail: params.ownerEmail,
        inviteeEmail: cleanEmail,
        inviteeName: params.fullName?.trim() || cleanEmail.split("@")[0],
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };
      this.store.invitations.push(invitation);
    }

    // Create notification for invitee
    const roleTitle = cleanRole === "cashier" ? "Cashier" : cleanRole === "inventory" ? "Inventory Clerk" : "Manager";
    this.store.notifications.push({
      id: "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
      targetEmail: cleanEmail,
      type: "team_invite",
      title: `Team Invitation: ${cleanBizName}`,
      message: `${params.ownerName || "Store Owner"} invited you to join "${cleanBizName}" as ${roleTitle}. Accept invitation to access this store workspace.`,
      inviteId: invitation.id,
      businessId: params.businessId,
      businessName: cleanBizName,
      role: cleanRole,
      ownerName: params.ownerName || "Store Owner",
      isRead: false,
      createdAt: now,
    });

    // Mirror to Supabase business_staff if valid UUID business
    if (params.businessId && params.businessId.length >= 32) {
      serverSupabase
        .from("business_staff")
        .upsert({
          business_id: params.businessId,
          invited_email: cleanEmail,
          role: cleanRole,
          permissions: invitation.permissions,
          status: "pending",
          invited_by: params.ownerId,
          updated_at: now,
        })
        .then();
    }

    return { success: true, invitation };
  }

  public getPendingInvitations(email?: string, userId?: string): TeamInvitation[] {
    this.refresh();
    const cleanEmail = email?.trim().toLowerCase();

    return this.store.invitations.filter((inv) => {
      if (inv.status !== "pending") return false;
      if (cleanEmail && inv.inviteeEmail.toLowerCase() === cleanEmail) return true;
      if (userId && inv.inviteeUserId === userId) return true;
      return false;
    });
  }

  public acceptInvitation(params: {
    invitationId: string;
    userId: string;
    userEmail: string;
    userName?: string;
  }): { success: boolean; business?: any; error?: string } {
    this.refresh();
    const cleanEmail = params.userEmail.trim().toLowerCase();
    const cleanUserId = params.userId.trim();

    let invIndex = this.store.invitations.findIndex(
      (i) =>
        i.id === params.invitationId &&
        (i.inviteeEmail.toLowerCase() === cleanEmail || !i.inviteeEmail || i.inviteeUserId === cleanUserId)
    );

    if (invIndex < 0) {
      invIndex = this.store.invitations.findIndex((i) => i.id === params.invitationId);
    }

    if (invIndex < 0) {
      return { success: false, error: "Invitation not found or expired." };
    }

    const inv = this.store.invitations[invIndex];
    const now = new Date().toISOString();

    inv.status = "accepted";
    inv.inviteeUserId = cleanUserId;
    inv.updatedAt = now;
    this.store.invitations[invIndex] = inv;

    const memberIndex = this.store.memberships.findIndex(
      (m) => m.businessId === inv.businessId && (m.userId === cleanUserId || m.userEmail.toLowerCase() === cleanEmail)
    );

    let membership: TeamMembership;
    if (memberIndex >= 0) {
      membership = {
        ...this.store.memberships[memberIndex],
        userId: cleanUserId,
        userEmail: cleanEmail,
        userName: params.userName || this.store.memberships[memberIndex].userName,
        role: inv.role,
        permissions: inv.permissions,
        businessName: inv.businessName,
        isActive: true,
        updatedAt: now,
      };
      this.store.memberships[memberIndex] = membership;
    } else {
      membership = {
        id: "mem_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
        businessId: inv.businessId,
        businessName: inv.businessName,
        businessAddress: inv.businessAddress,
        currency: inv.currency || "USD",
        userId: cleanUserId,
        userEmail: cleanEmail,
        userName: params.userName || inv.inviteeName || cleanEmail.split("@")[0],
        ownerId: inv.ownerId,
        role: inv.role,
        permissions: inv.permissions,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      this.store.memberships.push(membership);
    }

    this.store.notifications.forEach((n) => {
      if (n.inviteId === inv.id || (n.businessId === inv.businessId && n.targetEmail.toLowerCase() === cleanEmail)) {
        n.isRead = true;
      }
    });

    // Update Supabase business_staff
    if (inv.businessId && inv.businessId.length >= 32) {
      serverSupabase
        .from("business_staff")
        .update({
          status: "active",
          user_id: cleanUserId,
          updated_at: now,
        })
        .eq("business_id", inv.businessId)
        .ilike("invited_email", cleanEmail)
        .then();
    }

    const business = {
      id: inv.businessId,
      business_name: inv.businessName,
      business_address: inv.businessAddress || "",
      currency: inv.currency || "USD",
      status: "active",
      owner_user_id: inv.ownerId,
      is_staff: true,
      staff_role: inv.role,
      default_tax: 0,
      stock_alert_limit: 5,
      category_id: null,
    };

    return { success: true, business };
  }

  public declineInvitation(params: {
    invitationId: string;
    userEmail: string;
    userId?: string;
  }): { success: boolean; error?: string } {
    this.refresh();
    const cleanEmail = params.userEmail.trim().toLowerCase();

    const invIndex = this.store.invitations.findIndex(
      (i) => i.id === params.invitationId && i.inviteeEmail.toLowerCase() === cleanEmail
    );

    if (invIndex < 0) {
      return { success: false, error: "Invitation not found." };
    }

    const inv = this.store.invitations[invIndex];
    inv.status = "declined";
    inv.updatedAt = new Date().toISOString();

    this.store.notifications.forEach((n) => {
      if (n.inviteId === params.invitationId) n.isRead = true;
    });

    if (inv.businessId && inv.businessId.length >= 32) {
      serverSupabase
        .from("business_staff")
        .update({ status: "inactive", updated_at: new Date().toISOString() })
        .eq("business_id", inv.businessId)
        .ilike("invited_email", cleanEmail)
        .then();
    }

    return { success: true };
  }

  public resendInvitation(params: {
    invitationId?: string;
    businessId: string;
    email: string;
    ownerName?: string;
  }): { success: boolean; error?: string } {
    this.refresh();
    const cleanEmail = params.email.trim().toLowerCase();

    const invIndex = this.store.invitations.findIndex(
      (i) =>
        (params.invitationId ? i.id === params.invitationId : i.businessId === params.businessId && i.inviteeEmail.toLowerCase() === cleanEmail) &&
        i.status === "pending"
    );

    if (invIndex < 0) {
      return { success: false, error: "Pending invitation not found." };
    }

    const inv = this.store.invitations[invIndex];
    const now = new Date().toISOString();
    inv.updatedAt = now;
    this.store.invitations[invIndex] = inv;

    const roleTitle = inv.role === "cashier" ? "Cashier" : inv.role === "inventory" ? "Inventory Clerk" : "Manager";
    this.store.notifications.push({
      id: "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
      targetEmail: cleanEmail,
      type: "team_invite",
      title: `Team Invitation Reminder: ${inv.businessName}`,
      message: `${params.ownerName || inv.ownerName || "Store Owner"} reminded you to join "${inv.businessName}" as ${roleTitle}. Click Accept below to activate your employee access.`,
      inviteId: inv.id,
      businessId: inv.businessId,
      businessName: inv.businessName,
      role: inv.role,
      ownerName: params.ownerName || inv.ownerName || "Store Owner",
      isRead: false,
      createdAt: now,
    });

    return { success: true };
  }

  public getEmployeeBusinesses(userId?: string, email?: string): any[] {
    this.refresh();
    const cleanEmail = email?.trim().toLowerCase();
    const cleanUserId = userId?.trim();

    const activeMembers = this.store.memberships.filter((m) => {
      if (!m.isActive) return false;
      if (cleanUserId && m.userId === cleanUserId) return true;
      if (cleanEmail && m.userEmail.toLowerCase() === cleanEmail) return true;
      return false;
    });

    return activeMembers.map((m) => ({
      id: m.businessId,
      business_name: m.businessName,
      business_address: m.businessAddress || "",
      currency: m.currency || "USD",
      status: "active",
      owner_user_id: m.ownerId,
      is_staff: true,
      staff_role: m.role,
      default_tax: 0,
      stock_alert_limit: 5,
      category_id: null,
    }));
  }

  public getTeamMembers(params: { businessId?: string; ownerId?: string }): any[] {
    this.refresh();
    const rawBiz = params.businessId?.trim();
    const rawOwner = params.ownerId?.trim();
    const businessId = (rawBiz && rawBiz !== "null" && rawBiz !== "undefined") ? rawBiz : undefined;
    const ownerId = (rawOwner && rawOwner !== "null" && rawOwner !== "undefined") ? rawOwner : undefined;

    const matchesFilter = (itemBiz?: string, itemOwner?: string) => {
      if (!businessId && !ownerId) return true;
      if (businessId && itemBiz && (itemBiz === businessId || itemBiz.includes(businessId) || businessId.includes(itemBiz))) return true;
      if (ownerId && itemOwner && (itemOwner === ownerId || itemOwner.includes(ownerId) || ownerId.includes(itemOwner))) return true;
      if (businessId && businessId.startsWith("biz_") && itemOwner && businessId.includes(itemOwner)) return true;
      if (itemBiz && itemBiz.startsWith("biz_") && ownerId && itemBiz.includes(ownerId)) return true;
      return false;
    };

    const active = this.store.memberships
      .filter((m) => {
        if (!m.isActive && m.isActive !== undefined) return false;
        return matchesFilter(m.businessId, m.ownerId);
      })
      .map((m) => ({
        id: m.id,
        user_id: m.userId,
        userId: m.userId,
        full_name: m.userName,
        fullName: m.userName,
        email: m.userEmail,
        role: m.role,
        status: m.isActive === false ? "inactive" : "active",
        created_at: m.createdAt,
        createdAt: m.createdAt,
        updated_at: m.updatedAt,
        updatedAt: m.updatedAt,
        is_owner: false,
        business_id: m.businessId,
        businessId: m.businessId,
        appointed_by_user_id: m.ownerId,
      }));

    const inactive = this.store.memberships
      .filter((m) => {
        if (m.isActive !== false) return false;
        return matchesFilter(m.businessId, m.ownerId);
      })
      .map((m) => ({
        id: m.id,
        user_id: m.userId,
        userId: m.userId,
        full_name: m.userName,
        fullName: m.userName,
        email: m.userEmail,
        role: m.role,
        status: "inactive",
        created_at: m.createdAt,
        createdAt: m.createdAt,
        updated_at: m.updatedAt,
        updatedAt: m.updatedAt,
        is_owner: false,
        business_id: m.businessId,
        businessId: m.businessId,
        appointed_by_user_id: m.ownerId,
      }));

    const pending = this.store.invitations
      .filter((inv) => {
        if (inv.status !== "pending") return false;
        return matchesFilter(inv.businessId, inv.ownerId);
      })
      .map((inv) => ({
        id: inv.id,
        user_id: inv.inviteeUserId || inv.id,
        userId: inv.inviteeUserId || inv.id,
        full_name: inv.inviteeName || inv.inviteeEmail.split("@")[0],
        fullName: inv.inviteeName || inv.inviteeEmail.split("@")[0],
        email: inv.inviteeEmail,
        role: inv.role,
        status: "pending",
        created_at: inv.createdAt,
        createdAt: inv.createdAt,
        updated_at: inv.updatedAt,
        updatedAt: inv.updatedAt,
        is_owner: false,
        business_id: inv.businessId,
        businessId: inv.businessId,
        invitation_id: inv.id,
        appointed_by_user_id: inv.ownerId,
      }));

    return [...active, ...inactive, ...pending];
  }

  public getTeamMembersForBusiness(businessId: string): any[] {
    return this.getTeamMembers({ businessId });
  }

  public addDirectMember(params: {
    businessId: string;
    businessName?: string;
    businessAddress?: string;
    currency?: string;
    ownerId: string;
    ownerName?: string;
    email: string;
    fullName: string;
    role: "cashier" | "manager" | "inventory";
    permissions?: string[];
    userId?: string;
    status?: "active" | "pending";
  }): { success: boolean; member: any } {
    this.refresh();
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanBizName = params.businessName?.trim() || "Store";
    const cleanRole = params.role || "cashier";
    const now = new Date().toISOString();
    const cleanUserId = params.userId?.trim() || "user_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    this.store.invitations = this.store.invitations.filter(
      (i) => !(i.businessId === params.businessId && i.inviteeEmail.toLowerCase() === cleanEmail)
    );

    const existingIndex = this.store.memberships.findIndex(
      (m) =>
        m.businessId === params.businessId &&
        (m.userEmail.toLowerCase() === cleanEmail || (params.userId && m.userId === params.userId))
    );

    let member: TeamMembership;
    if (existingIndex >= 0) {
      member = {
        ...this.store.memberships[existingIndex],
        userName: params.fullName.trim() || this.store.memberships[existingIndex].userName,
        role: cleanRole,
        permissions: params.permissions || this.store.memberships[existingIndex].permissions,
        businessName: cleanBizName,
        isActive: params.status !== "pending",
        updatedAt: now,
      };
      this.store.memberships[existingIndex] = member;
    } else {
      member = {
        id: "mem_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
        businessId: params.businessId,
        businessName: cleanBizName,
        businessAddress: params.businessAddress,
        currency: params.currency || "USD",
        userId: cleanUserId,
        userEmail: cleanEmail,
        userName: params.fullName.trim() || cleanEmail.split("@")[0],
        ownerId: params.ownerId,
        role: cleanRole,
        permissions: params.permissions || (cleanRole === "cashier" ? ["pos", "inventory"] : cleanRole === "inventory" ? ["inventory", "purchases"] : ["full"]),
        isActive: params.status !== "pending",
        createdAt: now,
        updatedAt: now,
      };
      this.store.memberships.push(member);
    }

    if (params.businessId && params.businessId.length >= 32) {
      serverSupabase
        .from("business_staff")
        .upsert({
          business_id: params.businessId,
          invited_email: cleanEmail,
          role: cleanRole,
          permissions: member.permissions,
          status: member.isActive ? "active" : "pending",
          invited_by: params.ownerId,
          user_id: member.userId.length >= 32 ? member.userId : null,
          updated_at: now,
        })
        .then();
    }

    return {
      success: true,
      member: {
        id: member.id,
        user_id: member.userId,
        userId: member.userId,
        full_name: member.userName,
        fullName: member.userName,
        email: member.userEmail,
        role: member.role,
        status: member.isActive ? "active" : "inactive",
        created_at: member.createdAt,
        createdAt: member.createdAt,
        updated_at: member.updatedAt,
        updatedAt: member.updatedAt,
        is_owner: false,
        business_id: member.businessId,
        businessId: member.businessId,
      },
    };
  }

  public removeMember(businessId: string, memberId: string, ownerId?: string): { success: boolean } {
    this.refresh();
    const cleanMemId = memberId?.trim().toLowerCase();
    this.store.memberships = this.store.memberships.filter((m) => {
      const bizMatch = !businessId || m.businessId === businessId || (ownerId && m.ownerId === ownerId) || (businessId && (m.businessId.includes(businessId) || businessId.includes(m.businessId)));
      const idMatch = m.id === memberId || m.userId === memberId || (cleanMemId && m.userEmail.toLowerCase() === cleanMemId);
      return !(bizMatch && idMatch);
    });
    this.store.invitations = this.store.invitations.filter((i) => {
      const bizMatch = !businessId || i.businessId === businessId || (ownerId && i.ownerId === ownerId) || (businessId && (i.businessId.includes(businessId) || businessId.includes(i.businessId)));
      const idMatch = i.id === memberId || i.inviteeUserId === memberId || (cleanMemId && i.inviteeEmail.toLowerCase() === cleanMemId);
      return !(bizMatch && idMatch);
    });

    if (businessId && businessId.length >= 32) {
      serverSupabase
        .from("business_staff")
        .delete()
        .eq("business_id", businessId)
        .or(`id.eq.${memberId},invited_email.eq.${cleanMemId}`)
        .then();
    }

    return { success: true };
  }

  public updateMemberStatus(businessId: string, memberId: string, isActive: boolean, ownerId?: string): { success: boolean } {
    this.refresh();
    const cleanMemId = memberId?.trim().toLowerCase();
    const mem = this.store.memberships.find(
      (m) =>
        (!businessId || m.businessId === businessId || (ownerId && m.ownerId === ownerId) || (businessId && (m.businessId.includes(businessId) || businessId.includes(m.businessId)))) &&
        (m.id === memberId || m.userId === memberId || (cleanMemId && m.userEmail.toLowerCase() === cleanMemId))
    );
    if (mem) {
      mem.isActive = isActive;
      mem.updatedAt = new Date().toISOString();
    }

    if (businessId && businessId.length >= 32) {
      serverSupabase
        .from("business_staff")
        .update({ status: isActive ? "active" : "inactive", updated_at: new Date().toISOString() })
        .eq("business_id", businessId)
        .or(`id.eq.${memberId},invited_email.eq.${cleanMemId}`)
        .then();
    }

    return { success: true };
  }

  public updateMemberRole(businessId: string, memberId: string, role: "cashier" | "manager" | "inventory", ownerId?: string): { success: boolean } {
    this.refresh();
    const cleanMemId = memberId?.trim().toLowerCase();
    const mem = this.store.memberships.find(
      (m) =>
        (!businessId || m.businessId === businessId || (ownerId && m.ownerId === ownerId) || (businessId && (m.businessId.includes(businessId) || businessId.includes(m.businessId)))) &&
        (m.id === memberId || m.userId === memberId || (cleanMemId && m.userEmail.toLowerCase() === cleanMemId))
    );
    if (mem) {
      mem.role = role;
      mem.updatedAt = new Date().toISOString();
    }
    const inv = this.store.invitations.find(
      (i) =>
        (!businessId || i.businessId === businessId || (ownerId && i.ownerId === ownerId) || (businessId && (i.businessId.includes(businessId) || businessId.includes(i.businessId)))) &&
        (i.id === memberId || i.inviteeUserId === memberId || (cleanMemId && i.inviteeEmail.toLowerCase() === cleanMemId))
    );
    if (inv) {
      inv.role = role;
      inv.updatedAt = new Date().toISOString();
    }

    if (businessId && businessId.length >= 32) {
      serverSupabase
        .from("business_staff")
        .update({ role, updated_at: new Date().toISOString() })
        .eq("business_id", businessId)
        .or(`id.eq.${memberId},invited_email.eq.${cleanMemId}`)
        .then();
    }

    return { success: true };
  }

  public getNotifications(email?: string, userId?: string): TeamNotification[] {
    this.refresh();
    const cleanEmail = email?.trim().toLowerCase();
    const cleanUserId = userId?.trim();

    return this.store.notifications
      .filter((n) => {
        if (cleanEmail && n.targetEmail.toLowerCase() === cleanEmail) return true;
        if (cleanUserId && n.targetUserId === cleanUserId) return true;
        return false;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export const teamService = new TeamService();
