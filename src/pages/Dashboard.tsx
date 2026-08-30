import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import UserPanelGate from "@/components/UserPanelGate";
import { usePlan } from "@/hooks/usePlan";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { useMoney } from "@/lib/currency";
import { useStaffRole } from "@/hooks/useStaffRole";
import {
  Package,
  ShoppingCart,
  BarChart3,
  Plus,
  Sparkles,
  AlertTriangle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

interface DayPoint {
  day: string;
  sales: number;
  profit: number;
}
interface Operation {
  id: string;
  type: string;
  amount: number;
  meta: string;
  status: string;
}
interface TopItem {
  name: string;
  units: number;
  profit: number;
}

const Stat = ({
  label,
  value,
  delta,
  deltaClass = "text-emerald-500",
  icon: Icon,
  iconClass,
  onClick,
}: any) => (
  <button
    onClick={onClick}
    className="text-left bg-card border border-border/80 rounded-2xl p-4 sm:p-5 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 transition-all min-w-0 w-full overflow-hidden flex flex-col justify-between"
  >
    <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4 w-full">
      <div
        className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      {delta && (
        <span
          className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${deltaClass}`}
        >
          {delta}
        </span>
      )}
    </div>
    <div className="w-full min-w-0">
      <p className="text-[10px] sm:text-[11px] font-bold tracking-wider text-muted-foreground mb-1 truncate uppercase">
        {label}
      </p>
      <p
        className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-foreground truncate"
        title={String(value)}
      >
        {value}
      </p>
    </div>
  </button>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { plan, planId, fullName, loading: planLoading } = usePlan();
  const { active, loading: bizLoading } = useActiveBusiness();
  const { isCashier, isInventoryClerk, isManager, isOwner } = useStaffRole();

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    todaySales: 0,
    todayProfit: 0,
    totalRevenue: 0,
    totalProducts: 0,
    lowStock: 0,
  });
  const [chart, setChart] = useState<DayPoint[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [alerts, setAlerts] = useState<
    { title: string; sub: string; tone: "amber" | "rose" }[]
  >([]);

  const { format: money } = useMoney();

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }
    if (!active) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const bizId = active.id;
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      { data: products },
      { data: sales },
      { data: saleItems },
      { data: movements },
    ] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, stock_units, min_stock_alert, expiry_date, status")
        .eq("business_id", bizId),
      supabase
        .from("sales")
        .select("id, total, profit, status, processed_by, created_at")
        .eq("business_id", bizId)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("sale_items")
        .select("product_name, quantity, unit_price, unit_cost, created_at")
        .eq("owner_user_id", user.id)
        .gte("created_at", since.toISOString()),
      supabase
        .from("stock_movements")
        .select("id, type, quantity, created_at, product_id")
        .eq("business_id", bizId)
        .eq("type", "in")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const prods = products ?? [];
    if (bizId) {
      supabase.from("businesses").update({ listed_products: prods.length }).eq("id", bizId).then();
    }
    if (user?.id) {
      supabase.from("profiles").update({ listed_products: prods.length }).eq("user_id", user.id).then();
    }
    const allSales = sales ?? [];

    // KPIs
    const completed = allSales.filter((s) => s.status === "completed");
    const todaySalesRows = completed.filter(
      (s) => new Date(s.created_at) >= todayStart
    );
    const todaySales = todaySalesRows.reduce((a, s) => a + Number(s.total), 0);
    const todayProfit = todaySalesRows.reduce(
      (a, s) => a + Number(s.profit),
      0
    );
    const totalRevenue = completed.reduce((a, s) => a + Number(s.total), 0);
    const defaultStockThreshold = Number(active?.stock_alert_limit) || 10;
    const lowStock = prods.filter((p) => {
      const threshold = Number(p.min_stock_alert) > 0 ? Number(p.min_stock_alert) : defaultStockThreshold;
      return p.stock_units > 0 && p.stock_units <= threshold;
    }).length;
    setKpis({
      todaySales,
      todayProfit,
      totalRevenue,
      totalProducts: prods.length,
      lowStock,
    });

    // Chart — last 30 days
    const byDay: Record<string, { sales: number; profit: number }> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      byDay[d.toISOString().slice(0, 10)] = { sales: 0, profit: 0 };
    }
    completed.forEach((s) => {
      const key = new Date(s.created_at).toISOString().slice(0, 10);
      if (byDay[key]) {
        byDay[key].sales += Number(s.total);
        byDay[key].profit += Number(s.profit);
      }
    });
    setChart(
      Object.entries(byDay).map(([k, v]) => ({
        day: new Date(k).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        sales: v.sales,
        profit: v.profit,
      }))
    );

    // Recent operations — sales + stock-in
    const ops: Operation[] = [];
    allSales.slice(0, 4).forEach((s) =>
      ops.push({
        id: s.id,
        type: "Sale",
        amount: Number(s.total),
        meta: `${new Date(s.created_at).toLocaleDateString()} ${new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${s.processed_by || "You"}`,
        status: s.status === "completed" ? "COMPLETED" : "PENDING",
      })
    );
    (movements ?? []).slice(0, 2).forEach((m) =>
      ops.push({
        id: m.id,
        type: "Purchase",
        amount: m.quantity,
        meta: `${new Date(m.created_at).toLocaleDateString()} • Stock-in`,
        status: "COMPLETED",
      })
    );
    ops.sort((a, b) => 0);
    setOperations(ops.slice(0, 5));

    // Top growth items
    const agg: Record<string, TopItem> = {};
    (saleItems ?? []).forEach((it) => {
      const k = it.product_name;
      if (!agg[k]) agg[k] = { name: k, units: 0, profit: 0 };
      agg[k].units += it.quantity;
      agg[k].profit +=
        (Number(it.unit_price) - Number(it.unit_cost)) * it.quantity;
    });
    setTopItems(
      Object.values(agg)
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 3)
    );

    // Critical alerts
    const al: { title: string; sub: string; tone: "amber" | "rose" }[] = [];
    prods
      .filter((p) => {
        const threshold = Number(p.min_stock_alert) > 0 ? Number(p.min_stock_alert) : defaultStockThreshold;
        return p.stock_units > 0 && p.stock_units <= threshold;
      })
      .slice(0, 1)
      .forEach((p) =>
        al.push({
          title: `Low Stock: ${p.name}`,
          sub: `${p.stock_units} units remaining.`,
          tone: "amber",
        })
      );
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    prods
      .filter((p) => p.expiry_date && new Date(p.expiry_date) <= soon)
      .slice(0, 1)
      .forEach((p) =>
        al.push({
          title: `Expiring: ${p.name}`,
          sub: `Expires ${new Date(p.expiry_date!).toLocaleDateString()}.`,
          tone: "rose",
        })
      );
    setAlerts(al);

    setLoading(false);
  }, [active, navigate]);

  useEffect(() => {
    if (bizLoading) return;
    if (!active) {
      navigate("/setup/business");
      return;
    }
    load();
  }, [bizLoading, active, load, navigate]);

  // Realtime
  useEffect(() => {
    if (!active) return;
    const ch = supabase
      .channel(`dashboard-${active.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `business_id=eq.${active.id}`,
        },
        () => load()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
          filter: `business_id=eq.${active.id}`,
        },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [active, load]);

  const firstName = fullName?.split(" ")[0] || "there";
  const initial = firstName.charAt(0).toUpperCase();
  const hasData = chart.some((c) => c.sales > 0);

  if (planLoading || bizLoading || loading) {
    return (
      <UserPanelGate pageTitle="Dashboard" module="dashboard">
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-muted-foreground text-sm font-medium gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p>Loading your store dashboard...</p>
        </div>
      </UserPanelGate>
    );
  }

  return (
    <UserPanelGate pageTitle="Dashboard" module="dashboard">
      <div className="w-full space-y-6 min-w-0 pb-10">
        {/* ========================================================================= */}
        {/* HEADER SECTION (Welcome Title + Action CTAs)                             */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-1 truncate text-foreground">
              Welcome back, {firstName} 👋
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {isCashier
                ? "POS terminal and sales overview dashboard."
                : "Here's your business pulse for the last 30 days."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => navigate("/dashboard/pos")}
              className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 sm:gap-2 hover:bg-primary/90 transition shadow-md shadow-primary/20 whitespace-nowrap"
            >
              <Plus className="h-4 w-4 shrink-0" /> New Sale (POS)
            </button>
            {!isCashier && (
              <button
                onClick={() => navigate("/dashboard/inventory")}
                className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-card border border-border/80 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 sm:gap-2 hover:bg-muted transition whitespace-nowrap"
              >
                <Plus className="h-4 w-4 shrink-0" /> Add Product
              </button>
            )}
            <button
              onClick={() => navigate("/dashboard/reports")}
              className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-card border border-border/80 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 sm:gap-2 hover:bg-muted transition whitespace-nowrap"
            >
              <Clock className="h-4 w-4 shrink-0" /> Reports
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5 KPI METRICS CARDS (Adaptive Grid with Text-Safe Truncation)            */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 min-w-0">
          <Stat
            label="TODAY SALES"
            value={money(kpis.todaySales)}
            iconClass="bg-blue-500/15 text-blue-500"
            icon={ShoppingCart}
            onClick={() => navigate("/dashboard/analytics")}
          />
          <Stat
            label="TODAY PROFIT"
            value={money(kpis.todayProfit)}
            iconClass="bg-emerald-500/15 text-emerald-500"
            icon={TrendingUp}
            onClick={() => navigate("/dashboard/analytics")}
          />
          <Stat
            label="TOTAL REVENUE"
            value={money(kpis.totalRevenue)}
            iconClass="bg-purple-500/15 text-purple-500"
            icon={BarChart3}
            onClick={() => navigate("/dashboard/analytics")}
          />
          <Stat
            label="TOTAL PRODUCTS"
            value={kpis.totalProducts.toLocaleString()}
            iconClass="bg-amber-500/15 text-amber-500"
            icon={Package}
            onClick={() => {
              if (!isCashier) navigate("/dashboard/inventory");
            }}
          />
          <Stat
            label="LOW STOCK"
            value={kpis.lowStock}
            delta={kpis.lowStock > 0 ? "ALERT" : "OK"}
            deltaClass={
              kpis.lowStock > 0
                ? "bg-rose-500/15 text-rose-500 font-bold"
                : "bg-emerald-500/15 text-emerald-500 font-bold"
            }
            iconClass="bg-rose-500/15 text-rose-500"
            icon={AlertTriangle}
            onClick={() => {
              if (!isCashier) navigate("/dashboard/low-stock");
            }}
          />
        </div>

        {/* ========================================================================= */}
        {/* REVENUE VELOCITY CHART & GEFLOW INTELLIGENCE SIDEBAR                      */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 sm:gap-6 min-w-0">
          {/* Revenue Velocity Chart Card */}
          <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-6 min-w-0 overflow-hidden flex flex-col justify-between shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4 min-w-0">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-base sm:text-lg truncate text-foreground">
                  Revenue Velocity
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                  Visual correlation between total sales and net profit margins.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs shrink-0">
                <span className="inline-flex items-center gap-1.5 font-bold text-muted-foreground whitespace-nowrap">
                  <span className="h-2 w-2 rounded-full bg-sky-400 shrink-0" />{" "}
                  SALES
                </span>
                <span className="inline-flex items-center gap-1.5 font-bold text-muted-foreground whitespace-nowrap">
                  <span className="h-2 w-2 rounded-full bg-violet-400 shrink-0" />{" "}
                  PROFIT
                </span>
              </div>
            </div>

            <div className="h-64 sm:h-72 w-full min-w-0">
              {hasData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chart}
                    margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#38bdf8"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="100%"
                          stopColor="#38bdf8"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#c084fc"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="100%"
                          stopColor="#c084fc"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="day"
                      tick={{
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      interval={3}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="#38bdf8"
                      strokeWidth={2.5}
                      fill="url(#g1)"
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke="#c084fc"
                      strokeWidth={2.5}
                      fill="url(#g2)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mb-2 opacity-50" />
                  <p className="font-bold text-sm text-foreground">
                    No sales recorded yet
                  </p>
                  <p className="text-xs mt-1">
                    Process sales in the POS terminal to see revenue trends here.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Geflow Intelligence + Alerts */}
          <div className="space-y-4 min-w-0">
            {/* Geflow Intelligence Banner */}
            <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-sky-400 via-cyan-400 to-violet-400 text-white shadow-xl shadow-primary/20 min-w-0 overflow-hidden flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest bg-white/20 px-2.5 py-1 rounded-full whitespace-nowrap">
                  <Sparkles className="h-3 w-3 shrink-0" /> GEFLOW INTELLIGENCE
                </div>
                <h3 className="font-bold text-lg sm:text-xl mt-3 break-words">
                  {kpis.lowStock > 0
                    ? `${kpis.lowStock} SKU${
                        kpis.lowStock > 1 ? "s" : ""
                      } need restocking`
                    : kpis.totalProducts === 0
                    ? "Add your first product"
                    : "Inventory looks healthy"}
                </h3>
                <p className="text-xs text-white/90 mt-1.5 leading-relaxed break-words">
                  {kpis.lowStock > 0
                    ? "Some products are approaching their safety threshold. Review and restock to avoid stockouts."
                    : kpis.totalProducts === 0
                    ? "Start by registering products in the Inventory Hub to unlock live analytics."
                    : "No low-stock alerts right now. Keep processing sales to grow your insights."}
                </p>
              </div>
              <button
                onClick={() =>
                  navigate(
                    kpis.totalProducts === 0
                      ? "/dashboard/inventory"
                      : "/dashboard/low-stock"
                  )
                }
                className="w-full mt-4 h-10 rounded-xl bg-white text-primary text-xs font-bold tracking-wider hover:bg-white/90 transition shadow-xs shrink-0"
              >
                {kpis.totalProducts === 0
                  ? "GO TO INVENTORY"
                  : "REVIEW RECOMMENDATION"}
              </button>
            </div>

            {/* Critical Alerts Box */}
            <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 min-w-0 overflow-hidden shadow-xs">
              <h3 className="font-bold text-sm sm:text-base mb-3 inline-flex items-center gap-2 truncate text-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />{" "}
                Critical Alerts
              </h3>
              <div className="space-y-2.5">
                {alerts.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    No critical alerts. Everything is in order.
                  </p>
                ) : (
                  alerts.map((a, i) => (
                    <div
                      key={i}
                      className={`${
                        a.tone === "amber"
                          ? "bg-amber-500/10 border-amber-500/20"
                          : "bg-rose-500/10 border-rose-500/20"
                      } border rounded-xl p-3 min-w-0`}
                    >
                      <p className="text-xs font-bold truncate text-foreground">
                        {a.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {a.sub}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RECENT OPERATIONS & TOP GROWTH ITEMS                                      */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 sm:gap-6 min-w-0">
          {/* Recent Operations */}
          <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-6 min-w-0 overflow-hidden shadow-xs">
            <div className="flex items-center justify-between gap-3 mb-4 min-w-0">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-base sm:text-lg truncate text-foreground">
                  Recent Operations
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                  Live stream of billing and stock-in events.
                </p>
              </div>
              <button
                onClick={() => navigate("/dashboard/reports")}
                className="h-8 sm:h-9 px-3 sm:px-4 rounded-xl border border-border/80 text-xs font-bold hover:bg-muted shrink-0 whitespace-nowrap"
              >
                VIEW LEDGER
              </button>
            </div>
            {operations.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <ShoppingCart className="h-7 w-7 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-bold text-foreground">
                  No operations yet
                </p>
                <p className="text-xs mt-1">
                  Sales and stock movements will appear here in real time.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60 min-w-0">
                {operations.map((op) => (
                  <div
                    key={op.id}
                    className="flex items-center justify-between gap-3 py-3 sm:py-4 min-w-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl ${
                          op.type === "Sale"
                            ? "bg-emerald-500/15 text-emerald-500"
                            : "bg-sky-500/15 text-sky-500"
                        } flex items-center justify-center shrink-0`}
                      >
                        {op.type === "Sale" ? (
                          <ShoppingCart className="h-4 w-4" />
                        ) : (
                          <Package className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs sm:text-sm truncate text-foreground">
                          {op.type} •{" "}
                          {op.type === "Sale"
                            ? money(op.amount)
                            : `${op.amount} units`}
                        </p>
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground tracking-wider truncate">
                          {op.meta}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap ${
                        op.status === "COMPLETED"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-amber-500/15 text-amber-500"
                      }`}
                    >
                      {op.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Growth Items */}
          <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-6 min-w-0 overflow-hidden flex flex-col justify-between shadow-xs">
            <div>
              <h3 className="font-bold text-base sm:text-lg truncate text-foreground">
                Top Growth Items
              </h3>
              <p className="text-xs text-muted-foreground mb-4 truncate">
                Your most profitable SKUs this month.
              </p>
              {topItems.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <TrendingUp className="h-7 w-7 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-bold text-foreground">
                    No sales data yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3 min-w-0">
                  {topItems.map((item, i) => (
                    <div
                      key={item.name}
                      className="flex items-center gap-2.5 sm:gap-3 py-2 min-w-0"
                    >
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-bold text-xs sm:text-sm truncate text-foreground"
                          title={item.name}
                        >
                          {item.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground tracking-wider truncate">
                          {item.units} UNITS SOLD
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-emerald-500">
                          {money(item.profit)}
                        </p>
                        <p className="text-[9px] sm:text-[10px] text-muted-foreground tracking-wider">
                          PROFIT
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!isCashier && (
              <button
                onClick={() => navigate("/dashboard/inventory")}
                className="w-full mt-4 h-9 sm:h-10 text-xs font-bold tracking-wider text-primary hover:underline truncate"
              >
                FULL INVENTORY ANALYTICS →
              </button>
            )}
          </div>
        </div>
      </div>
    </UserPanelGate>
  );
};

export default Dashboard;
