import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  Download,
  Package,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportResultSummary } from "@/lib/importer/types";
import { downloadImportErrorReport } from "@/lib/importer/importExecutionEngine";

interface StepImportingProps {
  isProcessing: boolean;
  progress: {
    stage?: string;
    processed: number;
    total: number;
    currentName: string;
    percentage: number;
  };
  summary: ImportResultSummary | null;
  onFinish: () => void;
  onReset: () => void;
}

export const StepImporting = ({
  isProcessing,
  progress,
  summary,
  onFinish,
  onReset,
}: StepImportingProps) => {
  if (isProcessing || !summary) {
    const currentStage = progress.stage || "Importing";

    return (
      <div className="py-12 sm:py-16 text-center max-w-lg mx-auto space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-sky-500/15 text-sky-500 flex items-center justify-center mx-auto shadow-inner animate-pulse">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Importing Products into Inventory
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 truncate max-w-md mx-auto">
            {progress.currentName
              ? `Processing "${progress.currentName}"`
              : "Verifying schemas and committing database records..."}
          </p>
        </div>

        {/* Multi-stage indicator */}
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className={`px-2.5 py-1 rounded-full text-[10px] ${currentStage === "Validating" ? "bg-sky-500/10 text-sky-600 border border-sky-500/20 font-bold" : "bg-muted"}`}>
            1. Validate
          </span>
          <span className="text-muted-foreground/40">→</span>
          <span className={`px-2.5 py-1 rounded-full text-[10px] ${currentStage === "Importing" ? "bg-sky-500/10 text-sky-600 border border-sky-500/20 font-bold" : "bg-muted"}`}>
            2. Import
          </span>
          <span className="text-muted-foreground/40">→</span>
          <span className={`px-2.5 py-1 rounded-full text-[10px] ${currentStage === "Finalizing" ? "bg-sky-500/10 text-sky-600 border border-sky-500/20 font-bold" : "bg-muted"}`}>
            3. Finalize
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-2 max-w-md mx-auto">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>
              {progress.processed} / {progress.total} Items
            </span>
            <span className="text-sky-500">{progress.percentage}%</span>
          </div>

          <div className="h-3 w-full bg-muted rounded-full overflow-hidden p-0.5 border border-border">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-300 shadow-sm"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Transactional safety enforced. Please do not refresh or close the browser.
        </p>
      </div>
    );
  }

  // Completed State
  const hasErrors = summary.failed > 0;
  const isAllSuccess = summary.failed === 0 && (summary.imported > 0 || summary.updated > 0);

  return (
    <div className="py-6 space-y-6 max-w-2xl mx-auto">
      {/* Icon & Title */}
      <div className="text-center space-y-2">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${
            isAllSuccess
              ? "bg-emerald-500/15 text-emerald-500"
              : hasErrors
              ? "bg-amber-500/15 text-amber-500"
              : "bg-sky-500/15 text-sky-500"
          }`}
        >
          {isAllSuccess ? (
            <CheckCircle2 className="w-8 h-8" />
          ) : hasErrors ? (
            <AlertTriangle className="w-8 h-8" />
          ) : (
            <Sparkles className="w-8 h-8" />
          )}
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {isAllSuccess
            ? "Import Completed Successfully!"
            : hasErrors
            ? "Import Completed with Warnings"
            : "Import Finalized"}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Processed {summary.totalRows} rows in {(summary.durationMs / 1000).toFixed(1)} seconds.
        </p>

        {summary.batchId && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border text-[11px] font-mono text-muted-foreground mt-1">
            <Hash className="w-3 h-3 text-sky-500" /> Batch ID: {summary.batchId}
          </div>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {summary.imported}
          </p>
          <p className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase tracking-wider font-bold mt-0.5">
            New Products
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-center">
          <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">
            {summary.updated}
          </p>
          <p className="text-[10px] text-sky-700 dark:text-sky-300 uppercase tracking-wider font-bold mt-0.5">
            Updated / Restocked
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-muted border border-border text-center">
          <p className="text-2xl font-bold text-muted-foreground">{summary.skipped}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">
            Skipped
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            {summary.failed}
          </p>
          <p className="text-[10px] text-rose-700 dark:text-rose-300 uppercase tracking-wider font-bold mt-0.5">
            Failed
          </p>
        </div>
      </div>

      {/* Error Report Downloader */}
      {hasErrors && (
        <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <div>
              <p className="font-bold text-rose-700 dark:text-rose-300">
                {summary.failed} item(s) failed validation or database constraints
              </p>
              <p className="text-muted-foreground mt-0.5">
                Download the error report to fix the issues in your spreadsheet and re-import.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadImportErrorReport(summary.errors)}
            className="rounded-xl text-xs font-semibold shrink-0 bg-background"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Download Error Report
          </Button>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-border">
        <Button
          variant="outline"
          onClick={onReset}
          className="w-full sm:w-auto rounded-xl text-xs font-semibold h-10 px-5"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Import Another Spreadsheet
        </Button>

        <Button
          onClick={onFinish}
          className="w-full sm:w-auto rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs h-10 px-6 shadow-sm"
        >
          <Package className="w-3.5 h-3.5 mr-1.5" /> View Imported Inventory
        </Button>
      </div>
    </div>
  );
};
export default StepImporting;
