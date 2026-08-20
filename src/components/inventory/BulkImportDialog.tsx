import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductCategory } from "@/hooks/useProductCategories";
import { ParsedWorkbook } from "@/lib/importer/fileParser";
import {
  ColumnMapping,
  ImportResultSummary,
  NormalizedProduct,
} from "@/lib/importer/types";
import { analyzeColumnMappings } from "@/lib/importer/mappingEngine";
import { processAndValidateRows } from "@/lib/importer/validationEngine";
import { runAIBulkProductPipeline } from "@/lib/importer/aiBulkImportPipeline";
import {
  detectInFileDuplicates,
  correlateWithExistingDatabaseProducts,
} from "@/lib/importer/duplicateEngine";
import { executeProductImport } from "@/lib/importer/importExecutionEngine";
import { StepUpload } from "./importer/StepUpload";
import { StepMapping } from "./importer/StepMapping";
import { StepReview } from "./importer/StepReview";
import { StepImporting } from "./importer/StepImporting";
import {
  Upload,
  Sparkles,
  TableProperties,
  CheckCircle2,
  PackagePlus,
  Loader2,
  Brain,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { BusinessCatalogContext } from "@/server/ai/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  businessId: string;
  ownerUserId: string;
  categories: ProductCategory[];
  onSaved: () => void;
}

type Step = 1 | 2 | 3 | 4;

export const BulkImportDialog = ({
  open,
  onOpenChange,
  businessId,
  ownerUserId,
  categories,
  onSaved,
}: Props) => {
  const { toast } = useToast();
  const { activeBusiness, industryType } = useActiveBusiness();

  const [step, setStep] = useState<Step>(1);
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [products, setProducts] = useState<NormalizedProduct[]>([]);

  // AI Pipeline Analysis State
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiProgress, setAiProgress] = useState({
    stage: "Analyzing products...",
    current: 0,
    total: 0,
    percentage: 0,
    currentName: "",
  });

  // DB Execution State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({
    processed: 0,
    total: 0,
    currentName: "",
    percentage: 0,
  });
  const [importSummary, setImportSummary] = useState<ImportResultSummary | null>(null);

  const resetAll = () => {
    setStep(1);
    setWorkbook(null);
    setMappings([]);
    setProducts([]);
    setIsAiAnalyzing(false);
    setIsProcessing(false);
    setProgress({ processed: 0, total: 0, currentName: "", percentage: 0 });
    setImportSummary(null);
  };

  // Build BusinessCatalogContext for AI
  const businessCatalogContext: BusinessCatalogContext = useMemo(() => {
    const parents = categories.filter((c) => !c.parent_id);
    const subcategories = categories.filter((c) => !!c.parent_id);

    return {
      businessId,
      businessName: activeBusiness?.business_name || "Active Store",
      industryType: industryType || "general",
      currency: activeBusiness?.currency || "PKR",
      allowedCategories: parents.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug || c.name.toLowerCase().replace(/\s+/g, "_"),
      })),
      allowedSubcategories: subcategories.map((s) => ({
        id: s.id,
        parentId: s.parent_id || null,
        name: s.name,
        slug: s.slug || s.name.toLowerCase().replace(/\s+/g, "_"),
      })),
    };
  }, [businessId, activeBusiness, industryType, categories]);

  // Step 1: File Parsed -> Generate Initial Mappings
  const handleFileParsed = (parsed: ParsedWorkbook) => {
    setWorkbook(parsed);

    // Extract headers and data rows based on detected header row
    const headerRowIdx = parsed.headerDetection.headerRowIndex;
    const rawHeaders = parsed.headerDetection.headers;
    const sampleRows = parsed.rawGrid.slice(headerRowIdx + 1, headerRowIdx + 10);

    const { mappings: initialMappings } = analyzeColumnMappings(
      rawHeaders,
      sampleRows
    );
    setMappings(initialMappings);
    setStep(2);
  };

  // Step 2: Mappings Completed -> Run AI Product Intelligence Pipeline & Duplicate Detection
  const handleMappingsContinue = async () => {
    if (!workbook) return;

    const headerRowIdx = workbook.headerDetection.headerRowIndex;
    const dataRows = workbook.rawGrid.slice(headerRowIdx + 1);

    setIsAiAnalyzing(true);
    setAiProgress({
      stage: "Initializing GeFlow AI Product Intelligence...",
      current: 0,
      total: dataRows.length,
      percentage: 5,
      currentName: "",
    });

    try {
      // 1. Run AI bulk intelligence pipeline
      const normalized = await runAIBulkProductPipeline({
        mappings,
        dataRows,
        headerRowIndex: headerRowIdx,
        existingCategories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          parent_id: c.parent_id || null,
          slug: c.slug,
        })),
        businessContext: businessCatalogContext,
        onProgress: (p) => {
          setAiProgress({
            stage: p.stage,
            current: p.current,
            total: p.total,
            percentage: p.percentage,
            currentName: p.currentName || "",
          });
        },
      });

      // 2. Detect in-file duplicates
      const withInFileDupes = detectInFileDuplicates(normalized);

      // 3. Correlate with database products for active business
      const withDbDupes = await correlateWithExistingDatabaseProducts(
        withInFileDupes,
        businessId
      );

      setProducts(withDbDupes);
      setIsAiAnalyzing(false);
      setStep(3);
    } catch (err: any) {
      console.warn("AI pipeline encountered an issue, falling back to standard validator:", err);
      // Deterministic fallback
      const fallbackNormalized = processAndValidateRows({
        mappings,
        dataRows,
        headerRowIndex: headerRowIdx,
        existingCategories: categories,
      });
      const withInFile = detectInFileDuplicates(fallbackNormalized);
      const withDb = await correlateWithExistingDatabaseProducts(withInFile, businessId);

      setProducts(withDb);
      setIsAiAnalyzing(false);
      setStep(3);
    }
  };

  // Step 3 -> Step 4: Execute Database Import
  const handleStartImport = async (approvedProducts: NormalizedProduct[]) => {
    setStep(4);
    setIsProcessing(true);

    try {
      const summary = await executeProductImport({
        products: approvedProducts,
        businessId,
        ownerUserId,
        industryType,
        onProgress: (p) => setProgress(p),
      });

      setImportSummary(summary);
      setIsProcessing(false);

      if (summary.imported > 0 || summary.updated > 0) {
        toast({
          title: "Import complete",
          description: `Successfully added ${summary.imported} new products${
            summary.updated > 0 ? ` and updated ${summary.updated}` : ""
          }.`,
        });
        onSaved();
      }
    } catch (err: any) {
      setIsProcessing(false);
      toast({
        title: "Import encountered an error",
        description: err.message || "Failed to complete product import.",
        variant: "destructive",
      });
    }
  };

  const stepsHeader = [
    { num: 1, label: "Upload File", icon: Upload },
    { num: 2, label: "Map Columns", icon: Sparkles },
    { num: 3, label: "AI Review & Approve", icon: TableProperties },
    { num: 4, label: "Commit to Database", icon: PackagePlus },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetAll();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-6xl w-[96vw] max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="border-b border-border pb-4">
          {/* Stepper Header */}
          <div className="flex items-center justify-between gap-2 max-w-2xl mx-auto w-full">
            {stepsHeader.map((s, idx) => {
              const isCurrent = step === s.num;
              const isDone = step > s.num;

              return (
                <div key={s.num} className="flex items-center flex-1">
                  <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isDone
                          ? "bg-emerald-500 text-white"
                          : isCurrent
                          ? "bg-sky-500 text-white shadow-md ring-2 ring-sky-500/20"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                    </div>
                    <span
                      className={`text-[10px] sm:text-xs font-bold tracking-tight whitespace-nowrap ${
                        isCurrent
                          ? "text-foreground"
                          : isDone
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground opacity-70"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>

                  {idx < stepsHeader.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 sm:mx-3 transition-colors ${
                        step > s.num ? "bg-emerald-500" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        {/* Step Views */}
        <div className="pt-2">
          {/* AI Intelligence Progress Overlay */}
          {isAiAnalyzing ? (
            <div className="py-16 text-center space-y-6 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 text-sky-500 mx-auto flex items-center justify-center animate-pulse">
                <Brain className="w-8 h-8 animate-spin text-sky-500" style={{ animationDuration: "3s" }} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-foreground">
                  AI Product Intelligence in Progress
                </h3>
                <p className="text-xs text-muted-foreground">
                  {aiProgress.stage}
                </p>
                {aiProgress.currentName && (
                  <p className="text-[11px] font-mono text-sky-600 dark:text-sky-400 truncate max-w-xs mx-auto">
                    "{aiProgress.currentName}"
                  </p>
                )}
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 transition-all duration-300 rounded-full"
                    style={{ width: `${aiProgress.percentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>
                    {aiProgress.current} / {aiProgress.total} items
                  </span>
                  <span className="font-bold text-foreground">{aiProgress.percentage}%</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20 text-[11px] text-muted-foreground flex items-center gap-2 text-left">
                <ShieldCheck className="w-4 h-4 text-sky-500 shrink-0" />
                <span>
                  Admin Catalog rules & business category UOMs are being validated in real-time.
                </span>
              </div>
            </div>
          ) : (
            <>
              {step === 1 && (
                <StepUpload
                  onParsed={handleFileParsed}
                  onCancel={() => onOpenChange(false)}
                />
              )}

              {step === 2 && (
                <StepMapping
                  mappings={mappings}
                  onMappingsChange={setMappings}
                  onBack={() => setStep(1)}
                  onContinue={handleMappingsContinue}
                />
              )}

              {step === 3 && (
                <StepReview
                  products={products}
                  categories={categories}
                  industryType={industryType}
                  onProductsChange={setProducts}
                  onBack={() => setStep(2)}
                  onStartImport={handleStartImport}
                />
              )}

              {step === 4 && (
                <StepImporting
                  isProcessing={isProcessing}
                  progress={progress}
                  summary={importSummary}
                  onFinish={() => {
                    resetAll();
                    onOpenChange(false);
                  }}
                  onReset={() => resetAll()}
                />
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkImportDialog;
