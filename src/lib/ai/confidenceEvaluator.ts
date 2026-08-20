/**
 * GEFLOW AI — FIELD-LEVEL CONFIDENCE EVALUATION ENGINE (PHASE 10)
 *
 * Professional, multi-signal, field-level reliability evaluation system.
 * Evaluates each product attribute independently based on:
 * - Admin catalog validation (categories, subcategories, allowed UOMs)
 * - Explicit input evidence vs ungrounded inference
 * - Multi-model agreement/disagreement
 * - Anti-invention checks for financial and inventory attributes
 * - Source tracking (user, verified, ai, system)
 *
 * Invariant: Confidence is an internal reliability signal, not proof of correctness.
 */

import {
  ProductSuggestion,
  CategoryValidationContext,
  ConfidenceLevel,
  FieldConfidenceDetail,
  FieldSource,
} from "@/types/aiProductIntelligence";
import { CONFIDENCE_THRESHOLDS, getConfidenceLevel } from "./confidenceThresholds";
import { STANDARD_STOCK_UNITS } from "./productIntelligenceContract";

export interface ConfidenceEvaluationOptions {
  rawInput?: string;
  categoryContext?: CategoryValidationContext;
  modelDisagreements?: Record<string, { modelA: any; modelB: any }>;
  isUserOverride?: Record<string, boolean>;
}

export interface EvaluatedConfidenceResult {
  overall_confidence: number;
  confidence_level: ConfidenceLevel;
  needs_review: boolean;
  uncertain_fields: string[];
  field_confidence: Record<string, number>;
  field_confidence_details: Record<string, FieldConfidenceDetail>;
  field_sources: Record<string, FieldSource>;
  warnings: string[];
}

/**
 * Core function to evaluate field-level confidence independently
 */
export function evaluateProductSuggestionConfidence(
  suggestion: ProductSuggestion,
  options?: ConfidenceEvaluationOptions
): EvaluatedConfidenceResult {
  const rawInput = (options?.rawInput || suggestion.identification?.product_name || "").toLowerCase();
  const context = options?.categoryContext;
  const disagreements = options?.modelDisagreements || {};
  const isUserOverride = options?.isUserOverride || {};

  const details: Record<string, FieldConfidenceDetail> = {};
  const scoreMap: Record<string, number> = {};
  const sources: Record<string, FieldSource> = { ...(suggestion.field_sources || {}) };
  const warnings: string[] = [...(suggestion.warnings || [])];
  const uncertainFields: string[] = [];

  // Helper to register an evaluated field
  const registerField = (
    fieldKey: string,
    label: string,
    value: any,
    baseScore: number,
    isValidated: boolean,
    reason?: string,
    evidence?: string,
    fieldWarnings?: string[]
  ) => {
    let finalScore = Math.max(0, Math.min(1, baseScore));
    let source: FieldSource = (isUserOverride[fieldKey] ? "user" : sources[fieldKey] || "ai") as FieldSource;

    // If user provided, source is user and score is boosted to authoritative
    if (source === "user" || isUserOverride[fieldKey]) {
      finalScore = 0.98;
      isValidated = true;
      reason = reason || "Directly provided or edited by user";
    }

    // Check multi-model disagreement
    let hasDisagreement = false;
    if (disagreements[fieldKey] && source !== "user") {
      hasDisagreement = true;
      finalScore = Math.min(finalScore, 0.55); // Penalize disagreement below review threshold
      reason = `AI models suggested conflicting values (${disagreements[fieldKey].modelA} vs ${disagreements[fieldKey].modelB})`;
    }

    const level = getConfidenceLevel(finalScore);
    const needsReview = finalScore < CONFIDENCE_THRESHOLDS.AUTO_REVIEW_THRESHOLD || !isValidated || hasDisagreement;

    if (needsReview) {
      uncertainFields.push(fieldKey);
    }

    if (isValidated && source === "ai" && finalScore >= CONFIDENCE_THRESHOLDS.HIGH_THRESHOLD) {
      source = "verified";
    }

    const detail: FieldConfidenceDetail = {
      field: fieldKey,
      label,
      value,
      confidence_score: Math.round(finalScore * 100) / 100,
      confidence_level: level,
      needs_review: needsReview,
      validated: isValidated,
      source,
      reason,
      evidence,
      warnings: fieldWarnings && fieldWarnings.length > 0 ? fieldWarnings : undefined,
      disagreement: hasDisagreement,
    };

    details[fieldKey] = detail;
    scoreMap[fieldKey] = detail.confidence_score;
    sources[fieldKey] = source;

    if (fieldWarnings) {
      warnings.push(...fieldWarnings);
    }
  };

  // ---------------------------------------------------------------------------
  // 1. PRODUCT NAME
  // ---------------------------------------------------------------------------
  const prodName = suggestion.identification?.product_name || "";
  let nameScore = 0.88;
  let nameValidated = false;
  let nameReason = "Standard product naming";

  if (!prodName || prodName.trim().length === 0) {
    nameScore = 0.1;
    nameReason = "Product name is missing";
  } else if (prodName.trim().length >= 3) {
    nameScore = 0.92;
    nameValidated = true;
    if (rawInput && prodName.toLowerCase().includes(rawInput.trim().toLowerCase())) {
      nameScore = 0.96;
      nameReason = "Exact match with input text";
    }
  } else {
    nameScore = 0.5;
    nameReason = "Product name is unusually short";
  }
  registerField("product_name", "Product Name", prodName, nameScore, nameValidated, nameReason);

  // ---------------------------------------------------------------------------
  // 2. PRIMARY CATEGORY
  // ---------------------------------------------------------------------------
  const catId = suggestion.classification?.primary_category_id;
  const catName = suggestion.classification?.primary_category_name;
  let catScore = 0.5;
  let catValidated = false;
  let catReason = "Category determination pending";

  if (context?.allowedPrimaryCategories && context.allowedPrimaryCategories.length > 0) {
    const matchedCategory = context.allowedPrimaryCategories.find(
      (c) =>
        (catId && c.id === catId) ||
        (catName && c.name.toLowerCase() === catName.toLowerCase()) ||
        (c.slug && catName && c.slug.toLowerCase() === catName.toLowerCase())
    );

    if (matchedCategory) {
      catScore = 0.94;
      catValidated = true;
      catReason = `Matched active business category "${matchedCategory.name}"`;
    } else if (catId || catName) {
      catScore = 0.35;
      catValidated = false;
      catReason = `Category "${catName || catId}" is not configured in business catalog`;
    } else {
      catScore = 0.3;
      catValidated = false;
      catReason = "No matching category identified in business catalog";
    }
  } else if (catName) {
    catScore = 0.75;
    catValidated = true;
    catReason = "Categorized based on product type";
  } else {
    catScore = 0.35;
    catValidated = false;
    catReason = "Category could not be identified";
  }
  registerField("primary_category", "Primary Category", catName || catId || null, catScore, catValidated, catReason);

  // ---------------------------------------------------------------------------
  // 3. SUBCATEGORY
  // ---------------------------------------------------------------------------
  const subId = suggestion.classification?.subcategory_id;
  const subName = suggestion.classification?.subcategory_name;
  let subScore = 0.7;
  let subValidated = false;
  let subReason = "Subcategory";

  if (context?.allowedSubcategories && context.allowedSubcategories.length > 0) {
    const activeCatId = catId || (context.allowedPrimaryCategories?.find(c => c.name.toLowerCase() === (catName || "").toLowerCase())?.id);
    
    if (subId || subName) {
      const matchedSub = context.allowedSubcategories.find((s) => {
        const parentMatches = !s.parentId || !activeCatId || s.parentId === activeCatId;
        return (
          parentMatches &&
          ((subId && s.id === subId) || (subName && s.name.toLowerCase() === subName.toLowerCase()))
        );
      });

      if (matchedSub) {
        subScore = 0.92;
        subValidated = true;
        subReason = `Verified subcategory "${matchedSub.name}" under parent category`;
      } else {
        subScore = 0.35;
        subValidated = false;
        subReason = `Subcategory "${subName || subId}" does not belong to selected category`;
      }
    } else {
      // If no subcategory provided, check if primary category actually has subcategories
      const availableSubs = activeCatId
        ? context.allowedSubcategories.filter((s) => s.parentId === activeCatId)
        : [];
      if (availableSubs.length === 0) {
        subScore = 0.90;
        subValidated = true;
        subReason = "Selected category does not have subcategories";
      } else {
        subScore = 0.55;
        subValidated = false;
        subReason = "Optional subcategory not selected";
      }
    }
  } else if (subName) {
    subScore = 0.75;
    subValidated = true;
    subReason = "Subcategory inferred from product type";
  } else {
    subScore = 0.85;
    subValidated = true;
    subReason = "No subcategory required";
  }
  registerField("subcategory", "Subcategory", subName || subId || null, subScore, subValidated, subReason);

  // ---------------------------------------------------------------------------
  // 4. UNIT OF MEASURE (STOCK UNIT)
  // ---------------------------------------------------------------------------
  const stockUnit = (suggestion.uom?.stock_unit || "").toLowerCase();
  let uomScore = 0.85;
  let uomValidated = false;
  let uomReason = "Stock unit";
  const validUnits = (
    context?.allowedUomUnits && context.allowedUomUnits.length > 0
      ? context.allowedUomUnits
      : STANDARD_STOCK_UNITS
  ).map((u) => u.toLowerCase());

  if (validUnits.includes(stockUnit)) {
    uomScore = 0.93;
    uomValidated = true;
    uomReason = `Authoritative stock unit "${stockUnit}" in business catalog`;

    // Check textual contradictions (e.g. user typed 'capsule', AI returned 'tablet')
    if (rawInput.includes("capsule") && stockUnit === "tablet") {
      uomScore = 0.35;
      uomValidated = false;
      uomReason = "Conflicts with input text which specified 'capsule'";
    } else if (rawInput.includes("tablet") && stockUnit === "capsule") {
      uomScore = 0.35;
      uomValidated = false;
      uomReason = "Conflicts with input text which specified 'tablet'";
    }
  } else if (stockUnit) {
    uomScore = 0.45;
    uomValidated = false;
    uomReason = `Stock unit "${stockUnit}" is not configured in allowed inventory units`;
  } else {
    uomScore = 0.2;
    uomValidated = false;
    uomReason = "Stock unit is missing";
  }
  registerField("stock_unit", "Unit of Measure (UOM)", stockUnit, uomScore, uomValidated, uomReason);

  // ---------------------------------------------------------------------------
  // 5. PACKAGING & PACK SIZE
  // ---------------------------------------------------------------------------
  const packSize = suggestion.uom?.pack_size;
  let packScore = 0.85;
  let packValidated = true;
  let packReason = "Standard single unit";

  if (packSize && packSize > 1) {
    const packStr = String(packSize);
    const textHasCount =
      rawInput.includes(packStr) ||
      rawInput.includes(`pack of ${packStr}`) ||
      rawInput.includes(`${packStr}s`) ||
      rawInput.includes(`${packStr}ct`) ||
      rawInput.includes(`${packStr}pk`) ||
      rawInput.includes(`${packStr} tabs`) ||
      rawInput.includes(`${packStr} cap`);

    if (textHasCount) {
      packScore = 0.94;
      packValidated = true;
      packReason = `Pack size ${packSize} explicitly identified in product description`;
    } else {
      // Inferred pack size without explicit mention in input
      packScore = 0.52;
      packValidated = false;
      packReason = `Pack size (${packSize}) was inferred and not explicitly provided in product text`;
    }
  }
  registerField("pack_size", "Pack Size / Packaging", packSize || null, packScore, packValidated, packReason);

  // ---------------------------------------------------------------------------
  // 6. STRENGTH / POTENCY
  // ---------------------------------------------------------------------------
  const strength = suggestion.attributes?.strength;
  let strengthScore = 0.88;
  let strengthValidated = true;
  let strengthReason = "Standard formulation";

  if (strength) {
    const strengthMatch = rawInput.match(/(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|l|w|v|kg|iu|%))\b/i);
    const cleanCandStr = strength.replace(/\s+/g, "").toLowerCase();

    if (strengthMatch) {
      const cleanInputStr = strengthMatch[1].replace(/\s+/g, "").toLowerCase();
      if (cleanInputStr === cleanCandStr) {
        strengthScore = 0.96;
        strengthValidated = true;
        strengthReason = `Potency (${strength}) explicitly verified in input text`;
      } else {
        strengthScore = 0.35;
        strengthValidated = false;
        strengthReason = `Strength in input (${strengthMatch[1]}) conflicts with suggestion (${strength})`;
      }
    } else {
      // Inferred strength without direct mention
      strengthScore = 0.45;
      strengthValidated = false;
      strengthReason = `Potency (${strength}) was inferred and not specified in product text`;
    }
  } else {
    strengthScore = 0.88;
    strengthValidated = true;
    strengthReason = "Not applicable for this product category";
  }
  registerField("strength", "Strength / Potency", strength || null, strengthScore, strengthValidated, strengthReason);

  // ---------------------------------------------------------------------------
  // 7. BUSINESS DATA (PURCHASE COST & RETAIL PRICE)
  // Anti-invention rule: Must NEVER be fabricated by AI.
  // ---------------------------------------------------------------------------
  const userSupplied = suggestion.extracted_business_data?.user_supplied;
  const cost = suggestion.extracted_business_data?.purchase_cost;
  const price = suggestion.extracted_business_data?.retail_price;

  let pricingScore = 0.90;
  let pricingValidated = true;
  let pricingReason = "Pricing not specified";

  if (cost != null || price != null) {
    if (userSupplied || isUserOverride["pricing"]) {
      pricingScore = 0.98;
      pricingValidated = true;
      pricingReason = "User-supplied price context";

      if (cost != null && price != null && Number(cost) > Number(price)) {
        pricingScore = 0.40;
        pricingValidated = false;
        pricingReason = "Purchase cost exceeds retail price (negative profit margin)";
      }
    } else {
      // AI attempted to generate pricing without user providing it
      pricingScore = 0.30;
      pricingValidated = false;
      pricingReason = "Pricing was estimated by AI and must be manually reviewed";
    }
  }
  registerField("pricing", "Pricing & Cost", price || cost ? { cost, price } : null, pricingScore, pricingValidated, pricingReason);

  // ---------------------------------------------------------------------------
  // 8. OVERALL CONFIDENCE & STATUS RESOLUTION
  // ---------------------------------------------------------------------------
  // Weighted calculation based on core inventory attributes
  const weights: Record<string, number> = {
    product_name: 0.25,
    primary_category: 0.30,
    subcategory: 0.15,
    stock_unit: 0.20,
    pack_size: 0.05,
    strength: 0.05,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  Object.entries(weights).forEach(([key, weight]) => {
    if (scoreMap[key] !== undefined) {
      weightedSum += scoreMap[key] * weight;
      totalWeight += weight;
    }
  });

  let overallConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0.75;

  // Cap overall confidence if critical fields failed validation
  const distinctUncertain = Array.from(new Set(uncertainFields));
  const hasCriticalFailure =
    details.product_name?.confidence_level === "low" ||
    details.primary_category?.confidence_level === "low" ||
    details.stock_unit?.confidence_level === "low";

  if (hasCriticalFailure) {
    overallConfidence = Math.min(overallConfidence, 0.55);
  }

  overallConfidence = Math.round(overallConfidence * 100) / 100;
  const overallLevel = getConfidenceLevel(overallConfidence);
  const needsReview = overallConfidence < CONFIDENCE_THRESHOLDS.AUTO_REVIEW_THRESHOLD || distinctUncertain.length > 0;

  return {
    overall_confidence: overallConfidence,
    confidence_level: overallLevel,
    needs_review: needsReview,
    uncertain_fields: distinctUncertain,
    field_confidence: scoreMap,
    field_confidence_details: details,
    field_sources: sources,
    warnings: Array.from(new Set(warnings)),
  };
}

/**
 * Filter suggestions to only include high-confidence fields (>= HIGH_THRESHOLD 0.85)
 */
export function getHighConfidenceFields(
  fieldDetails: Record<string, FieldConfidenceDetail>
): Record<string, boolean> {
  const highConfidenceMap: Record<string, boolean> = {};

  Object.entries(fieldDetails).forEach(([fieldKey, detail]) => {
    if (detail.confidence_level === "high" && !detail.needs_review && detail.validated) {
      highConfidenceMap[fieldKey] = true;
    } else {
      highConfidenceMap[fieldKey] = false;
    }
  });

  return highConfidenceMap;
}
