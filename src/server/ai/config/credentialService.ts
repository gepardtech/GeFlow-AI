/**
 * GEFLOW AI — SECURE CREDENTIAL SERVICE (PHASE 4)
 *
 * Resolves AI provider API keys exclusively in the secure server environment.
 * Never leaks raw secrets to client bundles, frontend network calls, or loggers.
 */

import { AIProviderType } from "../types";

export interface CredentialStatus {
  isConfigured: boolean;
  source: "env" | "database" | "none";
  maskedKey: string | null;
  keyName: string;
}

export class CredentialService {
  private static instance: CredentialService;

  private envKeyMap: Record<AIProviderType, string> = {
    gemini: "GEMINI_API_KEY",
    openai: "OPENAI_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    heuristic_fallback: "",
  };

  public static getInstance(): CredentialService {
    if (!CredentialService.instance) {
      CredentialService.instance = new CredentialService();
    }
    return CredentialService.instance;
  }

  /**
   * Securely gets the raw provider key on the server.
   * STRICTLY SERVER-SIDE ONLY.
   */
  public getRawKey(provider: AIProviderType): string | null {
    if (provider === "heuristic_fallback") {
      return "local-heuristic";
    }

    const envVarName = this.envKeyMap[provider];
    if (envVarName && process.env[envVarName]) {
      const val = process.env[envVarName]?.trim();
      return val && val.length > 0 ? val : null;
    }

    return null;
  }

  /**
   * Returns a safe masked representation of the API key for administrative UI visibility.
   * e.g., 'sk-...3f81' or 'AIza...8a9b'
   */
  public getMaskedKey(provider: AIProviderType): string | null {
    const raw = this.getRawKey(provider);
    if (!raw || provider === "heuristic_fallback") {
      return null;
    }

    if (raw.length <= 8) {
      return "••••••••";
    }

    const prefix = raw.substring(0, 4);
    const suffix = raw.substring(raw.length - 4);
    return `${prefix}...${suffix}`;
  }

  /**
   * Retrieves provider credential status without exposing the key value.
   */
  public getCredentialStatus(provider: AIProviderType): CredentialStatus {
    const raw = this.getRawKey(provider);
    const envVarName = this.envKeyMap[provider] || "NONE";

    return {
      isConfigured: !!raw,
      source: raw ? "env" : "none",
      maskedKey: this.getMaskedKey(provider),
      keyName: envVarName,
    };
  }

  /**
   * Checks if all required provider keys or specific provider keys are configured.
   */
  public isProviderReady(provider: AIProviderType): boolean {
    if (provider === "heuristic_fallback") {
      return true;
    }
    return !!this.getRawKey(provider);
  }
}

export const credentialService = CredentialService.getInstance();
