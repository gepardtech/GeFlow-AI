/**
 * GEFLOW AI — AI CONFIGURATION SERVICE (PHASE 7)
 *
 * Central intelligence configuration registry.
 * Manages active/inactive statuses, default models, provider health,
 * task routing rules, and safe administrative views.
 */

import { AIProviderType, AITaskType } from "../types";
import {
  AIProviderRecord,
  AIModelRecord,
  ProviderHealthStatus,
  ProviderConfigurationView,
  TaskRoutingConfig,
} from "@/types/aiConfiguration";
import { credentialService } from "./credentialService";

export class AIConfigurationService {
  private static instance: AIConfigurationService;

  private providers: Map<AIProviderType, AIProviderRecord> = new Map();
  private models: Map<string, AIModelRecord> = new Map();
  private taskRoutings: Map<AITaskType, Partial<TaskRoutingConfig>> = new Map();

  constructor() {
    this.seedDefaultConfiguration();
  }

  public static getInstance(): AIConfigurationService {
    if (!AIConfigurationService.instance) {
      AIConfigurationService.instance = new AIConfigurationService();
    }
    return AIConfigurationService.instance;
  }

  /**
   * Initializes default provider & model registries.
   */
  private seedDefaultConfiguration(): void {
    const now = new Date().toISOString();

    // 1. Providers
    const defaultProviders: AIProviderRecord[] = [
      {
        id: "11111111-1111-4111-a111-111111111111",
        name: "Google Gemini",
        slug: "gemini",
        provider_type: "model_provider",
        is_active: true,
        is_default: true,
        health_status: "unknown",
        last_health_check: null,
        description: "Primary product extraction & categorization engine",
        created_at: now,
        updated_at: now,
      },
      {
        id: "22222222-2222-4222-a222-222222222222",
        name: "OpenAI",
        slug: "openai",
        provider_type: "model_provider",
        is_active: true,
        is_default: false,
        health_status: "unknown",
        last_health_check: null,
        description: "Primary consistency auditor & reasoning verifier",
        created_at: now,
        updated_at: now,
      },
      {
        id: "33333333-3333-4333-a333-333333333333",
        name: "OpenRouter",
        slug: "openrouter",
        provider_type: "model_router",
        is_active: true,
        is_default: false,
        health_status: "unknown",
        last_health_check: null,
        description: "Multi-model gateway & flexible fallback routing layer",
        created_at: now,
        updated_at: now,
      },
    ];

    defaultProviders.forEach((p) => this.providers.set(p.slug, p));

    // 2. Models
    const defaultModels: AIModelRecord[] = [
      // Gemini Models
      {
        id: "m_gemini_flash",
        provider_id: "11111111-1111-4111-a111-111111111111",
        provider_slug: "gemini",
        model_id: "gemini-3.7-flash",
        display_name: "Gemini 3.7 Flash",
        model_type: "multimodal",
        capabilities: [
          "product_analysis",
          "product_category_detection",
          "product_subcategory_detection",
          "product_uom_detection",
          "product_packaging_detection",
          "product_verification",
          "assistant_response",
          "vision_analysis",
        ],
        is_active: true,
        is_default: true,
        priority: 1,
        fallback_eligible: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: "m_gemini_pro",
        provider_id: "11111111-1111-4111-a111-111111111111",
        provider_slug: "gemini",
        model_id: "gemini-3.1-pro-preview",
        display_name: "Gemini 3.1 Pro",
        model_type: "multimodal",
        capabilities: [
          "product_analysis",
          "product_verification",
          "business_analysis",
          "document_analysis",
          "vision_analysis",
        ],
        is_active: true,
        is_default: false,
        priority: 2,
        fallback_eligible: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: "m_gemini_lite",
        provider_id: "11111111-1111-4111-a111-111111111111",
        provider_slug: "gemini",
        model_id: "gemini-3.1-flash-lite",
        display_name: "Gemini 3.1 Flash Lite",
        model_type: "multimodal",
        capabilities: [
          "product_analysis",
          "product_category_detection",
          "product_uom_detection",
          "assistant_response",
        ],
        is_active: true,
        is_default: false,
        priority: 3,
        fallback_eligible: true,
        created_at: now,
        updated_at: now,
      },

      // OpenAI Models
      {
        id: "m_openai_mini",
        provider_id: "22222222-2222-4222-a222-222222222222",
        provider_slug: "openai",
        model_id: "gpt-4o-mini",
        display_name: "GPT-4o Mini",
        model_type: "reasoning",
        capabilities: [
          "product_analysis",
          "product_verification",
          "product_category_detection",
          "product_uom_detection",
          "assistant_response",
        ],
        is_active: true,
        is_default: true,
        priority: 1,
        fallback_eligible: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: "m_openai_4o",
        provider_id: "22222222-2222-4222-a222-222222222222",
        provider_slug: "openai",
        model_id: "gpt-4o",
        display_name: "GPT-4o",
        model_type: "reasoning",
        capabilities: [
          "product_analysis",
          "product_verification",
          "business_analysis",
          "vision_analysis",
          "document_analysis",
        ],
        is_active: true,
        is_default: false,
        priority: 2,
        fallback_eligible: true,
        created_at: now,
        updated_at: now,
      },

      // OpenRouter Models
      {
        id: "m_openrouter_llama",
        provider_id: "33333333-3333-4333-a333-333333333333",
        provider_slug: "openrouter",
        model_id: "meta-llama/llama-3.3-70b-instruct",
        display_name: "Llama 3.3 70B Instruct",
        model_type: "text",
        capabilities: [
          "product_analysis",
          "product_verification",
          "product_category_detection",
          "product_subcategory_detection",
          "product_uom_detection",
          "product_packaging_detection",
          "assistant_response",
          "business_analysis",
        ],
        is_active: true,
        is_default: true,
        priority: 1,
        fallback_eligible: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: "m_openrouter_claude",
        provider_id: "33333333-3333-4333-a333-333333333333",
        provider_slug: "openrouter",
        model_id: "anthropic/claude-3.5-sonnet",
        display_name: "Claude 3.5 Sonnet",
        model_type: "multimodal",
        capabilities: [
          "product_analysis",
          "product_verification",
          "business_analysis",
          "document_analysis",
          "vision_analysis",
        ],
        is_active: true,
        is_default: false,
        priority: 2,
        fallback_eligible: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: "m_openrouter_mistral",
        provider_id: "33333333-3333-4333-a333-333333333333",
        provider_slug: "openrouter",
        model_id: "mistralai/mistral-large-2411",
        display_name: "Mistral Large 2411",
        model_type: "reasoning",
        capabilities: [
          "product_analysis",
          "product_verification",
          "business_analysis",
          "assistant_response",
        ],
        is_active: true,
        is_default: false,
        priority: 3,
        fallback_eligible: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: "m_openrouter_deepseek",
        provider_id: "33333333-3333-4333-a333-333333333333",
        provider_slug: "openrouter",
        model_id: "deepseek/deepseek-chat",
        display_name: "DeepSeek V3",
        model_type: "reasoning",
        capabilities: [
          "product_analysis",
          "product_verification",
          "business_analysis",
        ],
        is_active: true,
        is_default: false,
        priority: 4,
        fallback_eligible: true,
        created_at: now,
        updated_at: now,
      },
    ];

    defaultModels.forEach((m) => this.models.set(`${m.provider_slug}:${m.model_id}`, m));
  }

  /**
   * Returns all providers with their active configurations and safe metadata.
   */
  public getAllProviderViews(): ProviderConfigurationView[] {
    const views: ProviderConfigurationView[] = [];

    this.providers.forEach((p) => {
      const pModels = this.getModelsForProvider(p.slug);
      const defaultModel = pModels.find((m) => m.is_default) || pModels[0] || null;
      const credStatus = credentialService.getCredentialStatus(p.slug);

      views.push({
        provider: { ...p },
        models: pModels,
        defaultModel,
        isConfigured: credStatus.isConfigured,
        hasValidCredentials: credStatus.isConfigured,
        maskedKeySummary: credStatus.maskedKey,
      });
    });

    return views;
  }

  public getProvider(slug: AIProviderType): AIProviderRecord | undefined {
    return this.providers.get(slug);
  }

  public getActiveProviders(): AIProviderRecord[] {
    return Array.from(this.providers.values()).filter((p) => p.is_active);
  }

  public isProviderActive(slug: AIProviderType | string): boolean {
    if (slug === "heuristic_fallback") return true;
    const p = this.providers.get(slug as AIProviderType);
    if (!p) {
      return true;
    }
    return p.is_active;
  }

  public getModelsForProvider(slug: AIProviderType): AIModelRecord[] {
    return Array.from(this.models.values()).filter((m) => m.provider_slug === slug);
  }

  public getActiveModelsForProvider(slug: AIProviderType): AIModelRecord[] {
    return Array.from(this.models.values()).filter(
      (m) => m.provider_slug === slug && m.is_active
    );
  }

  public getDefaultModel(slug: AIProviderType): string {
    const activeModels = this.getActiveModelsForProvider(slug);
    const def = activeModels.find((m) => m.is_default);
    if (def) return def.model_id;
    if (activeModels.length > 0) return activeModels[0].model_id;

    // Static fallback defaults
    switch (slug) {
      case "gemini":
        return "gemini-3.7-flash";
      case "openai":
        return "gpt-4o-mini";
      case "openrouter":
        return "meta-llama/llama-3.3-70b-instruct";
      default:
        return "local-heuristic-v1";
    }
  }

  public setProviderStatus(slug: AIProviderType, isActive: boolean): void {
    const p = this.providers.get(slug);
    if (p) {
      p.is_active = isActive;
      p.updated_at = new Date().toISOString();
    }
  }

  public setProviderHealth(slug: AIProviderType, healthStatus: ProviderHealthStatus): void {
    const p = this.providers.get(slug);
    if (p) {
      p.health_status = healthStatus;
      p.last_health_check = new Date().toISOString();
      p.updated_at = new Date().toISOString();
    }
  }

  public setDefaultProvider(slug: AIProviderType): void {
    this.providers.forEach((p) => {
      p.is_default = p.slug === slug;
      p.updated_at = new Date().toISOString();
    });
  }

  public setModelStatus(providerSlug: AIProviderType, modelId: string, isActive: boolean): void {
    const key = `${providerSlug}:${modelId}`;
    const m = this.models.get(key);
    if (m) {
      m.is_active = isActive;
      m.updated_at = new Date().toISOString();
    }
  }

  public setDefaultModel(providerSlug: AIProviderType, modelId: string): void {
    this.models.forEach((m) => {
      if (m.provider_slug === providerSlug) {
        m.is_default = m.model_id === modelId;
        m.updated_at = new Date().toISOString();
      }
    });
  }

  public registerModel(model: Omit<AIModelRecord, "created_at" | "updated_at">): void {
    const now = new Date().toISOString();
    const fullRecord: AIModelRecord = {
      ...model,
      created_at: now,
      updated_at: now,
    };
    if (model.is_default) {
      this.setDefaultModel(model.provider_slug || "openrouter", model.model_id);
    }
    this.models.set(`${model.provider_slug}:${model.model_id}`, fullRecord);
  }

  public setTaskRouting(taskType: AITaskType, config: Partial<TaskRoutingConfig>): void {
    this.taskRoutings.set(taskType, config);
  }

  /**
   * Returns Centralized Task Routing configuration.
   * Ensures only active providers with valid configurations are assigned.
   */
  public getTaskRouting(taskType: AITaskType): TaskRoutingConfig {
    const customConfig = this.taskRoutings.get(taskType);

    if (taskType === "product_analysis" || taskType.startsWith("product_")) {
      if (taskType === "product_verification") {
        const openaiActive = this.isProviderActive("openai") && credentialService.isProviderReady("openai");
        const openrouterActive = this.isProviderActive("openrouter") && credentialService.isProviderReady("openrouter");
        const geminiActive = this.isProviderActive("gemini") && credentialService.isProviderReady("gemini");

        let primary: AIProviderType = customConfig?.primaryProvider || "openai";
        if (primary === "openai" && !openaiActive) {
          if (geminiActive) primary = "gemini";
          else if (openrouterActive) primary = "openrouter";
          else primary = "heuristic_fallback";
        }

        let fallback: AIProviderType = customConfig?.fallbackProvider || (primary === "gemini" ? "openrouter" : "gemini");
        if (fallback === "openrouter" && !openrouterActive) {
          if (geminiActive && primary !== "gemini") fallback = "gemini";
          else fallback = "heuristic_fallback";
        } else if (fallback === "gemini" && !geminiActive) {
          if (openrouterActive && primary !== "openrouter") fallback = "openrouter";
          else fallback = "heuristic_fallback";
        }

        return {
          taskType,
          primaryProvider: primary,
          primaryModel: customConfig?.primaryModel || this.getDefaultModel(primary),
          fallbackProvider: fallback,
          fallbackModel: customConfig?.fallbackModel || this.getDefaultModel(fallback),
        };
      }

      // Default product intake tasks (analysis, category detection, UOM detection, etc.)
      const geminiActive = this.isProviderActive("gemini") && credentialService.isProviderReady("gemini");
      const openrouterActive = this.isProviderActive("openrouter") && credentialService.isProviderReady("openrouter");
      const openaiActive = this.isProviderActive("openai") && credentialService.isProviderReady("openai");

      let primary: AIProviderType = customConfig?.primaryProvider || "gemini";
      if (primary === "gemini" && !geminiActive) {
        if (openrouterActive) primary = "openrouter";
        else if (openaiActive) primary = "openai";
        else primary = "heuristic_fallback";
      }

      let fallback: AIProviderType = customConfig?.fallbackProvider || "openrouter";
      if (fallback === "openrouter" && !openrouterActive) {
        if (openaiActive) fallback = "openai";
        else fallback = "heuristic_fallback";
      }

      return {
        taskType,
        primaryProvider: primary,
        primaryModel: customConfig?.primaryModel || this.getDefaultModel(primary),
        fallbackProvider: fallback,
        fallbackModel: customConfig?.fallbackModel || this.getDefaultModel(fallback),
      };
    } else if (taskType === "vision_analysis") {
      const geminiActive = this.isProviderActive("gemini") && credentialService.isProviderReady("gemini");
      const openrouterActive = this.isProviderActive("openrouter") && credentialService.isProviderReady("openrouter");
      const openaiActive = this.isProviderActive("openai") && credentialService.isProviderReady("openai");

      let primary: AIProviderType = customConfig?.primaryProvider || "gemini";
      if (primary === "gemini" && !geminiActive) {
        if (openrouterActive) primary = "openrouter";
        else if (openaiActive) primary = "openai";
        else primary = "heuristic_fallback";
      }

      let fallback: AIProviderType = customConfig?.fallbackProvider || "openrouter";
      if (fallback === "openrouter" && !openrouterActive) {
        if (openaiActive) fallback = "openai";
        else fallback = "heuristic_fallback";
      }

      return {
        taskType,
        primaryProvider: primary,
        primaryModel: customConfig?.primaryModel || this.getDefaultModel(primary),
        fallbackProvider: fallback,
        fallbackModel: customConfig?.fallbackModel || this.getDefaultModel(fallback),
      };
    } else {
      // General assistant or business analysis
      const openrouterActive = this.isProviderActive("openrouter") && credentialService.isProviderReady("openrouter");
      const geminiActive = this.isProviderActive("gemini") && credentialService.isProviderReady("gemini");
      const openaiActive = this.isProviderActive("openai") && credentialService.isProviderReady("openai");

      let primary: AIProviderType = customConfig?.primaryProvider || "gemini";
      if (!geminiActive) {
        if (openrouterActive) primary = "openrouter";
        else if (openaiActive) primary = "openai";
        else primary = "heuristic_fallback";
      }

      let fallback: AIProviderType = customConfig?.fallbackProvider || "openrouter";
      if (!openrouterActive) {
        if (openaiActive) fallback = "openai";
        else fallback = "heuristic_fallback";
      }

      return {
        taskType,
        primaryProvider: primary,
        primaryModel: customConfig?.primaryModel || this.getDefaultModel(primary),
        fallbackProvider: fallback,
        fallbackModel: customConfig?.fallbackModel || this.getDefaultModel(fallback),
      };
    }
  }
}

export const aiConfigurationService = AIConfigurationService.getInstance();
