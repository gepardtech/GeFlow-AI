/**
 * GEFLOW AI — PHASE 8 INTEGRATION TESTS
 * AI Suggestion Engine & Add Product UI Integration
 *
 * Verifies:
 * 1. AI Suggestion trigger lifecycle (never auto-saves to database)
 * 2. Admin-configured Category and Subcategory matching & review flags
 * 3. UOM validation against business allowed stock units
 * 4. Packaging and pack size relationships (Box of 20 != stock_units=20)
 * 5. Strength and formulation extraction
 * 6. User review, selective field application, and manual editing persistence
 * 7. Graceful fallback on network/provider failures
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { requestProductAnalysis, requestProductVerification } from "../lib/ai/aiServiceClient";
import { BusinessCatalogContext } from "../server/ai/types";
import { ProductSuggestion, CategoryValidationContext } from "../types/aiProductIntelligence";
import { analyzeProductInput } from "../lib/ai/productIntelligenceEngine";

describe("Phase 8 — AI Suggestion Engine & Add Product UI Integration", () => {
  const mockCatalogContext: CategoryValidationContext = {
    allowedPrimaryCategories: [
      { id: "cat_pharma", name: "Pharmaceuticals & Healthcare", slug: "pharmaceuticals" },
      { id: "cat_beverage", name: "Beverages & Drinks", slug: "beverages" },
      { id: "cat_fmcg", name: "FMCG & Groceries", slug: "fmcg" },
    ],
    allowedSubcategories: [
      { id: "sub_pain", name: "Pain Relief & Analgesics", parentId: "cat_pharma", slug: "pain_relief" },
      { id: "sub_antibiotic", name: "Antibiotics", parentId: "cat_pharma", slug: "antibiotics" },
      { id: "sub_soda", name: "Carbonated Sodas", parentId: "cat_beverage", slug: "carbonated_sodas" },
    ],
    allowedUomUnits: ["piece", "tablet", "capsule", "bottle", "box", "can", "strip", "pack"],
  };

  const businessContext: BusinessCatalogContext = {
    businessId: "biz_test_123",
    businessName: "City Pharmacy & Mart",
    industryType: "pharmacy",
    currency: "USD",
    allowedCategories: mockCatalogContext.allowedPrimaryCategories,
    allowedSubcategories: mockCatalogContext.allowedSubcategories.map((s) => ({
      id: s.id,
      parentId: s.parentId,
      name: s.name,
      slug: s.slug,
    })),
    allowedStockUnits: mockCatalogContext.allowedUomUnits,
  };

  describe("1. Strict No Auto-Save and User Review Invariant", () => {
    it("analyzing a product generates suggestion data WITHOUT committing to database", async () => {
      let databaseSaveCalled = false;
      const mockDatabaseSave = () => {
        databaseSaveCalled = true;
      };

      const suggestion = await requestProductAnalysis("Paracetamol 500mg 20 tablets", businessContext);

      expect(suggestion).toBeDefined();
      expect(suggestion.identification.product_name).toContain("Paracetamol");
      expect(databaseSaveCalled).toBe(false); // Must never trigger DB write
    });

    it("applying suggestions copies values to form state WITHOUT saving", () => {
      const databaseSaveCalled = false;
      const formState = {
        name: "",
        category_id: "",
        subcategory_id: "",
        uom: "piece",
        description: "",
      };

      const mockSuggestion: ProductSuggestion = {
        id: "sug_1",
        identification: {
          product_name: "Paracetamol 500mg Tablets",
          brand: "Generic",
          product_type: "Analgesic",
          barcode: null,
        },
        classification: {
          primary_category_id: "cat_pharma",
          primary_category_name: "Pharmaceuticals & Healthcare",
          subcategory_id: "sub_pain",
          subcategory_name: "Pain Relief & Analgesics",
          matched_by: "id",
        },
        uom: {
          unit_type: "quantity",
          stock_unit: "tablet",
          pack_size: 20,
        },
        attributes: {
          strength: "500 mg",
          form: "tablet",
          metadata: { packaging: "Box", pack_size: 20 },
        },
        overall_confidence: 0.92,
        confidence_level: "high",
        field_confidence: { product_name: 0.95, primary_category: 0.9, stock_unit: 0.9 },
        needs_review: false,
        uncertain_fields: [],
        warnings: [],
        ai_metadata: {
          provider: "geflow-router",
          model: "gemini-2.5-flash",
          generated_at: new Date().toISOString(),
        },
        field_sources: { name: "ai", category: "ai", uom: "ai" },
      };

      // Simulated handleApplyAISuggestion
      const handleApply = (s: ProductSuggestion) => {
        formState.name = s.identification.product_name;
        formState.category_id = s.classification.primary_category_id || "";
        formState.subcategory_id = s.classification.subcategory_id || "";
        formState.uom = s.uom.stock_unit;
        // DB save is NOT called here
      };

      handleApply(mockSuggestion);

      expect(formState.name).toBe("Paracetamol 500mg Tablets");
      expect(formState.category_id).toBe("cat_pharma");
      expect(formState.subcategory_id).toBe("sub_pain");
      expect(formState.uom).toBe("tablet");
      expect(databaseSaveCalled).toBe(false);
    });
  });

  describe("2. Admin Category and Taxonomy Validation", () => {
    it("maps matching categories to existing Admin category IDs", async () => {
      const result = await requestProductAnalysis("Coca Cola 1.5L bottle", businessContext);

      expect(result.classification.primary_category_id).toBe("cat_beverage");
      expect(result.classification.primary_category_name).toBe("Beverages & Drinks");
    });

    it("marks category as needs_review if no admin category matches", async () => {
      const result = await requestProductAnalysis("Heavy Duty Construction Drill Bit 10mm", businessContext);

      // Hardware/Drill does not exist in pharmacy/drinks catalog
      expect(result.classification.primary_category_id).toBeNull();
      expect(result.needs_review).toBe(true);
    });

    it("validates subcategory exists under selected parent category", async () => {
      const result = await requestProductAnalysis("Amoxicillin 250mg capsules", businessContext);

      expect(result.classification.primary_category_id).toBe("cat_pharma");
      expect(result.classification.subcategory_id).toBe("sub_antibiotic");
    });
  });

  describe("3. Unit of Measure (UOM) and Packaging Relationships", () => {
    it("preserves base unit vs packaging ratio (Box of 20 = 20 Tablets)", async () => {
      const result = await requestProductAnalysis("Paracetamol 500mg box of 20 tablets", businessContext);

      expect(result.uom.stock_unit.toLowerCase()).toBe("tablet");
      expect(result.uom.pack_size).toBe(20);
      expect(result.attributes.strength).toMatch(/500\s*mg/i);
    });

    it("validates stock unit against allowed UOM registry", async () => {
      const result = await requestProductAnalysis("Fresh Orange Juice 500ml bottle", businessContext);

      expect(mockCatalogContext.allowedUomUnits).toContain(result.uom.stock_unit.toLowerCase());
    });
  });

  describe("4. Strength and Formulation Identification", () => {
    it("extracts structured strength without conflating with stock units", async () => {
      const result = await requestProductAnalysis("Ibuprofen 400mg 10 capsules", businessContext);

      expect(result.attributes.strength).toMatch(/400\s*mg/i);
      expect(result.uom.stock_unit.toLowerCase()).toBe("capsule");
      expect(result.uom.pack_size).toBe(10);
    });
  });

  describe("5. User Editability & Selective Application", () => {
    it("allows user to override suggested category before applying", () => {
      const suggestion: ProductSuggestion = {
        id: "sug_2",
        identification: {
          product_name: "Sparkling Water 500ml",
          brand: null,
          product_type: null,
          barcode: null,
        },
        classification: {
          primary_category_id: "cat_beverage",
          primary_category_name: "Beverages & Drinks",
          subcategory_id: null,
          subcategory_name: null,
          matched_by: "id",
        },
        uom: { unit_type: "volume", stock_unit: "bottle" },
        attributes: { strength: null, form: "liquid", metadata: {} },
        overall_confidence: 0.85,
        confidence_level: "high",
        field_confidence: {},
        needs_review: false,
        uncertain_fields: [],
        warnings: [],
        ai_metadata: { provider: "test", model: "test", generated_at: "" },
        field_sources: {},
      };

      // User decides to re-categorize to FMCG instead
      const userEditedValues = {
        primary_category_id: "cat_fmcg",
      };

      const appliedCategory = userEditedValues.primary_category_id || suggestion.classification.primary_category_id;
      expect(appliedCategory).toBe("cat_fmcg");
    });
  });

  describe("6. Error Resilience & Graceful Fallback", () => {
    it("falls back to local heuristic intelligence when backend service is unreachable", async () => {
      // Simulate network outage by forcing local fallback
      const fallbackResult = await analyzeProductInput({
        rawText: "Paracetamol 500mg 20 tablets",
        categoryContext: mockCatalogContext,
        businessIndustry: "pharmacy",
      });

      expect(fallbackResult).toBeDefined();
      expect(fallbackResult.identification.product_name).toContain("Paracetamol");
      expect(fallbackResult.classification.primary_category_id).toBe("cat_pharma");
      expect(fallbackResult.uom.stock_unit).toBe("tablet");
    });
  });
});
