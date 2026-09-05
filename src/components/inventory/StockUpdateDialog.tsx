import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ProductRecord } from "./ProductDialog";
import { Loader2, Boxes, Scale } from "lucide-react";
import { computeProductStock } from "@/lib/uomRegistry";
import { recordStockMovement } from "@/lib/stockMovementService";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: ProductRecord | null;
  onSaved: () => void;
}

const StockUpdateDialog = ({ open, onOpenChange, product, onSaved }: Props) => {
  const { toast } = useToast();
  const [mode, setMode] = useState<"add" | "remove" | "set">("add");
  const [unitType, setUnitType] = useState<"uom" | "base">("uom");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMode("add");
      setUnitType("uom");
      setQty("");
      setReason("");
    }
  }, [open]);

  const stockInfo = useMemo(() => {
    if (!product) return null;
    return computeProductStock(product.stock_units, product.name, product.description, product.uom, product.units_per_uom, product.base_unit);
  }, [product]);

  if (!product || !stockInfo) return null;

  const rawQty = parseFloat(qty) || 0;
  const packSize = stockInfo.packSize > 0 ? stockInfo.packSize : 1;
  const baseQtyDelta = unitType === "uom" ? Math.round(rawQty * packSize) : Math.round(rawQty);

  const currentBaseUnits = stockInfo.totalSubUnits;
  let projectedBaseUnits = currentBaseUnits;

  if (mode === "add") {
    projectedBaseUnits = currentBaseUnits + baseQtyDelta;
  } else if (mode === "remove") {
    projectedBaseUnits = Math.max(0, currentBaseUnits - baseQtyDelta);
  } else {
    // "set"
    projectedBaseUnits = Math.max(0, baseQtyDelta);
  }

  const projectedPacks = packSize > 0 ? +(projectedBaseUnits / packSize).toFixed(2) : projectedBaseUnits;

  const save = async () => {
    if (rawQty <= 0 && mode !== "set") {
      toast({ title: "Please enter a valid quantity", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const updatePayload: { stock_units: number; description?: string } = {
      stock_units: projectedBaseUnits,
    };

    if (product.description) {
      let updatedDesc = product.description;
      if (updatedDesc.includes("[PACK_QTY:")) {
        updatedDesc = updatedDesc.replace(/\[PACK_QTY:\s*[^\]]+\]/i, `[PACK_QTY: ${projectedPacks}]`);
      }
      if (updatedDesc.includes("[BASE_QTY:")) {
        updatedDesc = updatedDesc.replace(/\[BASE_QTY:\s*[^\]]+\]/i, `[BASE_QTY: ${projectedBaseUnits}]`);
      }
      updatePayload.description = updatedDesc;
    }

    const { error } = await supabase.from("products").update(updatePayload).eq("id", product.id);
    
    if (error) {
      setSaving(false);
      toast({ title: "Could not update stock", description: error.message, variant: "destructive" });
      return;
    }

    // Record stock movement (in base units)
    const movementQty = projectedBaseUnits - currentBaseUnits;
    if (movementQty !== 0 && user?.id) {
      await recordStockMovement({
        business_id: product.business_id,
        owner_user_id: user.id,
        product_id: product.id,
        quantity: movementQty,
        type: "adjustment",
        reason: reason || `Manual stock ${mode} (${unitType === "uom" ? `${rawQty} ${stockInfo.uomLabel}` : `${rawQty} ${stockInfo.subUnitName}`})`,
        note: `Updated from ${currentBaseUnits} to ${projectedBaseUnits} ${stockInfo.subUnitName.toLowerCase()}s`,
        reference_id: product.id,
        reference_type: "manual_adjustment",
        created_by: user.id,
      });
    }

    setSaving(false);
    toast({
      title: "Stock updated successfully",
      description: `${product.name}: ${stockInfo.displayText} → ${projectedPacks} ${stockInfo.uomLabel}s (${projectedBaseUnits} ${stockInfo.subUnitName.toLowerCase()}s)`,
    });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">Update Stock</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {product.name} · Current: <strong className="text-emerald-500">{stockInfo.displayText}</strong> ({stockInfo.totalSubUnits} {stockInfo.subUnitName.toLowerCase()}s)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Adjustment Mode */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Adjustment Action</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="grid grid-cols-3 gap-2">
              {[["add", "+ Add Stock"], ["remove", "- Remove Stock"], ["set", "= Set Total"]].map(([v, l]) => (
                <label
                  key={v}
                  className={`flex items-center justify-center gap-1.5 h-9 rounded-xl border cursor-pointer font-semibold transition ${
                    mode === v ? "border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <RadioGroupItem value={v} className="sr-only" /> {l}
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Unit Toggle if product has multiple units per pack */}
          {packSize > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Input Unit</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUnitType("uom")}
                  className={`flex items-center justify-center gap-2 h-9 rounded-xl border text-xs font-semibold transition ${
                    unitType === "uom"
                      ? "border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400 shadow-xs"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5" />
                  <span>Selling Pack ({stockInfo.uomLabel} of {packSize})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUnitType("base")}
                  className={`flex items-center justify-center gap-2 h-9 rounded-xl border text-xs font-semibold transition ${
                    unitType === "base"
                      ? "border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400 shadow-xs"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Base Unit ({stockInfo.subUnitName})</span>
                </button>
              </div>
            </div>
          )}

          {/* Quantity Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Quantity in {unitType === "uom" ? `${stockInfo.uomLabel}s` : `${stockInfo.subUnitName}s`}
            </Label>
            <Input
              type="number"
              min="0"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              autoFocus
              className="rounded-xl h-10"
            />
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Reason for Adjustment (Optional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Physical inventory count, damaged goods"
              className="rounded-xl h-9"
            />
          </div>

          {/* Real-time Calculation Preview Card */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[11px]">
              <span>Base Units Conversion:</span>
              <strong className="text-foreground">
                {rawQty > 0 ? (unitType === "uom" ? `${rawQty} ${stockInfo.uomLabel}s × ${packSize} = ${baseQtyDelta} ${stockInfo.subUnitName.toLowerCase()}s` : `${baseQtyDelta} ${stockInfo.subUnitName.toLowerCase()}s`) : "0"}
              </strong>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
              <span className="font-semibold text-foreground">New Inventory Total:</span>
              <strong className="text-sm font-extrabold text-sky-500">
                {projectedPacks} {stockInfo.uomLabel}s ({projectedBaseUnits} {stockInfo.subUnitName.toLowerCase()}s)
              </strong>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="rounded-xl text-xs h-9">
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs h-9 shadow-sm">
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Confirm Stock Update
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StockUpdateDialog;
