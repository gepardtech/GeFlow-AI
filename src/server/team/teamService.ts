import fs from "fs";
import path from "path";

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

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "team_storage.json");

function ensureStorage(): TeamDataStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(content);
      return {
        invitations: parsed.invitations || [],
        memberships: parsed.memberships || [],
        notifications: parsed.notifications || [],
      };
    }
  } catch (err) {
    console.error("Error reading team storage, initializing fresh store:", err);
  }

  const initial: TeamDataStore = {
    invitations: [],
    memberships: [],
    notifications: [],
  };
  saveStorage(initial);
  return initial;
}

function saveStorage(store: TeamDataStore) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving team storage:", err);
  }
}

export class TeamService {
  private store: TeamDataStore;

  constructor() {
    this.store = ensureStorage();
  }

  private refresh() {
    this.store = ensureStorage();
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
      // Refresh pending invitation
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

    saveStorage(this.store);
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

    // Fallback: If invite ID matches exactly, allow acceptance
    if (invIndex < 0) {
      invIndex = this.store.invitations.findIndex((i) => i.id === params.invitationId);
    }

    if (invIndex < 0) {
      return { success: false, error: "Invitation not found or expired." };
    }

    const inv = this.store.invitations[invIndex];
    const now = new Date().toISOString();

    // Mark invitation accepted
    inv.status = "accepted";
    inv.inviteeUserId = cleanUserId;
    inv.updatedAt = now;
    this.store.invitations[invIndex] = inv;

    // Create or update active membership
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
        businessName: inv.businessName, // REAL NAME!
        isActive: true,
        updatedAt: now,
      };
      this.store.memberships[memberIndex] = membership;
    } else {
      membership = {
        id: "mem_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
        businessId: inv.businessId,
        businessName: inv.businessName, // REAL NAME!
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

    // Mark corresponding invite notifications as read
    this.store.notifications.forEach((n) => {
      if (n.inviteId === inv.id || (n.businessId === inv.businessId && n.targetEmail.toLowerCase() === cleanEmail)) {
        n.isRead = true;
      }
    });

    saveStorage(this.store);

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

    this.store.invitations[invIndex].status = "declined";
    this.store.invitations[invIndex].updatedAt = new Date().toISOString();

    // Mark notifications read
    this.store.notifications.forEach((n) => {
      if (n.inviteId === params.invitationId) n.isRead = true;
    });

    saveStorage(this.store);
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

    // Create fresh notification with Accept CTA
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

    saveStorage(this.store);
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
      business_name: m.businessName, // REAL BUSINESS NAME!
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

  public getTeamMembersForBusiness(businessId: string): any[] {
    this.refresh();

    // Active members
    const active = this.store.memberships
      .filter((m) => m.businessId === businessId && m.isActive)
      .map((m) => ({
        id: m.id,
        user_id: m.userId,
        full_name: m.userName,
        email: m.userEmail,
        role: m.role,
        status: "active",
        created_at: m.createdAt,
        is_owner: false,
      }));

    // Pending invitations
    const pending = this.store.invitations
      .filter((inv) => inv.businessId === businessId && inv.status === "pending")
      .map((inv) => ({
        id: inv.id,
        user_id: inv.inviteeUserId || inv.id,
        full_name: inv.inviteeName || inv.inviteeEmail.split("@")[0],
        email: inv.inviteeEmail,
        role: inv.role,
        status: "pending",
        created_at: inv.createdAt,
        is_owner: false,
        invitation_id: inv.id,
      }));

    return [...active, ...pending];
  }

  public removeMember(businessId: string, memberId: string): { success: boolean } {
    this.refresh();
    this.store.memberships = this.store.memberships.filter(
      (m) => !(m.businessId === businessId && (m.id === memberId || m.userId === memberId))
    );
    this.store.invitations = this.store.invitations.filter(
      (i) => !(i.businessId === businessId && (i.id === memberId || i.inviteeUserId === memberId))
    );
    saveStorage(this.store);
    return { success: true };
  }

  public updateMemberRole(businessId: string, memberId: string, role: "cashier" | "manager" | "inventory"): { success: boolean } {
    this.refresh();
    const mem = this.store.memberships.find(
      (m) => m.businessId === businessId && (m.id === memberId || m.userId === memberId)
    );
    if (mem) {
      mem.role = role;
      mem.updatedAt = new Date().toISOString();
    }
    const inv = this.store.invitations.find(
      (i) => i.businessId === businessId && (i.id === memberId || i.inviteeUserId === memberId)
    );
    if (inv) {
      inv.role = role;
      inv.updatedAt = new Date().toISOString();
    }
    saveStorage(this.store);
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
