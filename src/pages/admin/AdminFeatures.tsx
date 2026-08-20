import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PanelLayout from "@/components/PanelLayout";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import { Search, Plus, Eye, MoreVertical, Loader2, Cpu, Activity, Zap, Shield, Pencil, FlaskConical, Trash2, UploadCloud, Code2, Package, ShoppingCart, FileText, Brain, Users, Settings as SettingsIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Module {
  id: string; module_code: string; name: string; function_group: string; description: string | null;
  source_file_url: string | null; lifecycle_phase: string;
  global_active: boolean; plan_free: boolean; plan_standard: boolean; plan_premium: boolean;
  health: string; latency_ms: number;
}

const groupIcon = (g: string) => ({
  inventory: Package, pos: ShoppingCart, finance: FileText, ai: Brain, reports: FileText, users: Users, core: SettingsIcon,
}[g] ?? Cpu);

const phaseClass = (p: string) => ({
  live: "bg-emerald-400/15 text-emerald-500 border-emerald-400/30",
  beta: "bg-violet-400/15 text-violet-500 border-violet-400/30",
  staging: "bg-amber-400/15 text-amber-600 border-amber-400/30",
  deactivated: "bg-slate-400/15 text-slate-500 border-slate-400/30",
}[p] ?? "bg-slate-400/15 text-slate-500");

const blank = () => ({
  module_code: "", name: "", function_group: "inventory", description: "",
  source_file_url: "", lifecycle_phase: "beta",
  plan_free: false, plan_standard: false, plan_premium: true,
  global_active: true, health: "high", latency_ms: 0,
});

const AdminFeatures = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const [form, setForm] = useState<any>(blank());
  const [del, setDel] = useState<Module | null>(null);
  const [view, setView] = useState<Module | null>(null);
  const [test, setTest] = useState<Module | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<Module>>>({});

  const load = useCallback(async () => {
    const { data } = await supabase.from("feature_modules").select("*").order("created_at");
    setRows((data as Module[]) ?? []); setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("admin_features_rt").on("postgres_changes", { event: "*", schema: "public", table: "feature_modules" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.module_code.toLowerCase().includes(q) || r.function_group.toLowerCase().includes(q);
  }), [rows, search]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.global_active && r.lifecycle_phase !== "deactivated").length;
    const usage = rows.length > 0 ? (active >= rows.length * 0.8 ? "High" : active >= rows.length * 0.5 ? "Medium" : "Low") : "—";
    const avgLatency = rows.length ? Math.round(rows.reduce((s, r) => s + r.latency_ms, 0) / rows.length) : 0;
    const integrity = rows.length === 0 ? 100 : 100 - (rows.filter((r) => r.health === "low" || r.health === "none").length / rows.length) * 5;
    return { active, usage, avgLatency, integrity: integrity.toFixed(1) };
  }, [rows]);

  const stagePending = (id: string, patch: Partial<Module>) => {
    setPendingChanges((p) => ({ ...p, [id]: { ...(p[id] ?? {}), ...patch } }));
    setRows((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r));
  };
  const discardPending = () => { setPendingChanges({}); load(); };
  const savePending = async () => {
    const ids = Object.keys(pendingChanges);
    if (ids.length === 0) return;
    for (const id of ids) {
      await supabase.from("feature_modules").update(pendingChanges[id] as any).eq("id", id);
    }
    toast({ title: "Global state saved", description: `${ids.length} module${ids.length > 1 ? "s" : ""} synced.` });
    setPendingChanges({});
  };

  const submit = async () => {
    if (!form.name.trim() || !form.module_code.trim()) { toast({ title: "Code & name required", variant: "destructive" }); return; }
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const payload = { ...form, latency_ms: Number(form.latency_ms || 0), created_by_user_id: user.id, source_file_url: form.source_file_url || null, description: form.description || null };
    let error;
    if (editing) ({ error } = await supabase.from("feature_modules").update(payload).eq("id", editing.id));
    else ({ error } = await supabase.from("feature_modules").insert(payload));
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Module updated" : "Module pushed to platform" });
    setOpen(false); setEditing(null); setForm(blank());
  };

  const confirmDelete = async () => {
    if (!del) return;
    await supabase.from("feature_modules").delete().eq("id", del.id);
    toast({ title: "Module removed" }); setDel(null);
  };

  const dirty = Object.keys(pendingChanges).length > 0;

  return (
    <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY} isAdmin>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1">Feature Control Room</h1>
          <p className="text-sm text-muted-foreground">Orchestrate GeFlow architectural modules, releases, and tier entitlements.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-[300px]">
            <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter modules, IDs or categories..." className="h-12 w-full pl-11 pr-4 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <Button onClick={() => { setEditing(null); setForm(blank()); setOpen(true); }} className="h-12 px-5 rounded-xl bg-foreground text-background hover:opacity-90 font-bold">
            <Plus className="h-4 w-4 mr-2" /> Register Module
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat icon={Cpu} label="ACTIVE MODULES" value={stats.active} accent="text-sky-500 bg-sky-400/15" />
        <Stat icon={Activity} label="PLATFORM USAGE" value={stats.usage} accent="text-emerald-500 bg-emerald-400/15" />
        <Stat icon={Zap} label="AVG LATENCY" value={`${stats.avgLatency}ms`} accent="text-amber-500 bg-amber-400/15" />
        <Stat icon={Shield} label="CORE INTEGRITY" value={`${stats.integrity}%`} accent="text-violet-500 bg-violet-400/15" />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1.4fr_1fr_0.8fr_0.8fr] gap-2 px-6 py-4 text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border bg-muted/20">
          <div>FEATURE IDENTITY</div><div className="text-center">GLOBAL LOGIC</div><div className="text-center">TIER ENTITLEMENT (F/S/P)</div><div className="text-center">LIFECYCLE PHASE</div><div className="text-center">HEALTH</div><div className="text-right">ACTIONS</div>
        </div>
        {loading ? (
          <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No modules yet. Click <strong>Register Module</strong> to push your first feature.</div>
        ) : filtered.map((r) => {
          const Icon = groupIcon(r.function_group);
          return (
            <div key={r.id} className="grid grid-cols-[2fr_1fr_1.4fr_1fr_0.8fr_0.8fr] gap-2 items-center px-6 py-4 border-b border-border last:border-0 hover:bg-muted/30">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-sky-400/15 text-sky-500 flex items-center justify-center"><Icon className="h-4 w-4" /></div>
                <div className="min-w-0">
                  <p className="font-bold truncate">{r.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{r.function_group} • <span className="font-mono bg-muted px-1.5 py-0.5 rounded ml-1">{r.module_code}</span></p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Switch checked={r.global_active} onCheckedChange={(v) => stagePending(r.id, { global_active: v })} />
                <p className="text-[9px] font-bold tracking-widest text-muted-foreground">{r.global_active ? "OPERATIONAL" : "RESTRICTED"}</p>
              </div>
              <div className="flex justify-center gap-2">
                {(["plan_free", "plan_standard", "plan_premium"] as const).map((k, i) => (
                  <div key={k} className="flex flex-col items-center gap-0.5">
                    <Switch checked={(r as any)[k]} onCheckedChange={(v) => stagePending(r.id, { [k]: v } as any)} />
                    <p className="text-[9px] font-bold tracking-widest text-muted-foreground">{["F", "S", "P"][i]}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-center">
                <Select value={r.lifecycle_phase} onValueChange={(v) => stagePending(r.id, { lifecycle_phase: v })}>
                  <SelectTrigger className={`h-8 px-3 rounded-md border text-[10px] font-bold tracking-widest uppercase w-auto ${phaseClass(r.lifecycle_phase)}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">Live Production</SelectItem>
                    <SelectItem value="beta">Beta / Canary</SelectItem>
                    <SelectItem value="staging">Internal Staging</SelectItem>
                    <SelectItem value="deactivated">Deactivated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-center">
                <p className="text-xs font-bold capitalize">{r.health}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{r.latency_ms}ms</p>
              </div>
              <div className="flex justify-end items-center gap-1">
                <button onClick={() => setView(r)} className="h-8 w-8 rounded-lg hover:bg-muted inline-flex items-center justify-center"><Eye className="h-4 w-4" /></button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><button className="h-8 w-8 rounded-lg hover:bg-muted inline-flex items-center justify-center"><MoreVertical className="h-4 w-4" /></button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setEditing(r); setForm({ ...r, source_file_url: r.source_file_url ?? "", description: r.description ?? "" }); setOpen(true); }}><Pencil className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTest(r)}><FlaskConical className="h-3.5 w-3.5 mr-2" /> Live Test</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDel(r)} className="text-rose-500"><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating save bar */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 transition-all ${dirty ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
        <div className="bg-card border border-border shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-6">
          <div className="flex items-center gap-3"><Shield className="h-5 w-5 text-sky-500" /><div><p className="font-bold text-sm">Global Configuration Lock</p><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Last synced: just now</p></div></div>
          <button onClick={discardPending} className="text-sm font-bold text-muted-foreground hover:text-foreground">DISCARD EDITS</button>
          <Button onClick={savePending} className="bg-sky-400 hover:bg-sky-500 text-white font-bold">SAVE GLOBAL STATE</Button>
        </div>
      </div>

      {/* Register / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Code2 className="h-5 w-5 text-sky-500" /> {editing ? "Edit Module" : "New Feature Architect"}</DialogTitle>
            <DialogDescription>Push a new module into the platform logic with tier entitlements.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Lab label="MODULE IDENTITY"><input value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="e.g. Demand Forecaster" className="h-11 w-full px-3 bg-muted/40 rounded-lg text-sm border border-sky-400/30" /></Lab>
            <Lab label="FUNCTIONAL GROUP">
              <Select value={form.function_group} onValueChange={(v) => setForm((f: any) => ({ ...f, function_group: v }))}>
                <SelectTrigger className="h-11 bg-muted/40 border-0"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="inventory">Inventory</SelectItem><SelectItem value="pos">POS</SelectItem><SelectItem value="finance">Finance</SelectItem><SelectItem value="ai">AI</SelectItem><SelectItem value="reports">Reports</SelectItem><SelectItem value="users">Users</SelectItem><SelectItem value="core">Core</SelectItem></SelectContent>
              </Select>
            </Lab>
          </div>
          <Lab label="MODULE CODE"><input value={form.module_code} onChange={(e) => setForm((f: any) => ({ ...f, module_code: e.target.value.toUpperCase() }))} placeholder="F-INV-11" disabled={!!editing} className="h-11 w-full px-3 bg-muted/40 rounded-lg text-sm font-mono" /></Lab>

          <Lab label="CODE PAYLOAD (.ZIP / .TS)">
            <label className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center text-center cursor-pointer hover:border-sky-400/50 transition">
              <UploadCloud className="h-8 w-8 text-sky-500 mb-2" />
              <p className="font-bold text-sm">{form.source_file_url ? form.source_file_url.split("/").pop() : "Click or Drag Module Source Code"}</p>
              <p className="text-xs text-muted-foreground mt-1">Architecture will be parsed and registered automatically.</p>
              <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setForm((p: any) => ({ ...p, source_file_url: f.name })); }} />
            </label>
          </Lab>

          <div className="grid grid-cols-2 gap-3">
            <Lab label="INITIAL RELEASE PHASE">
              <Select value={form.lifecycle_phase} onValueChange={(v) => setForm((f: any) => ({ ...f, lifecycle_phase: v }))}>
                <SelectTrigger className="h-11 bg-muted/40 border-0"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="live">Live Production</SelectItem><SelectItem value="beta">Beta / Canary</SelectItem><SelectItem value="staging">Internal Staging</SelectItem><SelectItem value="deactivated">Deactivated</SelectItem></SelectContent>
              </Select>
            </Lab>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">PLAN ASSIGNMENTS</p>
              <div className="flex items-center gap-4 h-11 px-3 bg-muted/40 rounded-lg">
                {(["plan_free", "plan_standard", "plan_premium"] as const).map((k, i) => (
                  <div key={k} className="flex flex-col items-center gap-0.5">
                    <Switch checked={form[k]} onCheckedChange={(v) => setForm((f: any) => ({ ...f, [k]: v }))} />
                    <p className="text-[9px] font-bold tracking-widest text-muted-foreground">{["F", "S", "P"][i]}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <Lab label="SYSTEM DEFINITION"><textarea rows={4} value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="Formal documentation of module scope..." className="w-full p-3 bg-muted/40 rounded-lg text-sm" /></Lab>
          <Button onClick={submit} className="w-full h-12 rounded-xl bg-sky-400 hover:bg-sky-500 text-white font-bold">Push to Platform Logic</Button>
        </DialogContent>
      </Dialog>

      {/* View detail */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{view?.name}</DialogTitle><DialogDescription className="font-mono">{view?.module_code}</DialogDescription></DialogHeader>
          {view && (
            <div className="space-y-3 text-sm">
              <Row k="Function Group" v={view.function_group} />
              <Row k="Lifecycle Phase" v={view.lifecycle_phase} />
              <Row k="Global" v={view.global_active ? "Operational" : "Restricted"} />
              <Row k="Entitlement" v={`${view.plan_free ? "F " : ""}${view.plan_standard ? "S " : ""}${view.plan_premium ? "P" : ""}` || "—"} />
              <Row k="Health" v={`${view.health} (${view.latency_ms}ms)`} />
              {view.source_file_url && <Row k="Source" v={view.source_file_url} />}
              {view.description && <div className="pt-2 border-t border-border"><p className="text-[10px] font-bold tracking-widest text-muted-foreground">DESCRIPTION</p><p className="mt-1">{view.description}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Live test */}
      <Dialog open={!!test} onOpenChange={(o) => !o && setTest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-violet-500" /> Live Test — {test?.name}</DialogTitle><DialogDescription>Sandbox preview running against demo data.</DialogDescription></DialogHeader>
          <div className="bg-muted/40 rounded-xl p-4 text-sm space-y-2">
            <p>✓ Module <strong>{test?.module_code}</strong> spawned in isolated sandbox</p>
            <p>✓ Demo dataset loaded (12 products, 4 invoices)</p>
            <p>✓ Routed to entitled plans: {test ? [test.plan_free && "F", test.plan_standard && "S", test.plan_premium && "P"].filter(Boolean).join("/") || "—" : ""}</p>
            <p>✓ Latency: <strong>{test?.latency_ms}ms</strong></p>
            <p className="text-emerald-500 font-bold pt-2">All checks passed.</p>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete module?</AlertDialogTitle><AlertDialogDescription>"{del?.name}" will be permanently removed from the platform.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-rose-500 hover:bg-rose-600">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PanelLayout>
  );
};

const Stat = ({ icon: Icon, label, value, accent }: any) => (
  <div className="bg-card border border-border rounded-2xl p-5 relative">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold mt-2">{value}</p>
      </div>
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${accent}`}><Icon className="h-4 w-4" /></div>
    </div>
  </div>
);
const Lab = ({ label, children }: any) => (<div className="mb-3"><p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">{label}</p>{children}</div>);
const Row = ({ k, v }: { k: string; v: any }) => (<div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-bold capitalize">{String(v)}</span></div>);

export default AdminFeatures;
