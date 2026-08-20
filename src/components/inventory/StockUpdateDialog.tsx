import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ProductRecord } from "./ProductDialog";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: ProductRecord | null;
  onSaved: () => void;
}

const StockUpdateDialog = ({ open, onOpenChange, product, onSaved }: Props) => {
  const { toast } = useToast();
  const [mode, setMode] = useState("add");
  const [qty, setQty] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setMode("add"); setQty(""); } }, [open]);
  if (!product) return null;

  const n = parseInt(qty) || 0;
  const projected = mode === "add" ? product.stock_units + n : mode === "remove" ? Math.max(0, product.stock_units - n) : n;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("products").update({ stock_units: projected }).eq("id", product.id);
    setSaving(false);
    if (error) { toast({ title: "Could not update stock", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Stock updated", description: `${product.name}: ${product.stock_units} → ${projected}` });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Stock</DialogTitle>
          <DialogDescription>{product.name} · current stock {product.stock_units}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <RadioGroup value={mode} onValueChange={setMode} className="grid grid-cols-3 gap-2">
            {[["add", "Add"], ["remove", "Remove"], ["set", "Set to"]].map(([v, l]) => (
              <label key={v} className={`flex items-center justify-center gap-2 h-10 rounded-lg border cursor-pointer text-sm font-semibold ${mode === v ? "border-sky-400 bg-sky-400/10 text-sky-500" : "border-border"}`}>
                <RadioGroupItem value={v} className="sr-only" /> {l}
              </label>
            ))}
          </RadioGroup>
          <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" autoFocus />
          </div>
          <p className="text-sm text-muted-foreground">New stock level: <span className="font-bold text-foreground">{projected}</span></p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-sky-400 hover:bg-sky-500 text-white font-bold">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Update Stock
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StockUpdateDialog;
