import { useState, useEffect, useMemo, useCallback } from "react";
import {
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
  Printer,
  History,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Calendar,
  DollarSign,
  Undo2,
  FileText,
  BadgeAlert,
  Loader2,
} from "lucide-react";
import UserPanelGate from "@/components/UserPanelGate";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { useMoney } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ReturnRecord,
  ReturnItem,
  SaleWithItems,
  fetchReturnsHistory,
  findSaleForReturn,
  fetchRecentSalesForReturn,
  executeReturnTransaction,
} from "@/lib/returnsService";
import { ReturnReceiptModal } from "@/components/returns/ReturnReceiptModal";
import { supabase } from "@/integrations/supabase/client";

interface ItemReturnState {
  productId?: string | null;
  productName: string;
  originalQty: number;
  returnQty: number;
  unitPrice: number;
  unitCost: number;
  reason: "damaged" | "expired" | "wrong_item" | "customer_change_mind" | "other";
  restock: boolean;
}

export default function UserReturns() {
  const { active, activeId } = useActiveBusiness();
  const { format: fmt, symbol } = useMoney();
  const { toast } = useToast();

  const [tab, setTab] = useState<"new" | "history">("new");
  const [searchSaleQuery, setSearchSaleQuery] = useState("");
  const [isSearchingSale, setIsSearchingSale] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null);
  const [recentSales, setRecentSales] = useState<SaleWithItems[]>([]);
  const [returnItemsState, setReturnItemsState] = useState<Record<string, ItemReturnState>>({});

  // Refund Meta
  const [refundMethod, setRefundMethod] = useState("cash");
  const [customerName, setCustomerName] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // History & Receipt Modal
  const [historyRecords, setHistoryRecords] = useState<ReturnRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [activeReceiptRecord, setActiveReceiptRecord] = useState<ReturnRecord | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Load Recent Sales and Returns History
  const loadInitialData = useCallback(async () => {
    if (!activeId) return;
    setIsLoadingHistory(true);
    try {
      const [history, recent] = await Promise.all([
        fetchReturnsHistory(activeId),
        fetchRecentSalesForReturn(activeId, 15),
      ]);
      setHistoryRecords(history);
      setRecentSales(recent);
    } catch (err) {
      console.warn("Notice loading returns data:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [activeId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Listen for updates from other tabs/processes
  useEffect(() => {
    const handleUpdate = () => {
      if (activeId) {
        fetchReturnsHistory(activeId).then(setHistoryRecords);
      }
    };
    window.addEventListener("geflow:returns-updated", handleUpdate);
    return () => window.removeEventListener("geflow:returns-updated", handleUpdate);
  }, [activeId]);

  // Handle Search for a specific sale
  const handleSearchSale = async (queryToUse?: string) => {
    const q = queryToUse !== undefined ? queryToUse : searchSaleQuery;
    if (!activeId || !q.trim()) {
      toast({ title: "Please enter a Sale ID or Invoice number", variant: "destructive" });
      return;
    }
    setIsSearchingSale(true);
    try {
      const found = await findSaleForReturn(activeId, q.trim());
      if (found) {
        setSelectedSale(found);
        // Initialize item state
        const initialStates: Record<string, ItemReturnState> = {};
        found.items.forEach((item) => {
          initialStates[item.id] = {
            productId: item.product_id,
            productName: item.product_name,
            originalQty: item.quantity,
            returnQty: 0,
            unitPrice: item.unit_price,
            unitCost: item.unit_cost,
            reason: "customer_change_mind",
            restock: true,
          };
        });
        setReturnItemsState(initialStates);
        toast({ title: `Sale #${found.id} loaded (${found.items.length} item types)` });
      } else {
        toast({
          title: "Sale not found",
          description: `No completed sale found matching "${q}". Check the ID or select from recent sales below.`,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({ title: "Error finding sale", variant: "destructive" });
    } finally {
      setIsSearchingSale(false);
    }
  };

  // Select from recent sales list
  const handleSelectRecentSale = (sale: SaleWithItems) => {
    setSearchSaleQuery(sale.id);
    setSelectedSale(sale);
    const initialStates: Record<string, ItemReturnState> = {};
    sale.items.forEach((item) => {
      initialStates[item.id] = {
        productId: item.product_id,
        productName: item.product_name,
        originalQty: item.quantity,
        returnQty: 0,
        unitPrice: item.unit_price,
        unitCost: item.unit_cost,
        reason: "customer_change_mind",
        restock: true,
      };
    });
    setReturnItemsState(initialStates);
  };

  // Update return state for an individual item
  const updateItemReturn = (itemId: string, updates: Partial<ItemReturnState>) => {
    setReturnItemsState((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      const next = { ...current, ...updates };

      // Auto toggle restock when reason changes
      if (updates.reason) {
        if (updates.reason === "damaged" || updates.reason === "expired") {
          next.restock = false;
        } else {
          next.restock = true;
        }
      }

      // Clamp returnQty between 0 and originalQty
      if (updates.returnQty !== undefined) {
        next.returnQty = Math.max(0, Math.min(updates.returnQty, next.originalQty));
      }

      return { ...prev, [itemId]: next };
    });
  };

  // Calculate totals
  const totalReturnQty = useMemo(() => {
    return Object.values(returnItemsState).reduce((s, it) => s + it.returnQty, 0);
  }, [returnItemsState]);

  const totalRefundAmount = useMemo(() => {
    return Object.values(returnItemsState).reduce((s, it) => s + it.returnQty * it.unitPrice, 0);
  }, [returnItemsState]);

  // Submit return
  const handleProcessReturn = async () => {
    if (!activeId || !selectedSale) return;
    if (totalReturnQty <= 0) {
      toast({
        title: "No items selected for return",
        description: "Please specify a return quantity of at least 1 for one or more items.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData.user?.id;

      // Filter only items with returnQty > 0
      const itemsToReturn: ReturnItem[] = Object.values(returnItemsState)
        .filter((it) => it.returnQty > 0)
        .map((it) => ({
          product_id: it.productId,
          product_name: it.productName,
          original_qty: it.originalQty,
          return_qty: it.returnQty,
          unit_price: it.unitPrice,
          unit_cost: it.unitCost,
          refund_amount: it.returnQty * it.unitPrice,
          reason: it.reason,
          restock: it.restock,
        }));

      const record = await executeReturnTransaction({
        businessId: activeId,
        saleId: selectedSale.id,
        customerName: customerName.trim() || undefined,
        cashierName: selectedSale.processed_by || "Staff",
        refundMethod,
        reason: itemsToReturn[0]?.reason || "Customer Return",
        notes: returnNotes.trim() || undefined,
        items: itemsToReturn,
        userId: currentUserId,
      });

      toast({
        title: "Return & refund processed! 🧾",
        description: `Refund of ${fmt(totalRefundAmount)} logged. Stock updated and return voucher generated.`,
      });

      // Update history list
      setHistoryRecords((prev) => [record, ...prev]);

      // Show receipt modal
      setActiveReceiptRecord(record);
      setReceiptModalOpen(true);

      // Reset form
      setSelectedSale(null);
      setSearchSaleQuery("");
      setReturnItemsState({});
      setCustomerName("");
      setReturnNotes("");
    } catch (err: any) {
      toast({
        title: "Failed to process return",
        description: err.message || "An unexpected error occurred while recording the return.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter history records
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return historyRecords;
    const q = historySearch.toLowerCase();
    return historyRecords.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.sale_id.toLowerCase().includes(q) ||
        (r.customer_name && r.customer_name.toLowerCase().includes(q)) ||
        (r.cashier_name && r.cashier_name.toLowerCase().includes(q)) ||
        r.items.some((it) => it.product_name.toLowerCase().includes(q))
    );
  }, [historyRecords, historySearch]);

  return (
    <UserPanelGate pageTitle="Returns & Refunds" module="pos">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              <Undo2 className="w-7 h-7 text-sky-500" />
              Returns & Refunds
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Process customer item returns, calculate refunds, restore inventory, and track return histories.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="inline-flex p-1 rounded-xl bg-muted/60 border border-border shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTab("new")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                tab === "new"
                  ? "bg-foreground text-background shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New Return
            </button>
            <button
              type="button"
              onClick={() => setTab("history")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                tab === "history"
                  ? "bg-foreground text-background shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Return History
              {historyRecords.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-sky-500/20 text-sky-600 dark:text-sky-400 font-extrabold">
                  {historyRecords.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab 1: New Return Flow */}
        {tab === "new" && (
          <div className="space-y-6">
            {/* Step 1: Sale Search & Selection Box */}
            <div className="p-4 sm:p-6 rounded-2xl bg-card border border-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
                <div>
                  <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                    <Search className="w-4 h-4 text-sky-500" />
                    Step 1: Locate Original Sale
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Enter the receipt Sale ID or select from recent completed sales.
                  </p>
                </div>
                {selectedSale && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedSale(null);
                      setSearchSaleQuery("");
                      setReturnItemsState({});
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer self-start"
                  >
                    Change Sale
                  </Button>
                )}
              </div>

              {!selectedSale ? (
                <div className="space-y-4 pt-1">
                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="text"
                        value={searchSaleQuery}
                        onChange={(e) => setSearchSaleQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSearchSale();
                        }}
                        placeholder="Enter Sale ID / Receipt number (e.g. sale_171...)"
                        className="pl-9 h-10 text-sm font-semibold rounded-xl bg-muted/40 border-border"
                      />
                    </div>
                    <Button
                      onClick={() => handleSearchSale()}
                      disabled={isSearchingSale || !searchSaleQuery.trim()}
                      className="h-10 px-5 text-xs font-bold rounded-xl gap-1.5 cursor-pointer shrink-0"
                    >
                      {isSearchingSale ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      Lookup Sale
                    </Button>
                  </div>

                  {/* Quick Select from Recent Sales */}
                  {recentSales.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                        Recent Completed Sales
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {recentSales.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => handleSelectRecentSale(s)}
                            className="p-3 rounded-xl bg-muted/30 hover:bg-muted/60 border border-border/80 transition cursor-pointer flex flex-col justify-between gap-2 group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-extrabold text-foreground group-hover:text-sky-500 transition">
                                #{s.id.slice(0, 16)}...
                              </span>
                              <span className="text-xs font-black text-emerald-500">
                                {fmt(s.total)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>{s.items.length} item(s)</span>
                              <span>{new Date(s.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Selected Sale Overview Banner */
                <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">Sale #{selectedSale.id}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        {selectedSale.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Processed by: <strong className="text-foreground">{selectedSale.processed_by || "Cashier"}</strong> ·{" "}
                      Date: {new Date(selectedSale.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase">Original Total</div>
                    <div className="text-base font-black text-sky-500">{fmt(selectedSale.total)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Return Items Config & Refund Summary */}
            {selectedSale && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Products Return List */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="p-4 sm:p-6 rounded-2xl bg-card border border-border space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                        <Package className="w-4 h-4 text-sky-500" />
                        Step 2: Select Items to Return
                      </h2>
                      <span className="text-xs font-bold text-muted-foreground">
                        {selectedSale.items.length} Line Item(s)
                      </span>
                    </div>

                    <div className="space-y-3">
                      {selectedSale.items.map((item) => {
                        const itemState = returnItemsState[item.id] || {
                          returnQty: 0,
                          reason: "customer_change_mind",
                          restock: true,
                        };

                        const isReturning = itemState.returnQty > 0;

                        return (
                          <div
                            key={item.id}
                            className={`p-4 rounded-xl border transition space-y-3 ${
                              isReturning
                                ? "bg-muted/40 border-sky-500/50 shadow-xs"
                                : "bg-card border-border/70 opacity-80"
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <h3 className="font-extrabold text-sm text-foreground">
                                  {item.product_name}
                                </h3>
                                <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                  <span>Sold Qty: <strong>{item.quantity}</strong></span>
                                  <span>·</span>
                                  <span>Unit Price: <strong>{fmt(item.unit_price)}</strong></span>
                                </div>
                              </div>

                              {/* Return Qty Control */}
                              <div className="flex items-center gap-2 self-start sm:self-auto">
                                <span className="text-xs font-bold text-muted-foreground">Return Qty:</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateItemReturn(item.id, {
                                        returnQty: Math.max(0, itemState.returnQty - 1),
                                      })
                                    }
                                    className="w-7 h-7 rounded-lg bg-muted text-foreground flex items-center justify-center font-bold hover:bg-muted/80 cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    max={item.quantity}
                                    value={itemState.returnQty}
                                    onChange={(e) =>
                                      updateItemReturn(item.id, {
                                        returnQty: parseInt(e.target.value) || 0,
                                      })
                                    }
                                    className="w-12 h-7 text-center rounded-lg bg-card border border-border text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateItemReturn(item.id, {
                                        returnQty: Math.min(item.quantity, itemState.returnQty + 1),
                                      })
                                    }
                                    className="w-7 h-7 rounded-lg bg-muted text-foreground flex items-center justify-center font-bold hover:bg-muted/80 cursor-pointer"
                                  >
                                    +
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateItemReturn(item.id, { returnQty: item.quantity })
                                    }
                                    className="px-2 h-7 rounded-lg bg-muted/60 text-[10px] font-bold text-muted-foreground hover:text-foreground cursor-pointer ml-1"
                                  >
                                    Max
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Options if returning */}
                            {isReturning && (
                              <div className="pt-2 border-t border-border/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div>
                                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                                    Return Reason
                                  </label>
                                  <select
                                    value={itemState.reason}
                                    onChange={(e) =>
                                      updateItemReturn(item.id, {
                                        reason: e.target.value as any,
                                      })
                                    }
                                    className="w-full h-8 px-2 rounded-lg bg-card border border-border text-xs font-semibold text-foreground focus:outline-none"
                                  >
                                    <option value="customer_change_mind">Customer Changed Mind</option>
                                    <option value="wrong_item">Wrong Item Delivered</option>
                                    <option value="damaged">Damaged / Broken</option>
                                    <option value="expired">Expired / Past Due</option>
                                    <option value="other">Other Reason</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                                    Inventory Action
                                  </label>
                                  <label className="h-8 px-2 rounded-lg bg-card border border-border flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={itemState.restock}
                                      onChange={(e) =>
                                        updateItemReturn(item.id, {
                                          restock: e.target.checked,
                                        })
                                      }
                                      className="rounded border-border text-sky-500 focus:ring-sky-500"
                                    />
                                    <span>
                                      Restock +{itemState.returnQty} to sellable stock
                                    </span>
                                  </label>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right 1 Col: Refund Tender & Confirmation Sidebar */}
                <div className="space-y-4">
                  <div className="p-4 sm:p-6 rounded-2xl bg-card border border-border space-y-4 sticky top-6">
                    <div className="pb-2 border-b border-border">
                      <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                        Step 3: Refund Details
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Review refund calculations and payment method.
                      </p>
                    </div>

                    {/* Breakdown */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Items to Return</span>
                        <strong className="text-foreground">{totalReturnQty} unit(s)</strong>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Original Sale</span>
                        <strong className="text-foreground">{fmt(selectedSale.total)}</strong>
                      </div>
                      <div className="pt-2 border-t border-border flex items-center justify-between text-sm">
                        <span className="font-extrabold text-foreground">Refund Total</span>
                        <span className="text-xl font-black text-emerald-500">
                          {fmt(totalRefundAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Refund Mode Selection */}
                    <div className="space-y-1.5 pt-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                        Refund Payment Method
                      </label>
                      <select
                        value={refundMethod}
                        onChange={(e) => setRefundMethod(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                      >
                        <option value="cash">Cash Tender</option>
                        <option value="card">Card / POS Reversal</option>
                        <option value="store_credit">Store Credit / Voucher</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="digital_wallet">Digital Wallet (JazzCash / EasyPaisa / UPI)</option>
                      </select>
                    </div>

                    {/* Customer Name */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                        Customer Name (Optional)
                      </label>
                      <Input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="h-8 text-xs font-medium rounded-xl bg-muted/30 border-border"
                      />
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                        Return Notes / Remarks (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={returnNotes}
                        onChange={(e) => setReturnNotes(e.target.value)}
                        placeholder="Add inspection notes or supervisor approval..."
                        className="w-full p-2 text-xs font-medium rounded-xl bg-muted/30 border border-border focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
                      />
                    </div>

                    {/* Submit Button */}
                    <Button
                      id="confirm-return-refund-cta"
                      onClick={handleProcessReturn}
                      disabled={isProcessing || totalReturnQty === 0}
                      className="w-full h-11 text-xs font-extrabold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2 cursor-pointer shadow-sm transition"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Confirm Return & Refund ({fmt(totalRefundAmount)})
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Return History Log */}
        {tab === "history" && (
          <div className="p-4 sm:p-6 rounded-2xl bg-card border border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
              <div>
                <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                  <History className="w-4 h-4 text-sky-500" />
                  Return & Refund Records
                </h2>
                <p className="text-xs text-muted-foreground">
                  Complete audit log of returned items, refund amounts, restocked inventory, and vouchers.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search returns..."
                  className="pl-8 h-8 text-xs rounded-xl bg-muted/40 border-border"
                />
              </div>
            </div>

            {isLoadingHistory ? (
              <div className="py-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
                <span className="text-xs font-semibold">Loading return history...</span>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground space-y-2">
                <div className="w-12 h-12 rounded-full bg-muted/50 mx-auto flex items-center justify-center text-muted-foreground">
                  <RotateCcw className="w-6 h-6 opacity-60" />
                </div>
                <h3 className="font-extrabold text-sm text-foreground">No Returns Recorded Yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  When customers return merchandise, records will appear here with printable refund vouchers.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTab("new")}
                  className="mt-2 text-xs rounded-xl cursor-pointer"
                >
                  Process First Return
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
                      <th className="py-2.5 px-3">Return ID</th>
                      <th className="py-2.5 px-3">Original Sale</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Items Returned</th>
                      <th className="py-2.5 px-3">Refund Method</th>
                      <th className="py-2.5 px-3 text-right">Refund Total</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredHistory.map((rec) => (
                      <tr key={rec.id} className="hover:bg-muted/30 transition">
                        <td className="py-3 px-3 font-mono font-bold text-foreground">
                          {rec.id}
                        </td>
                        <td className="py-3 px-3 font-mono text-muted-foreground">
                          #{rec.sale_id.slice(0, 14)}...
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">
                          {new Date(rec.created_at).toLocaleDateString()}{" "}
                          <span className="text-[10px] text-muted-foreground/80 block">
                            {new Date(rec.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-foreground max-w-xs truncate">
                            {rec.items.map((it) => `${it.return_qty}x ${it.product_name}`).join(", ")}
                          </div>
                          <span className="text-[10px] text-muted-foreground capitalize">
                            Reason: {rec.reason.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-500/15 text-sky-600 dark:text-sky-400">
                            {rec.refund_method}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-black text-emerald-500">
                          {fmt(rec.total_refund)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setActiveReceiptRecord(rec);
                              setReceiptModalOpen(true);
                            }}
                            className="h-7 px-2.5 text-[11px] font-bold text-sky-500 hover:text-sky-600 gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Voucher
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Printable Return Voucher Modal */}
        <ReturnReceiptModal
          open={receiptModalOpen}
          onOpenChange={setReceiptModalOpen}
          record={activeReceiptRecord}
          businessName={active?.business_name || "Business Store"}
          currencySymbol={symbol}
        />
      </div>
    </UserPanelGate>
  );
}
