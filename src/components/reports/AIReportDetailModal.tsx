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
  Sparkles,
  DollarSign,
  Boxes,
  PackageX,
  AlertTriangle,
  Flame,
  ShieldAlert,
  Download,
  Calendar,
  Building2,
  FileText,
  Phone,
  Mail,
  Truck,
  CheckCircle2,
} from "lucide-react";
import { GeneratedAIReport } from "@/lib/aiReportSchedulerService";
import { useMoney } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: GeneratedAIReport | null;
}

export const AIReportDetailModal: React.FC<Props> = ({ open, onOpenChange, report }) => {
  const { format: fmt } = useMoney();
  const { toast } = useToast();

  if (!report) return null;

  const handleDownloadReport = () => {
    const jsonStr = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AI_Report_${report.frequency}_${report.createdAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Report Downloaded",
      description: "AI Executive Report saved in JSON format.",
    });
  };

  const handleExportCSV = () => {
    let csv = "Section,Metric,Value,Notes\n";
    csv += `Profit,Revenue,${report.sections.profit.revenue},"Gross sales revenue"\n`;
    csv += `Profit,Net Profit,${report.sections.profit.profit},"Net calculated profit"\n`;
    csv += `Profit,Margin %,${report.sections.profit.marginPercent.toFixed(2)}%,"Gross Margin"\n`;
    csv += `Inventory,Total Valuation,${report.sections.inventory.totalValuation},"Valuation at cost"\n`;
    csv += `Inventory,Total Units,${report.sections.inventory.totalUnits},"Stock on hand"\n`;
    csv += `Out of Stock,Count,${report.sections.outOfStock.count},"Items requiring immediate restock"\n`;
    csv += `Low Stock,Count,${report.sections.lowStock.count},"Items below warning threshold"\n`;
    csv += `Issue Products,Count,${report.sections.issueProducts.count},"Expiring/Negative margin items"\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AI_Report_${report.frequency}_${report.createdAt.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "CSV Exported",
      description: "AI Report metrics exported as CSV.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl flex flex-col max-h-[90vh]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-foreground">
                  {report.title}
                </DialogTitle>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-500/10 text-sky-500 border border-sky-500/20">
                  {report.frequency}
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {report.businessName}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {new Date(report.createdAt).toLocaleString()}
                </span>
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="rounded-xl text-xs font-semibold h-8"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadReport}
              className="rounded-xl text-xs font-semibold h-8 bg-sky-500 hover:bg-sky-600 text-white"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" /> Download JSON
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Summary Banner */}
          <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/20 text-xs text-foreground leading-relaxed">
            <span className="font-bold text-sky-500 block mb-1">AI Executive Analysis:</span>
            {report.summary}
          </div>

          {/* Key 6 Pillars Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Profit Pillar */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5" />
                </div>
                <span>1. Profit & Sales Performance</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="p-2 rounded-lg bg-muted/40">
                  <span className="text-[10px] text-muted-foreground block">Revenue</span>
                  <span className="text-xs font-bold text-foreground font-mono">
                    {fmt(report.sections.profit.revenue)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-muted/40">
                  <span className="text-[10px] text-muted-foreground block">Net Profit</span>
                  <span className="text-xs font-bold text-emerald-500 font-mono">
                    {fmt(report.sections.profit.profit)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-muted/40">
                  <span className="text-[10px] text-muted-foreground block">Margin</span>
                  <span className="text-xs font-bold text-sky-500">
                    {report.sections.profit.marginPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Total Inventory Pillar */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center">
                  <Boxes className="w-3.5 h-3.5" />
                </div>
                <span>2. Total Inventory & Valuation</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="p-2 rounded-lg bg-muted/40">
                  <span className="text-[10px] text-muted-foreground block">Valuation</span>
                  <span className="text-xs font-bold text-foreground font-mono">
                    {fmt(report.sections.inventory.totalValuation)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-muted/40">
                  <span className="text-[10px] text-muted-foreground block">Total Units</span>
                  <span className="text-xs font-bold text-foreground font-mono">
                    {report.sections.inventory.totalUnits}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-muted/40">
                  <span className="text-[10px] text-muted-foreground block">SKU Count</span>
                  <span className="text-xs font-bold text-foreground font-mono">
                    {report.sections.inventory.activeCatalogCount}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Out of Stock Pillar */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
                    <PackageX className="w-3.5 h-3.5" />
                  </div>
                  <span>3. Out of Stock Items ({report.sections.outOfStock.count})</span>
                </div>
                {report.sections.outOfStock.count > 0 && (
                  <span className="text-[10px] text-rose-500 font-extrabold uppercase">Critical</span>
                )}
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 pt-1">
                {report.sections.outOfStock.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">No products out of stock.</p>
                ) : (
                  report.sections.outOfStock.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-rose-500/5">
                      <span className="font-semibold text-foreground truncate max-w-[200px]">{it.name}</span>
                      <span className="text-[10px] text-rose-500 font-mono">0 units</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 4. Low Stock Pillar */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <span>4. Low Stock Warnings ({report.sections.lowStock.count})</span>
                </div>
                {report.sections.lowStock.count > 0 && (
                  <span className="text-[10px] text-amber-500 font-extrabold uppercase">Restock Alert</span>
                )}
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 pt-1">
                {report.sections.lowStock.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">All stocks above threshold.</p>
                ) : (
                  report.sections.lowStock.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-amber-500/5">
                      <span className="font-semibold text-foreground truncate max-w-[180px]">{it.name}</span>
                      <span className="text-[10px] text-amber-600 font-mono font-bold">
                        {it.currentStock} left (Alert: {it.alertLimit})
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 5. Highly Demanded Products Pillar */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <Flame className="w-3.5 h-3.5" />
                </div>
                <span>5. Highly Demanded Products</span>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 pt-1">
                {report.sections.highlyDemanded.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">No sales recorded yet.</p>
                ) : (
                  report.sections.highlyDemanded.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-purple-500/5">
                      <span className="font-semibold text-foreground truncate max-w-[180px]">{it.name}</span>
                      <span className="text-[10px] text-purple-600 font-mono font-bold">
                        {it.unitsSold} sold ({fmt(it.revenueGenerated)})
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 6. Issue Products Pillar */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </div>
                  <span>6. Issue Products ({report.sections.issueProducts.count})</span>
                </div>
                {report.sections.issueProducts.count > 0 && (
                  <span className="text-[10px] text-red-500 font-extrabold uppercase">Action Needed</span>
                )}
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 pt-1">
                {report.sections.issueProducts.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">No expiring or negative margin products.</p>
                ) : (
                  report.sections.issueProducts.items.map((it, idx) => (
                    <div key={idx} className="text-xs p-1.5 rounded-lg bg-red-500/5 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">{it.name}</span>
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">
                          {it.issueType.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{it.details}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Supplier Recommendations & Restock Sheet */}
          {report.supplierRecommendations && report.supplierRecommendations.length > 0 && (
            <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-sky-500" />
                  <h4 className="text-xs font-bold text-foreground">
                    Nearby Supplier Restock Recommendations ({report.supplierRecommendations.length})
                  </h4>
                </div>
                <span className="text-[10px] text-muted-foreground">AI Procurement Sheet</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-border/80 text-[10px] font-bold uppercase text-muted-foreground">
                      <th className="py-2 px-2">PRODUCT</th>
                      <th className="py-2 px-2">REORDER QTY</th>
                      <th className="py-2 px-2">EST. COST</th>
                      <th className="py-2 px-2">PRIMARY SUPPLIER</th>
                      <th className="py-2 px-2">CONTACT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {report.supplierRecommendations.map((rec, i) => (
                      <tr key={i} className="hover:bg-muted/40">
                        <td className="py-2 px-2 font-semibold text-foreground">{rec.productName}</td>
                        <td className="py-2 px-2 font-mono font-bold text-sky-500">{rec.suggestedQty} units</td>
                        <td className="py-2 px-2 font-mono">{fmt(rec.estimatedCost)}</td>
                        <td className="py-2 px-2 font-medium text-foreground">{rec.primarySupplier}</td>
                        <td className="py-2 px-2 text-[11px] text-muted-foreground font-mono">{rec.supplierPhone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-end">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 px-5 rounded-xl text-xs font-bold"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
