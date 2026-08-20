import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Zap,
  TrendingUp,
  ArrowRight,
  PackageCheck,
  AlertCircle,
  Clock,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ActionRecommendationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  predictionData?: {
    categoryName: string;
    projectedGrowth: number;
    recommendedStock: number;
    estimatedRevenueLift: number;
    suggestedSuppliers: string[];
  };
}

export const ActionRecommendationModal = ({
  open,
  onOpenChange,
  predictionData = {
    categoryName: "Cold & Flu (Medicine)",
    projectedGrowth: 24,
    recommendedStock: 350,
    estimatedRevenueLift: 4250,
    suggestedSuppliers: ["Apex Pharma Logistics", "Global Med Distributors"],
  },
}: ActionRecommendationModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-500 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest text-sky-500 uppercase">
                  AI PREDICTION ENGINE
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-600">
                  94% Confidence
                </span>
              </div>
              <DialogTitle className="text-lg font-bold">
                Recommended Action: {predictionData.categoryName}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Predictive demand forecasting analyzed historical POS sales velocity, seasonal infection
            waves, and current inventory levels.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Key Insights Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Projected Growth
              </div>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                +{predictionData.projectedGrowth}%
              </p>
              <p className="text-[10px] text-muted-foreground">Expected spike over next 7–14 days</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                <PackageCheck className="w-3.5 h-3.5 text-sky-500" /> Target Buffer
              </div>
              <p className="text-xl font-bold text-sky-600 dark:text-sky-400">
                +{predictionData.recommendedStock} Units
              </p>
              <p className="text-[10px] text-muted-foreground">To prevent stockouts during peak</p>
            </div>
          </div>

          {/* Action Strategy Box */}
          <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 space-y-2.5">
            <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-500" /> Automated Procurement Plan
            </h4>
            <ul className="space-y-1.5 text-xs text-foreground/90 pl-1">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                <span>
                  Issue a purchase order for <strong>{predictionData.recommendedStock} units</strong> of top-selling analgesics and antihistamines.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                <span>
                  Set POS quick-access buttons for high-velocity flu medications to speed up counter sales.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                <span>
                  Maintain minimum safety threshold alert at <strong>50 units</strong> per store branch.
                </span>
              </li>
            </ul>
          </div>

          {/* Verified Suppliers */}
          <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Fastest Fulfillment Suppliers
              </span>
              <span className="text-[10px] text-emerald-500 font-semibold">Ready to order</span>
            </div>
            <div className="space-y-1.5">
              {predictionData.suggestedSuppliers.map((sup, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/80"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-semibold text-foreground">{sup}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Lead time: 24-48 hrs</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl text-xs">
            Dismiss
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                navigate("/dashboard/inventory");
              }}
              className="rounded-xl text-xs font-semibold"
            >
              Check Inventory
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                navigate("/dashboard/purchases");
              }}
              className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-4"
            >
              Create Purchase Order <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
