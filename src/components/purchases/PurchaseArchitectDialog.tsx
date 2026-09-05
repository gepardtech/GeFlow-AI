import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Truck, Package, Plus, Trash2, ArrowRight, Loader2, Scale, Layers, Sparkles, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMoney } from "@/lib/currency";
import { ALL_STANDARD_UOMS, parseProductUOM, computeProductStock } from "@/lib/uomRegistry";
import { recordStockMovement } from "@/lib/stockMovementService";

export interface PurchaseProduct {
  id: string;
  name: string;
  description?: string | null;
  stock_units: number;
  purchase_cost: number;
  retail_price: number;
  uom?: string | null;
  units_per_uom?: number | null;
  base_unit?: string | null;
}

interface LineItem {
  key: string;
  product_id: string;
  uom: string;
  multiplier: string;
  qty: string;
  purchase: string;
  sale: string;
  batch: string;
  expiry: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  businessId: string;
  userId: string;
  products: PurchaseProduct[];
  onSaved: () => void;
}

const blankLine = (): LineItem => ({
  key: Math.random().toString(36).slice(2),
  product_id: "",
  uom: "piece",
  multiplier: "1",
  qty: "1",
  purchase: "0",
  sale: "0",
  batch: "",
  expiry: "",
});

const PurchaseArchitectDialog = ({
  open,
  onOpenChange,
  businessId,
  userId,
  products,
  onSaved,
}: Props) => {
  const { toast } = useToast();
  const { symbol, format: fmt } = useMoney();

  const [supplier, setSupplier] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<LineItem[]>([blankLine()]);
  const [saving, setSaving] = useState(false);

  // Local product list to support on-the-fly additions
  const [localProducts, setLocalProducts] = useState<PurchaseProduct[]>(products);
  const [quickNewProductOpen, setQuickNewProductOpen] = useState(false);
  const [targetLineKeyForNewProduct, setTargetLineKeyForNewProduct] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Quick product form
  const [newProdName, setNewProdName] = useState("");
  const [newProdSku, setNewProdSku] = useState("");
  const [newProdSupplier, setNewProdSupplier] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("");
  const [newProdSubcategory, setNewProdSubcategory] = useState("");
  const [newProdUom, setNewProdUom] = useState("piece");
  const [newProdScale, setNewProdScale] = useState("1");
  const [newProdCost, setNewProdCost] = useState("");
  const [newProdRetail, setNewProdRetail] = useState("");
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  // Subcategories & Known Suppliers
  const [allSubcategories, setAllSubcategories] = useState<{ id: string; name: string; parent_id: string }[]>([]);
  const [knownSuppliers, setKnownSuppliers] = useState<string[]>([]);

  useEffect(() => {
    setLocalProducts(products);
  }, [products]);

  useEffect(() => {
    if (open && businessId) {
      // Load active categories without restrictive status filter to ensure all categories show
      const loadCategories = async () => {
        try {
          const { data: catData } = await supabase
            .from("product_categories")
            .select("id, name, parent_id, status")
            .order("name", { ascending: true });

          if (catData && catData.length > 0) {
            const parents = catData.filter((c: any) => !c.parent_id);
            const subs = catData.filter((c: any) => !!c.parent_id);
            setCategories(parents.length > 0 ? parents : catData);
            setAllSubcategories(subs);
          } else {
            // Fallback to business categories or standard default catalog
            const { data: bCat } = await supabase
              .from("business_categories")
              .select("id, name");
            if (bCat && bCat.length > 0) {
              setCategories(bCat.map((b: any) => ({ id: b.id, name: b.name, parent_id: null })));
            } else {
              const defaults = [
                { id: "cat-pharmacy-meds", name: "Medicines & Pharmaceuticals", parent_id: null },
                { id: "cat-health-care", name: "Health & Personal Care", parent_id: null },
                { id: "cat-grocery-staples", name: "Grocery & Staples", parent_id: null },
                { id: "cat-beverages-drinks", name: "Beverages & Drinks", parent_id: null },
                { id: "cat-dairy-bakery", name: "Dairy & Bakery", parent_id: null },
                { id: "cat-general-store", name: "General Retail & FMCG", parent_id: null },
              ];
              setCategories(defaults);
              setAllSubcategories([
                { id: "sub-tablets", name: "Tablets & Capsules", parent_id: "cat-pharmacy-meds" },
                { id: "sub-syrups", name: "Syrups & Liquids", parent_id: "cat-pharmacy-meds" },
                { id: "sub-injections", name: "Injections & Vials", parent_id: "cat-pharmacy-meds" },
                { id: "sub-skin-care", name: "Skincare & Topicals", parent_id: "cat-health-care" },
                { id: "sub-snacks", name: "Snacks & Confectionery", parent_id: "cat-grocery-staples" },
                { id: "sub-cold-drinks", name: "Juices & Cold Drinks", parent_id: "cat-beverages-drinks" },
              ]);
            }
          }
        } catch (err) {
          console.warn("Category load error in purchase architect:", err);
        }
      };

      loadCategories();

      // Load known past suppliers
      supabase
        .from("purchases")
        .select("supplier_name")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(100)
        .then(({ data }) => {
          if (data) {
            const unique = Array.from(new Set(data.map((d: any) => d.supplier_name?.trim()).filter(Boolean)));
            setKnownSuppliers(unique as string[]);
          }
        });
    }
  }, [open, businessId]);

  useEffect(() => {
    if (open) {
      setSupplier("");
      setInvoiceRef("");
      setEntryDate(new Date().toISOString().slice(0, 10));
      setLines([blankLine()]);
    }
  }, [open]);

  const setLine = (key: string, patch: Partial<LineItem>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = () => setLines((prev) => [...prev, blankLine()]);
  const removeLine = (key: string) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  const availableSubcategories = useMemo(() => {
    if (!newProdCategory) return [];
    return allSubcategories.filter((s) => s.parent_id === newProdCategory);
  }, [newProdCategory, allSubcategories]);

  const openQuickAddProductModal = (lineKey?: string) => {
    setTargetLineKeyForNewProduct(lineKey || lines[0]?.key || null);
    const randNum = Math.floor(100000 + Math.random() * 900000);
    setNewProdName("");
    setNewProdSku(`SKU-${randNum}`);
    setNewProdSupplier(supplier || "");
    setNewProdCategory(categories[0]?.id || "");
    setNewProdSubcategory("");
    setNewProdUom("piece");
    setNewProdScale("1");
    setNewProdCost("0");
    setNewProdRetail("0");
    setQuickNewProductOpen(true);
  };

  // Maryam AI smart auto-fill for unlisted products
  const handleAiAutoFillProduct = () => {
    if (!newProdName.trim()) {
      toast({
        title: "Enter Product Name",
        description: "Type a product name (e.g. 'Panadol Extra 20s Pack' or 'Brown Sugar 1kg') to analyze.",
        variant: "destructive",
      });
      return;
    }

    setAiAnalyzing(true);
    const raw = newProdName.trim().toLowerCase();

    // 1. Detect UOM & Scale
    let detectedUom = "piece";
    let detectedScale = "1";

    if (raw.includes("pack") || raw.includes("strip") || raw.includes("box") || raw.includes("carton") || raw.includes("dozen")) {
      if (raw.includes("pack")) detectedUom = "pack";
      else if (raw.includes("box")) detectedUom = "box";
      else if (raw.includes("strip")) detectedUom = "strip";
      else if (raw.includes("carton")) detectedUom = "carton";
      else if (raw.includes("dozen")) {
        detectedUom = "dozen";
        detectedScale = "12";
      }

      // Check for scale numbers e.g. 20s, 24x, 12pk, 10 tablets
      const numMatch = raw.match(/(\d+)\s*(?:pcs|pc|units|tablets|tabs|capsules|caps|s|pk|x)/i);
      if (numMatch && numMatch[1]) {
        detectedScale = numMatch[1];
      } else if (detectedScale === "1" && (detectedUom === "pack" || detectedUom === "box")) {
        detectedScale = "12";
      }
    } else if (raw.includes("bottle") || raw.includes("syrup") || raw.includes("ml") || raw.includes("liter") || raw.includes("ltr")) {
      detectedUom = raw.includes("ml") ? "ml" : raw.includes("liter") || raw.includes("ltr") ? "liter" : "bottle";
    } else if (raw.includes("kg") || raw.includes("gram") || raw.includes("gm") || raw.includes("weight")) {
      detectedUom = raw.includes("kg") ? "kg" : "gram";
    }

    // 2. Detect Category Match
    let matchedCatId = newProdCategory;
    if (categories.length > 0) {
      const match = categories.find((c) =>
        raw.includes(c.name.toLowerCase()) ||
        (c.name.toLowerCase().includes("pharm") && (raw.includes("mg") || raw.includes("tab") || raw.includes("syrup") || raw.includes("capsule"))) ||
        (c.name.toLowerCase().includes("bev") && (raw.includes("drink") || raw.includes("water") || raw.includes("juice") || raw.includes("milk"))) ||
        (c.name.toLowerCase().includes("food") && (raw.includes("rice") || raw.includes("snack") || raw.includes("biscuit") || raw.includes("sugar"))) ||
        (c.name.toLowerCase().includes("grocer") && (raw.includes("oil") || raw.includes("flour") || raw.includes("salt") || raw.includes("tea")))
      );
      if (match) {
        matchedCatId = match.id;
      }
    }

    // 3. Generate Clean SKU
    const prefix = newProdName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "PRD";
    const sku = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;

    // 4. Set inferred values
    setNewProdSku(sku);
    setNewProdUom(detectedUom);
    setNewProdScale(detectedScale);
    if (matchedCatId) setNewProdCategory(matchedCatId);

    // If cost is entered, calculate estimated 25% retail margin
    const currentCost = Number(newProdCost) || 0;
    if (currentCost > 0 && (!newProdRetail || Number(newProdRetail) === 0)) {
      setNewProdRetail((currentCost * 1.25).toFixed(2));
    }

    setTimeout(() => {
      setAiAnalyzing(false);
      toast({
        title: "Maryam AI Product Assistant",
        description: `Analyzed "${newProdName}": Configured as ${detectedUom.toUpperCase()} (Scale: ${detectedScale} units/pack) with auto-generated SKU.`,
      });
    }, 350);
  };

  const handleCreateNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      toast({ title: "Product name required", variant: "destructive" });
      return;
    }
    setCreatingProduct(true);
    const autoSku = newProdSku.trim() || `SKU-${Math.floor(100000 + Math.random() * 900000)}`;
    const cost = Number(newProdCost) || 0;
    const retail = Number(newProdRetail) || (cost > 0 ? cost * 1.25 : 0);
    const scaleNum = Number(newProdScale) || 1;

    const { data: { user } } = await supabase.auth.getUser();
    const effectiveUserId = user?.id || userId;

    const descTags = [`[UOM: ${newProdUom}]`];
    if (scaleNum > 1) {
      descTags.push(`[SCALE: ${scaleNum}]`);
      descTags.push(`[PIECES_PER_PACK: ${scaleNum}]`);
    }
    descTags.push(`[PACK_QTY: 0]`);
    descTags.push(`[BASE_QTY: 0]`);
    if (newProdSupplier.trim()) {
      descTags.push(`[SUPPLIER: ${newProdSupplier.trim()}]`);
      if (!supplier) {
        setSupplier(newProdSupplier.trim());
      }
    }

    const { data: newProd, error } = await supabase
      .from("products")
      .insert({
        business_id: businessId,
        owner_user_id: effectiveUserId,
        name: newProdName.trim(),
        internal_sku: autoSku,
        category_id: newProdCategory || null,
        subcategory_id: newProdSubcategory || null,
        description: descTags.join(" "),
        purchase_cost: cost,
        retail_price: retail,
        stock_units: 0,
        min_stock_alert: 10,
        status: "active",
      })
      .select("id, name, description, stock_units, purchase_cost, retail_price")
      .single();

    setCreatingProduct(false);

    if (error || !newProd) {
      toast({
        title: "Could not create product",
        description: error?.message,
        variant: "destructive",
      });
      return;
    }

    const createdItem: PurchaseProduct = {
      id: newProd.id,
      name: newProd.name,
      description: newProd.description,
      stock_units: newProd.stock_units ?? 0,
      purchase_cost: newProd.purchase_cost ?? cost,
      retail_price: newProd.retail_price ?? retail,
    };

    setLocalProducts((prev) => [createdItem, ...prev]);

    // Apply to target line
    if (targetLineKeyForNewProduct) {
      setLine(targetLineKeyForNewProduct, {
        product_id: createdItem.id,
        uom: newProdUom,
        multiplier: String(scaleNum),
        purchase: String(cost),
        sale: String(retail),
      });
    }

    toast({
      title: "Product added to catalog",
      description: `${createdItem.name} (${autoSku}) is now selected in purchase order with multiplier ${scaleNum}x.`,
    });
    setQuickNewProductOpen(false);
    onSaved();
  };

  const onProductPick = (key: string, pid: string) => {
    if (pid === "__NEW_PRODUCT__") {
      openQuickAddProductModal(key);
      return;
    }
    const p = localProducts.find((x) => x.id === pid);
    if (!p) {
      setLine(key, { product_id: pid });
      return;
    }

    const parsed = parseProductUOM(p.name, p.description || "");
    setLine(key, {
      product_id: pid,
      uom: parsed.uom || "piece",
      multiplier: String(parsed.packSize > 0 ? parsed.packSize : 1),
      purchase: String(p.purchase_cost || 0),
      sale: String(p.retail_price || 0),
    });
  };

  const grandTotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.purchase) || 0), 0),
    [lines]
  );

  const totalItems = useMemo(
    () =>
      lines.reduce((s, l) => {
        const qty = Number(l.qty) || 0;
        const mult = Number(l.multiplier) || 1;
        return s + qty * mult;
      }, 0),
    [lines]
  );

  const commit = async () => {
    if (!businessId) {
      toast({ title: "Business context missing", description: "Please select an active business.", variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const effectiveUserId = user?.id || userId;
    if (!effectiveUserId) {
      toast({ title: "Authentication required", description: "Please sign in to record purchases.", variant: "destructive" });
      return;
    }

    const valid = lines.filter((l) => l.product_id && l.product_id !== "__NEW_PRODUCT__" && (Number(l.qty) || 0) > 0);
    if (valid.length === 0) {
      toast({
        title: "Nothing to commit",
        description: "Please select at least one product with quantity greater than 0.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);

    try {
      const { data: purchase, error: perr } = await supabase
        .from("purchases")
        .insert({
          business_id: businessId,
          owner_user_id: effectiveUserId,
          supplier_name: (supplier || "General Supplier").trim(),
          invoice_ref: invoiceRef?.trim() || null,
          entry_date: entryDate || new Date().toISOString().slice(0, 10),
          total: +(grandTotal).toFixed(2),
          status: "completed",
        })
        .select("id")
        .single();

      if (perr || !purchase) {
        throw new Error(perr?.message || "Failed to create purchase record");
      }

      for (const l of valid) {
        const p = localProducts.find((x) => x.id === l.product_id) || products.find((x) => x.id === l.product_id);
        const pkgQty = Number(l.qty) || 0;
        const multiplier = Number(l.multiplier) || 1;
        const purchasePricePerPkg = Number(l.purchase) || 0;
        const salePricePerPkg = Number(l.sale) || 0;

        const uomObj = ALL_STANDARD_UOMS.find((u) => u.id === l.uom);
        const uomLabel = uomObj ? uomObj.name : l.uom;
        const itemTitle = multiplier > 1
          ? `${p?.name ?? "Product"} (${pkgQty} ${uomLabel} @ ${multiplier} units)`
          : (p?.name ?? "Product");

        // Column `quantity` in purchase_items is integer
        const integerQty = Math.max(1, Math.round(pkgQty));
        const sanitizedExpiry = l.expiry && l.expiry.trim() ? l.expiry.trim() : null;

        const { error: itemErr } = await supabase.from("purchase_items").insert({
          purchase_id: purchase.id,
          owner_user_id: effectiveUserId,
          product_id: l.product_id,
          product_name: itemTitle,
          quantity: integerQty,
          purchase_price: purchasePricePerPkg,
          sale_price: salePricePerPkg,
          batch_number: l.batch?.trim() || null,
          expiry_date: sanitizedExpiry,
        });
        if (itemErr) {
          console.warn("Purchase item insert error:", itemErr);
        }

        // Increase product stock in BASE UNITS (tablets, pieces, ml, etc.)
        const currentStockInfo = computeProductStock(p?.stock_units, p?.name, p?.description, p?.uom, p?.units_per_uom, p?.base_unit);
        const effectiveMultiplier = multiplier > 1
          ? multiplier
          : (currentStockInfo.packSize > 1 ? currentStockInfo.packSize : 1);
        const totalBaseUnitsAdded = Math.round(pkgQty * effectiveMultiplier);
        const newStock = Math.round(currentStockInfo.totalSubUnits + totalBaseUnitsAdded);

        const update: {
          stock_units: number;
          purchase_cost: number;
          retail_price?: number;
          batch_number?: string;
          expiry_date?: string;
          description?: string;
        } = {
          stock_units: newStock,
          purchase_cost: purchasePricePerPkg,
        };
        if (salePricePerPkg > 0) update.retail_price = salePricePerPkg;
        if (l.batch?.trim()) update.batch_number = l.batch.trim();
        if (sanitizedExpiry) update.expiry_date = sanitizedExpiry;

        if (p?.description) {
          let updatedDesc = p.description;
          const newPackQty = currentStockInfo.packSize > 0 ? +(newStock / currentStockInfo.packSize).toFixed(2) : newStock;
          if (updatedDesc.includes("[PACK_QTY:")) {
            updatedDesc = updatedDesc.replace(/\[PACK_QTY:\s*[^\]]+\]/i, `[PACK_QTY: ${newPackQty}]`);
          }
          if (updatedDesc.includes("[BASE_QTY:")) {
            updatedDesc = updatedDesc.replace(/\[BASE_QTY:\s*[^\]]+\]/i, `[BASE_QTY: ${newStock}]`);
          }
          update.description = updatedDesc;
        }

        await supabase.from("products").update(update).eq("id", l.product_id);

        // Record stock movement (quantity is in base units)
        await recordStockMovement({
          business_id: businessId,
          owner_user_id: effectiveUserId,
          product_id: l.product_id,
          quantity: totalBaseUnitsAdded,
          type: "in",
          reason: "purchase intake",
          note: `PO: PUR-${purchase.id.slice(0, 8)} · Received: ${pkgQty} ${uomLabel} (+${totalBaseUnitsAdded} ${currentStockInfo.subUnitName.toLowerCase()}s)${supplier ? ` · ${supplier}` : ""}`,
          reference_id: purchase.id,
          reference_type: "purchase_intake",
          created_by: effectiveUserId,
        });
      }

      toast({
        title: "Purchase successfully recorded",
        description: `PUR-${purchase.id.slice(0, 8).toUpperCase()}: ${valid.length} item(s) received · ${fmt(grandTotal)}.`,
      });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Purchase commit error:", err);
      toast({
        title: "Could not record purchase",
        description: err.message || "Database error while committing purchase.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "h-10 px-3 bg-card border border-border text-foreground rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors";

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden rounded-3xl border-border max-h-[92vh] flex flex-col bg-card">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-border bg-muted/20">
          <div className="flex items-start gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold leading-tight text-foreground">Purchase Architect &amp; Stock-In</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-500 border border-sky-500/20 uppercase">
                  UOM Pack Multipliers
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Record new stock-in with pack conversions (Cartons, Boxes, Bags, Mann, Liters) and automatic inventory calculation.
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Grand Total</p>
            <p className="text-2xl font-extrabold text-sky-500">{fmt(grandTotal)}</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Transaction details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Supplier Entity</label>
                {knownSuppliers.length > 0 && (
                  <span className="text-[9px] font-semibold text-sky-500">
                    {knownSuppliers.length} known
                  </span>
                )}
              </div>
              <input
                list="known-suppliers-list"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g. MedCare Pharmaceuticals / Agro Wholesalers"
                className={inputCls}
              />
              <datalist id="known-suppliers-list">
                {knownSuppliers.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Invoice / Reference No.</label>
              <input
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                placeholder="e.g. INV-90231"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Entry Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Itemized */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-sky-500" />
                <h3 className="font-extrabold text-sm text-foreground">Itemized Stock-In Lines</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openQuickAddProductModal()}
                  className="h-9 px-3 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-sky-500/20 transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-sky-500" /> New Product
                </button>
                <button
                  type="button"
                  onClick={addLine}
                  className="h-9 px-3.5 rounded-xl border border-border text-xs font-bold inline-flex items-center gap-1.5 hover:bg-muted transition"
                >
                  <Plus className="h-3.5 w-3.5 text-sky-500" /> Add Line Item
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border overflow-hidden bg-card">
              <div className="hidden lg:grid grid-cols-[1.8fr_0.9fr_0.6fr_0.8fr_0.8fr_1.1fr_auto] gap-3 px-4 py-2.5 bg-muted/40 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                <span>Product</span>
                <span>Purchase UOM &amp; Multiplier</span>
                <span>Pkg Qty</span>
                <span>Purchase ({symbol})</span>
                <span>Retail ({symbol})</span>
                <span>Batch / Expiry</span>
                <span></span>
              </div>
              <div className="divide-y divide-border">
                {lines.map((l) => {
                  const qty = Number(l.qty) || 0;
                  const mult = Number(l.multiplier) || 1;
                  const totalUnits = +(qty * mult).toFixed(2);

                  return (
                    <div
                      key={l.key}
                      className="grid grid-cols-1 lg:grid-cols-[1.8fr_0.9fr_0.6fr_0.8fr_0.8fr_1.1fr_auto] gap-3 px-4 py-3.5 items-start bg-card hover:bg-muted/10 transition"
                    >
                      {/* Product select */}
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase lg:hidden block mb-1">Product</label>
                        <select
                          value={l.product_id}
                          onChange={(e) => onProductPick(l.key, e.target.value)}
                          className={inputCls + " w-full font-medium"}
                        >
                          <option value="">Select Product...</option>
                          <option value="__NEW_PRODUCT__" className="text-sky-600 font-bold bg-sky-50 dark:bg-sky-950/40">
                            + Add New Product to Catalog...
                          </option>
                          {localProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* UOM and Multiplier */}
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase lg:hidden block mb-1">Purchase Unit &amp; Pack Size</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <select
                            value={l.uom}
                            onChange={(e) => setLine(l.key, { uom: e.target.value })}
                            className={inputCls + " w-full text-xs px-2"}
                          >
                            {ALL_STANDARD_UOMS.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={l.multiplier}
                            onChange={(e) => setLine(l.key, { multiplier: e.target.value })}
                            placeholder="x Units"
                            title="Units per package (e.g. 20 tabs/box, 24 boxes/carton, 40 kg/mann)"
                            className={inputCls + " w-full text-xs px-2"}
                          />
                        </div>
                      </div>

                      {/* Qty */}
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase lg:hidden block mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={l.qty}
                          onChange={(e) => setLine(l.key, { qty: e.target.value })}
                          className={inputCls + " w-full font-bold text-center"}
                        />
                        {mult > 1 && (
                          <span className="text-[9px] font-semibold text-sky-500 block text-center mt-1">
                            ={totalUnits} units
                          </span>
                        )}
                      </div>

                      {/* Purchase Price */}
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase lg:hidden block mb-1">Purchase Price</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.purchase}
                          onChange={(e) => setLine(l.key, { purchase: e.target.value })}
                          placeholder="Per Pack"
                          className={inputCls + " w-full"}
                        />
                      </div>

                      {/* Retail Price */}
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase lg:hidden block mb-1">Retail Price</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.sale}
                          onChange={(e) => setLine(l.key, { sale: e.target.value })}
                          placeholder="Per Pack"
                          className={inputCls + " w-full"}
                        />
                      </div>

                      {/* Batch & Expiry */}
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase lg:hidden block mb-1">Batch / Expiry</label>
                        <div className="flex flex-col gap-1.5">
                          <input
                            value={l.batch}
                            onChange={(e) => setLine(l.key, { batch: e.target.value })}
                            placeholder="Batch No."
                            className="h-8 px-2 bg-card border border-border text-foreground rounded-lg text-xs"
                          />
                          <input
                            type="date"
                            value={l.expiry}
                            onChange={(e) => setLine(l.key, { expiry: e.target.value })}
                            className="h-8 px-2 bg-card border border-border text-foreground rounded-lg text-xs"
                          />
                        </div>
                      </div>

                      {/* Delete */}
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => removeLine(l.key)}
                          className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-rose-500 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6 border-t border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-lg border border-border text-[11px] font-bold bg-card">
              LINES: {lines.length}
            </span>
            <span className="px-3 py-1.5 rounded-lg border border-border text-[11px] font-bold bg-card text-sky-500">
              TOTAL STOCK UNITS ADDED: {totalItems}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-xs font-bold tracking-widest text-muted-foreground hover:text-foreground transition uppercase"
            >
              Discard Draft
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={saving}
              className="h-12 px-6 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold inline-flex items-center gap-2 disabled:opacity-50 transition shadow-md"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Commit Purchase &amp; Update Stock <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Quick Product Creation Dialog */}
    <Dialog open={quickNewProductOpen} onOpenChange={setQuickNewProductOpen}>
      <DialogContent className="max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
            <Plus className="w-5 h-5 text-sky-500" />
            Quick Add Product to Catalog
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Create a new product record on-the-fly and automatically insert it into this purchase order.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateNewProduct} className="space-y-3.5 mt-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Product Name *
              </label>
              <button
                type="button"
                onClick={handleAiAutoFillProduct}
                disabled={aiAnalyzing}
                className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-sky-500 bg-sky-500/10 hover:bg-sky-500/20 px-2.5 py-0.5 rounded-full transition cursor-pointer border border-sky-500/30"
              >
                {aiAnalyzing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 text-sky-500" />
                )}
                Auto-Fill with Maryam AI
              </button>
            </div>
            <input
              type="text"
              required
              value={newProdName}
              onChange={(e) => {
                setNewProdName(e.target.value);
                if (!newProdSku || newProdSku.startsWith("SKU-")) {
                  const clean = e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "SKU";
                  const rand = Math.floor(100000 + Math.random() * 900000);
                  setNewProdSku(`${clean}-${rand}`);
                }
              }}
              placeholder="e.g. Organic Almond Milk 1L or Panadol Extra 20s"
              className={inputCls + " w-full font-medium"}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Internal SKU
              </label>
              <input
                type="text"
                value={newProdSku}
                onChange={(e) => setNewProdSku(e.target.value)}
                placeholder="SKU-123456"
                className={inputCls + " w-full font-mono text-xs"}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Base Unit (UOM)
              </label>
              <select
                value={newProdUom}
                onChange={(e) => setNewProdUom(e.target.value)}
                className={inputCls + " w-full capitalize text-xs"}
              >
                {ALL_STANDARD_UOMS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Category ({categories.length} loaded)
              </label>
              <select
                value={newProdCategory}
                onChange={(e) => {
                  setNewProdCategory(e.target.value);
                  setNewProdSubcategory("");
                }}
                className={inputCls + " w-full text-xs"}
              >
                <option value="">No Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Subcategory
              </label>
              <select
                value={newProdSubcategory}
                onChange={(e) => setNewProdSubcategory(e.target.value)}
                disabled={availableSubcategories.length === 0}
                className={inputCls + " w-full text-xs disabled:opacity-50"}
              >
                <option value="">None / General</option>
                {availableSubcategories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
              Supplier Name (Optional)
            </label>
            <input
              list="known-suppliers-list"
              type="text"
              value={newProdSupplier}
              onChange={(e) => setNewProdSupplier(e.target.value)}
              placeholder="e.g. Primary Distributor / Manufacturer"
              className={inputCls + " w-full text-xs"}
            />
          </div>

          <div className="p-3 bg-muted/30 border border-border rounded-xl">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Measurement Scale (Units / Pack)
              </label>
              <span className="text-[10px] font-bold text-sky-500">
                1 {newProdUom} = {newProdScale || "1"} single units
              </span>
            </div>
            <input
              type="number"
              min="1"
              step="any"
              value={newProdScale}
              onChange={(e) => setNewProdScale(e.target.value)}
              placeholder="e.g. 12"
              className={inputCls + " w-full text-xs font-semibold"}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Cost Price ({symbol})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newProdCost}
                onChange={(e) => {
                  setNewProdCost(e.target.value);
                  const cost = Number(e.target.value) || 0;
                  if (cost > 0 && (!newProdRetail || Number(newProdRetail) === 0)) {
                    setNewProdRetail((cost * 1.25).toFixed(2));
                  }
                }}
                className={inputCls + " w-full text-xs"}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Retail Price ({symbol})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newProdRetail}
                onChange={(e) => setNewProdRetail(e.target.value)}
                className={inputCls + " w-full text-xs font-semibold"}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-4">
            <button
              type="button"
              onClick={() => setQuickNewProductOpen(false)}
              className="h-10 px-4 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingProduct}
              className="h-10 px-5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50 transition"
            >
              {creatingProduct ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Save &amp; Select in Purchase
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default PurchaseArchitectDialog;
