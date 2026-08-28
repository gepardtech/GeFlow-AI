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
  Truck,
  Download,
  Calendar,
  Building2,
  FileText,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  PackageX,
  Send,
} from "lucide-react";
import { SupplierRecommendationReport } from "@/lib/aiReportSchedulerService";
import { useMoney } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: SupplierRecommendationReport | null;
  onApprove?: (reportId: string) => void;
}

export const AIRestockDetailModal: React.FC<Props> = ({
  open,
  onOpenChange,
  report,
  onApprove,
}) => {
  const { format: fmt } = useMoney();
  const { toast } = useToast();

  if (!report) return null;

  const handleExportCSV = () => {
    let csv = "Product Name,SKU,Current Stock,Alert Threshold,Recommended Order Qty,Unit Cost,Subtotal Cost,Supplier Name,Supplier Phone,Supplier Email,Supplier Address,Urgency,Lead Time\n";
    report.items.forEach((it) => {
      csv += `"${it.productName}","${it.sku}",${it.currentStock},${it.alertLimit},${it.recommendedOrderQty},${it.unitCost},${it.subtotalCost},"${it.supplierName}","${it.supplierPhone}","${it.supplierEmail}","${it.supplierAddress}","${it.urgency}","${it.leadTime}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AI_Supplier_Procurement_${report.createdAt.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Procurement Sheet Exported",
      description: "Supplier contact and order recommendations downloaded.",
    });
  };

  const handleApprove = () => {
    onApprove?.(report.id);
    toast({
      title: "Purchase Order Draft Approved",
      description: "Supplier procurement orders queued for fulfillment.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl flex flex-col max-h-[90vh]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border bg-muted/30 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-foreground">
                  {report.title}
                </DialogTitle>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    report.status === "approved"
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  }`}
                >
                  {report.status.replace("_", " ")}
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
              <Download className="w-3.5 h-3.5 mr-1.5" /> Export PO Draft
            </Button>
            {report.status !== "approved" && (
              <Button
                size="sm"
                onClick={handleApprove}
                className="rounded-xl text-xs font-bold h-8 bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve & Execute
              </Button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top KPI Metrics Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-card border border-border">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                Products Requiring Restock
              </span>
              <p className="text-lg font-extrabold text-foreground font-mono mt-0.5">
                {report.itemsCount} SKUs
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-card border border-border">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                Total Recommended Order
              </span>
              <p className="text-lg font-extrabold text-sky-500 font-mono mt-0.5">
                {report.items.reduce((acc, i) => acc + i.recommendedOrderQty, 0)} Units
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-card border border-border">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                Estimated Procurement Capital
              </span>
              <p className="text-lg font-extrabold text-emerald-500 font-mono mt-0.5">
                {fmt(report.totalEstimatedCost)}
              </p>
            </div>
          </div>

          {/* Supplier Procurement Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Itemized Supplier Contact & Restock Schedule
              </h4>
              <span className="text-xs text-muted-foreground">
                Auto-matched with certified nearby distributors
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-[10px] font-bold uppercase text-muted-foreground">
                    <th className="py-3 px-3">PRODUCT</th>
                    <th className="py-3 px-3 text-center">CURRENT / ALERT</th>
                    <th className="py-3 px-3 text-center">REORDER QTY</th>
                    <th className="py-3 px-3 text-right">EST. COST</th>
                    <th className="py-3 px-3">NEARBY SUPPLIER & CONTACT</th>
                    <th className="py-3 px-3 text-center">LEAD TIME</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {it.urgency === "critical" ? (
                            <span className="w-5 h-5 rounded-md bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                              <PackageX className="w-3 h-3" />
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                              <AlertTriangle className="w-3 h-3" />
                            </span>
                          )}
                          <div>
                            <span className="font-bold text-foreground block">{it.productName}</span>
                            <span className="text-[10px] text-muted-foreground font-mono block">
                              SKU: {it.sku}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-mono font-bold ${
                            it.currentStock === 0 ? "text-rose-500" : "text-amber-500"
                          }`}
                        >
                          {it.currentStock} units
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          Alert at {it.alertLimit}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-sky-500 font-mono text-sm">
                        +{it.recommendedOrderQty}
                      </td>

                      <td className="py-3 px-3 text-right font-mono">
                        <span className="font-bold text-foreground block">{fmt(it.subtotalCost)}</span>
                        <span className="text-[10px] text-muted-foreground block">
                          @{fmt(it.unitCost)}/u
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-bold text-foreground block">{it.supplierName}</span>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-2.5 h-2.5 text-sky-500" /> {it.supplierPhone}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="w-2.5 h-2.5 text-sky-500" /> {it.supplierEmail}
                          </span>
                        </div>
                        <span className="text-[9px] text-muted-foreground/80 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2.5 h-2.5" /> {it.supplierAddress}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-foreground border border-border">
                          {it.leadTime}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            AI Automated Supplier Procurement Engine
          </span>
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
