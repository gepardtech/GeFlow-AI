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
    title: "Counter Billing & Checkout",
    features: [
      {
        title: "Fast POS Billing",
        desc: "Ring up customer sales in seconds with swift cart calculations and instant change return.",
        icon: ShoppingCart,
        plans: ["Free", "Standard", "Premium"],
      },
      {
        title: "Barcode Scanner Support",
        desc: "Plug in any standard USB or wireless handheld barcode scanner for error-free checkout.",
        icon: ScanLine,
        plans: ["Free", "Standard", "Premium"],
      },
      {
        title: "Thermal Receipt Printing",
        desc: "Print clean 58mm or 80mm receipts with your store name, contact number, and tax details.",
        icon: FileText,
        plans: ["Standard", "Premium"],
      },
      {
        title: "Store Credit & Udhar Book",
        desc: "Track loyal regular customer credit balances, add credit notes, and record partial repayments.",
        icon: Users,
        plans: ["Standard", "Premium"],
      },
    ],
  },
  {
    title: "Stock & Shelf Management",
    features: [
      {
        title: "Live Stock Tracking",
        desc: "Every item billed or restocked instantly updates your available inventory count.",
        icon: Package,
        plans: ["Free", "Standard", "Premium"],
      },
      {
        title: "Low Stock Alert Ringtones",
        desc: "Choose from 18 audible alert chimes to warn your staff before bestsellers sell out.",
        icon: AlertTriangle,
        plans: ["Free", "Standard", "Premium"],
      },
      {
        title: "Batch & Expiry Dates",
        desc: "Essential for pharmacies and grocery shops. Sell oldest batches first and stop expired sales.",
        icon: CalendarClock,
        plans: ["Premium"],
      },
      {
        title: "Supplier Restock Logs",
        desc: "Record incoming distributor shipments with purchase costs to keep margins 100% accurate.",
        icon: Truck,
        plans: ["Standard", "Premium"],
      },
    ],
  },
  {
    title: "Daily Profits & Cash Flow",
    features: [
      {
        title: "Live Profit Margins",
        desc: "See your actual gross and net profit based on your real wholesale purchase costs.",
        icon: TrendingUp,
        plans: ["Standard", "Premium"],
      },
      {
        title: "Daily Store Expense Log",
        desc: "Track daily shop overheads like rent, tea, utility bills, and packaging supplies in one spot.",
        icon: Zap,
        plans: ["Standard", "Premium"],
      },
      {
        title: "Simple Returns & Restocking",
        desc: "Process customer product returns smoothly with automatic restock adjustments.",
        icon: Package,
        plans: ["Standard", "Premium"],
      },
      {
        title: "End-of-Day Cash Summary",
        desc: "Match your drawer cash against card payments and store credit before locking up.",
        icon: BarChart3,
        plans: ["Premium"],
      },
    ],
  },
  {
    title: "Staff & Business Control",
    features: [
      {
        title: "Staff & Cashier Permissions",
        desc: "Cashiers ring up sales while your purchase costs, financial books, and profits stay private.",
        icon: Users,
        plans: ["Standard", "Premium"],
      },
      {
        title: "Multi-Store Branches",
        desc: "Check stock and sales across different shop branches or warehouses from one screen.",
        icon: Layers,
        plans: ["Premium"],
      },
      {
        title: "Downloadable PDF & Excel Reports",
        desc: "Export sales ledgers, inventory counts, and tax reports whenever your accountant needs them.",
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
          Features Built for <span className="text-gradient">Everyday Retailers</span>
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Every button, screen, and calculation is tailored to real shop counters — fast checkout, zero missing stock, and clear daily profits.
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
            Ready to Take Control of Your Store?
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8 text-base">
            Start with our Free tier today or choose an affordable plan with thermal printing, udhar ledgers, and staff cashier roles.
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
