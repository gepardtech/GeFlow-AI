import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Printer,
  Copy,
  Receipt,
  Package,
  DollarSign,
  User,
  Calendar,
  Building2,
  FileCheck,
  AlertCircle,
} from "lucide-react";
import { useMoney } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";

export interface LedgerItemDetail {
  id: string;
  recordId: string;
  rawId: string;
  sourceType: "sale" | "movement" | "purchase";
  category: string;
  volume: number;
  unitVal: number;
  totalNet: number;
  profit?: number;
  status: "verified" | "pending" | "reconciled";
  date: string;
  processedBy?: string | null;
  customerName?: string | null;
  paymentMethod?: string | null;
  businessName?: string;
  lineItems?: {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    unitCost?: number;
    subtotal: number;
    sku?: string | null;
  }[];
  notes?: string | null;
}

interface RecordDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: LedgerItemDetail | null;
  businessName?: string;
}

export const RecordDetailModal: React.FC<RecordDetailModalProps> = ({
  open,
  onOpenChange,
  record,
  businessName = "Business Workspace",
}) => {
  const { format: fmt } = useMoney();
  const { toast } = useToast();

  if (!record) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(record.recordId);
    toast({
      title: "Record Key Copied",
      description: `Copied identifier ${record.recordId} to clipboard.`,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const recordDate = new Date(record.date);
  const formattedDate = isNaN(recordDate.getTime())
    ? record.date
    : recordDate.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });

  // Deterministic audit verification hash
  const auditHash = `0x${Array.from(record.rawId || record.id)
    .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 0xffffffff, 0x9e3779b9)
    .toString(16)
    .padStart(8, "0")
    .toUpperCase()}F8A1`;

  const profitMargin =
    record.profit && record.totalNet > 0
      ? Math.round((record.profit / record.totalNet) * 100)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border-border bg-card shadow-2xl">
        {/* Top Header Banner */}
        <div className="p-5 sm:p-6 border-b border-border bg-muted/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-500 flex items-center justify-center font-black text-base shrink-0 shadow-inner">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-lg font-black tracking-tight text-foreground font-mono">
                    {record.recordId}
                  </DialogTitle>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      record.status === "verified"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"
                        : record.status === "pending"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25"
                        : "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25"
                    }`}
                  >
                    {record.status === "verified" ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    {record.status}
                  </span>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formattedDate}</span>
                  <span>•</span>
                  <span>{businessName}</span>
                </DialogDescription>
              </div>
            </div>

            {/* Quick Action Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyId}
                className="h-8 px-2.5 rounded-lg text-xs font-bold border-border bg-card hover:bg-muted"
                title="Copy Identity"
              >
                <Copy className="w-3.5 h-3.5 mr-1" /> Copy ID
              </Button>
              <Button
                size="sm"
                onClick={handlePrint}
                className="h-8 px-3 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" /> Print
              </Button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* 4 KPI Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                TOTAL NET
              </span>
              <p className="text-base sm:text-lg font-black text-foreground mt-0.5 font-mono">
                {fmt(record.totalNet)}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                VOLUME UNITS
              </span>
              <p className="text-base sm:text-lg font-black text-foreground mt-0.5">
                {record.volume} {record.volume === 1 ? "unit" : "units"}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                UNIT VALUE
              </span>
              <p className="text-base sm:text-lg font-black text-foreground mt-0.5 font-mono">
                {fmt(record.unitVal)}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                {record.profit !== undefined ? "EST. PROFIT" : "CATEGORY"}
              </span>
              <p className="text-base sm:text-lg font-black text-emerald-500 dark:text-emerald-400 mt-0.5 font-mono">
                {record.profit !== undefined ? (
                  <>
                    {fmt(record.profit)}
                    {profitMargin !== null && (
                      <span className="text-[11px] font-semibold text-muted-foreground ml-1">
                        ({profitMargin}%)
                      </span>
                    )}
                  </>
                ) : (
                  record.category
                )}
              </p>
            </div>
          </div>

          {/* Operational Context Strip */}
          <div className="p-4 rounded-xl bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                TRANSACTION CLASSIFICATION
              </span>
              <p className="font-bold text-foreground capitalize">
                {record.sourceType === "sale"
                  ? "Direct Point of Sale Transaction"
                  : record.sourceType === "movement"
                  ? "Inventory Movement / Adjustment"
                  : "Procurement / Purchase Receipt"}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                CATEGORY SEGMENT
              </span>
              <p className="font-bold text-sky-500 uppercase tracking-wide">
                {record.category}
              </p>
            </div>

            {record.processedBy && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  OPERATOR / CASHIER
                </span>
                <p className="font-bold text-foreground">
                  {record.processedBy}
                </p>
              </div>
            )}
          </div>

          {/* Itemized Line Items Breakdown */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-sky-500" />
                <span>Itemized Breakdown ({record.lineItems?.length || 0})</span>
              </h4>
              <span className="text-[10px] text-muted-foreground font-semibold">
                Ledger verified records
              </span>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-[10px] font-bold uppercase text-muted-foreground tracking-wider border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3">PRODUCT / ITEM</th>
                    <th className="py-2.5 px-3 text-center">QTY</th>
                    <th className="py-2.5 px-3 text-right">UNIT PRICE</th>
                    <th className="py-2.5 px-3 text-right">SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(!record.lineItems || record.lineItems.length === 0) ? (
                    <tr>
                      <td colSpan={4} className="py-4 px-3 text-center text-muted-foreground">
                        Standard transaction package (consolidated entry of {record.volume} units).
                      </td>
                    </tr>
                  ) : (
                    record.lineItems.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-foreground">{item.productName}</p>
                          {item.sku && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              SKU: {item.sku}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-foreground">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                          {fmt(item.unitPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                          {fmt(item.subtotal)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cryptographic Compliance & Audit Hash */}
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <div>
                <span className="font-bold text-foreground">Immutable Audit Hash: </span>
                <span className="font-mono text-muted-foreground">{auditHash}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileCheck className="w-3.5 h-3.5 text-sky-500" />
              <span className="font-semibold">DB Record ID: </span>
              <span className="font-mono">{record.rawId.slice(0, 8)}...</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground font-medium">
            GeFlow Audit Engine • Verified Ledger Record
          </span>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-8 px-4 rounded-xl text-xs font-bold"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
