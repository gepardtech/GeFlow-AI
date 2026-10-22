import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileText,
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
  MessageSquare,
  Copy,
  Receipt,
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

interface CreditTransaction {
  id: string;
  type: "charge" | "payment";
  amount: number;
  balanceAfter: number;
  note?: string;
  referenceId?: string;
  createdAt: string;
  recordedBy?: string;
}

interface CustomerStoreCredit {
  id: string;
  businessId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  balance: number;
  creditLimit: number;
  notes?: string;
  transactions: CreditTransaction[];
  createdAt: string;
  updatedAt: string;
}

export default function UserCustomerCredits() {
  const { active, activeId } = useActiveBusiness();
  const { format: fmt, symbol } = useMoney();
  const { toast } = useToast();

  const [credits, setCredits] = useState<CustomerStoreCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "has_balance" | "cleared" | "over_limit">("all");

  // Add Customer Account Modal
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustLimit, setNewCustLimit] = useState("1000");
  const [newCustInitialBalance, setNewCustInitialBalance] = useState("0");
  const [newCustNotes, setNewCustNotes] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Adjust Dialog (+ Udhar or - Payment)
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<"charge" | "payment">("charge");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerStoreCredit | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustRef, setAdjustRef] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // History Statement Modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<CustomerStoreCredit | null>(null);

  const normalizeCredit = useCallback((raw: any): CustomerStoreCredit => {
    const name = raw.customerName || raw.customer_name || "Customer";
    const txs: CreditTransaction[] = Array.isArray(raw.transactions)
      ? raw.transactions.map((t: any) => ({
          id: t.id || `tx_${Math.random().toString(36).slice(2)}`,
          type: t.type === "payment" ? "payment" : "charge",
          amount: Number(t.amount || 0),
          balanceAfter: Number(t.balanceAfter ?? t.balance_after ?? 0),
          note: t.note || "",
          referenceId: t.referenceId || t.reference_id || t.invoice_no || "",
          createdAt: t.createdAt || t.created_at || t.date || new Date().toISOString(),
          recordedBy: t.recordedBy || t.recorded_by || t.processed_by || "Register",
        }))
      : [];

    return {
      id: raw.id,
      businessId: raw.businessId || raw.business_id || "",
      customerName: name,
      customerPhone: raw.customerPhone || raw.customer_phone || "",
      customerEmail: raw.customerEmail || raw.customer_email || "",
      balance: Number(raw.balance || 0),
      creditLimit: Number(raw.creditLimit ?? raw.credit_limit ?? 1000),
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
    const handleUpdate = () => loadCredits();
    window.addEventListener("geflow:store-credit-updated", handleUpdate);
    window.addEventListener("geflow:sales-updated", handleUpdate);
    return () => {
      window.removeEventListener("geflow:store-credit-updated", handleUpdate);
      window.removeEventListener("geflow:sales-updated", handleUpdate);
    };
  }, [loadCredits]);

  // Filtered credits
  const filteredCredits = useMemo(() => {
    return credits.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const cName = (c.customerName || "Customer").toLowerCase();
      const matchQuery =
        !q ||
        cName.includes(q) ||
        (c.customerPhone && c.customerPhone.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q));

      if (!matchQuery) return false;

      if (statusFilter === "has_balance") return c.balance > 0;
      if (statusFilter === "cleared") return c.balance <= 0;
      if (statusFilter === "over_limit") return c.balance > c.creditLimit && c.creditLimit > 0;
      return true;
    });
  }, [credits, searchQuery, statusFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalOutstanding = credits.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
    const totalCustomersWithBalance = credits.filter((c) => c.balance > 0).length;
    const overLimitCount = credits.filter((c) => c.balance > c.creditLimit && c.creditLimit > 0).length;
    const totalPaymentsReceived = credits.reduce((sum, c) => {
      const paid = c.transactions
        .filter((t) => t.type === "payment")
        .reduce((sub, t) => sub + t.amount, 0);
      return sum + paid;
    }, 0);

    return {
      totalOutstanding,
      totalCustomersWithBalance,
      overLimitCount,
      totalPaymentsReceived,
    };
  }, [credits]);

  // Create Customer Account
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId || !newCustName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    setSavingCustomer(true);
    try {
      const res = await fetch("/api/sync/store-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: activeId,
          customerName: newCustName.trim(),
          customerPhone: newCustPhone.trim() || undefined,
          customerEmail: newCustEmail.trim() || undefined,
          creditLimit: parseFloat(newCustLimit) || 0,
          balance: parseFloat(newCustInitialBalance) || 0,
          notes: newCustNotes.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to create customer credit account");
      const data = await res.json();
      if (data.success && data.credit) {
        const normalized = normalizeCredit(data.credit);
        setCredits((prev) => [normalized, ...prev.filter((c) => c.id !== normalized.id)]);
        toast({
          title: "Khata / Store Credit Account Created",
          description: `Customer account for "${normalized.customerName}" is now active.`,
        });
        setAddCustomerOpen(false);
        setNewCustName("");
        setNewCustPhone("");
        setNewCustEmail("");
        setNewCustLimit("1000");
        setNewCustInitialBalance("0");
        setNewCustNotes("");
      }
    } catch (err: any) {
      toast({
        title: "Creation failed",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setSavingCustomer(false);
    }
  };

  // Adjust Balance (+ Udhar or - Payment)
  const handleConfirmAdjust = async () => {
    if (!activeId || !selectedCustomer) return;
    const amountNum = parseFloat(adjustAmount);
    if (!amountNum || amountNum <= 0) {
      toast({ title: "Enter a valid positive amount", variant: "destructive" });
      return;
    }

    setAdjusting(true);
    try {
      const res = await fetch("/api/sync/store-credits/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: activeId,
          creditId: selectedCustomer.id,
          customerId: selectedCustomer.id,
          type: adjustType,
          amount: amountNum,
          note: adjustNote.trim() || (adjustType === "charge" ? "Manual Store Credit Added" : "Manual Customer Payment Recorded"),
          referenceId: adjustRef.trim() || undefined,
          recordedBy: active?.business_name || "Owner",
        }),
      });

      if (!res.ok) throw new Error("Balance adjustment failed");
      const data = await res.json();
      if (data.success && data.credit) {
        const normalized = normalizeCredit(data.credit);
        setCredits((prev) => prev.map((c) => (c.id === normalized.id ? normalized : c)));
        toast({
          title: adjustType === "charge" ? "Credit / Udhar Added" : "Payment Recorded Successfully",
          description: `${fmt(amountNum)} ${adjustType === "charge" ? "charged to" : "collected from"} ${normalized.customerName}. New balance: ${fmt(normalized.balance)}`,
        });
        setAdjustDialogOpen(false);
        setAdjustAmount("");
        setAdjustNote("");
        setAdjustRef("");
      }
    } catch (err: any) {
      toast({
        title: "Adjustment error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setAdjusting(false);
    }
  };

  // Delete Customer Account
  const handleDeleteCustomer = async (id: string, name: string) => {
    const displayName = name || "this customer";
    if (!confirm(`Are you sure you want to remove the credit account for ${displayName}?`)) return;
    try {
      const res = await fetch(`/api/sync/store-credits/${id}?businessId=${encodeURIComponent(activeId || "")}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCredits((prev) => prev.filter((c) => c.id !== id));
        toast({ title: "Account removed", description: `Removed credit profile for ${displayName}.` });
      }
    } catch (err) {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  // WhatsApp / Share reminder
  const handleCopyReminder = (c: CustomerStoreCredit) => {
    const custName = c.customerName || "Customer";
    const text = `Assalam-o-Alaikum / Hello ${custName},\nThis is a polite reminder from ${active?.business_name || "our store"}. Your current outstanding store credit / udhar balance is ${fmt(c.balance)}.\nKindly clear your pending balance at your earliest convenience. Thank you!`;
    navigator.clipboard.writeText(text);
    toast({
      title: "Reminder copied to clipboard! 📋",
      description: "You can now paste and send this via WhatsApp or SMS.",
    });
  };

  return (
    <UserPanelGate title="Store Credit & Customer Udhar Ledger">
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
                <FileText className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                Customer Udhar / Store Credit Ledger
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Track customer khata, grant store credit, record payments, and audit debtor balances for {active?.business_name || "Store"}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadCredits}
              disabled={loading}
              className="h-10 rounded-xl text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={() => setAddCustomerOpen(true)}
              className="h-10 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Customer Account
            </Button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
              <span>Total Outstanding Udhar</span>
              <span className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg">
                <ArrowUpRight className="w-4 h-4" />
              </span>
            </div>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
              {fmt(metrics.totalOutstanding)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Across {metrics.totalCustomersWithBalance} customer accounts
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
              <span>Total Recovered / Paid</span>
              <span className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
                <ArrowDownLeft className="w-4 h-4" />
              </span>
            </div>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {fmt(metrics.totalPaymentsReceived)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Total historical repayments collected
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
              <span>Total Active Accounts</span>
              <span className="p-1.5 bg-sky-500/10 text-sky-500 rounded-lg">
                <User className="w-4 h-4" />
              </span>
            </div>
            <p className="text-2xl font-black text-foreground">
              {credits.length}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Registered khata customers
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
              <span>Over Limit Warning</span>
              <span className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
              </span>
            </div>
            <p className="text-2xl font-black text-amber-500">
              {metrics.overLimitCount}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Customers exceeding assigned credit limit
            </p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-3 rounded-2xl bg-card border border-border">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name, phone, or notes..."
              className="pl-9 h-10 rounded-xl text-xs bg-muted/30"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger className="h-10 rounded-xl text-xs w-full sm:w-44">
                <SelectValue placeholder="Filter balance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts ({credits.length})</SelectItem>
                <SelectItem value="has_balance">Pending Udhar ({metrics.totalCustomersWithBalance})</SelectItem>
                <SelectItem value="cleared">Zero / Cleared Balance</SelectItem>
                <SelectItem value="over_limit">Over Limit ({metrics.overLimitCount})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="rounded-3xl bg-card border border-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Credit Limit</th>
                  <th className="py-3 px-4 text-right">Outstanding Balance</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4 text-right">Khata Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCredits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <p className="font-semibold text-sm">No Store Credit / Udhar records found</p>
                      <p className="text-xs mt-1">Create a new customer account or select "Store Credit" at POS checkout.</p>
                      <Button
                        size="sm"
                        onClick={() => setAddCustomerOpen(true)}
                        className="mt-4 rounded-xl text-xs bg-sky-500 hover:bg-sky-600 text-white font-bold"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Customer Account
                      </Button>
                    </td>
                  </tr>
                ) : (
                  filteredCredits.map((c) => {
                    const isOverLimit = c.balance > c.creditLimit && c.creditLimit > 0;
                    const hasPending = c.balance > 0;
                    return (
                      <tr key={c.id} className="hover:bg-muted/30 transition">
                        <td className="py-3.5 px-4 font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold text-xs uppercase">
                              {(c.customerName || "Customer").charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-foreground">{c.customerName || "Customer"}</p>
                              {c.notes && <p className="text-[10px] text-muted-foreground line-clamp-1">{c.notes}</p>}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-muted-foreground">
                          <div className="space-y-0.5">
                            {c.customerPhone && (
                              <p className="flex items-center gap-1 font-mono text-[11px] text-foreground">
                                <Phone className="w-3 h-3 text-muted-foreground" /> {c.customerPhone}
                              </p>
                            )}
                            {c.customerEmail && (
                              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Mail className="w-3 h-3" /> {c.customerEmail}
                              </p>
                            )}
                            {!c.customerPhone && !c.customerEmail && <span className="text-[10px] italic">No contact added</span>}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-medium text-muted-foreground">
                          {c.creditLimit > 0 ? fmt(c.creditLimit) : "No Limit"}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex flex-col items-end">
                            <span
                              className={`text-sm font-black font-mono ${
                                hasPending
                                  ? isOverLimit
                                    ? "text-amber-500"
                                    : "text-rose-600 dark:text-rose-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              {fmt(c.balance)}
                            </span>
                            {isOverLimit && (
                              <span className="text-[9px] font-bold uppercase text-amber-500 flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" /> Over Limit
                              </span>
                            )}
                            {!hasPending && (
                              <span className="text-[9px] font-bold uppercase text-emerald-500 flex items-center gap-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" /> All Cleared
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            {new Date(c.updatedAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedCustomer(c);
                                setAdjustType("charge");
                                setAdjustDialogOpen(true);
                              }}
                              className="h-8 px-2 rounded-xl text-[11px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-500/20"
                            >
                              <Plus className="w-3 h-3 mr-0.5" /> Add Udhar
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedCustomer(c);
                                setAdjustType("payment");
                                setAdjustDialogOpen(true);
                              }}
                              className="h-8 px-2 rounded-xl text-[11px] font-bold text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/20"
                            >
                              <ArrowDownLeft className="w-3 h-3 mr-0.5" /> Payment
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setHistoryCustomer(c);
                                setHistoryOpen(true);
                              }}
                              title="View Khata Statement"
                              className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground"
                            >
                              <History className="w-4 h-4" />
                            </Button>

                            {c.balance > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCopyReminder(c)}
                                title="Copy WhatsApp Reminder"
                                className="h-8 w-8 p-0 rounded-xl text-sky-500 hover:bg-sky-500/10"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteCustomer(c.id, c.customerName)}
                              title="Delete Account"
                              className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

        {/* Modal: New Customer Account */}
        <Dialog open={addCustomerOpen} onOpenChange={setAddCustomerOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <User className="w-4 h-4 text-sky-500" />
                Add Customer Udhar / Credit Account
              </DialogTitle>
              <DialogDescription className="text-xs">
                Register a customer profile for assigning store credit, managing running ledger balances, and POS checkout.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateCustomer} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Customer Full Name *</Label>
                <Input
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Tariq Mehmood / Apex Enterprises"
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Phone Number</Label>
                  <Input
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="0300-1234567"
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Email (Optional)</Label>
                  <Input
                    type="email"
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    placeholder="buyer@domain.com"
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Credit Limit ({symbol})</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={newCustLimit}
                    onChange={(e) => setNewCustLimit(e.target.value)}
                    placeholder="1000"
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Initial Balance ({symbol})</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={newCustInitialBalance}
                    onChange={(e) => setNewCustInitialBalance(e.target.value)}
                    placeholder="0"
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Customer Address / Note</Label>
                <Textarea
                  value={newCustNotes}
                  onChange={(e) => setNewCustNotes(e.target.value)}
                  placeholder="e.g. Shop # 4, Main Bazaar. Regular wholesale buyer."
                  rows={2}
                  className="rounded-xl text-xs resize-none"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setAddCustomerOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingCustomer}
                  className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold"
                >
                  {savingCustomer ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : null}
                  Create Account
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal: Adjust Balance (+ Udhar or - Payment) */}
        <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                {adjustType === "charge" ? (
                  <ArrowUpRight className="w-5 h-5 text-rose-500" />
                ) : (
                  <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                )}
                {adjustType === "charge" ? "Grant Store Credit / Add Udhar" : "Record Customer Payment / Vasooli"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Customer: <strong>{selectedCustomer?.customerName || "Customer"}</strong> &bull; Current Balance:{" "}
                <span className="font-bold text-foreground font-mono">{fmt(selectedCustomer?.balance || 0)}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">
                  {adjustType === "charge" ? "Credit Amount to Add *" : "Payment Amount Received *"}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm">
                    {symbol}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    autoFocus
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-8 h-11 text-base font-bold font-mono rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Reason / Description</Label>
                <Input
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder={
                    adjustType === "charge"
                      ? "e.g. Purchased items on credit / Slip #104"
                      : "e.g. Cash received in store / Online bank transfer"
                  }
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Reference / Slip Number (Optional)</Label>
                <Input
                  value={adjustRef}
                  onChange={(e) => setAdjustRef(e.target.value)}
                  placeholder="e.g. RCPT-49021 or CHQ-0012"
                  className="h-10 rounded-xl text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdjustDialogOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button
                onClick={handleConfirmAdjust}
                disabled={adjusting}
                className={`rounded-xl font-bold text-white ${
                  adjustType === "charge" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {adjusting ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : null}
                {adjustType === "charge" ? "Confirm Add Udhar" : "Confirm Record Payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Statement & Ledger History */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-sky-500" />
                Khata Statement: {historyCustomer?.customerName || "Customer"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Audit history of credit issued and payments made. Current Balance:{" "}
                <strong className="text-rose-500 font-mono">{fmt(historyCustomer?.balance || 0)}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
              {!historyCustomer?.transactions || historyCustomer.transactions.length === 0 ? (
                <p className="text-center py-8 text-xs text-muted-foreground">No transaction entries on record yet.</p>
              ) : (
                <div className="space-y-2">
                  {historyCustomer.transactions.map((t) => (
                    <div
                      key={t.id}
                      className="p-3.5 rounded-2xl bg-muted/40 border border-border flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            t.type === "charge"
                              ? "bg-rose-500/10 text-rose-500"
                              : "bg-emerald-500/10 text-emerald-500"
                          }`}
                        >
                          {t.type === "charge" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-bold text-foreground">
                            {t.type === "charge" ? "Credit Given (+ Udhar)" : "Payment Received (- Vasooli)"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{t.note || "No note recorded"}</p>
                          {t.referenceId && (
                            <p className="text-[10px] font-mono text-muted-foreground">Ref: {t.referenceId}</p>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={`font-black font-mono text-sm ${
                            t.type === "charge" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {t.type === "charge" ? "+" : "-"} {fmt(t.amount)}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          Bal: {fmt(t.balanceAfter)}
                        </p>
                        <p className="text-[9px] text-muted-foreground">
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
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="border-t border-border pt-3">
              <Button variant="outline" onClick={() => setHistoryOpen(false)} className="rounded-xl text-xs">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </UserPanelGate>
  );
}
