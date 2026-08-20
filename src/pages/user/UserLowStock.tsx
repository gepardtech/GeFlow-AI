import { useEffect, useState, useCallback } from "react";
import {
  TriangleAlert, RefreshCw, Search, Filter, Package, MoreVertical, Boxes, Layers, PackagePlus,
} from "lucide-react";
import UserPanelGate from "@/components/UserPanelGate";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { useProductCategories } from "@/hooks/useProductCategories";
import { usePlan } from "@/hooks/usePlan";
import { supabase } from "@/integrations/supabase/client";
import { useMoney } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import BulkReplenishmentDialog, { DeficitProduct } from "@/components/inventory/BulkReplenishmentDialog";
import StockUpdateDialog from "@/components/inventory/StockUpdateDialog";
import type { ProductRecord } from "@/components/inventory/ProductDialog";

interface LowProduct extends DeficitProduct {
  purchase_cost: number; retail_price: number; min_stock_alert: number;
}

const UserLowStock = () => {
  const { active, industryType, categoryName, loading: bizLoading } = useActiveBusiness();
  const { all: categories } = useProductCategories(industryType, categoryName);
  const { plan, email } = usePlan();
  const { format: fmt } = useMoney();

  const [rows, setRows] = useState<LowProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [stockTarget, setStockTarget] = useState<ProductRecord | null>(null);

  const maxItems = plan.limits.outOfStockMax === "unlimited" ? 999 : plan.limits.outOfStockMax;
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "General";

  const load = useCallback(async () => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id, name, internal_sku, barcode, category_id, purchase_cost, retail_price, stock_units, min_stock_alert, batch_number, expiry_date")
      .eq("business_id", active.id)
      .order("stock_units", { ascending: true });
    
    const defaultThreshold = active.stock_alert_limit ?? 10;
    const low = (data ?? []).filter((p: any) => {
      const threshold = (p.min_stock_alert !== null && p.min_stock_alert !== undefined && p.min_stock_alert > 0)
        ? p.min_stock_alert
        : defaultThreshold;
      return p.stock_units > 0 && p.stock_units <= threshold;
    });
    setRows(low as LowProduct[]);
    setLoading(false);
  }, [active]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? "");
    })();
  }, []);

  useEffect(() => { if (!bizLoading) load(); }, [bizLoading, load]);

  useEffect(() => {
    if (!active) return;
    const ch = supabase.channel(`lowstock-${active.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `business_id=eq.${active.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active, load]);

  const filtered = rows.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.internal_sku ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.barcode ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <UserPanelGate pageTitle="Low Stock" module="inventory">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight truncate text-foreground">Threshold Ledger</h1>
            <span className="text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full bg-amber-500 text-white shrink-0">{rows.length} WARNINGS ACTIVE</span>
          </div>
          <p className="text-xs sm:text-sm italic text-muted-foreground mt-1 truncate">"Replenish before the shelf runs dry — protect every sale."</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button variant="outline" onClick={load} className="h-9 sm:h-11 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold"><RefreshCw className="h-4 w-4 mr-1.5" /> Sync Levels</Button>
          <Button onClick={() => setBulkOpen(true)} disabled={rows.length === 0} className="h-9 sm:h-11 px-3.5 sm:px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-bold"><Layers className="h-4 w-4 mr-1.5" /> Bulk Replenish</Button>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6 min-w-0">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter low stock by name, barcode or SKU..." className="w-full h-11 sm:h-12 pl-11 pr-4 bg-card border border-border/80 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <button className="h-11 sm:h-12 px-4 sm:px-5 rounded-2xl bg-card border border-border/80 text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-muted transition shrink-0"><Filter className="h-4 w-4" /> Refine Registry</button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {bizLoading || loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading threshold ledger...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-bold">{search ? "No matching items" : "No low stock items"}</p>
            <p className="text-sm text-muted-foreground mt-1">{search ? "Try a different search." : "All products are above their safety thresholds."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left px-6 py-4">PRODUCT / SKU</th>
                  <th className="text-left px-6 py-4">CATEGORY</th>
                  <th className="text-center px-6 py-4">ON HAND</th>
                  <th className="text-center px-6 py-4">SAFETY THRESHOLD</th>
                  <th className="text-center px-6 py-4">THREAT LEVEL</th>
                  <th className="text-right px-6 py-4">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const critical = p.stock_units <= p.min_stock_alert / 2;
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-11 w-11 rounded-xl ${critical ? "bg-rose-500/15 text-rose-500" : "bg-amber-500/15 text-amber-500"} flex items-center justify-center flex-shrink-0`}><Package className="h-5 w-5" /></div>
                          <div>
                            <p className="font-bold text-sm">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground tracking-wider">SKU: {p.internal_sku || "—"} <span className="mx-1">•</span> {p.barcode || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4"><span className="text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md bg-muted text-muted-foreground uppercase">{catName(p.category_id)}</span></td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-lg font-bold ${critical ? "text-rose-500" : "text-amber-500"}`}>{p.stock_units}</span>
                        <p className="text-[10px] text-muted-foreground tracking-wider">UNITS</p>
                      </td>
                      <td className="px-6 py-4 text-center font-bold">{p.min_stock_alert}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full ${critical ? "bg-rose-500/15 text-rose-500" : "bg-amber-500/15 text-amber-500"}`}>{critical ? "CRITICAL" : "LOW STOCK"}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => setStockTarget(p as unknown as ProductRecord)}><Boxes className="h-4 w-4 mr-2" /> Update Stock</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setBulkOpen(true)}><PackagePlus className="h-4 w-4 mr-2" /> Bulk Replenish</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {active && userId && (
        <BulkReplenishmentDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          products={rows}
          businessId={active.id}
          ownerUserId={userId}
          userEmail={email ?? ""}
          planLabel={plan.label}
          maxItems={maxItems}
          categoryName={catName}
          onDone={load}
        />
      )}
      <StockUpdateDialog open={!!stockTarget} onOpenChange={(v) => { if (!v) setStockTarget(null); }} product={stockTarget} onSaved={load} />
    </UserPanelGate>
  );
};

export default UserLowStock;
