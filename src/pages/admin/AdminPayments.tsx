import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PanelLayout from "@/components/PanelLayout";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Activity, Banknote, ChevronDown, Copy, CreditCard, Eye, EyeOff, Loader2,
  Plug, RefreshCw, Save, ShieldCheck, Wallet, ArrowRight, Landmark, Plus, Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";

export interface TransactionItem {
  id: string;
  gateway: string;
  amount: number;
  currency: string;
  status: string;
  customer_email?: string | null;
  customer_name?: string | null;
  plan?: string | null;
  transaction_reference?: string | null;
  created_at: string;
}

interface Gateway {
  id: string;
  gateway_key: string;
  name: string;
  enabled: boolean;
  mode: string;
  public_config: Record<string, any>;
  credentials: Record<string, any>;
  webhook_url: string | null;
  sort_order: number;
}

interface Settings {
  id: string;
  retry_failed: boolean; retry_interval_hours: number; retry_count: number; notify_user_on_failure: boolean;
  enable_refunds: boolean; allow_partial_refunds: boolean; refund_window_days: number;
  include_branding: boolean; company_address: string | null; tax_id: string | null; invoice_footer: string | null;
  multi_gateway_failover: boolean; sandbox_mode: boolean; fraud_detection: boolean; auto_send_invoices: boolean;
  payout_method: string; payout_account: string | null; payout_min_amount: number; payout_schedule: string; payout_currency: string;
}

/** Credential fields per gateway — mirrors what each provider hands out. */
const FIELDS: Record<string, { public: { key: string; label: string }[]; secret: { key: string; label: string }[] }> = {
  paypal: {
    public: [{ key: "client_id", label: "Client ID" }],
    secret: [{ key: "secret", label: "Secret Key" }, { key: "webhook_id", label: "Webhook ID" }],
  },
  stripe: {
    public: [{ key: "publishable_key", label: "Publishable Key" }],
    secret: [{ key: "secret_key", label: "Secret Key" }, { key: "webhook_secret", label: "Webhook Secret" }],
  },
  jazzcash: {
    public: [{ key: "merchant_id", label: "Merchant ID" }],
    secret: [{ key: "password", label: "Password" }, { key: "integrity_salt", label: "Integrity Salt" }],
  },
  razorpay: {
    public: [{ key: "key_id", label: "Key ID" }],
    secret: [{ key: "key_secret", label: "Key Secret" }, { key: "webhook_secret", label: "Webhook Secret" }],
  },
  bank: {
    public: [{ key: "bank_name", label: "Bank Name" }, { key: "account_title", label: "Account Title" }],
    secret: [{ key: "account_number", label: "Account / IBAN" }],
  },
};

const ICONS: Record<string, typeof Wallet> = {
  paypal: Wallet, stripe: CreditCard, jazzcash: Banknote, razorpay: Plug, bank: Landmark,
};

const DEFAULT_PAYPAL_CLIENT_ID = "BAAxlkvHkBSK_FKe9MeTzSTeTyQGBrs3nTkbrWKlwRBgoy6iBFxfQtHQknHKoneEY_D-B22eJ1bjkX-LRo";
const DEFAULT_PAYPAL_SECRET = "ENRaMOQHAN9R0m0zXhwNadzlveYSr4FHoxpM3NwytUwpOQ1ywPNHv9iZHco5GlG03r-kxYelpFSplgLK";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between py-2.5">
    <span className="text-sm font-semibold">{label}</span>
    {children}
  </div>
);

const AdminPayments = () => {
  const { toast } = useToast();
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<string | null>("paypal");
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0, volume: 0 });
  const [testing, setTesting] = useState(false);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [openAddTx, setOpenAddTx] = useState(false);
  const [addTxForm, setAddTxForm] = useState({
    gateway: "stripe",
    amount: "29.00",
    currency: "USD",
    customer_email: "",
    customer_name: "",
    plan: "standard",
    status: "completed",
  });

  const load = useCallback(async () => {
    let apiTransactions: TransactionItem[] = [];
    try {
      const txRes = await fetch("/api/admin/payment-transactions");
      const txJson = await txRes.json();
      if (txJson.success && Array.isArray(txJson.transactions)) {
        apiTransactions = txJson.transactions;
      }
    } catch {
      // Fallback to direct supabase query
    }

    const [{ data: gs }, { data: st }, { data: tx }] = await Promise.all([
      supabase.from("payment_gateways").select("*").order("sort_order", { ascending: true }),
      supabase.from("payment_settings").select("*").limit(1).maybeSingle(),
      apiTransactions.length === 0
        ? supabase.from("payment_transactions").select("*").order("created_at", { ascending: false }).limit(100)
        : Promise.resolve({ data: apiTransactions }),
    ]);
    const list = ((gs as unknown as Gateway[]) ?? []).map((g) => {
      if (g.gateway_key === "paypal") {
        const pub = { ...g.public_config };
        const cred = { ...g.credentials };
        if (!pub.client_id) pub.client_id = DEFAULT_PAYPAL_CLIENT_ID;
        if (!cred.secret) cred.secret = DEFAULT_PAYPAL_SECRET;
        return { ...g, public_config: pub, credentials: cred };
      }
      return g;
    });
    setGateways(list);
    setSettings((st as unknown as Settings) ?? null);
    const txData = (tx as TransactionItem[]) ?? apiTransactions ?? [];
    setTransactions(txData);
    setStats({
      total: txData.length,
      completed: txData.filter((r) => r.status === "completed").length,
      failed: txData.filter((r) => r.status === "failed").length,
      volume: txData.filter((r) => r.status === "completed").reduce((s, r) => s + Number(r.amount || 0), 0),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel(`admin_payments_rt_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_gateways" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_transactions" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const patchGateway = (id: string, patch: Partial<Gateway>) =>
    setGateways((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  const saveAll = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/payment-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateways,
          settings,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save payment settings");
      }
      toast({ title: "Payment settings saved", description: "Gateways are now live on checkout and synced with pricing." });
      load();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("paypal-payments", {
      body: { action: "create", plan: "standard", cycle: "monthly", amount: 1, currency: "USD" },
    });
    setTesting(false);
    if (error || data?.error) {
      toast({ title: "PayPal connection failed", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "PayPal connected", description: "Credentials verified — checkout is ready." });
  };

  const submitAddTx = async () => {
    if (!addTxForm.amount) {
      toast({ title: "Amount is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/payment-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addTxForm),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to record payment transaction");
      }
      toast({ title: "Transaction recorded", description: `Recorded ${addTxForm.currency} ${addTxForm.amount}` });
      setOpenAddTx(false);
      setAddTxForm({
        gateway: "stripe",
        amount: "29.00",
        currency: "USD",
        customer_email: "",
        customer_name: "",
        plan: "standard",
        status: "completed",
      });
      load();
    } catch (err: any) {
      toast({ title: "Failed to record", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteTx = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/payment-transactions/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete transaction");
      }
      toast({ title: "Transaction deleted" });
      load();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const successRate = stats.total ? ((stats.completed / stats.total) * 100).toFixed(1) : "100.0";
  const visible = useMemo(
    () => gateways.filter((g) => g.name.toLowerCase().includes(search.trim().toLowerCase())),
    [gateways, search],
  );

  const set = (patch: Partial<Settings>) => setSettings((s) => (s ? { ...s, ...patch } : s));

  if (loading) {
    return (
      <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY}>
        <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading payment infrastructure...
        </div>
      </PanelLayout>
    );
  }

  return (
    <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY}>
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1">Payment Settings</h1>
          <p className="text-sm text-muted-foreground max-w-md">
            Configure payment gateways, API keys, webhooks, currencies, payouts, and system status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search settings..." className="h-10 w-full sm:w-64" />
          <Button variant="outline" className="h-10 gap-2 font-bold" onClick={testConnection} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />} Test Connection
          </Button>
          <Button asChild variant="outline" className="h-10 gap-2 font-bold">
            <Link to="/admin/billing/invoices"><ArrowRight className="h-4 w-4" /> View Billing</Link>
          </Button>
          <Button onClick={saveAll} disabled={saving} className="h-10 gap-2 font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
          </Button>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_380px] gap-6">
        {/* LEFT — gateways */}
        <div className="space-y-6">
          <section className="premium-card p-6">
            <h2 className="text-2xl font-bold">Payment Gateways</h2>
            <p className="text-sm text-muted-foreground mb-5">Enable and configure your payment providers.</p>

            <div className="space-y-3">
              {visible.map((g) => {
                const Icon = ICONS[g.gateway_key] ?? CreditCard;
                const fields = FIELDS[g.gateway_key] ?? { public: [], secret: [] };
                const isOpen = open === g.gateway_key;
                const configured = fields.public.every((f) => g.public_config?.[f.key])
                  && (fields.secret[0] ? !!g.credentials?.[fields.secret[0].key] : true);
                return (
                  <div key={g.id} className="border border-border rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : g.gateway_key)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-muted/40 transition"
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-primary" />
                        <span className="font-bold">{g.name}</span>
                        <span className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full ${
                          g.enabled && configured ? "bg-emerald-500/15 text-emerald-500"
                            : configured ? "bg-slate-400/15 text-slate-500"
                            : "bg-amber-400/15 text-amber-600"
                        }`}>
                          {g.enabled && configured ? "ONLINE" : configured ? "OFFLINE" : "NOT CONFIGURED"}
                        </span>
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${isOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 border-t border-border">
                        <Row label={`Enable ${g.name}`}>
                          <Switch checked={g.enabled} onCheckedChange={(v) => patchGateway(g.id, { enabled: v })} />
                        </Row>

                        <div className="grid md:grid-cols-2 gap-5 mt-3">
                          <div className="space-y-3">
                            <p className="text-[10px] font-bold tracking-wider text-muted-foreground">API KEYS</p>
                            {fields.public.map((f) => (
                              <div key={f.key}>
                                <label className="text-xs font-semibold mb-1.5 block">{f.label}</label>
                                <Input
                                  value={g.public_config?.[f.key] ?? ""}
                                  onChange={(e) => patchGateway(g.id, { public_config: { ...g.public_config, [f.key]: e.target.value } })}
                                  placeholder={f.label}
                                  className="h-11"
                                />
                              </div>
                            ))}
                            {fields.secret.map((f) => {
                              const rk = `${g.id}:${f.key}`;
                              return (
                                <div key={f.key}>
                                  <label className="text-xs font-semibold mb-1.5 block">{f.label}</label>
                                  <div className="relative">
                                    <Input
                                      type={reveal[rk] ? "text" : "password"}
                                      value={g.credentials?.[f.key] ?? ""}
                                      onChange={(e) => patchGateway(g.id, { credentials: { ...g.credentials, [f.key]: e.target.value } })}
                                      placeholder="••••••••••••••••"
                                      className="h-11 pr-11"
                                    />
                                    <button type="button" onClick={() => setReveal((r) => ({ ...r, [rk]: !r[rk] }))}
                                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                      {reveal[rk] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="space-y-3">
                            <p className="text-[10px] font-bold tracking-wider text-muted-foreground">SETTINGS</p>
                            <div>
                              <label className="text-xs font-semibold mb-1.5 block">Mode</label>
                              <Select value={g.mode} onValueChange={(v) => patchGateway(g.id, { mode: v })}>
                                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sandbox">Test Mode</SelectItem>
                                  <SelectItem value="live">Live Mode</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-xs font-semibold mb-1.5 block">Webhook URL</label>
                              <div className="relative">
                                <Input
                                  value={g.webhook_url ?? ""}
                                  onChange={(e) => patchGateway(g.id, { webhook_url: e.target.value })}
                                  placeholder={`https://api.geflowai.com/webhooks/${g.gateway_key}`}
                                  className="h-11 pr-11"
                                />
                                <button type="button"
                                  onClick={() => { navigator.clipboard.writeText(g.webhook_url ?? ""); toast({ title: "Copied", description: "Webhook URL copied." }); }}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                  <Copy className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            {g.gateway_key === "paypal" && (
                              <Button type="button" variant="outline" className="h-10 font-bold" onClick={testConnection} disabled={testing}>
                                {testing ? "Verifying..." : "Verify Credentials"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Realtime Original Payment Transactions */}
          <section className="premium-card p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h2 className="text-2xl font-bold">Payment Transactions</h2>
                <p className="text-sm text-muted-foreground">Original real-time records from payment_transactions collection.</p>
              </div>
              <Button onClick={() => setOpenAddTx(true)} className="h-10 px-4 rounded-xl gap-2 font-bold bg-gradient-to-r from-sky-500 to-blue-500 text-white">
                <Plus className="h-4 w-4" /> Record Payment
              </Button>
            </div>

            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border bg-muted/20">
                    <th className="text-left px-4 py-3">DATE</th>
                    <th className="text-left px-4 py-3">REFERENCE</th>
                    <th className="text-left px-4 py-3">CUSTOMER</th>
                    <th className="text-left px-4 py-3">GATEWAY</th>
                    <th className="text-center px-4 py-3">AMOUNT</th>
                    <th className="text-center px-4 py-3">STATUS</th>
                    <th className="text-right px-4 py-3">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No payment transactions recorded yet. Live checkout payments and manual entries will appear here.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((t) => (
                      <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{t.transaction_reference || t.id.slice(0, 8)}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-xs">{t.customer_name || "Guest"}</p>
                          <p className="text-[11px] text-muted-foreground">{t.customer_email || "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-xs uppercase font-bold text-sky-500">{t.gateway}</td>
                        <td className="px-4 py-3 text-center font-bold text-xs">
                          {t.currency || "USD"} {Number(t.amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            t.status === "completed" ? "bg-emerald-500/15 text-emerald-500" :
                            t.status === "failed" ? "bg-rose-500/15 text-rose-500" : "bg-amber-500/15 text-amber-500"
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => deleteTx(t.id)} className="text-destructive hover:opacity-80 p-1" title="Delete transaction">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Invoice branding */}
            <section className="premium-card p-6">
              <h2 className="text-2xl font-bold">Invoice Branding</h2>
              <p className="text-sm text-muted-foreground mb-4">Customize the look of your invoices and receipts.</p>
              <Row label="Include branding on invoices">
                <Switch checked={!!settings?.include_branding} onCheckedChange={(v) => set({ include_branding: v })} />
              </Row>
              <div className="space-y-3 mt-3">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block">Company Address</label>
                  <Textarea value={settings?.company_address ?? ""} onChange={(e) => set({ company_address: e.target.value })}
                    placeholder="123 AI Lane, Tech City, 12345" rows={3} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block">Tax ID / VAT Number</label>
                  <Input value={settings?.tax_id ?? ""} onChange={(e) => set({ tax_id: e.target.value })} placeholder="Enter your Tax ID" className="h-11" />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block">Invoice Footer Text</label>
                  <Textarea value={settings?.invoice_footer ?? ""} onChange={(e) => set({ invoice_footer: e.target.value })}
                    placeholder="e.g. Thank you for your business!" rows={3} />
                </div>
              </div>
            </section>

            {/* Advanced */}
            <section className="premium-card p-6">
              <h2 className="text-2xl font-bold">Advanced Settings</h2>
              <p className="text-sm text-muted-foreground mb-4">Fine-tune system-level payment behaviors.</p>
              <Row label="Enable Multi-Gateway Failover">
                <Switch checked={!!settings?.multi_gateway_failover} onCheckedChange={(v) => set({ multi_gateway_failover: v })} />
              </Row>
              <Row label="Enable Payment Sandbox Mode">
                <Switch checked={!!settings?.sandbox_mode} onCheckedChange={(v) => set({ sandbox_mode: v })} />
              </Row>
              <Row label="Enable AI-based Fraud Detection">
                <Switch checked={!!settings?.fraud_detection} onCheckedChange={(v) => set({ fraud_detection: v })} />
              </Row>
              <Row label="Auto send invoices to admin">
                <Switch checked={!!settings?.auto_send_invoices} onCheckedChange={(v) => set({ auto_send_invoices: v })} />
              </Row>
            </section>
          </div>
        </div>

        {/* RIGHT — status / payouts */}
        <div className="space-y-6">
          <section className="premium-card p-6">
            <h2 className="text-2xl font-bold">Real-Time Payment Status</h2>
            <p className="text-sm text-muted-foreground mb-4">Monitor the health of your payment infrastructure.</p>
            <div className="space-y-3 text-sm">
              {gateways.map((g) => (
                <div key={g.id} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <Activity className="h-4 w-4 text-primary" /> {g.name}
                  </span>
                  <span className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full ${
                    g.enabled ? "bg-emerald-500/15 text-emerald-500" : "bg-slate-400/15 text-slate-500"}`}>
                    {g.enabled ? "HEALTHY" : "OFFLINE"}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-border my-4" />
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Success Rate</span><span className="font-bold">{successRate}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Completed Payments</span><span className="font-bold">{stats.completed}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Failed Payments</span><span className="font-bold text-destructive">{stats.failed}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Processed Volume</span><span className="font-bold">${stats.volume.toFixed(2)}</span></div>
            </div>
            <Button variant="outline" className="w-full h-10 mt-4 gap-2 font-bold" onClick={load}>
              <RefreshCw className="h-4 w-4" /> Refresh Now
            </Button>
          </section>

          {/* Withdrawals */}
          <section className="premium-card p-6">
            <h2 className="text-2xl font-bold">Withdrawals &amp; Payouts</h2>
            <p className="text-sm text-muted-foreground mb-4">Where your platform revenue is settled.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold mb-1.5 block">Payout Method</label>
                <Select value={settings?.payout_method ?? "paypal"} onValueChange={(v) => set({ payout_method: v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="stripe">Stripe Payouts</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="jazzcash">JazzCash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block">Payout Account</label>
                <Input value={settings?.payout_account ?? ""} onChange={(e) => set({ payout_account: e.target.value })}
                  placeholder="payouts@geflowai.com / IBAN" className="h-11" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block">Minimum Amount</label>
                  <Input type="number" value={settings?.payout_min_amount ?? 0}
                    onChange={(e) => set({ payout_min_amount: Number(e.target.value) })} className="h-11" />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block">Currency</label>
                  <Input value={settings?.payout_currency ?? "USD"} onChange={(e) => set({ payout_currency: e.target.value.toUpperCase() })} className="h-11" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block">Payout Schedule</label>
                <Select value={settings?.payout_schedule ?? "monthly"} onValueChange={(v) => set({ payout_schedule: v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Failed payments */}
          <section className="premium-card p-6">
            <h2 className="text-2xl font-bold">Failed Payment Handling</h2>
            <Row label="Retry failed payments">
              <Switch checked={!!settings?.retry_failed} onCheckedChange={(v) => set({ retry_failed: v })} />
            </Row>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-xs font-semibold mb-1.5 block">Retry Interval (hours)</label>
                <Input type="number" value={settings?.retry_interval_hours ?? 24}
                  onChange={(e) => set({ retry_interval_hours: Number(e.target.value) })} className="h-11" />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block">Retry Count</label>
                <Input type="number" value={settings?.retry_count ?? 3}
                  onChange={(e) => set({ retry_count: Number(e.target.value) })} className="h-11" />
              </div>
            </div>
            <Row label="Notify user on failure">
              <Switch checked={!!settings?.notify_user_on_failure} onCheckedChange={(v) => set({ notify_user_on_failure: v })} />
            </Row>
          </section>

          {/* Refunds */}
          <section className="premium-card p-6">
            <h2 className="text-2xl font-bold">Refunds</h2>
            <Row label="Enable Refunds">
              <Switch checked={!!settings?.enable_refunds} onCheckedChange={(v) => set({ enable_refunds: v })} />
            </Row>
            <Row label="Allow Partial Refunds">
              <Switch checked={!!settings?.allow_partial_refunds} onCheckedChange={(v) => set({ allow_partial_refunds: v })} />
            </Row>
            <div className="mt-2">
              <label className="text-xs font-semibold mb-1.5 block">Refund Window (days)</label>
              <Input type="number" value={settings?.refund_window_days ?? 14}
                onChange={(e) => set({ refund_window_days: Number(e.target.value) })} className="h-11" />
            </div>
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground mt-5 inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" /> CREDENTIALS ENCRYPTED • ADMIN ONLY
            </p>
          </section>
        </div>
      </div>

      {/* Record Payment Transaction Dialog */}
      <Dialog open={openAddTx} onOpenChange={setOpenAddTx}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment Transaction</DialogTitle>
            <DialogDescription>Store an original transaction in payment_transactions collection.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">Amount</label>
                <Input
                  type="number"
                  step="0.01"
                  value={addTxForm.amount}
                  onChange={(e) => setAddTxForm({ ...addTxForm, amount: e.target.value })}
                  placeholder="29.00"
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Currency</label>
                <Input
                  value={addTxForm.currency}
                  onChange={(e) => setAddTxForm({ ...addTxForm, currency: e.target.value.toUpperCase() })}
                  placeholder="USD"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">Gateway</label>
                <Select value={addTxForm.gateway} onValueChange={(v) => setAddTxForm({ ...addTxForm, gateway: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="jazzcash">JazzCash</SelectItem>
                    <SelectItem value="razorpay">Razorpay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Status</label>
                <Select value={addTxForm.status} onValueChange={(v) => setAddTxForm({ ...addTxForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">Customer Name</label>
              <Input
                value={addTxForm.customer_name}
                onChange={(e) => setAddTxForm({ ...addTxForm, customer_name: e.target.value })}
                placeholder="e.g. John Doe"
              />
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">Customer Email</label>
              <Input
                type="email"
                value={addTxForm.customer_email}
                onChange={(e) => setAddTxForm({ ...addTxForm, customer_email: e.target.value })}
                placeholder="e.g. client@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAddTx(false)}>Cancel</Button>
            <Button onClick={submitAddTx} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelLayout>
  );
};

export default AdminPayments;
