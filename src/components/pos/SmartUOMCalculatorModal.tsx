import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Zap,
  Scale,
  Pill,
  Droplets,
  Package,
  Layers,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Boxes,
  HelpCircle,
} from "lucide-react";
import {
  parseProductUOM,
  getSmartSubUnitOptions,
  calculateFractionalPrice,
  ALL_STANDARD_UOMS,
  SubUnitPreset,
  FractionalCalculationResult,
} from "@/lib/uomRegistry";
import { useMoney } from "@/lib/currency";

export interface SmartUOMProductInfo {
  id: string;
  name: string;
  description?: string | null;
  internal_sku?: string | null;
  barcode?: string | null;
  retail_price: number;
  discount_price?: number | null;
  purchase_cost: number;
  stock_units: number;
}

export interface AppliedFractionalSelection {
  productId: string;
  selectedPresetId: string;
  fractionOfPack: number;
  unitPrice: number;
  purchaseCost: number;
  profit: number;
  marginPct: number;
  stockUnitsDeducted: number;
  displayUnitLabel: string;
  fullDisplayName: string;
  subQuantity: number;
  subUnitName: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: SmartUOMProductInfo | null;
  initialFraction?: number;
  onApply: (selection: AppliedFractionalSelection) => void;
}

export const SmartUOMCalculatorModal: React.FC<Props> = ({
  open,
  onOpenChange,
  product,
  initialFraction = 1,
  onApply,
}) => {
  const { symbol, format: fmt } = useMoney();

  const [mode, setMode] = useState<"preset" | "manual">("preset");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("full");

  // Manual inputs
  const [manualPackSize, setManualPackSize] = useState<string>("1");
  const [manualSubQty, setManualSubQty] = useState<string>("1");
  const [manualUnitName, setManualUnitName] = useState<string>("Piece");
  const [customPriceOverride, setCustomPriceOverride] = useState<string>("");

  const baseRetail = product ? Number(product.discount_price ?? product.retail_price) || 0 : 0;
  const baseCost = product ? Number(product.purchase_cost) || 0 : 0;

  const { parsed, presets } = useMemo(() => {
    if (!product) {
      return {
        parsed: parseProductUOM("", ""),
        presets: [] as SubUnitPreset[],
      };
    }
    return getSmartSubUnitOptions(
      product.name,
      product.description || "",
      baseRetail,
      baseCost
    );
  }, [product, baseRetail, baseCost]);

  useEffect(() => {
    if (product && open) {
      setSelectedPresetId(initialFraction === 1 ? "full" : presets[1]?.id || "full");
      setManualPackSize(String(parsed.packSize > 0 ? parsed.packSize : 1));
      setManualSubQty("1");
      setManualUnitName(parsed.subUnitName || parsed.uomLabel);
      setCustomPriceOverride("");
      setMode("preset");
    }
  }, [product, open, initialFraction, parsed, presets]);

  // Computed results
  const calculation: FractionalCalculationResult = useMemo(() => {
    if (!product) {
      return calculateFractionalPrice(0, 0, 1);
    }

    if (mode === "preset") {
      const preset = presets.find((p) => p.id === selectedPresetId) || presets[0];
      if (!preset) return calculateFractionalPrice(baseRetail, baseCost, 1);

      const customLabel = preset.id === "full"
        ? `Full ${parsed.uomLabel}`
        : `${preset.label}`;

      let res = calculateFractionalPrice(baseRetail, baseCost, preset.fractionOfPack, customLabel);
      if (customPriceOverride && !isNaN(Number(customPriceOverride))) {
        const customPrice = parseFloat(customPriceOverride);
        const profit = +(customPrice - res.purchaseCost).toFixed(2);
        const marginPct = customPrice > 0 ? +((profit / customPrice) * 100).toFixed(1) : 0;
        res = { ...res, unitPrice: customPrice, profit, marginPct };
      }
      return res;
    } else {
      // Manual mode
      const totalPack = parseFloat(manualPackSize) || 1;
      const subQty = parseFloat(manualSubQty) || 1;
      const fraction = totalPack > 0 ? subQty / totalPack : 1;

      const customLabel = `${subQty} ${manualUnitName} (from ${totalPack} ${parsed.uomLabel})`;
      let res = calculateFractionalPrice(baseRetail, baseCost, fraction, customLabel);

      if (customPriceOverride && !isNaN(Number(customPriceOverride))) {
        const customPrice = parseFloat(customPriceOverride);
        const profit = +(customPrice - res.purchaseCost).toFixed(2);
        const marginPct = customPrice > 0 ? +((profit / customPrice) * 100).toFixed(1) : 0;
        res = { ...res, unitPrice: customPrice, profit, marginPct };
      }
      return res;
    }
  }, [
    product,
    mode,
    selectedPresetId,
    presets,
    manualPackSize,
    manualSubQty,
    manualUnitName,
    customPriceOverride,
    baseRetail,
    baseCost,
    parsed,
  ]);

  if (!product) return null;

  const handleApply = () => {
    let subQuantity = 1;
    let subUnitName = parsed.uomLabel;
    let displayUnitLabel = calculation.displayName;

    if (mode === "preset") {
      const preset = presets.find((p) => p.id === selectedPresetId) || presets[0];
      subQuantity = preset ? preset.unitCount : 1;
      subUnitName = preset ? preset.unitName : parsed.uomLabel;
      displayUnitLabel = preset ? preset.label : `1 ${parsed.uomLabel}`;
    } else {
      subQuantity = parseFloat(manualSubQty) || 1;
      subUnitName = manualUnitName;
      displayUnitLabel = `${subQuantity} ${manualUnitName}`;
    }

    onApply({
      productId: product.id,
      selectedPresetId,
      fractionOfPack: calculation.fractionOfPack,
      unitPrice: calculation.unitPrice,
      purchaseCost: calculation.purchaseCost,
      profit: calculation.profit,
      marginPct: calculation.marginPct,
      stockUnitsDeducted: calculation.stockUnitsDeducted,
      displayUnitLabel,
      fullDisplayName: `${product.name} [${displayUnitLabel}]`,
      subQuantity,
      subUnitName,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl sm:rounded-3xl flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-border bg-muted/30 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
              {parsed.isLiquidVolume ? (
                <Droplets className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : parsed.isPharmaPack ? (
                <Pill className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <Scale className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground leading-tight">
                  Smart UOM &amp; Dose Calculator
                </DialogTitle>
                <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 uppercase">
                  AI Pricing
                </span>
              </div>
              <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Sell sub-units (tablets, sips, fractional kg/g) with automatic profit margin preservation.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Product Overview Card */}
        <div className="px-4 sm:px-6 pt-3 sm:pt-4 pb-1 sm:pb-2">
          <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-xs sm:text-sm text-foreground truncate">{product.name}</p>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>Listed: <strong className="text-foreground">{parsed.packSize} {parsed.subUnitName} ({parsed.uomLabel})</strong></span>
                <span>•</span>
                <span>Stock: <strong className="text-emerald-500">{product.stock_units} Units</strong></span>
              </div>
            </div>
            <div className="flex items-center justify-between sm:flex-col sm:items-end sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-border/50">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Listed Pack Price</span>
              <div className="flex items-baseline sm:flex-col gap-2 sm:gap-0">
                <span className="text-sm sm:text-base font-extrabold text-foreground">{fmt(baseRetail)}</span>
                <span className="text-[10px] text-muted-foreground">Cost: {fmt(baseCost)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="px-4 sm:px-6 pt-1 sm:pt-2">
          <div className="grid grid-cols-2 p-1 bg-muted/60 rounded-xl text-xs font-bold border border-border">
            <button
              type="button"
              onClick={() => setMode("preset")}
              className={`py-2 px-1 sm:px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 text-[11px] sm:text-xs truncate ${
                mode === "preset"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              <span className="truncate">Smart Presets ({presets.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`py-2 px-1 sm:px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 text-[11px] sm:text-xs truncate ${
                mode === "manual"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="truncate">Custom Ratio / Dose</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 overflow-y-auto space-y-3 sm:space-y-4 flex-1">
          {mode === "preset" ? (
            <div className="space-y-2">
              <Label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Select Selling Sub-Unit or Dose Option:
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                {presets.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  const price = +(baseRetail * preset.fractionOfPack).toFixed(2);
                  const cost = +(baseCost * preset.fractionOfPack).toFixed(2);
                  const margin = price > 0 ? +(((price - cost) / price) * 100).toFixed(0) : 0;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                        isSelected
                          ? "border-sky-500 bg-sky-500/10 shadow-xs"
                          : "border-border bg-card hover:bg-muted/40 hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-foreground leading-tight">
                              {preset.label}
                            </span>
                            {preset.isPopular && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                                Common
                              </span>
                            )}
                          </div>
                          {preset.subLabel && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                              {preset.subLabel}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs sm:text-sm font-extrabold text-sky-500 block">
                            {fmt(price)}
                          </span>
                          <span className="text-[9px] text-muted-foreground block">
                            Profit: {fmt(price - cost)} ({margin}%)
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Stock Deduct: <strong className="text-foreground">{preset.fractionOfPack.toFixed(3)}</strong></span>
                        <span className="font-semibold text-sky-600 dark:text-sky-400">
                          {(preset.fractionOfPack * 100).toFixed(1)}% of Pack
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-muted/30 border border-border space-y-3">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  Custom Ratio &amp; Fractional Calculation Setup
                </Label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground block mb-1">
                      Full Pack Size (e.g. 10, 20, 100)
                    </Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="any"
                      value={manualPackSize}
                      onChange={(e) => setManualPackSize(e.target.value)}
                      className="h-9 rounded-xl text-xs bg-background"
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground block mb-1">
                      Buyer Purchase Qty (e.g. 0.5, 3, 15)
                    </Label>
                    <Input
                      type="number"
                      min="0.001"
                      step="any"
                      value={manualSubQty}
                      onChange={(e) => setManualSubQty(e.target.value)}
                      className="h-9 rounded-xl text-xs bg-background font-bold text-sky-500"
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground block mb-1">
                      Sub-Unit Name (e.g. tab, kg, ml)
                    </Label>
                    <Input
                      value={manualUnitName}
                      onChange={(e) => setManualUnitName(e.target.value)}
                      placeholder="e.g. kg, g, ml, tab, sip"
                      className="h-9 rounded-xl text-xs bg-background"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Optional Price Override & Profit Calculator */}
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-sky-500/5 to-indigo-500/5 border border-sky-500/20 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  Algorithmic Selling Price &amp; Profit Preview
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Proportionally maintains profit margin from wholesale pack cost.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1 sm:pt-0">
                <Label className="text-[10px] font-bold text-muted-foreground shrink-0">
                  Override Price ({symbol}):
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={calculation.unitPrice.toFixed(2)}
                  value={customPriceOverride}
                  onChange={(e) => setCustomPriceOverride(e.target.value)}
                  className="w-24 sm:w-28 h-8 text-right font-bold text-xs bg-background rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
              <div className="p-2 rounded-xl bg-card border border-border">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Computed Retail</p>
                <p className="text-xs sm:text-sm font-extrabold text-sky-500 mt-0.5">{fmt(calculation.unitPrice)}</p>
              </div>
              <div className="p-2 rounded-xl bg-card border border-border">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Proportional Cost</p>
                <p className="text-xs sm:text-sm font-extrabold text-muted-foreground mt-0.5">{fmt(calculation.purchaseCost)}</p>
              </div>
              <div className="p-2 rounded-xl bg-card border border-border">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Net Profit</p>
                <p className="text-xs sm:text-sm font-extrabold text-emerald-500 mt-0.5">{fmt(calculation.profit)}</p>
              </div>
              <div className="p-2 rounded-xl bg-card border border-border">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Margin</p>
                <p className="text-xs sm:text-sm font-extrabold text-indigo-500 mt-0.5">{calculation.marginPct}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-5 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1.5 justify-center sm:justify-start">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">
              Deducts <strong className="text-foreground">{calculation.stockUnitsDeducted.toFixed(3)}</strong> units from inventory.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10 sm:h-11 px-4 rounded-xl text-xs font-semibold w-1/3 sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              className="h-10 sm:h-11 px-5 rounded-xl text-xs sm:text-sm font-bold bg-sky-500 hover:bg-sky-600 text-white shadow-md flex-1 sm:flex-initial"
            >
              <Zap className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              Apply {fmt(calculation.unitPrice)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
