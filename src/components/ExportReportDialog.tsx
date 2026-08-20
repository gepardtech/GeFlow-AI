import { useState } from "react";
import { Calendar as CalendarIcon, Download, FileDown, Sparkles, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface AdminMetrics {
  totalUsers: number;
  activeUsers: number;
  mrr: number;
  aiUsage: number;
  systemHealth: number;
  openTickets: number;
  // For period filtering of users (created_at) and tickets (created_at)
  usersCreatedAt: string[];
  ticketsCreatedAt: string[];
  ticketsRead: boolean[];
  usersUsage: number[];
  usersPlan: string[];
  usersLastActive?: string[];
}

interface Props {
  metrics: AdminMetrics;
  filename?: string;
}

const PLAN_PRICES: Record<string, number> = { free: 0, standard: 29, premium: 79, unlimited: 0, lifetime: 0 };

const csvEscape = (v: any) => {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
};

const ExportReportDialog = ({ metrics, filename = "geflow-admin-report" }: Props) => {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>();
  const { toast } = useToast();

  const handleExport = () => {
    if (!range?.from || !range?.to) {
      toast({ title: "Pick a date range", description: "Select both a start and end date.", variant: "destructive" });
      return;
    }
    const start = range.from.getTime();
    const end = range.to.getTime() + 24 * 60 * 60 * 1000 - 1;

    // Period-filtered totals
    const periodUserIdx = metrics.usersCreatedAt
      .map((c, i) => ({ t: new Date(c).getTime(), i }))
      .filter((x) => x.t >= start && x.t <= end)
      .map((x) => x.i);

    const periodTotalUsers = periodUserIdx.length;

    // Active in last 24h within period (using last_active if provided, else created_at)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const lastActives = metrics.usersLastActive ?? metrics.usersCreatedAt;
    const periodActive = lastActives
      .map((d) => new Date(d).getTime())
      .filter((t) => t >= Math.max(start, dayAgo) && t <= end).length;

    const periodMRR = periodUserIdx.reduce((s, i) => s + (PLAN_PRICES[metrics.usersPlan[i]] ?? 0), 0);
    const periodAIUsage = periodUserIdx.reduce((s, i) => s + (metrics.usersUsage[i] ?? 0), 0);

    const periodTickets = metrics.ticketsCreatedAt
      .map((c, i) => ({ t: new Date(c).getTime(), i }))
      .filter((x) => x.t >= start && x.t <= end);
    const openTickets = periodTickets.filter((x) => !metrics.ticketsRead[x.i]).length;

    const headers = [
      "Report Date",
      "Period Start",
      "Period End",
      "Total Users",
      "Active Users (24h)",
      "MRR ($)",
      "AI Usage (Calls)",
      "System Health (%)",
      "Open Support Tickets",
    ];

    const row = [
      format(new Date(), "yyyy-MM-dd HH:mm:ss"),
      format(range.from, "yyyy-MM-dd"),
      format(range.to, "yyyy-MM-dd"),
      periodTotalUsers,
      periodActive,
      periodMRR.toFixed(2),
      periodAIUsage,
      metrics.systemHealth.toFixed(2),
      openTickets,
    ];

    const csv = [
      `# GeFlow Admin Report`,
      `# Generated: ${new Date().toISOString()}`,
      `# Period: ${format(range.from, "yyyy-MM-dd")} → ${format(range.to, "yyyy-MM-dd")}`,
      ``,
      headers.join(","),
      row.map(csvEscape).join(","),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${format(range.from, "yyyyMMdd")}-${format(range.to, "yyyyMMdd")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({ title: "Report downloaded", description: "Your CSV report is ready." });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="h-10 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 text-white text-sm font-bold inline-flex items-center gap-2 hover:shadow-xl hover:shadow-sky-500/30 hover:-translate-y-0.5 transition-all">
          <FileDown className="h-4 w-4" /> Export Report
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-sky-500 via-blue-500 to-violet-500 p-6 text-white">
          <div className="inline-flex items-center gap-2 text-[10px] font-bold tracking-widest bg-white/20 px-2.5 py-1 rounded-full mb-3">
            <Sparkles className="h-3 w-3" /> ADMIN INSIGHTS
          </div>
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-2xl text-white">Export Performance Report</DialogTitle>
            <DialogDescription className="text-white/85 text-sm">
              Generate a professional CSV with platform KPIs for the selected period.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">REPORT INCLUDES</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {["Report Date", "Period Start", "Period End", "Total Users", "Active Users (24h)", "MRR ($)", "AI Usage (Calls)", "System Health (%)", "Open Support Tickets"].map((c) => (
                <div key={c} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                  <span className="font-medium">{c}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">DATE RANGE</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-medium h-11", !range && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {range?.from ? (
                    range.to ? `${format(range.from, "LLL dd, y")} → ${format(range.to, "LLL dd, y")}` : format(range.from, "LLL dd, y")
                  ) : "Pick a date range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <Button onClick={handleExport} className="w-full h-11 bg-gradient-to-r from-sky-500 to-violet-500 hover:shadow-lg hover:shadow-sky-500/30 transition-all" size="lg">
            <Download className="h-4 w-4 mr-2" /> Apply &amp; Download CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportReportDialog;
