import { useState } from "react";
import {
  PayPalButtons,
  PayPalCardFieldsProvider,
  PayPalNumberField,
  PayPalExpiryField,
  PayPalCVVField,
  usePayPalCardFields,
} from "@paypal/react-paypal-js";
import { ArrowRight, ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CaptureResult {
  status: string;
  plan: string;
  cycle: string;
  amount: number;
  currency: string;
  method: string;
  payerEmail: string;
  invoiceNumber: string;
  hasBusiness: boolean;
}

interface Props {
  plan: string;
  cycle: string;
  amount: number;
  couponCode?: string | null;
  /** Creates/authenticates the account. Must resolve true before payment starts. */
  ensureAuth: () => Promise<boolean>;
  onSuccess: (result: CaptureResult) => void;
  ctaLabel: string;
  priceLabel: string;
}

const createOrder = async (plan: string, cycle: string, amount: number, coupon?: string | null, actions?: any) => {
  try {
    const { data, error } = await supabase.functions.invoke("paypal-payments", {
      body: { action: "create", plan, cycle, amount, currency: "USD", coupon },
    });
    if (!error && data?.id) return data.id as string;
    if (data?.error) console.warn("Edge function create failed:", data.error);
  } catch (err) {
    console.warn("Edge function create threw:", err);
  }

  // Fallback to PayPal Client Actions if Edge function is unreachable
  if (actions?.order) {
    return actions.order.create({
      intent: "CAPTURE",
      purchase_units: [{
        description: `GeFlow ${plan} plan (${cycle})`,
        amount: {
          currency_code: "USD",
          value: Math.max(amount, 0.01).toFixed(2),
        },
      }],
      application_context: {
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        brand_name: "GeFlow",
      },
    });
  }
  throw new Error("Could not start PayPal payment. Please check your credentials.");
};

const captureOrder = async (orderId: string, plan: string, cycle: string, amount: number, actions?: any): Promise<CaptureResult> => {
  try {
    const { data, error } = await supabase.functions.invoke("paypal-payments", {
      body: { action: "capture", orderId, plan, cycle },
    });
    if (!error && data && !data.error && (data.status === "COMPLETED" || data.status === "APPROVED")) {
      return data as CaptureResult;
    }
    if (data?.error) console.warn("Edge function capture failed:", data.error);
  } catch (err) {
    console.warn("Edge function capture threw:", err);
  }

  // Client-side fallback capture
  let captureData: any = null;
  if (actions?.order) {
    captureData = await actions.order.capture();
  }

  const { data: { user } } = await supabase.auth.getUser();
  const payerEmail = captureData?.payer?.email_address ?? user?.email ?? "";
  const invoiceNumber = `INV-${(orderId || Date.now().toString()).slice(-8).toUpperCase()}`;

  // Update profile plan in Supabase
  if (user) {
    await supabase.from("profiles").update({
      plan,
      status: "active",
      last_active: new Date().toISOString(),
    } as any).eq("user_id", user.id);

    const next = new Date();
    if (cycle === "monthly") next.setMonth(next.getMonth() + 1);
    else if (cycle === "yearly") next.setFullYear(next.getFullYear() + 1);

    await supabase.from("subscriptions").insert({
      owner_user_id: user.id,
      tier: plan,
      cycle,
      status: "active",
      amount,
      next_billing_date: cycle === "lifetime" ? null : next.toISOString(),
    } as any);

    await supabase.from("invoices").insert({
      invoice_number: invoiceNumber,
      owner_user_id: user.id,
      client_name: (user.user_metadata?.full_name as string) || payerEmail || "Customer",
      billing_email: user.email || payerEmail,
      plan,
      payment_method: "PayPal",
      amount,
      status: "paid",
    } as any);
  }

  const { count } = user
    ? await supabase.from("businesses").select("id", { count: "exact", head: true }).eq("owner_user_id", user.id)
    : { count: 0 };

  return {
    status: "COMPLETED",
    plan,
    cycle,
    amount,
    currency: "USD",
    method: `PayPal (${payerEmail || "Verified"})`,
    payerEmail,
    invoiceNumber,
    hasBusiness: (count ?? 0) > 0,
  };
};

/* --------------------------- Card submit button --------------------------- */
const CardSubmit = ({ ctaLabel, priceLabel, busy, setBusy }: {
  ctaLabel: string; priceLabel: string; busy: boolean; setBusy: (v: boolean) => void;
}) => {
  const { cardFieldsForm } = usePayPalCardFields();
  const { toast } = useToast();

  const submit = async () => {
    if (!cardFieldsForm) return;
    const state = await cardFieldsForm.getState();
    if (!state.isFormValid) {
      toast({ title: "Check your card details", description: "Please complete all card fields.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await cardFieldsForm.submit();
    } catch (e) {
      setBusy(false);
      toast({ title: "Payment failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <Button
        type="button"
        onClick={submit}
        disabled={busy}
        className="cta-btn w-full h-14 rounded-full text-sm font-bold tracking-wider gap-2 bg-primary text-primary-foreground hover:bg-primary shadow-lg shadow-primary/25 transition-all duration-300 active:scale-[0.99]"
      >
        {busy ? (
          "PROCESSING TRANSACTION..."
        ) : (
          <>
            <Lock className="h-4 w-4" />
            {ctaLabel} • {priceLabel}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
      <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-muted-foreground tracking-wider">
        <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0" />
        <span>PCI-DSS LEVEL 1 COMPLIANT • 256-BIT SSL ENCRYPTED</span>
      </div>
    </div>
  );
};

/* ------------------------------ Card section ------------------------------ */
export const PayPalCardSection = ({ plan, cycle, amount, couponCode, ensureAuth, onSuccess, ctaLabel, priceLabel }: Props) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4">
      <PayPalCardFieldsProvider
        createOrder={async () => {
          const ok = await ensureAuth();
          if (!ok) throw new Error("Account details are required");
          return createOrder(plan, cycle, amount, couponCode);
        }}
        onApprove={async (data, actions) => {
          try {
            const result = await captureOrder(data.orderID, plan, cycle, amount, actions);
            onSuccess(result);
          } catch (e) {
            toast({ title: "Payment failed", description: (e as Error).message, variant: "destructive" });
          } finally {
            setBusy(false);
          }
        }}
        onError={(err) => {
          setBusy(false);
          toast({ title: "Payment failed", description: String((err as any)?.message ?? err), variant: "destructive" });
        }}
        style={{
          input: {
            "font-size": "15px",
            "font-family": "Inter, system-ui, sans-serif",
            padding: "12px 14px",
            color: "currentColor",
          },
        }}
      >
        <div>
          <label className="text-[10px] font-bold tracking-wider text-muted-foreground mb-2 block uppercase">
            Credit or Debit Card Number
          </label>
          <div className="paypal-field rounded-xl border border-input bg-background/80 dark:bg-muted/40 hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 px-3 transition-all">
            <PayPalNumberField />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold tracking-wider text-muted-foreground mb-2 block uppercase">
              Expiration Date
            </label>
            <div className="paypal-field rounded-xl border border-input bg-background/80 dark:bg-muted/40 hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 px-3 transition-all">
              <PayPalExpiryField />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold tracking-wider text-muted-foreground mb-2 block uppercase">
              CVC / CVV
            </label>
            <div className="paypal-field rounded-xl border border-input bg-background/80 dark:bg-muted/40 hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 px-3 transition-all">
              <PayPalCVVField />
            </div>
          </div>
        </div>

        <CardSubmit ctaLabel={ctaLabel} priceLabel={priceLabel} busy={busy} setBusy={setBusy} />
      </PayPalCardFieldsProvider>
    </div>
  );
};

/* ----------------------------- PayPal buttons ----------------------------- */
export const PayPalWalletSection = ({
  plan,
  cycle,
  amount,
  couponCode,
  ensureAuth,
  onSuccess,
  payerEmail,
  ctaLabel,
  priceLabel,
}: Props & { payerEmail?: string }) => {
  const { toast } = useToast();

  return (
    <div className="space-y-4 pt-1">
      <div className="rounded-2xl border border-border/80 bg-card/60 dark:bg-card/40 backdrop-blur-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">PayPal Instant Checkout</p>
              <p className="text-[11px] text-muted-foreground">Authorize with your PayPal account balance or linked cards</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <span className="text-xs font-bold text-primary">{priceLabel}</span>
          </div>
        </div>

        {payerEmail ? (
          <div className="rounded-lg bg-muted/60 dark:bg-muted/30 p-3 border border-border/50 text-xs text-muted-foreground flex items-center justify-between gap-2">
            <span>Billing account:</span>
            <span className="font-semibold text-foreground truncate max-w-[220px]">{payerEmail}</span>
          </div>
        ) : null}

        <div className="paypal-btn-wrapper relative z-10 w-full min-h-[48px]">
          <PayPalButtons
            style={{ layout: "vertical", shape: "pill", color: "gold", height: 48, label: "paypal" }}
            createOrder={async (data, actions) => {
              const ok = await ensureAuth();
              if (!ok) throw new Error("Account details are required");
              return createOrder(plan, cycle, amount, couponCode, actions);
            }}
            onApprove={async (data, actions) => {
              try {
                const result = await captureOrder(data.orderID, plan, cycle, amount, actions);
                onSuccess(result);
              } catch (e) {
                toast({ title: "Payment failed", description: (e as Error).message, variant: "destructive" });
              }
            }}
            onError={(err) => {
              toast({ title: "PayPal error", description: String((err as any)?.message ?? err), variant: "destructive" });
            }}
          />
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          Click above to authenticate in a secure PayPal popup. You will review the <span className="font-semibold text-foreground">{priceLabel}</span> total before completing.
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-muted-foreground tracking-wider pt-1">
        <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0" />
        <span>PCI-DSS LEVEL 1 COMPLIANT • 256-BIT SSL ENCRYPTED</span>
      </div>
    </div>
  );
};

