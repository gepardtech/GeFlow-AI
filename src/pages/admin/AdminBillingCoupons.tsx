import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PanelLayout from "@/components/PanelLayout";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import BillingTabs from "@/components/BillingTabs";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Ticket, Plus, Loader2, Pencil, Trash2, Percent, DollarSign, Copy, CheckCircle2, XCircle,
} from "lucide-react";

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  applies_to_plan: string | null;
  min_amount: number;
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
};

const emptyForm = {
  code: "", description: "", discount_type: "percent", discount_value: 10,
  applies_to_plan: "all", min_amount: 0, max_uses: "", expires_at: "", active: true,
};

const AdminBillingCoupons = () => {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    setCoupons((data as Coupon[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("admin_coupons_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "coupons" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      code: c.code, description: c.description ?? "", discount_type: c.discount_type,
      discount_value: c.discount_value, applies_to_plan: c.applies_to_plan ?? "all",
      min_amount: c.min_amount, max_uses: c.max_uses ?? "",
      expires_at: c.expires_at ? c.expires_at.slice(0, 10) : "", active: c.active,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.code.trim()) { toast({ title: "Code required", variant: "destructive" }); return; }
    setSaving(true);
    const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value) || 0,
      applies_to_plan: form.applies_to_plan === "all" ? null : form.applies_to_plan,
      min_amount: Number(form.min_amount) || 0,
      max_uses: form.max_uses === "" ? null : Number(form.max_uses),
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      active: form.active,
    };
    const res = editing
      ? await supabase.from("coupons").update(payload).eq("id", editing.id)
      : await supabase.from("coupons").insert(payload as any);
    setSaving(false);
    if (res.error) { toast({ title: "Save failed", description: res.error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Coupon updated" : "Coupon created", description: "Synced live to the checkout page." });
    setOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("coupons").delete().eq("id", deleteTarget.id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Coupon deleted" });
    setDeleteTarget(null);
    load();
  };

  const toggleActive = async (c: Coupon) => {
    await supabase.from("coupons").update({ active: !c.active }).eq("id", c.id);
    load();
  };

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); toast({ title: "Copied", description: code }); };

  const stats = useMemo(() => ({
    total: coupons.length,
    active: coupons.filter((c) => c.active).length,
    redemptions: coupons.reduce((s, c) => s + (c.used_count ?? 0), 0),
  }), [coupons]);

  const isExpired = (c: Coupon) => c.expires_at && new Date(c.expires_at) < new Date();

  return (
    <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY} isAdmin>
      <BillingTabs />

      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Ticket className="h-5 w-5 text-sky-500" /> Coupon Codes</h2>
          <p className="text-sm text-muted-foreground">Create discount codes that sync instantly to the checkout page.</p>
        </div>
        <Button onClick={openCreate} className="h-11 px-5 rounded-xl bg-sky-400 hover:bg-sky-500 text-white font-bold">
          <Plus className="h-4 w-4 mr-2" /> New Coupon
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="TOTAL COUPONS" value={stats.total} />
        <Stat label="ACTIVE" value={stats.active} />
        <Stat label="REDEMPTIONS" value={stats.redemptions} />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-20 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : coupons.length === 0 ? (
          <div className="p-16 text-center text-sm text-muted-foreground">No coupons yet. Create your first discount code.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border">
                  <th className="px-5 py-3">CODE</th>
                  <th className="px-5 py-3">DISCOUNT</th>
                  <th className="px-5 py-3">PLAN</th>
                  <th className="px-5 py-3">USAGE</th>
                  <th className="px-5 py-3">EXPIRES</th>
                  <th className="px-5 py-3">STATUS</th>
                  <th className="px-5 py-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold bg-muted px-2 py-1 rounded-lg">{c.code}</span>
                        <button onClick={() => copyCode(c.code)} className="text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                      </div>
                      {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                    </td>
                    <td className="px-5 py-4 font-bold">
                      {c.discount_type === "percent" ? `${c.discount_value}%` : `$${Number(c.discount_value).toFixed(2)}`}
                    </td>
                    <td className="px-5 py-4 capitalize text-muted-foreground">{c.applies_to_plan ?? "All plans"}</td>
                    <td className="px-5 py-4 text-muted-foreground">{c.used_count}{c.max_uses != null ? ` / ${c.max_uses}` : ""}</td>
                    <td className="px-5 py-4 text-muted-foreground">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}</td>
                    <td className="px-5 py-4">
                      {isExpired(c) ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500"><XCircle className="h-3.5 w-3.5" /> Expired</span>
                      ) : (
                        <button onClick={() => toggleActive(c)} className={`inline-flex items-center gap-1 text-xs font-bold ${c.active ? "text-emerald-500" : "text-muted-foreground"}`}>
                          {c.active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} {c.active ? "Active" : "Inactive"}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" onClick={() => setDeleteTarget(c)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Coupon" : "Create Coupon"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Coupon Code"><Input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="SUMMER25" className="font-mono uppercase" /></Field>
              <Field label="Status">
                <div className="flex items-center gap-2 h-10"><Switch checked={form.active} onCheckedChange={(v) => set("active", v)} /><span className="text-sm text-muted-foreground">{form.active ? "Active" : "Inactive"}</span></div>
              </Field>
            </div>
            <Field label="Description"><Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional internal note" /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Discount Type">
                <Select value={form.discount_type} onValueChange={(v) => set("discount_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent"><span className="flex items-center gap-2"><Percent className="h-3.5 w-3.5" /> Percentage</span></SelectItem>
                    <SelectItem value="fixed"><span className="flex items-center gap-2"><DollarSign className="h-3.5 w-3.5" /> Fixed amount</span></SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={form.discount_type === "percent" ? "Discount (%)" : "Discount ($)"}>
                <Input type="number" value={form.discount_value} onChange={(e) => set("discount_value", e.target.value)} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Applies To">
                <Select value={form.applies_to_plan} onValueChange={(v) => set("applies_to_plan", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All plans</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Min Order ($)"><Input type="number" value={form.min_amount} onChange={(e) => set("min_amount", e.target.value)} /></Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Max Uses (blank = ∞)"><Input type="number" value={form.max_uses} onChange={(e) => set("max_uses", e.target.value)} placeholder="Unlimited" /></Field>
              <Field label="Expiry Date"><Input type="date" value={form.expires_at} onChange={(e) => set("expires_at", e.target.value)} /></Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving} className="bg-sky-400 hover:bg-sky-500 text-white font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Create coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete coupon {deleteTarget?.code}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the coupon and it will no longer work at checkout.</AlertDialogDescription>
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

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="bg-card border border-border rounded-2xl p-5">
    <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{label}</p>
    <p className="text-3xl font-bold mt-1">{value}</p>
  </div>
);

const Field = ({ label, children }: any) => (
  <div>
    <Label className="text-xs font-bold tracking-widest text-muted-foreground">{label.toUpperCase()}</Label>
    <div className="mt-1.5">{children}</div>
  </div>
);

export default AdminBillingCoupons;
