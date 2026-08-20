import { useState } from "react";
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
import { ProductCategory } from "@/hooks/useProductCategories";
import { NormalizedProduct } from "@/lib/importer/types";
import { getAllowedUomsForIndustry } from "@/lib/importer/uomCatalog";
import { Edit3, Sparkles, Tag, Package, AlertCircle } from "lucide-react";

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProducts: NormalizedProduct[];
  categories: ProductCategory[];
  industryType?: string | null;
  onApply: (updates: {
    category_id?: string | null;
    category_name?: string | null;
    subcategory_id?: string | null;
    subcategory_name?: string | null;
    stock_unit?: string | null;
    package_type?: string | null;
    status?: "active" | "draft" | "archived" | null;
    min_stock_alert?: number | null;
  }) => void;
}

export const BulkEditDialog = ({
  open,
  onOpenChange,
  selectedProducts,
  categories,
  industryType,
  onApply,
}: BulkEditDialogProps) => {
  const [enableCategory, setEnableCategory] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>("");

  const [enableUom, setEnableUom] = useState(false);
  const [selectedUom, setSelectedUom] = useState<string>("");

  const [enablePackaging, setEnablePackaging] = useState(false);
  const [packagingType, setPackagingType] = useState<string>("");

  const [enableStatus, setEnableStatus] = useState(false);
  const [productStatus, setProductStatus] = useState<"active" | "draft" | "archived">("active");

  const [enableMinAlert, setEnableMinAlert] = useState(false);
  const [minAlertValue, setMinAlertValue] = useState<string>("10");

  const parentCategories = categories.filter((c) => !c.parent_id);
  const subcategories = categories.filter((c) => c.parent_id === selectedCategoryId);
  const allowedUoms = getAllowedUomsForIndustry(industryType);

  const handleApply = () => {
    const updates: {
      category_id?: string | null;
      category_name?: string | null;
      subcategory_id?: string | null;
      subcategory_name?: string | null;
      stock_unit?: string | null;
      package_type?: string | null;
      status?: "active" | "draft" | "archived" | null;
      min_stock_alert?: number | null;
    } = {};

    if (enableCategory && selectedCategoryId) {
      const cat = categories.find((c) => c.id === selectedCategoryId);
      const sub = categories.find((c) => c.id === selectedSubcategoryId);
      updates.category_id = selectedCategoryId;
      updates.category_name = cat?.name || null;
      updates.subcategory_id = selectedSubcategoryId || null;
      updates.subcategory_name = sub?.name || null;
    }

    if (enableUom && selectedUom) {
      updates.stock_unit = selectedUom.toLowerCase().trim();
    }

    if (enablePackaging && packagingType.trim()) {
      updates.package_type = packagingType.trim();
    }

    if (enableStatus) {
      updates.status = productStatus;
    }

    if (enableMinAlert && minAlertValue) {
      updates.min_stock_alert = parseInt(minAlertValue, 10) || 10;
    }

    onApply(updates);
    onOpenChange(false);
  };

  const hasAnySelected =
    (enableCategory && !!selectedCategoryId) ||
    (enableUom && !!selectedUom) ||
    (enablePackaging && !!packagingType.trim()) ||
    enableStatus ||
    (enableMinAlert && !!minAlertValue);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <DialogTitle className="text-base sm:text-lg font-bold">
              Bulk Edit ({selectedProducts.length} Products)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Apply changes across all selected products. Only checked attributes will be updated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3 text-xs">
          {/* Section 1: Category */}
          <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-foreground flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableCategory}
                  onChange={(e) => setEnableCategory(e.target.checked)}
                  className="rounded text-sky-500"
                />
                Update Category & Subcategory
              </label>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                Admin Verified
              </span>
            </div>

            {enableCategory && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Primary Category</Label>
                  <Select
                    value={selectedCategoryId}
                    onValueChange={(val) => {
                      setSelectedCategoryId(val);
                      setSelectedSubcategoryId("");
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {parentCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Subcategory</Label>
                  <Select
                    value={selectedSubcategoryId}
                    onValueChange={setSelectedSubcategoryId}
                    disabled={!selectedCategoryId || subcategories.length === 0}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue
                        placeholder={
                          subcategories.length === 0 ? "No Subcategories" : "Select Subcategory"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Base Unit of Measure (UOM) */}
          <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-foreground flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableUom}
                  onChange={(e) => setEnableUom(e.target.checked)}
                  className="rounded text-sky-500"
                />
                Update Base Unit of Measure (UOM)
              </label>
              <span className="text-[10px] text-emerald-600 font-semibold uppercase">
                Allowed Catalog
              </span>
            </div>

            {enableUom && (
              <div className="pt-1">
                <Select value={selectedUom} onValueChange={setSelectedUom}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Select Allowed Unit" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {allowedUoms.map((u) => (
                      <SelectItem key={u} value={u} className="text-xs capitalize">
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Section 3: Packaging Type */}
          <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-foreground flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enablePackaging}
                  onChange={(e) => setEnablePackaging(e.target.checked)}
                  className="rounded text-sky-500"
                />
                Update Packaging Type
              </label>
            </div>

            {enablePackaging && (
              <div className="pt-1">
                <Input
                  value={packagingType}
                  onChange={(e) => setPackagingType(e.target.value)}
                  placeholder="e.g. Box, Strip, Bottle, Carton, Pack"
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            )}
          </div>

          {/* Section 4: Min Stock Alert & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2">
              <label className="font-bold text-foreground flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableStatus}
                  onChange={(e) => setEnableStatus(e.target.checked)}
                  className="rounded text-sky-500"
                />
                Product Status
              </label>
              {enableStatus && (
                <Select
                  value={productStatus}
                  onValueChange={(val: any) => setProductStatus(val)}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active" className="text-xs">
                      Active
                    </SelectItem>
                    <SelectItem value="draft" className="text-xs">
                      Draft
                    </SelectItem>
                    <SelectItem value="archived" className="text-xs">
                      Archived
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2">
              <label className="font-bold text-foreground flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableMinAlert}
                  onChange={(e) => setEnableMinAlert(e.target.checked)}
                  className="rounded text-sky-500"
                />
                Min Stock Alert Limit
              </label>
              {enableMinAlert && (
                <Input
                  type="number"
                  value={minAlertValue}
                  onChange={(e) => setMinAlertValue(e.target.value)}
                  placeholder="10"
                  className="h-9 text-xs rounded-xl"
                />
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!hasAnySelected}
            className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs px-5"
          >
            Apply to {selectedProducts.length} Products
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
export default BulkEditDialog;
