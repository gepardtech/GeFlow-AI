import { Link } from "react-router-dom";
import { Lock, Sparkles, Check, ArrowRight } from "lucide-react";
import { PlanId } from "@/hooks/usePlan";

interface Props {
  currentPlan: PlanId;
  path: string;
  pageTitle: string;
}

const PLAN_LABELS: Record<PlanId, string> = {
  free: "Free",
  standard: "Standard",
  premium: "Premium",
  lifetime: "Lifetime VIP",
};

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  standard: 1,
  premium: 2,
  lifetime: 3,
};

const ROUTE_MIN_PLAN: { prefix: string; min: PlanId }[] = [
  { prefix: "/dashboard/purchases", min: "standard" },
  { prefix: "/dashboard/analytics", min: "premium" },
  { prefix: "/dashboard/team", min: "premium" },
];

function minPlanForRoute(path: string): PlanId {
  for (const rule of ROUTE_MIN_PLAN) {
    if (path === rule.prefix || path.startsWith(rule.prefix + "/")) {
      return rule.min;
    }
  }
  return "premium";
}

const PERKS: Record<PlanId, string[]> = {
  free: [],
  standard: [
    "Up to 500 products",
    "3 branches",
    "Suppliers & Purchases",
    "30-day reports",
    "Returns & refunds",
  ],
  premium: [
    "Unlimited products",
    "Up to 7 branches",
    "Team Hub & analytics",
    "Full AI suite",
    "Multi-branch sync",
  ],
  lifetime: [
    "Everything in Premium",
    "Up to 10 branches",
    "Priority AI",
    "White label ready",
    "Lifetime access",
  ],
};

const PlanLockedScreen = ({ currentPlan, path, pageTitle }: Props) => {
  const required = minPlanForRoute(path);
  const requiredLabel = PLAN_LABELS[required];
  const currentLabel = PLAN_LABELS[currentPlan] || "Free";

  return (
    <div className="max-w-3xl mx-auto py-10">
      <div className="bg-card border border-border rounded-3xl p-8 md:p-10 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 via-transparent to-violet-500/5 pointer-events-none" />
        <div className="relative">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center mb-5 shadow-lg shadow-violet-500/20">
            <Lock className="h-7 w-7 text-white" />
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest bg-amber-500/15 text-amber-600 dark:text-amber-300 px-2.5 py-1 rounded-full mb-3">
            <Sparkles className="h-3 w-3" /> {requiredLabel.toUpperCase()} FEATURE
          </span>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{pageTitle} is locked</h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Your current{" "}
            <span className="font-bold text-foreground">{currentLabel}</span> plan
            doesn&apos;t include this module. Upgrade to{" "}
            <span className="font-bold text-foreground">{requiredLabel}</span> to
            unlock it.
          </p>

          <div className="mt-7 grid sm:grid-cols-2 gap-3 text-left max-w-xl mx-auto">
            {(PERKS[required] || []).map((perk) => (
              <div
                key={perk}
                className="flex items-center gap-2.5 bg-muted/40 rounded-xl px-3.5 py-2.5"
              >
                <span className="h-5 w-5 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center flex-shrink-0">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-sm font-medium">{perk}</span>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap gap-3 justify-center">
            <Link
              to="/dashboard/subscription"
              className="h-11 px-6 rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 text-white text-sm font-bold inline-flex items-center gap-2 hover:shadow-lg hover:shadow-violet-500/30 hover:-translate-y-0.5 transition-all"
            >
              Upgrade to {requiredLabel} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/dashboard/subscription"
              className="h-11 px-6 rounded-xl bg-card border border-border text-sm font-bold inline-flex items-center hover:bg-muted transition"
            >
              View Subscription & Plans
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanLockedScreen;