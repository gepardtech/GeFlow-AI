import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Building2, CheckCircle2, ArrowRight, ArrowLeft, Loader2, Rocket } from "lucide-react";
import { getPlan, normalizePlan } from "@/lib/plans";
import { CURRENCY_SYMBOLS } from "@/lib/currency";

interface Category { id: string; name: string; industry_type: string; currency: string; }

const Step = ({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) => (
  <div className="flex items-center gap-3 flex-1">
    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition ${
      done ? "bg-emerald-500 border-emerald-500 text-white" :
      active ? "bg-primary border-primary text-primary-foreground" :
      "bg-card border-border text-muted-foreground"
    }`}>{done ? <CheckCircle2 className="h-4 w-4" /> : n}</div>
    <span className={`text-xs font-bold tracking-wider ${active || done ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
  </div>
);

const SetupBusiness = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string | null; fullName: string | null; plan: string } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bizCount, setBizCount] = useState(0);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [currency, setCurrency] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { navigate("/login"); return; }
      const [{ data: p }, { data: cats }, { count }] = await Promise.all([
        supabase.from("profiles").select("full_name, email, plan").eq("user_id", u.id).maybeSingle(),
        supabase.from("business_categories").select("id, name, industry_type, currency").eq("status", "active").order("name"),
        supabase.from("businesses").select("id", { count: "exact", head: true }).eq("owner_user_id", u.id),
      ]);
      setUser({ id: u.id, email: u.email ?? null, fullName: p?.full_name ?? null, plan: p?.plan ?? "free" });
      setCategories((cats as Category[]) ?? []);
      setBizCount(count ?? 0);
    })();
  }, [navigate]);

  const plan = useMemo(() => getPlan(user?.plan), [user?.plan]);
  const limit = plan.limits.branchesMax === "unlimited" ? Infinity : (plan.limits.branchesMax as number);
  const overLimit = bizCount >= limit;

  const handleSubmit = async () => {
    if (!user) return;
    if (!name.trim()) { toast({ title: "Business name required", variant: "destructive" }); return; }
    if (!categoryId) { toast({ title: "Please select a category", variant: "destructive" }); return; }
    setBusy(true);
    const { error } = await supabase.from("businesses").insert({
      owner_user_id: user.id,
      business_name: name.trim(),
      business_address: address.trim() || null,
      category_id: categoryId,
      currency: currency || categories.find((c) => c.id === categoryId)?.currency || "USD",
    });
    setBusy(false);
    if (error) { toast({ title: "Could not create business", description: error.message, variant: "destructive" }); return; }
    setStep(3);
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-card border border-border rounded-3xl shadow-2xl shadow-primary/5 overflow-hidden">
          <div className="bg-hero-gradient p-6 text-primary-foreground">
            <div className="flex items-center gap-2 mb-2"><Rocket className="h-5 w-5" /><span className="text-xs font-bold tracking-widest uppercase">Business Setup</span></div>
            <h1 className="text-2xl md:text-3xl font-bold">Welcome to GeFlow</h1>
            <p className="text-sm text-primary-foreground/80">Three quick steps to launch your command center.</p>
          </div>

          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <Step n={1} label="WELCOME" active={step === 1} done={step > 1} />
              <div className="h-px flex-1 bg-border" />
              <Step n={2} label="YOUR BUSINESS" active={step === 2} done={step > 2} />
              <div className="h-px flex-1 bg-border" />
              <Step n={3} label="ALL SETUP" active={step === 3} done={false} />
            </div>
          </div>

          <div className="p-8 min-h-[360px]">
            {step === 1 && (
              <div className="text-center space-y-5">
                <div className="h-16 w-16 rounded-2xl bg-primary/15 text-primary mx-auto flex items-center justify-center"><Sparkles className="h-7 w-7" /></div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Hi {user.fullName?.split(" ")[0] || "there"} — Let's Build Your Command Center 🚀</h2>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    You're on the <span className="font-bold text-foreground capitalize">{plan.label}</span> plan.
                    You can register up to <span className="font-bold text-foreground">{limit === Infinity ? "unlimited" : limit}</span> business{limit === 1 ? "" : "es"}.
                    Let's set up the first one — it only takes a minute.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2">
                  {["Real-time inventory", "Smart POS", "Profit insights"].map((t) => (
                    <div key={t} className="bg-muted/40 rounded-xl p-3 text-xs font-semibold">{t}</div>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 max-w-md mx-auto">
                <h2 className="text-xl font-bold">Tell us about your business</h2>
                {overLimit && (
                  <div className="bg-rose-500/10 border border-rose-500/30 text-rose-500 text-sm rounded-xl p-3">
                    Your <span className="font-bold capitalize">{plan.label}</span> plan allows {limit} business(es). Upgrade to add more.
                  </div>
                )}
                <div>
                  <label className="text-sm font-semibold mb-2 block">Business Name *</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bilal Pharmacy" className="h-11" />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-2 block">Address</label>
                  <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City, Country" rows={2} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-2 block">Business Category *</label>
                  <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setCurrency(categories.find((c) => c.id === v)?.currency ?? "USD"); }}>
                    <SelectTrigger className="h-11"><SelectValue placeholder={categories.length ? "Choose a category" : "No active categories yet"} /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} <span className="text-muted-foreground ml-1">· {c.industry_type}</span></SelectItem>)}
                    </SelectContent>
                  </Select>
                  {categories.length === 0 && <p className="text-xs text-muted-foreground mt-2">An admin needs to publish a business category before you can continue.</p>}
                </div>
                <div>
                  <label className="text-sm font-semibold mb-2 block">Operating Currency *</label>
                  <Select value={currency} onValueChange={setCurrency} disabled={!categoryId}>
                    <SelectTrigger className="h-11"><SelectValue placeholder={categoryId ? "Choose currency" : "Select a category first"} /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CURRENCY_SYMBOLS).map(([code, sym]) => (
                        <SelectItem key={code} value={code}>{code} <span className="text-muted-foreground ml-1">{sym}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">Defaults to the currency set by your business category — you can change it any time from My Businesses.</p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="text-center space-y-5">
                <div className="h-20 w-20 rounded-3xl bg-emerald-500/15 text-emerald-500 mx-auto flex items-center justify-center"><CheckCircle2 className="h-10 w-10" /></div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">All set, {user.fullName?.split(" ")[0] || "captain"}! 🎉</h2>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    <span className="font-bold text-foreground">{name}</span> is live. We're taking you to your dashboard now.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-border flex items-center justify-between gap-3 bg-muted/20">
            {step > 1 && step < 3 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
            ) : <span />}
            {step === 1 && (
              <Button onClick={() => setStep(2)} className="ml-auto">Get Started <ArrowRight className="h-4 w-4 ml-2" /></Button>
            )}
            {step === 2 && (
              <Button onClick={handleSubmit} disabled={busy || overLimit || !name.trim() || !categoryId} className="ml-auto">
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Building2 className="h-4 w-4 mr-2" />} Create Business
              </Button>
            )}
            {step === 3 && (
              <Button onClick={() => navigate("/dashboard")} className="ml-auto">Go to Dashboard <ArrowRight className="h-4 w-4 ml-2" /></Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupBusiness;
