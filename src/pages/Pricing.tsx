import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import { Check, Minus, Tag, Crown } from "lucide-react";
import { useMoney } from "@/lib/currency";
import { usePricingPlans } from "@/hooks/usePricingPlans";
import { getPendingCoupon } from "@/lib/couponHelper";
import { supabase } from "@/integrations/supabase/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const freeFeatures = ["50 items limit", "Basic POS", "Single user", "Real-time Profit"];
const standardFeatures = ["1000 items limit", "Full POS & Returns", "Multi-user support", "Financial summaries", "Supplier Portal"];
const premiumFeatures = ["Unlimited items", "Everything in Standard", "Batch & expiry tracking", "Advanced analytics", "Multi-branch support", "Priority support"];

const freeLifetime = ["100 items limit", "Basic POS", "Basic Reports"];
const standardLifetime = ["1000 items limit", "Lifetime support", "Full POS Features"];
const premiumLifetime = ["Unlimited everything", "AI Insights Lifetime", "Enterprise Control"];

const faqs = [
  { q: "Can I upgrade my plan later?", a: "Yes — you can upgrade or downgrade anytime from your account dashboard. Changes apply instantly with prorated billing." },
  { q: "What happens if I exceed the item limit?", a: "You'll be notified before reaching your limit. You can upgrade your plan or archive old items to stay within limits." },
  { q: "Is my data secure?", a: "Absolutely. All data is encrypted in transit and at rest, with daily automated backups and enterprise-grade security." },
  { q: "Do you offer a refund for lifetime plans?", a: "Yes — we offer a 14-day money-back guarantee on all lifetime plans, no questions asked." },
  { q: "Is there any hidden cost?", a: "No hidden fees. The price you see is the price you pay. Taxes may apply based on your location." },
  { q: "Does POS work offline?", a: "Yes, our POS continues to function offline and syncs automatically when your connection is restored." },
];

const Cell = ({ value }: { value: string | boolean }) => {
  if (value === true) return <Check className="h-4 w-4 text-primary mx-auto" />;
  if (value === false) return <Minus className="h-4 w-4 text-muted-foreground mx-auto" />;
  return <span className="text-sm font-semibold text-muted-foreground">{value}</span>;
};

const Pricing = () => {
  const [searchParams] = useSearchParams();
  const { price } = useMoney({ scope: "platform" });
  const { priceOf, featuresOf, byKey, badgeOf, isPopular, badgePositionOf, nameOf, taglineOf, ctaTextOf } = usePricingPlans();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly" | "lifetime">("monthly");
  const [lifetimeLimits, setLifetimeLimits] = useState<{ standard: number; premium: number }>({ standard: 25, premium: 25 });
  const [lifetimeCounts, setLifetimeCounts] = useState<{ standard: number; premium: number }>({ standard: 0, premium: 0 });
  const [planLimits, setPlanLimits] = useState<Record<string, Record<string, { value: number | null; isLocked: boolean }>>>({});

  useEffect(() => {
    fetch("/api/admin/pricing-plans")
      .then((r) => r.json())
      .then((d) => {
        if (d?.lifetime_plan_limits) {
          setLifetimeLimits({
            standard: d.lifetime_plan_limits.standard ?? 25,
            premium: d.lifetime_plan_limits.premium ?? 25,
          });
        }
        if (d?.lifetime_offer_counts) {
          setLifetimeCounts({
            standard: d.lifetime_offer_counts.standard ?? 0,
            premium: d.lifetime_offer_counts.premium ?? 0,
          });
        }
      })
      .catch(() => {});

    // Sync comparison table live with Admin Plan Limits & Feature Controls
    const loadLimits = async () => {
      try {
        const res = await fetch("/api/admin/plan-limits");
        const json = await res.json();
        if (json.success && Array.isArray(json.limits)) {
          const map: Record<string, Record<string, { value: number | null; isLocked: boolean }>> = {};
          json.limits.forEach((r: any) => {
            const p = (r.plan_key || "").toLowerCase();
            const resKey = (r.resource_key || "").toLowerCase();
            if (!map[p]) map[p] = {};
            map[p][resKey] = {
              value: r.limit_value !== undefined ? r.limit_value : null,
              isLocked: Boolean(r.is_locked),
            };
          });
          setPlanLimits(map);
        }
      } catch (err) {
        console.warn("Notice loading plan limits:", err);
      }
    };
    loadLimits();

    const channelId = `pricing_table_limits_${Math.random().toString(36).slice(2, 9)}`;
    const ch = supabase
      .channel(channelId)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_limits" }, () => {
        loadLimits();
      })
      .subscribe();

    const onLimitsRefresh = () => loadLimits();
    window.addEventListener("panel:refresh", onLimitsRefresh);
    window.addEventListener("geflow:pricing-updated", onLimitsRefresh);

    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("panel:refresh", onLimitsRefresh);
      window.removeEventListener("geflow:pricing-updated", onLimitsRefresh);
    };
  }, []);

  const dynamicCompareRows = useMemo(() => {
    const getVal = (plan: string, key: string, fallback: string | boolean, unit?: string, altKey?: string) => {
      const entry = planLimits[plan]?.[key] ?? (altKey ? planLimits[plan]?.[altKey] : undefined);
      if (!entry) return fallback;
      if (entry.isLocked) return false;
      if (entry.value === null) return "Unlimited";
      if (entry.value === 0) return false;
      if (unit) {
        const label = entry.value === 1 && unit.endsWith("s") ? unit.slice(0, -1) : unit;
        return `${entry.value.toLocaleString()} ${label}`;
      }
      return `${entry.value.toLocaleString()}`;
    };

    return [
      {
        feature: "Inventory / Products Limit",
        free: getVal("free", "products", "50 items", "items"),
        standard: getVal("standard", "products", "1,000 items", "items"),
        premium: getVal("premium", "products", "Unlimited", "items"),
      },
      {
        feature: "Branches & Outlets Limit",
        free: getVal("free", "branches", "1 Outlet", "Outlets"),
        standard: getVal("standard", "branches", "3 Outlets", "Outlets"),
        premium: getVal("premium", "branches", "Unlimited", "Outlets"),
      },
      {
        feature: "Business Categories Limit",
        free: getVal("free", "categories", "1 Category", "Categories", "business_categories"),
        standard: getVal("standard", "categories", "1 Category", "Categories", "business_categories"),
        premium: getVal("premium", "categories", "Unlimited", "Categories", "business_categories"),
      },
      {
        feature: "Team Members / Staff Accounts",
        free: getVal("free", "team_members", "1 Member", "Members"),
        standard: getVal("standard", "team_members", "3 Members", "Members"),
        premium: getVal("premium", "team_members", "Unlimited", "Members"),
      },
      {
        feature: "Low Stock Alert Tracking",
        free: getVal("free", "low_stock", "5 items", "items"),
        standard: getVal("standard", "low_stock", "25 items", "items"),
        premium: getVal("premium", "low_stock", "Unlimited", "items"),
      },
      {
        feature: "Out of Stock Ledger Tracking",
        free: getVal("free", "out_of_stock", "5 items", "items"),
        standard: getVal("standard", "out_of_stock", "25 items", "items"),
        premium: getVal("premium", "out_of_stock", "Unlimited", "items"),
      },
      {
        feature: "Sales Reports History",
        free: getVal("free", "reports_days", "7 Days", "Days"),
        standard: getVal("standard", "reports_days", "30 Days", "Days"),
        premium: getVal("premium", "reports_days", "Unlimited Analytics", "Days"),
      },
      {
        feature: "AI Assistant Requests / Month",
        free: getVal("free", "ai_requests", "20 req/mo", "req/mo"),
        standard: getVal("standard", "ai_requests", "200 req/mo", "req/mo"),
        premium: getVal("premium", "ai_requests", "Unlimited AI", "req/mo"),
      },
      { feature: "POS Terminal & Offline Mode", free: "Basic POS", standard: "Full POS + Returns", premium: "Full POS + Multi-Terminal" },
      { feature: "Multi-user Access & Roles", free: false, standard: true, premium: true },
      { feature: "Supplier & Purchase Orders", free: false, standard: true, premium: true },
      { feature: "Real-time Profit Insights", free: true, standard: true, premium: true },
      { feature: "Batch & Expiry Date Tracking", free: false, standard: false, premium: true },
      { feature: "Barcode & Thermal Receipts", free: "Basic", standard: true, premium: true },
      { feature: "Support SLA", free: "Email", standard: "Priority Support", premium: "24/7 VIP Dedicated" },
    ];
  }, [planLimits]);

  const urlCoupon = searchParams.get("coupon") || searchParams.get("code") || searchParams.get("promo");
  const activePromoCode = (urlCoupon || getPendingCoupon() || "").trim().toUpperCase();

  const getCheckoutUrl = (plan: string, period: string) => {
    let url = `/checkout?plan=${encodeURIComponent(plan)}&period=${encodeURIComponent(period)}`;
    if (activePromoCode) {
      url += `&coupon=${encodeURIComponent(activePromoCode)}`;
    }
    return url;
  };

  return (
    <Layout>
      {/* Header */}
      <section className="pt-20 pb-10">
        <div className="container mx-auto px-4 text-center">
          {activePromoCode && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-4 animate-in fade-in">
              <Tag className="w-3.5 h-3.5" />
              <span>Promo Code {activePromoCode} Active — Discount applied at checkout</span>
            </div>
          )}
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Choose the Right <span className="text-gradient">Plan</span>
            <br />
            for <span className="text-secondary">You</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Flexible pricing for every business stage — from startup to enterprise.
          </p>

          <div className="inline-flex items-center bg-card border border-border rounded-full p-1 gap-1 justify-center shadow-xs">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                billingPeriod === "monthly" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >Monthly</button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                billingPeriod === "yearly" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >Yearly (Save up to 40%)</button>
          </div>
        </div>
      </section>

      {/* Subscription Plans */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Free */}
            {(() => {
              const badge = badgeOf("free", billingPeriod);
              const pos = badgePositionOf("free");
              const pop = isPopular("free");
              const displayBadge = badge || (pop ? "POPULAR" : null);
              return (
                <div className={`premium-card p-7 flex flex-col ${pop ? "ring-2 ring-primary shadow-2xl shadow-primary/20" : ""}`}>
                  {displayBadge && pos === "top" ? (
                    <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full self-start mb-4 tracking-wider ${pop ? "bg-primary text-primary-foreground" : "text-primary bg-primary/10"}`}>
                      {displayBadge}
                    </span>
                  ) : <div className="h-7 mb-4" />}
                  <h3 className="text-xl font-bold mb-1">{nameOf("free", "Free")}</h3>
                  <p className="text-sm text-muted-foreground mb-5">{taglineOf("free", "Always free for small stores.")}</p>
                  <div className="flex items-baseline gap-1 mb-6">
                    <p className="text-4xl font-bold">{price(priceOf("free", billingPeriod))}</p>
                    <span className="text-sm text-muted-foreground">/{billingPeriod === "monthly" ? "mo" : "yr"}</span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {featuresOf("free", freeFeatures).map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  {displayBadge && pos === "bottom" && (
                    <span className="inline-block text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full text-center mb-3 tracking-wider">
                      {displayBadge}
                    </span>
                  )}
                  <Button className="cta-btn w-full rounded-full" asChild>
                    <Link to="/signup">{ctaTextOf("free", "GET STARTED")}</Link>
                  </Button>
                  <p className="text-center text-[10px] font-bold tracking-wider text-muted-foreground mt-3">NO CARD NEEDED</p>
                </div>
              );
            })()}

            {/* Standard */}
            {(() => {
              const badge = badgeOf("standard", billingPeriod);
              const pos = badgePositionOf("standard");
              const pop = isPopular("standard");
              const displayBadge = badge || (pop ? "MOST POPULAR" : null);
              return (
                <div className={`premium-card p-7 flex flex-col relative ${pop ? "ring-2 ring-sky-500 shadow-2xl shadow-sky-500/20" : ""}`}>
                  {displayBadge && pos === "top" ? (
                    <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full self-start mb-4 tracking-wider ${pop ? "bg-sky-500 text-white" : "text-primary bg-primary/10"}`}>
                      {displayBadge}
                    </span>
                  ) : <div className="h-7 mb-4" />}
                  <h3 className="text-xl font-bold mb-1">{nameOf("standard", "Standard")}</h3>
                  <p className="text-sm text-muted-foreground mb-5">{taglineOf("standard", "Ideal for growing retailers.")}</p>
                  <div className="flex items-baseline gap-1 mb-6">
                    <p className="text-4xl font-bold">{price(priceOf("standard", billingPeriod))}</p>
                    <span className="text-sm text-muted-foreground">/{billingPeriod === "monthly" ? "mo" : "yr"}</span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {featuresOf("standard", standardFeatures).map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  {displayBadge && pos === "bottom" && (
                    <span className="inline-block text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full text-center mb-3 tracking-wider">
                      {displayBadge}
                    </span>
                  )}
                  <Button className="cta-btn w-full rounded-full" asChild>
                    <Link to={getCheckoutUrl("standard", billingPeriod)}>{ctaTextOf("standard", "CHOOSE PLAN", billingPeriod)}</Link>
                  </Button>
                </div>
              );
            })()}

            {/* Premium */}
            {(() => {
              const badge = badgeOf("premium", billingPeriod);
              const pos = badgePositionOf("premium");
              const pop = isPopular("premium");
              const displayBadge = badge || (pop ? "RECOMMENDED" : null);
              return (
                <div className={`premium-card p-7 flex flex-col relative ${pop ? "ring-2 ring-primary shadow-2xl shadow-primary/20" : ""}`}>
                  {displayBadge && pos === "top" ? (
                    <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full self-start mb-4 tracking-wider ${pop ? "bg-primary text-primary-foreground" : "text-secondary bg-secondary/10"}`}>
                      {displayBadge}
                    </span>
                  ) : <div className="h-7 mb-4" />}
                  <h3 className="text-xl font-bold mb-1">{nameOf("premium", "Premium")}</h3>
                  <p className="text-sm text-muted-foreground mb-5">{taglineOf("premium", "For advanced operations & multi-branch.")}</p>
                  <div className="flex items-baseline gap-1 mb-6">
                    <p className="text-4xl font-bold">{price(priceOf("premium", billingPeriod))}</p>
                    <span className="text-sm text-muted-foreground">/{billingPeriod === "monthly" ? "mo" : "yr"}</span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {featuresOf("premium", premiumFeatures).map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  {displayBadge && pos === "bottom" && (
                    <span className="inline-block text-xs font-bold text-secondary bg-secondary/10 px-3 py-1 rounded-full text-center mb-3 tracking-wider">
                      {displayBadge}
                    </span>
                  )}
                  <Button className="cta-btn w-full rounded-full" asChild>
                    <Link to={getCheckoutUrl("premium", billingPeriod)}>{ctaTextOf("premium", "CHOOSE PLAN", billingPeriod)}</Link>
                  </Button>
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      {/* Lifetime Plans */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Exclusive Lifetime Access</h2>
            <p className="text-muted-foreground">Pay once, own the system forever.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Standard Lifetime */}
            {(() => {
              const badge = badgeOf("standard", "lifetime");
              const pop = isPopular("standard", "lifetime");
              const limit = lifetimeLimits.standard || 25;
              const claimed = lifetimeCounts.standard || 0;
              const remaining = Math.max(0, limit - claimed);
              return (
                <div className={`premium-card p-7 flex flex-col ${pop ? "ring-2 ring-primary shadow-2xl shadow-primary/20" : ""}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-block text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-3 py-1 rounded-full tracking-wider">
                      {badge || `ONLY ${limit} OFFERS AVAILABLE`}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground font-mono">{remaining} left</span>
                  </div>
                  <h3 className="text-xl font-bold mb-1">{nameOf("standard", "Standard")} Lifetime</h3>
                  <div className="flex items-baseline gap-1 mb-6 mt-3">
                    <p className="text-4xl font-bold">{price(priceOf("standard", "lifetime"))}</p>
                    <span className="text-sm text-muted-foreground">one-time</span>
                  </div>
                  <div className="mb-4 p-2.5 rounded-xl bg-muted/40 border border-border text-xs flex items-center justify-between">
                    <span className="font-semibold text-foreground">Standard Registration Limit:</span>
                    <span className="font-bold text-amber-500">{limit} spots offer</span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {featuresOf("standard", standardLifetime, "lifetime").map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="cta-btn w-full rounded-full" asChild>
                    <Link to={getCheckoutUrl("standard", "lifetime")}>{ctaTextOf("standard", "UNLOCK LIFETIME", "lifetime")}</Link>
                  </Button>
                </div>
              );
            })()}

            {/* Premium Lifetime */}
            {(() => {
              const badge = badgeOf("premium", "lifetime");
              const pop = isPopular("premium", "lifetime");
              const limit = lifetimeLimits.premium || 25;
              const claimed = lifetimeCounts.premium || 0;
              const remaining = Math.max(0, limit - claimed);
              return (
                <div className={`premium-card p-7 flex flex-col ${pop ? "ring-2 ring-secondary shadow-2xl shadow-secondary/20" : ""}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-block text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-3 py-1 rounded-full tracking-wider">
                      {badge || `ONLY ${limit} OFFERS AVAILABLE`}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground font-mono">{remaining} left</span>
                  </div>
                  <h3 className="text-xl font-bold mb-1">{nameOf("premium", "Premium")} Lifetime</h3>
                  <div className="flex items-baseline gap-1 mb-6 mt-3">
                    <p className="text-4xl font-bold">{price(priceOf("premium", "lifetime"))}</p>
                    <span className="text-sm text-muted-foreground">one-time</span>
                  </div>
                  <div className="mb-4 p-2.5 rounded-xl bg-muted/40 border border-border text-xs flex items-center justify-between">
                    <span className="font-semibold text-foreground">Premium Registration Limit:</span>
                    <span className="font-bold text-amber-500">{limit} spots offer</span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {featuresOf("premium", premiumLifetime, "lifetime").map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="cta-btn w-full rounded-full" asChild>
                    <Link to={getCheckoutUrl("premium", "lifetime")}>{ctaTextOf("premium", "UNLOCK LIFETIME", "lifetime")}</Link>
                  </Button>
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      {/* Compare Plans */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Compare Our Plans</h2>
            <p className="text-muted-foreground">Real-time feature breakdown synchronized with platform plan limits.</p>
          </div>

          <div className="premium-card max-w-5xl mx-auto overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left p-4 text-xs font-bold tracking-wider text-foreground">FEATURE</th>
                    <th className="text-center p-4 text-xs font-bold tracking-wider text-muted-foreground">FREE</th>
                    <th className="text-center p-4 text-xs font-bold tracking-wider text-primary">STANDARD</th>
                    <th className="text-center p-4 text-xs font-bold tracking-wider text-secondary">PREMIUM</th>
                  </tr>
                </thead>
                <tbody>
                  {dynamicCompareRows.map((row) => (
                    <tr key={row.feature} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4 text-sm font-semibold">{row.feature}</td>
                      <td className="p-4 text-center"><Cell value={row.free} /></td>
                      <td className="p-4 text-center"><Cell value={row.standard} /></td>
                      <td className="p-4 text-center"><Cell value={row.premium} /></td>
                    </tr>
                  ))}
                  <tr>
                    <td className="p-4"></td>
                    <td className="p-4 text-center">
                      <Button size="sm" className="cta-btn rounded-full text-xs font-bold" asChild>
                        <Link to="/signup">{ctaTextOf("free", "GET STARTED", billingPeriod)}</Link>
                      </Button>
                    </td>
                    <td className="p-4 text-center">
                      <Button size="sm" className="cta-btn rounded-full text-xs font-bold" asChild>
                        <Link to={`/checkout?plan=standard&period=${billingPeriod}`}>{ctaTextOf("standard", "CHOOSE STANDARD", billingPeriod)}</Link>
                      </Button>
                    </td>
                    <td className="p-4 text-center">
                      <Button size="sm" className="cta-btn rounded-full text-xs font-bold" asChild>
                        <Link to={`/checkout?plan=premium&period=${billingPeriod}`}>{ctaTextOf("premium", "CHOOSE PREMIUM", billingPeriod)}</Link>
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Lifetime Deal Callout within Compare Section */}
          <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-sky-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-5xl mx-auto shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <p className="font-bold text-foreground text-sm flex items-center gap-2">
                  <span>Looking for Lifetime Ownership?</span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">LIMITED OFFERS</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Single one-time payment. No monthly renewal fees, complete VIP feature package forever.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
              <Button size="sm" className="cta-btn rounded-full text-xs font-bold px-4" asChild>
                <Link to={getCheckoutUrl("standard", "lifetime")}>{ctaTextOf("standard", "LIFETIME STANDARD", "lifetime")}</Link>
              </Button>
              <Button size="sm" className="cta-btn rounded-full text-xs font-bold px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white" asChild>
                <Link to={getCheckoutUrl("premium", "lifetime")}>{ctaTextOf("premium", "LIFETIME PREMIUM", "lifetime")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Pricing FAQs</h2>
            <p className="text-muted-foreground">Answers to common billing and plan questions.</p>
          </div>

          <div className="max-w-2xl mx-auto space-y-3">
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="premium-card px-5 border-0"
                >
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline py-4">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <div className="container mx-auto px-4">
          <div className="premium-card max-w-4xl mx-auto p-12 md:p-16 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to unlock your business
              <br />
              details with <span className="text-gradient">GeFlow</span>?
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              No credit card required. Get instant access to powerful business analysis.
            </p>
            <Button size="lg" className="cta-btn rounded-full px-8" asChild>
              <Link to="/signup">SIGN UP FREE</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Pricing;
