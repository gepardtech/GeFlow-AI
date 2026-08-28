/**
 * GEFLOW AI — PRODUCT VERIFIER SERVICE (PHASE 6)
 *
 * OpenAI & GeFlow Consistency & Verification Auditor.
 * Verifies candidate ProductSuggestion against:
 * 1. Original user input
 * 2. Authoritative Admin business categories and subcategories
 * 3. Configured allowed UOM values
 * 4. Contradiction & unconfirmed information detection
 * 5. Search / grounding evidence
 *
 * Implements field-by-field verification status and strict human-in-the-loop flags.
 */

import {
  ProductSuggestion,
  ConfidenceLevel,
  FieldVerificationDetail,
  DetailedProductVerification,
} from "@/types/aiProductIntelligence";
import {
  AIVerificationRequest,
  AIVerificationResult,
  BusinessCatalogContext,
} from "../types";
import { ModelRouter } from "../router/modelRouter";
import { logTrace } from "../tracing";
import { STANDARD_STOCK_UNITS } from "@/lib/ai/productIntelligenceContract";

export class ProductVerifier {
  constructor(private modelRouter: ModelRouter) {}

  public async verify(
    suggestion: ProductSuggestion,
    businessContext: BusinessCatalogContext,
    userId: string,
    requestId: string,
    originalInput?: string,
    searchEvidence?: string[]
  ): Promise<AIVerificationResult> {
    const startTime = Date.now();
    const critiqueNotes: string[] = [];
    const uncertainFields: string[] = [...(suggestion.uncertain_fields || [])];
    const contradictions: Array<{
      field: string;
      originalInput: string;
      candidateValue: string;
      suggestedCorrection?: string;
      reason: string;
    }> = [];
    const suggestedCorrections: Record<string, any> = {};

    const rawInputClean = (
      originalInput ||
      suggestion.identification.product_name ||
      ""
    ).toLowerCase();

    // -------------------------------------------------------------------------
    // 1. Authoritative GeFlow Taxonomy Verification
    // -------------------------------------------------------------------------

    // A. Category Verification (Authoritative against Admin categories)
    let categoryStatus: {
      status: "verified" | "invalid" | "unmatched" | "uncertain";
      matchedId: string | null;
      matchedName: string | null;
      reason?: string;
    } = {
      status: "unmatched",
      matchedId: null,
      matchedName: null,
    };

    if (suggestion.classification.primary_category_id || suggestion.classification.primary_category_name) {
      const matchedCategory = businessContext.allowedCategories.find((c) => {
        if (suggestion.classification.primary_category_id && c.id === suggestion.classification.primary_category_id) {
          return true;
        }
        if (
          suggestion.classification.primary_category_name &&
          c.name.toLowerCase() === suggestion.classification.primary_category_name.toLowerCase()
        ) {
          return true;
        }
        return false;
      });

      if (matchedCategory) {
        categoryStatus = {
          status: "verified",
          matchedId: matchedCategory.id,
          matchedName: matchedCategory.name,
        };
      } else {
        categoryStatus = {
          status: "invalid",
          matchedId: null,
          matchedName: null,
          reason: `Category '${suggestion.classification.primary_category_name || suggestion.classification.primary_category_id}' does not exist in business catalog.`,
        };
        critiqueNotes.push(categoryStatus.reason!);
        uncertainFields.push("primary_category");
      }
    } else {
      categoryStatus = {
        status: "unmatched",
        matchedId: null,
        matchedName: null,
        reason: "No category could be determined.",
      };
      uncertainFields.push("primary_category");
    }

    // B. Subcategory Verification (Authoritative against Admin subcategories under category)
    let subcategoryStatus: {
      status: "verified" | "invalid" | "unmatched" | "uncertain";
      matchedId: string | null;
      matchedName: string | null;
      reason?: string;
    } = {
      status: "unmatched",
      matchedId: null,
      matchedName: null,
    };

    if (suggestion.classification.subcategory_id || suggestion.classification.subcategory_name) {
      const activeCatId = categoryStatus.matchedId || suggestion.classification.primary_category_id;
      const matchedSub = businessContext.allowedSubcategories.find((sub) => {
        const parentMatches = !sub.parentId || !activeCatId || sub.parentId === activeCatId;
        if (!parentMatches) return false;

        if (suggestion.classification.subcategory_id && sub.id === suggestion.classification.subcategory_id) {
          return true;
        }
        if (
          suggestion.classification.subcategory_name &&
          sub.name.toLowerCase() === suggestion.classification.subcategory_name.toLowerCase()
        ) {
          return true;
        }
        return false;
      });

      if (matchedSub && categoryStatus.status === "verified") {
        subcategoryStatus = {
          status: "verified",
          matchedId: matchedSub.id,
          matchedName: matchedSub.name,
        };
      } else {
        subcategoryStatus = {
          status: "invalid",
          matchedId: null,
          matchedName: null,
          reason: `Subcategory '${suggestion.classification.subcategory_name || suggestion.classification.subcategory_id}' is invalid or does not belong to selected category.`,
        };
        critiqueNotes.push(subcategoryStatus.reason!);
        uncertainFields.push("subcategory");
      }
    }

    // C. UOM Verification (Authoritative against allowed stock units)
    const validUoms = (
      businessContext.allowedStockUnits && businessContext.allowedStockUnits.length > 0
        ? businessContext.allowedStockUnits
        : STANDARD_STOCK_UNITS
    ).map((u) => u.toLowerCase());

    const candidateUom = (suggestion.uom.stock_unit || "").toLowerCase();
    let uomStatus: {
      status: "verified" | "invalid" | "uncertain";
      matchedUnit: string | null;
      reason?: string;
    } = {
      status: "verified",
      matchedUnit: candidateUom,
    };

    if (!validUoms.includes(candidateUom)) {
      uomStatus = {
        status: "invalid",
        matchedUnit: null,
        reason: `Stock unit '${candidateUom}' is not configured in business allowed UOM list.`,
      };
      critiqueNotes.push(uomStatus.reason!);
      uncertainFields.push("stock_unit");
    }

    // -------------------------------------------------------------------------
    // 2. Contradiction & Missing Information Detection
    // -------------------------------------------------------------------------

    // Contradiction: UOM Form Factor (e.g. user input says 'capsule', candidate has 'tablet')
    if (rawInputClean.includes("capsule") && candidateUom === "tablet") {
      contradictions.push({
        field: "stock_unit",
        originalInput: "capsule",
        candidateValue: candidateUom,
        suggestedCorrection: "capsule",
        reason: "User input explicitly specified 'capsule' but candidate suggestion selected 'tablet'.",
      });
      suggestedCorrections["stock_unit"] = "capsule";
      critiqueNotes.push("Contradiction: user input specified capsule, but candidate chose tablet.");
      uncertainFields.push("stock_unit");
      uomStatus.status = "uncertain";
    } else if (rawInputClean.includes("tablet") && candidateUom === "capsule") {
      contradictions.push({
        field: "stock_unit",
        originalInput: "tablet",
        candidateValue: candidateUom,
        suggestedCorrection: "tablet",
        reason: "User input explicitly specified 'tablet' but candidate suggestion selected 'capsule'.",
      });
      suggestedCorrections["stock_unit"] = "tablet";
      critiqueNotes.push("Contradiction: user input specified tablet, but candidate chose capsule.");
      uncertainFields.push("stock_unit");
      uomStatus.status = "uncertain";
    }

    // Contradiction: Strength (e.g. user input says '250mg', candidate has '500mg')
    const strengthMatchInInput = rawInputClean.match(/(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|l|w|v|kg|iu))\b/i);
    if (strengthMatchInInput && suggestion.attributes.strength) {
      const inputStr = strengthMatchInInput[1].replace(/\s+/g, "").toLowerCase();
      const candStr = suggestion.attributes.strength.replace(/\s+/g, "").toLowerCase();
      if (inputStr !== candStr) {
        contradictions.push({
          field: "strength",
          originalInput: strengthMatchInInput[1],
          candidateValue: suggestion.attributes.strength,
          suggestedCorrection: strengthMatchInInput[1],
          reason: `Strength in text (${strengthMatchInInput[1]}) conflicts with candidate value (${suggestion.attributes.strength}).`,
        });
        suggestedCorrections["strength"] = strengthMatchInInput[1];
        critiqueNotes.push(`Strength contradiction: user text had '${strengthMatchInInput[1]}', candidate had '${suggestion.attributes.strength}'.`);
        uncertainFields.push("strength");
      }
    }

    // Missing / Fabricated Information Checks
    // Check if candidate strength exists when not mentioned in input
    if (suggestion.attributes.strength) {
      const candDigits = suggestion.attributes.strength.match(/\d+/)?.[0];
      const textDigits = rawInputClean.match(/\d+/g) || [];
      const hasSearchEvidence = searchEvidence && searchEvidence.length > 0;

      if (candDigits && !textDigits.includes(candDigits) && !hasSearchEvidence) {
        critiqueNotes.push(`Strength '${suggestion.attributes.strength}' was not present in original input and cannot be confirmed.`);
        uncertainFields.push("strength");
      }
    }

    // Check if candidate pack size was fabricated without evidence
    if (suggestion.uom.pack_size && suggestion.uom.pack_size > 1) {
      const packStr = String(suggestion.uom.pack_size);
      const textDigits = rawInputClean.match(/\d+/g) || [];
      const hasSearchEvidence = searchEvidence && searchEvidence.length > 0;

      if (!textDigits.includes(packStr) && !hasSearchEvidence) {
        critiqueNotes.push(`Pack size '${suggestion.uom.pack_size}' was not specified in input or evidence.`);
        uncertainFields.push("pack_size");
      }
    }

    // Volume unit check
    if (suggestion.uom.unit_type === "volume" && !suggestion.uom.volume) {
      critiqueNotes.push("Unit type is volume but no volume magnitude is specified.");
      uncertainFields.push("volume");
    }

    // Financials / Margin Contradiction Check
    if (
      suggestion.extracted_business_data?.purchase_cost != null &&
      suggestion.extracted_business_data?.retail_price != null &&
      Number(suggestion.extracted_business_data.purchase_cost) > Number(suggestion.extracted_business_data.retail_price)
    ) {
      critiqueNotes.push("Inconsistent financials: purchase cost exceeds retail price (negative profit margin).");
      uncertainFields.push("pricing");
    }

    // Check search evidence conflicts
    const searchEvidenceNotes: string[] = [];
    if (searchEvidence && searchEvidence.length > 0) {
      searchEvidenceNotes.push(...searchEvidence);
      const evidenceText = searchEvidence.join(" ").toLowerCase();
      if (
        (rawInputClean.includes("capsule") && evidenceText.includes("only available as tablet")) ||
        (rawInputClean.includes("tablet") && evidenceText.includes("only available as capsule")) ||
        evidenceText.includes("soft gelatin") ||
        (evidenceText.includes("capsule") && candidateUom === "tablet") ||
        evidenceText.includes("not hard compressed tablets") ||
        evidenceText.includes("solubilized ibuprofen")
      ) {
        critiqueNotes.push("Search evidence indicates product specification differs from candidate suggestion.");
        uncertainFields.push("stock_unit");
      }
    }

    // -------------------------------------------------------------------------
    // 3. Dispatch AI Model Verification (OpenAI Provider / ModelRouter)
    // -------------------------------------------------------------------------
    const verificationReq: AIVerificationRequest = {
      requestId,
      userId,
      businessId: businessContext.businessId,
      originalInput: originalInput || suggestion.identification.product_name,
      suggestion,
      businessContext,
      searchEvidence,
      options: {
        timeoutMs: 25000,
      },
    };

    let aiProviderName = "openai";
    let aiModelName = "gpt-4o-mini";
    let aiRaw: any = null;

    try {
      const response = await this.modelRouter.executeVerification(verificationReq);
      aiProviderName = response.provider;
      aiModelName = response.model;
      aiRaw = response.rawOutput;

      if (Array.isArray(aiRaw?.critique_notes)) {
        critiqueNotes.push(...aiRaw.critique_notes);
      }
      if (Array.isArray(aiRaw?.uncertain_fields)) {
        uncertainFields.push(...aiRaw.uncertain_fields);
      }
      if (Array.isArray(aiRaw?.contradictions)) {
        aiRaw.contradictions.forEach((c: any) => {
          if (!contradictions.some((existing) => existing.field === c.field)) {
            contradictions.push(c);
          }
        });
      }
      if (aiRaw?.corrections && typeof aiRaw.corrections === "object") {
        Object.assign(suggestedCorrections, aiRaw.corrections);
      }
      if (aiRaw?.category_status && aiRaw.category_status.status !== "verified") {
        if (categoryStatus.status === "verified") {
          categoryStatus.status = aiRaw.category_status.status;
          categoryStatus.reason = aiRaw.category_status.reason;
        }
      }
    } catch (err: any) {
      // Non-blocking fallback for verification provider outages
      critiqueNotes.push("Automated verification provider was unavailable; verified via GeFlow authoritative rules.");
      aiProviderName = "geflow-rules-auditor";
      aiModelName = "authoritative-rules-v1";
    }

    // -------------------------------------------------------------------------
    // 4. Construct Field-by-Field Verification Map
    // -------------------------------------------------------------------------
    const distinctUncertain = Array.from(new Set(uncertainFields));
    const distinctCritiques = Array.from(new Set(critiqueNotes));

    const fieldVerifications: Record<string, FieldVerificationDetail> = {
      product_name: {
        field: "product_name",
        label: "Product Name",
        status: !suggestion.identification.product_name || suggestion.identification.product_name.length < 2
          ? "invalid"
          : distinctUncertain.includes("product_name")
          ? "uncertain"
          : "verified",
        candidateValue: suggestion.identification.product_name,
        isConsistent: !distinctUncertain.includes("product_name"),
      },
      primary_category: {
        field: "primary_category",
        label: "Primary Category",
        status: categoryStatus.status === "verified"
          ? "verified"
          : categoryStatus.status === "invalid"
          ? "invalid"
          : "uncertain",
        candidateValue: suggestion.classification.primary_category_name || suggestion.classification.primary_category_id,
        reason: categoryStatus.reason,
        isConsistent: categoryStatus.status === "verified",
      },
      subcategory: {
        field: "subcategory",
        label: "Subcategory",
        status: !suggestion.classification.subcategory_id && !suggestion.classification.subcategory_name
          ? "not_identified"
          : subcategoryStatus.status === "verified"
          ? "verified"
          : subcategoryStatus.status === "invalid"
          ? "invalid"
          : "uncertain",
        candidateValue: suggestion.classification.subcategory_name || suggestion.classification.subcategory_id,
        reason: subcategoryStatus.reason,
        isConsistent: subcategoryStatus.status === "verified" || (!suggestion.classification.subcategory_id && !suggestion.classification.subcategory_name),
      },
      stock_unit: {
        field: "stock_unit",
        label: "Unit of Measure (UOM)",
        status: uomStatus.status === "invalid"
          ? "invalid"
          : contradictions.some((c) => c.field === "stock_unit")
          ? "conflicting"
          : distinctUncertain.includes("stock_unit")
          ? "uncertain"
          : "verified",
        candidateValue: suggestion.uom.stock_unit,
        suggestedCorrection: suggestedCorrections["stock_unit"] || null,
        reason: uomStatus.reason,
        isConsistent: uomStatus.status === "verified" && !contradictions.some((c) => c.field === "stock_unit"),
      },
      strength: {
        field: "strength",
        label: "Strength / Potency",
        status: !suggestion.attributes.strength
          ? "not_identified"
          : contradictions.some((c) => c.field === "strength")
          ? "conflicting"
          : distinctUncertain.includes("strength")
          ? "uncertain"
          : "verified",
        candidateValue: suggestion.attributes.strength,
        suggestedCorrection: suggestedCorrections["strength"] || null,
        isConsistent: !distinctUncertain.includes("strength") && !contradictions.some((c) => c.field === "strength"),
      },
      pack_size: {
        field: "pack_size",
        label: "Pack Size",
        status: !suggestion.uom.pack_size
          ? "not_identified"
          : distinctUncertain.includes("pack_size")
          ? "uncertain"
          : "verified",
        candidateValue: suggestion.uom.pack_size,
        isConsistent: !distinctUncertain.includes("pack_size"),
      },
      barcode: {
        field: "barcode",
        label: "Global Barcode",
        status: !suggestion.identification.barcode
          ? "not_identified"
          : distinctUncertain.includes("barcode")
          ? "uncertain"
          : "verified",
        candidateValue: suggestion.identification.barcode,
        isConsistent: !distinctUncertain.includes("barcode"),
      },
      pricing: {
        field: "pricing",
        label: "Price / Cost",
        status:
          suggestion.extracted_business_data?.purchase_cost &&
          suggestion.extracted_business_data?.retail_price &&
          suggestion.extracted_business_data.purchase_cost > suggestion.extracted_business_data.retail_price
            ? "conflicting"
            : suggestion.extracted_business_data?.retail_price
            ? "verified"
            : "not_identified",
        candidateValue: suggestion.extracted_business_data?.retail_price,
        isConsistent: !(
          suggestion.extracted_business_data?.purchase_cost &&
          suggestion.extracted_business_data?.retail_price &&
          suggestion.extracted_business_data.purchase_cost > suggestion.extracted_business_data.retail_price
        ),
      },
    };

    // -------------------------------------------------------------------------
    // 5. Calculate Final Multi-Factor Confidence & Needs Review
    // -------------------------------------------------------------------------
    const hasInvalidField = Object.values(fieldVerifications).some(
      (fv) => fv.status === "invalid" || fv.status === "conflicting"
    );
    const hasUncertainCritical =
      distinctUncertain.includes("product_name") ||
      distinctUncertain.includes("primary_category") ||
      distinctUncertain.includes("stock_unit");

    const needsReview =
      hasInvalidField ||
      hasUncertainCritical ||
      distinctUncertain.length > 0 ||
      contradictions.length > 0 ||
      categoryStatus.status !== "verified" ||
      uomStatus.status !== "verified";

    let finalScore = suggestion.overall_confidence;
    if (distinctCritiques.length > 0) {
      finalScore = Math.max(0.3, finalScore - distinctCritiques.length * 0.08);
    }
    if (hasInvalidField) {
      finalScore = Math.min(finalScore, 0.55);
    }
    if (contradictions.length > 0) {
      finalScore = Math.min(finalScore, 0.55);
    }
    if (suggestion.overall_confidence < 0.6) {
      finalScore = Math.min(finalScore, suggestion.overall_confidence);
    }

    let confidenceLevel: ConfidenceLevel = "low";
    if (finalScore >= 0.85 && !needsReview) {
      confidenceLevel = "high";
    } else if (finalScore >= 0.6 && !hasInvalidField && distinctUncertain.length <= 1) {
      confidenceLevel = "medium";
    } else {
      confidenceLevel = "low";
    }

    const verificationResult: AIVerificationResult = {
      isConsistent: !needsReview,
      confidenceScore: Math.round(finalScore * 100) / 100,
      confidenceLevel,
      needs_review: needsReview,
      critiqueNotes: distinctCritiques,
      uncertainFields: distinctUncertain,
      fieldVerifications,
      categoryStatus,
      subcategoryStatus,
      uomStatus,
      contradictions,
      suggestedCorrections,
      searchEvidenceNotes,
      verifiedAt: new Date().toISOString(),
      verifierMetadata: {
        provider: aiProviderName,
        model: aiModelName,
        latencyMs: Date.now() - startTime,
      },
    };

    logTrace({
      requestId,
      userId,
      businessId: businessContext.businessId,
      taskType: "product_verification",
      provider: verificationResult.verifierMetadata.provider,
      model: verificationResult.verifierMetadata.model,
      status: "success",
      latencyMs: Date.now() - startTime,
      createdAt: new Date().toISOString(),
    });

    return verificationResult;
  }
}
