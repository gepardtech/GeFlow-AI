import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, CheckCircle2, RotateCcw, Copy, Check } from "lucide-react";
import { ReturnRecord } from "@/lib/returnsService";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: ReturnRecord | null;
  businessName?: string;
  currencySymbol?: string;
}

export function ReturnReceiptModal({
  open,
  onOpenChange,
  record,
  businessName = "Business Store",
  currencySymbol = "$",
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!record) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const lines = [
      `=== RETURN & REFUND RECEIPT ===`,
      `Store: ${businessName}`,
      `Return ID: ${record.id}`,
      `Sale Ref: #${record.sale_id}`,
      `Date: ${new Date(record.created_at).toLocaleString()}`,
      `Cashier: ${record.cashier_name || "Staff"}`,
      `Refund Method: ${record.refund_method.toUpperCase()}`,
      `--------------------------------`,
      ...record.items.map(
        (it) =>
          `${it.return_qty}x ${it.product_name} @ ${currencySymbol}${it.unit_price.toFixed(2)} = ${currencySymbol}${it.refund_amount.toFixed(2)} [${it.reason}]`
      ),
      `--------------------------------`,
      `TOTAL REFUND: ${currencySymbol}${record.total_refund.toFixed(2)}`,
      `================================`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    toast({ title: "Copied receipt summary to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-background border border-border sm:rounded-2xl">
        <DialogHeader className="p-4 sm:p-6 bg-muted/30 border-b border-border pb-4">
          <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Return Processed Successfully</span>
          </div>
          <DialogTitle className="text-xl font-black text-foreground pt-1">
            Refund Receipt
          </DialogTitle>
        </DialogHeader>

        {/* Printable Receipt Paper */}
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto font-mono text-xs" ref={printRef}>
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-border">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-foreground font-sans">
              {businessName}
            </h3>
            <p className="text-muted-foreground text-[11px]">CUSTOMER RETURN & REFUND VOUCHER</p>
            <p className="text-muted-foreground text-[10px]">
              {new Date(record.created_at).toLocaleString()}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] py-1">
            <div>
              <span className="text-muted-foreground block text-[10px]">RETURN ID</span>
              <span className="font-bold text-foreground truncate block">{record.id}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">ORIGINAL SALE</span>
              <span className="font-bold text-foreground truncate block">#{record.sale_id}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">CASHIER</span>
              <span className="font-semibold text-foreground">{record.cashier_name || "Cashier"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">PAYMENT / REFUND</span>
              <span className="font-bold uppercase text-sky-500">{record.refund_method}</span>
            </div>
            {record.customer_name && (
              <div className="col-span-2">
                <span className="text-muted-foreground block text-[10px]">CUSTOMER</span>
                <span className="font-semibold text-foreground">{record.customer_name}</span>
              </div>
            )}
          </div>

          {/* Returned Items */}
          <div className="pt-2 border-t border-dashed border-border space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
              <span>Item Description</span>
              <span>Refund Amount</span>
            </div>
            {record.items.map((it, idx) => (
              <div key={idx} className="flex items-start justify-between gap-2 py-1 text-xs">
                <div className="flex-1">
                  <div className="font-bold text-foreground">{it.product_name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {it.return_qty} returned @ {currencySymbol}{it.unit_price.toFixed(2)} ·{" "}
                    <span className="capitalize">{it.reason.replace(/_/g, " ")}</span>
                    {it.restock && <span className="text-emerald-500 ml-1 font-semibold">(Restocked)</span>}
                  </div>
                </div>
                <div className="font-bold text-foreground text-right shrink-0">
                  {currencySymbol}{it.refund_amount.toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Total Refund Banner */}
          <div className="pt-3 border-t-2 border-border flex items-center justify-between text-sm">
            <span className="font-extrabold text-foreground">TOTAL REFUNDED</span>
            <span className="font-black text-lg text-emerald-500">
              {currencySymbol}{record.total_refund.toFixed(2)}
            </span>
          </div>

          {record.notes && (
            <div className="p-2.5 rounded-lg bg-muted/40 text-[11px] text-muted-foreground italic border border-border">
              Note: {record.notes}
            </div>
          )}

          <div className="text-center pt-3 text-[10px] text-muted-foreground">
            Thank you for shopping with us. Please retain this voucher for your records.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-muted/20 border-t border-border flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleCopySummary} className="text-xs h-9 gap-1.5 cursor-pointer">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="text-xs h-9 gap-1.5 cursor-pointer">
            <Printer className="w-3.5 h-3.5" />
            Print Receipt
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)} className="text-xs h-9 cursor-pointer">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
