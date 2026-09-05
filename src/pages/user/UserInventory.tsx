import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Package, Plus, Lock, Search, MoreVertical, Eye, ArrowRightLeft, Boxes as BoxesIcon,
  Pencil, Trash2, DollarSign, AlertTriangle, XCircle, ChevronDown, Download, Upload,
  ScanLine, Barcode, PackagePlus, TriangleAlert, CheckCircle2, FileText, Clock, History,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import UserPanelGate from "@/components/UserPanelGate";
import { usePlan } from "@/hooks/usePlan";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { useProductCategories } from "@/hooks/useProductCategories";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import ProductDialog, { ProductRecord } from "@/components/inventory/ProductDialog";
import ProductViewDialog from "@/components/inventory/ProductViewDialog";
import StockUpdateDialog from "@/components/inventory/StockUpdateDialog";
import BulkTransferDialog from "@/components/inventory/BulkTransferDialog";
import ExportLedgerDialog from "@/components/inventory/ExportLedgerDialog";
import BulkImportDialog from "@/components/inventory/BulkImportDialog";
import BarcodeLookupDialog from "@/components/inventory/BarcodeLookupDialog";
import RestockWorkflowDialog from "@/components/inventory/RestockWorkflowDialog";
import { StockLedgerModal } from "@/components/inventory/StockLedgerModal";
import { useMoney } from "@/lib/currency";
import { parseProductUOM, computeProductStock } from "@/lib/uomRegistry";

const UserInventory = () => {
  const { plan } = usePlan();
  const { getLimit, isExceeded, remaining } = usePlanLimits();
  const { active, businesses, industryType, categoryName, loading: bizLoading } = useActiveBusiness();
  const { all: allCategories } = useProductCategories(industryType, categoryName);
  const { toast } = useToast();
  const { format: fmt } = useMoney();
  const navigate = useNavigate();

  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkStatusModalOpen, setBulkStatusModalOpen] = useState(false);
  const [targetBulkStatus, setTargetBulkStatus] = useState<string>("active");
  const [bulkUpdatingStatus, setBulkUpdatingStatus] = useState(false);
  const [userId, setUserId] = useState<string>("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const [prefill, setPrefill] = useState<Record<string, string> | null>(null);
  const [viewTarget, setViewTarget] = useState<ProductRecord | null>(null);
  const [stockTarget, setStockTarget] = useState<ProductRecord | null>(null);
  const [transferTarget, setTransferTarget] = useState<ProductRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductRecord | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [barcode, setBarcode] = useState<"manual" | "scanner" | null>(null);
  const [restockOpen, setRestockOpen] = useState(false);
  const [stockLedgerOpen, setStockLedgerOpen] = useState(false);

  const activeId = active?.id;
  const ownerUserId = active?.owner_user_id;

  const load = useCallback(async (isSilent = false) => {
    if (!activeId) {
      setLoading(false);
      return;
    }
    if (!isSilent) {
      setLoading(true);
    }
    try {
      const { data: initialData, error } = await supabase
        .from("products")
        .select("id, name, internal_sku, description, category_id, subcategory_id, purchase_cost, retail_price, discount_price, stock_units, min_stock_alert, batch_number, expiry_date, barcode, status, images, uom, units_per_uom, base_unit")
        .eq("business_id", activeId)
        .order("created_at", { ascending: false });
      
      let data = initialData;
      if (error) {
        // Resilient fallback if columns not yet migrated
        const fallback = await supabase
          .from("products")
          .select("id, name, internal_sku, description, category_id, subcategory_id, purchase_cost, retail_price, discount_price, stock_units, min_stock_alert, batch_number, expiry_date, barcode, status, images")
          .eq("business_id", activeId)
          .order("created_at", { ascending: false });
        data = fallback.data as any;
      }

      if (data) {
        setProducts(data as ProductRecord[]);
      }
    } catch (err) {
      console.warn("Failed to fetch inventory products:", err);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? "");
    })();
  }, []);

  useEffect(() => {
    if (!bizLoading && activeId) {
      load(false);
    }
  }, [bizLoading, activeId, load]);

  useEffect(() => {
    if (!activeId) return;
    const ch = supabase.channel(`inventory-${activeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `business_id=eq.${activeId}` }, () => {
        load(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId, load]);

  const catName = (id: string | null) => allCategories.find((c) => c.id === id)?.name ?? "—";

  const productLimit = getLimit("products");
  const used = products.length;
  const exceeded = isExceeded("products", used);

  const defaultMinAlert = active?.stock_alert_limit ?? 10;
  const totalStockValue = products.reduce((s, p) => s + p.stock_units * Number(p.purchase_cost), 0);
  const lowStock = products.filter((p) => {
    const threshold = (p.min_stock_alert !== null && p.min_stock_alert !== undefined && p.min_stock_alert > 0)
      ? p.min_stock_alert
      : defaultMinAlert;
    return p.stock_units > 0 && p.stock_units <= threshold;
  }).length;
  const outOfStock = products.filter((p) => p.stock_units <= 0).length;
  const draftCount = products.filter((p) => p.status !== "active").length;
  const issueCount = lowStock + outOfStock + draftCount;

  const openAdd = (pre?: Record<string, string> | null) => {
    if (exceeded) {
      toast({ title: "Product limit reached", description: `Your ${plan.label} plan allows ${productLimit} products. Upgrade to add more.`, variant: "destructive" });
      return;
    }
    setEditing(null);
    setPrefill(pre ?? null);
    setDialogOpen(true);
  };

  const openEdit = (p: ProductRecord) => { setEditing(p); setPrefill(null); setDialogOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("products").delete().eq("id", deleteTarget.id);
    if (error) { toast({ title: "Could not delete", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Product deleted", description: deleteTarget.name }); load(); }
    setDeleteTarget(null);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const { error } = await supabase.from("products").delete().in("id", selectedIds);
      if (error) {
        toast({ title: "Bulk delete failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Products deleted", description: `Successfully deleted ${selectedIds.length} product(s).` });
        setSelectedIds([]);
        load();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBulkDeleting(false);
      setBulkDeleteModalOpen(false);
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.length === 0) return;
    setBulkUpdatingStatus(true);
    try {
      const { error } = await supabase.from("products").update({ status: newStatus }).in("id", selectedIds);
      if (error) {
        toast({ title: "Bulk update failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Status updated", description: `Updated ${selectedIds.length} product(s) to ${newStatus}.` });
        setSelectedIds([]);
        load();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBulkUpdatingStatus(false);
      setBulkStatusModalOpen(false);
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.internal_sku ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode ?? "").toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (categoryFilter !== "all" && p.category_id !== categoryFilter) {
      return false;
    }

    const threshold =
      p.min_stock_alert !== null && p.min_stock_alert !== undefined && p.min_stock_alert > 0
        ? p.min_stock_alert
        : defaultMinAlert;

    if (statusFilter === "in_stock") return p.stock_units > threshold;
    if (statusFilter === "low_stock") return p.stock_units > 0 && p.stock_units <= threshold;
    if (statusFilter === "out_of_stock") return p.stock_units <= 0;
    if (statusFilter === "active") return p.status === "active";
    if (statusFilter === "draft") return p.status !== "active";
    if (statusFilter === "expiring_30") {
      if (!p.expiry_date) return false;
      const exp = new Date(p.expiry_date).getTime();
      const now = Date.now();
      return exp >= now && exp <= now + 30 * 86400000;
    }
    if (statusFilter === "expiring_60") {
      if (!p.expiry_date) return false;
      const exp = new Date(p.expiry_date).getTime();
      const now = Date.now();
      return exp > now + 30 * 86400000 && exp <= now + 60 * 86400000;
    }
    if (statusFilter === "expiring") {
      if (!p.expiry_date) return false;
      const exp = new Date(p.expiry_date).getTime();
      const sixtyDays = Date.now() + 60 * 86400000;
      return exp <= sixtyDays;
    }

    return true;
  });

  const expiring30Items = useMemo(() => {
    const now = Date.now();
    return products.filter((p) => {
      if (!p.expiry_date) return false;
      const t = new Date(p.expiry_date).getTime();
      return t >= now && t <= now + 30 * 86400000;
    });
  }, [products]);

  const expiring60Items = useMemo(() => {
    const now = Date.now();
    return products.filter((p) => {
      if (!p.expiry_date) return false;
      const t = new Date(p.expiry_date).getTime();
      return t > now + 30 * 86400000 && t <= now + 60 * 86400000;
    });
  }, [products]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.includes(p.id));
  const someFilteredSelected = filtered.some((p) => selectedIds.includes(p.id)) && !allFilteredSelected;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filtered.some((p) => p.id === id)));
    } else {
      const filteredIds = filtered.map((p) => p.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const kpis = [
    { label: "Total Products", value: used, icon: BoxesIcon, color: "text-sky-500 bg-sky-500/15" },
    { label: "Stock Value", value: fmt(totalStockValue), icon: DollarSign, color: "text-emerald-500 bg-emerald-500/15" },
    { label: "Low Stock", value: lowStock, icon: AlertTriangle, color: "text-amber-500 bg-amber-500/15" },
    { label: "Out of Stock", value: outOfStock, icon: XCircle, color: "text-rose-500 bg-rose-500/15" },
  ];

  return (
    <UserPanelGate pageTitle="Inventory" module="inventory">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-1 truncate text-foreground">Inventory</h1>
            {productLimit !== null && (
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border inline-flex items-center gap-1 ${
                exceeded
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                  : (remaining("products", used) ?? 10) <= 5
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
              }`}>
                {exceeded ? "Quota Reached" : `${remaining("products", used)} remaining`} ({used}/{productLimit})
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">
            All products, batches and stock levels for {active?.business_name ?? "your workspace"}.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            variant="outline"
            onClick={() => setStockLedgerOpen(true)}
            className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/5 hover:bg-sky-500/15"
          >
            <History className="h-4 w-4 mr-1.5" /> Stock Ledger
          </Button>
          <Button variant="outline" onClick={() => setExportOpen(true)} className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold">
            <Download className="h-4 w-4 mr-1.5" /> Export Ledger
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (exceeded) {
                toast({
                  title: "Product limit reached",
                  description: `Your ${plan.label} plan allows ${productLimit} products. Upgrade to import more products.`,
                  variant: "destructive",
                });
                return;
              }
              setImportOpen(true);
            }}
            className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold"
          >
            <Upload className="h-4 w-4 mr-1.5" /> Bulk Import
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={exceeded} className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-sky-400 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold disabled:opacity-60">
                {exceeded ? <Lock className="h-4 w-4 mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />} New Product <ChevronDown className="h-4 w-4 ml-1.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => openAdd()}><PackagePlus className="h-4 w-4 mr-2" /> Add Manual</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBarcode("scanner")}><ScanLine className="h-4 w-4 mr-2" /> Scan Barcode</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBarcode("manual")}><Barcode className="h-4 w-4 mr-2" /> Direct Barcode Entry</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Plan limit exceeded banner */}
      {exceeded && (
        <div className="flex items-center justify-between gap-4 flex-wrap rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 mb-6 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <Lock className="h-5 w-5 text-rose-500 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-300">
                Product Limit Reached ({used}/{productLimit})
              </p>
              <p className="text-xs text-rose-600/80 dark:text-rose-400/80">
                You have reached the maximum number of products allowed on your {plan.label} plan. Upgrade to unlock more capacity.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => navigate("/dashboard/subscription")}
            className="bg-rose-600 hover:bg-rose-700 text-white border-0 text-xs font-bold rounded-xl shrink-0"
          >
            Upgrade Plan →
          </Button>
        </div>
      )}

      {/* Alert notification bar */}
      {issueCount > 0 && (
        <div className="flex items-center gap-3 flex-wrap rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 mb-6 min-w-0">
          <TriangleAlert className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-300 flex-1 min-w-[200px]">
            Inventory Deficit Detected — {issueCount} item{issueCount !== 1 ? "s have" : " has"} breached safety thresholds.
          </p>
          <Button size="sm" onClick={() => setRestockOpen(true)} className="bg-background hover:bg-background/80 text-foreground border border-border text-xs font-semibold shrink-0">
            Initiate Restock Workflow →
          </Button>
        </div>
      )}

      {/* Near Expiry Alert Bar (30 & 60 Days) */}
      {(expiring30Items.length > 0 || expiring60Items.length > 0) && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 mb-6 min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Clock className="h-5 w-5 text-rose-500 shrink-0" />
            <div className="text-xs sm:text-sm text-rose-700 dark:text-rose-300">
              <span className="font-bold">Near Expiry Alert: </span>
              {expiring30Items.length > 0 && (
                <span className="font-semibold text-rose-600 dark:text-rose-400 mr-2">
                  🔴 {expiring30Items.length} product(s) expiring within 30 days
                </span>
              )}
              {expiring60Items.length > 0 && (
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  🟡 {expiring60Items.length} product(s) expiring in 31–60 days
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {expiring30Items.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatusFilter("expiring_30")}
                className="bg-background/80 hover:bg-background text-rose-600 dark:text-rose-400 border-rose-500/30 text-xs font-semibold rounded-xl"
              >
                Show 30d Urgent ({expiring30Items.length})
              </Button>
            )}
            {expiring60Items.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatusFilter("expiring_60")}
                className="bg-background/80 hover:bg-background text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs font-semibold rounded-xl"
              >
                Show 60d Watchlist ({expiring60Items.length})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 min-w-0">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 min-w-0 overflow-hidden">
            <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-xl ${k.color} flex items-center justify-center mb-3 shrink-0`}>
              <k.icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <p className="text-xl sm:text-2xl font-bold tracking-tight truncate text-foreground" title={String(k.value)}>{k.value}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground tracking-wider uppercase mt-0.5 truncate">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name, SKU or barcode..."
            className="w-full h-11 pl-11 pr-4 bg-card border border-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Category Filter */}
        <div className="w-full sm:w-48 shrink-0">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full h-11 px-3 bg-card border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All Categories</option>
            {allCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-44 shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full h-11 px-3 bg-card border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All Statuses</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock (Alert)</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="expiring_30">🔴 Expiring in 30 Days (Urgent)</option>
            <option value="expiring_60">🟡 Expiring in 31–60 Days (Watchlist)</option>
            <option value="expiring">All Expiring Soon (≤60d)</option>
            <option value="active">Active Only</option>
            <option value="draft">Draft Only</option>
          </select>
        </div>

        {(search || categoryFilter !== "all" || statusFilter !== "all") && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setCategoryFilter("all");
              setStatusFilter("all");
            }}
            className="h-11 px-3 text-xs text-muted-foreground hover:text-foreground shrink-0 rounded-xl"
          >
            Reset Filters
          </Button>
        )}
      </div>

      {/* Bulk Selection Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl p-3.5 mb-4 flex items-center justify-between gap-3 flex-wrap animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-sky-500 text-white flex items-center justify-center font-bold text-xs">
              {selectedIds.length}
            </div>
            <span className="text-xs font-bold text-foreground">
              {selectedIds.length} product(s) selected
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setTargetBulkStatus("active");
                setBulkStatusModalOpen(true);
              }}
              className="h-8 text-xs font-bold rounded-lg border-border hover:bg-background"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
              Set Active
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setTargetBulkStatus("draft");
                setBulkStatusModalOpen(true);
              }}
              className="h-8 text-xs font-bold rounded-lg border-border hover:bg-background"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
              Set Draft
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkDeleteModalOpen(true)}
              className="h-8 text-xs font-bold rounded-lg"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete Selected
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        {bizLoading || loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading inventory...</div>
        ) : !active ? (
          <div className="p-12 text-center">
            <Package className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-bold">No business selected</p>
            <p className="text-sm text-muted-foreground mt-1">Create or select a business to manage inventory.</p>
            <Button onClick={() => navigate("/dashboard/businesses")} className="mt-4">Go to Businesses</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-bold">{search || categoryFilter !== "all" || statusFilter !== "all" ? "No matching products" : "No products yet"}</p>
            <p className="text-sm text-muted-foreground mt-1">{search || categoryFilter !== "all" || statusFilter !== "all" ? "Try adjusting your filters or search." : "Add your first product to start tracking stock, batches and pricing."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border bg-muted/20">
                  <th className="w-10 px-4 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someFilteredSelected;
                      }}
                      onChange={toggleSelectAll}
                      className="rounded border-border text-sky-500 focus:ring-sky-500 cursor-pointer h-4 w-4"
                    />
                  </th>
                  <th className="text-left px-4 py-4">PRODUCT / SKU</th>
                  <th className="text-left px-4 py-4">CATEGORY</th>
                  <th className="text-left px-4 py-4">PRICING</th>
                  <th className="text-left px-4 py-4">STOCK</th>
                  <th className="text-left px-4 py-4">STATUS</th>
                  <th className="text-right px-6 py-4">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const threshold = (p.min_stock_alert !== null && p.min_stock_alert !== undefined && p.min_stock_alert > 0)
                    ? p.min_stock_alert
                    : defaultMinAlert;
                  const stockInfo = computeProductStock(p.stock_units, p.name, p.description, p.uom, p.units_per_uom, p.base_unit);
                  const out = stockInfo.totalSubUnits <= 0;
                  const low = !out && stockInfo.listingStock <= threshold;
                  const margin = Number(p.retail_price) > 0 ? Math.round(((Number(p.retail_price) - Number(p.purchase_cost)) / Number(p.retail_price)) * 100) : 0;
                  const isSelected = selectedIds.includes(p.id);
                  
                  // Batch and expiry checks
                  const nowTime = Date.now();
                  const expTime = p.expiry_date ? new Date(p.expiry_date).getTime() : null;
                  const isExpired = expTime !== null ? expTime < nowTime : false;
                  const daysLeft = expTime !== null && !isExpired ? Math.ceil((expTime - nowTime) / (1000 * 3600 * 24)) : null;
                  const isExpiring30 = daysLeft !== null && daysLeft <= 30;
                  const isExpiring60 = daysLeft !== null && daysLeft > 30 && daysLeft <= 60;

                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-border last:border-0 transition-colors ${
                        isSelected ? "bg-sky-500/5 hover:bg-sky-500/10" : "hover:bg-muted/30"
                      }`}
                    >
                      <td className="w-10 px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectProduct(p.id)}
                          className="rounded border-border text-sky-500 focus:ring-sky-500 cursor-pointer h-4 w-4"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {p.images && p.images[0]
                            ? <img src={p.images[0]} alt="" className="h-10 w-10 rounded-xl object-cover border border-border" />
                            : <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Package className="h-4 w-4" /></div>}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-sm truncate text-foreground">{p.name}</p>
                              {isExpired && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-destructive/15 text-destructive shrink-0">EXPIRED</span>
                              )}
                              {isExpiring30 && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
                                  EXPIRING ({daysLeft}d)
                                </span>
                              )}
                              {isExpiring60 && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                                  EXPIRING ({daysLeft}d)
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground tracking-wider truncate mt-0.5">
                              {p.internal_sku || p.barcode || "—"}
                              {p.batch_number ? ` · Batch: ${p.batch_number}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4"><span className="text-xs text-muted-foreground">{catName(p.category_id)}</span></td>
                      <td className="px-4 py-4">
                        {(() => {
                          const parsed = parseProductUOM(p.name, p.description || "", p.uom, p.units_per_uom, p.base_unit);
                          const isScaled = parsed.packSize > 1;
                          const retail = Number(p.discount_price ?? p.retail_price);
                          return (
                            <div>
                              <p className="font-bold text-sm">
                                {fmt(retail)}
                                <span className="text-xs font-normal text-muted-foreground ml-1">/{parsed.uomLabel}</span>
                              </p>
                              {isScaled && (
                                <p className="text-[10px] text-muted-foreground">
                                  ~{fmt(retail / parsed.packSize)}/{parsed.subUnitName}
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                cost {fmt(Number(p.purchase_cost))} · <span className={margin >= 0 ? "text-emerald-500 font-semibold" : "text-rose-500 font-semibold"}>{margin}% margin</span>
                              </p>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-4">
                        {(() => {
                          const isScaled = stockInfo.packSize > 1;
                          return (
                            <div className="flex flex-col">
                              <span className={`text-base font-extrabold ${out ? "text-rose-500" : low ? "text-amber-500" : "text-foreground"}`}>
                                {stockInfo.displayText}
                              </span>
                              {isScaled && (
                                <span className="text-[11px] font-semibold text-muted-foreground">
                                  {stockInfo.subText}
                                </span>
                              )}
                              <p className="text-[10px] text-muted-foreground tracking-wider mt-0.5">alert ≤ {threshold}</p>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full ${out ? "bg-rose-500/15 text-rose-500" : low ? "bg-amber-500/15 text-amber-500" : p.status !== "active" ? "bg-muted text-muted-foreground" : "bg-emerald-500/15 text-emerald-500"}`}>
                          {p.status !== "active" ? p.status.toUpperCase() : out ? "OUT OF STOCK" : low ? "LOW STOCK" : "IN STOCK"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => setViewTarget(p)}><Eye className="h-4 w-4 mr-2" /> View Identity</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTransferTarget(p)}><ArrowRightLeft className="h-4 w-4 mr-2" /> Bulk Transfer</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStockTarget(p)}><BoxesIcon className="h-4 w-4 mr-2" /> Update Stock</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="h-4 w-4 mr-2" /> Edit Metadata</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteTarget(p)} className="text-rose-500 focus:text-rose-500"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Delete Modal */}
      <Dialog open={bulkDeleteModalOpen} onOpenChange={setBulkDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Delete {selectedIds.length} Products
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {selectedIds.length} selected product(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setBulkDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={bulkDeleting}
              onClick={handleBulkDelete}
            >
              {bulkDeleting ? "Deleting..." : `Delete ${selectedIds.length} Products`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Status Modal */}
      <Dialog open={bulkStatusModalOpen} onOpenChange={setBulkStatusModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Status for {selectedIds.length} Products</DialogTitle>
            <DialogDescription>
              Change the status of all {selectedIds.length} selected products to {targetBulkStatus.toUpperCase()}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs font-bold text-muted-foreground uppercase block mb-1.5">
              Select Target Status
            </label>
            <select
              value={targetBulkStatus}
              onChange={(e) => setTargetBulkStatus(e.target.value)}
              className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="active">Active (Available in POS &amp; Catalog)</option>
              <option value="draft">Draft (Hidden / Inactive)</option>
            </select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setBulkStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={bulkUpdatingStatus}
              onClick={() => handleBulkStatusChange(targetBulkStatus)}
              className="bg-sky-500 hover:bg-sky-600 text-white font-bold"
            >
              {bulkUpdatingStatus ? "Updating..." : "Apply Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {active && userId && (
        <ProductDialog open={dialogOpen} onOpenChange={setDialogOpen} businessId={active.id} ownerUserId={userId} product={editing} prefill={prefill} onSaved={load} />
      )}

      <ProductViewDialog open={!!viewTarget} onOpenChange={(v) => { if (!v) setViewTarget(null); }} product={viewTarget} categoryName={catName(viewTarget?.category_id ?? null)} />
      <StockUpdateDialog open={!!stockTarget} onOpenChange={(v) => { if (!v) setStockTarget(null); }} product={stockTarget} onSaved={load} />
      {active && userId && (
        <BulkTransferDialog open={!!transferTarget} onOpenChange={(v) => { if (!v) setTransferTarget(null); }} product={transferTarget} sourceBusinessId={active.id} ownerUserId={userId} businesses={businesses} onSaved={load} />
      )}
      {active && (
        <ExportLedgerDialog open={exportOpen} onOpenChange={setExportOpen} products={products} categoryName={catName} businessName={active.business_name} />
      )}
      {active && (
        <StockLedgerModal
          open={stockLedgerOpen}
          onOpenChange={setStockLedgerOpen}
          businessId={active.id}
          productsList={products.map((p) => ({
            id: p.id,
            name: p.name,
            internal_sku: p.internal_sku,
          }))}
        />
      )}
      {active && userId && (
        <BulkImportDialog open={importOpen} onOpenChange={setImportOpen} businessId={active.id} ownerUserId={userId} categories={allCategories} onSaved={load} />
      )}
      <BarcodeLookupDialog open={!!barcode} onOpenChange={(v) => { if (!v) setBarcode(null); }} mode={barcode ?? "manual"} onResolved={(pre) => openAdd(pre)} />
      <RestockWorkflowDialog open={restockOpen} onOpenChange={setRestockOpen} products={products} onFix={(p) => { setRestockOpen(false); openEdit(p); }} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-semibold">{deleteTarget?.name}</span> and its stock records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-500 hover:bg-rose-600 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UserPanelGate>
  );
};

export default UserInventory;
