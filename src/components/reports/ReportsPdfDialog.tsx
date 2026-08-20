import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, FileText, CheckCircle2, Building2, Calendar } from "lucide-react";
import { useMoney } from "@/lib/currency";

interface AuditLedgerItem {
  id: string;
  recordId: string;
  category: string;
  volume: number;
  unitVal: number;
  totalNet: number;
  status: "verified" | "pending";
  date: string;
}

interface ReportsPdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessName: string;
  reportLogic: string;
  dateRange: string;
  kpis: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
  };
  categoryMix: {
    name: string;
    value: number;
    color: string;
    percentage: number;
  }[];
  auditLedger: AuditLedgerItem[];
}

export const ReportsPdfDialog = ({
  open,
  onOpenChange,
  businessName,
  reportLogic,
  dateRange,
  kpis,
  categoryMix,
  auditLedger,
}: ReportsPdfDialogProps) => {
  const { format: fmt } = useMoney();

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 print:p-0 print:border-none print:shadow-none">
        <DialogHeader className="print:hidden border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-500 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Executive Report Preview</DialogTitle>
                <p className="text-xs text-muted-foreground">Ready for print or PDF export</p>
              </div>
            </div>
            <Button
              onClick={handlePrint}
              className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs"
            >
              <Printer className="w-4 h-4 mr-2" /> Print / Save as PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Document Body */}
        <div id="printable-report" className="space-y-6 text-foreground py-2 text-xs">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-primary/20 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-2xl tracking-tight text-sky-500">GeFlow</span>
                <span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-md bg-muted text-muted-foreground uppercase">
                  COMPLIANCE REPORT
                </span>
              </div>
              <p className="text-base font-bold text-foreground mt-1">{businessName}</p>
              <p className="text-xs text-muted-foreground">Generated on {new Date().toLocaleDateString(undefined, { dateStyle: "long" })}</p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Report Logic</p>
              <p className="text-sm font-bold text-foreground">{reportLogic}</p>
              <p className="text-xs text-muted-foreground">Date Window: <span className="font-semibold">{dateRange}</span></p>
            </div>
          </div>

          {/* KPI Summary Strip */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl border border-border bg-muted/30">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">TOTAL REVENUE</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{fmt(kpis.totalRevenue)}</p>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-muted/30">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">TOTAL ORDERS</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{kpis.totalOrders}</p>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-muted/30">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">AVG ORDER VALUE</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{fmt(kpis.avgOrderValue)}</p>
            </div>
          </div>

          {/* Category Mix Breakdown */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">Category Revenue Distribution</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {categoryMix.map((cat, idx) => (
                <div key={idx} className="p-2.5 rounded-lg border border-border/80 bg-card">
                  <p className="font-bold text-xs uppercase text-muted-foreground">{cat.name}</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{fmt(cat.value)}</p>
                  <p className="text-[10px] text-sky-500 font-semibold">{cat.percentage}% of total</p>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Ledger Table */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">Granular Audit Ledger</h4>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                    <th className="py-2.5 px-3">Record Identity</th>
                    <th className="py-2.5 px-3">Category / Group</th>
                    <th className="py-2.5 px-3 text-center">Volume</th>
                    <th className="py-2.5 px-3 text-right">Unit Val</th>
                    <th className="py-2.5 px-3 text-right">Total Net</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {auditLedger.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 px-3 font-mono font-bold text-foreground">{row.recordId}</td>
                      <td className="py-2 px-3 uppercase font-semibold text-muted-foreground">{row.category}</td>
                      <td className="py-2 px-3 text-center font-bold">{row.volume}</td>
                      <td className="py-2 px-3 text-right font-mono">{fmt(row.unitVal)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{fmt(row.totalNet)}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          row.status === "verified" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="border-t border-border pt-3 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>GeFlow Cloud Enterprise • Ledger Verified</span>
            <span>Confidential Financial Document</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
