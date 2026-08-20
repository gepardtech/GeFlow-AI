import React from "react";
import { CheckCircle2, Sparkles, AlertTriangle, AlertCircle, Minus, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfidenceLevel, FieldSource, FieldConfidenceDetail } from "@/types/aiProductIntelligence";

export type AIFieldStatus =
  | "verified"
  | "suggested"
  | "uncertain"
  | "review_required"
  | "conflicting"
  | "invalid"
  | "not_identified"
  | "high_confidence"
  | "medium_confidence"
  | "low_confidence"
  | "user"
  | "none";

interface AIFieldStatusBadgeProps {
  status?: AIFieldStatus;
  confidenceLevel?: ConfidenceLevel;
  confidenceScore?: number;
  source?: FieldSource;
  detail?: FieldConfidenceDetail;
  suggestedValue?: string | number | null;
  onApplySuggestion?: (value: any) => void;
  reason?: string;
  className?: string;
}

export const AIFieldStatusBadge: React.FC<AIFieldStatusBadgeProps> = ({
  status = "none",
  confidenceLevel,
  confidenceScore,
  source,
  detail,
  suggestedValue,
  onApplySuggestion,
  reason,
  className = "",
}) => {
  const effSource = detail?.source || source;
  const effLevel = detail?.confidence_level || confidenceLevel;
  const effReason = detail?.reason || reason;

  if (effSource === "user" || status === "user") {
    return (
      <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
        <Badge
          variant="outline"
          className="h-5 px-1.5 gap-1 text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
          title={effReason || "User Provided (Authoritative)"}
        >
          <UserCheck className="w-2.5 h-2.5" />
          User Defined
        </Badge>
      </div>
    );
  }

  // Check if confidenceLevel is explicitly provided or mapped via status
  let effectiveStatus = status;
  if (effLevel === "high" && (status === "none" || status === "suggested" || status === "verified")) {
    effectiveStatus = "high_confidence";
  } else if (effLevel === "medium" && (status === "none" || status === "suggested" || status === "uncertain")) {
    effectiveStatus = "medium_confidence";
  } else if (effLevel === "low" && (status === "none" || status === "suggested" || status === "uncertain" || status === "invalid")) {
    effectiveStatus = "low_confidence";
  }

  if (!effectiveStatus || effectiveStatus === "none") return null;

  const renderBadge = () => {
    switch (effectiveStatus) {
      case "high_confidence":
      case "verified":
        return (
          <Badge
            variant="outline"
            className="h-5 px-1.5 gap-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            title={effReason || "High Reliability — Verified against business catalog/evidence"}
          >
            <CheckCircle2 className="w-2.5 h-2.5" />
            ✓ High Confidence
          </Badge>
        );
      case "medium_confidence":
      case "review_required":
      case "uncertain":
        return (
          <Badge
            variant="outline"
            className="h-5 px-1.5 gap-1 text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
            title={effReason || "Review Recommended — Inferred or requires confirmation"}
          >
            <AlertTriangle className="w-2.5 h-2.5" />
            ⚠ Review Recommended
          </Badge>
        );
      case "low_confidence":
      case "conflicting":
      case "invalid":
        return (
          <Badge
            variant="outline"
            className="h-5 px-1.5 gap-1 text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
            title={effReason || "Low Reliability — Unverified or conflicts with inputs"}
          >
            <AlertCircle className="w-2.5 h-2.5" />
            ⚠ Low Confidence
          </Badge>
        );
      case "suggested":
        return (
          <Badge
            variant="outline"
            className="h-5 px-1.5 gap-1 text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
            title={effReason || "AI Suggested Attribute"}
          >
            <Sparkles className="w-2.5 h-2.5" />
            AI Suggested
          </Badge>
        );
      case "not_identified":
        return (
          <Badge
            variant="outline"
            className="h-5 px-1.5 gap-1 text-[10px] font-semibold bg-muted text-muted-foreground border-border"
          >
            <Minus className="w-2.5 h-2.5" />
            Not Identified
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {renderBadge()}
      {suggestedValue !== undefined && suggestedValue !== null && onApplySuggestion && (
        <button
          type="button"
          onClick={() => onApplySuggestion(suggestedValue)}
          className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline font-medium flex items-center gap-0.5"
          title={effReason ? `Suggestion: ${effReason}` : `Use suggestion: ${suggestedValue}`}
        >
          Use: <span className="font-semibold">{String(suggestedValue)}</span>
        </button>
      )}
    </div>
  );
};
