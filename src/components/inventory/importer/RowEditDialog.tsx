import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NormalizedProduct } from "@/lib/importer/types";
import { ProductCategory } from "@/hooks/useProductCategories";
import { getAllowedUomsForIndustry, isUomAllowedForIndustry } from "@/lib/importer/uomCatalog";
import {
  Sparkles,
  FileText,
  User,
  AlertTriangle,
  CheckCircle2,
  Package,
} from "lucide-react";
import { AIConfidenceBadge } from "../AIConfidenceBadge";

interface RowEditDialogProps {
  product: NormalizedProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ProductCategory[];
  industryType?: string | null;
  onSave: (updated: NormalizedProduct) => void;
}

export const RowEditDialog = ({
  product,
  open,
  onOpenChange,
  categories,
  industryType,
  onSave,
}: RowEditDialogProps) => {
  const [form, setForm] = useState({
    name: "",
    internal_sku: "",
    category_id: "",
    subcategory_id: "",
    stock_unit: "piece",
    package_type: "",
    pack_size: "",
    strength: "",
    brand: "",
    purchase_cost: "",
    retail_price: "",
    discount_price: "",
    stock_units: "",
    min_stock_alert: "10",
    batch_number: "",
    expiry_date: "",
    barcode: "",
    status: "active" as "active" | "draft" | "archived",
  });

  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!product) return;
    setForm({
      name: product.canonical.name || "",
      internal_sku: product.canonical.internal_sku || "",
      category_id: product.canonical.category_id || "",
      subcategory_id: product.canonical.subcategory_id || "",
      stock_unit: product.canonical.stock_unit || "piece",
      package_type: product.canonical.package_type || "",
      pack_size: product.canonical.pack_size ? String(product.canonical.pack_size) : "",
      strength: product.canonical.strength || "",
      brand: product.canonical.brand || "",
      purchase_cost: String(product.canonical.purchase_cost ?? "0"),
      retail_price: String(product.canonical.retail_price ?? "0"),
      discount_price: product.canonical.discount_price ? String(product.canonical.discount_price) : "",
      stock_units: String(product.canonical.stock_units ?? "0"),
      min_stock_alert: String(product.canonical.min_stock_alert ?? "10"),
      batch_number: product.canonical.batch_number || "",
      expiry_date: product.canonical.expiry_date || "",
      barcode: product.canonical.barcode || "",
      status: product.canonical.status || "active",
    });
    setModifiedFields(new Set());
  }, [product]);

  if (!product) return null;

  const parents = categories.filter((c) => !c.parent_id);
  const subcategories = categories.filter((c) => c.parent_id === form.category_id);
  const allowedUoms = getAllowedUomsForIndustry(industryType);
  const isCurrentUomAllowed = isUomAllowedForIndustry(form.stock_unit, industryType);

  const markModified = (fieldKey: string) => {
    setModifiedFields((prev) => new Set(prev).add(fieldKey));
  };

  /**
   * Helper to compute field-level AI origin tag
   */
  const getFieldOrigin = (fieldKey: string, rawKey?: string) => {
    if (modifiedFields.has(fieldKey)) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[9px] font-semibold rounded bg-sky-500/10 text-sky-600">
          <User className="w-2.5 h-2.5" /> User Modified
        </span>
      );
    }

    const hasRaw = rawKey && product.raw && (product.raw as any)[rawKey] && (product.raw as any)[rawKey].trim() !== "";
    if (product.ai_normalized && (!hasRaw || fieldKey === "category_id" || fieldKey === "strength" || fieldKey === "package_type")) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[9px] font-semibold rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
          <Sparkles className="w-2.5 h-2.5" /> ✨ AI Detected
        </span>
      );
    }

    if (hasRaw) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[9px] font-semibold rounded bg-muted text-muted-foreground">
          <FileText className="w-2.5 h-2.5" /> 📄 Spreadsheet
        </span>
      );
    }

    return null;
  };

  const handleSave = () => {
    const cleanName = form.name.trim();
    const selectedCat = categories.find((c) => c.id === form.category_id);
    const selectedSub = categories.find((c) => c.id === form.subcategory_id);

    const updatedCanonical = {
      ...product.canonical,
      name: cleanName,
      internal_sku: form.internal_sku.trim() || null,
      category_id: form.category_id || null,
      category_name: selectedCat?.name || null,
      subcategory_id: form.subcategory_id || null,
      subcategory_name: selectedSub?.name || null,
      stock_unit: form.stock_unit.trim().toLowerCase() || "piece",
      package_type: form.package_type.trim() || null,
      pack_size: form.pack_size ? parseInt(form.pack_size, 10) || null : null,
      strength: form.strength.trim() || null,
      brand: form.brand.trim() || null,
      purchase_cost: Number(form.purchase_cost) || 0,
      retail_price: Number(form.retail_price) || 0,
      discount_price: form.discount_price ? Number(form.discount_price) : null,
      stock_units: parseInt(form.stock_units, 10) || 0,
      min_stock_alert: parseInt(form.min_stock_alert, 10) || 10,
      batch_number: form.batch_number.trim() || null,
      expiry_date: form.expiry_date.trim() || null,
      barcode: form.barcode.trim() || null,
      status: form.status,
    };

    const errors: string[] = [];
    if (!cleanName) errors.push("Product Name is required");
    if (updatedCanonical.retail_price < 0) errors.push("Retail price cannot be negative");
    if (updatedCanonical.purchase_cost < 0) errors.push("Purchase price cannot be negative");

    const warnings: string[] = [];
    if (!updatedCanonical.category_id) {
      warnings.push("Category is unassigned");
    }
    if (!isUomAllowedForIndustry(updatedCanonical.stock_unit, industryType)) {
      warnings.push(`UOM "${updatedCanonical.stock_unit}" is not in the allowed business units catalog`);
    }

    const newStatus = errors.length > 0 ? "error" : warnings.length > 0 ? "review" : "ready";

    onSave({
      ...product,
      canonical: updatedCanonical,
      status: newStatus,
      errors,
      warnings,
      selected: newStatus !== "error",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-xl">
        <DialogHeader className="p-5 border-b border-border flex-shrink-0 bg-muted/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  Review Row #{product.rowIndex}
                  {product.confidence?.overall !== undefined && (
                    <AIConfidenceBadge score={product.confidence.overall} size="sm" showPercentage />
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Inspect provenance, field-level origin, and verify candidate product values before import.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 p-5 overflow-y-auto max-h-[62vh] text-xs">
          {/* Row 1: Product Name */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">
                Product Name <span className="text-rose-500">*</span>
              </Label>
              {getFieldOrigin("name", "Product Name")}
            </div>
            <Input
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                markModified("name");
              }}
              placeholder="e.g. Paracetamol 500mg Tablets"
              className="h-9 text-xs rounded-xl"
            />
          </div>

          {/* Row 2: SKU & Barcode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Internal SKU</Label>
                {getFieldOrigin("internal_sku", "SKU")}
              </div>
              <Input
                value={form.internal_sku}
                onChange={(e) => {
                  setForm({ ...form, internal_sku: e.target.value });
                  markModified("internal_sku");
                }}
                placeholder="e.g. SKU-10023"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Barcode / UPC / EAN</Label>
                {getFieldOrigin("barcode", "Barcode")}
              </div>
              <Input
                value={form.barcode}
                onChange={(e) => {
                  setForm({ ...form, barcode: e.target.value });
                  markModified("barcode");
                }}
                placeholder="e.g. 8901234567890"
                className="h-9 text-xs rounded-xl font-mono"
              />
            </div>
          </div>

          {/* Row 3: Category & Subcategory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Primary Category</Label>
                {getFieldOrigin("category_id")}
              </div>
              <Select
                value={form.category_id}
                onValueChange={(val) => {
                  setForm({ ...form, category_id: val, subcategory_id: "" });
                  markModified("category_id");
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {parents.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} className="text-xs">
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Subcategory</Label>
                {getFieldOrigin("subcategory_id")}
              </div>
              <Select
                value={form.subcategory_id}
                onValueChange={(val) => {
                  setForm({ ...form, subcategory_id: val });
                  markModified("subcategory_id");
                }}
                disabled={!form.category_id || subcategories.length === 0}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder={subcategories.length === 0 ? "No Subcategories" : "Select Subcategory"} />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id} className="text-xs">
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 4: UOM & Packaging */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Stock UOM</Label>
                {getFieldOrigin("stock_unit")}
              </div>
              <Select
                value={form.stock_unit}
                onValueChange={(val) => {
                  setForm({ ...form, stock_unit: val });
                  markModified("stock_unit");
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedUoms.map((uom) => (
                    <SelectItem key={uom} value={uom} className="text-xs capitalize">
                      {uom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Packaging Type</Label>
                {getFieldOrigin("package_type")}
              </div>
              <Input
                value={form.package_type}
                onChange={(e) => {
                  setForm({ ...form, package_type: e.target.value });
                  markModified("package_type");
                }}
                placeholder="e.g. Blister Pack"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Pack Size</Label>
                {getFieldOrigin("pack_size")}
              </div>
              <Input
                type="number"
                value={form.pack_size}
                onChange={(e) => {
                  setForm({ ...form, pack_size: e.target.value });
                  markModified("pack_size");
                }}
                placeholder="e.g. 10"
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Row 5: Pricing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Purchase Cost</Label>
                {getFieldOrigin("purchase_cost", "Purchase Price")}
              </div>
              <Input
                type="number"
                step="0.01"
                value={form.purchase_cost}
                onChange={(e) => {
                  setForm({ ...form, purchase_cost: e.target.value });
                  markModified("purchase_cost");
                }}
                placeholder="0.00"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Retail Price</Label>
                {getFieldOrigin("retail_price", "Retail Price")}
              </div>
              <Input
                type="number"
                step="0.01"
                value={form.retail_price}
                onChange={(e) => {
                  setForm({ ...form, retail_price: e.target.value });
                  markModified("retail_price");
                }}
                placeholder="0.00"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Discount Price</Label>
                {getFieldOrigin("discount_price", "Discount")}
              </div>
              <Input
                type="number"
                step="0.01"
                value={form.discount_price}
                onChange={(e) => {
                  setForm({ ...form, discount_price: e.target.value });
                  markModified("discount_price");
                }}
                placeholder="0.00"
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Row 6: Stock & Alert */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Stock Units</Label>
                {getFieldOrigin("stock_units", "Stock Units")}
              </div>
              <Input
                type="number"
                value={form.stock_units}
                onChange={(e) => {
                  setForm({ ...form, stock_units: e.target.value });
                  markModified("stock_units");
                }}
                placeholder="0"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Min Stock Alert</Label>
                {getFieldOrigin("min_stock_alert", "Min Stock Alert")}
              </div>
              <Input
                type="number"
                value={form.min_stock_alert}
                onChange={(e) => {
                  setForm({ ...form, min_stock_alert: e.target.value });
                  markModified("min_stock_alert");
                }}
                placeholder="10"
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Row 7: Strength & Brand */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Strength / Formulation</Label>
                {getFieldOrigin("strength")}
              </div>
              <Input
                value={form.strength}
                onChange={(e) => {
                  setForm({ ...form, strength: e.target.value });
                  markModified("strength");
                }}
                placeholder="e.g. 500mg"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Brand / Manufacturer</Label>
                {getFieldOrigin("brand")}
              </div>
              <Input
                value={form.brand}
                onChange={(e) => {
                  setForm({ ...form, brand: e.target.value });
                  markModified("brand");
                }}
                placeholder="e.g. GlaxoSmithKline"
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Row 8: Batch & Expiry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Batch Number</Label>
                {getFieldOrigin("batch_number", "Batch Number")}
              </div>
              <Input
                value={form.batch_number}
                onChange={(e) => {
                  setForm({ ...form, batch_number: e.target.value });
                  markModified("batch_number");
                }}
                placeholder="e.g. BATCH-2025"
                className="h-9 text-xs rounded-xl font-mono"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Expiry Date (YYYY-MM-DD)</Label>
                {getFieldOrigin("expiry_date", "Expiry Date")}
              </div>
              <Input
                type="date"
                value={form.expiry_date}
                onChange={(e) => {
                  setForm({ ...form, expiry_date: e.target.value });
                  markModified("expiry_date");
                }}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/20 border-t border-border flex-shrink-0 flex items-center justify-end gap-2.5">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl text-xs font-semibold">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs px-6 shadow-sm"
          >
            Save & Update Row
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
export default RowEditDialog;
