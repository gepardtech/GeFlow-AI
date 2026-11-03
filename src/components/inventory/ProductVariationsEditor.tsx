import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMoney } from "@/lib/currency";
import {
  Layers,
  Sparkles,
  Plus,
  Trash2,
  RefreshCw,
  Scale,
  UtensilsCrossed,
  Package,
  Wand2,
  Tag,
  Check,
  CheckCircle2,
  Boxes,
  Shirt,
  DollarSign,
  ChevronDown,
} from "lucide-react";
import type {
  ProductType,
  ProductAttributeOption,
  ProductVariantItem,
  ProductModifierGroup,
  ProductVariationsConfig,
} from "@/server/productVariationsStorage";

interface Props {
  config: ProductVariationsConfig;
  onChange: (updated: ProductVariationsConfig) => void;
  basePrice: number;
  baseCost: number;
  baseSku: string;
  industryType?: string;
}

const PRODUCT_TYPES: Array<{
  type: ProductType;
  label: string;
  icon: React.ElementType;
  description: string;
}> = [
  {
    type: "simple",
    label: "Simple Product",
    icon: Package,
    description: "Standard single SKU with fixed price and inventory",
  },
  {
    type: "variable",
    label: "Variable Product",
    icon: Layers,
    description: "Attributes & multi-variant matrix (Size, Color, Flavour) with individual SKUs and stock",
  },
  {
    type: "addons",
    label: "Add-ons & Modifiers",
    icon: UtensilsCrossed,
    description: "Customizable extras (toppings, crusts, sauces, combo upgrades)",
  },
  {
    type: "measured",
    label: "Weight / Measured",
    icon: Scale,
    description: "Sold by weight, volume, or length (250g, 500g, kg, meters)",
  },
  {
    type: "bundle",
    label: "Bundle / Combo",
    icon: Boxes,
    description: "Grouped collection of multiple inventory products",
  },
  {
    type: "service",
    label: "Service / Non-Stock",
    icon: Tag,
    description: "Labor, delivery, consulting, or fee without inventory tracking",
  },
];

export const ProductVariationsEditor: React.FC<Props> = ({
  config,
  onChange,
  basePrice,
  baseCost,
  baseSku,
  industryType,
}) => {
  const { symbol, format: fmt } = useMoney();
  const { toast } = useToast();

  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrValues, setNewAttrValues] = useState("");
  const [newModifierGroupName, setNewModifierGroupName] = useState("");
  // Attribute option pricing overrides: { [attrName]: { [optionVal]: price } }
  const [attrPriceOverrides, setAttrPriceOverrides] = useState<Record<string, Record<string, number>>>({});

  const handleTypeChange = (type: ProductType) => {
    onChange({
      ...config,
      product_type: type,
    });
  };

  const handleOptionPriceChange = (attrName: string, val: string, price: number) => {
    const nextOverrides = {
      ...attrPriceOverrides,
      [attrName]: {
        ...(attrPriceOverrides[attrName] || {}),
        [val]: price,
      },
    };
    setAttrPriceOverrides(nextOverrides);

    // If variants already exist, immediately update matching variants' retail prices
    if (config.variants && config.variants.length > 0) {
      const updatedVariants = config.variants.map((v) => {
        if (v.attributes && v.attributes[attrName] === val) {
          return { ...v, retail_price: price };
        }
        return v;
      });
      onChange({
        ...config,
        variants: updatedVariants,
      });
    }
  };

  const handleApplyAllOptionPrices = () => {
    if (!config.variants || config.variants.length === 0) return;

    const updatedVariants = config.variants.map((v) => {
      let resolvedPrice = v.retail_price;
      let matchedAny = false;

      // Check if variant matches any configured attribute override
      for (const [attrName, val] of Object.entries(v.attributes || {})) {
        const optionPrice = attrPriceOverrides[attrName]?.[val];
        if (optionPrice !== undefined && optionPrice > 0) {
          resolvedPrice = optionPrice;
          matchedAny = true;
          break;
        }
      }

      return matchedAny ? { ...v, retail_price: resolvedPrice } : v;
    });

    onChange({
      ...config,
      variants: updatedVariants,
    });

    toast({
      title: "Variety Prices Applied",
      description: "Updated variant prices across your product matrix based on option pricing.",
    });
  };

  // ---------------- ATTRIBUTES MANAGEMENT ----------------
  const handleAddAttribute = () => {
    const name = newAttrName.trim();
    if (!name) return;

    const values = newAttrValues
      .split(/[,|\n]/)
      .map((v) => v.trim())
      .filter(Boolean);

    if (values.length === 0) {
      toast({
        title: "Values required",
        description: "Please enter at least one value for this attribute (e.g. Small, Medium, Large).",
        variant: "destructive",
      });
      return;
    }

    const newAttr: ProductAttributeOption = {
      id: `attr_${Date.now()}`,
      name,
      values,
      generatesVariants: true,
      inputType: "pills",
    };

    onChange({
      ...config,
      attributes: [...(config.attributes || []), newAttr],
    });

    setNewAttrName("");
    setNewAttrValues("");
  };

  const handleRemoveAttribute = (id: string) => {
    onChange({
      ...config,
      attributes: config.attributes.filter((a) => a.id !== id),
    });
  };

  const handleAddValueToAttr = (attrId: string, val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    onChange({
      ...config,
      attributes: config.attributes.map((a) =>
        a.id === attrId && !a.values.includes(trimmed)
          ? { ...a, values: [...a.values, trimmed] }
          : a
      ),
    });
  };

  const handleRemoveValueFromAttr = (attrId: string, val: string) => {
    onChange({
      ...config,
      attributes: config.attributes.map((a) =>
        a.id === attrId
          ? { ...a, values: a.values.filter((v) => v !== val) }
          : a
      ),
    });
  };

  // ---------------- CARTESIAN COMBINATIONS GENERATOR ----------------
  const handleGenerateCombinations = () => {
    if (!config.attributes || config.attributes.length === 0) {
      toast({
        title: "No attributes defined",
        description: "Add at least one attribute (e.g. Size or Color) to generate combinations.",
        variant: "destructive",
      });
      return;
    }

    // Filter active attributes that have values
    const validAttrs = config.attributes.filter((a) => a.values.length > 0);
    if (validAttrs.length === 0) return;

    // Helper to cartesian product
    const cartesian = (arrays: string[][]): string[][] => {
      return arrays.reduce<string[][]>(
        (a, b) => a.flatMap((d) => b.map((e) => [...d, e])),
        [[]]
      );
    };

    const attrValuesArrays = validAttrs.map((a) => a.values);
    const combinations = cartesian(attrValuesArrays);

    const generatedVariants: ProductVariantItem[] = combinations.map((combo, idx) => {
      const attrMap: Record<string, string> = {};
      validAttrs.forEach((attr, i) => {
        attrMap[attr.name] = combo[i];
      });

      const comboName = combo.join(" / ");
      const skuSuffix = combo.map((c) => c.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3)).join("-");
      const sku = `${baseSku || "PROD"}-${skuSuffix || idx + 1}`;

      // Check if existing variant has same attributes to preserve user customizations
      const existing = config.variants?.find((v) => {
        for (const [k, val] of Object.entries(attrMap)) {
          if (v.attributes[k] !== val) return false;
        }
        return true;
      });

      if (existing && Number(existing.retail_price) > 0) {
        return existing;
      }

      // 1. Calculate price from explicit attribute overrides
      let calculatedRetailPrice = 0;
      let hasExplicitOverride = false;
      for (const [attrName, val] of Object.entries(attrMap)) {
        const override = attrPriceOverrides[attrName]?.[val];
        if (override !== undefined && Number(override) > 0) {
          calculatedRetailPrice += Number(override);
          hasExplicitOverride = true;
        }
      }

      // 2. If no explicit override, calculate intelligent tiered pricing based on attribute tiers
      if (!hasExplicitOverride || calculatedRetailPrice <= 0) {
        const effectiveBase = Number(basePrice) > 0 ? Number(basePrice) : 500;
        let sizeMultiplier = 1.0;

        const sizeAttr = validAttrs.find((a) => /size|weight|portion|scale|volume|gauge/i.test(a.name)) || validAttrs[0];
        if (sizeAttr) {
          const valIndex = sizeAttr.values.indexOf(attrMap[sizeAttr.name]);
          const tiers = [1.0, 1.4, 1.7, 2.1, 2.5, 3.0];
          sizeMultiplier = tiers[Math.min(Math.max(0, valIndex), tiers.length - 1)];
        }

        calculatedRetailPrice = Math.round(effectiveBase * sizeMultiplier);

        // Check if secondary attribute adds crust or premium modifier
        const crustAttr = validAttrs.find((a) => /crust|topping|style|type|premium/i.test(a.name));
        if (crustAttr) {
          const crustVal = (attrMap[crustAttr.name] || "").toLowerCase();
          if (crustVal.includes("cheese") || crustVal.includes("burst") || crustVal.includes("stuffed")) {
            calculatedRetailPrice += 150;
          } else if (crustVal.includes("thin") || crustVal.includes("crispy")) {
            calculatedRetailPrice += 50;
          }
        }
      }

      const calculatedPurchaseCost = baseCost > 0
        ? Math.round(baseCost * (calculatedRetailPrice / (basePrice || calculatedRetailPrice || 1)))
        : Math.round(calculatedRetailPrice * 0.5);

      return {
        id: existing?.id || `var_${Date.now()}_${idx}`,
        parent_id: config.product_id,
        name: comboName,
        sku,
        retail_price: calculatedRetailPrice,
        purchase_cost: calculatedPurchaseCost,
        stock_units: 10,
        attributes: attrMap,
        active: true,
      };
    });

    onChange({
      ...config,
      variants: generatedVariants,
    });

    toast({
      title: "Combinations Generated",
      description: `Generated ${generatedVariants.length} distinct variant SKUs ready for individual pricing and inventory tracking.`,
    });
  };

  // ---------------- VARIANT ROW EDITS ----------------
  const handleUpdateVariant = (id: string, updates: Partial<ProductVariantItem>) => {
    onChange({
      ...config,
      variants: config.variants.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    });
  };

  const handleRemoveVariant = (id: string) => {
    onChange({
      ...config,
      variants: config.variants.filter((v) => v.id !== id),
    });
  };

  // ---------------- MODIFIERS / ADDONS MANAGEMENT ----------------
  const handleAddModifierGroup = () => {
    const name = newModifierGroupName.trim();
    if (!name) return;
    const newGroup: ProductModifierGroup = {
      id: `mod_${Date.now()}`,
      name,
      required: false,
      options: [
        { id: `opt_${Date.now()}_1`, name: "Option 1", price: 0 },
      ],
    };
    onChange({
      ...config,
      modifiers: [...(config.modifiers || []), newGroup],
    });
    setNewModifierGroupName("");
  };

  const handleAddOptionToGroup = (groupId: string) => {
    onChange({
      ...config,
      modifiers: config.modifiers.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: [
                ...g.options,
                { id: `opt_${Date.now()}`, name: "New Add-on", price: 1.0 },
              ],
            }
          : g
      ),
    });
  };

  const handleUpdateOption = (groupId: string, optId: string, updates: Partial<{ name: string; price: number }>) => {
    onChange({
      ...config,
      modifiers: config.modifiers.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: g.options.map((o) => (o.id === optId ? { ...o, ...updates } : o)),
            }
          : g
      ),
    });
  };

  const handleRemoveOption = (groupId: string, optId: string) => {
    onChange({
      ...config,
      modifiers: config.modifiers.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: g.options.filter((o) => o.id !== optId),
            }
          : g
      ),
    });
  };

  const handleRemoveModifierGroup = (groupId: string) => {
    onChange({
      ...config,
      modifiers: config.modifiers.filter((g) => g.id !== groupId),
    });
  };

  // Quick Preset Loader based on Industry
  const handleLoadIndustryPreset = (presetType: "pizza" | "clothing" | "sweets" | "bakery") => {
    if (presetType === "pizza") {
      const pizzaAttrs: ProductAttributeOption[] = [
        { id: "p_size", name: "Size", values: ["Small 8\"", "Medium 10\"", "Large 12\"", "Family 14\""], generatesVariants: true, inputType: "pills" },
        { id: "p_crust", name: "Crust", values: ["Classic Hand Tossed", "Thin Crust", "Cheese Burst"], generatesVariants: true, inputType: "pills" },
      ];

      const pizzaVariants: ProductVariantItem[] = [
        { id: `var_piz_1`, parent_id: config.product_id, name: "Small 8\" / Classic Hand Tossed", sku: `${baseSku || "PIZ"}-S-TOSS`, retail_price: 500, purchase_cost: 250, stock_units: 999999, attributes: { Size: "Small 8\"", Crust: "Classic Hand Tossed" }, active: true },
        { id: `var_piz_2`, parent_id: config.product_id, name: "Small 8\" / Thin Crust", sku: `${baseSku || "PIZ"}-S-THIN`, retail_price: 550, purchase_cost: 270, stock_units: 999999, attributes: { Size: "Small 8\"", Crust: "Thin Crust" }, active: true },
        { id: `var_piz_3`, parent_id: config.product_id, name: "Small 8\" / Cheese Burst", sku: `${baseSku || "PIZ"}-S-BURST`, retail_price: 650, purchase_cost: 320, stock_units: 999999, attributes: { Size: "Small 8\"", Crust: "Cheese Burst" }, active: true },

        { id: `var_piz_4`, parent_id: config.product_id, name: "Medium 10\" / Classic Hand Tossed", sku: `${baseSku || "PIZ"}-M-TOSS`, retail_price: 750, purchase_cost: 375, stock_units: 999999, attributes: { Size: "Medium 10\"", Crust: "Classic Hand Tossed" }, active: true },
        { id: `var_piz_5`, parent_id: config.product_id, name: "Medium 10\" / Thin Crust", sku: `${baseSku || "PIZ"}-M-THIN`, retail_price: 800, purchase_cost: 400, stock_units: 999999, attributes: { Size: "Medium 10\"", Crust: "Thin Crust" }, active: true },
        { id: `var_piz_6`, parent_id: config.product_id, name: "Medium 10\" / Cheese Burst", sku: `${baseSku || "PIZ"}-M-BURST`, retail_price: 900, purchase_cost: 450, stock_units: 999999, attributes: { Size: "Medium 10\"", Crust: "Cheese Burst" }, active: true },

        { id: `var_piz_7`, parent_id: config.product_id, name: "Large 12\" / Classic Hand Tossed", sku: `${baseSku || "PIZ"}-L-TOSS`, retail_price: 850, purchase_cost: 425, stock_units: 999999, attributes: { Size: "Large 12\"", Crust: "Classic Hand Tossed" }, active: true },
        { id: `var_piz_8`, parent_id: config.product_id, name: "Large 12\" / Thin Crust", sku: `${baseSku || "PIZ"}-L-THIN`, retail_price: 900, purchase_cost: 450, stock_units: 999999, attributes: { Size: "Large 12\"", Crust: "Thin Crust" }, active: true },
        { id: `var_piz_9`, parent_id: config.product_id, name: "Large 12\" / Cheese Burst", sku: `${baseSku || "PIZ"}-L-BURST`, retail_price: 1050, purchase_cost: 520, stock_units: 999999, attributes: { Size: "Large 12\"", Crust: "Cheese Burst" }, active: true },

        { id: `var_piz_10`, parent_id: config.product_id, name: "Family 14\" / Classic Hand Tossed", sku: `${baseSku || "PIZ"}-F-TOSS`, retail_price: 1100, purchase_cost: 550, stock_units: 999999, attributes: { Size: "Family 14\"", Crust: "Classic Hand Tossed" }, active: true },
        { id: `var_piz_11`, parent_id: config.product_id, name: "Family 14\" / Thin Crust", sku: `${baseSku || "PIZ"}-F-THIN`, retail_price: 1150, purchase_cost: 575, stock_units: 999999, attributes: { Size: "Family 14\"", Crust: "Thin Crust" }, active: true },
        { id: `var_piz_12`, parent_id: config.product_id, name: "Family 14\" / Cheese Burst", sku: `${baseSku || "PIZ"}-F-BURST`, retail_price: 1300, purchase_cost: 650, stock_units: 999999, attributes: { Size: "Family 14\"", Crust: "Cheese Burst" }, active: true },
      ];

      setAttrPriceOverrides({
        Size: { "Small 8\"": 500, "Medium 10\"": 750, "Large 12\"": 850, "Family 14\"": 1100 },
        Crust: { "Classic Hand Tossed": 0, "Thin Crust": 50, "Cheese Burst": 150 },
      });

      onChange({
        ...config,
        product_type: "variable",
        attributes: pizzaAttrs,
        variants: pizzaVariants,
        modifiers: [
          {
            id: "m_toppings",
            name: "Extra Toppings",
            required: false,
            options: [
              { id: "opt_cheese", name: "Extra Mozzarella", price: 150 },
              { id: "opt_jalapenos", name: "Jalapenos", price: 80 },
              { id: "opt_olives", name: "Black Olives", price: 80 },
            ],
          },
        ],
      });
    } else if (presetType === "clothing") {
      const clothAttrs = [
        { id: "c_size", name: "Size", values: ["S", "M", "L", "XL", "XXL"], generatesVariants: true, inputType: "pills" as const },
        { id: "c_color", name: "Color", values: ["Black", "White", "Navy", "Olive"], generatesVariants: true, inputType: "pills" as const },
      ];
      const clothVariants: ProductVariantItem[] = [
        { id: "var_c_1", parent_id: config.product_id, name: "S / Black", sku: `${baseSku || "CLOTH"}-S-BLK`, retail_price: 1200, purchase_cost: 600, stock_units: 15, attributes: { Size: "S", Color: "Black" }, active: true },
        { id: "var_c_2", parent_id: config.product_id, name: "M / Black", sku: `${baseSku || "CLOTH"}-M-BLK`, retail_price: 1200, purchase_cost: 600, stock_units: 20, attributes: { Size: "M", Color: "Black" }, active: true },
        { id: "var_c_3", parent_id: config.product_id, name: "L / Black", sku: `${baseSku || "CLOTH"}-L-BLK`, retail_price: 1300, purchase_cost: 650, stock_units: 20, attributes: { Size: "L", Color: "Black" }, active: true },
        { id: "var_c_4", parent_id: config.product_id, name: "XL / Black", sku: `${baseSku || "CLOTH"}-XL-BLK`, retail_price: 1400, purchase_cost: 700, stock_units: 15, attributes: { Size: "XL", Color: "Black" }, active: true },
        { id: "var_c_5", parent_id: config.product_id, name: "XXL / Black", sku: `${baseSku || "CLOTH"}-XXL-BLK`, retail_price: 1500, purchase_cost: 750, stock_units: 10, attributes: { Size: "XXL", Color: "Black" }, active: true },
      ];

      setAttrPriceOverrides({
        Size: { S: 1200, M: 1200, L: 1300, XL: 1400, XXL: 1500 },
      });

      onChange({
        ...config,
        product_type: "variable",
        attributes: clothAttrs,
        variants: clothVariants,
        modifiers: [],
      });
    } else if (presetType === "sweets") {
      onChange({
        ...config,
        product_type: "measured",
        weight_unit: "g",
        price_per_base_unit: basePrice || 800,
        quick_presets: [250, 500, 750, 1000],
        attributes: [],
        modifiers: [
          {
            id: "m_box",
            name: "Gift Packaging",
            required: false,
            options: [
              { id: "opt_box_reg", name: "Standard Sweet Box", price: 0 },
              { id: "opt_box_gold", name: "Gold Premium Gift Box", price: 150 },
            ],
          },
        ],
      });
    } else if (presetType === "bakery") {
      const bakeAttrs = [
        { id: "b_weight", name: "Cake Weight", values: ["0.5 kg (1 lb)", "1 kg (2 lb)", "2 kg (4 lb)"], generatesVariants: true, inputType: "pills" as const },
        { id: "b_flavor", name: "Flavor", values: ["Dutch Chocolate", "Vanilla Bean", "Red Velvet"], generatesVariants: true, inputType: "pills" as const },
      ];
      const bakeVariants: ProductVariantItem[] = [
        { id: "var_b_1", parent_id: config.product_id, name: "0.5 kg (1 lb) / Dutch Chocolate", sku: `${baseSku || "CAKE"}-05-CHOC`, retail_price: 700, purchase_cost: 350, stock_units: 999999, attributes: { "Cake Weight": "0.5 kg (1 lb)", Flavor: "Dutch Chocolate" }, active: true },
        { id: "var_b_2", parent_id: config.product_id, name: "1 kg (2 lb) / Dutch Chocolate", sku: `${baseSku || "CAKE"}-10-CHOC`, retail_price: 1300, purchase_cost: 650, stock_units: 999999, attributes: { "Cake Weight": "1 kg (2 lb)", Flavor: "Dutch Chocolate" }, active: true },
        { id: "var_b_3", parent_id: config.product_id, name: "2 kg (4 lb) / Dutch Chocolate", sku: `${baseSku || "CAKE"}-20-CHOC`, retail_price: 2400, purchase_cost: 1200, stock_units: 999999, attributes: { "Cake Weight": "2 kg (4 lb)", Flavor: "Dutch Chocolate" }, active: true },
      ];

      setAttrPriceOverrides({
        "Cake Weight": { "0.5 kg (1 lb)": 700, "1 kg (2 lb)": 1300, "2 kg (4 lb)": 2400 },
      });

      onChange({
        ...config,
        product_type: "variable",
        attributes: bakeAttrs,
        variants: bakeVariants,
      });
    }

    toast({
      title: "Preset Loaded with Real Pricing",
      description: `Loaded attributes and verified variety prices (${presetType}).`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Product Type Selector Tabs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-sky-500" />
            Product Architecture &amp; Variation Engine
          </span>
          {/* Quick industry buttons */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleLoadIndustryPreset("pizza")}
              className="text-[10px] h-6 px-2 text-muted-foreground hover:text-foreground"
            >
              Pizza Preset
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleLoadIndustryPreset("clothing")}
              className="text-[10px] h-6 px-2 text-muted-foreground hover:text-foreground"
            >
              Clothing Preset
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleLoadIndustryPreset("sweets")}
              className="text-[10px] h-6 px-2 text-muted-foreground hover:text-foreground"
            >
              Weight Preset
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRODUCT_TYPES.map((item) => {
            const Icon = item.icon;
            const isSelected = config.product_type === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => handleTypeChange(item.type)}
                className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2.5 ${
                  isSelected
                    ? "bg-sky-500/10 border-sky-500 text-sky-600 dark:text-sky-400 shadow-sm"
                    : "bg-card hover:bg-muted border-border text-foreground"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isSelected
                      ? "bg-sky-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold block truncate">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground line-clamp-1">
                    {item.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------- VARIABLE PRODUCT VIEW ---------------- */}
      {config.product_type === "variable" && (
        <div className="space-y-4 pt-2 border-t border-border">
          {/* Attributes Builder */}
          <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                  1. Define Product Attributes (Size, Color, Material, etc.)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Specify dimensions or options that generate unique purchasable variations.
                </span>
              </div>
            </div>

            {/* Existing Attributes List */}
            {config.attributes && config.attributes.length > 0 && (
              <div className="space-y-2">
                {config.attributes.map((attr) => (
                  <div
                    key={attr.id}
                    className="p-3 rounded-xl bg-card border border-border space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-sky-500" />
                        {attr.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAttribute(attr.id)}
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {attr.values.map((val) => (
                        <Badge
                          key={val}
                          variant="secondary"
                          className="text-xs py-0.5 px-2 font-medium flex items-center gap-1 bg-muted border border-border"
                        >
                          <span>{val}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveValueFromAttr(attr.id, val)}
                            className="hover:text-destructive ml-0.5"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}

                      {/* Add single value input */}
                      <input
                        type="text"
                        placeholder="+ Add value and press Enter"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddValueToAttr(attr.id, (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = "";
                          }
                        }}
                        className="text-xs px-2 py-0.5 bg-background border border-border rounded-md w-44 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Attribute Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
              <Input
                placeholder="Attribute name (e.g. Size, Color)"
                value={newAttrName}
                onChange={(e) => setNewAttrName(e.target.value)}
                className="text-xs h-9 sm:col-span-4"
              />
              <Input
                placeholder="Comma separated values (e.g. S, M, L, XL)"
                value={newAttrValues}
                onChange={(e) => setNewAttrValues(e.target.value)}
                className="text-xs h-9 sm:col-span-6"
              />
              <Button
                type="button"
                onClick={handleAddAttribute}
                className="text-xs h-9 sm:col-span-2 bg-sky-500 hover:bg-sky-600 text-white gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </Button>
            </div>
          </div>

          {/* Step 2: Quick Variety Pricing by Option */}
          {config.attributes && config.attributes.length > 0 && (
            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/25 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300 block flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-purple-500" />
                    Quick Variety Pricing by Option
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Define separate prices for each option (e.g. Small: 500, Medium: 750, Large: 850). Each variety retains its real price.
                  </span>
                </div>
                {config.variants && config.variants.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyAllOptionPrices}
                    className="text-[11px] h-7 bg-purple-600 hover:bg-purple-700 text-white font-bold"
                  >
                    Apply to All Varieties
                  </Button>
                )}
              </div>

              <div className="space-y-2.5">
                {config.attributes.map((attr) => (
                  <div key={attr.id} className="p-2.5 rounded-lg bg-card/80 border border-border space-y-1.5">
                    <span className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                      {attr.name} Prices ({symbol})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {attr.values.map((val) => {
                        const currentPrice = attrPriceOverrides[attr.name]?.[val] ?? (
                          config.variants?.find((v) => v.attributes && v.attributes[attr.name] === val)?.retail_price ?? ""
                        );
                        return (
                          <div key={val} className="flex items-center gap-1 bg-muted/60 border border-border px-2 py-1 rounded-lg">
                            <span className="text-xs font-semibold text-foreground mr-1">{val}:</span>
                            <span className="text-xs font-bold text-muted-foreground">{symbol}</span>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              placeholder="0"
                              value={currentPrice}
                              onChange={(e) => handleOptionPriceChange(attr.name, val, parseFloat(e.target.value) || 0)}
                              className="w-16 h-6 px-1.5 text-xs font-bold bg-background border border-border rounded focus:outline-none focus:border-purple-500"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Combinations Generator Button & Actions */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20">
            <div>
              <span className="text-xs font-bold text-sky-700 dark:text-sky-300 block">
                3. Generate Variation Combinations
              </span>
              <span className="text-[11px] text-muted-foreground">
                Computes every combination (e.g. Size × Crust) with distinct variety prices and inventory stocks.
              </span>
            </div>
            <Button
              type="button"
              onClick={handleGenerateCombinations}
              className="text-xs font-bold h-9 bg-sky-500 hover:bg-sky-600 text-white gap-1.5 shadow-sm"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Generate All Combinations
            </Button>
          </div>

          {/* Variants Matrix Table */}
          {config.variants && config.variants.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                    4. Generated Variants Matrix ({config.variants.length} variations)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Total variant stock:{" "}
                    <strong className="text-foreground">
                      {config.variants.reduce((sum, v) => sum + (v.active ? Number(v.stock_units || 0) : 0), 0)} units
                    </strong>
                  </span>
                </div>
                {(() => {
                  const variantPrices = config.variants.map((v) => Number(v.retail_price) || 0).filter((p) => p > 0);
                  const minP = variantPrices.length > 0 ? Math.min(...variantPrices) : 0;
                  const maxP = variantPrices.length > 0 ? Math.max(...variantPrices) : 0;
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-500/15 px-2.5 py-1 rounded-lg border border-purple-500/30">
                        Price Range: {fmt(minP)} – {fmt(maxP)}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="rounded-xl border border-border overflow-hidden bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/60 text-muted-foreground uppercase font-bold text-[10px] border-b border-border">
                      <tr>
                        <th className="py-2.5 px-3">Variant</th>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Price ({symbol})</th>
                        <th className="py-2.5 px-3">Cost ({symbol})</th>
                        <th className="py-2.5 px-3">Stock</th>
                        <th className="py-2.5 px-3 text-center">Active</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {config.variants.map((v) => (
                        <tr
                          key={v.id}
                          className={`hover:bg-muted/30 transition ${
                            !v.active ? "opacity-50" : ""
                          }`}
                        >
                          <td className="py-2.5 px-3 font-semibold text-foreground whitespace-nowrap">
                            {v.name}
                          </td>
                          <td className="py-2.5 px-3">
                            <Input
                              value={v.sku}
                              onChange={(e) => handleUpdateVariant(v.id, { sku: e.target.value })}
                              className="font-mono text-xs h-7 w-28"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <Input
                              type="number"
                              step="0.01"
                              value={v.retail_price}
                              onChange={(e) =>
                                handleUpdateVariant(v.id, { retail_price: parseFloat(e.target.value) || 0 })
                              }
                              className="text-xs h-7 w-20 font-bold"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <Input
                              type="number"
                              step="0.01"
                              value={v.purchase_cost ?? 0}
                              onChange={(e) =>
                                handleUpdateVariant(v.id, { purchase_cost: parseFloat(e.target.value) || 0 })
                              }
                              className="text-xs h-7 w-20"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <Input
                              type="number"
                              min="0"
                              value={v.stock_units}
                              onChange={(e) =>
                                handleUpdateVariant(v.id, { stock_units: parseInt(e.target.value, 10) || 0 })
                              }
                              className="text-xs h-7 w-16 font-semibold"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Switch
                              checked={v.active}
                              onCheckedChange={(checked) => handleUpdateVariant(v.id, { active: checked })}
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveVariant(v.id)}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- WEIGHT-BASED / MEASURED VIEW ---------------- */}
      {config.product_type === "measured" && (
        <div className="space-y-4 pt-2 border-t border-border">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
            <div>
              <span className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider block">
                Weight-Based &amp; Fractional Measurement Settings
              </span>
              <span className="text-[11px] text-muted-foreground">
                Configures price-per-base-unit and fast POS weight presets (e.g. Sweets, Produce, Fabrics, Spices).
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Measurement Unit
                </label>
                <div className="flex gap-2">
                  {["g", "kg", "lb", "oz", "ml", "l", "m"].map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => onChange({ ...config, weight_unit: u as any })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                        config.weight_unit === u
                          ? "bg-amber-500 text-white border-amber-600"
                          : "bg-card text-foreground border-border"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Price per 1000{config.weight_unit || "g"} (or 1 base unit)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={config.price_per_base_unit ?? basePrice}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      price_per_base_unit: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="h-9 text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Quick POS Preset Buttons
              </label>
              <div className="flex flex-wrap gap-2">
                {[100, 250, 500, 750, 1000, 2000].map((preset) => {
                  const currentPresets = config.quick_presets || [250, 500, 750, 1000];
                  const has = currentPresets.includes(preset);
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        const updated = has
                          ? currentPresets.filter((p) => p !== preset)
                          : [...currentPresets, preset].sort((a, b) => a - b);
                        onChange({ ...config, quick_presets: updated });
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold border transition ${
                        has
                          ? "bg-amber-500 text-white border-amber-600"
                          : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                      }`}
                    >
                      {preset >= 1000 ? `${preset / 1000}kg` : `${preset}g`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- ADD-ONS / MODIFIERS VIEW ---------------- */}
      {(config.product_type === "addons" || config.product_type === "variable" || config.product_type === "measured") && (
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                Add-on Groups &amp; Modifiers (Optional)
              </span>
              <span className="text-[11px] text-muted-foreground">
                Toppings, extra fillings, crust choices, or gift packaging.
              </span>
            </div>
          </div>

          {/* Existing Groups */}
          {config.modifiers && config.modifiers.map((group) => (
            <div key={group.id} className="p-3.5 rounded-xl bg-card border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">{group.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {group.options.length} options
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddOptionToGroup(group.id)}
                    className="h-7 text-[11px] px-2 gap-1 text-sky-600 dark:text-sky-400"
                  >
                    <Plus className="w-3 h-3" />
                    Option
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveModifierGroup(group.id)}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Options List */}
              <div className="space-y-1.5">
                {group.options.map((opt) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <Input
                      value={opt.name}
                      onChange={(e) => handleUpdateOption(group.id, opt.id, { name: e.target.value })}
                      placeholder="Add-on name (e.g. Extra Mozzarella)"
                      className="text-xs h-7 flex-1"
                    />
                    <div className="flex items-center gap-1 w-28">
                      <span className="text-xs text-muted-foreground font-semibold">+</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={opt.price}
                        onChange={(e) =>
                          handleUpdateOption(group.id, opt.id, { price: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="Price"
                        className="text-xs h-7 font-bold"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(group.id, opt.id)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Add Modifier Group Input */}
          <div className="flex items-center gap-2 pt-1">
            <Input
              placeholder="New Modifier Group (e.g. Toppings, Sauces, Packaging)"
              value={newModifierGroupName}
              onChange={(e) => setNewModifierGroupName(e.target.value)}
              className="text-xs h-8"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddModifierGroup}
              className="text-xs h-8 shrink-0 gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Group
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
