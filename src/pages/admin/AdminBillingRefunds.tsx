import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PanelLayout from "@/components/PanelLayout";
import BillingTabs from "@/components/BillingTabs";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import { Search, Eye, Loader2, MessageSquare, Shield, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Refund {
  id: string; ticket_id: string; amount: number; reason: string; status: string;
  admin_notes: string | null; owner_user_id: string; business_id: string | null; created_at: string;
  business?: { business_name: string | null } | null;
  owner?: { full_name: string | null; email: string | null } | null;
}

const statusBadge = (s: string) => ({
  pending: "bg-amber-400/15 text-amber-500",
  approved: "bg-emerald-400/15 text-emerald-500",
  denied: "bg-rose-400/15 text-rose-500",
}[s.toLowerCase()] ?? "bg-muted text-muted-foreground");

const AdminBillingRefunds = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<Refund | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Create modal state
  const [openAdd, setOpenAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    amount: "49.00",
    reason: "Requested refund during trial period",
    status: "pending",
  });

  // Delete modal state
  const [delTarget, setDelTarget] = useState<Refund | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/refunds");
      const json = await res.json();
      if (json.success && Array.isArray(json.refunds)) {
        setRows(json.refunds as Refund[]);
      } else {
        const { data } = await supabase.from("refund_requests").select("*").order("created_at", { ascending: false });
        const list = (data ?? []) as any[];
        if (list.length === 0) { setRows([]); setLoading(false); return; }
        const owners = Array.from(new Set(list.map((r) => r.owner_user_id)));
        const bizIds = Array.from(new Set(list.map((r) => r.business_id).filter(Boolean)));
        const [{ data: profs }, { data: biz }] = await Promise.all([
          supabase.from("profiles").select("user_id, full_name, email").in("user_id", owners),
          bizIds.length ? supabase.from("businesses").select("id, business_name").in("id", bizIds) : Promise.resolve({ data: [] }),
        ]);
        const pMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
        const bMap = new Map((biz ?? []).map((b: any) => [b.id, b]));
        setRows(list.map((r) => ({ ...r, owner: pMap.get(r.owner_user_id) ?? null, business: r.business_id ? bMap.get(r.business_id) ?? null : null })));
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel(`admin_refund_rt_${Math.random().toString(36).slice(2)}`).on("postgres_changes", { event: "*", schema: "public", table: "refund_requests" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.ticket_id.toLowerCase().includes(q)
      || (r.business?.business_name ?? "").toLowerCase().includes(q)
      || (r.owner?.full_name ?? "").toLowerCase().includes(q);
  }), [rows, search]);

  const submitCreate = async () => {
    if (!addForm.reason.trim()) {
      toast({ title: "Reason is required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(addForm.amount) || 0,
          reason: addForm.reason.trim(),
          status: addForm.status,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create refund request");
      }
      toast({ title: "Refund request created", description: json.refund?.ticket_id });
      setOpenAdd(false);
      setAddForm({ amount: "49.00", reason: "Requested refund during trial period", status: "pending" });
      load();
    } catch (err: any) {
      toast({ title: "Creation failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!delTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/refunds/${delTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete refund request");
      }
      toast({ title: "Refund request deleted", description: delTarget.ticket_id });
      setDelTarget(null);
      load();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (status: "approved" | "denied") => {
    if (!view) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/refunds/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refundId: view.id,
          status,
          admin_notes: notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update refund status");
      }
      toast({ title: status === "approved" ? "Refund approved & plan downgraded" : "Refund denied" });
      setView(null);
      setNotes("");
      load();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY} isAdmin>
      <BillingTabs />

      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search refund queue..."
            className="h-11 w-full pl-11 pr-4 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <Button onClick={() => setOpenAdd(true)} className="h-11 px-5 rounded-xl font-bold gap-2 bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg shadow-sky-500/20">
          <Plus className="h-4 w-4" /> Add Refund Request
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border bg-muted/20">
              <th className="text-left px-6 py-4">TICKET ID</th>
              <th className="text-left px-4 py-4">BUSINESS</th>
              <th className="text-center px-4 py-4">AMOUNT</th>
              <th className="text-left px-4 py-4">REASON</th>
              <th className="text-center px-4 py-4">STATUS</th>
              <th className="text-right px-6 py-4">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">No refund requests yet. Real-time entries will appear here.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-6 py-4 font-bold">{r.ticket_id}</td>
                <td className="px-4 py-4">
                  <p className="font-bold">{r.business?.business_name ?? r.owner?.full_name ?? "—"}</p>
                </td>
                <td className="px-4 py-4 text-center font-bold">${Number(r.amount).toFixed(2)}</td>
                <td className="px-4 py-4 text-muted-foreground">{r.reason}</td>
                <td className="px-4 py-4 text-center">
                  <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${statusBadge(r.status)}`}>{r.status}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button onClick={() => { setView(r); setNotes(r.admin_notes ?? ""); }} className="inline-flex items-center gap-1 text-sky-500 text-xs font-bold hover:underline">
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                    <button onClick={() => setDelTarget(r)} className="text-destructive hover:opacity-80 p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2"><MessageSquare className="h-4 w-4 text-sky-500" /><p className="font-bold">System Policy</p></div>
          <p className="text-xs text-muted-foreground leading-relaxed">GeFlow maintains a standard 14-day full refund policy. Requests outside this window require senior administrative approval and must be documented with specific service failure logs.</p>
        </div>
        <div className="bg-rose-400/5 border border-rose-400/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2"><Shield className="h-4 w-4 text-rose-500" /><p className="font-bold text-rose-500">Automated Flow</p></div>
          <p className="text-xs text-rose-500/80 leading-relaxed">Approving a refund will instantly downgrade the account to the Free tier and revoke access to Premium modules. This change propagates through our cloud synchronization layer within 60 seconds.</p>
        </div>
      </div>

      {/* Add Refund Dialog */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Refund Request</DialogTitle>
            <DialogDescription>Record a refund ticket in the centralized database collection.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div>
              <Label className="text-xs font-bold">Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={addForm.amount}
                onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">Reason for Refund</Label>
              <Input
                value={addForm.reason}
                onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">Initial Status</Label>
              <Select value={addForm.status} onValueChange={(v) => setAddForm({ ...addForm, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAdd(false)}>Cancel</Button>
            <Button onClick={submitCreate} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Refund Confirm */}
      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete refund ticket {delTarget?.ticket_id}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the record from the refund_requests database collection.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={busy} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Details Dialog */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Refund {view?.ticket_id}</DialogTitle>
            <DialogDescription>{view?.business?.business_name ?? view?.owner?.full_name} • ${Number(view?.amount ?? 0).toFixed(2)}</DialogDescription>
          </DialogHeader>
          {view && (
            <div className="space-y-4">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1">REASON</p>
                <p className="text-sm">{view.reason}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">ADMIN NOTES</p>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Internal notes…"
                  className="w-full px-3 py-2 bg-muted/40 rounded-lg text-sm" />
              </div>
              {view.status === "pending" ? (
                <div className="flex gap-2">
                  <button onClick={() => updateStatus("approved")} disabled={busy}
                    className="flex-1 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Approve Refund"}
                  </button>
                  <button onClick={() => updateStatus("denied")} disabled={busy}
                    className="flex-1 h-10 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Deny Request"}
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-muted/30 rounded-lg text-xs text-center text-muted-foreground">
                  Status: <span className="font-bold capitalize">{view.status}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PanelLayout>
  );
};

export default AdminBillingRefunds;
