import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  fetchStockLedger,
  StockMovementRecord,
} from "@/lib/stockMovementService";
import {
  History,
  Download,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Calendar,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  productsList?: { id: string; name: string; internal_sku?: string | null }[];
}

export const StockLedgerModal: React.FC<Props> = ({
  open,
  onOpenChange,
  businessId,
  productsList = [],
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState<StockMovementRecord[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"all" | "today" | "7d" | "30d">("all");
  const [search, setSearch] = useState("");

  const loadLedger = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);

    let startDate: string | undefined;
    if (dateRange === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      startDate = d.toISOString();
    } else if (dateRange === "7d") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      startDate = d.toISOString();
    } else if (dateRange === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      startDate = d.toISOString();
    }

    const data = await fetchStockLedger(businessId, {
      productId: selectedProduct,
      movementType: selectedType,
      startDate,
    });

    setMovements(data);
    setLoading(false);
  }, [businessId, dateRange, selectedProduct, selectedType]);

  useEffect(() => {
    if (open && businessId) {
      loadLedger();
    }
  }, [open, businessId, loadLedger]);

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const prodName = (m.products?.name || "").toLowerCase();
      const sku = (m.products?.internal_sku || "").toLowerCase();
      const reason = (m.reason || "").toLowerCase();
      const note = (m.note || "").toLowerCase();
      const ref = (m.reference_id || "").toLowerCase();
      const q = search.toLowerCase();

      return (
        !q ||
        prodName.includes(q) ||
        sku.includes(q) ||
        reason.includes(q) ||
        note.includes(q) ||
        ref.includes(q)
      );
    });
  }, [movements, search]);

  const handleExportCSV = () => {
    if (filteredMovements.length === 0) {
      toast({ title: "No data to export", description: "There are no stock movements matching the current filter." });
      return;
    }

    const headers = [
      "Date & Time",
      "Product Name",
      "SKU",
      "Movement Type",
      "Quantity (Base Units)",
      "Selling UoM",
      "Units Per UoM",
      "Reason",
      "Reference Type",
      "Reference ID",
      "Note",
    ];

    const rows = filteredMovements.map((m) => {
      const dateStr = new Date(m.created_at).toLocaleString();
      const prodName = `"${(m.products?.name || "Product").replace(/"/g, '""')}"`;
      const sku = `"${(m.products?.internal_sku || "").replace(/"/g, '""')}"`;
      const type = m.type;
      const qty = m.quantity;
      const uom = m.products?.uom || "piece";
      const scale = m.products?.units_per_uom || 1;
      const reason = `"${(m.reason || "").replace(/"/g, '""')}"`;
      const refType = m.reference_type || "";
      const refId = m.reference_id || "";
      const note = `"${(m.note || "").replace(/"/g, '""')}"`;

      return [dateStr, prodName, sku, type, qty, uom, scale, reason, refType, refId, note].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `stock_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Ledger Exported",
      description: `Exported ${filteredMovements.length} movement records to CSV.`,
    });
  };

  const getTypeBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case "in":
      case "purchase":
      case "return":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <ArrowDownRight className="h-3 w-3" /> + INTAKE
          </span>
        );
      case "out":
      case "sale":
      case "waste":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <ArrowUpRight className="h-3 w-3" /> - DEDUCT
          </span>
        );
      case "transfer":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Layers className="h-3 w-3" /> TRANSFER
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            ADJUSTMENT
          </span>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border border-border shadow-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-card">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                <History className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-extrabold text-foreground">
                  Stock Ledger & Audit Trail
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Complete history of inventory movements tracked in Base Units
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadLedger}
                disabled={loading}
                className="h-8 px-2.5 text-xs font-semibold gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </Button>
              <Button
                size="sm"
                onClick={handleExportCSV}
                className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Filter Controls Bar */}
        <div className="p-3 sm:p-4 bg-muted/20 border-b border-border space-y-2.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search product, SKU, note..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-2.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {/* Product Filter */}
            <div>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full h-8 px-2 bg-background border border-border rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
              >
                <option value="all">All Products</option>
                {productsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.internal_sku ? `(${p.internal_sku})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Movement Type */}
            <div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full h-8 px-2 bg-background border border-border rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
              >
                <option value="all">All Movement Types</option>
                <option value="in">Intake / Purchases / Adds (+)</option>
                <option value="out">Deductions / Sales (-)</option>
                <option value="adjustment">Manual Adjustments</option>
                <option value="transfer">Branch Transfers</option>
              </select>
            </div>

            {/* Date Range Selector */}
            <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
              {(["all", "today", "7d", "30d"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDateRange(r)}
                  className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    dateRange === r
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r === "all" ? "All" : r === "today" ? "Today" : r === "7d" ? "7 Days" : "30 Days"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 mx-auto animate-spin mb-2 text-sky-500" />
              <p className="text-xs">Loading ledger entries...</p>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-2">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-bold text-foreground">No movements recorded</p>
              <p className="text-xs max-w-sm mx-auto">
                Stock changes from sales, purchases, adjustments, and imports will be logged here in Base Units.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/40 sticky top-0 border-b border-border/80 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                <tr>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Product</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Quantity (Base Units)</th>
                  <th className="p-3">Reason / Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredMovements.map((m) => {
                  const prod = m.products;
                  const isPositive = m.type === "in" || m.type === "purchase" || m.type === "return";
                  const baseUnit = prod?.base_unit || "piece";
                  const uom = prod?.uom || "pack";
                  const scale = Number(prod?.units_per_uom) || 1;

                  return (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                        {new Date(m.created_at).toLocaleDateString()}{" "}
                        <span className="text-[10px] text-muted-foreground/70">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>

                      <td className="p-3 min-w-[160px]">
                        <p className="font-bold text-foreground truncate max-w-xs">{prod?.name || "Product"}</p>
                        {prod?.internal_sku && (
                          <p className="text-[10px] text-muted-foreground font-mono">SKU: {prod.internal_sku}</p>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap">{getTypeBadge(m.type)}</td>

                      <td className="p-3 text-right whitespace-nowrap font-mono">
                        <span
                          className={`font-bold text-xs ${
                            isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-sky-600 dark:text-sky-400"
                          }`}
                        >
                          {isPositive ? "+" : "-"}
                          {Math.abs(m.quantity)} {baseUnit}
                        </span>
                        {scale > 1 && (
                          <p className="text-[10px] text-muted-foreground font-sans">
                            ≈ {(Math.abs(m.quantity) / scale).toFixed(2)} {uom}
                          </p>
                        )}
                      </td>

                      <td className="p-3 min-w-[180px]">
                        <p className="font-medium text-foreground truncate">{m.reason || "Inventory update"}</p>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate mt-0.5">
                          {m.reference_type && (
                            <span className="font-semibold text-sky-600 dark:text-sky-400 uppercase">
                              [{m.reference_type}]
                            </span>
                          )}
                          {m.reference_id && <span className="font-mono truncate">{m.reference_id}</span>}
                          {m.note && !m.reference_id && <span className="italic truncate">{m.note}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-border bg-card flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{filteredMovements.length}</strong> movement records
          </span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
