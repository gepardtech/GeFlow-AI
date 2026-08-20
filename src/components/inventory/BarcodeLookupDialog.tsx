import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ScanLine, Barcode } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "manual" | "scanner";
  onResolved: (prefill: Record<string, string>) => void;
}

/**
 * Direct Barcode Entry: user types a barcode, we sync product info from the
 * open product database (OpenFoodFacts, free & keyless).
 * Scanner mode: a USB/handheld scanner types into the focused input and sends
 * Enter; we run the same lookup automatically.
 */
const BarcodeLookupDialog = ({ open, onOpenChange, mode, onResolved }: Props) => {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setCode(""); setTimeout(() => inputRef.current?.focus(), 100); } }, [open]);

  const lookup = async (barcode: string) => {
    const clean = barcode.trim();
    if (!clean) return;
    setLoading(true);
    const prefill: Record<string, string> = { barcode: clean, internal_sku: `SKU-${clean.slice(-6)}` };
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(clean)}.json?fields=product_name,brands,generic_name`);
      const json = await res.json();
      if (json?.status === 1 && json?.product) {
        const p = json.product;
        prefill.name = p.product_name || p.generic_name || "";
        if (p.generic_name && p.generic_name !== prefill.name) prefill.description = p.generic_name;
      }
    } catch { /* offline / not found — user fills manually */ }
    setLoading(false);
    if (!prefill.name) {
      toast({ title: "No online match found", description: "Barcode captured — fill the details manually." });
    } else {
      toast({ title: "Product synced", description: prefill.name });
    }
    onResolved(prefill);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-400/15 text-sky-500 flex items-center justify-center">
              {mode === "scanner" ? <ScanLine className="h-5 w-5" /> : <Barcode className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle>{mode === "scanner" ? "Scan Barcode" : "Direct Barcode Entry"}</DialogTitle>
              <DialogDescription>
                {mode === "scanner" ? "Scan a product with your barcode scanner." : "Enter a barcode to sync product info from the web."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>Barcode</Label>
          <Input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") lookup(code); }}
            placeholder={mode === "scanner" ? "Waiting for scanner..." : "e.g. 8901234560123"}
            inputMode="numeric"
          />
          {mode === "scanner" && <p className="text-xs text-muted-foreground">Tip: most handheld scanners send an Enter key after scanning, which triggers the lookup automatically.</p>}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={() => lookup(code)} disabled={loading || !code.trim()} className="bg-sky-400 hover:bg-sky-500 text-white font-bold">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sync & Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeLookupDialog;
