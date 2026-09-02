import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { useToast } from "@/hooks/use-toast";
import { usePlan } from "@/hooks/usePlan";
import { useNavigate, Link } from "react-router-dom";
import UserPanelGate from "@/components/UserPanelGate";
import { BusinessCategoryDef, BusinessItem } from "@/types/business";
import { getExtendedBusinessData } from "@/lib/businessStorage";
import { CURRENCY_SYMBOLS, currencyLabel, currencySymbol } from "@/lib/currencies";
import { refreshBusinessMoney } from "@/lib/currency";
import { CreateBusinessWizard } from "@/components/business/CreateBusinessWizard";
import { EditBusinessModal } from "@/components/business/EditBusinessModal";
import { BusinessDetailsDrawer } from "@/components/business/BusinessDetailsDrawer";
import { ArchiveBusinessDialog } from "@/components/business/ArchiveBusinessDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  Building2,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  MapPin,
  Phone,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  Zap,
  Check,
  Copy,
  ExternalLink,
  Store,
  DollarSign,
  Layers,
  Archive,
  RotateCcw,
  Eye,
  Settings,
  Sparkles,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const UserBusinesses = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { activeId, setActive, reload } = useActiveBusiness();
  const { plan, planId } = usePlan();

  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [categories, setCategories] = useState<BusinessCategoryDef[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "archived">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Modals & Drawers state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const [selectedBiz, setSelectedBiz] = useState<BusinessItem | null>(null);

  const maxBranches = plan?.limits?.branchesMax ?? (planId === "free" ? 1 : planId === "standard" ? 3 : planId === "premium" ? 7 : 10);
  const isBranchLimitReached = typeof maxBranches === "number" && businesses.length >= maxBranches;

  // Load Businesses and Categories relationally
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const [{ data: bizRows, error: bizErr }, { data: catRows, error: catErr }, { data: profile }] =
        await Promise.all([
          supabase
            .from("businesses")
            .select("*")
            .eq("owner_user_id", user.id)
            .order("created_at", { ascending: true }),
          supabase.from("business_categories").select("*"),
          supabase.from("profiles").select("plan").eq("user_id", user.id).maybeSingle(),
        ]);

      if (bizErr) throw bizErr;

      const loadedCats = (catRows as any[]) || [];
      setCategories(loadedCats);

      const catMap = new Map<string, BusinessCategoryDef>();
      loadedCats.forEach((c) => catMap.set(c.id, c));

      const enrichedList: BusinessItem[] = ((bizRows as any[]) || []).map((b) => {
        const cat = b.category_id ? catMap.get(b.category_id) || null : null;
        const ext = getExtendedBusinessData(b.id);
        return {
          ...b,
          category: cat,
          category_name: cat ? cat.name : "Retail / Commercial",
          industry_type: cat ? cat.industry_type : "Retail",
          extended: ext,
          user_plan: profile?.plan || "Standard",
        };
      });

      setBusinesses(enrichedList);
    } catch (err: any) {
      toast({
        title: "Error Loading Businesses",
        description: err.message || "Failed to retrieve your businesses.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
    window.addEventListener("geflow:business-changed", loadData);
    return () => window.removeEventListener("geflow:business-changed", loadData);
  }, [loadData]);

  // Filtered Businesses
  const filteredBusinesses = useMemo(() => {
    return businesses.filter((b) => {
      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "active" && b.status !== "active") return false;
        if (statusFilter === "inactive" && b.status !== "inactive") return false;
        if (statusFilter === "archived" && b.status !== "archived") return false;
      }

      // Category filter
      if (categoryFilter !== "all") {
        if (b.category_id !== categoryFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = b.business_name.toLowerCase().includes(q);
        const matchesCategory = b.category_name?.toLowerCase().includes(q);
        const matchesAddress = b.business_address?.toLowerCase().includes(q);
        const matchesCurrency = b.currency?.toLowerCase().includes(q);
        const matchesPhone = b.extended?.phone?.toLowerCase().includes(q);
        return matchesName || matchesCategory || matchesAddress || matchesCurrency || matchesPhone;
      }

      return true;
    });
  }, [businesses, statusFilter, categoryFilter, searchQuery]);

  // Handle Switch Workspace
  const handleEnterWorkspace = (biz: BusinessItem) => {
    setActive(biz.id);
    localStorage.setItem("geflow.activeBusinessId", biz.id);
    refreshBusinessMoney();
    window.dispatchEvent(new CustomEvent("geflow:business-changed"));
    toast({
      title: "Workspace Switched",
      description: `Active business is now set to ${biz.business_name}.`,
    });
    navigate("/dashboard");
  };

  // Open Edit Modal
  const handleOpenEdit = (biz: BusinessItem) => {
    setSelectedBiz(biz);
    setEditModalOpen(true);
  };

  // Open Details Drawer
  const handleOpenDetails = (biz: BusinessItem) => {
    setSelectedBiz(biz);
    setDetailsDrawerOpen(true);
  };

  // Open Archive Dialog
  const handleOpenArchive = (biz: BusinessItem) => {
    setSelectedBiz(biz);
    setArchiveDialogOpen(true);
  };

  // Confirm Archive / Restore
  const handleConfirmArchive = async (biz: BusinessItem) => {
    setArchiveBusy(true);
    const newStatus = biz.status === "archived" ? "active" : "archived";
    try {
      const { error } = await supabase
        .from("businesses")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", biz.id);

      if (error) throw error;

      toast({
        title: newStatus === "archived" ? "Business Archived" : "Business Restored",
        description: `${biz.business_name} status updated to ${newStatus}.`,
      });

      setArchiveDialogOpen(false);
      await loadData();
      reload();
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setArchiveBusy(false);
    }
  };

  // Copy ID helper
  const copyBizId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast({
      title: "Copied to Clipboard",
      description: `Business ID: ${id}`,
    });
  };

  const activeCount = businesses.filter((b) => b.status === "active").length;

  return (
    <UserPanelGate pageTitle="My Businesses">
      <div className="w-full space-y-6 min-w-0 pb-12">
        {/* ========================================================================= */}
        {/* HEADER SECTION (Title + Description + Active Badge + Create CTA)          */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                My Businesses
              </h1>
              <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-sky-500/15 text-sky-500 border border-sky-500/20 shadow-xs">
                {activeCount} ACTIVE BUSINESSES
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide border ${
                isBranchLimitReached 
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" 
                  : "bg-muted text-muted-foreground border-border"
              }`}>
                {businesses.length}/{typeof maxBranches === "number" ? maxBranches : "∞"} ({plan?.label || "Free"} Plan)
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage all your businesses and branches from one centralized place.
            </p>
          </div>

          <Button
            onClick={() => {
              if (isBranchLimitReached) {
                setLimitDialogOpen(true);
              } else {
                setWizardOpen(true);
              }
            }}
            className="h-11 px-5 rounded-2xl text-xs font-extrabold uppercase tracking-wider bg-sky-400 hover:bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20 border-0 shrink-0 gap-2 transition-transform active:scale-[0.98]"
          >
            {isBranchLimitReached ? (
              <>
                <Lock className="w-4 h-4 stroke-[2.5] text-slate-950" /> Branch Limit Reached
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 stroke-[2.5]" /> Create New Business
              </>
            )}
          </Button>
        </div>

        {/* ========================================================================= */}
        {/* SEARCH AND FILTERS BAR                                                    */}
        {/* ========================================================================= */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative w-full flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by business name, category, location, or currency..."
              className="h-11 pl-11 pr-4 rounded-2xl bg-card border-border text-xs sm:text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-sky-500"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-2xl border border-border/80 self-stretch md:self-auto overflow-x-auto">
            {(
              [
                { id: "all", label: "All" },
                { id: "active", label: "Active" },
                { id: "inactive", label: "Inactive" },
                { id: "archived", label: "Archived" },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === st.id
                    ? "bg-card text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Category Filter Select */}
          {categories.length > 0 && (
            <div className="w-full md:w-52 shrink-0">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full h-11 px-3.5 rounded-2xl bg-card border border-border text-xs font-semibold text-foreground">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* BUSINESS NETWORK CARDS GRID                                               */}
        {/* ========================================================================= */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="p-6 rounded-3xl bg-card border border-border/70 animate-pulse space-y-4 h-64"
              >
                <div className="w-14 h-14 rounded-2xl bg-muted" />
                <div className="h-6 w-3/4 bg-muted rounded-md" />
                <div className="h-4 w-1/2 bg-muted rounded-md" />
              </div>
            ))}
          </div>
        ) : filteredBusinesses.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center rounded-3xl bg-card border border-dashed border-border space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-sky-500/10 text-sky-500 mx-auto flex items-center justify-center">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">No Businesses Found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchQuery || statusFilter !== "all" || categoryFilter !== "all"
                  ? "No businesses matched your search or active filters. Try adjusting your search query."
                  : "You haven't added any businesses yet. Create your first business to launch your operations."}
              </p>
            </div>
            <Button
              onClick={() => setWizardOpen(true)}
              className="rounded-2xl h-10 px-5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/15"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create Your First Business
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {filteredBusinesses.map((biz) => {
              const isCurrentlyActive = biz.id === activeId;
              const joinedDate = new Date(biz.created_at).toLocaleDateString(undefined, {
                month: "short",
                year: "numeric",
              });
              const cur = (biz.currency || "USD").toUpperCase();
              const sym = currencySymbol(cur);

              return (
                <div
                  key={biz.id}
                  className={`p-6 rounded-3xl bg-card border shadow-xs relative flex flex-col justify-between space-y-5 transition-all group ${
                    isCurrentlyActive
                      ? "border-sky-500/80 ring-1 ring-sky-500/40 shadow-md shadow-sky-500/5"
                      : "border-border/80 hover:border-sky-500/40"
                  }`}
                >
                  {/* Top Row: Logo / Icon + Active Badge + 3-Dots Menu */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Logo / Avatar */}
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 text-slate-950 flex items-center justify-center shadow-md shadow-sky-400/20 font-black text-2xl tracking-tighter">
                        {biz.business_name.charAt(0).toUpperCase()}
                      </div>

                      {isCurrentlyActive && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Active Workspace
                        </span>
                      )}
                    </div>

                    {/* Options Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 text-xs rounded-2xl p-1.5">
                        <DropdownMenuItem
                          onClick={() => handleEnterWorkspace(biz)}
                          className="font-semibold cursor-pointer rounded-xl"
                        >
                          <Check className="w-3.5 h-3.5 mr-2 text-emerald-500" />
                          Open Business
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => handleOpenDetails(biz)}
                          className="cursor-pointer rounded-xl"
                        >
                          <Eye className="w-3.5 h-3.5 mr-2 text-sky-500" />
                          View Details
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => handleOpenEdit(biz)}
                          className="cursor-pointer rounded-xl"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-2" />
                          Edit Business
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => copyBizId(biz.id)}
                          className="cursor-pointer rounded-xl"
                        >
                          <Copy className="w-3.5 h-3.5 mr-2" />
                          Copy Business ID
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => handleOpenArchive(biz)}
                          className={`cursor-pointer rounded-xl ${
                            biz.status === "archived"
                              ? "text-emerald-500 focus:text-emerald-500"
                              : "text-rose-500 focus:text-rose-500"
                          }`}
                        >
                          {biz.status === "archived" ? (
                            <>
                              <RotateCcw className="w-3.5 h-3.5 mr-2" />
                              Restore Business
                            </>
                          ) : (
                            <>
                              <Archive className="w-3.5 h-3.5 mr-2" />
                              Archive Business
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Business Name & Category */}
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold tracking-tight text-foreground line-clamp-1">
                      {biz.business_name}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[10px] font-extrabold tracking-widest text-sky-400 uppercase">
                        {biz.category_name || "COMMERCIAL RETAIL"}
                      </p>
                      {biz.category && (
                        <span className="text-[10px] text-muted-foreground/80 font-medium">
                          • {biz.category.industry_type}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Location, Phone, & Currency Details */}
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <span className="truncate">
                        {biz.business_address || "Location not configured"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                          <DollarSign className="w-3.5 h-3.5 text-sky-500" />
                        </div>
                        <span className="font-bold text-foreground">
                          {cur} ({sym})
                        </span>
                      </div>

                      <Badge variant="outline" className="text-[10px] font-bold">
                        Tax: {biz.default_tax ?? 0}%
                      </Badge>
                    </div>
                  </div>

                  {/* Status & Created Date Box */}
                  <div className="grid grid-cols-2 p-3 rounded-2xl bg-muted/20 border border-border/70 text-center">
                    <div className="border-r border-border/70">
                      <p className="text-[9px] font-extrabold tracking-widest text-muted-foreground uppercase">
                        STATUS
                      </p>
                      <div className="flex items-center justify-center gap-1.5 mt-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            biz.status === "active"
                              ? "bg-emerald-500"
                              : biz.status === "archived"
                              ? "bg-amber-500"
                              : "bg-slate-400"
                          }`}
                        />
                        <span className="text-[11px] font-extrabold tracking-wider uppercase text-foreground">
                          {biz.status || "ACTIVE"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-[9px] font-extrabold tracking-widest text-muted-foreground uppercase">
                        CREATED
                      </p>
                      <p className="text-[11px] font-extrabold tracking-wider text-foreground mt-1">
                        {joinedDate}
                      </p>
                    </div>
                  </div>

                  {/* Card Actions: [Open Business] + [Edit] */}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleEnterWorkspace(biz)}
                      className="flex-1 h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-card dark:hover:bg-muted dark:text-foreground border border-transparent dark:border-border text-xs font-extrabold tracking-wider uppercase flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-[0.98]"
                    >
                      {isCurrentlyActive ? "OPEN WORKSPACE" : "SWITCH TO BUSINESS"}{" "}
                      <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleOpenEdit(biz)}
                      className="h-11 px-3.5 rounded-2xl text-xs font-bold"
                      title="Edit Business"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* BOTTOM NETWORK STATS STRIP (3 Cards)                                      */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[9px] font-extrabold tracking-widest text-muted-foreground uppercase">
                  NETWORK UPTIME
                </p>
                <p className="text-xl font-extrabold text-foreground tracking-tight mt-0.5">
                  99.9%
                </p>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-muted-foreground/60" />
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[9px] font-extrabold tracking-widest text-muted-foreground uppercase">
                  INFRASTRUCTURE
                </p>
                <p className="text-xl font-extrabold text-foreground tracking-tight mt-0.5">
                  Enterprise
                </p>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-muted-foreground/60" />
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[9px] font-extrabold tracking-widest text-muted-foreground uppercase">
                  NODES SYNC
                </p>
                <p className="text-xl font-extrabold text-foreground tracking-tight mt-0.5">
                  Real-time
                </p>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-muted-foreground/60" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODALS & DRAWERS                                                          */}
      {/* ========================================================================= */}
      {/* 1. Multi-Step Create Business Wizard */}
      <CreateBusinessWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={async (newId) => {
          await loadData();
          reload();
        }}
      />

      {/* 2. Edit Business Modal */}
      <EditBusinessModal
        business={selectedBiz}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onUpdated={async () => {
          await loadData();
          reload();
        }}
      />

      {/* 3. Business Details Drawer */}
      <BusinessDetailsDrawer
        business={selectedBiz}
        open={detailsDrawerOpen}
        onOpenChange={setDetailsDrawerOpen}
        onEnterWorkspace={(b) => handleEnterWorkspace(b)}
        onOpenEdit={(b) => handleOpenEdit(b)}
        isActive={selectedBiz?.id === activeId}
      />

      {/* 4. Archive / Restore Dialog */}
      <ArchiveBusinessDialog
        business={selectedBiz}
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        onConfirm={handleConfirmArchive}
        busy={archiveBusy}
      />

      {/* 5. Plan Branch Limit Dialog */}
      <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <DialogContent className="max-w-md p-6 rounded-3xl">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              Branch Registration Limit Reached
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              You have currently registered <strong className="text-foreground">{businesses.length}</strong> of <strong className="text-foreground">{typeof maxBranches === "number" ? maxBranches : "unlimited"}</strong> allowed business branches on your <strong className="text-foreground">{plan?.label || "Free"} Plan</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-xs border-y border-border my-2">
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Free Plan</span>
              <span className="font-bold text-foreground">Single Business (1)</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Standard Plan</span>
              <span className="font-bold text-sky-500">Up to 3 Businesses</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Premium Plan</span>
              <span className="font-bold text-violet-500">Up to 7 Businesses</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Lifetime Plan</span>
              <span className="font-bold text-amber-500">Up to 10 Businesses</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setLimitDialogOpen(false)}
              className="h-11 px-5 rounded-2xl text-xs font-bold"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setLimitDialogOpen(false);
                navigate("/dashboard/subscription");
              }}
              className="h-11 px-5 rounded-2xl text-xs font-extrabold bg-sky-500 hover:bg-sky-600 text-white"
            >
              Upgrade Subscription
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </UserPanelGate>
  );
};

export default UserBusinesses;
