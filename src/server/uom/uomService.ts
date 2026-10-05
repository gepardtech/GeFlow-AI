import fs from "fs";
import path from "path";

export interface MasterUom {
  id: string;
  uomId: string;
  name: string;
  symbol: string;
  type: string; // Weight, Volume, Length, Quantity, Packaging, Food & Beverage, Area, Time, Service, Other
  parentId: string | null; // ID of parent Main UoM, or null if this is a Main UoM
  parentName: string | null; // Name of parent e.g. "Weight", "Volume", "Food & Beverage", or null
  isMainUom: boolean;
  targetBusinessCategories: string[]; // List of Business Categories e.g. ["Restaurant & Dine-In", "Grocery Store & Minimart"]
  description: string;
  baseUnit?: string;
  subUnit?: string;
  conversionFactor?: number;
  conversionUnit?: string;
  decimalAllowed?: boolean;
  fractionAllowed?: boolean;
  status: "Active" | "Inactive";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const UOMS_FILE = path.join(DATA_DIR, "uoms.json");

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export const ALL_BUSINESS_CATEGORIES = [
  "Agricultural Supplies",
  "Auto Accessories",
  "Automotive Parts",
  "Bakery",
  "Building Materials",
  "Cakes & Desserts",
  "Computer & IT",
  "Confectionery",
  "Electrical Supplies",
  "Electronics",
  "Fashion & Apparel",
  "Furniture",
  "Gift & Lifestyle",
  "Grocery / Supermarket",
  "Hardware & Tools",
  "Home Appliances",
  "Mobile Accessories",
  "Mobile Phone",
  "Office / Asset Management",
  "Pharmacy / Medical Store",
  "Restaurant / Food Business",
  "Repair & Service Center",
  "Retail",
  "Salon / Beauty Services",
  "Seeds & Fertilizer",
  "Warehouse / Distribution",
  "Wholesale",
];

// Master Seed Categories & Sub-UoMs according to user's hierarchical architecture
export const SEED_HIERARCHICAL_UOMS: MasterUom[] = [
  // ================= MAIN UoMs (Root Categories) =================
  {
    id: "UOM-MAIN-WEIGHT",
    uomId: "UOM-MAIN-WEIGHT",
    name: "Weight",
    symbol: "wt",
    type: "Weight",
    parentId: null,
    parentName: null,
    isMainUom: true,
    targetBusinessCategories: [
      "Grocery / Supermarket",
      "Pharmacy / Medical Store",
      "Restaurant / Food Business",
      "Warehouse / Distribution",
      "Wholesale",
      "Agriculture & Farming Supplies",
      "Retail",
    ],
    description: "Units used to measure product mass and weight.",
    decimalAllowed: true,
    fractionAllowed: true,
    status: "Active",
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-MAIN-VOLUME",
    uomId: "UOM-MAIN-VOLUME",
    name: "Volume",
    symbol: "vol",
    type: "Volume",
    parentId: null,
    parentName: null,
    isMainUom: true,
    targetBusinessCategories: [
      "Grocery / Supermarket",
      "Restaurant / Food Business",
      "Pharmacy / Medical Store",
      "Warehouse / Distribution",
      "Wholesale",
    ],
    description: "Units used to measure fluid and liquid volume.",
    decimalAllowed: true,
    fractionAllowed: true,
    status: "Active",
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-MAIN-FOOD",
    uomId: "UOM-MAIN-FOOD",
    name: "Food & Beverage",
    symbol: "f&b",
    type: "Food & Beverage",
    parentId: null,
    parentName: null,
    isMainUom: true,
    targetBusinessCategories: [
      "Restaurant / Food Business",
      "Bakery",
      "Cakes & Desserts",
      "Confectionery",
      "Retail",
    ],
    description: "Prepared food portions, restaurant servings, and dining units.",
    decimalAllowed: false,
    fractionAllowed: true,
    status: "Active",
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-MAIN-QUANTITY",
    uomId: "UOM-MAIN-QUANTITY",
    name: "Quantity",
    symbol: "qty",
    type: "Quantity",
    parentId: null,
    parentName: null,
    isMainUom: true,
    targetBusinessCategories: [
      "Retail",
      "Grocery / Supermarket",
      "Electronics",
      "Mobile Phone",
      "Mobile Accessories",
      "Computer & IT",
      "Fashion & Apparel",
      "Hardware & Tools",
      "Home Appliances",
      "Furniture",
      "Auto Accessories",
      "Automotive Parts",
      "Office / Asset Management",
      "Wholesale",
    ],
    description: "Discrete countable items, units, and assemblies.",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-MAIN-PACKAGING",
    uomId: "UOM-MAIN-PACKAGING",
    name: "Packaging",
    symbol: "pkg",
    type: "Packaging",
    parentId: null,
    parentName: null,
    isMainUom: true,
    targetBusinessCategories: [
      "Pharmacy / Medical Store",
      "Grocery / Supermarket",
      "Warehouse / Distribution",
      "Wholesale",
      "Retail",
      "Electronics",
      "Auto Accessories",
    ],
    description: "Commercial containers, packaging types, and shipping cases.",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-MAIN-LENGTH",
    uomId: "UOM-MAIN-LENGTH",
    name: "Length",
    symbol: "len",
    type: "Length",
    parentId: null,
    parentName: null,
    isMainUom: true,
    targetBusinessCategories: [
      "Electrical Supplies",
      "Hardware & Tools",
      "Building Materials",
      "Fashion & Apparel",
    ],
    description: "Units used for linear distance, cabling, and fabrics.",
    decimalAllowed: true,
    fractionAllowed: true,
    status: "Active",
    sortOrder: 6,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-MAIN-SERVICE",
    uomId: "UOM-MAIN-SERVICE",
    name: "Service & Labor",
    symbol: "svc",
    type: "Service",
    parentId: null,
    parentName: null,
    isMainUom: true,
    targetBusinessCategories: [
      "Repair & Service Center",
      "Salon / Beauty Services",
      "Auto Accessories",
    ],
    description: "Time-based, service, and labor session units.",
    decimalAllowed: true,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },

  // ================= SUB UoMs (Weight Children) =================
  {
    id: "UOM-101",
    uomId: "UOM-101",
    name: "Kilogram",
    symbol: "kg",
    type: "Weight",
    parentId: "UOM-MAIN-WEIGHT",
    parentName: "Weight",
    isMainUom: false,
    targetBusinessCategories: [
      "Grocery / Supermarket",
      "Pharmacy / Medical Store",
      "Restaurant / Food Business",
      "Warehouse / Distribution",
      "Wholesale",
      "Agriculture & Farming Supplies",
    ],
    description: "Standard metric kilogram unit (1 kg = 1,000 g).",
    baseUnit: "kg",
    subUnit: "g",
    conversionFactor: 1000,
    conversionUnit: "g",
    decimalAllowed: true,
    fractionAllowed: true,
    status: "Active",
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-102",
    uomId: "UOM-102",
    name: "Gram",
    symbol: "g",
    type: "Weight",
    parentId: "UOM-MAIN-WEIGHT",
    parentName: "Weight",
    isMainUom: false,
    targetBusinessCategories: [
      "Pharmacy / Medical Store",
      "Grocery / Supermarket",
      "Restaurant / Food Business",
      "Bakery",
      "Confectionery",
    ],
    description: "Standard gram unit (1 g = 1,000 mg).",
    baseUnit: "g",
    subUnit: "mg",
    conversionFactor: 1000,
    conversionUnit: "mg",
    decimalAllowed: true,
    fractionAllowed: true,
    status: "Active",
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-103",
    uomId: "UOM-103",
    name: "Milligram",
    symbol: "mg",
    type: "Weight",
    parentId: "UOM-MAIN-WEIGHT",
    parentName: "Weight",
    isMainUom: false,
    targetBusinessCategories: [
      "Pharmacy / Medical Store",
    ],
    description: "Micro weight unit used for chemical formulations and active ingredients.",
    baseUnit: "mg",
    subUnit: "mcg",
    conversionFactor: 1000,
    conversionUnit: "mcg",
    decimalAllowed: true,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-104",
    uomId: "UOM-104",
    name: "Pound",
    symbol: "lb",
    type: "Weight",
    parentId: "UOM-MAIN-WEIGHT",
    parentName: "Weight",
    isMainUom: false,
    targetBusinessCategories: [
      "Grocery / Supermarket",
      "Restaurant / Food Business",
      "Wholesale",
    ],
    description: "Imperial weight unit (1 lb ≈ 453.59g).",
    baseUnit: "lb",
    subUnit: "oz",
    conversionFactor: 16,
    conversionUnit: "oz",
    decimalAllowed: true,
    fractionAllowed: true,
    status: "Active",
    sortOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-105",
    uomId: "UOM-105",
    name: "Mann",
    symbol: "mann",
    type: "Weight",
    parentId: "UOM-MAIN-WEIGHT",
    parentName: "Weight",
    isMainUom: false,
    targetBusinessCategories: [
      "Grocery / Supermarket",
      "Wholesale",
      "Agriculture & Farming Supplies",
    ],
    description: "Bulk agricultural unit (1 Mann = 40 kg).",
    baseUnit: "mann",
    subUnit: "kg",
    conversionFactor: 40,
    conversionUnit: "kg",
    decimalAllowed: true,
    fractionAllowed: true,
    status: "Active",
    sortOrder: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },

  // ================= SUB UoMs (Volume Children) =================
  {
    id: "UOM-201",
    uomId: "UOM-201",
    name: "Liter",
    symbol: "L",
    type: "Volume",
    parentId: "UOM-MAIN-VOLUME",
    parentName: "Volume",
    isMainUom: false,
    targetBusinessCategories: [
      "Grocery / Supermarket",
      "Restaurant / Food Business",
      "Warehouse / Distribution",
      "Wholesale",
      "Retail",
    ],
    description: "Standard liquid volume unit (1 L = 1,000 ml).",
    baseUnit: "L",
    subUnit: "ml",
    conversionFactor: 1000,
    conversionUnit: "ml",
    decimalAllowed: true,
    fractionAllowed: true,
    status: "Active",
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-202",
    uomId: "UOM-202",
    name: "Milliliter",
    symbol: "ml",
    type: "Volume",
    parentId: "UOM-MAIN-VOLUME",
    parentName: "Volume",
    isMainUom: false,
    targetBusinessCategories: [
      "Pharmacy / Medical Store",
      "Grocery / Supermarket",
      "Restaurant / Food Business",
      "Salon / Beauty Services",
    ],
    description: "Small liquid measure (1 ml = 0.001 L).",
    baseUnit: "ml",
    subUnit: "ml",
    conversionFactor: 1,
    conversionUnit: "ml",
    decimalAllowed: true,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-203",
    uomId: "UOM-203",
    name: "Fluid Ounce",
    symbol: "fl oz",
    type: "Volume",
    parentId: "UOM-MAIN-VOLUME",
    parentName: "Volume",
    isMainUom: false,
    targetBusinessCategories: [
      "Restaurant / Food Business",
      "Retail",
    ],
    description: "Imperial fluid volume measure (1 fl oz ≈ 29.57 ml).",
    baseUnit: "fl oz",
    subUnit: "ml",
    conversionFactor: 29.57,
    conversionUnit: "ml",
    decimalAllowed: true,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-204",
    uomId: "UOM-204",
    name: "Gallon",
    symbol: "gal",
    type: "Volume",
    parentId: "UOM-MAIN-VOLUME",
    parentName: "Volume",
    isMainUom: false,
    targetBusinessCategories: [
      "Automotive Parts",
      "Warehouse / Distribution",
      "Wholesale",
      "Hardware & Tools",
    ],
    description: "Bulk liquid container measure (1 gal ≈ 3.785 L).",
    baseUnit: "gal",
    subUnit: "L",
    conversionFactor: 3.785,
    conversionUnit: "L",
    decimalAllowed: true,
    fractionAllowed: true,
    status: "Active",
    sortOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },

  // ================= SUB UoMs (Food & Beverage Children) =================
  {
    id: "UOM-301",
    uomId: "UOM-301",
    name: "Pizza",
    symbol: "pz",
    type: "Food & Beverage",
    parentId: "UOM-MAIN-FOOD",
    parentName: "Food & Beverage",
    isMainUom: false,
    targetBusinessCategories: [
      "Restaurant / Food Business",
      "Fast Food",
      "Bakery",
    ],
    description: "Full pizza pie, tracked by pieces/slices (e.g. 4, 6, 8, or 12 slices).",
    baseUnit: "pz",
    subUnit: "slice",
    conversionFactor: 8,
    conversionUnit: "slice",
    decimalAllowed: false,
    fractionAllowed: true,
    status: "Active",
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-302",
    uomId: "UOM-302",
    name: "Burger",
    symbol: "bgr",
    type: "Food & Beverage",
    parentId: "UOM-MAIN-FOOD",
    parentName: "Food & Beverage",
    isMainUom: false,
    targetBusinessCategories: [
      "Restaurant / Food Business",
      "Fast Food",
    ],
    description: "Individual burger meal or sandwich unit.",
    baseUnit: "bgr",
    subUnit: "unit",
    conversionFactor: 1,
    conversionUnit: "unit",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-303",
    uomId: "UOM-303",
    name: "Fries",
    symbol: "fr",
    type: "Food & Beverage",
    parentId: "UOM-MAIN-FOOD",
    parentName: "Food & Beverage",
    isMainUom: false,
    targetBusinessCategories: [
      "Restaurant / Food Business",
      "Fast Food",
    ],
    description: "Portion or basket of french fries.",
    baseUnit: "fr",
    subUnit: "portion",
    conversionFactor: 1,
    conversionUnit: "portion",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-304",
    uomId: "UOM-304",
    name: "Portion",
    symbol: "portion",
    type: "Food & Beverage",
    parentId: "UOM-MAIN-FOOD",
    parentName: "Food & Beverage",
    isMainUom: false,
    targetBusinessCategories: [
      "Restaurant / Food Business",
    ],
    description: "Prepared side portion or appetizer.",
    baseUnit: "portion",
    subUnit: "portion",
    conversionFactor: 1,
    conversionUnit: "portion",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-305",
    uomId: "UOM-305",
    name: "Plate",
    symbol: "plate",
    type: "Food & Beverage",
    parentId: "UOM-MAIN-FOOD",
    parentName: "Food & Beverage",
    isMainUom: false,
    targetBusinessCategories: [
      "Restaurant / Food Business",
    ],
    description: "Plated main entree or dining serving.",
    baseUnit: "plate",
    subUnit: "plate",
    conversionFactor: 1,
    conversionUnit: "plate",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-306",
    uomId: "UOM-306",
    name: "Slice",
    symbol: "slice",
    type: "Food & Beverage",
    parentId: "UOM-MAIN-FOOD",
    parentName: "Food & Beverage",
    isMainUom: false,
    targetBusinessCategories: [
      "Restaurant / Food Business",
      "Bakery",
      "Cakes & Desserts",
    ],
    description: "Individual cut slice of cake, pizza, or pie.",
    baseUnit: "slice",
    subUnit: "slice",
    conversionFactor: 1,
    conversionUnit: "slice",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 6,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-307",
    uomId: "UOM-307",
    name: "Cup",
    symbol: "cup",
    type: "Food & Beverage",
    parentId: "UOM-MAIN-FOOD",
    parentName: "Food & Beverage",
    isMainUom: false,
    targetBusinessCategories: [
      "Restaurant / Food Business",
      "Cafe & Coffee Shop",
    ],
    description: "Beverage or soup cup.",
    baseUnit: "cup",
    subUnit: "ml",
    conversionFactor: 250,
    conversionUnit: "ml",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },

  // ================= SUB UoMs (Quantity Children) =================
  {
    id: "UOM-401",
    uomId: "UOM-401",
    name: "Piece",
    symbol: "pcs",
    type: "Quantity",
    parentId: "UOM-MAIN-QUANTITY",
    parentName: "Quantity",
    isMainUom: false,
    targetBusinessCategories: [
      "Retail",
      "Grocery / Supermarket",
      "Electronics",
      "Mobile Phone",
      "Mobile Accessories",
      "Computer & IT",
      "Fashion & Apparel",
      "Hardware & Tools",
      "Home Appliances",
      "Auto Accessories",
      "Restaurant / Food Business",
      "Pharmacy / Medical Store",
      "Wholesale",
    ],
    description: "Standard individual unit count (1:1 piece).",
    baseUnit: "pcs",
    subUnit: "pcs",
    conversionFactor: 1,
    conversionUnit: "pcs",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-402",
    uomId: "UOM-402",
    name: "Dozen",
    symbol: "doz",
    type: "Quantity",
    parentId: "UOM-MAIN-QUANTITY",
    parentName: "Quantity",
    isMainUom: false,
    targetBusinessCategories: [
      "Grocery / Supermarket",
      "Bakery",
      "Restaurant / Food Business",
      "Wholesale",
    ],
    description: "Pack of 12 items (1 Dozen = 12 pcs).",
    baseUnit: "doz",
    subUnit: "pcs",
    conversionFactor: 12,
    conversionUnit: "pcs",
    decimalAllowed: false,
    fractionAllowed: true,
    status: "Active",
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-403",
    uomId: "UOM-403",
    name: "Pair",
    symbol: "pr",
    type: "Quantity",
    parentId: "UOM-MAIN-QUANTITY",
    parentName: "Quantity",
    isMainUom: false,
    targetBusinessCategories: [
      "Fashion & Apparel",
      "Retail",
      "Auto Accessories",
    ],
    description: "Matched pair of 2 items (shoes, socks, wiper blades).",
    baseUnit: "pr",
    subUnit: "pcs",
    conversionFactor: 2,
    conversionUnit: "pcs",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-404",
    uomId: "UOM-404",
    name: "Set",
    symbol: "set",
    type: "Quantity",
    parentId: "UOM-MAIN-QUANTITY",
    parentName: "Quantity",
    isMainUom: false,
    targetBusinessCategories: [
      "Furniture",
      "Hardware & Tools",
      "Electronics",
      "Retail",
    ],
    description: "Grouped assembly of items sold together.",
    baseUnit: "set",
    subUnit: "pcs",
    conversionFactor: 1,
    conversionUnit: "pcs",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },

  // ================= SUB UoMs (Packaging Children) =================
  {
    id: "UOM-501",
    uomId: "UOM-501",
    name: "Box",
    symbol: "box",
    type: "Packaging",
    parentId: "UOM-MAIN-PACKAGING",
    parentName: "Packaging",
    isMainUom: false,
    targetBusinessCategories: [
      "Pharmacy / Medical Store",
      "Grocery / Supermarket",
      "Electronics",
      "Hardware & Tools",
      "Wholesale",
      "Restaurant / Food Business",
      "Retail",
    ],
    description: "Commercial box containing multiple smaller units/blisters/tablets.",
    baseUnit: "box",
    subUnit: "piece",
    conversionFactor: 12,
    conversionUnit: "piece",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-502",
    uomId: "UOM-502",
    name: "Carton",
    symbol: "ctn",
    type: "Packaging",
    parentId: "UOM-MAIN-PACKAGING",
    parentName: "Packaging",
    isMainUom: false,
    targetBusinessCategories: [
      "Warehouse / Distribution",
      "Wholesale",
      "Grocery / Supermarket",
      "Pharmacy / Medical Store",
    ],
    description: "Large corrugated shipping carton (e.g. 24 or 48 boxes/units).",
    baseUnit: "ctn",
    subUnit: "box",
    conversionFactor: 24,
    conversionUnit: "box",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-503",
    uomId: "UOM-503",
    name: "Pack",
    symbol: "pack",
    type: "Packaging",
    parentId: "UOM-MAIN-PACKAGING",
    parentName: "Packaging",
    isMainUom: false,
    targetBusinessCategories: [
      "Grocery / Supermarket",
      "Retail",
      "Wholesale",
      "Hardware & Tools",
    ],
    description: "Retail blister or poly-wrapped bundle pack.",
    baseUnit: "pack",
    subUnit: "pcs",
    conversionFactor: 10,
    conversionUnit: "pcs",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-504",
    uomId: "UOM-504",
    name: "Bottle",
    symbol: "btl",
    type: "Packaging",
    parentId: "UOM-MAIN-PACKAGING",
    parentName: "Packaging",
    isMainUom: false,
    targetBusinessCategories: [
      "Pharmacy / Medical Store",
      "Grocery / Supermarket",
      "Restaurant / Food Business",
      "Salon / Beauty Services",
    ],
    description: "Sealed glass or plastic container for liquid products.",
    baseUnit: "btl",
    subUnit: "ml",
    conversionFactor: 100,
    conversionUnit: "ml",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-505",
    uomId: "UOM-505",
    name: "Strip",
    symbol: "strip",
    type: "Packaging",
    parentId: "UOM-MAIN-PACKAGING",
    parentName: "Packaging",
    isMainUom: false,
    targetBusinessCategories: [
      "Pharmacy / Medical Store",
    ],
    description: "Medicine blister strip (e.g. 10 tablets per strip).",
    baseUnit: "strip",
    subUnit: "tablet",
    conversionFactor: 10,
    conversionUnit: "tablet",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-506",
    uomId: "UOM-506",
    name: "Tablet",
    symbol: "tab",
    type: "Packaging",
    parentId: "UOM-MAIN-PACKAGING",
    parentName: "Packaging",
    isMainUom: false,
    targetBusinessCategories: [
      "Pharmacy / Medical Store",
    ],
    description: "Single pharmaceutical oral solid dosage.",
    baseUnit: "tab",
    subUnit: "tab",
    conversionFactor: 1,
    conversionUnit: "tab",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 6,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-507",
    uomId: "UOM-507",
    name: "Capsule",
    symbol: "cap",
    type: "Packaging",
    parentId: "UOM-MAIN-PACKAGING",
    parentName: "Packaging",
    isMainUom: false,
    targetBusinessCategories: [
      "Pharmacy / Medical Store",
    ],
    description: "Single gelatin-encapsulated pharmaceutical dosage.",
    baseUnit: "cap",
    subUnit: "cap",
    conversionFactor: 1,
    conversionUnit: "cap",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-508",
    uomId: "UOM-508",
    name: "Can",
    symbol: "can",
    type: "Packaging",
    parentId: "UOM-MAIN-PACKAGING",
    parentName: "Packaging",
    isMainUom: false,
    targetBusinessCategories: [
      "Restaurant / Food Business",
      "Grocery / Supermarket",
      "Retail",
    ],
    description: "Canned beverage or sealed aluminum food tin.",
    baseUnit: "can",
    subUnit: "ml",
    conversionFactor: 330,
    conversionUnit: "ml",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-509",
    uomId: "UOM-509",
    name: "Sachet",
    symbol: "sachet",
    type: "Packaging",
    parentId: "UOM-MAIN-PACKAGING",
    parentName: "Packaging",
    isMainUom: false,
    targetBusinessCategories: [
      "Pharmacy / Medical Store",
      "Grocery / Supermarket",
      "Restaurant / Food Business",
    ],
    description: "Single-serve powdered or liquid packet.",
    baseUnit: "sachet",
    subUnit: "g",
    conversionFactor: 5,
    conversionUnit: "g",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 9,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-510",
    uomId: "UOM-510",
    name: "Bag / Sack",
    symbol: "bag",
    type: "Packaging",
    parentId: "UOM-MAIN-PACKAGING",
    parentName: "Packaging",
    isMainUom: false,
    targetBusinessCategories: [
      "Grocery / Supermarket",
      "Warehouse / Distribution",
      "Wholesale",
      "Building Materials",
      "Agriculture & Farming Supplies",
    ],
    description: "Heavy woven sack or large paper bag (e.g. 25 kg / 50 kg).",
    baseUnit: "bag",
    subUnit: "kg",
    conversionFactor: 25,
    conversionUnit: "kg",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },

  // ================= SUB UoMs (Length Children) =================
  {
    id: "UOM-601",
    uomId: "UOM-601",
    name: "Meter",
    symbol: "m",
    type: "Length",
    parentId: "UOM-MAIN-LENGTH",
    parentName: "Length",
    isMainUom: false,
    targetBusinessCategories: [
      "Electrical Supplies",
      "Hardware & Tools",
      "Building Materials",
      "Fashion & Apparel",
    ],
    description: "Standard metric distance unit (1 m = 100 cm).",
    baseUnit: "m",
    subUnit: "cm",
    conversionFactor: 100,
    conversionUnit: "cm",
    decimalAllowed: true,
    fractionAllowed: true,
    status: "Active",
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-602",
    uomId: "UOM-602",
    name: "Foot",
    symbol: "ft",
    type: "Length",
    parentId: "UOM-MAIN-LENGTH",
    parentName: "Length",
    isMainUom: false,
    targetBusinessCategories: [
      "Hardware & Tools",
      "Building Materials",
      "Plumbing",
    ],
    description: "Imperial length measure (1 ft = 12 inches).",
    baseUnit: "ft",
    subUnit: "in",
    conversionFactor: 12,
    conversionUnit: "in",
    decimalAllowed: true,
    fractionAllowed: true,
    status: "Active",
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },

  // ================= SUB UoMs (Service Children) =================
  {
    id: "UOM-701",
    uomId: "UOM-701",
    name: "Hour",
    symbol: "hr",
    type: "Service",
    parentId: "UOM-MAIN-SERVICE",
    parentName: "Service & Labor",
    isMainUom: false,
    targetBusinessCategories: [
      "Repair & Service Center",
      "Salon / Beauty Services",
    ],
    description: "Hourly billing rate for technician or labor.",
    baseUnit: "hr",
    subUnit: "min",
    conversionFactor: 60,
    conversionUnit: "min",
    decimalAllowed: true,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
  {
    id: "UOM-702",
    uomId: "UOM-702",
    name: "Session",
    symbol: "session",
    type: "Service",
    parentId: "UOM-MAIN-SERVICE",
    parentName: "Service & Labor",
    isMainUom: false,
    targetBusinessCategories: [
      "Salon / Beauty Services",
      "Repair & Service Center",
    ],
    description: "Individual client treatment or service appointment.",
    baseUnit: "session",
    subUnit: "session",
    conversionFactor: 1,
    conversionUnit: "session",
    decimalAllowed: false,
    fractionAllowed: false,
    status: "Active",
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin",
  },
];

export class UomService {
  private uoms: MasterUom[] = [];

  constructor() {
    ensureDirectoryExists();
    this.loadUoms();
  }

  private loadUoms() {
    try {
      if (fs.existsSync(UOMS_FILE)) {
        const raw = fs.readFileSync(UOMS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Check if parsed has hierarchical structure
          const hasMainFlag = parsed.some((u) => u.isMainUom !== undefined || u.parentId !== undefined);
          if (hasMainFlag) {
            this.uoms = parsed;
            return;
          }
        }
      }
    } catch (err) {
      console.warn("Notice reading uoms file, re-initializing:", err);
    }

    // Initialize with standard hierarchical seeds
    this.uoms = [...SEED_HIERARCHICAL_UOMS];
    this.saveUoms();
  }

  public saveUoms() {
    try {
      ensureDirectoryExists();
      fs.writeFileSync(UOMS_FILE, JSON.stringify(this.uoms, null, 2), "utf-8");
    } catch (err) {
      console.error("Error saving uoms file:", err);
    }
  }

  // --- Read Operations ---
  public getUoms(filters?: {
    parentId?: string | null;
    isMain?: boolean;
    businessCategory?: string;
    search?: string;
    status?: string;
  }): MasterUom[] {
    let result = [...this.uoms];

    if (filters) {
      if (filters.status && filters.status !== "all") {
        result = result.filter((u) => u.status === filters.status);
      }

      if (filters.isMain !== undefined) {
        result = result.filter((u) => u.isMainUom === filters.isMain);
      }

      if (filters.parentId !== undefined) {
        if (filters.parentId === null) {
          result = result.filter((u) => u.isMainUom || !u.parentId);
        } else {
          result = result.filter((u) => u.parentId === filters.parentId);
        }
      }

      if (filters.businessCategory && filters.businessCategory !== "all") {
        const target = filters.businessCategory.toLowerCase();
        result = result.filter((u) => {
          // Main UoMs are kept if they or any of their children match
          if (u.isMainUom) {
            const hasMatchingChild = this.uoms.some(
              (c) =>
                c.parentId === u.id &&
                c.targetBusinessCategories?.some((bc) => bc.toLowerCase().includes(target) || target.includes(bc.toLowerCase()))
            );
            const matchesDirect = u.targetBusinessCategories?.some((bc) => bc.toLowerCase().includes(target) || target.includes(bc.toLowerCase()));
            return hasMatchingChild || matchesDirect;
          }
          return u.targetBusinessCategories?.some(
            (bc) => bc.toLowerCase().includes(target) || target.includes(bc.toLowerCase())
          );
        });
      }

      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        result = result.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.symbol.toLowerCase().includes(q) ||
            (u.parentName && u.parentName.toLowerCase().includes(q)) ||
            (u.description && u.description.toLowerCase().includes(q))
        );
      }
    }

    return result.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  public getUom(id: string): MasterUom | null {
    return this.uoms.find((u) => u.id === id || u.uomId === id) || null;
  }

  // --- Write Operations ---
  public saveUom(data: Partial<MasterUom>, adminId = "admin"): MasterUom {
    const now = new Date().toISOString();
    let existingIndex = -1;

    if (data.id || data.uomId) {
      const matchId = data.id || data.uomId;
      existingIndex = this.uoms.findIndex((u) => u.id === matchId || u.uomId === matchId);
    } else if (data.name && data.parentId !== undefined) {
      existingIndex = this.uoms.findIndex(
        (u) => u.name.toLowerCase() === data.name?.toLowerCase() && u.parentId === data.parentId
      );
    }

    // Determine parent name if parentId provided
    let parentName = data.parentName || null;
    let isMainUom = data.isMainUom !== undefined ? data.isMainUom : !data.parentId;

    if (data.parentId) {
      const parent = this.uoms.find((u) => u.id === data.parentId || u.uomId === data.parentId);
      if (parent) {
        parentName = parent.name;
        isMainUom = false;
      }
    } else {
      parentName = null;
      isMainUom = true;
    }

    if (existingIndex >= 0) {
      const existing = this.uoms[existingIndex];
      const updated: MasterUom = {
        ...existing,
        ...data,
        id: existing.id || existing.uomId,
        uomId: existing.uomId || existing.id,
        isMainUom,
        parentName,
        targetBusinessCategories: Array.isArray(data.targetBusinessCategories)
          ? data.targetBusinessCategories
          : existing.targetBusinessCategories || [],
        updatedAt: now,
        updatedBy: adminId,
      };
      this.uoms[existingIndex] = updated;
      this.saveUoms();
      return updated;
    }

    // Create New UoM
    const newId = isMainUom
      ? `UOM-MAIN-${data.name?.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || Date.now()}`
      : `UOM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

    const newUom: MasterUom = {
      id: data.id || newId,
      uomId: data.uomId || newId,
      name: (data.name || "New UoM").trim(),
      symbol: (data.symbol || data.name?.slice(0, 3).toLowerCase() || "uom").trim(),
      type: data.type || (parentName ? parentName : isMainUom ? data.name || "Quantity" : "Quantity"),
      parentId: isMainUom ? null : data.parentId || null,
      parentName,
      isMainUom,
      targetBusinessCategories: Array.isArray(data.targetBusinessCategories) ? data.targetBusinessCategories : [],
      description: data.description || "",
      baseUnit: data.baseUnit || data.name || "unit",
      subUnit: data.subUnit || data.name || "unit",
      conversionFactor: Number(data.conversionFactor) || 1,
      conversionUnit: data.conversionUnit || data.baseUnit || "unit",
      decimalAllowed: Boolean(data.decimalAllowed),
      fractionAllowed: Boolean(data.fractionAllowed),
      status: data.status || "Active",
      sortOrder: Number(data.sortOrder) || (this.uoms.length + 1) * 10,
      createdAt: now,
      updatedAt: now,
      createdBy: adminId,
      updatedBy: adminId,
    };

    this.uoms.push(newUom);
    this.saveUoms();
    return newUom;
  }

  public deleteUom(id: string): boolean {
    const idx = this.uoms.findIndex((u) => u.id === id || u.uomId === id);
    if (idx === -1) return false;

    const uom = this.uoms[idx];
    if (uom.isMainUom) {
      // Deactivate child UoMs as well
      this.uoms.forEach((child) => {
        if (child.parentId === uom.id) {
          child.status = "Inactive";
          child.updatedAt = new Date().toISOString();
        }
      });
    }

    // Soft delete / deactivate rather than hard wiping to protect historic inventory references
    uom.status = "Inactive";
    uom.updatedAt = new Date().toISOString();
    this.saveUoms();
    return true;
  }

  public bulkUpdateUoms(
    ids: string[],
    updates: {
      action?: "status" | "categories" | "delete";
      status?: "Active" | "Inactive";
      targetBusinessCategories?: string[];
      addCategories?: string[];
    },
    adminId = "admin"
  ): { updatedCount: number } {
    let updatedCount = 0;
    const now = new Date().toISOString();
    const idSet = new Set(ids);

    this.uoms.forEach((u) => {
      if (idSet.has(u.id) || idSet.has(u.uomId)) {
        if (updates.action === "delete") {
          u.status = "Inactive";
        } else if (updates.action === "status" && updates.status) {
          u.status = updates.status;
        } else if (updates.action === "categories") {
          if (Array.isArray(updates.targetBusinessCategories)) {
            u.targetBusinessCategories = [...updates.targetBusinessCategories];
          } else if (Array.isArray(updates.addCategories)) {
            const current = new Set(u.targetBusinessCategories || []);
            updates.addCategories.forEach((c) => current.add(c));
            u.targetBusinessCategories = Array.from(current);
          }
        }
        u.updatedAt = now;
        u.updatedBy = adminId;
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      this.saveUoms();
    }

    return { updatedCount };
  }

  // --- Realtime Aggregation Statistics ---
  public getStats() {
    const totalUoms = this.uoms.length;
    const mainUoms = this.uoms.filter((u) => u.isMainUom).length;
    const subUoms = this.uoms.filter((u) => !u.isMainUom).length;

    // Distinct assigned categories
    const categoriesSet = new Set<string>();
    this.uoms.forEach((u) => {
      if (Array.isArray(u.targetBusinessCategories)) {
        u.targetBusinessCategories.forEach((c) => categoriesSet.add(c));
      }
    });

    return {
      totalUoms,
      mainUoms,
      subUoms,
      businessCategories: Math.max(categoriesSet.size, 21),
    };
  }

  // --- Category-Specific UoMs for Product Form ---
  public getUomsForBusinessCategory(categoryIdentifier?: string | null): {
    category: string;
    defaultUom: string;
    uoms: Array<{
      id: string;
      name: string;
      symbol: string;
      parentName: string;
      isDefault: boolean;
      subUnit?: string;
      conversionFactor?: number;
      decimalAllowed?: boolean;
    }>;
  } {
    const raw = (categoryIdentifier || "").toLowerCase().trim();

    const isRestaurant =
      raw.includes("restaurant") ||
      raw.includes("food") ||
      raw.includes("cafe") ||
      raw.includes("bakery") ||
      raw.includes("dining") ||
      raw.includes("fast food");

    const isPharmacy =
      raw.includes("pharmacy") ||
      raw.includes("medical") ||
      raw.includes("health") ||
      raw.includes("clinic") ||
      raw.includes("drug");

    const isGrocery =
      raw.includes("grocery") ||
      raw.includes("supermarket") ||
      raw.includes("mart") ||
      raw.includes("general store");

    const isElectronics =
      raw.includes("electronic") ||
      raw.includes("computer") ||
      raw.includes("mobile") ||
      raw.includes("gadget");

    // Filter sub-UoMs targeted for this category
    const activeSubUoms = this.uoms.filter((u) => !u.isMainUom && u.status === "Active");
    let matched = activeSubUoms.filter((u) => {
      const cats = (u.targetBusinessCategories || []).map((c) => c.toLowerCase());
      if (raw && cats.some((c) => c.includes(raw) || raw.includes(c))) return true;
      if (isRestaurant && cats.some((c) => c.includes("restaurant") || c.includes("food"))) return true;
      if (isPharmacy && cats.some((c) => c.includes("pharmacy") || c.includes("medical"))) return true;
      if (isGrocery && cats.some((c) => c.includes("grocery") || c.includes("supermarket"))) return true;
      if (isElectronics && cats.some((c) => c.includes("electronic") || c.includes("mobile") || c.includes("computer"))) return true;
      return false;
    });

    if (matched.length === 0) {
      // Fallback to all standard active sub-UoMs if no specific filter hit
      matched = activeSubUoms;
    }

    // Determine smart default
    let defaultUnitName = "piece";
    if (isRestaurant) {
      defaultUnitName = "pizza";
    } else if (isPharmacy) {
      defaultUnitName = "box";
    } else if (isGrocery) {
      defaultUnitName = "piece";
    }

    const defaultExists = matched.some((m) => m.name.toLowerCase() === defaultUnitName);
    if (!defaultExists && matched.length > 0) {
      defaultUnitName = matched[0].name.toLowerCase();
    }

    return {
      category: categoryIdentifier || "General",
      defaultUom: defaultUnitName,
      uoms: matched.map((m) => ({
        id: m.id,
        name: m.name,
        symbol: m.symbol,
        parentName: m.parentName || m.type || "General",
        isDefault: m.name.toLowerCase() === defaultUnitName,
        subUnit: m.subUnit || m.baseUnit || "unit",
        conversionFactor: m.conversionFactor || 1,
        decimalAllowed: m.decimalAllowed ?? false,
      })),
    };
  }
}

export const uomService = new UomService();
