import { ColumnMapping, NormalizedProduct, RowStatus } from "./types";
import {
  normalizeBarcode,
  normalizeDate,
  normalizeDiscount,
  normalizeImages,
  normalizePrice,
  normalizeQuantity,
} from "./normalizationEngine";

export interface CategoryLookupItem {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface ValidationPipelineOptions {
  mappings: ColumnMapping[];
  dataRows: string[][];
  headerRowIndex: number;
  existingCategories: CategoryLookupItem[];
}

export const processAndValidateRows = ({
  mappings,
  dataRows,
  headerRowIndex,
  existingCategories,
}: ValidationPipelineOptions): NormalizedProduct[] => {
  const products: NormalizedProduct[] = [];

  // Build category name lookup maps (case insensitive)
  const categoryMap = new Map<string, CategoryLookupItem>();
  const subcategoryMap = new Map<string, CategoryLookupItem[]>();

  for (const cat of existingCategories) {
    const key = cat.name.trim().toLowerCase();
    categoryMap.set(key, cat);
    if (cat.parent_id) {
      const parentSubs = subcategoryMap.get(cat.parent_id) || [];
      parentSubs.push(cat);
      subcategoryMap.set(cat.parent_id, parentSubs);
    }
  }

  // Pre-index column indices by canonical field
  const colByField = new Map<string, number>();
  const metadataCols: number[] = [];

  for (const m of mappings) {
    if (m.mappedField === "ignore") continue;
    if (m.mappedField === "metadata") {
      metadataCols.push(m.columnIndex);
    } else {
      colByField.set(m.mappedField, m.columnIndex);
    }
  }

  const nameIdx = colByField.get("name");
  const skuIdx = colByField.get("internal_sku");
  const costIdx = colByField.get("purchase_cost");
  const priceIdx = colByField.get("retail_price");
  const discIdx = colByField.get("discount_price");
  const stockIdx = colByField.get("stock_units");
  const alertIdx = colByField.get("min_stock_alert");
  const catIdx = colByField.get("category");
  const subcatIdx = colByField.get("subcategory");
  const barcodeIdx = colByField.get("barcode");
  const batchIdx = colByField.get("batch_number");
  const expiryIdx = colByField.get("expiry_date");
  const imagesIdx = colByField.get("images");
  const statusIdx = colByField.get("status");

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    // Skip rows that are completely empty
    if (!row || row.every((c) => !c || c.trim() === "")) continue;

    const actualSpreadsheetLine = headerRowIndex + 1 + r + 1;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Create raw dictionary
    const raw: Record<string, string> = {};
    mappings.forEach((m) => {
      raw[m.uploadedHeader] = row[m.columnIndex] ?? "";
    });

    // 1. Product Name (Required)
    const rawName = nameIdx !== undefined ? row[nameIdx] : "";
    const cleanName = (rawName || "").trim();
    if (!cleanName) {
      errors.push("Product Name is required");
    }

    // 2. SKU
    const rawSku = skuIdx !== undefined ? row[skuIdx] : "";
    const cleanSku = (rawSku || "").trim() || null;

    // 3. Prices
    const rawCost = costIdx !== undefined ? row[costIdx] : "";
    const costRes = normalizePrice(rawCost);
    if (!costRes.isValid) errors.push(costRes.error || "Invalid purchase price");

    const rawPrice = priceIdx !== undefined ? row[priceIdx] : "";
    const priceRes = normalizePrice(rawPrice);
    if (!priceRes.isValid) errors.push(priceRes.error || "Invalid retail price");

    // 4. Discount
    const rawDisc = discIdx !== undefined ? row[discIdx] : "";
    const discRes = normalizeDiscount(rawDisc, priceRes.value);
    if (!discRes.isValid) errors.push(discRes.error || "Invalid discount");
    if (discRes.warning) warnings.push(discRes.warning);

    // 5. Stock & Alert
    const rawStock = stockIdx !== undefined ? row[stockIdx] : "";
    const stockRes = normalizeQuantity(rawStock, 0);
    if (!stockRes.isValid) errors.push(stockRes.error || "Invalid stock units");

    const rawAlert = alertIdx !== undefined ? row[alertIdx] : "";
    const alertRes = normalizeQuantity(rawAlert, 10);
    if (!alertRes.isValid) errors.push(alertRes.error || "Invalid min stock alert");

    // 6. Barcode
    const rawBarcode = barcodeIdx !== undefined ? row[barcodeIdx] : "";
    const barcodeRes = normalizeBarcode(rawBarcode);
    if (!barcodeRes.isValid) errors.push(barcodeRes.error || "Invalid barcode format");

    // 7. Batch & Expiry
    const rawBatch = batchIdx !== undefined ? row[batchIdx] : "";
    const cleanBatch = (rawBatch || "").trim() || null;

    const rawExpiry = expiryIdx !== undefined ? row[expiryIdx] : "";
    const expiryRes = normalizeDate(rawExpiry);
    if (!expiryRes.isValid && rawExpiry.trim() !== "") {
      errors.push(expiryRes.error || "Invalid expiry date");
    }
    if (expiryRes.warning) warnings.push(expiryRes.warning);

    // 8. Images
    const rawImages = imagesIdx !== undefined ? row[imagesIdx] : "";
    const imagesRes = normalizeImages(rawImages);
    if (!imagesRes.isValid) errors.push(imagesRes.warning || "Invalid image URLs");
    if (imagesRes.warning) warnings.push(imagesRes.warning);

    // 9. Status
    const rawStatus = statusIdx !== undefined ? (row[statusIdx] || "").trim().toLowerCase() : "active";
    let finalStatus: "active" | "draft" | "archived" = "active";
    if (["active", "draft", "archived"].includes(rawStatus)) {
      finalStatus = rawStatus as any;
    }

    // 10. Category & Subcategory Resolution
    const rawCat = catIdx !== undefined ? (row[catIdx] || "").trim() : "";
    let categoryId: string | null = null;
    let categoryName: string | null = null;

    if (rawCat) {
      const match = categoryMap.get(rawCat.toLowerCase());
      if (match) {
        categoryId = match.id;
        categoryName = match.name;
      } else {
        categoryName = rawCat;
        warnings.push(`Category "${rawCat}" not found in GeFlow (will be flagged for resolution)`);
      }
    }

    const rawSubcat = subcatIdx !== undefined ? (row[subcatIdx] || "").trim() : "";
    let subcategoryId: string | null = null;
    let subcategoryName: string | null = null;

    if (rawSubcat) {
      if (categoryId) {
        const subs = subcategoryMap.get(categoryId) || [];
        const matchSub = subs.find((s) => s.name.toLowerCase() === rawSubcat.toLowerCase());
        if (matchSub) {
          subcategoryId = matchSub.id;
          subcategoryName = matchSub.name;
        } else {
          subcategoryName = rawSubcat;
          warnings.push(`Subcategory "${rawSubcat}" will be mapped or created`);
        }
      } else {
        subcategoryName = rawSubcat;
      }
    }

    // 11. MetaData / Extra JSON
    const metadata_json: Record<string, any> = {};
    for (const col of metadataCols) {
      const header = mappings.find((m) => m.columnIndex === col)?.uploadedHeader || `Col_${col}`;
      const val = row[col];
      if (val && val.trim() !== "") {
        metadata_json[header] = val.trim();
      }
    }

    // Determine initial status
    let status: RowStatus = "ready";
    if (errors.length > 0) {
      status = "error";
    } else if (warnings.length > 0 || (rawCat && !categoryId)) {
      status = "review";
    }

    products.push({
      id: crypto.randomUUID(),
      rowIndex: actualSpreadsheetLine,
      raw,
      canonical: {
        name: cleanName,
        internal_sku: cleanSku,
        description: Object.keys(metadata_json).length > 0 ? JSON.stringify(metadata_json) : null,
        category_id: categoryId,
        category_name: categoryName,
        subcategory_id: subcategoryId,
        subcategory_name: subcategoryName,
        purchase_cost: costRes.value,
        retail_price: priceRes.value,
        discount_price: discRes.value,
        stock_units: stockRes.value,
        min_stock_alert: alertRes.value,
        batch_number: cleanBatch,
        expiry_date: expiryRes.value,
        barcode: barcodeRes.value,
        status: finalStatus,
        images: imagesRes.value,
        metadata_json,
      },
      status,
      errors,
      warnings,
      isDuplicateInFile: false,
      existingProductId: null,
      existingProductData: null,
      duplicateAction: "skip",
      selected: status !== "error",
    });
  }

  return products;
};
