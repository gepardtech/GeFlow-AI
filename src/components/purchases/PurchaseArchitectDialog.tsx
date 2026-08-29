import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Truck, Package, Plus, Trash2, ArrowRight, Loader2, Scale, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMoney } from "@/lib/currency";
import { ALL_STANDARD_UOMS, parseProductUOM } from "@/lib/uomRegistry";

export interface PurchaseProduct {
  id: string;
  name: string;
  description?: string | null;
  stock_units: number;
  purchase_cost: number;
  retail_price: number;
}

interface LineItem {
  key: string;
  product_id: string;
  uom: string;
  multiplier: string;
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
  product_id: "",
  uom: "piece",
  multiplier: "1",
  qty: "1",
  purchase: "0",
  sale: "0",
  batch: "",
  expiry: "",
});

const PurchaseArchitectDialog = ({
  open,
  onOpenChange,
  businessId,
  userId,
  products,
  onSaved,
}: Props) => {
  const { toast } = useToast();
  const { symbol, format: fmt } = useMoney();

  const [supplier, setSupplier] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<LineItem[]>([blankLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSupplier("");
      setInvoiceRef("");
      setEntryDate(new Date().toISOString().slice(0, 10));
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
    if (!p) {
      setLine(key, { product_id: pid });
      return;
    }

    const parsed = parseProductUOM(p.name, p.description || "");
    setLine(key, {
      product_id: pid,
      uom: parsed.uom || "piece",
      multiplier: String(parsed.packSize > 0 ? parsed.packSize : 1),
      purchase: String(p.purchase_cost || 0),
      sale: String(p.retail_price || 0),
    });
  };

  const grandTotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.purchase) || 0), 0),
    [lines]
  );

  const totalItems = useMemo(
    () =>
      lines.reduce((s, l) => {
        const qty = Number(l.qty) || 0;
        const mult = Number(l.multiplier) || 1;
        return s + qty * mult;
      }, 0),
    [lines]
  );

  const commit = async () => {
    if (!businessId || !userId) return;
    const valid = lines.filter((l) => l.product_id && (Number(l.qty) || 0) > 0);
    if (valid.length === 0) {
      toast({
        title: "Nothing to commit",
        description: "Add at least one product with quantity.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);

    const { data: purchase, error: perr } = await supabase
      .from("purchases")
      .insert({
        business_id: businessId,
        owner_user_id: userId,
        supplier_name: supplier || "Unspecified Supplier",
        invoice_ref: invoiceRef || null,
        entry_date: entryDate,
        total: grandTotal,
        status: "completed",
      })
      .select("id")
      .single();

    if (perr || !purchase) {
      setSaving(false);
      toast({
        title: "Could not record purchase",
        description: perr?.message,
        variant: "destructive",
      });
      return;
    }

    for (const l of valid) {
      const p = products.find((x) => x.id === l.product_id);
      const pkgQty = Number(l.qty) || 0;
      const multiplier = Number(l.multiplier) || 1;
      const totalStockUnitsAdded = +(pkgQty * multiplier).toFixed(3);
      const purchasePricePerPkg = Number(l.purchase) || 0;
      const salePricePerPkg = Number(l.sale) || 0;

      // Unit prices per single stock unit
      const unitPurchaseCost = multiplier > 1 ? +(purchasePricePerPkg / multiplier).toFixed(2) : purchasePricePerPkg;
      const unitRetailPrice = multiplier > 1 ? +(salePricePerPkg / multiplier).toFixed(2) : salePricePerPkg;

      const uomObj = ALL_STANDARD_UOMS.find((u) => u.id === l.uom);
      const uomLabel = uomObj ? uomObj.name : l.uom;
      const itemTitle = multiplier > 1
        ? `${p?.name ?? "Product"} (${pkgQty} ${uomLabel} @ ${multiplier} units)`
        : (p?.name ?? "Product");

      await supabase.from("purchase_items").insert({
        purchase_id: purchase.id,
        owner_user_id: userId,
        product_id: l.product_id,
        product_name: itemTitle,
        quantity: totalStockUnitsAdded,
        purchase_price: purchasePricePerPkg,
        sale_price: salePricePerPkg,
        batch_number: l.batch || null,
        expiry_date: l.expiry || null,
      });

      // Increase stock and refresh pricing/batch on product
      const update: {
        stock_units: number;
        purchase_cost: number;
        retail_price?: number;
        batch_number?: string;
        expiry_date?: string;
      } = {
        stock_units: +( (p?.stock_units ?? 0) + totalStockUnitsAdded ).toFixed(3),
        purchase_cost: purchasePricePerPkg,
      };
      if (salePricePerPkg > 0) update.retail_price = salePricePerPkg;
      if (l.batch) update.batch_number = l.batch;
      if (l.expiry) update.expiry_date = l.expiry;

      await supabase.from("products").update(update).eq("id", l.product_id);

      await supabase.from("stock_movements").insert({
        business_id: businessId,
        owner_user_id: userId,
        product_id: l.product_id,
        quantity: totalStockUnitsAdded,
        type: "in",
        reason: "purchase (UOM pack aware)",
        note: `Purchase ${purchase.id.slice(0, 8)} · ${pkgQty} ${uomLabel} (x${multiplier})${supplier ? ` · ${supplier}` : ""}`,
      });
    }

    setSaving(false);
    toast({
      title: "Purchase committed",
      description: `${valid.length} line(s) · ${fmt(grandTotal)} · ${totalItems} stock units added.`,
    });
    onSaved();
    onOpenChange(false);
  };

  const inputCls =
    "h-10 px-3 bg-card border border-border text-foreground rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden rounded-3xl border-border max-h-[92vh] flex flex-col bg-card">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-border bg-muted/20">
          <div className="flex items-start gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold leading-tight text-foreground">Purchase Architect &amp; Stock-In</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-500 border border-sky-500/20 uppercase">
                  UOM Pack Multipliers
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Record new stock-in with pack conversions (Cartons, Boxes, Bags, Mann, Liters) and automatic inventory calculation.
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Grand Total</p>
            <p className="text-2xl font-extrabold text-sky-500">{fmt(grandTotal)}</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Transaction details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Supplier Entity</label>
              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g. MedCare Pharmaceuticals / Agro Wholesalers"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Invoice / Reference No.</label>
              <input
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                placeholder="e.g. INV-90231"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Entry Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Itemized */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-sky-500" />
                <h3 className="font-extrabold text-sm text-foreground">Itemized Stock-In Lines</h3>
              </div>
              <button
                type="button"
                onClick={addLine}
                className="h-9 px-3.5 rounded-xl border border-border text-xs font-bold inline-flex items-center gap-1.5 hover:bg-muted transition"
              >
                <Plus className="h-3.5 w-3.5 text-sky-500" /> Add Line Item
              </button>
            </div>

            <div className="rounded-2xl border border-border overflow-hidden bg-card">
              <div className="hidden lg:grid grid-cols-[1.8fr_0.9fr_0.6fr_0.8fr_0.8fr_1.1fr_auto] gap-3 px-4 py-2.5 bg-muted/40 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                <span>Product</span>
                <span>Purchase UOM &amp; Multiplier</span>
                <span>Pkg Qty</span>
                <span>Purchase ({symbol})</span>
                <span>Retail ({symbol})</span>
                <span>Batch / Expiry</span>
                <span></span>
              </div>
              <div className="divide-y divide-border">
                {lines.map((l) => {
                  const qty = Number(l.qty) || 0;
                  const mult = Number(l.multiplier) || 1;
                  const totalUnits = +(qty * mult).toFixed(2);

                  return (
                    <div
                      key={l.key}
                      className="grid grid-cols-1 lg:grid-cols-[1.8fr_0.9fr_0.6fr_0.8fr_0.8fr_1.1fr_auto] gap-3 px-4 py-3.5 items-start bg-card hover:bg-muted/10 transition"
                    >
                      {/* Product select */}
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase lg:hidden block mb-1">Product</label>
                        <select
                          value={l.product_id}
                          onChange={(e) => onProductPick(l.key, e.target.value)}
                          className={inputCls + " w-full font-medium"}
                        >
                          <option value="">Select Product...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* UOM and Multiplier */}
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase lg:hidden block mb-1">Purchase Unit &amp; Pack Size</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <select
                            value={l.uom}
                            onChange={(e) => setLine(l.key, { uom: e.target.value })}
                            className={inputCls + " w-full text-xs px-2"}
                          >
                            {ALL_STANDARD_UOMS.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={l.multiplier}
                            onChange={(e) => setLine(l.key, { multiplier: e.target.value })}
                            placeholder="x Units"
                            title="Units per package (e.g. 20 tabs/box, 24 boxes/carton, 40 kg/mann)"
                            className={inputCls + " w-full text-xs px-2"}
                          />
                        </div>
                      </div>

                      {/* Qty */}
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase lg:hidden block mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={l.qty}
                          onChange={(e) => setLine(l.key, { qty: e.target.value })}
                          className={inputCls + " w-full font-bold text-center"}
                        />
                        {mult > 1 && (
                          <span className="text-[9px] font-semibold text-sky-500 block text-center mt-1">
                            ={totalUnits} units
                          </span>
                        )}
                      </div>

                      {/* Purchase Price */}
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase lg:hidden block mb-1">Purchase Price</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.purchase}
                          onChange={(e) => setLine(l.key, { purchase: e.target.value })}
                          placeholder="Per Pack"
                          className={inputCls + " w-full"}
                        />
                      </div>

                      {/* Retail Price */}
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase lg:hidden block mb-1">Retail Price</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.sale}
                          onChange={(e) => setLine(l.key, { sale: e.target.value })}
                          placeholder="Per Pack"
                          className={inputCls + " w-full"}
                        />
                      </div>

                      {/* Batch & Expiry */}
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase lg:hidden block mb-1">Batch / Expiry</label>
                        <div className="flex flex-col gap-1.5">
                          <input
                            value={l.batch}
                            onChange={(e) => setLine(l.key, { batch: e.target.value })}
                            placeholder="Batch No."
                            className="h-8 px-2 bg-card border border-border text-foreground rounded-lg text-xs"
                          />
                          <input
                            type="date"
                            value={l.expiry}
                            onChange={(e) => setLine(l.key, { expiry: e.target.value })}
                            className="h-8 px-2 bg-card border border-border text-foreground rounded-lg text-xs"
                          />
                        </div>
                      </div>

                      {/* Delete */}
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => removeLine(l.key)}
                          className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-rose-500 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6 border-t border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-lg border border-border text-[11px] font-bold bg-card">
              LINES: {lines.length}
            </span>
            <span className="px-3 py-1.5 rounded-lg border border-border text-[11px] font-bold bg-card text-sky-500">
              TOTAL STOCK UNITS ADDED: {totalItems}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-xs font-bold tracking-widest text-muted-foreground hover:text-foreground transition uppercase"
            >
              Discard Draft
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={saving}
              className="h-12 px-6 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold inline-flex items-center gap-2 disabled:opacity-50 transition shadow-md"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Commit Purchase &amp; Update Stock <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseArchitectDialog;
