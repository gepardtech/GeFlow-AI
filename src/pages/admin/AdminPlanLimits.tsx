import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PanelLayout from "@/components/PanelLayout";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SlidersHorizontal, Loader2, Shield, Save, Infinity as InfinityIcon } from "lucide-react";

interface Limit {
  id: string;
  plan_key: string;
  resource_key: string;
  label: string;
  limit_value: number | null;
  is_locked: boolean;
}

const PLAN_META: Record<string, { label: string; cls: string }> = {
  free: { label: "Free", cls: "bg-slate-400/15 text-slate-500" },
  standard: { label: "Standard", cls: "bg-sky-400/15 text-sky-500" },
  premium: { label: "Premium", cls: "bg-violet-400/15 text-violet-500" },
  lifetime: { label: "Lifetime", cls: "bg-amber-400/15 text-amber-600" },
};
const PLAN_ORDER = ["free", "standard", "premium", "lifetime"];

interface DefaultResourceDef {
  key: string;
  label: string;
  defaults: Record<string, { limit_value: number | null; is_locked: boolean }>;
}

const DEFAULT_RESOURCES: DefaultResourceDef[] = [
  {
    key: "products",
    label: "Products / Items Limit",
    defaults: {
      free: { limit_value: 50, is_locked: false },
      standard: { limit_value: 1000, is_locked: false },
      premium: { limit_value: null, is_locked: false },
      lifetime: { limit_value: null, is_locked: false },
    },
  },
  {
    key: "branches",
    label: "Branches / Outlets Limit",
    defaults: {
      free: { limit_value: 1, is_locked: false },
      standard: { limit_value: 3, is_locked: false },
      premium: { limit_value: null, is_locked: false },
      lifetime: { limit_value: null, is_locked: false },
    },
  },
  {
    key: "categories",
    label: "Business Categories Limit",
    defaults: {
      free: { limit_value: 1, is_locked: false },
      standard: { limit_value: 1, is_locked: false },
      premium: { limit_value: null, is_locked: false },
      lifetime: { limit_value: null, is_locked: false },
    },
  },
  {
    key: "low_stock",
    label: "Low Stock Alert Tracking",
    defaults: {
      free: { limit_value: 5, is_locked: false },
      standard: { limit_value: 25, is_locked: false },
      premium: { limit_value: null, is_locked: false },
      lifetime: { limit_value: null, is_locked: false },
    },
  },
  {
    key: "out_of_stock",
    label: "Out of Stock Ledger Items",
    defaults: {
      free: { limit_value: 5, is_locked: false },
      standard: { limit_value: 25, is_locked: false },
      premium: { limit_value: null, is_locked: false },
      lifetime: { limit_value: null, is_locked: false },
    },
  },
  {
    key: "reports_days",
    label: "Report History (Days)",
    defaults: {
      free: { limit_value: 7, is_locked: false },
      standard: { limit_value: 30, is_locked: false },
      premium: { limit_value: null, is_locked: false },
      lifetime: { limit_value: null, is_locked: false },
    },
  },
  {
    key: "ai_requests",
    label: "AI Assistant Requests / Month",
    defaults: {
      free: { limit_value: 20, is_locked: false },
      standard: { limit_value: 200, is_locked: false },
      premium: { limit_value: null, is_locked: false },
      lifetime: { limit_value: null, is_locked: false },
    },
  },
];

const AdminPlanLimits = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Limit[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Record<string, Partial<Limit>>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("plan_limits").select("*");
    let currentRows = ((data as Limit[]) ?? []);

    // Ensure all standard resources exist in database
    const missingInserts: {
      plan_key: string;
      resource_key: string;
      label: string;
      limit_value: number | null;
      is_locked: boolean;
    }[] = [];

    DEFAULT_RESOURCES.forEach((res) => {
      PLAN_ORDER.forEach((plan) => {
        const found = currentRows.find(
          (r) => r.plan_key === plan && r.resource_key === res.key
        );
        if (!found) {
          const def = res.defaults[plan] || { limit_value: null, is_locked: false };
          missingInserts.push({
            plan_key: plan,
            resource_key: res.key,
            label: res.label,
            limit_value: def.limit_value,
            is_locked: def.is_locked,
          });
        }
      });
    });

    if (missingInserts.length > 0) {
      const { data: inserted } = await supabase
        .from("plan_limits")
        .insert(missingInserts)
        .select();
      if (inserted) {
        currentRows = [...currentRows, ...(inserted as Limit[])];
      }
    }

    setRows(currentRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`admin_plan_limits_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_limits" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const stage = (id: string, patch: Partial<Limit>) => {
    setPending((p) => ({ ...p, [id]: { ...(p[id] ?? {}), ...patch } }));
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const save = async () => {
    const ids = Object.keys(pending);
    if (!ids.length) return;
    setSaving(true);
    let hasError = false;
    for (const id of ids) {
      const { error } = await supabase
        .from("plan_limits")
        .update(pending[id] as any)
        .eq("id", id);
      if (error) {
        hasError = true;
        toast({ title: "Failed to update limit", description: error.message, variant: "destructive" });
      }
    }
    setSaving(false);
    if (!hasError) {
      setPending({});
      toast({
        title: "Plan limits saved successfully",
        description: `${ids.length} quota configuration${ids.length > 1 ? "s" : ""} updated and synchronized live across user workspace.`,
      });
    }
  };

  const discard = () => { setPending({}); load(); };

  const resources = useMemo(() => {
    const seen: { key: string; label: string }[] = [];
    // Prioritize DEFAULT_RESOURCES order first
    DEFAULT_RESOURCES.forEach((d) => seen.push({ key: d.key, label: d.label }));
    // Then any extra custom resources from DB
    rows.forEach((r) => {
      if (!seen.find((s) => s.key === r.resource_key)) {
        seen.push({ key: r.resource_key, label: r.label });
      }
    });
    return seen;
  }, [rows]);

  const cell = (plan: string, resourceKey: string) =>
    rows.find((r) => r.plan_key === plan && r.resource_key === resourceKey);

  const dirty = Object.keys(pending).length > 0;

  return (
    <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY} isAdmin>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1">Plan Limits</h1>
          <p className="text-sm text-muted-foreground">Define resource quotas per plan tier. Empty value = unlimited. These limits enforce across the user workspace in real time.</p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border bg-muted/20">
                <th className="text-left px-6 py-4">RESOURCE</th>
                {PLAN_ORDER.map((p) => (
                  <th key={p} className="px-4 py-4 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-full ${PLAN_META[p].cls}`}>{PLAN_META[p].label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resources.map((res) => (
                <tr key={res.key} className="border-b border-border last:border-0">
                  <td className="px-6 py-4">
                    <p className="font-bold">{res.label}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{res.key}</p>
                  </td>
                  {PLAN_ORDER.map((plan) => {
                    const c = cell(plan, res.key);
                    if (!c) return <td key={plan} className="px-4 py-4 text-center text-muted-foreground">—</td>;
                    return (
                      <td key={plan} className="px-4 py-4">
                        <div className="flex flex-col items-center gap-2">
                          <div className="relative w-28">
                            <Input
                              type="number"
                              disabled={c.is_locked}
                              value={c.limit_value ?? ""}
                              onChange={(e) => stage(c.id, { limit_value: e.target.value === "" ? null : Number(e.target.value) })}
                              placeholder="∞"
                              className="h-9 text-center"
                            />
                            {c.limit_value === null && !c.is_locked && (
                              <InfinityIcon className="h-3.5 w-3.5 text-emerald-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Switch checked={c.is_locked} onCheckedChange={(v) => stage(c.id, { is_locked: v })} />
                            <span className="text-[9px] font-bold tracking-widest text-muted-foreground">{c.is_locked ? "LOCKED" : "OPEN"}</span>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Leave a value empty for unlimited access. Toggle <strong className="text-foreground">LOCKED</strong> to fully disable a resource for that tier.
      </div>

      {/* Floating save bar */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 transition-all ${dirty ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
        <div className="bg-card border border-border shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-6">
          <div className="flex items-center gap-3"><Shield className="h-5 w-5 text-sky-500" /><div><p className="font-bold text-sm">Quota Configuration Lock</p><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Unsaved changes</p></div></div>
          <button onClick={discard} className="text-sm font-bold text-muted-foreground hover:text-foreground">DISCARD</button>
          <Button onClick={save} disabled={saving} className="bg-sky-400 hover:bg-sky-500 text-white font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> SAVE LIMITS</>}
          </Button>
        </div>
      </div>
    </PanelLayout>
  );
};

export default AdminPlanLimits;
