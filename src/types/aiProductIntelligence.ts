/**
 * GEFLOW AI — PRODUCT INTELLIGENCE DATA CONTRACT (PHASE 2)
 *
 * Provider-Neutral Structured Data Contract for AI Product Intelligence.
 * Used by all future AI providers (Gemini, OpenAI, OpenRouter, Local Models)
 * to standardize product identification, classification, UOM, attributes,
 * validation, confidence scoring, and review workflows.
 *
 * NOTE: AI suggestions are NEVER directly committed to the database.
 * Workflow: User Input -> AI Analysis -> ProductSuggestion -> Validation -> User Review/Edit -> Existing Product Save
 */

/**
 * Origin tracking for each field to ensure user overrides always take absolute precedence
 */
export type FieldSource = "ai" | "user" | "verified" | "system";

export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * Phase 10 Field-Level Confidence Detail Contract
 */
export interface FieldConfidenceDetail {
  field: string;
  label?: string;
  value: any;
  confidence_score: number;
  confidence_level: ConfidenceLevel;
  needs_review: boolean;
  validated: boolean;
  source: FieldSource;
  reason?: string;
  evidence?: string;
  warnings?: string[];
  disagreement?: boolean;
}

export type ProductUnitType = "quantity" | "weight" | "volume";

/**
 * Field-level verification status for Phase 6 OpenAI verification
 */
export type FieldVerificationStatus =
  | "verified"
  | "suggested"
  | "uncertain"
  | "conflicting"
  | "invalid"
  | "not_identified";

export interface FieldVerificationDetail {
  field: string;
  label?: string;
  status: FieldVerificationStatus;
  candidateValue: any;
  suggestedCorrection?: any;
  reason?: string;
  isConsistent: boolean;
}

export interface DetailedProductVerification {
  isConsistent: boolean;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  needs_review: boolean;
  critiqueNotes: string[];
  uncertainFields: string[];
  fieldVerifications: Record<string, FieldVerificationDetail>;
  categoryStatus: {
    status: "verified" | "invalid" | "unmatched" | "uncertain";
    matchedId: string | null;
    matchedName: string | null;
    reason?: string;
  };
  subcategoryStatus: {
    status: "verified" | "invalid" | "unmatched" | "uncertain";
    matchedId: string | null;
    matchedName: string | null;
    reason?: string;
  };
  uomStatus: {
    status: "verified" | "invalid" | "uncertain";
    matchedUnit: string | null;
    reason?: string;
  };
  contradictions: Array<{
    field: string;
    originalInput: string;
    candidateValue: string;
    suggestedCorrection?: string;
    reason: string;
  }>;
  suggestedCorrections?: Record<string, any>;
  searchEvidenceNotes?: string[];
  verifiedAt: string;
  verifierMetadata: {
    provider: string;
    model: string;
    latencyMs: number;
  };
}

/**
 * Basic UOM (Unit of Measure) Contract
 * Distinguishes stock/selling unit from product weight/volume/strength.
 */
export interface UOMContract {
  /**
   * Minimum standard unit types: "quantity" (pieces, bottles, tablets), "weight" (kg, g), "volume" (L, ml)
   */
  unit_type: ProductUnitType;

  /**
   * The actual stock / selling unit (e.g., "tablet", "bottle", "box", "piece", "can", "strip", "vial", "pack")
   * Distinct from the product's internal volume/weight (e.g. 1.5L bottle -> stock_unit="bottle", volume=1.5L)
   */
  stock_unit: string;

  /**
   * Optional quantitative count if applicable
   */
  quantity?: number | null;

  /**
   * Physical weight if applicable (e.g., 500g, 1.2kg)
   */
  weight?: {
    value: number;
    unit: "kg" | "g" | "mg" | "lb" | "oz";
  } | null;

  /**
   * Liquid or fluid volume if applicable (e.g., 1.5 L, 250 ml)
   */
  volume?: {
    value: number;
    unit: "l" | "ml" | "fl_oz";
  } | null;

  /**
   * Optional pack size (e.g. 20 tablets per pack, 6 cans per pack).
   * Must NEVER be fabricated by AI. If not explicitly known or verified, must be null.
   */
  pack_size?: number | null;
}

/**
 * Product Identification Information
 */
export interface ProductIdentification {
  /**
   * Normalized / standardized product title (e.g. "Panadol Extra 500mg Tablets")
   */
  product_name: string;

  /**
   * Brand name if known/extracted (e.g., "GSK", "Coca-Cola", "Samsung"); null if unknown
   */
  brand: string | null;

  /**
   * Product nature/type (e.g., "Analgesic", "Carbonated Beverage", "Cable"); null when uncertain
   */
  product_type: string | null;

  /**
   * Clean structured marketing / POS description (optional)
   */
  description?: string | null;

  /**
   * Barcode (EAN-13, UPC-A, Code-128, etc.).
   * STRICT RULE: Must NEVER be invented or hallucinated by AI.
   * If not provided in user input or reliably scanned, MUST be null.
   */
  barcode: string | null;
}

/**
 * Business Category Classification
 * Must match authoritative Admin-managed category configurations.
 */
export interface ProductClassification {
  /**
   * Database ID of the matched primary category (if matched against active catalog)
   */
  primary_category_id: string | null;

  /**
   * Display name of the suggested primary category (e.g. "Pharmaceuticals & Healthcare")
   */
  primary_category_name: string | null;

  /**
   * Database ID of the matched subcategory (if matched against active catalog)
   */
  subcategory_id: string | null;

  /**
   * Display name of the suggested subcategory (e.g. "Pain Relief & Analgesics")
   */
  subcategory_name: string | null;

  /**
   * How the classification was matched against the catalog
   */
  matched_by: "id" | "name" | "slug" | "unmatched";
}

/**
 * Specific Structured Product Attributes
 */
export interface ProductAttributes {
  /**
   * Formulation strength if applicable (e.g. "500 mg", "10 mg/5ml")
   * Distinct from stock quantities or pack counts.
   */
  strength: string | null;

  /**
   * Physical form or packaging state (e.g., "tablet", "syrup", "capsule", "powder", "gel", "liquid", "solid")
   */
  form: string | null;

  /**
   * Controlled structured key-value attributes (e.g. { active_ingredient: "Paracetamol", prescription_required: false })
   * Strictly structured — never an uncontrolled free-text dump.
   */
  metadata: Record<string, string | number | boolean | null>;
}

/**
 * Field-level confidence scores (0.0 to 1.0)
 */
export interface FieldConfidenceScores {
  product_name?: number;
  brand?: number;
  product_type?: number;
  primary_category?: number;
  subcategory?: number;
  stock_unit?: number;
  pack_size?: number;
  strength?: number;
  form?: number;
  description?: number;
  [key: string]: number | undefined;
}

/**
 * Provider-Neutral Execution Telemetry
 * Never contains API keys, tokens, or private secrets.
 */
export interface AIMetadata {
  /**
   * Identifier of the AI provider or subsystem (e.g., "gecore-ai-engine", "gemini-3.7-flash", "openai-gpt4o", "openrouter")
   */
  provider: string;

  /**
   * Specific model version used
   */
  model: string;

  /**
   * ISO timestamp of suggestion generation
   */
  generated_at: string;

  /**
   * Unique correlation request ID for audit logging
   */
  request_id?: string;

  /**
   * Processing execution latency in milliseconds
   */
  latency_ms?: number;
}

/**
 * Explicitly User-Supplied Business Inventory Values
 * Note: AI never invents these values. They are only present if explicitly passed in user input text.
 */
export interface ExtractedUserBusinessData {
  purchase_cost?: number | null;
  retail_price?: number | null;
  stock_units?: number | null;
  min_stock_alert?: number | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  user_supplied: boolean;
}

/**
 * The Master Provider-Neutral Product Suggestion Data Contract
 */
export interface ProductSuggestion {
  /**
   * Ephemeral client UUID for tracing the suggestion session
   */
  id: string;

  /**
   * Core product naming and identification
   */
  identification: ProductIdentification;

  /**
   * Catalog categorization matched against Admin business categories
   */
  classification: ProductClassification;

  /**
   * Unit of Measure specification
   */
  uom: UOMContract;

  /**
   * Structured physical attributes and metadata
   */
  attributes: ProductAttributes;

  /**
   * User-supplied inventory context (never invented by AI)
   */
  extracted_business_data?: ExtractedUserBusinessData;

  /**
   * Overall suggestion confidence score (0.00 to 1.00)
   */
  overall_confidence: number;

  /**
   * Categorical confidence level for human review
   */
  confidence_level: ConfidenceLevel;

  /**
   * Granular confidence score per attribute
   */
  field_confidence: FieldConfidenceScores;

  /**
   * Phase 10 Field-Level Structured Confidence & Reliability Details
   */
  field_confidence_details?: Record<string, FieldConfidenceDetail>;

  /**
   * Flags whether human review is required before accepting fields
   */
  needs_review: boolean;

  /**
   * List of field names that fall below confidence thresholds or require explicit human verification
   */
  uncertain_fields: string[];

  /**
   * Human-readable diagnostic and advisory warnings
   */
  warnings: string[];

  /**
   * Telemetry and traceability details
   */
  ai_metadata: AIMetadata;

  /**
   * Origin tracking for each field to ensure user overrides always take absolute precedence
   */
  field_sources: Record<string, FieldSource>;

  /**
   * Optional Phase 6 deep verification and audit breakdown
   */
  verification?: DetailedProductVerification;
}

/**
 * Category & Subcategory Catalog Context for Validation
 */
export interface CategoryValidationContext {
  allowedPrimaryCategories: Array<{
    id: string;
    name: string;
    slug?: string;
    industry_assignments?: string[];
  }>;
  allowedSubcategories: Array<{
    id: string;
    name: string;
    parentId: string | null;
    slug?: string;
  }>;
  allowedUomUnits?: string[];
}

/**
 * Validation Diagnostics
 */
export interface ValidationError {
  field: string;
  code: string;
  message: string;
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  severity: "info" | "warning";
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  sanitizedSuggestion?: ProductSuggestion;
}
