import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ProductRecord } from "./ProductDialog";
import type { BusinessRow } from "@/hooks/useActiveBusiness";
import { Loader2, ArrowRightLeft, Boxes, Scale } from "lucide-react";
import { computeProductStock } from "@/lib/uomRegistry";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: ProductRecord | null;
  sourceBusinessId: string;
  ownerUserId: string;
  businesses: BusinessRow[];
  onSaved: () => void;
}

const BulkTransferDialog = ({ open, onOpenChange, product, sourceBusinessId, ownerUserId, businesses, onSaved }: Props) => {
  const { toast } = useToast();
  const [target, setTarget] = useState("");
  const [unitType, setUnitType] = useState<"uom" | "base">("uom");
  const [qty, setQty] = useState("");
  const [saving, setSaving] = useState(false);

  const options = businesses.filter((b) => b.id !== sourceBusinessId);
  useEffect(() => { if (open) { setTarget(""); setQty(""); setUnitType("uom"); } }, [open]);
  
  const stockInfo = useMemo(() => {
    if (!product) return null;
    return computeProductStock(product.stock_units, product.name, product.description, product.uom, product.units_per_uom, product.base_unit);
  }, [product]);

  if (!product || !stockInfo) return null;

  const packSize = stockInfo.packSize > 0 ? stockInfo.packSize : 1;
  const rawQty = parseFloat(qty) || 0;
  const baseQty = unitType === "uom" ? Math.round(rawQty * packSize) : Math.round(rawQty);

  const save = async () => {
    if (!target) { toast({ title: "Select a destination branch", variant: "destructive" }); return; }
    if (baseQty <= 0 || baseQty > stockInfo.totalSubUnits) {
      toast({
        title: "Invalid quantity",
        description: `Available: ${stockInfo.displayText} (${stockInfo.totalSubUnits} ${stockInfo.subUnitName.toLowerCase()}s)`,
        variant: "destructive",
      });
      return;
    }
    setSaving(true);

    const newSourceBaseUnits = Math.max(0, stockInfo.totalSubUnits - baseQty);
    const newSourcePacks = packSize > 0 ? +(newSourceBaseUnits / packSize).toFixed(2) : newSourceBaseUnits;

    let updatedSrcDesc = product.description;
    if (updatedSrcDesc) {
      if (updatedSrcDesc.includes("[PACK_QTY:")) {
        updatedSrcDesc = updatedSrcDesc.replace(/\[PACK_QTY:\s*[^\]]+\]/i, `[PACK_QTY: ${newSourcePacks}]`);
      }
      if (updatedSrcDesc.includes("[BASE_QTY:")) {
        updatedSrcDesc = updatedSrcDesc.replace(/\[BASE_QTY:\s*[^\]]+\]/i, `[BASE_QTY: ${newSourceBaseUnits}]`);
      }
    }

    // Decrement source
    const { error: srcErr } = await supabase
      .from("products")
      .update({
        stock_units: newSourceBaseUnits,
        ...(updatedSrcDesc ? { description: updatedSrcDesc } : {}),
      })
      .eq("id", product.id);

    if (srcErr) {
      setSaving(false);
      toast({ title: "Transfer failed", description: srcErr.message, variant: "destructive" });
      return;
    }

    // Record source stock movement out
    await supabase.from("stock_movements").insert({
      business_id: sourceBusinessId,
      owner_user_id: ownerUserId,
      product_id: product.id,
      quantity: -baseQty,
      type: "out",
      reason: "branch transfer out",
      note: `Transferred ${rawQty} ${unitType === "uom" ? stockInfo.uomLabel : stockInfo.subUnitName}s to destination branch`,
    });

    // Find matching product in target branch
    const { data: existing } = await supabase.from("products")
      .select("id, stock_units, description").eq("business_id", target)
      .eq("name", product.name).maybeSingle();

    if (existing) {
      const newTargetBaseUnits = (existing.stock_units ?? 0) + baseQty;
      let updatedTgtDesc = existing.description;
      if (updatedTgtDesc) {
        const newTgtPacks = packSize > 0 ? +(newTargetBaseUnits / packSize).toFixed(2) : newTargetBaseUnits;
        if (updatedTgtDesc.includes("[PACK_QTY:")) {
          updatedTgtDesc = updatedTgtDesc.replace(/\[PACK_QTY:\s*[^\]]+\]/i, `[PACK_QTY: ${newTgtPacks}]`);
        }
        if (updatedTgtDesc.includes("[BASE_QTY:")) {
          updatedTgtDesc = updatedTgtDesc.replace(/\[BASE_QTY:\s*[^\]]+\]/i, `[BASE_QTY: ${newTargetBaseUnits}]`);
        }
      }

      await supabase.from("products").update({
        stock_units: newTargetBaseUnits,
        ...(updatedTgtDesc ? { description: updatedTgtDesc } : {}),
      }).eq("id", existing.id);

      await supabase.from("stock_movements").insert({
        business_id: target,
        owner_user_id: ownerUserId,
        product_id: existing.id,
        quantity: baseQty,
        type: "in",
        reason: "branch transfer in",
        note: `Received ${rawQty} ${unitType === "uom" ? stockInfo.uomLabel : stockInfo.subUnitName}s from branch transfer`,
      });
    } else {
      const newTgtPacks = packSize > 0 ? +(baseQty / packSize).toFixed(2) : baseQty;
      let newTgtDesc = product.description || "";
      if (newTgtDesc.includes("[PACK_QTY:")) {
        newTgtDesc = newTgtDesc.replace(/\[PACK_QTY:\s*[^\]]+\]/i, `[PACK_QTY: ${newTgtPacks}]`);
      }
      if (newTgtDesc.includes("[BASE_QTY:")) {
        newTgtDesc = newTgtDesc.replace(/\[BASE_QTY:\s*[^\]]+\]/i, `[BASE_QTY: ${baseQty}]`);
      }

      const insertPayload: any = {
        business_id: target,
        owner_user_id: ownerUserId,
        name: product.name,
        internal_sku: product.internal_sku,
        description: newTgtDesc,
        category_id: product.category_id,
        subcategory_id: product.subcategory_id ?? null,
        purchase_cost: product.purchase_cost,
        retail_price: product.retail_price,
        discount_price: product.discount_price,
        stock_units: baseQty,
        min_stock_alert: product.min_stock_alert,
        batch_number: product.batch_number,
        expiry_date: product.expiry_date,
        barcode: product.barcode,
        status: product.status,
        images: product.images ?? [],
        uom: product.uom,
        units_per_uom: product.units_per_uom,
        base_unit: product.base_unit,
      };

      const { data: newProd } = await supabase.from("products").insert(insertPayload).select("id").maybeSingle();
      if (newProd?.id) {
        await supabase.from("stock_movements").insert({
          business_id: target,
          owner_user_id: ownerUserId,
          product_id: newProd.id,
          quantity: baseQty,
          type: "in",
          reason: "branch transfer in",
          note: `Received ${rawQty} ${unitType === "uom" ? stockInfo.uomLabel : stockInfo.subUnitName}s from branch transfer`,
        });
      }
    }

    setSaving(false);
    toast({
      title: "Stock transferred successfully",
      description: `Moved ${rawQty} ${unitType === "uom" ? stockInfo.uomLabel : stockInfo.subUnitName}s (${baseQty} base units) of ${product.name} to destination branch.`,
    });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-400/15 text-sky-500 flex items-center justify-center shrink-0">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">Bulk Transfer Stock</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {product.name} · Available: <strong className="text-emerald-500">{stockInfo.displayText}</strong> ({stockInfo.totalSubUnits} {stockInfo.subUnitName.toLowerCase()}s)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Destination Branch</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue placeholder="Select a destination branch" />
              </SelectTrigger>
              <SelectContent>
                {options.length === 0 && <SelectItem value="none" disabled>No other branches available</SelectItem>}
                {options.map((b) => <SelectItem key={b.id} value={b.id}>{b.business_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {packSize > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Transfer Unit</Label>
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

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Quantity to Transfer ({unitType === "uom" ? `${stockInfo.uomLabel}s` : `${stockInfo.subUnitName}s`})
            </Label>
            <Input
              type="number"
              min="1"
              max={unitType === "uom" ? Math.floor(stockInfo.listingStock) : stockInfo.totalSubUnits}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              className="rounded-xl h-10"
            />
          </div>

          {rawQty > 0 && (
            <div className="p-3 rounded-xl bg-muted/40 border border-border/80 text-[11px] space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Base Units Transferred:</span>
                <strong className="text-foreground">{baseQty} {stockInfo.subUnitName.toLowerCase()}s</strong>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Remaining in this branch:</span>
                <strong className="text-emerald-500">
                  {Math.max(0, stockInfo.totalSubUnits - baseQty)} {stockInfo.subUnitName.toLowerCase()}s (~{packSize > 0 ? ((stockInfo.totalSubUnits - baseQty) / packSize).toFixed(1) : 0} {stockInfo.uomLabel}s)
                </strong>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="rounded-xl text-xs h-9">
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs h-9 shadow-sm">
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Transfer Stock
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkTransferDialog;
