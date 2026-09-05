import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMoney } from "@/lib/currency";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { useProductCategories } from "@/hooks/useProductCategories";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import {
  Loader2,
  PackagePlus,
  Camera,
  X,
  Zap,
  Sparkles,
  Barcode,
  Layers,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Tag,
  Boxes,
  FileText,
  ShieldCheck,
  Percent,
} from "lucide-react";
import { AIProductIntelligenceAssistant, AIProductIntelligenceAssistantRef } from "./AIProductIntelligenceAssistant";
import { ProductSuggestion, FieldConfidenceDetail, ConfidenceLevel, FieldSource } from "@/types/aiProductIntelligence";
import { UOMSelect } from "./UOMSelect";
import { AIFieldStatusBadge, AIFieldStatus } from "./AIFieldStatusBadge";
import { formatStockWithUOM, formatUomPlural, getDefaultBaseUnit } from "@/lib/uomRegistry";

export interface FieldAIStatusInfo {
  status?: AIFieldStatus;
  confidenceLevel?: ConfidenceLevel;
  confidenceScore?: number;
  source?: FieldSource;
  reason?: string;
  detail?: FieldConfidenceDetail;
  suggested?: any;
}

export interface ProductRecord {
  id: string;
  name: string;
  internal_sku: string | null;
  description: string | null;
  category_id: string | null;
  subcategory_id?: string | null;
  purchase_cost: number;
  retail_price: number;
  discount_price: number | null;
  stock_units: number;
  min_stock_alert: number;
  batch_number: string | null;
  expiry_date: string | null;
  barcode: string | null;
  status: string;
  images?: string[] | null;
  uom?: string | null;
  units_per_uom?: number | null;
  base_unit?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  businessId: string;
  ownerUserId: string;
  product?: ProductRecord | null;
  /** Prefill values from a barcode scan / lookup. */
  prefill?: Partial<Record<string, string>> | null;
  onSaved: () => void;
}

const emptyForm = {
  name: "",
  internal_sku: "",
  description: "",
  category_id: "",
  subcategory_id: "",
  uom: "box",
  units_per_uom: "12",
  base_unit: "tablet",
  opening_stock_boxes: "0",
  // Compatibility mirror fields
  measurement_scale: "12",
  pack_qty: "0",
  stock_units: "0",
  purchase_cost: "",
  retail_price: "",
  discount_price: "",
  min_stock_alert: "5",
  batch_number: "",
  expiry_date: "",
  barcode: "",
  status: "active",
};

interface FormErrors {
  name?: string;
  category_id?: string;
  uom?: string;
  retail_price?: string;
  stock_units?: string;
  purchase_cost?: string;
  discount_price?: string;
}

const MAX_IMAGES = 7;

/**
 * Section Header Component with visual step indicator
 */
const SectionHeader: React.FC<{
  number: number;
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
}> = ({ number, title, description, icon: Icon, badge }) => (
  <div className="flex items-start justify-between gap-2 pb-2 mb-3 border-b border-border/70">
    <div className="flex items-center gap-2.5">
      <div className="h-6 w-6 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold text-xs flex items-center justify-center shrink-0">
        {number}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-sky-500 shrink-0" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            {title}
          </h3>
        </div>
        {description && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </div>
    {badge}
  </div>
);

const FieldLabel: React.FC<{
  children: React.ReactNode;
  required?: boolean;
  aiInfo?: FieldAIStatusInfo;
  aiStatus?: AIFieldStatus;
  suggestedValue?: string | number | null;
  onApplySuggestion?: (val: any) => void;
  htmlFor?: string;
}> = ({ children, required, aiInfo, aiStatus, suggestedValue, onApplySuggestion, htmlFor }) => (
  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
    <label
      htmlFor={htmlFor}
      className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1 cursor-pointer"
    >
      {children}
      {required && <span className="text-destructive font-black">*</span>}
    </label>
    {(aiInfo || (aiStatus && aiStatus !== "none")) && (
      <AIFieldStatusBadge
        status={aiInfo?.status || aiStatus}
        confidenceLevel={aiInfo?.confidenceLevel}
        confidenceScore={aiInfo?.confidenceScore}
        source={aiInfo?.source}
        detail={aiInfo?.detail}
        reason={aiInfo?.reason}
        suggestedValue={aiInfo?.suggested ?? suggestedValue}
        onApplySuggestion={onApplySuggestion}
      />
    )}
  </div>
);

const ProductDialog = ({
  open,
  onOpenChange,
  businessId,
  ownerUserId,
  product,
  prefill,
  onSaved,
}: Props) => {
  const { toast } = useToast();
  const { symbol } = useMoney();
  const { industryType, categoryName, enabledFeatures, categorySettings } = useActiveBusiness();
  const { getLimit, isExceeded } = usePlanLimits();
  const { parents, subcategoriesOf, all, loading: categoriesLoading } = useProductCategories(
    industryType,
    categoryName
  );

  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const aiAssistantRef = useRef<AIProductIntelligenceAssistantRef>(null);

  // Field-level AI status & confidence detail state (Phase 10)
  const [fieldAIStatuses, setFieldAIStatuses] = useState<Record<string, FieldAIStatusInfo>>({});

  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!product;

  // Default min stock alert based on category settings if available
  const defaultMinAlert = useMemo(() => {
    return categorySettings?.stock_alert_limit ? String(categorySettings.stock_alert_limit) : "10";
  }, [categorySettings]);

  // Extract UOM, Scale, Base Unit, and Pack Qty if stored in description
  const extractUOMFromDescription = (desc: string | null): { cleanDesc: string; uom: string | null; scale: string | null; packQty: string | null; baseUnitTag: string | null } => {
    if (!desc) return { cleanDesc: "", uom: null, scale: null, packQty: null, baseUnitTag: null };
    let cleanDesc = desc;
    let uom: string | null = null;
    let scale: string | null = null;
    let packQty: string | null = null;
    let baseUnitTag: string | null = null;

    const uomMatch = cleanDesc.match(/\[UOM:\s*([^\]]+)\]/i);
    if (uomMatch && uomMatch[1]) {
      uom = uomMatch[1].trim();
      cleanDesc = cleanDesc.replace(/\[UOM:\s*[^\]]+\]/i, "").trim();
    }

    const scaleMatch = cleanDesc.match(/\[(?:SCALE|PACK_SIZE|UNITS_PER_UOM):\s*([^\]]+)\]/i);
    if (scaleMatch && scaleMatch[1]) {
      scale = scaleMatch[1].trim();
      cleanDesc = cleanDesc.replace(/\[(?:SCALE|PACK_SIZE|UNITS_PER_UOM):\s*([^\]]+)\]/i, "").trim();
    }

    const baseUnitMatch = cleanDesc.match(/\[BASE_UNIT:\s*([^\]]+)\]/i);
    if (baseUnitMatch && baseUnitMatch[1]) {
      baseUnitTag = baseUnitMatch[1].trim();
      cleanDesc = cleanDesc.replace(/\[BASE_UNIT:\s*[^\]]+\]/i, "").trim();
    }

    const packQtyMatch = cleanDesc.match(/\[PACK_QTY:\s*([^\]]+)\]/i);
    if (packQtyMatch && packQtyMatch[1]) {
      packQty = packQtyMatch[1].trim();
      cleanDesc = cleanDesc.replace(/\[PACK_QTY:\s*[^\]]+\]/i, "").trim();
    }

    cleanDesc = cleanDesc.replace(/\[BASE_QTY:\s*[^\]]+\]/i, "").trim();

    return { cleanDesc, uom, scale, packQty, baseUnitTag };
  };

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setTouched({});
    setFieldAIStatuses({});

    if (product) {
      const { cleanDesc, uom, scale, packQty, baseUnitTag } = extractUOMFromDescription(product.description);
      const rawStock = product.stock_units !== null && product.stock_units !== undefined ? Number(product.stock_units) : 0;
      
      const resolvedUom = (product.uom || uom || "box").toLowerCase();
      const resolvedUnitsPerUom = product.units_per_uom !== null && product.units_per_uom !== undefined && Number(product.units_per_uom) > 0
        ? Number(product.units_per_uom)
        : (Number(scale) || (resolvedUom === "box" ? 12 : resolvedUom === "strip" ? 10 : 1));
      const resolvedBaseUnit = (product.base_unit || baseUnitTag || getDefaultBaseUnit(resolvedUom, industryType)).toLowerCase();

      // Determine initial opening stock in Boxes
      // In the new architecture, stock_units is stored in base units (e.g. 120 tablets).
      // So opening stock in boxes = rawStock / resolvedUnitsPerUom (120 / 12 = 10 boxes).
      // If legacy product where stock_units was saved as boxes (e.g. stock_units == packQty), use packQty.
      let initialBoxes = 0;
      const packQtyMatch = (product.description || "").match(/\[PACK_QTY:\s*([0-9.]+)\]/i);
      if (packQtyMatch && Math.abs(Number(packQtyMatch[1]) - rawStock) < 0.001) {
        initialBoxes = Number(packQtyMatch[1]);
      } else if (resolvedUnitsPerUom > 1) {
        initialBoxes = +(rawStock / resolvedUnitsPerUom).toFixed(2);
      } else {
        initialBoxes = rawStock;
      }

      setForm({
        name: product.name ?? "",
        internal_sku: product.internal_sku ?? "",
        description: cleanDesc,
        category_id: product.category_id ?? "",
        subcategory_id: product.subcategory_id ?? "",
        uom: resolvedUom,
        units_per_uom: String(resolvedUnitsPerUom),
        base_unit: resolvedBaseUnit,
        opening_stock_boxes: String(initialBoxes),
        measurement_scale: String(resolvedUnitsPerUom),
        pack_qty: String(initialBoxes),
        stock_units: String(rawStock),
        purchase_cost: product.purchase_cost !== null && product.purchase_cost !== undefined ? String(product.purchase_cost) : "",
        retail_price: product.retail_price !== null && product.retail_price !== undefined ? String(product.retail_price) : "",
        discount_price: product.discount_price != null ? String(product.discount_price) : "",
        min_stock_alert: String(product.min_stock_alert ?? defaultMinAlert),
        batch_number: product.batch_number ?? "",
        expiry_date: product.expiry_date ?? "",
        barcode: product.barcode ?? "",
        status: product.status ?? "active",
      });
      setImages(product.images ?? []);
    } else {
      setForm({
        ...emptyForm,
        min_stock_alert: defaultMinAlert,
        units_per_uom: "12",
        measurement_scale: "12",
        opening_stock_boxes: "0",
        pack_qty: "0",
        stock_units: "0",
        ...(prefill ?? {}),
      });
      setImages([]);
    }
  }, [open, product, prefill, defaultMinAlert, industryType]);

  const set = (k: keyof typeof emptyForm, v: string) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      // When primary category changes, reset subcategory
      if (k === "category_id") {
        next.subcategory_id = "";
      }
      return next;
    });

    // Clear AI indicator when user manually alters a field
    if (fieldAIStatuses[k]) {
      setFieldAIStatuses((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }

    // Clear error for field if valid
    if (errors[k as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [k]: undefined }));
    }
  };

  const generateAutoSku = (nameInput?: string) => {
    const cleanName = (nameInput || form.name || "PRD").replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "SKU";
    const randNum = Math.floor(100000 + Math.random() * 900000);
    const sku = `${cleanName}-${randNum}`;
    set("internal_sku", sku);
    return sku;
  };

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // Feature gating: only show fields the admin enabled for this business category.
  const feat = (id: string) => !enabledFeatures || enabledFeatures.includes(id);
  const selectedParent = all.find((c) => c.id === form.category_id) ?? null;
  const catAllows = (flag: keyof NonNullable<typeof selectedParent>) =>
    !selectedParent || (selectedParent as any)[flag];

  const showDiscount = feat("discount");
  const showAlert = feat("lowstock");
  const showBatch = feat("batch") && catAllows("inherit_batch");
  const showExpiry = feat("expiry") && catAllows("inherit_expiry");
  const showBarcode = feat("barcode") && catAllows("inherit_barcode");

  const subs = useMemo(() => subcategoriesOf(form.category_id || null), [
    form.category_id,
    subcategoriesOf,
  ]);

  const selectedSubcategory = useMemo(() => {
    return all.find((c) => c.id === form.subcategory_id) ?? null;
  }, [all, form.subcategory_id]);

  const categoryContext = useMemo(() => {
    return {
      allowedPrimaryCategories: parents.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug || p.name.toLowerCase().replace(/\s+/g, "_"),
      })),
      allowedSubcategories: all
        .filter((c) => !!c.parent_id)
        .map((s) => ({
          id: s.id,
          parentId: s.parent_id || undefined,
          name: s.name,
          slug: s.slug || s.name.toLowerCase().replace(/\s+/g, "_"),
        })),
    };
  }, [parents, all]);

  // AI Suggestion Handler (prepares UI without directly persisting)
  const handleApplyAISuggestion = (
    s: ProductSuggestion,
    appliedFields: Record<string, boolean> = {
      product_name: true,
      category: true,
      subcategory: true,
      uom: true,
      packaging: true,
      strength: true,
      pricing: false,
    }
  ) => {
    setForm((prev) => {
      const next = { ...prev };
      if (appliedFields.product_name && s.identification?.product_name) {
        next.name = s.identification.product_name;
      }
      if (s.identification?.description) {
        next.description = s.identification.description;
      } else if (appliedFields.strength || appliedFields.packaging) {
        const specParts: string[] = [];
        if (appliedFields.strength && s.attributes?.strength) {
          specParts.push(`Strength: ${s.attributes.strength}`);
        }
        if (appliedFields.packaging && s.attributes?.metadata?.packaging_type) {
          const pkg = s.attributes.metadata.packaging_type;
          const units = s.attributes.metadata.pack_size || s.uom?.pack_size;
          specParts.push(`Packaging: ${pkg}${units ? ` (${units}s)` : ""}`);
        }
        if (specParts.length > 0) {
          if (!next.description) {
            next.description = specParts.join(" • ");
          } else if (!next.description.includes(specParts[0])) {
            next.description = `${next.description}\n${specParts.join(" • ")}`;
          }
        }
      }
      if (appliedFields.category && s.classification?.primary_category_id) {
        next.category_id = s.classification.primary_category_id;
      }
      if (appliedFields.subcategory && s.classification?.subcategory_id) {
        next.subcategory_id = s.classification.subcategory_id;
      }
      if (appliedFields.uom && s.uom?.stock_unit) {
        next.uom = s.uom.stock_unit.toLowerCase();
        next.base_unit = s.uom.base_unit || getDefaultBaseUnit(next.uom, industryType);
      }
      if (s.uom?.pack_size && s.uom.pack_size > 0) {
        next.units_per_uom = String(s.uom.pack_size);
        next.measurement_scale = String(s.uom.pack_size);
      }
      if (s.identification?.barcode) {
        next.barcode = s.identification.barcode;
      }
      if (
        appliedFields.pricing &&
        s.extracted_business_data?.purchase_cost !== null &&
        s.extracted_business_data?.purchase_cost !== undefined
      ) {
        next.purchase_cost = String(s.extracted_business_data.purchase_cost);
      }
      if (
        appliedFields.pricing &&
        s.extracted_business_data?.retail_price !== null &&
        s.extracted_business_data?.retail_price !== undefined
      ) {
        next.retail_price = String(s.extracted_business_data.retail_price);
      }
      if (
        s.extracted_business_data?.stock_units !== null &&
        s.extracted_business_data?.stock_units !== undefined
      ) {
        const uomUnits = Number(next.units_per_uom) || 1;
        const boxes = String(s.extracted_business_data.stock_units);
        next.opening_stock_boxes = boxes;
        next.pack_qty = boxes;
        next.stock_units = String(Math.round(Number(boxes) * uomUnits));
      }
      if (s.extracted_business_data?.min_stock_alert !== null && s.extracted_business_data?.min_stock_alert !== undefined) {
        next.min_stock_alert = String(s.extracted_business_data.min_stock_alert);
      }
      return next;
    });

    // Set field AI status and confidence indicators (Phase 10)
    const confDetails = s.field_confidence_details || {};
    const newStatuses: Record<string, FieldAIStatusInfo> = {};

    if (appliedFields.product_name && s.identification?.product_name) {
      const d = confDetails["product_name"];
      newStatuses.name = {
        detail: d,
        confidenceLevel: d?.confidence_level || (s.overall_confidence >= 0.85 ? "high" : "medium"),
        confidenceScore: d?.confidence_score ?? s.overall_confidence,
        source: d?.source || "ai",
        reason: d?.reason,
      };
    }
    if (s.identification?.description || s.attributes?.strength || s.attributes?.metadata?.packaging_type) {
      const d = confDetails["description"] || confDetails["strength"];
      newStatuses.description = {
        detail: d,
        confidenceLevel: d?.confidence_level || "high",
        confidenceScore: d?.confidence_score ?? 0.88,
        source: d?.source || "ai",
        reason: d?.reason || "Formulated from product specifications and packaging analysis",
      };
    }
    if (appliedFields.category && s.classification?.primary_category_id) {
      const d = confDetails["primary_category"];
      newStatuses.category_id = {
        detail: d,
        confidenceLevel: d?.confidence_level || "high",
        confidenceScore: d?.confidence_score ?? 0.9,
        source: d?.source || "ai",
        reason: d?.reason,
      };
    }
    if (appliedFields.subcategory && s.classification?.subcategory_id) {
      const d = confDetails["subcategory"];
      newStatuses.subcategory_id = {
        detail: d,
        confidenceLevel: d?.confidence_level || "high",
        confidenceScore: d?.confidence_score ?? 0.85,
        source: d?.source || "ai",
        reason: d?.reason,
      };
    }
    if (appliedFields.uom && s.uom?.stock_unit) {
      const d = confDetails["stock_unit"];
      newStatuses.uom = {
        detail: d,
        confidenceLevel: d?.confidence_level || "high",
        confidenceScore: d?.confidence_score ?? 0.9,
        source: d?.source || "ai",
        reason: d?.reason,
      };
    }
    if (appliedFields.pricing && s.extracted_business_data?.retail_price) {
      const d = confDetails["retail_price"];
      newStatuses.retail_price = {
        detail: d,
        confidenceLevel: d?.confidence_level || "medium",
        confidenceScore: d?.confidence_score ?? 0.7,
        source: d?.source || "user",
        reason: d?.reason || "Extracted from explicit user query text",
      };
    }
    if (appliedFields.pricing && s.extracted_business_data?.purchase_cost) {
      const d = confDetails["purchase_cost"];
      newStatuses.purchase_cost = {
        detail: d,
        confidenceLevel: d?.confidence_level || "medium",
        confidenceScore: d?.confidence_score ?? 0.7,
        source: d?.source || "user",
        reason: d?.reason || "Extracted from explicit user query text",
      };
    }

    setFieldAIStatuses(newStatuses);

    toast({
      title: "✨ AI Suggestions Applied",
      description: `Suggestions for "${s.identification.product_name}" populated into form. Review and edit before saving.`,
    });
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      toast({ title: "Max 7 images allowed", variant: "destructive" });
      return;
    }
    setUploading(true);
    const next: string[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      const path = `${ownerUserId}/${businessId}/${crypto.randomUUID()}-${file.name.replace(
        /[^\w.-]/g,
        "_"
      )}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
        continue;
      }
      const { data: signed } = await supabase.storage
        .from("product-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) next.push(signed.signedUrl);
    }
    setImages((prev) => [...prev, ...next]);
    setUploading(false);
  };

  // Validate entire form before saving
  const validateForm = (): boolean => {
    const errs: FormErrors = {};

    if (!form.name.trim()) {
      errs.name = "Product name is required.";
    }

    if (!form.category_id) {
      errs.category_id = "Please select a category.";
    }

    if (!form.uom.trim()) {
      errs.uom = "Please select a unit of measure.";
    }

    if (form.retail_price === "" || isNaN(Number(form.retail_price))) {
      errs.retail_price = "Retail price must be greater than or equal to 0.";
    } else if (Number(form.retail_price) < 0) {
      errs.retail_price = "Retail price must be greater than or equal to 0.";
    }

    const effectiveStock = form.opening_stock_boxes !== "" ? form.opening_stock_boxes : (form.pack_qty !== "" ? form.pack_qty : form.stock_units);
    if (effectiveStock === "" || isNaN(Number(effectiveStock))) {
      errs.stock_units = "Opening stock must be greater than or equal to 0.";
    } else if (Number(effectiveStock) < 0) {
      errs.stock_units = "Opening stock cannot be negative.";
    }

    if (form.purchase_cost !== "" && Number(form.purchase_cost) < 0) {
      errs.purchase_cost = "Purchase cost must be greater than or equal to 0.";
    }

    if (form.discount_price !== "" && Number(form.discount_price) < 0) {
      errs.discount_price = "Discount price cannot be negative.";
    }

    setErrors(errs);
    setTouched({
      name: true,
      category_id: true,
      uom: true,
      retail_price: true,
      stock_units: true,
      purchase_cost: true,
      discount_price: true,
    });

    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast({
        title: "Validation errors detected",
        description: "Please review and complete the highlighted required fields.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    if (!isEdit) {
      // Check real-time product limit
      const { count } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId);

      const currentCount = count ?? 0;
      if (isExceeded("products", currentCount)) {
        const pLimit = getLimit("products");
        setSaving(false);
        toast({
          title: "Product limit exceeded",
          description: `Your current plan limit of ${pLimit} products has been reached. Please upgrade your plan to add more products.`,
          variant: "destructive",
        });
        return;
      }
    }

    // stock_units is ALWAYS stored in Base Unit (smallest unit e.g. tablets, pieces, ml)
    const openingBoxes = Number(form.opening_stock_boxes !== "" ? form.opening_stock_boxes : (form.pack_qty !== "" ? form.pack_qty : form.stock_units)) || 0;
    const unitsPerUom = Math.max(1, Number(form.units_per_uom || form.measurement_scale) || 1);
    const totalBaseUnits = Math.round(openingBoxes * unitsPerUom);
    const resolvedUom = (form.uom || "box").toLowerCase().trim();
    const resolvedBaseUnit = (form.base_unit || getDefaultBaseUnit(resolvedUom, industryType)).toLowerCase().trim();

    // Format description with UOM metadata tags as backward-compatible fallback
    let finalDescription = form.description.trim();
    const tags: string[] = [];
    if (resolvedUom) tags.push(`[UOM: ${resolvedUom}]`);
    if (unitsPerUom > 1) {
      tags.push(`[SCALE: ${unitsPerUom}]`);
      tags.push(`[UNITS_PER_UOM: ${unitsPerUom}]`);
    }
    tags.push(`[BASE_UNIT: ${resolvedBaseUnit}]`);
    tags.push(`[PACK_QTY: ${openingBoxes}]`);
    tags.push(`[BASE_QTY: ${totalBaseUnits}]`);

    if (tags.length > 0) {
      finalDescription = finalDescription
        ? `${finalDescription}\n${tags.join(" ")}`
        : tags.join(" ");
    }

    const finalSku = form.internal_sku.trim() || generateAutoSku(form.name);

    const payloadWithColumns: Record<string, any> = {
      business_id: businessId,
      owner_user_id: ownerUserId,
      name: form.name.trim(),
      internal_sku: finalSku,
      description: finalDescription || null,
      category_id: form.category_id || null,
      subcategory_id: form.subcategory_id || null,
      purchase_cost: Number(form.purchase_cost) || 0,
      retail_price: Number(form.retail_price) || 0,
      discount_price: form.discount_price ? Number(form.discount_price) : null,
      stock_units: totalBaseUnits, // ALWAYS in Base Unit (e.g. 120 tablets for 10 boxes of 12)
      uom: resolvedUom,
      units_per_uom: unitsPerUom,
      base_unit: resolvedBaseUnit,
      min_stock_alert: parseInt(form.min_stock_alert, 10) || 5,
      batch_number: form.batch_number.trim() || null,
      expiry_date: form.expiry_date || null,
      barcode: form.barcode.trim() || null,
      status: form.status || "active",
      images,
    };

    let error: any = null;
    if (isEdit && product) {
      const res = await supabase.from("products").update(payloadWithColumns).eq("id", product.id);
      error = res.error;
    } else {
      const res = await supabase.from("products").insert(payloadWithColumns);
      error = res.error;
    }

    // Resilient fallback if the new columns (uom, units_per_uom, base_unit) have not yet been migrated in Supabase (Postgres 42703)
    if (error && (error.code === "42703" || String(error.message).toLowerCase().includes("column"))) {
      console.warn("Retrying save without new column properties (tags preserved in description):", error.message);
      const legacyPayload = {
        business_id: businessId,
        owner_user_id: ownerUserId,
        name: form.name.trim(),
        internal_sku: finalSku,
        description: finalDescription || null,
        category_id: form.category_id || null,
        subcategory_id: form.subcategory_id || null,
        purchase_cost: Number(form.purchase_cost) || 0,
        retail_price: Number(form.retail_price) || 0,
        discount_price: form.discount_price ? Number(form.discount_price) : null,
        stock_units: totalBaseUnits, // ALWAYS in Base Units!
        min_stock_alert: parseInt(form.min_stock_alert, 10) || 5,
        batch_number: form.batch_number.trim() || null,
        expiry_date: form.expiry_date || null,
        barcode: form.barcode.trim() || null,
        status: form.status || "active",
        images,
      };
      if (isEdit && product) {
        const res = await supabase.from("products").update(legacyPayload).eq("id", product.id);
        error = res.error;
      } else {
        const res = await supabase.from("products").insert(legacyPayload);
        error = res.error;
      }
    }

    setSaving(false);

    if (error) {
      toast({
        title: "Could not save product",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Synchronize listed_products count to businesses and profiles
    try {
      const { count: bCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId);
      if (bCount !== null && bCount !== undefined) {
        await supabase.from("businesses").update({ listed_products: bCount }).eq("id", businessId);
      }
      const targetUserId = ownerUserId;
      if (targetUserId) {
        const { count: uCount } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("owner_user_id", targetUserId);
        if (uCount !== null && uCount !== undefined) {
          await supabase.from("profiles").update({ listed_products: uCount }).eq("user_id", targetUserId);
        }
      }
    } catch (syncErr) {
      console.warn("Product count sync notice:", syncErr);
    }

    toast({
      title: isEdit ? "Product SKU updated" : "Product SKU saved successfully",
      description: `${form.name} (${formatStockWithUOM(form.stock_units, form.uom)}) committed to catalog.`,
    });

    onSaved();
    onOpenChange(false);
  };

  // Calculations for Final Review
  const calculatedMargin = useMemo(() => {
    const cost = Number(form.purchase_cost) || 0;
    const retail = Number(form.retail_price) || 0;
    if (retail <= 0) return 0;
    return Math.round(((retail - cost) / retail) * 100);
  }, [form.purchase_cost, form.retail_price]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:w-full max-w-3xl max-h-[92vh] sm:max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col bg-background text-foreground border-border shadow-2xl rounded-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-card/60 shrink-0 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <PackagePlus className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold tracking-tight truncate">
                  {isEdit ? "Edit Product SKU" : "Register Product SKU"}
                </h2>
                <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
                  {industryType || categoryName || "Standard Catalog"}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-none">
                Structured product entry with category hierarchy, UOM controls, and AI readiness.
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto px-3.5 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-6 flex-1">
          {/* SECTION 6 (Optional Top Placement): AI Product Intelligence */}
          <div className="rounded-xl sm:rounded-2xl border border-sky-500/30 bg-sky-500/5 p-3 sm:p-3.5 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] sm:text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                      AI Product Intelligence
                    </span>
                    <span className="text-[8px] sm:text-[9px] px-1.5 py-0.2 rounded font-medium bg-sky-500/20 text-sky-700 dark:text-sky-300 shrink-0">
                      Optional
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground line-clamp-1 sm:line-clamp-none">
                    Auto-suggest taxonomy, UOM, and specs from product name or packaging.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAIAssistant(!showAIAssistant)}
                className="h-7 sm:h-8 text-[11px] sm:text-xs font-semibold gap-1 border-sky-500/40 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 shrink-0 px-2 sm:px-3"
              >
                {showAIAssistant ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    <span>Hide</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Analyze</span>
                  </>
                )}
              </Button>
            </div>

            {showAIAssistant && (
              <div className="mt-3 pt-3 border-t border-sky-500/20 animate-in fade-in-50 duration-200">
                <AIProductIntelligenceAssistant
                  ref={aiAssistantRef}
                  categoryContext={categoryContext}
                  businessIndustry={industryType || categoryName}
                  businessCurrency={symbol}
                  businessId={businessId}
                  onApplySuggestion={handleApplyAISuggestion}
                  currentProductName={form.name}
                  currentBarcode={form.barcode}
                  onDismiss={() => setShowAIAssistant(false)}
                />
              </div>
            )}
          </div>

          {/* SECTION 1: Product Identification */}
          <div className="space-y-3 sm:space-y-4">
            <SectionHeader
              number={1}
              title="Product Identification"
              description="Primary identity, internal code, and descriptive specifications"
              icon={Tag}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <FieldLabel
                  htmlFor="product-name-input"
                  required
                  aiInfo={fieldAIStatuses.name}
                  suggestedValue={fieldAIStatuses.name?.suggested}
                  onApplySuggestion={(val) => set("name", String(val))}
                >
                  Product Name
                </FieldLabel>
                <Input
                  id="product-name-input"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  onBlur={() => markTouched("name")}
                  placeholder="Enter product name (e.g. Paracetamol 500mg)"
                  className={errors.name && touched.name ? "border-destructive focus-visible:ring-destructive/30" : ""}
                />
                {form.name.trim().length >= 3 && (
                  <div className="flex items-center justify-between mt-1.5 pt-0.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-sky-500" />
                      Ready for AI intelligence
                    </span>
                    <button
                      id="quick-analyze-trigger-btn"
                      type="button"
                      onClick={() => {
                        setShowAIAssistant(true);
                        setTimeout(() => {
                          aiAssistantRef.current?.triggerAnalysis(form.name);
                        }, 50);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 bg-sky-500/10 hover:bg-sky-500/20 px-2 py-0.5 rounded-md border border-sky-500/20 transition cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      ✨ Analyze with AI
                    </button>
                  </div>
                )}
                {errors.name && touched.name && (
                  <p className="text-[11px] text-destructive flex items-center gap-1 mt-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <FieldLabel htmlFor="product-sku-input" className="mb-0">
                    Internal SKU (Auto/Custom)
                  </FieldLabel>
                  <button
                    type="button"
                    onClick={() => generateAutoSku()}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 bg-sky-500/10 hover:bg-sky-500/20 px-2 py-0.5 rounded-md border border-sky-500/20 transition cursor-pointer"
                  >
                    ⚡ Generate SKU
                  </button>
                </div>
                <Input
                  id="product-sku-input"
                  value={form.internal_sku}
                  onChange={(e) => set("internal_sku", e.target.value)}
                  placeholder="e.g. SKU-88402 (leave blank for auto-gen)"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Unique store identifier. Click Generate SKU or leave blank to auto-create.
                </p>
              </div>
            </div>

            <div>
              <FieldLabel
                htmlFor="product-metadata-input"
                aiInfo={fieldAIStatuses.description}
                suggestedValue={fieldAIStatuses.description?.suggested}
                onApplySuggestion={(val) => set("description", String(val))}
              >
                MetaData (Short Description &amp; Specifications)
              </FieldLabel>
              <Textarea
                id="product-metadata-input"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Product details, clinical indications, ingredients, or storage guidelines..."
                rows={2}
                className="resize-none text-xs"
              />
            </div>
          </div>

          {/* SECTION 2: Product Classification & UOM */}
          <div className="space-y-3 sm:space-y-4 pt-1 sm:pt-2">
            <SectionHeader
              number={2}
              title="Product Classification"
              description="Admin-controlled category hierarchy and controlled Unit of Measure"
              icon={Layers}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Primary Category */}
              <div>
                <FieldLabel
                  required
                  aiInfo={fieldAIStatuses.category_id}
                  suggestedValue={fieldAIStatuses.category_id?.suggested}
                  onApplySuggestion={(val) => set("category_id", String(val))}
                >
                  Primary Category
                </FieldLabel>
                <Select
                  value={form.category_id}
                  onValueChange={(v) => {
                    set("category_id", v);
                    markTouched("category_id");
                  }}
                >
                  <SelectTrigger
                    id="primary-category-select"
                    className={
                      errors.category_id && touched.category_id
                        ? "border-destructive focus:ring-destructive/30"
                        : ""
                    }
                  >
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {parents.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No product categories are available for this business.
                      </SelectItem>
                    ) : (
                      parents.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {errors.category_id && touched.category_id && (
                  <p className="text-[11px] text-destructive flex items-center gap-1 mt-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {errors.category_id}
                  </p>
                )}
              </div>

              {/* Subcategory */}
              <div>
                <FieldLabel
                  aiInfo={fieldAIStatuses.subcategory_id}
                  suggestedValue={fieldAIStatuses.subcategory_id?.suggested}
                  onApplySuggestion={(val) => set("subcategory_id", String(val))}
                >
                  Subcategory
                </FieldLabel>
                <Select
                  value={form.subcategory_id}
                  onValueChange={(v) => set("subcategory_id", v)}
                  disabled={!form.category_id || subs.length === 0}
                >
                  <SelectTrigger id="subcategory-select">
                    <SelectValue
                      placeholder={
                        !form.category_id
                          ? "Select category first"
                          : subs.length === 0
                          ? "No subcategories available"
                          : "Select Subcategory"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {subs.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No subcategories available for this category.
                      </SelectItem>
                    ) : (
                      subs.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {subs.length > 0
                    ? `${subs.length} subcategories available`
                    : "Filtered by primary category"}
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 3: Pricing, UoM & Stock Inventory */}
          <div className="space-y-4 pt-1 sm:pt-2">
            <SectionHeader
              number={3}
              title="Pricing, Unit of Measure (UoM) &amp; Stock"
              description="Cost, retail price, packaging scale, listing stock, and base units"
              icon={DollarSign}
            />

            {/* Pricing Section */}
            <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                  Product Pricing &amp; Profitability
                </span>
                {Number(form.retail_price) > 0 && (
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    (Number(form.retail_price) - Number(form.purchase_cost || 0)) >= 0
                      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      : "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20"
                  }`}>
                    Margin: {Math.round(((Number(form.retail_price) - Number(form.purchase_cost || 0)) / Number(form.retail_price)) * 100)}% 
                    ({symbol}{(Number(form.retail_price) - Number(form.purchase_cost || 0)).toFixed(2)} profit/{form.uom || "unit"})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Purchase Cost */}
                <div>
                  <FieldLabel
                    htmlFor="purchase-cost-input"
                    aiInfo={fieldAIStatuses.purchase_cost}
                    suggestedValue={fieldAIStatuses.purchase_cost?.suggested}
                    onApplySuggestion={(val) => set("purchase_cost", String(val))}
                  >
                    Purchase Cost ({symbol})
                  </FieldLabel>
                  <div className="relative">
                    <Input
                      id="purchase-cost-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.purchase_cost}
                      onChange={(e) => set("purchase_cost", e.target.value)}
                      onBlur={() => markTouched("purchase_cost")}
                      placeholder="0.00"
                      className={errors.purchase_cost && touched.purchase_cost ? "border-destructive" : ""}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Your wholesale/supplier cost per {form.uom || "unit"}.
                  </p>
                  {errors.purchase_cost && touched.purchase_cost && (
                    <p className="text-[11px] text-destructive flex items-center gap-1 mt-1 font-medium">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {errors.purchase_cost}
                    </p>
                  )}
                </div>

                {/* Retail Price */}
                <div>
                  <FieldLabel
                    htmlFor="retail-price-input"
                    required
                    aiInfo={fieldAIStatuses.retail_price}
                    suggestedValue={fieldAIStatuses.retail_price?.suggested}
                    onApplySuggestion={(val) => set("retail_price", String(val))}
                  >
                    Retail Price ({symbol})
                  </FieldLabel>
                  <div className="relative">
                    <Input
                      id="retail-price-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.retail_price}
                      onChange={(e) => set("retail_price", e.target.value)}
                      onBlur={() => markTouched("retail_price")}
                      placeholder="0.00"
                      className={
                        errors.retail_price && touched.retail_price
                          ? "border-destructive focus-visible:ring-destructive/30"
                          : ""
                      }
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Selling price charged per {form.uom || "unit"}.
                  </p>
                  {errors.retail_price && touched.retail_price && (
                    <p className="text-[11px] text-destructive flex items-center gap-1 mt-1 font-medium">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {errors.retail_price}
                    </p>
                  )}
                </div>

                {/* Discount Price */}
                {showDiscount ? (
                  <div>
                    <FieldLabel htmlFor="discount-price-input">
                      Discount Price ({symbol})
                    </FieldLabel>
                    <Input
                      id="discount-price-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.discount_price}
                      onChange={(e) => set("discount_price", e.target.value)}
                      onBlur={() => markTouched("discount_price")}
                      placeholder="Optional promotional price"
                      className={errors.discount_price && touched.discount_price ? "border-destructive" : ""}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Promotional sale price (optional).
                    </p>
                    {errors.discount_price && touched.discount_price && (
                      <p className="text-[11px] text-destructive flex items-center gap-1 mt-1 font-medium">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {errors.discount_price}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="hidden sm:block" />
                )}
              </div>
            </div>

            {/* Packaging, UoM & Stock Conversion Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-muted/40 border border-border/80 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-sky-500" />
                  Packaging &amp; Stock Configuration
                </span>
                <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/20">
                  Selling Unit: {form.uom ? form.uom.toUpperCase() : "BOX"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {/* 1. Selling Unit (UoM) */}
                <div>
                  <FieldLabel htmlFor="uom-scale-type-select" required>
                    Selling Unit (UoM)
                  </FieldLabel>
                  <Select
                    value={form.uom ? form.uom.toLowerCase() : "box"}
                    onValueChange={(val) => {
                      set("uom", val);
                      markTouched("uom");
                      if (val === "box") {
                        set("units_per_uom", "12");
                        set("base_unit", "tablet");
                        set("measurement_scale", "12");
                      } else if (val === "strip") {
                        set("units_per_uom", "10");
                        set("base_unit", "tablet");
                        set("measurement_scale", "10");
                      } else if (val === "dozen") {
                        set("units_per_uom", "12");
                        set("base_unit", "piece");
                        set("measurement_scale", "12");
                      } else if (val === "carton") {
                        set("units_per_uom", "24");
                        set("base_unit", "piece");
                        set("measurement_scale", "24");
                      } else if (val === "pack") {
                        set("units_per_uom", "10");
                        set("base_unit", "piece");
                        set("measurement_scale", "10");
                      } else if (val === "bottle") {
                        set("units_per_uom", "100");
                        set("base_unit", "ml");
                        set("measurement_scale", "100");
                      } else if (val === "kg") {
                        set("units_per_uom", "1000");
                        set("base_unit", "g");
                        set("measurement_scale", "1000");
                      } else if (val === "piece") {
                        set("units_per_uom", "1");
                        set("base_unit", "piece");
                        set("measurement_scale", "1");
                      }
                    }}
                  >
                    <SelectTrigger id="uom-scale-type-select" className="h-10 text-xs">
                      <SelectValue placeholder="Select UOM" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="box">📦 Box (e.g. 12 or 20 tablets per box)</SelectItem>
                      <SelectItem value="strip">💊 Strip (e.g. 10 pills per strip)</SelectItem>
                      <SelectItem value="pack">🛍️ Pack (e.g. 10 items per pack)</SelectItem>
                      <SelectItem value="carton">📦 Carton (e.g. 24 units per carton)</SelectItem>
                      <SelectItem value="dozen">🥚 Dozen (12 pieces per dozen)</SelectItem>
                      <SelectItem value="bottle">🧴 Bottle (e.g. 100ml / syrup)</SelectItem>
                      <SelectItem value="kg">⚖️ Kilogram (1000g per kg)</SelectItem>
                      <SelectItem value="piece">🧩 Piece / Single Unit (1:1)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Primary unit sold over the counter.
                  </p>
                </div>

                {/* 2. Pieces / Units per Box */}
                <div>
                  <FieldLabel htmlFor="units-per-uom-input" required>
                    Pieces / Units per {form.uom ? form.uom.charAt(0).toUpperCase() + form.uom.slice(1) : "Box"}
                  </FieldLabel>
                  <Input
                    id="units-per-uom-input"
                    type="number"
                    min="1"
                    value={form.units_per_uom}
                    onChange={(e) => {
                      const val = e.target.value;
                      set("units_per_uom", val);
                      set("measurement_scale", val);
                    }}
                    placeholder="12"
                    className="h-10 text-xs font-semibold"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Smallest {form.base_unit || "pieces"} inside 1 {form.uom || "box"}.
                  </p>
                </div>

                {/* 3. Opening Stock in Boxes */}
                <div>
                  <FieldLabel htmlFor="opening-stock-boxes-input" required>
                    Opening Stock in {form.uom ? formatUomPlural(form.uom.charAt(0).toUpperCase() + form.uom.slice(1), 2) : "Boxes"}
                  </FieldLabel>
                  <Input
                    id="opening-stock-boxes-input"
                    type="number"
                    min="0"
                    step="any"
                    value={form.opening_stock_boxes}
                    onChange={(e) => {
                      const val = e.target.value;
                      set("opening_stock_boxes", val);
                      set("pack_qty", val);
                      const totalUnits = Number(val || 0) * Number(form.units_per_uom || 1);
                      set("stock_units", String(totalUnits));
                    }}
                    onBlur={() => markTouched("stock_units")}
                    placeholder="10"
                    className={`h-10 text-xs font-bold text-sky-600 dark:text-sky-400 ${
                      errors.stock_units && touched.stock_units
                        ? "border-destructive focus-visible:ring-destructive/30"
                        : "border-sky-500/30 bg-sky-500/5"
                    }`}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Physical {form.uom || "box"} count currently on hand.
                  </p>
                </div>
              </div>

              {/* Dynamic Live Preview Banner */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-background border border-sky-500/20 text-xs flex-wrap gap-2 shadow-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sky-600 dark:text-sky-400 font-bold flex items-center gap-1">
                    💡 Live Preview:
                  </span>
                  <span className="font-semibold text-foreground">
                    You are adding{" "}
                    <strong className="font-bold text-sky-600 dark:text-sky-400">
                      {form.opening_stock_boxes || "0"} {formatUomPlural(form.uom ? form.uom.charAt(0).toUpperCase() + form.uom.slice(1) : "Box", Number(form.opening_stock_boxes || 0))}
                    </strong>{" "}
                    ={" "}
                    <strong className="font-extrabold text-foreground px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20">
                      {+(Number(form.opening_stock_boxes || 0) * Number(form.units_per_uom || 1)).toFixed(2)}{" "}
                      {formatUomPlural(form.base_unit ? form.base_unit.charAt(0).toUpperCase() + form.base_unit.slice(1) : "Tablet", +(Number(form.opening_stock_boxes || 0) * Number(form.units_per_uom || 1)))}
                    </strong>
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    (Automatically saved in database as Base Units)
                  </span>
                </div>
                {Number(form.units_per_uom) > 1 && Number(form.retail_price) > 0 && (
                  <span className="text-[11px] font-semibold text-muted-foreground bg-muted/60 px-2 py-1 rounded-md border border-border/60">
                    Single {form.base_unit || "piece"} price: ~{symbol}{(Number(form.retail_price) / Number(form.units_per_uom)).toFixed(2)} / {form.base_unit || "unit"}
                  </span>
                )}
              </div>
            </div>

            {/* Min Stock Alert */}
            {showAlert && (
              <div className="p-3 bg-muted/20 border border-border rounded-xl">
                <FieldLabel htmlFor="min-stock-alert-input">
                  Low Stock Safety Alert Threshold (in Base Units)
                </FieldLabel>
                <Input
                  id="min-stock-alert-input"
                  type="number"
                  min="0"
                  value={form.min_stock_alert}
                  onChange={(e) => set("min_stock_alert", e.target.value)}
                  placeholder={defaultMinAlert}
                  className="h-10 text-xs mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Triggers low stock warning when inventory drops to or below this single piece threshold.
                </p>
              </div>
            )}
          </div>

          {/* SECTION 4: Batch & Expiry */}
          {(showBatch || showExpiry) && (
            <div className="space-y-3 sm:space-y-4 pt-1 sm:pt-2">
              <SectionHeader
                number={4}
                title="Batch &amp; Expiry Tracking"
                description="Regulatory lot identification and expiration date controls"
                icon={Calendar}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {showBatch && (
                  <div>
                    <FieldLabel htmlFor="batch-number-input">
                      Batch / Lot Number
                    </FieldLabel>
                    <Input
                      id="batch-number-input"
                      value={form.batch_number}
                      onChange={(e) => set("batch_number", e.target.value)}
                      placeholder="e.g. LOT-2026-X8"
                    />
                  </div>
                )}

                {showExpiry && (
                  <div>
                    <FieldLabel htmlFor="expiry-date-input">
                      Expiry Date
                    </FieldLabel>
                    <Input
                      id="expiry-date-input"
                      type="date"
                      value={form.expiry_date}
                      onChange={(e) => set("expiry_date", e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 5: Images & Barcode */}
          <div className="space-y-3 sm:space-y-4 pt-1 sm:pt-2">
            <SectionHeader
              number={5}
              title="Images &amp; Barcode"
              description="Visual product assets and scanner-ready barcode entry"
              icon={Barcode}
            />

            {/* Barcode */}
            {showBarcode && (
              <div>
                <FieldLabel htmlFor="barcode-input">
                  Global Barcode (UPC / EAN / Code-128)
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="barcode-input"
                    value={form.barcode}
                    onChange={(e) => set("barcode", e.target.value)}
                    placeholder="Scan or type product barcode (e.g. 8901234567890)"
                    className="font-mono text-sm pl-9"
                  />
                  <Barcode className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Scanner-compatible input. Barcode scanners automatically type and format into this field.
                </p>
              </div>
            )}

            {/* Product Assets */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <FieldLabel>
                  Product Images (Max {MAX_IMAGES})
                </FieldLabel>
                <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400">
                  {images.length}/{MAX_IMAGES} slots
                </span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => uploadImages(e.target.files)}
              />
              <div className="flex flex-wrap gap-2.5 sm:gap-3">
                {images.map((url, i) => (
                  <div
                    key={i}
                    className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden border border-border group bg-muted/30"
                  >
                    <img
                      src={url}
                      alt={`asset ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setImages((p) => p.filter((_, x) => x !== i))}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/90 text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm"
                      title="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {images.length < MAX_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-sky-400 hover:text-sky-500 transition bg-card/40"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    <span className="text-[8px] sm:text-[9px] font-bold tracking-wider uppercase">Add</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 7: Final Review Card */}
          <div className="pt-1 sm:pt-2">
            <SectionHeader
              number={7}
              title="Final Verification Review"
              description="Review summary of specifications before committing SKU to database"
              icon={ShieldCheck}
            />

            <div className="rounded-xl sm:rounded-2xl border border-border bg-card p-3 sm:p-4 space-y-2.5 sm:space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
                <div>
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold text-muted-foreground block">
                    Product Name
                  </span>
                  <span className="font-semibold truncate block text-foreground">
                    {form.name.trim() || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold text-muted-foreground block">
                    Category / Sub
                  </span>
                  <span className="font-semibold truncate block text-foreground">
                    {selectedParent ? selectedParent.name : "—"}
                    {selectedSubcategory && (
                      <span className="text-muted-foreground font-normal"> / {selectedSubcategory.name}</span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold text-muted-foreground block">
                    UOM &amp; Stock
                  </span>
                  <span className="font-semibold text-foreground">
                    {form.stock_units !== "" ? formatStockWithUOM(form.stock_units, form.uom) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold text-muted-foreground block">
                    Price &amp; Margin
                  </span>
                  <div className="flex items-center gap-1 font-semibold text-foreground flex-wrap">
                    <span>
                      {form.retail_price !== "" ? `${symbol} ${Number(form.retail_price).toFixed(2)}` : "—"}
                    </span>
                    {calculatedMargin > 0 && (
                      <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        (+{calculatedMargin}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {(form.batch_number || form.expiry_date || form.barcode) && (
                <div className="pt-2 border-t border-border/70 flex flex-wrap gap-2.5 sm:gap-4 text-[11px] sm:text-xs">
                  {form.batch_number && (
                    <div>
                      <span className="text-[9px] sm:text-[10px] uppercase font-bold text-muted-foreground">
                        Batch:{" "}
                      </span>
                      <span className="font-mono font-medium text-foreground">{form.batch_number}</span>
                    </div>
                  )}
                  {form.expiry_date && (
                    <div>
                      <span className="text-[9px] sm:text-[10px] uppercase font-bold text-muted-foreground">
                        Expiry:{" "}
                      </span>
                      <span className="font-medium text-foreground">{form.expiry_date}</span>
                    </div>
                  )}
                  {form.barcode && (
                    <div>
                      <span className="text-[9px] sm:text-[10px] uppercase font-bold text-muted-foreground">
                        Barcode:{" "}
                      </span>
                      <span className="font-mono font-medium text-foreground">{form.barcode}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Actions Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-t border-border bg-card/90 backdrop-blur shrink-0 flex items-center justify-between gap-2.5 sm:gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="text-xs font-semibold h-10 sm:h-11 px-3 sm:px-4"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-10 sm:h-11 px-4 sm:px-6 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 flex-1 sm:flex-initial justify-center"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                <span>{isEdit ? "Save Changes" : "Save Product SKU"}</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDialog;
