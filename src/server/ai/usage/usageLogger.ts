/**
 * GEFLOW AI — API USAGE & REQUEST LOGGER (PHASE 4)
 *
 * Records AI request metrics, token consumptions, and latencies.
 * Enforces strict multi-tenant isolation and guarantees no credentials or raw sensitive prompts are stored.
 */

import { AITaskType, AIProviderType } from "../types";
import { APIUsageSummary } from "@/types/aiConfiguration";

export interface LogRequestParams {
  requestId: string;
  userId: string;
  businessId: string;
  provider: AIProviderType | string;
  model: string;
  taskType: AITaskType | string;
  status: "success" | "fallback" | "error";
  latencyMs: number;
  errorCode?: string;
  usageTokens?: number;
}

export interface ApiRequestRecord extends LogRequestParams {
  id: string;
  createdAt: string;
}

export class UsageLogger {
  private static instance: UsageLogger;

  // In-memory request log buffer (limited to last 1000 items)
  private requestLogs: ApiRequestRecord[] = [];
  
  // Aggregated daily map: `${businessId}:${provider}:${model}:${day}` -> APIUsageSummary
  private dailySummaries: Map<string, APIUsageSummary> = new Map();

  public static getInstance(): UsageLogger {
    if (!UsageLogger.instance) {
      UsageLogger.instance = new UsageLogger();
    }
    return UsageLogger.instance;
  }

  /**
   * Logs an API request execution.
   */
  public logRequest(params: LogRequestParams): ApiRequestRecord {
    const now = new Date();
    const day = now.toISOString().split("T")[0];
    const record: ApiRequestRecord = {
      ...params,
      id: `req_log_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: now.toISOString(),
      usageTokens: params.usageTokens || 0,
    };

    // Store in FIFO ring buffer
    this.requestLogs.unshift(record);
    if (this.requestLogs.length > 1000) {
      this.requestLogs.pop();
    }

    // Update Daily Aggregate
    const summaryKey = `${params.businessId}:${params.provider}:${params.model}:${day}`;
    const existing = this.dailySummaries.get(summaryKey);

    if (existing) {
      existing.totalRequests += 1;
      existing.totalTokens += record.usageTokens || 0;
      existing.totalLatencyMs += record.latencyMs;
      existing.averageLatencyMs = Math.round(existing.totalLatencyMs / existing.totalRequests);
    } else {
      this.dailySummaries.set(summaryKey, {
        businessId: params.businessId,
        provider: params.provider,
        model: params.model,
        day,
        totalRequests: 1,
        totalTokens: record.usageTokens || 0,
        totalLatencyMs: record.latencyMs,
        averageLatencyMs: record.latencyMs,
      });
    }

    return record;
  }

  /**
   * Retrieves usage summary for a specific business (Tenant Isolation).
   */
  public getBusinessUsageSummary(businessId: string): APIUsageSummary[] {
    const results: APIUsageSummary[] = [];
    this.dailySummaries.forEach((summary) => {
      if (summary.businessId === businessId) {
        results.push({ ...summary });
      }
    });
    return results;
  }

  /**
   * Retrieves recent request logs for a specific business (Tenant Isolation).
   */
  public getBusinessRecentRequests(businessId: string, limit = 50): ApiRequestRecord[] {
    return this.requestLogs
      .filter((r) => r.businessId === businessId)
      .slice(0, limit);
  }

  public clear(): void {
    this.requestLogs = [];
    this.dailySummaries.clear();
  }
}

export const usageLogger = UsageLogger.getInstance();
