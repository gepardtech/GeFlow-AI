import { useCallback, useEffect, useRef, useState } from "react";
import { CURRENCIES } from "@/lib/currencies";
import { supabase } from "@/integrations/supabase/client";
import PanelLayout from "@/components/PanelLayout";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import { applyPlatformSettings } from "@/components/PlatformSettingsProvider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Settings, Palette, CreditCard, Shield, Bell, Loader2, Save, Upload, ImageIcon, Globe, Trash2, Mail,
} from "lucide-react";
import { EmailTemplatesManager } from "@/components/admin/EmailTemplatesManager";

type SettingsRow = Record<string, any>;

// Full global timezone list (falls back to a curated set on older browsers).
const TIMEZONES: string[] = (() => {
  try {
    // @ts-expect-error - supportedValuesOf is widely available in modern browsers
    const list = Intl.supportedValuesOf?.("timeZone");
    if (Array.isArray(list) && list.length) return list as string[];
  } catch { /* noop */ }
  return [
    "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Dubai", "Asia/Karachi",
    "Asia/Kolkata", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney",
  ];
})();

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const AdminSettings = () => {
  const { toast } = useToast();
  const [row, setRow] = useState<SettingsRow | null>(null);
  const [form, setForm] = useState<SettingsRow>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("platform_settings").select("*").limit(1).maybeSingle();
    if (data) { setRow(data); setForm(data); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const setAlert = (group: string, channel: string, v: boolean) =>
    setForm((f) => ({ ...f, alerts: { ...(f.alerts ?? {}), [group]: { ...((f.alerts ?? {})[group] ?? {}), [channel]: v } } }));

  const uploadImage = async (file: File, field: "logo_url" | "favicon_url") => {
    if (file.size > 1024 * 1024) { toast({ title: "Image too large", description: "Please use an image under 1MB.", variant: "destructive" }); return; }
    const dataUrl = await fileToDataUrl(file);
    set(field, dataUrl);
    toast({ title: "Image ready", description: "Click Save changes to apply." });
  };

  const save = async () => {
    if (!row) return;
    setSaving(true);
    const { id, created_at, updated_at, singleton, ...payload } = form;
    const { error } = await supabase.from("platform_settings").update(payload as any).eq("id", row.id);
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    applyPlatformSettings(form);
    toast({ title: "Settings saved", description: "Changes are now live across the platform." });
    load();
  };

  if (loading) {
    return (
      <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY} isAdmin>
        <div className="p-20 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
      </PanelLayout>
    );
  }

  if (!row) {
    return (
      <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY} isAdmin>
        <div className="p-20 text-center text-sm text-muted-foreground">No platform settings record found.</div>
      </PanelLayout>
    );
  }

  return (
    <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY} isAdmin>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1">System Settings</h1>
          <p className="text-sm text-muted-foreground">Branding, billing defaults, security policies and platform-wide alerts. Changes apply in real time.</p>
        </div>
        <Button onClick={save} disabled={saving} className="h-11 px-6 rounded-xl bg-sky-400 hover:bg-sky-500 text-white font-bold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Save changes</>}
        </Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="bg-card border border-border rounded-xl p-1.5 inline-flex flex-wrap h-auto gap-1">
          <TabsTrigger value="general" className="data-[state=active]:bg-sky-400/15 data-[state=active]:text-sky-500 rounded-lg gap-2 font-bold"><Settings className="h-4 w-4" /> General</TabsTrigger>
          <TabsTrigger value="branding" className="rounded-lg gap-2 font-bold"><Palette className="h-4 w-4" /> Branding</TabsTrigger>
          <TabsTrigger value="billing" className="rounded-lg gap-2 font-bold"><CreditCard className="h-4 w-4" /> Billing</TabsTrigger>
          <TabsTrigger value="security" className="rounded-lg gap-2 font-bold"><Shield className="h-4 w-4" /> Security</TabsTrigger>
          <TabsTrigger value="alerts" className="rounded-lg gap-2 font-bold"><Bell className="h-4 w-4" /> Alerts</TabsTrigger>
          <TabsTrigger value="emails" className="rounded-lg gap-2 font-bold"><Mail className="h-4 w-4" /> Email Templates</TabsTrigger>
        </TabsList>

        {/* GENERAL */}
        <TabsContent value="general" className="mt-6 space-y-6">
          <Card title="Platform Identity" desc="Core naming and regional defaults.">
            <Field label="Application Name"><Input value={form.app_name ?? ""} onChange={(e) => set("app_name", e.target.value)} /></Field>
            <Field label="Tagline"><Input value={form.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} placeholder="Short slogan shown across the app" /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="System Timezone">
                <Select value={form.system_timezone ?? "UTC"} onValueChange={(v) => set("system_timezone", v)}>
                  <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Interface Language">
                <Select value={form.interface_language ?? "en-US"} onValueChange={(v) => set("interface_language", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="en-GB">English (UK)</SelectItem>
                    <SelectItem value="ur-PK">Urdu</SelectItem>
                    <SelectItem value="ar-SA">Arabic</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Toggle label="Multi-business mode" desc="Allow eligible plans to manage multiple businesses." checked={!!form.multi_business} onChange={(v) => set("multi_business", v)} />
            <Toggle label="Global branch sync" desc="Keep inventory and pricing synced across branches." checked={!!form.global_branch_sync} onChange={(v) => set("global_branch_sync", v)} />
            <Toggle label="API maintenance mode" desc="Temporarily pause external API access for maintenance." checked={!!form.api_maintenance} onChange={(v) => set("api_maintenance", v)} />
          </Card>

          <Card title="Maintenance Mode" desc="Take the user panel offline for everyone except admins.">
            <Toggle label="Enable maintenance mode" desc="When on, all non-admin users see a maintenance screen instead of the workspace." checked={!!form.maintenance_mode} onChange={(v) => set("maintenance_mode", v)} />
            <Field label="Maintenance Message">
              <Input value={form.maintenance_message ?? ""} onChange={(e) => set("maintenance_message", e.target.value)} placeholder="GeFlow is under maintenance, please come back in some time." />
            </Field>
          </Card>
        </TabsContent>


        {/* BRANDING */}
        <TabsContent value="branding" className="mt-6 grid lg:grid-cols-2 gap-6 items-start">
          <Card title="Brand Assets" desc="Logo and favicon shown across the app and browser tab.">
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Logo */}
              <div>
                <Label className="text-xs font-bold tracking-widest text-muted-foreground">LOGO</Label>
                <div className="mt-2 border border-border rounded-xl p-4 flex flex-col items-center justify-center gap-3 bg-muted/20">
                  <div className="h-20 w-full flex items-center justify-center rounded-lg bg-card border border-border overflow-hidden">
                    {form.logo_url ? <img src={form.logo_url} alt="Logo preview" className="max-h-16 object-contain" /> : <ImageIcon className="h-7 w-7 text-muted-foreground" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "logo_url"); e.target.value = ""; }} />
                    <Button type="button" variant="outline" size="sm" onClick={() => logoRef.current?.click()}><Upload className="h-4 w-4 mr-2" /> Upload</Button>
                    {form.logo_url && <Button type="button" variant="ghost" size="sm" className="text-rose-500" onClick={() => set("logo_url", null)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </div>
              </div>
              {/* Favicon */}
              <div>
                <Label className="text-xs font-bold tracking-widest text-muted-foreground">FAVICON</Label>
                <div className="mt-2 border border-border rounded-xl p-4 flex flex-col items-center justify-center gap-3 bg-muted/20">
                  <div className="h-20 w-full flex items-center justify-center rounded-lg bg-card border border-border overflow-hidden">
                    {form.favicon_url ? <img src={form.favicon_url} alt="Favicon preview" className="h-10 w-10 object-contain" /> : <Globe className="h-7 w-7 text-muted-foreground" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <input ref={faviconRef} type="file" accept="image/png,image/x-icon,image/svg+xml,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "favicon_url"); e.target.value = ""; }} />
                    <Button type="button" variant="outline" size="sm" onClick={() => faviconRef.current?.click()}><Upload className="h-4 w-4 mr-2" /> Upload</Button>
                    {form.favicon_url && <Button type="button" variant="ghost" size="sm" className="text-rose-500" onClick={() => set("favicon_url", null)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">PNG, SVG, ICO or JPG up to 1MB. Favicon updates the browser tab icon instantly after saving.</p>
          </Card>

          <Card title="Theme & Colors" desc="Accent colors applied across panels and landing pages.">
            <div className="grid sm:grid-cols-2 gap-4">
              <ColorField label="Primary Accent" value={form.primary_accent ?? "#50c8fb"} onChange={(v) => set("primary_accent", v)} />
              <ColorField label="Secondary Accent" value={form.secondary_accent ?? "#bf83ce"} onChange={(v) => set("secondary_accent", v)} />
            </div>
            <Field label="Default Theme">
              <Select value={form.default_theme ?? "light"} onValueChange={(v) => set("default_theme", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Toggle label="White-label mode" desc="Hide GeFlow branding for resold instances." checked={!!form.white_label} onChange={(v) => set("white_label", v)} />
          </Card>
        </TabsContent>

        {/* BILLING */}
        <TabsContent value="billing" className="mt-6">
          <Card title="Billing Defaults" desc="Currency, tax and invoicing configuration.">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Base Currency">
                <Select value={form.base_currency ?? "USD"} onValueChange={(v) => set("base_currency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Universal Tax (%)"><Input type="number" value={form.universal_tax ?? 0} onChange={(e) => set("universal_tax", Number(e.target.value))} /></Field>
            </div>
            <Field label="Invoice Prefix"><Input value={form.invoice_prefix ?? ""} onChange={(e) => set("invoice_prefix", e.target.value)} /></Field>
            <Toggle label="Automated tax receipts" desc="Email a tax receipt automatically after each payment." checked={!!form.automated_tax_receipts} onChange={(v) => set("automated_tax_receipts", v)} />
          </Card>
        </TabsContent>

        {/* SECURITY */}
        <TabsContent value="security" className="mt-6">
          <Card title="Security Policies" desc="Authentication and session hardening.">
            <Toggle label="Require admin 2FA" desc="Enforce two-factor authentication for all admins." checked={!!form.admin_2fa} onChange={(v) => set("admin_2fa", v)} />
            <Toggle label="Global IP guard" desc="Restrict admin access to approved IP ranges." checked={!!form.global_ip_guard} onChange={(v) => set("global_ip_guard", v)} />
            <Toggle label="Hardware key" desc="Allow FIDO2 / hardware security keys." checked={!!form.hardware_key} onChange={(v) => set("hardware_key", v)} />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Minimum password length"><Input type="number" value={form.min_pass_length ?? 8} onChange={(e) => set("min_pass_length", Number(e.target.value))} /></Field>
              <Field label="Session timeout (hours)"><Input type="number" value={form.session_ttl ?? 12} onChange={(e) => set("session_ttl", Number(e.target.value))} /></Field>
            </div>
          </Card>
        </TabsContent>

        {/* ALERTS */}
        <TabsContent value="alerts" className="mt-6">
          <Card title="Notification Alerts" desc="Choose how the team is notified for each event.">
            <div className="space-y-3">
              {Object.entries(form.alerts ?? {}).map(([group, channels]: any) => (
                <div key={group} className="border border-border rounded-xl p-4">
                  <p className="font-bold capitalize mb-3">{group.replace(/_/g, " ")}</p>
                  <div className="flex flex-wrap gap-5">
                    {Object.entries(channels).map(([ch, val]: any) => (
                      <label key={ch} className="flex items-center gap-2 text-sm">
                        <Switch checked={!!val} onCheckedChange={(v) => setAlert(group, ch, v)} />
                        <span className="capitalize text-muted-foreground">{ch}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* EMAIL TEMPLATES */}
        <TabsContent value="emails" className="mt-6">
          <EmailTemplatesManager />
        </TabsContent>
      </Tabs>
    </PanelLayout>
  );
};

const Card = ({ title, desc, children }: any) => (
  <div className="bg-card border border-border rounded-2xl p-6 w-full">
    <p className="font-bold text-lg">{title}</p>
    <p className="text-sm text-muted-foreground mb-5">{desc}</p>
    <div className="space-y-5">{children}</div>
  </div>
);

const Field = ({ label, children }: any) => (
  <div>
    <Label className="text-xs font-bold tracking-widest text-muted-foreground">{label.toUpperCase()}</Label>
    <div className="mt-1.5">{children}</div>
  </div>
);

const ColorField = ({ label, value, onChange }: any) => (
  <div>
    <Label className="text-xs font-bold tracking-widest text-muted-foreground">{label.toUpperCase()}</Label>
    <div className="mt-1.5 flex items-center gap-3">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 rounded-lg border border-border bg-transparent cursor-pointer" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
    </div>
  </div>
);

const Toggle = ({ label, desc, checked, onChange }: any) => (
  <div className="flex items-center justify-between gap-4 border border-border rounded-xl p-4">
    <div>
      <p className="font-semibold text-sm">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export default AdminSettings;
