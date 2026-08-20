import { useEffect, useState, useCallback } from "react";
import {
  AlertCircle, RefreshCw, Layers, Search, Filter, Package, MoreVertical, PackagePlus, Boxes,
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

interface OOSProduct extends DeficitProduct {
  purchase_cost: number; retail_price: number; min_stock_alert: number;
  discount_price: number | null; subcategory_id: string | null; description: string | null;
  batch_number: string | null; expiry_date: string | null; status: string; images: string[] | null;
}

const UserOutOfStock = () => {
  const { active, industryType, categoryName, loading: bizLoading } = useActiveBusiness();
  const { all: categories } = useProductCategories(industryType, categoryName);
  const { plan, email } = usePlan();
  const { format: fmt } = useMoney();

  const [rows, setRows] = useState<OOSProduct[]>([]);
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
      .select("id, name, internal_sku, barcode, category_id, subcategory_id, description, purchase_cost, retail_price, discount_price, stock_units, min_stock_alert, batch_number, expiry_date, status, images")
      .eq("business_id", active.id)
      .lte("stock_units", 0)
      .order("name");
    setRows((data as OOSProduct[]) ?? []);
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
    const ch = supabase.channel(`oos-${active.id}-${Math.random().toString(36).slice(2)}`)
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
    <UserPanelGate pageTitle="Out of Stock" module="inventory">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl md:text-4xl font-extrabold">Deficit Ledger</h1>
            <span className="text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full bg-rose-500 text-white">{rows.length} CRITICAL STOCKOUTS</span>
          </div>
          <p className="text-sm italic text-muted-foreground mt-1">"Every second an item is out of stock is a revenue leak."</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={load} className="h-11 rounded-xl font-bold"><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
          <Button onClick={() => setBulkOpen(true)} disabled={rows.length === 0} className="h-11 rounded-xl bg-sky-400 hover:bg-sky-500 text-white font-bold"><Layers className="h-4 w-4 mr-2" /> Bulk Update Stock</Button>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter deficit by name, barcode or SKU..." className="w-full h-12 pl-11 pr-4 bg-card border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <button className="h-12 px-5 rounded-2xl bg-card border border-border text-sm font-bold inline-flex items-center gap-2 hover:bg-muted transition"><Filter className="h-4 w-4" /> Refine Registry</button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {bizLoading || loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading deficit ledger...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-bold">{search ? "No matching stockouts" : "No stockouts detected"}</p>
            <p className="text-sm text-muted-foreground mt-1">{search ? "Try a different search." : "Every SKU currently has stock on hand."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left px-6 py-4">PRODUCT BLUEPRINT</th>
                  <th className="text-left px-6 py-4">INDUSTRY / GROUP</th>
                  <th className="text-left px-6 py-4">IDENTITY (BARCODE)</th>
                  <th className="text-right px-6 py-4">COST BASE</th>
                  <th className="text-center px-6 py-4">STATUS</th>
                  <th className="text-right px-6 py-4">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center flex-shrink-0"><Package className="h-5 w-5" /></div>
                        <div>
                          <p className="font-bold text-sm">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground tracking-wider">SKU: {p.internal_sku || "—"} <span className="mx-1">•</span> {p.subcategory_id ? catName(p.subcategory_id) : catName(p.category_id)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md bg-muted text-muted-foreground uppercase">{catName(p.category_id)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-mono font-semibold">{p.barcode || "—"}</p>
                      <div className="h-1 w-20 rounded-full bg-sky-400/40 mt-1" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="font-bold text-sm">{fmt(Number(p.purchase_cost))}</p>
                      <p className="text-[10px] text-muted-foreground tracking-wider">RETAIL: {fmt(Number(p.retail_price))}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-500">
                        <AlertCircle className="h-3 w-3" /> ZERO STOCK
                      </span>
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
                ))}
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

export default UserOutOfStock;
