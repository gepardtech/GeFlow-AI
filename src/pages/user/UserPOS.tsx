import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart, Search, ScanLine, Trash2, Package, Plus, Minus,
  Banknote, CreditCard, Zap, Loader2, X, Sparkles, Scale, Pill, Droplets,
  Layers, ChevronRight, User, Phone, FileText, Barcode, Check, RotateCcw,
  FlaskConical, UserPlus, Globe, Clock, PauseCircle,
  Smartphone, Building2, ArrowRightLeft, Tag, Percent, ShieldCheck, Wallet, AlertTriangle,
} from "lucide-react";
import {
  POSBuyerSelectionModal,
  POSBuyerAccount,
} from "@/components/pos/POSBuyerSelectionModal";
import {
  POSVariantSelectionModal,
  VariantSelectionResult,
} from "@/components/pos/POSVariantSelectionModal";
import type { ProductVariationsConfig } from "@/server/productVariationsStorage";
import { getBusinessPaymentMethods, BusinessPaymentMethod } from "@/lib/paymentMethods";
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
import {
  HeldOrdersModal,
  HeldOrderRecord,
} from "@/components/pos/HeldOrdersModal";
import {
  fetchHeldOrders,
  saveHeldOrder,
  deleteHeldOrder,
} from "@/lib/heldOrdersService";
import {
  fetchSyncedProducts,
  recordSyncedSale,
  getSyncedHeldOrders,
  saveSyncedHeldOrder,
  deleteSyncedHeldOrder,
  isDemoProduct,
} from "@/lib/businessSync";
import { recordStockMovement } from "@/lib/stockMovementService";
import { parseProductUOM, computeProductStock } from "@/lib/uomRegistry";
import { COUNTRIES, detectDefaultCountry } from "@/lib/countries";
import { generateProfessionalReceiptNo } from "@/lib/receiptUtils";

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
  uom?: string | null;
  units_per_uom?: number | null;
  base_unit?: string | null;
}

export interface CartLine extends POSProduct {
  lineId: string;
  qty: number;
  unit: number;
  fractionOfPack: number;
  stockUnitsDeducted: number; // Base units deducted per 1 unit of this line (e.g. 12 for 1 box, 1 for 1 tablet)
  displayUnitLabel: string;
  proportionalCost: number;
  discountPct?: number; // per-item percent discount
  discountAmount?: number; // per-item fixed discount
  discountType?: "pct" | "fixed";
  isEditingDiscount?: boolean;
  variantId?: string;
  variantSku?: string;
  variantName?: string;
  variantAttributes?: Record<string, string>;
  selectedModifiers?: any[];
  measuredQuantity?: number;
  measuredUnit?: string;
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
  const [payMethod, setPayMethod] = useState<string>("cash");
  const [cashGiven, setCashGiven] = useState("");
  const [processing, setProcessing] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [cashierName, setCashierName] = useState("Cashier");

  // Product Variations & Options (WooCommerce / Shopify style)
  const [variationsMap, setVariationsMap] = useState<Record<string, ProductVariationsConfig>>({});
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<POSProduct | null>(null);
  const [variantModalOpen, setVariantModalOpen] = useState(false);

  // Dynamic Country / Business Payment Methods & Split Pay
  const [paymentMethods, setPaymentMethods] = useState<BusinessPaymentMethod[]>([]);
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitMethod1, setSplitMethod1] = useState("cash");
  const [splitAmount1, setSplitAmount1] = useState("");
  const [splitMethod2, setSplitMethod2] = useState("card");
  const [splitAmount2, setSplitAmount2] = useState("");

  const refreshPaymentMethods = useCallback(() => {
    if (active) {
      const all = getBusinessPaymentMethods(active).filter((m) => m.enabled);
      setPaymentMethods(all);
      if (all.length > 0) {
        setPayMethod((prev) => {
          if (all.some((m) => m.id === prev)) return prev;
          const def = all.find((m) => m.isDefault) || all[0];
          return def.id;
        });
        if (all.length >= 2) {
          setSplitMethod1(all[0].id);
          setSplitMethod2(all[1].id);
        }
      }
    }
  }, [active]);

  useEffect(() => {
    refreshPaymentMethods();
    const handleUpdate = () => refreshPaymentMethods();
    window.addEventListener("geflow:payment-methods-updated", handleUpdate);
    return () => window.removeEventListener("geflow:payment-methods-updated", handleUpdate);
  }, [refreshPaymentMethods]);

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

  // Verified Buyer Account (Store Credit / Udhar balance management)
  const [selectedBuyer, setSelectedBuyer] = useState<POSBuyerAccount | null>(null);
  const [buyerModalOpen, setBuyerModalOpen] = useState(false);
  const [buyerModalRequiredFor, setBuyerModalRequiredFor] = useState<"deposit" | "udhar" | null>(null);
  const [partialCashOption, setPartialCashOption] = useState<"udhar" | "deposit">("udhar");
  const [depositChangeToCredit, setDepositChangeToCredit] = useState(false);

  const handleSelectBuyerAccount = (buyer: POSBuyerAccount) => {
    setSelectedBuyer(buyer);
    setCustomerName(buyer.customerName);
    if (buyer.customerPhone) {
      setCustomerPhone(buyer.customerPhone);
    }
  };

  const handleClearBuyerAccount = () => {
    setSelectedBuyer(null);
  };

  // Barcode Test Simulator State
  const [showBarcodeSimulator, setShowBarcodeSimulator] = useState(false);

  // UOM Smart Calculator Modal state
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [selectedProductForCalc, setSelectedProductForCalc] = useState<SmartUOMProductInfo | null>(null);
  const [calcInitialFraction, setCalcInitialFraction] = useState<number>(1);
  const [editingCartLineId, setEditingCartLineId] = useState<string | null>(null);

  // Held Orders State
  const [heldOrdersModalOpen, setHeldOrdersModalOpen] = useState(false);
  const [heldOrders, setHeldOrders] = useState<HeldOrderRecord[]>([]);
  const [activeHeldOrderId, setActiveHeldOrderId] = useState<string | null>(null);

  const refreshHeldOrders = useCallback(async () => {
    if (!active?.id) {
      setHeldOrders([]);
      return;
    }
    let list = await fetchHeldOrders(active.id);
    if (!list || list.length === 0) {
      list = await getSyncedHeldOrders(active.id);
    }
    setHeldOrders(list || []);
  }, [active?.id]);

  useEffect(() => {
    refreshHeldOrders();
  }, [refreshHeldOrders]);

  const catName = useCallback(
    (id: string | null) => categories.find((c) => c.id === id)?.name ?? "General",
    [categories]
  );

  // Load POS settings reactively so any changes from Settings apply immediately
  const [posConfig, setPosConfig] = useState<any>(() => {
    try {
      const key = active?.id ? `geflow_settings_${active.id}` : "geflow_settings_global";
      const saved = localStorage.getItem(key) || localStorage.getItem("geflow_settings_global");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const reloadSettings = useCallback(async () => {
    try {
      const key = active?.id ? `geflow_settings_${active.id}` : "geflow_settings_global";
      const saved = localStorage.getItem(key) || localStorage.getItem("geflow_settings_global");
      if (saved) {
        setPosConfig(JSON.parse(saved));
      }

      // Sync settings from server if active business is set (keeps employee and owner POS in 100% sync)
      if (active?.id) {
        try {
          const res = await fetch(`/api/sync/settings?businessId=${encodeURIComponent(active.id)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.settings && Object.keys(data.settings).length > 0) {
              setPosConfig((prev: any) => ({ ...prev, ...data.settings }));
              localStorage.setItem(key, JSON.stringify(data.settings));
            }
          }
        } catch {
          // ignore network glitches
        }
      }
    } catch (e) {
      console.warn("Failed to reload POS config", e);
    }
  }, [active?.id]);

  useEffect(() => {
    reloadSettings();
  }, [reloadSettings]);

  useEffect(() => {
    const onSettingsChanged = (e: any) => {
      if (e?.detail) {
        setPosConfig(e.detail);
      } else {
        reloadSettings();
      }
    };
    const onBizUpdated = () => reloadSettings();
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("geflow_settings")) reloadSettings();
    };

    window.addEventListener("geflow:settings-changed", onSettingsChanged);
    window.addEventListener("geflow:business-updated", onBizUpdated);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("geflow:settings-changed", onSettingsChanged);
      window.removeEventListener("geflow:business-updated", onBizUpdated);
      window.removeEventListener("storage", onStorage);
    };
  }, [reloadSettings]);

  // Tax and pricing configuration
  // User Requirement:
  // 1. Tax Breakdown: turning off turns off tax calculating from pos cart & invoice
  // 2. Automated tax engine: turning off disables tax calculating from pos cart & invoice
  // 3. Price Tax Inclusivity: functional support for inclusive vs exclusive pricing
  const [posTaxOverridden, setPosTaxOverridden] = useState<boolean | null>(() => {
    try {
      const saved = localStorage.getItem(active?.id ? `geflow_pos_tax_active_${active.id}` : "geflow_pos_tax_active_global");
      return saved !== null ? saved === "true" : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!active?.id) return;
    try {
      const saved = localStorage.getItem(`geflow_pos_tax_active_${active.id}`);
      if (saved !== null) {
        setPosTaxOverridden(saved === "true");
      }
    } catch {
      /* ignore */
    }
  }, [active?.id]);

  const isSettingsTaxExplicitlyDisabled =
    posConfig.enableTaxCalculation === false ||
    posConfig.enableTaxCalculation === "false" ||
    posConfig.taxEnabled === false ||
    posConfig.taxDisabled === true ||
    posConfig.showTaxBreakdown === false ||
    posConfig.showTaxBreakdown === "false" ||
    (posConfig.defaultTaxRate !== undefined && Number(posConfig.defaultTaxRate) === 0) ||
    (!posConfig.defaultTaxRate && (active?.default_tax === 0 || active?.default_tax === null || active?.default_tax === undefined));

  const rawTaxRate = Number(
    posConfig.defaultTaxRate !== undefined
      ? posConfig.defaultTaxRate
      : (active?.default_tax ?? 0)
  );

  // Bulletproof tax guarantee:
  // If tax is disabled in settings, or 0% rate, or terminal disabled: tax MUST NEVER apply
  const isTaxEnabled = !isSettingsTaxExplicitlyDisabled && rawTaxRate > 0 && posTaxOverridden !== false && (posTaxOverridden === true || posConfig.enableTaxCalculation === true);
  const effectiveTaxRate = isTaxEnabled ? rawTaxRate : 0;
  const taxRate = effectiveTaxRate;

  const enableSecondaryTax = isTaxEnabled && Boolean(posConfig.enableSecondaryTax);
  const secondaryTaxRate = enableSecondaryTax ? (Number(posConfig.secondaryTaxRate) || 0) : 0;
  const taxPricingMode: "exclusive" | "inclusive" = posConfig.taxPricingMode === "inclusive" ? "inclusive" : "exclusive";
  const isTaxInclusive = taxPricingMode === "inclusive";
  const showTaxBreakdown = isTaxEnabled && effectiveTaxRate > 0;

  const handleToggleTax = () => {
    const nextState = !isTaxEnabled;
    setPosTaxOverridden(nextState);
    try {
      if (active?.id) {
        localStorage.setItem(`geflow_pos_tax_active_${active.id}`, String(nextState));
      }
      localStorage.setItem("geflow_pos_tax_active_global", String(nextState));
    } catch {
      /* ignore */
    }
    toast({
      title: nextState ? "Tax Engine Enabled" : "Tax Engine Disabled (0%)",
      description: nextState
        ? `Applied ${rawTaxRate}% sales tax to current and upcoming sales.`
        : "Tax will not be applied to any products in this sale or future sales.",
    });
  };

  const quickCashOptions = useMemo(() => {
    const raw = posConfig.quickAmounts || "10, 20, 50, 100";
    return raw.split(",").map((s: string) => parseFloat(s.trim())).filter((n: number) => !isNaN(n) && n > 0);
  }, [posConfig.quickAmounts]);

  const activeId = active?.id;
  const isStaff = Boolean(active?.is_staff);
  const staffRole = active?.staff_role;
  const ownerUserId = active?.owner_user_id;

  const load = useCallback(async (isSilent = false) => {
    if (!activeId) { setLoading(false); return; }
    if (!isSilent) setLoading(true);
    let data: any[] | null = null;

    try {
      // 1. Direct Supabase fetch for all users (real database)
      const { data: initialData, error } = await supabase
        .from("products")
        .select("id, name, description, internal_sku, barcode, category_id, retail_price, discount_price, purchase_cost, stock_units, min_stock_alert, uom, units_per_uom, base_unit")
        .eq("business_id", activeId)
        .eq("status", "active")
        .order("name");

      data = initialData;
      if (error || !data || data.length === 0) {
        const fallback = await supabase
          .from("products")
          .select("id, name, description, internal_sku, barcode, category_id, retail_price, discount_price, purchase_cost, stock_units, min_stock_alert")
          .eq("business_id", activeId)
          .eq("status", "active")
          .order("name");
        if (fallback.data && fallback.data.length > 0) {
          data = fallback.data as any;
        }
      }

      // 2. Fetch from Business Sync engine (ensures employee POS receives 100% of business listed inventory)
      if (!data || data.length === 0 || isStaff) {
        const synced = await fetchSyncedProducts(activeId, {
          role: staffRole || "cashier",
          isStaff,
          ownerUserId,
          statusOnly: "active",
        });
        if (synced && synced.length > 0) {
          data = synced as any;
        }
      }

      const cleanProducts = ((data as POSProduct[]) ?? []).filter((p) => !isDemoProduct(p));
      setProducts(cleanProducts);

      // Fetch product variations configs
      try {
        const vRes = await fetch(`/api/sync/product-variations?business_id=${activeId}`);
        if (vRes.ok) {
          const vData = await vRes.json();
          if (vData.configs && Array.isArray(vData.configs)) {
            const vMap: Record<string, ProductVariationsConfig> = {};
            vData.configs.forEach((c: ProductVariationsConfig) => {
              vMap[c.product_id] = c;
            });
            setVariationsMap(vMap);
          }
        }
      } catch (vErr) {
        console.warn("Could not load product variations:", vErr);
      }
    } catch (err) {
      console.warn("POS failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  }, [activeId, isStaff, staffRole, ownerUserId]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? "");
      setCashierName(user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Cashier");
    })();
  }, []);

  useEffect(() => { if (!bizLoading && activeId) load(false); }, [bizLoading, activeId, load]);

  useEffect(() => {
    if (!activeId) return;
    const ch = supabase.channel(`pos-${activeId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `business_id=eq.${activeId}` }, () => load(true))
      .subscribe();

    const onUpdate = () => {
      load(true);
      refreshHeldOrders();
    };
    window.addEventListener("geflow:products-updated", onUpdate);
    window.addEventListener("geflow:stock-updated", onUpdate);
    window.addEventListener("geflow:sales-updated", onUpdate);
    window.addEventListener("panel:refresh", onUpdate);

    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("geflow:products-updated", onUpdate);
      window.removeEventListener("geflow:stock-updated", onUpdate);
      window.removeEventListener("geflow:sales-updated", onUpdate);
      window.removeEventListener("panel:refresh", onUpdate);
    };
  }, [activeId, load, refreshHeldOrders]);

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
    // If product is variable, measured, or has custom modifiers, open POSVariantSelectionModal
    const vConfig = variationsMap[p.id];
    if (
      vConfig &&
      (vConfig.product_type === "variable" ||
        vConfig.product_type === "measured" ||
        vConfig.product_type === "addons" ||
        (vConfig.attributes && vConfig.attributes.length > 0) ||
        (vConfig.modifiers && vConfig.modifiers.length > 0))
    ) {
      setSelectedProductForVariant(p);
      setVariantModalOpen(true);
      return;
    }

    const stockInfo = computeProductStock(p.stock_units, p.name, p.description, p.uom, p.units_per_uom, p.base_unit);
    if (stockInfo.totalSubUnits <= 0) {
      toast({ title: "Out of stock", description: p.name, variant: "destructive" });
      return;
    }

    // If stock remaining is less than 1 full pack, open the Smart UoM calculator to sell loose units!
    if (stockInfo.totalSubUnits < stockInfo.packSize && stockInfo.packSize > 1) {
      toast({
        title: "Loose stock only",
        description: `Only ${stockInfo.displayText} left. Opening Dose & UOM Calculator to sell loose ${stockInfo.subUnitName.toLowerCase()}s.`,
      });
      openUOMCalculatorForProduct(p);
      return;
    }

    const price = unitPrice(p);
    const parsed = parseProductUOM(p.name, p.description || "", p.uom, p.units_per_uom, p.base_unit);

    setCart((prev) => {
      // Find full-pack line if exists
      const existing = prev.find((l) => l.id === p.id && l.fractionOfPack === 1);
      if (existing) {
        const totalBaseRequired = (existing.qty + 1) * stockInfo.packSize;
        const otherLinesBaseUnits = prev
          .filter((l) => l.id === p.id && l.lineId !== existing.lineId)
          .reduce((s, l) => s + (l.qty * l.stockUnitsDeducted), 0);

        if (totalBaseRequired + otherLinesBaseUnits > stockInfo.totalSubUnits) {
          toast({ title: "Stock limit reached", description: `Only ${stockInfo.displayText} in stock.`, variant: "destructive" });
          return prev;
        }
        return prev.map((l) => (l.lineId === existing.lineId ? { ...l, qty: l.qty + 1 } : l));
      }

      // Check if other lines of same product already exceed stock
      const otherLinesBaseUnits = prev
        .filter((l) => l.id === p.id)
        .reduce((s, l) => s + (l.qty * l.stockUnitsDeducted), 0);

      if (stockInfo.packSize + otherLinesBaseUnits > stockInfo.totalSubUnits) {
        toast({ title: "Stock limit reached", description: `Only ${stockInfo.displayText} in stock.`, variant: "destructive" });
        return prev;
      }

      return [
        ...prev,
        {
          ...p,
          lineId: `${p.id}_full_${Date.now()}`,
          qty: 1,
          unit: price,
          fractionOfPack: 1,
          stockUnitsDeducted: stockInfo.packSize, // Base units deducted per 1 full box (e.g. 12 tablets)
          displayUnitLabel: `Full ${parsed.uomLabel}`,
          proportionalCost: Number(p.purchase_cost) || 0,
        },
      ];
    });
  };

  const handleConfirmVariantSelection = (result: VariantSelectionResult) => {
    const p = result.product;
    const price = result.effectivePrice;
    setCart((prev) => [
      ...prev,
      {
        ...p,
        lineId: `${p.id}_var_${result.variant?.id || Date.now()}_${Date.now()}`,
        name: result.displayName,
        internal_sku: result.sku,
        unit: price,
        retail_price: price,
        qty: 1,
        fractionOfPack: 1,
        stockUnitsDeducted: 1,
        displayUnitLabel: result.measuredQuantity
          ? `${result.measuredQuantity}${result.measuredUnit || "g"}`
          : (result.variant?.name || "Variant"),
        proportionalCost: Number(result.variant?.purchase_cost ?? p.purchase_cost) || 0,
        variantId: result.variant?.id,
        variantSku: result.sku,
        variantName: result.displayName,
        variantAttributes: result.selectedAttributes,
        selectedModifiers: result.selectedModifiers,
        measuredQuantity: result.measuredQuantity,
        measuredUnit: result.measuredUnit,
      },
    ]);
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
      uom: p.uom,
      units_per_uom: p.units_per_uom,
      base_unit: p.base_unit,
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
      uom: line.uom,
      units_per_uom: line.units_per_uom,
      base_unit: line.base_unit,
    });
    setCalcInitialFraction(line.fractionOfPack);
    setEditingCartLineId(line.lineId);
    setCalculatorOpen(true);
  };

  const handleApplyFractional = (selection: AppliedFractionalSelection) => {
    const p = products.find((x) => x.id === selection.productId);
    if (!p) return;
    const stockInfo = computeProductStock(p.stock_units, p.name, p.description, p.uom, p.units_per_uom, p.base_unit);
    // Base units per single item: e.g. 1 for 1 tablet, 2 for 2 tablets, 12 for 1 box
    const baseUnitsPerQty = selection.subQuantity > 0
      ? selection.subQuantity
      : Math.max(1, Math.round(selection.fractionOfPack * stockInfo.packSize));

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
                stockUnitsDeducted: baseUnitsPerQty,
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
          stockUnitsDeducted: baseUnitsPerQty,
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
        const stockInfo = computeProductStock(l.stock_units, l.name, l.description, l.uom, l.units_per_uom, l.base_unit);
        const otherLinesBaseUnits = prev
          .filter((other) => other.id === l.id && other.lineId !== lineId)
          .reduce((sum, other) => sum + (other.qty * other.stockUnitsDeducted), 0);
        const thisLineBaseUnits = next * l.stockUnitsDeducted;

        if (otherLinesBaseUnits + thisLineBaseUnits > stockInfo.totalSubUnits) {
          toast({ title: "Stock limit reached", description: `Only ${stockInfo.displayText} in stock.`, variant: "destructive" });
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
    setSelectedBuyer(null);
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

  const getLineGross = useCallback((l: CartLine) => l.unit * l.qty, []);

  const getLineDiscount = useCallback((l: CartLine) => {
    const gross = l.unit * l.qty;
    if (l.discountType === "fixed") {
      return Math.min(gross, Math.max(0, Number(l.discountAmount || 0)));
    }
    const pct = Math.min(100, Math.max(0, Number(l.discountPct || 0)));
    return Math.round(((gross * pct) / 100) * 100) / 100;
  }, []);

  const getLineTotal = useCallback((l: CartLine) => {
    return Math.max(0, (l.unit * l.qty) - (l.discountType === "fixed" ? Math.min(l.unit * l.qty, Math.max(0, Number(l.discountAmount || 0))) : ((l.unit * l.qty * Math.min(100, Math.max(0, Number(l.discountPct || 0)))) / 100)));
  }, []);

  const setLineDiscount = useCallback((lineId: string, val: number, type: "pct" | "fixed" = "pct") => {
    setCart((prev) =>
      prev.map((l) =>
        l.lineId === lineId
          ? {
              ...l,
              discountType: type,
              discountPct: type === "pct" ? val : undefined,
              discountAmount: type === "fixed" ? val : undefined,
              isEditingDiscount: false,
            }
          : l
      )
    );
  }, []);

  const toggleLineDiscountEdit = useCallback((lineId: string) => {
    setCart((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, isEditingDiscount: !l.isEditingDiscount } : l))
    );
  }, []);

  const grossSubtotal = cart.reduce((s, l) => s + getLineGross(l), 0);
  const itemDiscountsTotal = cart.reduce((s, l) => s + getLineDiscount(l), 0);
  const afterItemDiscountSubtotal = Math.max(0, grossSubtotal - itemDiscountsTotal);

  // Overall cart discount applies on top
  const cartDiscountValue = Math.min(afterItemDiscountSubtotal * (Number(discountPct) || 0) / 100, afterItemDiscountSubtotal);
  const subtotal = afterItemDiscountSubtotal;
  const totalDiscount = Math.round((itemDiscountsTotal + cartDiscountValue) * 100) / 100;
  const taxed = Math.max(0, afterItemDiscountSubtotal - cartDiscountValue);

  let gst = 0;
  let secondaryGst = 0;
  let grandTotal = taxed;

  // Strict tax guarantee: if tax disabled, tax is strictly 0 regardless of how many products/items are in cart
  if (isTaxEnabled && effectiveTaxRate > 0) {
    if (isTaxInclusive) {
      // Prices ALREADY include tax - total does NOT increase
      const combinedRate = effectiveTaxRate + secondaryTaxRate;
      const base = taxed / (1 + combinedRate / 100);
      gst = Math.round((base * (effectiveTaxRate / 100)) * 100) / 100;
      secondaryGst = Math.round((base * (secondaryTaxRate / 100)) * 100) / 100;
      grandTotal = taxed;
    } else {
      // Tax Exclusive - added on top of taxed subtotal
      gst = Math.round((taxed * (effectiveTaxRate / 100)) * 100) / 100;
      secondaryGst = secondaryTaxRate > 0 ? Math.round((taxed * (secondaryTaxRate / 100)) * 100) / 100 : 0;
      grandTotal = taxed + gst + secondaryGst;
    }
  } else {
    gst = 0;
    secondaryGst = 0;
    grandTotal = taxed;
  }

  const cashNum = Number(cashGiven) || 0;
  const activeMethodObj = paymentMethods.find((m) => m.id === payMethod);
  const isCashLike = !isSplitPayment && (payMethod === "cash" || activeMethodObj?.type === "cash");
  const changeDue = isCashLike ? Math.max(cashNum - grandTotal, 0) : 0;

  const completeTransaction = async () => {
    if (!active || !userId || cart.length === 0) return;

    // Financial rules: identify Store Credit Deposit and Udhar usage
    const isPayingDeposit = !isSplitPayment && payMethod === "credit_deposit";
    const isPayingUdhar = !isSplitPayment && (payMethod === "credit_udhar" || payMethod === "credit" || activeMethodObj?.type === "credit");
    const isSplitDeposit = isSplitPayment && (splitMethod1 === "credit_deposit" || splitMethod2 === "credit_deposit");
    const isSplitUdhar = isSplitPayment && (splitMethod1 === "credit_udhar" || splitMethod1 === "credit" || splitMethod2 === "credit_udhar" || splitMethod2 === "credit");

    const requiresBuyer = isPayingDeposit || isPayingUdhar || isSplitDeposit || isSplitUdhar;

    // Rule: Never apply credit to a buyer based only on a matching name or without explicit verified profile
    if (requiresBuyer && !selectedBuyer) {
      toast({
        title: "Verified Buyer Required",
        description: "Financial rules require selecting or registering a verified Buyer Account before using Store Credit or adding to Udhar.",
        variant: "destructive",
      });
      setBuyerModalRequiredFor(isPayingDeposit || isSplitDeposit ? "deposit" : "udhar");
      setBuyerModalOpen(true);
      return;
    }

    let depositToSpend = 0;
    let udharToCharge = 0;
    let finalPayMethodName = "";
    let tenderAmount = 0;

    if (isSplitPayment) {
      const s1 = Number(splitAmount1) || 0;
      const s2 = Number(splitAmount2) || 0;
      if (s1 + s2 < grandTotal - 0.01) {
        toast({
          title: "Incomplete split payment",
          description: `Total split amount (${fmt(s1 + s2)}) is less than Grand Total (${fmt(grandTotal)}).`,
          variant: "destructive",
        });
        return;
      }

      if (splitMethod1 === "credit_deposit") depositToSpend += s1;
      else if (splitMethod1 === "credit_udhar" || splitMethod1 === "credit") udharToCharge += s1;

      if (splitMethod2 === "credit_deposit") depositToSpend += s2;
      else if (splitMethod2 === "credit_udhar" || splitMethod2 === "credit") udharToCharge += s2;

      const getMethodLabel = (id: string) => {
        if (id === "credit_deposit") return "Store Credit Deposit";
        if (id === "credit_udhar" || id === "credit") return "Udhar Debt";
        return paymentMethods.find((m) => m.id === id)?.name || id;
      };

      finalPayMethodName = `Split: ${getMethodLabel(splitMethod1)} (${fmt(s1)}) + ${getMethodLabel(splitMethod2)} (${fmt(s2)})`;
      tenderAmount = s1 + s2;
    } else {
      if (isPayingDeposit) {
        depositToSpend = grandTotal;
        finalPayMethodName = "Store Credit Deposit";
        tenderAmount = grandTotal;
      } else if (isPayingUdhar) {
        udharToCharge = grandTotal;
        finalPayMethodName = "Udhar Credit (Khata)";
        tenderAmount = grandTotal;
      } else {
        if (isCashLike && cashNum < grandTotal) {
          const remainingUnpaid = Math.round((grandTotal - cashNum) * 100) / 100;
          if (remainingUnpaid > 0) {
            // Partial cash or full credit balance tendered: e.g. Paid $75 on $100 -> automatically add remaining $25 to buyer's Udhar or Store Credit
            if (!selectedBuyer) {
              toast({
                title: "Buyer Account Required for Remaining Balance",
                description: cashNum > 0
                  ? `Cash received (${fmt(cashNum)}) is less than total (${fmt(grandTotal)}). Please select a Buyer Account to record the remaining ${fmt(remainingUnpaid)} in store credit / udhar.`
                  : "Amount paid is less than the grand total. Please enter cash received or select a Buyer Account to record to Udhar.",
                variant: "destructive",
              });
              setBuyerModalRequiredFor(partialCashOption === "deposit" ? "deposit" : "udhar");
              setBuyerModalOpen(true);
              return;
            }

            if (partialCashOption === "deposit") {
              depositToSpend = remainingUnpaid;
              finalPayMethodName = cashNum > 0 ? `Cash (${fmt(cashNum)}) + Deposit (${fmt(remainingUnpaid)})` : `Store Credit Deposit`;
              tenderAmount = cashNum;
            } else {
              udharToCharge = remainingUnpaid;
              finalPayMethodName = cashNum > 0 ? `Cash (${fmt(cashNum)}) + Udhar (${fmt(remainingUnpaid)})` : `Udhar Credit (Khata)`;
              tenderAmount = cashNum;
            }
          }
        } else {
          finalPayMethodName = activeMethodObj?.name || (payMethod === "card" ? "Card / POS" : "Cash");
          tenderAmount = isCashLike ? cashNum : grandTotal;
        }
      }
    }

    // Financial rule: Store credit can only be deducted up to the validated available balance
    if (depositToSpend > 0) {
      if (!selectedBuyer || (selectedBuyer.availableDeposit < depositToSpend)) {
        toast({
          title: "Insufficient Store Credit Deposit",
          description: `Buyer ${selectedBuyer?.customerName || "Customer"} only has ${fmt(selectedBuyer?.availableDeposit || 0)} available in advance deposits. Cannot deduct ${fmt(depositToSpend)}.`,
          variant: "destructive",
        });
        return;
      }
    }

    // Financial rule: Outstanding udhar increases only by the unpaid portion of an eligible sale up to credit limit
    if (udharToCharge > 0) {
      if (!selectedBuyer) {
        toast({ title: "Buyer Account Missing", description: "Cannot add to Udhar without a verified buyer profile.", variant: "destructive" });
        return;
      }
      const newTotalUdhar = selectedBuyer.outstandingUdhar + udharToCharge;
      if (newTotalUdhar > selectedBuyer.creditLimit) {
        toast({
          title: "Credit Limit Exceeded",
          description: `Buyer credit limit is ${fmt(selectedBuyer.creditLimit)}. Current debt is ${fmt(selectedBuyer.outstandingUdhar)}. Adding ${fmt(udharToCharge)} exceeds limit.`,
          variant: "destructive",
        });
        return;
      }
    }

    setProcessing(true);
    const profit = cart.reduce((s, l) => s + (getLineTotal(l) - Number(l.proportionalCost) * l.qty), 0) - cartDiscountValue;
    const professionalReceiptNo = generateProfessionalReceiptNo(active.business_name);

    const saleItems = cart.map((l) => ({
      product_id: l.id,
      product_name: l.fractionOfPack !== 1 ? `${l.name} [${l.displayUnitLabel}]` : l.name,
      quantity: l.qty,
      unit_price: l.unit,
      unit_cost: Number(l.proportionalCost),
      discount: getLineDiscount(l),
      total: getLineTotal(l),
      deductionUnits: (l.stockUnitsDeducted || 1) * l.qty,
      barcode: l.barcode || null,
      batch_number: l.batch_number || null,
      internal_sku: l.internal_sku || null,
    }));

    // Post to unified sync engine
    const syncRes = await recordSyncedSale(active.id, {
      sale: {
        invoice_no: professionalReceiptNo,
        receipt_no: professionalReceiptNo,
        customer_name: selectedBuyer ? `${selectedBuyer.customerName} [${selectedBuyer.buyerId}]` : (customerName.trim() || undefined),
        customer_phone: selectedBuyer?.customerPhone || fullCustomerPhone || undefined,
        total: grandTotal,
        profit,
        status: "completed",
        processed_by: cashierName || "Cashier",
        owner_user_id: active.owner_user_id || userId,
      },
      items: saleItems,
      cashierName: cashierName || "Cashier",
      userId,
      isStaff: Boolean(active.is_staff),
    });

    const saleId = syncRes?.sale?.id || `sale_${Date.now()}`;

    const depositToAdd = (changeDue > 0 && depositChangeToCredit && selectedBuyer) ? changeDue : 0;

    // Atomically execute ledger adjustments for Store Credit Deposit or Udhar
    if (selectedBuyer && (depositToSpend > 0 || udharToCharge > 0 || depositToAdd > 0)) {
      try {
        const updatedBuyerState = { ...selectedBuyer };

        // 1. Deduct from advance deposit
        if (depositToSpend > 0) {
          const adjRes = await fetch("/api/sync/store-credits/adjust", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessId: active.id,
              creditId: selectedBuyer.id,
              amount: depositToSpend,
              type: "deposit_spend",
              paymentMethod: "Store Credit Deposit",
              note: `POS purchase covered by advance deposit (${cart.length} items)`,
              invoiceNo: professionalReceiptNo,
              processedBy: cashierName || "Cashier",
            }),
          });
          if (adjRes.ok) {
            const data = await adjRes.json();
            if (data.credit) {
              updatedBuyerState.availableDeposit = Number(data.credit.availableDeposit ?? data.credit.available_deposit ?? 0);
              updatedBuyerState.outstandingUdhar = Number(data.credit.outstandingUdhar ?? data.credit.outstanding_udhar ?? 0);
            }
          }
        }

        // 2. Add unpaid balance to Udhar
        if (udharToCharge > 0) {
          const adjRes = await fetch("/api/sync/store-credits/adjust", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessId: active.id,
              creditId: selectedBuyer.id,
              amount: udharToCharge,
              type: "udhar_charge",
              paymentMethod: "Udhar Credit",
              note: `POS Store Credit Purchase (${cart.length} items)`,
              invoiceNo: professionalReceiptNo,
              processedBy: cashierName || "Cashier",
            }),
          });
          if (adjRes.ok) {
            const data = await adjRes.json();
            if (data.credit) {
              updatedBuyerState.availableDeposit = Number(data.credit.availableDeposit ?? data.credit.available_deposit ?? 0);
              updatedBuyerState.outstandingUdhar = Number(data.credit.outstandingUdhar ?? data.credit.outstanding_udhar ?? 0);
            }
          }
        }

        // 3. Save change as Store Credit advance deposit if requested
        if (depositToAdd > 0) {
          const adjRes = await fetch("/api/sync/store-credits/adjust", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessId: active.id,
              creditId: selectedBuyer.id,
              amount: depositToAdd,
              type: "deposit_add",
              paymentMethod: "Cash Change Saved",
              note: `Change from POS purchase ${professionalReceiptNo} added to deposit`,
              invoiceNo: professionalReceiptNo,
              processedBy: cashierName || "Cashier",
            }),
          });
          if (adjRes.ok) {
            const data = await adjRes.json();
            if (data.credit) {
              updatedBuyerState.availableDeposit = Number(data.credit.availableDeposit ?? data.credit.available_deposit ?? 0);
              updatedBuyerState.outstandingUdhar = Number(data.credit.outstandingUdhar ?? data.credit.outstanding_udhar ?? 0);
            }
          }
        }

        setSelectedBuyer(updatedBuyerState);
        window.dispatchEvent(new CustomEvent("geflow:store-credits-updated"));
      } catch (e) {
        console.warn("Notice updating verified buyer ledger:", e);
      }
    }

    // Group stock deductions in BASE UNITS per product to ensure accurate atomic updates
    const productDeductions: Record<string, { product: POSProduct; totalBaseUnitsDeducted: number; summaryLabels: string[] }> = {};
    for (const l of cart) {
      const deduction = (l.stockUnitsDeducted || 1) * l.qty;
      if (!productDeductions[l.id]) {
        productDeductions[l.id] = { product: l, totalBaseUnitsDeducted: 0, summaryLabels: [] };
      }
      productDeductions[l.id].totalBaseUnitsDeducted += deduction;
      productDeductions[l.id].summaryLabels.push(`${l.qty}x ${l.displayUnitLabel}`);
    }

    for (const pid of Object.keys(productDeductions)) {
      const { product: p, totalBaseUnitsDeducted, summaryLabels } = productDeductions[pid];
      const stockInfo = computeProductStock(p.stock_units, p.name, p.description, p.uom, p.units_per_uom, p.base_unit);
      const newBaseStock = Math.max(Math.round(stockInfo.totalSubUnits - totalBaseUnitsDeducted), 0);

      const updatePayload: { stock_units: number; description?: string } = {
        stock_units: newBaseStock,
      };

      if (p.description) {
        let updatedDesc = p.description;
        const newPackQty = stockInfo.packSize > 0 ? +(newBaseStock / stockInfo.packSize).toFixed(2) : newBaseStock;
        if (updatedDesc.includes("[PACK_QTY:")) {
          updatedDesc = updatedDesc.replace(/\[PACK_QTY:\s*[^\]]+\]/i, `[PACK_QTY: ${newPackQty}]`);
        }
        if (updatedDesc.includes("[BASE_QTY:")) {
          updatedDesc = updatedDesc.replace(/\[BASE_QTY:\s*[^\]]+\]/i, `[BASE_QTY: ${newBaseStock}]`);
        }
        updatePayload.description = updatedDesc;
      }

      try {
        await supabase.from("products").update(updatePayload).eq("id", pid);
        await recordStockMovement({
          business_id: active.id,
          owner_user_id: userId,
          product_id: pid,
          quantity: -totalBaseUnitsDeducted,
          type: "out",
          reason: "POS sale (UOM accurate)",
          note: `Sale ${saleId.slice(0, 8)} · Sold: ${summaryLabels.join(", ")} (-${totalBaseUnitsDeducted} ${stockInfo.subUnitName.toLowerCase()}s)`,
          reference_id: saleId,
          reference_type: "pos_sale",
          created_by: userId,
        });
      } catch {
        /* ignore supabase errors */
      }
    }

    // Deduct stock for specific product variants if purchased
    for (const l of cart) {
      if (l.variantId && l.id) {
        try {
          await fetch("/api/sync/product-variations/adjust-stock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: l.id,
              variantId: l.variantId,
              deltaQuantity: -l.qty,
            }),
          });
        } catch (err) {
          console.warn("Notice adjusting variant stock in POS:", err);
        }
      }
    }

    if (activeHeldOrderId) {
      await deleteHeldOrder(activeHeldOrderId, active.id);
      await deleteSyncedHeldOrder(active.id, activeHeldOrderId);
      setActiveHeldOrderId(null);
      refreshHeldOrders();
    }

    setProcessing(false);

    // Build the printable receipt from finalized cart with registered business name
    const invoiceNo = professionalReceiptNo;
    setReceipt({
      invoiceNo,
      date: new Date(),
      businessName: active.business_name,
      businessAddress: posConfig.businessAddress || active.business_address || "",
      businessPhone: posConfig.businessPhone || "",
      logoUrl: posConfig.logoUrl || null,
      receiptHeader: posConfig.receiptHeader?.trim() || active.business_name,
      receiptSubheader: posConfig.receiptSubheader || "Official Store Receipt & Fiscal Log",
      receiptFooter: posConfig.receiptFooter || "Thank you for choosing us! Returns accepted within 14 days.",
      cashierName: cashierName || "Cashier",
      customerName: customerName.trim() || undefined,
      customerPhone: fullCustomerPhone,
      patientNote: customerNote.trim() || undefined,
      showLogoOnReceipt: posConfig.showLogoOnReceipt !== false,
      showTaxBreakdown: posConfig.showTaxBreakdown !== false && isTaxEnabled && effectiveTaxRate > 0,
      showCashierName: posConfig.showCashierName !== false,
      showBarcodeOnReceipt: posConfig.showBarcodeOnReceipt !== false,
      autoPrintReceipt: Boolean(posConfig.autoPrintReceipt),
      receiptFont: posConfig.receiptFont || "poppins",
      lines: cart.map((l) => ({
        name: l.fractionOfPack !== 1 ? `${l.name} (${l.displayUnitLabel})` : l.name,
        qty: l.qty,
        unit: l.unit,
        total: getLineTotal(l),
      })),
      subtotal,
      discount: totalDiscount,
      taxRate: effectiveTaxRate,
      tax: gst,
      secondaryTax: secondaryGst,
      secondaryTaxRate,
      secondaryTaxLabel: posConfig.secondaryTaxLabel || "Secondary Tax",
      taxLabel: posConfig.taxLabel || "Tax",
      taxPricingMode,
      taxRegistrationNumber: posConfig.taxRegistrationNumber || "",
      total: grandTotal,
      payMethod: finalPayMethodName,
      cashGiven: tenderAmount,
      changeDue,
      symbol,
    });
    setReceiptOpen(true);

    toast({
      title: "Transaction complete 🧾",
      description: `${cart.length} item(s) · ${fmt(grandTotal)} via ${finalPayMethodName}${isCashLike ? ` · change ${fmt(changeDue)}` : ""}`,
    });
    clearCart();
    load();
  };

  const handleHoldCart = async () => {
    if (!active?.id || cart.length === 0) return;
    try {
      const heldData = {
        business_id: active.id,
        owner_user_id: active.owner_user_id,
        customer_name: customerName.trim() || null,
        customer_phone: fullCustomerPhone || null,
        customer_note: customerNote.trim() || null,
        cart_data: cart,
        total_amount: grandTotal,
        item_count: cart.reduce((sum, item) => sum + item.qty, 0),
      };
      await saveHeldOrder(heldData);
      await saveSyncedHeldOrder(active.id, heldData);

      toast({
        title: "Order placed on hold",
        description: `Saved ${cart.length} item(s) to Held Orders. You can resume anytime.`,
      });

      clearCart();
      setActiveHeldOrderId(null);
      refreshHeldOrders();
    } catch {
      toast({
        title: "Failed to hold order",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleResumeHeldOrder = (order: HeldOrderRecord) => {
    if (cart.length > 0) {
      if (!window.confirm("Resuming this order will replace your current cart. Continue?")) {
        return;
      }
    }

    setCart(order.cart_data || []);
    if (order.customer_name) setCustomerName(order.customer_name);
    if (order.customer_phone) setCustomerPhone(order.customer_phone);
    if (order.customer_note) setCustomerNote(order.customer_note);
    setActiveHeldOrderId(order.id);
    setHeldOrdersModalOpen(false);

    toast({
      title: "Held order resumed",
      description: `Loaded ${order.item_count || order.cart_data?.length || 0} item(s) back into cart.`,
    });
  };

  const handleDeleteHeldOrder = async (orderId: string) => {
    if (!active?.id) return;
    await deleteHeldOrder(orderId, active.id);
    if (activeHeldOrderId === orderId) {
      setActiveHeldOrderId(null);
    }
    refreshHeldOrders();
    toast({
      title: "Held order removed",
      description: "Order has been removed from the queue.",
    });
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
                className={`h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl text-xs font-bold tracking-wider inline-flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                  scanMode ? "bg-sky-500 text-white shadow-xs" : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                <ScanLine className="h-3.5 w-3.5" /> SCAN
              </button>
              <button
                type="button"
                onClick={() => navigate("/dashboard/returns")}
                className="h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl text-xs font-bold tracking-wider inline-flex items-center justify-center gap-1.5 bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0 cursor-pointer"
                title="Process Customer Returns & Refunds"
              >
                <RotateCcw className="h-3.5 w-3.5" /> RETURNS
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
                  const stockInfo = computeProductStock(p.stock_units, p.name, p.description, p.uom, p.units_per_uom, p.base_unit);
                  const out = stockInfo.totalSubUnits <= 0;
                  const low = !out && stockInfo.listingStock <= p.min_stock_alert;
                  const parsed = parseProductUOM(p.name, p.description || "", p.uom, p.units_per_uom, p.base_unit);
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
                            {variationsMap[p.id] && (variationsMap[p.id].product_type === "variable" || variationsMap[p.id].product_type === "measured" || variationsMap[p.id].product_type === "addons" || (variationsMap[p.id].variants && variationsMap[p.id].variants.length > 0)) && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 uppercase">
                                {variationsMap[p.id].product_type === "variable" ? `${variationsMap[p.id].variants?.length || 0} Variants` : variationsMap[p.id].product_type === "measured" ? "Scale / Wt" : "Options"}
                              </span>
                            )}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border uppercase">
                              {parsed.packSize > 1 ? `${parsed.packSize} ${parsed.subUnitName}s/${parsed.uomLabel}` : parsed.uomLabel}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                              out ? "bg-rose-500/15 text-rose-500" : low ? "bg-amber-500/15 text-amber-500" : "bg-emerald-500/15 text-emerald-500"
                            }`}>
                              {out
                                ? "OUT OF STOCK"
                                : stockInfo.displayText}
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

            <div className="flex items-center gap-1.5">
              {/* Held Orders Queue Button */}
              <button
                type="button"
                id="pos-held-orders-queue-btn"
                onClick={() => setHeldOrdersModalOpen(true)}
                className="relative h-8 px-2.5 rounded-xl border border-border/80 bg-muted/30 hover:bg-muted/70 text-xs font-bold flex items-center gap-1.5 text-foreground transition cursor-pointer"
                title="View Held Orders Queue"
              >
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span className="hidden sm:inline">Held</span>
                {heldOrders.length > 0 && (
                  <span className="h-4 min-w-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-extrabold flex items-center justify-center">
                    {heldOrders.length}
                  </span>
                )}
              </button>

              {/* Hold Current Cart Button */}
              <button
                type="button"
                id="pos-hold-cart-btn"
                disabled={cart.length === 0}
                onClick={handleHoldCart}
                className="h-8 px-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 transition cursor-pointer"
                title="Hold current cart & customer"
              >
                <PauseCircle className="h-3.5 w-3.5" />
                <span>Hold</span>
              </button>

              {/* Clear Cart */}
              <button
                onClick={clearCart}
                disabled={cart.length === 0}
                className="h-8 w-8 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-rose-500 disabled:opacity-40 transition cursor-pointer"
                title="Clear Cart & Reset Customer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Resumed Order Banner */}
          {activeHeldOrderId && (
            <div className="px-3 py-1.5 bg-amber-500/15 border-b border-amber-500/25 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-200 font-bold">
                <Clock className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                <span>Resumed Held Order (Auto-clears on sale)</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveHeldOrderId(null)}
                className="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
              >
                Detach
              </button>
            </div>
          )}

          {/* Customer / Buyer Account Quick Details Header */}
          <div className={`p-3 border-b border-border flex-shrink-0 ${selectedBuyer ? "bg-emerald-500/5" : "bg-muted/20"}`}>
            {selectedBuyer ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-bold truncate text-foreground">{selectedBuyer.customerName}</p>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono text-[9px] font-extrabold">
                          {selectedBuyer.buyerId}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">
                        {selectedBuyer.customerPhone ? `Tel: ${selectedBuyer.customerPhone}` : "No phone registered"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setBuyerModalRequiredFor(null);
                        setBuyerModalOpen(true);
                      }}
                      className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline px-1.5 py-0.5 rounded hover:bg-sky-500/10 transition cursor-pointer"
                    >
                      Change
                    </button>
                    <span className="text-muted-foreground text-[10px]">&bull;</span>
                    <button
                      type="button"
                      onClick={handleClearBuyerAccount}
                      className="text-[11px] font-bold text-rose-500 hover:underline px-1.5 py-0.5 rounded hover:bg-rose-500/10 transition cursor-pointer"
                    >
                      Detach
                    </button>
                  </div>
                </div>

                {/* Separate Balances Badges: Available Deposit vs Outstanding Udhar */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/60">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-emerald-800 dark:text-emerald-200 uppercase">Available Deposit</span>
                    <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                      {fmt(selectedBuyer.availableDeposit)}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-amber-800 dark:text-amber-200 uppercase">Current Udhar</span>
                    <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                      {fmt(selectedBuyer.outstandingUdhar)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div>
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
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setBuyerModalRequiredFor(null);
                        setBuyerModalOpen(true);
                      }}
                      className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1 border border-emerald-500/25"
                      title="Link confirmed Buyer ID or registered phone for Store Credit / Udhar"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      <span>Link Buyer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCustomerForm((v) => !v)}
                      className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline px-2 py-1 rounded-md hover:bg-sky-500/10 transition cursor-pointer"
                    >
                      {showCustomerForm ? "Done" : customerName || customerPhone ? "Edit" : "+ Rx"}
                    </button>
                  </div>
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
                {cart.map((l) => {
                  const gross = getLineGross(l);
                  const lineDisc = getLineDiscount(l);
                  const lineTotal = getLineTotal(l);
                  const hasLineDisc = lineDisc > 0;

                  return (
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

                      {/* Quantity & Item Discount Controls */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-border/50 gap-2">
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

                        {/* Item-level discount button / input */}
                        <div className="flex items-center gap-1.5 ml-auto">
                          {l.isEditingDiscount ? (
                            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
                              <input
                                type="number"
                                min="0"
                                max={l.discountType === "fixed" ? gross : 100}
                                autoFocus
                                defaultValue={l.discountType === "fixed" ? l.discountAmount || 0 : l.discountPct || 0}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setLineDiscount(l.lineId, val, l.discountType || "pct");
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const val = parseFloat((e.target as HTMLInputElement).value) || 0;
                                    setLineDiscount(l.lineId, val, l.discountType || "pct");
                                  }
                                }}
                                className="w-14 h-6 px-1 text-center bg-background border border-border rounded text-xs font-bold"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const nextType = l.discountType === "fixed" ? "pct" : "fixed";
                                  setLineDiscount(l.lineId, l.discountType === "fixed" ? (l.discountPct || 0) : (l.discountAmount || 0), nextType);
                                }}
                                className="px-1.5 h-6 text-[10px] font-bold rounded bg-muted hover:bg-muted/80"
                                title="Toggle % or $"
                              >
                                {l.discountType === "fixed" ? symbol : "%"}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleLineDiscountEdit(l.lineId)}
                                className="px-1.5 h-6 text-[10px] font-bold text-sky-500 hover:text-sky-600 cursor-pointer"
                              >
                                Done
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleLineDiscountEdit(l.lineId)}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                                hasLineDisc
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              }`}
                              title="Add item discount"
                            >
                              <Tag className="w-2.5 h-2.5" />
                              <span>{hasLineDisc ? `-${fmt(lineDisc)}` : "Item Disc"}</span>
                            </button>
                          )}

                          <div className="text-right pl-1 min-w-[60px]">
                            {hasLineDisc && (
                              <span className="line-through text-[10px] text-muted-foreground block -mb-0.5">
                                {fmt(gross)}
                              </span>
                            )}
                            <p className="text-sm font-bold text-sky-500">{fmt(lineTotal)}</p>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Financial summary + payment (Always pinned footer) */}
          <div className="border-t border-border p-3.5 space-y-2.5 flex-shrink-0 bg-card shadow-2xl z-20 mt-auto">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Subtotal ({cart.length} items)</span>
              <span className="font-bold">{fmt(grossSubtotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
                <span className="font-medium">Total Discount {itemDiscountsTotal > 0 && cartDiscountValue > 0 ? "(Items + Order)" : itemDiscountsTotal > 0 ? "(Items)" : `(${discountPct}%)`}</span>
                <span className="font-bold">−{fmt(totalDiscount)}</span>
              </div>
            )}
            {isTaxEnabled && effectiveTaxRate > 0 && (
              <div className="flex items-center justify-between text-xs py-0.5">
                <span className="text-muted-foreground font-medium">{posConfig.taxLabel || "Tax"} ({effectiveTaxRate}%)</span>
                <span className="font-bold">
                  {isTaxInclusive ? "(incl. " : "+"}{fmt(gst)}{isTaxInclusive ? ")" : ""}
                </span>
              </div>
            )}
            {showTaxBreakdown && isTaxEnabled && enableSecondaryTax && secondaryTaxRate > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {isTaxInclusive ? "Includes " : ""}{posConfig.secondaryTaxLabel || "Surcharge"} ({secondaryTaxRate}%)
                </span>
                <span className="font-bold">{isTaxInclusive ? "" : "+"}{fmt(secondaryGst)}</span>
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

            {/* Payment Methods & Split Pay */}
            <div className="space-y-2 pt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Payment Method
                </span>
                <button
                  type="button"
                  onClick={() => setIsSplitPayment(!isSplitPayment)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition cursor-pointer flex items-center gap-1 ${
                    isSplitPayment
                      ? "bg-sky-500 text-white shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ArrowRightLeft className="w-3 h-3" />
                  Split Pay
                </button>
              </div>

              {!isSplitPayment ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {paymentMethods
                      .filter((pm) => pm.id !== "credit" && pm.type !== "credit")
                      .map((pm) => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setPayMethod(pm.id)}
                          className={`h-9 px-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer truncate ${
                            payMethod === pm.id
                              ? "bg-foreground text-background shadow-xs"
                              : "bg-muted/60 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {pm.type === "cash" ? (
                            <Banknote className="h-3.5 w-3.5 shrink-0" />
                          ) : pm.type === "card" ? (
                            <CreditCard className="h-3.5 w-3.5 shrink-0" />
                          ) : pm.type === "wallet" || pm.type === "digital" ? (
                            <Smartphone className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="truncate">{pm.name}</span>
                        </button>
                      ))}
                  </div>

                  {/* Dedicated Store Credit / Udhar Balance Payment Options */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPayMethod("credit_deposit");
                        if (!selectedBuyer) {
                          setBuyerModalRequiredFor("deposit");
                          setBuyerModalOpen(true);
                        }
                      }}
                      className={`h-9 px-2 rounded-xl text-xs font-bold inline-flex items-center justify-between gap-1 transition cursor-pointer border ${
                        payMethod === "credit_deposit"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Wallet className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Use Store Credit</span>
                      </div>
                      {selectedBuyer ? (
                        <span className="text-[10px] font-mono px-1 rounded bg-black/20 shrink-0">
                          {fmt(selectedBuyer.availableDeposit)}
                        </span>
                      ) : (
                        <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                          Link
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPayMethod("credit_udhar");
                        if (!selectedBuyer) {
                          setBuyerModalRequiredFor("udhar");
                          setBuyerModalOpen(true);
                        }
                      }}
                      className={`h-9 px-2 rounded-xl text-xs font-bold inline-flex items-center justify-between gap-1 transition cursor-pointer border ${
                        payMethod === "credit_udhar"
                          ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25 hover:bg-amber-500/20"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Add to Udhar</span>
                      </div>
                      {selectedBuyer ? (
                        <span className="text-[10px] font-mono px-1 rounded bg-black/20 shrink-0">
                          {fmt(selectedBuyer.outstandingUdhar)}
                        </span>
                      ) : (
                        <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300">
                          Link
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Feedback Banner for Store Credit Deposit */}
                  {payMethod === "credit_deposit" && (
                    <div className="pt-0.5">
                      {!selectedBuyer ? (
                        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between">
                          <span className="text-[11px] font-medium">Link buyer to spend advance deposit</span>
                          <button
                            type="button"
                            onClick={() => {
                              setBuyerModalRequiredFor("deposit");
                              setBuyerModalOpen(true);
                            }}
                            className="font-bold underline text-amber-700 dark:text-amber-300 cursor-pointer"
                          >
                            Link Now
                          </button>
                        </div>
                      ) : selectedBuyer.availableDeposit < grandTotal ? (
                        <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold text-[11px]">
                            <span>Insufficient Store Credit Deposit</span>
                            <span>{fmt(selectedBuyer.availableDeposit)} avail</span>
                          </div>
                          <p className="text-[10px] leading-tight">
                            Total is {fmt(grandTotal)}. Switch to Split Pay to spend {fmt(selectedBuyer.availableDeposit)} deposit + remainder via Cash, Card, or Udhar.
                          </p>
                        </div>
                      ) : (
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-200 text-xs">
                          <div className="flex items-center justify-between font-bold text-[11px]">
                            <span>Deposit Coverage Verified</span>
                            <span className="font-mono">Balance After: {fmt(selectedBuyer.availableDeposit - grandTotal)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Feedback Banner for Add to Udhar */}
                  {payMethod === "credit_udhar" && (
                    <div className="pt-0.5">
                      {!selectedBuyer ? (
                        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between">
                          <span className="text-[11px] font-medium">Link buyer to record Udhar debt</span>
                          <button
                            type="button"
                            onClick={() => {
                              setBuyerModalRequiredFor("udhar");
                              setBuyerModalOpen(true);
                            }}
                            className="font-bold underline text-amber-700 dark:text-amber-300 cursor-pointer"
                          >
                            Link Now
                          </button>
                        </div>
                      ) : selectedBuyer.outstandingUdhar + grandTotal > selectedBuyer.creditLimit ? (
                        <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold text-[11px]">
                            <span>Credit Limit Exceeded</span>
                            <span>Limit: {fmt(selectedBuyer.creditLimit)}</span>
                          </div>
                          <p className="text-[10px] leading-tight">
                            Current Udhar is {fmt(selectedBuyer.outstandingUdhar)}. Adding {fmt(grandTotal)} would reach {fmt(selectedBuyer.outstandingUdhar + grandTotal)}.
                          </p>
                        </div>
                      ) : (
                        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-200 text-xs">
                          <div className="flex items-center justify-between font-bold text-[11px]">
                            <span>Udhar Credit Approved</span>
                            <span className="font-mono">New Debt: {fmt(selectedBuyer.outstandingUdhar + grandTotal)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isCashLike && (
                    <div className="space-y-1.5 pt-1">
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

                      {/* 1-Click Partial Cash Allocation (e.g. Paid $75 on $100 -> Put remaining $25 on Udhar or Deposit) */}
                      {cashNum > 0 && cashNum < grandTotal && (
                        <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 space-y-2 mt-1.5 animate-in fade-in">
                          <div className="flex items-center justify-between text-[11px] font-bold text-foreground">
                            <span>Partial Cash Tendered:</span>
                            <span className="text-amber-600 dark:text-amber-400 font-mono font-extrabold">
                              Remaining Balance: {fmt(grandTotal - cashNum)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>Allocate remaining balance on checkout:</span>
                            {selectedBuyer && (
                              <span className="font-semibold text-foreground font-mono">{selectedBuyer.buyerId}</span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setPartialCashOption("udhar");
                                if (!selectedBuyer) {
                                  setBuyerModalRequiredFor("udhar");
                                  setBuyerModalOpen(true);
                                }
                              }}
                              className={`h-9 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                                partialCashOption === "udhar"
                                  ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                  : "bg-card text-foreground border-border hover:bg-muted"
                              }`}
                            >
                              <FileText className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">Add {fmt(grandTotal - cashNum)} to Udhar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setPartialCashOption("deposit");
                                if (!selectedBuyer) {
                                  setBuyerModalRequiredFor("deposit");
                                  setBuyerModalOpen(true);
                                }
                              }}
                              className={`h-9 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                                partialCashOption === "deposit"
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                  : "bg-card text-foreground border-border hover:bg-muted"
                              }`}
                            >
                              <Wallet className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">Use {fmt(grandTotal - cashNum)} Deposit</span>
                            </button>
                          </div>
                          {!selectedBuyer && (
                            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-700 dark:text-amber-300 font-medium flex items-center justify-between">
                              <span>No buyer linked yet</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setBuyerModalRequiredFor("udhar");
                                  setBuyerModalOpen(true);
                                }}
                                className="font-bold underline cursor-pointer"
                              >
                                Select Buyer Account →
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Option to Save Change to Store Credit Deposit */}
                      {changeDue > 0 && selectedBuyer && (
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs mt-1.5 flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={depositChangeToCredit}
                              onChange={(e) => setDepositChangeToCredit(e.target.checked)}
                              className="w-4 h-4 rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                              Save change of {fmt(changeDue)} to {selectedBuyer.customerName}'s Store Credit Deposit
                            </span>
                          </label>
                        </div>
                      )}

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
                </>
              ) : (
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border space-y-2">
                  <div className="text-[11px] font-bold text-foreground flex items-center justify-between">
                    <span>Split Tender</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Total: {fmt(grandTotal)}</span>
                  </div>

                  {/* Quick Preset Buttons for Split Tender */}
                  <div className="flex items-center gap-1.5 flex-wrap pb-1 border-b border-border/60">
                    <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Presets:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSplitMethod1("cash");
                        setSplitMethod2("credit_udhar");
                        if (!selectedBuyer) {
                          setBuyerModalRequiredFor("udhar");
                          setBuyerModalOpen(true);
                        }
                      }}
                      className="px-2 py-0.5 rounded-md bg-card border border-border text-[10px] font-bold hover:bg-muted text-foreground transition cursor-pointer"
                    >
                      Cash + Udhar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSplitMethod1("cash");
                        setSplitMethod2("credit_deposit");
                        if (!selectedBuyer) {
                          setBuyerModalRequiredFor("deposit");
                          setBuyerModalOpen(true);
                        }
                      }}
                      className="px-2 py-0.5 rounded-md bg-card border border-border text-[10px] font-bold hover:bg-muted text-foreground transition cursor-pointer"
                    >
                      Cash + Deposit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSplitMethod1("card");
                        setSplitMethod2("credit_udhar");
                        if (!selectedBuyer) {
                          setBuyerModalRequiredFor("udhar");
                          setBuyerModalOpen(true);
                        }
                      }}
                      className="px-2 py-0.5 rounded-md bg-card border border-border text-[10px] font-bold hover:bg-muted text-foreground transition cursor-pointer"
                    >
                      Card + Udhar
                    </button>
                  </div>

                  {/* Split Line 1 */}
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={splitMethod1}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSplitMethod1(val);
                        if ((val === "credit_deposit" || val === "credit_udhar") && !selectedBuyer) {
                          setBuyerModalRequiredFor(val === "credit_deposit" ? "deposit" : "udhar");
                          setBuyerModalOpen(true);
                        }
                      }}
                      className="h-8 px-2 rounded-lg bg-card border border-border text-xs font-bold text-foreground focus:outline-none"
                    >
                      {paymentMethods
                        .filter((m) => m.id !== "credit" && m.type !== "credit")
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      <option value="credit_deposit">
                        Store Credit Deposit {selectedBuyer ? `(${fmt(selectedBuyer.availableDeposit)})` : "(Link Buyer)"}
                      </option>
                      <option value="credit_udhar">
                        Add to Udhar {selectedBuyer ? `(${fmt(selectedBuyer.outstandingUdhar)})` : "(Link Buyer)"}
                      </option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={splitAmount1}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSplitAmount1(val);
                        const num = Number(val) || 0;
                        const remainder = Math.max(0, grandTotal - num);
                        setSplitAmount2(remainder > 0 ? remainder.toFixed(2) : "0");
                      }}
                      placeholder="Amount 1"
                      className="h-8 px-2 rounded-lg bg-card border border-border text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  {/* Split Line 2 */}
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={splitMethod2}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSplitMethod2(val);
                        if ((val === "credit_deposit" || val === "credit_udhar") && !selectedBuyer) {
                          setBuyerModalRequiredFor(val === "credit_deposit" ? "deposit" : "udhar");
                          setBuyerModalOpen(true);
                        }
                      }}
                      className="h-8 px-2 rounded-lg bg-card border border-border text-xs font-bold text-foreground focus:outline-none"
                    >
                      {paymentMethods
                        .filter((m) => m.id !== "credit" && m.type !== "credit")
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      <option value="credit_deposit">
                        Store Credit Deposit {selectedBuyer ? `(${fmt(selectedBuyer.availableDeposit)})` : "(Link Buyer)"}
                      </option>
                      <option value="credit_udhar">
                        Add to Udhar {selectedBuyer ? `(${fmt(selectedBuyer.outstandingUdhar)})` : "(Link Buyer)"}
                      </option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={splitAmount2}
                      onChange={(e) => setSplitAmount2(e.target.value)}
                      placeholder="Amount 2"
                      className="h-8 px-2 rounded-lg bg-card border border-border text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[10px] font-bold">
                    <span className="text-muted-foreground">
                      Allocated: {fmt((Number(splitAmount1) || 0) + (Number(splitAmount2) || 0))}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const half = (grandTotal / 2).toFixed(2);
                        setSplitAmount1(half);
                        setSplitAmount2((grandTotal - Number(half)).toFixed(2));
                      }}
                      className="text-sky-500 hover:underline cursor-pointer"
                    >
                      50 / 50 Split
                    </button>
                  </div>
                </div>
              )}
            </div>

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

      {/* Held Orders Modal */}
      <HeldOrdersModal
        open={heldOrdersModalOpen}
        onOpenChange={setHeldOrdersModalOpen}
        orders={heldOrders}
        onResume={handleResumeHeldOrder}
        onDelete={handleDeleteHeldOrder}
        formatMoney={fmt}
      />

      <SaleReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        data={receipt}
        onNewCustomer={() => setReceiptOpen(false)}
      />

      {/* Verified Buyer Selection Modal for Store Credit / Udhar */}
      <POSBuyerSelectionModal
        open={buyerModalOpen}
        onOpenChange={setBuyerModalOpen}
        businessId={active?.id || ""}
        selectedBuyer={selectedBuyer}
        onSelectBuyer={handleSelectBuyerAccount}
        requiredForPayment={buyerModalRequiredFor}
      />

      {/* Product Variations, Attribute Combos & Modifiers Selection Modal */}
      <POSVariantSelectionModal
        open={variantModalOpen}
        onOpenChange={setVariantModalOpen}
        product={selectedProductForVariant}
        variationConfig={selectedProductForVariant ? variationsMap[selectedProductForVariant.id] : undefined}
        onConfirm={handleConfirmVariantSelection}
        formatMoney={fmt}
      />
    </UserPanelGate>
  );
};

export default UserPOS;
