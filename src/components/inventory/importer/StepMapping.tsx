import { useMemo } from "react";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  EyeOff,
  AlertCircle,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CanonicalField, ColumnMapping } from "@/lib/importer/types";
import { CANONICAL_FIELDS } from "@/lib/importer/canonicalFields";
import { updateColumnMapping } from "@/lib/importer/mappingEngine";

interface StepMappingProps {
  mappings: ColumnMapping[];
  onMappingsChange: (newMappings: ColumnMapping[]) => void;
  onBack: () => void;
  onContinue: () => void;
}

export const StepMapping = ({
  mappings,
  onMappingsChange,
  onBack,
  onContinue,
}: StepMappingProps) => {
  const hasProductName = useMemo(
    () => mappings.some((m) => m.mappedField === "name"),
    [mappings]
  );

  const matchedCount = useMemo(
    () => mappings.filter((m) => m.mappedField !== "ignore" && m.status === "matched").length,
    [mappings]
  );
  const reviewCount = useMemo(
    () => mappings.filter((m) => m.requiresReview || m.status === "review" || m.status === "conflict").length,
    [mappings]
  );
  const ignoredCount = useMemo(
    () => mappings.filter((m) => m.mappedField === "ignore").length,
    [mappings]
  );

  // Check for duplicate field mappings
  const fieldCounts = useMemo(() => {
    const counts = new Map<CanonicalField, number>();
    for (const m of mappings) {
      if (m.mappedField !== "ignore" && m.mappedField !== "metadata") {
        counts.set(m.mappedField, (counts.get(m.mappedField) || 0) + 1);
      }
    }
    return counts;
  }, [mappings]);

  const conflicts = useMemo(() => {
    const list: string[] = [];
    fieldCounts.forEach((count, field) => {
      if (count > 1) {
        const def = CANONICAL_FIELDS.find((f) => f.key === field);
        list.push(def?.label || field);
      }
    });
    return list;
  }, [fieldCounts]);

  const handleFieldChange = (colIdx: number, newField: CanonicalField) => {
    const updated = updateColumnMapping(mappings, colIdx, newField);
    onMappingsChange(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-sky-500" />
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Map Columns to GeFlow Fields
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            GeFlow intelligently analyzed your headers and sample data. Verify the mappings below.
          </p>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> {matchedCount} Matched
          </span>
          {reviewCount > 0 && (
            <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> {reviewCount} Review
            </span>
          )}
          <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground font-semibold flex items-center gap-1.5">
            <EyeOff className="w-3.5 h-3.5" /> {ignoredCount} Ignored
          </span>
        </div>
      </div>

      {/* Warnings bar if Product Name is missing */}
      {!hasProductName && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Product Name is required</p>
            <p className="mt-0.5">
              Please select at least one uploaded column to map to <strong>Product Name</strong> before proceeding.
            </p>
          </div>
        </div>
      )}

      {/* Conflicts warning */}
      {conflicts.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs sm:text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Multiple columns mapped to the same field</p>
            <p className="mt-0.5">
              The following fields have multiple assigned columns: <strong>{conflicts.join(", ")}</strong>. Please review and ignore redundant columns or choose primary.
            </p>
          </div>
        </div>
      )}

      {/* Desktop & Tablet Table */}
      <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                <th className="py-3.5 px-4 w-[24%]">Uploaded Column</th>
                <th className="py-3.5 px-4 w-[26%]">GeFlow Target Field</th>
                <th className="py-3.5 px-4 w-[16%]">Confidence</th>
                <th className="py-3.5 px-4 w-[22%]">Sample Value</th>
                <th className="py-3.5 px-4 w-[12%] text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mappings.map((m) => {
                const isConflict = (fieldCounts.get(m.mappedField) || 0) > 1;
                const isHigh = m.confidence >= 90;
                const isMed = m.confidence >= 70 && m.confidence < 90;
                const isIgnored = m.mappedField === "ignore";

                return (
                  <tr
                    key={m.columnIndex}
                    className={`hover:bg-muted/25 transition-colors ${
                      isConflict
                        ? "bg-amber-500/5"
                        : isIgnored
                        ? "opacity-60 bg-muted/10"
                        : ""
                    }`}
                  >
                    {/* Uploaded header */}
                    <td className="py-3 px-4">
                      <p className="font-bold text-foreground text-sm">{m.uploadedHeader}</p>
                      <p className="text-[10px] text-muted-foreground">Column #{m.columnIndex + 1}</p>
                    </td>

                    {/* Target field selector */}
                    <td className="py-3 px-4">
                      <Select
                        value={m.mappedField}
                        onValueChange={(val) => handleFieldChange(m.columnIndex, val as CanonicalField)}
                      >
                        <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                          <SelectValue placeholder="Select target field" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {CANONICAL_FIELDS.map((f) => (
                            <SelectItem key={f.key} value={f.key} className="text-xs">
                              <span className="font-medium">{f.label}</span>
                              {f.required && (
                                <span className="ml-1 text-rose-500 font-bold">*</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {m.reason && (
                        <p className="text-[10px] text-muted-foreground mt-1 truncate" title={m.reason}>
                          {m.reason}
                        </p>
                      )}
                    </td>

                    {/* Confidence Score */}
                    <td className="py-3 px-4">
                      {isIgnored ? (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold">
                            <span
                              className={
                                isHigh
                                  ? "text-emerald-500"
                                  : isMed
                                  ? "text-amber-500"
                                  : "text-sky-500"
                              }
                            >
                              {m.confidence}%
                            </span>
                            <span className="text-[9px] text-muted-foreground uppercase">
                              {isHigh ? "High" : isMed ? "Review" : "Low"}
                            </span>
                          </div>
                          <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isHigh
                                  ? "bg-emerald-500"
                                  : isMed
                                  ? "bg-amber-500"
                                  : "bg-sky-500"
                              }`}
                              style={{ width: `${m.confidence}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Sample value */}
                    <td className="py-3 px-4">
                      <div className="max-w-[200px]">
                        <p
                          className="font-mono text-[11px] text-foreground bg-muted/60 px-2 py-1 rounded-lg truncate"
                          title={m.sampleValues.join(", ")}
                        >
                          {m.sampleValues[0] || <span className="text-muted-foreground italic">empty</span>}
                        </p>
                        {m.sampleValues.length > 1 && (
                          <p className="text-[9px] text-muted-foreground mt-0.5 truncate">
                            e.g. {m.sampleValues.slice(1, 3).join(", ")}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 text-right">
                      {isConflict ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600">
                          ⚠ Duplicate
                        </span>
                      ) : isIgnored ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                          Ignored
                        </span>
                      ) : isHigh ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600">
                          ✓ Matched
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600">
                          ⚠ Review
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card Stack */}
      <div className="block md:hidden space-y-3">
        {mappings.map((m) => (
          <div
            key={m.columnIndex}
            className={`p-4 rounded-2xl border bg-card space-y-3 ${
              m.mappedField === "ignore" ? "opacity-60" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-foreground">{m.uploadedHeader}</p>
                <p className="text-[10px] text-muted-foreground">Column #{m.columnIndex + 1}</p>
              </div>
              <span className="text-xs font-bold text-sky-500">
                {m.mappedField !== "ignore" ? `${m.confidence}% match` : "Ignored"}
              </span>
            </div>

            {m.sampleValues[0] && (
              <p className="text-xs font-mono bg-muted/60 p-2 rounded-lg truncate">
                Sample: {m.sampleValues[0]}
              </p>
            )}

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Map To GeFlow Field
              </label>
              <Select
                value={m.mappedField}
                onValueChange={(val) => handleFieldChange(m.columnIndex, val as CanonicalField)}
              >
                <SelectTrigger className="h-10 rounded-xl text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANONICAL_FIELDS.map((f) => (
                    <SelectItem key={f.key} value={f.key} className="text-xs">
                      {f.label} {f.required && "*"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Footer */}
      <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-md border-t border-border p-3 sm:p-4 rounded-2xl shadow-lg flex items-center justify-between gap-3">
        <Button variant="outline" onClick={onBack} className="rounded-xl text-xs gap-1.5 h-9">
          <ArrowLeft className="w-4 h-4" /> Back to Upload
        </Button>
        <Button
          onClick={onContinue}
          disabled={!hasProductName}
          className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs px-6 h-9 shadow-sm disabled:opacity-50 gap-2"
        >
          Review Data & Duplicates <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
