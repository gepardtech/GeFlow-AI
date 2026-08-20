export type CanonicalField =
  | "name"
  | "internal_sku"
  | "purchase_cost"
  | "retail_price"
  | "discount_price"
  | "stock_units"
  | "min_stock_alert"
  | "category"
  | "subcategory"
  | "uom"
  | "packaging"
  | "pack_size"
  | "strength"
  | "brand"
  | "barcode"
  | "batch_number"
  | "expiry_date"
  | "images"
  | "metadata"
  | "status"
  | "ignore";

export interface CanonicalFieldDefinition {
  key: CanonicalField;
  label: string;
  description: string;
  required?: boolean;
  type: "string" | "number" | "date" | "category" | "images" | "json" | "status";
  aliases: string[];
}

export interface SheetInfo {
  name: string;
  rowCount: number;
  dataPreview: string[][];
  relevanceScore: number;
  isRecommended: boolean;
}

export interface HeaderDetectionResult {
  headerRowIndex: number;
  headers: string[];
  confidence: number;
  candidateRows: { index: number; text: string; score: number }[];
}

export interface ColumnMapping {
  uploadedHeader: string;
  columnIndex: number;
  sampleValues: string[];
  mappedField: CanonicalField;
  confidence: number; // 0 to 100
  reason: string;
  requiresReview: boolean;
  status: "matched" | "review" | "ignored" | "conflict";
}

export type RowStatus = "ready" | "review" | "error" | "duplicate" | "skipped";

export type DuplicateAction = "skip" | "update" | "add_stock" | "keep_first";

export interface NormalizedProduct {
  id: string; // temp client-side uuid
  rowIndex: number;
  raw: Record<string, string>;
  canonical: {
    name: string;
    original_name?: string;
    internal_sku: string | null;
    description: string | null;
    category_id: string | null;
    category_name: string | null;
    subcategory_id: string | null;
    subcategory_name: string | null;
    stock_unit: string | null;
    package_type: string | null;
    pack_size: number | null;
    strength: string | null;
    brand: string | null;
    purchase_cost: number;
    retail_price: number;
    discount_price: number | null;
    stock_units: number;
    min_stock_alert: number;
    batch_number: string | null;
    expiry_date: string | null; // YYYY-MM-DD
    barcode: string | null;
    status: "active" | "draft" | "archived";
    images: string[];
    metadata_json: Record<string, any>;
  };
  ai_normalized?: boolean;
  ai_confidence?: number; // 0 to 1
  ai_confidence_level?: "high" | "medium" | "low";
  ai_field_confidence?: Record<string, any>;
  ai_suggestion?: any;
  status: RowStatus;
  errors: string[];
  warnings: string[];
  isDuplicateInFile: boolean;
  existingProductId: string | null;
  existingProductData: {
    id: string;
    name: string;
    internal_sku: string | null;
    barcode: string | null;
    stock_units: number;
    purchase_cost: number;
    retail_price: number;
    category_id: string | null;
  } | null;
  duplicateAction: DuplicateAction;
  selected: boolean;
}

export interface CategoryMatchOption {
  uploadedName: string;
  matchedId: string | null;
  matchedName: string | null;
  isNew: boolean;
  action: "map" | "create" | "unassigned";
}

export interface SubcategoryMatchOption {
  uploadedName: string;
  parentCategoryId: string | null;
  matchedId: string | null;
  matchedName: string | null;
  isNew: boolean;
  action: "map" | "create" | "unassigned";
}

export interface ImportResultSummary {
  batchId?: string;
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { rowIndex: number; name: string; error: string; raw?: Record<string, string> }[];
  durationMs: number;
  importedProductIds: string[];
}

export interface ImportHistoryRecord {
  id: string;
  businessId: string;
  fileName: string;
  fileSize: number;
  importedAt: string;
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  status: "completed" | "partial" | "failed";
}
