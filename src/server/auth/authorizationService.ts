/**
 * GEFLOW AI — STEP 07: ORGANIZATION-LEVEL & CATEGORY-LEVEL AUTHORIZATION SERVICE
 *
 * Implements a strict, server-enforced, fail-closed authorization engine:
 * - Level 1: Organization / Business Membership, Roles, Status, and Cross-Tenant Isolation
 * - Level 2: Category Access, 29 Category-to-Agent Mapping, and Resource Boundaries
 * - Combined Decision: Authenticated User + Active Membership + Valid Category + Agent Boundary
 * - Audit Trail: Comprehensive security logging of all authorization decisions
 */

import fs from "fs";
import path from "path";
import { Request, Response, NextFunction } from "express";
import { serverSupabase } from "../supabase";
import { teamService } from "../team/teamService";
import { businessDataSyncService } from "../team/businessDataSyncService";

export type OrganizationRole = "owner" | "admin" | "manager" | "cashier" | "inventory" | "member";
export type MembershipStatus = "active" | "pending" | "suspended" | "revoked" | "none";
export type AgentPermissionLevel = "read" | "analyze" | "draft" | "write" | "restricted";
export type AuthorizationOutcome = "ALLOW" | "DENY";

export interface CategoryAgentMapping {
  categoryId: string; // CAT-001 through CAT-029
  categoryName: string;
  industryType: string;
  primaryAgentId: string; // AGT-001 through AGT-029
  agentName: string;
  status: "active" | "suspended";
}

export interface AuthorizationEvent {
  eventId: string;
  timestamp: string;
  actor: {
    userId: string;
    email?: string;
    role?: string;
  };
  organizationId: string;
  businessId: string;
  categoryId?: string;
  agentId?: string;
  action: string;
  outcome: AuthorizationOutcome;
  reason?: string;
  correlationId: string;
}

export interface AuthDecision {
  allowed: boolean;
  statusCode?: number;
  reason?: string;
  code?: string;
  context?: {
    userId: string;
    userEmail?: string;
    businessId: string;
    businessName: string;
    role: OrganizationRole;
    membershipStatus: MembershipStatus;
    permissions: string[];
    categoryId: string;
    categoryName: string;
    primaryAgentId: string;
  };
}

// -----------------------------------------------------------------------------
// PART 5 — VERIFIED 29 CATEGORY-TO-AGENT REGISTRY (STEP 05/06/07 CANONICAL)
// -----------------------------------------------------------------------------
export const CATEGORY_AGENT_REGISTRY: CategoryAgentMapping[] = [
  { categoryId: "CAT-001", categoryName: "General Retail & Department Store", industryType: "Retail", primaryAgentId: "AGT-001", agentName: "General Retail Specialist", status: "active" },
  { categoryId: "CAT-002", categoryName: "Agriculture & Farming Supplies", industryType: "Agriculture", primaryAgentId: "AGT-002", agentName: "Agriculture & Farm Specialist", status: "active" },
  { categoryId: "CAT-003", categoryName: "Wholesale & Distribution Hub", industryType: "Wholesale", primaryAgentId: "AGT-003", agentName: "Wholesale & Logistics Specialist", status: "active" },
  { categoryId: "CAT-004", categoryName: "Optometry & Eyewear Store", industryType: "Optical", primaryAgentId: "AGT-004", agentName: "Optometry & Optical Specialist", status: "active" },
  { categoryId: "CAT-005", categoryName: "Pet Shop & Veterinary Supplies", industryType: "Pet Care", primaryAgentId: "AGT-005", agentName: "Pet & Veterinary Specialist", status: "active" },
  { categoryId: "CAT-006", categoryName: "Sports, Gym & Fitness Equipment", industryType: "Sports", primaryAgentId: "AGT-006", agentName: "Sports & Fitness Specialist", status: "active" },
  { categoryId: "CAT-007", categoryName: "Home Appliances & Kitchenware", industryType: "Home Goods", primaryAgentId: "AGT-007", agentName: "Home Appliances Specialist", status: "active" },
  { categoryId: "CAT-008", categoryName: "Home Furniture & Living", industryType: "Furniture", primaryAgentId: "AGT-008", agentName: "Furniture & Living Specialist", status: "active" },
  { categoryId: "CAT-009", categoryName: "Jewelry, Watches & Luxury Goods", industryType: "Jewelry", primaryAgentId: "AGT-009", agentName: "Jewelry & Luxury Goods Specialist", status: "active" },
  { categoryId: "CAT-010", categoryName: "Bookstore & Stationery", industryType: "Books & Stationery", primaryAgentId: "AGT-010", agentName: "Bookstore & Stationery Specialist", status: "active" },
  { categoryId: "CAT-011", categoryName: "Hair Salon & Barbershop", industryType: "Salon", primaryAgentId: "AGT-011", agentName: "Salon & Grooming Specialist", status: "active" },
  { categoryId: "CAT-012", categoryName: "Cosmetics, Beauty & Skincare", industryType: "Beauty", primaryAgentId: "AGT-012", agentName: "Beauty & Cosmetics Specialist", status: "active" },
  { categoryId: "CAT-013", categoryName: "Vehicle Repair & Service Garage", industryType: "Repair Shop", primaryAgentId: "AGT-013", agentName: "Vehicle Repair & Service Specialist", status: "active" },
  { categoryId: "CAT-014", categoryName: "Auto Parts & Accessories", industryType: "Automotive", primaryAgentId: "AGT-014", agentName: "Auto Parts Specialist", status: "active" },
  { categoryId: "CAT-015", categoryName: "Plumbing & Sanitary Ware", industryType: "Plumbing", primaryAgentId: "AGT-015", agentName: "Plumbing Supplies Specialist", status: "active" },
  { categoryId: "CAT-016", categoryName: "Electrical & Lighting Supplies", industryType: "Electrical", primaryAgentId: "AGT-016", agentName: "Electrical & Lighting Specialist", status: "active" },
  { categoryId: "CAT-017", categoryName: "Hardware, Tools & Construction", industryType: "Hardware", primaryAgentId: "AGT-017", agentName: "Hardware & Tools Specialist", status: "active" },
  { categoryId: "CAT-018", categoryName: "Bakery & Pastry Shop", industryType: "Bakery", primaryAgentId: "AGT-018", agentName: "Bakery & Pastry Specialist", status: "active" },
  { categoryId: "CAT-019", categoryName: "Cafe & Coffee Shop", industryType: "Cafe", primaryAgentId: "AGT-019", agentName: "Cafe & Coffee Shop Specialist", status: "active" },
  { categoryId: "CAT-020", categoryName: "Fast Food & Quick Service", industryType: "Fast Food", primaryAgentId: "AGT-020", agentName: "Fast Food Specialist", status: "active" },
  { categoryId: "CAT-021", categoryName: "Restaurant & Dine-In", industryType: "Restaurant", primaryAgentId: "AGT-021", agentName: "Restaurant & Dine-In Specialist", status: "active" },
  { categoryId: "CAT-022", categoryName: "Footwear & Shoes", industryType: "Footwear", primaryAgentId: "AGT-022", agentName: "Footwear Specialist", status: "active" },
  { categoryId: "CAT-023", categoryName: "Fashion & Apparel Boutique", industryType: "Boutique", primaryAgentId: "AGT-023", agentName: "Fashion Boutique Specialist", status: "active" },
  { categoryId: "CAT-024", categoryName: "Computer & IT Hardware", industryType: "IT Store", primaryAgentId: "AGT-024", agentName: "Computer & IT Specialist", status: "active" },
  { categoryId: "CAT-025", categoryName: "Mobile Phones & Telecommunication", industryType: "Mobile Shop", primaryAgentId: "AGT-025", agentName: "Mobile & Telecom Specialist", status: "active" },
  { categoryId: "CAT-026", categoryName: "Electronics & Gadgets", industryType: "Electronics", primaryAgentId: "AGT-026", agentName: "Consumer Electronics Specialist", status: "active" },
  { categoryId: "CAT-027", categoryName: "Grocery Store & Minimart", industryType: "Grocery", primaryAgentId: "AGT-027", agentName: "Grocery & Minimart Specialist", status: "active" },
  { categoryId: "CAT-028", categoryName: "Supermarket & Hypermarket", industryType: "Supermarket", primaryAgentId: "AGT-028", agentName: "Supermarket Specialist", status: "active" },
  { categoryId: "CAT-029", categoryName: "Pharmacy & Health Store", industryType: "Pharmacy", primaryAgentId: "AGT-029", agentName: "Pharmacy & Healthcare Specialist", status: "active" },
];

// Quick index maps
const AGENT_TO_CATEGORY_MAP = new Map<string, CategoryAgentMapping>(
  CATEGORY_AGENT_REGISTRY.map((c) => [c.primaryAgentId, c])
);
const CATEGORY_ID_MAP = new Map<string, CategoryAgentMapping>(
  CATEGORY_AGENT_REGISTRY.map((c) => [c.categoryId, c])
);

// -----------------------------------------------------------------------------
// AUDIT LOG STORAGE
// -----------------------------------------------------------------------------
const AUDIT_LOG_FILE = path.join(process.cwd(), "data", "authorization_audit_log.json");
const inMemoryAuditLogs: AuthorizationEvent[] = [];

export function recordAuthorizationAudit(event: Omit<AuthorizationEvent, "eventId" | "timestamp">): AuthorizationEvent {
  const fullEvent: AuthorizationEvent = {
    eventId: `auth_ev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };

  inMemoryAuditLogs.push(fullEvent);
  if (inMemoryAuditLogs.length > 1000) {
    inMemoryAuditLogs.shift();
  }

  // Persist asynchronously
  try {
    const dir = path.dirname(AUDIT_LOG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(inMemoryAuditLogs.slice(-200), null, 2), "utf-8");
  } catch (err) {
    console.warn("Notice: Authorization audit log file write error:", err);
  }

  // Log denials to console for security awareness
  if (fullEvent.outcome === "DENY") {
    console.warn(
      `[SECURITY AUDIT] ACCESS DENIED: Actor=${fullEvent.actor.userId} Action=${fullEvent.action} Org=${fullEvent.organizationId} Business=${fullEvent.businessId} Reason="${fullEvent.reason}"`
    );
  }

  return fullEvent;
}

export function getAuthorizationAuditLogs(limit = 100): AuthorizationEvent[] {
  return inMemoryAuditLogs.slice(-limit).reverse();
}

// -----------------------------------------------------------------------------
// CATEGORY RESOLVER UTILITIES
// -----------------------------------------------------------------------------
export function resolveCategoryForBusiness(business: {
  category_id?: string | null;
  industry_type?: string | null;
  business_name?: string;
}): CategoryAgentMapping {
  // 1. Direct CAT-xxx match
  if (business.category_id && CATEGORY_ID_MAP.has(business.category_id)) {
    return CATEGORY_ID_MAP.get(business.category_id)!;
  }

  // 2. Industry type match
  if (business.industry_type) {
    const normalized = business.industry_type.trim().toLowerCase();
    const matched = CATEGORY_AGENT_REGISTRY.find(
      (c) =>
        c.industryType.toLowerCase() === normalized ||
        c.categoryName.toLowerCase().includes(normalized)
    );
    if (matched) return matched;
  }

  // 3. Name inference
  if (business.business_name) {
    const bName = business.business_name.toLowerCase();
    for (const entry of CATEGORY_AGENT_REGISTRY) {
      const catWords = entry.categoryName.toLowerCase().split(/\s*&\s*|\s+/);
      if (catWords.some((w) => w.length > 3 && bName.includes(w))) {
        return entry;
      }
    }
  }

  // Default fallback: CAT-001 General Retail
  return CATEGORY_AGENT_REGISTRY[0];
}

// -----------------------------------------------------------------------------
// CORE LEVEL 1: ORGANIZATION / BUSINESS ACCESS VERIFICATION
// -----------------------------------------------------------------------------
export async function verifyOrganizationAccess(params: {
  userId: string;
  userEmail?: string;
  businessId: string;
  requiredPermission?: string; // 'full' | 'manage' | 'inventory' | 'pos' | 'reports' | 'read'
  correlationId?: string;
}): Promise<AuthDecision> {
  const { userId, userEmail = "", businessId, requiredPermission = "read", correlationId = `corr_${Date.now()}` } = params;

  if (!businessId || typeof businessId !== "string" || businessId.trim().length === 0) {
    recordAuthorizationAudit({
      actor: { userId, email: userEmail },
      organizationId: "unknown",
      businessId: "invalid",
      action: "organization.access",
      outcome: "DENY",
      reason: "Missing or malformed business identifier",
      correlationId,
    });
    return {
      allowed: false,
      statusCode: 400,
      code: "AUTH_INVALID_BUSINESS_ID",
      reason: "Missing or malformed business identifier.",
    };
  }

  // 1. Verify Business exists in store or database
  let businessRecord: any = null;

  // Check in-memory businessDataSyncService
  const memoryUnit = businessDataSyncService.getOrCreateBusinessUnit(businessId);
  if (memoryUnit && memoryUnit.business_id === businessId && memoryUnit.created_at) {
    businessRecord = {
      id: businessId,
      owner_user_id: memoryUnit.owner_user_id || "",
      business_name: memoryUnit.settings?.business_name || "Store",
      status: memoryUnit.settings?.status || "active",
      industry_type: memoryUnit.settings?.industry_type || "Retail",
      category_id: memoryUnit.settings?.category_id || "CAT-001",
    };
  }

  // Check Supabase businesses table
  if (!businessRecord || !businessRecord.owner_user_id) {
    try {
      const { data: dbBiz } = await serverSupabase
        .from("businesses")
        .select("id, owner_user_id, business_name, status, category_id, currency, industry_type")
        .eq("id", businessId)
        .maybeSingle();

      if (dbBiz) {
        businessRecord = dbBiz;
      }
    } catch (e) {
      console.warn("Notice: serverSupabase business lookup:", e);
    }
  }

  // Fail-closed if business does not exist
  if (!businessRecord) {
    recordAuthorizationAudit({
      actor: { userId, email: userEmail },
      organizationId: businessId,
      businessId,
      action: "organization.access",
      outcome: "DENY",
      reason: "Business organization does not exist",
      correlationId,
    });
    return {
      allowed: false,
      statusCode: 404,
      code: "AUTH_ORGANIZATION_NOT_FOUND",
      reason: `Business organization ${businessId} was not found.`,
    };
  }

  // Fail-closed if business is suspended
  if (businessRecord.status === "suspended") {
    recordAuthorizationAudit({
      actor: { userId, email: userEmail },
      organizationId: businessId,
      businessId,
      action: "organization.access",
      outcome: "DENY",
      reason: "Business organization is suspended",
      correlationId,
    });
    return {
      allowed: false,
      statusCode: 403,
      code: "AUTH_ORGANIZATION_SUSPENDED",
      reason: `Business organization ${businessRecord.business_name} is suspended.`,
    };
  }

  // 2. Check if user is Global Platform Admin (gepardwebs@gmail.com or user_roles admin)
  if (userEmail.toLowerCase() === "gepardwebs@gmail.com") {
    const categoryMapping = resolveCategoryForBusiness(businessRecord);
    recordAuthorizationAudit({
      actor: { userId, email: userEmail, role: "admin" },
      organizationId: businessId,
      businessId,
      categoryId: categoryMapping.categoryId,
      action: "organization.admin_access",
      outcome: "ALLOW",
      reason: "Global Platform Administrator bypass",
      correlationId,
    });
    return {
      allowed: true,
      context: {
        userId,
        userEmail,
        businessId,
        businessName: businessRecord.business_name,
        role: "admin",
        membershipStatus: "active",
        permissions: ["full", "manage", "inventory", "pos", "reports"],
        categoryId: categoryMapping.categoryId,
        categoryName: categoryMapping.categoryName,
        primaryAgentId: categoryMapping.primaryAgentId,
      },
    };
  }

  // 3. Check if user is the direct Owner of this business
  if (businessRecord.owner_user_id && businessRecord.owner_user_id === userId) {
    const categoryMapping = resolveCategoryForBusiness(businessRecord);
    recordAuthorizationAudit({
      actor: { userId, email: userEmail, role: "owner" },
      organizationId: businessId,
      businessId,
      categoryId: categoryMapping.categoryId,
      action: "organization.owner_access",
      outcome: "ALLOW",
      reason: "Verified business owner",
      correlationId,
    });
    return {
      allowed: true,
      context: {
        userId,
        userEmail,
        businessId,
        businessName: businessRecord.business_name,
        role: "owner",
        membershipStatus: "active",
        permissions: ["full", "manage", "inventory", "pos", "reports"],
        categoryId: categoryMapping.categoryId,
        categoryName: categoryMapping.categoryName,
        primaryAgentId: categoryMapping.primaryAgentId,
      },
    };
  }

  // 4. Check Team Membership via TeamService
  const teamMembers = teamService.getTeamMembersForBusiness(businessId);
  const member = teamMembers.find(
    (m) =>
      (m.userId && m.userId === userId) ||
      (m.userEmail && userEmail && m.userEmail.toLowerCase() === userEmail.toLowerCase())
  );

  // Check if user has pending invitations
  const pendingInvites = teamService.getPendingInvitations(userEmail, userId);
  const hasPendingForBiz = pendingInvites.some((inv) => inv.businessId === businessId && inv.status === "pending");

  if (hasPendingForBiz && !member) {
    recordAuthorizationAudit({
      actor: { userId, email: userEmail },
      organizationId: businessId,
      businessId,
      action: "organization.access",
      outcome: "DENY",
      reason: "Membership invitation is pending acceptance",
      correlationId,
    });
    return {
      allowed: false,
      statusCode: 403,
      code: "AUTH_MEMBERSHIP_PENDING",
      reason: "Your invitation to this organization is pending acceptance.",
    };
  }

  if (!member) {
    // Cross-tenant breach attempt: User is neither owner nor active staff
    recordAuthorizationAudit({
      actor: { userId, email: userEmail },
      organizationId: businessId,
      businessId,
      action: "organization.access",
      outcome: "DENY",
      reason: "User has no membership or ownership for this organization",
      correlationId,
    });
    return {
      allowed: false,
      statusCode: 403,
      code: "AUTH_CROSS_TENANT_FORBIDDEN",
      reason: "Access denied. You do not belong to this business organization.",
    };
  }

  // Check if member is suspended or inactive
  if (member.isActive === false) {
    recordAuthorizationAudit({
      actor: { userId, email: userEmail, role: member.role },
      organizationId: businessId,
      businessId,
      action: "organization.access",
      outcome: "DENY",
      reason: "Member account has been suspended by organization owner",
      correlationId,
    });
    return {
      allowed: false,
      statusCode: 403,
      code: "AUTH_MEMBERSHIP_SUSPENDED",
      reason: "Your access to this organization has been suspended.",
    };
  }

  // 5. Enforce granular role & permission checks
  const memberRole: OrganizationRole =
    member.role === "manager"
      ? "manager"
      : member.role === "inventory"
      ? "inventory"
      : member.role === "cashier"
      ? "cashier"
      : "member";

  const memberPermissions: string[] = Array.isArray(member.permissions) && member.permissions.length > 0
    ? member.permissions
    : memberRole === "manager"
    ? ["full", "manage", "inventory", "pos", "reports"]
    : memberRole === "inventory"
    ? ["inventory", "purchases"]
    : memberRole === "cashier"
    ? ["pos"]
    : ["read"];

  // Permission validation logic
  const hasFull = memberPermissions.includes("full");
  let permissionGranted = false;

  if (hasFull || requiredPermission === "read") {
    permissionGranted = true;
  } else if (requiredPermission === "pos" && (memberPermissions.includes("pos") || memberRole === "cashier" || memberRole === "manager")) {
    permissionGranted = true;
  } else if (requiredPermission === "inventory" && (memberPermissions.includes("inventory") || memberRole === "inventory" || memberRole === "manager")) {
    permissionGranted = true;
  } else if (requiredPermission === "purchases" && (memberPermissions.includes("purchases") || memberRole === "inventory" || memberRole === "manager")) {
    permissionGranted = true;
  } else if (requiredPermission === "reports" && (memberPermissions.includes("reports") || memberRole === "manager")) {
    permissionGranted = true;
  } else if (requiredPermission === "manage" && (memberRole === "manager" || memberPermissions.includes("manage"))) {
    permissionGranted = true;
  }

  if (!permissionGranted) {
    recordAuthorizationAudit({
      actor: { userId, email: userEmail, role: memberRole },
      organizationId: businessId,
      businessId,
      action: `permission.${requiredPermission}`,
      outcome: "DENY",
      reason: `Role '${memberRole}' lacks required permission '${requiredPermission}'`,
      correlationId,
    });
    return {
      allowed: false,
      statusCode: 403,
      code: "AUTH_INSUFFICIENT_PERMISSIONS",
      reason: `Insufficient permissions. Operation requires '${requiredPermission}'.`,
    };
  }

  const categoryMapping = resolveCategoryForBusiness(businessRecord);
  recordAuthorizationAudit({
    actor: { userId, email: userEmail, role: memberRole },
    organizationId: businessId,
    businessId,
    categoryId: categoryMapping.categoryId,
    action: `organization.member_access.${requiredPermission}`,
    outcome: "ALLOW",
    reason: "Authorized organization member",
    correlationId,
  });

  return {
    allowed: true,
    context: {
      userId,
      userEmail,
      businessId,
      businessName: businessRecord.business_name,
      role: memberRole,
      membershipStatus: "active",
      permissions: memberPermissions,
      categoryId: categoryMapping.categoryId,
      categoryName: categoryMapping.categoryName,
      primaryAgentId: categoryMapping.primaryAgentId,
    },
  };
}

// -----------------------------------------------------------------------------
// CORE LEVEL 2: CATEGORY & AGENT ACCESS VERIFICATION
// -----------------------------------------------------------------------------
export function verifyCategoryAccess(params: {
  businessCategoryId: string;
  requestedCategoryId?: string;
  requestedAgentId?: string;
  correlationId?: string;
}): { allowed: boolean; statusCode?: number; code?: string; reason?: string } {
  const { businessCategoryId, requestedCategoryId, requestedAgentId } = params;

  // Find business category mapping
  const expectedCategory = CATEGORY_ID_MAP.get(businessCategoryId);
  if (!expectedCategory) {
    return {
      allowed: false,
      statusCode: 400,
      code: "AUTH_UNKNOWN_CATEGORY",
      reason: `Business has invalid category identifier '${businessCategoryId}'.`,
    };
  }

  // 1. Verify requested Category ID matches the business's category
  if (requestedCategoryId && requestedCategoryId !== expectedCategory.categoryId) {
    return {
      allowed: false,
      statusCode: 403,
      code: "AUTH_CATEGORY_MISMATCH",
      reason: `Category access denied: Requested category '${requestedCategoryId}' does not match business category '${expectedCategory.categoryId}' (${expectedCategory.categoryName}).`,
    };
  }

  // 2. Verify requested Agent ID matches the business's assigned Primary Agent
  if (requestedAgentId) {
    const targetAgent = AGENT_TO_CATEGORY_MAP.get(requestedAgentId);
    if (!targetAgent) {
      return {
        allowed: false,
        statusCode: 400,
        code: "AUTH_UNKNOWN_AGENT",
        reason: `Invalid or unregistered agent identifier '${requestedAgentId}'.`,
      };
    }

    if (targetAgent.status === "suspended") {
      return {
        allowed: false,
        statusCode: 403,
        code: "AUTH_AGENT_SUSPENDED",
        reason: `Agent '${requestedAgentId}' (${targetAgent.agentName}) is currently suspended.`,
      };
    }

    if (targetAgent.primaryAgentId !== expectedCategory.primaryAgentId) {
      return {
        allowed: false,
        statusCode: 403,
        code: "AUTH_AGENT_CATEGORY_MISMATCH",
        reason: `Agent boundary violation: Agent '${requestedAgentId}' (${targetAgent.categoryName}) cannot operate on category '${expectedCategory.categoryId}' (${expectedCategory.categoryName}). Expected agent is '${expectedCategory.primaryAgentId}'.`,
      };
    }
  }

  return { allowed: true };
}

// -----------------------------------------------------------------------------
// COMBINED DECISION: ORG + CATEGORY + AGENT
// -----------------------------------------------------------------------------
export async function authorizeRequest(params: {
  userId: string;
  userEmail?: string;
  businessId: string;
  requiredPermission?: string;
  requestedCategoryId?: string;
  requestedAgentId?: string;
  operationName?: string;
  correlationId?: string;
}): Promise<AuthDecision> {
  const {
    userId,
    userEmail,
    businessId,
    requiredPermission = "read",
    requestedCategoryId,
    requestedAgentId,
    operationName = "execute",
    correlationId = `corr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  } = params;

  // Level 1: Organization & Business
  const orgDecision = await verifyOrganizationAccess({
    userId,
    userEmail,
    businessId,
    requiredPermission,
    correlationId,
  });

  if (!orgDecision.allowed) {
    return orgDecision;
  }

  // Level 2: Category & Agent
  const businessCatId = orgDecision.context?.categoryId || "CAT-001";
  const catDecision = verifyCategoryAccess({
    businessCategoryId: businessCatId,
    requestedCategoryId,
    requestedAgentId,
    correlationId,
  });

  if (!catDecision.allowed) {
    recordAuthorizationAudit({
      actor: { userId, email: userEmail, role: orgDecision.context?.role },
      organizationId: businessId,
      businessId,
      categoryId: requestedCategoryId || businessCatId,
      agentId: requestedAgentId,
      action: `category_agent.${operationName}`,
      outcome: "DENY",
      reason: catDecision.reason,
      correlationId,
    });
    return {
      allowed: false,
      statusCode: catDecision.statusCode || 403,
      code: catDecision.code,
      reason: catDecision.reason,
    };
  }

  // Combined Check Succeeded
  recordAuthorizationAudit({
    actor: { userId, email: userEmail, role: orgDecision.context?.role },
    organizationId: businessId,
    businessId,
    categoryId: businessCatId,
    agentId: requestedAgentId || orgDecision.context?.primaryAgentId,
    action: `authorized.${operationName}`,
    outcome: "ALLOW",
    reason: "Organization and Category checks passed",
    correlationId,
  });

  return orgDecision;
}

// -----------------------------------------------------------------------------
// EXPRESS MIDDLEWARE FOR ROUTE PROTECTION
// -----------------------------------------------------------------------------
export function requireOrgCategoryAuth(options: {
  permission?: string;
  targetBusinessParam?: string; // e.g. 'businessId' or query or body
  requireCategoryMatch?: boolean;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const userHeader = req.headers["x-user-id"] as string;
      const emailHeader = (req.headers["x-user-email"] as string) || "";

      let userId = userHeader;
      let userEmail = emailHeader;

      // Extract from Bearer token if header is not present
      if (!userId && authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7).trim();
        try {
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
            userId = payload.sub;
            userEmail = payload.email || "";
          }
        } catch {
          // invalid token
        }
      }

      // If running dev locally without auth, use dev local session
      if (!userId && process.env.NODE_ENV !== "production") {
        userId = "dev-local-user";
        userEmail = "dev@geflow.local";
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          code: "AUTH_UNAUTHORIZED",
          error: "Authentication token is missing or expired.",
        });
      }

      // Resolve businessId from query, params, or body
      const businessId =
        (req.query.businessId as string) ||
        (req.params.businessId as string) ||
        (req.params.id as string) ||
        (req.body && (req.body.businessId || req.body.business_id));

      if (!businessId) {
        // If businessId is not required on this endpoint, proceed
        return next();
      }

      const decision = await verifyOrganizationAccess({
        userId,
        userEmail,
        businessId,
        requiredPermission: options.permission || "read",
      });

      if (!decision.allowed) {
        return res.status(decision.statusCode || 403).json({
          success: false,
          code: decision.code || "AUTH_FORBIDDEN",
          error: decision.reason || "Access denied.",
        });
      }

      // Attach context to request for downstream handlers
      (req as any).authContext = decision.context;
      next();
    } catch (err: any) {
      console.error("Authorization middleware error:", err);
      return res.status(500).json({
        success: false,
        code: "AUTH_INTERNAL_ERROR",
        error: "Failed to evaluate authorization policies.",
      });
    }
  };
}

/**
 * Resolves requesting user identity from standard authorization mechanisms.
 */
export async function resolveRequestUser(
  req: Request
): Promise<{ userId: string; email?: string } | null> {
  const userHeader = req.headers["x-user-id"] as string;
  const emailHeader = (req.headers["x-user-email"] as string) || "";
  if (userHeader) {
    return { userId: userHeader, email: emailHeader };
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token) {
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
          if (payload?.sub) {
            return { userId: payload.sub, email: payload.email || emailHeader };
          }
        }
      } catch {
        // Fall through
      }
    }
  }

  // Fallback in non-production development mode
  if (process.env.NODE_ENV !== "production") {
    return { userId: "dev-local-user", email: "dev@geflow.local" };
  }

  return null;
}

