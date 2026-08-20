/**
 * GEFLOW AI — CONFIDENCE SYSTEM THRESHOLDS & BOUNDARIES (PHASE 10)
 *
 * Centralized, configurable thresholds for AI confidence evaluation.
 * Never hardcoded in UI components or business logic.
 */

import { ConfidenceLevel } from "@/types/aiProductIntelligence";

export const CONFIDENCE_THRESHOLDS = {
  /**
   * Minimum score for High Confidence (Safe to apply, verified against business rules)
   */
  HIGH_THRESHOLD: 0.85,

  /**
   * Minimum score for Medium Confidence (Review recommended)
   */
  MEDIUM_THRESHOLD: 0.60,

  /**
   * Fields below this score automatically flag needs_review = true
   */
  AUTO_REVIEW_THRESHOLD: 0.85,
} as const;

/**
 * Maps numerical confidence score (0.00 to 1.00) to standardized confidence level
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  const normalized = Math.max(0, Math.min(1, typeof score === "number" && !isNaN(score) ? score : 0));
  if (normalized >= CONFIDENCE_THRESHOLDS.HIGH_THRESHOLD) {
    return "high";
  }
  if (normalized >= CONFIDENCE_THRESHOLDS.MEDIUM_THRESHOLD) {
    return "medium";
  }
  return "low";
}

/**
 * Returns human-friendly, professional badge labels
 */
export function getConfidenceDisplay(level: ConfidenceLevel): {
  label: string;
  shortLabel: string;
  description: string;
  variant: "high" | "medium" | "low";
} {
  switch (level) {
    case "high":
      return {
        label: "High Confidence",
        shortLabel: "High",
        description: "Verified against business catalog or explicit input evidence.",
        variant: "high",
      };
    case "medium":
      return {
        label: "Review Recommended",
        shortLabel: "Review",
        description: "Inferred from context or requires human confirmation.",
        variant: "medium",
      };
    case "low":
    default:
      return {
        label: "Low Confidence",
        shortLabel: "Low",
        description: "Unverified, incomplete, or requires manual entry.",
        variant: "low",
      };
  }
}
