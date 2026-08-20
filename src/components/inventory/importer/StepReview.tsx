import { useState, useMemo } from "react";
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Edit2,
  Trash2,
  Eye,
  Info,
  Check,
  Package,
  Layers,
  ArrowUpDown,
  Tag,
  ShieldCheck,
  Edit3,
  CheckSquare,
  Square,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  NormalizedProduct,
  RowStatus,
  DuplicateAction,
} from "@/lib/importer/types";
import { ProductCategory } from "@/hooks/useProductCategories";
import { RowEditDialog } from "./RowEditDialog";
import { RowDetailDrawer } from "./RowDetailDrawer";
import { BulkEditDialog } from "./BulkEditDialog";
import { useMoney } from "@/lib/currency";
import { AIConfidenceBadge } from "../AIConfidenceBadge";
import { getAllowedUomsForIndustry, isUomAllowedForIndustry } from "@/lib/importer/uomCatalog";

interface StepReviewProps {
  products: NormalizedProduct[];
  categories: ProductCategory[];
  industryType?: string | null;
  onProductsChange: (updated: NormalizedProduct[]) => void;
  onBack: () => void;
  onStartImport: (approvedProducts: NormalizedProduct[]) => void;
}

type FilterTab = "all" | "ready" | "review" | "duplicate" | "error" | "skipped";

export const StepReview = ({
  products,
  categories,
  industryType,
  onProductsChange,
  onBack,
  onStartImport,
}: StepReviewProps) => {
  const { format: fmt } = useMoney();

  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  // Inspection Drawer, Edit Dialog, Bulk Edit state
  const [inspectingRow, setInspectingRow] = useState<NormalizedProduct | null>(null);
  const [editingRow, setEditingRow] = useState<NormalizedProduct | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  // Final Confirmation Modal
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Compute category lookup
  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories]
  );
  const allowedUoms = useMemo(
    () => getAllowedUomsForIndustry(industryType),
    [industryType]
  );

  // Status counts (Dynamic counters)
  const total = products.length;
  const readyCount = useMemo(() => products.filter((p) => p.status === "ready").length, [products]);
  const reviewCount = useMemo(() => products.filter((p) => p.status === "review").length, [products]);
  const duplicateCount = useMemo(() => products.filter((p) => p.status === "duplicate").length, [products]);
  const errorCount = useMemo(() => products.filter((p) => p.status === "error").length, [products]);
  const skippedCount = useMemo(() => products.filter((p) => p.status === "skipped").length, [products]);
  const selectedProducts = useMemo(() => products.filter((p) => p.selected && p.status !== "skipped"), [products]);
  const selectedCount = selectedProducts.length;
  const aiNormalizedCount = useMemo(() => products.filter((p) => p.ai_normalized).length, [products]);

  // Filtered rows
  const displayedRows = useMemo(() => {
    return products.filter((p) => {
      // Tab filter
      if (filterTab === "ready" && p.status !== "ready") return false;
      if (filterTab === "review" && p.status !== "review") return false;
      if (filterTab === "duplicate" && p.status !== "duplicate") return false;
      if (filterTab === "error" && p.status !== "error") return false;
      if (filterTab === "skipped" && p.status !== "skipped") return false;

      // Category filter
      if (selectedCategoryFilter !== "all") {
        if (selectedCategoryFilter === "unassigned") {
          if (p.canonical.category_id) return false;
        } else if (p.canonical.category_id !== selectedCategoryFilter) {
          return false;
        }
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = (p.canonical.name || "").toLowerCase();
        const origName = (p.canonical.original_name || "").toLowerCase();
        const sku = (p.canonical.internal_sku || "").toLowerCase();
        const barcode = (p.canonical.barcode || "").toLowerCase();
        const cat = (p.canonical.category_name || "").toLowerCase();
        const uom = (p.canonical.stock_unit || "").toLowerCase();
        const brand = (p.canonical.brand || "").toLowerCase();

        return (
          name.includes(q) ||
          origName.includes(q) ||
          sku.includes(q) ||
          barcode.includes(q) ||
          cat.includes(q) ||
          uom.includes(q) ||
          brand.includes(q)
        );
      }

      return true;
    });
  }, [products, filterTab, selectedCategoryFilter, search]);

  // Selection handlers
  const allDisplayedSelected =
    displayedRows.length > 0 &&
    displayedRows.every((p) => p.selected || p.status === "error");

  const toggleSelectAll = () => {
    if (allDisplayedSelected) {
      // Deselect displayed
      const displayedIds = new Set(displayedRows.map((p) => p.id));
      onProductsChange(
        products.map((p) => (displayedIds.has(p.id) ? { ...p, selected: false } : p))
      );
    } else {
      // Select displayed (except errors)
      const displayedIds = new Set(displayedRows.map((p) => p.id));
      onProductsChange(
        products.map((p) =>
          displayedIds.has(p.id)
            ? { ...p, selected: p.status !== "error" }
            : p
        )
      );
    }
  };

  const handleSelectReady = () => {
    onProductsChange(
      products.map((p) => ({
        ...p,
        selected: p.status === "ready",
      }))
    );
  };

  const handleSelectReview = () => {
    onProductsChange(
      products.map((p) => ({
        ...p,
        selected: p.status === "review",
      }))
    );
  };

  const handleDeselectAll = () => {
    onProductsChange(
      products.map((p) => ({
        ...p,
        selected: false,
      }))
    );
  };

  const toggleRowSelect = (id: string) => {
    onProductsChange(
      products.map((p) =>
        p.id === id ? { ...p, selected: !p.selected } : p
      )
    );
  };

  // Row update handlers
  const handleSaveRow = (updated: NormalizedProduct) => {
    onProductsChange(
      products.map((p) => (p.id === updated.id ? updated : p))
    );
  };

  const handleQuickAssignCategory = (productId: string, categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    onProductsChange(
      products.map((p) => {
        if (p.id !== productId) return p;
        const newCanonical = {
          ...p.canonical,
          category_id: categoryId,
          category_name: cat?.name || null,
          subcategory_id: null,
          subcategory_name: null,
        };
        const warnings = p.warnings.filter((w) => !w.toLowerCase().includes("category"));
        const newStatus: RowStatus =
          p.errors.length > 0 ? "error" : warnings.length > 0 ? "review" : "ready";

        return {
          ...p,
          canonical: newCanonical,
          warnings,
          status: newStatus,
          selected: newStatus !== "error",
        };
      })
    );
  };

  const handleQuickAssignUom = (productId: string, uom: string) => {
    onProductsChange(
      products.map((p) => {
        if (p.id !== productId) return p;
        const newCanonical = {
          ...p.canonical,
          stock_unit: uom.toLowerCase().trim(),
        };
        const warnings = p.warnings.filter((w) => !w.toLowerCase().includes("uom"));
        const newStatus: RowStatus =
          p.errors.length > 0 ? "error" : warnings.length > 0 ? "review" : "ready";

        return {
          ...p,
          canonical: newCanonical,
          warnings,
          status: newStatus,
          selected: newStatus !== "error",
        };
      })
    );
  };

  const handleSetDuplicateAction = (productId: string, action: DuplicateAction) => {
    onProductsChange(
      products.map((p) => {
        if (p.id !== productId) return p;
        return {
          ...p,
          duplicateAction: action,
          status: action === "skip" ? "skipped" : "ready",
          selected: action !== "skip",
        };
      })
    );
  };

  const handleBulkDuplicateAction = (action: DuplicateAction) => {
    onProductsChange(
      products.map((p) => {
        if (p.status !== "duplicate" && !p.existingProductId) return p;
        return {
          ...p,
          duplicateAction: action,
          status: action === "skip" ? "skipped" : "ready",
          selected: action !== "skip",
        };
      })
    );
  };

  const handleApplyBulkEdit = (updates: any) => {
    const selectedIds = new Set(selectedProducts.map((p) => p.id));
    onProductsChange(
      products.map((p) => {
        if (!selectedIds.has(p.id)) return p;

        const newCanonical = {
          ...p.canonical,
          ...(updates.category_id !== undefined && {
            category_id: updates.category_id,
            category_name: updates.category_name,
            subcategory_id: updates.subcategory_id,
            subcategory_name: updates.subcategory_name,
          }),
          ...(updates.stock_unit !== undefined && { stock_unit: updates.stock_unit }),
          ...(updates.package_type !== undefined && { package_type: updates.package_type }),
          ...(updates.status !== undefined && updates.status && { status: updates.status }),
          ...(updates.min_stock_alert !== undefined && updates.min_stock_alert && { min_stock_alert: updates.min_stock_alert }),
        };

        // Recalculate status
        const errors = [...p.errors];
        const warnings: string[] = [];
        if (!newCanonical.category_id) warnings.push("Category is unassigned");
        if (!isUomAllowedForIndustry(newCanonical.stock_unit, industryType)) {
          warnings.push(`UOM "${newCanonical.stock_unit}" is not in the allowed catalog`);
        }

        const newStatus: RowStatus =
          errors.length > 0 ? "error" : warnings.length > 0 ? "review" : "ready";

        return {
          ...p,
          canonical: newCanonical,
          errors,
          warnings,
          status: newStatus,
          selected: newStatus !== "error",
        };
      })
    );
  };

  // Status Badge Component
  const renderStatusBadge = (p: NormalizedProduct) => {
    switch (p.status) {
      case "ready":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready
          </span>
        );
      case "review":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Review
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> Error
          </span>
        );
      case "duplicate":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <Layers className="w-3.5 h-3.5" /> Duplicate
          </span>
        );
      case "skipped":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full bg-muted text-muted-foreground border border-border">
            Skipped
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Dynamic Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Review Products Before Import
            </h2>
            {aiNormalizedCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> {aiNormalizedCount} AI Enhanced
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {total} products analyzed. {readyCount} ready to import, {reviewCount} require review
            {errorCount > 0 ? `, ${errorCount} errors` : ""}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack} className="rounded-xl text-xs gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Mapping
          </Button>

          <Button
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={selectedCount === 0}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirm & Import ({selectedCount})
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Total Products */}
        <button
          type="button"
          onClick={() => setFilterTab("all")}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            filterTab === "all"
              ? "border-sky-500 bg-sky-500/5 shadow-xs"
              : "border-border bg-card hover:bg-muted/30"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Total</span>
            <Package className="w-4 h-4 text-sky-500" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">{total}</p>
        </button>

        {/* Ready */}
        <button
          type="button"
          onClick={() => setFilterTab("ready")}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            filterTab === "ready"
              ? "border-emerald-500 bg-emerald-500/5 shadow-xs"
              : "border-border bg-card hover:bg-muted/30"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-600">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Ready</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {readyCount}
          </p>
        </button>

        {/* Needs Review */}
        <button
          type="button"
          onClick={() => setFilterTab("review")}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            filterTab === "review"
              ? "border-amber-500 bg-amber-500/5 shadow-xs"
              : "border-border bg-card hover:bg-muted/30"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-600">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Needs Review</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {reviewCount}
          </p>
        </button>

        {/* Errors */}
        <button
          type="button"
          onClick={() => setFilterTab("error")}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            filterTab === "error"
              ? "border-rose-500 bg-rose-500/5 shadow-xs"
              : "border-border bg-card hover:bg-muted/30"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-600">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Errors</span>
            <XCircle className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {errorCount}
          </p>
        </button>

        {/* Duplicates */}
        <button
          type="button"
          onClick={() => setFilterTab("duplicate")}
          className={`p-3.5 rounded-2xl border text-left transition-all col-span-2 sm:col-span-1 ${
            filterTab === "duplicate"
              ? "border-indigo-500 bg-indigo-500/5 shadow-xs"
              : "border-border bg-card hover:bg-muted/30"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-indigo-600">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Duplicates</span>
            <Layers className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {duplicateCount}
          </p>
        </button>
      </div>

      {/* Toolbar: Search, Filters & Bulk Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-2xl border border-border">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, SKU, barcode, brand..."
              className="pl-9 h-9 text-xs bg-background rounded-xl"
            />
          </div>

          <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs bg-background rounded-xl">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Categories</SelectItem>
              <SelectItem value="unassigned" className="text-xs text-amber-500 font-semibold">
                ⚠ Unassigned Only
              </SelectItem>
              {parentCategories.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selection Quick Buttons & Bulk Edit */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs rounded-xl font-semibold gap-1">
                <CheckSquare className="w-3.5 h-3.5 text-sky-500" /> Select <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              <DropdownMenuItem onClick={toggleSelectAll}>
                Select All Displayed ({displayedRows.length})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSelectReady}>
                Select All Ready ({readyCount})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSelectReview}>
                Select All Needs Review ({reviewCount})
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDeselectAll} className="text-rose-600">
                Deselect All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkEditOpen(true)}
            disabled={selectedCount === 0}
            className="h-9 text-xs rounded-xl font-semibold gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5 text-sky-500" /> Bulk Edit ({selectedCount})
          </Button>

          {duplicateCount > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-xs rounded-xl font-semibold gap-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" /> Duplicate Action <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem onClick={() => handleBulkDuplicateAction("skip")}>
                  Skip All Duplicates
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkDuplicateAction("update")}>
                  Update Existing Products
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkDuplicateAction("add_stock")}>
                  Add Stock to Existing Products
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Main Review Table (Desktop View) */}
      <div className="hidden sm:block bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                <th className="py-3.5 px-3 w-10 text-center">
                  <Checkbox checked={allDisplayedSelected} onCheckedChange={toggleSelectAll} />
                </th>
                <th className="py-3.5 px-3 w-12 text-center">#</th>
                <th className="py-3.5 px-4 min-w-[200px]">Product / Intelligence</th>
                <th className="py-3.5 px-3 min-w-[140px]">Category</th>
                <th className="py-3.5 px-3 min-w-[100px]">Base UOM</th>
                <th className="py-3.5 px-3 min-w-[120px]">Packaging</th>
                <th className="py-3.5 px-3 min-w-[120px]">Pricing</th>
                <th className="py-3.5 px-3 min-w-[70px]">Stock</th>
                <th className="py-3.5 px-3 min-w-[110px]">BarCode / SKU</th>
                <th className="py-3.5 px-3 min-w-[90px]">AI Confidence</th>
                <th className="py-3.5 px-3 w-28">Status</th>
                <th className="py-3.5 px-3 text-right min-w-[90px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-muted-foreground">
                    <p className="font-semibold text-sm">No products found matching the current filters.</p>
                  </td>
                </tr>
              ) : (
                displayedRows.map((p) => {
                  const isErr = p.status === "error";
                  const isRev = p.status === "review";
                  const isDupe = p.status === "duplicate";
                  const isSkip = p.status === "skipped";

                  const hasNameDiff =
                    p.canonical.original_name &&
                    p.canonical.original_name.trim() !== p.canonical.name.trim();

                  const isUomValid = isUomAllowedForIndustry(p.canonical.stock_unit, industryType);

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-muted/20 transition-colors ${
                        !p.selected || isSkip
                          ? "opacity-50 bg-muted/10"
                          : isErr
                          ? "bg-rose-500/5"
                          : isDupe
                          ? "bg-indigo-500/5"
                          : isRev
                          ? "bg-amber-500/5"
                          : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <Checkbox
                          checked={p.selected}
                          onCheckedChange={() => toggleRowSelect(p.id)}
                          disabled={isErr}
                        />
                      </td>

                      {/* Row Index */}
                      <td className="py-3 px-3 text-center font-mono text-[11px] text-muted-foreground">
                        {p.rowIndex}
                      </td>

                      {/* Product Name & Intelligence */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-foreground text-xs">
                              {p.canonical.name}
                            </span>
                            {hasNameDiff && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="p-0.5 rounded text-sky-500 hover:bg-sky-500/10 inline-flex items-center"
                                    title="View AI normalization diff"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-3 text-xs space-y-2">
                                  <p className="font-bold text-sky-600 flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5" /> AI Normalization Diff
                                  </p>
                                  <div>
                                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Original:</span>
                                    <p className="font-mono text-muted-foreground bg-muted p-1 rounded mt-0.5 text-[11px]">
                                      {p.canonical.original_name}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Normalized:</span>
                                    <p className="font-semibold text-foreground bg-sky-500/10 p-1 rounded mt-0.5 text-[11px]">
                                      {p.canonical.name}
                                    </p>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                          {(p.canonical.brand || p.canonical.strength) && (
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              {p.canonical.brand && <span>Brand: {p.canonical.brand}</span>}
                              {p.canonical.strength && <span>• {p.canonical.strength}</span>}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Category & Subcategory */}
                      <td className="py-3 px-3">
                        {p.canonical.category_name ? (
                          <div className="space-y-0.5">
                            <span className="font-medium text-foreground text-xs">
                              {p.canonical.category_name}
                            </span>
                            {p.canonical.subcategory_name && (
                              <p className="text-[10px] text-muted-foreground">
                                ↳ {p.canonical.subcategory_name}
                              </p>
                            )}
                          </div>
                        ) : (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-amber-500 hover:text-amber-600 font-semibold text-[11px]"
                              >
                                <AlertTriangle className="w-3 h-3" /> Select Category
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-2 text-xs">
                              <p className="font-bold mb-2">Assign Category</p>
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {parentCategories.map((cat) => (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => handleQuickAssignCategory(p.id, cat.id)}
                                    className="w-full text-left p-1.5 rounded-lg hover:bg-muted font-medium text-xs truncate"
                                  >
                                    {cat.name}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </td>

                      {/* Base Unit of Measure (UOM) */}
                      <td className="py-3 px-3">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                isUomValid
                                  ? "text-foreground hover:underline"
                                  : "text-amber-500 hover:text-amber-600"
                              }`}
                            >
                              <span className="capitalize">{p.canonical.stock_unit || "piece"}</span>
                              {!isUomValid && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-2 text-xs">
                            <p className="font-bold mb-2">Select Allowed UOM</p>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {allowedUoms.map((uom) => (
                                <button
                                  key={uom}
                                  type="button"
                                  onClick={() => handleQuickAssignUom(p.id, uom)}
                                  className="w-full text-left p-1.5 rounded-lg hover:bg-muted font-medium text-xs capitalize truncate"
                                >
                                  {uom}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </td>

                      {/* Packaging & Pack Size */}
                      <td className="py-3 px-3 text-muted-foreground text-[11px]">
                        {p.canonical.package_type ? (
                          <span>
                            {p.canonical.package_type}
                            {p.canonical.pack_size ? ` (${p.canonical.pack_size}s)` : ""}
                          </span>
                        ) : (
                          <span className="italic opacity-50">—</span>
                        )}
                      </td>

                      {/* Pricing */}
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          <p className="font-bold text-foreground">
                            {fmt(p.canonical.retail_price)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Cost: {fmt(p.canonical.purchase_cost)}
                          </p>
                        </div>
                      </td>

                      {/* Stock Units */}
                      <td className="py-3 px-3 font-semibold text-foreground">
                        {p.canonical.stock_units}
                      </td>

                      {/* Barcode & SKU */}
                      <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground">
                        {p.canonical.barcode || p.canonical.internal_sku || <span className="italic opacity-50">—</span>}
                      </td>

                      {/* Confidence */}
                      <td className="py-3 px-3">
                        {p.ai_confidence !== undefined ? (
                          <AIConfidenceBadge score={p.ai_confidence} size="sm" showPercentage />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">N/A</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">{renderStatusBadge(p)}</td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingRow(p)}
                            className="h-7 w-7 p-0 rounded-lg text-sky-500 hover:text-sky-600 hover:bg-sky-500/10"
                            title="Edit & Review Row"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setInspectingRow(p)}
                            className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Inspect Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View (< sm screens) */}
      <div className="block sm:hidden space-y-3">
        {displayedRows.length === 0 ? (
          <div className="p-8 text-center bg-card border border-border rounded-2xl text-muted-foreground">
            <p className="text-xs font-semibold">No products found matching the filters.</p>
          </div>
        ) : (
          displayedRows.map((p) => {
            const isErr = p.status === "error";
            const isRev = p.status === "review";
            const isDupe = p.status === "duplicate";

            return (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border bg-card transition-all space-y-3 ${
                  !p.selected
                    ? "opacity-50 border-border"
                    : isErr
                    ? "border-rose-500/40 bg-rose-500/5"
                    : isDupe
                    ? "border-indigo-500/40 bg-indigo-500/5"
                    : isRev
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-border shadow-xs"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={p.selected}
                      onCheckedChange={() => toggleRowSelect(p.id)}
                      disabled={isErr}
                    />
                    <div>
                      <p className="font-bold text-sm text-foreground">{p.canonical.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Row #{p.rowIndex} • {p.canonical.internal_sku || p.canonical.barcode || "No Code"}
                      </p>
                    </div>
                  </div>
                  {renderStatusBadge(p)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-xl border border-border">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Category</span>
                    <p className="font-medium text-foreground truncate mt-0.5">
                      {p.canonical.category_name || "⚠ Unassigned"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Base UOM</span>
                    <p className="font-medium text-foreground capitalize mt-0.5">
                      {p.canonical.stock_unit || "piece"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Price / Cost</span>
                    <p className="font-bold text-foreground mt-0.5">
                      {fmt(p.canonical.retail_price)} <span className="text-[10px] font-normal text-muted-foreground">({fmt(p.canonical.purchase_cost)})</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Stock Units</span>
                    <p className="font-bold text-foreground mt-0.5">{p.canonical.stock_units}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    {p.ai_confidence !== undefined && (
                      <AIConfidenceBadge score={p.ai_confidence} size="sm" showPercentage />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInspectingRow(p)}
                      className="h-8 text-xs rounded-xl px-2.5"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> Inspect
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setEditingRow(p)}
                      className="h-8 text-xs rounded-xl px-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" /> Review
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Row Edit Modal */}
      <RowEditDialog
        product={editingRow}
        open={!!editingRow}
        onOpenChange={(open) => !open && setEditingRow(null)}
        categories={categories}
        industryType={industryType}
        onSave={handleSaveRow}
      />

      {/* Row Inspection Detail Drawer */}
      <RowDetailDrawer
        product={inspectingRow}
        open={!!inspectingRow}
        onOpenChange={(open) => !open && setInspectingRow(null)}
        onEdit={(prod) => {
          setInspectingRow(null);
          setEditingRow(prod);
        }}
      />

      {/* Bulk Edit Modal */}
      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedProducts={selectedProducts}
        categories={categories}
        industryType={industryType}
        onApply={handleApplyBulkEdit}
      />

      {/* Final Confirmation Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                Confirm & Start Import
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Review final batch breakdown before committing records to the permanent database.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-muted/50 border border-border space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total In Upload:</span>
                <span className="font-bold">{total} products</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-600 font-medium">Selected For Import:</span>
                <span className="font-bold text-emerald-600">{selectedCount} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Skipped / Excluded:</span>
                <span className="font-medium">{total - selectedCount} items</span>
              </div>
            </div>

            {reviewCount > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
                <p className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Note: {reviewCount} items are marked "Needs Review".
                </p>
                <p className="text-[11px] mt-0.5 opacity-90">
                  You can proceed now or review and correct them beforehand.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                onStartImport(products);
              }}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 shadow-sm"
            >
              ✓ Confirm & Start Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default StepReview;
