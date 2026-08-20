import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShoppingBag, Package, Loader2, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMoney } from "@/lib/currency";

export interface PurchaseRecord {
  id: string;
  business_id: string;
  owner_user_id: string;
  supplier_name: string;
  invoice_ref: string | null;
  entry_date: string;
  total: number;
  status: string;
  created_at: string;
}

interface PurchaseItemRow {
  id: string;
  product_name: string;
  quantity: number;
  purchase_price: number;
  sale_price: number;
  batch_number: string | null;
  expiry_date: string | null;
}

interface Props {
  purchase: PurchaseRecord | null;
  onOpenChange: (v: boolean) => void;
  businessName?: string;
  taxRate?: number;
}

const PurchaseLedgerDialog = ({ purchase, onOpenChange, businessName = "", taxRate = 0 }: Props) => {
  const { format: fmt, symbol } = useMoney();
  const [items, setItems] = useState<PurchaseItemRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!purchase) return;
    setLoading(true);
    supabase
      .from("purchase_items")
      .select("id, product_name, quantity, purchase_price, sale_price, batch_number, expiry_date")
      .eq("purchase_id", purchase.id)
      .then(({ data }) => {
        setItems((data as PurchaseItemRow[]) ?? []);
        setLoading(false);
      });
  }, [purchase]);

  const { net, tax, total } = useMemo(() => {
    const computedNet = items.reduce((s, it) => s + Number(it.quantity) * Number(it.purchase_price), 0);
    const netVal = items.length > 0 ? computedNet : Number(purchase?.total ?? 0);
    const taxVal = +(netVal * (taxRate / 100)).toFixed(2);
    return { net: +netVal.toFixed(2), tax: taxVal, total: +(netVal + taxVal).toFixed(2) };
  }, [items, purchase, taxRate]);

  const purchaseId = purchase ? `PUR-${purchase.id.slice(0, 8).toUpperCase()}` : "";
  const recordDate = purchase ? new Date(purchase.entry_date).toLocaleDateString() : "";

  const downloadPdf = () => {
    if (!purchase) return;
    const rowsHtml = items.map((it) => `
      <tr>
        <td class="l">${escapeHtml(it.product_name)}${it.batch_number ? `<div class="muted">Batch: ${escapeHtml(it.batch_number)}${it.expiry_date ? ` · Exp ${new Date(it.expiry_date).toLocaleDateString()}` : ""}</div>` : ""}</td>
        <td class="c">${it.quantity}</td>
        <td class="r">${symbol}${Number(it.purchase_price).toFixed(2)}</td>
        <td class="r">${symbol}${(Number(it.quantity) * Number(it.purchase_price)).toFixed(2)}</td>
      </tr>`).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${purchaseId}</title>
    <style>
      *{box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;}
      body{margin:0;padding:40px;color:#0f172a;}
      .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0ea5e9;padding-bottom:20px;margin-bottom:24px;}
      .brand{font-size:24px;font-weight:800;}
      .sub{color:#64748b;font-size:13px;margin-top:4px;}
      .tag{background:#0ea5e9;color:#fff;padding:6px 14px;border-radius:8px;font-weight:700;font-size:13px;}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-bottom:24px;font-size:13px;}
      .meta div span{color:#64748b;display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;}
      table{width:100%;border-collapse:collapse;margin-bottom:20px;}
      th{background:#f1f5f9;text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#475569;}
      td{padding:12px;border-bottom:1px solid #e2e8f0;font-size:13px;}
      .c{text-align:center;}.r{text-align:right;}.l{text-align:left;}
      .muted{color:#94a3b8;font-size:11px;margin-top:2px;}
      .totals{margin-left:auto;width:280px;font-size:14px;}
      .totals .row{display:flex;justify-content:space-between;padding:8px 0;}
      .totals .grand{border-top:2px solid #0f172a;margin-top:6px;padding-top:12px;font-size:18px;font-weight:800;color:#0ea5e9;}
      .foot{margin-top:40px;color:#94a3b8;font-size:11px;text-align:center;}
    </style></head><body>
      <div class="head">
        <div><div class="brand">${escapeHtml(businessName || "GeFlow")}</div><div class="sub">Purchase Invoice</div></div>
        <div class="tag">${purchaseId}</div>
      </div>
      <div class="meta">
        <div><span>Supplier</span>${escapeHtml(purchase.supplier_name || "—")}</div>
        <div><span>Invoice Reference</span>${escapeHtml(purchase.invoice_ref || "—")}</div>
        <div><span>Record Date</span>${recordDate}</div>
        <div><span>Status</span>${escapeHtml(purchase.status)}</div>
      </div>
      <table>
        <thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Unit Price</th><th class="r">Amount</th></tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="4" class="c muted">No line items recorded.</td></tr>`}</tbody>
      </table>
      <div class="totals">
        <div class="row"><span>Net Price</span><span>${symbol}${net.toFixed(2)}</span></div>
        <div class="row"><span>Tax (${taxRate}%)</span><span>${symbol}${tax.toFixed(2)}</span></div>
        <div class="row grand"><span>Total</span><span>${symbol}${total.toFixed(2)}</span></div>
      </div>
      <div class="foot">Generated by GeFlow · ${new Date().toLocaleString()}</div>
    </body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      };
    }
  };

  return (
    <Dialog open={!!purchase} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-sky-500" />
            Purchase Ledger · {purchaseId}
          </DialogTitle>
          <DialogDescription>
            Full stock-in record and supplier invoice details.
          </DialogDescription>
        </DialogHeader>

        {/* Meta grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Meta label="Supplier" value={purchase?.supplier_name || "—"} />
          <Meta label="Invoice Ref" value={purchase?.invoice_ref || "—"} />
          <Meta label="Record Date" value={recordDate} />
          <Meta label="Status" value={purchase?.status || "—"} className="capitalize" />
        </div>

        {/* Items */}
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1.6fr_0.5fr_0.8fr_0.8fr_1fr] gap-2 px-4 py-2.5 bg-muted/40 text-[10px] font-bold tracking-widest text-muted-foreground">
            <span>PRODUCT</span><span>QTY</span><span>PRICE</span><span>AMOUNT</span><span>BATCH / EXPIRY</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No line items recorded.</div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((it) => (
                <div key={it.id} className="grid grid-cols-[1.6fr_0.5fr_0.8fr_0.8fr_1fr] gap-2 px-4 py-3 text-sm items-center">
                  <span className="font-semibold flex items-center gap-2 min-w-0">
                    <Package className="h-3.5 w-3.5 text-sky-500 flex-shrink-0" />
                    <span className="truncate">{it.product_name}</span>
                  </span>
                  <span>{it.quantity}</span>
                  <span>{fmt(Number(it.purchase_price))}</span>
                  <span className="font-bold">{fmt(Number(it.quantity) * Number(it.purchase_price))}</span>
                  <span className="text-xs text-muted-foreground">
                    {it.batch_number || "—"}{it.expiry_date ? ` · ${new Date(it.expiry_date).toLocaleDateString()}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="flex flex-col items-end gap-1.5 pt-1">
          <div className="w-full sm:w-64 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Net Price</span>
            <span className="font-semibold">{fmt(net)}</span>
          </div>
          <div className="w-full sm:w-64 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tax ({taxRate}%)</span>
            <span className="font-semibold">{fmt(tax)}</span>
          </div>
          <div className="w-full sm:w-64 flex items-center justify-between border-t border-border pt-2 mt-1">
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground">TOTAL PRICE</span>
            <span className="text-xl font-extrabold text-sky-500">{fmt(total)}</span>
          </div>
        </div>

        <button
          onClick={downloadPdf}
          className="mt-2 h-11 w-full rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold inline-flex items-center justify-center gap-2 transition"
        >
          <FileDown className="h-4 w-4" /> Download PDF Invoice
        </button>
      </DialogContent>
    </Dialog>
  );
};

const Meta = ({ label, value, className = "" }: { label: string; value: string; className?: string }) => (
  <div className="bg-muted/40 rounded-xl p-3">
    <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">{label}</p>
    <p className={`text-sm font-semibold mt-0.5 truncate ${className}`}>{value}</p>
  </div>
);

const escapeHtml = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default PurchaseLedgerDialog;
