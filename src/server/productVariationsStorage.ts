import fs from "fs";
import path from "path";
import { serverSupabase } from "./supabase";

export type ProductType =
  | "simple"
  | "variable"
  | "addons"
  | "bundle"
  | "measured"
  | "recipe"
  | "service";

export interface ProductAttributeOption {
  id: string;
  name: string; // e.g. "Size", "Color", "Flavor", "Crust"
  values: string[]; // e.g. ["Small", "Medium", "Large"]
  inputType?: "dropdown" | "radio" | "pills" | "color" | "multi_select";
  generatesVariants?: boolean;
  affectsPrice?: boolean;
}

export interface ProductVariantItem {
  id: string;
  parent_id: string;
  name: string; // e.g. "Red / M" or "Large / Stuffed"
  sku: string;
  barcode?: string;
  retail_price: number;
  purchase_cost?: number;
  stock_units: number;
  attributes: Record<string, string>; // e.g. { Size: "Large", Crust: "Stuffed" }
  image_url?: string;
  active: boolean;
}

export interface ProductModifierOption {
  id: string;
  name: string; // e.g. "Extra Cheese"
  price: number;
  is_default?: boolean;
}

export interface ProductModifierGroup {
  id: string;
  name: string; // e.g. "Toppings"
  required: boolean;
  min_selections?: number;
  max_selections?: number;
  options: ProductModifierOption[];
}

export interface ProductBundleItem {
  product_id: string;
  name: string;
  quantity: number;
}

export interface ProductVariationsConfig {
  product_id: string;
  business_id: string;
  product_type: ProductType;
  attributes: ProductAttributeOption[];
  variants: ProductVariantItem[];
  modifiers: ProductModifierGroup[];
  bundle_items?: ProductBundleItem[];
  weight_unit?: "g" | "kg" | "lb" | "oz" | "ml" | "l" | "m";
  price_per_base_unit?: number;
  quick_presets?: number[]; // e.g. [250, 500, 750, 1000] for 250g, 500g, etc.
  updated_at: string;
}

export interface CategoryTemplate {
  industry_type: string;
  display_name: string;
  recommended_product_type: ProductType;
  sample_attributes: ProductAttributeOption[];
  sample_variants_preview: string[];
  suggested_uom: string;
  pos_features: string[];
  description: string;
}

const DATA_FILE = path.join(process.cwd(), "data", "business_product_variations.json");

export const CATEGORY_TEMPLATES: Record<string, CategoryTemplate> = {
  restaurant: {
    industry_type: "restaurant",
    display_name: "Restaurant & Fast Food",
    recommended_product_type: "variable",
    sample_attributes: [
      { id: "attr_size", name: "Size", values: ["Small (8\")", "Medium (10\")", "Large (12\")", "XL (14\")"], generatesVariants: true, inputType: "pills" },
      { id: "attr_crust", name: "Crust Type", values: ["Thin & Crispy", "Pan Regular", "Cheese Stuffed"], generatesVariants: true, inputType: "pills" }
    ],
    sample_variants_preview: ["Small / Thin", "Medium / Pan", "Large / Stuffed"],
    suggested_uom: "piece",
    pos_features: ["Size Buttons", "Crust Selection", "Topping Add-ons", "Portion Pricing"],
    description: "Multi-size pizzas, burgers, crust selection, and customizable toppings."
  },
  bakery: {
    industry_type: "bakery",
    display_name: "Bakery & Cake Shop",
    recommended_product_type: "variable",
    sample_attributes: [
      { id: "attr_weight", name: "Cake Weight", values: ["1 Lb (0.5 kg)", "2 Lb (1.0 kg)", "3 Lb (1.5 kg)", "Slice"], generatesVariants: true, inputType: "pills" },
      { id: "attr_flavor", name: "Flavor", values: ["Belgian Chocolate", "Vanilla Bean", "Red Velvet", "Lotus Biscoff"], generatesVariants: true, inputType: "pills" }
    ],
    sample_variants_preview: ["1 Lb / Belgian Chocolate", "2 Lb / Red Velvet", "Slice / Vanilla"],
    suggested_uom: "piece",
    pos_features: ["Weight/Flavor Combinations", "Slice vs Whole", "Custom Messages"],
    description: "Tiered cake weights, artisanal flavors, slice formats, and bespoke orders."
  },
  sweets: {
    industry_type: "sweets",
    display_name: "Traditional Sweets & Confectionery",
    recommended_product_type: "measured",
    sample_attributes: [
      { id: "attr_box", name: "Packaging Format", values: ["Standard Box", "Luxury Gift Box", "Loose / Open Tray"], generatesVariants: false, inputType: "dropdown" }
    ],
    sample_variants_preview: ["250 g Box", "500 g Box", "1 kg Family Pack"],
    suggested_uom: "kg",
    pos_features: ["Quick Gram Buttons (250g, 500g, 1kg)", "Direct Weight Scale Entry", "Price per kg Calculation"],
    description: "Weight-based selling with quick 250g, 500g, 750g, and 1kg presets."
  },
  clothing: {
    industry_type: "clothing",
    display_name: "Clothing & Fashion Apparel",
    recommended_product_type: "variable",
    sample_attributes: [
      { id: "attr_size", name: "Size", values: ["XS", "S", "M", "L", "XL", "XXL"], generatesVariants: true, inputType: "pills" },
      { id: "attr_color", name: "Colour", values: ["Black", "White", "Navy Blue", "Olive Green"], generatesVariants: true, inputType: "color" }
    ],
    sample_variants_preview: ["Black / M", "Black / L", "White / M", "Navy / XL"],
    suggested_uom: "piece",
    pos_features: ["Size & Colour Matrix", "Barcode Scanning per Variant", "Independent Stock Tracking"],
    description: "Shopify-style Size x Colour combinations with independent SKU and stock tracking."
  },
  grocery: {
    industry_type: "grocery",
    display_name: "Grocery & Supermarket",
    recommended_product_type: "simple",
    sample_attributes: [
      { id: "attr_pack", name: "Packaging Size", values: ["Single Piece", "Pack of 6", "Carton of 24"], generatesVariants: true, inputType: "dropdown" }
    ],
    sample_variants_preview: ["Single Piece", "Pack of 6", "Carton of 24"],
    suggested_uom: "piece",
    pos_features: ["Pack-to-Piece Conversion", "High-speed Barcode Scanning", "Expiry & Batch Tracking"],
    description: "Individual piece, pack, carton multi-packaging with conversion factors."
  },
  pharmacy: {
    industry_type: "pharmacy",
    display_name: "Pharmacy & Healthcare",
    recommended_product_type: "variable",
    sample_attributes: [
      { id: "attr_strength", name: "Dosage Strength", values: ["250 mg", "500 mg", "1000 mg"], generatesVariants: true, inputType: "pills" },
      { id: "attr_pkg", name: "Packaging", values: ["Box (100 tabs)", "Strip (10 tabs)", "Single Dose"], generatesVariants: true, inputType: "dropdown" }
    ],
    sample_variants_preview: ["500 mg / Strip", "500 mg / Box", "250 mg / Strip"],
    suggested_uom: "strip",
    pos_features: ["Loose Dose Selling", "Batch & Expiry Controls", "Regulatory Warnings"],
    description: "Strength, strip, and box packaging hierarchy with loose tablet calculation."
  },
  electronics: {
    industry_type: "electronics",
    display_name: "Electronics & Tech Accessories",
    recommended_product_type: "variable",
    sample_attributes: [
      { id: "attr_storage", name: "Storage Capacity", values: ["64 GB", "128 GB", "256 GB", "512 GB"], generatesVariants: true, inputType: "pills" },
      { id: "attr_color", name: "Colour", values: ["Space Gray", "Silver", "Midnight Blue"], generatesVariants: true, inputType: "color" }
    ],
    sample_variants_preview: ["128 GB / Space Gray", "256 GB / Silver"],
    suggested_uom: "piece",
    pos_features: ["Serial / IMEI Tracking", "Warranty Options", "Bundle Accessories"],
    description: "Capacity, model, and colour variants with warranty and accessory bundling."
  },
  hardware: {
    industry_type: "hardware",
    display_name: "Hardware & Building Materials",
    recommended_product_type: "measured",
    sample_attributes: [
      { id: "attr_length", name: "Length / Dimension", values: ["1 Metre", "2.5 Metres", "5 Metres", "10 Metres Roll"], generatesVariants: true, inputType: "pills" },
      { id: "attr_gauge", name: "Gauge / Diameter", values: ["1/2 Inch", "3/4 Inch", "1 Inch"], generatesVariants: true, inputType: "dropdown" }
    ],
    sample_variants_preview: ["1/2 Inch / 2.5 Metres", "3/4 Inch / 5 Metres"],
    suggested_uom: "metre",
    pos_features: ["Length & Area Measurements", "Bulk Carton Conversion", "Supplier Purchase Units"],
    description: "Measured quantity sales by metre, foot, kg, or dimensional specifications."
  }
};

class ProductVariationsStorage {
  private cache: Record<string, ProductVariationsConfig> = {};

  constructor() {
    this.load();
    this.syncFromSupabase();
  }

  private load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        this.cache = JSON.parse(raw);
      }
    } catch {
      this.cache = {};
    }
  }

  private async syncFromSupabase() {
    try {
      const { data: row } = await serverSupabase
        .from("platform_settings")
        .select("id, alerts")
        .limit(1)
        .maybeSingle();
      if (row?.alerts && typeof row.alerts === "object") {
        const dbConfigs = (row.alerts as any).product_variations;
        if (dbConfigs && typeof dbConfigs === "object") {
          // Merge dbConfigs with priority
          this.cache = { ...this.cache, ...dbConfigs };
          try {
            const dir = path.dirname(DATA_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(DATA_FILE, JSON.stringify(this.cache, null, 2), "utf-8");
          } catch {
            /* ignore */
          }
        }
      }
    } catch (e) {
      console.warn("Notice syncing product variations from Supabase:", e);
    }
  }

  private persist() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.cache, null, 2), "utf-8");

      // Save to Supabase platform_settings alerts
      (async () => {
        try {
          const { data: row } = await serverSupabase.from("platform_settings").select("id, alerts").limit(1).maybeSingle();
          if (row?.id) {
            const alerts = row.alerts && typeof row.alerts === "object" ? { ...(row.alerts as any) } : {};
            alerts.product_variations = this.cache;
            await serverSupabase.from("platform_settings").update({ alerts, updated_at: new Date().toISOString() }).eq("id", row.id);
          }
        } catch (dbErr) {
          console.warn("Notice saving product variations to Supabase:", dbErr);
        }
      })();
    } catch (e) {
      console.warn("Failed to persist product variations data:", e);
    }
  }

  public getByProduct(productId: string): ProductVariationsConfig | null {
    return this.cache[productId] || null;
  }

  public getByBusiness(businessId: string): ProductVariationsConfig[] {
    return Object.values(this.cache).filter((c) => c.business_id === businessId);
  }

  public saveConfig(config: ProductVariationsConfig): ProductVariationsConfig {
    const updated = {
      ...config,
      updated_at: new Date().toISOString()
    };
    this.cache[config.product_id] = updated;
    this.persist();
    return updated;
  }

  public deleteConfig(productId: string): boolean {
    if (this.cache[productId]) {
      delete this.cache[productId];
      this.persist();
      return true;
    }
    return false;
  }

  public adjustVariantStock(productId: string, variantId: string, deltaQuantity: number): ProductVariantItem | null {
    const config = this.cache[productId];
    if (!config || !Array.isArray(config.variants)) return null;

    const variant = config.variants.find((v) => v.id === variantId);
    if (!variant) return null;

    variant.stock_units = Math.max(0, Math.round(variant.stock_units + deltaQuantity));
    config.updated_at = new Date().toISOString();
    this.persist();
    return variant;
  }

  public getTemplateForIndustry(industry: string): CategoryTemplate {
    const key = (industry || "").toLowerCase().trim();
    if (key.includes("pizza") || key.includes("cafe") || key.includes("rest") || key.includes("food")) {
      return CATEGORY_TEMPLATES.restaurant;
    }
    if (key.includes("bake") || key.includes("cake") || key.includes("bread")) {
      return CATEGORY_TEMPLATES.bakery;
    }
    if (key.includes("sweet") || key.includes("mithai") || key.includes("halwa")) {
      return CATEGORY_TEMPLATES.sweets;
    }
    if (key.includes("cloth") || key.includes("fash") || key.includes("apparel") || key.includes("garment") || key.includes("boutique")) {
      return CATEGORY_TEMPLATES.clothing;
    }
    if (key.includes("pharm") || key.includes("medic") || key.includes("drug") || key.includes("health")) {
      return CATEGORY_TEMPLATES.pharmacy;
    }
    if (key.includes("electr") || key.includes("phone") || key.includes("mobile") || key.includes("tech")) {
      return CATEGORY_TEMPLATES.electronics;
    }
    if (key.includes("hardw") || key.includes("build") || key.includes("paint") || key.includes("tool")) {
      return CATEGORY_TEMPLATES.hardware;
    }
    if (key.includes("groc") || key.includes("mart") || key.includes("super")) {
      return CATEGORY_TEMPLATES.grocery;
    }
    return CATEGORY_TEMPLATES.clothing; // Default versatile retail model
  }
}

export const productVariationsStorage = new ProductVariationsStorage();
