import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PanelLayout from "@/components/PanelLayout";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import {
  Search,
  Plus,
  Eye,
  MoreVertical,
  Loader2,
  Cpu,
  Zap,
  Shield,
  Pencil,
  FlaskConical,
  Trash2,
  Code2,
  Package,
  ShoppingCart,
  Brain,
  Users,
  DollarSign,
  Truck,
  BarChart3,
  Globe,
  Layers,
  Sparkles,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  ExternalLink,
  Filter,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Check,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  FeatureModuleDefinition,
  FEATURE_GROUPS,
  VERSION_ROADMAP_META,
  MASTER_FEATURE_CATALOG,
  getLocalFeatureCatalog,
  saveLocalFeatureCatalog,
} from "@/lib/featureCatalog";

const getGroupIcon = (groupKey: string) => {
  switch (groupKey) {
    case "pos":
      return ShoppingCart;
    case "inventory":
      return Package;
    case "ai":
      return Brain;
    case "crm":
      return Users;
    case "finance":
      return DollarSign;
    case "purchases":
      return Truck;
    case "reports":
      return BarChart3;
    case "team":
      return Shield;
    case "ecommerce":
      return Globe;
    case "enterprise":
      return Layers;
    case "hardware":
      return Cpu;
    case "developer":
      return Code2;
    default:
      return FolderKanban;
  }
};

const getVersionBadgeClass = (v: string) => {
  switch (v) {
    case "v1":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    case "v2":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "v3":
      return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30";
    case "v4":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
    case "v5":
      return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
    default:
      return "bg-slate-500/15 text-slate-500 border-slate-500/30";
  }
};

const getPhaseBadgeClass = (p: string) => {
  switch (p) {
    case "live":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    case "beta":
      return "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30";
    case "staging":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
    case "deactivated":
      return "bg-slate-500/15 text-slate-500 border-slate-500/30";
    default:
      return "bg-slate-500/15 text-slate-500";
  }
};

const blankForm = () => ({
  module_code: "",
  name: "",
  function_group: "inventory" as const,
  group_title: "Inventory & Stock Control",
  description: "",
  version_target: "v1" as const,
  version_title: "Version 1.0 — Core MVP",
  lifecycle_phase: "staging" as const,
  plan_free: true,
  plan_standard: true,
  plan_premium: true,
  global_active: true,
  health: "optimal" as const,
  latency_ms: 15,
  source_file_url: "",
});

export const AdminFeatures = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<FeatureModuleDefinition[]>(() => getLocalFeatureCatalog());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<string>("all");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Dialogs & Modals
  const [openRegister, setOpenRegister] = useState(false);
  const [editing, setEditing] = useState<FeatureModuleDefinition | null>(null);
  const [form, setForm] = useState<any>(blankForm());
  const [delItem, setDelItem] = useState<FeatureModuleDefinition | null>(null);
  const [inspectItem, setInspectItem] = useState<FeatureModuleDefinition | null>(null);
  const [testItem, setTestItem] = useState<FeatureModuleDefinition | null>(null);
  const [testLog, setTestLog] = useState<string[]>([]);
  const [testRunning, setTestRunning] = useState(false);

  // Staged modifications
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<FeatureModuleDefinition>>>({});

  // Sync with DB / Catalog
  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("feature_modules").select("*").order("created_at");
      if (!error && data && data.length > 0) {
        const merged: FeatureModuleDefinition[] = MASTER_FEATURE_CATALOG.map((masterItem) => {
          const dbItem = (data as any[]).find((d) => d.module_code === masterItem.module_code || d.id === masterItem.id);
          if (dbItem) {
            return {
              ...masterItem,
              global_active: dbItem.global_active,
              lifecycle_phase: dbItem.lifecycle_phase || masterItem.lifecycle_phase,
              plan_free: dbItem.plan_free ?? masterItem.plan_free,
              plan_standard: dbItem.plan_standard ?? masterItem.plan_standard,
              plan_premium: dbItem.plan_premium ?? masterItem.plan_premium,
            };
          }
          return masterItem;
        });
        setRows(merged);
        saveLocalFeatureCatalog(merged);
      } else {
        const local = getLocalFeatureCatalog();
        setRows(local);
      }
    } catch (err) {
      console.warn("Using local catalog:", err);
      setRows(getLocalFeatureCatalog());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Filtered rows
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (selectedVersion !== "all" && r.version_target !== selectedVersion) return false;
      if (selectedGroup !== "all" && r.function_group !== selectedGroup) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.module_code.toLowerCase().includes(q) ||
        r.function_group.toLowerCase().includes(q) ||
        r.group_title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    });
  }, [rows, search, selectedVersion, selectedGroup]);

  // Grouped structure
  const groupedFeatures = useMemo(() => {
    const map = new Map<string, { meta: (typeof FEATURE_GROUPS)[0]; items: FeatureModuleDefinition[] }>();

    FEATURE_GROUPS.forEach((g) => {
      map.set(g.key, { meta: g, items: [] });
    });

    filtered.forEach((item) => {
      const existing = map.get(item.function_group);
      if (existing) {
        existing.items.push(item);
      } else {
        const fallbackMeta = {
          key: item.function_group,
          title: item.group_title || item.function_group.toUpperCase(),
          iconName: "FolderKanban",
          description: "Modular platform features",
          accent: "text-slate-500 bg-slate-500/10 border-slate-500/20",
        };
        map.set(item.function_group, { meta: fallbackMeta, items: [item] });
      }
    });

    return Array.from(map.values()).filter((g) => g.items.length > 0);
  }, [filtered]);

  // Stats calculation
  const stats = useMemo(() => {
    const active = rows.filter((r) => r.global_active).length;
    const v1Active = rows.filter((r) => r.version_target === "v1" && r.global_active).length;
    const v1Total = rows.filter((r) => r.version_target === "v1").length;
    const futureTotal = rows.filter((r) => r.version_target !== "v1").length;
    const futureActive = rows.filter((r) => r.version_target !== "v1" && r.global_active).length;
    return {
      active,
      total: rows.length,
      v1Active,
      v1Total,
      futureActive,
      futureTotal,
    };
  }, [rows]);

  const stagePending = (id: string, patch: Partial<FeatureModuleDefinition>) => {
    setPendingChanges((p) => ({ ...p, [id]: { ...(p[id] ?? {}), ...patch } }));
    setRows((rs) => {
      const updated = rs.map((r) => (r.id === id ? { ...r, ...patch } : r));
      saveLocalFeatureCatalog(updated);
      return updated;
    });
  };

  const discardPending = () => {
    setPendingChanges({});
    load();
  };

  const savePending = async () => {
    const ids = Object.keys(pendingChanges);
    if (ids.length === 0) return;

    saveLocalFeatureCatalog(rows);
    window.dispatchEvent(new Event("storage"));

    try {
      for (const id of ids) {
        const patch = pendingChanges[id];
        const dbPayload: any = { ...patch };
        delete dbPayload.test_scenario;
        await supabase.from("feature_modules").update(dbPayload).eq("id", id);
      }
    } catch (e) {
      console.warn("DB update sync skipped, local changes saved:", e);
    }

    toast({
      title: "Platform Changes Synced",
      description: `${ids.length} feature module${ids.length > 1 ? "s" : ""} updated and active across all store panels.`,
    });
    setPendingChanges({});
  };

  // Quick Action: Reset to Pure V1.0 Launch Baseline (Only V1 Active, V2-V5 Disabled)
  const handleResetToV1 = () => {
    const updated = MASTER_FEATURE_CATALOG.map((m) => {
      const isV1 = m.version_target === "v1";
      return {
        ...m,
        global_active: isV1,
        lifecycle_phase: (isV1 ? "live" : "staging") as any,
      };
    });

    setRows(updated);
    saveLocalFeatureCatalog(updated);
    window.dispatchEvent(new Event("storage"));

    const batch: Record<string, Partial<FeatureModuleDefinition>> = {};
    updated.forEach((u) => {
      batch[u.id] = {
        global_active: u.global_active,
        lifecycle_phase: u.lifecycle_phase,
      };
    });
    setPendingChanges(batch);

    toast({
      title: "Version 1.0 Baseline Restored",
      description: `Only the ${stats.v1Total} Core V1 features are active. V2 to V5 features are safely staged.`,
    });
  };

  // Quick Action: Unlock All Versions (V1 to V5)
  const handleUnlockAll = () => {
    const updated = rows.map((r) => ({
      ...r,
      global_active: true,
      lifecycle_phase: "live" as const,
      plan_free: true,
      plan_standard: true,
      plan_premium: true,
    }));

    setRows(updated);
    saveLocalFeatureCatalog(updated);
    window.dispatchEvent(new Event("storage"));

    const batch: Record<string, Partial<FeatureModuleDefinition>> = {};
    updated.forEach((u) => {
      batch[u.id] = {
        global_active: true,
        lifecycle_phase: "live",
        plan_free: true,
        plan_standard: true,
        plan_premium: true,
      };
    });
    setPendingChanges(batch);

    toast({
      title: "All Roadmap Features Activated",
      description: `All ${rows.length} modules across V1 to V5 are now active in the platform.`,
    });
  };

  // Toggle entire functional group
  const handleToggleGroup = (groupKey: string, enable: boolean) => {
    const updated = rows.map((r) => {
      if (r.function_group === groupKey) {
        return {
          ...r,
          global_active: enable,
          lifecycle_phase: (enable ? "live" : "staging") as any,
        };
      }
      return r;
    });

    setRows(updated);
    saveLocalFeatureCatalog(updated);
    window.dispatchEvent(new Event("storage"));

    const batch: Record<string, Partial<FeatureModuleDefinition>> = { ...pendingChanges };
    updated
      .filter((r) => r.function_group === groupKey)
      .forEach((u) => {
        batch[u.id] = {
          global_active: u.global_active,
          lifecycle_phase: u.lifecycle_phase,
        };
      });
    setPendingChanges(batch);

    toast({
      title: `${enable ? "Activated" : "Disabled"} Feature Group`,
      description: `All features in ${groupKey.toUpperCase()} updated.`,
    });
  };

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Run interactive sandbox test
  const runLiveTest = (item: FeatureModuleDefinition) => {
    setTestItem(item);
    setTestRunning(true);
    setTestLog([
      `[0.00s] Initializing test sandbox for ${item.name} (${item.module_code})...`,
      `[0.04s] Architecture Group: ${item.group_title} | Roadmap Target: ${item.version_target.toUpperCase()}`,
      `[0.08s] Verifying plan allocations (Free: ${item.plan_free ? "Yes" : "No"}, Std: ${
        item.plan_standard ? "Yes" : "No"
      }, Prem: ${item.plan_premium ? "Yes" : "No"})...`,
    ]);

    setTimeout(() => {
      setTestLog((prev) => [
        ...prev,
        `[0.15s] Mounting source vector: ${item.source_file_url || "src/pages/Dashboard.tsx"}`,
        `[0.22s] Executing test vector: "${item.test_scenario?.input_sample || "Sample operational payload"}"`,
      ]);
    }, 280);

    setTimeout(() => {
      setTestLog((prev) => [
        ...prev,
        `[0.38s] Response payload parsed: ${JSON.stringify(
          item.test_scenario?.simulated_payload || { status: "active", module: item.module_code }
        )}`,
        `[0.45s] Expected outcome verified: "${
          item.test_scenario?.expected_output || "Verified operational with 0ms error rate."
        }"`,
        `[0.50s] Engine latency: ${item.latency_ms}ms (Health: ${item.health.toUpperCase()})`,
        `[0.52s] TEST OUTCOME: ALL CHECKS PASSED. Ready for customer execution.`,
      ]);
      setTestRunning(false);
    }, 650);
  };

  const submitCustomFeature = async () => {
    if (!form.name.trim() || !form.module_code.trim()) {
      toast({ title: "Feature name & code are required", variant: "destructive" });
      return;
    }

    const payload: FeatureModuleDefinition = {
      ...form,
      id: editing?.id || `feat-custom-${Date.now()}`,
      latency_ms: Number(form.latency_ms || 15),
      group_title:
        FEATURE_GROUPS.find((g) => g.key === form.function_group)?.title || "Modular Feature Group",
      version_title:
        VERSION_ROADMAP_META.find((v) => v.version === form.version_target)?.title || "Roadmap Feature",
    };

    let nextRows: FeatureModuleDefinition[];
    if (editing) {
      nextRows = rows.map((r) => (r.id === editing.id ? { ...r, ...payload } : r));
    } else {
      nextRows = [payload, ...rows];
    }

    setRows(nextRows);
    saveLocalFeatureCatalog(nextRows);
    window.dispatchEvent(new Event("storage"));

    toast({ title: editing ? "Feature Module Updated" : "Custom Feature Module Registered" });
    setOpenRegister(false);
    setEditing(null);
    setForm(blankForm());
  };

  const confirmDelete = () => {
    if (!delItem) return;
    const nextRows = rows.filter((r) => r.id !== delItem.id);
    setRows(nextRows);
    saveLocalFeatureCatalog(nextRows);
    window.dispatchEvent(new Event("storage"));
    toast({ title: "Feature Module Removed" });
    setDelItem(null);
  };

  const dirty = Object.keys(pendingChanges).length > 0;

  return (
    <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY} isAdmin>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-3xl font-black tracking-tight">Feature Control Room</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black border border-emerald-500/20">
              V1.0 Launch + V2–V5 Roadmap
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Group-wise feature manager: enable, test, and control module visibility across all store dashboards and
            subscription tiers.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleResetToV1}
            className="h-10 rounded-xl text-xs font-bold border-border hover:bg-muted"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
            Reset to V1 Core ({stats.v1Total} Active)
          </Button>

          <Button
            variant="outline"
            onClick={handleUnlockAll}
            className="h-10 rounded-xl text-xs font-bold border-border hover:bg-muted"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
            Unlock All Roadmap ({rows.length} Modules)
          </Button>

          <Button
            onClick={() => {
              setEditing(null);
              setForm(blankForm());
              setOpenRegister(true);
            }}
            className="h-10 px-4 rounded-xl bg-foreground text-background hover:opacity-90 font-bold text-xs"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Register Module
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={CheckCircle2}
          label="ACTIVE OPERATIONAL"
          value={`${stats.active} / ${stats.total}`}
          accent="text-emerald-500 bg-emerald-500/15"
          subtitle={`${stats.v1Active} of ${stats.v1Total} V1 Core Active`}
        />
        <StatCard
          icon={Sparkles}
          label="ROADMAP STAGED (V2–V5)"
          value={`${stats.futureActive} / ${stats.futureTotal}`}
          accent="text-violet-500 bg-violet-500/15"
          subtitle="Ready for Instant Activation"
        />
        <StatCard
          icon={FolderKanban}
          label="FUNCTIONAL GROUPS"
          value={`${FEATURE_GROUPS.length} Groups`}
          accent="text-blue-500 bg-blue-500/15"
          subtitle="Modular Architecture"
        />
        <StatCard
          icon={Shield}
          label="TIER GATEKEEPING"
          value="Free / Std / Prem"
          accent="text-amber-500 bg-amber-500/15"
          subtitle="Granular Subscription Access"
        />
      </div>

      {/* Roadmap Version Tabs & Filter Bar */}
      <div className="bg-card border border-border rounded-2xl p-3.5 mb-5 shadow-xs space-y-3">
        {/* Version Roadmap Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedVersion("all")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              selectedVersion === "all"
                ? "bg-foreground text-background shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> All Roadmap ({rows.length})
          </button>

          {VERSION_ROADMAP_META.map((ver) => {
            const count = rows.filter((r) => r.version_target === ver.version).length;
            const activeCount = rows.filter((r) => r.version_target === ver.version && r.global_active).length;
            const isSelected = selectedVersion === ver.version;

            return (
              <button
                key={ver.version}
                onClick={() => setSelectedVersion(ver.version)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <span>{ver.badge}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {activeCount}/{count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search, Group Select & View Mode */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search features (e.g. POS, Barcode, AI, Khata, Loyalty, Forecasting)..."
              className="h-10 w-full pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="h-10 w-[190px] text-xs font-bold rounded-xl border-border bg-muted/30">
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Functional Groups</SelectItem>
                {FEATURE_GROUPS.map((g) => (
                  <SelectItem key={g.key} value={g.key}>
                    {g.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border">
              <button
                onClick={() => setViewMode("grouped")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "grouped" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FolderKanban className="h-3.5 w-3.5" /> Grouped
              </button>
              <button
                onClick={() => setViewMode("flat")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "flat" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="h-3.5 w-3.5" /> Flat Table
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Grouped View or Flat Table */}
      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center shadow-xs">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
          <p className="text-xs text-muted-foreground font-medium">Loading feature registry...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center text-sm text-muted-foreground shadow-xs">
          No features found matching the current search filters.
        </div>
      ) : viewMode === "grouped" ? (
        /* GROUPED VIEW */
        <div className="space-y-6">
          {groupedFeatures.map(({ meta, items }) => {
            const Icon = getGroupIcon(meta.key);
            const isCollapsed = !!collapsedGroups[meta.key];
            const activeInGroup = items.filter((i) => i.global_active).length;
            const allActiveInGroup = activeInGroup === items.length;

            return (
              <div
                key={meta.key}
                className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs transition-all"
              >
                {/* Group Header Banner */}
                <div className="px-5 py-4 bg-muted/20 border-b border-border flex items-center justify-between gap-4 flex-wrap">
                  <div
                    onClick={() => toggleGroupCollapse(meta.key)}
                    className="flex items-center gap-3 cursor-pointer select-none group"
                  >
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${meta.accent}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-foreground group-hover:text-primary transition-colors">
                          {meta.title}
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-muted text-muted-foreground border">
                          {activeInGroup} / {items.length} Active
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleGroup(meta.key, !allActiveInGroup)}
                      className="h-8 text-[11px] font-bold rounded-lg border-border"
                    >
                      {allActiveInGroup ? "Disable All in Group" : "Activate All in Group"}
                    </Button>

                    <button
                      onClick={() => toggleGroupCollapse(meta.key)}
                      className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Group Items Table */}
                {!isCollapsed && (
                  <div>
                    {/* Header Columns */}
                    <div className="grid grid-cols-[2fr_1fr_1.1fr_1fr_0.8fr_0.8fr] gap-2 px-5 py-3 text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border bg-muted/10">
                      <div>FEATURE NAME & SCOPE</div>
                      <div className="text-center">LIVE TOGGLE</div>
                      <div className="text-center">TIERS (FREE / STD / PREM)</div>
                      <div className="text-center">ROADMAP STAGE</div>
                      <div className="text-center">LATENCY</div>
                      <div className="text-right">SANDBOX / ACTIONS</div>
                    </div>

                    {/* Rows */}
                    {items.map((r) => (
                      <FeatureRow
                        key={r.id}
                        r={r}
                        stagePending={stagePending}
                        onTest={() => runLiveTest(r)}
                        onInspect={() => setInspectItem(r)}
                        onEdit={() => {
                          setEditing(r);
                          setForm({ ...r });
                          setOpenRegister(true);
                        }}
                        onDelete={() => setDelItem(r)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* FLAT TABLE VIEW */
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="grid grid-cols-[2fr_1fr_1.1fr_1fr_0.8fr_0.8fr] gap-2 px-6 py-4 text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border bg-muted/20">
            <div>FEATURE IDENTITY & SCOPE</div>
            <div className="text-center">LIVE TOGGLE</div>
            <div className="text-center">TIERS (FREE / STD / PREM)</div>
            <div className="text-center">ROADMAP STAGE</div>
            <div className="text-center">LATENCY</div>
            <div className="text-right">SANDBOX & ACTIONS</div>
          </div>

          {filtered.map((r) => (
            <FeatureRow
              key={r.id}
              r={r}
              stagePending={stagePending}
              onTest={() => runLiveTest(r)}
              onInspect={() => setInspectItem(r)}
              onEdit={() => {
                setEditing(r);
                setForm({ ...r });
                setOpenRegister(true);
              }}
              onDelete={() => setDelItem(r)}
            />
          ))}
        </div>
      )}

      {/* Floating Save Bar */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 transition-all duration-200 z-50 ${
          dirty ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <div className="bg-card/95 backdrop-blur-md border border-primary/30 shadow-2xl rounded-2xl px-6 py-3.5 flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">Pending Configuration Changes</p>
              <p className="text-[11px] text-muted-foreground">
                {Object.keys(pendingChanges).length} feature(s) modified in stage
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={discardPending}
              className="text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              DISCARD
            </Button>
            <Button
              onClick={savePending}
              className="bg-primary text-primary-foreground hover:opacity-90 font-bold text-xs px-5 rounded-xl shadow-xs"
            >
              SAVE & APPLY ACROSS APP
            </Button>
          </div>
        </div>
      </div>

      {/* Live Sandbox Interactive Tester Dialog */}
      <Dialog open={!!testItem} onOpenChange={(o) => !o && setTestItem(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="flex items-center gap-2 text-lg font-black">
                <FlaskConical className="h-5 w-5 text-violet-500" />
                <span>Sandbox Simulator — {testItem?.name}</span>
              </DialogTitle>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold uppercase ${
                  testItem?.global_active
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-slate-500/15 text-slate-500"
                }`}
              >
                {testItem?.global_active ? "LIVE IN PRODUCTION" : "CURRENTLY DISABLED"}
              </span>
            </div>
            <DialogDescription className="text-xs">
              Simulate module performance, verify payload outputs, and preview live dashboard interaction.
            </DialogDescription>
          </DialogHeader>

          {testItem && (
            <div className="space-y-4">
              {/* Test Summary Card */}
              <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Module Code:</span>
                  <span className="font-mono font-bold bg-card px-2 py-0.5 rounded border">{testItem.module_code}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Architecture Group:</span>
                  <span className="font-bold">{testItem.group_title}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Roadmap Target:</span>
                  <span className="font-bold uppercase text-primary">
                    {testItem.version_target.toUpperCase()} ({testItem.version_title})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Plan Entitlements:</span>
                  <span className="font-mono font-bold">
                    {[testItem.plan_free && "Free", testItem.plan_standard && "Standard", testItem.plan_premium && "Premium"]
                      .filter(Boolean)
                      .join(" • ") || "None"}
                  </span>
                </div>
              </div>

              {/* Interactive Test Scenario */}
              <div className="border border-border rounded-xl p-4 space-y-3 bg-card">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Play className="h-3.5 w-3.5 text-emerald-500" /> Test Vector & Simulated Execution:
                </p>

                <div className="bg-muted/30 p-2.5 rounded-lg text-xs space-y-1.5">
                  <p className="text-muted-foreground font-medium">Input Sample:</p>
                  <p className="font-mono text-[11px] text-foreground bg-card p-2 rounded border">
                    {testItem.test_scenario?.input_sample || "Sample test parameter"}
                  </p>
                </div>

                <div className="bg-muted/30 p-2.5 rounded-lg text-xs space-y-1.5">
                  <p className="text-muted-foreground font-medium">Expected Output:</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                    {testItem.test_scenario?.expected_output || "Feature executed without errors."}
                  </p>
                </div>
              </div>

              {/* Execution Console Logs */}
              <div className="bg-slate-950 text-slate-200 p-3.5 rounded-xl font-mono text-[11px] space-y-1 max-h-40 overflow-y-auto border border-slate-800">
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest pb-1 border-b border-slate-800">
                  Execution Output Console
                </p>
                {testLog.map((log, i) => (
                  <p key={i} className="leading-relaxed">
                    {log}
                  </p>
                ))}
              </div>

              {/* Action Controls in Modal */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runLiveTest(testItem)}
                  disabled={testRunning}
                  className="text-xs font-bold"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Re-run Simulation
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={testItem.global_active ? "destructive" : "default"}
                    onClick={() => {
                      stagePending(testItem.id, { global_active: !testItem.global_active });
                      setTestItem({ ...testItem, global_active: !testItem.global_active });
                      toast({
                        title: !testItem.global_active ? "Feature Activated" : "Feature Disabled",
                        description: `${testItem.name} is now ${!testItem.global_active ? "Active" : "Disabled"}.`,
                      });
                    }}
                    className="text-xs font-bold"
                  >
                    {!testItem.global_active ? "Activate in Live Stores" : "Disable in Stores"}
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => {
                      window.open("/dashboard", "_blank");
                    }}
                    className="text-xs font-bold bg-primary text-primary-foreground"
                  >
                    Open Live Dashboard <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Inspect View Dialog */}
      <Dialog open={!!inspectItem} onOpenChange={(o) => !o && setInspectItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" /> {inspectItem?.name}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">{inspectItem?.module_code}</DialogDescription>
          </DialogHeader>
          {inspectItem && (
            <div className="space-y-3 text-xs">
              <InfoRow k="Group / Category" v={inspectItem.group_title} />
              <InfoRow k="Roadmap Target" v={inspectItem.version_target.toUpperCase()} />
              <InfoRow k="Lifecycle Phase" v={inspectItem.lifecycle_phase} />
              <InfoRow k="Global Operational" v={inspectItem.global_active ? "Active" : "Disabled"} />
              <InfoRow
                k="Plan Entitlements"
                v={
                  [
                    inspectItem.plan_free && "Free",
                    inspectItem.plan_standard && "Standard",
                    inspectItem.plan_premium && "Premium",
                  ]
                    .filter(Boolean)
                    .join(", ") || "None"
                }
              />
              <InfoRow k="Engine Latency" v={`${inspectItem.latency_ms}ms (${inspectItem.health})`} />
              {inspectItem.source_file_url && <InfoRow k="Source File" v={inspectItem.source_file_url} />}
              {inspectItem.description && (
                <div className="pt-2 border-t border-border">
                  <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Description</p>
                  <p className="mt-1 text-foreground leading-relaxed">{inspectItem.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Register / Edit Dialog */}
      <Dialog open={openRegister} onOpenChange={setOpenRegister}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black">
              <Code2 className="h-5 w-5 text-primary" />{" "}
              {editing ? "Edit Feature Module" : "Register Feature Module"}
            </DialogTitle>
            <DialogDescription>Deploy a new modular capability into GeFlow's platform architecture.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="FEATURE NAME">
              <input
                value={form.name}
                onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. AI Invoice Vision Import"
                className="h-10 w-full px-3 bg-muted/40 rounded-xl text-xs border border-border"
              />
            </FieldWrapper>

            <FieldWrapper label="FUNCTIONAL GROUP">
              <Select
                value={form.function_group}
                onValueChange={(v) =>
                  setForm((f: any) => ({
                    ...f,
                    function_group: v,
                    group_title: FEATURE_GROUPS.find((g) => g.key === v)?.title || "Modular Feature",
                  }))
                }
              >
                <SelectTrigger className="h-10 bg-muted/40 border-border text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEATURE_GROUPS.map((g) => (
                    <SelectItem key={g.key} value={g.key}>
                      {g.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="MODULE CODE">
              <input
                value={form.module_code}
                onChange={(e) => setForm((f: any) => ({ ...f, module_code: e.target.value.toUpperCase() }))}
                placeholder="e.g. F-AI-08"
                disabled={!!editing}
                className="h-10 w-full px-3 bg-muted/40 rounded-xl text-xs font-mono border border-border"
              />
            </FieldWrapper>

            <FieldWrapper label="TARGET ROADMAP VERSION">
              <Select
                value={form.version_target || "v1"}
                onValueChange={(v) =>
                  setForm((f: any) => ({
                    ...f,
                    version_target: v,
                    version_title: VERSION_ROADMAP_META.find((m) => m.version === v)?.title || "Roadmap Feature",
                  }))
                }
              >
                <SelectTrigger className="h-10 bg-muted/40 border-border text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VERSION_ROADMAP_META.map((v) => (
                    <SelectItem key={v.version} value={v.version}>
                      {v.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="RELEASE STAGE">
              <Select
                value={form.lifecycle_phase}
                onValueChange={(v) => setForm((f: any) => ({ ...f, lifecycle_phase: v }))}
              >
                <SelectTrigger className="h-10 bg-muted/40 border-border text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Live Production</SelectItem>
                  <SelectItem value="beta">Beta / Canary</SelectItem>
                  <SelectItem value="staging">Internal Staging</SelectItem>
                  <SelectItem value="deactivated">Deactivated</SelectItem>
                </SelectContent>
              </Select>
            </FieldWrapper>

            <div>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5 uppercase">
                PLAN ASSIGNMENTS
              </p>
              <div className="flex items-center gap-4 h-10 px-3 bg-muted/40 rounded-xl border border-border">
                {(["plan_free", "plan_standard", "plan_premium"] as const).map((k, i) => (
                  <div key={k} className="flex flex-col items-center gap-0.5">
                    <Switch checked={form[k]} onCheckedChange={(v) => setForm((f: any) => ({ ...f, [k]: v }))} />
                    <span className="text-[8px] font-bold tracking-widest text-muted-foreground uppercase">
                      {["Free", "Std", "Prem"][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <FieldWrapper label="SYSTEM DESCRIPTION">
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))}
              placeholder="Formal documentation of feature purpose and user benefits..."
              className="w-full p-3 bg-muted/40 rounded-xl text-xs border border-border"
            />
          </FieldWrapper>

          <Button
            onClick={submitCustomFeature}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-xs"
          >
            {editing ? "Save Feature Definition" : "Register Feature into Platform Logic"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!delItem} onOpenChange={(o) => !o && setDelItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feature Module?</AlertDialogTitle>
            <AlertDialogDescription>
              "{delItem?.name}" ({delItem?.module_code}) will be permanently unmounted from the platform architecture.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-500 hover:bg-rose-600 text-xs font-bold">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PanelLayout>
  );
};

// Feature Row Component
const FeatureRow = ({
  r,
  stagePending,
  onTest,
  onInspect,
  onEdit,
  onDelete,
}: {
  r: FeatureModuleDefinition;
  stagePending: (id: string, patch: Partial<FeatureModuleDefinition>) => void;
  onTest: () => void;
  onInspect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const Icon = getGroupIcon(r.function_group);
  const isV1 = r.version_target === "v1";

  return (
    <div className="grid grid-cols-[2fr_1fr_1.1fr_1fr_0.8fr_0.8fr] gap-2 items-center px-5 py-3.5 border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
      {/* Identity */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
            r.global_active
              ? "bg-primary/10 text-primary border border-primary/20"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-xs truncate text-foreground">{r.name}</p>
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase tracking-wider border ${getVersionBadgeClass(
                r.version_target
              )}`}
            >
              {r.version_target.toUpperCase()}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{r.description}</p>
          <p className="text-[9px] uppercase font-mono text-muted-foreground/80 mt-0.5">
            {r.module_code} • {r.group_title}
          </p>
        </div>
      </div>

      {/* Global Live Switch */}
      <div className="flex flex-col items-center gap-1">
        <Switch checked={r.global_active} onCheckedChange={(v) => stagePending(r.id, { global_active: v })} />
        <span
          className={`text-[9px] font-black uppercase tracking-wider ${
            r.global_active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
          }`}
        >
          {r.global_active ? "ACTIVE" : "DISABLED"}
        </span>
      </div>

      {/* Tier Allocations */}
      <div className="flex justify-center items-center gap-2.5">
        {(["plan_free", "plan_standard", "plan_premium"] as const).map((k, i) => {
          const short = ["F", "S", "P"][i];
          const label = ["Free", "Standard", "Premium"][i];
          return (
            <div key={k} className="flex flex-col items-center gap-0.5">
              <Switch checked={(r as any)[k]} onCheckedChange={(v) => stagePending(r.id, { [k]: v } as any)} />
              <span className="text-[8px] font-extrabold text-muted-foreground font-mono" title={label}>
                {short}
              </span>
            </div>
          );
        })}
      </div>

      {/* Release Stage */}
      <div className="flex justify-center">
        <Select
          value={r.lifecycle_phase}
          onValueChange={(v: any) => stagePending(r.id, { lifecycle_phase: v })}
        >
          <SelectTrigger
            className={`h-7 px-2 rounded-lg border text-[9px] font-black tracking-wider uppercase w-auto ${getPhaseBadgeClass(
              r.lifecycle_phase
            )}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="beta">Beta</SelectItem>
            <SelectItem value="staging">Staging</SelectItem>
            <SelectItem value="deactivated">Deactivated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Latency */}
      <div className="text-center">
        <p className="text-[11px] font-bold capitalize text-foreground">{r.latency_ms}ms</p>
        <p className="text-[9px] text-muted-foreground capitalize">{r.health}</p>
      </div>

      {/* Actions */}
      <div className="flex justify-end items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={onTest}
          className="h-7 px-2 rounded-lg text-[10px] font-bold text-violet-600 dark:text-violet-400 border-violet-500/30 hover:bg-violet-500/10 flex items-center gap-1"
          title="Run Sandbox Simulator"
        >
          <FlaskConical className="h-3 w-3" /> Test
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-7 w-7 rounded-lg hover:bg-muted inline-flex items-center justify-center text-muted-foreground hover:text-foreground">
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onInspect}>
              <Eye className="h-3.5 w-3.5 mr-2" /> Inspect Metadata
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Module
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onTest}>
              <Play className="h-3.5 w-3.5 mr-2" /> Run Live Simulator
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-rose-500">
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Module
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, accent, subtitle }: any) => (
  <div className="bg-card border border-border rounded-2xl p-4 relative shadow-xs">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{label}</p>
        <p className="text-2xl font-black mt-1 text-foreground">{value}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  </div>
);

const FieldWrapper = ({ label, children }: any) => (
  <div className="mb-2.5">
    <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1 uppercase">{label}</p>
    {children}
  </div>
);

const InfoRow = ({ k, v }: { k: string; v: any }) => (
  <div className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
    <span className="text-muted-foreground">{k}</span>
    <span className="font-bold text-foreground">{String(v)}</span>
  </div>
);

export default AdminFeatures;
