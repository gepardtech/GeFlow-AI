/**
 * GeFlow AI — Centralized Audit Logging Service (Step 11)
 *
 * Implements an immutable, append-only cryptographic event ledger for agent executions,
 * tool invocations, security decisions, and governance actions across all 29 agents.
 *
 * Hash chaining: Each record contains the SHA-256 hash of the previous record
 * plus its own canonical serialized contents, guaranteeing tamper-evident audit trails.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  AgentAuditEventRecord,
  AuditEventCategory,
} from "./agentExecutionTypes";
import { organizationAuthService } from "../auth/organizationAuthService";

const DATA_DIR = path.resolve(process.cwd(), "data");
const AUDIT_LEDGER_FILE = path.join(DATA_DIR, "agent_audit_ledger.json");
const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

export interface AuditQueryFilter {
  business_id: string;
  agent_id?: string;
  category_id?: string;
  execution_id?: string;
  event_category?: AuditEventCategory;
  event_type?: string;
  actor_id?: string;
  target_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export class AgentAuditService {
  private ledger: AgentAuditEventRecord[] = [];
  private lastHash: string = GENESIS_HASH;

  constructor() {
    this.ensureDataDir();
    this.loadLedger();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (_e) {
        /* directory may already exist */
      }
    }
  }

  private loadLedger(): void {
    if (fs.existsSync(AUDIT_LEDGER_FILE)) {
      try {
        const raw = fs.readFileSync(AUDIT_LEDGER_FILE, "utf-8");
        const parsed: AgentAuditEventRecord[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.ledger = parsed;
          this.lastHash = parsed[parsed.length - 1].event_hash;
          return;
        }
      } catch (e) {
        console.error("[AgentAuditService] Error loading audit ledger, initializing fresh:", e);
      }
    }
    this.ledger = [];
    this.lastHash = GENESIS_HASH;
  }

  private persistLedger(): void {
    try {
      fs.writeFileSync(AUDIT_LEDGER_FILE, JSON.stringify(this.ledger, null, 2), "utf-8");
    } catch (e) {
      console.error("[AgentAuditService] Failed to persist audit ledger to disk:", e);
    }
  }

  /**
   * Sanitizes metadata to strip sensitive secrets, authorization headers, or auth tokens.
   */
  private sanitizeMetadata(data?: Record<string, any>): Record<string, any> {
    if (!data || typeof data !== "object") return {};
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = ["password", "secret", "token", "authorization", "key", "access_token"];

    for (const [k, v] of Object.entries(data)) {
      if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
        sanitized[k] = "[REDACTED]";
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        sanitized[k] = this.sanitizeMetadata(v);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  /**
   * Computes SHA-256 hash of an event given the previous hash.
   */
  private computeEventHash(
    previousHash: string,
    eventData: Omit<AgentAuditEventRecord, "event_hash">
  ): string {
    const canonicalPayload = JSON.stringify({
      previousHash,
      audit_event_id: eventData.audit_event_id,
      event_type: eventData.event_type,
      event_category: eventData.event_category,
      event_timestamp: eventData.event_timestamp,
      execution_id: eventData.execution_id || "",
      correlation_id: eventData.correlation_id,
      agent_id: eventData.agent_id || "",
      agent_configuration_version: eventData.agent_configuration_version || "",
      business_id: eventData.business_id,
      category_id: eventData.category_id || "",
      actor_type: eventData.actor_type,
      actor_id: eventData.actor_id,
      target_type: eventData.target_type,
      target_id: eventData.target_id,
      action: eventData.action,
      authorization_decision: eventData.authorization_decision,
      result_status: eventData.result_status,
      failure_code: eventData.failure_code || "",
      sanitized_metadata: eventData.sanitized_metadata,
    });

    return crypto.createHash("sha256").update(canonicalPayload).digest("hex");
  }

  /**
   * Appends an audit event to the tamper-evident ledger.
   */
  public recordEvent(
    event: Omit<AgentAuditEventRecord, "audit_event_id" | "event_timestamp" | "event_hash" | "previous_event_hash"> & {
      audit_event_id?: string;
      event_timestamp?: string;
    }
  ): AgentAuditEventRecord {
    const audit_event_id =
      event.audit_event_id ||
      `audit_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const event_timestamp = event.event_timestamp || new Date().toISOString();
    const sanitized_metadata = this.sanitizeMetadata(event.sanitized_metadata);

    const baseRecord: Omit<AgentAuditEventRecord, "event_hash"> = {
      audit_event_id,
      event_type: event.event_type,
      event_category: event.event_category,
      event_timestamp,
      execution_id: event.execution_id,
      correlation_id: event.correlation_id || `corr_${Date.now()}`,
      agent_id: event.agent_id,
      agent_configuration_version: event.agent_configuration_version,
      business_id: event.business_id,
      category_id: event.category_id,
      actor_type: event.actor_type,
      actor_id: event.actor_id,
      actor_email: event.actor_email,
      target_type: event.target_type,
      target_id: event.target_id,
      action: event.action,
      authorization_decision: event.authorization_decision,
      approval_reference: event.approval_reference,
      tool_id: event.tool_id,
      result_status: event.result_status,
      failure_code: event.failure_code,
      sanitized_metadata,
      previous_event_hash: this.lastHash,
    };

    const event_hash = this.computeEventHash(this.lastHash, baseRecord);
    const fullRecord: AgentAuditEventRecord = {
      ...baseRecord,
      event_hash,
    };

    this.ledger.push(fullRecord);
    this.lastHash = event_hash;
    this.persistLedger();

    return fullRecord;
  }

  /**
   * Queries audit ledger with strict role check (Manager, Admin, Owner, or Platform Admin).
   */
  public async getAuditEvents(
    filter: AuditQueryFilter,
    caller: { userId: string; isPlatformAdmin?: boolean }
  ): Promise<{ events: AgentAuditEventRecord[]; total: number; offset: number; limit: number }> {
    if (!filter.business_id) {
      throw new Error("business_id is required to query audit events.");
    }

    // Role verification
    const auth = await organizationAuthService.authorizeOrganizationAccess({
      userId: caller.userId,
      businessId: filter.business_id,
      isPlatformAdmin: caller.isPlatformAdmin,
    });

    if (!auth.allowed) {
      throw new Error(`Audit ledger access denied: ${auth.reason || "Unauthorized"}`);
    }

    const role = auth.role || "member";
    const allowedRoles = ["owner", "admin", "manager"];
    if (!caller.isPlatformAdmin && !allowedRoles.includes(role)) {
      throw new Error(`Audit ledger requires Manager, Admin, or Owner privilege (caller role is '${role}').`);
    }

    let records = this.ledger.filter((r) => r.business_id === filter.business_id);

    if (filter.agent_id) {
      records = records.filter((r) => r.agent_id === filter.agent_id);
    }
    if (filter.category_id) {
      records = records.filter((r) => r.category_id === filter.category_id);
    }
    if (filter.execution_id) {
      records = records.filter((r) => r.execution_id === filter.execution_id);
    }
    if (filter.event_category) {
      records = records.filter((r) => r.event_category === filter.event_category);
    }
    if (filter.event_type) {
      records = records.filter((r) => r.event_type === filter.event_type);
    }
    if (filter.actor_id) {
      records = records.filter((r) => r.actor_id === filter.actor_id);
    }
    if (filter.target_id) {
      records = records.filter((r) => r.target_id === filter.target_id);
    }
    if (filter.start_date) {
      const startMs = new Date(filter.start_date).getTime();
      records = records.filter((r) => new Date(r.event_timestamp).getTime() >= startMs);
    }
    if (filter.end_date) {
      const endMs = new Date(filter.end_date).getTime();
      records = records.filter((r) => new Date(r.event_timestamp).getTime() <= endMs);
    }

    // Newest first
    records.sort((a, b) => new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime());

    const total = records.length;
    const offset = Math.max(0, filter.offset || 0);
    const limit = Math.min(100, Math.max(1, filter.limit || 50));
    const paginated = records.slice(offset, offset + limit);

    return {
      events: paginated,
      total,
      offset,
      limit,
    };
  }

  /**
   * Verifies the cryptographic hash integrity of the entire ledger.
   */
  public verifyAuditIntegrity(): {
    valid: boolean;
    totalEvents: number;
    brokenAtEventId?: string;
    message: string;
  } {
    if (this.ledger.length === 0) {
      return { valid: true, totalEvents: 0, message: "Audit ledger is empty (integrity intact)." };
    }

    let expectedPrevHash = GENESIS_HASH;

    for (let i = 0; i < this.ledger.length; i++) {
      const event = this.ledger[i];

      if (event.previous_event_hash !== expectedPrevHash) {
        return {
          valid: false,
          totalEvents: this.ledger.length,
          brokenAtEventId: event.audit_event_id,
          message: `Integrity broken at event index ${i} (${event.audit_event_id}): previous_event_hash does not match chain.`,
        };
      }

      const calculatedHash = this.computeEventHash(expectedPrevHash, event);
      if (calculatedHash !== event.event_hash) {
        return {
          valid: false,
          totalEvents: this.ledger.length,
          brokenAtEventId: event.audit_event_id,
          message: `Integrity broken at event index ${i} (${event.audit_event_id}): event_hash signature mismatch.`,
        };
      }

      expectedPrevHash = event.event_hash;
    }

    return {
      valid: true,
      totalEvents: this.ledger.length,
      message: `Audit ledger verified intact across ${this.ledger.length} cryptographic events.`,
    };
  }
}

export const agentAuditService = new AgentAuditService();
