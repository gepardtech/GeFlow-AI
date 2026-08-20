import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NormalizedProduct } from "@/lib/importer/types";
import { useMoney } from "@/lib/currency";
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Pencil,
  Sparkles,
  ShieldCheck,
  Tag,
  Layers,
} from "lucide-react";
import { AIConfidenceBadge } from "../AIConfidenceBadge";

interface RowDetailDrawerProps {
  product: NormalizedProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (product: NormalizedProduct) => void;
}

export const RowDetailDrawer = ({
  product,
  open,
  onOpenChange,
  onEdit,
}: RowDetailDrawerProps) => {
  const { format: fmt } = useMoney();

  if (!product) return null;

  const rawEntries = Object.entries(product.raw);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  {product.canonical.name || "Untitled Product"}
                  {product.ai_confidence !== undefined && (
                    <AIConfidenceBadge
                      score={product.ai_confidence}
                      size="sm"
                      showPercentage
                    />
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Spreadsheet Row #{product.rowIndex} • Status:{" "}
                  <span className="font-semibold uppercase">{product.status}</span>
                  {product.ai_normalized && (
                    <span className="ml-2 text-sky-500 font-semibold">• AI Enhanced</span>
                  )}
                </DialogDescription>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onEdit(product);
              }}
              className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold"
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit Row
            </Button>
          </div>
        </DialogHeader>

        {/* Validation issues */}
        {product.errors.length > 0 && (
          <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> Validation Errors:
            </p>
            <ul className="list-disc list-inside space-y-0.5 opacity-90 pl-1">
              {product.errors.map((e, idx) => (
                <li key={idx}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {product.warnings.length > 0 && (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Warnings & Review Notes:
            </p>
            <ul className="list-disc list-inside space-y-0.5 opacity-90 pl-1">
              {product.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Side by side comparison: Original vs GeFlow Converted */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Original Uploaded Data */}
          <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Original Uploaded Data
              </span>
              <span className="text-[10px] text-muted-foreground">{rawEntries.length} columns</span>
            </div>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {rawEntries.map(([k, v]) => (
                <div key={k} className="text-xs">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {k}
                  </p>
                  <p className="font-mono text-xs text-foreground bg-background/80 p-1.5 rounded-lg border border-border mt-0.5 break-all">
                    {v || <span className="text-muted-foreground italic">—</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* GeFlow Converted Canonical Data */}
          <div className="p-4 rounded-2xl bg-sky-500/5 border border-sky-500/20 space-y-3">
            <div className="flex items-center justify-between border-b border-sky-500/20 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-500 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> GeFlow Canonical Product
              </span>
              <span className="text-[10px] font-semibold text-emerald-500">Normalized</span>
            </div>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 text-xs">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Product Name</p>
                <p className="font-bold text-sm text-foreground">{product.canonical.name || "—"}</p>
                {product.canonical.original_name && product.canonical.original_name !== product.canonical.name && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Original in sheet: <span className="italic">{product.canonical.original_name}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">SKU</p>
                  <p className="font-mono text-xs">{product.canonical.internal_sku || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Global BarCode</p>
                  <p className="font-mono text-xs">{product.canonical.barcode || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Category</p>
                  <p className="text-xs font-medium">{product.canonical.category_name || "Unassigned"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Subcategory</p>
                  <p className="text-xs">{product.canonical.subcategory_name || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-background/60 p-2 rounded-xl border border-border/50">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Base UOM</p>
                  <p className="text-xs font-bold text-foreground capitalize">{product.canonical.stock_unit || "piece"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Packaging</p>
                  <p className="text-xs">{product.canonical.package_type || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Pack Size</p>
                  <p className="text-xs">{product.canonical.pack_size ? `${product.canonical.pack_size} units` : "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Strength / Formulation</p>
                  <p className="text-xs">{product.canonical.strength || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Brand / Manufacturer</p>
                  <p className="text-xs">{product.canonical.brand || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Purchase Cost</p>
                  <p className="font-bold text-xs">{fmt(product.canonical.purchase_cost)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Retail Price</p>
                  <p className="font-bold text-xs text-sky-500">{fmt(product.canonical.retail_price)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Discount</p>
                  <p className="text-xs">{product.canonical.discount_price ? fmt(product.canonical.discount_price) : "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Stock Units</p>
                  <p className="font-bold text-sm">{product.canonical.stock_units}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Min Stock Alert</p>
                  <p className="text-xs">{product.canonical.min_stock_alert}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Batch Number</p>
                  <p className="font-mono text-xs">{product.canonical.batch_number || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Expiry Date</p>
                  <p className="font-mono text-xs">{product.canonical.expiry_date || "—"}</p>
                </div>
              </div>

              {product.canonical.images && product.canonical.images.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Images ({product.canonical.images.length})</p>
                  <div className="flex gap-2 overflow-x-auto">
                    {product.canonical.images.map((img, i) => (
                      <img key={i} src={img} alt="" className="w-12 h-12 object-cover rounded-lg border border-border" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
