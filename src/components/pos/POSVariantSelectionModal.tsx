import React, { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMoney } from "@/lib/currency";
import {
  Layers,
  Sparkles,
  Check,
  Scale,
  Plus,
  Minus,
  AlertCircle,
  PackageCheck,
  Tag,
  DollarSign,
  UtensilsCrossed,
} from "lucide-react";
import type {
  ProductVariationsConfig,
  ProductVariantItem,
  ProductModifierOption,
} from "@/server/productVariationsStorage";
import type { POSProduct } from "@/pages/user/UserPOS";

export interface VariantSelectionResult {
  product: POSProduct;
  variant?: ProductVariantItem;
  selectedAttributes: Record<string, string>;
  selectedModifiers: ProductModifierOption[];
  measuredQuantity?: number; // e.g. 500 for 500g
  measuredUnit?: string; // e.g. "g"
  effectivePrice: number;
  displayName: string;
  sku: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: POSProduct | null;
  config: ProductVariationsConfig | null;
  onConfirm: (result: VariantSelectionResult) => void;
}

export const POSVariantSelectionModal: React.FC<Props> = ({
  open,
  onOpenChange,
  product,
  config,
  onConfirm,
}) => {
  const { symbol, format: fmt } = useMoney();

  // Selected attribute map: { [attributeName]: selectedValue }
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});

  // Selected modifiers list
  const [selectedModifiers, setSelectedModifiers] = useState<ProductModifierOption[]>([]);

  // Weight / measured quantity
  const [measuredQty, setMeasuredQty] = useState<string>("500");

  // Quantity multiplier
  const [quantity, setQuantity] = useState<number>(1);

  // Initialize defaults whenever modal opens or product changes
  useEffect(() => {
    if (!open || !config) return;

    // Pick first value for each attribute
    const initialAttrs: Record<string, string> = {};
    if (config.attributes && config.attributes.length > 0) {
      config.attributes.forEach((attr) => {
        if (attr.values && attr.values.length > 0) {
          initialAttrs[attr.name] = attr.values[0];
        }
      });
    }
    setSelectedAttributes(initialAttrs);

    // Default modifiers
    const initialMods: ProductModifierOption[] = [];
    if (config.modifiers) {
      config.modifiers.forEach((group) => {
        group.options?.forEach((opt) => {
          if (opt.is_default) {
            initialMods.push(opt);
          }
        });
      });
    }
    setSelectedModifiers(initialMods);

    // Default weight
    if (config.quick_presets && config.quick_presets.length > 0) {
      setMeasuredQty(String(config.quick_presets[0]));
    } else {
      setMeasuredQty("500");
    }

    setQuantity(1);
  }, [open, config]);

  // Match the active variant based on selected attributes
  const matchedVariant = useMemo(() => {
    if (!config || !config.variants || config.variants.length === 0) return null;

    return config.variants.find((v) => {
      // Check if all selected attributes match
      for (const [key, val] of Object.entries(selectedAttributes)) {
        if (v.attributes[key] && v.attributes[key] !== val) {
          return false;
        }
      }
      return true;
    }) || config.variants[0];
  }, [config, selectedAttributes]);

  // Calculate pricing
  const isMeasured = config?.product_type === "measured";
  const baseUnitPrice = matchedVariant
    ? matchedVariant.retail_price
    : (product ? Number(product.discount_price || product.retail_price) : 0);

  // Modifiers total addition
  const modifiersPriceAdd = useMemo(() => {
    return selectedModifiers.reduce((sum, mod) => sum + (Number(mod.price) || 0), 0);
  }, [selectedModifiers]);

  const unitPrice = useMemo(() => {
    if (isMeasured) {
      // e.g. price_per_base_unit or product.retail_price is for 1 kg (1000g)
      const numQty = parseFloat(measuredQty) || 0;
      const ratePerBase = config?.price_per_base_unit || baseUnitPrice;
      // standard unit is kg or 1000g, or direct unit
      const weightUnit = config?.weight_unit || "g";
      if (weightUnit === "g" || weightUnit === "ml") {
        return (ratePerBase * (numQty / 1000)) + modifiersPriceAdd;
      }
      return (ratePerBase * numQty) + modifiersPriceAdd;
    }
    return baseUnitPrice + modifiersPriceAdd;
  }, [isMeasured, measuredQty, config, baseUnitPrice, modifiersPriceAdd]);

  const totalCalculated = useMemo(() => {
    return Math.max(0, unitPrice * quantity);
  }, [unitPrice, quantity]);

  if (!product || !config) return null;

  const handleToggleModifier = (mod: ProductModifierOption, groupMax?: number) => {
    setSelectedModifiers((prev) => {
      const exists = prev.some((m) => m.id === mod.id);
      if (exists) {
        return prev.filter((m) => m.id !== mod.id);
      }
      return [...prev, mod];
    });
  };

  const handleConfirm = () => {
    let displayName = product.name;
    const attrEntries = Object.entries(selectedAttributes);
    if (attrEntries.length > 0) {
      displayName += ` (${attrEntries.map(([k, v]) => `${v}`).join(" / ")})`;
    }
    if (isMeasured) {
      displayName += ` - ${measuredQty}${config.weight_unit || "g"}`;
    }
    if (selectedModifiers.length > 0) {
      displayName += ` + ${selectedModifiers.map((m) => m.name).join(", ")}`;
    }

    const sku = matchedVariant?.sku || product.internal_sku || product.id;

    for (let i = 0; i < quantity; i++) {
      onConfirm({
        product,
        variant: matchedVariant || undefined,
        selectedAttributes,
        selectedModifiers,
        measuredQuantity: isMeasured ? parseFloat(measuredQty) || 0 : undefined,
        measuredUnit: isMeasured ? (config.weight_unit || "g") : undefined,
        effectivePrice: unitPrice,
        displayName,
        sku,
      });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] p-0 overflow-hidden rounded-2xl bg-card border-border shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-extrabold text-foreground">
                  {product.name}
                </DialogTitle>
                <Badge variant="outline" className="text-[10px] font-semibold uppercase bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30">
                  {config.product_type}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure variation, portion, add-ons, and pricing for POS
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground block font-medium">Item Total</span>
              <span className="text-lg font-black text-sky-600 dark:text-sky-400">
                {fmt(totalCalculated)}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-5 max-h-[68vh] overflow-y-auto">
          {/* Attributes Selection (e.g. Size, Crust, Flavor, Color) */}
          {config.attributes && config.attributes.length > 0 && (
            <div className="space-y-4">
              {config.attributes.map((attr) => (
                <div key={attr.id || attr.name} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-sky-500" />
                      Select {attr.name}:
                    </span>
                    <span className="text-sky-600 dark:text-sky-400 font-semibold">
                      {selectedAttributes[attr.name] || "None selected"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {attr.values.map((val) => {
                      const isSelected = selectedAttributes[attr.name] === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() =>
                            setSelectedAttributes((prev) => ({
                              ...prev,
                              [attr.name]: val,
                            }))
                          }
                          className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                            isSelected
                              ? "bg-sky-500 text-white border-sky-600 shadow-md shadow-sky-500/20 scale-[1.02]"
                              : "bg-background hover:bg-muted text-foreground border-border"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Weight-Based / Measured Controls (e.g. Sweets, Produce, Fabrics) */}
          {isMeasured && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-amber-500" />
                  Weighing &amp; Measurement ({config.weight_unit || "g"})
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  Base Rate: {fmt(config.price_per_base_unit || product.retail_price)} / kg
                </span>
              </div>

              {/* Quick Presets */}
              {config.quick_presets && config.quick_presets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {config.quick_presets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMeasuredQty(String(preset))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                        measuredQty === String(preset)
                          ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                          : "bg-card text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {preset >= 1000 ? `${preset / 1000}kg` : `${preset}${config.weight_unit || "g"}`}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom Quantity Input */}
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={measuredQty}
                  onChange={(e) => setMeasuredQty(e.target.value)}
                  className="font-mono text-sm h-9 bg-card border-border"
                  placeholder="e.g. 250"
                />
                <span className="text-xs font-bold text-foreground uppercase px-2 py-1 rounded bg-muted">
                  {config.weight_unit || "g"}
                </span>
              </div>
            </div>
          )}

          {/* Add-ons / Modifiers (e.g. Pizza Toppings, Extra Cheese, Sauces) */}
          {config.modifiers && config.modifiers.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border">
              {config.modifiers.map((group) => (
                <div key={group.id} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <UtensilsCrossed className="w-3.5 h-3.5 text-sky-500" />
                      {group.name}
                      {group.required && (
                        <span className="text-[10px] text-destructive font-bold">*Required</span>
                      )}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      {group.max_selections ? `Max ${group.max_selections}` : "Optional"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {group.options.map((opt) => {
                      const isSelected = selectedModifiers.some((m) => m.id === opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleToggleModifier(opt, group.max_selections)}
                          className={`p-2.5 rounded-xl text-left border transition flex items-center justify-between gap-1.5 ${
                            isSelected
                              ? "bg-sky-500/10 border-sky-500 text-sky-700 dark:text-sky-300 font-bold"
                              : "bg-background hover:bg-muted/60 border-border text-foreground font-medium"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                              isSelected ? "bg-sky-500 border-sky-600 text-white" : "border-muted-foreground/40"
                            }`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span className="text-xs truncate">{opt.name}</span>
                          </div>
                          {opt.price > 0 && (
                            <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
                              +{fmt(opt.price)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Variant Stock & SKU summary */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-emerald-500" />
              <span>SKU: <strong className="text-foreground font-mono">{matchedVariant?.sku || product.internal_sku || "N/A"}</strong></span>
            </div>
            <div>
              <span>Stock: </span>
              <strong className={`font-semibold ${
                (matchedVariant?.stock_units ?? product.stock_units) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
              }`}>
                {matchedVariant?.stock_units ?? product.stock_units} available
              </strong>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-border bg-muted/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl p-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
            >
              <Minus className="w-3.5 h-3.5" />
            </Button>
            <span className="w-8 text-center text-xs font-black text-foreground">
              {quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setQuantity((q) => q + 1)}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              className="rounded-xl text-xs font-bold h-9 bg-sky-500 hover:bg-sky-600 text-white gap-1.5 shadow-md shadow-sky-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Add to Cart ({fmt(totalCalculated)})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
