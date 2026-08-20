import { useMoney } from "@/lib/currency";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { TrendingUp, DollarSign, Package, Gauge, Loader2 } from "lucide-react";
import type { ProductRecord } from "./ProductDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: ProductRecord | null;
  mode: "analytics" | "velocity";
}

interface SaleItemRow { quantity: number; unit_price: number; unit_cost: number; created_at: string }

const ProductInsightsDialog = ({ open, onOpenChange, product, mode }: Props) => {
  const { format: fmt } = useMoney();
  const [rows, setRows] = useState<SaleItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !product) return;
    setLoading(true);
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("sale_items")
        .select("quantity, unit_price, unit_cost, created_at")
        .eq("product_id", product.id)
        .order("created_at", { ascending: true });
      if (!active) return;
      setRows((data as SaleItemRow[]) ?? []);
      setLoading(false);
    };
    load();
    const ch = supabase.channel(`insights-${product.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sale_items", filter: `product_id=eq.${product.id}` }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [open, product]);

  const unitsSold = rows.reduce((s, r) => s + r.quantity, 0);
  const revenue = rows.reduce((s, r) => s + r.quantity * Number(r.unit_price), 0);
  const profit = rows.reduce((s, r) => s + r.quantity * (Number(r.unit_price) - Number(r.unit_cost)), 0);
  const orders = rows.length;

  // velocity: units sold per day over last 30 days
  const now = Date.now();
  const days = 30;
  const buckets: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  rows.forEach((r) => {
    const key = r.created_at.slice(0, 10);
    if (key in buckets) buckets[key] += r.quantity;
  });
  const chartData = Object.entries(buckets).map(([date, units]) => ({
    date: new Date(date).toLocaleDateString("en", { month: "short", day: "numeric" }),
    units,
  }));
  const last30Units = Object.values(buckets).reduce((s, v) => s + v, 0);
  const velocityPerDay = (last30Units / days).toFixed(2);
  const daysOfCover = Number(velocityPerDay) > 0 ? Math.round((product?.stock_units ?? 0) / Number(velocityPerDay)) : null;

  const stats = mode === "analytics"
    ? [
        { label: "Units Sold", value: unitsSold, icon: Package, color: "text-sky-500 bg-sky-500/15" },
        { label: "Revenue", value: fmt(revenue), icon: DollarSign, color: "text-emerald-500 bg-emerald-500/15" },
        { label: "Profit", value: fmt(profit), icon: TrendingUp, color: "text-violet-500 bg-violet-500/15" },
        { label: "Orders", value: orders, icon: Gauge, color: "text-amber-500 bg-amber-500/15" },
      ]
    : [
        { label: "Velocity / day", value: `${velocityPerDay}`, icon: Gauge, color: "text-sky-500 bg-sky-500/15" },
        { label: "Sold (30d)", value: last30Units, icon: Package, color: "text-emerald-500 bg-emerald-500/15" },
        { label: "On Hand", value: product?.stock_units ?? 0, icon: Package, color: "text-violet-500 bg-violet-500/15" },
        { label: "Days of Cover", value: daysOfCover === null ? "∞" : daysOfCover, icon: TrendingUp, color: "text-amber-500 bg-amber-500/15" },
      ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "analytics" ? "Product Analytics" : "Sale Velocity"}</DialogTitle>
          <DialogDescription>{product?.name} — live performance from real transactions.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-16 flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading insights...</div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl border border-border p-4">
                  <div className={`h-9 w-9 rounded-lg ${s.color} flex items-center justify-center mb-2`}><s.icon className="h-4 w-4" /></div>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border p-4">
              <p className="text-xs font-bold tracking-widest text-muted-foreground mb-4">UNITS SOLD — LAST 30 DAYS</p>
              {last30Units === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No sales recorded in the last 30 days.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={4} />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                    <Area type="monotone" dataKey="units" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#velGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProductInsightsDialog;
