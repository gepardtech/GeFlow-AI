/**
 * GEFLOW AI — HEURISTIC LOCAL PARSER (FALLBACK PROVIDER)
 *
 * Provides a deterministic, offline-capable fallback adapter adhering to AIProviderInterface.
 * Activated if external AI providers fail or when operating in zero-cloud mode.
 */

import {
  AIProviderInterface,
  AIAnalysisRequest,
  AIVerificationRequest,
  AIProviderResponse,
} from "../types";
import { analyzeProductInput } from "@/lib/ai/productIntelligenceEngine";

export class HeuristicFallbackProvider implements AIProviderInterface {
  public readonly name = "heuristic_fallback" as const;
  public readonly defaultModel = "local-heuristic-v1";

  public isConfigured(): boolean {
    return true; // Always available
  }

  public async analyzeProduct(request: AIAnalysisRequest): Promise<AIProviderResponse> {
    const startTime = Date.now();
    const { businessContext, rawInput } = request;

    const categoryContext = {
      allowedPrimaryCategories: businessContext.allowedCategories,
      allowedSubcategories: businessContext.allowedSubcategories,
    };

    const suggestion = await analyzeProductInput({
      rawText: rawInput,
      categoryContext,
      currentFormState: request.currentFormState,
      businessIndustry: businessContext.industryType,
      businessCurrency: businessContext.currency,
    });

    return {
      rawOutput: suggestion,
      provider: this.name,
      model: this.defaultModel,
      latencyMs: Date.now() - startTime,
    };
  }

  public async verifyProduct(request: AIVerificationRequest): Promise<AIProviderResponse> {
    const startTime = Date.now();
    const s = request.suggestion;
    const notes: string[] = [];
    const uncertain: string[] = [];
    const contradictions: Array<{
      field: string;
      originalInput: string;
      candidateValue: string;
      suggestedCorrection?: string;
      reason: string;
    }> = [];
    const corrections: Record<string, any> = {};

    const { allowedCategories, allowedSubcategories, allowedStockUnits } = request.businessContext;
    const originalInput = (request.originalInput || s.identification.product_name || "").toLowerCase();

    // 1. Product Name verification
    let nameStatus: "verified" | "suggested" | "uncertain" | "conflicting" | "invalid" | "not_identified" = "verified";
    if (!s.identification.product_name || s.identification.product_name.trim().length < 2) {
      nameStatus = "invalid";
      notes.push("Product name is too short or empty.");
      uncertain.push("product_name");
    }

    // 2. Category Verification against Admin categories
    let catStatus: "verified" | "invalid" | "unmatched" | "uncertain" = "unmatched";
    let matchedCatId: string | null = null;
    let matchedCatName: string | null = null;

    if (s.classification.primary_category_id) {
      const match = allowedCategories.find((c) => c.id === s.classification.primary_category_id);
      if (match) {
        catStatus = "verified";
        matchedCatId = match.id;
        matchedCatName = match.name;
      } else {
        catStatus = "invalid";
        notes.push(`Category '${s.classification.primary_category_name || s.classification.primary_category_id}' does not exist in business catalog.`);
        uncertain.push("primary_category");
      }
    } else {
      catStatus = "unmatched";
      uncertain.push("primary_category");
    }

    // 3. Subcategory Verification against Admin subcategories under parent
    let subStatus: "verified" | "invalid" | "unmatched" | "uncertain" = "unmatched";
    let matchedSubId: string | null = null;
    let matchedSubName: string | null = null;

    if (s.classification.subcategory_id) {
      const subMatch = allowedSubcategories.find(
        (sub) => sub.id === s.classification.subcategory_id && (!sub.parentId || sub.parentId === s.classification.primary_category_id)
      );
      if (subMatch) {
        subStatus = "verified";
        matchedSubId = subMatch.id;
        matchedSubName = subMatch.name;
      } else {
        subStatus = "invalid";
        notes.push(`Subcategory '${s.classification.subcategory_name || s.classification.subcategory_id}' is invalid under selected category.`);
        uncertain.push("subcategory");
      }
    }

    // 4. UOM Verification against business's allowed stock units
    const validUoms = (allowedStockUnits && allowedStockUnits.length > 0)
      ? allowedStockUnits.map((u) => u.toLowerCase())
      : ["piece", "box", "bottle", "strip", "tablet", "capsule", "can", "bag", "pack", "tube", "sachet", "vial"];

    let uomStatus: "verified" | "invalid" | "uncertain" = "verified";
    const candidateUom = (s.uom.stock_unit || "").toLowerCase();

    if (!validUoms.includes(candidateUom)) {
      uomStatus = "invalid";
      notes.push(`Stock unit '${candidateUom}' is not configured in business allowed UOM list.`);
      uncertain.push("stock_unit");
    }

    // 5. Contradiction Detection
    // e.g. input contains "capsule" but candidate says "tablet"
    if (originalInput.includes("capsule") && candidateUom === "tablet") {
      contradictions.push({
        field: "stock_unit",
        originalInput: "capsule",
        candidateValue: candidateUom,
        suggestedCorrection: "capsule",
        reason: "User input specified 'capsule' but candidate suggestion specified 'tablet'.",
      });
      corrections["stock_unit"] = "capsule";
      notes.push("UOM contradiction detected: user input specified capsule, but candidate chose tablet.");
      uncertain.push("stock_unit");
      uomStatus = "uncertain";
    } else if (originalInput.includes("tablet") && candidateUom === "capsule") {
      contradictions.push({
        field: "stock_unit",
        originalInput: "tablet",
        candidateValue: candidateUom,
        suggestedCorrection: "tablet",
        reason: "User input specified 'tablet' but candidate suggestion specified 'capsule'.",
      });
      corrections["stock_unit"] = "tablet";
      notes.push("UOM contradiction detected: user input specified tablet, but candidate chose capsule.");
      uncertain.push("stock_unit");
      uomStatus = "uncertain";
    }

    // Check strength contradiction e.g. input has "250mg" but candidate has "500mg"
    const strengthMatchInInput = originalInput.match(/(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|l|w|v|kg))\b/i);
    if (strengthMatchInInput && s.attributes.strength) {
      const inputVal = strengthMatchInInput[1].replace(/\s+/g, "").toLowerCase();
      const candVal = s.attributes.strength.replace(/\s+/g, "").toLowerCase();
      if (inputVal !== candVal) {
        contradictions.push({
          field: "strength",
          originalInput: strengthMatchInInput[1],
          candidateValue: s.attributes.strength,
          suggestedCorrection: strengthMatchInInput[1],
          reason: `Strength in text (${strengthMatchInInput[1]}) contradicts candidate value (${s.attributes.strength}).`,
        });
        corrections["strength"] = strengthMatchInInput[1];
        notes.push(`Strength contradiction detected: input was '${strengthMatchInInput[1]}', candidate was '${s.attributes.strength}'.`);
        uncertain.push("strength");
      }
    }

    // 6. Missing / Fabricated Information Detection
    let strengthStatus: "verified" | "uncertain" | "conflicting" | "not_identified" = "not_identified";
    if (s.attributes.strength) {
      if (originalInput && !originalInput.includes(s.attributes.strength.toLowerCase().replace(/\s+/g, ""))) {
        // If candidate provided strength but text has no such number or string
        const numbersInText = originalInput.match(/\d+/g) || [];
        const candNumber = s.attributes.strength.match(/\d+/)?.[0];
        if (candNumber && !numbersInText.includes(candNumber)) {
          strengthStatus = "uncertain";
          notes.push(`Strength '${s.attributes.strength}' cannot be confirmed from original input.`);
          uncertain.push("strength");
        } else {
          strengthStatus = "verified";
        }
      } else {
        strengthStatus = "verified";
      }
    }

    let packSizeStatus: "verified" | "uncertain" | "not_identified" = "not_identified";
    if (s.uom.pack_size) {
      const packStr = String(s.uom.pack_size);
      if (!originalInput.includes(packStr)) {
        packSizeStatus = "uncertain";
        notes.push(`Pack size ${s.uom.pack_size} cannot be confirmed from input evidence.`);
        uncertain.push("pack_size");
      } else {
        packSizeStatus = "verified";
      }
    }

    const distinctUncertain = Array.from(new Set(uncertain));
    const needsReview = distinctUncertain.length > 0 || notes.length > 0 || catStatus !== "verified";

    const fieldVerifications: Record<string, any> = {
      product_name: {
        field: "product_name",
        status: nameStatus,
        candidateValue: s.identification.product_name,
        isConsistent: nameStatus === "verified",
      },
      primary_category: {
        field: "primary_category",
        status: catStatus,
        candidateValue: s.classification.primary_category_name || s.classification.primary_category_id,
        isConsistent: catStatus === "verified",
        reason: catStatus === "invalid" ? "Not in business catalog" : undefined,
      },
      subcategory: {
        field: "subcategory",
        status: subStatus,
        candidateValue: s.classification.subcategory_name || s.classification.subcategory_id,
        isConsistent: subStatus === "verified",
      },
      stock_unit: {
        field: "stock_unit",
        status: uomStatus,
        candidateValue: s.uom.stock_unit,
        suggestedCorrection: corrections["stock_unit"] || null,
        isConsistent: uomStatus === "verified",
      },
      strength: {
        field: "strength",
        status: strengthStatus,
        candidateValue: s.attributes.strength,
        suggestedCorrection: corrections["strength"] || null,
        isConsistent: strengthStatus === "verified",
      },
      pack_size: {
        field: "pack_size",
        status: packSizeStatus,
        candidateValue: s.uom.pack_size,
        isConsistent: packSizeStatus === "verified",
      },
    };

    return {
      rawOutput: {
        is_consistent: !needsReview,
        confidence_score: needsReview ? 0.65 : 0.92,
        needs_review: needsReview,
        critique_notes: notes,
        uncertain_fields: distinctUncertain,
        field_verifications: fieldVerifications,
        category_status: {
          status: catStatus,
          matched_id: matchedCatId,
          matched_name: matchedCatName,
        },
        subcategory_status: {
          status: subStatus,
          matched_id: matchedSubId,
          matched_name: matchedSubName,
        },
        uom_status: {
          status: uomStatus,
          matched_unit: uomStatus === "verified" ? candidateUom : null,
        },
        contradictions,
        corrections,
      },
      provider: this.name,
      model: this.defaultModel,
      latencyMs: Date.now() - startTime,
    };
  }
}
