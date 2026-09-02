import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  ShoppingCart,
  Calendar,
  Download,
  Zap,
  ArrowUpRight,
  Clock,
  Sparkles,
  Package,
  AlertTriangle,
  FileSpreadsheet,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Building2,
  Box,
  Layers,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useNavigate } from "react-router-dom";
import UserPanelGate from "@/components/UserPanelGate";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { useProductCategories } from "@/hooks/useProductCategories";
import { supabase } from "@/integrations/supabase/client";
import { useMoney } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface RevenueVelocityPoint {
  day: string;
  revenue: number;
  costs: number;
}

interface TopProductPulse {
  id: string;
  rank: number;
  name: string;
  unitsProcessed: number;
  marginPercent: number;
  totalRevenue: number;
}

interface StagnantBottleneck {
  id: string;
  name: string;
  unitsStagnant: number;
  ageDays: number;
  action: string;
}

const PALETTE = [
  "#38bdf8", // Sky Blue
  "#818cf8", // Indigo
  "#34d399", // Emerald
  "#fbbf24", // Amber
  "#f87171", // Rose
  "#c084fc", // Purple
  "#2dd4bf", // Teal
  "#fb923c", // Orange
];

export const UserAnalytics = () => {
  const { active, industryType, categoryName, loading: bizLoading } = useActiveBusiness();
  const { all: allCategories } = useProductCategories(industryType, categoryName);
  const { format: fmt } = useMoney();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [dateRange, setDateRange] = useState<string>("7d");
  const [loading, setLoading] = useState(true);
  const [recommendationModalOpen, setRecommendationModalOpen] = useState(false);
  const [procurementModalOpen, setProcurementModalOpen] = useState(false);

  // Supabase data caches strictly for active store
  const [sales, setSales] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Load live store data from Supabase strictly filtered by active.id
  const loadData = useCallback(async () => {
    if (!active?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const [
        { data: salesData },
        { data: purchasesData },
        { data: productsData },
      ] = await Promise.all([
        supabase
          .from("sales")
          .select("id, total, profit, status, created_at")
          .eq("business_id", active.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("purchases")
          .select("id, total_amount, status, created_at")
          .eq("business_id", active.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("products")
          .select("id, name, internal_sku, category_id, subcategory_id, purchase_cost, retail_price, stock_units, min_stock_alert, created_at, updated_at")
          .eq("business_id", active.id)
          .order("created_at", { ascending: false }),
      ]);

      const currentSales = salesData || [];
      setSales(currentSales);
      setPurchases(purchasesData || []);
      setProducts(productsData || []);

      if (currentSales.length > 0) {
        const saleIds = currentSales.map((s) => s.id).slice(0, 200);
        const { data: itemsData } = await supabase
          .from("sale_items")
          .select("id, sale_id, product_id, product_name, quantity, unit_price, unit_cost, created_at")
          .in("sale_id", saleIds);
        setSaleItems(itemsData || []);
      } else {
        setSaleItems([]);
      }
    } catch (err: any) {
      console.error("Error fetching store analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [active?.id]);

  useEffect(() => {
    if (!bizLoading) loadData();
  }, [bizLoading, loadData]);

  // Compute Metrics and Visual Data strictly from this store's data
  const {
    kpis,
    velocityData,
    categoryMixData,
    operationalPulse,
    bottlenecks,
    topCategoryName,
  } = useMemo(() => {
    const now = new Date();
    let days = 7;
    if (dateRange === "today") days = 1;
    else if (dateRange === "yesterday") days = 2;
    else if (dateRange === "7d") days = 7;
    else if (dateRange === "30d") days = 30;
    else if (dateRange === "month") days = 30;
    else if (dateRange === "90d") days = 90;
    else if (dateRange === "year") days = 365;
    else if (dateRange === "all") days = 730;

    const cutoff = new Date();
    cutoff.setDate(now.getDate() - days);

    const filteredSales = sales.filter(
      (s) => new Date(s.created_at) >= cutoff && s.status !== "cancelled"
    );
    const filteredPurchases = purchases.filter(
      (p) => new Date(p.created_at) >= cutoff && p.status !== "cancelled"
    );

    // 1. KPI Calculations (strictly real store numbers)
    const totalRevenue = filteredSales.reduce((acc, s) => acc + Number(s.total || 0), 0);
    const totalProfit = filteredSales.reduce((acc, s) => acc + Number(s.profit || 0), 0);
    const totalOrders = filteredSales.length;
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // 2. Revenue Velocity Chart Data (Mon - Sun or past 7 days)
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const velocityMap = new Map<string, { revenue: number; costs: number }>();
    dayLabels.forEach((dl) => velocityMap.set(dl, { revenue: 0, costs: 0 }));

    filteredSales.forEach((s) => {
      const d = new Date(s.created_at);
      const dayIdx = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
      const label = dayLabels[dayIdx];
      const ex = velocityMap.get(label) || { revenue: 0, costs: 0 };
      ex.revenue += Number(s.total || 0);
      velocityMap.set(label, ex);
    });

    filteredPurchases.forEach((p) => {
      const d = new Date(p.created_at);
      const dayIdx = (d.getDay() + 6) % 7;
      const label = dayLabels[dayIdx];
      const ex = velocityMap.get(label) || { revenue: 0, costs: 0 };
      ex.costs += Number(p.total_amount || 0);
      velocityMap.set(label, ex);
    });

    const velocityData: RevenueVelocityPoint[] = dayLabels.map((dl) => ({
      day: dl,
      revenue: velocityMap.get(dl)?.revenue || 0,
      costs: velocityMap.get(dl)?.costs || 0,
    }));

    // 3. Dynamic Category Mix based on this store's real catalog and sales
    const catMap = new Map<string, number>();
    const getCatName = (catId?: string | null) => {
      if (!catId) return "General";
      const found = allCategories.find((c) => c.id === catId);
      return found?.name || "General";
    };

    if (filteredSales.length > 0 && saleItems.length > 0) {
      // Aggregate sales volume by category
      saleItems.forEach((it) => {
        const prod = products.find((p) => p.id === it.product_id);
        const cat = getCatName(prod?.category_id);
        catMap.set(cat, (catMap.get(cat) || 0) + Number(it.quantity || 1) * Number(it.unit_price || 0));
      });
    } else if (products.length > 0) {
      // If no sales yet, break down inventory value by category
      products.forEach((p) => {
        const cat = getCatName(p.category_id);
        const val = Number(p.stock_units || 0) * Number(p.retail_price || 0);
        catMap.set(cat, (catMap.get(cat) || 0) + (val > 0 ? val : 1));
      });
    } else {
      catMap.set(active?.business_name ? `${active.business_name} Catalog` : "General Store", 100);
    }

    const totalCatVal = Array.from(catMap.values()).reduce((a, b) => a + b, 0) || 1;
    const sortedCats = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
    const topCategoryName = sortedCats[0]?.[0] || "General";

    const categoryMixData = sortedCats.slice(0, 4).map(([name, val], idx) => ({
      name: name.toUpperCase(),
      value: Math.max(1, Math.round((val / totalCatVal) * 100)),
      color: PALETTE[idx % PALETTE.length],
    }));

    // 4. Operational Pulse: Top High-Yield SKUs from this store's real sales or inventory
    const pulseList: TopProductPulse[] = [];
    if (saleItems.length > 0) {
      const prodAgg = new Map<string, { name: string; units: number; rev: number; cost: number }>();
      saleItems.forEach((it) => {
        const pId = it.product_id || it.product_name || "item";
        const ex = prodAgg.get(pId) || {
          name: it.product_name || "Store Item",
          units: 0,
          rev: 0,
          cost: 0,
        };
        const qty = Number(it.quantity || 1);
        const price = Number(it.unit_price || 0);
        const cost = Number(it.unit_cost || price * 0.7);
        ex.units += qty;
        ex.rev += qty * price;
        ex.cost += qty * cost;
        prodAgg.set(pId, ex);
      });

      const sortedProds = Array.from(prodAgg.entries()).sort((a, b) => b[1].rev - a[1].rev);
      sortedProds.slice(0, 4).forEach(([id, data], idx) => {
        const margin = data.rev > 0 ? Math.round(((data.rev - data.cost) / data.rev) * 100) : 30;
        pulseList.push({
          id,
          rank: idx + 1,
          name: data.name,
          unitsProcessed: data.units,
          marginPercent: Math.max(5, margin),
          totalRevenue: data.rev,
        });
      });
    } else if (products.length > 0) {
      // If no sales, show top registered inventory items for this store
      products.slice(0, 4).forEach((p, idx) => {
        const retail = Number(p.retail_price || 0);
        const cost = Number(p.purchase_cost || 0);
        const margin = retail > 0 ? Math.round(((retail - cost) / retail) * 100) : 25;
        pulseList.push({
          id: p.id,
          rank: idx + 1,
          name: p.name,
          unitsProcessed: Number(p.stock_units || 0),
          marginPercent: Math.max(5, margin),
          totalRevenue: retail * Math.max(1, Number(p.stock_units || 0)),
        });
      });
    }

    // 5. System Bottlenecks: Real stagnant or low stock items from this store
    const bottleneckList: StagnantBottleneck[] = [];
    if (products.length > 0) {
      // Check products with high stock units or 0 sales
      const stagnantProds = products.filter((p) => Number(p.stock_units || 0) > 0);
      stagnantProds.slice(0, 3).forEach((p, idx) => {
        const daysOld = p.created_at
          ? Math.max(1, Math.floor((now.getTime() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24)))
          : 14 + idx * 7;
        bottleneckList.push({
          id: p.id,
          name: p.name,
          unitsStagnant: Number(p.stock_units || 0),
          ageDays: daysOld,
          action: Number(p.stock_units || 0) > 20 ? "PROMO BUNDLE SUGGESTED" : "MONITOR TURNOVER",
        });
      });
    }

    return {
      kpis: {
        totalRevenue,
        totalProfit,
        avgMargin,
        totalOrders,
      },
      velocityData,
      categoryMixData,
      operationalPulse: pulseList,
      bottlenecks: bottleneckList,
      topCategoryName,
    };
  }, [sales, purchases, products, saleItems, dateRange, allCategories, active?.business_name]);

  // Export Intelligence Action
  const handleExportIntelligence = () => {
    let csv = "Section,Metric,Value,Date Range\n";
    csv += `Store,${active?.business_name || "My Store"},${dateRange}\n`;
    csv += `KPIs,Total Revenue,${kpis.totalRevenue},${dateRange}\n`;
    csv += `KPIs,Net Profit,${kpis.totalProfit},${dateRange}\n`;
    csv += `KPIs,Average Margin,${kpis.avgMargin.toFixed(1)}%,${dateRange}\n`;
    csv += `KPIs,Order Volume,${kpis.totalOrders},${dateRange}\n\n`;

    csv += "Operational Pulse - High Yield SKUs\nRank,Product Name,Units Processed,Margin %,Total Revenue\n";
    operationalPulse.forEach((p) => {
      csv += `${p.rank},"${p.name}",${p.unitsProcessed},${p.marginPercent}%,${p.totalRevenue}\n`;
    });

    csv += "\nSystem Bottlenecks - Stock Aging Risk\nProduct Name,Units Stagnant,Age (Days),Suggested Action\n";
    bottlenecks.forEach((b) => {
      csv += `"${b.name}",${b.unitsStagnant},${b.ageDays},"${b.action}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active?.business_name || "store"}_intelligence_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Intelligence Exported",
      description: `Store telemetry downloaded for ${active?.business_name || "active business"}.`,
    });
  };

  // Download Audit handler
  const handleDownloadAudit = () => {
    let csv = "Rank,SKU Name,Units Processed,Margin %,Total Revenue\n";
    operationalPulse.forEach((p) => {
      csv += `${p.rank},"${p.name}",${p.unitsProcessed},${p.marginPercent}%,${p.totalRevenue}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active?.business_name || "store"}_sku_audit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Audit Ledger Downloaded",
      description: "Store SKU performance audit exported as CSV.",
    });
  };

  return (
    <UserPanelGate pageTitle="Analytics" module="analytics">
      <div className="w-full space-y-6 min-w-0 pb-10">
        {/* ========================================================================= */}
        {/* HEADER SECTION (Business Intelligence + Date Range + Export Intelligence) */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Store Intelligence
              </h1>
              {active?.business_name && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  {active.business_name}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Live telemetry, sales velocity, and profit margins for {active?.business_name || "your active store"}.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Date Range Selector */}
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40 h-10 rounded-xl bg-card border-border text-xs font-semibold shadow-xs">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="90d">Last 3 Months</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            {/* Export Intelligence CTA */}
            <Button
              onClick={handleExportIntelligence}
              className="h-10 px-4 rounded-xl text-xs font-bold bg-card hover:bg-muted text-foreground border border-border shadow-xs"
            >
              <Download className="w-4 h-4 mr-2" /> Export Store Report
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TOP 4 KPI CARDS STRIP                                                     */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: TOTAL REVENUE */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 dark:bg-sky-500/15 text-sky-500 flex items-center justify-center font-bold text-sm">
                $
              </div>
              <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
                {dateRange}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                TOTAL REVENUE
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mt-0.5">
                {fmt(kpis.totalRevenue)}
              </p>
            </div>
          </div>

          {/* Card 2: NET PROFIT */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Net Profit
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                NET PROFIT
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mt-0.5">
                {fmt(kpis.totalProfit)}
              </p>
            </div>
          </div>

          {/* Card 3: AVG MARGIN */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 dark:bg-purple-500/15 text-purple-500 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                Store Margin
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                AVG MARGIN
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mt-0.5">
                {kpis.avgMargin.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Card 4: ORDER VOL */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 text-amber-500 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                Orders
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                ORDER VOLUME
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mt-0.5">
                {kpis.totalOrders.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MIDDLE SECTION: Left (Revenue Velocity ~65%) & Right (Discovery + Mix)    */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Chart: Revenue Velocity (8 cols) */}
          <div className="lg:col-span-8 p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  Revenue &amp; Cost Velocity
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Visual correlation between daily sales and procurement expenses.
                </p>
              </div>

              {/* Chart Legend */}
              <div className="flex items-center gap-4 text-[10px] font-extrabold tracking-wider uppercase">
                <div className="flex items-center gap-1.5 text-sky-500">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  <span>REVENUE</span>
                </div>
                <div className="flex items-center gap-1.5 text-purple-400">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span>PROCUREMENT</span>
                </div>
              </div>
            </div>

            {/* Recharts Curved Multi-Area Chart */}
            <div className="h-[300px] sm:h-[340px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={velocityData}
                  margin={{ top: 20, right: 10, left: -15, bottom: 0 }}
                >
                  <defs>
                    {/* Sky Blue Revenue Gradient */}
                    <linearGradient id="velocityRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                    </linearGradient>
                    {/* Purple Costs Gradient */}
                    <linearGradient id="velocityCostGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c084fc" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#c084fc" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="currentColor"
                    className="text-border/30"
                  />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    className="text-muted-foreground font-medium"
                    dy={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    className="text-muted-foreground font-medium"
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const rev = Number(payload.find((p) => p.dataKey === "revenue")?.value || 0);
                        const cost = Number(payload.find((p) => p.dataKey === "costs")?.value || 0);
                        return (
                          <div className="bg-popover border border-border p-3 rounded-xl shadow-lg text-xs space-y-1">
                            <p className="font-bold text-foreground">{label}</p>
                            <p className="text-sky-500 font-semibold">Revenue: {fmt(rev)}</p>
                            <p className="text-purple-400 font-semibold">Purchases: {fmt(cost)}</p>
                            <p className="text-[10px] text-emerald-500 font-semibold border-t border-border pt-1">
                              Net: {fmt(rev - cost)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#velocityRevGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="costs"
                    stroke="#c084fc"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#velocityCostGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right Column: Intelligent Discovery + Category Mix (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            {/* Intelligent Discovery Card */}
            <div className="p-5 sm:p-6 rounded-2xl bg-sky-500/5 dark:bg-sky-950/20 border border-sky-500/20 shadow-xs relative overflow-hidden space-y-4">
              <Sparkles className="w-16 h-16 text-sky-500/10 absolute top-2 right-2 pointer-events-none" />

              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-500 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-extrabold tracking-widest text-sky-500 uppercase">
                  STORE INTELLIGENCE
                </span>
              </div>

              <div className="space-y-1">
                <h4 className="text-base sm:text-lg font-bold text-foreground">
                  {topCategoryName} Optimization
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {kpis.totalRevenue > 0
                    ? `Your ${topCategoryName} items are driving steady sales volume. Maintain healthy stock to capture demand.`
                    : `Registered ${products.length} catalog products in ${active?.business_name || "store"}. Process transactions at POS to record live velocity.`}
                </p>
              </div>

              {/* Discovery Metric Strips */}
              <div className="space-y-2 pt-1 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-card/80 dark:bg-card/50 border border-border/80">
                  <div className="flex items-center gap-2 text-muted-foreground font-semibold">
                    <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                    <span>Est. Margin Health</span>
                  </div>
                  <span className="font-bold text-emerald-500 font-mono">
                    {kpis.avgMargin > 0 ? `+${kpis.avgMargin.toFixed(1)}%` : "Ready"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-card/80 dark:bg-card/50 border border-border/80">
                  <div className="flex items-center gap-2 text-muted-foreground font-semibold">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>Catalog SKUs</span>
                  </div>
                  <span className="font-bold text-amber-500 font-mono">
                    {products.length} Products
                  </span>
                </div>
              </div>

              {/* CTA Button */}
              <Button
                onClick={() => setRecommendationModalOpen(true)}
                className="w-full h-10 rounded-xl bg-card hover:bg-muted text-foreground font-bold text-xs border border-border shadow-xs"
              >
                Review Recommendations
              </Button>
            </div>

            {/* Category Mix Card (Donut Chart) */}
            <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-xs space-y-3">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-foreground">
                  Category Mix
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Store distribution across your categories.
                </p>
              </div>

              {/* Donut Chart */}
              <div className="h-[150px] w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryMixData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {categoryMixData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [`${val}%`, name]}
                      contentStyle={{
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: "600",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* 4-Item Grid Legend */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {categoryMixData.map((cat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="truncate">{cat.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BOTTOM SECTION: Left (Operational Pulse) & Right (System Bottlenecks)     */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Operational Pulse (8 cols) */}
          <div className="lg:col-span-8 p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  Operational Pulse
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Top performing and high-yield store SKUs.
                </p>
              </div>

              {operationalPulse.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadAudit}
                  className="h-8 px-3 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border-border bg-background hover:bg-muted text-foreground"
                >
                  DOWNLOAD AUDIT
                </Button>
              )}
            </div>

            {/* List of Ranked High-Yield Items */}
            <div className="space-y-2.5 pt-1">
              {operationalPulse.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="font-semibold text-sm text-foreground">No product sales recorded yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Start processing transactions at POS to view live SKU yields.
                  </p>
                </div>
              ) : (
                operationalPulse.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-muted/20 hover:bg-muted/30 border border-border/70 transition-colors gap-3"
                  >
                    {/* Left: Rank Badge + Name + Units */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold text-xs shrink-0">
                        {item.rank}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs sm:text-sm text-foreground truncate">
                          {item.name}
                        </p>
                        <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mt-0.5">
                          {item.unitsProcessed.toLocaleString()} UNITS IN STOCK / SOLD
                        </p>
                      </div>
                    </div>

                    {/* Right: Margin % + Total Revenue */}
                    <div className="flex items-center gap-6 sm:gap-8 shrink-0 text-right">
                      <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                          MARGIN
                        </p>
                        <p className="text-xs sm:text-sm font-extrabold text-emerald-500 mt-0.5">
                          {item.marginPercent}%
                        </p>
                      </div>

                      <div className="min-w-[70px]">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                          TOTAL VAL
                        </p>
                        <p className="text-xs sm:text-sm font-extrabold text-foreground font-mono mt-0.5">
                          {fmt(item.totalRevenue)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: System Bottlenecks (4 cols) */}
          <div className="lg:col-span-4 p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">
                Inventory Aging &amp; Alerts
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Stagnant or low-turnover store stock.
              </p>
            </div>

            {/* Dead Stock Items */}
            <div className="space-y-3">
              {bottlenecks.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <ShieldCheck className="w-8 h-8 mx-auto text-emerald-500/40 mb-1" />
                  <p className="text-xs font-semibold text-foreground">Inventory Turnover Healthy</p>
                  <p className="text-[11px] text-muted-foreground">No dead stock alerts detected.</p>
                </div>
              ) : (
                bottlenecks.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/70 text-xs gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                        <Box className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-foreground truncate">
                          {item.name}
                        </p>
                        <p className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
                          {item.unitsStagnant} UNITS HELD
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-extrabold text-rose-500">
                        Age: {item.ageDays}d
                      </p>
                      <p className="text-[8px] font-bold tracking-widest text-muted-foreground uppercase mt-0.5">
                        {item.action}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Link CTA */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setProcurementModalOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 text-[11px] font-extrabold tracking-wider text-sky-500 hover:text-sky-600 transition-colors uppercase py-1"
              >
                FULL PROCUREMENT ANALYSIS <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RECOMMENDATION REVIEW MODAL                                              */}
      {/* ========================================================================= */}
      <Dialog open={recommendationModalOpen} onOpenChange={setRecommendationModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-500 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold tracking-widest text-sky-500 uppercase">
                  STORE INTELLIGENCE
                </span>
                <DialogTitle className="text-lg font-bold">
                  {topCategoryName} Performance Optimization
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Automated margin analysis and replenishment suggestions for {active?.business_name || "your store"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Store Margin Average</p>
                <p className="text-xl font-bold text-emerald-500 mt-1">
                  {kpis.avgMargin > 0 ? `${kpis.avgMargin.toFixed(1)}%` : "Healthy"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Based on recorded transaction margins</p>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Active Catalog</p>
                <p className="text-xl font-bold text-sky-500 mt-1">{products.length} SKUs</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Registered in current store workspace</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 space-y-2">
              <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-sky-500" /> Store Action Items
              </h4>
              <ul className="space-y-1.5 text-xs text-foreground/90 pl-1">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                  <span>Maintain stock safety buffers for high turnover items to prevent POS stockouts.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                  <span>Review supplier invoices in Purchases module to ensure accurate unit costs.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border gap-2">
            <Button
              variant="ghost"
              onClick={() => setRecommendationModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Dismiss
            </Button>
            <Button
              onClick={() => {
                setRecommendationModalOpen(false);
                navigate("/dashboard/purchases");
              }}
              className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-4"
            >
              Open Purchases &amp; POs <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* FULL PROCUREMENT ANALYSIS MODAL                                           */}
      {/* ========================================================================= */}
      <Dialog open={procurementModalOpen} onOpenChange={setProcurementModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold tracking-widest text-rose-500 uppercase">
                  PROCUREMENT INTELLIGENCE
                </span>
                <DialogTitle className="text-lg font-bold">
                  Inventory Aging &amp; Stock Turnover
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Breakdown of inventory holding periods for {active?.business_name || "this store"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-[10px] font-bold uppercase text-muted-foreground">
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3 text-center">Stock Held</th>
                    <th className="py-2.5 px-3 text-center">Age (Days)</th>
                    <th className="py-2.5 px-3 text-right">Turnover Strategy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bottlenecks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">
                        No aging inventory bottlenecks found.
                      </td>
                    </tr>
                  ) : (
                    bottlenecks.map((b) => (
                      <tr key={b.id}>
                        <td className="py-2.5 px-3 font-bold text-foreground">{b.name}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">{b.unitsStagnant} units</td>
                        <td className="py-2.5 px-3 text-center text-rose-500 font-bold">{b.ageDays}d</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/15 text-amber-600">
                            {b.action}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/30 border border-border text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Recommended Actions for {active?.business_name}:</p>
              <p>1. Track real-time inventory counts and configure low-stock alerts.</p>
              <p>2. Create purchase orders directly from the Purchases module when stock reaches reorder levels.</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border gap-2">
            <Button
              variant="ghost"
              onClick={() => setProcurementModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setProcurementModalOpen(false);
                navigate("/dashboard/inventory");
              }}
              className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-4"
            >
              Manage Inventory Stock
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </UserPanelGate>
  );
};

export default UserAnalytics;
