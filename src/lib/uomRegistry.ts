/**
 * GEFLOW — UNIT OF MEASURE (UOM) REGISTRY & SMART DOSE / CONVERSION ENGINE
 *
 * Provides structured, business/industry-aware Unit of Measure configurations,
 * search filters, validation, standard aliases, and AI / Algorithmic fractional
 * unit & medical/pharmacy dosage calculation logic.
 */

export type UOMCategory = "quantity" | "weight" | "volume" | "packaging" | "dimension";

export interface UOMOption {
  id: string;
  name: string;
  abbreviation: string;
  category: UOMCategory;
  description?: string;
  industries?: string[];
  baseUnit?: string;
  defaultMultiplier?: number;
}

export const ALL_STANDARD_UOMS: UOMOption[] = [
  // Quantity / Count units
  { id: "piece", name: "Piece", abbreviation: "pc", category: "quantity", description: "Individual single item count", baseUnit: "piece", defaultMultiplier: 1 },
  { id: "unit", name: "Unit", abbreviation: "unit", category: "quantity", description: "Generic standard single unit", baseUnit: "unit", defaultMultiplier: 1 },
  { id: "tablet", name: "Tablet", abbreviation: "tab", category: "quantity", description: "Solid pharmaceutical dosage", industries: ["pharmacy", "medical", "hospital"], baseUnit: "tablet", defaultMultiplier: 1 },
  { id: "capsule", name: "Capsule", abbreviation: "cap", category: "quantity", description: "Encapsulated pharmaceutical dose", industries: ["pharmacy", "medical", "hospital"], baseUnit: "capsule", defaultMultiplier: 1 },
  { id: "strip", name: "Strip", abbreviation: "strip", category: "packaging", description: "Blister strip of tablets/capsules (typically 10 tabs)", industries: ["pharmacy", "medical"], baseUnit: "tablet", defaultMultiplier: 10 },
  { id: "bottle", name: "Bottle", abbreviation: "btl", category: "packaging", description: "Glass or plastic bottle container (typically 100ml / 60ml)", industries: ["pharmacy", "grocery", "restaurant", "retail"], baseUnit: "ml", defaultMultiplier: 100 },
  { id: "box", name: "Box", abbreviation: "box", category: "packaging", description: "Standard commercial box (typically 20 units/tabs)", baseUnit: "piece", defaultMultiplier: 20 },
  { id: "pack", name: "Pack", abbreviation: "pk", category: "packaging", description: "Packaged group of items", baseUnit: "piece", defaultMultiplier: 12 },
  { id: "carton", name: "Carton", abbreviation: "ctn", category: "packaging", description: "Bulk transport carton (typically 24 boxes)", industries: ["wholesale", "warehouse", "retail", "grocery"], baseUnit: "box", defaultMultiplier: 24 },
  { id: "can", name: "Can / Tin", abbreviation: "can", category: "packaging", description: "Sealed metal container", industries: ["grocery", "restaurant", "supermarket"], baseUnit: "piece", defaultMultiplier: 1 },
  { id: "vial", name: "Vial", abbreviation: "vial", category: "packaging", description: "Small glass vessel for injectables", industries: ["pharmacy", "medical", "hospital"], baseUnit: "ml", defaultMultiplier: 5 },
  { id: "ampoule", name: "Ampoule", abbreviation: "amp", category: "packaging", description: "Single-use glass ampoule", industries: ["pharmacy", "medical", "hospital"], baseUnit: "ml", defaultMultiplier: 2 },
  { id: "tube", name: "Tube", abbreviation: "tube", category: "packaging", description: "Squeezable tube for creams/gels", industries: ["pharmacy", "cosmetics", "retail"], baseUnit: "g", defaultMultiplier: 30 },
  { id: "sachet", name: "Sachet / Pouch", abbreviation: "sachet", category: "packaging", description: "Small flexible packet", industries: ["pharmacy", "grocery", "fmcg"], baseUnit: "piece", defaultMultiplier: 1 },
  { id: "bag", name: "Bag", abbreviation: "bag", category: "packaging", description: "Paper or plastic bulk bag (e.g. 10kg/50kg)", baseUnit: "kg", defaultMultiplier: 10 },
  { id: "pair", name: "Pair", abbreviation: "pr", category: "quantity", description: "Set of two matching items", industries: ["retail", "fashion", "hardware"], baseUnit: "piece", defaultMultiplier: 2 },
  { id: "set", name: "Set", abbreviation: "set", category: "quantity", description: "Group of matched components", industries: ["electronics", "hardware", "retail"], baseUnit: "piece", defaultMultiplier: 1 },
  { id: "dozen", name: "Dozen", abbreviation: "doz", category: "quantity", description: "Pack of 12 items", industries: ["grocery", "retail", "supermarket"], baseUnit: "piece", defaultMultiplier: 12 },
  { id: "bundle", name: "Bundle", abbreviation: "bdl", category: "packaging", description: "Tied or grouped collection", baseUnit: "piece", defaultMultiplier: 10 },

  // Weight units
  { id: "mann", name: "Mann (40 kg)", abbreviation: "mann", category: "weight", description: "Traditional bulk weight (40 Kilograms)", industries: ["grocery", "wholesale", "agriculture"], baseUnit: "kg", defaultMultiplier: 40 },
  { id: "kg", name: "Kilogram", abbreviation: "kg", category: "weight", description: "Metric mass (1,000 grams)", baseUnit: "g", defaultMultiplier: 1000 },
  { id: "g", name: "Gram", abbreviation: "g", category: "weight", description: "Metric mass (base unit)", baseUnit: "g", defaultMultiplier: 1 },
  { id: "mg", name: "Milligram", abbreviation: "mg", category: "weight", description: "Pharmaceutical micro-mass", industries: ["pharmacy", "medical"], baseUnit: "mg", defaultMultiplier: 1 },
  { id: "lb", name: "Pound", abbreviation: "lb", category: "weight", description: "Imperial weight (16 oz)", baseUnit: "oz", defaultMultiplier: 16 },
  { id: "oz", name: "Ounce", abbreviation: "oz", category: "weight", description: "Imperial ounce", baseUnit: "oz", defaultMultiplier: 1 },

  // Volume units & Medical liquid dosage
  { id: "l", name: "Liter", abbreviation: "L", category: "volume", description: "Metric volume (1,000 ml)", baseUnit: "ml", defaultMultiplier: 1000 },
  { id: "ml", name: "Milliliter", abbreviation: "ml", category: "volume", description: "Metric liquid volume", baseUnit: "ml", defaultMultiplier: 1 },
  { id: "fl_oz", name: "Fluid Ounce", abbreviation: "fl oz", category: "volume", description: "Imperial fluid volume (~30 ml)", baseUnit: "ml", defaultMultiplier: 30 },
  { id: "gal", name: "Gallon", abbreviation: "gal", category: "volume", description: "Standard liquid gallon (~3.785 L)", baseUnit: "l", defaultMultiplier: 3.785 },

  // Dimension / Length units
  { id: "meter", name: "Meter", abbreviation: "m", category: "dimension", description: "Linear length (100 cm)", industries: ["hardware", "textile", "electronics"], baseUnit: "cm", defaultMultiplier: 100 },
  { id: "cm", name: "Centimeter", abbreviation: "cm", category: "dimension", description: "Linear measure", industries: ["hardware", "textile"], baseUnit: "cm", defaultMultiplier: 1 },
  { id: "foot", name: "Foot", abbreviation: "ft", category: "dimension", description: "Imperial length (12 in)", industries: ["hardware", "construction"], baseUnit: "in", defaultMultiplier: 12 },
  { id: "roll", name: "Roll", abbreviation: "roll", category: "dimension", description: "Continuous wound material", industries: ["hardware", "textile", "electronics"], baseUnit: "meter", defaultMultiplier: 50 },
  { id: "sheet", name: "Sheet", abbreviation: "sheet", category: "dimension", description: "Flat single material sheet", industries: ["hardware", "stationery"], baseUnit: "piece", defaultMultiplier: 1 },
];

/**
 * Normalizes industry string for matching
 */
const normalizeStr = (s?: string | null) => (s || "").trim().toLowerCase();

/**
 * Returns tailored UOM options STRICTLY filtered based on the business's industry / business category.
 * Non-pharmacy retail/grocery businesses NEVER see pharmaceutical units (tablet, capsule, strip, vial, etc.).
 */
export function getUOMsForBusiness(industryType?: string | null, categoryName?: string | null): UOMOption[] {
  const ind = normalizeStr(industryType);
  const cat = normalizeStr(categoryName);

  const isPharma = ind.includes("pharm") || ind.includes("medic") || ind.includes("health") || ind.includes("clinic") || ind.includes("hospital") || cat.includes("pharm") || cat.includes("medic");
  const isGrocery = ind.includes("groc") || ind.includes("super") || ind.includes("food") || ind.includes("fmcg") || ind.includes("baker") || ind.includes("snack") || ind.includes("market") || cat.includes("groc") || cat.includes("super") || cat.includes("food") || cat.includes("fmcg") || cat.includes("agri");
  const isElectronics = ind.includes("elect") || ind.includes("mobile") || ind.includes("tech") || ind.includes("computer") || cat.includes("elect") || cat.includes("mobile");
  const isHardware = ind.includes("hardw") || ind.includes("build") || ind.includes("const") || ind.includes("tool") || ind.includes("paint") || cat.includes("hardw");
  const isRestaurant = ind.includes("rest") || ind.includes("cafe") || ind.includes("dining") || ind.includes("fast food") || cat.includes("rest") || cat.includes("dining");
  const isFashion = ind.includes("cloth") || ind.includes("apparel") || ind.includes("fashion") || ind.includes("shoe") || ind.includes("textile") || cat.includes("cloth") || cat.includes("fashion");
  const isWholesale = ind.includes("whole") || ind.includes("distrib") || ind.includes("wareh") || cat.includes("whole");

  // Strict list of allowed IDs per industry
  let allowedIds: string[];

  if (isPharma) {
    allowedIds = [
      "piece", "tablet", "capsule", "strip", "bottle", "box", "pack",
      "vial", "ampoule", "tube", "sachet", "drop", "g", "mg", "ml", "l", "unit"
    ];
  } else if (isGrocery) {
    allowedIds = [
      "pack", "piece", "box", "carton", "bottle", "can", "bag", "sachet",
      "dozen", "kg", "g", "mann", "l", "ml", "bundle", "unit"
    ];
  } else if (isElectronics) {
    allowedIds = [
      "piece", "unit", "set", "pack", "box", "carton", "roll", "meter", "pair"
    ];
  } else if (isHardware) {
    allowedIds = [
      "piece", "unit", "box", "carton", "roll", "sheet", "set", "pair",
      "meter", "cm", "foot", "kg", "g", "bundle"
    ];
  } else if (isRestaurant) {
    allowedIds = [
      "piece", "pack", "box", "bottle", "can", "dozen", "kg", "g", "l", "ml", "unit"
    ];
  } else if (isFashion) {
    allowedIds = [
      "piece", "unit", "pair", "set", "pack", "box", "dozen", "meter", "bundle"
    ];
  } else if (isWholesale) {
    allowedIds = [
      "carton", "box", "pack", "piece", "bag", "bundle", "mann", "kg", "g", "l", "roll"
    ];
  } else {
    // Default Retail / General Store: Strictly NO pharmaceutical units (no tablet, capsule, strip, vial, ampoule, mg)
    allowedIds = [
      "piece", "unit", "pack", "box", "carton", "bottle", "can", "bag",
      "pair", "set", "dozen", "bundle", "tube", "sachet", "kg", "g", "l", "ml", "meter"
    ];
  }

  // Filter ALL_STANDARD_UOMS strictly to allowed IDs for this business
  const filtered = ALL_STANDARD_UOMS.filter((u) => allowedIds.includes(u.id));

  // Sort: prioritize most common units for that industry
  return filtered.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    if (isPharma) {
      if (["tablet", "capsule", "strip", "bottle", "box", "pack", "syrup"].includes(a.id)) scoreA += 10;
      if (["tablet", "capsule", "strip", "bottle", "box", "pack", "syrup"].includes(b.id)) scoreB += 10;
    } else if (isGrocery) {
      if (["pack", "piece", "box", "bottle", "can", "kg", "g"].includes(a.id)) scoreA += 10;
      if (["pack", "piece", "box", "bottle", "can", "kg", "g"].includes(b.id)) scoreB += 10;
    } else {
      if (["piece", "pack", "box", "unit", "pair", "set"].includes(a.id)) scoreA += 10;
      if (["piece", "pack", "box", "unit", "pair", "set"].includes(b.id)) scoreB += 10;
    }

    return scoreB - scoreA;
  });
}

/**
 * Filter UOM options by search query
 */
export function searchUOMs(query: string, options: UOMOption[]): UOMOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;

  return options.filter((opt) =>
    opt.name.toLowerCase().includes(q) ||
    opt.abbreviation.toLowerCase().includes(q) ||
    opt.id.toLowerCase().includes(q) ||
    opt.category.toLowerCase().includes(q) ||
    (opt.description && opt.description.toLowerCase().includes(q))
  );
}

/**
 * Parses UOM and pack metadata from a product's name and description.
 */
export interface ParsedProductUOM {
  uom: string;
  uomLabel: string;
  category: UOMCategory;
  packSize: number;
  baseUnit: string;
  subUnitName: string;
  isBulkWeight: boolean;
  isLiquidVolume: boolean;
  isPharmaPack: boolean;
}

export function parseProductUOM(
  productName: string = "",
  description: string = "",
  explicitUom?: string | null,
  explicitUnitsPerUom?: number | null,
  explicitBaseUnit?: string | null
): ParsedProductUOM {
  const desc = description || "";
  const name = productName || "";
  const fullText = `${name} ${desc}`.toLowerCase();
  const isFoodOrBakeryOrSnack = /\b(biscuit|biscuits|buscit|biscut|cookie|cookies|cracker|crackers|wafer|wafers|rusk|snack|snacks|chip|chips|crisp|crisps|candy|candies|chocolate|chocolates|cake|cakes|bread|bun|buns|noodles|pasta|cereal)\b/i.test(fullText);

  // 1. Resolve Selling Unit (UoM)
  let uom = "piece";
  if (explicitUom && explicitUom.trim()) {
    uom = explicitUom.trim().toLowerCase();
  } else {
    const uomTagMatch = desc.match(/\[UOM:\s*([^\]]+)\]/i);
    if (uomTagMatch && uomTagMatch[1]) {
      uom = uomTagMatch[1].trim().toLowerCase();
    } else {
      // Infer contextually from text
      if (isFoodOrBakeryOrSnack) {
        if (fullText.includes("box") || fullText.includes("carton")) uom = "box";
        else if (fullText.includes("packet") || fullText.includes("pkt")) uom = "pack";
        else uom = "pack";
      } else if (fullText.includes("tablet") || /\b(tabs?)\b/i.test(fullText)) {
        uom = "tablet";
      } else if (fullText.includes("capsule") || /\b(caps?)\b/i.test(fullText)) {
        uom = "capsule";
      } else if (fullText.includes("strip")) {
        uom = "strip";
      } else if (fullText.includes("syrup") || fullText.includes("suspension") || fullText.includes("bottle") || fullText.includes("drop")) {
        uom = "bottle";
      } else if (fullText.includes("box") || fullText.includes("pk 20") || fullText.includes("pack 20")) {
        uom = "box";
      } else if (fullText.includes("pack") || fullText.includes("packet")) {
        uom = "pack";
      } else if (/\b(mann|maund|40\s*kg|40kg)\b/i.test(fullText)) {
        uom = "mann";
      } else if (/\b(\d+(?:\.\d+)?)\s*(g|gm|gram|grams)\b/i.test(fullText) && !/\b(mg|mcg)\b/i.test(fullText)) {
        uom = "g";
      } else if (/\b(\d+(?:\.\d+)?)\s*(kg|kilo|kilogram|kilograms)\b/i.test(fullText) || /\b(kilo|kilogram|kilograms)\b/i.test(fullText)) {
        uom = "kg";
      } else if (/\b(liter|litre|liters|litres)\b/i.test(fullText) || /\b(\d+(?:\.\d+)?)\s*l\b/i.test(fullText)) {
        uom = "l";
      } else if (/\b(ml|milliliter|milliliters)\b/i.test(fullText)) {
        uom = "bottle";
      }
    }
  }

  // 2. Parse pack size (units per 1 box/pack)
  let packSize = 1;
  let baseUnit = "piece";
  let subUnitName = "Piece";

  if (explicitUnitsPerUom !== null && explicitUnitsPerUom !== undefined && Number(explicitUnitsPerUom) > 0) {
    packSize = Number(explicitUnitsPerUom);
  } else {
    // Check explicit [SCALE: 20] or [UNITS_PER_UOM: 20] or [PACK_SIZE: 20] or [PACK: 20] or [VOLUME: 100ml]
    const scaleTagMatch = desc.match(/\[(?:SCALE|UNITS_PER_UOM|PACK_SIZE|UNITS_PER_PACK):\s*([0-9.]+)\s*([a-zA-Z]*)\]/i);
    const subUnitTagMatch = desc.match(/\[(?:SUB_UNIT|BASE_UNIT):\s*([^\]]+)\]/i);
    const packMatch = desc.match(/\[(PACK|VOLUME):\s*([0-9.]+)\s*([a-zA-Z]*)\]/i);

    if (scaleTagMatch && scaleTagMatch[1]) {
      packSize = parseFloat(scaleTagMatch[1]) || 1;
      if (scaleTagMatch[2]) subUnitName = scaleTagMatch[2];
      if (subUnitTagMatch && subUnitTagMatch[1]) subUnitName = subUnitTagMatch[1].trim();
    } else if (packMatch && packMatch[2]) {
      packSize = parseFloat(packMatch[2]) || 1;
      if (packMatch[3]) subUnitName = packMatch[3];
    } else {
      // Look for patterns like "box of 16 pack", "10 kg", "500 g", "20 tab", "100 ml", "60 ml", "10 strips", "40 kg", "24 pcs"
      const boxOfPacksMatch = fullText.match(/(?:box\s+of|pack\s+of|carton\s+of)\s*([0-9]+)\s*(?:pack|packs|packet|packets|pcs|pieces)?/i);
      const weightMatch = fullText.match(/([0-9.]+)\s*(kg|kilo|kilogram|kilograms)/i);
      const gramMatch = fullText.match(/([0-9.]+)\s*(g|gm|gram|grams)/i);
      const mlMatch = fullText.match(/([0-9.]+)\s*(ml|milliliter|milliliters)/i);
      const tabMatch = fullText.match(/([0-9]+)\s*(tab|tablet|tablets|cap|capsule|capsules|pill|pills)/i);
      const stripMatch = fullText.match(/([0-9]+)\s*(strip|strips)/i);
      const boxMatch = fullText.match(/box\s*([0-9]+)|([0-9]+)\s*per box|([0-9]+)\s*in box/i);

      if (boxOfPacksMatch && isFoodOrBakeryOrSnack) {
        packSize = parseInt(boxOfPacksMatch[1], 10) || 1;
        baseUnit = "pack";
        subUnitName = "Pack";
      } else if (weightMatch) {
        packSize = parseFloat(weightMatch[1]) || 1;
        baseUnit = "kg";
        subUnitName = "kg";
      } else if (gramMatch && !fullText.includes("mg")) {
        packSize = parseFloat(gramMatch[1]) || 1;
        baseUnit = "g";
        subUnitName = "g";
      } else if (mlMatch) {
        packSize = parseFloat(mlMatch[1]) || 100;
        baseUnit = "ml";
        subUnitName = "ml";
      } else if (tabMatch) {
        packSize = parseInt(tabMatch[1], 10) || 20;
        baseUnit = "tablet";
        subUnitName = "Tablet";
      } else if (stripMatch) {
        packSize = parseInt(stripMatch[1], 10) || 10;
        baseUnit = "strip";
        subUnitName = "Strip";
      } else if (boxMatch) {
        packSize = parseInt(boxMatch[1] || boxMatch[2] || boxMatch[3], 10) || 20;
        baseUnit = isFoodOrBakeryOrSnack ? "pack" : "piece";
        subUnitName = isFoodOrBakeryOrSnack ? "Pack" : "Piece";
      }
    }
  }

  if (explicitBaseUnit && explicitBaseUnit.trim()) {
    baseUnit = explicitBaseUnit.trim().toLowerCase();
    subUnitName = explicitBaseUnit.trim().charAt(0).toUpperCase() + explicitBaseUnit.trim().slice(1);
  }

  // Defaults per UOM
  const opt = ALL_STANDARD_UOMS.find((o) => o.id === uom) || {
    id: uom,
    name: uom.toUpperCase(),
    abbreviation: uom,
    category: "quantity" as UOMCategory,
  };

  const isPharmaText = /\b(panadol|paracetamol|amoxicillin|ibuprofen|aspirin|antibiotic|mg|mcg|syrup|vial|tablet|capsule)\b/i.test(fullText);
  const isBulkWeight = ["kg", "g", "mann", "lb", "oz", "bag"].includes(uom) || baseUnit === "kg" || baseUnit === "g";
  const isLiquidVolume = ["bottle", "l", "ml", "vial", "ampoule", "fl_oz"].includes(uom) || baseUnit === "ml" || baseUnit === "l";
  const isPharmaPack = !isFoodOrBakeryOrSnack && (["tablet", "capsule", "strip", "vial", "ampoule"].includes(uom) || (isPharmaText && (baseUnit === "tablet" || baseUnit === "capsule")));

  if (uom === "g") {
    baseUnit = "g";
    subUnitName = "g";
    if (packSize <= 1 && fullText.includes("500")) packSize = 500;
    else if (packSize <= 1 && fullText.includes("250")) packSize = 250;
    else if (packSize <= 1 && fullText.includes("100")) packSize = 100;
    else if (packSize <= 1) packSize = 500; // default 500g pack
  }
  if (uom === "kg" && packSize <= 0) packSize = 1;
  if (uom === "mann") {
    packSize = 40;
    baseUnit = "kg";
    subUnitName = "kg";
  }
  if (uom === "bottle" && packSize <= 1) {
    packSize = 100; // Default 100ml bottle
    baseUnit = "ml";
    subUnitName = "ml";
  }
  if (uom === "box" && packSize <= 1) {
    packSize = 20;
    if (isFoodOrBakeryOrSnack) {
      baseUnit = "pack";
      subUnitName = "Pack";
    } else if (isPharmaText) {
      baseUnit = "tablet";
      subUnitName = "Tablet";
    } else {
      baseUnit = "piece";
      subUnitName = "Piece";
    }
  }
  if (uom === "strip" && packSize <= 1) {
    packSize = 10; // Default 10 tabs per strip
    baseUnit = "tablet";
    subUnitName = "Tablet";
  }

  return {
    uom: opt.id,
    uomLabel: opt.name,
    category: opt.category,
    packSize,
    baseUnit,
    subUnitName,
    isBulkWeight,
    isLiquidVolume,
    isPharmaPack,
  };
}

/**
 * Smart Sub-Unit Preset Definition
 */
export interface SubUnitPreset {
  id: string;
  label: string;
  subLabel?: string;
  fractionOfPack: number;
  unitCount: number;
  unitName: string;
  isPopular?: boolean;
}

/**
 * Generates intelligent sub-unit & dosage options for POS Cashiers.
 */
export function getSmartSubUnitOptions(
  productName: string,
  description: string,
  retailPrice: number,
  purchaseCost: number,
  explicitUom?: string | null,
  explicitUnitsPerUom?: number | null,
  explicitBaseUnit?: string | null
): {
  parsed: ParsedProductUOM;
  presets: SubUnitPreset[];
} {
  const parsed = parseProductUOM(productName, description, explicitUom, explicitUnitsPerUom, explicitBaseUnit);
  const presets: SubUnitPreset[] = [];

  // 1. Full Package
  presets.push({
    id: "full",
    label: `Full ${parsed.uomLabel}`,
    subLabel: parsed.packSize > 1 ? `${parsed.packSize} ${parsed.subUnitName}` : undefined,
    fractionOfPack: 1,
    unitCount: parsed.packSize,
    unitName: parsed.uomLabel,
    isPopular: true,
  });

  // 2. Liquid volume / Syrup Dosage calculation
  if (parsed.isLiquidVolume || parsed.uom === "bottle") {
    const totalMl = parsed.packSize > 1 ? parsed.packSize : 100;

    // 1 Dose / Teaspoon (5ml)
    presets.push({
      id: "dose_5ml",
      label: "1 Dose / Teaspoon (5 ml)",
      subLabel: `${(5 / totalMl * 100).toFixed(1)}% of bottle`,
      fractionOfPack: 5 / totalMl,
      unitCount: 5,
      unitName: "ml",
    });

    // 1 Sip (10ml)
    presets.push({
      id: "sip_10ml",
      label: "1 Sip (10 ml)",
      subLabel: "Standard single oral sip",
      fractionOfPack: 10 / totalMl,
      unitCount: 10,
      unitName: "ml",
      isPopular: true,
    });

    // 1 Tablespoon (15ml)
    presets.push({
      id: "dose_15ml",
      label: "1 Tablespoon (15 ml)",
      subLabel: "Adult high-dose measure",
      fractionOfPack: 15 / totalMl,
      unitCount: 15,
      unitName: "ml",
    });

    // 3 Sips / Day Dose (30ml)
    presets.push({
      id: "sips_30ml",
      label: "3 Sips / Daily Pack (30 ml)",
      subLabel: "Full 3-dose daily regimen",
      fractionOfPack: 30 / totalMl,
      unitCount: 30,
      unitName: "ml",
      isPopular: true,
    });

    // Half Bottle (50%)
    presets.push({
      id: "half_bottle",
      label: `Half Bottle (${totalMl / 2} ml)`,
      subLabel: "50% split",
      fractionOfPack: 0.5,
      unitCount: totalMl / 2,
      unitName: "ml",
    });
  }

  // 3. Weight calculation (Grams vs Kilograms vs Mann)
  else if (parsed.isBulkWeight || parsed.uom === "g" || parsed.uom === "kg" || parsed.uom === "mann" || parsed.uom === "bag" || parsed.baseUnit === "g" || parsed.baseUnit === "kg") {
    // Case A: Product measured in GRAMS (e.g. 500g, 250g, 100g, 750g)
    if (parsed.uom === "g" || parsed.baseUnit === "g") {
      const totalGrams = parsed.packSize > 0 ? parsed.packSize : 500;

      // Half Pack (e.g. 250g from 500g pack)
      if (totalGrams >= 200) {
        const halfG = Math.round(totalGrams / 2);
        presets.push({
          id: "g_half",
          label: `Half (${halfG} g)`,
          subLabel: "50% split",
          fractionOfPack: 0.5,
          unitCount: halfG,
          unitName: "g",
          isPopular: true,
        });
      }

      // 250 g (1/4 kg / Pao) if pack >= 500g and not exactly 250g
      if (totalGrams >= 500 && totalGrams !== 250) {
        presets.push({
          id: "g_250",
          label: "250 g (1/4 kg / 1 Pao)",
          subLabel: "250 grams retail measure",
          fractionOfPack: 250 / totalGrams,
          unitCount: 250,
          unitName: "g",
          isPopular: true,
        });
      }

      // 100 g if pack >= 200g
      if (totalGrams >= 200) {
        presets.push({
          id: "g_100",
          label: "100 g",
          subLabel: `${Math.round((100 / totalGrams) * 100)}% portion`,
          fractionOfPack: 100 / totalGrams,
          unitCount: 100,
          unitName: "g",
        });
      }

      // 50 g if pack >= 100g
      if (totalGrams >= 100) {
        presets.push({
          id: "g_50",
          label: "50 g",
          subLabel: "Small portion",
          fractionOfPack: 50 / totalGrams,
          unitCount: 50,
          unitName: "g",
        });
      }
    }

    // Case B: Wholesale 1 MANN (40 kg / 40,000 g)
    else if (parsed.uom === "mann") {
      // Half Mann (20 kg)
      presets.push({
        id: "mann_half",
        label: "Half Mann (20 kg)",
        subLabel: "50% wholesale split",
        fractionOfPack: 0.5,
        unitCount: 20,
        unitName: "kg",
        isPopular: true,
      });

      // 10 kg (Quarter Mann)
      presets.push({
        id: "kg_10",
        label: "10 kg (Quarter Mann)",
        subLabel: "25% wholesale split",
        fractionOfPack: 0.25,
        unitCount: 10,
        unitName: "kg",
      });

      // 5 kg
      presets.push({
        id: "kg_5",
        label: "5 kg",
        subLabel: "Retail portion from Mann",
        fractionOfPack: 5 / 40,
        unitCount: 5,
        unitName: "kg",
      });

      // 1 kg
      presets.push({
        id: "kg_1",
        label: "1 kg (1,000 g)",
        subLabel: "1 kg from Mann",
        fractionOfPack: 1 / 40,
        unitCount: 1,
        unitName: "kg",
        isPopular: true,
      });

      // 500 g (Half kg)
      presets.push({
        id: "kg_0.5",
        label: "500 g (Half kg)",
        subLabel: "Half kg measure",
        fractionOfPack: 0.5 / 40,
        unitCount: 0.5,
        unitName: "kg",
      });
    }

    // Case C: KILOGRAMS (kg) (e.g. 50kg bag, 20kg bag, 10kg bag, 5kg, 1kg)
    else {
      const totalKg = parsed.packSize > 0 ? parsed.packSize : 1;

      // 1 Mann (40kg) ONLY IF pack is >= 40kg
      if (totalKg >= 40) {
        presets.push({
          id: "mann_1",
          label: "1 Mann (40 kg)",
          subLabel: "Wholesale bulk standard",
          fractionOfPack: 40 / totalKg,
          unitCount: 40,
          unitName: "kg",
        });
      }

      // 10 kg if totalKg > 10
      if (totalKg > 10) {
        presets.push({
          id: "kg_10",
          label: "10 kg",
          subLabel: "10 kg portion",
          fractionOfPack: 10 / totalKg,
          unitCount: 10,
          unitName: "kg",
        });
      }

      // 5 kg if totalKg > 5
      if (totalKg > 5) {
        presets.push({
          id: "kg_5",
          label: "5 kg",
          subLabel: "5 kg portion",
          fractionOfPack: 5 / totalKg,
          unitCount: 5,
          unitName: "kg",
        });
      }

      // Half Pack/Bag if totalKg > 1
      if (totalKg > 1) {
        const halfKg = +(totalKg / 2).toFixed(2);
        presets.push({
          id: "kg_half",
          label: `Half (${halfKg} kg)`,
          subLabel: "50% split",
          fractionOfPack: 0.5,
          unitCount: halfKg,
          unitName: "kg",
          isPopular: true,
        });
      }

      // 1 kg if totalKg > 1
      if (totalKg > 1) {
        presets.push({
          id: "kg_1",
          label: "1 kg (1,000 g)",
          subLabel: `From ${totalKg}kg bulk pack`,
          fractionOfPack: 1 / totalKg,
          unitCount: 1,
          unitName: "kg",
          isPopular: true,
        });
      }

      // 0.5 kg (500g) if totalKg >= 1
      if (totalKg >= 1) {
        presets.push({
          id: "kg_0.5",
          label: "0.5 kg (500 g / Half kg)",
          subLabel: "500 grams portion",
          fractionOfPack: 0.5 / totalKg,
          unitCount: 0.5,
          unitName: "kg",
          isPopular: true,
        });
      }

      // 250 g (1/4 kg / Pao) if totalKg >= 0.5
      if (totalKg >= 0.5) {
        presets.push({
          id: "g_250",
          label: "250 g (1/4 kg / Pao)",
          subLabel: "250 grams retail measure",
          fractionOfPack: 0.25 / totalKg,
          unitCount: 0.25,
          unitName: "kg",
        });
      }

      // 100 g if totalKg >= 0.2
      if (totalKg >= 0.2) {
        presets.push({
          id: "g_100",
          label: "100 g",
          subLabel: "100 grams measure",
          fractionOfPack: 0.1 / totalKg,
          unitCount: 0.1,
          unitName: "kg",
        });
      }
    }
  }

  // 4. Solid Pharma & Packaging (e.g. Box of 20 tablets, Box of 16 packs, 10 strips)
  else if (parsed.isPharmaPack || parsed.uom === "box" || parsed.uom === "pack" || parsed.uom === "strip") {
    const totalTabs = parsed.packSize > 1 ? parsed.packSize : 20;

    // Single Sub-Unit (1 Tablet / 1 Pack / 1 Piece)
    presets.push({
      id: "single_tab",
      label: `1 Single ${parsed.subUnitName}`,
      subLabel: `1/${totalTabs} of ${parsed.uomLabel}`,
      fractionOfPack: 1 / totalTabs,
      unitCount: 1,
      unitName: parsed.subUnitName,
      isPopular: true,
    });

    // 2 Sub-Units
    if (totalTabs >= 2) {
      presets.push({
        id: "tab_2",
        label: `2 ${parsed.subUnitName}s`,
        subLabel: parsed.isPharmaPack ? "Single emergency dose" : "2 units portion",
        fractionOfPack: 2 / totalTabs,
        unitCount: 2,
        unitName: parsed.subUnitName,
      });
    }

    // 3 or 4 Sub-Units
    if (totalTabs >= 4 && !parsed.isPharmaPack) {
      presets.push({
        id: "tab_quarter",
        label: `Quarter Box (${Math.round(totalTabs / 4)} ${parsed.subUnitName}s)`,
        subLabel: "25% pack portion",
        fractionOfPack: 0.25,
        unitCount: Math.round(totalTabs / 4),
        unitName: parsed.subUnitName,
        isPopular: true,
      });
    } else if (totalTabs >= 3 && parsed.isPharmaPack) {
      presets.push({
        id: "tab_3",
        label: `3 ${parsed.subUnitName}s`,
        subLabel: "1-day medical treatment",
        fractionOfPack: 3 / totalTabs,
        unitCount: 3,
        unitName: parsed.subUnitName,
        isPopular: true,
      });
    }

    // 5 Sub-Units (or custom step)
    if (totalTabs >= 5 && parsed.isPharmaPack) {
      presets.push({
        id: "tab_5",
        label: `5 ${parsed.subUnitName}s`,
        subLabel: "Short course dose",
        fractionOfPack: 5 / totalTabs,
        unitCount: 5,
        unitName: parsed.subUnitName,
      });
    }

    // 1 Strip (10 Tabs) if pharma box is 20+ tabs
    if (totalTabs >= 20 && parsed.isPharmaPack) {
      presets.push({
        id: "strip_10",
        label: "1 Strip (10 Tablets)",
        subLabel: "Half box blister sheet",
        fractionOfPack: 10 / totalTabs,
        unitCount: 10,
        unitName: "Strip",
        isPopular: true,
      });
    }

    // Half Box / Half Pack
    if (totalTabs > 2) {
      presets.push({
        id: "half_box",
        label: `Half ${parsed.uomLabel} (${Math.round(totalTabs / 2)} ${parsed.subUnitName}s)`,
        subLabel: "50% split",
        fractionOfPack: 0.5,
        unitCount: Math.round(totalTabs / 2),
        unitName: parsed.subUnitName,
      });
    }
  }

  // 5. General fractional presets (Quarter, Half)
  else {
    presets.push({
      id: "half",
      label: "Half (0.5 Unit)",
      subLabel: "50% portion",
      fractionOfPack: 0.5,
      unitCount: 0.5,
      unitName: parsed.uomLabel,
    });
    presets.push({
      id: "quarter",
      label: "Quarter (0.25 Unit)",
      subLabel: "25% portion",
      fractionOfPack: 0.25,
      unitCount: 0.25,
      unitName: parsed.uomLabel,
    });
  }

  return { parsed, presets };
}

/**
 * Calculates accurate retail price, purchase cost, and profit for fractional UOM purchases.
 */
export interface FractionalCalculationResult {
  fractionOfPack: number;
  unitPrice: number;
  purchaseCost: number;
  profit: number;
  marginPct: number;
  stockUnitsDeducted: number;
  displayName: string;
  fractionLabel: string;
}

export function calculateFractionalPrice(
  listedRetailPrice: number,
  listedPurchaseCost: number,
  fractionOfPack: number,
  customLabel?: string
): FractionalCalculationResult {
  const fraction = Math.max(fractionOfPack, 0.0001);
  const unitPrice = +(listedRetailPrice * fraction).toFixed(2);
  const purchaseCost = +(listedPurchaseCost * fraction).toFixed(2);
  const profit = +(unitPrice - purchaseCost).toFixed(2);
  const marginPct = unitPrice > 0 ? +((profit / unitPrice) * 100).toFixed(1) : 0;
  const stockUnitsDeducted = fraction;

  return {
    fractionOfPack: fraction,
    unitPrice,
    purchaseCost,
    profit,
    marginPct,
    stockUnitsDeducted,
    displayName: customLabel || `${fraction.toFixed(2)}x Unit`,
    fractionLabel: `${(fraction * 100).toFixed(1)}%`,
  };
}

/**
 * Format stock quantity with UOM label
 */
export function formatStockWithUOM(stock: number | string, uomNameOrId?: string | null): string {
  const count = typeof stock === "string" ? parseFloat(stock) || 0 : stock;
  const displayCount = Number.isInteger(count) ? count : count.toFixed(2);

  if (!uomNameOrId) return `${displayCount} Units`;

  const match = ALL_STANDARD_UOMS.find(
    (u) => u.id.toLowerCase() === uomNameOrId.toLowerCase() || u.name.toLowerCase() === uomNameOrId.toLowerCase()
  );

  const label = match ? match.name : uomNameOrId;
  const isPlural = count !== 1;

  if (match && ["kg", "g", "mg", "lb", "oz", "l", "ml", "fl_oz", "gal", "meter", "cm", "foot"].includes(match.id)) {
    return `${displayCount} ${match.abbreviation}`;
  }

  if (isPlural) {
    if (label.toLowerCase() === "box") return `${displayCount} Boxes`;
    if (label.toLowerCase() === "sachet / pouch" || label.toLowerCase() === "sachet") return `${displayCount} Sachets`;
    if (label.toLowerCase() === "bottle") return `${displayCount} Bottles`;
    if (label.toLowerCase() === "piece") return `${displayCount} Pieces`;
    if (label.toLowerCase() === "unit") return `${displayCount} Units`;
    if (label.toLowerCase() === "tablet") return `${displayCount} Tablets`;
    if (label.toLowerCase() === "capsule") return `${displayCount} Capsules`;
    if (label.toLowerCase() === "strip") return `${displayCount} Strips`;
    if (label.toLowerCase() === "can / tin" || label.toLowerCase() === "can") return `${displayCount} Cans`;
    return `${displayCount} ${label}s`;
  }

  return `${displayCount} ${label}`;
}

/**
 * Calculates display representations for product stock:
 * In the GeFlow architecture:
 * stock_units is ALWAYS stored in BASE UNITS (tablets, pieces, ml, grams).
 * listingStock: e.g. 10 Boxes (stock_units / units_per_uom)
 * totalSubUnits: e.g. 120 Tablets (stock_units in base units)
 * packSize / units_per_uom: e.g. 12 Tablets/Box
 */
export interface ProductStockBreakdown {
  listingStock: number; // e.g. 10 (boxes on hand)
  packSize: number; // e.g. 12 (tablets per box)
  totalSubUnits: number; // e.g. 120 (tablets in base units)
  fullPacks: number; // e.g. 10
  looseSubUnits: number; // e.g. 0 or 6
  hasFractions: boolean;
  uom: string; // e.g. "box"
  uomLabel: string; // e.g. "Box"
  baseUnit: string; // e.g. "tablet"
  subUnitName: string; // e.g. "Tablet"
  displayText: string; // e.g. "10 Boxes (120 tablets)" or "10 Boxes + 6 tablets"
  subText: string; // e.g. "120 tablets · 12 per box"
}

export function getDefaultBaseUnit(uom: string, industryType?: string | null): string {
  const norm = (uom || "").trim().toLowerCase();
  const matched = ALL_STANDARD_UOMS.find((u) => u.id === norm);
  if (matched?.baseUnit) {
    if (matched.id === "box" && (industryType === "pharmacy" || industryType === "medical" || !industryType)) {
      return "tablet";
    }
    return matched.baseUnit;
  }
  if (norm === "box" || norm === "strip") return "tablet";
  if (norm === "bottle" || norm === "vial") return "ml";
  if (norm === "kg" || norm === "mann") return "g";
  return "piece";
}

export function formatUomPlural(label: string, count: number): string {
  if (count === 1) return label;
  const l = label.toLowerCase();
  if (l === "box") return "Boxes";
  if (l === "carton") return "Cartons";
  if (l === "dozen") return "Dozens";
  if (l === "strip") return "Strips";
  if (l === "pack") return "Packs";
  if (l === "bottle") return "Bottles";
  if (l === "piece") return "Pieces";
  if (l === "unit") return "Units";
  if (l === "tablet") return "Tablets";
  if (l === "capsule") return "Capsules";
  if (l === "can" || l === "can / tin") return "Cans";
  if (l === "sachet" || l === "sachet / pouch") return "Sachets";
  if (l.endsWith("s")) return label;
  return `${label}s`;
}

export function computeProductStock(
  stockUnits: number | string | null | undefined,
  productName: string = "",
  description?: string | null,
  explicitUom?: string | null,
  explicitUnitsPerUom?: number | null,
  explicitBaseUnit?: string | null
): ProductStockBreakdown {
  const parsed = parseProductUOM(productName, description || "", explicitUom, explicitUnitsPerUom, explicitBaseUnit);
  const desc = description || "";

  // 1. Resolve Selling Unit (UOM)
  const rawUom = (explicitUom || parsed.uom || "piece").toLowerCase().trim();
  const matchedOpt = ALL_STANDARD_UOMS.find(
    (u) => u.id.toLowerCase() === rawUom || u.name.toLowerCase() === rawUom
  );
  const uomLabel = matchedOpt ? matchedOpt.name : rawUom.charAt(0).toUpperCase() + rawUom.slice(1);

  // 2. Resolve Units per UOM (pack size)
  const packSize = explicitUnitsPerUom !== null && explicitUnitsPerUom !== undefined && Number(explicitUnitsPerUom) > 0
    ? Number(explicitUnitsPerUom)
    : parsed.packSize > 0
    ? parsed.packSize
    : 1;

  // 3. Resolve Base Unit (smallest unit)
  let baseUnit = (explicitBaseUnit || parsed.baseUnit || "piece").toLowerCase().trim();
  let subUnitName = parsed.subUnitName || baseUnit.charAt(0).toUpperCase() + baseUnit.slice(1);

  if (rawUom === "box" && (baseUnit === "piece" || !explicitBaseUnit)) {
    if (parsed.isPharmaPack || productName.toLowerCase().includes("tablet") || productName.toLowerCase().includes("capsule")) {
      baseUnit = "tablet";
      subUnitName = "Tablet";
    }
  }

  // 4. Resolve Stock in Base Units
  let rawBaseStock = stockUnits !== null && stockUnits !== undefined ? Number(stockUnits) : 0;
  if (isNaN(rawBaseStock)) rawBaseStock = 0;

  // Handle backward compatibility for legacy products where stock_units was saved as Boxes instead of Base Units
  const packQtyMatch = desc.match(/\[PACK_QTY:\s*([0-9.]+)\]/i);
  const baseQtyMatch = desc.match(/\[BASE_QTY:\s*([0-9.]+)\]/i);
  if (
    packSize > 1 &&
    packQtyMatch &&
    baseQtyMatch &&
    Math.abs(Number(packQtyMatch[1]) - rawBaseStock) < 0.001
  ) {
    // This was stored in boxes! Convert to true base units
    rawBaseStock = Number(baseQtyMatch[1]) || (rawBaseStock * packSize);
  }

  const totalSubUnits = +rawBaseStock.toFixed(2);
  const listingStock = packSize > 0 ? +(totalSubUnits / packSize).toFixed(3) : totalSubUnits;
  const fullPacks = Math.floor(listingStock);
  const looseSubUnits = Math.round(+(totalSubUnits - fullPacks * packSize).toFixed(2));
  const hasFractions = looseSubUnits > 0 || (listingStock - fullPacks > 0.001);

  let displayText = "";
  if (totalSubUnits <= 0) {
    displayText = "Out of Stock";
  } else if (packSize <= 1) {
    displayText = `${totalSubUnits} ${formatUomPlural(uomLabel, totalSubUnits)}`;
  } else {
    // Pack size > 1 (e.g. 10 Boxes of 12 tablets = 120 tablets)
    if (looseSubUnits === 0) {
      // Exactly full boxes
      const packPlural = formatUomPlural(uomLabel, fullPacks);
      const subPlural = formatUomPlural(subUnitName, totalSubUnits);
      displayText = `${fullPacks} ${packPlural} (${totalSubUnits} ${subPlural.toLowerCase()})`;
    } else if (fullPacks > 0) {
      // Mixed: e.g. "10 Boxes + 6 tablets (126 tablets)"
      const packPlural = formatUomPlural(uomLabel, fullPacks);
      const subPlural = formatUomPlural(subUnitName, looseSubUnits);
      displayText = `${fullPacks} ${packPlural} + ${looseSubUnits} ${subPlural.toLowerCase()} (${totalSubUnits} total)`;
    } else {
      // Less than 1 box: e.g. "6 tablets (0.5 Boxes)"
      const subPlural = formatUomPlural(subUnitName, looseSubUnits);
      displayText = `${looseSubUnits} ${subPlural} (${listingStock} ${uomLabel})`;
    }
  }

  const subText = packSize > 1
    ? `${totalSubUnits} ${formatUomPlural(subUnitName, totalSubUnits).toLowerCase()} · ${packSize} per ${uomLabel}`
    : `${totalSubUnits} ${formatUomPlural(uomLabel, totalSubUnits).toLowerCase()}`;

  return {
    listingStock,
    packSize,
    totalSubUnits,
    fullPacks,
    looseSubUnits,
    hasFractions,
    uom: rawUom,
    uomLabel,
    baseUnit,
    subUnitName,
    displayText,
    subText,
  };
}

export function resolveProductUnits(p: {
  stock_units?: number | string | null;
  name?: string | null;
  description?: string | null;
  uom?: string | null;
  units_per_uom?: number | null;
  base_unit?: string | null;
}): ProductStockBreakdown {
  return computeProductStock(
    p.stock_units,
    p.name || "",
    p.description,
    p.uom,
    p.units_per_uom,
    p.base_unit
  );
}


