/**
 * GEFLOW AI — ERROR HANDLING & ERROR NORMALIZATION (PHASE 3)
 */

import { AIErrorCode } from "./types";

export class AIServiceError extends Error {
  public readonly code: AIErrorCode;
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly requestId?: string;
  public readonly details?: any;

  constructor(
    code: AIErrorCode,
    message: string,
    options?: {
      statusCode?: number;
      retryable?: boolean;
      requestId?: string;
      details?: any;
    }
  ) {
    super(message);
    this.name = "AIServiceError";
    this.code = code;
    this.statusCode = options?.statusCode ?? 500;
    this.retryable = options?.retryable ?? false;
    this.requestId = options?.requestId;
    this.details = options?.details;
    Object.setPrototypeOf(this, AIServiceError.prototype);
  }

  public toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        requestId: this.requestId,
        retryable: this.retryable,
      },
    };
  }
}

export function sanitizeError(err: any, requestId?: string): AIServiceError {
  if (err instanceof AIServiceError) {
    return err;
  }

  const message = err?.message || String(err);

  if (message.includes("timeout") || message.includes("ETIMEDOUT") || message.includes("AbortError")) {
    return new AIServiceError("AI_REQUEST_TIMEOUT", "AI provider request timed out.", {
      statusCode: 504,
      retryable: true,
      requestId,
    });
  }

  if (message.includes("rate limit") || message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) {
    return new AIServiceError("AI_RATE_LIMITED", "AI provider rate limit exceeded. Please try again shortly.", {
      statusCode: 429,
      retryable: true,
      requestId,
    });
  }

  if (message.includes("API_KEY") || message.includes("unauthorized") || message.includes("401") || message.includes("403")) {
    return new AIServiceError("AI_PROVIDER_UNAVAILABLE", "AI provider authentication is misconfigured or unavailable.", {
      statusCode: 503,
      retryable: false,
      requestId,
    });
  }

  return new AIServiceError("AI_INTERNAL_ERROR", "An unexpected error occurred in the AI product intelligence service.", {
    statusCode: 500,
    retryable: false,
    requestId,
  });
}
