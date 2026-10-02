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
  const [lifetimeLimits, setLifetimeLimits] = useState<{ standard: number; premium: number }>({ standard: 25, premium: 25 });
  const [lifetimeCounts, setLifetimeCounts] = useState<{ standard: number; premium: number }>({ standard: 0, premium: 0 });
  const [lifetimeCustoms, setLifetimeCustoms] = useState<Record<string, any>>({});
  const [savingLimits, setSavingLimits] = useState(false);

  // Dedicated Lifetime Edit State
  const [lifetimeModalOpen, setLifetimeModalOpen] = useState(false);
  const [editingLifetimeKey, setEditingLifetimeKey] = useState<string>("");
  const [lifetimeForm, setLifetimeForm] = useState({
    plan_key: "",
    name: "",
    lifetime_price: 199.99,
    badge_text: "",
    badge_position: "top",
    is_popular: false,
    limit: 25,
    features: "",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pricing-plans");
      const json = await res.json();
      if (json.success && Array.isArray(json.plans)) {
        setRows(json.plans as PlanRow[]);
        if (json.lifetime_plan_limits) {
          setLifetimeLimits({
            standard: json.lifetime_plan_limits.standard ?? 25,
            premium: json.lifetime_plan_limits.premium ?? 25,
          });
        }
        if (json.lifetime_offer_counts) {
          setLifetimeCounts({
            standard: json.lifetime_offer_counts.standard ?? 0,
            premium: json.lifetime_offer_counts.premium ?? 0,
          });
        }
        if (json.lifetime_customizations) {
          setLifetimeCustoms(json.lifetime_customizations);
        }
      } else {
        const { data } = await supabase.from("pricing_plans").select("*").order("sort_order");
        setRows((data as PlanRow[]) ?? []);
      }
    } catch {
      const { data } = await supabase.from("pricing_plans").select("*").order("sort_order");
      setRows((data as PlanRow[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const openLifetimeEdit = (planKey: string) => {
    const r = rows.find((p) => p.plan_key.toLowerCase() === planKey.toLowerCase());
    const customs = lifetimeCustoms[planKey.toLowerCase()] || {};
    const limit = planKey === "standard" ? lifetimeLimits.standard : planKey === "premium" ? lifetimeLimits.premium : 25;
    
    setEditingLifetimeKey(planKey);
    setLifetimeForm({
      plan_key: planKey,
      name: r?.name || (planKey.charAt(0).toUpperCase() + planKey.slice(1)),
      lifetime_price: customs.lifetime_price !== undefined ? customs.lifetime_price : (r?.lifetime_price || 199.99),
      badge_text: customs.badge_text !== undefined ? (customs.badge_text || "") : (r?.badge_cycle === "lifetime" ? r.badge_text || "" : ""),
      badge_position: customs.badge_position || "top",
      is_popular: customs.is_popular !== undefined ? customs.is_popular : Boolean(r?.is_popular),
      limit: limit,
      features: Array.isArray(customs.features) ? customs.features.join("\n") : (r?.features || []).join("\n"),
    });
    setLifetimeModalOpen(true);
  };

  const submitLifetimeEdit = async () => {
    setBusy(true);
    try {
      // 1. Save lifetime customization (independent badges, price, features, popular status)
      const res = await fetch("/api/admin/pricing-plans/lifetime-customizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_key: editingLifetimeKey,
          lifetime_price: Number(lifetimeForm.lifetime_price),
          badge_text: lifetimeForm.badge_text.trim() || null,
          badge_position: lifetimeForm.badge_position,
          is_popular: lifetimeForm.is_popular,
          features: lifetimeForm.features.split("\n").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update lifetime customization");
      }

      // 2. Save limits if standard or premium
      if (editingLifetimeKey === "standard" || editingLifetimeKey === "premium") {
        const nextLimits = {
          ...lifetimeLimits,
          [editingLifetimeKey]: Number(lifetimeForm.limit) || 25,
        };
        await fetch("/api/admin/pricing-plans/lifetime-limits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limits: nextLimits }),
        });
      }

      window.dispatchEvent(new CustomEvent("geflow:pricing-updated"));
      toast({
        title: "Lifetime Plan Updated",
        description: `Successfully configured lifetime settings and badge for ${lifetimeForm.name}.`,
      });
      setLifetimeModalOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const saveLifetimeLimits = async () => {
    setSavingLimits(true);
    try {
      const res = await fetch("/api/admin/pricing-plans/lifetime-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limits: lifetimeLimits }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        window.dispatchEvent(new CustomEvent("geflow:pricing-updated"));
        toast({
          title: "Lifetime limits updated",
          description: `Standard: ${lifetimeLimits.standard} limit, Premium: ${lifetimeLimits.premium} limit saved.`,
        });
        load();
      } else {
        throw new Error(json.error || "Failed to update limits");
      }
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingLimits(false);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`admin_pricing_rt_${Math.random().toString(36).slice(2)}`).on("postgres_changes", { event: "*", schema: "public", table: "pricing_plans" }, load).subscribe();
    const onRefresh = () => load();
    window.addEventListener("panel:refresh", onRefresh);
    window.addEventListener("geflow:data-refresh", onRefresh);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("panel:refresh", onRefresh);
      window.removeEventListener("geflow:data-refresh", onRefresh);
    };
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
      id: editing?.id,
      plan_key: form.plan_key.toLowerCase().trim(),
      name: form.name.trim(),
      tagline: form.tagline.trim() || null,
      monthly_price: Number(form.monthly_price),
      yearly_price: Number(form.yearly_price),
      lifetime_price: Number(form.lifetime_price),
      features: form.features.split("\n").map((s) => s.trim()).filter(Boolean),
      is_active: form.is_active,
      is_popular: form.is_popular,
      sort_order: Number(form.sort_order),
      badge_text: form.badge_text?.trim() || null,
      badge_position: form.badge_position,
      badge_cycle: form.badge_cycle,
    };

    try {
      const res = await fetch("/api/admin/pricing-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save plan");
      }
      toast({ title: editing ? "Plan updated" : "Plan created" });
      setOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!del) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/pricing-plans/${del.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete plan");
      }
      toast({ title: "Plan deleted" });
      setDel(null);
      load();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
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

      {/* Lifetime Registration Offer Configuration Banner */}
      <div className="bg-card border border-amber-500/30 rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-foreground">🎁 Exclusive Lifetime Plan Registration Offers</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
                LIMITED OFFER
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Configure maximum lifetime plan registrations allowed for users (e.g. 25-25 registration offers). Once filled, users cannot register for lifetime tier.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-xl border border-border">
              <span className="text-xs font-bold text-muted-foreground">Standard:</span>
              <input
                type="number"
                min="0"
                value={lifetimeLimits.standard}
                onChange={(e) => setLifetimeLimits((l) => ({ ...l, standard: Number(e.target.value) }))}
                className="w-16 h-8 text-center text-sm font-bold bg-background rounded-lg border border-border"
              />
              <span className="text-[11px] text-muted-foreground">limit</span>
            </div>
            <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-xl border border-border">
              <span className="text-xs font-bold text-muted-foreground">Premium:</span>
              <input
                type="number"
                min="0"
                value={lifetimeLimits.premium}
                onChange={(e) => setLifetimeLimits((l) => ({ ...l, premium: Number(e.target.value) }))}
                className="w-16 h-8 text-center text-sm font-bold bg-background rounded-lg border border-border"
              />
              <span className="text-[11px] text-muted-foreground">limit</span>
            </div>
            <Button
              onClick={saveLifetimeLimits}
              disabled={savingLimits}
              className="h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs"
            >
              {savingLimits ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Limits"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : rows.map((r) => {
          const planKey = r.plan_key.toLowerCase();
          const hasLifetimeLimit = planKey === "standard" || planKey === "premium";
          const limit = planKey === "standard" ? lifetimeLimits.standard : planKey === "premium" ? lifetimeLimits.premium : null;
          const claimed = planKey === "standard" ? lifetimeCounts.standard : planKey === "premium" ? lifetimeCounts.premium : 0;
          return (
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

            {hasLifetimeLimit && limit !== null && (
              <div className="mb-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-amber-600 dark:text-amber-400">Lifetime Offer Limit:</span>{" "}
                  <span className="font-semibold text-foreground">{limit} spots</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">Claimed: {claimed} / {limit}</span>
              </div>
            )}

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
        );})}
      </div>

      {/* 2. DEDICATED LIFETIME PLANS SECTION & TABLE */}
      <div className="mt-10 mb-8 pt-8 border-t border-border">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">Exclusive Lifetime Plans</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">
                SEPARATE OFFER &amp; BADGES
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage lifetime pricing, registration limits, and badges independently from monthly/yearly subscriptions.
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                <th className="p-4">Plan Name</th>
                <th className="p-4">Lifetime Price</th>
                <th className="p-4">Registration Offer Limit</th>
                <th className="p-4">Independent Lifetime Badge</th>
                <th className="p-4">Popular On Lifetime</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {["standard", "premium"].map((key) => {
                const r = rows.find((p) => p.plan_key.toLowerCase() === key);
                const customs = lifetimeCustoms[key] || {};
                const priceVal = customs.lifetime_price !== undefined ? customs.lifetime_price : (r?.lifetime_price || 0);
                const badgeText = customs.badge_text !== undefined ? customs.badge_text : (r?.badge_cycle === "lifetime" ? r.badge_text : null);
                const isPop = customs.is_popular !== undefined ? customs.is_popular : Boolean(r?.is_popular);
                const limit = key === "standard" ? lifetimeLimits.standard : lifetimeLimits.premium;
                const claimed = key === "standard" ? lifetimeCounts.standard : lifetimeCounts.premium;

                return (
                  <tr key={key} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-foreground text-sm">{r?.name || key.toUpperCase()} Lifetime</p>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">{key}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-extrabold text-foreground text-base">${priceVal}</span>
                      <span className="text-xs text-muted-foreground ml-1">one-time</span>
                    </td>
                    <td className="p-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                        <span className="font-bold text-amber-600 dark:text-amber-400">{limit} spots</span>
                        <span className="text-[10px] text-muted-foreground">({claimed} claimed)</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {badgeText ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          {badgeText}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">None configured</span>
                      )}
                    </td>
                    <td className="p-4">
                      {isPop ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-500 bg-sky-500/10 px-2.5 py-0.5 rounded-full">
                          <Star className="h-3 w-3" /> Popular
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openLifetimeEdit(key)}
                        className="rounded-xl font-bold text-xs hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Lifetime
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lifetime Plan Edit Modal */}
      <Dialog open={lifetimeModalOpen} onOpenChange={setLifetimeModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lifetime Plan: {lifetimeForm.name}</DialogTitle>
            <DialogDescription>
              Configure the lifetime price, registration limit, and separate lifetime promotional badge.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="PLAN KEY">
                <input value={lifetimeForm.plan_key} disabled className="h-10 w-full px-3 bg-muted/60 rounded-lg text-sm font-mono" />
              </Field>
              <Field label="LIFETIME PRICE ($)">
                <input
                  type="number"
                  step="0.01"
                  value={lifetimeForm.lifetime_price}
                  onChange={(e) => setLifetimeForm((f) => ({ ...f, lifetime_price: Number(e.target.value) }))}
                  className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm font-bold"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="LIFETIME OFFER LIMIT (SPOTS)">
                <input
                  type="number"
                  min="0"
                  value={lifetimeForm.limit}
                  onChange={(e) => setLifetimeForm((f) => ({ ...f, limit: Number(e.target.value) }))}
                  className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm font-bold"
                />
              </Field>
              <div className="flex items-center justify-between bg-muted/40 px-3 py-2.5 rounded-lg mt-5">
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground">POPULAR ON LIFETIME</span>
                <Switch
                  checked={lifetimeForm.is_popular}
                  onCheckedChange={(val) => setLifetimeForm((f) => ({ ...f, is_popular: val }))}
                />
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">
                INDEPENDENT LIFETIME BADGE
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="BADGE TEXT (e.g. 58% OFF, 25 SPOTS OFFER)">
                  <input
                    value={lifetimeForm.badge_text}
                    onChange={(e) => setLifetimeForm((f) => ({ ...f, badge_text: e.target.value }))}
                    placeholder="e.g. 58% OFF"
                    className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm"
                  />
                </Field>
                <Field label="POSITION">
                  <Select
                    value={lifetimeForm.badge_position}
                    onValueChange={(val) => setLifetimeForm((f) => ({ ...f, badge_position: val }))}
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl bg-card border border-border text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Top</SelectItem>
                      <SelectItem value="bottom">Bottom</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>

            <Field label="LIFETIME PLAN BULLETS (one per line)">
              <textarea
                value={lifetimeForm.features}
                onChange={(e) => setLifetimeForm((f) => ({ ...f, features: e.target.value }))}
                rows={5}
                placeholder="1000 items limit&#10;Full POS &amp; Returns&#10;Lifetime Support"
                className="w-full px-3 py-2 bg-muted/40 rounded-lg text-sm"
              />
            </Field>

            <Button
              onClick={submitLifetimeEdit}
              disabled={busy}
              className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Lifetime Settings & Badge"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
