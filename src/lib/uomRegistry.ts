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
 * Returns tailored UOM options based on the business's industry / business category.
 */
export function getUOMsForBusiness(industryType?: string | null, categoryName?: string | null): UOMOption[] {
  const ind = normalizeStr(industryType);
  const cat = normalizeStr(categoryName);

  const isPharma = ind.includes("pharm") || ind.includes("medic") || cat.includes("pharm") || cat.includes("medic");
  const isGrocery = ind.includes("groc") || ind.includes("super") || ind.includes("food") || cat.includes("groc") || cat.includes("super") || cat.includes("agri");
  const isElectronics = ind.includes("elect") || ind.includes("mobile") || ind.includes("tech") || cat.includes("elect") || cat.includes("mobile");
  const isHardware = ind.includes("hardw") || ind.includes("build") || ind.includes("const") || cat.includes("hardw");
  const isRestaurant = ind.includes("rest") || ind.includes("cafe") || ind.includes("dining") || cat.includes("rest");

  return [...ALL_STANDARD_UOMS].sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    if (isPharma) {
      if (["tablet", "capsule", "strip", "bottle", "box", "vial", "ampoule", "tube", "sachet", "ml", "mg"].includes(a.id)) scoreA += 10;
      if (["tablet", "capsule", "strip", "bottle", "box", "vial", "ampoule", "tube", "sachet", "ml", "mg"].includes(b.id)) scoreB += 10;
    } else if (isGrocery) {
      if (["piece", "pack", "box", "bottle", "can", "bag", "kg", "g", "mann", "l", "ml", "dozen"].includes(a.id)) scoreA += 10;
      if (["piece", "pack", "box", "bottle", "can", "bag", "kg", "g", "mann", "l", "ml", "dozen"].includes(b.id)) scoreB += 10;
    } else if (isElectronics) {
      if (["piece", "unit", "set", "pack", "box", "roll", "meter", "pair"].includes(a.id)) scoreA += 10;
      if (["piece", "unit", "set", "pack", "box", "roll", "meter", "pair"].includes(b.id)) scoreB += 10;
    } else if (isHardware) {
      if (["piece", "box", "carton", "roll", "sheet", "set", "pair", "meter", "kg"].includes(a.id)) scoreA += 10;
      if (["piece", "box", "carton", "roll", "sheet", "set", "pair", "meter", "kg"].includes(b.id)) scoreB += 10;
    } else if (isRestaurant) {
      if (["piece", "bottle", "can", "pack", "kg", "g", "l", "ml"].includes(a.id)) scoreA += 10;
      if (["piece", "bottle", "can", "pack", "kg", "g", "l", "ml"].includes(b.id)) scoreB += 10;
    }

    if (["piece", "unit", "box", "pack", "bottle", "kg"].includes(a.id)) scoreA += 2;
    if (["piece", "unit", "box", "pack", "bottle", "kg"].includes(b.id)) scoreB += 2;

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

export function parseProductUOM(productName: string = "", description: string = ""): ParsedProductUOM {
  const desc = description || "";
  const name = productName || "";
  const fullText = `${name} ${desc}`.toLowerCase();

  // 1. Check explicit [UOM: xyz] tag
  let uom = "piece";
  const uomTagMatch = desc.match(/\[UOM:\s*([^\]]+)\]/i);
  if (uomTagMatch && uomTagMatch[1]) {
    uom = uomTagMatch[1].trim().toLowerCase();
  } else {
    // Infer from text
    if (fullText.includes("tablet") || fullText.includes(" tab")) uom = "tablet";
    else if (fullText.includes("capsule") || fullText.includes(" cap")) uom = "capsule";
    else if (fullText.includes("strip")) uom = "strip";
    else if (fullText.includes("syrup") || fullText.includes("suspension") || fullText.includes("bottle") || fullText.includes("drop")) uom = "bottle";
    else if (fullText.includes("box") || fullText.includes("pk 20") || fullText.includes("pack 20")) uom = "box";
    else if (fullText.includes("mann") || fullText.includes("40kg") || fullText.includes("40 kg")) uom = "mann";
    else if (fullText.includes("kg") || fullText.includes("kilo") || fullText.includes("10kg") || fullText.includes("5kg") || fullText.includes("bag")) uom = "kg";
    else if (fullText.includes("gram") || fullText.includes(" 500g") || fullText.includes(" 250g")) uom = "g";
    else if (fullText.includes("liter") || fullText.includes("litre") || fullText.includes(" 1l")) uom = "l";
    else if (fullText.includes("ml") || fullText.includes("100ml") || fullText.includes("60ml")) uom = "bottle";
  }

  // 2. Parse pack size / volume / weight numbers
  let packSize = 1;
  let baseUnit = "piece";
  let subUnitName = "Piece";

  // Check explicit [PACK: 20] or [VOLUME: 100ml] or [BASE_QTY: 10]
  const packMatch = desc.match(/\[(PACK|BASE_QTY|VOLUME):\s*([0-9.]+)\s*([a-zA-Z]*)\]/i);
  if (packMatch) {
    packSize = parseFloat(packMatch[2]) || 1;
    if (packMatch[3]) subUnitName = packMatch[3];
  } else {
    // Look for patterns like "10 kg", "20 tab", "100 ml", "60 ml", "10 strips", "40 kg", "24 pcs"
    const weightMatch = fullText.match(/([0-9.]+)\s*(kg|kilo|kilogram)/i);
    const gramMatch = fullText.match(/([0-9.]+)\s*(g|gram|gm)/i);
    const mlMatch = fullText.match(/([0-9.]+)\s*(ml|milliliter)/i);
    const tabMatch = fullText.match(/([0-9]+)\s*(tab|tablet|cap|capsule|pill)/i);
    const stripMatch = fullText.match(/([0-9]+)\s*(strip)/i);
    const boxMatch = fullText.match(/box\s*([0-9]+)|([0-9]+)\s*per box|([0-9]+)\s*in box/i);

    if (weightMatch) {
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
      baseUnit = "piece";
      subUnitName = "Piece";
    }
  }

  // Defaults per UOM
  const opt = ALL_STANDARD_UOMS.find((o) => o.id === uom) || {
    id: uom,
    name: uom.toUpperCase(),
    abbreviation: uom,
    category: "quantity" as UOMCategory,
  };

  const isBulkWeight = ["kg", "g", "mann", "lb", "oz", "bag"].includes(uom) || baseUnit === "kg" || baseUnit === "g";
  const isLiquidVolume = ["bottle", "l", "ml", "vial", "ampoule", "fl_oz"].includes(uom) || baseUnit === "ml" || baseUnit === "l";
  const isPharmaPack = ["tablet", "capsule", "strip", "box", "vial", "ampoule"].includes(uom) || baseUnit === "tablet" || baseUnit === "capsule";

  if (isBulkWeight && packSize <= 1 && uom === "kg") packSize = 1;
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
    packSize = 20; // Default 20 tabs/units per box
    baseUnit = "tablet";
    subUnitName = "Tablet";
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
  purchaseCost: number
): {
  parsed: ParsedProductUOM;
  presets: SubUnitPreset[];
} {
  const parsed = parseProductUOM(productName, description);
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

  // 3. Bulk Weight calculation (e.g. 10kg Bag, 1 Mann / 40kg, 1kg)
  else if (parsed.isBulkWeight || parsed.uom === "kg" || parsed.uom === "mann" || parsed.uom === "bag") {
    const totalKg = parsed.uom === "mann" ? 40 : parsed.packSize > 1 ? parsed.packSize : 10;

    // 1 Mann (40kg)
    if (parsed.uom === "mann" || totalKg >= 40) {
      presets.push({
        id: "mann_1",
        label: "1 Mann (40 kg)",
        subLabel: "Wholesale bulk standard",
        fractionOfPack: 40 / totalKg,
        unitCount: 40,
        unitName: "kg",
      });
    }

    // 10 kg
    if (totalKg > 10) {
      presets.push({
        id: "kg_10",
        label: "10 kg",
        subLabel: "Quarter / 10kg portion",
        fractionOfPack: 10 / totalKg,
        unitCount: 10,
        unitName: "kg",
      });
    }

    // 5 kg
    if (totalKg >= 5) {
      presets.push({
        id: "kg_5",
        label: "5 kg",
        subLabel: "Half bulk bag",
        fractionOfPack: 5 / totalKg,
        unitCount: 5,
        unitName: "kg",
      });
    }

    // 1 kg
    presets.push({
      id: "kg_1",
      label: "1 kg (1,000 g)",
      subLabel: `From ${totalKg}kg bulk pack`,
      fractionOfPack: 1 / totalKg,
      unitCount: 1,
      unitName: "kg",
      isPopular: true,
    });

    // 0.5 kg (500g)
    presets.push({
      id: "kg_0.5",
      label: "0.5 kg (500 g / Half kg)",
      subLabel: "500 grams portion",
      fractionOfPack: 0.5 / totalKg,
      unitCount: 0.5,
      unitName: "kg",
      isPopular: true,
    });

    // 250 g
    presets.push({
      id: "g_250",
      label: "250 g (1/4 kg / Pao)",
      subLabel: "250 grams retail measure",
      fractionOfPack: 0.25 / totalKg,
      unitCount: 0.25,
      unitName: "kg",
      isPopular: true,
    });

    // 100 g
    presets.push({
      id: "g_100",
      label: "100 g",
      subLabel: "Small test quantity",
      fractionOfPack: 0.1 / totalKg,
      unitCount: 0.1,
      unitName: "kg",
    });
  }

  // 4. Solid Pharma & Packaging (e.g. Box of 20 tablets, 10 strips)
  else if (parsed.isPharmaPack || parsed.uom === "box" || parsed.uom === "pack" || parsed.uom === "strip") {
    const totalTabs = parsed.packSize > 1 ? parsed.packSize : 20;

    // Single Tablet / Capsule
    presets.push({
      id: "single_tab",
      label: `1 Single ${parsed.subUnitName}`,
      subLabel: `1/${totalTabs} of ${parsed.uomLabel}`,
      fractionOfPack: 1 / totalTabs,
      unitCount: 1,
      unitName: parsed.subUnitName,
      isPopular: true,
    });

    // 2 Tablets
    if (totalTabs >= 2) {
      presets.push({
        id: "tab_2",
        label: `2 ${parsed.subUnitName}s`,
        subLabel: "Single emergency dose",
        fractionOfPack: 2 / totalTabs,
        unitCount: 2,
        unitName: parsed.subUnitName,
      });
    }

    // 3 Tablets
    if (totalTabs >= 3) {
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

    // 5 Tablets
    if (totalTabs >= 5) {
      presets.push({
        id: "tab_5",
        label: `5 ${parsed.subUnitName}s`,
        subLabel: "Short course dose",
        fractionOfPack: 5 / totalTabs,
        unitCount: 5,
        unitName: parsed.subUnitName,
      });
    }

    // 1 Strip (10 Tabs) if box is 20+ tabs
    if (totalTabs >= 20) {
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

    // Half Box
    if (totalTabs > 2) {
      presets.push({
        id: "half_box",
        label: `Half Box (${Math.round(totalTabs / 2)} ${parsed.subUnitName}s)`,
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
