import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import CTASection from "@/components/CTASection";
import { useMoney } from "@/lib/currency";
import { usePricingPlans } from "@/hooks/usePricingPlans";
import heroLaptop from "@/assets/hero-laptop.jpg";
import aboutOffice from "@/assets/about-office.jpg";
import {
  Package,
  ShoppingCart,
  TrendingUp,
  BarChart3,
  Users,
  ArrowRight,
  Check,
  Clipboard,
  Truck,
  Activity,
  Smartphone,
  Expand,
} from "lucide-react";

const workflowSteps = [
  {
    icon: Clipboard,
    num: "01",
    title: "Create Workspace",
    desc: "System initializes your business environment instantly.",
  },
  {
    icon: Package,
    num: "02",
    title: "Add Inventory",
    desc: "Add items with stock, price, and SKU codes.",
  },
  {
    icon: ShoppingCart,
    num: "03",
    title: "Start Sales (POS)",
    desc: "Fast billing with automatic stock deduction.",
  },
  {
    icon: Truck,
    num: "04",
    title: "Manage Purchases",
    desc: "Stock increases automatically from suppliers.",
  },
  {
    icon: Activity,
    num: "05",
    title: "Track Performance",
    desc: "Profit, reports, and analytics in real time.",
  },
];

const features = [
  {
    icon: Package,
    title: "Inventory Management",
    desc: "Real-time stock tracking with SKU system and stock ledger history.",
  },
  {
    icon: ShoppingCart,
    title: "POS System",
    desc: "Fast billing engine with barcode support and instant invoice generation.",
  },
  {
    icon: TrendingUp,
    title: "Finance System",
    desc: "Profit tracking, expense management, and financial summaries.",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    desc: "Sales reports, stock reports, and profit analytics dashboards.",
  },
  {
    icon: Users,
    title: "User Management",
    desc: "Role-based access control with multi-user system.",
  },
];

const freePlanFeatures = [
  "100 items limit",
  "Basic POS",
  "Single user",
  "Real time Profit",
];
const standardFeatures = [
  "1000 items limit",
  "Full POS & Returns",
  "Multi user support",
  "Financial summaries",
  "Supplier Portal",
];
const premiumFeatures = [
  "Unlimited items",
  "Everything in Standard",
  "Batch & expiry tracking",
  "Advanced analytics",
  "Multi-branch support",
  "Priority support",
];

const Index = () => {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const { price } = useMoney({ scope: "platform" });
  const { priceOf, featuresOf, byKey, badgeOf, isPopular, badgePositionOf, nameOf, taglineOf } = usePricingPlans();

  return (
    <Layout>
      {/* Hero Section */}
      <section className="py-10 sm:py-14 md:py-20 overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-display font-bold leading-tight mb-4 sm:mb-5 text-foreground">
                Manage your entire business in one{" "}
                <span className="text-gradient">intelligent</span> system
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base mb-2 leading-relaxed max-w-lg">
                Inventory, sales, purchases, and profit — all in real time.
                Designed for pharmacies, retail stores & warehouses.
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-6 sm:mt-7">
                <Button
                  size="lg"
                  asChild
                  className="gap-2 px-6 sm:px-7 w-full sm:w-auto cta-btn justify-center"
                >
                  <Link to="/signup">
                    Get Started Free <ArrowRight size={16} />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="px-6 sm:px-7 w-full sm:w-auto cta-btn-outline justify-center"
                >
                  <Link to="/features">Explore Features</Link>
                </Button>
              </div>
            </div>
            <div className="flex justify-center min-w-0">
              <div className="w-full max-w-md md:max-w-none rounded-2xl overflow-hidden shadow-2xl border border-border/60 animate-float cursor-pointer transition-transform duration-300 hover:shadow-3xl">
                <img
                  src={heroLaptop}
                  alt="GeFlow Dashboard"
                  width={800}
                  height={600}
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 sm:px-6">
        <div className="border-t border-border" />
      </div>

      {/* How It Works */}
      <section className="py-12 sm:py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-14 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold mb-3 text-foreground">
              Workflow built for speed
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
              Scale your business in 5 simple steps with our automated architecture.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5 min-w-0">
            {workflowSteps.map((step) => (
              <div
                key={step.title}
                className="text-center group cursor-pointer p-4 sm:p-5 rounded-2xl border border-border/40 hover:border-border/80 bg-card/40 hover:bg-card hover:shadow-md transition-all duration-300 min-w-0"
              >
                <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary group-hover:shadow-lg group-hover:shadow-primary/20 transition-all duration-300 shrink-0">
                  <step.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary group-hover:text-primary-foreground transition-colors duration-300" />
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center">
                    {step.num}
                  </span>
                </div>
                <h3 className="font-semibold text-xs sm:text-sm mb-1 truncate text-foreground">
                  {step.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 sm:py-16 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-14 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold mb-3 text-foreground">
              Powerful Features
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
              Everything you need to run your modern retail, grouped for clarity.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto min-w-0">
            {features.map((f) => (
              <div
                key={f.title}
                className="glass-card p-5 sm:p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer min-w-0"
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-primary group-hover:shadow-md transition-all duration-300 shrink-0">
                  <f.icon className="h-5 w-5 text-primary group-hover:text-primary-foreground transition-colors duration-300" />
                </div>
                <h3 className="font-semibold text-sm sm:text-base mb-1 truncate text-foreground">
                  {f.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-12 sm:py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center max-w-5xl mx-auto min-w-0">
            <div className="rounded-2xl overflow-hidden shadow-lg border border-border/50 animate-float cursor-pointer transition-transform duration-300 hover:shadow-2xl min-w-0">
              <img
                src={aboutOffice}
                alt="GeFlow business dashboard"
                width={800}
                height={600}
                loading="lazy"
                className="w-full h-auto object-cover"
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold mb-3 sm:mb-4 text-foreground">
                What is GeFlow?
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                GeFlow is a modern business operating system designed to manage
                inventory, sales, purchases, and profit tracking in real time.
              </p>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-5 sm:mb-6">
                It replaces manual systems like Excel and registers with a fully
                digital and automated solution.
              </p>
              <ul className="space-y-2.5 sm:space-y-3">
                {[
                  { icon: Activity, text: "Real-time business control" },
                  { icon: Smartphone, text: "Multi-device access" },
                  { icon: Expand, text: "Scalable for all business sizes" },
                ].map((item) => (
                  <li key={item.text} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-foreground">
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-10 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold mb-3 text-foreground">
              Choose your GeFlow Plan
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mb-6">
              Simple, transparent pricing for every business stage.
            </p>

            <div className="inline-flex items-center bg-card border border-border rounded-full p-1 gap-1">
              <button
                onClick={() => setBillingPeriod("monthly")}
                className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  billingPeriod === "monthly"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod("yearly")}
                className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  billingPeriod === "yearly"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Yearly
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto min-w-0">
            {/* Free Plan */}
            {(() => {
              const badge = badgeOf("free", billingPeriod);
              const pos = badgePositionOf("free");
              const pop = isPopular("free");
              return (
                <div
                  className={`glass-card p-5 sm:p-7 flex flex-col hover:shadow-lg hover:-translate-y-1 transition-all duration-300 min-w-0 overflow-hidden ${
                    pop ? "border-primary/40 shadow-lg ring-1 ring-primary/30" : ""
                  }`}
                >
                  {badge && pos === "top" ? (
                    <span className="inline-block text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full self-start mb-3">
                      {badge}
                    </span>
                  ) : (
                    <div className="h-[26px] mb-3" />
                  )}
                  <h3 className="text-xl font-bold mb-1 text-foreground">
                    {nameOf("free", "Free")}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 truncate">
                    {taglineOf("free", "Always free")}
                  </p>
                  <p className="text-3xl sm:text-4xl font-bold mb-1 text-foreground">
                    {price(priceOf("free", billingPeriod))}
                  </p>
                  <p className="text-xs text-muted-foreground mb-6">No card needed</p>
                  <ul className="space-y-3 mb-8 flex-1">
                    {featuresOf("free", freePlanFeatures).map((f) => (
                      <li
                        key={f}
                        className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground"
                      >
                        <Check className="h-4 w-4 text-primary shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  {badge && pos === "bottom" && (
                    <span className="inline-block text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full text-center mb-3">
                      {badge}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    className="w-full cta-btn-outline"
                    asChild
                  >
                    <Link to="/signup">Get Started Free</Link>
                  </Button>
                </div>
              );
            })()}

            {/* Standard Plan */}
            {(() => {
              const badge = badgeOf("standard", billingPeriod);
              const pos = badgePositionOf("standard");
              const pop = isPopular("standard");
              return (
                <div
                  className={`glass-card p-5 sm:p-7 flex flex-col hover:shadow-lg hover:-translate-y-1 transition-all duration-300 min-w-0 overflow-hidden ${
                    pop || billingPeriod === "monthly" ? "border-primary/40 shadow-lg ring-1 ring-primary/30" : ""
                  }`}
                >
                  {badge && pos === "top" ? (
                    <span className="inline-block text-xs font-semibold text-primary-foreground bg-primary px-3 py-1 rounded-full self-start mb-3">
                      {badge}
                    </span>
                  ) : (
                    <div className="h-[26px] mb-3" />
                  )}
                  <h3 className="text-xl font-bold mb-1 text-foreground">
                    {nameOf("standard", "Standard")}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 truncate">
                    {taglineOf("standard", "For growing retailers")}
                  </p>
                  <p className="text-3xl sm:text-4xl font-bold text-primary mb-1">
                    {price(priceOf("standard", billingPeriod))}
                  </p>
                  <p className="text-xs text-muted-foreground mb-6">
                    per {billingPeriod === "monthly" ? "month" : "year"}
                  </p>
                  <ul className="space-y-3 mb-8 flex-1">
                    {featuresOf("standard", standardFeatures).map((f) => (
                      <li
                        key={f}
                        className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground"
                      >
                        <Check className="h-4 w-4 text-primary shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  {badge && pos === "bottom" && (
                    <span className="inline-block text-xs font-semibold text-primary-foreground bg-primary px-3 py-1 rounded-full text-center mb-3">
                      {badge}
                    </span>
                  )}
                  <Button className="w-full cta-btn" asChild>
                    <Link to={`/checkout?plan=standard&period=${billingPeriod}`}>
                      Choose Plan
                    </Link>
                  </Button>
                </div>
              );
            })()}

            {/* Premium Plan */}
            {(() => {
              const badge = badgeOf("premium", billingPeriod);
              const pos = badgePositionOf("premium");
              const pop = isPopular("premium");
              return (
                <div
                  className={`glass-card p-5 sm:p-7 flex flex-col hover:shadow-lg hover:-translate-y-1 transition-all duration-300 min-w-0 overflow-hidden ${
                    pop || billingPeriod === "yearly" ? "border-primary/40 shadow-lg ring-1 ring-primary/30" : ""
                  }`}
                >
                  {badge && pos === "top" ? (
                    <span className="inline-block text-xs font-semibold text-secondary-foreground bg-secondary px-3 py-1 rounded-full self-start mb-3">
                      {badge}
                    </span>
                  ) : (
                    <div className="h-[26px] mb-3" />
                  )}
                  <h3 className="text-xl font-bold mb-1 text-foreground">
                    {nameOf("premium", "Premium")}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 truncate">
                    {taglineOf("premium", "For advanced operations")}
                  </p>
                  <p className="text-3xl sm:text-4xl font-bold mb-1 text-foreground">
                    <span
                      className={billingPeriod === "yearly" ? "text-primary" : ""}
                    >
                      {price(priceOf("premium", billingPeriod))}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mb-6">
                    per {billingPeriod === "monthly" ? "month" : "year"}
                  </p>
                  <ul className="space-y-3 mb-8 flex-1">
                    {featuresOf("premium", premiumFeatures).map((f) => (
                      <li
                        key={f}
                        className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground"
                      >
                        <Check className="h-4 w-4 text-primary shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  {badge && pos === "bottom" && (
                    <span className="inline-block text-xs font-semibold text-secondary-foreground bg-secondary px-3 py-1 rounded-full text-center mb-3">
                      {badge}
                    </span>
                  )}
                  <Button
                    variant={billingPeriod === "yearly" ? "default" : "outline"}
                    className={`w-full ${
                      billingPeriod === "yearly" ? "cta-btn" : "cta-btn-outline"
                    }`}
                    asChild
                  >
                    <Link to={`/checkout?plan=premium&period=${billingPeriod}`}>
                      Choose Plan
                    </Link>
                  </Button>
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      <CTASection />
    </Layout>
  );
};

export default Index;
