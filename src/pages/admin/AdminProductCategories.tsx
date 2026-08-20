import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PanelLayout from "@/components/PanelLayout";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, MoreVertical, Eye, Pencil, Trash2, Loader2, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CatRow {
  id: string; name: string; slug: string; parent_id: string | null; description: string | null;
  industry_assignments: string[]; inherit_expiry: boolean; inherit_batch: boolean;
  inherit_barcode: boolean; inherit_alerts: boolean; status: string; usage_count: number;
  created_at: string;
}
const INDUSTRIES = ["Pharmacy","Medical Store","Hospital Pharmacy","Grocery Store","Supermarket","Electronics Store","Mobile Shop","Restaurant","Retail","Wholesale","Hardware","Other"];
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");

interface Form { name: string; parent_id: string | null; industries: string[]; description: string; expiry: boolean; batch: boolean; barcode: boolean; alerts: boolean; }
const blank = (): Form => ({ name: "", parent_id: null, industries: [], description: "", expiry: false, batch: false, barcode: false, alerts: false });

const AdminProductCategories = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<CatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [form, setForm] = useState<Form>(blank());
  const [editing, setEditing] = useState<CatRow | null>(null);
  const [view, setView] = useState<CatRow | null>(null);
  const [del, setDel] = useState<CatRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("product_categories").select("*").order("created_at", { ascending: true });
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    setRows((data as CatRow[]) ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
    const ch = supabase.channel("admin_product_categories_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "product_categories" }, load).subscribe();
    const onR = () => load();
    window.addEventListener("panel:refresh", onR);
    return () => { supabase.removeChannel(ch); window.removeEventListener("panel:refresh", onR); };
  }, [load]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (industryFilter !== "all" && !r.industry_assignments.includes(industryFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q);
    }
    return true;
  }), [rows, search, industryFilter]);

  // Sort children right after parent for display
  const ordered = useMemo(() => {
    const parents = filtered.filter((r) => !r.parent_id);
    const result: { row: CatRow; depth: number }[] = [];
    const pushChildren = (pid: string, depth: number) => {
      filtered.filter((r) => r.parent_id === pid).forEach((c) => {
        result.push({ row: c, depth });
        pushChildren(c.id, depth + 1);
      });
    };
    parents.forEach((p) => { result.push({ row: p, depth: 0 }); pushChildren(p.id, 1); });
    // also include orphan rows where parent is filtered out
    filtered.forEach((r) => { if (!result.some((x) => x.row.id === r.id)) result.push({ row: r, depth: 0 }); });
    return result;
  }, [filtered]);

  const openEdit = (r: CatRow) => {
    setEditing(r);
    setForm({
      name: r.name, parent_id: r.parent_id, industries: r.industry_assignments, description: r.description ?? "",
      expiry: r.inherit_expiry, batch: r.inherit_batch, barcode: r.inherit_barcode, alerts: r.inherit_alerts,
    });
  };

  const submit = async () => {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setBusy(true);
    const baseSlug = slugify(form.name);
    const slug = editing ? editing.slug : `${baseSlug}-${Math.random().toString(36).slice(2,6)}`;
    const payload: any = {
      name: form.name.trim(), slug, parent_id: form.parent_id, description: form.description.trim() || null,
      industry_assignments: form.industries,
      inherit_expiry: form.expiry, inherit_batch: form.batch, inherit_barcode: form.barcode, inherit_alerts: form.alerts,
    };
    let error;
    if (editing) ({ error } = await supabase.from("product_categories").update(payload).eq("id", editing.id));
    else {
      const { data: { user } } = await supabase.auth.getUser();
      ({ error } = await supabase.from("product_categories").insert({ ...payload, created_by_user_id: user!.id }));
    }
    setBusy(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Category updated" : "Category created" });
    setEditing(null); setForm(blank());
  };

  const confirmDelete = async () => {
    if (!del) return;
    setBusy(true);
    const { error } = await supabase.from("product_categories").delete().eq("id", del.id);
    setBusy(false);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Category deleted" });
    setDel(null);
  };

  const toggleIndustry = (i: string) =>
    setForm((f) => ({ ...f, industries: f.industries.includes(i) ? f.industries.filter((x) => x !== i) : [...f.industries, i] }));

  return (
    <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY} isAdmin>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl md:text-4xl font-bold">Product Categories</h1>
          <Badge className="bg-sky-400/15 text-sky-500 hover:bg-sky-400/15 text-[10px] tracking-widest font-bold">{rows.length} TAXONOMY NODES</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Standardize how businesses organize their inventory using WordPress-style management.</p>
      </div>

      <div className="grid lg:grid-cols-[420px_1fr] gap-6">
        {/* LEFT: Add / Edit form */}
        <div className="bg-card border border-border rounded-2xl p-6 h-fit">
          <div className="flex items-center gap-2 mb-1">
            <Plus className="h-5 w-5 text-sky-500" />
            <h2 className="text-lg font-bold">{editing ? "Edit Category" : "Add New Category"}</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5">Create a new taxonomy node for the platform.</p>

          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">NAME</p>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Tablets"
                className="h-11 w-full px-4 bg-muted/40 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <p className="text-[11px] text-muted-foreground mt-1.5">The name is how it appears on your site.</p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">PARENT CATEGORY</p>
              <Select value={form.parent_id ?? "none"} onValueChange={(v) => setForm((f) => ({ ...f, parent_id: v === "none" ? null : v }))}>
                <SelectTrigger className="h-11 bg-muted/40 border-0 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Root)</SelectItem>
                  {rows.filter((r) => !editing || r.id !== editing.id).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1.5">Assign a parent term to create a hierarchy.</p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">INDUSTRY ASSIGNMENT</p>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {INDUSTRIES.map((i) => {
                  const on = form.industries.includes(i);
                  return (
                    <button key={i} type="button" onClick={() => toggleIndustry(i)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition ${on ? "bg-sky-400/15 text-sky-500" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}>
                      {i}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">DESCRIPTION</p>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief metadata..." rows={3}
                className="w-full px-4 py-3 bg-muted/40 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>

            <div className="border-t border-dashed border-border pt-5">
              <p className="text-[10px] font-bold tracking-widest text-sky-500 mb-3">INHERITED LOGIC</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["EXPIRY", "expiry"], ["BATCH", "batch"], ["BARCODE", "barcode"], ["ALERTS", "alerts"],
                ].map(([lbl, k]) => (
                  <div key={k} className="flex items-center justify-between bg-muted/40 px-3 py-2.5 rounded-lg">
                    <span className="text-[10px] font-bold tracking-widest text-muted-foreground">{lbl}</span>
                    <Switch checked={(form as any)[k]} onCheckedChange={(v) => setForm((f) => ({ ...f, [k]: v } as any))} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={submit} disabled={busy} className="flex-1 h-12 rounded-xl bg-sky-400 hover:bg-sky-500 text-white font-bold tracking-wider">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "SAVE CHANGES" : "ADD NEW CATEGORY"}
              </Button>
              {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm(blank()); }} className="h-12 rounded-xl">Cancel</Button>}
            </div>
          </div>
        </div>

        {/* RIGHT: Listing */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories..."
                className="h-12 w-full pl-11 pr-4 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="h-12 w-48 bg-card border border-border rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border bg-muted/20">
                    <th className="text-left px-6 py-4">NAME</th>
                    <th className="text-left px-4 py-4">INDUSTRY REACH</th>
                    <th className="text-right px-4 py-4">USAGE</th>
                    <th className="text-right px-6 py-4">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
                  ) : ordered.length === 0 ? (
                    <tr><td colSpan={4} className="p-12 text-center text-muted-foreground">No product categories yet.</td></tr>
                  ) : ordered.map(({ row: r, depth }, idx) => {
                    const code = `PCAT-${String(idx + 1).padStart(3, "0")}`;
                    const reach = r.industry_assignments.slice(0, 2);
                    const more = Math.max(0, r.industry_assignments.length - 2);
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition">
                        <td className="px-6 py-4">
                          <div style={{ paddingLeft: depth * 18 }} className="flex items-center gap-2">
                            {depth > 0 && <span className="text-muted-foreground">↳</span>}
                            <div>
                              <p className="font-bold">{r.name}</p>
                              <p className="text-[10px] font-mono text-muted-foreground tracking-wider mt-0.5">{code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {reach.map((i) => <span key={i} className="px-2 py-0.5 rounded-md bg-sky-400/10 text-sky-500 text-[10px] font-bold uppercase tracking-wider">{i}</span>)}
                            {more > 0 && <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold">+{more}</span>}
                            {reach.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right font-bold">{r.usage_count}</td>
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
        </div>
      </div>

      {/* View dialog */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Layers className="h-5 w-5 text-sky-500" /> {view?.name}</DialogTitle>
            <DialogDescription>{view?.description || "No description provided."}</DialogDescription>
          </DialogHeader>
          {view && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/40 rounded-lg p-3"><p className="text-[10px] font-bold tracking-widest text-muted-foreground">SLUG</p><p className="font-mono text-xs mt-1">{view.slug}</p></div>
                <div className="bg-muted/40 rounded-lg p-3"><p className="text-[10px] font-bold tracking-widest text-muted-foreground">USAGE</p><p className="font-bold mt-1">{view.usage_count}</p></div>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">INDUSTRY REACH</p>
                <div className="flex flex-wrap gap-1.5">
                  {view.industry_assignments.length === 0 ? <span className="text-xs text-muted-foreground">—</span> :
                    view.industry_assignments.map((i) => <span key={i} className="px-2 py-0.5 rounded-md bg-sky-400/10 text-sky-500 text-[10px] font-bold uppercase tracking-wider">{i}</span>)}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">INHERITED LOGIC</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[["Expiry", view.inherit_expiry], ["Batch", view.inherit_batch], ["Barcode", view.inherit_barcode], ["Alerts", view.inherit_alerts]].map(([k, v]) => (
                    <div key={k as string} className="flex items-center justify-between bg-muted/40 px-3 py-2 rounded-lg">
                      <span>{k as string}</span>
                      <span className={(v ? "text-emerald-500" : "text-muted-foreground") + " font-bold"}>{v ? "ON" : "OFF"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete category?</AlertDialogTitle>
            <AlertDialogDescription>This will remove "{del?.name}" from the platform. Subcategories will become root nodes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-500 hover:bg-rose-600">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PanelLayout>
  );
};

export default AdminProductCategories;
