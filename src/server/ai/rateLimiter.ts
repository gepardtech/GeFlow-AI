/**
 * GEFLOW AI — RATE LIMITER (PHASE 3)
 *
 * Sliding-window rate limiter per user and per business to prevent API abuse.
 */

import { AIServiceError } from "./errors";

interface RateLimitBucket {
  timestamps: number[];
}

const userBuckets = new Map<string, RateLimitBucket>();
const businessBuckets = new Map<string, RateLimitBucket>();

// Default configuration: 30 requests per minute per user, 60 per minute per business
const USER_LIMIT_PER_WINDOW = 30;
const BUSINESS_LIMIT_PER_WINDOW = 60;
const WINDOW_MS = 60 * 1000; // 1 minute

function checkBucket(bucketMap: Map<string, RateLimitBucket>, key: string, limit: number): boolean {
  const now = Date.now();
  let bucket = bucketMap.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    bucketMap.set(key, bucket);
  }

  // Remove timestamps outside window
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < WINDOW_MS);

  if (bucket.timestamps.length >= limit) {
    return false;
  }

  bucket.timestamps.push(now);
  return true;
}

export function enforceRateLimit(userId: string, businessId: string, requestId?: string): void {
  if (!checkBucket(userBuckets, userId, USER_LIMIT_PER_WINDOW)) {
    throw new AIServiceError("AI_RATE_LIMITED", "User AI request limit exceeded. Please wait a minute before making more requests.", {
      statusCode: 429,
      retryable: true,
      requestId,
    });
  }

  if (!checkBucket(businessBuckets, businessId, BUSINESS_LIMIT_PER_WINDOW)) {
    throw new AIServiceError("AI_RATE_LIMITED", "Business AI request quota temporarily reached. Please try again shortly.", {
      statusCode: 429,
      retryable: true,
      requestId,
    });
  }
}

export function resetRateLimits(): void {
  userBuckets.clear();
  businessBuckets.clear();
}
