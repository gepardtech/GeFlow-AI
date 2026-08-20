/**
 * GEFLOW AI — AI PROVIDER CONFIGURATION TYPES (PHASE 4)
 *
 * Types for Supabase ai_providers, ai_models, and ai_provider_keys metadata.
 * Strictly guarantees that raw secret API keys are never included in client schemas.
 */

import { AIProviderType, AITaskType, AIErrorCode } from "@/server/ai/types";

export type ProviderTypeEnum = "model_provider" | "model_router";

export type ProviderHealthStatus = "healthy" | "degraded" | "unavailable" | "disabled" | "unhealthy" | "unknown";

export interface AIProviderRecord {
  id: string;
  name: string;
  slug: AIProviderType;
  provider_type: ProviderTypeEnum;
  is_active: boolean;
  is_default: boolean;
  health_status: ProviderHealthStatus;
  last_health_check: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIModelRecord {
  id: string;
  provider_id: string;
  provider_slug?: AIProviderType;
  model_id: string;
  display_name: string;
  model_type: "multimodal" | "reasoning" | "text" | "vision" | "long_context";
  capabilities: string[];
  is_active: boolean;
  is_default: boolean;
  priority?: number;
  fallback_eligible?: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AIProviderKeyMetadata {
  id: string;
  provider_id: string;
  provider_slug: AIProviderType;
  key_name: string;
  key_source: "env" | "database" | "vault";
  masked_key: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProviderConfigurationView {
  provider: AIProviderRecord;
  models: AIModelRecord[];
  defaultModel: AIModelRecord | null;
  isConfigured: boolean;
  hasValidCredentials: boolean;
  maskedKeySummary?: string | null;
}

export interface AIConnectionTestRequest {
  provider: AIProviderType;
  modelId?: string;
}

export interface AIConnectionTestResult {
  success: boolean;
  provider: AIProviderType;
  model: string;
  latencyMs: number;
  healthStatus: ProviderHealthStatus;
  errorCode?: AIErrorCode;
  message?: string;
  testedAt: string;
}

export interface TaskRoutingConfig {
  taskType: AITaskType;
  primaryProvider: AIProviderType;
  primaryModel: string;
  fallbackProvider: AIProviderType;
  fallbackModel: string;
  verificationProvider?: AIProviderType;
  verificationModel?: string;
}

export interface APIUsageSummary {
  businessId: string;
  provider: string;
  model: string;
  day: string;
  totalRequests: number;
  totalTokens: number;
  totalLatencyMs: number;
  averageLatencyMs: number;
}
