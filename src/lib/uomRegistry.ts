/**
 * GEFLOW — UNIT OF MEASURE (UOM) REGISTRY & BUSINESS CATALOG INTEGRATION
 *
 * Provides structured, business/industry-aware Unit of Measure configurations,
 * search filters, validation, and standard aliases for manual and AI-assisted entry.
 */

export type UOMCategory = "quantity" | "weight" | "volume" | "packaging" | "dimension";

export interface UOMOption {
  id: string;
  name: string;
  abbreviation: string;
  category: UOMCategory;
  description?: string;
  industries?: string[];
}

export const ALL_STANDARD_UOMS: UOMOption[] = [
  // Quantity / Count units
  { id: "piece", name: "Piece", abbreviation: "pc", category: "quantity", description: "Individual single item count" },
  { id: "unit", name: "Unit", abbreviation: "unit", category: "quantity", description: "Generic standard single unit" },
  { id: "tablet", name: "Tablet", abbreviation: "tab", category: "quantity", description: "Solid pharmaceutical dosage", industries: ["pharmacy", "medical", "hospital"] },
  { id: "capsule", name: "Capsule", abbreviation: "cap", category: "quantity", description: "Encapsulated pharmaceutical dose", industries: ["pharmacy", "medical", "hospital"] },
  { id: "strip", name: "Strip", abbreviation: "strip", category: "packaging", description: "Blister strip of tablets/capsules", industries: ["pharmacy", "medical"] },
  { id: "bottle", name: "Bottle", abbreviation: "btl", category: "packaging", description: "Glass or plastic bottle container", industries: ["pharmacy", "grocery", "restaurant", "retail"] },
  { id: "box", name: "Box", abbreviation: "box", category: "packaging", description: "Standard commercial box" },
  { id: "pack", name: "Pack", abbreviation: "pk", category: "packaging", description: "Packaged group of items" },
  { id: "carton", name: "Carton", abbreviation: "ctn", category: "packaging", description: "Bulk transport or storage carton", industries: ["wholesale", "warehouse", "retail", "grocery"] },
  { id: "can", name: "Can / Tin", abbreviation: "can", category: "packaging", description: "Sealed metal or aluminum container", industries: ["grocery", "restaurant", "supermarket"] },
  { id: "vial", name: "Vial", abbreviation: "vial", category: "packaging", description: "Small glass vessel for injectables", industries: ["pharmacy", "medical", "hospital"] },
  { id: "ampoule", name: "Ampoule", abbreviation: "amp", category: "packaging", description: "Sealed single-use glass vial", industries: ["pharmacy", "medical", "hospital"] },
  { id: "tube", name: "Tube", abbreviation: "tube", category: "packaging", description: "Squeezable tube for creams/gels", industries: ["pharmacy", "cosmetics", "retail"] },
  { id: "sachet", name: "Sachet / Pouch", abbreviation: "sachet", category: "packaging", description: "Small flexible sealed packet", industries: ["pharmacy", "grocery", "fmcg"] },
  { id: "bag", name: "Bag", abbreviation: "bag", category: "packaging", description: "Paper or plastic bag container" },
  { id: "pair", name: "Pair", abbreviation: "pr", category: "quantity", description: "Set of two matching items", industries: ["retail", "fashion", "hardware"] },
  { id: "set", name: "Set", abbreviation: "set", category: "quantity", description: "Group of matched components", industries: ["electronics", "hardware", "retail"] },
  { id: "dozen", name: "Dozen", abbreviation: "doz", category: "quantity", description: "Pack of 12 items", industries: ["grocery", "retail", "supermarket"] },
  { id: "bundle", name: "Bundle", abbreviation: "bdl", category: "packaging", description: "Tied or grouped collection" },

  // Weight units
  { id: "kg", name: "Kilogram", abbreviation: "kg", category: "weight", description: "Metric mass (1,000 grams)" },
  { id: "g", name: "Gram", abbreviation: "g", category: "weight", description: "Metric mass (base unit)" },
  { id: "mg", name: "Milligram", abbreviation: "mg", category: "weight", description: "Pharmaceutical micro-mass", industries: ["pharmacy", "medical"] },
  { id: "lb", name: "Pound", abbreviation: "lb", category: "weight", description: "Imperial weight (16 oz)" },
  { id: "oz", name: "Ounce", abbreviation: "oz", category: "weight", description: "Imperial ounce" },

  // Volume units
  { id: "l", name: "Liter", abbreviation: "L", category: "volume", description: "Metric volume (1,000 ml)" },
  { id: "ml", name: "Milliliter", abbreviation: "ml", category: "volume", description: "Metric liquid volume" },
  { id: "fl_oz", name: "Fluid Ounce", abbreviation: "fl oz", category: "volume", description: "Imperial fluid volume" },
  { id: "gal", name: "Gallon", abbreviation: "gal", category: "volume", description: "Standard liquid gallon" },

  // Dimension / Length units
  { id: "meter", name: "Meter", abbreviation: "m", category: "dimension", description: "Linear length (100 cm)", industries: ["hardware", "textile", "electronics"] },
  { id: "cm", name: "Centimeter", abbreviation: "cm", category: "dimension", description: "Linear measure", industries: ["hardware", "textile"] },
  { id: "foot", name: "Foot", abbreviation: "ft", category: "dimension", description: "Imperial length (12 in)", industries: ["hardware", "construction"] },
  { id: "roll", name: "Roll", abbreviation: "roll", category: "dimension", description: "Continuous wound material", industries: ["hardware", "textile", "electronics"] },
  { id: "sheet", name: "Sheet", abbreviation: "sheet", category: "dimension", description: "Flat single material sheet", industries: ["hardware", "stationery"] },
];

/**
 * Normalizes industry string for matching
 */
const normalizeStr = (s?: string | null) => (s || "").trim().toLowerCase();

/**
 * Returns tailored UOM options based on the business's industry / business category.
 * Always prioritizes industry-appropriate units while providing general options.
 */
export function getUOMsForBusiness(industryType?: string | null, categoryName?: string | null): UOMOption[] {
  const ind = normalizeStr(industryType);
  const cat = normalizeStr(categoryName);

  const isPharma = ind.includes("pharm") || ind.includes("medic") || cat.includes("pharm") || cat.includes("medic");
  const isGrocery = ind.includes("groc") || ind.includes("super") || ind.includes("food") || cat.includes("groc") || cat.includes("super");
  const isElectronics = ind.includes("elect") || ind.includes("mobile") || ind.includes("tech") || cat.includes("elect") || cat.includes("mobile");
  const isHardware = ind.includes("hardw") || ind.includes("build") || ind.includes("const") || cat.includes("hardw");
  const isRestaurant = ind.includes("rest") || ind.includes("cafe") || ind.includes("dining") || cat.includes("rest");

  // Sort & prioritize
  return [...ALL_STANDARD_UOMS].sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    if (isPharma) {
      if (["tablet", "capsule", "strip", "bottle", "box", "vial", "ampoule", "tube", "sachet", "ml", "mg"].includes(a.id)) scoreA += 10;
      if (["tablet", "capsule", "strip", "bottle", "box", "vial", "ampoule", "tube", "sachet", "ml", "mg"].includes(b.id)) scoreB += 10;
    } else if (isGrocery) {
      if (["piece", "pack", "box", "bottle", "can", "bag", "kg", "g", "l", "ml", "dozen"].includes(a.id)) scoreA += 10;
      if (["piece", "pack", "box", "bottle", "can", "bag", "kg", "g", "l", "ml", "dozen"].includes(b.id)) scoreB += 10;
    } else if (isElectronics) {
      if (["piece", "unit", "set", "pack", "box", "roll", "meter", "pair"].includes(a.id)) scoreA += 10;
      if (["piece", "unit", "set", "pack", "box", "roll", "meter", "pair"].includes(b.id)) scoreB += 10;
    } else if (isHardware) {
      if (["piece", "box", "carton", "roll", "sheet", "set", "pair", "meter", "kg"].includes(a.id)) scoreA += 10;
      if (["piece", "box", "carton", "roll", "sheet", "set", "pair", "meter", "kg"].includes(b.id)) scoreB += 10;
    } else if (isRestaurant) {
      if (["piece", "bottle", "can", "pack", "portion", "kg", "g", "l", "ml"].includes(a.id)) scoreA += 10;
      if (["piece", "bottle", "can", "pack", "portion", "kg", "g", "l", "ml"].includes(b.id)) scoreB += 10;
    }

    // Default primary units
    if (["piece", "unit", "box", "pack", "bottle"].includes(a.id)) scoreA += 2;
    if (["piece", "unit", "box", "pack", "bottle"].includes(b.id)) scoreB += 2;

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
 * Format stock quantity with UOM label
 */
export function formatStockWithUOM(stock: number | string, uomNameOrId?: string | null): string {
  const count = typeof stock === "string" ? parseInt(stock, 10) || 0 : stock;
  if (!uomNameOrId) return `${count} Units`;

  const match = ALL_STANDARD_UOMS.find(
    (u) => u.id.toLowerCase() === uomNameOrId.toLowerCase() || u.name.toLowerCase() === uomNameOrId.toLowerCase()
  );

  const label = match ? match.name : uomNameOrId;
  const isPlural = count !== 1;

  // Standard metric and dimension unit abbreviations
  if (match && ["kg", "g", "mg", "lb", "oz", "l", "ml", "fl_oz", "gal", "meter", "cm", "foot"].includes(match.id)) {
    return `${count} ${match.abbreviation}`;
  }

  // Simple pluralization
  if (isPlural) {
    if (label.toLowerCase() === "box") return `${count} Boxes`;
    if (label.toLowerCase() === "sachet / pouch" || label.toLowerCase() === "sachet") return `${count} Sachets`;
    if (label.toLowerCase() === "bottle") return `${count} Bottles`;
    if (label.toLowerCase() === "piece") return `${count} Pieces`;
    if (label.toLowerCase() === "unit") return `${count} Units`;
    if (label.toLowerCase() === "tablet") return `${count} Tablets`;
    if (label.toLowerCase() === "capsule") return `${count} Capsules`;
    if (label.toLowerCase() === "strip") return `${count} Strips`;
    if (label.toLowerCase() === "can / tin" || label.toLowerCase() === "can") return `${count} Cans`;
    return `${count} ${label}s`;
  }

  return `${count} ${label}`;
}
