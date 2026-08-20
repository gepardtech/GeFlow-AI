/**
 * GEFLOW AI — REQUEST TRACING & AUDITING (PHASE 3)
 *
 * Trace logger for tracking AI queries, latency, provider selection, and errors.
 * Never logs API keys, user secrets, or raw prompt dumps.
 */

import { TraceRecord, AITaskType } from "./types";

const memoryTraces: TraceRecord[] = [];
const MAX_MEMORY_TRACES = 200;

export function generateRequestId(prefix: string = "GF-AI"): string {
  const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `${prefix}-${Date.now()}-${rand}`;
}

export function logTrace(trace: TraceRecord): void {
  memoryTraces.unshift(trace);
  if (memoryTraces.length > MAX_MEMORY_TRACES) {
    memoryTraces.pop();
  }

  // Safe internal structured console logging
  const safeLog = {
    tag: "[AI-TRACE]",
    requestId: trace.requestId,
    task: trace.taskType,
    provider: trace.provider,
    model: trace.model,
    status: trace.status,
    latencyMs: trace.latencyMs,
    errorCode: trace.errorCode || null,
  };

  if (trace.status === "error") {
    console.error(JSON.stringify(safeLog));
  } else {
    console.log(JSON.stringify(safeLog));
  }
}

export function getRecentTraces(businessId?: string): TraceRecord[] {
  if (businessId) {
    return memoryTraces.filter((t) => t.businessId === businessId);
  }
  return memoryTraces;
}
