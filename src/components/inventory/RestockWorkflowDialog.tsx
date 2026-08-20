import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ProductRecord } from "./ProductDialog";
import { useMoney } from "@/lib/currency";
import { AlertTriangle, XCircle, FileEdit, PackageX, Sparkles, TrendingDown } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: ProductRecord[];
  onFix: (product: ProductRecord) => void;
}

const RestockWorkflowDialog = ({ open, onOpenChange, products, onFix }: Props) => {
  const { format: fmt } = useMoney();
  const out = products.filter((p) => p.stock_units <= 0);
  const low = products.filter((p) => p.stock_units > 0 && p.stock_units <= p.min_stock_alert);
  const drafts = products.filter((p) => p.status !== "active");
  const lostRevenue = out.reduce((s, p) => s + Number(p.retail_price), 0);

  const sections = [
    { key: "out", title: "Critical Stockouts", icon: XCircle, color: "text-rose-500 bg-rose-500/10", items: out, note: "Restock now — these are unsellable." },
    { key: "low", title: "Breached Safety Thresholds", icon: TrendingDown, color: "text-amber-500 bg-amber-500/10", items: low, note: "Approaching stockout — reorder soon." },
    { key: "draft", title: "Not Published / Draft", icon: FileEdit, color: "text-sky-500 bg-sky-500/10", items: drafts, note: "Publish to make these sellable in POS." },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-400/15 text-sky-500 flex items-center justify-center"><Sparkles className="h-5 w-5" /></div>
            <div>
              <DialogTitle>Restock Workflow</DialogTitle>
              <DialogDescription>AI-powered analysis of your inventory health.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-xl bg-muted/40 border border-border p-4 mb-2">
          <p className="text-sm">
            {out.length + low.length === 0 && drafts.length === 0
              ? "All clear — no inventory issues detected. Your catalog is healthy."
              : `Detected ${out.length} stockout${out.length !== 1 ? "s" : ""}, ${low.length} low-stock item${low.length !== 1 ? "s" : ""} and ${drafts.length} unpublished product${drafts.length !== 1 ? "s" : ""}.`}
          </p>
          {lostRevenue > 0 && <p className="text-xs text-rose-500 font-semibold mt-1">Est. revenue at risk from stockouts: {fmt(lostRevenue)}</p>}
        </div>

        <div className="space-y-4">
          {sections.filter((s) => s.items.length > 0).map((s) => (
            <div key={s.key}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${s.color}`}><s.icon className="h-4 w-4" /></div>
                <p className="text-sm font-bold">{s.title} <span className="text-muted-foreground font-normal">· {s.items.length}</span></p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{s.note}</p>
              <div className="space-y-1.5">
                {s.items.slice(0, 6).map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground tracking-wider">{p.internal_sku || "—"} · stock {p.stock_units}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => onFix(p)}>Fix</Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {out.length + low.length === 0 && drafts.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <PackageX className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nothing to restock right now.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RestockWorkflowDialog;
