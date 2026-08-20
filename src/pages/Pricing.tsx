import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import { Check, Minus } from "lucide-react";
import { useMoney } from "@/lib/currency";
import { usePricingPlans } from "@/hooks/usePricingPlans";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const freeFeatures = ["100 items limit", "Basic POS", "Single user", "Real-time Profit"];
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

const compareRows: { feature: string; free: string | boolean; standard: string | boolean; premium: string | boolean }[] = [
  { feature: "Inventory Management", free: "100 items", standard: "1000 items", premium: "Unlimited" },
  { feature: "POS Terminal", free: "Basic", standard: "Full + Returns", premium: "Full + Returns" },
  { feature: "Sales Reporting", free: "Basic", standard: "Advanced", premium: "Custom Analytics" },
  { feature: "Multi-user Access", free: false, standard: true, premium: true },
  { feature: "Supplier Management", free: false, standard: true, premium: true },
  { feature: "Profit Insights", free: true, standard: true, premium: true },
  { feature: "Expiry Tracking", free: false, standard: false, premium: true },
  { feature: "Multi-branch Support", free: false, standard: false, premium: true },
  { feature: "Barcode Support", free: "Basic", standard: true, premium: true },
  { feature: "Support", free: "Email", standard: "Priority", premium: "24/7 VIP" },
];

const Cell = ({ value }: { value: string | boolean }) => {
  if (value === true) return <Check className="h-4 w-4 text-primary mx-auto" />;
  if (value === false) return <Minus className="h-4 w-4 text-muted-foreground mx-auto" />;
  return <span className="text-sm text-muted-foreground">{value}</span>;
};

const Pricing = () => {
  const { price } = useMoney({ scope: "platform" });
  const { priceOf, featuresOf, byKey, badgeOf, isPopular, badgePositionOf, nameOf, taglineOf } = usePricingPlans();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  return (
    <Layout>
      {/* Header */}
      <section className="pt-20 pb-10">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Choose the Right <span className="text-gradient">Plan</span>
            <br />
            for <span className="text-secondary">You</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Flexible pricing for every business stage — from startup to enterprise.
          </p>

          <div className="inline-flex items-center bg-card border border-border rounded-full p-1 gap-1">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                billingPeriod === "monthly" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >Monthly</button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                billingPeriod === "yearly" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >Yearly</button>
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
              return (
                <div className={`premium-card p-7 flex flex-col ${pop ? "ring-2 ring-primary shadow-2xl shadow-primary/20" : ""}`}>
                  {badge && pos === "top" ? (
                    <span className="inline-block text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full self-start mb-4 tracking-wider">
                      {badge}
                    </span>
                  ) : <div className="h-7 mb-4" />}
                  <h3 className="text-xl font-bold mb-1">{nameOf("free", "Free")}</h3>
                  <p className="text-sm text-muted-foreground mb-5">{taglineOf("free", "Professional solution.")}</p>
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
                  {badge && pos === "bottom" && (
                    <span className="inline-block text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full text-center mb-3 tracking-wider">
                      {badge}
                    </span>
                  )}
                  <Button className="cta-btn w-full rounded-full" asChild>
                    <Link to="/signup">GET STARTED</Link>
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
              return (
                <div className={`premium-card p-7 flex flex-col ${pop ? "ring-2 ring-primary shadow-2xl shadow-primary/20" : ""}`}>
                  {badge && pos === "top" ? (
                    <span className="inline-block text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full self-start mb-4 tracking-wider">
                      {badge}
                    </span>
                  ) : <div className="h-7 mb-4" />}
                  <h3 className="text-xl font-bold mb-1">{nameOf("standard", "Standard")}</h3>
                  <p className="text-sm text-muted-foreground mb-5">{taglineOf("standard", "Professional solution.")}</p>
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
                  {badge && pos === "bottom" && (
                    <span className="inline-block text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full text-center mb-3 tracking-wider">
                      {badge}
                    </span>
                  )}
                  <Button className="cta-btn w-full rounded-full" asChild>
                    <Link to={`/checkout?plan=standard&period=${billingPeriod}`}>CHOOSE PLAN</Link>
                  </Button>
                </div>
              );
            })()}

            {/* Premium */}
            {(() => {
              const badge = badgeOf("premium", billingPeriod);
              const pos = badgePositionOf("premium");
              const pop = isPopular("premium");
              return (
                <div className={`premium-card p-7 flex flex-col ${pop ? "ring-2 ring-secondary shadow-2xl shadow-secondary/20" : ""}`}>
                  {badge && pos === "top" ? (
                    <span className="inline-block text-xs font-bold text-secondary bg-secondary/10 px-3 py-1 rounded-full self-start mb-4 tracking-wider">
                      {badge}
                    </span>
                  ) : <div className="h-7 mb-4" />}
                  <h3 className="text-xl font-bold mb-1">{nameOf("premium", "Premium")}</h3>
                  <p className="text-sm text-muted-foreground mb-5">{taglineOf("premium", "Professional solution.")}</p>
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
                  {badge && pos === "bottom" && (
                    <span className="inline-block text-xs font-bold text-secondary bg-secondary/10 px-3 py-1 rounded-full text-center mb-3 tracking-wider">
                      {badge}
                    </span>
                  )}
                  <Button className="cta-btn w-full rounded-full" asChild>
                    <Link to={`/checkout?plan=premium&period=${billingPeriod}`}>CHOOSE PLAN</Link>
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

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Free Lifetime */}
            {(() => {
              const badge = badgeOf("free", "lifetime");
              const pop = isPopular("free");
              return (
                <div className={`premium-card p-7 flex flex-col ${pop ? "ring-2 ring-primary shadow-2xl shadow-primary/20" : ""}`}>
                  {badge ? (
                    <span className="inline-block text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full self-start mb-4 tracking-wider">
                      {badge}
                    </span>
                  ) : <div className="h-7 mb-4" />}
                  <h3 className="text-xl font-bold mb-1">{nameOf("free", "Free")} Lifetime</h3>
                  <div className="flex items-baseline gap-1 mb-6 mt-3">
                    <p className="text-4xl font-bold">{price(priceOf("free", "lifetime"))}</p>
                    <span className="text-sm text-muted-foreground">one-time</span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {freeLifetime.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="cta-btn w-full rounded-full" asChild>
                    <Link to="/signup">GET STARTED</Link>
                  </Button>
                  <p className="text-center text-[10px] font-bold tracking-wider text-muted-foreground mt-3">NO CARD NEEDED</p>
                </div>
              );
            })()}

            {/* Standard Lifetime */}
            {(() => {
              const badge = badgeOf("standard", "lifetime");
              const pop = isPopular("standard");
              return (
                <div className={`premium-card p-7 flex flex-col ${pop ? "ring-2 ring-primary shadow-2xl shadow-primary/20" : ""}`}>
                  {badge ? (
                    <span className="inline-block text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full self-start mb-4 tracking-wider">
                      {badge}
                    </span>
                  ) : <div className="h-7 mb-4" />}
                  <h3 className="text-xl font-bold mb-1">{nameOf("standard", "Standard")} Lifetime</h3>
                  <div className="flex items-baseline gap-1 mb-6 mt-3">
                    <p className="text-4xl font-bold">{price(priceOf("standard", "lifetime"))}</p>
                    <span className="text-sm text-muted-foreground">one-time</span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {standardLifetime.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="cta-btn w-full rounded-full" asChild>
                    <Link to="/checkout?plan=standard&period=lifetime">UNLOCK LIFETIME</Link>
                  </Button>
                </div>
              );
            })()}

            {/* Premium Lifetime */}
            {(() => {
              const badge = badgeOf("premium", "lifetime");
              const pop = isPopular("premium");
              return (
                <div className={`premium-card p-7 flex flex-col ${pop ? "ring-2 ring-secondary shadow-2xl shadow-secondary/20" : ""}`}>
                  {badge ? (
                    <span className="inline-block text-xs font-bold text-secondary bg-secondary/10 px-3 py-1 rounded-full self-start mb-4 tracking-wider">
                      {badge}
                    </span>
                  ) : <div className="h-7 mb-4" />}
                  <h3 className="text-xl font-bold mb-1">{nameOf("premium", "Premium")} Lifetime</h3>
                  <div className="flex items-baseline gap-1 mb-6 mt-3">
                    <p className="text-4xl font-bold">{price(priceOf("premium", "lifetime"))}</p>
                    <span className="text-sm text-muted-foreground">one-time</span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {premiumLifetime.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="cta-btn w-full rounded-full" asChild>
                    <Link to="/checkout?plan=premium&period=lifetime">UNLOCK LIFETIME</Link>
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
            <p className="text-muted-foreground">Detailed feature breakdown for every tier.</p>
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
                  {compareRows.map((row) => (
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
                      <Button size="sm" className="cta-btn rounded-full text-xs" asChild>
                        <Link to="/signup">GET STARTED</Link>
                      </Button>
                    </td>
                    <td className="p-4 text-center">
                      <Button size="sm" className="cta-btn rounded-full text-xs" asChild>
                        <Link to={`/checkout?plan=standard&period=${billingPeriod}`}>CHOOSE STANDARD</Link>
                      </Button>
                    </td>
                    <td className="p-4 text-center">
                      <Button size="sm" className="cta-btn rounded-full text-xs" asChild>
                        <Link to={`/checkout?plan=premium&period=${billingPeriod}`}>CHOOSE PREMIUM</Link>
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
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
