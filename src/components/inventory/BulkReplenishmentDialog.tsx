import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Zap, Search, Check, ArrowRight, Loader2, PackageX } from "lucide-react";

export interface DeficitProduct {
  id: string; name: string; internal_sku: string | null; barcode: string | null;
  category_id: string | null; stock_units: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: DeficitProduct[];
  businessId: string;
  ownerUserId: string;
  userEmail: string;
  planLabel: string;
  maxItems: number;
  categoryName: (id: string | null) => string;
  onDone: () => void;
}

const genId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const BulkReplenishmentDialog = ({
  open, onOpenChange, products, businessId, ownerUserId, userEmail, planLabel, maxItems, categoryName, onDone,
}: Props) => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [authId, setAuthId] = useState(genId());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAuthId(genId());
      // Pre-select first deficit item at 10 units, matching the reference.
      setSelected(products[0] ? { [products[0].id]: 10 } : {});
      setSearch("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.internal_sku ?? "").toLowerCase().includes(q));
  }, [products, search]);

  const selectedIds = Object.keys(selected);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev[id] !== undefined) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      if (selectedIds.length >= maxItems) {
        toast({ title: "Plan limit reached", description: `The ${planLabel} plan allows ${maxItems} items per batch.`, variant: "destructive" });
        return prev;
      }
      return { ...prev, [id]: 10 };
    });
  };

  const setUnits = (id: string, v: string) => setSelected((prev) => ({ ...prev, [id]: Math.max(Number(v) || 0, 0) }));

  const authorize = async () => {
    const entries = Object.entries(selected).filter(([, u]) => u > 0);
    if (entries.length === 0) { toast({ title: "Nothing to update", description: "Select items and set add units.", variant: "destructive" }); return; }
    setSaving(true);
    for (const [id, add] of entries) {
      const p = products.find((x) => x.id === id);
      if (!p) continue;
      await supabase.from("products").update({ stock_units: p.stock_units + add }).eq("id", id);
      await supabase.from("stock_movements").insert({
        business_id: businessId, owner_user_id: ownerUserId, product_id: id,
        quantity: add, type: "restock", reason: "Bulk replenishment", note: `Batch ${authId}`,
      });
    }
    setSaving(false);
    toast({ title: "Batch authorized", description: `${entries.length} SKU(s) replenished · ID ${authId}` });
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap className="h-7 w-7 text-sky-500" />
            <div>
              <h2 className="text-2xl font-extrabold leading-tight">Bulk Replenishment Node</h2>
              <p className="text-sm text-muted-foreground">Selected: {selectedIds.length} / {maxItems} items (based on {planLabel.toLowerCase()} plan)</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex text-[11px] font-bold text-sky-500 border border-dashed border-sky-400/50 rounded-lg px-3 py-1.5">
            Node: {userEmail || "—"}
          </span>
        </div>

        <div className="grid md:grid-cols-[280px_1fr] max-h-[60vh]">
          {/* Left: deficit items */}
          <div className="border-r border-border p-4 overflow-y-auto">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">IDENTIFY DEFICIT ITEMS</p>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search catalog..." className="w-full h-10 pl-9 pr-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <ul className="space-y-2">
              {filtered.map((p) => {
                const on = selected[p.id] !== undefined;
                return (
                  <li key={p.id}>
                    <button onClick={() => toggle(p.id)} className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition ${on ? "bg-sky-400 text-white" : "hover:bg-muted/60"}`}>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{p.name}</p>
                        <p className={`text-[10px] font-bold tracking-wider ${on ? "text-white/80" : "text-muted-foreground"}`}>{p.internal_sku || "—"}</p>
                      </div>
                      <span className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 border ${on ? "bg-white/20 border-white" : "border-border"}`}>
                        {on && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="text-center py-8 text-muted-foreground"><PackageX className="h-7 w-7 mx-auto mb-2 opacity-40" /><p className="text-sm">No deficit items.</p></li>
              )}
            </ul>
          </div>

          {/* Right: quantity matrix */}
          <div className="p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground">VERIFICATION &amp; QUANTITY MATRIX</p>
              <span className="text-[11px] font-bold text-sky-500">Live Calculation Active</span>
            </div>
            {selectedIds.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <PackageX className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Select deficit items to replenish.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] font-bold tracking-widest text-muted-foreground">
                    <th className="text-left pb-3">TARGET PRODUCT</th>
                    <th className="text-center pb-3">CURRENT</th>
                    <th className="text-right pb-3">ADD UNITS</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedIds.map((id) => {
                    const p = products.find((x) => x.id === id);
                    if (!p) return null;
                    return (
                      <tr key={id} className="border-t border-border">
                        <td className="py-3">
                          <p className="text-sm font-bold">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">{categoryName(p.category_id)} · {p.barcode || p.internal_sku || "—"}</p>
                        </td>
                        <td className="py-3 text-center"><span className="text-sm font-bold text-rose-500">{p.stock_units}</span></td>
                        <td className="py-3 text-right">
                          <input type="number" min="0" value={selected[id]} onChange={(e) => setUnits(id, e.target.value)}
                            className="w-20 h-9 px-2 text-right bg-muted/50 border border-border rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground">BATCH AUTHORIZATION</p>
            <p className="text-sm font-bold">ID: {authId}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => onOpenChange(false)} className="text-sm font-bold text-muted-foreground hover:text-foreground px-4 py-2">CANCEL</button>
            <Button onClick={authorize} disabled={saving} className="h-12 px-6 rounded-xl bg-sky-400 hover:bg-sky-500 text-white font-bold">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              AUTHORIZE BATCH UPDATE <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkReplenishmentDialog;
