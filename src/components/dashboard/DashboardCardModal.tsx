import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Package,
  ShoppingCart,
  BarChart3,
  Clock,
  ArrowRight,
  ShieldAlert,
  Lightbulb,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

export type DashboardModalType =
  | "geflow_intelligence"
  | "today_sales"
  | "today_profit"
  | "total_revenue"
  | "total_products"
  | "low_stock"
  | "revenue_velocity"
  | "recent_operations"
  | "top_growth"
  | "critical_alerts"
  | null;

export interface DashboardCardModalData {
  type: DashboardModalType;
  businessName: string;
  currency: string;
  money: (amount: number) => string;
  kpis: {
    todaySales: number;
    todayProfit: number;
    totalRevenue: number;
    totalProducts: number;
    lowStock: number;
  };
  chart: { day: string; sales: number; profit: number }[];
  operations: {
    id: string;
    type: string;
    amount: number;
    meta: string;
    status: string;
  }[];
  topItems: {
    name: string;
    units: number;
    profit: number;
  }[];
  alerts: {
    title: string;
    sub: string;
    tone: "amber" | "rose";
  }[];
  lowStockItems: {
    id: string;
    name: string;
    stock_units: number;
    threshold: number;
    category?: string;
    selling_price?: number;
  }[];
  outOfStockItems: {
    id: string;
    name: string;
    category?: string;
  }[];
  todayTransactionsCount: number;
  monthTransactionsCount: number;
}

interface Props {
  data: DashboardCardModalData | null;
  onClose: () => void;
}

export const DashboardCardModal: React.FC<Props> = ({ data, onClose }) => {
  const navigate = useNavigate();

  if (!data || !data.type) return null;

  const {
    type,
    businessName,
    money,
    kpis,
    topItems,
    alerts,
    operations,
    lowStockItems,
    outOfStockItems,
    todayTransactionsCount,
  } = data;

  const handleOpenAi = () => {
    onClose();
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("geflow:open-ai-assistant"));
    }, 150);
  };

  const handleNavigate = (path: string) => {
    onClose();
    navigate(path);
  };

  // 1. GEFLOW INTELLIGENCE MODAL
  if (type === "geflow_intelligence") {
    const hasIssues = kpis.lowStock > 0 || outOfStockItems.length > 0 || kpis.totalProducts === 0;
    const targetPath =
      kpis.totalProducts === 0
        ? "/dashboard/inventory"
        : kpis.lowStock > 0
        ? "/dashboard/low-stock"
        : "/dashboard/inventory";

    return (
      <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
          <DialogHeader className="space-y-1.5 text-left border-b border-border/60 pb-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest bg-primary/10 text-primary px-3 py-1 rounded-full uppercase">
                <Sparkles className="h-3.5 w-3.5" /> GeFlow Intelligence Analysis
              </span>
              <span className="text-xs text-muted-foreground ml-auto truncate font-medium">
                {businessName}
              </span>
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 mt-2">
              Store Diagnostic & AI Suggestions
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
              Review current inventory health, identified issues, and real-time AI suggestions before navigating.
            </DialogDescription>
          </DialogHeader>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2">
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Catalog SKUs</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{kpis.totalProducts}</p>
            </div>
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Low Stock SKUs</p>
              <p className={`text-lg font-bold mt-0.5 ${kpis.lowStock > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                {kpis.lowStock}
              </p>
            </div>
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Out of Stock</p>
              <p className={`text-lg font-bold mt-0.5 ${outOfStockItems.length > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                {outOfStockItems.length}
              </p>
            </div>
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Today Revenue</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{money(kpis.todaySales)}</p>
            </div>
          </div>

          {/* Issues Section */}
          <div className="space-y-2.5 mt-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Identified Store Issues
            </h4>
            {hasIssues ? (
              <div className="space-y-2">
                {kpis.totalProducts === 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs">
                    <p className="font-bold text-foreground">Empty Product Catalog</p>
                    <p className="text-muted-foreground mt-0.5">
                      Your store has 0 products registered. You need to add products with cost and retail prices to enable POS checkout and automated sales analytics.
                    </p>
                  </div>
                )}
                {kpis.lowStock > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs">
                    <p className="font-bold text-foreground">
                      {kpis.lowStock} SKU{kpis.lowStock > 1 ? "s" : ""} Approaching Safety Threshold
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      These items have dropped to or below their alert quantity. Continuing to sell without restocking may result in missed customer orders.
                    </p>
                    {lowStockItems.length > 0 && (
                      <div className="mt-2 space-y-1.5 border-t border-amber-500/20 pt-2">
                        {lowStockItems.slice(0, 3).map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-[11px]">
                            <span className="font-medium text-foreground truncate max-w-[220px]">{item.name}</span>
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              {item.stock_units} remaining (alert at {item.threshold})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {outOfStockItems.length > 0 && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs">
                    <p className="font-bold text-foreground">
                      {outOfStockItems.length} Product{outOfStockItems.length > 1 ? "s" : ""} Completely Out of Stock
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      Immediate restock order is advised to prevent permanent customer drop-off.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <p className="text-emerald-700 dark:text-emerald-300 font-medium">
                  Zero stock deficits detected. All active products are currently above their safety thresholds.
                </p>
              </div>
            )}
          </div>

          {/* AI Suggestions Section */}
          <div className="space-y-2.5 mt-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-sky-500" />
              AI Suggestions & Action Items
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
                <p className="font-bold text-foreground">1. Prioritize Best Sellers</p>
                <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                  {topItems.length > 0
                    ? `Keep ${topItems[0].name} fully stocked. It is currently your #1 profit contributor.`
                    : "Add top moving impulse items near POS checkout to build initial sales volume."}
                </p>
              </div>
              <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
                <p className="font-bold text-foreground">2. Restock Safety Buffer</p>
                <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                  Set safety stock thresholds to at least 7-10 days of expected demand to avoid supplier delivery gaps.
                </p>
              </div>
              <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
                <p className="font-bold text-foreground">3. Bundle Slow-Moving SKUs</p>
                <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                  Offer a 10% discount on slow-moving inventory when bundled with everyday essentials.
                </p>
              </div>
              <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
                <p className="font-bold text-foreground">4. Customer Alerts</p>
                <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                  Notify regular shoppers via WhatsApp when fresh restocked batches arrive at your store.
                </p>
              </div>
            </div>
          </div>

          {/* Footer CTAs */}
          <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={handleOpenAi}
              className="w-full sm:w-auto h-10 px-4 rounded-xl border border-primary/30 text-primary text-xs font-bold hover:bg-primary/5 transition flex items-center justify-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" /> Ask Maryam AI
            </button>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="w-1/2 sm:w-auto h-10 px-4 rounded-xl border border-border text-xs font-bold hover:bg-muted transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleNavigate(targetPath)}
                className="w-1/2 sm:w-auto h-10 px-5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                {kpis.totalProducts === 0 ? "Go to Inventory Hub" : "Go to Restock & Low Stock"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 2. TODAY SALES STAT MODAL
  if (type === "today_sales") {
    const aov = todayTransactionsCount > 0 ? kpis.todaySales / todayTransactionsCount : 0;
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
          <DialogHeader className="text-left border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-blue-500/15 text-blue-500">
                <ShoppingCart className="h-4 w-4" />
              </span>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  Today's Sales Breakdown
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Real-time sales velocity and register activity for today.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Today Sales</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">{money(kpis.todaySales)}</p>
            </div>
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Orders Processed</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{todayTransactionsCount}</p>
            </div>
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Average Order Value</p>
              <p className="text-base font-bold text-foreground mt-0.5">{money(aov)}</p>
            </div>
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Today Profit</p>
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{money(kpis.todayProfit)}</p>
            </div>
          </div>

          <div className="space-y-2 mt-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              Sales Observations & Next Steps
            </h4>
            <div className="bg-muted/30 border border-border/60 rounded-xl p-3 text-xs space-y-1.5 text-muted-foreground leading-relaxed">
              <p>
                • {todayTransactionsCount > 0
                  ? `Your store has closed ${todayTransactionsCount} orders today. Average spend per customer is ${money(aov)}.`
                  : "No sales transactions completed yet today. Launch the POS terminal to record your first checkout."}
              </p>
              <p>
                • Keep quick impulse items (snacks, small accessories) right next to your checkout counter to naturally increase average order value.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-border text-xs font-bold hover:bg-muted"
            >
              Close
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleNavigate("/dashboard/analytics")}
                className="h-9 px-3.5 rounded-xl border border-primary/30 text-primary text-xs font-bold hover:bg-primary/5"
              >
                Analytics
              </button>
              <button
                type="button"
                onClick={() => handleNavigate("/dashboard/pos")}
                className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center gap-1.5"
              >
                Open POS Terminal <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 3. TODAY PROFIT STAT MODAL
  if (type === "today_profit") {
    const margin = kpis.todaySales > 0 ? (kpis.todayProfit / kpis.todaySales) * 100 : 0;
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
          <DialogHeader className="text-left border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-emerald-500/15 text-emerald-500">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  Today's Net Profit & Margin
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Gross profit calculated after subtracting cost-of-goods (COGS).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Net Profit</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{money(kpis.todayProfit)}</p>
            </div>
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Estimated Margin</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{margin.toFixed(1)}%</p>
            </div>
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Today Revenue</p>
              <p className="text-base font-bold text-foreground mt-0.5">{money(kpis.todaySales)}</p>
            </div>
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Revenue (All Time)</p>
              <p className="text-base font-bold text-foreground mt-0.5">{money(kpis.totalRevenue)}</p>
            </div>
          </div>

          <div className="space-y-2 mt-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-emerald-500" />
              Profitability Advice
            </h4>
            <div className="bg-muted/30 border border-border/60 rounded-xl p-3 text-xs space-y-1.5 text-muted-foreground leading-relaxed">
              <p>
                • Maintaining a healthy margin above 25–30% allows your business to comfortably absorb overhead and operating costs.
              </p>
              <p>
                • If margin dips, review item-level discounts given at checkout and renegotiate purchase costs with primary suppliers.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-border text-xs font-bold hover:bg-muted"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleNavigate("/dashboard/analytics")}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center gap-1.5"
            >
              View Full Profit Analytics <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 4. TOTAL REVENUE STAT MODAL
  if (type === "total_revenue") {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
          <DialogHeader className="text-left border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-purple-500/15 text-purple-500">
                <BarChart3 className="h-4 w-4" />
              </span>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  Total Store Revenue
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Cumulative completed gross revenue across all sales channels.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Lifetime Revenue</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">{money(kpis.totalRevenue)}</p>
            </div>
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Today Revenue</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{money(kpis.todaySales)}</p>
            </div>
          </div>

          <div className="bg-muted/30 border border-border/60 rounded-xl p-3 text-xs space-y-1.5 text-muted-foreground mt-2 leading-relaxed">
            <p className="font-bold text-foreground">Financial Health Check:</p>
            <p>
              All customer transactions completed at the POS counter are automatically synced into your financial ledger. For detailed daily, weekly, or tax summaries, consult the Reports module.
            </p>
          </div>

          <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-border text-xs font-bold hover:bg-muted"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleNavigate("/dashboard/reports")}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center gap-1.5"
            >
              Open Financial Reports <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 5. TOTAL PRODUCTS STAT MODAL
  if (type === "total_products") {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
          <DialogHeader className="text-left border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-amber-500/15 text-amber-500">
                <Package className="h-4 w-4" />
              </span>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  Catalog & Product Summary
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Active SKU status and inventory distribution.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2.5 mt-2">
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Total SKUs</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{kpis.totalProducts}</p>
            </div>
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Low Stock</p>
              <p className={`text-lg font-bold mt-0.5 ${kpis.lowStock > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                {kpis.lowStock}
              </p>
            </div>
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Out of Stock</p>
              <p className={`text-lg font-bold mt-0.5 ${outOfStockItems.length > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                {outOfStockItems.length}
              </p>
            </div>
          </div>

          <div className="space-y-2 mt-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Catalog Health & Observations
            </h4>
            <div className="bg-muted/30 border border-border/60 rounded-xl p-3 text-xs space-y-1.5 text-muted-foreground leading-relaxed">
              {kpis.totalProducts === 0 ? (
                <p className="text-amber-600 dark:text-amber-400 font-medium">
                  No products found. Add products with barcodes, cost prices, and categories to start selling.
                </p>
              ) : (
                <>
                  <p>
                    • You have {kpis.totalProducts} registered products in your database.
                  </p>
                  {kpis.lowStock > 0 && (
                    <p className="text-amber-600 dark:text-amber-400">
                      • {kpis.lowStock} item(s) are low in stock and need replenishment.
                    </p>
                  )}
                  {outOfStockItems.length > 0 && (
                    <p className="text-rose-600 dark:text-rose-400">
                      • {outOfStockItems.length} item(s) are currently completely sold out.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-border text-xs font-bold hover:bg-muted"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleNavigate("/dashboard/inventory")}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center gap-1.5"
            >
              Go to Inventory Hub <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 6. LOW STOCK STAT MODAL
  if (type === "low_stock") {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
          <DialogHeader className="text-left border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-rose-500/15 text-rose-500">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  Low Stock & Out-of-Stock Alert
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Products that have breached your store safety reorder threshold.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Low Stock Items</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{kpis.lowStock}</p>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Out of Stock</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{outOfStockItems.length}</p>
            </div>
          </div>

          {/* List of critical low stock items */}
          <div className="space-y-2 mt-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Critical SKUs Needing Reorder
            </h4>
            {lowStockItems.length === 0 && outOfStockItems.length === 0 ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-700 dark:text-emerald-300">
                All inventory levels are optimal. No immediate restocking is required.
              </div>
            ) : (
              <div className="divide-y divide-border/60 border border-border/60 rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-card">
                {lowStockItems.map((p) => (
                  <div key={p.id} className="p-2.5 text-xs flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">Alert threshold: {p.threshold} units</p>
                    </div>
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                      {p.stock_units} left
                    </span>
                  </div>
                ))}
                {outOfStockItems.map((p) => (
                  <div key={p.id} className="p-2.5 text-xs flex items-center justify-between gap-2 bg-rose-500/5">
                    <p className="font-bold text-foreground truncate">{p.name}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 shrink-0">
                      0 UNITS
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-border text-xs font-bold hover:bg-muted"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleNavigate("/dashboard/low-stock")}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center gap-1.5"
            >
              Go to Low Stock Management <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 7. REVENUE VELOCITY MODAL
  if (type === "revenue_velocity") {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
          <DialogHeader className="text-left border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-sky-500/15 text-sky-500">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  Revenue Velocity Analysis
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  30-day correlation between total sales and net profit margins.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 mt-2 text-xs">
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3.5 space-y-2">
              <p className="font-bold text-foreground text-sm">Velocity Dynamics:</p>
              <p className="text-muted-foreground leading-relaxed">
                • Blue curve tracks total gross sales billed through the POS register.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                • Purple curve indicates actual gross profit earned after deducting inventory unit costs.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                • A widening gap between sales and profit indicates heavy discounts or a high proportion of low-margin sales.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-border text-xs font-bold hover:bg-muted"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleNavigate("/dashboard/analytics")}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center gap-1.5"
            >
              Detailed Analytics <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 8. RECENT OPERATIONS MODAL
  if (type === "recent_operations") {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
          <DialogHeader className="text-left border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-emerald-500/15 text-emerald-500">
                <Clock className="h-4 w-4" />
              </span>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  Recent Operations Ledger
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Real-time audit log of sales checkouts and stock-in movements.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Recent Stream ({operations.length} events)
            </h4>
            {operations.length === 0 ? (
              <div className="bg-muted/40 border border-border/60 rounded-xl p-4 text-center text-xs text-muted-foreground">
                No recent operations recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-border/60 border border-border/60 rounded-xl overflow-hidden max-h-56 overflow-y-auto bg-card">
                {operations.map((op) => (
                  <div key={op.id} className="p-3 text-xs flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">
                        {op.type} • {op.type === "Sale" ? money(op.amount) : `${op.amount} units`}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{op.meta}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
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

          <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-border text-xs font-bold hover:bg-muted"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleNavigate("/dashboard/reports")}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center gap-1.5"
            >
              Go to Full Reports & Ledger <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 9. TOP GROWTH ITEMS MODAL
  if (type === "top_growth") {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
          <DialogHeader className="text-left border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-emerald-500/15 text-emerald-500">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  Top Growth & High-Profit Products
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Your most profitable SKUs driving store performance.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Top Profit Drivers
            </h4>
            {topItems.length === 0 ? (
              <div className="bg-muted/40 border border-border/60 rounded-xl p-4 text-center text-xs text-muted-foreground">
                No product sales recorded yet. Process checkouts in the POS terminal to discover your top growth items.
              </div>
            ) : (
              <div className="divide-y divide-border/60 border border-border/60 rounded-xl overflow-hidden max-h-56 overflow-y-auto bg-card">
                {topItems.map((item, i) => (
                  <div key={item.name} className="p-3 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-6 w-6 rounded-md bg-muted text-foreground flex items-center justify-center font-bold text-[11px] shrink-0">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground truncate">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">{item.units} units sold</p>
                      </div>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                      +{money(item.profit)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-muted/30 border border-border/60 rounded-xl p-3 text-xs space-y-1 text-muted-foreground mt-2 leading-relaxed">
            <p className="font-bold text-foreground">Growth Recommendation:</p>
            <p>
              Ensure your supplier leads times for these items are short and keep backup inventory so you never run out of your most profitable stock.
            </p>
          </div>

          <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-border text-xs font-bold hover:bg-muted"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleNavigate("/dashboard/inventory")}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center gap-1.5"
            >
              Open Inventory Catalog <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 10. CRITICAL ALERTS MODAL
  if (type === "critical_alerts") {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
          <DialogHeader className="text-left border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-amber-500/15 text-amber-500">
                <ShieldAlert className="h-4 w-4" />
              </span>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  Active Critical Alerts
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Real-time stock alerts and expiring inventory notifications.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            {alerts.length === 0 ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <p className="text-emerald-700 dark:text-emerald-300 font-medium">
                  No critical alerts at this time. All inventory and batch expiries are clear.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <div
                    key={i}
                    className={`border rounded-xl p-3 text-xs ${
                      a.tone === "amber"
                        ? "bg-amber-500/10 border-amber-500/20 text-foreground"
                        : "bg-rose-500/10 border-rose-500/20 text-foreground"
                    }`}
                  >
                    <p className="font-bold">{a.title}</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">{a.sub}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-border text-xs font-bold hover:bg-muted"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleNavigate("/dashboard/low-stock")}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center gap-1.5"
            >
              Resolve Low Stock Alerts <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
};

export default DashboardCardModal;
