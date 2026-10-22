import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Crown,
  Zap,
  Box,
  Check,
  ArrowUpRight,
  ArrowRight,
  CreditCard,
  FileText,
  Download,
  Loader2,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Tag,
  AlertCircle,
  Clock,
  Sparkles,
  Plus,
  RefreshCw,
  Wallet,
  Trash2,
  ExternalLink,
  Mail,
} from "lucide-react";
import UserPanelGate from "@/components/UserPanelGate";
import { usePlan } from "@/hooks/usePlan";
import { usePricingPlans } from "@/hooks/usePricingPlans";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { usePlatformSettings } from "@/components/PlatformSettingsProvider";
import { usePaymentGateways } from "@/hooks/usePaymentGateways";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSearchParams } from "react-router-dom";
import {
  validateCoupon,
  getPendingCoupon,
  clearPendingCoupon,
  findActiveAnnouncementCoupon,
} from "@/lib/couponHelper";
import jsPDF from "jspdf";

interface InvoiceRecord {
  id: string;
  invoice_number: string;
  client_name: string;
  billing_email: string;
  plan: string;
  payment_method: string;
  amount: number;
  status: string;
  issue_date: string;
}

interface SavedPaymentMethod {
  id?: string;
  type?: "card" | "paypal";
  brand?: string;
  last4?: string;
  expMonth?: string;
  expYear?: string;
  holderName?: string;
  paypalEmail?: string;
  source?: "user_manual" | "checkout";
}

const detectCardBrand = (digits: string): "VISA" | "Mastercard" | "American Express" | "Discover" | "Card" => {
  const clean = digits.replace(/\D/g, "");
  if (/^4/.test(clean)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(clean)) return "Mastercard";
  if (/^3[47]/.test(clean)) return "American Express";
  if (/^(6011|65|64[4-9]|622)/.test(clean)) return "Discover";
  return "Card";
};

export const UserSubscription = () => {
  const [searchParams] = useSearchParams();
  const { planId, fullName, email, userId } = usePlan();
  const { plans: livePricing, loading: pricingLoading, priceOf, ctaTextOf, badgeOf } = usePricingPlans();
  const { activeBusiness } = useActiveBusiness();
  const { settings } = usePlatformSettings();
  const { toast } = useToast();

  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly" | "lifetime">("monthly");
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [activeSub, setActiveSub] = useState<any>(null);

  const { paypalClientId, paypal } = usePaymentGateways();
  const isPaypalEnabled = paypal ? paypal.enabled : true;

  // Real payment method state — only real methods; never fake demo/fluffy cards
  const [paymentCard, setPaymentCard] = useState<SavedPaymentMethod | null>(null);
  const [loadingPaymentMethod, setLoadingPaymentMethod] = useState(true);

  // Modal States
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>("premium");

  // Upgrade Form State
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [appliedCouponData, setAppliedCouponData] = useState<{
    code: string;
    label: string;
    amount: number;
    discountType: "percent" | "amount";
    discountValue: number;
    isAnnouncementPromo?: boolean;
  } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [selectedCycleForUpgrade, setSelectedCycleForUpgrade] = useState<"monthly" | "yearly" | "lifetime">("monthly");

  // Payment Method Modal Form State (Synced with Checkout & Admin Gateways)
  const [paymentMethodType, setPaymentMethodType] = useState<"card" | "paypal">("card");
  const [paypalEmailInput, setPaypalEmailInput] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardZip, setCardZip] = useState("");
  const [savingCard, setSavingCard] = useState(false);
  const [removingPaymentMethod, setRemovingPaymentMethod] = useState(false);

  // Renewal email reminder states
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const autoRenewalReminderSentRef = React.useRef(false);

  // Sync form inputs when editing existing payment card
  useEffect(() => {
    if (paymentCard?.type === "card") {
      setPaymentMethodType("card");
      setCardName(paymentCard.holderName || "");
      setCardNumber(paymentCard.last4 ? `•••• •••• •••• ${paymentCard.last4}` : "");
      setCardExp(paymentCard.expMonth && paymentCard.expYear ? `${paymentCard.expMonth}/${paymentCard.expYear}` : "");
    } else if (paymentCard?.type === "paypal") {
      setPaymentMethodType("paypal");
      setPaypalEmailInput(paymentCard.paypalEmail || "");
    } else {
      setCardName("");
      setCardNumber("");
      setCardExp("");
      setCardCvc("");
      setCardZip("");
      setPaypalEmailInput("");
    }
  }, [paymentCard]);

  // Load real user payment method from backend
  const loadPaymentMethod = useCallback(async (activeUserId: string) => {
    if (!activeUserId) return;
    setLoadingPaymentMethod(true);
    try {
      const res = await fetch(`/api/user/subscription/payment-method?userId=${encodeURIComponent(activeUserId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.paymentMethod) {
          const pm = json.paymentMethod;
          setPaymentCard({
            id: pm.id,
            type: pm.type,
            brand: pm.card?.brand,
            last4: pm.card?.last4,
            expMonth: pm.card?.expMonth,
            expYear: pm.card?.expYear,
            holderName: pm.card?.holderName,
            paypalEmail: pm.paypal?.email,
            source: pm.source,
          });
          setLoadingPaymentMethod(false);
          return;
        }
      }
      setPaymentCard(null);
    } catch (err) {
      console.warn("Notice loading user payment method:", err);
      setPaymentCard(null);
    } finally {
      setLoadingPaymentMethod(false);
    }
  }, []);

  // Manage Subscription State
  const [autoRenew, setAutoRenew] = useState(() => {
    const saved = localStorage.getItem("geflow_autorenew");
    return saved !== null ? saved === "true" : true;
  });
  const [savingManage, setSavingManage] = useState(false);
  const [expiryNotificationDismissed, setExpiryNotificationDismissed] = useState(false);

  const handleToggleAutoRenew = (val: boolean) => {
    setAutoRenew(val);
    localStorage.setItem("geflow_autorenew", String(val));
    toast({
      title: val ? "Auto-Renew Enabled" : "Auto-Renew Paused",
      description: val
        ? "Your plan will automatically renew on the next billing date."
        : "Your plan will not auto-charge. You will be alerted 7 days before expiry.",
    });
  };

  // Load real subscription & invoice records from Supabase
  const loadSubscriptionData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch user's subscription record
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subData) {
        setActiveSub(subData);
        if (subData.cycle === "yearly") setBillingCycle("yearly");
      }

      // Load user's real payment method (Card or PayPal)
      await loadPaymentMethod(user.id);

      // 2. Fetch user's invoices
      let userInvoices: any[] = [];
      try {
        const { data: invData } = await supabase
          .from("invoices")
          .select("*")
          .or(`owner_user_id.eq.${user.id},billing_email.eq.${user.email}`)
          .order("created_at", { ascending: false });

        if (invData && invData.length > 0) {
          userInvoices = invData;
        }
      } catch {
        /* fallback below */
      }

      if (userInvoices.length === 0 && user.email) {
        try {
          const res = await fetch(`/api/admin/invoices?search=${encodeURIComponent(user.email)}`);
          const json = await res.json();
          if (json.success && Array.isArray(json.invoices) && json.invoices.length > 0) {
            userInvoices = json.invoices.filter(
              (i: any) =>
                i.billing_email?.toLowerCase() === user.email?.toLowerCase() ||
                i.owner_user_id === user.id
            );
          }
        } catch {
          /* ignore */
        }
      }

      if (userInvoices.length > 0) {
        setInvoices(userInvoices as InvoiceRecord[]);
      } else {
        setInvoices([]);
      }
    } catch (err) {
      console.error("Error loading subscription data:", err);
    } finally {
      setLoadingInvoices(false);
    }
  }, [fullName, planId, loadPaymentMethod]);

  useEffect(() => {
    loadSubscriptionData();

    const ch = supabase
      .channel(`user_subs_rt_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, loadSubscriptionData)
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, loadSubscriptionData)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadSubscriptionData)
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [loadSubscriptionData]);

  // Current Plan Details
  const currentPlanNormalized = (planId || "free").toLowerCase();

  const planPricing = useMemo(() => {
    const freeRow = livePricing.find((p) => p.plan_key === "free");
    const stdRow = livePricing.find((p) => p.plan_key === "standard");
    const premRow = livePricing.find((p) => p.plan_key === "premium");

    return {
      free: {
        monthly: freeRow?.monthly_price ?? 0,
        yearly: freeRow?.yearly_price ?? 0,
      },
      standard: {
        monthly: stdRow?.monthly_price ?? 4.99,
        yearly: stdRow?.yearly_price ?? 49.9,
      },
      premium: {
        monthly: premRow?.monthly_price ?? 9.99,
        yearly: premRow?.yearly_price ?? 99.9,
      },
    };
  }, [livePricing]);

  const activeCycleDisplay = useMemo(() => {
    if (activeSub?.source === "admin_manual" || activeSub?.payment_method === "Admin Manual Assignment" || activeSub?.payment_method?.toLowerCase()?.includes("admin")) {
      return "ADMIN ASSIGNED";
    }
    if (currentPlanNormalized === "lifetime" || activeSub?.cycle === "lifetime") {
      return "LIFETIME";
    }
    if (activeSub?.cycle === "yearly") {
      return "ANNUAL";
    }
    if (activeSub?.cycle === "monthly") {
      return "MONTHLY";
    }
    if (currentPlanNormalized === "free") {
      return "FREE TIER";
    }
    return "ACTIVE";
  }, [activeSub, currentPlanNormalized]);

  const currentRenewalRate = useMemo(() => {
    if (currentPlanNormalized === "free") return 0;
    if (currentPlanNormalized === "lifetime" || activeSub?.cycle === "lifetime") return 0;
    if (activeSub?.source === "admin_manual" || activeSub?.payment_method === "Admin Manual Assignment" || activeSub?.payment_method?.toLowerCase()?.includes("admin")) {
      return 0;
    }
    const effCycle = activeSub?.cycle || "monthly";
    if (currentPlanNormalized === "standard") {
      return effCycle === "yearly" ? planPricing.standard.yearly : planPricing.standard.monthly;
    }
    if (currentPlanNormalized === "premium") {
      return effCycle === "yearly" ? planPricing.premium.yearly : planPricing.premium.monthly;
    }
    return 0;
  }, [currentPlanNormalized, activeSub, planPricing]);

  const nextAuditDate = useMemo(() => {
    if (activeSub?.next_billing_date) {
      const d = new Date(activeSub.next_billing_date);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
    }
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
  }, [activeSub]);

  const isAdminManualPlan = useMemo(() => {
    return (
      activeSub?.source === "admin_manual" ||
      activeSub?.payment_method === "Admin Manual Assignment" ||
      activeSub?.payment_method === null ||
      activeSub?.payment_method?.toLowerCase()?.includes("admin") ||
      activeSub?.payment_method?.toLowerCase()?.includes("manual")
    );
  }, [activeSub]);

  const daysRemaining = useMemo(() => {
    if (!activeSub?.next_billing_date || currentPlanNormalized === "free" || currentPlanNormalized === "lifetime" || activeSub?.cycle === "lifetime") {
      return 999;
    }
    const diff = new Date(activeSub.next_billing_date).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [activeSub, currentPlanNormalized]);

  const isNearExpiry = daysRemaining <= 7 && daysRemaining >= -30;
  const isPlanExpired = daysRemaining <= 0;

  // Auto-dispatch renewal reminder email & notification when plan is near expiry (once per session)
  useEffect(() => {
    if (isNearExpiry && userId && email && !autoRenewalReminderSentRef.current) {
      autoRenewalReminderSentRef.current = true;
      fetch("/api/user/subscription/send-renewal-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email,
          plan: currentPlanNormalized,
          daysRemaining: Math.max(0, daysRemaining),
          nextBillingDate: activeSub?.next_billing_date || null,
        }),
      }).catch(() => {});
    }
  }, [isNearExpiry, userId, email, currentPlanNormalized, daysRemaining, activeSub]);

  // PDF Generator for Invoices
  const handleDownloadInvoice = (inv: InvoiceRecord) => {
    try {
      const doc = new jsPDF();
      const appName = settings?.app_name || "GeFlow";

      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(appName, 20, 24);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Official Tax Invoice & Audit Receipt", 20, 30);

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("INVOICE", 190, 24, { align: "right" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`#${inv.invoice_number}`, 190, 30, { align: "right" });
      doc.text(`Date: ${inv.issue_date}`, 190, 36, { align: "right" });

      doc.setDrawColor(220, 220, 230);
      doc.line(20, 44, 190, 44);

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("BILL TO:", 20, 54);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(inv.client_name, 20, 60);
      doc.text(inv.billing_email, 20, 66);

      doc.setFont("helvetica", "bold");
      doc.text("PAYMENT METHOD:", 190, 54, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.text(inv.payment_method, 190, 60, { align: "right" });

      // Table Box
      doc.setFillColor(245, 247, 250);
      doc.rect(20, 78, 170, 10, "F");

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("TIER DESCRIPTION", 25, 84);
      doc.text("CYCLE", 120, 84);
      doc.text("AMOUNT", 185, 84, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`GeFlow ${inv.plan} Subscription Tier`, 25, 96);
      doc.text("Recurring Period", 120, 96);
      doc.text(`$${inv.amount.toFixed(2)}`, 185, 96, { align: "right" });

      doc.line(20, 104, 190, 104);

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL PAID:", 120, 114);
      doc.text(`$${inv.amount.toFixed(2)}`, 185, 114, { align: "right" });

      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.text(
        "Thank you for choosing GeFlow. This receipt verifies active architectural authorization and encryption rights.",
        20,
        140
      );

      doc.save(`${inv.invoice_number}.pdf`);
      toast({
        title: "Invoice Downloaded",
        description: `Receipt ${inv.invoice_number} saved as PDF.`,
      });
    } catch (err) {
      toast({
        title: "Download Failed",
        description: "Could not generate invoice PDF.",
        variant: "destructive",
      });
    }
  };

  // Upgrade price computations
  const rawUpgradePrice = useMemo(() => {
    if (selectedPlanKey === "free") return 0;
    if (selectedCycleForUpgrade === "lifetime") {
      return priceOf(selectedPlanKey, "lifetime", selectedPlanKey === "standard" ? 199.99 : 349.99);
    }
    if (selectedPlanKey === "standard") {
      return selectedCycleForUpgrade === "yearly"
        ? planPricing.standard.yearly
        : planPricing.standard.monthly;
    }
    return selectedCycleForUpgrade === "yearly"
      ? planPricing.premium.yearly
      : planPricing.premium.monthly;
  }, [selectedPlanKey, selectedCycleForUpgrade, planPricing, priceOf]);

  const calculatedDiscountAmount = useMemo(() => {
    if (!couponApplied || !appliedCouponData) return 0;
    if (appliedCouponData.discountType === "percent") {
      return +((rawUpgradePrice * appliedCouponData.discountValue) / 100).toFixed(2);
    }
    return Math.min(rawUpgradePrice, appliedCouponData.amount);
  }, [couponApplied, appliedCouponData, rawUpgradePrice]);

  const finalUpgradePrice = useMemo(() => {
    return Math.max(0, +(rawUpgradePrice - calculatedDiscountAmount).toFixed(2));
  }, [rawUpgradePrice, calculatedDiscountAmount]);

  // Apply Coupon
  const handleApplyCoupon = async (overrideCode?: string, overridePlan?: string) => {
    const raw = overrideCode !== undefined ? overrideCode : couponCode;
    const codeClean = raw.trim().toUpperCase();
    if (!codeClean) return;
    setCouponCode(codeClean);
    setValidatingCoupon(true);
    try {
      const planToValidate = overridePlan || selectedPlanKey;
      const priceToValidate =
        planToValidate === "free"
          ? 0
          : planToValidate === "standard"
          ? selectedCycleForUpgrade === "yearly"
            ? planPricing.standard.yearly
            : planPricing.standard.monthly
          : selectedCycleForUpgrade === "yearly"
          ? planPricing.premium.yearly
          : planPricing.premium.monthly;

      const res = await validateCoupon(codeClean, planToValidate, priceToValidate, selectedCycleForUpgrade);
      if (res.valid) {
        setCouponDiscount(res.discountType === "percent" ? res.discountValue : 0);
        setCouponApplied(true);
        setAppliedCouponData({
          code: res.code,
          label: res.label,
          amount: res.amount,
          discountType: res.discountType,
          discountValue: res.discountValue,
          isAnnouncementPromo: res.isAnnouncementPromo,
        });
        toast({
          title: res.isAnnouncementPromo ? "Announcement Promo Applied!" : "Coupon Applied!",
          description: `${res.label} discount applied.`,
        });
        clearPendingCoupon();
      } else {
        setCouponApplied(false);
        setAppliedCouponData(null);
        setCouponDiscount(0);
        toast({
          title: "Invalid Coupon Code",
          description: res.reason || "The coupon code provided is invalid or expired.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Verification Error",
        description: "Could not verify coupon.",
        variant: "destructive",
      });
    } finally {
      setValidatingCoupon(false);
    }
  };

  // Re-validate applied coupon whenever selected plan or cycle changes
  useEffect(() => {
    if (!appliedCouponData?.code) return;
    let isMounted = true;
    (async () => {
      const priceToValidate =
        selectedPlanKey === "free"
          ? 0
          : selectedPlanKey === "standard"
          ? selectedCycleForUpgrade === "yearly"
            ? planPricing.standard.yearly
            : planPricing.standard.monthly
          : selectedCycleForUpgrade === "yearly"
          ? planPricing.premium.yearly
          : planPricing.premium.monthly;

      const res = await validateCoupon(appliedCouponData.code, selectedPlanKey, priceToValidate, selectedCycleForUpgrade);
      if (!isMounted) return;
      if (!res.valid) {
        setCouponApplied(false);
        setAppliedCouponData(null);
        setCouponDiscount(0);
        toast({
          title: "Coupon Not Valid For Selected Plan",
          description: res.reason || `Coupon ${appliedCouponData.code} is not applicable to the ${selectedPlanKey} plan.`,
          variant: "destructive",
        });
      } else {
        setCouponDiscount(res.discountType === "percent" ? res.discountValue : 0);
        setAppliedCouponData((prev) => prev ? { ...prev, amount: res.amount } : null);
      }
    })();
    return () => { isMounted = false; };
  }, [selectedPlanKey, selectedCycleForUpgrade, planPricing, toast]);

  // Open Upgrade Modal
  const openUpgradeModal = (planKey: string) => {
    setSelectedPlanKey(planKey);
    setSelectedCycleForUpgrade(billingCycle);
    setUpgradeModalOpen(true);

    if (!couponApplied) {
      const urlCoupon = searchParams.get("coupon") || searchParams.get("code") || searchParams.get("promo");
      const pending = getPendingCoupon();
      const target = (urlCoupon || pending || "").trim().toUpperCase();
      if (target) {
        setCouponCode(target);
        setTimeout(() => {
          handleApplyCoupon(target, planKey);
        }, 50);
      }
    }
  };

  // Check URL parameters on mount
  useEffect(() => {
    const urlPlan = searchParams.get("plan");
    const urlCoupon = searchParams.get("coupon") || searchParams.get("code") || searchParams.get("promo");
    const pendingCoupon = getPendingCoupon();

    if (urlPlan && (urlPlan === "standard" || urlPlan === "premium")) {
      openUpgradeModal(urlPlan);
    } else if (urlCoupon || pendingCoupon) {
      const target = (urlCoupon || pendingCoupon || "").trim().toUpperCase();
      if (target) {
        setCouponCode(target);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Execute Upgrade
  const handleConfirmUpgrade = async () => {
    setUpgradeBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No active session found.");

      const rawPrice = rawUpgradePrice;
      const finalPrice = finalUpgradePrice;

      // 1. Update Profile Plan
      await supabase
        .from("profiles")
        .update({
          plan: selectedPlanKey,
        })
        .eq("user_id", user.id);

      // 2. Insert into subscriptions table
      const nextDate = new Date();
      if (selectedCycleForUpgrade === "lifetime") {
        nextDate.setFullYear(nextDate.getFullYear() + 100);
      } else if (selectedCycleForUpgrade === "yearly") {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      } else {
        nextDate.setDate(nextDate.getDate() + 30);
      }

      await supabase.from("subscriptions").insert({
        owner_user_id: user.id,
        business_id: activeBusiness?.id || null,
        tier: selectedPlanKey,
        cycle: selectedCycleForUpgrade,
        status: "active",
        amount: finalPrice,
        next_billing_date: selectedCycleForUpgrade === "lifetime" ? null : nextDate.toISOString(),
      });

      // 3. Generate new official invoice
      const newInvNumber = `INV-${Math.floor(10000 + Math.random() * 90000)}`;
      const newInv: InvoiceRecord = {
        id: `inv-${Date.now()}`,
        invoice_number: newInvNumber,
        client_name: fullName || user.email?.split("@")[0] || "Workspace Owner",
        billing_email: user.email || "owner@geflowai.com",
        plan: selectedPlanKey.toUpperCase(),
        payment_method: paymentCard ? `${paymentCard.brand} •••• ${paymentCard.last4}` : "Authorized Billing Card",
        amount: finalPrice,
        status: "paid",
        issue_date: new Date().toISOString().slice(0, 10),
      };

      await supabase.from("invoices").insert({
        invoice_number: newInvNumber,
        client_name: newInv.client_name,
        billing_email: newInv.billing_email,
        plan: newInv.plan,
        payment_method: newInv.payment_method,
        amount: newInv.amount,
        status: "paid",
        issue_date: newInv.issue_date,
        owner_user_id: user.id,
        business_id: activeBusiness?.id || null,
      });

      setInvoices((prev) => [newInv, ...prev]);

      toast({
        title: "Tier Activated Successfully!",
        description: `You are now authorized on the ${selectedPlanKey.toUpperCase()} tier.`,
      });

      setUpgradeModalOpen(false);
      await loadSubscriptionData();
    } catch (err: any) {
      toast({
        title: "Upgrade Failed",
        description: err?.message || "Could not complete transaction.",
        variant: "destructive",
      });
    } finally {
      setUpgradeBusy(false);
    }
  };

  // Save or Update Real Payment Method (Card or PayPal - Synced with Backend & Checkout)
  const handleSavePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      toast({ title: "Authentication Required", description: "Please sign in to link a payment method.", variant: "destructive" });
      return;
    }

    setSavingCard(true);
    try {
      if (paymentMethodType === "card") {
        if (!cardName.trim()) {
          toast({ title: "Cardholder Name Required", description: "Please enter the full name on the card.", variant: "destructive" });
          setSavingCard(false);
          return;
        }
        const cleanDigits = cardNumber.replace(/\D/g, "");
        if (cleanDigits.length < 13) {
          toast({ title: "Invalid Card Number", description: "Please enter a valid card number with at least 13 digits.", variant: "destructive" });
          setSavingCard(false);
          return;
        }
        const parts = cardExp.split("/");
        const mm = parts[0]?.trim() || "12";
        const rawYy = parts[1]?.trim() || "28";
        const yy = rawYy.length === 2 ? `20${rawYy}` : rawYy;

        const res = await fetch("/api/user/subscription/payment-method", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            type: "card",
            card: {
              cardNumber: cleanDigits,
              brand: detectCardBrand(cleanDigits),
              last4: cleanDigits.slice(-4),
              expMonth: mm,
              expYear: yy,
              holderName: cardName.trim(),
              zip: cardZip.trim(),
            },
            source: "user_manual",
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to save card payment method");
        }
        setPaymentCard({
          id: json.paymentMethod?.id,
          type: "card",
          brand: json.paymentMethod?.card?.brand || "Card",
          last4: json.paymentMethod?.card?.last4,
          expMonth: json.paymentMethod?.card?.expMonth,
          expYear: json.paymentMethod?.card?.expYear,
          holderName: json.paymentMethod?.card?.holderName,
          source: "user_manual",
        });
        toast({
          title: "Payment Card Linked Successfully",
          description: `${json.paymentMethod?.card?.brand || "Card"} ending in •••• ${json.paymentMethod?.card?.last4} is now your active billing method.`,
        });
      } else {
        // PayPal
        if (!paypalEmailInput.trim() || !paypalEmailInput.includes("@")) {
          toast({ title: "Valid PayPal Email Required", description: "Please enter your verified PayPal account email.", variant: "destructive" });
          setSavingCard(false);
          return;
        }
        const res = await fetch("/api/user/subscription/payment-method", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            type: "paypal",
            paypal: {
              email: paypalEmailInput.trim(),
            },
            source: "user_manual",
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to link PayPal account");
        }
        setPaymentCard({
          id: json.paymentMethod?.id,
          type: "paypal",
          paypalEmail: json.paymentMethod?.paypal?.email,
          source: "user_manual",
        });
        toast({
          title: "PayPal Account Linked Successfully",
          description: `PayPal (${json.paymentMethod?.paypal?.email}) authorized for automatic renewals.`,
        });
      }
      setCardModalOpen(false);
      await loadSubscriptionData();
    } catch (err: any) {
      toast({
        title: "Could Not Save Payment Method",
        description: err.message || "Please check your inputs and try again.",
        variant: "destructive",
      });
    } finally {
      setSavingCard(false);
    }
  };

  // Remove Payment Method
  const handleRemovePaymentMethod = async () => {
    if (!userId) return;
    setRemovingPaymentMethod(true);
    try {
      const res = await fetch(`/api/user/subscription/payment-method?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to remove payment method");
      }
      setPaymentCard(null);
      toast({
        title: "Payment Method Removed",
        description: "Your payment method has been detached from your subscription.",
      });
      await loadSubscriptionData();
    } catch (err: any) {
      toast({
        title: "Remove Failed",
        description: err.message || "Could not remove payment method.",
        variant: "destructive",
      });
    } finally {
      setRemovingPaymentMethod(false);
    }
  };

  // Dispatch Manual Renewal Reminder Email & Notification
  const handleSendRenewalReminder = async () => {
    if (!userId) return;
    setReminderSending(true);
    try {
      const res = await fetch("/api/user/subscription/send-renewal-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email: email || "",
          plan: currentPlanNormalized,
          daysRemaining: Math.max(0, daysRemaining),
          nextBillingDate: activeSub?.next_billing_date || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setReminderSent(true);
        toast({
          title: "Renewal Reminder Dispatched",
          description: `A renewal notice with instructions was dispatched to ${email || "your inbox"}.`,
        });
      }
    } catch (e: any) {
      toast({ title: "Reminder Notice", description: e.message || "Notification recorded." });
    } finally {
      setReminderSending(false);
    }
  };

  // Manage Subscription Submit
  const handleSaveManage = () => {
    setSavingManage(true);
    setTimeout(() => {
      setSavingManage(false);
      setManageModalOpen(false);
      toast({
        title: "Subscription Settings Updated",
        description: autoRenew
          ? "Automatic renewal active for next billing cycle."
          : "Auto-renew disabled. Tier will remain active until end of period.",
      });
    }, 400);
  };

  // Cancel subscription
  const handleCancelSub = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("profiles")
        .update({ plan: "free" })
        .eq("user_id", user.id);

      toast({
        title: "Subscription Cancelled",
        description: "Your workspace has reverted to the Free tier.",
      });
      setManageModalOpen(false);
      await loadSubscriptionData();
    } catch {
      toast({
        title: "Action Failed",
        description: "Could not cancel subscription.",
        variant: "destructive",
      });
    }
  };

  return (
    <UserPanelGate pageTitle="Subscription" module="subscription">
      <div className="w-full space-y-10 min-w-0 pb-16">
        {/* ========================================================================= */}
        {/* EXPIRY & RENEWAL NOTIFICATION SYSTEM (AUTO-SYNCED)                        */}
        {/* ========================================================================= */}
        {!expiryNotificationDismissed && (isNearExpiry || (isAdminManualPlan && !paymentCard && currentPlanNormalized !== "free")) && (
          <div className={`p-4 sm:p-5 rounded-2xl text-xs flex flex-col md:flex-row md:items-center justify-between gap-4 border shadow-xs ${
            !paymentCard
              ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
              : "bg-sky-500/10 border-sky-500/30 text-sky-950 dark:text-sky-200"
          }`}>
            <div className="flex items-start sm:items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-bold ${
                !paymentCard
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "bg-sky-500 text-slate-950 shadow-sm"
              }`}>
                {!paymentCard ? <ShieldAlert className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-foreground text-sm">
                    {isAdminManualPlan && !paymentCard
                      ? "Plan Assigned by Admin — Payment Method Required for Renewal"
                      : isPlanExpired
                      ? "Subscription Billing Cycle Due Today"
                      : "Subscription Renewal Notice"}
                  </span>
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                    !paymentCard
                      ? "bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                      : "bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-500/30"
                  }`}>
                    {daysRemaining <= 0 ? "RENEWAL DUE" : `${daysRemaining} DAYS REMAINING`}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {isAdminManualPlan && !paymentCard ? (
                    <>
                      Your <strong className="text-foreground capitalize">{currentPlanNormalized} Plan</strong> was manually activated by an administrator. Because no billing method is on file, please link your personal <strong>Credit/Debit Card</strong> or <strong>PayPal</strong> before <strong className="text-foreground">{nextAuditDate}</strong> so your workspace never loses access.
                    </>
                  ) : (
                    <>
                      Your <strong className="text-foreground capitalize">{currentPlanNormalized} Plan</strong> billing cycle renews on <strong className="text-foreground">{nextAuditDate}</strong>. Auto-renew is currently <span className={autoRenew ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>{autoRenew ? "ENABLED" : "PAUSED"}</span>.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {!paymentCard ? (
                <Button
                  size="sm"
                  onClick={() => setCardModalOpen(true)}
                  className="h-9 px-3.5 text-xs font-extrabold rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Add Payment Method
                </Button>
              ) : null}

              <Button
                size="sm"
                variant="outline"
                onClick={handleSendRenewalReminder}
                disabled={reminderSending}
                className="h-9 px-3 text-xs font-bold rounded-xl border-border/80 hover:bg-muted gap-1.5"
                title="Send a renewal reminder email and notification to your account"
              >
                {reminderSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : reminderSent ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span>{reminderSent ? "Sent to Inbox" : "Send Email Reminder"}</span>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpiryNotificationDismissed(true)}
                className="h-9 px-2 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TOP ACTIVE SUBSCRIPTION BANNER CARD                                       */}
        {/* ========================================================================= */}
        <div className="p-6 sm:p-8 rounded-3xl bg-card border border-border/80 shadow-xs relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left Side: Plan Info & Limits */}
            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 dark:bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0 border border-purple-500/20">
                  <Crown className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground capitalize">
                      {currentPlanNormalized} Plan
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-muted text-muted-foreground border border-border">
                      CYCLE: {activeCycleDisplay}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
                You are currently on the{" "}
                <span className="font-bold text-foreground capitalize">{currentPlanNormalized} Plan</span>. Your
                architectural limits allow for{" "}
                <span className="font-semibold text-foreground">
                  {currentPlanNormalized === "premium" || currentPlanNormalized === "lifetime"
                    ? "Unlimited SKUs, multi-branch synchronization, and automated AI financial forecasting."
                    : currentPlanNormalized === "standard"
                    ? "1,000 SKUs, full POS & returns, and supplier intelligence."
                    : "100 SKUs and standard core POS terminal access."}
                </span>
              </p>

              {/* Auto-Renew Switch Bar & Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Button
                  onClick={() => openUpgradeModal("premium")}
                  className="h-11 px-5 rounded-2xl text-xs font-extrabold uppercase tracking-wider bg-sky-400 hover:bg-sky-500 text-slate-950 shadow-md shadow-sky-400/20 border-0 flex items-center gap-1.5 transition-all active:scale-[0.98]"
                >
                  <ArrowUpRight className="w-4 h-4 stroke-[2.5]" /> Upgrade Plan
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setManageModalOpen(true)}
                  className="h-11 px-5 rounded-2xl text-xs font-bold text-foreground border-border/80 hover:bg-muted/60 transition-colors"
                >
                  Manage Subscription
                </Button>

                {/* Direct Auto-Renew Toggle */}
                <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-muted/40 border border-border">
                  <Switch
                    id="auto-renew-banner-toggle"
                    checked={autoRenew}
                    onCheckedChange={handleToggleAutoRenew}
                  />
                  <Label htmlFor="auto-renew-banner-toggle" className="text-xs font-bold cursor-pointer">
                    Auto-Renew {autoRenew ? <span className="text-emerald-500">(On)</span> : <span className="text-muted-foreground">(Off)</span>}
                  </Label>
                </div>
              </div>
            </div>

            {/* Right Side: Status Badge & Rate Box */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-4 shrink-0">
              {/* Status Pill */}
              <div className="text-left sm:text-right lg:text-right">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  STATUS: ACTIVE
                </span>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mt-1">
                  {currentPlanNormalized === "lifetime" || activeSub?.cycle === "lifetime"
                    ? "PERPETUAL VIP ACCESS"
                    : `NEXT AUDIT: ${nextAuditDate}`}
                </p>
              </div>

              {/* Renewal Rate Metric Box */}
              <div className="w-full sm:w-48 p-4 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70 text-left sm:text-right lg:text-right">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                  RENEWAL RATE
                </p>
                <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mt-0.5">
                  ${currentRenewalRate.toFixed(2)}
                </p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 mt-0.5">
                  {currentPlanNormalized === "lifetime" || activeSub?.cycle === "lifetime"
                    ? "LIFETIME ACCESS — NO RENEWAL"
                    : activeSub?.source === "admin_manual" || activeSub?.payment_method?.toLowerCase()?.includes("admin")
                    ? "ADMIN ASSIGNED — NO AUTO-CHARGE"
                    : activeSub?.cycle === "yearly"
                    ? "BILLED ANNUALLY"
                    : "NEXT AUTOMATIC CHARGE"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION: EXPAND YOUR CAPABILITIES (PRICING TIERS)                         */}
        {/* ========================================================================= */}
        <div className="space-y-6">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Expand Your Capabilities
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Select a new architectural tier to unlock advanced intelligence.
            </p>

            {/* Monthly / Yearly / Lifetime Toggle */}
            <div className="pt-3">
              <div className="inline-flex p-1 rounded-2xl bg-muted/70 dark:bg-muted/40 border border-border/80">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-4 sm:px-5 py-2 rounded-xl text-xs font-extrabold tracking-wider transition-all ${
                    billingCycle === "monthly"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  MONTHLY
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("yearly")}
                  className={`px-4 sm:px-5 py-2 rounded-xl text-xs font-extrabold tracking-wider transition-all flex items-center gap-1.5 ${
                    billingCycle === "yearly"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  YEARLY
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-500">
                    SAVE 20%
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("lifetime")}
                  className={`px-4 sm:px-5 py-2 rounded-xl text-xs font-extrabold tracking-wider transition-all flex items-center gap-1.5 ${
                    billingCycle === "lifetime"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  LIFETIME
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500/15 text-amber-500">
                    DEAL
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* 3 ARCHITECTURAL PLAN CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {/* 1. FREE PLAN */}
            <div
              className={`p-6 sm:p-7 rounded-3xl bg-card border flex flex-col justify-between transition-all ${
                currentPlanNormalized === "free"
                  ? "border-sky-500/60 ring-2 ring-sky-500/20 shadow-md"
                  : "border-border/80 hover:border-border"
              }`}
            >
              <div className="space-y-5">
                <div className="w-12 h-12 rounded-2xl bg-slate-500/10 text-slate-500 flex items-center justify-center border border-slate-500/20">
                  <Box className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">Free Plan</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Perfect for testing the architectural core.
                  </p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black text-foreground">$0</span>
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    {billingCycle === "lifetime" ? "FREE FOREVER" : billingCycle === "yearly" ? "/ YR" : "/ MO"}
                  </span>
                </div>

                {/* Features */}
                <div className="space-y-3 pt-2 border-t border-border/60 text-xs">
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <div className="w-4 h-4 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>100 items limit</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <div className="w-4 h-4 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>Basic POS</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <div className="w-4 h-4 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>Basic Reports</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <div className="w-4 h-4 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>Single user</span>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <Button
                  disabled={currentPlanNormalized === "free"}
                  onClick={() => openUpgradeModal("free")}
                  variant={currentPlanNormalized === "free" ? "outline" : "default"}
                  className={`w-full h-11 rounded-2xl text-xs font-extrabold uppercase tracking-wider ${
                    currentPlanNormalized === "free"
                      ? "border-border text-muted-foreground cursor-default"
                      : "bg-sky-400 hover:bg-sky-500 text-slate-950 shadow-md shadow-sky-400/20 border-0"
                  }`}
                >
                  {currentPlanNormalized === "free" ? "ACTIVE TIER" : "SWITCH TO FREE"}
                </Button>
              </div>
            </div>

            {/* 2. STANDARD PLAN */}
            <div
              className={`p-6 sm:p-7 rounded-3xl bg-card border flex flex-col justify-between transition-all ${
                currentPlanNormalized === "standard"
                  ? "border-sky-500/60 ring-2 ring-sky-500/20 shadow-md"
                  : "border-border/80 hover:border-border"
              }`}
            >
              <div className="space-y-5">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center border border-sky-500/20">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">Standard Plan</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    The standard for growing retail businesses.
                  </p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black text-foreground">
                    ${billingCycle === "lifetime" ? priceOf("standard", "lifetime", 199.99).toFixed(2) : billingCycle === "yearly" ? planPricing.standard.yearly.toFixed(2) : planPricing.standard.monthly.toFixed(2)}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    {billingCycle === "lifetime" ? "ONE-TIME" : billingCycle === "yearly" ? "/ YR" : "/ MO"}
                  </span>
                </div>

                {/* Features */}
                <div className="space-y-3 pt-2 border-t border-border/60 text-xs">
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <div className="w-4 h-4 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>1,000 items limit</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <div className="w-4 h-4 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>Full POS &amp; Returns</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <div className="w-4 h-4 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>Multi-user support</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <div className="w-4 h-4 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>Supplier Portal</span>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <Button
                  disabled={
                    currentPlanNormalized === "lifetime" ||
                    (currentPlanNormalized === "standard" && (billingCycle !== "lifetime" || activeSub?.cycle === "lifetime"))
                  }
                  onClick={() => openUpgradeModal("standard")}
                  className={`w-full h-11 rounded-2xl text-xs font-extrabold uppercase tracking-wider ${
                    currentPlanNormalized === "lifetime" ||
                    (currentPlanNormalized === "standard" && (billingCycle !== "lifetime" || activeSub?.cycle === "lifetime"))
                      ? "border-border bg-muted/60 text-muted-foreground cursor-default"
                      : "bg-sky-400 hover:bg-sky-500 text-slate-950 shadow-md shadow-sky-400/20 border-0 flex items-center justify-center gap-1.5"
                  }`}
                >
                  {currentPlanNormalized === "lifetime" ? (
                    "LIFETIME VIP ACTIVE"
                  ) : currentPlanNormalized === "standard" && (billingCycle !== "lifetime" || activeSub?.cycle === "lifetime") ? (
                    "ACTIVE TIER"
                  ) : (
                    <>
                      {billingCycle === "lifetime" ? ctaTextOf("standard", "UNLOCK LIFETIME", "lifetime") : "UPGRADE NOW"} <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* 3. PREMIUM PLAN */}
            <div
              className={`p-6 sm:p-7 rounded-3xl bg-card border flex flex-col justify-between transition-all ${
                currentPlanNormalized === "premium"
                  ? "border-purple-500/60 ring-2 ring-purple-500/20 shadow-md"
                  : "border-border/80 hover:border-border"
              }`}
            >
              <div className="space-y-5">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">Premium Plan</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total business intelligence &amp; AI automation.
                  </p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black text-foreground">
                    ${billingCycle === "lifetime" ? priceOf("premium", "lifetime", 349.99).toFixed(2) : billingCycle === "yearly" ? planPricing.premium.yearly.toFixed(2) : planPricing.premium.monthly.toFixed(2)}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    {billingCycle === "lifetime" ? "ONE-TIME" : billingCycle === "yearly" ? "/ YR" : "/ MO"}
                  </span>
                </div>

                {/* Features */}
                <div className="space-y-3 pt-2 border-t border-border/60 text-xs">
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <div className="w-4 h-4 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>Unlimited items</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <div className="w-4 h-4 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>Multi-branch sync</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <div className="w-4 h-4 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>AI Insights</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <div className="w-4 h-4 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>Expiry Tracking</span>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <Button
                  disabled={currentPlanNormalized === "premium" && (billingCycle !== "lifetime" || activeSub?.cycle === "lifetime")}
                  onClick={() => openUpgradeModal("premium")}
                  className={`w-full h-11 rounded-2xl text-xs font-extrabold uppercase tracking-wider ${
                    currentPlanNormalized === "premium" && (billingCycle !== "lifetime" || activeSub?.cycle === "lifetime")
                      ? "border-border bg-muted/60 text-muted-foreground cursor-default"
                      : "bg-sky-400 hover:bg-sky-500 text-slate-950 shadow-md shadow-sky-400/20 border-0 flex items-center justify-center gap-1.5"
                  }`}
                >
                  {currentPlanNormalized === "premium" && (billingCycle !== "lifetime" || activeSub?.cycle === "lifetime") ? (
                    "ACTIVE TIER"
                  ) : (
                    <>
                      {billingCycle === "lifetime" ? ctaTextOf("premium", "UNLOCK LIFETIME", "lifetime") : "UPGRADE NOW"} <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DETAILED INFRASTRUCTURE COMPARISON TABLE                                  */}
        {/* ========================================================================= */}
        <div className="p-6 sm:p-8 rounded-3xl bg-card border border-border/80 shadow-xs overflow-hidden space-y-4">
          <div className="pb-3 border-b border-border/60">
            <h3 className="text-lg font-bold text-foreground">Infrastructure Comparison</h3>
            <p className="text-xs text-muted-foreground">
              Deep-dive matrix of architectural limitations and module allocations.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border/60 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                  <th className="py-3 px-3">INFRASTRUCTURE</th>
                  <th className="py-3 px-3">FREE</th>
                  <th className="py-3 px-3 text-sky-500 dark:text-sky-400">STANDARD</th>
                  <th className="py-3 px-3 text-purple-500 dark:text-purple-400">PREMIUM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                <tr>
                  <td className="py-3.5 px-3 font-semibold text-foreground">Inventory Management</td>
                  <td className="py-3.5 px-3 text-muted-foreground">BASIC</td>
                  <td className="py-3.5 px-3 text-foreground">ADVANCED</td>
                  <td className="py-3.5 px-3 font-bold text-purple-400">ENTERPRISE</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-3 font-semibold text-foreground">POS System</td>
                  <td className="py-3.5 px-3 text-muted-foreground">STANDARD</td>
                  <td className="py-3.5 px-3 text-foreground">STANDARD</td>
                  <td className="py-3.5 px-3 font-bold text-purple-400">HIGH-VELOCITY</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-3 font-semibold text-foreground">Purchases System</td>
                  <td className="py-3.5 px-3 text-muted-foreground">—</td>
                  <td className="py-3.5 px-3">
                    <span className="w-4 h-4 rounded-full bg-sky-500/15 text-sky-500 inline-flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="w-4 h-4 rounded-full bg-purple-500/15 text-purple-400 inline-flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 px-3 font-semibold text-foreground">Reports</td>
                  <td className="py-3.5 px-3 text-muted-foreground">BASIC (PDF)</td>
                  <td className="py-3.5 px-3 text-foreground">ADVANCED (CSV)</td>
                  <td className="py-3.5 px-3 font-bold text-purple-400">REAL-TIME INTELLIGENCE</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-3 font-semibold text-foreground">Analytics</td>
                  <td className="py-3.5 px-3 text-muted-foreground">—</td>
                  <td className="py-3.5 px-3 text-muted-foreground">—</td>
                  <td className="py-3.5 px-3">
                    <span className="w-4 h-4 rounded-full bg-purple-500/15 text-purple-400 inline-flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 px-3 font-semibold text-foreground">Team Members</td>
                  <td className="py-3.5 px-3 text-muted-foreground">1 USER</td>
                  <td className="py-3.5 px-3 text-foreground">UP TO 5</td>
                  <td className="py-3.5 px-3 font-bold text-purple-400">UNLIMITED</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-3 font-semibold text-foreground">Barcode Scanner</td>
                  <td className="py-3.5 px-3 text-muted-foreground">MANUAL</td>
                  <td className="py-3.5 px-3 text-foreground">HARDWARE SUPPORT</td>
                  <td className="py-3.5 px-3 font-bold text-purple-400">VISION + HARDWARE</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-3 font-semibold text-foreground">Expiry Tracking</td>
                  <td className="py-3.5 px-3 text-muted-foreground">—</td>
                  <td className="py-3.5 px-3 text-muted-foreground">—</td>
                  <td className="py-3.5 px-3">
                    <span className="w-4 h-4 rounded-full bg-purple-500/15 text-purple-400 inline-flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 px-3 font-semibold text-foreground">Priority Support</td>
                  <td className="py-3.5 px-3 text-muted-foreground">—</td>
                  <td className="py-3.5 px-3 text-foreground">EMAIL</td>
                  <td className="py-3.5 px-3 font-bold text-purple-400">24/7 DEDICATED</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BOTTOM 2-COLUMN GRID (AUTHORIZED GATEWAY + RECENT AUDIT HISTORY)          */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LEFT: AUTHORIZED GATEWAY */}
          <div className="p-6 sm:p-7 rounded-3xl bg-card border border-border/80 shadow-xs flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-5 h-5 text-sky-500" />
                <h3 className="text-base font-bold text-foreground">Authorized Gateway</h3>
              </div>

              {/* Case 1: Plan Assigned Manually by Admin and User hasn't added their payment method yet */}
              {isAdminManualPlan && !paymentCard && currentPlanNormalized !== "free" ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                      <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold text-foreground">Admin Manual Plan Assignment</p>
                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          NO PAYMENT METHOD
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        This plan was assigned manually by the admin. Please add your personal payment method (Card or PayPal) to enable renewals.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setCardModalOpen(true)}
                    className="h-8 px-3.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs shrink-0 gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Payment Method
                  </Button>
                </div>
              ) : paymentCard ? (
                /* Case 2: Real User-Added Payment Method (Card or PayPal) */
                <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0 border border-sky-500/20 font-bold">
                      {paymentCard.type === "paypal" ? (
                        <Wallet className="w-5 h-5 text-sky-500" />
                      ) : (
                        <CreditCard className="w-5 h-5 text-sky-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-extrabold text-foreground tracking-wide">
                          {paymentCard.type === "paypal"
                            ? "PayPal Account"
                            : `${paymentCard.brand || "Card"} •••• ${paymentCard.last4}`}
                        </p>
                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                          USER VERIFIED METHOD
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {paymentCard.type === "paypal"
                          ? `Account Email: ${paymentCard.paypalEmail || email}`
                          : `Expires: ${paymentCard.expMonth}/${paymentCard.expYear} • Cardholder: ${paymentCard.holderName || "Workspace Owner"}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCardModalOpen(true)}
                      className="h-8 px-3 rounded-xl text-[11px] font-bold border-border/80 hover:bg-muted"
                    >
                      Update
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemovePaymentMethod}
                      disabled={removingPaymentMethod}
                      className="h-8 px-2 rounded-xl text-[11px] font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                      title="Detach payment method"
                    >
                      {removingPaymentMethod ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              ) : currentPlanNormalized === "free" ? (
                /* Case 3: Free Tier with no method */
                <div className="p-4 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                      <Box className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Free Tier • No Payment Method Required</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Link a personal card or PayPal anytime for instant upgrades</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCardModalOpen(true)}
                    className="h-8 px-3 rounded-xl text-[10px] font-bold border-border/80 hover:bg-muted gap-1"
                  >
                    <Plus className="w-3 h-3" /> ADD METHOD
                  </Button>
                </div>
              ) : (
                /* Case 4: No payment method on file */
                <div className="p-4 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">No payment method on file</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Add a Credit/Debit Card or PayPal to authorize automatic renewals</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCardModalOpen(true)}
                    className="h-8 px-3 rounded-xl text-[10px] font-bold border-border/80 hover:bg-muted gap-1"
                  >
                    <Plus className="w-3 h-3" /> ADD METHOD
                  </Button>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              onClick={() => setCardModalOpen(true)}
              className="w-full h-11 rounded-2xl border-dashed border-border/80 hover:border-sky-500/60 hover:bg-sky-500/5 text-xs font-bold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> {paymentCard ? "LINK OR REPLACE PAYMENT METHOD" : "ADD PERSONAL PAYMENT METHOD"}
            </Button>
          </div>

          {/* RIGHT: RECENT AUDIT HISTORY (INVOICES) */}
          <div className="p-6 sm:p-7 rounded-3xl bg-card border border-border/80 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <h3 className="text-base font-bold text-foreground">Recent Audit History</h3>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  {invoices.length} RECEIPTS
                </span>
              </div>

              {/* Invoices List */}
              <div className="space-y-2.5 divide-y divide-border/30 max-h-56 overflow-y-auto pr-1">
                {loadingInvoices ? (
                  <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-500" /> Loading receipts...
                  </div>
                ) : invoices.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">No invoices on record.</p>
                ) : (
                  invoices.slice(0, 3).map((inv) => (
                    <div key={inv.id} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">{inv.invoice_number}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">
                            {new Date(inv.issue_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "2-digit",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-extrabold text-foreground">${inv.amount.toFixed(2)}</p>
                          <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            {inv.status}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoice(inv)}
                          title="Download PDF"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* UPGRADE / CHECKOUT CONFIRMATION MODAL                                     */}
      {/* ========================================================================= */}
      <Dialog open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen}>
        <DialogContent className="max-w-md p-6 sm:p-7 rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-sky-400/15 text-sky-500 flex items-center justify-center shrink-0">
                <Crown className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground capitalize">
                  Activate {selectedPlanKey} Tier
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Confirm architectural authorization and billing parameters.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-3 text-xs">
            {/* Cycle Selector */}
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1.5">
                BILLING FREQUENCY
              </label>
              <div className={`grid ${selectedPlanKey === "free" ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3"} gap-2`}>
                <button
                  type="button"
                  onClick={() => setSelectedCycleForUpgrade("monthly")}
                  className={`p-2.5 sm:p-3 rounded-2xl border text-left transition-all ${
                    selectedCycleForUpgrade === "monthly"
                      ? "border-sky-500 bg-sky-500/5 text-foreground font-bold"
                      : "border-border/80 text-muted-foreground hover:border-border"
                  }`}
                >
                  <p className="text-xs">Monthly</p>
                  <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                    $
                    {selectedPlanKey === "premium"
                      ? planPricing.premium.monthly
                      : selectedPlanKey === "standard"
                      ? planPricing.standard.monthly
                      : 0}
                    /mo
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCycleForUpgrade("yearly")}
                  className={`p-2.5 sm:p-3 rounded-2xl border text-left transition-all ${
                    selectedCycleForUpgrade === "yearly"
                      ? "border-sky-500 bg-sky-500/5 text-foreground font-bold"
                      : "border-border/80 text-muted-foreground hover:border-border"
                  }`}
                >
                  <p className="text-xs flex items-center justify-between">
                    <span>Yearly</span>
                    <span className="text-[9px] font-black text-emerald-500">-20%</span>
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                    $
                    {selectedPlanKey === "premium"
                      ? planPricing.premium.yearly
                      : selectedPlanKey === "standard"
                      ? planPricing.standard.yearly
                      : 0}
                    /yr
                  </p>
                </button>

                {selectedPlanKey !== "free" && (
                  <button
                    type="button"
                    onClick={() => setSelectedCycleForUpgrade("lifetime")}
                    className={`p-2.5 sm:p-3 rounded-2xl border text-left transition-all ${
                      selectedCycleForUpgrade === "lifetime"
                        ? "border-amber-500 bg-amber-500/5 text-foreground font-bold"
                        : "border-border/80 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <p className="text-xs flex items-center justify-between">
                      <span>Lifetime</span>
                      <span className="text-[9px] font-black text-amber-500">DEAL</span>
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                      ${priceOf(selectedPlanKey, "lifetime", selectedPlanKey === "standard" ? 199.99 : 349.99).toFixed(2)}
                    </p>
                  </button>
                )}
              </div>
            </div>

            {/* Coupon Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                  PROMOTIONAL COUPON
                </label>
                {couponApplied && (
                  <button
                    type="button"
                    onClick={() => {
                      setCouponApplied(false);
                      setAppliedCouponData(null);
                      setCouponDiscount(0);
                      setCouponCode("");
                    }}
                    className="text-[10px] text-muted-foreground hover:text-destructive underline cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value);
                    if (couponApplied) {
                      setCouponApplied(false);
                      setAppliedCouponData(null);
                      setCouponDiscount(0);
                    }
                  }}
                  placeholder="Enter discount code"
                  className="h-11 rounded-2xl uppercase tracking-wider text-xs font-mono font-bold"
                  disabled={couponApplied}
                />
                <Button
                  type="button"
                  onClick={() => handleApplyCoupon()}
                  disabled={validatingCoupon || couponApplied || !couponCode.trim()}
                  variant="outline"
                  className="h-11 px-4 rounded-2xl text-xs font-bold shrink-0"
                >
                  {validatingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : couponApplied ? "Applied ✓" : "Apply"}
                </Button>
              </div>
            </div>

            {/* Payment Method Preview */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {paymentCard?.type === "paypal" ? (
                  <Wallet className="w-4 h-4 text-sky-500" />
                ) : (
                  <CreditCard className="w-4 h-4 text-sky-500" />
                )}
                <span className="font-bold text-foreground text-xs">
                  {paymentCard
                    ? paymentCard.type === "paypal"
                      ? `PayPal (${paymentCard.paypalEmail})`
                      : `${paymentCard.brand || "Card"} •••• ${paymentCard.last4}`
                    : "No payment method linked yet"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUpgradeModalOpen(false);
                  setCardModalOpen(true);
                }}
                className="text-[11px] font-bold text-sky-500 hover:underline"
              >
                {paymentCard ? "Change" : "Add Method"}
              </button>
            </div>

            {/* Price Summary */}
            <div className="p-4 rounded-2xl bg-sky-500/5 border border-sky-500/20 space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>${rawUpgradePrice.toFixed(2)}</span>
              </div>
              {couponApplied && appliedCouponData && (
                <div className="flex justify-between text-emerald-500 font-bold">
                  <span>Discount ({appliedCouponData.label})</span>
                  <span>-${calculatedDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-foreground pt-1.5 border-t border-sky-500/20">
                <span>Total Due Now</span>
                <span className="text-base text-sky-400 font-black">
                  ${finalUpgradePrice.toFixed(2)}
                </span>
              </div>
            </div>

            <Button
              onClick={handleConfirmUpgrade}
              disabled={upgradeBusy}
              className="w-full h-12 rounded-2xl bg-sky-400 hover:bg-sky-500 text-slate-950 font-bold text-sm shadow-md shadow-sky-400/20 transition-all active:scale-[0.99] border-0"
            >
              {upgradeBusy ? "Authorizing Network..." : "Authorize & Activate Tier"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MANAGE SUBSCRIPTION MODAL                                                 */}
      {/* ========================================================================= */}
      <Dialog open={manageModalOpen} onOpenChange={setManageModalOpen}>
        <DialogContent className="max-w-md p-6 sm:p-7 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              Manage Subscription
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Control renewal triggers, architectural limits, and billing state.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-3 text-xs">
            {/* Auto-renew Switch */}
            <div className="p-4 rounded-2xl bg-card border border-border/80 flex items-center justify-between gap-4">
              <div>
                <p className="font-bold text-foreground">Automatic Renewal</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Automatically audit and renew tier on {nextAuditDate}.
                </p>
              </div>
              <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
            </div>

            {/* Cancel Button */}
            <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-rose-500">Decommission Tier</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Revert workspace back to the Free plan tier.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancelSub}
                className="h-8 px-3 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-600 shrink-0"
              >
                Cancel Plan
              </Button>
            </div>

            <Button
              onClick={handleSaveManage}
              disabled={savingManage}
              className="w-full h-11 rounded-2xl bg-sky-400 hover:bg-sky-500 text-slate-950 font-bold text-xs shadow-md border-0"
            >
              {savingManage ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* ADD / UPDATE PAYMENT METHOD MODAL (SYNCED WITH CHECKOUT & ADMIN GATEWAYS) */}
      {/* ========================================================================= */}
      <Dialog open={cardModalOpen} onOpenChange={setCardModalOpen}>
        <DialogContent className="max-w-md p-6 sm:p-7 rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-sky-400/15 text-sky-500 flex items-center justify-center shrink-0">
                {paymentMethodType === "paypal" ? (
                  <Wallet className="w-6 h-6 stroke-[2.2]" />
                ) : (
                  <CreditCard className="w-6 h-6 stroke-[2.2]" />
                )}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                  {paymentCard ? "Update Payment Method" : "Add Personal Payment Method"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Synchronized with platform checkout and automated renewal gateways.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Payment Method Selector Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-2xl mt-2 border border-border/70">
            <button
              type="button"
              onClick={() => setPaymentMethodType("card")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-extrabold tracking-wider transition-all ${
                paymentMethodType === "card"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CreditCard className="w-4 h-4 text-sky-500" />
              <span>CARD</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethodType("paypal")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-extrabold tracking-wider transition-all ${
                paymentMethodType === "paypal"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Wallet className="w-4 h-4 text-sky-500" />
              <span>PAYPAL</span>
              {isPaypalEnabled && (
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  LIVE
                </span>
              )}
            </button>
          </div>

          <form onSubmit={handleSavePaymentMethod} className="space-y-4 pt-2 text-xs">
            {paymentMethodType === "card" ? (
              <>
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1.5">
                    CARDHOLDER NAME
                  </label>
                  <Input
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="e.g. Bilal Ahmad"
                    className="h-11 rounded-2xl text-xs"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                      CARD NUMBER
                    </label>
                    {cardNumber.replace(/\D/g, "").length >= 4 && (
                      <span className="text-[10px] font-bold text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded-md uppercase font-mono">
                        {detectCardBrand(cardNumber)}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      value={cardNumber}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, "").slice(0, 16);
                        const formatted = clean.replace(/(\d{4})(?=\d)/g, "$1 ");
                        setCardNumber(formatted);
                      }}
                      placeholder="4000 1234 5678 9010"
                      className="h-11 rounded-2xl text-xs font-mono tracking-wider"
                      maxLength={19}
                      required
                    />
                    <CreditCard className="w-4 h-4 text-muted-foreground absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1.5">
                      EXP (MM/YY)
                    </label>
                    <Input
                      value={cardExp}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, "").slice(0, 4);
                        if (clean.length > 2) {
                          setCardExp(`${clean.slice(0, 2)}/${clean.slice(2)}`);
                        } else {
                          setCardExp(clean);
                        }
                      }}
                      placeholder="12/28"
                      className="h-11 rounded-2xl text-xs font-mono"
                      maxLength={5}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1.5">
                      CVC / CVV
                    </label>
                    <Input
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="123"
                      className="h-11 rounded-2xl text-xs font-mono"
                      maxLength={4}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1.5">
                      ZIP / POSTAL
                    </label>
                    <Input
                      value={cardZip}
                      onChange={(e) => setCardZip(e.target.value.slice(0, 10))}
                      placeholder="94103"
                      className="h-11 rounded-2xl text-xs font-mono"
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3.5">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1.5">
                    PAYPAL ACCOUNT EMAIL
                  </label>
                  <div className="relative">
                    <Input
                      type="email"
                      value={paypalEmailInput}
                      onChange={(e) => setPaypalEmailInput(e.target.value)}
                      placeholder="your.email@paypal.com"
                      className="h-11 rounded-2xl text-xs pl-10"
                      required
                    />
                    <Wallet className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                    Enter the primary email address linked to your verified PayPal wallet. Renewals will be billed automatically.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-[11px] text-muted-foreground">
                    Secured via PayPal Gateway and synchronized with platform checkout rules.
                  </p>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={savingCard}
              className="w-full h-11 rounded-2xl bg-sky-400 hover:bg-sky-500 text-slate-950 font-bold text-xs shadow-md border-0 mt-2 gap-2"
            >
              {savingCard ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying & Saving...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Save & Authorize Payment Method
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </UserPanelGate>
  );
};

export default UserSubscription;
