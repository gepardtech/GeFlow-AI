import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ProductRecord } from "./ProductDialog";
import type { BusinessRow } from "@/hooks/useActiveBusiness";
import { Loader2, ArrowRightLeft } from "lucide-react";

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
  const [qty, setQty] = useState("");
  const [saving, setSaving] = useState(false);

  const options = businesses.filter((b) => b.id !== sourceBusinessId);
  useEffect(() => { if (open) { setTarget(""); setQty(""); } }, [open]);
  if (!product) return null;

  const n = parseInt(qty) || 0;

  const save = async () => {
    if (!target) { toast({ title: "Select a destination branch", variant: "destructive" }); return; }
    if (n <= 0 || n > product.stock_units) { toast({ title: "Invalid quantity", description: `Available: ${product.stock_units}`, variant: "destructive" }); return; }
    setSaving(true);

    // Decrement source
    const { error: srcErr } = await supabase.from("products").update({ stock_units: product.stock_units - n }).eq("id", product.id);
    if (srcErr) { setSaving(false); toast({ title: "Transfer failed", description: srcErr.message, variant: "destructive" }); return; }

    // Find matching product in target branch
    const { data: existing } = await supabase.from("products")
      .select("id, stock_units").eq("business_id", target)
      .eq("name", product.name).maybeSingle();

    if (existing) {
      await supabase.from("products").update({ stock_units: (existing.stock_units ?? 0) + n }).eq("id", existing.id);
    } else {
      await supabase.from("products").insert({
        business_id: target, owner_user_id: ownerUserId, name: product.name,
        internal_sku: product.internal_sku, description: product.description,
        category_id: product.category_id, subcategory_id: product.subcategory_id ?? null,
        purchase_cost: product.purchase_cost, retail_price: product.retail_price,
        discount_price: product.discount_price, stock_units: n, min_stock_alert: product.min_stock_alert,
        batch_number: product.batch_number, expiry_date: product.expiry_date, barcode: product.barcode,
        status: product.status, images: product.images ?? [],
      });
    }
    setSaving(false);
    toast({ title: "Stock transferred", description: `${n} × ${product.name} moved to selected branch.` });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-400/15 text-sky-500 flex items-center justify-center"><ArrowRightLeft className="h-5 w-5" /></div>
            <div>
              <DialogTitle>Bulk Transfer</DialogTitle>
              <DialogDescription>{product.name} · {product.stock_units} in stock</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Destination Branch</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue placeholder="Select a business branch" /></SelectTrigger>
              <SelectContent>
                {options.length === 0 && <SelectItem value="none" disabled>No other branches available</SelectItem>}
                {options.map((b) => <SelectItem key={b.id} value={b.id}>{b.business_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quantity to Transfer</Label>
            <Input type="number" min="1" max={product.stock_units} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-sky-400 hover:bg-sky-500 text-white font-bold">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Transfer Stock
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkTransferDialog;
