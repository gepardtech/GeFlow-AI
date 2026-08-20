import { useState, useMemo } from "react";
import { Download } from "lucide-react";
import { format, startOfDay, subDays, startOfYear, isSameDay, isWithinInterval, addMonths, startOfMonth, endOfMonth, addDays } from "date-fns";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ExportColumn { header: string; value: (row: any) => string | number; }
interface Props {
  triggerLabel?: string;
  title?: string;
  filename: string;
  rows: any[];
  /** field on each row that holds the date used for filtering */
  dateField: string;
  columns: ExportColumn[];
  trigger?: React.ReactNode;
}

const csvEscape = (v: any) => {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
};

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "7", label: "Last 7 Days" },
  { id: "30", label: "Last 30 Days" },
  { id: "ytd", label: "Year to Date" },
];

const MonthGrid = ({ month, range, onPick }: { month: Date; range: { from?: Date; to?: Date }; onPick: (d: Date) => void; }) => {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const startWeekday = start.getDay();
  const days: (Date | null)[] = Array.from({ length: startWeekday }, () => null);
  for (let d = 1; d <= end.getDate(); d++) days.push(new Date(month.getFullYear(), month.getMonth(), d));
  const labels = ["S", "M", "T", "W", "T", "F", "S"];
  return (
    <div>
      <p className="text-center font-bold text-sky-500 mb-3">{format(month, "MMMM yyyy")}</p>
      <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold text-muted-foreground mb-1">
        {labels.map((l, i) => <div key={i} className="text-center">{l}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          if (!d) return <div key={i} />;
          const inRange = range.from && range.to && isWithinInterval(d, { start: range.from, end: range.to });
          const isStart = range.from && isSameDay(d, range.from);
          const isEnd = range.to && isSameDay(d, range.to);
          const isEdge = isStart || isEnd;
          return (
            <button
              key={i}
              onClick={() => onPick(d)}
              className={cn(
                "h-9 w-9 text-sm rounded-md transition-all font-medium",
                isEdge && "bg-sky-500 text-white shadow-lg shadow-sky-500/40",
                !isEdge && inRange && "bg-sky-500/15 text-sky-500",
                !isEdge && !inRange && "hover:bg-muted text-foreground/80",
              )}
            >{d.getDate()}</button>
          );
        })}
      </div>
    </div>
  );
};

const AuditExportDialog = ({ trigger, triggerLabel = "Export Report", title = "Export Audit Log", filename, rows, dateField, columns }: Props) => {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<Date | undefined>(subDays(startOfDay(new Date()), 7));
  const [to, setTo] = useState<Date | undefined>(startOfDay(new Date()));
  const [activePreset, setActivePreset] = useState<string>("7");
  const { toast } = useToast();

  const month1 = useMemo(() => startOfMonth(from ?? new Date()), [from]);
  const month2 = useMemo(() => addMonths(month1, 1), [month1]);

  const applyPreset = (id: string) => {
    const today = startOfDay(new Date());
    setActivePreset(id);
    if (id === "today") { setFrom(today); setTo(today); }
    else if (id === "7") { setFrom(subDays(today, 6)); setTo(today); }
    else if (id === "30") { setFrom(subDays(today, 29)); setTo(today); }
    else if (id === "ytd") { setFrom(startOfYear(today)); setTo(today); }
  };

  const pickDay = (d: Date) => {
    setActivePreset("");
    if (!from || (from && to && !isSameDay(from, to))) { setFrom(d); setTo(d); return; }
    if (d < from) { setTo(from); setFrom(d); } else { setTo(d); }
  };

  const handleExport = () => {
    if (!from || !to) { toast({ title: "Pick a date range", variant: "destructive" }); return; }
    const start = startOfDay(from).getTime();
    const end = startOfDay(addDays(to, 1)).getTime() - 1;
    const filtered = rows.filter((r) => {
      const v = r[dateField];
      if (!v) return false;
      const t = new Date(v).getTime();
      return t >= start && t <= end;
    });
    const headerRow = columns.map((c) => c.header).join(",");
    const dataRows = filtered.map((r) => columns.map((c) => csvEscape(c.value(r))).join(","));
    const csv = [
      `# ${title}`,
      `# Period: ${format(from, "yyyy-MM-dd")} → ${format(to, "yyyy-MM-dd")}`,
      `# Generated: ${new Date().toISOString()}`,
      ``,
      headerRow,
      ...dataRows,
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${format(from, "yyyyMMdd")}-${format(to, "yyyyMMdd")}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast({ title: "Report downloaded", description: `${filtered.length} rows exported.` });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button className="h-10 px-4 rounded-xl bg-card border border-border text-sm font-bold inline-flex items-center gap-2 hover:bg-muted transition">
            <Download className="h-4 w-4" /> {triggerLabel}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-border">
        <div className="grid grid-cols-[200px_1fr]">
          <div className="bg-muted/40 border-r border-border p-5">
            <p className="text-[10px] font-bold tracking-widest text-sky-500 mb-4">PRESETS</p>
            <div className="space-y-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={cn(
                    "w-full h-10 rounded-xl border text-sm font-semibold transition-all text-left px-4",
                    activePreset === p.id ? "border-sky-500 bg-sky-500/10 text-sky-500" : "border-border bg-card hover:border-sky-500/40",
                  )}
                >{p.label}</button>
              ))}
            </div>
          </div>
          <div className="p-6 relative">
            <h2 className="text-2xl font-bold mb-5">{title}</h2>
            <div className="grid grid-cols-2 gap-6">
              <MonthGrid month={month1} range={{ from, to }} onPick={pickDay} />
              <MonthGrid month={month2} range={{ from, to }} onPick={pickDay} />
            </div>
            <div className="border-t border-border mt-6 pt-4 flex items-center justify-between">
              <p className="text-xs font-bold tracking-widest text-sky-500">
                RANGE: {from ? format(from, "MMM dd").toUpperCase() : "—"} - {to ? format(to, "MMM dd, yyyy").toUpperCase() : "—"}
              </p>
              <div className="flex items-center gap-3">
                <button onClick={() => setOpen(false)} className="h-10 px-5 text-sm font-bold hover:bg-muted rounded-xl transition">Cancel</button>
                <button onClick={handleExport} className="h-11 px-6 rounded-full bg-gradient-to-r from-sky-400 to-sky-500 text-white text-sm font-bold inline-flex items-center gap-2 hover:shadow-lg hover:shadow-sky-500/40 transition-all">
                  <Download className="h-4 w-4" /> Apply &amp; Export
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuditExportDialog;
