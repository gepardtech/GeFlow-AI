import { useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  FileCheck,
  CheckCircle2,
  Layers,
  ArrowRight,
  Loader2,
  Table,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ParsedWorkbook, parseUploadedFile, readSheetGrid } from "@/lib/importer/fileParser";
import { downloadSampleInventoryTemplate } from "@/lib/importer/templateGenerator";
import { SheetInfo } from "@/lib/importer/types";

interface StepUploadProps {
  onParsed: (workbook: ParsedWorkbook) => void;
  onCancel: () => void;
}

export const StepUpload = ({ onParsed, onCancel }: StepUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [selectedHeaderRow, setSelectedHeaderRow] = useState<number>(0);

  const handleFile = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const parsed = await parseUploadedFile(file);
      setWorkbook(parsed);
      setSelectedSheet(parsed.activeSheetName);
      setSelectedHeaderRow(parsed.headerDetection.headerRowIndex);
    } catch (err: any) {
      setError(err.message || "Failed to parse the file. Please check format.");
      setWorkbook(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSheetChange = async (sheetName: string) => {
    if (!workbook || workbook.fileType === "csv") return;
    setSelectedSheet(sheetName);
    setLoading(true);
    try {
      const { rawGrid, headerDetection } = await readSheetGrid(workbook.file, sheetName);
      setWorkbook({
        ...workbook,
        activeSheetName: sheetName,
        rawGrid,
        headerDetection,
      });
      setSelectedHeaderRow(headerDetection.headerRowIndex);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProceed = () => {
    if (!workbook) return;
    onParsed(workbook);
  };

  return (
    <div className="space-y-6">
      {/* Title & Description */}
      <div className="text-center max-w-xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Import Products
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
          Upload your existing inventory file and GeFlow will automatically organize and normalize
          the product information into your inventory structure.
        </p>
      </div>

      {!workbook ? (
        <>
          {/* Drag and drop upload zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.[0]) {
                handleFile(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? "border-sky-500 bg-sky-500/10 scale-[1.01]"
                : "border-border hover:border-sky-400/60 hover:bg-muted/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />

            <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center mb-4">
              {loading ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <Upload className="w-8 h-8" />
              )}
            </div>

            <p className="font-semibold text-base sm:text-lg text-foreground">
              {loading ? "Analyzing spreadsheet..." : "Drag & drop your inventory file here"}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              or <span className="text-sky-500 font-semibold underline">browse files</span> from your computer
            </p>

            <div className="flex items-center justify-center gap-3 mt-4 text-[11px] font-medium text-muted-foreground">
              <span className="px-2.5 py-1 rounded-md bg-muted border border-border">.XLSX</span>
              <span className="px-2.5 py-1 rounded-md bg-muted border border-border">.XLS</span>
              <span className="px-2.5 py-1 rounded-md bg-muted border border-border">.CSV</span>
              <span>• Max 25 MB</span>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to process file</p>
                <p className="mt-0.5 opacity-90">{error}</p>
              </div>
            </div>
          )}

          {/* Optional template download */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border/80 text-xs sm:text-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Need a sample structure?</p>
                <p className="text-xs text-muted-foreground">
                  Download an optional recommended template with example product rows.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadSampleInventoryTemplate("xlsx")}
                className="h-8 text-xs font-semibold rounded-xl"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> Excel Template
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => downloadSampleInventoryTemplate("csv")}
                className="h-8 text-xs font-semibold"
              >
                CSV
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={onCancel} className="rounded-xl">
              Cancel
            </Button>
          </div>
        </>
      ) : (
        /* Sheet & Header Selection View (When multiple sheets or header verification needed) */
        <div className="space-y-6">
          {/* File summary card */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 border border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate text-foreground">{workbook.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {(workbook.file.size / 1024).toFixed(1)} KB • {workbook.rawGrid.length} total rows detected
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setWorkbook(null);
                setError(null);
              }}
              className="rounded-xl text-xs"
            >
              Change File
            </Button>
          </div>

          {/* Multiple sheets detected */}
          {workbook.sheets.length > 1 && (
            <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-500" />
                <h3 className="font-bold text-sm text-foreground">Select Spreadsheet Sheet</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                We detected multiple sheets. Please choose the sheet containing your product inventory:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {workbook.sheets.map((sheet) => (
                  <button
                    key={sheet.name}
                    type="button"
                    onClick={() => handleSheetChange(sheet.name)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all ${
                      selectedSheet === sheet.name
                        ? "border-sky-500 bg-sky-500/10 font-semibold text-foreground shadow-sm"
                        : "border-border hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold truncate">{sheet.name}</p>
                      <p className="text-[10px] text-muted-foreground opacity-80">{sheet.rowCount} rows</p>
                    </div>
                    {sheet.isRecommended && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-bold uppercase tracking-wider">
                        Recommended
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Header Row Detection Preview */}
          <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4 text-sky-500" />
                <h3 className="font-bold text-sm text-foreground">Detected Header Row</h3>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Row {selectedHeaderRow + 1} identified with {workbook.headerDetection.confidence}% confidence
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-background p-2">
              <div className="flex gap-2 min-w-max">
                {workbook.headerDetection.headers.map((h, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-muted text-[11px] font-semibold text-foreground border border-border/80"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => {
                setWorkbook(null);
                setError(null);
              }}
              className="rounded-xl"
            >
              Back
            </Button>
            <Button
              onClick={handleProceed}
              className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold px-6 shadow-sm"
            >
              Analyze & Map Columns <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
