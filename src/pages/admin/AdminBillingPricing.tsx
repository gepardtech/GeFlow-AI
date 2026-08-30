import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PanelLayout from "@/components/PanelLayout";
import BillingTabs from "@/components/BillingTabs";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import { Plus, Pencil, Trash2, Loader2, Star, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface PlanRow {
  id: string; plan_key: string; name: string; tagline: string | null;
  monthly_price: number; yearly_price: number; lifetime_price: number;
  features: string[]; is_active: boolean; is_popular: boolean;
  payment_method_synced: boolean; sort_order: number;
  badge_text: string | null; badge_position: string; badge_cycle: string;
}

const blank = () => ({
  plan_key: "", name: "", tagline: "", monthly_price: 0, yearly_price: 0, lifetime_price: 0,
  features: "", is_active: true, is_popular: false, sort_order: 0,
  badge_text: "", badge_position: "top", badge_cycle: "all",
});

const AdminBillingPricing = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [form, setForm] = useState(blank());
  const [del, setDel] = useState<PlanRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("pricing_plans").select("*").order("sort_order");
    setRows((data as PlanRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel(`admin_pricing_rt_${Math.random().toString(36).slice(2)}`).on("postgres_changes", { event: "*", schema: "public", table: "pricing_plans" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const openCreate = () => { setEditing(null); setForm(blank()); setOpen(true); };
  const openEdit = (r: PlanRow) => {
    setEditing(r);
    setForm({
      plan_key: r.plan_key, name: r.name, tagline: r.tagline ?? "",
      monthly_price: r.monthly_price, yearly_price: r.yearly_price, lifetime_price: r.lifetime_price,
      features: (r.features ?? []).join("\n"), is_active: r.is_active, is_popular: r.is_popular, sort_order: r.sort_order,
      badge_text: r.badge_text ?? "", badge_position: r.badge_position ?? "top", badge_cycle: r.badge_cycle ?? "all",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.plan_key.trim()) { toast({ title: "Plan key and name required", variant: "destructive" }); return; }
    setBusy(true);
    const payload = {
      plan_key: form.plan_key.toLowerCase().trim(), name: form.name.trim(), tagline: form.tagline.trim() || null,
      monthly_price: Number(form.monthly_price), yearly_price: Number(form.yearly_price), lifetime_price: Number(form.lifetime_price),
      features: form.features.split("\n").map((s) => s.trim()).filter(Boolean),
      is_active: form.is_active, is_popular: form.is_popular, sort_order: Number(form.sort_order),
      badge_text: form.badge_text?.trim() || null, badge_position: form.badge_position, badge_cycle: form.badge_cycle,
    };
    let error;
    if (editing) ({ error } = await supabase.from("pricing_plans").update(payload).eq("id", editing.id));
    else ({ error } = await supabase.from("pricing_plans").insert(payload));
    setBusy(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Plan updated" : "Plan created" });
    setOpen(false);
  };

  const confirmDelete = async () => {
    if (!del) return;
    const { error } = await supabase.from("pricing_plans").delete().eq("id", del.id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Plan deleted" });
    setDel(null);
  };

  const anySynced = rows.some((r) => r.payment_method_synced);

  return (
    <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY} isAdmin>
      <BillingTabs />

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Pricing Plans</h2>
          <p className="text-sm text-muted-foreground">Edit tiers shown on the landing page, checkout and user upgrade screens.</p>
        </div>
        <Button onClick={openCreate} className="h-11 rounded-xl bg-sky-400 hover:bg-sky-500 text-white font-bold">
          <Plus className="h-4 w-4 mr-2" /> New Plan
        </Button>
      </div>

      {!anySynced && (
        <div className="bg-amber-400/10 border border-amber-400/30 text-amber-600 dark:text-amber-400 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">No Payment Method Sync</p>
            <p className="text-xs mt-0.5">Connect a payment provider so checkouts can collect payment. Until then, the checkout page will show "Not Payment Method Sync".</p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : rows.map((r) => (
          <div key={r.id} className={`bg-card border ${r.is_popular ? "border-sky-400 shadow-lg shadow-sky-400/10" : "border-border"} rounded-2xl p-6 relative`}>
            {r.is_popular && <span className="absolute top-4 right-4 inline-flex items-center gap-1 text-[10px] font-bold tracking-widest text-sky-500 bg-sky-400/15 px-2 py-1 rounded-full"><Star className="h-3 w-3" /> POPULAR</span>}
            <p className="text-[10px] font-mono tracking-widest text-muted-foreground">{r.plan_key.toUpperCase()}</p>
            <h3 className="text-2xl font-bold mt-1">{r.name}</h3>
            <p className="text-xs text-muted-foreground mb-4">{r.tagline}</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-muted/40 rounded-lg p-2 text-center"><p className="text-[9px] tracking-widest text-muted-foreground font-bold">MONTHLY</p><p className="font-bold mt-1">${r.monthly_price}</p></div>
              <div className="bg-muted/40 rounded-lg p-2 text-center"><p className="text-[9px] tracking-widest text-muted-foreground font-bold">YEARLY</p><p className="font-bold mt-1">${r.yearly_price}</p></div>
              <div className="bg-muted/40 rounded-lg p-2 text-center"><p className="text-[9px] tracking-widest text-muted-foreground font-bold">LIFETIME</p><p className="font-bold mt-1">${r.lifetime_price}</p></div>
            </div>
            <ul className="space-y-1.5 mb-4">
              {(r.features ?? []).slice(0, 5).map((f) => <li key={f} className="text-xs text-muted-foreground">• {f}</li>)}
            </ul>
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className={`text-[10px] font-bold tracking-widest ${r.is_active ? "text-emerald-500" : "text-muted-foreground"}`}>{r.is_active ? "ACTIVE" : "DISABLED"}</span>
              <div className="flex gap-1">
                <button onClick={() => openEdit(r)} className="h-8 w-8 rounded-lg hover:bg-muted inline-flex items-center justify-center"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => setDel(r)} className="h-8 w-8 rounded-lg hover:bg-rose-500/10 text-rose-500 inline-flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Plan" : "New Pricing Plan"}</DialogTitle>
            <DialogDescription>Sync to landing page, checkout and user upgrade screens.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="PLAN KEY"><input value={form.plan_key} onChange={(e) => setForm((f) => ({ ...f, plan_key: e.target.value }))} disabled={!!editing} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Field>
              <Field label="NAME"><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Field>
            </div>
            <Field label="TAGLINE"><input value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="MONTHLY ($)"><input type="number" step="0.01" value={form.monthly_price} onChange={(e) => setForm((f) => ({ ...f, monthly_price: Number(e.target.value) }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Field>
              <Field label="YEARLY ($)"><input type="number" step="0.01" value={form.yearly_price} onChange={(e) => setForm((f) => ({ ...f, yearly_price: Number(e.target.value) }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Field>
              <Field label="LIFETIME ($)"><input type="number" step="0.01" value={form.lifetime_price} onChange={(e) => setForm((f) => ({ ...f, lifetime_price: Number(e.target.value) }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Field>
            </div>
            <Field label="FEATURES (one per line)"><textarea value={form.features} onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))} rows={5} className="w-full px-3 py-2 bg-muted/40 rounded-lg text-sm" /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Toggle label="ACTIVE" checked={form.is_active} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <Toggle label="POPULAR" checked={form.is_popular} onChange={(v) => setForm((f) => ({ ...f, is_popular: v }))} />
              <Field label="SORT"><input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Field>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">PROMOTIONAL BADGE</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="BADGE TEXT"><input value={form.badge_text} onChange={(e) => setForm((f) => ({ ...f, badge_text: e.target.value }))} placeholder="e.g. SAVE 20%" className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Field>
                <Field label="POSITION">
                  <Select value={form.badge_position} onValueChange={(val) => setForm((f) => ({ ...f, badge_position: val }))}>
                    <SelectTrigger className="h-10 w-full rounded-xl bg-card border border-border text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Top</SelectItem>
                      <SelectItem value="bottom">Bottom</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="APPLIES TO">
                  <Select value={form.badge_cycle} onValueChange={(val) => setForm((f) => ({ ...f, badge_cycle: val }))}>
                    <SelectTrigger className="h-10 w-full rounded-xl bg-card border border-border text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All cycles</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="lifetime">Lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
            <Button onClick={submit} disabled={busy} className="w-full h-11 rounded-xl bg-sky-400 hover:bg-sky-500 text-white font-bold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save Changes" : "Create Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plan?</AlertDialogTitle>
            <AlertDialogDescription>"{del?.name}" will be removed from the platform.</AlertDialogDescription>
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

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">{label}</p>{children}</div>
);
const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between bg-muted/40 px-3 py-2.5 rounded-lg">
    <span className="text-[10px] font-bold tracking-widest text-muted-foreground">{label}</span>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export default AdminBillingPricing;
