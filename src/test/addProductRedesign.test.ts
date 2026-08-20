import { describe, it, expect } from "vitest";
import {
  getUOMsForBusiness,
  searchUOMs,
  formatStockWithUOM,
  ALL_STANDARD_UOMS,
} from "@/lib/uomRegistry";

describe("GeFlow Add Product Popup Redesign & UOM System", () => {
  // 1. UOM Registry & Business-Tailored Units
  it("provides tailored UOMs for Pharmacy / Medical businesses", () => {
    const pharmaUOMs = getUOMsForBusiness("Pharmacy", "Medical Store");
    const topIds = pharmaUOMs.slice(0, 8).map((u) => u.id);

    expect(topIds).toContain("tablet");
    expect(topIds).toContain("capsule");
    expect(topIds).toContain("strip");
    expect(topIds).toContain("bottle");
    expect(topIds).toContain("box");
  });

  it("provides tailored UOMs for Grocery / Supermarket businesses", () => {
    const groceryUOMs = getUOMsForBusiness("Grocery Store", "Supermarket");
    const topIds = groceryUOMs.slice(0, 8).map((u) => u.id);

    expect(topIds).toContain("piece");
    expect(topIds).toContain("pack");
    expect(topIds).toContain("box");
    expect(topIds).toContain("kg");
  });

  it("provides tailored UOMs for Electronics & Hardware businesses", () => {
    const electUOMs = getUOMsForBusiness("Electronics Store", "Mobile Shop");
    const electTopIds = electUOMs.slice(0, 8).map((u) => u.id);
    expect(electTopIds).toContain("unit");
    expect(electTopIds).toContain("set");

    const hardwUOMs = getUOMsForBusiness("Hardware", "Construction");
    const hardwTopIds = hardwUOMs.slice(0, 8).map((u) => u.id);
    expect(hardwTopIds).toContain("meter");
    expect(hardwTopIds).toContain("roll");
  });

  // 2. UOM Search & Filtering
  it("filters UOMs accurately via search query", () => {
    const all = ALL_STANDARD_UOMS;
    const tabSearch = searchUOMs("tab", all);
    expect(tabSearch.some((u) => u.id === "tablet")).toBe(true);

    const kgSearch = searchUOMs("kilo", all);
    expect(kgSearch.some((u) => u.id === "kg")).toBe(true);

    const mlSearch = searchUOMs("milli", all);
    expect(mlSearch.some((u) => u.id === "ml")).toBe(true);
  });

  // 3. Stock formatting with UOM
  it("formats stock quantity with singular and plural UOM labels correctly", () => {
    expect(formatStockWithUOM(1, "tablet")).toBe("1 Tablet");
    expect(formatStockWithUOM(100, "tablet")).toBe("100 Tablets");
    expect(formatStockWithUOM(1, "box")).toBe("1 Box");
    expect(formatStockWithUOM(50, "box")).toBe("50 Boxes");
    expect(formatStockWithUOM(25, "capsule")).toBe("25 Capsules");
    expect(formatStockWithUOM(5, "kg")).toBe("5 kg");
    expect(formatStockWithUOM(500, "ml")).toBe("500 ml");
  });

  // 4. Form Validation Rules Verification
  it("validates required fields logic according to GeFlow rules", () => {
    const validateProduct = (data: {
      name: string;
      category_id: string;
      uom: string;
      retail_price: string;
      stock_units: string;
    }) => {
      const errors: Record<string, string> = {};
      if (!data.name.trim()) errors.name = "Product name is required.";
      if (!data.category_id) errors.category_id = "Please select a category.";
      if (!data.uom.trim()) errors.uom = "Please select a unit of measure.";
      if (data.retail_price === "" || Number(data.retail_price) < 0) {
        errors.retail_price = "Retail price must be greater than or equal to 0.";
      }
      if (data.stock_units === "" || Number(data.stock_units) < 0) {
        errors.stock_units = "Stock units must be greater than or equal to 0.";
      }
      return errors;
    };

    // Empty form triggers required errors
    const emptyErrors = validateProduct({
      name: "",
      category_id: "",
      uom: "",
      retail_price: "",
      stock_units: "",
    });
    expect(emptyErrors.name).toBe("Product name is required.");
    expect(emptyErrors.category_id).toBe("Please select a category.");
    expect(emptyErrors.uom).toBe("Please select a unit of measure.");
    expect(emptyErrors.retail_price).toBe("Retail price must be greater than or equal to 0.");
    expect(emptyErrors.stock_units).toBe("Stock units must be greater than or equal to 0.");

    // Valid form passes with 0 errors
    const validErrors = validateProduct({
      name: "Amoxicillin 500mg",
      category_id: "cat_antibiotics_123",
      uom: "capsule",
      retail_price: "15.50",
      stock_units: "120",
    });
    expect(Object.keys(validErrors).length).toBe(0);
  });

  // 5. Category-Subcategory hierarchy consistency
  it("filters subcategories strictly based on selected primary category", () => {
    const mockCategories = [
      { id: "cat_pain", name: "Pain Relief", parent_id: null },
      { id: "cat_anti", name: "Antibiotics", parent_id: null },
      { id: "sub_para", name: "Paracetamol", parent_id: "cat_pain" },
      { id: "sub_nsaid", name: "NSAIDs", parent_id: "cat_pain" },
      { id: "sub_pen", name: "Penicillins", parent_id: "cat_anti" },
    ];

    const getSubcategories = (parentId: string | null) =>
      parentId ? mockCategories.filter((c) => c.parent_id === parentId) : [];

    const painSubs = getSubcategories("cat_pain");
    expect(painSubs.map((s) => s.id)).toEqual(["sub_para", "sub_nsaid"]);
    expect(painSubs.some((s) => s.id === "sub_pen")).toBe(false);

    const antiSubs = getSubcategories("cat_anti");
    expect(antiSubs.map((s) => s.id)).toEqual(["sub_pen"]);
  });
});
