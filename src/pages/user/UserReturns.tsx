import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  RotateCcw,
  Search,
  CheckCircle2,
  Package,
  Printer,
  History,
  Calendar,
  DollarSign,
  Undo2,
  Loader2,
  Barcode,
  User,
  Tag,
  Layers,
  FileText,
  Clock,
  RefreshCw,
  Sparkles,
  ArrowRight,
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
  fetchRecentSalesForReturn,
  searchSalesForReturn,
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

type SearchCriterion = "all" | "slip" | "customer" | "product" | "barcode" | "batch";

export default function UserReturns() {
  const { active, activeId } = useActiveBusiness();
  const { format: fmt, symbol } = useMoney();
  const { toast } = useToast();

  const [tab, setTab] = useState<"new" | "history">("new");

  // Search state
  const [searchSaleQuery, setSearchSaleQuery] = useState("");
  const [searchCriterion, setSearchCriterion] = useState<SearchCriterion>("all");
  const [isSearchingSale, setIsSearchingSale] = useState(false);
  const [searchResults, setSearchResults] = useState<SaleWithItems[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Return Transaction State
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
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load Recent Sales and Returns History
  const loadInitialData = useCallback(async (showIndicator = true) => {
    if (!activeId) return;
    if (showIndicator) setIsLoadingHistory(true);
    setIsSyncing(true);
    try {
      const [history, recent] = await Promise.all([
        fetchReturnsHistory(activeId),
        fetchRecentSalesForReturn(activeId, 20),
      ]);
      setHistoryRecords(history);
      setRecentSales(recent);
      setLastSyncedAt(new Date());
    } catch (err) {
      console.warn("Notice loading returns data:", err);
    } finally {
      if (showIndicator) setIsLoadingHistory(false);
      setIsSyncing(false);
    }
  }, [activeId]);

  useEffect(() => {
    loadInitialData(true);
  }, [loadInitialData]);

  // Realtime synchronization: Realtime channel + Periodic polling when on history tab
  useEffect(() => {
    if (!activeId) return;

    // 1. Supabase Postgres changes channel
    const channel = supabase
      .channel(`returns-sync-${activeId}-${Math.random().toString(36).slice(2, 6)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "returns", filter: `business_id=eq.${activeId}` },
        () => loadInitialData(false)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales", filter: `business_id=eq.${activeId}` },
        () => loadInitialData(false)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock_movements", filter: `business_id=eq.${activeId}` },
        () => loadInitialData(false)
      )
      .subscribe();

    // 2. Window event listeners
    const handleSync = () => loadInitialData(false);
    window.addEventListener("geflow:returns-updated", handleSync);
    window.addEventListener("geflow:sales-updated", handleSync);
    window.addEventListener("geflow:products-updated", handleSync);
    window.addEventListener("geflow:stock-updated", handleSync);
    window.addEventListener("storage", handleSync);

    // 3. Periodic polling interval (every 4s) to ensure 100% realtime sync across all sessions
    const interval = setInterval(() => {
      loadInitialData(false);
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("geflow:returns-updated", handleSync);
      window.removeEventListener("geflow:sales-updated", handleSync);
      window.removeEventListener("geflow:products-updated", handleSync);
      window.removeEventListener("geflow:stock-updated", handleSync);
      window.removeEventListener("storage", handleSync);
      clearInterval(interval);
    };
  }, [activeId, loadInitialData]);

  // Execute multi-criteria search
  const handleSearchSale = async (forcedQuery?: string) => {
    const q = forcedQuery !== undefined ? forcedQuery : searchSaleQuery;
    if (!activeId) return;
    if (!q.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearchingSale(true);
    setHasSearched(true);
    try {
      const results = await searchSalesForReturn(activeId, q.trim(), searchCriterion);
      setSearchResults(results);

      // If exactly 1 result found and user was in barcode mode or specific slip mode, auto-select it
      if (results.length === 1 && (searchCriterion === "barcode" || searchCriterion === "slip")) {
        handleSelectSale(results[0]);
        toast({
          title: `Loaded Sale #${results[0].invoice_no || results[0].id}`,
          description: `${results[0].items.length} product line(s) ready for return.`,
        });
      } else if (results.length === 0) {
        toast({
          title: "No sales found",
          description: `No completed sale matched "${q}" for ${searchCriterion.toUpperCase()}. Try another search.`,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({ title: "Error searching sales", variant: "destructive" });
    } finally {
      setIsSearchingSale(false);
    }
  };

  // Select sale for return processing
  const handleSelectSale = (sale: SaleWithItems) => {
    setSelectedSale(sale);
    setCustomerName(sale.customer_name || "");
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

      if (updates.reason) {
        if (updates.reason === "damaged" || updates.reason === "expired") {
          next.restock = false;
        } else {
          next.restock = true;
        }
      }

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

      const slipNumber =
        selectedSale.invoice_no || (selectedSale as any).receipt_no || selectedSale.id;

      const record = await executeReturnTransaction({
        businessId: activeId,
        saleId: selectedSale.id,
        invoiceNo: slipNumber,
        customerName: customerName.trim() || selectedSale.customer_name || "Walk-in Customer",
        cashierName: selectedSale.processed_by || "Staff",
        refundMethod,
        reason: itemsToReturn[0]?.reason || "Customer Return",
        notes: returnNotes.trim() || undefined,
        items: itemsToReturn,
        userId: currentUserId,
        originalSaleTotal: Number(selectedSale.total) || 0,
        originalSaleDate: selectedSale.created_at,
      });

      toast({
        title: "Return & stock restoration completed! 🧾",
        description: `Refund of ${fmt(totalRefundAmount)} recorded. Inventory successfully restored.`,
      });

      // Update history list immediately
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
      setSearchResults([]);
      setHasSearched(false);

      // Reload background sync
      loadInitialData(false);
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

  // Filter history records New to Old
  const filteredHistory = useMemo(() => {
    const list = [...historyRecords].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    if (!historySearch.trim()) return list;
    const q = historySearch.toLowerCase();
    return list.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.sale_id.toLowerCase().includes(q) ||
        (r.invoice_no && r.invoice_no.toLowerCase().includes(q)) ||
        (r.customer_name && r.customer_name.toLowerCase().includes(q)) ||
        (r.cashier_name && r.cashier_name.toLowerCase().includes(q)) ||
        r.items.some(
          (it) =>
            it.product_name.toLowerCase().includes(q) ||
            (it.barcode && it.barcode.toLowerCase().includes(q)) ||
            (it.batch_number && it.batch_number.toLowerCase().includes(q))
        )
    );
  }, [historyRecords, historySearch]);

  const searchPlaceholder = useMemo(() => {
    switch (searchCriterion) {
      case "slip":
        return "Search by Slip No: e.g. GEF-ARCH-5SWQ88";
      case "customer":
        return "Search by Client/Buyer name: e.g. Ali";
      case "product":
        return "Search by Product name: e.g. Coca-Cola";
      case "barcode":
        return "Scan barcode or enter numbers: e.g. 8901234567890";
      case "batch":
        return "Search by Batch No: e.g. B-01 or EXP-2026";
      default:
        return "Search by Slip No (GEF-...), Client (Ali), Product (Coca-Cola), Barcode or Batch...";
    }
  }, [searchCriterion]);

  return (
    <UserPanelGate pageTitle="Returns & Refunds" module="pos">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              <Undo2 className="w-7 h-7 text-sky-500" />
              Returns &amp; Refunds
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Search by Slip No, Client name, Product name, Barcode or Batch No. Realtime inventory restoration.
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
                    Step 1: Search &amp; Locate Original Sale
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Search by Slip No, Client/Buyer name, Product name, Barcode, or Batch No.
                  </p>
                </div>
                {selectedSale && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedSale(null);
                      setReturnItemsState({});
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer self-start"
                  >
                    Change Selected Sale
                  </Button>
                )}
              </div>

              {!selectedSale ? (
                <div className="space-y-4 pt-1">
                  {/* Search Criteria Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1 shrink-0">
                      Search By:
                    </span>
                    {(
                      [
                        { id: "all", label: "All Criteria", icon: Sparkles },
                        { id: "slip", label: "Slip / Receipt #", icon: FileText },
                        { id: "customer", label: "Client / Buyer", icon: User },
                        { id: "product", label: "Product Name", icon: Package },
                        { id: "barcode", label: "Barcode Scan", icon: Barcode },
                        { id: "batch", label: "Batch No", icon: Layers },
                      ] as const
                    ).map((c) => {
                      const Icon = c.icon;
                      const active = searchCriterion === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSearchCriterion(c.id);
                            if (c.id === "barcode") {
                              setTimeout(() => barcodeInputRef.current?.focus(), 50);
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            active
                              ? "bg-sky-500 text-white shadow-xs"
                              : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{c.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Search Input Box */}
                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    <div className="relative flex-1">
                      {searchCriterion === "barcode" ? (
                        <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-500 animate-pulse" />
                      ) : searchCriterion === "customer" ? (
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      ) : searchCriterion === "product" ? (
                        <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      )}
                      <Input
                        ref={barcodeInputRef}
                        type="text"
                        value={searchSaleQuery}
                        onChange={(e) => setSearchSaleQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSearchSale();
                        }}
                        placeholder={searchPlaceholder}
                        className="pl-9 h-10 text-sm font-semibold rounded-xl bg-muted/40 border-border"
                      />
                    </div>
                    <Button
                      onClick={() => handleSearchSale()}
                      disabled={isSearchingSale || !searchSaleQuery.trim()}
                      className="h-10 px-5 text-xs font-bold rounded-xl gap-1.5 cursor-pointer shrink-0 bg-sky-500 hover:bg-sky-600 text-white"
                    >
                      {isSearchingSale ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      Search Sales
                    </Button>
                  </div>

                  {/* Search Results Display */}
                  {hasSearched && (
                    <div className="space-y-2 pt-2 border-t border-border/70">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          Matching Sales Found: {searchResults.length}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setHasSearched(false);
                            setSearchResults([]);
                            setSearchSaleQuery("");
                          }}
                          className="text-[11px] h-6 px-2 text-muted-foreground hover:text-foreground"
                        >
                          Clear Results
                        </Button>
                      </div>

                      {searchResults.length === 0 ? (
                        <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                          No completed sales matched your query. Try searching by Client name (e.g. Ali), Product name (e.g. Coca-Cola), or Slip No.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                          {searchResults.map((s) => {
                            const slipNo = s.invoice_no || (s as any).receipt_no || s.id;
                            return (
                              <div
                                key={s.id}
                                className="p-3.5 rounded-xl bg-card hover:bg-muted/40 border border-border hover:border-sky-500/50 transition flex flex-col justify-between gap-3 group shadow-xs"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-xs font-black text-sky-500 flex items-center gap-1">
                                      <FileText className="w-3.5 h-3.5" />
                                      RECEIPT #: {slipNo}
                                    </span>
                                    <span className="text-xs font-black text-emerald-500">
                                      {fmt(s.total)}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span className="flex items-center gap-1 text-foreground font-semibold">
                                      <User className="w-3 h-3 text-muted-foreground" />
                                      {s.customer_name || "Walk-in Customer"}
                                    </span>
                                    <span>{new Date(s.created_at).toLocaleString()}</span>
                                  </div>

                                  {/* Products Shown as Names */}
                                  <div className="space-y-1 pt-1 border-t border-border/60">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                                      Products:
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {s.items.map((it, idx) => (
                                        <span
                                          key={idx}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted/80 text-foreground border border-border/60"
                                        >
                                          <Package className="w-3 h-3 text-sky-500" />
                                          <span className="font-bold">{it.product_name}</span>
                                          <span className="text-muted-foreground font-normal">
                                            ({it.quantity}x @ {fmt(it.unit_price)})
                                          </span>
                                          {it.barcode && (
                                            <span className="font-mono text-[9px] text-muted-foreground">
                                              [{it.barcode}]
                                            </span>
                                          )}
                                          {it.batch_number && (
                                            <span className="font-mono text-[9px] text-amber-500">
                                              [{it.batch_number}]
                                            </span>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-border/60 flex items-center justify-end">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSelectSale(s)}
                                    className="h-8 px-4 text-xs font-bold rounded-lg bg-sky-500 hover:bg-sky-600 text-white gap-1.5 cursor-pointer shadow-xs"
                                  >
                                    Select for Return
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick Select from Recent Sales */}
                  {!hasSearched && recentSales.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                          Recent Completed Sales (New to Old)
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Click any card to select for return
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {recentSales.map((s) => {
                          const slipNo = s.invoice_no || (s as any).receipt_no || s.id;
                          return (
                            <div
                              key={s.id}
                              onClick={() => handleSelectSale(s)}
                              className="p-3.5 rounded-xl bg-muted/30 hover:bg-muted/60 border border-border/80 hover:border-sky-500/50 transition cursor-pointer flex flex-col justify-between gap-2.5 group shadow-xs"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-xs font-extrabold text-foreground group-hover:text-sky-500 transition flex items-center gap-1">
                                    <FileText className="w-3 h-3 text-sky-500" />
                                    RECEIPT #: {slipNo}
                                  </span>
                                  <span className="text-xs font-black text-emerald-500">
                                    {fmt(s.total)}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                  <span className="font-semibold text-foreground">
                                    {s.customer_name || "Walk-in Customer"}
                                  </span>
                                  <span>{new Date(s.created_at).toLocaleDateString()}</span>
                                </div>

                                {/* Products Shown Prominently as Names */}
                                <div className="pt-1 flex flex-wrap gap-1">
                                  {s.items.map((it, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-background border border-border/60 text-foreground"
                                    >
                                      <Package className="w-2.5 h-2.5 text-sky-500" />
                                      <span className="font-bold">{it.product_name}</span>
                                      <span className="text-muted-foreground">({it.quantity}x)</span>
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-sky-500 font-bold group-hover:translate-x-0.5 transition-transform">
                                <span>{s.items.length} Product Line(s)</span>
                                <span className="flex items-center gap-1">
                                  Select <ArrowRight className="w-3 h-3" />
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Selected Sale Overview Banner */
                <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm text-foreground flex items-center gap-1">
                        <FileText className="w-4 h-4 text-sky-500" />
                        RECEIPT #: {selectedSale.invoice_no || (selectedSale as any).receipt_no || selectedSale.id}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        {selectedSale.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span>
                        Client / Buyer: <strong className="text-foreground">{selectedSale.customer_name || "Walk-in Customer"}</strong>
                      </span>
                      <span>
                        Processed by: <strong className="text-foreground">{selectedSale.processed_by || "Staff"}</strong>
                      </span>
                      <span>
                        Date: <strong className="text-foreground">{new Date(selectedSale.created_at).toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="text-right sm:border-l sm:border-sky-500/20 sm:pl-4">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase">Original Total</div>
                    <div className="text-lg font-black text-sky-500">{fmt(selectedSale.total)}</div>
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
                        Step 2: Select Items &amp; Quantities to Return
                      </h2>
                      <span className="text-xs font-bold text-muted-foreground">
                        {selectedSale.items.length} Product Line(s)
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
                            className={`p-3.5 rounded-xl border transition space-y-3 ${
                              isReturning
                                ? "bg-sky-500/5 border-sky-500/40 shadow-xs"
                                : "bg-muted/20 border-border/80"
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              {/* Product Info with Name & Meta */}
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-sm font-extrabold text-foreground">
                                    {item.product_name}
                                  </h4>
                                  {item.barcode && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border/50">
                                      {item.barcode}
                                    </span>
                                  )}
                                  {item.batch_number && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30">
                                      Batch: {item.batch_number}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Sold: <strong className="text-foreground">{item.quantity} units</strong> @ {fmt(item.unit_price)} each · Line Total: {fmt(item.quantity * item.unit_price)}
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
                                    Restoring Stock after Return
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
                                    <span className={itemState.restock ? "text-emerald-500 font-bold" : "text-muted-foreground"}>
                                      Restore +{itemState.returnQty} to sellable stock
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
                        Step 3: Refund Details &amp; Voucher
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Review refund calculations, buyer information, and restore inventory.
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
                        Client / Buyer Name
                      </label>
                      <Input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Ali"
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
                      Confirm Return &amp; Refund ({fmt(totalRefundAmount)})
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
                  Return &amp; Refund Records (New to Old)
                </h2>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>Realtime synchronized purchase &amp; refund audit trail.</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Realtime Sync
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadInitialData(false)}
                  disabled={isSyncing}
                  className="h-8 px-2.5 text-xs rounded-xl text-muted-foreground hover:text-foreground gap-1.5"
                  title="Force re-sync returns history"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-sky-500" : ""}`} />
                  <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
                </Button>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search by Slip #, Client, Product..."
                    className="pl-8 h-8 text-xs rounded-xl bg-muted/40 border-border"
                  />
                </div>
              </div>
            </div>

            {isLoadingHistory ? (
              <div className="py-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
                <span className="text-xs font-semibold">Synchronizing return history...</span>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground space-y-2">
                <div className="w-12 h-12 rounded-full bg-muted/50 mx-auto flex items-center justify-center text-muted-foreground">
                  <RotateCcw className="w-6 h-6 opacity-60" />
                </div>
                <h3 className="font-extrabold text-sm text-foreground">No Returns Recorded Yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  When customers return merchandise, records will appear here in realtime with full original purchase data and printable vouchers.
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
                      <th className="py-2.5 px-3">Original Slip &amp; Client</th>
                      <th className="py-2.5 px-3">Return Date</th>
                      <th className="py-2.5 px-3">Returned Products</th>
                      <th className="py-2.5 px-3">Original Total</th>
                      <th className="py-2.5 px-3 text-right">Refund Total</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredHistory.map((rec) => {
                      const slipLabel = rec.invoice_no
                        ? `RECEIPT #: ${rec.invoice_no}`
                        : `#${rec.sale_id.slice(0, 14)}`;

                      return (
                        <tr key={rec.id} className="hover:bg-muted/30 transition">
                          <td className="py-3 px-3 font-mono font-bold text-foreground">
                            {rec.id}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono text-xs font-extrabold text-sky-500 block">
                              {slipLabel}
                            </span>
                            <span className="text-[11px] text-foreground font-semibold flex items-center gap-1 mt-0.5">
                              <User className="w-3 h-3 text-muted-foreground" />
                              {rec.customer_name || "Walk-in Customer"}
                            </span>
                            {rec.original_sale_date && (
                              <span className="text-[10px] text-muted-foreground block">
                                Purchased: {new Date(rec.original_sale_date).toLocaleDateString()}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-muted-foreground">
                            {new Date(rec.created_at).toLocaleDateString()}{" "}
                            <span className="text-[10px] text-muted-foreground/80 block">
                              {new Date(rec.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1 max-w-sm">
                              {rec.items.map((it, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted/60 text-foreground border border-border/50"
                                >
                                  <Package className="w-3 h-3 text-sky-500" />
                                  <span>{it.return_qty}x {it.product_name}</span>
                                  {it.restock && (
                                    <span className="text-[9px] text-emerald-500 font-bold ml-0.5">
                                      (Restocked)
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                            <span className="text-[10px] text-muted-foreground capitalize block mt-1">
                              Reason: {rec.reason.replace(/_/g, " ")} · Method: {rec.refund_method}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-medium text-muted-foreground">
                            {rec.original_sale_total !== undefined ? fmt(rec.original_sale_total) : "—"}
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
                      );
                    })}
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
