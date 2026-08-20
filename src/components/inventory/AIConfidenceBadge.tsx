import React from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, Sparkles, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfidenceLevel, FieldSource, FieldConfidenceDetail } from "@/types/aiProductIntelligence";
import { getConfidenceDisplay } from "@/lib/ai/confidenceThresholds";

interface AIConfidenceBadgeProps {
  level?: ConfidenceLevel;
  score?: number;
  source?: FieldSource;
  reason?: string;
  detail?: FieldConfidenceDetail;
  showScore?: boolean;
  showIcon?: boolean;
  compact?: boolean;
  className?: string;
}

export const AIConfidenceBadge: React.FC<AIConfidenceBadgeProps> = ({
  level,
  score,
  source,
  reason,
  detail,
  showScore = false,
  showIcon = true,
  compact = false,
  className = "",
}) => {
  const effLevel: ConfidenceLevel = detail?.confidence_level || level || "medium";
  const effScore = detail?.confidence_score ?? score;
  const effSource = detail?.source || source || "ai";
  const effReason = detail?.reason || reason;

  const display = getConfidenceDisplay(effLevel);

  if (effSource === "user") {
    return (
      <Badge
        variant="outline"
        className={`h-5 px-1.5 gap-1 text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 ${className}`}
        title={effReason || "User Provided Value (Authoritative)"}
      >
        {showIcon && <UserCheck className="w-2.5 h-2.5 shrink-0" />}
        <span>User Defined</span>
      </Badge>
    );
  }

  const getStyleAndIcon = () => {
    switch (effLevel) {
      case "high":
        return {
          bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
          icon: <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />,
          label: compact ? "High" : "✓ High Confidence",
        };
      case "medium":
        return {
          bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
          icon: <AlertTriangle className="w-2.5 h-2.5 shrink-0" />,
          label: compact ? "Review" : "⚠ Review Recommended",
        };
      case "low":
      default:
        return {
          bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
          icon: <AlertCircle className="w-2.5 h-2.5 shrink-0" />,
          label: compact ? "Low" : "⚠ Low Confidence",
        };
    }
  };

  const style = getStyleAndIcon();

  const scoreText = showScore && effScore !== undefined ? ` (${Math.round(effScore * 100)}%)` : "";

  return (
    <Badge
      variant="outline"
      className={`h-5 px-1.5 gap-1 text-[10px] font-semibold ${style.bg} ${className}`}
      title={effReason ? `Reliability Signal: ${effReason}` : display.description}
    >
      {showIcon && style.icon}
      <span>{style.label}{scoreText}</span>
    </Badge>
  );
};
