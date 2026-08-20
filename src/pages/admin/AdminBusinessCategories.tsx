import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PanelLayout from "@/components/PanelLayout";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Filter, Tag, MoreVertical, Eye, Pencil, Trash2, Loader2,
  LayoutDashboard, Package, ShoppingCart, ShoppingBag, FileText, BarChart3, Users, Settings,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CategoryRow {
  id: string;
  name: string;
  industry_type: string;
  internal_description: string | null;
  status: string;
  enabled_modules: string[];
  enabled_features: string[];
  default_tax: number;
  currency: string;
  stock_alert_limit: number;
  created_at: string;
}

const INDUSTRIES = [
  "Pharmacy", "Supermarket", "Warehouse", "Electronics", "Restaurant", "Salon",
  "Repair Shop", "Office", "Retail", "Wholesale", "Boutique", "Bakery", "Hardware", "Other",
];
const MODULES = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "pos", label: "POS Terminal", icon: ShoppingCart },
  { id: "purchases", label: "Purchases", icon: ShoppingBag },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "team", label: "Team Hub", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];
const FEATURES = [
  { id: "barcode", label: "Barcode System" },
  { id: "supplier", label: "Supplier Management" },
  { id: "discount", label: "Discount System" },
  { id: "lowstock", label: "Low Stock Alerts" },
  { id: "expiry", label: "Expiry Tracking" },
  { id: "batch", label: "Batch Tracking" },
  { id: "warranty", label: "Warranty Tracking" },
  { id: "service", label: "Service Logs" },
  { id: "appointment", label: "Appointment System" },
  { id: "ingredient", label: "Ingredient Tracking" },
  { id: "asset", label: "Asset Tracking" },
];
import { CURRENCY_CODES, currencyLabel } from "@/lib/currencies";

const CURRENCIES = CURRENCY_CODES;

interface FormState {
  name: string;
  industry_type: string;
  internal_description: string;
  status: string;
  enabled_modules: string[];
  enabled_features: string[];
  default_tax: number;
  currency: string;
  stock_alert_limit: number;
}
const blankForm = (): FormState => ({
  name: "", industry_type: "", internal_description: "", status: "active",
  enabled_modules: ["dashboard", "inventory"], enabled_features: [],
  default_tax: 0, currency: "USD", stock_alert_limit: 10,
});

const AdminBusinessCategories = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [orgsByCat, setOrgsByCat] = useState<Record<string, number>>({});

  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm());
  const [busy, setBusy] = useState(false);

  const [view, setView] = useState<CategoryRow | null>(null);
  const [del, setDel] = useState<CategoryRow | null>(null);

  const load = useCallback(async () => {
    const [{ data, error }, { data: biz }, { data: notes }] = await Promise.all([
      supabase.from("business_categories").select("*").order("created_at", { ascending: false }),
      supabase.from("businesses").select("category_id"),
      supabase.from("business_category_internal").select("category_id, internal_description"),
    ]);
    if (error) toast({ title: "Failed to load categories", description: error.message, variant: "destructive" });
    const noteMap: Record<string, string | null> = {};
    (notes ?? []).forEach((n: any) => { noteMap[n.category_id] = n.internal_description; });
    setRows(((data as any[]) ?? []).map((r) => ({ ...r, internal_description: noteMap[r.id] ?? null })) as CategoryRow[]);
    const tally: Record<string, number> = {};
    (biz ?? []).forEach((b: any) => { if (b.category_id) tally[b.category_id] = (tally[b.category_id] ?? 0) + 1; });
    setOrgsByCat(tally);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin_categories_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "business_categories" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "business_category_internal" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "businesses" }, load)
      .subscribe();
    const onR = () => load();
    window.addEventListener("panel:refresh", onR);
    return () => { supabase.removeChannel(ch); window.removeEventListener("panel:refresh", onR); };
  }, [load]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (industryFilter !== "all" && r.industry_type !== industryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.industry_type.toLowerCase().includes(q);
    }
    return true;
  }), [rows, search, statusFilter, industryFilter]);

  const openCreate = () => { setEditing(null); setForm(blankForm()); setOpenForm(true); };
  const openEdit = (r: CategoryRow) => {
    setEditing(r);
    setForm({
      name: r.name, industry_type: r.industry_type, internal_description: r.internal_description ?? "",
      status: r.status, enabled_modules: r.enabled_modules ?? [], enabled_features: r.enabled_features ?? [],
      default_tax: Number(r.default_tax) || 0, currency: r.currency, stock_alert_limit: r.stock_alert_limit,
    });
    setOpenForm(true);
  };

  const toggleArr = (key: "enabled_modules" | "enabled_features", id: string) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }));

  const submit = async () => {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    if (!form.industry_type) { toast({ title: "Industry is required", variant: "destructive" }); return; }
    setBusy(true);
    const internalNote = form.internal_description.trim() || null;
    const payload = {
      name: form.name.trim(), industry_type: form.industry_type,
      status: form.status, enabled_modules: form.enabled_modules, enabled_features: form.enabled_features,
      default_tax: form.default_tax, currency: form.currency, stock_alert_limit: form.stock_alert_limit,
    };
    let error;
    let categoryId = editing?.id;
    if (editing) {
      ({ error } = await supabase.from("business_categories").update(payload).eq("id", editing.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await supabase
        .from("business_categories")
        .insert({ ...payload, created_by_user_id: user!.id })
        .select("id")
        .single();
      error = res.error;
      categoryId = res.data?.id;
    }
    if (!error && categoryId) {
      const { error: noteErr } = await supabase
        .from("business_category_internal")
        .upsert({ category_id: categoryId, internal_description: internalNote, updated_at: new Date().toISOString() });
      if (noteErr) error = noteErr;
    }
    setBusy(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Category updated" : "Category created" });
    setOpenForm(false);
  };


  const confirmDelete = async () => {
    if (!del) return;
    setBusy(true);
    const { error } = await supabase.from("business_categories").delete().eq("id", del.id);
    setBusy(false);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Category deleted" });
    setDel(null);
  };

  return (
    <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY} isAdmin>
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl md:text-4xl font-bold">Business Categories</h1>
            <Badge className="bg-sky-400/15 text-sky-500 hover:bg-sky-400/15 text-[10px] tracking-widest font-bold">
              {rows.length} ARCHITECTURAL BLUEPRINTS
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Define real-world business models and provision specialized module payloads.</p>
        </div>
        <Button onClick={openCreate} className="h-10 px-5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 hover:opacity-90 text-white font-bold shadow-lg shadow-sky-500/30">
          <Plus className="h-4 w-4 mr-2" /> Add New Category
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter blueprints by name or type..."
            className="h-12 w-full pl-11 pr-4 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-12 px-5 rounded-xl bg-card border border-border text-sm font-bold inline-flex items-center gap-2 hover:bg-muted">
              <Filter className="h-4 w-4 text-sky-500" /> Filter Matrix
              {(statusFilter !== "all" || industryFilter !== "all") && <span className="h-2 w-2 rounded-full bg-sky-500" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-3">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">STATUS</p>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 mb-3"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">INDUSTRY</p>
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="h-9 mb-3"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All industries</SelectItem>
                {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
            <button
              onClick={() => { setStatusFilter("all"); setIndustryFilter("all"); }}
              className="w-full h-9 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted"
            >Clear filters</button>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border bg-muted/20">
                <th className="text-left px-6 py-4">BLUEPRINT / IDENTITY</th>
                <th className="text-center px-4 py-4">MODULES</th>
                <th className="text-left px-4 py-4">FEATURES</th>
                <th className="text-center px-4 py-4">ORGS USING</th>
                <th className="text-left px-4 py-4">STATUS</th>
                <th className="text-right px-6 py-4">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">No business categories yet — create your first blueprint.</td></tr>
              ) : filtered.map((r, idx) => {
                const cid = `CAT-${String(idx + 1).padStart(3, "0")}`;
                const modIcons = (r.enabled_modules ?? []).slice(0, 4);
                const more = Math.max(0, (r.enabled_modules?.length ?? 0) - 4);
                const featChips = (r.enabled_features ?? []).slice(0, 3);
                const featMore = Math.max(0, (r.enabled_features?.length ?? 0) - 3);
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-sky-400/15 text-sky-500 flex items-center justify-center"><Tag className="h-5 w-5" /></div>
                        <div>
                          <p className="font-bold">{r.name}</p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <span className="uppercase tracking-wider">{r.industry_type}</span>
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                            <span className="font-mono bg-muted px-1.5 rounded">{cid}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        {modIcons.map((m) => {
                          const def = MODULES.find((x) => x.id === m);
                          const Icon = def?.icon ?? LayoutDashboard;
                          return <span key={m} title={def?.label} className="h-7 w-7 rounded-md bg-sky-400/10 text-sky-500 flex items-center justify-center"><Icon className="h-3.5 w-3.5" /></span>;
                        })}
                        {more > 0 && <span className="h-7 px-2 rounded-md bg-muted text-[10px] font-bold flex items-center">+{more}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-1.5 max-w-[220px]">
                        {featChips.map((f) => <span key={f} className="px-2 py-0.5 rounded-md bg-sky-400/10 text-sky-500 text-[10px] font-bold uppercase tracking-wider">{FEATURES.find((x) => x.id === f)?.label.split(" ")[0] ?? f}</span>)}
                        {featMore > 0 && <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold">+{featMore}</span>}
                        {featChips.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <p className="text-2xl font-bold leading-none">{orgsByCat[r.id] ?? 0}</p>
                      <p className="text-[9px] tracking-widest text-muted-foreground font-bold mt-1">INSTANCES</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full uppercase ${
                        r.status === "active" ? "bg-emerald-400/15 text-emerald-500" : "bg-amber-400/15 text-amber-500"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${r.status === "active" ? "bg-emerald-500" : "bg-amber-500"}`} />
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 w-8 rounded-lg hover:bg-muted inline-flex items-center justify-center"><MoreVertical className="h-4 w-4" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setView(r)}><Eye className="h-4 w-4 mr-2" /> View Details</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(r)}><Pencil className="h-4 w-4 mr-2" /> Edit Blueprint</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDel(r)} className="text-rose-500 focus:text-rose-500"><Trash2 className="h-4 w-4 mr-2" /> Permanent Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Blueprint" : "Add New Category"}</DialogTitle>
            <DialogDescription>Architect a category — modules, features and operational defaults flow to every business that adopts it.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">BLUEPRINT IDENTITY</p>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold mb-1.5 block">Name *</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Advanced Pharmacy" />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1.5 block">Real-World Type *</label>
                  <Select value={form.industry_type} onValueChange={(v) => setForm({ ...form, industry_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                    <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3">
                <label className="text-xs font-bold mb-1.5 block">Internal Description</label>
                <Textarea value={form.internal_description} onChange={(e) => setForm({ ...form, internal_description: e.target.value })} rows={2} placeholder="Why this blueprint exists, what it ships with..." />
              </div>
              <div className="mt-3">
                <label className="text-xs font-bold mb-1.5 block">Status</label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">ENABLE MODULE PAYLOAD</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {MODULES.map((m) => {
                  const on = form.enabled_modules.includes(m.id);
                  const Icon = m.icon;
                  return (
                    <button key={m.id} type="button" onClick={() => toggleArr("enabled_modules", m.id)}
                      className={`p-3 rounded-xl border text-left transition ${on ? "border-sky-500 bg-sky-500/10" : "border-border bg-card hover:bg-muted/40"}`}>
                      <Icon className={`h-4 w-4 mb-1.5 ${on ? "text-sky-500" : "text-muted-foreground"}`} />
                      <p className="text-xs font-bold">{m.label}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">SPECIALIZED FEATURE CONFIGURATION</p>
              <div className="space-y-2">
                {FEATURES.map((f) => {
                  const on = form.enabled_features.includes(f.id);
                  return (
                    <div key={f.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card">
                      <span className="text-sm font-semibold">{f.label}</span>
                      <Switch checked={on} onCheckedChange={() => toggleArr("enabled_features", f.id)} />
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">OPERATIONAL DEFAULTS</p>
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold mb-1.5 block">Default Tax (%)</label>
                  <Input type="number" min={0} max={100} step="0.01" value={form.default_tax}
                    onChange={(e) => setForm({ ...form, default_tax: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1.5 block">Currency</label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{currencyLabel(c)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-bold mb-1.5 block">Stock Alert Limit</label>
                  <Input type="number" min={0} value={form.stock_alert_limit}
                    onChange={(e) => setForm({ ...form, stock_alert_limit: Number(e.target.value) })} />
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpenForm(false)} disabled={busy}>Discard Blueprint</Button>
            <Button onClick={submit} disabled={busy} className="bg-gradient-to-r from-sky-500 to-blue-500 text-white">
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Save Changes" : "Commit Category Logic"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-xl bg-sky-400/15 text-sky-500 flex items-center justify-center"><Tag className="h-6 w-6" /></div>
              <div>
                <DialogTitle>{view?.name}</DialogTitle>
                <DialogDescription className="font-mono text-xs">{view?.industry_type}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {view && (
            <div className="space-y-3 text-sm">
              <Row label="Internal Description" value={view.internal_description || "—"} />
              <Row label="Modules" value={(view.enabled_modules ?? []).map((m) => MODULES.find((x) => x.id === m)?.label ?? m).join(", ") || "—"} />
              <Row label="Features" value={(view.enabled_features ?? []).map((f) => FEATURES.find((x) => x.id === f)?.label ?? f).join(", ") || "—"} />
              <Row label="Default Tax" value={`${view.default_tax}%`} />
              <Row label="Currency" value={view.currency} />
              <Row label="Stock Alert Limit" value={view.stock_alert_limit} />
              <Row label="Orgs Using" value={orgsByCat[view.id] ?? 0} />
              <Row label="Status" value={<span className="capitalize">{view.status}</span>} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this category?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <span className="font-bold">{del?.name}</span> from the platform. Businesses already linked to it will keep their settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={busy} className="bg-rose-500 hover:bg-rose-600">
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Permanent Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PanelLayout>
  );
};

const Row = ({ label, value }: { label: string; value: any }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0">
    <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{label}</span>
    <span className="text-sm font-semibold text-right">{value}</span>
  </div>
);

export default AdminBusinessCategories;
