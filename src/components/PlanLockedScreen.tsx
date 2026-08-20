import { Link } from "react-router-dom";
import { Lock, Sparkles, Check, ArrowRight } from "lucide-react";
import { getPlan, minPlanForRoute, PlanId, PLANS } from "@/lib/plans";

interface Props {
  currentPlan: PlanId;
  path: string;
  pageTitle: string;
}

const PERKS: Record<PlanId, string[]> = {
  free: [],
  standard: ["Up to 100 products", "3 branches", "Team Hub", "30-day reports", "Suppliers & Purchases"],
  premium: ["Unlimited products & branches", "Advanced analytics", "Batch & expiry tracking", "Multi-branch sync", "Audit logs"],
  lifetime: ["Everything Premium", "White label", "Priority performance", "Early feature access"],
};

const PlanLockedScreen = ({ currentPlan, path, pageTitle }: Props) => {
  const required = minPlanForRoute(path);
  const requiredPlan = PLANS[required];
  const current = getPlan(currentPlan);

  return (
    <div className="max-w-3xl mx-auto py-10">
      <div className="bg-card border border-border rounded-3xl p-8 md:p-10 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 via-transparent to-violet-500/5 pointer-events-none" />
        <div className="relative">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center mb-5 shadow-lg shadow-violet-500/20">
            <Lock className="h-7 w-7 text-white" />
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest bg-amber-500/15 text-amber-600 dark:text-amber-300 px-2.5 py-1 rounded-full mb-3">
            <Sparkles className="h-3 w-3" /> {requiredPlan.label.toUpperCase()} FEATURE
          </span>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{pageTitle} is locked</h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Your current <span className="font-bold text-foreground">{current.label}</span> plan doesn't include
            this module. Upgrade to <span className="font-bold text-foreground">{requiredPlan.label}</span> to unlock it.
          </p>

          <div className="mt-7 grid sm:grid-cols-2 gap-3 text-left max-w-xl mx-auto">
            {PERKS[required]?.map((perk) => (
              <div key={perk} className="flex items-center gap-2.5 bg-muted/40 rounded-xl px-3.5 py-2.5">
                <span className="h-5 w-5 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center flex-shrink-0">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-sm font-medium">{perk}</span>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap gap-3 justify-center">
            <Link
              to="/pricing"
              className="h-11 px-6 rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 text-white text-sm font-bold inline-flex items-center gap-2 hover:shadow-lg hover:shadow-violet-500/30 hover:-translate-y-0.5 transition-all"
            >
              Upgrade to {requiredPlan.label} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/dashboard/subscription"
              className="h-11 px-6 rounded-xl bg-card border border-border text-sm font-bold inline-flex items-center hover:bg-muted transition"
            >
              Compare plans
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanLockedScreen;
