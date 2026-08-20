/**
 * GEFLOW AI — MODEL ROUTER & DYNAMIC CONFIGURATION (PHASE 7)
 *
 * Central intelligence router determining provider and model dispatching.
 * Reads centralized task-based configuration from AIConfigurationService.
 * Enforces task routing preferences (Gemini / OpenAI / OpenRouter), request-level fallback history,
 * strict infinite-loop prevention, timeout management, error sanitization, and structured usage tracking.
 */

import {
  AIProviderInterface,
  AIAnalysisRequest,
  AIVerificationRequest,
  AIProviderResponse,
  AIProviderType,
  AITaskType,
} from "../types";
import { GeminiProvider } from "../providers/geminiProvider";
import { OpenAIProvider } from "../providers/openaiProvider";
import { OpenRouterProvider } from "../providers/openrouterProvider";
import { HeuristicFallbackProvider } from "../providers/heuristicFallbackProvider";
import { aiConfigurationService } from "../config/aiConfigurationService";
import { usageLogger } from "../usage/usageLogger";
import { AIServiceError, sanitizeError } from "../errors";

export interface RouterConfig {
  maxRetriesPerProvider?: number;
  requestTimeoutMs?: number;
}

export class ModelRouter {
  private providers: Map<AIProviderType, AIProviderInterface> = new Map();
  private config: Required<RouterConfig>;

  constructor(customProviders?: AIProviderInterface[], config?: RouterConfig) {
    this.config = {
      maxRetriesPerProvider: config?.maxRetriesPerProvider ?? 1,
      requestTimeoutMs: config?.requestTimeoutMs ?? 4000,
    };

    if (customProviders && customProviders.length > 0) {
      customProviders.forEach((p) => this.providers.set(p.name, p));
    } else {
      this.registerProvider(new GeminiProvider());
      this.registerProvider(new OpenAIProvider());
      this.registerProvider(new OpenRouterProvider());
      this.registerProvider(new HeuristicFallbackProvider());
    }
  }

  public registerProvider(provider: AIProviderInterface): void {
    this.providers.set(provider.name, provider);
  }

  public getProvider(name: AIProviderType): AIProviderInterface | undefined {
    return this.providers.get(name);
  }

  /**
   * Resolves the execution sequence for an AI task based on configured task routing,
   * caller preferences, active statuses, and capability filters.
   */
  public resolveProviderSequence(taskType: AITaskType, preferredProvider?: AIProviderType): AIProviderType[] {
    const routing = aiConfigurationService.getTaskRouting(taskType);
    const allRegistered = Array.from(this.providers.keys());

    // Task-specific sequence construction: primary -> fallback -> remaining active -> heuristic
    const defaultSequence: AIProviderType[] = [
      routing.primaryProvider,
      routing.fallbackProvider,
      "gemini",
      "openrouter",
      "openai",
      "heuristic_fallback",
    ];

    let sequence: AIProviderType[] = [
      ...allRegistered.filter((k) => !defaultSequence.includes(k)),
      ...defaultSequence.filter((k, idx, self) => self.indexOf(k) === idx && allRegistered.includes(k)),
    ];

    if (preferredProvider && this.providers.has(preferredProvider)) {
      sequence = [preferredProvider, ...sequence.filter((p) => p !== preferredProvider)];
    }

    return sequence;
  }

  /**
   * Dispatches product analysis using centralized task routing and active provider checks.
   */
  public async executeAnalysis(request: AIAnalysisRequest): Promise<AIProviderResponse> {
    const sequence = this.resolveProviderSequence("product_analysis", request.options?.preferredProvider);
    const attemptedProviders = new Set<string>();
    const errors: string[] = [];

    for (const providerName of sequence) {
      // Loop prevention: Each provider is only attempted once per request
      if (attemptedProviders.has(providerName)) {
        continue;
      }
      attemptedProviders.add(providerName);

      const provider = this.providers.get(providerName);

      // Check if provider is configured and is active in AIConfigurationService
      if (!provider || !provider.isConfigured()) {
        continue;
      }

      if (providerName !== "heuristic_fallback" && !aiConfigurationService.isProviderActive(providerName)) {
        errors.push(`Provider [${providerName}] is marked inactive in configuration`);
        continue;
      }

      // Determine model from request option or configuration
      const effectiveModel =
        request.options?.preferredModel || aiConfigurationService.getDefaultModel(providerName);
      const effectiveRequest: AIAnalysisRequest = {
        ...request,
        options: {
          ...request.options,
          preferredModel: effectiveModel,
        },
      };

      let attempt = 0;
      while (attempt < this.config.maxRetriesPerProvider) {
        attempt++;
        const startTime = Date.now();
        try {
          const timeoutMs = request.options?.timeoutMs || this.config.requestTimeoutMs;
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Timeout after ${timeoutMs}ms`)),
              timeoutMs
            )
          );

          const result = await Promise.race([provider.analyzeProduct(effectiveRequest), timeoutPromise]);

          // Log successful API usage
          usageLogger.logRequest({
            requestId: request.requestId,
            userId: request.userId,
            businessId: request.businessId || request.businessContext.businessId,
            provider: result.provider,
            model: result.model,
            taskType: "product_analysis",
            status: result.provider === "heuristic_fallback" ? "fallback" : "success",
            latencyMs: result.latencyMs || Date.now() - startTime,
            usageTokens: result.usage?.totalTokens || 0,
          });

          return result;
        } catch (err: any) {
          const sanitized = sanitizeError(err, request.requestId);
          errors.push(`Provider [${providerName}] attempt ${attempt} failed: ${sanitized.message}`);

          // If not retryable, immediately proceed to fallback provider
          if (!sanitized.retryable) {
            break;
          }
        }
      }
    }

    // Explicit fallback to deterministic local heuristic engine if not yet attempted
    const fallback = this.providers.get("heuristic_fallback");
    if (fallback && !attemptedProviders.has("heuristic_fallback")) {
      const result = await fallback.analyzeProduct(request);
      usageLogger.logRequest({
        requestId: request.requestId,
        userId: request.userId,
        businessId: request.businessId || request.businessContext.businessId,
        provider: "heuristic_fallback",
        model: "local-heuristic-v1",
        taskType: "product_analysis",
        status: "fallback",
        latencyMs: result.latencyMs,
      });
      return result;
    }

    throw new AIServiceError(
      "AI_PROVIDER_UNAVAILABLE",
      `All AI providers failed. Details: ${errors.join("; ")}`,
      { statusCode: 503, retryable: false, requestId: request.requestId }
    );
  }

  /**
   * Dispatches product verification across active providers.
   */
  public async executeVerification(request: AIVerificationRequest): Promise<AIProviderResponse> {
    const sequence = this.resolveProviderSequence("product_verification", request.options?.preferredProvider);
    const attemptedProviders = new Set<string>();

    for (const providerName of sequence) {
      if (attemptedProviders.has(providerName)) {
        continue;
      }
      attemptedProviders.add(providerName);

      const provider = this.providers.get(providerName);
      if (!provider || !provider.isConfigured()) {
        continue;
      }

      if (providerName !== "heuristic_fallback" && !aiConfigurationService.isProviderActive(providerName)) {
        continue;
      }

      const effectiveModel =
        request.options?.preferredModel || aiConfigurationService.getDefaultModel(providerName);
      const effectiveRequest: AIVerificationRequest = {
        ...request,
        options: {
          ...request.options,
          preferredModel: effectiveModel,
        },
      };

      const startTime = Date.now();
      try {
        const timeoutMs = request.options?.timeoutMs || this.config.requestTimeoutMs;
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout after ${timeoutMs}ms`)),
            timeoutMs
          )
        );

        const result = await Promise.race([provider.verifyProduct(effectiveRequest), timeoutPromise]);

        usageLogger.logRequest({
          requestId: request.requestId,
          userId: request.userId,
          businessId: request.businessId || request.businessContext.businessId,
          provider: result.provider,
          model: result.model,
          taskType: "product_verification",
          status: "success",
          latencyMs: result.latencyMs || Date.now() - startTime,
        });

        return result;
      } catch {
        // Technical failure: proceed immediately to next fallback provider
        continue;
      }
    }

    const fallback = this.providers.get("heuristic_fallback");
    if (fallback) {
      return fallback.verifyProduct(request);
    }

    throw new AIServiceError(
      "AI_PROVIDER_UNAVAILABLE",
      "All verification providers unavailable.",
      { statusCode: 503, requestId: request.requestId }
    );
  }
}
