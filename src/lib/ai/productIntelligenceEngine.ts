/**
 * GEFLOW AI — PRODUCT INTELLIGENCE ENGINE
 *
 * Intelligent parser, catalog matcher, and suggestion generator.
 * Analyzes natural language product descriptions, titles, or supplier lines,
 * extracting identification, classification, UOM, attributes, and pricing.
 */

import {
  ProductSuggestion,
  CategoryValidationContext,
  ProductUnitType,
} from "@/types/aiProductIntelligence";
import { normalizeToProductSuggestion } from "./productIntelligenceNormalization";

interface AnalysisInput {
  rawText: string;
  categoryContext?: CategoryValidationContext;
  currentFormState?: Record<string, any>;
  businessIndustry?: string;
  businessCurrency?: string;
}

/**
 * Common packaging / stock unit mappings
 */
const UNIT_KEYWORDS: Array<{ match: RegExp; unit: string; type: ProductUnitType }> = [
  { match: /\b(biscuit|biscuits|buscit|biscut|cookie|cookies|cracker|crackers|wafer|wafers|rusk|rusks|snack|snacks|chip|chips|crisp|crisps|candy|candies|chocolate|chocolates|bar|bars|cake|cakes|bread|buns|bun|noodles|pasta|cereal)\b/i, unit: "pack", type: "quantity" },
  { match: /\b(packet|packets|pkt|pkts)\b/i, unit: "pack", type: "quantity" },
  { match: /\b(pack|packs|pk|pks)\b/i, unit: "pack", type: "quantity" },
  { match: /\b(tablet|tab|tablets|tabs)\b/i, unit: "tablet", type: "quantity" },
  { match: /\b(capsule|capsules|cap|caps)\b/i, unit: "capsule", type: "quantity" },
  { match: /\b(strip|strips)\b/i, unit: "strip", type: "quantity" },
  { match: /\b(bottle|bottles|btl|btls)\b/i, unit: "bottle", type: "quantity" },
  { match: /\b(box|boxes|bx)\b/i, unit: "box", type: "quantity" },
  { match: /\b(can|cans|tin|tins)\b/i, unit: "can", type: "quantity" },
  { match: /\b(vial|vials|ampoule|ampoules)\b/i, unit: "vial", type: "quantity" },
  { match: /\b(tube|tubes)\b/i, unit: "tube", type: "quantity" },
  { match: /\b(sachet|sachets|pouch|pouches)\b/i, unit: "sachet", type: "quantity" },
  { match: /\b(bag|bags)\b/i, unit: "bag", type: "quantity" },
  { match: /\b(carton|cartons|ctn)\b/i, unit: "carton", type: "quantity" },
  { match: /\b(roll|rolls)\b/i, unit: "roll", type: "quantity" },
  { match: /\b(pair|pairs|prs)\b/i, unit: "pair", type: "quantity" },
  { match: /\b(set|sets)\b/i, unit: "set", type: "quantity" },
  { match: /\b(kg|kilogram|kilograms)\b/i, unit: "kg", type: "weight" },
  { match: /\b(gram|grams|gm|g)\b/i, unit: "g", type: "weight" },
  { match: /\b(liter|litre|liters|litres|l)\b/i, unit: "liter", type: "volume" },
  { match: /\b(piece|pieces|pc|pcs|item|items|unit|units)\b/i, unit: "piece", type: "quantity" },
];

/**
 * Common known brands detector
 */
const KNOWN_BRANDS = [
  "Samsung", "Apple", "Sony", "Nike", "Adidas", "Puma", "Coca-Cola", "Pepsi", "Nestle",
  "Unilever", "Procter & Gamble", "P&G", "GSK", "Pfizer", "Novartis", "Abbott", "Sanofi",
  "Bayer", "Johnson & Johnson", "Colgate", "L'Oreal", "Nivea", "Dell", "HP", "Lenovo",
  "Asus", "Logitech", "Xiaomi", "Anker", "TP-Link", "Canon", "Bosch", "Stanley", "Philips"
];

/**
 * Analyze raw input and produce a structured ProductSuggestion
 */
export async function analyzeProductInput({
  rawText,
  categoryContext,
  currentFormState,
  businessIndustry,
}: AnalysisInput): Promise<ProductSuggestion> {
  const startTime = Date.now();
  const text = rawText.trim();

  // 1. Extract Strength / Dosage (e.g. 500mg, 10mg/5ml, 250mcg, 1.5g, 25W)
  const strengthMatch = text.match(/(\d+(?:\.\d+)?\s*(?:mg(?:\/\d+ml)?|g|mcg|iu|ml|l|w|v|mah|ah|kg))\b/i);
  const strength = strengthMatch ? strengthMatch[1].trim() : null;

  // 2. Extract Pack Size / Scale (e.g. "20 tablets per box", "pack of 20", "20 tablets", "x10", "10pcs", "box of 100")
  let packSize: number | null = null;
  const perBoxMatch = text.match(/(\d+)\s*(?:tablets?|tabs?|capsules?|caps?|pieces?|pcs?|units?|items?|sachets?|strips?)\s*(?:per|\/|in\s*(?:a|each|1))\s*(?:box|pack|carton|strip|dozen)?/i);
  const packMatch = text.match(/(?:pack\s+of|box\s+of|strip\s+of|carton\s+of|\bx)\s*(\d+)\b/i) ||
                    text.match(/(\d+)\s*(?:tablets|tabs|capsules|caps|pieces|pcs|count|ct|sachets)\b/i);
  if (perBoxMatch && perBoxMatch[1]) {
    const num = parseInt(perBoxMatch[1], 10);
    if (!isNaN(num) && num > 0 && num <= 50000) {
      packSize = num;
    }
  } else if (packMatch && packMatch[1]) {
    const num = parseInt(packMatch[1], 10);
    if (!isNaN(num) && num > 0 && num <= 50000) {
      packSize = num;
    }
  }

  // 3. Extract Weight / Volume physical dimensions
  let volume: { value: number; unit: "l" | "ml" | "fl_oz" } | null = null;
  const volMatch = text.match(/(\d+(?:\.\d+)?)\s*(l|liter|litre|ml|fl\s*oz)\b/i);
  if (volMatch) {
    const unitRaw = volMatch[2].toLowerCase();
    const unit = unitRaw.startsWith("ml") ? "ml" : (unitRaw.includes("oz") ? "fl_oz" : "l");
    volume = { value: parseFloat(volMatch[1]), unit };
  }

  let weight: { value: number; unit: "kg" | "g" | "mg" | "lb" | "oz" } | null = null;
  const wtMatch = text.match(/(\d+(?:\.\d+)?)\s*(kg|kilogram|g|gm|gram|mg|lb|oz)\b/i);
  if (wtMatch) {
    const unitRaw = wtMatch[2].toLowerCase();
    let unit: "kg" | "g" | "mg" | "lb" | "oz" = "g";
    if (unitRaw.startsWith("kg")) unit = "kg";
    else if (unitRaw.startsWith("mg")) unit = "mg";
    else if (unitRaw.startsWith("lb")) unit = "lb";
    else if (unitRaw.startsWith("oz")) unit = "oz";
    weight = { value: parseFloat(wtMatch[1]), unit };
  }

  // 4. Detect Primary Packaging / Stock Unit
  let stockUnit = "piece";
  let unitType: ProductUnitType = "quantity";
  if (/\b(?:box|boxes|bx)\b/i.test(text)) {
    stockUnit = "box";
  } else if (/\b(?:carton|cartons|ctn)\b/i.test(text)) {
    stockUnit = "carton";
  } else if (/\b(?:pack|packs|packet|packets|pkt|pkts)\b/i.test(text)) {
    stockUnit = "pack";
  } else if (/\b(?:strip|strips)\b/i.test(text)) {
    stockUnit = "strip";
  } else if (/\b(?:bottle|bottles|btl)\b/i.test(text)) {
    stockUnit = "bottle";
  } else {
    for (const item of UNIT_KEYWORDS) {
      if (item.match.test(text)) {
        stockUnit = item.unit;
        unitType = item.type;
        break;
      }
    }
  }

  // 5. Detect Physical Form
  let form: string | null = null;
  if (/\b(biscuit|biscuits|buscit|biscut|cookie|cookies|cracker|crackers|wafer|wafers|rusk)\b/i.test(text)) form = "biscuit / bakery";
  else if (/\b(snack|snacks|chip|chips|crisp|crisps|popcorn)\b/i.test(text)) form = "snack";
  else if (/\b(candy|candies|chocolate|chocolates|toffee|chewing gum|sweet|sweets)\b/i.test(text)) form = "confectionery";
  else if (/\b(tablet|tabs)\b/i.test(text)) form = "tablet";
  else if (/\b(capsule|caps)\b/i.test(text)) form = "capsule";
  else if (/\b(syrup|liquid|suspension|drops)\b/i.test(text)) form = "syrup";
  else if (/\b(injection|vial|ampoule)\b/i.test(text)) form = "injectable";
  else if (/\b(cream|ointment|gel)\b/i.test(text)) form = "topical gel";
  else if (/\b(powder|granules)\b/i.test(text)) form = "powder";
  else if (/\b(spray|aerosol)\b/i.test(text)) form = "spray";
  else if (/\b(soap|shampoo|facewash|detergent)\b/i.test(text)) form = "personal care";

  // 6. Detect Brand
  let detectedBrand: string | null = null;
  for (const b of KNOWN_BRANDS) {
    if (new RegExp(`\\b${b}\\b`, "i").test(text)) {
      detectedBrand = b;
      break;
    }
  }

  // 7. Extract Barcode if present (numeric string of 8, 12, 13, 14 digits)
  const barcodeMatch = text.match(/\b(\d{8}|\d{12}|\d{13}|\d{14})\b/);
  const detectedBarcode = barcodeMatch ? barcodeMatch[1] : null;

  // 8. Extract Pricing & Stock Units if user included explicit cost/price keywords
  let purchaseCost: number | null = null;
  let retailPrice: number | null = null;
  let stockUnits: number | null = null;

  const buyMatch = text.match(/(?:buy|cost|cp|purchase\s*price|purchase\s*cost|purchase|pur|bought\s*for)\s*(?:is|at|:|=)?\s*(?:rs\.?|pkr|inr|\$|€|£)?\s*(\d+(?:\.\d+)?)/i);
  if (buyMatch) purchaseCost = parseFloat(buyMatch[1]);

  const sellMatch = text.match(/(?:sell|selling\s*price|selling|price|sp|retail\s*price|retail|mrp|sale)\s*(?:is|at|:|=)?\s*(?:rs\.?|pkr|inr|\$|€|£)?\s*(\d+(?:\.\d+)?)/i);
  if (sellMatch) retailPrice = parseFloat(sellMatch[1]);

  // If retailPrice is still null, look for explicit currency tags
  if (retailPrice === null) {
    const currencySuffixMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:rs|pkr|inr|rupees?|\/-)\b/i);
    const currencyPrefixMatch = text.match(/(?:rs\.?|pkr|inr|\$|€|£)\s*(\d+(?:\.\d+)?)\b/i);

    if (currencySuffixMatch) {
      const val = parseFloat(currencySuffixMatch[1]);
      if (!isNaN(val) && val !== purchaseCost) {
        retailPrice = val;
      }
    } else if (currencyPrefixMatch) {
      const val = parseFloat(currencyPrefixMatch[1]);
      if (!isNaN(val) && val !== purchaseCost) {
        retailPrice = val;
      }
    }
  }

  // Extract total quantity / boxes
  const stockMatch = text.match(/(?:qty|stock|quantity|inventory|count)\s*(?:is|at|:|=)?\s*(\d+)/i) ||
                     text.match(/\b(\d+)\s*(?:box|boxes|carton|cartons|packs?|bottles?|strips?|pieces?|pcs)\b/i);
  if (stockMatch) {
    const rawQty = parseInt(stockMatch[1], 10);
    if (!isNaN(rawQty) && rawQty > 0) {
      // If user specified e.g. 10 Box and 20 Tablets Per Box, stockUnits = 10 * 20 = 200 (or rawQty)
      stockUnits = packSize && packSize > 1 ? rawQty * packSize : rawQty;
    }
  }

  // 9. Normalize Clean Product Title
  let cleanName = text
    .replace(/(?:buy|cost|cp|purchase\s*price|purchase\s*cost|purchase|pur|bought\s*for)\s*(?:is|at|:|=)?\s*(?:rs\.?|pkr|inr|\$|€|£)?\s*\d+(?:\.\d+)?(?:\s*(?:per|\/)\s*(?:box|pack|piece|unit|item))?/gi, "")
    .replace(/(?:sell|selling\s*price|selling|price|sp|retail\s*price|retail|mrp|sale)\s*(?:is|at|:|=)?\s*(?:rs\.?|pkr|inr|\$|€|£)?\s*\d+(?:\.\d+)?(?:\s*(?:per|\/)\s*(?:box|pack|piece|unit|item))?/gi, "")
    .replace(/\b\d+\s*(?:tablets?|tabs?|capsules?|caps?|pieces?|pcs?|units?|items?|sachets?|strips?)\s*(?:per|\/|in\s*(?:a|each|1))\s*(?:box|pack|carton|strip|dozen)?/gi, "")
    .replace(/\b\d+\s*(?:box|boxes|bx|carton|cartons|ctn|packs?|packet|packets|pkt|pkts|bottles?|strips?|pieces?|pcs)\b/gi, "")
    .replace(/\b\d+(?:\.\d+)?\s*(?:rs|pkr|inr|rupees?|\/-)\b/gi, "")
    .replace(/(?:rs\.?|pkr|inr|\$|€|£)\s*\d+(?:\.\d+)?\b/gi, "")
    .replace(/(?:pack\s+of|box\s+of|strip\s+of|carton\s+of)\s*\d+\s*(?:pack|packs|packet|packets|pcs|pieces|tabs|tablets|caps|capsules|units)?/gi, "")
    .replace(/(?:qty|stock|quantity|units|count)\s*[:=]?\s*\d+/gi, "")
    .replace(/\b(\d{8}|\d{12}|\d{13}|\d{14})\b/g, "")
    .replace(/[,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Capitalize title properly
  if (cleanName.length > 0) {
    cleanName = cleanName
      .split(" ")
      .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(" ");
  } else {
    cleanName = text;
  }

  // 10. Intelligent Category & Subcategory Matching with Domain Semantic Heuristics
  let matchedCategoryId: string | null = null;
  let matchedCategoryName: string | null = null;
  let matchedSubcategoryId: string | null = null;
  let matchedSubcategoryName: string | null = null;

  if (categoryContext && categoryContext.allowedPrimaryCategories?.length > 0) {
    const lowerText = text.toLowerCase();

    // Domain semantic associations
    const domainAssociations: Record<string, { parentKeywords: string[]; subKeywords?: Record<string, string[]> }> = {
      pharma: {
        parentKeywords: ["pharmaceutical", "pharma", "health", "medicine", "medical", "drug", "care"],
        subKeywords: {
          pain: ["pain", "analgesic", "paracetamol", "panadol", "ibuprofen", "aspirin", "fever"],
          antibiotic: ["antibiotic", "amoxicillin", "penicillin", "cipro", "azithromycin", "infection"],
          vitamins: ["vitamin", "supplement", "mineral", "calcium", "zinc", "iron"],
        },
      },
      beverage: {
        parentKeywords: ["beverage", "drink", "soda", "liquid", "refreshment"],
        subKeywords: {
          soda: ["coca", "cola", "pepsi", "sprite", "fanta", "soda", "carbonated"],
          juice: ["juice", "fruit", "orange", "apple", "mango"],
          water: ["water", "mineral", "sparkling"],
        },
      },
      fmcg: {
        parentKeywords: ["fmcg", "grocery", "groceries", "food", "supermarket", "packaged", "bakery", "snack"],
        subKeywords: {
          bakery: ["biscuit", "biscuits", "buscit", "cookie", "cookies", "cracker", "cake", "bread", "rusk"],
          snacks: ["snack", "chips", "crisps", "lays", "popcorn"],
          confectionery: ["chocolate", "candy", "toffee", "sweet"],
        },
      },
    };

    // Check direct matches first
    let bestParent = categoryContext.allowedPrimaryCategories.find((cat) => {
      const catNameLower = cat.name.toLowerCase();
      const slug = (cat.slug || "").toLowerCase();
      return (
        lowerText.includes(catNameLower) ||
        (slug && lowerText.includes(slug)) ||
        catNameLower.split(/[\s&,/]+/).some((w) => w.length > 3 && lowerText.includes(w))
      );
    });

    // Check domain semantic keywords if direct match wasn't found
    if (!bestParent) {
      for (const [domainKey, domainData] of Object.entries(domainAssociations)) {
        const matchesDomainText =
          (domainKey === "pharma" && /\b(paracetamol|panadol|ibuprofen|amoxicillin|aspirin|antibiotic|capsule|tablet|mg|syrup|vial)\b/i.test(lowerText)) ||
          (domainKey === "beverage" && /\b(coca|cola|pepsi|sprite|fanta|drink|juice|soda|tea|coffee|bottle|can|1\.5l|500ml|beverage)\b/i.test(lowerText)) ||
          (domainKey === "fmcg" && /\b(biscuit|biscuits|buscit|biscut|cookie|cookies|cracker|crackers|wafer|snack|chips|crisp|candy|chocolate|cake|bread|grocery|food|noodles|pasta|cereal)\b/i.test(lowerText));

        if (matchesDomainText) {
          bestParent = categoryContext.allowedPrimaryCategories.find((cat) => {
            const catNameLower = cat.name.toLowerCase();
            const slug = (cat.slug || "").toLowerCase();
            return domainData.parentKeywords.some((pk) => catNameLower.includes(pk) || slug.includes(pk));
          });
          if (bestParent) break;
        }
      }
    }

    // If still not found and single category exists
    if (!bestParent && categoryContext.allowedPrimaryCategories.length === 1) {
      bestParent = categoryContext.allowedPrimaryCategories[0];
    }

    if (bestParent) {
      matchedCategoryId = bestParent.id;
      matchedCategoryName = bestParent.name;

      // Find subcategories under this parent
      const subcats = categoryContext.allowedSubcategories.filter((s) => !s.parentId || s.parentId === bestParent?.id);
      let bestSub = subcats.find((sub) => {
        const subLower = sub.name.toLowerCase();
        const slug = (sub.slug || "").toLowerCase();
        return (
          lowerText.includes(subLower) ||
          (slug && lowerText.includes(slug)) ||
          subLower.split(/[\s&,/]+/).some((w) => w.length > 3 && lowerText.includes(w))
        );
      });

      if (!bestSub) {
        // Domain subcategory check
        if (/\b(paracetamol|panadol|ibuprofen|aspirin|pain|fever)\b/i.test(lowerText)) {
          bestSub = subcats.find((s) => /pain|analgesic/i.test(s.name) || /pain|analgesic/i.test(s.slug || ""));
        } else if (/\b(amoxicillin|antibiotic|penicillin|cipro)\b/i.test(lowerText)) {
          bestSub = subcats.find((s) => /antibiotic/i.test(s.name) || /antibiotic/i.test(s.slug || ""));
        } else if (/\b(coca|cola|pepsi|sprite|soda)\b/i.test(lowerText)) {
          bestSub = subcats.find((s) => /soda|carbonated/i.test(s.name) || /soda|carbonated/i.test(s.slug || ""));
        } else if (/\b(biscuit|biscuits|buscit|cookie|cookies|cracker|cake|bread|rusk|wafer)\b/i.test(lowerText)) {
          bestSub = subcats.find((s) => /bakery|biscuit|cookie|snack/i.test(s.name) || /bakery|biscuit|cookie|snack/i.test(s.slug || ""));
        } else if (/\b(snack|chips|crisps|popcorn|lays)\b/i.test(lowerText)) {
          bestSub = subcats.find((s) => /snack|chips/i.test(s.name) || /snack|chips/i.test(s.slug || ""));
        } else if (/\b(chocolate|candy|toffee|sweet)\b/i.test(lowerText)) {
          bestSub = subcats.find((s) => /confectionery|candy|chocolate|sweet/i.test(s.name) || /confectionery|candy|chocolate|sweet/i.test(s.slug || ""));
        }
      }

      if (bestSub) {
        matchedSubcategoryId = bestSub.id;
        matchedSubcategoryName = bestSub.name;
      }
    }
  }

  // 11. Generate Descriptive POS/Marketing Summary
  const descParts: string[] = [];
  if (detectedBrand) descParts.push(`Brand: ${detectedBrand}.`);
  if (strength) descParts.push(`Strength/Formulation: ${strength}.`);
  if (form) descParts.push(`Form: ${form.charAt(0).toUpperCase() + form.slice(1)}.`);
  if (packSize) descParts.push(`Pack configuration: ${packSize} units per ${stockUnit}.`);
  if (volume) descParts.push(`Volume: ${volume.value} ${volume.unit.toUpperCase()}.`);
  if (weight) descParts.push(`Weight: ${weight.value} ${weight.unit}.`);
  const generatedDescription = descParts.length > 0 ? descParts.join(" ") : null;

  // 12. Calculate Confidences
  let confidence = 0.85;
  const fieldConf: Record<string, number> = {
    product_name: cleanName.length > 3 ? 0.95 : 0.60,
    stock_unit: stockUnit !== "piece" ? 0.90 : 0.70,
  };

  if (matchedCategoryId) {
    fieldConf.primary_category = 0.88;
  } else {
    fieldConf.primary_category = 0.40;
    confidence -= 0.15;
  }

  if (matchedSubcategoryId) {
    fieldConf.subcategory = 0.85;
  }

  if (detectedBrand) fieldConf.brand = 0.90;
  if (strength) fieldConf.strength = 0.92;
  if (packSize) fieldConf.pack_size = 0.85;

  const rawSuggestion = {
    identification: {
      product_name: cleanName,
      brand: detectedBrand,
      product_type: form || (businessIndustry ? `${businessIndustry} Product` : null),
      description: generatedDescription,
      barcode: detectedBarcode,
    },
    classification: {
      primary_category_id: matchedCategoryId,
      primary_category_name: matchedCategoryName,
      subcategory_id: matchedSubcategoryId,
      subcategory_name: matchedSubcategoryName,
    },
    uom: {
      unit_type: unitType,
      stock_unit: stockUnit,
      pack_size: packSize,
      weight,
      volume,
    },
    attributes: {
      strength,
      form,
      metadata: {
        analyzed_at: new Date().toISOString(),
        industry: businessIndustry || "General",
      },
    },
    extracted_business_data: {
      purchase_cost: purchaseCost,
      retail_price: retailPrice,
      stock_units: stockUnits,
      min_stock_alert: null,
      batch_number: null,
      expiry_date: null,
      user_supplied: !!(purchaseCost !== null || retailPrice !== null || stockUnits !== null),
    },
    overall_confidence: Math.max(0.4, Math.min(0.98, confidence)),
    field_confidence: fieldConf,
  };

  const metadata = {
    provider: "geflow-product-intelligence",
    model: "semantic-heuristic-v1",
    generated_at: new Date().toISOString(),
    latency_ms: Date.now() - startTime,
  };

  return normalizeToProductSuggestion(rawSuggestion, metadata, categoryContext);
}
