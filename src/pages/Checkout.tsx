import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Layout from "@/components/Layout";
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, Lock, ShieldCheck, Wallet, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import InvoiceDialog, { InvoiceData } from "@/components/InvoiceDialog";
import { useMoney } from "@/lib/currency";
import { usePricingPlans } from "@/hooks/usePricingPlans";
import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import { usePaymentGateways } from "@/hooks/usePaymentGateways";
import { PayPalCardSection, PayPalWalletSection, CaptureResult } from "@/components/checkout/PayPalPayment";


type Plan = "standard" | "premium";
type Period = "monthly" | "yearly" | "lifetime";

const PLAN_DATA: Record<Plan, { name: string; entitlements: string[]; pricing: Record<Period, number> }> = {
  standard: {
    name: "Standard Plan",
    entitlements: ["1,000 items limit", "Full POS & Returns", "Multi-user support", "Financial summaries", "Supplier Portal"],
    pricing: { monthly: 4.99, yearly: 14.99, lifetime: 49.99 },
  },
  premium: {
    name: "Premium Plan",
    entitlements: ["Unlimited items", "Batch & expiry tracking", "Advanced analytics", "Multi-branch support", "Priority 24/7 support"],
    pricing: { monthly: 9.99, yearly: 24.99, lifetime: 99.99 },
  },
};

const PERIOD_LABEL: Record<Period, string> = {
  monthly: "MONTHLY CYCLE",
  yearly: "YEARLY CYCLE",
  lifetime: "LIFETIME • ONE-TIME",
};

const Checkout = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { symbol: sym, taxRate, invoiceNo, price: fx } = useMoney({ scope: "platform" });
  const { priceOf, featuresOf, byKey } = usePricingPlans();
  const { paypalClientId } = usePaymentGateways();

  const plan = (params.get("plan") as Plan) || "standard";
  const period = (params.get("period") as Period) || "monthly";
  const data = PLAN_DATA[plan] ?? PLAN_DATA.standard;
  const subtotal = priceOf(plan, period, data.pricing[period] ?? data.pricing.monthly);

  const tax = useMemo(() => +(Math.max(subtotal, 0) * (taxRate / 100)).toFixed(2), [subtotal, taxRate]);

  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [hasBusiness, setHasBusiness] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Sync with current authenticated Supabase session on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        setEmail(user.email ?? "");
        const userFullName = (user.user_metadata?.full_name as string) || "";
        if (userFullName) {
          setFullName(userFullName);
          setResolvedName(userFullName);
        } else {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", user.id)
            .maybeSingle();
          if (profile?.full_name) {
            setFullName(profile.full_name);
            setResolvedName(profile.full_name);
          }
        }
      }
    })();
  }, []);

  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "paypal">("card");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; amount: number; label: string } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [isAdminEmail, setIsAdminEmail] = useState(false);

  const discount = appliedCoupon?.amount ?? 0;
  const total = useMemo(() => +(Math.max(subtotal - discount, 0) + tax).toFixed(2), [subtotal, discount, tax]);

  const applyCoupon = async () => {
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    setCouponError("");
    // Validate via a secure function so the full coupon table is never exposed.
    const { data, error } = await supabase.rpc("validate_coupon", {
      _code: code,
      _plan: plan,
      _subtotal: subtotal,
    });
    setCouponLoading(false);
    const result = Array.isArray(data) ? data[0] : data;
    if (error || !result) {
      setAppliedCoupon(null);
      setCouponError("Invalid or expired coupon code.");
      return;
    }
    if (!result.valid) {
      setAppliedCoupon(null);
      setCouponError(result.reason || "Invalid or expired coupon code.");
      return;
    }
    const amount = Number(result.amount) || 0;
    const label = result.label || "";
    setAppliedCoupon({ code, amount: +amount.toFixed(2), label });
    setCouponError("");
    toast({ title: "Coupon applied!", description: `${label} activated.` });
  };


  const ctaLabel = period === "lifetime" ? "AUTHORIZE & START NODE" : "AUTHORIZE & START TRIAL";

  /**
   * Creates (or signs into) the Supabase account before the PayPal order is
   * created, so the transaction is always tied to a real user record.
   */
  const ensureAuth = async (): Promise<boolean> => {
    const { data: { user: current } } = await supabase.auth.getUser();
    if (current && current.email?.toLowerCase() === email.trim().toLowerCase()) {
      const name = (current.user_metadata?.full_name as string) || fullName || email.split("@")[0];
      setResolvedName(name);
      setCurrentUser(current);
      return true;
    }
    if (!email.trim() || password.length < 6 || (authMode === "signup" && !fullName.trim())) {
      toast({ title: "Account details required", description: "Complete your account fields to continue.", variant: "destructive" });
      return false;
    }
    setLoading(true);
    if (authMode === "login") {
      const { data: loginData, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setLoading(false);
      if (error) {
        toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
        return false;
      }
      const u = loginData?.user;
      setCurrentUser(u);
      const resolved = (u?.user_metadata?.full_name as string) || email.split("@")[0];
      setResolvedName(resolved);
      return true;
    }
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), plan, period }, emailRedirectTo: window.location.origin },
    });
    if (error) {
      // Account already exists → sign in with the same credentials.
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setLoading(false);
      if (loginError) {
        toast({ title: "Checkout failed", description: error.message, variant: "destructive" });
        return false;
      }
      const u = loginData?.user;
      setCurrentUser(u);
      const resolved = (u?.user_metadata?.full_name as string) || fullName.trim() || email.split("@")[0];
      setResolvedName(resolved);
      return true;
    }
    if (!signUpData.session) {
      // Email confirmation is on — sign in so the payment can be authorised.
      const { data: loginData } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (loginData?.user) setCurrentUser(loginData.user);
    } else if (signUpData.user) {
      setCurrentUser(signUpData.user);
    }
    setLoading(false);
    setResolvedName(fullName.trim() || email.split("@")[0]);
    return true;
  };

  const handleSuccess = async (result: CaptureResult) => {
    const { data: { user } } = await supabase.auth.getUser();
    const activeUser = user || currentUser;
    let userHasBusiness = !!result.hasBusiness;

    if (activeUser) {
      // Ensure user profile plan is updated in database
      await supabase.from("profiles").upsert({
        user_id: activeUser.id,
        email: activeUser.email || email,
        full_name: resolvedName || fullName || activeUser.email?.split("@")[0] || "Customer",
        plan,
        status: "active",
        last_active: new Date().toISOString(),
      } as any, { onConflict: "user_id" });

      // Check if user has any existing registered businesses
      const { count } = await supabase
        .from("businesses")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", activeUser.id);
      userHasBusiness = (count ?? 0) > 0;

      // Calculate next billing date
      const next = new Date();
      if (period === "monthly") next.setMonth(next.getMonth() + 1);
      else if (period === "yearly") next.setFullYear(next.getFullYear() + 1);

      // Record subscription in database
      await supabase.from("subscriptions").insert({
        owner_user_id: activeUser.id,
        tier: plan,
        cycle: period,
        status: "active",
        amount: total,
        next_billing_date: period === "lifetime" ? null : next.toISOString(),
      } as any);

      // Record invoice in database
      const invNumber = result.invoiceNumber || invoiceNo(Date.now().toString());
      await supabase.from("invoices").insert({
        invoice_number: invNumber,
        owner_user_id: activeUser.id,
        client_name: resolvedName || fullName || activeUser.email?.split("@")[0] || "Customer",
        billing_email: email || activeUser.email || "",
        plan,
        payment_method: result.method,
        amount: total,
        status: "paid",
      } as any);
    }

    const inv: InvoiceData = {
      invoiceNumber: result.invoiceNumber || invoiceNo(Date.now().toString()),
      date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      customerName: resolvedName || fullName || email.split("@")[0],
      customerEmail: email || activeUser?.email || "",
      planName: data.name,
      period: PERIOD_LABEL[period],
      paymentMethod: result.method,
      subtotal,
      discount,
      couponCode: appliedCoupon?.code,
      tax,
      total,
      currencySymbol: sym,
      taxRate,
    };
    setInvoice(inv);
    setHasBusiness(userHasBusiness);
    setIsAdminEmail(email.toLowerCase() === "gepardwebs@gmail.com" || activeUser?.email?.toLowerCase() === "gepardwebs@gmail.com");
    setShowInvoice(true);
    toast({ title: "Payment successful!", description: `${data.name} activated on your account.` });
  };

  const handleContinue = () => {
    setShowInvoice(false);
    if (isAdminEmail) { navigate("/admin"); return; }
    navigate(hasBusiness ? "/dashboard" : "/setup/business");
  };
  const payProps = {
    plan,
    cycle: period,
    amount: Number(total),
    couponCode: appliedCoupon?.code ?? null,
    ensureAuth,
    onSuccess: handleSuccess,
  };

  return (
    <Layout>
      <PayPalScriptProvider
        options={{
          clientId: paypalClientId ?? "test",
          currency: "USD",
          intent: "capture",
          components: "buttons,card-fields",
        }}
      >
      <section className="py-10 md:py-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <Link to="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/80 hover:text-primary transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" /> Back to Plans
          </Link>

          <div className="grid lg:grid-cols-[1fr_400px] gap-6">
            {/* LEFT — Form */}
            <form onSubmit={(e) => e.preventDefault()} className="premium-card p-6 md:p-10">

              <div className="flex items-start justify-between mb-2">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold mb-2">Secure Checkout</h1>
                  <p className="text-sm italic text-muted-foreground">"Finalize your details to activate your business cloud node."</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
              </div>

              <div className="border-t border-border my-6" />

              {/* Step 1 */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-9 w-9 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">1</div>
                <div>
                  <h2 className="text-lg font-bold">Account Identity</h2>
                  <p className="text-xs text-muted-foreground">{authMode === "signup" ? "Create your GeFlow account to activate this plan." : "Sign in to your existing GeFlow account."}</p>
                </div>
              </div>

              {/* Auth mode toggler */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-xl border border-border mb-5">
                <button
                  type="button"
                  onClick={() => setAuthMode("signup")}
                  className={`py-2.5 rounded-lg text-xs font-bold tracking-wider transition-all ${
                    authMode === "signup" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  NEW ACCOUNT
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  className={`py-2.5 rounded-lg text-xs font-bold tracking-wider transition-all ${
                    authMode === "login" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  EXISTING ACCOUNT
                </button>
              </div>

              <div className="space-y-4 mb-8">
                {authMode === "signup" && (
                  <div>
                    <label className="text-[10px] font-bold tracking-wider text-muted-foreground mb-2 block">FULL LEGAL NAME</label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="e.g. Alex Gepard" className="h-12" />
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold tracking-wider text-muted-foreground mb-2 block">{authMode === "signup" ? "WORK EMAIL IDENTITY" : "ACCOUNT EMAIL"}</label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="alex@geflow.io" className="h-12" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold tracking-wider text-muted-foreground mb-2 block">ACCOUNT PASSWORD</label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" className="h-12" />
                  </div>
                </div>
                {authMode === "login" && (
                  <p className="text-xs text-muted-foreground">Don't have an account?{" "}
                    <button type="button" onClick={() => setAuthMode("signup")} className="font-semibold text-primary hover:underline">Create one</button>
                  </p>
                )}
              </div>

              {/* Step 2 */}
              <div className="flex items-center gap-3 mb-5">
                <div className="h-9 w-9 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">2</div>
                <h2 className="text-lg font-bold">Secure Payment</h2>
              </div>

              <div className="bg-muted/40 rounded-2xl p-5 space-y-4">
                {/* Payment method toggler */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-background/90 dark:bg-card/90 rounded-xl border border-border/80 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold tracking-wider transition-all ${
                      paymentMethod === "card"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    <CreditCard className="h-4 w-4" /> PAY WITH CARD
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("paypal")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold tracking-wider transition-all ${
                      paymentMethod === "paypal"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    <Wallet className="h-4 w-4" /> PAY WITH PAYPAL
                  </button>
                </div>

                {!paypalClientId ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Online payments are being configured. Please try again shortly.
                  </p>
                ) : paymentMethod === "card" ? (
                  <PayPalCardSection {...payProps} ctaLabel={ctaLabel} priceLabel={fx(Number(total))} />
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold tracking-wider text-muted-foreground mb-2 block uppercase">
                        PayPal Account Identity (Optional)
                      </label>
                      <div className="relative">
                        <Wallet className="h-4 w-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
                        <Input
                          type="email"
                          value={paypalEmail}
                          onChange={(e) => setPaypalEmail(e.target.value)}
                          placeholder="you@paypal.com"
                          className="h-12 pl-11 bg-background/80 dark:bg-muted/30 border-input"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        You can specify your PayPal email or proceed directly to login in the popup window.
                      </p>
                    </div>

                    <PayPalWalletSection
                      {...payProps}
                      ctaLabel={ctaLabel}
                      priceLabel={fx(Number(total))}
                      payerEmail={paypalEmail}
                    />
                  </div>
                )}
              </div>

            </form>

            {/* RIGHT — Summary */}
            <aside className="premium-card p-6 md:p-7 h-fit lg:sticky lg:top-24">
              <h2 className="text-xl font-bold mb-5">Order Summary</h2>
              <div className="border-t border-border" />

              <div className="flex items-start justify-between py-5">
                <div>
                  <p className="font-bold text-base">{byKey(plan)?.name ?? data.name}</p>
                  <p className="text-[10px] font-bold tracking-wider text-primary mt-1">{PERIOD_LABEL[period]}</p>
                </div>
                <p className="text-2xl font-bold">{fx(subtotal)}</p>
              </div>

              <div className="border-t border-border" />

              <div className="space-y-2.5 py-5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span className="text-foreground font-semibold">{fx(subtotal)}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-primary">
                    <span>Coupon ({appliedCoupon.code})</span>
                    <span className="font-semibold">−{fx(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Architectural Tax ({taxRate}%)</span><span className="text-foreground font-semibold">{fx(tax)}</span>
                </div>
              </div>

              {/* Coupon */}
              <div className="border-t border-border pt-5">
                <label className="text-[10px] font-bold tracking-wider text-muted-foreground mb-2 block">COUPON CODE</label>
                <div className="flex gap-2">
                  <Input
                    value={coupon}
                    onChange={(e) => { setCoupon(e.target.value); setCouponError(""); }}
                    placeholder="Enter code"
                    className="h-10 uppercase"
                  />
                  <Button type="button" onClick={applyCoupon} disabled={couponLoading} variant="outline" className="h-10 px-4 text-xs font-bold tracking-wider">
                    {couponLoading ? "..." : "APPLY"}
                  </Button>
                </div>
                {couponError && <p className="text-xs text-destructive mt-2">{couponError}</p>}
                {appliedCoupon && <p className="text-xs text-primary mt-2 font-semibold">✓ {appliedCoupon.label} applied</p>}
              </div>

              <div className="border-t border-border" />

              <div className="flex items-center justify-between py-5">
                <p className="text-base font-bold">Grand Total</p>
                <p className="text-3xl font-bold text-primary">{fx(Number(total))}</p>
              </div>

              <div className="border-t border-border" />

              <div className="pt-5">
                <p className="text-[10px] font-bold tracking-wider text-primary mb-3 inline-flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> ACTIVE ENTITLEMENTS
                </p>
                <ul className="space-y-2.5">
                  {data.entitlements.map((e) => (
                    <li key={e} className="flex items-center gap-2 text-sm font-semibold">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" /> {e}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground mt-6 pt-5 border-t border-border">
                BY COMPLETING THIS PURCHASE, YOU AGREE TO OUR <span className="text-foreground font-bold">TERMS OF SERVICE.</span>
              </p>
            </aside>
          </div>
        </div>
      </section>
      <InvoiceDialog open={showInvoice} onClose={() => setShowInvoice(false)} onContinue={handleContinue} invoice={invoice} />
      </PayPalScriptProvider>
    </Layout>
  );
};

export default Checkout;
