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
  Activity, Banknote, ChevronDown, Copy, CreditCard, Eye, EyeOff, Loader2,
  Plug, RefreshCw, Save, ShieldCheck, Wallet, ArrowRight, Landmark,
} from "lucide-react";
import { Link } from "react-router-dom";

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

  const load = useCallback(async () => {
    const [{ data: gs }, { data: st }, { data: tx }] = await Promise.all([
      supabase.from("payment_gateways").select("*").order("sort_order", { ascending: true }),
      supabase.from("payment_settings").select("*").limit(1).maybeSingle(),
      supabase.from("payment_transactions").select("status, amount").limit(500),
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
    const rows = (tx as { status: string; amount: number }[]) ?? [];
    setStats({
      total: rows.length,
      completed: rows.filter((r) => r.status === "completed").length,
      failed: rows.filter((r) => r.status === "failed").length,
      volume: rows.filter((r) => r.status === "completed").reduce((s, r) => s + Number(r.amount || 0), 0),
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
    for (const g of gateways) {
      await supabase.from("payment_gateways").update({
        enabled: g.enabled,
        mode: g.mode,
        public_config: g.public_config,
        credentials: g.credentials,
        webhook_url: g.webhook_url,
      } as any).eq("id", g.id);
    }
    if (settings) {
      const { id, ...rest } = settings;
      await supabase.from("payment_settings").update(rest as any).eq("id", id);
    }
    setSaving(false);
    toast({ title: "Payment settings saved", description: "Gateways are now live on checkout." });
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
                                  placeholder={`https://api.geflow.io/webhooks/${g.gateway_key}`}
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
                  placeholder="payouts@geflow.io / IBAN" className="h-11" />
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
    </PanelLayout>
  );
};

export default AdminPayments;
