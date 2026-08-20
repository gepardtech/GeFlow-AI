import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import type { ProductRecord } from "./ProductDialog";
import { CalendarIcon, Download, FileSpreadsheet, FileBarChart2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: ProductRecord[];
  categoryName: (id: string | null) => string;
  businessName: string;
}

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const download = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

type ExportType = "report" | "products";

const ExportLedgerDialog = ({ open, onOpenChange, products, categoryName, businessName }: Props) => {
  const { toast } = useToast();
  const [range, setRange] = useState<DateRange | undefined>();
  const [type, setType] = useState<ExportType>("products");
  const [includeImages, setIncludeImages] = useState(true);

  const slug = businessName.replace(/\s+/g, "_");
  const stamp = range?.from
    ? `${format(range.from, "yyyyMMdd")}-${range.to ? format(range.to, "yyyyMMdd") : "now"}`
    : format(new Date(), "yyyyMMdd");

  const exportProducts = () => {
    const header = ["Name", "ID", "Category", "Stock", "Price", "Discount", "Status"];
    if (includeImages) header.push("Images");
    const rows = products.map((p) => {
      const r: (string | number)[] = [
        p.name, p.internal_sku ?? "", categoryName(p.category_id),
        p.stock_units, p.retail_price, p.discount_price ?? "", p.status,
      ];
      if (includeImages) r.push((p.images ?? []).join(" | "));
      return r;
    });
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    download(csv, `${slug}_products_${stamp}.csv`, "text/csv");
    toast({ title: "Products exported", description: `${rows.length} products written to CSV.` });
  };

  const exportReport = () => {
    const totalSkus = products.length;
    const totalUnits = products.reduce((s, p) => s + (p.stock_units ?? 0), 0);
    const retailValue = products.reduce((s, p) => s + (p.stock_units ?? 0) * Number(p.retail_price ?? 0), 0);
    const costValue = products.reduce((s, p) => s + (p.stock_units ?? 0) * Number(p.purchase_cost ?? 0), 0);
    const out = products.filter((p) => (p.stock_units ?? 0) <= 0).length;
    const low = products.filter((p) => (p.stock_units ?? 0) > 0 && (p.stock_units ?? 0) <= (p.min_stock_alert ?? 0)).length;

    const byCat = new Map<string, { skus: number; units: number; value: number }>();
    products.forEach((p) => {
      const key = categoryName(p.category_id) || "Uncategorized";
      const cur = byCat.get(key) ?? { skus: 0, units: 0, value: 0 };
      cur.skus += 1;
      cur.units += p.stock_units ?? 0;
      cur.value += (p.stock_units ?? 0) * Number(p.retail_price ?? 0);
      byCat.set(key, cur);
    });

    const lines: string[][] = [
      ["Inventory Report"],
      ["Business", businessName],
      ["Generated", new Date().toLocaleString()],
      ["Period", range?.from ? `${format(range.from, "PP")} - ${range.to ? format(range.to, "PP") : "now"}` : "All time"],
      [],
      ["Summary"],
      ["Total SKUs", String(totalSkus)],
      ["Total Units In Stock", String(totalUnits)],
      ["Stock Value (Retail)", retailValue.toFixed(2)],
      ["Stock Value (Cost)", costValue.toFixed(2)],
      ["Potential Margin", (retailValue - costValue).toFixed(2)],
      ["Out Of Stock SKUs", String(out)],
      ["Low Stock SKUs", String(low)],
      [],
      ["Category Breakdown"],
      ["Category", "SKUs", "Units", "Retail Value"],
      ...[...byCat.entries()].map(([k, v]) => [k, String(v.skus), String(v.units), v.value.toFixed(2)]),
    ];
    const csv = lines.map((r) => r.map(csvCell).join(",")).join("\n");
    download(csv, `${slug}_inventory_report_${stamp}.csv`, "text/csv");
    toast({ title: "Report exported", description: "Inventory summary report downloaded." });
  };

  const doExport = () => {
    if (type === "report") exportReport();
    else exportProducts();
    onOpenChange(false);
  };

  const OPTIONS: { id: ExportType; icon: typeof FileBarChart2; title: string; desc: string }[] = [
    { id: "report", icon: FileBarChart2, title: "Export Report", desc: "Summary of stock value, alerts and category breakdown." },
    { id: "products", icon: FileSpreadsheet, title: "Export Products (CSV)", desc: "Name, ID, Category, Stock, Price, Discount, Status, Images." },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Inventory</DialogTitle>
          <DialogDescription>Choose what you want to export from this business.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          {OPTIONS.map((o) => {
            const activeOpt = type === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setType(o.id)}
                className={cn(
                  "w-full text-left rounded-xl border p-3 flex items-start gap-3 transition-all",
                  activeOpt ? "border-sky-400 bg-sky-400/10" : "border-border hover:border-sky-400/50"
                )}
              >
                <span className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", activeOpt ? "bg-sky-400 text-white" : "bg-muted text-muted-foreground")}>
                  <o.icon className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-bold">{o.title}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{o.desc}</span>
                </span>
                {activeOpt && <Check className="h-4 w-4 text-sky-500 shrink-0" />}
              </button>
            );
          })}
        </div>

        {type === "products" && (
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input type="checkbox" checked={includeImages} onChange={(e) => setIncludeImages(e.target.checked)} className="h-4 w-4 accent-sky-400" />
            Include Images column (optional)
          </label>
        )}

        <div className="py-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !range && "text-muted-foreground")}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                {range?.from ? (range.to ? `${format(range.from, "PP")} – ${format(range.to, "PP")}` : format(range.from, "PP")) : "Pick a date range (optional)"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={1} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={doExport} className="bg-sky-400 hover:bg-sky-500 text-white font-bold">
            <Download className="h-4 w-4 mr-2" />Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportLedgerDialog;
