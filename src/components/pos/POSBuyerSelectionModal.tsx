import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Search,
  User,
  Phone,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Loader2,
  Wallet,
  FileText,
  Check,
} from "lucide-react";
import { useMoney } from "@/lib/currency";

export interface POSBuyerAccount {
  id: string;
  buyerId: string;
  customerName: string;
  customerPhone?: string;
  creditLimit: number;
  availableDeposit: number;
  outstandingUdhar: number;
  notes?: string;
}

interface POSBuyerSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  selectedBuyer: POSBuyerAccount | null;
  onSelectBuyer: (buyer: POSBuyerAccount) => void;
  requiredForPayment?: "deposit" | "udhar" | null;
}

export const POSBuyerSelectionModal: React.FC<POSBuyerSelectionModalProps> = ({
  open,
  onOpenChange,
  businessId,
  selectedBuyer,
  onSelectBuyer,
  requiredForPayment,
}) => {
  const { format: fmt } = useMoney();
  const [activeTab, setActiveTab] = useState<"search" | "create">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [buyers, setBuyers] = useState<POSBuyerAccount[]>([]);
  const [loading, setLoading] = useState(false);

  // New buyer form
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newLimit, setNewLimit] = useState("50000");
  const [newDeposit, setNewDeposit] = useState("0");
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchBuyers = useCallback(async (query: string = "") => {
    if (!businessId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const q = encodeURIComponent(query.trim());
      const res = await fetch(
        `/api/sync/store-credits/search?businessId=${encodeURIComponent(businessId)}&q=${q}`
      );
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json.buyers)
          ? json.buyers
          : Array.isArray(json.credits)
          ? json.credits
          : [];

        const normalized: POSBuyerAccount[] = list.map((b: any) => ({
          id: b.id,
          buyerId: b.buyerId || b.buyer_id || `BUY-${b.id.slice(-5)}`,
          customerName: b.customerName || b.customer_name || "Unknown Buyer",
          customerPhone: b.customerPhone || b.customer_phone || "",
          creditLimit: Number(b.creditLimit ?? b.credit_limit ?? 50000),
          availableDeposit: Number(b.availableDeposit ?? b.available_deposit ?? 0),
          outstandingUdhar: Number(
            b.outstandingUdhar ?? b.outstanding_udhar ?? b.balance ?? 0
          ),
          notes: b.notes || "",
        }));

        setBuyers(normalized);
      }
    } catch (err: any) {
      console.warn("Notice fetching buyers:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (open) {
      fetchBuyers(searchQuery);
    }
  }, [open, searchQuery, fetchBuyers]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    fetchBuyers(val);
  };

  // Ambiguity / Duplicate detection:
  // Check if multiple buyers share the same lowercased name
  const duplicateNameGroups = useMemo(() => {
    const counts = new Map<string, number>();
    buyers.forEach((b) => {
      const n = b.customerName.trim().toLowerCase();
      if (n) counts.set(n, (counts.get(n) || 0) + 1);
    });
    return counts;
  }, [buyers]);

  const handleCreateBuyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setErrorMsg("Buyer name is required.");
      return;
    }
    if (!newPhone.trim()) {
      setErrorMsg("Registered phone number is required for buyer verification.");
      return;
    }
    setCreating(true);
    setErrorMsg(null);

    try {
      const initialDeposit = Math.max(0, Number(newDeposit) || 0);
      const res = await fetch("/api/sync/store-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          credit: {
            customerName: newName.trim(),
            customerPhone: newPhone.trim(),
            creditLimit: Math.max(0, Number(newLimit) || 50000),
            availableDeposit: initialDeposit,
            outstandingUdhar: 0,
            notes: "Created from POS checkout",
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to create buyer account.");
      }

      const createdJson = await res.json();
      const b = createdJson.credit;
      const createdBuyer: POSBuyerAccount = {
        id: b.id,
        buyerId: b.buyerId || b.buyer_id || `BUY-${b.id.slice(-5)}`,
        customerName: b.customerName || b.customer_name,
        customerPhone: b.customerPhone || b.customer_phone,
        creditLimit: Number(b.creditLimit ?? b.credit_limit ?? 50000),
        availableDeposit: Number(b.availableDeposit ?? b.available_deposit ?? initialDeposit),
        outstandingUdhar: 0,
        notes: b.notes,
      };

      onSelectBuyer(createdBuyer);
      onOpenChange(false);
      setNewName("");
      setNewPhone("");
      setNewDeposit("0");
    } catch (err: any) {
      setErrorMsg(err.message || "Could not create buyer account.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[88vh] flex flex-col p-0 overflow-hidden bg-card border-border shadow-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                Verified Buyer Account (Store Credit &amp; Udhar)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Verify buyer identity by Buyer ID or registered Phone. Never assign balance based on name alone.
              </DialogDescription>
            </div>
          </div>

          {requiredForPayment && (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {requiredForPayment === "deposit"
                  ? "Select a verified buyer account with available deposit balance to complete checkout."
                  : "Select a verified buyer account to record this sale as unpaid Store Credit (Udhar)."}
              </span>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab("search")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === "search"
                  ? "bg-foreground text-background shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Search Existing Buyers
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("create")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "create"
                  ? "bg-foreground text-background shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Register New Buyer Profile
            </button>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === "search" ? (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search by Buyer ID (e.g. BUY-10023), Phone, or Name..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                />
              </div>

              {/* Duplicate Name Disambiguation Alert */}
              {Array.from(duplicateNameGroups.entries()).some(([, count]) => count > 1) && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Ambiguity Warning: Multiple buyers share matching names</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-600/90 dark:text-amber-400/90">
                    Always confirm the unique <strong>Buyer ID</strong> or <strong>phone number</strong> with the customer before charging credit or spending advance deposits.
                  </p>
                </div>
              )}

              {/* Buyer List */}
              <div className="space-y-2">
                {loading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                    <p className="text-xs">Searching buyer ledger...</p>
                  </div>
                ) : buyers.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                    <User className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-semibold text-xs text-foreground">No buyers found</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      No customer account matching &quot;{searchQuery}&quot;. Register a new buyer profile above.
                    </p>
                  </div>
                ) : (
                  buyers.map((buyer) => {
                    const isSelected = selectedBuyer?.id === buyer.id;
                    const isDuplicate =
                      (duplicateNameGroups.get(buyer.customerName.trim().toLowerCase()) || 0) > 1;

                    return (
                      <div
                        key={buyer.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? "bg-sky-500/10 border-sky-500/40"
                            : isDuplicate
                            ? "bg-card hover:bg-muted/30 border-amber-500/30"
                            : "bg-card hover:bg-muted/30 border-border"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-foreground">
                                {buyer.customerName}
                              </span>
                              <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {buyer.buyerId}
                              </span>
                              {isDuplicate && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                  Duplicate Name
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-muted-foreground/60" />
                              {buyer.customerPhone || "No registered phone"}
                            </p>

                            {/* Balance Badges */}
                            <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px]">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                                <Wallet className="w-3 h-3" />
                                Available Deposit: {fmt(buyer.availableDeposit)}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold font-mono">
                                <FileText className="w-3 h-3" />
                                Outstanding Udhar: {fmt(buyer.outstandingUdhar)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                (Limit: {fmt(buyer.creditLimit)})
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 self-end sm:self-center">
                            {isSelected ? (
                              <span className="h-8 px-3 rounded-lg bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5" /> Selected
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => {
                                  onSelectBuyer(buyer);
                                  onOpenChange(false);
                                }}
                                className="h-8 px-3 rounded-lg text-xs font-bold bg-foreground hover:bg-foreground/90 text-background cursor-pointer"
                              >
                                Select Buyer
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateBuyer} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20 text-xs text-sky-700 dark:text-sky-300">
                <p className="font-semibold">Quick Buyer Registration</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Creates an authentic profile with an auto-generated unique Buyer ID and separate deposit/udhar ledgers.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Full Buyer / Patient Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Tariq Mehmood"
                  className="w-full h-9 px-3 rounded-xl bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Verified Mobile / WhatsApp Number *
                </label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. +92 300 1234567"
                  className="w-full h-9 px-3 rounded-xl bg-background border border-border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                    Credit Limit ({fmt(0).slice(0, 3).trim()})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newLimit}
                    onChange={(e) => setNewLimit(e.target.value)}
                    placeholder="50000"
                    className="w-full h-9 px-3 rounded-xl bg-background border border-border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                    Initial Advance Deposit (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newDeposit}
                    onChange={(e) => setNewDeposit(e.target.value)}
                    placeholder="0"
                    className="w-full h-9 px-3 rounded-xl bg-background border border-border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab("search")}
                  className="h-9 px-4 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  size="sm"
                  className="h-9 px-4 text-xs font-bold bg-foreground text-background hover:bg-foreground/90"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Registering...
                    </>
                  ) : (
                    "Register & Select Buyer"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
