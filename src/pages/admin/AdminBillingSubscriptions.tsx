import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PanelLayout from "@/components/PanelLayout";
import BillingTabs from "@/components/BillingTabs";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import { Search, Download, MoreVertical, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";

interface SubRow {
  id: string; owner_user_id: string; tier: string; cycle: string; status: string; amount: number;
  next_billing_date: string | null;
  business?: { business_name: string | null } | null;
  owner?: { full_name: string | null; email: string | null } | null;
}

const tierClass = (t: string) => ({
  free: "bg-slate-400/15 text-slate-500",
  standard: "bg-sky-400/15 text-sky-500",
  premium: "bg-violet-400/15 text-violet-500",
  lifetime: "bg-amber-400/15 text-amber-500",
}[t.toLowerCase()] ?? "bg-muted text-muted-foreground");

const PIE_COLORS = ["#94a3b8", "#38bdf8", "#a78bfa", "#fbbf24"];

const AdminBillingSubscriptions = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const { data: subs } = await supabase.from("subscriptions").select("*").order("created_at", { ascending: false });
    const list = (subs ?? []) as any[];
    if (list.length === 0) { setRows([]); setLoading(false); return; }
    const ownerIds = Array.from(new Set(list.map((s) => s.owner_user_id)));
    const bizIds = Array.from(new Set(list.map((s) => s.business_id).filter(Boolean)));
    const [{ data: profs }, { data: biz }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email").in("user_id", ownerIds),
      bizIds.length ? supabase.from("businesses").select("id, business_name").in("id", bizIds) : Promise.resolve({ data: [] }),
    ]);
    const pMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
    const bMap = new Map((biz ?? []).map((b: any) => [b.id, b]));
    setRows(list.map((s) => ({ ...s, owner: pMap.get(s.owner_user_id) ?? null, business: s.business_id ? bMap.get(s.business_id) ?? null : null })));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel(`admin_subs_rt_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.business?.business_name ?? "").toLowerCase().includes(q)
      || (r.owner?.full_name ?? "").toLowerCase().includes(q)
      || (r.owner?.email ?? "").toLowerCase().includes(q)
      || r.tier.toLowerCase().includes(q);
  }), [rows, search]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === "active");
    const mrr = active.reduce((s, r) => s + Number(r.amount || 0), 0);
    const cancelled = rows.filter((r) => r.status === "cancelled").length;
    const churn = rows.length ? ((cancelled / rows.length) * 100).toFixed(1) : "0.0";
    const conversion = rows.length ? ((active.filter((r) => r.tier !== "free").length / rows.length) * 100).toFixed(1) : "0.0";
    return { mrr, active: active.length, churn, conversion };
  }, [rows]);

  const tierData = useMemo(() => {
    const t: Record<string, number> = { free: 0, standard: 0, premium: 0, lifetime: 0 };
    rows.forEach((r) => { t[r.tier.toLowerCase()] = (t[r.tier.toLowerCase()] ?? 0) + 1; });
    return Object.entries(t).map(([name, value]) => ({ name, value }));
  }, [rows]);

  const revenueData = useMemo(() => {
    // Use amounts grouped by month from subscriptions; fallback small series
    const byMonth: Record<string, number> = {};
    rows.forEach((r) => {
      const d = new Date((r as any).created_at ?? new Date());
      const k = d.toLocaleString("default", { month: "short" });
      byMonth[k] = (byMonth[k] ?? 0) + Number(r.amount || 0);
    });
    const months = ["Nov","Dec","Jan","Feb","Mar","Apr"];
    return months.map((m) => ({ month: m, value: byMonth[m] ?? 0 }));
  }, [rows]);

  const exportLedger = () => {
    const headers = ["Business","Owner","Email","Tier","Cycle","Status","Next Billing","Amount"];
    const lines = [headers.join(",")].concat(filtered.map((r) => [
      r.business?.business_name ?? "—", r.owner?.full_name ?? "—", r.owner?.email ?? "—",
      r.tier, r.cycle, r.status, r.next_billing_date ?? "N/A", r.amount,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `subscriptions-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Ledger exported" });
  };

  return (
    <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY} isAdmin>
      <BillingTabs />

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subscriptions..."
            className="h-12 w-full pl-11 pr-4 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <button onClick={exportLedger} className="h-12 px-5 rounded-xl bg-card border border-border text-sm font-bold inline-flex items-center gap-2 hover:bg-muted">
          <Download className="h-4 w-4" /> Export Ledger
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          ["MRR", `$${stats.mrr.toLocaleString()}`],
          ["ACTIVE SUBS", stats.active.toLocaleString()],
          ["CONVERSION", `${stats.conversion}%`],
          ["CHURN", `${stats.churn}%`],
        ].map(([k, v]) => (
          <div key={k} className="bg-card border border-border rounded-2xl p-5">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{k}</p>
            <p className="text-3xl font-bold mt-2">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 mb-6">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="font-bold mb-3">Revenue Velocity</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Area dataKey="value" stroke="#38bdf8" fill="url(#rev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="font-bold mb-3">Tier Distribution</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={tierData} dataKey="value" innerRadius={60} outerRadius={95} paddingAngle={2}>
                  {tierData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border bg-muted/20">
                <th className="text-left px-6 py-4">BUSINESS</th>
                <th className="text-center px-4 py-4">TIER</th>
                <th className="text-left px-4 py-4">CYCLE</th>
                <th className="text-left px-4 py-4">STATUS</th>
                <th className="text-left px-4 py-4">NEXT BILLING</th>
                <th className="text-right px-4 py-4">AMOUNT</th>
                <th className="text-right px-6 py-4">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">No subscriptions yet.</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-6 py-4">
                    <p className="font-bold">{r.business?.business_name ?? r.owner?.full_name ?? "—"}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{r.owner?.full_name ?? "—"}</p>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${tierClass(r.tier)}`}>{r.tier}</span>
                  </td>
                  <td className="px-4 py-4 capitalize">{r.cycle}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${r.status === "active" ? "text-emerald-500" : r.status === "cancelled" ? "text-rose-500" : "text-amber-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${r.status === "active" ? "bg-emerald-500" : r.status === "cancelled" ? "bg-rose-500" : "bg-amber-500"}`} />
                      {r.status[0].toUpperCase() + r.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{r.next_billing_date ?? "N/A"}</td>
                  <td className="px-4 py-4 text-right font-bold">${Number(r.amount).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-8 w-8 rounded-lg hover:bg-muted inline-flex items-center justify-center"><MoreVertical className="h-4 w-4" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toast({ title: "View not implemented" })}>View Details</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PanelLayout>
  );
};

export default AdminBillingSubscriptions;
