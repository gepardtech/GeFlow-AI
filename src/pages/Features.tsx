import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Package,
  ShoppingCart,
  ScanLine,
  TrendingUp,
  FileText,
  Truck,
  CalendarClock,
  AlertTriangle,
  Zap,
  Users,
  Layers,
  BarChart3,
  Sparkles,
} from "lucide-react";

type Plan = "Free" | "Standard" | "Premium";

interface Feature {
  title: string;
  desc: string;
  icon: React.ElementType;
  plans: Plan[];
}

interface Group {
  title: string;
  features: Feature[];
}

const planColor: Record<Plan, string> = {
  Free: "text-primary",
  Standard: "text-secondary",
  Premium: "text-[hsl(320_70%_60%)]",
};

const groups: Group[] = [
  {
    title: "Core Business Operations",
    features: [
      {
        title: "Inventory Control",
        desc: "Track every item movement with automated SKU generation and history.",
        icon: Package,
        plans: ["Free", "Standard", "Premium"],
      },
      {
        title: "Fast POS Terminal",
        desc: "Lightning-fast billing interface optimized for high-traffic retail environments.",
        icon: ShoppingCart,
        plans: ["Free", "Standard", "Premium"],
      },
      {
        title: "Barcode Support",
        desc: "Native integration with scanning hardware for error-free stock management.",
        icon: ScanLine,
        plans: ["Standard", "Premium"],
      },
      {
        title: "AI Store Assistant (Basic Level)",
        desc: "Interactive retail assistant for quick inventory lookups, low stock triage, and daily sales summaries.",
        icon: Sparkles,
        plans: ["Free", "Standard", "Premium"],
      },
    ],
  },
  {
    title: "Advanced Financial Logic",
    features: [
      {
        title: "Profit Engine",
        desc: "Real-time gross and net profit calculations based on weighted average costing.",
        icon: TrendingUp,
        plans: ["Standard", "Premium"],
      },
      {
        title: "Expense Tracking",
        desc: "Manage overhead costs like rent, utilities, and wages in one dashboard.",
        icon: FileText,
        plans: ["Standard", "Premium"],
      },
      {
        title: "Supplier Portal",
        desc: "Automate purchase orders and track vendor payments seamlessly.",
        icon: Truck,
        plans: ["Standard", "Premium"],
      },
    ],
  },
  {
    title: "Automation & Alerts",
    features: [
      {
        title: "Expiry System",
        desc: "Automated alerts for near-expiry products to minimize business waste.",
        icon: CalendarClock,
        plans: ["Premium"],
      },
      {
        title: "Low Stock Alerts",
        desc: "Never run out of bestsellers with intelligent reorder notifications.",
        icon: AlertTriangle,
        plans: ["Premium"],
      },
      {
        title: "Automated Costing",
        desc: "Live average cost recalculation as soon as new stock is added.",
        icon: Zap,
        plans: ["Standard", "Premium"],
      },
    ],
  },
  {
    title: "Enterprise Governance",
    features: [
      {
        title: "Role-based Access",
        desc: "Secure permissions for every employee, from cashier to manager.",
        icon: Users,
        plans: ["Standard", "Premium"],
      },
      {
        title: "Multi-branch Architecture",
        desc: "Connect multiple store locations to a single cloud-based HQ.",
        icon: Layers,
        plans: ["Premium"],
      },
      {
        title: "Deep Analytics",
        desc: "Visual charts and downloadable reports for every business metric.",
        icon: BarChart3,
        plans: ["Premium"],
      },
    ],
  },
];

const FeatureCard = ({ feature }: { feature: Feature }) => {
  const Icon = feature.icon;
  return (
    <div className="premium-card p-6 group">
      <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-bold text-base mb-2">{feature.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">{feature.desc}</p>
      <div className="pt-4 border-t border-border">
        <p className="text-[10px] font-bold tracking-wider uppercase">
          <span className="text-muted-foreground">Available on: </span>
          {feature.plans.map((p, i) => (
            <span key={p}>
              <span className={planColor[p]}>{p.toUpperCase()}</span>
              {i < feature.plans.length - 1 && <span className="text-muted-foreground">, </span>}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
};

const Features = () => (
  <Layout>
    <section className="pt-20 pb-12">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          <span className="text-gradient">GeFlow</span> Features
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Everything you need to manage your business faster, smarter, and with total accuracy.
        </p>
      </div>
    </section>

    <section className="pb-20">
      <div className="container mx-auto px-4 space-y-16">
        {groups.map((group) => (
          <div key={group.title}>
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">{group.title}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {group.features.map((f) => (
                <FeatureCard key={f.title} feature={f} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>

    <section className="pb-24">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-3xl p-12 md:p-16 text-center max-w-5xl mx-auto border border-primary/20 bg-gradient-to-br from-primary/15 via-secondary/15 to-primary/10 dark:from-primary/10 dark:via-secondary/10 dark:to-card dark:border-border/80 shadow-xl">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ready to Unlock More Features?
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8 text-base">
            Explore our tiered plans to find the perfect fit for your needs and get access to our most advanced tools.
          </p>
          <Button
            size="lg"
            className="cta-btn bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8 rounded-full shadow-lg shadow-primary/25"
            asChild
          >
            <Link to="/pricing">View Pricing Plans</Link>
          </Button>
        </div>
      </div>
    </section>
  </Layout>
);

export default Features;
