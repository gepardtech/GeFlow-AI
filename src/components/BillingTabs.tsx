import { NavLink } from "react-router-dom";
import { CreditCard, Receipt, DollarSign, Undo2, Ticket } from "lucide-react";

const tabs = [
  { to: "/admin/billing/subscriptions", label: "Subscriptions", icon: CreditCard },
  { to: "/admin/billing/pricing-plans", label: "Pricing Plans", icon: DollarSign },
  { to: "/admin/billing/invoices", label: "Invoices", icon: Receipt },
  { to: "/admin/billing/refunds", label: "Refunds", icon: Undo2 },
  { to: "/admin/billing/coupons", label: "Coupon Codes", icon: Ticket },
];

const BillingTabs = () => (
  <div className="mb-6">
    <h1 className="text-3xl md:text-4xl font-bold mb-1">Billing &amp; Monetization</h1>
    <p className="text-sm text-muted-foreground mb-5">Control revenue streams, manage tiers, and oversee global transactions.</p>
    <div className="inline-flex items-center gap-1 bg-card border border-border rounded-xl p-1.5 flex-wrap">
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <NavLink key={t.to} to={t.to} end className={({ isActive }) =>
            `inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-bold transition ${isActive ? "bg-sky-400/15 text-sky-500" : "text-muted-foreground hover:bg-muted/60"}`
          }>
            <Icon className="h-4 w-4" /> {t.label}
          </NavLink>
        );
      })}
    </div>
  </div>
);
export default BillingTabs;
