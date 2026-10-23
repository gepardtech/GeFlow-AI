import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  User,
  Phone,
  Mail,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Share2,
  Trash2,
  RefreshCw,
  Wallet,
  Clock,
  History,
  ShieldCheck,
  Receipt,
  FileText,
  Printer,
  ChevronRight,
  UserPlus,
  Building,
  CreditCard,
  Banknote,
  Filter,
  Download,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import UserPanelGate from "@/components/UserPanelGate";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { useMoney } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CreditTransactionType =
  | "deposit_add"
  | "deposit_spend"
  | "udhar_charge"
  | "udhar_repayment"
  | "charge"
  | "payment"
  | "adjustment";

export interface CreditTransaction {
  id: string;
  type: CreditTransactionType;
  amount: number;
  paymentMethod?: string;
  depositBalanceAfter?: number;
  udharBalanceAfter?: number;
  balanceAfter?: number;
  note?: string;
  referenceId?: string;
  createdAt: string;
  recordedBy?: string;
}

export interface CustomerStoreCredit {
  id: string;
  buyerId: string; // e.g. BUY-10482
  businessId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  outstandingUdhar: number; // positive = customer owes store (Udhar debt)
  availableDeposit: number; // positive = store holds advance customer deposit
  balance: number; // backward compatibility: mirrors outstandingUdhar
  creditLimit: number;
  notes?: string;
  transactions: CreditTransaction[];
  createdAt: string;
  updatedAt: string;
}

type TabKey = "overview" | "buyers" | "deposits" | "udhar" | "ledger";

export default function UserCustomerCredits() {
  const { active, activeId } = useActiveBusiness();
  const { format: fmt, symbol, currency } = useMoney();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [credits, setCredits] = useState<CustomerStoreCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "with_udhar" | "with_deposit" | "over_limit">("all");

  // Add / Edit Buyer Modal
  const [buyerModalOpen, setBuyerModalOpen] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState<CustomerStoreCredit | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerLimit, setBuyerLimit] = useState("50000");
  const [buyerInitialDeposit, setBuyerInitialDeposit] = useState("0");
  const [buyerInitialUdhar, setBuyerInitialUdhar] = useState("0");
  const [buyerNotes, setBuyerNotes] = useState("");
  const [savingBuyer, setSavingBuyer] = useState(false);

  // Add Advance Deposit Modal
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositBuyer, setDepositBuyer] = useState<CustomerStoreCredit | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("Cash");
  const [depositRef, setDepositRef] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const [submittingDeposit, setSubmittingDeposit] = useState(false);

  // Receive Udhar Repayment Modal
  const [repaymentModalOpen, setRepaymentModalOpen] = useState(false);
  const [repaymentBuyer, setRepaymentBuyer] = useState<CustomerStoreCredit | null>(null);
  const [repaymentAmount, setRepaymentAmount] = useState("");
  const [repaymentMethod, setRepaymentMethod] = useState("Cash");
  const [repaymentRef, setRepaymentRef] = useState("");
  const [repaymentNote, setRepaymentNote] = useState("");
  const [submittingRepayment, setSubmittingRepayment] = useState(false);

  // Identity Disambiguation Selection Modal
  const [disambiguationOpen, setDisambiguationOpen] = useState(false);
  const [disambiguationMatches, setDisambiguationMatches] = useState<CustomerStoreCredit[]>([]);
  const [disambiguationAction, setDisambiguationAction] = useState<"deposit" | "repayment" | "history">("history");

  // Statement / Khata History Modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBuyer, setHistoryBuyer] = useState<CustomerStoreCredit | null>(null);

  // Print Receipt Modal
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    buyer: CustomerStoreCredit;
    title: string;
    amount: number;
    type: "deposit" | "repayment";
    paymentMethod: string;
    refNo: string;
    note: string;
    date: string;
    depositBalanceAfter: number;
    udharBalanceAfter: number;
  } | null>(null);

  // Minimum deposit guidance based on active currency
  const minDepositGuidance = useMemo(() => {
    const c = (currency || active?.currency || "USD").toUpperCase();
    if (c === "PKR") return 10000;
    if (c === "INR") return 10000;
    if (c === "EUR" || c === "GBP") return 100;
    return 100; // USD / default
  }, [currency, active?.currency]);

  // Safe normalizer
  const normalizeCredit = useCallback((raw: any): CustomerStoreCredit => {
    const name = raw.customerName || raw.customer_name || "Customer";
    const bId = raw.buyerId || raw.buyer_id || `BUY-${Math.floor(10000 + Math.random() * 90000)}`;
    const txs: CreditTransaction[] = Array.isArray(raw.transactions)
      ? raw.transactions.map((t: any) => ({
          id: t.id || `tx_${Math.random().toString(36).slice(2)}`,
          type: t.type || "adjustment",
          amount: Number(t.amount || 0),
          paymentMethod: t.paymentMethod || t.payment_method || "Cash",
          depositBalanceAfter: Number(t.depositBalanceAfter ?? t.deposit_balance_after ?? 0),
          udharBalanceAfter: Number(t.udharBalanceAfter ?? t.udhar_balance_after ?? t.balanceAfter ?? t.balance_after ?? 0),
          balanceAfter: Number(t.balanceAfter ?? t.balance_after ?? 0),
          note: t.note || "",
          referenceId: t.referenceId || t.reference_id || t.invoice_no || "",
          createdAt: t.createdAt || t.created_at || t.date || new Date().toISOString(),
          recordedBy: t.recordedBy || t.recorded_by || t.processed_by || "Register",
        }))
      : [];

    const udhar = Number(raw.outstandingUdhar ?? raw.outstanding_udhar ?? raw.balance ?? 0);
    const deposit = Number(raw.availableDeposit ?? raw.available_deposit ?? 0);

    return {
      id: raw.id,
      buyerId: bId,
      businessId: raw.businessId || raw.business_id || "",
      customerName: name,
      customerPhone: raw.customerPhone || raw.customer_phone || "",
      customerEmail: raw.customerEmail || raw.customer_email || "",
      customerAddress: raw.customerAddress || raw.customer_address || "",
      outstandingUdhar: udhar,
      availableDeposit: deposit,
      balance: udhar,
      creditLimit: Number(raw.creditLimit ?? raw.credit_limit ?? 50000),
      notes: raw.notes || "",
      transactions: txs,
      createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
      updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
    };
  }, []);

  const loadCredits = useCallback(async () => {
    if (!activeId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sync/store-credits?businessId=${encodeURIComponent(activeId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.credits)) {
          setCredits(data.credits.map(normalizeCredit));
        }
      }
    } catch (e) {
      console.warn("Failed to load customer store credits:", e);
    } finally {
      setLoading(false);
    }
  }, [activeId, normalizeCredit]);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  // Overall Financial Statistics
  const stats = useMemo(() => {
    const totalOutstanding = credits.reduce((acc, c) => acc + (c.outstandingUdhar || 0), 0);
    const totalDeposits = credits.reduce((acc, c) => acc + (c.availableDeposit || 0), 0);
    const netPosition = totalOutstanding - totalDeposits; // Positive means store is net owed; Negative means store holds net surplus deposits
    const buyersWithUdhar = credits.filter((c) => (c.outstandingUdhar || 0) > 0).length;
    const buyersWithDeposits = credits.filter((c) => (c.availableDeposit || 0) > 0).length;
    const buyersOverLimit = credits.filter((c) => (c.outstandingUdhar || 0) > (c.creditLimit || 0)).length;

    return {
      totalOutstanding,
      totalDeposits,
      netPosition,
      buyersWithUdhar,
      buyersWithDeposits,
      buyersOverLimit,
      totalBuyers: credits.length,
    };
  }, [credits]);

  // Filtered Buyers list
  const filteredCredits = useMemo(() => {
    let result = [...credits];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const cleanDigits = q.replace(/[^0-9]/g, "");
      result = result.filter((c) => {
        const nameMatch = (c.customerName || "").toLowerCase().includes(q);
        const buyerIdMatch = (c.buyerId || "").toLowerCase().includes(q);
        const phone = (c.customerPhone || "").replace(/[^0-9]/g, "");
        const phoneMatch = cleanDigits ? phone.includes(cleanDigits) : false;
        return nameMatch || buyerIdMatch || phoneMatch;
      });
    }

    if (statusFilter === "with_udhar") {
      result = result.filter((c) => (c.outstandingUdhar || 0) > 0);
    } else if (statusFilter === "with_deposit") {
      result = result.filter((c) => (c.availableDeposit || 0) > 0);
    } else if (statusFilter === "over_limit") {
      result = result.filter((c) => (c.outstandingUdhar || 0) > (c.creditLimit || 0));
    }

    return result;
  }, [credits, searchQuery, statusFilter]);

  // All chronological transactions for the Transaction Ledger tab
  const allTransactions = useMemo(() => {
    const list: Array<{
      buyerId: string;
      customerName: string;
      customerPhone?: string;
      tx: CreditTransaction;
    }> = [];

    credits.forEach((c) => {
      (c.transactions || []).forEach((t) => {
        list.push({
          buyerId: c.buyerId,
          customerName: c.customerName,
          customerPhone: c.customerPhone,
          tx: t,
        });
      });
    });

    return list.sort((a, b) => new Date(b.tx.createdAt).getTime() - new Date(a.tx.createdAt).getTime());
  }, [credits]);

  // Open Add Buyer Modal
  const handleOpenAddBuyer = () => {
    setEditingBuyer(null);
    setBuyerName("");
    setBuyerPhone("");
    setBuyerEmail("");
    setBuyerAddress("");
    setBuyerLimit("50000");
    setBuyerInitialDeposit("0");
    setBuyerInitialUdhar("0");
    setBuyerNotes("");
    setBuyerModalOpen(true);
  };

  // Open Edit Buyer Modal
  const handleOpenEditBuyer = (buyer: CustomerStoreCredit) => {
    setEditingBuyer(buyer);
    setBuyerName(buyer.customerName);
    setBuyerPhone(buyer.customerPhone || "");
    setBuyerEmail(buyer.customerEmail || "");
    setBuyerAddress(buyer.customerAddress || "");
    setBuyerLimit(String(buyer.creditLimit || 50000));
    setBuyerInitialDeposit(String(buyer.availableDeposit || 0));
    setBuyerInitialUdhar(String(buyer.outstandingUdhar || 0));
    setBuyerNotes(buyer.notes || "");
    setBuyerModalOpen(true);
  };

  // Save Buyer Profile
  const handleSaveBuyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId || !buyerName.trim()) {
      toast({ title: "Name Required", description: "Please enter the buyer's full name.", variant: "destructive" });
      return;
    }

    setSavingBuyer(true);
    try {
      const payload: Partial<CustomerStoreCredit> = {
        id: editingBuyer?.id,
        buyerId: editingBuyer?.buyerId,
        customerName: buyerName.trim(),
        customerPhone: buyerPhone.trim(),
        customerEmail: buyerEmail.trim(),
        customerAddress: buyerAddress.trim(),
        creditLimit: Math.max(0, Number(buyerLimit) || 50000),
        notes: buyerNotes.trim(),
      };

      if (!editingBuyer) {
        payload.availableDeposit = Math.max(0, Number(buyerInitialDeposit) || 0);
        payload.outstandingUdhar = Math.max(0, Number(buyerInitialUdhar) || 0);
      }

      const res = await fetch("/api/sync/store-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: activeId, credit: payload }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save buyer account.");
      }

      const data = await res.json();
      if (data.success && data.credit) {
        const saved = normalizeCredit(data.credit);
        setCredits((prev) => {
          const idx = prev.findIndex((c) => c.id === saved.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [saved, ...prev];
        });

        toast({
          title: editingBuyer ? "Buyer Profile Updated" : "New Buyer Registered",
          description: `Account for ${saved.customerName} (${saved.buyerId}) saved successfully.`,
        });
        setBuyerModalOpen(false);
      }
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingBuyer(false);
    }
  };

  // Open Deposit Modal with verified buyer
  const handleOpenDeposit = (buyer?: CustomerStoreCredit) => {
    if (buyer) {
      setDepositBuyer(buyer);
      setDepositAmount("");
      setDepositMethod("Cash");
      setDepositRef("");
      setDepositNote("");
      setDepositModalOpen(true);
    } else {
      // Prompt user to pick/search verified buyer
      setDisambiguationAction("deposit");
      setDisambiguationMatches(credits);
      setDisambiguationOpen(true);
    }
  };

  // Submit Advance Deposit
  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId || !depositBuyer) return;

    const amt = Number(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid deposit amount.", variant: "destructive" });
      return;
    }

    setSubmittingDeposit(true);
    try {
      const res = await fetch("/api/sync/store-credits/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: activeId,
          creditId: depositBuyer.id,
          amount: amt,
          type: "deposit_add",
          paymentMethod: depositMethod,
          note: depositNote.trim() || `Advance store credit deposit via ${depositMethod}`,
          invoiceNo: depositRef.trim() || `DEP-${Date.now().toString().slice(-6)}`,
          processedBy: active?.business_name || "Store Counter",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to record deposit.");
      }

      const data = await res.json();
      if (data.success && data.credit) {
        const updated = normalizeCredit(data.credit);
        setCredits((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

        // Open Receipt Modal
        setReceiptData({
          buyer: updated,
          title: "Advance Deposit Receipt",
          amount: amt,
          type: "deposit",
          paymentMethod: depositMethod,
          refNo: depositRef.trim() || `DEP-${Date.now().toString().slice(-6)}`,
          note: depositNote.trim() || "Advance balance deposit",
          date: new Date().toISOString(),
          depositBalanceAfter: updated.availableDeposit,
          udharBalanceAfter: updated.outstandingUdhar,
        });
        setDepositModalOpen(false);
        setReceiptModalOpen(true);

        toast({
          title: "Deposit Recorded",
          description: `Added ${fmt(amt)} advance deposit to ${updated.customerName}'s account.`,
        });
      }
    } catch (err: any) {
      toast({ title: "Deposit Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingDeposit(false);
    }
  };

  // Open Repayment Modal with verified buyer
  const handleOpenRepayment = (buyer?: CustomerStoreCredit) => {
    if (buyer) {
      setRepaymentBuyer(buyer);
      setRepaymentAmount(buyer.outstandingUdhar > 0 ? String(buyer.outstandingUdhar) : "");
      setRepaymentMethod("Cash");
      setRepaymentRef("");
      setRepaymentNote("");
      setRepaymentModalOpen(true);
    } else {
      setDisambiguationAction("repayment");
      setDisambiguationMatches(credits.filter((c) => c.outstandingUdhar > 0));
      setDisambiguationOpen(true);
    }
  };

  // Submit Udhar Repayment
  const handleSubmitRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId || !repaymentBuyer) return;

    const amt = Number(repaymentAmount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid repayment amount.", variant: "destructive" });
      return;
    }

    setSubmittingRepayment(true);
    try {
      const res = await fetch("/api/sync/store-credits/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: activeId,
          creditId: repaymentBuyer.id,
          amount: amt,
          type: "udhar_repayment",
          paymentMethod: repaymentMethod,
          note: repaymentNote.trim() || `Udhar repayment received via ${repaymentMethod}`,
          invoiceNo: repaymentRef.trim() || `REP-${Date.now().toString().slice(-6)}`,
          processedBy: active?.business_name || "Store Counter",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to record payment.");
      }

      const data = await res.json();
      if (data.success && data.credit) {
        const updated = normalizeCredit(data.credit);
        setCredits((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

        // Open Receipt Modal
        setReceiptData({
          buyer: updated,
          title: "Udhar Repayment Receipt",
          amount: amt,
          type: "repayment",
          paymentMethod: repaymentMethod,
          refNo: repaymentRef.trim() || `REP-${Date.now().toString().slice(-6)}`,
          note: repaymentNote.trim() || "Udhar debt repayment settled",
          date: new Date().toISOString(),
          depositBalanceAfter: updated.availableDeposit,
          udharBalanceAfter: updated.outstandingUdhar,
        });
        setRepaymentModalOpen(false);
        setReceiptModalOpen(true);

        toast({
          title: "Payment Received",
          description: `Settled ${fmt(amt)} from ${updated.customerName}'s outstanding udhar.`,
        });
      }
    } catch (err: any) {
      toast({ title: "Repayment Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingRepayment(false);
    }
  };

  // Open Khata / Statement History
  const handleOpenHistory = (buyer: CustomerStoreCredit) => {
    setHistoryBuyer(buyer);
    setHistoryOpen(true);
  };

  // Share WhatsApp Statement Reminder
  const handleShareStatement = (buyer: CustomerStoreCredit) => {
    const bizName = active?.business_name || "Our Store";
    const msg = `*${bizName} - Account Statement Summary*\nDear ${buyer.customerName} (${buyer.buyerId}),\n\n• *Available Deposit Balance:* ${fmt(buyer.availableDeposit)}\n• *Outstanding Udhar Debt:* ${fmt(buyer.outstandingUdhar)}\n• *Credit Limit:* ${fmt(buyer.creditLimit)}\n\nThank you for choosing ${bizName}! For inquiries, please contact us.`;
    const encoded = encodeURIComponent(msg);
    const cleanPhone = (buyer.customerPhone || "").replace(/[^0-9]/g, "");
    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, "_blank");
    } else {
      navigator.clipboard.writeText(msg);
      toast({ title: "Statement Copied", description: "Khata statement summary copied to clipboard." });
    }
  };

  // Trigger Print Receipt
  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <UserPanelGate pageTitle="Store Credit & Udhar" module="pos">
      <div className="w-full space-y-6 min-w-0 pb-16">
        {/* ========================================================================= */}
        {/* HEADER SECTION (Title, Business Badge, Quick Action Buttons)             */}
        {/* ========================================================================= */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                <Wallet className="w-7 h-7 text-sky-500" />
                Store Credit / Udhar
              </h1>
              {active?.business_name && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  {active.business_name}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage buyer balances, advance deposits, outstanding udhar and repayments with verified identity matching.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              onClick={handleOpenAddBuyer}
              className="h-10 px-4 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white shadow-xs"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Buyer
            </Button>
            <Button
              onClick={() => handleOpenDeposit()}
              className="h-10 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <ArrowDownLeft className="w-4 h-4 mr-2" />
              Add Deposit
            </Button>
            <Button
              onClick={() => handleOpenRepayment()}
              variant="outline"
              className="h-10 px-4 rounded-xl text-xs font-bold border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
            >
              <ArrowUpRight className="w-4 h-4 mr-2" />
              Receive Payment
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadCredits}
              className="h-10 w-10 rounded-xl border border-border"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TOP METRIC CARDS STRIP                                                    */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Outstanding Udhar */}
          <div className="p-5 rounded-2xl bg-card border border-rose-500/20 shadow-xs space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                Unpaid Udhar
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                TOTAL OUTSTANDING UDHAR
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight mt-0.5 font-mono">
                {fmt(stats.totalOutstanding)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Owed across <span className="font-semibold text-foreground">{stats.buyersWithUdhar}</span> active buyers
              </p>
            </div>
          </div>

          {/* Card 2: Available Advance Deposits */}
          <div className="p-5 rounded-2xl bg-card border border-emerald-500/20 shadow-xs space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Buyer-Owned
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                AVAILABLE ADVANCE DEPOSITS
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5 font-mono">
                {fmt(stats.totalDeposits)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Held for <span className="font-semibold text-foreground">{stats.buyersWithDeposits}</span> depositing buyers
              </p>
            </div>
          </div>

          {/* Card 3: Buyers with Udhar vs Deposits */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
                {stats.totalBuyers} Profiles
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                BUYER BALANCE ROSTER
              </p>
              <div className="flex items-baseline gap-3 mt-0.5">
                <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {stats.buyersWithUdhar}
                </p>
                <span className="text-xs text-muted-foreground">with Udhar /</span>
                <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {stats.buyersWithDeposits}
                </p>
                <span className="text-xs text-muted-foreground">with Deposit</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {stats.buyersOverLimit > 0 ? (
                  <span className="text-amber-500 font-semibold">{stats.buyersOverLimit} over credit limit</span>
                ) : (
                  "All accounts within credit limit"
                )}
              </p>
            </div>
          </div>

          {/* Card 4: Net Exposure / Liquidity */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">
                <Building className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                Separate Accounts
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                NET STORE POSITION
              </p>
              <p
                className={`text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5 font-mono ${
                  stats.netPosition > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : stats.netPosition < 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-foreground"
                }`}
              >
                {stats.netPosition >= 0 ? `+${fmt(stats.netPosition)}` : `-${fmt(Math.abs(stats.netPosition))}`}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {stats.netPosition > 0
                  ? "Net store credit receivable"
                  : stats.netPosition < 0
                  ? "Net advance deposits held in store custody"
                  : "Balanced store receivables"}
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5-TAB NAVIGATION BAR                                                      */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/60 border border-border overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-xl transition-all shrink-0 flex items-center gap-2 ${
              activeTab === "overview"
                ? "bg-card text-foreground shadow-xs font-bold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab("buyers")}
            className={`px-4 py-2 rounded-xl transition-all shrink-0 flex items-center gap-2 ${
              activeTab === "buyers"
                ? "bg-card text-foreground shadow-xs font-bold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Buyer Accounts ({credits.length})
          </button>
          <button
            onClick={() => setActiveTab("deposits")}
            className={`px-4 py-2 rounded-xl transition-all shrink-0 flex items-center gap-2 ${
              activeTab === "deposits"
                ? "bg-card text-foreground shadow-xs font-bold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
            Store Credit Deposits ({stats.buyersWithDeposits})
          </button>
          <button
            onClick={() => setActiveTab("udhar")}
            className={`px-4 py-2 rounded-xl transition-all shrink-0 flex items-center gap-2 ${
              activeTab === "udhar"
                ? "bg-card text-foreground shadow-xs font-bold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
            Udhar & Repayments ({stats.buyersWithUdhar})
          </button>
          <button
            onClick={() => setActiveTab("ledger")}
            className={`px-4 py-2 rounded-xl transition-all shrink-0 flex items-center gap-2 ${
              activeTab === "ledger"
                ? "bg-card text-foreground shadow-xs font-bold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="w-3.5 h-3.5 text-sky-500" />
            Transaction Ledger ({allTransactions.length})
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW                                                           */}
        {/* ========================================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Quick Action Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-emerald-500/10 border border-sky-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-sky-500" />
                  Verified Buyer Balance Management
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Udhar debt and advance deposits are preserved as separate balances and never auto-deducted silently.
                  Minimum recommended advance deposit:{" "}
                  <strong className="text-emerald-600 font-mono">{fmt(minDepositGuidance)}</strong>.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={handleOpenAddBuyer}
                  size="sm"
                  className="rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  Register Buyer
                </Button>
                <Button
                  onClick={() => handleOpenDeposit()}
                  size="sm"
                  className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 mr-1.5" />
                  Deposit Advance
                </Button>
                <Button
                  onClick={() => handleOpenRepayment()}
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs font-bold border-rose-500/30 text-rose-600"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" />
                  Collect Payment
                </Button>
              </div>
            </div>

            {/* Two Column Grid: Top Udhar Balances & Recent Transactions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Box 1: High Outstanding Udhar Watchlist */}
              <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    <h3 className="text-sm font-bold text-foreground">Highest Outstanding Udhar</h3>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab("udhar");
                      setStatusFilter("with_udhar");
                    }}
                    className="text-xs text-sky-500 hover:underline flex items-center gap-1 font-semibold"
                  >
                    View All <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {credits.filter((c) => c.outstandingUdhar > 0).length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    No unpaid udhar recorded! All buyer balances are clear.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {[...credits]
                      .filter((c) => c.outstandingUdhar > 0)
                      .sort((a, b) => b.outstandingUdhar - a.outstandingUdhar)
                      .slice(0, 5)
                      .map((c) => (
                        <div
                          key={c.id}
                          className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs hover:border-rose-500/30 transition-all"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">{c.customerName}</span>
                              <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-muted border border-border">
                                {c.buyerId}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {c.customerPhone || "No phone listed"} • Limit: {fmt(c.creditLimit)}
                            </p>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <div>
                              <p className="font-extrabold text-rose-600 dark:text-rose-400 font-mono text-sm">
                                {fmt(c.outstandingUdhar)}
                              </p>
                              {c.availableDeposit > 0 && (
                                <p className="text-[10px] text-emerald-600 font-mono">
                                  Deposit: {fmt(c.availableDeposit)}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenRepayment(c)}
                              className="h-8 px-2 text-rose-600 hover:bg-rose-500/10 rounded-lg text-[11px] font-bold"
                            >
                              Repay
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Box 2: Top Advance Deposit Accounts */}
              <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-bold text-foreground">Top Advance Deposit Holders</h3>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab("deposits");
                      setStatusFilter("with_deposit");
                    }}
                    className="text-xs text-sky-500 hover:underline flex items-center gap-1 font-semibold"
                  >
                    View All <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {credits.filter((c) => c.availableDeposit > 0).length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    <Wallet className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    No buyer advance deposits on record yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {[...credits]
                      .filter((c) => c.availableDeposit > 0)
                      .sort((a, b) => b.availableDeposit - a.availableDeposit)
                      .slice(0, 5)
                      .map((c) => (
                        <div
                          key={c.id}
                          className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs hover:border-emerald-500/30 transition-all"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">{c.customerName}</span>
                              <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-muted border border-border">
                                {c.buyerId}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {c.customerPhone || "No phone listed"}
                            </p>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <div>
                              <p className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                                {fmt(c.availableDeposit)}
                              </p>
                              {c.outstandingUdhar > 0 && (
                                <p className="text-[10px] text-rose-500 font-mono">
                                  Udhar: {fmt(c.outstandingUdhar)}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenDeposit(c)}
                              className="h-8 px-2 text-emerald-600 hover:bg-emerald-500/10 rounded-lg text-[11px] font-bold"
                            >
                              + Deposit
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent 5 Transactions Strip */}
            <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-sky-500" />
                  <h3 className="text-sm font-bold text-foreground">Recent Khata & Balance Activity</h3>
                </div>
                <button
                  onClick={() => setActiveTab("ledger")}
                  className="text-xs text-sky-500 hover:underline flex items-center gap-1 font-semibold"
                >
                  Full Ledger ({allTransactions.length}) <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {allTransactions.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No recent balance activity on record.</p>
              ) : (
                <div className="divide-y divide-border">
                  {allTransactions.slice(0, 5).map(({ buyerId, customerName, tx }) => (
                    <div key={tx.id} className="py-3 flex items-center justify-between text-xs gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            tx.type === "deposit_add"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : tx.type === "deposit_spend"
                              ? "bg-sky-500/10 text-sky-500"
                              : tx.type === "udhar_repayment" || tx.type === "payment"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-rose-500/10 text-rose-500"
                          }`}
                        >
                          {tx.type === "deposit_add" || tx.type === "udhar_repayment" || tx.type === "payment" ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">{customerName}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{buyerId}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                tx.type === "deposit_add"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : tx.type === "deposit_spend"
                                  ? "bg-sky-500/10 text-sky-600"
                                  : tx.type === "udhar_repayment" || tx.type === "payment"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-rose-500/10 text-rose-600"
                              }`}
                            >
                              {tx.type === "deposit_add"
                                ? "Deposit Added"
                                : tx.type === "deposit_spend"
                                ? "Deposit Used"
                                : tx.type === "udhar_repayment" || tx.type === "payment"
                                ? "Udhar Repaid"
                                : "Udhar Charged"}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {tx.note || "No note recorded"} • {tx.paymentMethod || "Cash"}
                            {tx.referenceId && ` • Ref: ${tx.referenceId}`}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={`font-mono font-bold ${
                            tx.type === "deposit_add" || tx.type === "udhar_repayment" || tx.type === "payment"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {tx.type === "deposit_add" || tx.type === "udhar_repayment" || tx.type === "payment" ? "+" : "-"}
                          {fmt(tx.amount)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: BUYER ACCOUNTS                                                     */}
        {/* ========================================================================= */}
        {activeTab === "buyers" && (
          <div className="space-y-4">
            {/* Search and Filter Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Buyer ID (BUY-XXXXX), Name, or Phone..."
                  className="pl-9 h-10 rounded-xl bg-card border-border text-xs"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="w-44 h-10 rounded-xl bg-card border-border text-xs font-semibold">
                    <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="all">All Buyers ({credits.length})</SelectItem>
                    <SelectItem value="with_udhar">With Udhar Debt ({stats.buyersWithUdhar})</SelectItem>
                    <SelectItem value="with_deposit">With Deposits ({stats.buyersWithDeposits})</SelectItem>
                    <SelectItem value="over_limit">Over Limit ({stats.buyersOverLimit})</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleOpenAddBuyer}
                  className="h-10 px-4 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white"
                >
                  <UserPlus className="w-4 h-4 mr-1.5" />
                  Add Buyer Profile
                </Button>
              </div>
            </div>

            {/* Buyers Table */}
            <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Buyer ID</th>
                      <th className="py-3 px-4">Buyer Identity</th>
                      <th className="py-3 px-4 text-right">Outstanding Udhar</th>
                      <th className="py-3 px-4 text-right">Available Deposit</th>
                      <th className="py-3 px-4 text-right">Credit Limit</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCredits.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-muted-foreground">
                          No buyer accounts found matching your query.
                        </td>
                      </tr>
                    ) : (
                      filteredCredits.map((c) => {
                        const isOverLimit = (c.outstandingUdhar || 0) > (c.creditLimit || 0);
                        const hasDeposit = (c.availableDeposit || 0) > 0;
                        const hasUdhar = (c.outstandingUdhar || 0) > 0;

                        return (
                          <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                            {/* Buyer ID */}
                            <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                              <span className="px-2 py-1 rounded-md bg-muted border border-border">
                                {c.buyerId}
                              </span>
                            </td>

                            {/* Name & Contact */}
                            <td className="py-3.5 px-4">
                              <p className="font-bold text-foreground text-sm">{c.customerName}</p>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                {c.customerPhone ? (
                                  <span className="flex items-center gap-1 font-mono">
                                    <Phone className="w-3 h-3" /> {c.customerPhone}
                                  </span>
                                ) : (
                                  <span>No Phone</span>
                                )}
                                {c.customerEmail && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" /> {c.customerEmail}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Outstanding Udhar */}
                            <td className="py-3.5 px-4 text-right">
                              <p
                                className={`font-mono font-extrabold text-sm ${
                                  hasUdhar ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                                }`}
                              >
                                {fmt(c.outstandingUdhar)}
                              </p>
                            </td>

                            {/* Available Deposit */}
                            <td className="py-3.5 px-4 text-right">
                              <p
                                className={`font-mono font-extrabold text-sm ${
                                  hasDeposit ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                                }`}
                              >
                                {fmt(c.availableDeposit)}
                              </p>
                            </td>

                            {/* Credit Limit */}
                            <td className="py-3.5 px-4 text-right font-mono text-muted-foreground">
                              {fmt(c.creditLimit)}
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4 text-center">
                              {isOverLimit ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                  Over Limit
                                </span>
                              ) : hasUdhar ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  Udhar Active
                                </span>
                              ) : hasDeposit ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  Deposit Ready
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                                  Settled
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenDeposit(c)}
                                  className="h-8 px-2 text-emerald-600 hover:bg-emerald-500/10 rounded-lg text-[11px] font-bold"
                                  title="Add Advance Deposit"
                                >
                                  + Deposit
                                </Button>
                                {hasUdhar && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleOpenRepayment(c)}
                                    className="h-8 px-2 text-rose-600 hover:bg-rose-500/10 rounded-lg text-[11px] font-bold"
                                    title="Receive Payment"
                                  >
                                    Repay
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenHistory(c)}
                                  className="h-8 px-2 text-sky-500 hover:bg-sky-500/10 rounded-lg text-[11px] font-bold"
                                  title="View Statement"
                                >
                                  Khata
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleShareStatement(c)}
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-lg"
                                  title="Share WhatsApp Summary"
                                >
                                  <Share2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenEditBuyer(c)}
                                  className="h-8 px-2 text-muted-foreground hover:text-foreground rounded-lg text-[11px]"
                                >
                                  Edit
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: STORE CREDIT DEPOSITS                                              */}
        {/* ========================================================================= */}
        {activeTab === "deposits" && (
          <div className="space-y-6">
            {/* Advance Deposit Policy Banner */}
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Advance Deposit Accounts Policy</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Buyers can deposit advance balance for friction-free POS purchases. Recommended minimum deposit is{" "}
                    <strong className="text-emerald-600 font-mono">{fmt(minDepositGuidance)}</strong>. Deposit balance
                    is completely protected and cannot be silently deducted without explicit buyer/cashier confirmation.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => handleOpenDeposit()}
                className="h-10 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Advance Deposit
              </Button>
            </div>

            {/* Depositor Buyer Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {credits.filter((c) => c.availableDeposit > 0).length === 0 ? (
                <div className="col-span-full p-12 text-center text-xs text-muted-foreground bg-card rounded-2xl border border-border">
                  <Wallet className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  No advance deposits active right now. Click "Add Advance Deposit" to credit a buyer's account.
                </div>
              ) : (
                credits
                  .filter((c) => c.availableDeposit > 0)
                  .map((c) => (
                    <div
                      key={c.id}
                      className="p-5 rounded-2xl bg-card border border-border hover:border-emerald-500/30 shadow-xs space-y-4 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted border border-border">
                            {c.buyerId}
                          </span>
                          <h4 className="text-base font-bold text-foreground mt-1">{c.customerName}</h4>
                          <p className="text-xs text-muted-foreground">{c.customerPhone || "No contact info"}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          Active Deposit
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                        <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                          AVAILABLE ADVANCE BALANCE
                        </p>
                        <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                          {fmt(c.availableDeposit)}
                        </p>
                        {c.outstandingUdhar > 0 && (
                          <p className="text-[11px] text-rose-500 font-mono">
                            Separate Udhar Debt: {fmt(c.outstandingUdhar)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          onClick={() => handleOpenDeposit(c)}
                          size="sm"
                          className="flex-1 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          + Top Up Deposit
                        </Button>
                        <Button
                          onClick={() => handleOpenHistory(c)}
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs font-bold border-border"
                        >
                          Statement
                        </Button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: UDHAR & REPAYMENTS                                                  */}
        {/* ========================================================================= */}
        {activeTab === "udhar" && (
          <div className="space-y-6">
            {/* Udhar Policy Header */}
            <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-600 flex items-center justify-center font-bold shrink-0">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Outstanding Udhar & Recovery Management</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Track unpaid sales invoices and partial customer repayments. Total unpaid debt stands at{" "}
                    <strong className="text-rose-600 font-mono">{fmt(stats.totalOutstanding)}</strong> across{" "}
                    <strong>{stats.buyersWithUdhar}</strong> buyers.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => handleOpenRepayment()}
                className="h-10 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shrink-0"
              >
                <ArrowUpRight className="w-4 h-4 mr-1.5" />
                Receive Udhar Payment
              </Button>
            </div>

            {/* Udhar Debtors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {credits.filter((c) => c.outstandingUdhar > 0).length === 0 ? (
                <div className="col-span-full p-12 text-center text-xs text-muted-foreground bg-card rounded-2xl border border-border">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                  All accounts settled! No outstanding udhar recorded at this time.
                </div>
              ) : (
                credits
                  .filter((c) => c.outstandingUdhar > 0)
                  .sort((a, b) => b.outstandingUdhar - a.outstandingUdhar)
                  .map((c) => {
                    const isOver = c.outstandingUdhar > c.creditLimit;
                    return (
                      <div
                        key={c.id}
                        className="p-5 rounded-2xl bg-card border border-border hover:border-rose-500/30 shadow-xs space-y-4 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted border border-border">
                              {c.buyerId}
                            </span>
                            <h4 className="text-base font-bold text-foreground mt-1">{c.customerName}</h4>
                            <p className="text-xs text-muted-foreground">{c.customerPhone || "No contact info"}</p>
                          </div>
                          {isOver ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                              Over Limit
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              Unpaid Udhar
                            </span>
                          )}
                        </div>

                        <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                          <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                            OUTSTANDING DEBT
                          </p>
                          <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                            {fmt(c.outstandingUdhar)}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                            <span>Credit Limit: {fmt(c.creditLimit)}</span>
                            {c.availableDeposit > 0 && (
                              <span className="text-emerald-600 font-mono font-semibold">
                                Deposit: {fmt(c.availableDeposit)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            onClick={() => handleOpenRepayment(c)}
                            size="sm"
                            className="flex-1 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
                          >
                            Receive Payment
                          </Button>
                          <Button
                            onClick={() => handleShareStatement(c)}
                            size="sm"
                            variant="outline"
                            className="h-9 px-3 rounded-xl text-xs font-bold border-border"
                            title="Share WhatsApp Reminder"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            onClick={() => handleOpenHistory(c)}
                            size="sm"
                            variant="ghost"
                            className="h-9 px-3 rounded-xl text-xs font-bold"
                          >
                            Statement
                          </Button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: TRANSACTION LEDGER                                                 */}
        {/* ========================================================================= */}
        {activeTab === "ledger" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Chronological Transaction Audit Ledger</h3>
                <p className="text-xs text-muted-foreground">
                  Complete auditable record of all advance deposits, POS deductions, udhar charges and repayments.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-muted border border-border">
                {allTransactions.length} Transactions Recorded
              </span>
            </div>

            <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Date / Time</th>
                      <th className="py-3 px-4">Buyer Identity</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4">Payment Method</th>
                      <th className="py-3 px-4">Reference / Invoice</th>
                      <th className="py-3 px-4">Processed By</th>
                      <th className="py-3 px-4 text-right">Balances After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-muted-foreground">
                          No transactions recorded in the ledger yet.
                        </td>
                      </tr>
                    ) : (
                      allTransactions.map(({ buyerId, customerName, tx }) => (
                        <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-foreground">{customerName}</span>
                            <span className="ml-2 font-mono text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted border border-border">
                              {buyerId}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                tx.type === "deposit_add"
                                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                  : tx.type === "deposit_spend"
                                  ? "bg-sky-500/10 text-sky-600 border border-sky-500/20"
                                  : tx.type === "udhar_repayment" || tx.type === "payment"
                                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                              }`}
                            >
                              {tx.type === "deposit_add"
                                ? "Deposit Added"
                                : tx.type === "deposit_spend"
                                ? "Deposit Spent"
                                : tx.type === "udhar_repayment" || tx.type === "payment"
                                ? "Udhar Repayment"
                                : "Udhar Charged"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-extrabold">
                            <span
                              className={
                                tx.type === "deposit_add" || tx.type === "udhar_repayment" || tx.type === "payment"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }
                            >
                              {tx.type === "deposit_add" || tx.type === "udhar_repayment" || tx.type === "payment" ? "+" : "-"}
                              {fmt(tx.amount)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground">{tx.paymentMethod || "Cash"}</td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground">
                            {tx.referenceId || "—"}
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground">{tx.recordedBy || "Register"}</td>
                          <td className="py-3.5 px-4 text-right font-mono text-[11px]">
                            {tx.depositBalanceAfter !== undefined && (
                              <span className="text-emerald-600 block">Dep: {fmt(tx.depositBalanceAfter)}</span>
                            )}
                            {tx.udharBalanceAfter !== undefined && (
                              <span className="text-rose-500 block">Udh: {fmt(tx.udharBalanceAfter)}</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 1: REGISTER / EDIT BUYER ACCOUNT                                    */}
        {/* ========================================================================= */}
        <Dialog open={buyerModalOpen} onOpenChange={setBuyerModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-sky-500" />
                {editingBuyer ? `Edit Buyer Profile: ${editingBuyer.buyerId}` : "Register New Buyer Profile"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Unique Buyer ID and contact verification ensures balance entries are never mapped to the wrong person.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveBuyer} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Buyer Full Name *</Label>
                <Input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="e.g. Muhammad Usman"
                  required
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Phone / WhatsApp Number</Label>
                  <Input
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="h-10 rounded-xl text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Email (Optional)</Label>
                  <Input
                    type="email"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    placeholder="buyer@gmail.com"
                    className="h-10 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Credit Limit ({symbol})</Label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={buyerLimit}
                    onChange={(e) => setBuyerLimit(e.target.value)}
                    className="h-10 rounded-xl text-xs font-mono"
                  />
                </div>

                {!editingBuyer && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Initial Advance Deposit ({symbol})</Label>
                    <Input
                      type="number"
                      min="0"
                      step="100"
                      value={buyerInitialDeposit}
                      onChange={(e) => setBuyerInitialDeposit(e.target.value)}
                      placeholder="0"
                      className="h-10 rounded-xl text-xs font-mono"
                    />
                  </div>
                )}
              </div>

              {!editingBuyer && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Opening Udhar Debt ({symbol}) (if any)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={buyerInitialUdhar}
                    onChange={(e) => setBuyerInitialUdhar(e.target.value)}
                    placeholder="0"
                    className="h-10 rounded-xl text-xs font-mono"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Billing Address / Shop Area</Label>
                <Input
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  placeholder="e.g. Shop #14, Main Commercial Market"
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Internal Notes / Guarantees</Label>
                <Textarea
                  value={buyerNotes}
                  onChange={(e) => setBuyerNotes(e.target.value)}
                  placeholder="e.g. Verified wholesaler, pays every 15 days"
                  rows={2}
                  className="rounded-xl text-xs"
                />
              </div>

              <DialogFooter className="border-t border-border pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBuyerModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingBuyer}
                  className="rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white"
                >
                  {savingBuyer ? "Saving..." : editingBuyer ? "Update Account" : "Register Buyer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL 2: ADD ADVANCE DEPOSIT                                              */}
        {/* ========================================================================= */}
        <Dialog open={depositModalOpen} onOpenChange={setDepositModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                Add Advance Deposit
              </DialogTitle>
              <DialogDescription className="text-xs">
                Buyer: <strong className="text-foreground">{depositBuyer?.customerName}</strong> (
                {depositBuyer?.buyerId}) • Phone: {depositBuyer?.customerPhone || "N/A"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitDeposit} className="space-y-4 py-2">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Available Deposit:</span>
                  <span className="font-bold text-emerald-600 font-mono">
                    {fmt(depositBuyer?.availableDeposit || 0)}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Separate Udhar Debt:</span>
                  <span className="font-bold text-rose-500 font-mono">
                    {fmt(depositBuyer?.outstandingUdhar || 0)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Deposit Amount ({symbol}) *</Label>
                <Input
                  type="number"
                  min="1"
                  step="any"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder={`Min recommended: ${minDepositGuidance}`}
                  required
                  autoFocus
                  className="h-10 rounded-xl text-base font-bold font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Payment Method</Label>
                  <Select value={depositMethod} onValueChange={setDepositMethod}>
                    <SelectTrigger className="h-10 rounded-xl text-xs font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="Online Payment">Online Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Reference / Receipt #</Label>
                  <Input
                    value={depositRef}
                    onChange={(e) => setDepositRef(e.target.value)}
                    placeholder="e.g. CHQ-98124"
                    className="h-10 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Notes / Purpose</Label>
                <Input
                  value={depositNote}
                  onChange={(e) => setDepositNote(e.target.value)}
                  placeholder="e.g. Advance deposit for monthly wholesale stock"
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              <DialogFooter className="border-t border-border pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDepositModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingDeposit}
                  className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {submittingDeposit ? "Recording..." : "Confirm Deposit"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL 3: RECEIVE UDHAR PAYMENT                                            */}
        {/* ========================================================================= */}
        <Dialog open={repaymentModalOpen} onOpenChange={setRepaymentModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-rose-500" />
                Receive Udhar Repayment
              </DialogTitle>
              <DialogDescription className="text-xs">
                Buyer: <strong className="text-foreground">{repaymentBuyer?.customerName}</strong> (
                {repaymentBuyer?.buyerId}) • Phone: {repaymentBuyer?.customerPhone || "N/A"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitRepayment} className="space-y-4 py-2">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Total Udhar Debt:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 font-mono text-sm">
                    {fmt(repaymentBuyer?.outstandingUdhar || 0)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Amount Received ({symbol}) *</Label>
                <Input
                  type="number"
                  min="1"
                  step="any"
                  value={repaymentAmount}
                  onChange={(e) => setRepaymentAmount(e.target.value)}
                  placeholder="Enter repayment amount"
                  required
                  autoFocus
                  className="h-10 rounded-xl text-base font-bold font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Payment Method</Label>
                  <Select value={repaymentMethod} onValueChange={setRepaymentMethod}>
                    <SelectTrigger className="h-10 rounded-xl text-xs font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="Online Payment">Online Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Reference / Receipt #</Label>
                  <Input
                    value={repaymentRef}
                    onChange={(e) => setRepaymentRef(e.target.value)}
                    placeholder="e.g. REP-10482"
                    className="h-10 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Notes / Slip Details</Label>
                <Input
                  value={repaymentNote}
                  onChange={(e) => setRepaymentNote(e.target.value)}
                  placeholder="e.g. Partial repayment settled at shop counter"
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              <DialogFooter className="border-t border-border pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRepaymentModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingRepayment}
                  className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {submittingRepayment ? "Settling..." : "Confirm Repayment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL 4: BUYER IDENTITY DISAMBIGUATION / SELECTION MODAL                  */}
        {/* ========================================================================= */}
        <Dialog open={disambiguationOpen} onOpenChange={setDisambiguationOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-500" />
                Select Verified Buyer Account
              </DialogTitle>
              <DialogDescription className="text-xs">
                To prevent accidental balance assignments, please pick the exact buyer by Buyer ID or Phone.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-72 overflow-y-auto space-y-2 py-2 pr-1">
              {disambiguationMatches.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No matching buyers registered. Please register the buyer profile first.
                </div>
              ) : (
                disambiguationMatches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setDisambiguationOpen(false);
                      if (disambiguationAction === "deposit") handleOpenDeposit(b);
                      else if (disambiguationAction === "repayment") handleOpenRepayment(b);
                      else handleOpenHistory(b);
                    }}
                    className="w-full text-left p-3 rounded-xl bg-muted/40 hover:bg-sky-500/10 hover:border-sky-500/30 border border-border flex items-center justify-between text-xs transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{b.customerName}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-muted border border-border">
                          {b.buyerId}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {b.customerPhone || "No phone listed"}
                      </p>
                    </div>
                    <div className="text-right">
                      {disambiguationAction === "repayment" ? (
                        <p className="font-mono font-bold text-rose-500">{fmt(b.outstandingUdhar)}</p>
                      ) : (
                        <p className="font-mono font-bold text-emerald-600">{fmt(b.availableDeposit)}</p>
                      )}
                      <span className="text-[10px] text-sky-500 font-semibold">Select →</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <DialogFooter className="border-t border-border pt-3">
              <Button
                variant="outline"
                onClick={() => setDisambiguationOpen(false)}
                className="rounded-xl text-xs"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL 5: STATEMENT / KHATA HISTORY                                       */}
        {/* ========================================================================= */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <History className="w-5 h-5 text-sky-500" />
                  Khata Statement: {historyBuyer?.customerName || "Customer"} ({historyBuyer?.buyerId})
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => historyBuyer && handleShareStatement(historyBuyer)}
                  className="rounded-xl text-xs font-semibold gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" /> Share
                </Button>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Audit trail of credit issued, payments received, and advance deposits.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-muted/40 border border-border text-xs">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">OUTSTANDING UDHAR</p>
                <p className="text-base font-extrabold text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                  {fmt(historyBuyer?.outstandingUdhar || 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">AVAILABLE DEPOSIT</p>
                <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                  {fmt(historyBuyer?.availableDeposit || 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">CREDIT LIMIT</p>
                <p className="text-base font-extrabold text-foreground font-mono mt-0.5">
                  {fmt(historyBuyer?.creditLimit || 0)}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 py-2 pr-1">
              {!historyBuyer?.transactions || historyBuyer.transactions.length === 0 ? (
                <p className="text-center py-8 text-xs text-muted-foreground">No ledger transactions recorded yet.</p>
              ) : (
                historyBuyer.transactions.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-2xl bg-muted/30 border border-border flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          t.type === "deposit_add" || t.type === "udhar_repayment" || t.type === "payment"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-rose-500/10 text-rose-500"
                        }`}
                      >
                        {t.type === "deposit_add" || t.type === "udhar_repayment" || t.type === "payment" ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">
                            {t.type === "deposit_add"
                              ? "Deposit Added"
                              : t.type === "deposit_spend"
                              ? "Deposit Used (Purchase)"
                              : t.type === "udhar_repayment" || t.type === "payment"
                              ? "Udhar Repaid"
                              : "Udhar Charged (+)"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{t.paymentMethod || "Cash"}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{t.note || "No note recorded"}</p>
                        {t.referenceId && (
                          <p className="text-[10px] font-mono text-muted-foreground">Ref: {t.referenceId}</p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <p
                        className={`font-black font-mono text-sm ${
                          t.type === "deposit_add" || t.type === "udhar_repayment" || t.type === "payment"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {t.type === "deposit_add" || t.type === "udhar_repayment" || t.type === "payment" ? "+" : "-"}
                        {fmt(t.amount)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <DialogFooter className="border-t border-border pt-3">
              <Button variant="outline" onClick={() => setHistoryOpen(false)} className="rounded-xl text-xs">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL 6: THERMAL-READY PRINTABLE RECEIPT                                   */}
        {/* ========================================================================= */}
        <Dialog open={receiptModalOpen} onOpenChange={setReceiptModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-500" />
                  Transaction Receipt
                </span>
                <Button
                  onClick={handlePrintReceipt}
                  size="sm"
                  className="rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </Button>
              </DialogTitle>
            </DialogHeader>

            {receiptData && (
              <div
                id="thermal-receipt"
                className="p-5 rounded-xl border border-dashed border-border bg-card text-foreground font-mono text-xs space-y-3"
              >
                {/* Store Header */}
                <div className="text-center border-b border-border pb-3">
                  <h3 className="font-extrabold text-base tracking-tight">{active?.business_name || "GEFLOW STORE"}</h3>
                  <p className="text-[10px] text-muted-foreground">{active?.business_address || "Retail Branch"}</p>
                  <p className="text-[10px] text-muted-foreground">Tel: {active?.business_phone || "+1 800 GEFLOW"}</p>
                </div>

                {/* Receipt Title */}
                <div className="text-center font-bold text-xs uppercase tracking-wider py-1 bg-muted/40 rounded">
                  {receiptData.title}
                </div>

                {/* Details */}
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Receipt No:</span>
                    <span className="font-bold">{receiptData.refNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span>{new Date(receiptData.date).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Buyer ID:</span>
                    <span className="font-bold">{receiptData.buyer.buyerId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Buyer Name:</span>
                    <span className="font-bold">{receiptData.buyer.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Mode:</span>
                    <span>{receiptData.paymentMethod}</span>
                  </div>
                </div>

                {/* Amount Box */}
                <div className="p-3 rounded-lg bg-muted/60 border border-border flex justify-between items-center text-sm">
                  <span className="font-bold">Amount Transacted:</span>
                  <span className="font-extrabold text-base">{fmt(receiptData.amount)}</span>
                </div>

                {/* Balances After */}
                <div className="border-t border-border pt-2 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Available Deposit Balance:</span>
                    <span className="font-bold text-emerald-600">{fmt(receiptData.depositBalanceAfter)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remaining Outstanding Udhar:</span>
                    <span className="font-bold text-rose-500">{fmt(receiptData.udharBalanceAfter)}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="text-center text-[10px] text-muted-foreground border-t border-border pt-2">
                  <p>Thank you for doing business with us!</p>
                  <p className="mt-0.5">Powered by GeFlow AI POS</p>
                </div>
              </div>
            )}

            <DialogFooter className="border-t border-border pt-3 flex justify-between items-center">
              <Button
                variant="outline"
                onClick={() => setReceiptModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Close
              </Button>
              <Button
                onClick={() => receiptData && handleShareStatement(receiptData.buyer)}
                className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" /> Share WhatsApp Slip
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </UserPanelGate>
  );
}
