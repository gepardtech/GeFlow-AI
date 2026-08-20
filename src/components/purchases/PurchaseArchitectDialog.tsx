import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Truck, Package, Plus, Trash2, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMoney } from "@/lib/currency";

export interface PurchaseProduct {
  id: string;
  name: string;
  stock_units: number;
  purchase_cost: number;
  retail_price: number;
}

interface LineItem {
  key: string;
  product_id: string;
  qty: string;
  purchase: string;
  sale: string;
  batch: string;
  expiry: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  businessId: string;
  userId: string;
  products: PurchaseProduct[];
  onSaved: () => void;
}

const blankLine = (): LineItem => ({
  key: Math.random().toString(36).slice(2),
  product_id: "", qty: "1", purchase: "0", sale: "0", batch: "", expiry: "",
});

const PurchaseArchitectDialog = ({ open, onOpenChange, businessId, userId, products, onSaved }: Props) => {
  const { toast } = useToast();
  const { symbol, format: fmt } = useMoney();

  const [supplier, setSupplier] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<LineItem[]>([blankLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSupplier(""); setInvoiceRef(""); setEntryDate(new Date().toISOString().slice(0, 10));
      setLines([blankLine()]);
    }
  }, [open]);

  const setLine = (key: string, patch: Partial<LineItem>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = () => setLines((prev) => [...prev, blankLine()]);
  const removeLine = (key: string) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  const onProductPick = (key: string, pid: string) => {
    const p = products.find((x) => x.id === pid);
    setLine(key, {
      product_id: pid,
      purchase: p ? String(p.purchase_cost) : "0",
      sale: p ? String(p.retail_price) : "0",
    });
  };

  const grandTotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.purchase) || 0), 0),
    [lines],
  );
  const totalItems = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);

  const commit = async () => {
    if (!businessId || !userId) return;
    const valid = lines.filter((l) => l.product_id && (Number(l.qty) || 0) > 0);
    if (valid.length === 0) {
      toast({ title: "Nothing to commit", description: "Add at least one product with quantity.", variant: "destructive" });
      return;
    }
    setSaving(true);

    const { data: purchase, error: perr } = await supabase
      .from("purchases")
      .insert({
        business_id: businessId, owner_user_id: userId,
        supplier_name: supplier || "Unspecified Supplier",
        invoice_ref: invoiceRef || null, entry_date: entryDate,
        total: grandTotal, status: "completed",
      })
      .select("id")
      .single();

    if (perr || !purchase) {
      setSaving(false);
      toast({ title: "Could not record purchase", description: perr?.message, variant: "destructive" });
      return;
    }

    for (const l of valid) {
      const p = products.find((x) => x.id === l.product_id);
      const qty = Number(l.qty) || 0;
      const purchasePrice = Number(l.purchase) || 0;
      const salePrice = Number(l.sale) || 0;

      await supabase.from("purchase_items").insert({
        purchase_id: purchase.id, owner_user_id: userId, product_id: l.product_id,
        product_name: p?.name ?? "Product", quantity: qty,
        purchase_price: purchasePrice, sale_price: salePrice,
        batch_number: l.batch || null, expiry_date: l.expiry || null,
      });

      // Increase stock and refresh pricing/batch on the product record.
      const update: {
        stock_units: number; purchase_cost: number;
        retail_price?: number; batch_number?: string; expiry_date?: string;
      } = {
        stock_units: (p?.stock_units ?? 0) + qty,
        purchase_cost: purchasePrice,
      };
      if (salePrice > 0) update.retail_price = salePrice;
      if (l.batch) update.batch_number = l.batch;
      if (l.expiry) update.expiry_date = l.expiry;
      await supabase.from("products").update(update).eq("id", l.product_id);

      await supabase.from("stock_movements").insert({
        business_id: businessId, owner_user_id: userId, product_id: l.product_id,
        quantity: qty, type: "in", reason: "purchase",
        note: `Purchase ${purchase.id.slice(0, 8)}${supplier ? ` · ${supplier}` : ""}`,
      });
    }

    setSaving(false);
    toast({ title: "Purchase committed", description: `${valid.length} line(s) · ${fmt(grandTotal)} · stock updated.` });
    onSaved();
    onOpenChange(false);
  };

  const inputCls = "h-10 px-3 bg-card border border-border text-foreground rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border-border max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-400/15 text-sky-500 flex items-center justify-center flex-shrink-0">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold leading-tight">Purchase Architect</h2>
              <p className="text-sm text-muted-foreground">Record a new stock-in event and update your inventory ledger.</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground">GRAND TOTAL</p>
            <p className="text-2xl font-extrabold text-sky-500">{fmt(grandTotal)}</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Transaction details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground">SUPPLIER ENTITY</label>
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Gepard Pharma Wholesalers" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground">INVOICE / REFERENCE NO.</label>
              <input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} placeholder="e.g. INV-90231" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground">ENTRY DATE</label>
              <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Itemized */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-sky-500" />
                <h3 className="font-extrabold">Itemized Stock-In</h3>
              </div>
              <button onClick={addLine} className="h-9 px-3 rounded-xl border border-border text-xs font-bold inline-flex items-center gap-1.5 hover:bg-muted transition">
                <Plus className="h-3.5 w-3.5" /> Add Line Item
              </button>
            </div>

            <div className="rounded-2xl border border-border overflow-hidden">
              <div className="hidden md:grid grid-cols-[1.6fr_0.6fr_0.8fr_0.8fr_1.2fr_auto] gap-3 px-4 py-2.5 bg-muted/40 text-[10px] font-bold tracking-widest text-muted-foreground">
                <span>PRODUCT SEARCH</span><span>QTY</span><span>PURCHASE ({symbol})</span>
                <span>SALE ({symbol})</span><span>BATCH / EXPIRY</span><span></span>
              </div>
              <div className="divide-y divide-border">
                {lines.map((l) => (
                  <div key={l.key} className="grid grid-cols-1 md:grid-cols-[1.6fr_0.6fr_0.8fr_0.8fr_1.2fr_auto] gap-3 px-4 py-3 items-start">
                    <select value={l.product_id} onChange={(e) => onProductPick(l.key, e.target.value)} className={inputCls + " w-full"}>
                      <option value="">Identify Product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <input type="number" min="1" value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} className={inputCls + " w-full"} />
                    <input type="number" min="0" step="0.01" value={l.purchase} onChange={(e) => setLine(l.key, { purchase: e.target.value })} className={inputCls + " w-full"} />
                    <input type="number" min="0" step="0.01" value={l.sale} onChange={(e) => setLine(l.key, { sale: e.target.value })} className={inputCls + " w-full"} />
                    <div className="flex flex-col gap-2">
                      <input value={l.batch} onChange={(e) => setLine(l.key, { batch: e.target.value })} placeholder="Batch" className={inputCls + " w-full"} />
                      <input type="date" value={l.expiry} onChange={(e) => setLine(l.key, { expiry: e.target.value })} className={inputCls + " w-full"} />
                    </div>
                    <button onClick={() => removeLine(l.key)} className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-rose-500 transition">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-6 border-t border-border">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-lg border border-border text-[11px] font-bold">LINES: {lines.length}</span>
            <span className="px-3 py-1.5 rounded-lg border border-border text-[11px] font-bold">TOTAL ITEMS: {totalItems}</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => onOpenChange(false)} className="text-xs font-bold tracking-widest text-muted-foreground hover:text-foreground transition">
              DISCARD DRAFT
            </button>
            <button onClick={commit} disabled={saving} className="h-12 px-6 rounded-2xl bg-sky-400 hover:bg-sky-500 text-white font-bold inline-flex items-center gap-2 disabled:opacity-50 transition">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              COMMIT PURCHASE &amp; UPDATE STOCK <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseArchitectDialog;
