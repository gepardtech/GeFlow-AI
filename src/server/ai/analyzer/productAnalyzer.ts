/**
 * GEFLOW AI — PRODUCT ANALYZER (PHASE 3)
 *
 * Core orchestrator for product intelligence extraction.
 * Validates request, filters context, calls Model Router, normalizes responses,
 * runs schema validation, scores confidence, and returns ProductSuggestion.
 *
 * (NEVER saves records to the database!)
 */

import { ProductSuggestion, CategoryValidationContext } from "@/types/aiProductIntelligence";
import { validateProductSuggestion } from "@/lib/ai/productIntelligenceValidation";
import { AIAnalysisRequest } from "../types";
import { ModelRouter } from "../router/modelRouter";
import { ProductVerifier } from "../verifier/productVerifier";
import { normalizeProviderOutput } from "../normalizers/responseNormalizer";
import { AIServiceError } from "../errors";
import { logTrace } from "../tracing";
import { enforceRateLimit } from "../rateLimiter";

export class ProductAnalyzer {
  constructor(
    private modelRouter: ModelRouter,
    private verifier?: ProductVerifier
  ) {}

  public async analyze(request: AIAnalysisRequest): Promise<ProductSuggestion> {
    const startTime = Date.now();

    // 1. Request parameter validation
    if (!request.rawInput || request.rawInput.trim().length === 0) {
      throw new AIServiceError("AI_VALIDATION_FAILED", "Product rawInput text cannot be empty.", {
        statusCode: 400,
        requestId: request.requestId,
      });
    }

    if (!request.businessContext || !request.businessContext.businessId) {
      throw new AIServiceError("AI_VALIDATION_FAILED", "Valid businessContext is required.", {
        statusCode: 400,
        requestId: request.requestId,
      });
    }

    // 2. Rate Limiting Check
    enforceRateLimit(request.userId, request.businessContext.businessId, request.requestId);

    // 3. Prepare Catalog Validation Context
    const categoryContext: CategoryValidationContext = {
      allowedPrimaryCategories: (request.businessContext.allowedCategories || []).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
      })),
      allowedSubcategories: (request.businessContext.allowedSubcategories || []).map((s) => ({
        id: s.id,
        parentId: s.parentId || undefined,
        name: s.name,
        slug: s.slug,
      })),
    };

    // 4. Execute AI Model Router
    let providerResponse;
    let traceStatus: "success" | "fallback" | "error" = "success";
    let errorCode: string | undefined;

    try {
      providerResponse = await this.modelRouter.executeAnalysis(request);
      if (providerResponse.provider === "heuristic_fallback") {
        traceStatus = "fallback";
      }
    } catch (err: any) {
      traceStatus = "error";
      errorCode = err?.code || "AI_EXECUTION_FAILED";
      logTrace({
        requestId: request.requestId,
        userId: request.userId,
        businessId: request.businessContext.businessId,
        taskType: "product_analysis",
        provider: "unknown",
        model: "unknown",
        status: "error",
        latencyMs: Date.now() - startTime,
        errorCode,
        createdAt: new Date().toISOString(),
      });
      throw err;
    }

    // 5. Response Normalization to Phase 2 Contract
    const suggestion = normalizeProviderOutput(
      providerResponse,
      categoryContext,
      request.requestId
    );

    // 6. Validation System
    const validation = validateProductSuggestion(suggestion, categoryContext);
    if (!validation.isValid) {
      // Append validation errors as warnings rather than crashing, maintaining user editability
      suggestion.warnings.push(...validation.errors.map((e) => `[Validation Warning] ${e.field}: ${e.message}`));
      suggestion.needs_review = true;
      suggestion.confidence_level = "low";
      suggestion.uncertain_fields.push(...validation.errors.map((e) => e.field));
    }

    // 7. Phase 6 OpenAI Verification Layer
    if (this.verifier) {
      try {
        const verification = await this.verifier.verify(
          suggestion,
          request.businessContext,
          request.userId,
          request.requestId,
          request.rawInput
        );
        suggestion.verification = verification;
        if (verification.needs_review) {
          suggestion.needs_review = true;
        }
        if (verification.confidenceLevel === "low") {
          suggestion.confidence_level = "low";
        } else if (verification.confidenceLevel === "medium" && suggestion.confidence_level === "high") {
          suggestion.confidence_level = "medium";
        }
        suggestion.overall_confidence = Math.min(suggestion.overall_confidence, verification.confidenceScore);
        if (verification.uncertainFields && verification.uncertainFields.length > 0) {
          suggestion.uncertain_fields = Array.from(
            new Set([...suggestion.uncertain_fields, ...verification.uncertainFields])
          );
        }
        if (verification.critiqueNotes && verification.critiqueNotes.length > 0) {
          suggestion.warnings = Array.from(
            new Set([...suggestion.warnings, ...verification.critiqueNotes])
          );
        }
        // Update field_confidence_details with verified outcomes
        if (verification.fieldVerifications && suggestion.field_confidence_details) {
          Object.entries(verification.fieldVerifications).forEach(([fieldKey, vDetail]) => {
            if (suggestion.field_confidence_details && suggestion.field_confidence_details[fieldKey]) {
              if (vDetail.status === "verified") {
                suggestion.field_confidence_details[fieldKey].validated = true;
                suggestion.field_confidence_details[fieldKey].source = "verified";
                suggestion.field_confidence_details[fieldKey].confidence_score = Math.max(
                  suggestion.field_confidence_details[fieldKey].confidence_score,
                  0.92
                );
                suggestion.field_confidence_details[fieldKey].confidence_level = "high";
                suggestion.field_confidence_details[fieldKey].needs_review = false;
              } else if (vDetail.status === "invalid" || vDetail.status === "conflicting") {
                suggestion.field_confidence_details[fieldKey].validated = false;
                suggestion.field_confidence_details[fieldKey].confidence_score = Math.min(
                  suggestion.field_confidence_details[fieldKey].confidence_score,
                  0.45
                );
                suggestion.field_confidence_details[fieldKey].confidence_level = "low";
                suggestion.field_confidence_details[fieldKey].needs_review = true;
                if (vDetail.reason) {
                  suggestion.field_confidence_details[fieldKey].reason = vDetail.reason;
                }
              } else if (vDetail.status === "uncertain") {
                suggestion.field_confidence_details[fieldKey].needs_review = true;
                suggestion.field_confidence_details[fieldKey].confidence_score = Math.min(
                  suggestion.field_confidence_details[fieldKey].confidence_score,
                  0.58
                );
                suggestion.field_confidence_details[fieldKey].confidence_level = "low";
                if (vDetail.reason) {
                  suggestion.field_confidence_details[fieldKey].reason = vDetail.reason;
                }
              }
            }
          });
        }
      } catch (verErr) {
        console.warn("Non-fatal verification step skipped:", verErr);
      }
    }

    // 8. Request Tracing
    logTrace({
      requestId: request.requestId,
      userId: request.userId,
      businessId: request.businessContext.businessId,
      taskType: "product_analysis",
      provider: providerResponse.provider,
      model: providerResponse.model,
      status: traceStatus,
      latencyMs: Date.now() - startTime,
      createdAt: new Date().toISOString(),
    });

    return suggestion;
  }
}
