import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart, Search, ScanLine, Trash2, Package, Plus, Minus,
  Banknote, CreditCard, Zap, Loader2, X, Sparkles, Scale, Pill, Droplets,
  Layers, ChevronRight, User, Phone, FileText, Barcode, Check, RotateCcw,
  FlaskConical, UserPlus, Globe,
} from "lucide-react";
import UserPanelGate from "@/components/UserPanelGate";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { useProductCategories } from "@/hooks/useProductCategories";
import { supabase } from "@/integrations/supabase/client";
import { useMoney } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import SaleReceiptDialog, { ReceiptData } from "@/components/pos/SaleReceiptDialog";
import {
  SmartUOMCalculatorModal,
  SmartUOMProductInfo,
  AppliedFractionalSelection,
} from "@/components/pos/SmartUOMCalculatorModal";
import { parseProductUOM } from "@/lib/uomRegistry";
import { COUNTRIES, detectDefaultCountry } from "@/lib/countries";

export interface POSProduct {
  id: string;
  name: string;
  description: string | null;
  internal_sku: string | null;
  barcode: string | null;
  category_id: string | null;
  retail_price: number;
  discount_price: number | null;
  purchase_cost: number;
  stock_units: number;
  min_stock_alert: number;
}

export interface CartLine extends POSProduct {
  lineId: string;
  qty: number;
  unit: number;
  fractionOfPack: number;
  stockUnitsDeducted: number;
  displayUnitLabel: string;
  proportionalCost: number;
}

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

  // Customer / Patient Info on POS Receipt
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPhoneCode, setCustomerPhoneCode] = useState<string>("");
  const [customerNote, setCustomerNote] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  // Auto-detect business country and dial code
  const detectedCountry = useMemo(() => {
    return detectDefaultCountry({
      country: (active as any)?.extended?.location?.country,
      address: active?.business_address,
      currency: active?.currency,
    });
  }, [active]);

  // Set default dial code when active business is loaded
  useEffect(() => {
    if (detectedCountry && !customerPhoneCode) {
      setCustomerPhoneCode(detectedCountry.phoneCode);
    }
  }, [detectedCountry, customerPhoneCode]);

  const fullCustomerPhone = useMemo(() => {
    const p = customerPhone.trim();
    if (!p) return undefined;
    if (p.startsWith("+")) return p;
    const code = customerPhoneCode || detectedCountry.phoneCode || "+1";
    return `${code} ${p}`;
  }, [customerPhone, customerPhoneCode, detectedCountry]);

  // Barcode Test Simulator State
  const [showBarcodeSimulator, setShowBarcodeSimulator] = useState(false);

  // UOM Smart Calculator Modal state
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [selectedProductForCalc, setSelectedProductForCalc] = useState<SmartUOMProductInfo | null>(null);
  const [calcInitialFraction, setCalcInitialFraction] = useState<number>(1);
  const [editingCartLineId, setEditingCartLineId] = useState<string | null>(null);

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
      .select("id, name, description, internal_sku, barcode, category_id, retail_price, discount_price, purchase_cost, stock_units, min_stock_alert")
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
      (p.description ?? "").toLowerCase().includes(q) ||
      catName(p.category_id).toLowerCase().includes(q),
    );
  }, [products, search, catName]);

  const addToCart = (p: POSProduct) => {
    if (p.stock_units <= 0) {
      toast({ title: "Out of stock", description: p.name, variant: "destructive" });
      return;
    }
    const price = unitPrice(p);
    const parsed = parseProductUOM(p.name, p.description || "");

    setCart((prev) => {
      // Find full-pack line if exists
      const existing = prev.find((l) => l.id === p.id && l.fractionOfPack === 1);
      if (existing) {
        if (existing.qty >= p.stock_units) {
          toast({ title: "Stock limit reached", description: `Only ${p.stock_units} in stock.`, variant: "destructive" });
          return prev;
        }
        return prev.map((l) => (l.lineId === existing.lineId ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          ...p,
          lineId: `${p.id}_full_${Date.now()}`,
          qty: 1,
          unit: price,
          fractionOfPack: 1,
          stockUnitsDeducted: 1,
          displayUnitLabel: `Full ${parsed.uomLabel}`,
          proportionalCost: Number(p.purchase_cost) || 0,
        },
      ];
    });
  };

  const openUOMCalculatorForProduct = (p: POSProduct, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedProductForCalc({
      id: p.id,
      name: p.name,
      description: p.description,
      internal_sku: p.internal_sku,
      barcode: p.barcode,
      retail_price: p.retail_price,
      discount_price: p.discount_price,
      purchase_cost: p.purchase_cost,
      stock_units: p.stock_units,
    });
    setCalcInitialFraction(1);
    setEditingCartLineId(null);
    setCalculatorOpen(true);
  };

  const openUOMCalculatorForCartLine = (line: CartLine) => {
    setSelectedProductForCalc({
      id: line.id,
      name: line.name,
      description: line.description,
      internal_sku: line.internal_sku,
      barcode: line.barcode,
      retail_price: line.retail_price,
      discount_price: line.discount_price,
      purchase_cost: line.purchase_cost,
      stock_units: line.stock_units,
    });
    setCalcInitialFraction(line.fractionOfPack);
    setEditingCartLineId(line.lineId);
    setCalculatorOpen(true);
  };

  const handleApplyFractional = (selection: AppliedFractionalSelection) => {
    const p = products.find((x) => x.id === selection.productId);
    if (!p) return;

    if (editingCartLineId) {
      // Update existing cart line
      setCart((prev) =>
        prev.map((l) =>
          l.lineId === editingCartLineId
            ? {
                ...l,
                unit: selection.unitPrice,
                proportionalCost: selection.purchaseCost,
                fractionOfPack: selection.fractionOfPack,
                stockUnitsDeducted: selection.stockUnitsDeducted,
                displayUnitLabel: selection.displayUnitLabel,
              }
            : l
        )
      );
      toast({
        title: "Cart Line Updated",
        description: `${p.name} updated to ${selection.displayUnitLabel} @ ${fmt(selection.unitPrice)}`,
      });
    } else {
      // Add new fractional line
      setCart((prev) => [
        ...prev,
        {
          ...p,
          lineId: `${p.id}_frac_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          qty: 1,
          unit: selection.unitPrice,
          proportionalCost: selection.purchaseCost,
          fractionOfPack: selection.fractionOfPack,
          stockUnitsDeducted: selection.stockUnitsDeducted,
          displayUnitLabel: selection.displayUnitLabel,
        },
      ]);
      toast({
        title: "Sub-Unit Added to Cart",
        description: `${p.name} (${selection.displayUnitLabel}) added @ ${fmt(selection.unitPrice)}`,
      });
    }
  };

  const changeQty = (lineId: string, delta: number) => {
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.lineId !== lineId) return [l];
        const next = l.qty + delta;
        if (next <= 0) return [];
        const requiredStock = next * l.stockUnitsDeducted;
        if (requiredStock > l.stock_units) {
          toast({ title: "Stock limit reached", description: `Only ${l.stock_units} in stock.`, variant: "destructive" });
          return [l];
        }
        return [{ ...l, qty: next }];
      })
    );
  };

  const removeLine = (lineId: string) => setCart((prev) => prev.filter((l) => l.lineId !== lineId));
  const clearCart = () => {
    setCart([]);
    setDiscountPct("0");
    setCashGiven("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerPhoneCode(detectedCountry.phoneCode);
    setCustomerNote("");
  };

  const handleSimulateScan = (codeToScan: string) => {
    const code = codeToScan.trim().toLowerCase();
    if (!code) return;
    const hit = products.find(
      (p) => (p.barcode ?? "").toLowerCase() === code || (p.internal_sku ?? "").toLowerCase() === code
    );
    if (hit) {
      addToCart(hit);
      toast({
        title: "Barcode Scanned ⚡",
        description: `${hit.name} (Code: ${hit.barcode || hit.internal_sku}) added to cart`,
      });
    } else {
      toast({
        title: "Barcode Not Found",
        description: `No active product matched code "${codeToScan}"`,
        variant: "destructive",
      });
    }
  };

  // Scan-mode: on Enter, match a barcode/SKU exactly and add it.
  const handleScanEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !scanMode) return;
    const code = search.trim().toLowerCase();
    if (!code) return;
    const hit = products.find((p) => (p.barcode ?? "").toLowerCase() === code || (p.internal_sku ?? "").toLowerCase() === code);
    if (hit) { addToCart(hit); setSearch(""); }
    else toast({ title: "No match", description: `No product for "${search}"`, variant: "destructive" });
  };

  // Hardware barcode scanner support
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
    const profit = cart.reduce((s, l) => s + (l.unit - Number(l.proportionalCost)) * l.qty, 0) - discountValue;

    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .insert({ business_id: active.id, owner_user_id: userId, processed_by: userId, total: grandTotal, profit, status: "completed" })
      .select("id")
      .single();

    if (saleErr || !sale) {
      setProcessing(false);
      toast({ title: "Transaction failed", description: saleErr?.message, variant: "destructive" });
      return;
    }

    const items = cart.map((l) => ({
      sale_id: sale.id,
      owner_user_id: userId,
      product_id: l.id,
      product_name: l.fractionOfPack !== 1 ? `${l.name} [${l.displayUnitLabel}]` : l.name,
      quantity: l.qty,
      unit_price: l.unit,
      unit_cost: Number(l.proportionalCost),
    }));
    await supabase.from("sale_items").insert(items);

    // Group stock deductions per product to ensure accurate atomic updates
    const productDeductions: Record<string, { product: POSProduct; totalDeducted: number }> = {};
    for (const l of cart) {
      const deduction = l.stockUnitsDeducted * l.qty;
      if (!productDeductions[l.id]) {
        productDeductions[l.id] = { product: l, totalDeducted: 0 };
      }
      productDeductions[l.id].totalDeducted += deduction;
    }

    for (const pid of Object.keys(productDeductions)) {
      const { product: p, totalDeducted } = productDeductions[pid];
      const newStock = Math.max(+(p.stock_units - totalDeducted).toFixed(3), 0);

      await supabase.from("products").update({ stock_units: newStock }).eq("id", pid);
      await supabase.from("stock_movements").insert({
        business_id: active.id,
        owner_user_id: userId,
        product_id: pid,
        quantity: -totalDeducted,
        type: "sale",
        reason: "POS sale (UOM fractional accurate)",
        note: `Sale ${sale.id.slice(0, 8)}`,
      });
    }

    setProcessing(false);

    // Build the printable receipt from finalized cart
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
      customerName: customerName.trim() || undefined,
      customerPhone: fullCustomerPhone,
      patientNote: customerNote.trim() || undefined,
      showLogoOnReceipt: posConfig.showLogoOnReceipt !== false,
      showTaxBreakdown: posConfig.showTaxBreakdown !== false,
      showCashierName: posConfig.showCashierName !== false,
      showBarcodeOnReceipt: posConfig.showBarcodeOnReceipt !== false,
      autoPrintReceipt: Boolean(posConfig.autoPrintReceipt),
      lines: cart.map((l) => ({
        name: l.fractionOfPack !== 1 ? `${l.name} (${l.displayUnitLabel})` : l.name,
        qty: l.qty,
        unit: l.unit,
        total: l.unit * l.qty,
      })),
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

    toast({
      title: "Transaction complete",
      description: `${cart.length} item(s) · ${fmt(grandTotal)}${payMethod === "cash" ? ` · change ${fmt(changeDue)}` : ""}`,
    });
    clearCart();
    load();
  };

  return (
    <UserPanelGate pageTitle="POS Terminal" module="pos">
      <div className="flex flex-col xl:flex-row items-start gap-4 sm:gap-6 min-w-0 pb-16">
        {/* Product selection */}
        <div className="flex-1 min-w-0 w-full flex flex-col">
          {/* Search / Scan / Image bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-card border border-border rounded-2xl p-2 mb-3 sm:mb-4 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleScanEnter}
                placeholder={scanMode ? "Scan or type barcode / SKU, then Enter..." : "Search product name, SKU, UOM or category..."}
                className="w-full h-10 pl-10 pr-3 bg-transparent text-xs sm:text-sm focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setScanMode((v) => !v)}
                className={`h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl text-xs font-bold tracking-wider inline-flex items-center justify-center gap-1.5 transition-all shrink-0 ${
                  scanMode ? "bg-sky-500 text-white shadow-xs" : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                <ScanLine className="h-3.5 w-3.5" /> SCAN
              </button>
            </div>
          </div>

          {/* Barcode Testing / Hardware Scanner Assist */}
          {scanMode && (
            <div className="bg-sky-500/10 border border-sky-500/25 rounded-2xl p-3 mb-4 text-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <div className="flex items-center gap-2">
                  <Barcode className="h-4 w-4 text-sky-500 shrink-0" />
                  <span className="font-bold text-sky-700 dark:text-sky-300">
                    Live Barcode Scanner Mode Active
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Type barcode + Enter &bull; Or click any code below to simulate instant scan
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">Click to test scan:</span>
                {products.filter((p) => (p.barcode || p.internal_sku) && p.stock_units > 0).slice(0, 5).map((p) => {
                  const code = p.barcode || p.internal_sku || "";
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSimulateScan(code)}
                      className="px-2 py-0.5 rounded-lg bg-card border border-border text-[11px] font-mono hover:border-sky-400 hover:text-sky-500 transition shadow-2xs flex items-center gap-1"
                      title={`Click to simulate scanning ${p.name}`}
                    >
                      <Zap className="h-2.5 w-2.5 text-sky-500" />
                      <span>{code}</span>
                      <span className="text-muted-foreground text-[10px]">({p.name.slice(0, 10)})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
                  const parsed = parseProductUOM(p.name, p.description || "");
                  const hasSubUnits = parsed.packSize > 1 || parsed.isBulkWeight || parsed.isLiquidVolume || parsed.isPharmaPack;
                  const subUnitPrice = parsed.packSize > 1 ? unitPrice(p) / parsed.packSize : null;

                  return (
                    <div
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className={`text-left bg-card border border-border/80 rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-sky-500/10 hover:border-sky-400/40 cursor-pointer flex flex-col justify-between min-w-0 overflow-hidden relative group ${
                        out ? "opacity-60 pointer-events-none" : ""
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="h-9 w-9 rounded-xl bg-sky-400/15 text-sky-500 flex items-center justify-center shrink-0">
                            {parsed.isLiquidVolume ? (
                              <Droplets className="h-4 w-4 sm:h-5 sm:w-5" />
                            ) : parsed.isPharmaPack ? (
                              <Pill className="h-4 w-4 sm:h-5 sm:w-5" />
                            ) : parsed.isBulkWeight ? (
                              <Scale className="h-4 w-4 sm:h-5 sm:w-5" />
                            ) : (
                              <Package className="h-4 w-4 sm:h-5 sm:w-5" />
                            )}
                          </div>

                          {/* UOM & Stock Badges */}
                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border uppercase">
                              {parsed.packSize > 1 ? `${parsed.packSize} ${parsed.subUnitName}s/${parsed.uomLabel}` : parsed.uomLabel}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                              out ? "bg-rose-500/15 text-rose-500" : low ? "bg-amber-500/15 text-amber-500" : "bg-emerald-500/15 text-emerald-500"
                            }`}>
                              {out
                                ? "OUT OF STOCK"
                                : parsed.packSize > 1
                                ? `${Math.floor(p.stock_units / parsed.packSize)} ${parsed.uomLabel}s (${p.stock_units} ${parsed.subUnitName}s)`
                                : `${p.stock_units} in stock`}
                            </span>
                          </div>
                        </div>

                        <p className="font-bold text-sm leading-tight text-foreground line-clamp-2">{p.name}</p>
                        <p className="text-[10px] font-bold tracking-wider text-muted-foreground mt-1 uppercase truncate">
                          {catName(p.category_id)} · {p.internal_sku || p.barcode || "—"}
                        </p>
                      </div>

                      <div className="mt-4 pt-2.5 border-t border-border/60">
                        <div className="flex items-end justify-between gap-2">
                          <div>
                            <p className="text-lg sm:text-xl font-extrabold text-sky-500 leading-none">
                              {fmt(unitPrice(p))}
                            </p>
                            {subUnitPrice !== null && (
                              <p className="text-[10px] font-semibold text-muted-foreground mt-1">
                                ~{fmt(subUnitPrice)} / {parsed.subUnitName}
                              </p>
                            )}
                          </div>

                          {/* Trigger Smart Fractional/Dose modal for any product */}
                          <button
                            type="button"
                            onClick={(e) => openUOMCalculatorForProduct(p, e)}
                            className="h-8 px-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500 hover:text-white text-sky-600 dark:text-sky-400 text-[10px] font-bold tracking-wide border border-sky-500/25 transition flex items-center gap-1.5 shrink-0 z-10 shadow-2xs group/btn"
                            title="Calculate fractional dose or sub-unit (e.g. 1 Tablet, Strip, 0.5kg, 250ml)"
                          >
                            <Sparkles className="w-3 h-3 text-sky-500 group-hover/btn:text-white transition-colors" />
                            <span>Smart UOM</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart panel */}
        <div className="w-full xl:w-[400px] 2xl:w-[440px] flex-shrink-0 bg-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-xl min-w-0 xl:sticky xl:top-4 h-auto xl:h-[calc(100vh-6rem)]">
          {/* Header */}
          <div className="flex items-center justify-between p-3.5 border-b border-border flex-shrink-0 bg-card">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-xs">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <p className="font-extrabold text-sm leading-tight text-foreground">Order Cart</p>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground">REGISTER TERMINAL #01</p>
              </div>
            </div>
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="h-8 w-8 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-rose-500 disabled:opacity-40 transition cursor-pointer"
              title="Clear Cart & Reset Customer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Customer / Patient Quick Details Header */}
          <div className="p-3 border-b border-border bg-muted/20 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate text-foreground">
                    {customerName ? customerName : "Walk-in Customer"}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">
                    {fullCustomerPhone ? `Tel: ${fullCustomerPhone}` : "No phone number added"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerForm((v) => !v)}
                className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline px-2 py-1 rounded-md hover:bg-sky-500/10 transition cursor-pointer"
              >
                {showCustomerForm ? "Done" : customerName || customerPhone ? "Edit Details" : "+ Add Buyer / Rx"}
              </button>
            </div>

            {showCustomerForm && (
              <div className="mt-2.5 pt-2.5 border-t border-border/60 space-y-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                    Buyer / Patient Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Alex Morgan / Sarah Jenkins"
                    className="w-full h-8 px-2.5 rounded-lg bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">
                        Phone / WhatsApp
                      </label>
                      <span className="text-[9px] text-sky-600 dark:text-sky-400 font-semibold">
                        {detectedCountry.flag} {detectedCountry.name}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <select
                        value={customerPhoneCode || detectedCountry.phoneCode}
                        onChange={(e) => setCustomerPhoneCode(e.target.value)}
                        className="h-8 px-1.5 rounded-lg bg-background border border-border text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-sky-500 shrink-0 w-[94px] cursor-pointer"
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.phoneCode}>
                            {c.flag} {c.phoneCode}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Phone number"
                        className="w-full h-8 px-2.5 rounded-lg bg-background border border-border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                      Rx / Doctor Note
                    </label>
                    <input
                      type="text"
                      value={customerNote}
                      onChange={(e) => setCustomerNote(e.target.value)}
                      placeholder="e.g. Dr. Roberts / Rx #8402"
                      className="w-full h-8 px-2.5 rounded-lg bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Items scrollable list */}
          <div className="flex-1 overflow-y-auto min-h-[140px] max-h-[300px] xl:max-h-none">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-10 text-muted-foreground/60">
                <ShoppingCart className="h-12 w-12 mb-2" strokeWidth={1.2} />
                <p className="text-xs font-bold tracking-widest uppercase">Cart is Empty</p>
                <p className="text-[11px] text-muted-foreground mt-1">Select items from catalog to start sale</p>
              </div>
            ) : (
              <ul className="p-3 space-y-2">
                {cart.map((l) => (
                  <li key={l.lineId} className="flex flex-col gap-2 rounded-xl border border-border p-2.5 bg-card hover:border-sky-500/30 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate leading-tight text-foreground">{l.name}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => openUOMCalculatorForCartLine(l)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 text-[10px] font-bold border border-sky-500/20 transition cursor-pointer"
                            title="Edit sub-unit or dose"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>{l.displayUnitLabel}</span>
                          </button>
                          <span className="text-[11px] text-muted-foreground">
                            {fmt(l.unit)} each
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeLine(l.lineId)}
                        className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-rose-500 shrink-0 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => changeQty(l.lineId, -1)}
                          className="h-6 w-6 rounded-md bg-muted hover:bg-muted/70 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold">{l.qty}</span>
                        <button
                          onClick={() => changeQty(l.lineId, 1)}
                          className="h-6 w-6 rounded-md bg-muted hover:bg-muted/70 flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-right text-sm font-bold text-sky-500">{fmt(l.unit * l.qty)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Financial summary + payment (Always pinned footer) */}
          <div className="border-t border-border p-3.5 space-y-2.5 flex-shrink-0 bg-card shadow-2xl z-20 mt-auto">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Subtotal ({cart.length} items)</span>
              <span className="font-bold">{fmt(subtotal)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                <span className="font-bold">{fmt(gst)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Discount %</span>
              <input
                type="number"
                min="0"
                max="100"
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                className="w-16 h-7 px-2 text-right bg-muted/50 border border-border rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm font-extrabold text-foreground">Grand Total</span>
              <span className="text-xl font-black text-sky-500">{fmt(grandTotal)}</span>
            </div>

            {/* Payment toggle */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setPayMethod("cash")}
                className={`h-9 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  payMethod === "cash" ? "bg-foreground text-background shadow-xs" : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Banknote className="h-3.5 w-3.5" /> Cash
              </button>
              <button
                type="button"
                onClick={() => setPayMethod("card")}
                className={`h-9 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  payMethod === "card" ? "bg-foreground text-background shadow-xs" : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                <CreditCard className="h-3.5 w-3.5" /> Card / POS
              </button>
            </div>

            {payMethod === "cash" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-muted-foreground">
                  <span>CASH RECEIVED</span>
                  <span className={changeDue > 0 ? "text-emerald-500 font-extrabold" : ""}>
                    CHANGE: {fmt(changeDue)}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={cashGiven}
                  onChange={(e) => setCashGiven(e.target.value)}
                  placeholder="Enter cash received..."
                  className="w-full h-8 px-2.5 bg-muted/50 border border-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                {quickCashOptions.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    <button
                      type="button"
                      onClick={() => setCashGiven(grandTotal.toFixed(2))}
                      className="px-2 py-0.5 rounded-lg bg-muted text-[10px] font-bold hover:bg-muted/80 text-foreground transition cursor-pointer"
                    >
                      Exact
                    </button>
                    {quickCashOptions.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashGiven(amt.toString())}
                        className="px-2 py-0.5 rounded-lg bg-muted text-[10px] font-bold hover:bg-muted/80 text-foreground transition cursor-pointer"
                      >
                        {fmt(amt)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Complete Transaction CTA Button - ALWAYS VISIBLE */}
            <Button
              id="pos-complete-sale-cta"
              onClick={completeTransaction}
              disabled={cart.length === 0 || processing}
              className="w-full h-12 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-extrabold text-sm disabled:opacity-40 shadow-lg shadow-sky-500/25 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Complete Sale &bull; {fmt(grandTotal)}
            </Button>
          </div>
        </div>
      </div>

      {/* Smart UOM & Dose Calculator Modal */}
      <SmartUOMCalculatorModal
        open={calculatorOpen}
        onOpenChange={setCalculatorOpen}
        product={selectedProductForCalc}
        initialFraction={calcInitialFraction}
        onApply={handleApplyFractional}
      />

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
