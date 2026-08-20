/**
 * GEFLOW AI — PROVIDER CONNECTION TESTER (PHASE 4)
 *
 * Secure server-side diagnostic capability.
 * Probes provider connectivity with lightweight probes, calculates latencies,
 * normalizes failure error codes, and safely logs diagnostics without leaking secrets.
 */

import { GoogleGenAI } from "@google/genai";
import { AIProviderType, AIErrorCode } from "../types";
import { AIConnectionTestResult, ProviderHealthStatus } from "@/types/aiConfiguration";
import { credentialService } from "../config/credentialService";
import { aiConfigurationService } from "../config/aiConfigurationService";

export class ProviderConnectionTester {
  /**
   * Performs an isolated connectivity test against the specified provider.
   */
  public async testProvider(
    provider: AIProviderType,
    customModel?: string
  ): Promise<AIConnectionTestResult> {
    const startTime = Date.now();
    const model = customModel || aiConfigurationService.getDefaultModel(provider);
    const testedAt = new Date().toISOString();

    if (provider === "heuristic_fallback") {
      aiConfigurationService.setProviderHealth(provider, "healthy");
      return {
        success: true,
        provider,
        model: "local-heuristic-v1",
        latencyMs: 1,
        healthStatus: "healthy",
        testedAt,
      };
    }

    const rawKey = credentialService.getRawKey(provider);
    if (!rawKey) {
      aiConfigurationService.setProviderHealth(provider, "unhealthy");
      return {
        success: false,
        provider,
        model,
        latencyMs: 0,
        healthStatus: "unhealthy",
        errorCode: "AI_INVALID_CONFIGURATION",
        message: `No API key configured for ${provider}. Ensure ${provider.toUpperCase()}_API_KEY is set.`,
        testedAt,
      };
    }

    try {
      if (provider === "gemini") {
        await this.probeGemini(rawKey, model);
      } else if (provider === "openai") {
        await this.probeOpenAI(rawKey, model);
      } else if (provider === "openrouter") {
        await this.probeOpenRouter(rawKey, model);
      }

      const latencyMs = Date.now() - startTime;
      aiConfigurationService.setProviderHealth(provider, "healthy");

      return {
        success: true,
        provider,
        model,
        latencyMs,
        healthStatus: "healthy",
        testedAt,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const { errorCode, userMessage } = this.normalizeDiagnosticError(err, provider);
      
      aiConfigurationService.setProviderHealth(provider, "unhealthy");

      return {
        success: false,
        provider,
        model,
        latencyMs,
        healthStatus: "unhealthy",
        errorCode,
        message: userMessage,
        testedAt,
      };
    }
  }

  private async probeGemini(apiKey: string, model: string): Promise<void> {
    const client = new GoogleGenAI({ apiKey });
    await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: "Ping" }] }],
      config: {
        maxOutputTokens: 2,
      },
    });
  }

  private async probeOpenAI(apiKey: string, model: string): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Ping" }],
          max_tokens: 2,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async probeOpenRouter(apiKey: string, model: string): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://geflow.app",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Ping" }],
          max_tokens: 2,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private normalizeDiagnosticError(
    err: any,
    provider: AIProviderType
  ): { errorCode: AIErrorCode; userMessage: string } {
    const msg = String(err?.message || "").toLowerCase();

    if (err?.name === "AbortError" || msg.includes("timeout") || msg.includes("aborted")) {
      return {
        errorCode: "AI_REQUEST_TIMEOUT",
        userMessage: `Connection to ${provider} timed out after 8 seconds.`,
      };
    }

    if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("invalid api key") || msg.includes("authentication")) {
      return {
        errorCode: "AI_UNAUTHORIZED",
        userMessage: `Authentication failed. The API key for ${provider} is invalid or expired.`,
      };
    }

    if (msg.includes("429") || msg.includes("rate limit") || msg.includes("quota") || msg.includes("insufficient_quota")) {
      return {
        errorCode: "AI_RATE_LIMITED",
        userMessage: `Rate limit or quota exceeded for ${provider}.`,
      };
    }

    if (msg.includes("model not found") || msg.includes("does not exist") || msg.includes("invalid model")) {
      return {
        errorCode: "AI_INVALID_RESPONSE",
        userMessage: `Specified model is not supported or accessible with this ${provider} account.`,
      };
    }

    return {
      errorCode: "AI_PROVIDER_UNAVAILABLE",
      userMessage: `Unable to reach ${provider} service. Check network connectivity.`,
    };
  }
}

export const providerConnectionTester = new ProviderConnectionTester();
