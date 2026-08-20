/**
 * Allowed Units of Measure (UOM) Catalog per Industry
 *
 * Ensures deterministic UOM validation and prevents arbitrary AI hallucinated units.
 */

export const INDUSTRY_ALLOWED_UOMS: Record<string, string[]> = {
  pharmacy: [
    "tablet",
    "capsule",
    "syrup",
    "bottle",
    "strip",
    "box",
    "pack",
    "vial",
    "ampoule",
    "tube",
    "sachet",
    "drop",
    "inhaler",
    "piece",
    "patch",
    "cream",
    "ointment",
    "gel",
    "spray",
    "suspension",
  ],
  retail: [
    "piece",
    "pack",
    "box",
    "kg",
    "gram",
    "liter",
    "ml",
    "bottle",
    "can",
    "packet",
    "bag",
    "carton",
    "pair",
    "set",
    "dozen",
    "meter",
    "roll",
    "item",
  ],
  grocery: [
    "kg",
    "gram",
    "liter",
    "ml",
    "piece",
    "pack",
    "box",
    "bag",
    "bottle",
    "can",
    "jar",
    "pouch",
    "packet",
    "carton",
    "dozen",
  ],
  electronics: [
    "piece",
    "unit",
    "box",
    "pack",
    "set",
    "pair",
    "meter",
    "roll",
    "kit",
    "item",
  ],
  restaurant: [
    "portion",
    "plate",
    "serving",
    "cup",
    "glass",
    "bowl",
    "piece",
    "pack",
    "bottle",
    "can",
    "liter",
    "kg",
  ],
  general: [
    "piece",
    "unit",
    "pack",
    "box",
    "kg",
    "gram",
    "liter",
    "ml",
    "bottle",
    "can",
    "bag",
    "carton",
    "set",
    "pair",
    "item",
  ],
};

export const getAllowedUomsForIndustry = (industryType?: string | null): string[] => {
  if (!industryType) return INDUSTRY_ALLOWED_UOMS.general;
  const key = industryType.toLowerCase().trim();
  return INDUSTRY_ALLOWED_UOMS[key] || INDUSTRY_ALLOWED_UOMS.general;
};

export const isUomAllowedForIndustry = (
  uom: string,
  industryType?: string | null
): boolean => {
  if (!uom || !uom.trim()) return false;
  const allowed = getAllowedUomsForIndustry(industryType);
  return allowed.includes(uom.toLowerCase().trim());
};
