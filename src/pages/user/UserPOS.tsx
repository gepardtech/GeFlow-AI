import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart, Search, ScanLine, Trash2, Package, Plus, Minus,
  Banknote, CreditCard, Zap, Loader2, X,
} from "lucide-react";
import UserPanelGate from "@/components/UserPanelGate";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { useProductCategories } from "@/hooks/useProductCategories";
import { supabase } from "@/integrations/supabase/client";
import { useMoney } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import SaleReceiptDialog, { ReceiptData } from "@/components/pos/SaleReceiptDialog";

interface POSProduct {
  id: string; name: string; internal_sku: string | null; barcode: string | null;
  category_id: string | null; retail_price: number; discount_price: number | null;
  purchase_cost: number; stock_units: number; min_stock_alert: number;
}

interface CartLine extends POSProduct { qty: number; unit: number; }

const UserPOS = () => {
  const { active, industryType, categoryName, loading: bizLoading } = useActiveBusiness();
  const { all: categories } = useProductCategories(industryType, categoryName);
  const { symbol, format: fmt, invoiceNo: makeInvoiceNo } = useMoney();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [products, setProducts] = useState<POSProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [scanMode, setScanMode] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountPct, setDiscountPct] = useState("0");
  const [payMethod, setPayMethod] = useState<"cash" | "card">("cash");
  const [cashGiven, setCashGiven] = useState("");
  const [processing, setProcessing] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [cashierName, setCashierName] = useState("Cashier");

  const taxRate = Number(active?.default_tax ?? 0);
  const catName = useCallback(
    (id: string | null) => categories.find((c) => c.id === id)?.name ?? "General",
    [categories]
  );

  // Load POS settings
  const posConfig = useMemo(() => {
    if (!active?.id) return {};
    try {
      const saved = localStorage.getItem(`geflow_settings_${active.id}`) || localStorage.getItem("geflow_settings_global");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }, [active?.id]);

  const quickCashOptions = useMemo(() => {
    const raw = posConfig.quickAmounts || "10, 20, 50, 100";
    return raw.split(",").map((s: string) => parseFloat(s.trim())).filter((n: number) => !isNaN(n) && n > 0);
  }, [posConfig.quickAmounts]);

  const load = useCallback(async () => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id, name, internal_sku, barcode, category_id, retail_price, discount_price, purchase_cost, stock_units, min_stock_alert")
      .eq("business_id", active.id)
      .eq("status", "active")
      .order("name");
    setProducts((data as POSProduct[]) ?? []);
    setLoading(false);
  }, [active]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? "");
      setCashierName(user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Cashier");
    })();
  }, []);

  useEffect(() => { if (!bizLoading) load(); }, [bizLoading, load]);

  useEffect(() => {
    if (!active) return;
    const ch = supabase.channel(`pos-${active.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `business_id=eq.${active.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active, load]);

  const unitPrice = (p: POSProduct) => Number(p.discount_price ?? p.retail_price) || 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.internal_sku ?? "").toLowerCase().includes(q) ||
      (p.barcode ?? "").toLowerCase().includes(q) ||
      catName(p.category_id).toLowerCase().includes(q),
    );
  }, [products, search, catName]);

  const addToCart = (p: POSProduct) => {
    if (p.stock_units <= 0) { toast({ title: "Out of stock", description: p.name, variant: "destructive" }); return; }
    setCart((prev) => {
      const existing = prev.find((l) => l.id === p.id);
      if (existing) {
        if (existing.qty >= p.stock_units) { toast({ title: "Stock limit reached", description: `Only ${p.stock_units} in stock.`, variant: "destructive" }); return prev; }
        return prev.map((l) => l.id === p.id ? { ...l, qty: l.qty + 1 } : l);
      }
      return [...prev, { ...p, qty: 1, unit: unitPrice(p) }];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) => prev.flatMap((l) => {
      if (l.id !== id) return [l];
      const next = l.qty + delta;
      if (next <= 0) return [];
      if (next > l.stock_units) { toast({ title: "Stock limit reached", variant: "destructive" }); return [l]; }
      return [{ ...l, qty: next }];
    }));
  };

  const removeLine = (id: string) => setCart((prev) => prev.filter((l) => l.id !== id));
  const clearCart = () => { setCart([]); setDiscountPct("0"); setCashGiven(""); };

  // Scan-mode: on Enter, match a barcode/SKU exactly and add it.
  const handleScanEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !scanMode) return;
    const code = search.trim().toLowerCase();
    if (!code) return;
    const hit = products.find((p) => (p.barcode ?? "").toLowerCase() === code || (p.internal_sku ?? "").toLowerCase() === code);
    if (hit) { addToCart(hit); setSearch(""); }
    else toast({ title: "No match", description: `No product for "${search}"`, variant: "destructive" });
  };

  // Hardware barcode scanner support: USB/Bluetooth scanners emit keystrokes
  // very fast and finish with Enter. We buffer rapid input globally and match
  // it against a product barcode/SKU regardless of which field is focused.
  const productsRef = useRef<POSProduct[]>([]);
  const addRef = useRef<(p: POSProduct) => void>(() => {});
  productsRef.current = products;
  addRef.current = addToCart;

  useEffect(() => {
    let buffer = "";
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const now = Date.now();
      if (now - last > 80) buffer = "";
      last = now;
      if (e.key === "Enter") {
        const code = buffer.trim().toLowerCase();
        buffer = "";
        if (code.length < 3) return;
        const hit = productsRef.current.find(
          (p) => (p.barcode ?? "").toLowerCase() === code || (p.internal_sku ?? "").toLowerCase() === code,
        );
        if (hit) {
          e.preventDefault();
          addRef.current(hit);
          setSearch("");
        }
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);


  const subtotal = cart.reduce((s, l) => s + l.unit * l.qty, 0);
  const discountValue = Math.min(subtotal * (Number(discountPct) || 0) / 100, subtotal);
  const taxed = subtotal - discountValue;
  const gst = taxed * (taxRate / 100);
  const grandTotal = taxed + gst;
  const cashNum = Number(cashGiven) || 0;
  const changeDue = payMethod === "cash" ? Math.max(cashNum - grandTotal, 0) : 0;

  const completeTransaction = async () => {
    if (!active || !userId || cart.length === 0) return;
    if (payMethod === "cash" && cashNum < grandTotal) {
      toast({ title: "Insufficient cash", description: "Amount paid is less than the grand total.", variant: "destructive" });
      return;
    }
    setProcessing(true);
    const profit = cart.reduce((s, l) => s + (l.unit - Number(l.purchase_cost)) * l.qty, 0) - discountValue;

    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .insert({ business_id: active.id, owner_user_id: userId, processed_by: userId, total: grandTotal, profit, status: "completed" })
      .select("id")
      .single();

    if (saleErr || !sale) { setProcessing(false); toast({ title: "Transaction failed", description: saleErr?.message, variant: "destructive" }); return; }

    const items = cart.map((l) => ({
      sale_id: sale.id, owner_user_id: userId, product_id: l.id, product_name: l.name,
      quantity: l.qty, unit_price: l.unit, unit_cost: Number(l.purchase_cost),
    }));
    await supabase.from("sale_items").insert(items);

    // Decrement stock + log movements.
    for (const l of cart) {
      await supabase.from("products").update({ stock_units: Math.max(l.stock_units - l.qty, 0) }).eq("id", l.id);
      await supabase.from("stock_movements").insert({
        business_id: active.id, owner_user_id: userId, product_id: l.id,
        quantity: -l.qty, type: "sale", reason: "POS sale", note: `Sale ${sale.id.slice(0, 8)}`,
      });
    }

    setProcessing(false);

    // Build the printable receipt from the finalized cart before clearing.
    const invoiceNo = makeInvoiceNo(sale.id);
    setReceipt({
      invoiceNo,
      date: new Date(),
      businessName: active.business_name,
      businessAddress: posConfig.businessAddress || active.business_address || "",
      businessPhone: posConfig.businessPhone || "",
      logoUrl: posConfig.logoUrl || null,
      receiptHeader: posConfig.receiptHeader || active.business_name,
      receiptSubheader: posConfig.receiptSubheader || "Official Store Receipt & Fiscal Log",
      receiptFooter: posConfig.receiptFooter || "Thank you for choosing us! Returns accepted within 14 days.",
      cashierName: cashierName || "Cashier",
      showLogoOnReceipt: posConfig.showLogoOnReceipt !== false,
      showTaxBreakdown: posConfig.showTaxBreakdown !== false,
      showCashierName: posConfig.showCashierName !== false,
      showBarcodeOnReceipt: posConfig.showBarcodeOnReceipt !== false,
      autoPrintReceipt: Boolean(posConfig.autoPrintReceipt),
      lines: cart.map((l) => ({ name: l.name, qty: l.qty, unit: l.unit, total: l.unit * l.qty })),
      subtotal,
      discount: discountValue,
      taxRate,
      tax: gst,
      total: grandTotal,
      payMethod,
      cashGiven: cashNum,
      changeDue,
      symbol,
    });
    setReceiptOpen(true);

    toast({ title: "Transaction complete", description: `${cart.length} item(s) · ${fmt(grandTotal)}${payMethod === "cash" ? ` · change ${fmt(changeDue)}` : ""}` });
    clearCart();
    load();
  };


  return (
    <UserPanelGate pageTitle="POS Terminal" module="pos">
      <div className="flex flex-col xl:flex-row gap-4 sm:gap-6 xl:h-[calc(100vh-11rem)] min-w-0 pb-10 xl:pb-0">
        {/* Product selection */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Search / Scan bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-card border border-border rounded-2xl p-2 mb-4 sm:mb-5 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleScanEnter}
                placeholder={scanMode ? "Scan or type barcode / SKU, then Enter..." : "Search product name, SKU or category..."}
                className="w-full h-10 pl-10 pr-3 bg-transparent text-xs sm:text-sm focus:outline-none"
              />
            </div>
            <button
              onClick={() => setScanMode((v) => !v)}
              className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl text-xs font-bold tracking-wider inline-flex items-center justify-center gap-2 transition-all shrink-0 ${
                scanMode ? "bg-sky-400 text-white" : "bg-muted/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <ScanLine className="h-4 w-4" /> SCAN MODE
            </button>
          </div>

          {/* Grid */}
          <div className="flex-1 xl:overflow-y-auto pr-1 min-w-0">
            {bizLoading || loading ? (
              <div className="p-12 text-center text-muted-foreground">Loading catalog...</div>
            ) : !active ? (
              <div className="bg-card border border-border rounded-2xl p-8 sm:p-12 text-center">
                <Package className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="font-bold">No business selected</p>
                <p className="text-sm text-muted-foreground mt-1">Create or select a business to start selling.</p>
                <Button onClick={() => navigate("/dashboard/businesses")} className="mt-4">Go to Businesses</Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 sm:p-12 text-center">
                <Package className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="font-bold">{search ? "No matching products" : "No products yet"}</p>
                <p className="text-sm text-muted-foreground mt-1">{search ? "Try a different search." : "Add products in Inventory to sell them here."}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 min-w-0">
                {filtered.map((p) => {
                  const out = p.stock_units <= 0;
                  const low = !out && p.stock_units <= p.min_stock_alert;
                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      disabled={out}
                      className={`text-left bg-card border border-border/80 rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-sky-500/10 hover:border-sky-400/40 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none flex flex-col min-w-0 overflow-hidden`}
                    >
                      <div className="h-9 w-9 rounded-xl bg-sky-400/15 text-sky-500 flex items-center justify-center mb-4 shrink-0">
                        <Package className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <p className="font-bold text-sm leading-tight line-clamp-2 text-foreground truncate">{p.name}</p>
                      <p className="text-[10px] font-bold tracking-wider text-muted-foreground mt-1 uppercase truncate">
                        {catName(p.category_id)} · {p.internal_sku || p.barcode || "—"}
                      </p>
                      <div className="flex items-end justify-between gap-2 mt-3 w-full">
                        <p className="text-lg sm:text-xl font-extrabold text-sky-500 truncate">{fmt(unitPrice(p))}</p>
                        <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md shrink-0 ${
                          out ? "bg-rose-500/15 text-rose-500" : low ? "bg-amber-500/15 text-amber-500" : "bg-emerald-500/15 text-emerald-500"
                        }`}>
                          {p.stock_units} UNITS
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart panel */}
        <div className="w-full xl:w-96 flex-shrink-0 bg-card border border-border/80 rounded-2xl flex flex-col overflow-hidden shadow-xs min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sky-400 text-white flex items-center justify-center"><ShoppingCart className="h-5 w-5" /></div>
              <div>
                <p className="font-extrabold leading-tight">Order Items</p>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground">REGISTER TERMINAL #01</p>
              </div>
            </div>
            <button onClick={clearCart} disabled={cart.length === 0} className="h-9 w-9 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-rose-500 disabled:opacity-40 transition">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Items / empty state */}
          <div className="flex-1 overflow-y-auto min-h-[140px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-12 text-muted-foreground/60">
                <ShoppingCart className="h-14 w-14 mb-3" strokeWidth={1.2} />
                <p className="text-xs font-bold tracking-widest">CART IS EMPTY</p>
              </div>
            ) : (
              <ul className="p-3 space-y-2">
                {cart.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 rounded-xl border border-border p-2.5">
                    <div className="h-9 w-9 rounded-lg bg-sky-400/15 text-sky-500 flex items-center justify-center flex-shrink-0"><Package className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{l.name}</p>
                      <p className="text-[11px] text-muted-foreground">{fmt(l.unit)} each</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => changeQty(l.id, -1)} className="h-6 w-6 rounded-md bg-muted hover:bg-muted/70 flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                      <span className="w-6 text-center text-sm font-bold">{l.qty}</span>
                      <button onClick={() => changeQty(l.id, 1)} className="h-6 w-6 rounded-md bg-muted hover:bg-muted/70 flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                    </div>
                    <p className="w-16 text-right text-sm font-bold">{fmt(l.unit * l.qty)}</p>
                    <button onClick={() => removeLine(l.id)} className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-rose-500"><X className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Financial summary + payment */}
          <div className="border-t border-border p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-bold">{fmt(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">GST ({taxRate}%)</span>
              <span className="font-bold">{fmt(gst)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">% Discount</span>
              <input
                type="number" min="0" max="100" value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                className="w-20 h-8 px-2 text-right bg-muted/50 border border-border rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-lg font-extrabold">Grand Total</span>
              <span className="text-2xl font-extrabold text-sky-500">{fmt(grandTotal)}</span>
            </div>

            {/* Payment toggle */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setPayMethod("cash")}
                className={`h-11 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 transition ${payMethod === "cash" ? "bg-foreground text-background" : "bg-muted/60 text-muted-foreground hover:text-foreground"}`}
              >
                <Banknote className="h-4 w-4" /> Cash
              </button>
              <button
                onClick={() => setPayMethod("card")}
                className={`h-11 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 transition ${payMethod === "card" ? "bg-foreground text-background" : "bg-muted/60 text-muted-foreground hover:text-foreground"}`}
              >
                <CreditCard className="h-4 w-4" /> Card
              </button>
            </div>

            {payMethod === "cash" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold tracking-widest text-muted-foreground">AMOUNT PAID</span>
                  <span className="text-[10px] font-bold tracking-widest text-muted-foreground">RETURN: {fmt(changeDue)}</span>
                </div>
                <input
                  type="number" min="0" value={cashGiven}
                  onChange={(e) => setCashGiven(e.target.value)}
                  placeholder="Enter customer cash..."
                  className="w-full h-11 px-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {quickCashOptions.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <button
                      type="button"
                      onClick={() => setCashGiven(grandTotal.toFixed(2))}
                      className="px-2.5 py-1 rounded-lg bg-muted text-[10px] font-bold hover:bg-muted/80 text-foreground transition"
                    >
                      Exact
                    </button>
                    {quickCashOptions.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashGiven(amt.toString())}
                        className="px-2.5 py-1 rounded-lg bg-muted text-[10px] font-bold hover:bg-muted/80 text-foreground transition"
                      >
                        {fmt(amt)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={completeTransaction}
              disabled={cart.length === 0 || processing}
              className="w-full h-12 rounded-xl bg-sky-400 hover:bg-sky-500 text-white font-bold text-base disabled:opacity-50"
            >
              {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Complete Transaction
            </Button>
          </div>
        </div>
      </div>

      <SaleReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        data={receipt}
        onNewCustomer={() => setReceiptOpen(false)}
      />
    </UserPanelGate>

  );
};

export default UserPOS;
