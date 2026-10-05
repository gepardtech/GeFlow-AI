import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import PanelLayout from "@/components/PanelLayout";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import { useToast } from "@/hooks/use-toast";
import {
  Scale,
  Plus,
  Search,
  Filter,
  Layers,
  CheckCircle2,
  XCircle,
  Building2,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Eye,
  Pencil,
  Copy,
  PowerOff,
  Power,
  Check,
  X,
  Sparkles,
  RefreshCw,
  Boxes,
  Package,
  FolderTree,
  List,
  Trash2,
  SlidersHorizontal,
  Info,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export interface MasterUomItem {
  id: string;
  uomId: string;
  name: string;
  symbol: string;
  type: string;
  parentId: string | null;
  parentName: string | null;
  isMainUom: boolean;
  targetBusinessCategories: string[];
  description: string;
  baseUnit?: string;
  subUnit?: string;
  conversionFactor?: number;
  conversionUnit?: string;
  decimalAllowed?: boolean;
  fractionAllowed?: boolean;
  status: "Active" | "Inactive";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const STANDARD_BUSINESS_CATEGORIES = [
  "Agricultural Supplies",
  "Auto Accessories",
  "Automotive Parts",
  "Bakery",
  "Building Materials",
  "Cakes & Desserts",
  "Computer & IT",
  "Confectionery",
  "Electrical Supplies",
  "Electronics",
  "Fashion & Apparel",
  "Furniture",
  "Gift & Lifestyle",
  "Grocery / Supermarket",
  "Hardware & Tools",
  "Home Appliances",
  "Mobile Accessories",
  "Mobile Phone",
  "Office / Asset Management",
  "Pharmacy / Medical Store",
  "Restaurant / Food Business",
  "Repair & Service Center",
  "Retail",
  "Salon / Beauty Services",
  "Seeds & Fertilizer",
  "Warehouse / Distribution",
  "Wholesale",
];

const emptyUomForm = {
  name: "",
  symbol: "",
  type: "Quantity",
  parentId: "" as string, // "" means No Parent / Main UoM
  targetBusinessCategories: [] as string[],
  description: "",
  decimalAllowed: true,
  fractionAllowed: false,
  status: "Active" as "Active" | "Inactive",
};

export default function AdminUoM() {
  const { toast } = useToast();

  // State
  const [uoms, setUoms] = useState<MasterUomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUoms: 0,
    mainUoms: 0,
    subUoms: 0,
    businessCategories: 21,
  });

  // Views & Filters
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
  const [search, setSearch] = useState("");
  const [parentFilter, setParentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  // Modal / Drawer state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUom, setEditingUom] = useState<MasterUomItem | null>(null);
  const [drawerUom, setDrawerUom] = useState<MasterUomItem | null>(null);
  const [isBulkCategoryOpen, setIsBulkCategoryOpen] = useState(false);
  const [selectedBulkCategories, setSelectedBulkCategories] = useState<string[]>([]);
  const [formState, setFormState] = useState(emptyUomForm);
  const [submitting, setSubmitting] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");

  // Load Data
  const loadUoms = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (categoryFilter !== "all") params.append("businessCategory", categoryFilter);
      if (parentFilter !== "all") params.append("parentId", parentFilter);
      if (search.trim()) params.append("search", search.trim());

      const res = await fetch(`/api/admin/uoms?${params.toString()}`);
      const data = await res.json();
      if (data?.success && Array.isArray(data.uoms)) {
        setUoms(data.uoms);
        if (data.stats) {
          setStats(data.stats);
        }
        // Expand all parents by default on initial load
        if (expandedParents.size === 0) {
          const mainIds = new Set(data.uoms.filter((u: MasterUomItem) => u.isMainUom).map((u: MasterUomItem) => u.id));
          setExpandedParents(mainIds);
        }
      }
    } catch (err: any) {
      toast({
        title: "Failed to load UoMs",
        description: err.message || "Could not retrieve UoM catalog",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, parentFilter, search, toast]);

  useEffect(() => {
    loadUoms();
  }, [loadUoms]);

  // Main / Parent UoMs available in the catalog
  const parentOptions = useMemo(() => {
    return uoms.filter((u) => u.isMainUom);
  }, [uoms]);

  // Filtered UoMs
  const filteredUoms = useMemo(() => {
    return uoms.filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (categoryFilter !== "all") {
        const cat = categoryFilter.toLowerCase();
        if (u.isMainUom) {
          const children = uoms.filter((c) => c.parentId === u.id);
          const hasChild = children.some((c) =>
            c.targetBusinessCategories?.some((bc) => bc.toLowerCase().includes(cat))
          );
          const direct = u.targetBusinessCategories?.some((bc) => bc.toLowerCase().includes(cat));
          if (!hasChild && !direct) return false;
        } else {
          const direct = u.targetBusinessCategories?.some((bc) => bc.toLowerCase().includes(cat));
          if (!direct) return false;
        }
      }
      if (parentFilter !== "all") {
        if (parentFilter === "root") {
          if (!u.isMainUom) return false;
        } else if (u.parentId !== parentFilter && u.id !== parentFilter) {
          return false;
        }
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesSymbol = u.symbol.toLowerCase().includes(q);
        const matchesParent = u.parentName?.toLowerCase().includes(q);
        const matchesDesc = u.description?.toLowerCase().includes(q);
        const matchesCat = u.targetBusinessCategories?.some((c) => c.toLowerCase().includes(q));
        if (!matchesName && !matchesSymbol && !matchesParent && !matchesDesc && !matchesCat) {
          return false;
        }
      }
      return true;
    });
  }, [uoms, statusFilter, categoryFilter, parentFilter, search]);

  // Grouped for Tree View
  const treeNodes = useMemo(() => {
    const mainNodes = filteredUoms.filter((u) => u.isMainUom);
    // Find sub-uoms for each main node
    return mainNodes.map((main) => {
      const children = filteredUoms.filter((sub) => sub.parentId === main.id);
      return {
        main,
        children,
      };
    });
  }, [filteredUoms]);

  // Handle Selection
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredUoms.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUoms.map((u) => u.id)));
    }
  };

  const toggleExpand = (mainId: string) => {
    const next = new Set(expandedParents);
    if (next.has(mainId)) next.delete(mainId);
    else next.add(mainId);
    setExpandedParents(next);
  };

  // Open Create Modal
  const openCreateModal = (preselectedParentId?: string) => {
    setEditingUom(null);
    setFormState({
      ...emptyUomForm,
      parentId: preselectedParentId || "",
    });
    setIsCreateOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (uom: MasterUomItem) => {
    setEditingUom(uom);
    setFormState({
      name: uom.name,
      symbol: uom.symbol,
      type: uom.type || "Quantity",
      parentId: uom.isMainUom ? "" : uom.parentId || "",
      targetBusinessCategories: uom.targetBusinessCategories || [],
      description: uom.description || "",
      decimalAllowed: uom.decimalAllowed ?? true,
      fractionAllowed: uom.fractionAllowed ?? false,
      status: uom.status,
    });
    setIsCreateOpen(true);
  };

  // Save Modal Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const isMain = !formState.parentId;
      const parentObj = parentOptions.find((p) => p.id === formState.parentId);

      const payload = {
        id: editingUom?.id,
        uomId: editingUom?.uomId,
        name: formState.name.trim(),
        symbol: formState.symbol.trim() || formState.name.slice(0, 3).toLowerCase(),
        type: isMain ? formState.name : parentObj?.name || formState.type || "Quantity",
        parentId: isMain ? null : formState.parentId,
        parentName: isMain ? null : parentObj?.name || null,
        isMainUom: isMain,
        targetBusinessCategories: formState.targetBusinessCategories,
        description: formState.description.trim(),
        decimalAllowed: formState.decimalAllowed,
        fractionAllowed: formState.fractionAllowed,
        status: formState.status,
      };

      const res = await fetch("/api/admin/uoms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save UoM");
      }

      toast({
        title: editingUom ? "UoM Updated" : "UoM Created",
        description: `"${payload.name}" saved successfully.`,
      });

      setIsCreateOpen(false);
      loadUoms();
    } catch (err: any) {
      toast({
        title: "Could not save UoM",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Status Toggle
  const handleToggleStatus = async (uom: MasterUomItem) => {
    const newStatus = uom.status === "Active" ? "Inactive" : "Active";
    try {
      const res = await fetch("/api/admin/uoms/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: uom.id, status: newStatus }),
      });
      if (res.ok) {
        toast({
          title: `UoM ${newStatus}`,
          description: `"${uom.name}" is now ${newStatus}.`,
        });
        loadUoms();
      }
    } catch (err: any) {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    }
  };

  // Bulk Actions
  const handleBulkStatusChange = async (status: "Active" | "Inactive") => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch("/api/admin/uoms/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: "status",
          status,
        }),
      });
      if (res.ok) {
        toast({
          title: "Bulk Status Updated",
          description: `Updated status to ${status} for ${selectedIds.size} items.`,
        });
        setSelectedIds(new Set());
        loadUoms();
      }
    } catch (err: any) {
      toast({ title: "Bulk action failed", description: err.message, variant: "destructive" });
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch("/api/admin/uoms/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: "delete",
        }),
      });
      if (res.ok) {
        toast({
          title: "UoMs Deactivated",
          description: `${selectedIds.size} UoMs marked as inactive.`,
        });
        setSelectedIds(new Set());
        loadUoms();
      }
    } catch (err: any) {
      toast({ title: "Bulk deactivation failed", description: err.message, variant: "destructive" });
    }
  };

  const handleApplyBulkCategories = async () => {
    if (selectedIds.size === 0 || selectedBulkCategories.length === 0) return;
    try {
      const res = await fetch("/api/admin/uoms/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: "categories",
          addCategories: selectedBulkCategories,
        }),
      });
      if (res.ok) {
        toast({
          title: "Categories Appointed",
          description: `Assigned categories to ${selectedIds.size} UoMs.`,
        });
        setIsBulkCategoryOpen(false);
        setSelectedBulkCategories([]);
        setSelectedIds(new Set());
        loadUoms();
      }
    } catch (err: any) {
      toast({ title: "Category update failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <PanelLayout
      navItems={ADMIN_NAV}
      {...ADMIN_IDENTITY}
      isAdmin
    >
      <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 pb-12 animate-in fade-in-50 duration-200">
        {/* 1. Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
          <Link to="/admin" className="hover:text-primary transition-colors">Admin</Link>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
          <Link to="/admin/business-categories" className="hover:text-primary transition-colors">Business Categories</Link>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
          <span className="font-semibold text-foreground">UoM</span>
        </div>

        {/* 2. Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                <Scale className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">UoM</h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Manage units of measurement and organize them by parent UoM and target business category.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={loadUoms}
              disabled={loading}
              className="h-9 text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
            <Button
              onClick={() => openCreateModal()}
              size="sm"
              className="h-9 text-xs gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add UoM</span>
            </Button>
          </div>
        </div>

        {/* 3. Realtime Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total UoMs */}
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total UoMs</span>
              <div className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Boxes className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {loading ? "—" : stats.totalUoms}
            </div>
            <p className="text-[11px] text-muted-foreground">Total main + sub UoMs in library</p>
          </div>

          {/* Card 2: Main UoMs */}
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Main UoMs</span>
              <div className="h-7 w-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <FolderTree className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {loading ? "—" : stats.mainUoms}
            </div>
            <p className="text-[11px] text-muted-foreground">Root measurement groups</p>
          </div>

          {/* Card 3: Sub UoMs */}
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Sub UoMs</span>
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {loading ? "—" : stats.subUoms}
            </div>
            <p className="text-[11px] text-muted-foreground">Operational units sold/tracked</p>
          </div>

          {/* Card 4: Business Categories */}
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Business Categories</span>
              <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {loading ? "—" : stats.businessCategories}
            </div>
            <p className="text-[11px] text-muted-foreground">Assigned business industries</p>
          </div>
        </div>

        {/* 4. Controls: Search, Filters & View Toggle */}
        <div className="rounded-xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Left: Search input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search UoM by name, symbol, category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Middle: Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Parent UoM filter */}
              <Select value={parentFilter} onValueChange={setParentFilter}>
                <SelectTrigger className="h-9 text-xs w-[140px] sm:w-[160px]">
                  <SelectValue placeholder="Parent UoM" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Parents</SelectItem>
                  <SelectItem value="root">Only Main UoMs</SelectItem>
                  {parentOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Business Category filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 text-xs w-[160px] sm:w-[190px]">
                  <SelectValue placeholder="Target Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Business Categories</SelectItem>
                  {STANDARD_BUSINESS_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-xs w-[110px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              {/* View Switcher: Tree vs List */}
              <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30 ml-auto lg:ml-0">
                <Button
                  type="button"
                  variant={viewMode === "tree" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("tree")}
                  className="h-7 text-xs px-2.5 gap-1"
                >
                  <FolderTree className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Tree View</span>
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-7 text-xs px-2.5 gap-1"
                >
                  <List className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">List View</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Active Filter Pills */}
          {(categoryFilter !== "all" || parentFilter !== "all" || statusFilter !== "all" || search) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              <span className="text-muted-foreground text-[11px] font-medium mr-1">Active Filters:</span>
              {categoryFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 text-[11px] h-6">
                  Category: {categoryFilter}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setCategoryFilter("all")} />
                </Badge>
              )}
              {parentFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 text-[11px] h-6">
                  Parent: {parentFilter === "root" ? "Main Only" : parentOptions.find(p => p.id === parentFilter)?.name || parentFilter}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setParentFilter("all")} />
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 text-[11px] h-6">
                  Status: {statusFilter}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setStatusFilter("all")} />
                </Badge>
              )}
              {search && (
                <Badge variant="secondary" className="gap-1 text-[11px] h-6">
                  Search: "{search}"
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSearch("")} />
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCategoryFilter("all");
                  setParentFilter("all");
                  setStatusFilter("all");
                  setSearch("");
                }}
                className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>

        {/* Bulk Action Bar (when selected) */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20 animate-in fade-in-50 duration-200">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
                {selectedIds.size}
              </span>
              <span>UoMs selected</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkStatusChange("Active")}
                className="h-7 text-xs gap-1 border-primary/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                <Check className="h-3 w-3" />
                Activate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkStatusChange("Inactive")}
                className="h-7 text-xs gap-1 border-primary/30 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              >
                <PowerOff className="h-3 w-3" />
                Deactivate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsBulkCategoryOpen(true)}
                className="h-7 text-xs gap-1 border-primary/30"
              >
                <Building2 className="h-3 w-3" />
                Assign Categories
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* 5. Main UoM Tree / List Table */}
        <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 font-semibold text-muted-foreground">
                  <th className="py-3 px-3 w-9">
                    <input
                      type="checkbox"
                      checked={filteredUoms.length > 0 && selectedIds.size === filteredUoms.length}
                      onChange={toggleSelectAll}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3 font-semibold text-foreground">UoM</th>
                  <th className="py-3 px-3 font-semibold text-foreground">Parent UoM</th>
                  <th className="py-3 px-3 font-semibold text-foreground min-w-[220px]">Target Business</th>
                  <th className="py-3 px-3 font-semibold text-foreground hidden md:table-cell">Description</th>
                  <th className="py-3 px-3 font-semibold text-foreground text-center w-24">Status</th>
                  <th className="py-3 px-3 font-semibold text-foreground text-right w-16">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                        <span>Loading Units of Measurement...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUoms.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Scale className="h-8 w-8 text-muted-foreground/40" />
                        <span className="font-semibold text-foreground text-sm">No Units of Measurement Found</span>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          {search || categoryFilter !== "all" || parentFilter !== "all"
                            ? "No UoMs matched your active search or filters."
                            : "Click '+ Add UoM' to define your first root or sub-measurement unit."}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => openCreateModal()}
                          className="mt-2 text-xs gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Add UoM</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : viewMode === "tree" ? (
                  // TREE VIEW: Main Parent UoMs with expandable children
                  treeNodes.map(({ main, children }) => {
                    const isExpanded = expandedParents.has(main.id);
                    const isSelected = selectedIds.has(main.id);

                    return (
                      <React.Fragment key={main.id}>
                        {/* Parent / Main Row */}
                        <tr
                          className={`group hover:bg-muted/30 transition-colors ${
                            isSelected ? "bg-primary/[0.04]" : "bg-card"
                          }`}
                        >
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(main.id)}
                              className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleExpand(main.id)}
                                className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                              <div
                                onClick={() => setDrawerUom(main)}
                                className="cursor-pointer font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5 text-xs sm:text-sm"
                              >
                                <span>{main.name}</span>
                                <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4">
                                  {main.symbol}
                                </Badge>
                                <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                  {children.length} sub-units
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground text-xs">—</td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {main.targetBusinessCategories && main.targetBusinessCategories.length > 0 ? (
                                main.targetBusinessCategories.slice(0, 2).map((bc) => (
                                  <Badge key={bc} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                                    {bc}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-[11px]">All Businesses</span>
                              )}
                              {main.targetBusinessCategories && main.targetBusinessCategories.length > 2 && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">
                                  +{main.targetBusinessCategories.length - 2} more
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground hidden md:table-cell max-w-xs truncate text-[11px]">
                            {main.description || "Root measurement category"}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Badge
                              variant={main.status === "Active" ? "default" : "secondary"}
                              className={`text-[10px] font-medium px-2 py-0.5 ${
                                main.status === "Active"
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {main.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="text-xs w-44">
                                <DropdownMenuItem onClick={() => setDrawerUom(main)} className="gap-2">
                                  <Eye className="w-3.5 h-3.5" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditModal(main)} className="gap-2">
                                  <Pencil className="w-3.5 h-3.5" /> Edit Main UoM
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openCreateModal(main.id)} className="gap-2 text-primary font-semibold">
                                  <Plus className="w-3.5 h-3.5" /> + Add Sub UoM
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleToggleStatus(main)}
                                  className={`gap-2 ${main.status === "Active" ? "text-amber-600" : "text-emerald-600"}`}
                                >
                                  {main.status === "Active" ? (
                                    <>
                                      <PowerOff className="w-3.5 h-3.5" /> Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <Power className="w-3.5 h-3.5" /> Activate
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>

                        {/* Children / Sub-UoM Rows */}
                        {isExpanded &&
                          children.map((sub) => {
                            const isSubSelected = selectedIds.has(sub.id);
                            return (
                              <tr
                                key={sub.id}
                                className={`hover:bg-muted/20 transition-colors ${
                                  isSubSelected ? "bg-primary/[0.04]" : "bg-muted/[0.08]"
                                }`}
                              >
                                <td className="py-2.5 px-3">
                                  <input
                                    type="checkbox"
                                    checked={isSubSelected}
                                    onChange={() => toggleSelect(sub.id)}
                                    className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer ml-1"
                                  />
                                </td>
                                <td className="py-2.5 px-3 pl-8">
                                  <div
                                    onClick={() => setDrawerUom(sub)}
                                    className="cursor-pointer flex items-center gap-2 group/sub"
                                  >
                                    <span className="text-muted-foreground/60 select-none">↳</span>
                                    <span className="font-semibold text-foreground group-hover/sub:text-primary transition-colors">
                                      {sub.name}
                                    </span>
                                    <Badge variant="outline" className="text-[10px] font-mono px-1 py-0 h-4">
                                      {sub.symbol}
                                    </Badge>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <Badge variant="secondary" className="text-[10px] font-normal px-2 py-0">
                                    {sub.parentName || main.name}
                                  </Badge>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {sub.targetBusinessCategories && sub.targetBusinessCategories.length > 0 ? (
                                      sub.targetBusinessCategories.slice(0, 2).map((bc) => (
                                        <Badge key={bc} variant="outline" className="text-[10px] px-1.5 py-0 font-normal border-sky-500/20 text-sky-700 dark:text-sky-300 bg-sky-500/5">
                                          {bc}
                                        </Badge>
                                      ))
                                    ) : (
                                      <span className="text-muted-foreground text-[11px]">All Businesses</span>
                                    )}
                                    {sub.targetBusinessCategories && sub.targetBusinessCategories.length > 2 && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">
                                        +{sub.targetBusinessCategories.length - 2}
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-muted-foreground hidden md:table-cell max-w-xs truncate text-[11px]">
                                  {sub.description || `Sub-unit under ${main.name}`}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <Badge
                                    variant={sub.status === "Active" ? "default" : "secondary"}
                                    className={`text-[10px] font-medium px-2 py-0.5 ${
                                      sub.status === "Active"
                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                        : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {sub.status}
                                  </Badge>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="text-xs w-44">
                                      <DropdownMenuItem onClick={() => setDrawerUom(sub)} className="gap-2">
                                        <Eye className="w-3.5 h-3.5" /> View Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openEditModal(sub)} className="gap-2">
                                        <Pencil className="w-3.5 h-3.5" /> Edit Sub UoM
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => handleToggleStatus(sub)}
                                        className={`gap-2 ${sub.status === "Active" ? "text-amber-600" : "text-emerald-600"}`}
                                      >
                                        {sub.status === "Active" ? (
                                          <>
                                            <PowerOff className="w-3.5 h-3.5" /> Deactivate
                                          </>
                                        ) : (
                                          <>
                                            <Power className="w-3.5 h-3.5" /> Activate
                                          </>
                                        )}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </td>
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })
                ) : (
                  // FLAT LIST VIEW
                  filteredUoms.map((u) => {
                    const isSelected = selectedIds.has(u.id);
                    return (
                      <tr
                        key={u.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          isSelected ? "bg-primary/[0.04]" : ""
                        }`}
                      >
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(u.id)}
                            className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <div
                            onClick={() => setDrawerUom(u)}
                            className="cursor-pointer font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            <span>{u.name}</span>
                            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4">
                              {u.symbol}
                            </Badge>
                            {u.isMainUom && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                Main
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {u.parentName ? (
                            <Badge variant="secondary" className="text-[10px] font-normal px-2 py-0">
                              {u.parentName}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {u.targetBusinessCategories && u.targetBusinessCategories.length > 0 ? (
                              u.targetBusinessCategories.slice(0, 2).map((bc) => (
                                <Badge key={bc} variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                                  {bc}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-[11px]">All Businesses</span>
                            )}
                            {u.targetBusinessCategories && u.targetBusinessCategories.length > 2 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">
                                +{u.targetBusinessCategories.length - 2}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground hidden md:table-cell max-w-xs truncate text-[11px]">
                          {u.description || "—"}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge
                            variant={u.status === "Active" ? "default" : "secondary"}
                            className={`text-[10px] font-medium px-2 py-0.5 ${
                              u.status === "Active"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {u.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs w-44">
                              <DropdownMenuItem onClick={() => setDrawerUom(u)} className="gap-2">
                                <Eye className="w-3.5 h-3.5" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditModal(u)} className="gap-2">
                                <Pencil className="w-3.5 h-3.5" /> Edit UoM
                              </DropdownMenuItem>
                              {u.isMainUom && (
                                <DropdownMenuItem onClick={() => openCreateModal(u.id)} className="gap-2 text-primary font-semibold">
                                  <Plus className="w-3.5 h-3.5" /> + Add Sub UoM
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(u)}
                                className={`gap-2 ${u.status === "Active" ? "text-amber-600" : "text-emerald-600"}`}
                              >
                                {u.status === "Active" ? (
                                  <>
                                    <PowerOff className="w-3.5 h-3.5" /> Deactivate
                                  </>
                                ) : (
                                  <>
                                    <Power className="w-3.5 h-3.5" /> Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. CREATE / EDIT UoM MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleFormSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Scale className="w-5 h-5 text-primary" />
                {editingUom ? `Edit UoM — ${editingUom.name}` : "Create New Unit of Measurement"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure measurement definition, parent group, and targeted business categories.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              {/* Name & Symbol */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-semibold text-foreground flex items-center gap-1">
                    UoM Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Kilogram, Pizza, Box"
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    required
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Symbol</label>
                  <Input
                    placeholder="e.g. kg, pz"
                    value={formState.symbol}
                    onChange={(e) => setFormState({ ...formState, symbol: e.target.value })}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Parent UoM Selection */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-foreground">Parent UoM</label>
                  <span className="text-[10px] text-muted-foreground">Select 'No Parent' to create a Main UoM</span>
                </div>
                <Select
                  value={formState.parentId || "root"}
                  onValueChange={(val) => setFormState({ ...formState, parentId: val === "root" ? "" : val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="No Parent / Main UoM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">🌟 No Parent / Main UoM (Root Group)</SelectItem>
                    {parentOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Business Categories (Multi-select) */}
              <div className="space-y-2 pt-1 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-foreground">Target Business Categories</label>
                  <span className="text-[10px] text-muted-foreground">
                    {formState.targetBusinessCategories.length} categories appointed
                  </span>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filter business categories..."
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                    className="pl-8 h-8 text-[11px]"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto border border-border/80 rounded-lg p-2 space-y-1.5 bg-muted/20">
                  {STANDARD_BUSINESS_CATEGORIES.filter((c) =>
                    c.toLowerCase().includes(categorySearchQuery.toLowerCase())
                  ).map((cat) => {
                    const isChecked = formState.targetBusinessCategories.includes(cat);
                    return (
                      <label
                        key={cat}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const next = isChecked
                              ? formState.targetBusinessCategories.filter((c) => c !== cat)
                              : [...formState.targetBusinessCategories, cat];
                            setFormState({ ...formState, targetBusinessCategories: next });
                          }}
                          className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                        />
                        <span className="text-foreground">{cat}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setFormState({ ...formState, targetBusinessCategories: [...STANDARD_BUSINESS_CATEGORIES] })
                    }
                    className="h-6 text-[10px] px-2 text-primary"
                  >
                    Select All Categories
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormState({ ...formState, targetBusinessCategories: [] })}
                    className="h-6 text-[10px] px-2 text-muted-foreground"
                  >
                    Clear Categories
                  </Button>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Description</label>
                <Input
                  placeholder="Short explanation of this measurement unit..."
                  value={formState.description}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              {/* Status */}
              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <div>
                  <span className="font-semibold text-foreground block">Active Status</span>
                  <span className="text-[11px] text-muted-foreground">
                    Available for product cataloging and stock tracking
                  </span>
                </div>
                <Switch
                  checked={formState.status === "Active"}
                  onCheckedChange={(c) => setFormState({ ...formState, status: c ? "Active" : "Inactive" })}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {submitting ? "Saving..." : editingUom ? "Update UoM" : "Create UoM"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 7. UoM DETAIL DRAWER */}
      <Sheet open={!!drawerUom} onOpenChange={(open) => !open && setDrawerUom(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {drawerUom && (
            <div className="space-y-6 pt-2">
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                      {drawerUom.symbol}
                    </div>
                    <div>
                      <SheetTitle className="text-lg font-bold text-foreground">
                        {drawerUom.name}
                      </SheetTitle>
                      <SheetDescription className="text-xs">
                        {drawerUom.isMainUom ? "Main Measurement Group" : `Sub-UoM under ${drawerUom.parentName}`}
                      </SheetDescription>
                    </div>
                  </div>
                  <Badge
                    variant={drawerUom.status === "Active" ? "default" : "secondary"}
                    className={drawerUom.status === "Active" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : ""}
                  >
                    {drawerUom.status}
                  </Badge>
                </div>
              </SheetHeader>

              {/* Details List */}
              <div className="space-y-3.5 text-xs">
                <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-semibold text-foreground">
                      {drawerUom.isMainUom ? "Main UoM" : "Sub UoM"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Symbol</span>
                    <span className="font-mono font-bold text-foreground">{drawerUom.symbol}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Parent Group</span>
                    <span className="font-semibold text-foreground">
                      {drawerUom.parentName || "None (Root)"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Decimal Allowed</span>
                    <span className="font-semibold text-foreground">
                      {drawerUom.decimalAllowed ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span className="text-foreground">
                      {new Date(drawerUom.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <span className="font-semibold text-foreground block">Description</span>
                  <p className="text-muted-foreground bg-muted/10 p-2.5 rounded-lg border border-border/60">
                    {drawerUom.description || "No specific description provided."}
                  </p>
                </div>

                {/* Sub-UoMs list if Main UoM */}
                {drawerUom.isMainUom && (
                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        Sub-Units in {drawerUom.name}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const pId = drawerUom.id;
                          setDrawerUom(null);
                          openCreateModal(pId);
                        }}
                        className="h-6 text-[11px] text-primary gap-1 px-2"
                      >
                        <Plus className="w-3 h-3" /> Add Sub UoM
                      </Button>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {uoms
                        .filter((sub) => sub.parentId === drawerUom.id)
                        .map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/80"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{sub.name}</span>
                              <Badge variant="outline" className="text-[10px] font-mono px-1">
                                {sub.symbol}
                              </Badge>
                            </div>
                            <Badge
                              variant="secondary"
                              className={`text-[9px] ${
                                sub.status === "Active" ? "text-emerald-600" : "text-muted-foreground"
                              }`}
                            >
                              {sub.status}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Target Business Categories */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <span className="font-semibold text-foreground block">
                    Appointed Target Businesses ({drawerUom.targetBusinessCategories?.length || 0})
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
                    {drawerUom.targetBusinessCategories && drawerUom.targetBusinessCategories.length > 0 ? (
                      drawerUom.targetBusinessCategories.map((cat) => (
                        <Badge key={cat} variant="secondary" className="text-xs px-2 py-0.5">
                          {cat}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">Available for all businesses</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-border/60">
                  <Button
                    onClick={() => {
                      const u = drawerUom;
                      setDrawerUom(null);
                      openEditModal(u);
                    }}
                    className="flex-1 h-9 text-xs gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit UoM
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleToggleStatus(drawerUom);
                      setDrawerUom(null);
                    }}
                    className={`h-9 text-xs gap-1.5 ${
                      drawerUom.status === "Active" ? "text-amber-600" : "text-emerald-600"
                    }`}
                  >
                    {drawerUom.status === "Active" ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                    {drawerUom.status === "Active" ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 8. BULK ASSIGN CATEGORIES DIALOG */}
      <Dialog open={isBulkCategoryOpen} onOpenChange={setIsBulkCategoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Building2 className="w-5 h-5 text-primary" />
              Appoint Categories to {selectedIds.size} Selected UoMs
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select which business categories should have access to these measurement units in their inventory catalog.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="max-h-56 overflow-y-auto border border-border/80 rounded-lg p-2 space-y-1.5 bg-muted/20">
              {STANDARD_BUSINESS_CATEGORIES.map((cat) => {
                const isChecked = selectedBulkCategories.includes(cat);
                return (
                  <label
                    key={cat}
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        const next = isChecked
                          ? selectedBulkCategories.filter((c) => c !== cat)
                          : [...selectedBulkCategories, cat];
                        setSelectedBulkCategories(next);
                      }}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                    />
                    <span className="text-foreground">{cat}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsBulkCategoryOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApplyBulkCategories}
              disabled={selectedBulkCategories.length === 0}
              className="h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Appoint Categories
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelLayout>
  );
}
