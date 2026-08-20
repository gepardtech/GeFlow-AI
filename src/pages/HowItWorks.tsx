import { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import CTASection from "@/components/CTASection";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Building2, PackagePlus, ShoppingCart, BarChart3,
  Boxes, Zap, Users, ShieldCheck, FileBarChart, Headphones,
} from "lucide-react";

const steps = [
  { icon: Building2, title: "Setup Your Workspace", desc: "Create your business profile and configure your specific branch details in seconds. Our system adapts to your business model." },
  { icon: PackagePlus, title: "Initialize Inventory", desc: "Bulk import your products via CSV or add them manually with SKUs, costs, and initial stock levels to get started." },
  { icon: ShoppingCart, title: "Process Instant Sales", desc: "Start using our lightning-fast POS terminal. Every sale automatically updates stock levels and profit reports in real-time." },
  { icon: BarChart3, title: "Track & Scale", desc: "Monitor your business health with deep analytics. Get instant reports on inventory value, profit margins, and sales trends." },
];

const features = [
  { icon: Boxes, title: "Inventory Engine", desc: "Real-time stock tracking and SKU history." },
  { icon: Zap, title: "Automated Costing", desc: "Weighted average cost calculations." },
  { icon: Users, title: "Staff Roles", desc: "Role-based access for your entire team." },
  { icon: ShieldCheck, title: "Secure Backups", desc: "Enterprise-grade cloud data security." },
  { icon: FileBarChart, title: "Live Reports", desc: "Instant financial and stock summaries." },
  { icon: Headphones, title: "Priority Support", desc: "24/7 assistance for your operations." },
];

const faqs = [
  { q: "What types of businesses are supported?", a: "GeFlow is built for pharmacies, retail stores, warehouses, and any inventory-driven business — from single shops to multi-branch operations." },
  { q: "How accurate is the real-time profit tracking?", a: "Every sale and purchase updates your profit metrics instantly using weighted average costing, so the numbers you see are always accurate to the second." },
  { q: "Can I import my existing inventory data?", a: "Yes. You can bulk import products via CSV, including SKUs, costs, prices, and stock levels — get up and running in minutes." },
  { q: "Is my data secure?", a: "All data is encrypted in transit and at rest, with automated daily backups and enterprise-grade cloud infrastructure." },
];

const HowItWorks = () => {
  const [openItem, setOpenItem] = useState<string>("item-0");

  return (
    <Layout>
      {/* Hero */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
            How <span className="text-gradient">GeFlow</span> Works
          </h1>
          <p className="text-muted-foreground mb-8">
            A simple step-by-step guide to transforming your business operations in minutes.
          </p>
          <Button size="lg" className="cta-btn bg-primary text-primary-foreground rounded-full px-8" asChild>
            <Link to="/signup">Start Free Trial</Link>
          </Button>
        </div>
      </section>

      {/* Steps Grid 2x2 */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid sm:grid-cols-2 gap-6">
            {steps.map((s, i) => (
              <div key={s.title} className="glass-card p-7 hover:border-primary/40 hover:-translate-y-1 transition-all duration-300">
                <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">{i + 1}. {s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closer Look at Features */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">A Closer Look at Our Features</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Every module is built with precision to ensure your business runs like a well-oiled machine.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="glass-card p-6 text-center hover:border-primary/40 hover:-translate-y-1 transition-all duration-300">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
                  <f.icon className="h-4 w-4 text-primary" />
                </div>
                <h4 className="font-semibold text-sm mb-1.5">{f.title}</h4>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">Frequently Asked Questions</h2>
            <p className="text-muted-foreground">Everything you need to know to get started with GeFlow.</p>
          </div>
          <Accordion type="single" collapsible value={openItem} onValueChange={setOpenItem} className="space-y-3">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="glass-card px-5 border">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden rounded-3xl p-12 md:p-16 text-center border border-primary/20 bg-gradient-to-br from-primary/15 via-secondary/15 to-primary/10 dark:from-primary/10 dark:via-secondary/10 dark:to-card dark:border-border/80 shadow-xl">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
              Ready to Scale Your Business?
            </h2>
            <p className="text-muted-foreground mb-7 max-w-md mx-auto text-base">
              Join thousands of business owners simplifying their operations with GeFlow.
            </p>
            <Button size="lg" className="cta-btn bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8 rounded-full shadow-lg shadow-primary/25" asChild>
              <Link to="/signup">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default HowItWorks;
