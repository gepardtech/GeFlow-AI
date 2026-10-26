import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  UtensilsCrossed,
  Cake,
  Scale,
  Shirt,
  ShoppingCart,
  Pill,
  Smartphone,
  Wrench,
  Sofa,
  Truck,
  Layers,
  CheckCircle2,
  ChevronRight,
  Loader2,
  ArrowRight,
  Info,
} from "lucide-react";
import type { CategoryTemplate } from "@/server/productVariationsStorage";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  currentIndustry?: string;
  onApplyTemplate?: (template: CategoryTemplate) => void;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  restaurant: UtensilsCrossed,
  bakery: Cake,
  sweets: Scale,
  clothing: Shirt,
  grocery: ShoppingCart,
  pharmacy: Pill,
  electronics: Smartphone,
  hardware: Wrench,
  furniture: Sofa,
  wholesale: Truck,
};

export const BusinessCategorySetupWizard: React.FC<Props> = ({
  open,
  onOpenChange,
  businessId,
  currentIndustry,
  onApplyTemplate,
}) => {
  const { toast } = useToast();
  const [selectedIndustry, setSelectedIndustry] = useState<string>(currentIndustry || "restaurant");
  const [templates, setTemplates] = useState<Record<string, CategoryTemplate>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [aiGenerating, setAiGenerating] = useState<boolean>(false);
  const [activeTemplate, setActiveTemplate] = useState<CategoryTemplate | null>(null);

  // Fetch available category templates
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/sync/category-templates")
      .then((res) => res.json())
      .then((data) => {
        if (data.templates) {
          setTemplates(data.templates);
          const initialKey = currentIndustry && data.templates[currentIndustry] ? currentIndustry : Object.keys(data.templates)[0];
          setSelectedIndustry(initialKey);
          setActiveTemplate(data.templates[initialKey] || null);
        }
      })
      .catch((err) => {
        console.error("Failed to load category templates", err);
      })
      .finally(() => setLoading(false));
  }, [open, currentIndustry]);

  const handleSelectIndustry = (key: string) => {
    setSelectedIndustry(key);
    setActiveTemplate(templates[key] || null);
  };

  const handleAskAIRecommendation = async () => {
    setAiGenerating(true);
    try {
      const res = await fetch("/api/ai/category-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: selectedIndustry,
          business_name: "My Store",
          business_id: businessId,
        }),
      });
      const data = await res.json();
      if (data.recommendations) {
        setActiveTemplate((prev) => ({
          ...(prev || {
            industry_type: selectedIndustry,
            display_name: selectedIndustry,
            sample_attributes: [],
            sample_variants_preview: [],
            suggested_uom: "piece",
            pos_features: [],
            description: "",
          }),
          recommended_product_type: data.recommendations.recommended_product_type || "variable",
          sample_attributes: data.recommendations.suggested_attributes || prev?.sample_attributes || [],
          suggested_uom: data.recommendations.suggested_uom || prev?.suggested_uom || "piece",
          description: data.recommendations.explanation || prev?.description || "",
        }));
        toast({
          title: "AI Product Architecture Generated",
          description: `Generated custom variation & attribute rules for ${selectedIndustry}.`,
        });
      }
    } catch (err) {
      toast({
        title: "AI Generation Error",
        description: "Failed to generate AI recommendation, using verified template defaults.",
        variant: "destructive",
      });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleApply = () => {
    if (!activeTemplate) return;
    if (onApplyTemplate) {
      onApplyTemplate(activeTemplate);
    }
    toast({
      title: "Business Category Template Applied",
      description: `Configured ${activeTemplate.display_name} product architecture, attributes, and POS controls.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] p-0 overflow-hidden rounded-2xl bg-card border-border shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-foreground">
                Business-Aware Product &amp; Variation Setup
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Automatically configure variants, UOM, and POS controls tailored to your business industry.
              </DialogDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAskAIRecommendation}
            disabled={aiGenerating}
            className="text-xs font-bold gap-1.5 border-sky-500/40 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10"
          >
            {aiGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Run AI Architecture Analysis
          </Button>
        </div>

        {/* Body Split */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Industry Sidebar */}
          <div className="md:col-span-4 p-4 overflow-y-auto max-h-[40vh] md:max-h-full space-y-1.5 bg-muted/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 block mb-2">
              Select Business Industry
            </span>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              Object.entries(templates).map(([key, t]) => {
                const IconComponent = CATEGORY_ICONS[key] || Layers;
                const isSelected = selectedIndustry === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectIndustry(key)}
                    className={`w-full text-left p-3 rounded-xl transition flex items-center justify-between group border ${
                      isSelected
                        ? "bg-sky-500/10 border-sky-500 text-sky-600 dark:text-sky-400 font-bold"
                        : "bg-card hover:bg-muted border-border/60 text-foreground font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-sky-500 text-white"
                            : "bg-muted text-muted-foreground group-hover:text-foreground"
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs truncate block">{t.display_name}</span>
                        <span className="text-[10px] text-muted-foreground truncate block capitalize">
                          {t.recommended_product_type} format
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                  </button>
                );
              })
            )}
          </div>

          {/* Template Details & AI Preview */}
          <div className="md:col-span-8 p-6 overflow-y-auto space-y-5">
            {activeTemplate ? (
              <>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-foreground">
                      {activeTemplate.display_name}
                    </h3>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30">
                      {activeTemplate.recommended_product_type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activeTemplate.description}
                  </p>
                </div>

                {/* Attributes & Options Preview */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                    Recommended Product Attributes:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeTemplate.sample_attributes.map((attr, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-card border border-border space-y-1.5 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground">
                            {attr.name}
                          </span>
                          <span className="text-[10px] font-semibold text-sky-500 bg-sky-500/10 px-1.5 py-0.5 rounded">
                            {attr.inputType || "pills"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {attr.values.map((v) => (
                            <span
                              key={v}
                              className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border"
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sample Combinations Preview */}
                {activeTemplate.sample_variants_preview && activeTemplate.sample_variants_preview.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                      Sample Generated Combinations (SKUs):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeTemplate.sample_variants_preview.map((v, i) => (
                        <div
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-xs font-medium text-foreground flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Connected POS & Inventory Features */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                    Integrated POS &amp; Inventory Capabilities:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {activeTemplate.pos_features.map((feat, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-muted/40 border border-border text-center"
                      >
                        <span className="text-xs font-semibold text-foreground block">
                          {feat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* UOM Guidance */}
                <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-start gap-2.5 text-xs text-sky-700 dark:text-sky-300">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-500" />
                  <div>
                    <span className="font-bold block">Standard Unit of Measure:</span>
                    <span>
                      Recommended primary unit is <strong className="capitalize underline">{activeTemplate.suggested_uom}</strong>. This ensures harmonious stock audits and sales receipts across POS, purchases, and reporting.
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-muted-foreground text-xs">
                Select an industry on the left to inspect its product configuration template.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border bg-muted/30 flex items-center justify-between shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            className="text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white gap-2 shadow-md shadow-sky-500/20 px-5"
          >
            <span>Apply Product Template</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
