import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import {
  Sparkles,
  Check,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  HelpCircle,
  XCircle,
  SlidersHorizontal,
  Bot,
  Package,
  Layers,
  Tag,
  Zap,
  Info,
  Scale,
  DollarSign,
  Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ProductSuggestion,
  CategoryValidationContext,
  FieldVerificationStatus,
  DetailedProductVerification,
} from "@/types/aiProductIntelligence";
import { requestProductAnalysis, requestProductVerification } from "@/lib/ai/aiServiceClient";
import { BusinessCatalogContext } from "@/server/ai/types";
import { AIConfidenceBadge } from "./AIConfidenceBadge";

export interface AIProductIntelligenceAssistantRef {
  triggerAnalysis: (overrideText?: string) => void;
}

interface Props {
  categoryContext: CategoryValidationContext;
  businessIndustry?: string;
  businessCurrency?: string;
  businessId?: string;
  onApplySuggestion: (suggestion: ProductSuggestion, appliedFields?: Record<string, boolean>) => void;
  currentProductName?: string;
  currentBarcode?: string;
  onDismiss?: () => void;
}

type StepKey = "understanding" | "catalog" | "uom_packaging" | "finalizing";

export const AIProductIntelligenceAssistant = forwardRef<AIProductIntelligenceAssistantRef, Props>(
  (
    {
      categoryContext,
      businessIndustry,
      businessCurrency,
      businessId = "biz_default",
      onApplySuggestion,
      currentProductName = "",
      currentBarcode = "",
      onDismiss,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(true);
    const [inputText, setInputText] = useState(currentProductName || "");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisStep, setAnalysisStep] = useState<StepKey | null>(null);
    const [suggestion, setSuggestion] = useState<ProductSuggestion | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showDetailedReview, setShowDetailedReview] = useState(false);

    // Selective field application toggles in Review mode
    const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({
      product_name: true,
      category: true,
      subcategory: true,
      uom: true,
      packaging: true,
      strength: true,
      pricing: false, // Default pricing to opt-in so user prices are not overwritten
    });

    // Editable preview values inside the Review pane
    const [editableValues, setEditableValues] = useState<{
      product_name: string;
      primary_category_id: string;
      subcategory_id: string;
      stock_unit: string;
      package_type: string;
      pack_size: string;
      strength: string;
      purchase_cost: string;
      retail_price: string;
      description: string;
    }>({
      product_name: "",
      primary_category_id: "",
      subcategory_id: "",
      stock_unit: "",
      package_type: "",
      pack_size: "",
      strength: "",
      purchase_cost: "",
      retail_price: "",
      description: "",
    });

    // Sync input text if currentProductName changes and user hasn't typed a custom prompt
    useEffect(() => {
      if (currentProductName) {
        setInputText((prev) => (!prev ? currentProductName : prev));
      }
    }, [currentProductName]);

    const businessContext: BusinessCatalogContext = {
      businessId,
      businessName: "Current Business",
      industryType: businessIndustry,
      currency: businessCurrency,
      allowedCategories: categoryContext.allowedPrimaryCategories,
      allowedSubcategories: (categoryContext.allowedSubcategories || []).map((s) => ({
        id: s.id,
        parentId: s.parentId || null,
        name: s.name,
        slug: s.slug,
      })),
      allowedStockUnits: categoryContext.allowedUomUnits,
    };

    const handleAnalyze = async (overrideText?: string) => {
      const textToAnalyze = (overrideText || inputText || currentProductName).trim();
      if (!textToAnalyze) return;

      // Prevent duplicate requests while analyzing
      if (isAnalyzing) return;

      setIsAnalyzing(true);
      setErrorMessage(null);
      setShowDetailedReview(false);

      try {
        // Step 1: Understanding specifications
        setAnalysisStep("understanding");
        await new Promise((r) => setTimeout(r, 120));

        // Include barcode in raw input if present to enhance AI context
        const queryWithBarcode =
          currentBarcode && !textToAnalyze.includes(currentBarcode)
            ? `${textToAnalyze} (Barcode: ${currentBarcode})`
            : textToAnalyze;

        // Step 2: Checking business catalog & admin taxonomy
        setAnalysisStep("catalog");
        const result = await requestProductAnalysis(queryWithBarcode, businessContext);

        // Step 3: Identifying unit of measure & packaging
        setAnalysisStep("uom_packaging");
        await new Promise((r) => setTimeout(r, 100));

        // Step 4: Finalizing verified suggestions
        setAnalysisStep("finalizing");
        let finalSuggestion = result;
        if (!finalSuggestion.verification) {
          try {
            const verResult = await requestProductVerification(
              finalSuggestion,
              businessContext,
              undefined,
              queryWithBarcode
            );
            finalSuggestion = {
              ...finalSuggestion,
              verification: verResult,
            };
          } catch (verErr) {
            console.warn("AI verification pass skipped:", verErr);
          }
        }

        setSuggestion(finalSuggestion);

        // Determine packaging type and count
        const packageType =
          (finalSuggestion.attributes?.metadata?.packaging as string) ||
          (finalSuggestion.attributes?.form === "box" ? "Box" : "") ||
          (finalSuggestion.uom?.stock_unit?.toLowerCase() === "tablet" && finalSuggestion.uom?.pack_size ? "Box" : "");

        const packSize = finalSuggestion.uom?.pack_size ? String(finalSuggestion.uom.pack_size) : "";

        // Populate editable review values
        setEditableValues({
          product_name: finalSuggestion.identification?.product_name || textToAnalyze,
          primary_category_id: finalSuggestion.classification?.primary_category_id || "",
          subcategory_id: finalSuggestion.classification?.subcategory_id || "",
          stock_unit: finalSuggestion.uom?.stock_unit || "piece",
          package_type: packageType,
          pack_size: packSize,
          strength: finalSuggestion.attributes?.strength || "",
          purchase_cost:
            finalSuggestion.extracted_business_data?.purchase_cost != null
              ? String(finalSuggestion.extracted_business_data.purchase_cost)
              : "",
          retail_price:
            finalSuggestion.extracted_business_data?.retail_price != null
              ? String(finalSuggestion.extracted_business_data.retail_price)
              : "",
          description: finalSuggestion.identification?.description || "",
        });

        // Ensure user can see the suggestions
        setIsOpen(true);
      } catch (err: any) {
        console.warn("AI suggestion pipeline error:", err);
        setErrorMessage("AI analysis is temporarily unavailable. You can continue adding the product manually.");
      } finally {
        setIsAnalyzing(false);
        setAnalysisStep(null);
      }
    };

    // Expose triggerAnalysis to parent component
    useImperativeHandle(ref, () => ({
      triggerAnalysis: (overrideText?: string) => {
        if (overrideText) {
          setInputText(overrideText);
        }
        handleAnalyze(overrideText);
      },
    }));

    const handleApply = (applyAll = true) => {
      if (!suggestion) return;

      const fieldsToApply = applyAll
        ? {
            product_name: true,
            category: true,
            subcategory: true,
            uom: true,
            packaging: true,
            strength: true,
            pricing: !!(editableValues.purchase_cost || editableValues.retail_price),
          }
        : selectedFields;

      // Construct applied suggestion using editable values
      const updatedSuggestion: ProductSuggestion = {
        ...suggestion,
        identification: {
          ...suggestion.identification,
          product_name: fieldsToApply.product_name
            ? editableValues.product_name || suggestion.identification.product_name
            : suggestion.identification.product_name,
          description: editableValues.description || suggestion.identification.description,
        },
        classification: {
          ...suggestion.classification,
          primary_category_id: fieldsToApply.category
            ? editableValues.primary_category_id || null
            : null,
          primary_category_name:
            categoryContext.allowedPrimaryCategories.find((c) => c.id === editableValues.primary_category_id)?.name ||
            suggestion.classification.primary_category_name,
          subcategory_id: fieldsToApply.subcategory
            ? editableValues.subcategory_id || null
            : null,
          subcategory_name:
            categoryContext.allowedSubcategories?.find((s) => s.id === editableValues.subcategory_id)?.name ||
            suggestion.classification.subcategory_name,
        },
        uom: {
          ...suggestion.uom,
          stock_unit: fieldsToApply.uom
            ? editableValues.stock_unit || suggestion.uom.stock_unit
            : suggestion.uom.stock_unit,
          pack_size: fieldsToApply.packaging && editableValues.pack_size
            ? Number(editableValues.pack_size)
            : null,
        },
        attributes: {
          ...suggestion.attributes,
          strength: fieldsToApply.strength ? editableValues.strength || null : null,
          metadata: {
            ...(suggestion.attributes?.metadata || {}),
            packaging_type: editableValues.package_type || undefined,
            pack_size: editableValues.pack_size || undefined,
          },
        },
        extracted_business_data: {
          ...suggestion.extracted_business_data,
          purchase_cost:
            fieldsToApply.pricing && editableValues.purchase_cost
              ? Number(editableValues.purchase_cost)
              : null,
          retail_price:
            fieldsToApply.pricing && editableValues.retail_price
              ? Number(editableValues.retail_price)
              : null,
          user_supplied: false,
        },
      };

      onApplySuggestion(updatedSuggestion, fieldsToApply);
    };

    const handleSelectCategoryOption = (catId: string) => {
      setEditableValues((prev) => ({
        ...prev,
        primary_category_id: catId,
        subcategory_id: "",
      }));
    };

    const vData = suggestion?.verification;

    // Helper for confidence badge
    const renderConfidenceBadge = () => {
      if (!suggestion) return null;
      return (
        <AIConfidenceBadge
          id="ai-overall-confidence-badge"
          score={suggestion.overall_confidence}
          field="Overall Reliability"
          reason={
            suggestion.needs_review
              ? "One or more fields have low confidence or require manual administrative confirmation"
              : "Calculated across validated catalog, multi-model consensus, and rule verification"
          }
          showScore
          size="sm"
        />
      );
    };

    // Selected admin category name
    const matchedCategoryName =
      categoryContext.allowedPrimaryCategories.find((c) => c.id === editableValues.primary_category_id)?.name ||
      suggestion?.classification?.primary_category_name;

    const isCategoryMatchedInAdmin =
      !!categoryContext.allowedPrimaryCategories.find((c) => c.id === editableValues.primary_category_id);

    const matchedSubcategoryName =
      categoryContext.allowedSubcategories?.find((s) => s.id === editableValues.subcategory_id)?.name ||
      suggestion?.classification?.subcategory_name;

    const isSubcategoryMatchedInAdmin =
      !!categoryContext.allowedSubcategories?.find(
        (s) => s.id === editableValues.subcategory_id && (!s.parentId || s.parentId === editableValues.primary_category_id)
      );

    const isUomAllowedInAdmin =
      !categoryContext.allowedUomUnits ||
      categoryContext.allowedUomUnits.length === 0 ||
      categoryContext.allowedUomUnits.includes(editableValues.stock_unit?.toLowerCase());

    return (
      <div
        id="ai-product-intelligence-card"
        className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/[0.04] via-card to-background p-4 shadow-sm space-y-3.5 transition-all"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-foreground">
                  AI Product Intelligence
                </h4>
                <span className="text-[9px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">
                  Assistant
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Enter a product name to auto-suggest taxonomy, UOM, and packaging specifications for manual review.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              id="toggle-ai-assistant-btn"
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label={isOpen ? "Collapse AI section" : "Expand AI section"}
            >
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {isOpen && (
          <div className="space-y-3 pt-1">
            {/* Input & Analyze Button */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Input
                  id="ai-product-search-input"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isAnalyzing && inputText.trim()) {
                      e.preventDefault();
                      handleAnalyze();
                    }
                  }}
                  placeholder="e.g. Paracetamol 500mg box of 20 tablets or Coca-Cola 1.5L"
                  className="h-9 text-xs pr-8 rounded-xl border-sky-500/25 focus-visible:ring-sky-500/30"
                  disabled={isAnalyzing}
                />
                {inputText && !isAnalyzing && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputText("");
                      setSuggestion(null);
                      setErrorMessage(null);
                    }}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    aria-label="Clear input"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <Button
                id="ai-analyze-btn"
                type="button"
                onClick={() => handleAnalyze()}
                disabled={isAnalyzing || !inputText.trim()}
                className="h-9 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shrink-0 shadow-sm transition-all"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Analyzing...
                  </>
                ) : suggestion ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Re-analyze
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Analyze with AI
                  </>
                )}
              </Button>
            </div>

            {/* Professional Step-by-Step Loading Card */}
            {isAnalyzing && (
              <div
                id="ai-loading-state"
                className="p-3.5 rounded-xl bg-sky-500/5 border border-sky-500/20 space-y-2.5 animate-in fade-in duration-200"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400">
                  <Sparkles className="w-4 h-4 animate-spin text-sky-500" />
                  <span>AI is analyzing product...</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                    <span>Understanding product specifications</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                    <span>Checking admin taxonomy &amp; categories</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                    <span>Identifying unit of measurement &amp; packaging</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                    <span>Preparing structured suggestions</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message Notice */}
            {errorMessage && (
              <div
                id="ai-error-notice"
                className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 flex items-start justify-between gap-2 animate-in fade-in"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <p className="font-bold">Notice</p>
                    <p className="text-[11px] text-muted-foreground">{errorMessage}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAnalyze()}
                  className="h-7 text-[11px] px-2.5 shrink-0"
                >
                  Retry
                </Button>
              </div>
            )}

            {/* AI SUGGESTION SUMMARY CARD */}
            {suggestion && !isAnalyzing && (
              <div
                id="ai-suggestions-card"
                className="rounded-xl border border-sky-500/30 bg-card p-4 space-y-4 shadow-sm animate-in fade-in duration-200"
              >
                {/* Header with Title & Confidence */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-foreground">
                        ✨ AI Suggestions Ready
                      </h5>
                      <p className="text-[10px] text-muted-foreground">
                        Product analyzed successfully. Review suggestions before applying to form.
                      </p>
                    </div>
                  </div>

                  {renderConfidenceBadge()}
                </div>

                {/* Structured Suggestion Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                  {/* Category Field */}
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground gap-1">
                      <span>Category</span>
                      <div className="flex items-center gap-1">
                        {suggestion.field_confidence_details?.["primary_category"] && (
                          <AIConfidenceBadge
                            detail={suggestion.field_confidence_details["primary_category"]}
                            size="sm"
                          />
                        )}
                        {isCategoryMatchedInAdmin ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 text-[10px]">
                            <Check className="w-3 h-3" /> Configured
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5 text-[10px]">
                            <AlertTriangle className="w-3 h-3" /> Needs Review
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="font-semibold text-foreground truncate">
                      {matchedCategoryName || "Needs Review"}
                    </p>
                  </div>

                  {/* Subcategory Field */}
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground gap-1">
                      <span>Subcategory</span>
                      <div className="flex items-center gap-1">
                        {suggestion.field_confidence_details?.["subcategory"] && (
                          <AIConfidenceBadge
                            detail={suggestion.field_confidence_details["subcategory"]}
                            size="sm"
                          />
                        )}
                        {isSubcategoryMatchedInAdmin ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 text-[10px]">
                            <Check className="w-3 h-3" /> Configured
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[9px]">Optional / Review</span>
                        )}
                      </div>
                    </div>
                    <p className="font-semibold text-foreground truncate">
                      {matchedSubcategoryName || "Not assigned"}
                    </p>
                  </div>

                  {/* Unit of Measure (UOM) */}
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground gap-1">
                      <span>Base UOM</span>
                      <div className="flex items-center gap-1">
                        {suggestion.field_confidence_details?.["stock_unit"] && (
                          <AIConfidenceBadge
                            detail={suggestion.field_confidence_details["stock_unit"]}
                            size="sm"
                          />
                        )}
                        {isUomAllowedInAdmin ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 text-[10px]">
                            <Check className="w-3 h-3" /> Validated
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5 text-[10px]">
                            <AlertTriangle className="w-3 h-3" /> Needs Review
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="font-semibold text-foreground capitalize">
                      {editableValues.stock_unit || "Piece"}
                    </p>
                  </div>

                  {/* Packaging & Pack Size */}
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground gap-1">
                      <span>Packaging &amp; Pack Size</span>
                      <div className="flex items-center gap-1">
                        {suggestion.field_confidence_details?.["pack_size"] && (
                          <AIConfidenceBadge
                            detail={suggestion.field_confidence_details["pack_size"]}
                            size="sm"
                          />
                        )}
                        <Package className="w-3 h-3 text-sky-500" />
                      </div>
                    </div>
                    <p className="font-semibold text-foreground">
                      {editableValues.pack_size
                        ? `${editableValues.package_type || "Pack"} = ${editableValues.pack_size} ${editableValues.stock_unit || "Units"}`
                        : editableValues.package_type || "Single Unit"}
                    </p>
                  </div>

                  {/* Strength */}
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground gap-1">
                      <span>Strength / Dosage</span>
                      <div className="flex items-center gap-1">
                        {suggestion.field_confidence_details?.["strength"] && (
                          <AIConfidenceBadge
                            detail={suggestion.field_confidence_details["strength"]}
                            size="sm"
                          />
                        )}
                        <Tag className="w-3 h-3 text-sky-500" />
                      </div>
                    </div>
                    <p className="font-semibold text-foreground">
                      {editableValues.strength || "Not identified"}
                    </p>
                  </div>

                  {/* Product Type / Specifications */}
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground gap-1">
                      <span>Product Nature</span>
                      <div className="flex items-center gap-1">
                        {suggestion.field_confidence_details?.["product_name"] && (
                          <AIConfidenceBadge
                            detail={suggestion.field_confidence_details["product_name"]}
                            size="sm"
                          />
                        )}
                        <Info className="w-3 h-3 text-sky-500" />
                      </div>
                    </div>
                    <p className="font-semibold text-foreground truncate">
                      {suggestion.identification?.product_type || "Standard Merchandise"}
                    </p>
                  </div>
                </div>

                {/* Multiple Category Matches / Alternatives (Section 18) */}
                {categoryContext.allowedPrimaryCategories.length > 1 && !isCategoryMatchedInAdmin && (
                  <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs space-y-1.5">
                    <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      Select matching category from your Admin Catalog:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {categoryContext.allowedPrimaryCategories.slice(0, 6).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCategoryOption(c.id)}
                          className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition ${
                            editableValues.primary_category_id === c.id
                              ? "bg-sky-500 text-white border-sky-600"
                              : "bg-background hover:bg-muted text-foreground border-border"
                          }`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* DETAILED REVIEW & EDIT PANEL (Section 15) */}
                {showDetailedReview && (
                  <div
                    id="ai-detailed-review-pane"
                    className="p-3.5 rounded-xl bg-muted/20 border border-border/80 space-y-3 text-xs animate-in fade-in"
                  >
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-sky-500" />
                        <span>Inspect &amp; Tweak Suggestions Before Applying</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        Checked fields will copy into form
                      </span>
                    </div>

                    {/* Contradiction Warning Notice */}
                    {vData?.contradictions && vData.contradictions.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 space-y-1 text-[11px]">
                        <p className="font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Note from Auditor:
                        </p>
                        {vData.contradictions.map((c, idx) => (
                          <p key={idx}>
                            Field <strong>{c.field}</strong>: "{c.originalInput}" vs suggested "{c.candidateValue}".
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Editable Review Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Name */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedFields.product_name}
                              onChange={(e) =>
                                setSelectedFields((p) => ({ ...p, product_name: e.target.checked }))
                              }
                              className="rounded text-sky-500"
                            />
                            Product Title
                          </label>
                          {suggestion.field_confidence_details?.["product_name"] && (
                            <AIConfidenceBadge
                              detail={suggestion.field_confidence_details["product_name"]}
                              size="sm"
                            />
                          )}
                        </div>
                        <Input
                          value={editableValues.product_name}
                          onChange={(e) =>
                            setEditableValues((p) => ({ ...p, product_name: e.target.value }))
                          }
                          className="h-8 text-xs font-semibold bg-background"
                        />
                      </div>

                      {/* Primary Category */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedFields.category}
                              onChange={(e) =>
                                setSelectedFields((p) => ({ ...p, category: e.target.checked }))
                              }
                              className="rounded text-sky-500"
                            />
                            Admin Category
                          </label>
                          {suggestion.field_confidence_details?.["primary_category"] && (
                            <AIConfidenceBadge
                              detail={suggestion.field_confidence_details["primary_category"]}
                              size="sm"
                            />
                          )}
                        </div>
                        <select
                          value={editableValues.primary_category_id}
                          onChange={(e) =>
                            setEditableValues((p) => ({
                              ...p,
                              primary_category_id: e.target.value,
                              subcategory_id: "",
                            }))
                          }
                          className="h-8 w-full text-xs font-medium bg-background border border-input rounded-md px-2"
                        >
                          <option value="">-- Select Configured Category --</option>
                          {categoryContext.allowedPrimaryCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Subcategory */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedFields.subcategory}
                              onChange={(e) =>
                                setSelectedFields((p) => ({ ...p, subcategory: e.target.checked }))
                              }
                              className="rounded text-sky-500"
                            />
                            Subcategory
                          </label>
                          {suggestion.field_confidence_details?.["subcategory"] && (
                            <AIConfidenceBadge
                              detail={suggestion.field_confidence_details["subcategory"]}
                              size="sm"
                            />
                          )}
                        </div>
                        <select
                          value={editableValues.subcategory_id}
                          onChange={(e) =>
                            setEditableValues((p) => ({ ...p, subcategory_id: e.target.value }))
                          }
                          disabled={!editableValues.primary_category_id}
                          className="h-8 w-full text-xs font-medium bg-background border border-input rounded-md px-2 disabled:opacity-50"
                        >
                          <option value="">-- None / Select Subcategory --</option>
                          {(categoryContext.allowedSubcategories || [])
                            .filter(
                              (s) => !s.parentId || s.parentId === editableValues.primary_category_id
                            )
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Base Unit */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedFields.uom}
                              onChange={(e) => setSelectedFields((p) => ({ ...p, uom: e.target.checked }))}
                              className="rounded text-sky-500"
                            />
                            Base UOM (Stock Unit)
                          </label>
                          {suggestion.field_confidence_details?.["stock_unit"] && (
                            <AIConfidenceBadge
                              detail={suggestion.field_confidence_details["stock_unit"]}
                              size="sm"
                            />
                          )}
                        </div>
                        <Input
                          value={editableValues.stock_unit}
                          onChange={(e) =>
                            setEditableValues((p) => ({ ...p, stock_unit: e.target.value }))
                          }
                          placeholder="e.g. tablet, bottle, piece"
                          className="h-8 text-xs bg-background capitalize"
                        />
                      </div>

                      {/* Packaging & Pack Size */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedFields.packaging}
                              onChange={(e) =>
                                setSelectedFields((p) => ({ ...p, packaging: e.target.checked }))
                              }
                              className="rounded text-sky-500"
                            />
                            Packaging &amp; Units Per Pack
                          </label>
                          {suggestion.field_confidence_details?.["pack_size"] && (
                            <AIConfidenceBadge
                              detail={suggestion.field_confidence_details["pack_size"]}
                              size="sm"
                            />
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={editableValues.package_type}
                            onChange={(e) =>
                              setEditableValues((p) => ({ ...p, package_type: e.target.value }))
                            }
                            placeholder="Package (e.g. Box)"
                            className="h-8 text-xs bg-background"
                          />
                          <Input
                            type="number"
                            value={editableValues.pack_size}
                            onChange={(e) =>
                              setEditableValues((p) => ({ ...p, pack_size: e.target.value }))
                            }
                            placeholder="Units (e.g. 20)"
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                      </div>

                      {/* Strength */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedFields.strength}
                              onChange={(e) =>
                                setSelectedFields((p) => ({ ...p, strength: e.target.checked }))
                              }
                              className="rounded text-sky-500"
                            />
                            Strength Formulation
                          </label>
                          {suggestion.field_confidence_details?.["strength"] && (
                            <AIConfidenceBadge
                              detail={suggestion.field_confidence_details["strength"]}
                              size="sm"
                            />
                          )}
                        </div>
                        <Input
                          value={editableValues.strength}
                          onChange={(e) =>
                            setEditableValues((p) => ({ ...p, strength: e.target.value }))
                          }
                          placeholder="Strength (e.g. 500mg)"
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <Button
                      id="ai-review-btn"
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDetailedReview(!showDetailedReview)}
                      className="h-8 text-xs gap-1 font-semibold"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      {showDetailedReview ? "Hide Details" : "Review"}
                    </Button>

                    <Button
                      id="ai-dismiss-btn"
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSuggestion(null);
                        if (onDismiss) onDismiss();
                      }}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Dismiss
                    </Button>
                  </div>

                  <Button
                    id="ai-apply-suggestions-btn"
                    type="button"
                    onClick={() => handleApply(!showDetailedReview)}
                    className="h-8 px-4 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-sm gap-1.5 transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {showDetailedReview ? "Apply Selected" : "Apply Suggestions"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

AIProductIntelligenceAssistant.displayName = "AIProductIntelligenceAssistant";
