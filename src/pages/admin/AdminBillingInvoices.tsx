import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PanelLayout from "@/components/PanelLayout";
import BillingTabs from "@/components/BillingTabs";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import { usePlatformSettings } from "@/components/PlatformSettingsProvider";
import { Search, Plus, MoreVertical, Loader2, Download, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

interface BrandOpts { logo?: string | null; appName?: string; tagline?: string | null; }


interface Inv {
  id: string; invoice_number: string; client_name: string; billing_email: string;
  plan: string; payment_method: string; amount: number; status: string; issue_date: string;
}

const statusBadge = (s: string) => ({
  paid: "bg-emerald-400/15 text-emerald-500",
  pending: "bg-amber-400/15 text-amber-500",
  overdue: "bg-rose-400/15 text-rose-500",
  refunded: "bg-violet-400/15 text-violet-500",
}[s.toLowerCase()] ?? "bg-muted text-muted-foreground");

const blank = () => ({ client_name: "", billing_email: "", plan: "standard", payment_method: "Stripe", amount: 0, status: "paid", issue_date: new Date().toISOString().slice(0,10), notes: "" });

const downloadInvoicePdf = (inv: Inv & { notes?: string | null }, brand: BrandOpts = {}) => {
  const doc = new jsPDF();
  const appName = brand.appName || "GeFlow";
  let headerY = 22;
  if (brand.logo) {
    try {
      const fmt = brand.logo.startsWith("data:image/png") ? "PNG"
        : brand.logo.startsWith("data:image/jpeg") || brand.logo.startsWith("data:image/jpg") ? "JPEG"
        : brand.logo.startsWith("data:image/webp") ? "WEBP" : "PNG";
      doc.addImage(brand.logo, fmt, 20, 12, 40, 16);
      headerY = 36;
    } catch { /* fall back to text below */ }
  }
  if (!brand.logo) {
    doc.setFontSize(22); doc.setFont("helvetica","bold"); doc.text(appName, 20, 22);
    doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.text(brand.tagline || "by Gepard Tech", 20, 28);
  }
  doc.setFontSize(18); doc.setFont("helvetica","bold"); doc.text("INVOICE", 190, 22, { align: "right" });
  doc.setFontSize(10); doc.setFont("helvetica","normal");
  doc.text(`#${inv.invoice_number}`, 190, 28, { align: "right" });
  doc.text(inv.issue_date, 190, 34, { align: "right" });
  doc.line(20, 42, 190, 42);
  doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.text("BILL TO", 20, 52);
  doc.setFont("helvetica","normal"); doc.setFontSize(11);
  doc.text(inv.client_name, 20, 59); doc.setFontSize(9); doc.text(inv.billing_email, 20, 65);
  doc.setFont("helvetica","bold"); doc.text("PAYMENT METHOD", 190, 52, { align: "right" });
  doc.setFont("helvetica","normal"); doc.setFontSize(11); doc.text(inv.payment_method, 190, 59, { align: "right" });
  doc.setFillColor(245,245,250); doc.rect(20, 80, 170, 10, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(9);
  doc.text("PLAN", 23, 87); doc.text("STATUS", 130, 87); doc.text("AMOUNT", 187, 87, { align: "right" });
  doc.setFont("helvetica","normal"); doc.setFontSize(11);
  doc.text(inv.plan, 23, 100); doc.text(inv.status, 130, 100); doc.text(`$${Number(inv.amount).toFixed(2)}`, 187, 100, { align: "right" });
  doc.line(20, 110, 190, 110);
  doc.setFont("helvetica","bold"); doc.setFontSize(13);
  doc.text("TOTAL", 130, 122); doc.text(`$${Number(inv.amount).toFixed(2)}`, 187, 122, { align: "right" });
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(120);
  doc.text(`Thank you for choosing ${appName}. For support, contact gepardwebs@gmail.com`, 105, 270, { align: "center" });
  doc.save(`${appName}-${inv.invoice_number}.pdf`);
};

const AdminBillingInvoices = () => {
  const { toast } = useToast();
  const { settings } = usePlatformSettings();
  const brand: BrandOpts = { logo: settings?.logo_url, appName: settings?.app_name, tagline: settings?.tagline };
  const [rows, setRows] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<Inv | null>(null);

  const [form, setForm] = useState(blank());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    let q = supabase.from("invoices").select("*").order("created_at", { ascending: false });
    if (!search) q = q.limit(10);
    const { data } = await q;
    setRows((data as Inv[]) ?? []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    load();
    const ch = supabase.channel("admin_inv_rt").on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      r.invoice_number.toLowerCase().includes(q) ||
      r.client_name.toLowerCase().includes(q) ||
      r.billing_email.toLowerCase().includes(q));
  }, [rows, search]);

  const submit = async () => {
    if (!form.client_name.trim() || !form.billing_email.trim()) { toast({ title: "Client name and email required", variant: "destructive" }); return; }
    setBusy(true);
    const prefix = (settings?.invoice_prefix?.trim() || "INV").replace(/-+$/, "");
    const num = `${prefix}-${Date.now().toString().slice(-6)}`;
    const { data: { user } } = await supabase.auth.getUser();
    const { error, data } = await supabase.from("invoices").insert({
      invoice_number: num, owner_user_id: user?.id ?? null,
      client_name: form.client_name.trim(), billing_email: form.billing_email.trim(),
      plan: form.plan, payment_method: form.payment_method,
      amount: Number(form.amount), status: form.status, issue_date: form.issue_date,
      notes: form.notes || null,
    }).select().single();
    setBusy(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Invoice created" });
    setOpen(false);
    if (data) downloadInvoicePdf(data as any, brand);
    setForm(blank());
  };

  const confirmDelete = async () => {
    if (!delTarget) return;
    const { error } = await supabase.from("invoices").delete().eq("id", delTarget.id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Invoice deleted", description: delTarget.invoice_number }); load(); }
    setDelTarget(null);
  };


  return (
    <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY} isAdmin>
      <BillingTabs />

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search business, ID or email..."
            className="h-12 w-full pl-11 pr-4 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <Button onClick={() => setOpen(true)} className="h-12 px-5 rounded-xl bg-sky-400 hover:bg-sky-500 text-white font-bold">
          <Plus className="h-4 w-4 mr-2" /> New Manual Invoice
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border bg-muted/20">
              <th className="text-left px-6 py-4">ID / STATUS</th>
              <th className="text-left px-4 py-4">BILLING ENTITY</th>
              <th className="text-center px-4 py-4">ISSUE DATE</th>
              <th className="text-center px-4 py-4">GATEWAY</th>
              <th className="text-right px-4 py-4">AMOUNT</th>
              <th className="text-right px-6 py-4">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">No invoices yet — create one with "New Manual Invoice".</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-6 py-4">
                  <p className="font-bold">{r.invoice_number}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider uppercase ${statusBadge(r.status)}`}>{r.status}</span>
                </td>
                <td className="px-4 py-4">
                  <p className="font-bold">{r.client_name}</p>
                  <p className="text-xs text-muted-foreground">{r.billing_email}</p>
                </td>
                <td className="px-4 py-4 text-center text-muted-foreground">{r.issue_date}</td>
                <td className="px-4 py-4 text-center">{r.payment_method}</td>
                <td className="px-4 py-4 text-right font-bold">${Number(r.amount).toFixed(2)}</td>
                <td className="px-6 py-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-8 w-8 rounded-lg hover:bg-muted inline-flex items-center justify-center"><MoreVertical className="h-4 w-4" /></button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => downloadInvoicePdf(r as any, brand)}><Download className="h-4 w-4 mr-2" /> Download PDF</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDelTarget(r)} className="text-rose-500 focus:text-rose-500"><Trash2 className="h-4 w-4 mr-2" /> Delete Invoice</DropdownMenuItem>
                    </DropdownMenuContent>

                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Manual Invoice</DialogTitle>
            <DialogDescription>Fill the form on the left — preview updates instantly on the right.</DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-6">
            {/* LEFT: form */}
            <div className="space-y-3">
              <Field label="CLIENT NAME"><input value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Field>
              <Field label="BILLING EMAIL"><input value={form.billing_email} onChange={(e) => setForm((f) => ({ ...f, billing_email: e.target.value }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SUBSCRIPTION PLAN">
                  <Select value={form.plan} onValueChange={(v) => setForm((f) => ({ ...f, plan: v }))}>
                    <SelectTrigger className="h-10 bg-muted/40 border-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["free","standard","premium","lifetime"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="PAYMENT METHOD">
                  <Select value={form.payment_method} onValueChange={(v) => setForm((f) => ({ ...f, payment_method: v }))}>
                    <SelectTrigger className="h-10 bg-muted/40 border-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Stripe","PayPal","Credit Card","Bank Transfer","N/A"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="TOTAL AMOUNT ($)"><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Field>
                <Field label="STATUS">
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger className="h-10 bg-muted/40 border-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["paid","pending","overdue","refunded"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="ISSUE DATE"><input type="date" value={form.issue_date} onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Field>
              <Button onClick={submit} disabled={busy} className="w-full h-11 rounded-xl bg-sky-400 hover:bg-sky-500 text-white font-bold mt-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Download className="h-4 w-4 mr-2" /> Create &amp; Download PDF</>}
              </Button>
            </div>

            {/* RIGHT: preview */}
            <div className="bg-muted/30 border border-border rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xl font-bold">GeFlow</p>
                  <p className="text-[10px] text-muted-foreground">by Gepard Tech</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">INVOICE</p>
                  <p className="text-[10px] text-muted-foreground">PREVIEW</p>
                  <p className="text-xs mt-1">{form.issue_date}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div><p className="text-[10px] font-bold tracking-widest text-muted-foreground">BILL TO</p><p className="font-bold mt-1">{form.client_name || "Client name"}</p><p className="text-xs text-muted-foreground">{form.billing_email || "client@email.com"}</p></div>
                <div className="text-right"><p className="text-[10px] font-bold tracking-widest text-muted-foreground">METHOD</p><p className="font-bold mt-1">{form.payment_method}</p></div>
              </div>
              <div className="bg-background rounded-lg p-3 mb-3">
                <div className="flex justify-between text-[10px] font-bold tracking-widest text-muted-foreground mb-2">
                  <span>PLAN</span><span>STATUS</span><span>AMOUNT</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{form.plan}</span>
                  <span className="capitalize">{form.status}</span>
                  <span className="font-bold">${Number(form.amount).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex justify-between border-t border-border pt-3">
                <span className="font-bold">TOTAL</span>
                <span className="text-xl font-bold text-sky-500">${Number(form.amount).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <span className="font-semibold">{delTarget?.invoice_number}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-500 hover:bg-rose-600 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PanelLayout>

  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">{label}</p>{children}</div>
);

export default AdminBillingInvoices;
