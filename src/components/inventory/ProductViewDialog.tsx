import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMoney } from "@/lib/currency";
import type { ProductRecord } from "./ProductDialog";
import { Package, Boxes, Scale } from "lucide-react";
import { computeProductStock } from "@/lib/uomRegistry";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: ProductRecord | null;
  categoryName?: string | null;
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
    <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">{label}</span>
    <span className="text-sm font-semibold text-right">{value ?? "—"}</span>
  </div>
);

const ProductViewDialog = ({ open, onOpenChange, product, categoryName }: Props) => {
  const { format: fmt } = useMoney();
  if (!product) return null;

  const stockInfo = computeProductStock(
    product.stock_units,
    product.name,
    product.description,
    product.uom,
    product.units_per_uom,
    product.base_unit
  );

  const out = stockInfo.totalSubUnits <= 0;
  const low = !out && stockInfo.listingStock <= product.min_stock_alert;

  // Clean description of any legacy or system bracket tags
  const cleanDescription = product.description
    ? product.description
        .replace(/\[(?:UOM|SCALE|UNITS_PER_UOM|PACK_SIZE|PACK|VOLUME|BASE_UNIT|SUB_UNIT|PACK_QTY|BASE_QTY):\s*[^\]]+\]/gi, "")
        .trim()
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-background text-foreground border-border">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">{product.name}</DialogTitle>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <Boxes className="w-3 h-3" />
                  Unit: {stockInfo.uomLabel}
                </span>
                {stockInfo.packSize > 1 && (
                  <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Scale className="w-3 h-3" />
                    {stockInfo.packSize} {stockInfo.subUnitName}s/{stockInfo.uomLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {product.images && product.images.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-2">
            {product.images.map((u, i) => (
              <img
                key={i}
                src={u}
                alt=""
                className="h-16 w-16 rounded-lg object-cover border border-border"
              />
            ))}
          </div>
        )}

        <div>
          <Row label="SKU" value={product.internal_sku} />
          <Row label="Category" value={categoryName} />
          <Row label="Selling Unit (UOM)" value={stockInfo.uomLabel} />
          {stockInfo.packSize > 1 && (
            <>
              <Row label="Units Per Pack" value={`${stockInfo.packSize} ${stockInfo.subUnitName}s per ${stockInfo.uomLabel}`} />
              <Row label="Base / Smallest Unit" value={stockInfo.subUnitName} />
            </>
          )}
          <Row label="Description / Notes" value={cleanDescription || "—"} />
          <Row label={`Purchase Cost (per ${stockInfo.uomLabel})`} value={fmt(Number(product.purchase_cost))} />
          <Row label={`Retail Price (per ${stockInfo.uomLabel})`} value={fmt(Number(product.retail_price))} />
          {stockInfo.packSize > 1 && (
            <Row
              label={`Single ${stockInfo.subUnitName} Price`}
              value={`~${fmt(Number(product.retail_price) / stockInfo.packSize)}`}
            />
          )}
          <Row
            label="Discount Price"
            value={product.discount_price != null ? fmt(Number(product.discount_price)) : "—"}
          />
          <Row
            label="Stock on Hand"
            value={
              <div className="flex flex-col items-end">
                <span className={out ? "text-rose-500 font-bold" : low ? "text-amber-500 font-bold" : "text-emerald-600 font-bold"}>
                  {stockInfo.displayText}
                </span>
                {stockInfo.packSize > 1 && (
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {stockInfo.totalSubUnits} {stockInfo.subUnitName.toLowerCase()}s (Saved as Base Units)
                  </span>
                )}
              </div>
            }
          />
          <Row label="Min Stock Alert" value={product.min_stock_alert} />
          <Row label="Batch Number" value={product.batch_number} />
          <Row label="Expiry Date" value={product.expiry_date} />
          <Row label="Barcode" value={product.barcode} />
          <Row
            label="Status"
            value={<span className="uppercase text-xs font-bold">{product.status}</span>}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductViewDialog;
