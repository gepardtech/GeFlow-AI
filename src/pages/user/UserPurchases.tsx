import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ShoppingBag, Download, Plus, DollarSign, Boxes, Building2, Clock,
  Search, Eye, Package, RefreshCw, Loader2, Trash2,
} from "lucide-react";
import UserPanelGate from "@/components/UserPanelGate";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useMoney } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PurchaseArchitectDialog, { PurchaseProduct } from "@/components/purchases/PurchaseArchitectDialog";
import PurchaseLedgerDialog, { PurchaseRecord } from "@/components/purchases/PurchaseLedgerDialog";

const UserPurchases = () => {
  const { active, loading: bizLoading } = useActiveBusiness();
  const { format: fmt } = useMoney();
  const { toast } = useToast();

  const [rows, setRows] = useState<PurchaseRecord[]>([]);
  const [products, setProducts] = useState<PurchaseProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [architectOpen, setArchitectOpen] = useState(false);
  const [ledger, setLedger] = useState<PurchaseRecord | null>(null);
  const [deleteRow, setDeleteRow] = useState<PurchaseRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    const [{ data: pr }, { data: pd }] = await Promise.all([
      supabase.from("purchases").select("*").eq("business_id", active.id).order("created_at", { ascending: false }),
      supabase.from("products").select("id, name, stock_units, purchase_cost, retail_price").eq("business_id", active.id).eq("status", "active").order("name"),
    ]);
    setRows((pr as PurchaseRecord[]) ?? []);
    setProducts((pd as PurchaseProduct[]) ?? []);
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
    const ch = supabase.channel(`pur-${active.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases", filter: `business_id=eq.${active.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active, load]);

  const kpis = useMemo(() => {
    const totalProcured = rows.reduce((s, r) => s + Number(r.total || 0), 0);
    const suppliers = new Set(rows.map((r) => (r.supplier_name || "").trim().toLowerCase()).filter(Boolean)).size;
    const pending = rows.filter((r) => r.status === "pending").length;
    return { totalProcured, events: rows.length, suppliers, pending };
  }, [rows]);

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    const matchesQ = !q ||
      r.supplier_name.toLowerCase().includes(q) ||
      (r.invoice_ref ?? "").toLowerCase().includes(q) ||
      r.id.slice(0, 8).toLowerCase().includes(q);
    const matchesS = statusFilter === "all" || r.status === statusFilter;
    return matchesQ && matchesS;
  });

  const exportAudit = () => {
    if (rows.length === 0) { toast({ title: "Nothing to export" }); return; }
    const header = ["Purchase ID", "Supplier", "Invoice Ref", "Entry Date", "Total", "Status"];
    const lines = rows.map((r) => [
      `PUR-${r.id.slice(0, 8)}`, r.supplier_name, r.invoice_ref ?? "", r.entry_date,
      String(r.total), r.status,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `purchases-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    // purchase_items are removed automatically via cascade.
    const { error } = await supabase.from("purchases").delete().eq("id", deleteRow.id);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Purchase record removed" });
      setRows((prev) => prev.filter((r) => r.id !== deleteRow.id));
    }
    setDeleteRow(null);
    setDeleting(false);
  };


  const shortId = (id: string) => `PUR-${id.slice(0, 4).toUpperCase()}`;
  const dateLabel = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }).toUpperCase();

  const statusPill = (s: string) => {
    const map: Record<string, string> = {
      completed: "bg-emerald-500/15 text-emerald-500",
      pending: "bg-amber-500/15 text-amber-500",
      cancelled: "bg-rose-500/15 text-rose-500",
    };
    return map[s] ?? "bg-muted text-muted-foreground";
  };

  const kpiCards = [
    { label: "TOTAL PROCURED", value: fmt(kpis.totalProcured), icon: DollarSign, tag: "LEDGER", tagCls: "bg-muted text-muted-foreground", accent: "text-emerald-500 bg-emerald-500/15" },
    { label: "STOCK-IN EVENTS", value: String(kpis.events), icon: Boxes, tag: "TOTAL", tagCls: "bg-muted text-muted-foreground", accent: "text-sky-500 bg-sky-500/15" },
    { label: "ACTIVE SUPPLIERS", value: String(kpis.suppliers), icon: Building2, tag: "VERIFIED", tagCls: "bg-muted text-muted-foreground", accent: "text-violet-500 bg-violet-500/15" },
    { label: "PENDING ARRIVALS", value: String(kpis.pending), icon: Clock, tag: "ALERT", tagCls: "bg-amber-500/15 text-amber-500", accent: "text-amber-500 bg-amber-500/15" },
  ];

  return (
    <UserPanelGate pageTitle="Purchases" module="purchases">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl md:text-4xl font-extrabold">Purchases &amp; Stock-In</h1>
            <span className="text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full bg-sky-400/15 text-sky-500">{rows.length} RECORDS</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Orchestrate incoming inventory, supplier invoicing, and batch lifecycles.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={exportAudit} className="h-11 rounded-xl font-bold"><Download className="h-4 w-4 mr-2" /> Export Audit</Button>
          <Button onClick={() => setArchitectOpen(true)} disabled={!active} className="h-11 rounded-xl bg-sky-400 hover:bg-sky-500 text-white font-bold"><Plus className="h-4 w-4 mr-2" /> New Purchase Entry</Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {kpiCards.map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-6">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${k.accent}`}><k.icon className="h-4 w-4" /></div>
              <span className={`text-[9px] font-bold tracking-widest px-2 py-1 rounded-md ${k.tagCls}`}>{k.tag}</span>
            </div>
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{k.label}</p>
            <p className="text-2xl font-extrabold mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID, Supplier, or Invoice..." className="w-full h-12 pl-11 pr-4 bg-card border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-12 w-44 rounded-2xl bg-card font-bold"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <button onClick={load} className="h-12 px-5 rounded-2xl bg-card border border-border text-sm font-bold inline-flex items-center gap-2 hover:bg-muted transition"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {bizLoading || loading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading purchase ledger...</div>
        ) : !active ? (
          <div className="p-12 text-center">
            <Package className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-bold">No business selected</p>
            <p className="text-sm text-muted-foreground mt-1">Create or select a business to record purchases.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingBag className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-bold">{search || statusFilter !== "all" ? "No matching purchases" : "No purchases yet"}</p>
            <p className="text-sm text-muted-foreground mt-1">{search || statusFilter !== "all" ? "Try a different filter." : "Record your first supplier stock-in to build the ledger."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left px-6 py-4">PURCHASE IDENTITY</th>
                  <th className="text-left px-6 py-4">SUPPLIER / BRAND</th>
                  <th className="text-left px-6 py-4">INVOICE REF</th>
                  <th className="text-left px-6 py-4">TOTAL VALUE</th>
                  <th className="text-left px-6 py-4">STATUS</th>
                  <th className="text-right px-6 py-4">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-sky-400/15 text-sky-500 flex items-center justify-center font-bold text-xs flex-shrink-0"><ShoppingBag className="h-4 w-4" /></div>
                        <div>
                          <p className="font-bold">{shortId(r.id)}</p>
                          <p className="text-[10px] font-bold tracking-wider text-muted-foreground">{dateLabel(r.entry_date)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold">{r.supplier_name || "—"}</p>
                    </td>
                    <td className="px-6 py-4"><span className="font-mono text-xs text-muted-foreground">{r.invoice_ref || "—"}</span></td>
                    <td className="px-6 py-4 font-extrabold">{fmt(Number(r.total))}</td>
                    <td className="px-6 py-4"><span className={`text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full uppercase ${statusPill(r.status)}`}>{r.status}</span></td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-3">
                        <button onClick={() => setLedger(r)} className="inline-flex items-center gap-2 text-sm font-bold text-sky-500 hover:text-sky-600 transition"><Eye className="h-4 w-4" /> View Ledger</button>
                        <button onClick={() => setDeleteRow(r)} className="inline-flex items-center gap-1.5 text-sm font-bold text-rose-500 hover:text-rose-600 transition"><Trash2 className="h-4 w-4" /> Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {active && (
        <PurchaseArchitectDialog
          open={architectOpen}
          onOpenChange={setArchitectOpen}
          businessId={active.id}
          userId={userId}
          products={products}
          onSaved={load}
        />
      )}
      <PurchaseLedgerDialog
        purchase={ledger}
        onOpenChange={(v) => !v && setLedger(null)}
        businessName={active?.business_name ?? ""}
        taxRate={Number(active?.default_tax ?? 0)}
      />

      <AlertDialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this purchase record?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <span className="font-bold">{deleteRow ? shortId(deleteRow.id) : ""}</span> and its line items from the ledger.
              Stock levels already applied from this purchase are not reversed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-rose-500 hover:bg-rose-600">
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UserPanelGate>
  );
};

export default UserPurchases;
