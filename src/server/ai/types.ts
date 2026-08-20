/**
 * GEFLOW AI — BACKEND AI SERVICE TYPES (PHASE 3)
 *
 * Provider-neutral types, interfaces, payload contracts, and error structures.
 */

import {
  ProductSuggestion,
  CategoryValidationContext,
  ConfidenceLevel,
  FieldVerificationDetail,
  DetailedProductVerification,
} from "@/types/aiProductIntelligence";

export type AIProviderType = "gemini" | "openai" | "openrouter" | "heuristic_fallback";

export type AITaskType =
  | "product_analysis"
  | "product_verification"
  | "product_category_detection"
  | "product_subcategory_detection"
  | "product_uom_detection"
  | "product_packaging_detection"
  | "business_analysis"
  | "assistant_response"
  | "vision_analysis"
  | "document_analysis";

export type AIErrorCode =
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_REQUEST_TIMEOUT"
  | "AI_INVALID_RESPONSE"
  | "AI_VALIDATION_FAILED"
  | "AI_UNAUTHORIZED"
  | "AI_TENANT_ACCESS_DENIED"
  | "AI_RATE_LIMITED"
  | "AI_INVALID_CONFIGURATION"
  | "AI_INTERNAL_ERROR";

export interface BusinessCatalogContext {
  businessId: string;
  businessName: string;
  industryType?: string;
  currency?: string;
  allowedCategories: Array<{
    id: string;
    name: string;
    slug?: string;
    industry_assignments?: string[];
  }>;
  allowedSubcategories: Array<{
    id: string;
    parentId: string | null;
    name: string;
    slug?: string;
  }>;
  allowedStockUnits?: string[];
}

export interface AIAnalysisRequest {
  requestId: string;
  userId: string;
  businessId: string;
  rawInput: string;
  businessContext: BusinessCatalogContext;
  currentFormState?: Record<string, any>;
  options?: {
    preferredProvider?: AIProviderType;
    preferredModel?: string;
    temperature?: number;
    timeoutMs?: number;
  };
}

export interface AIVerificationRequest {
  requestId: string;
  userId: string;
  businessId: string;
  originalInput?: string;
  suggestion: ProductSuggestion;
  businessContext: BusinessCatalogContext;
  searchEvidence?: string[];
  options?: {
    preferredProvider?: AIProviderType;
    preferredModel?: string;
    timeoutMs?: number;
  };
}

export interface AIProviderResponse {
  rawOutput: any;
  provider: AIProviderType;
  model: string;
  latencyMs: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface AIProviderInterface {
  readonly name: AIProviderType;
  readonly defaultModel: string;
  analyzeProduct(request: AIAnalysisRequest): Promise<AIProviderResponse>;
  verifyProduct(request: AIVerificationRequest): Promise<AIProviderResponse>;
  isConfigured(): boolean;
}

export type AIVerificationResult = DetailedProductVerification;

export interface TraceRecord {
  requestId: string;
  userId: string;
  businessId: string;
  taskType: AITaskType;
  provider: string;
  model: string;
  status: "success" | "fallback" | "error";
  latencyMs: number;
  errorCode?: string;
  createdAt: string;
}
