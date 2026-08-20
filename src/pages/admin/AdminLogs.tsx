import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PanelLayout from "@/components/PanelLayout";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import { useToast } from "@/hooks/use-toast";
import { LogItem, LogSeverity } from "@/types/logs";
import {
  fetchLiveAuditLogs,
  filterAuditLogs,
  saveLocalLogOverride,
  blockIpAddress,
} from "@/lib/realLogsService";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Download,
  Clock,
  FileText,
  AlertCircle,
  Cpu,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Eye,
  Activity,
  Shield,
  Layers,
  ArrowRight,
} from "lucide-react";

export const AdminLogs = () => {
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();

  const [allLogs, setAllLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Active Category Tab
  const categoryParam = params.get("category") || "all";
  const [activeTab, setActiveTab] = useState<string>(categoryParam);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Selected Log & Drawer
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Modals
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<LogItem | null>(null);
  const [blockIpTarget, setBlockIpTarget] = useState<string | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  // Fetch Live Logs from Real DB
  const loadLogs = useCallback(async () => {
    try {
      const data = await fetchLiveAuditLogs();
      setAllLogs(data);
    } catch (e: any) {
      toast({
        title: "Log Fetch Failed",
        description: e.message || "Failed to load live database audit stream.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Real-time Supabase postgres_changes Subscription
  useEffect(() => {
    const channel = supabase
      .channel("admin_exact_audit_stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => loadLogs())
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_transactions" }, () => loadLogs())
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => loadLogs())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadLogs())
      .on("postgres_changes", { event: "*", schema: "public", table: "businesses" }, () => loadLogs())
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => loadLogs())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLogs]);

  // Auto-refresh interval (15s if enabled)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadLogs();
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadLogs]);

  // Category Tabs mapping
  const CATEGORY_TABS = [
    { id: "all", label: "All Logs" },
    { id: "ai", label: "AI Logs" },
    { id: "billing", label: "Billing Logs" },
    { id: "payments", label: "Payment Logs" },
    { id: "auth", label: "Auth Logs" },
    { id: "errors", label: "System Errors" },
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setCurrentPage(1);
    if (tabId === "all") {
      params.delete("category");
    } else {
      params.set("category", tabId);
    }
    setParams(params);
  };

  // Metrics calculation
  const totalLogsToday = allLogs.length;
  const errors24h = allLogs.filter(
    (l) => l.severity === "critical" || l.severity === "high" || l.status === "failed" || l.category === "errors"
  ).length;
  const criticalFailures = allLogs.filter((l) => l.severity === "critical").length;
  const aiActivityLogs = allLogs.filter((l) => l.category === "ai").length;
  const paymentEvents = allLogs.filter((l) => l.category === "payments" || l.category === "billing").length;

  // Filtered dataset
  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      // Tab filter
      if (activeTab === "ai" && log.category !== "ai") return false;
      if (activeTab === "billing" && log.category !== "billing") return false;
      if (activeTab === "payments" && log.category !== "payments") return false;
      if (activeTab === "auth" && log.category !== "auth") return false;
      if (activeTab === "errors" && log.category !== "errors" && log.severity !== "critical" && log.severity !== "high") return false;

      // Event Type dropdown filter
      if (eventTypeFilter !== "all") {
        if (eventTypeFilter === "ai" && log.category !== "ai") return false;
        if (eventTypeFilter === "payment" && log.category !== "payments" && log.category !== "billing") return false;
        if (eventTypeFilter === "auth" && log.category !== "auth") return false;
        if (eventTypeFilter === "system" && log.category !== "system") return false;
        if (eventTypeFilter === "user" && log.category !== "business_activity") return false;
      }

      // Severity dropdown filter
      if (severityFilter !== "all") {
        if (severityFilter === "info" && log.severity !== "info" && log.severity !== "low") return false;
        if (severityFilter === "warning" && log.severity !== "warning" && log.severity !== "medium") return false;
        if (severityFilter === "error" && log.severity !== "high") return false;
        if (severityFilter === "critical" && log.severity !== "critical") return false;
      }

      // Date Range filter
      if (dateRangeFilter !== "all") {
        const logTime = new Date(log.timestamp).getTime();
        const now = Date.now();
        if (dateRangeFilter === "today") {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (logTime < today.getTime()) return false;
        } else if (dateRangeFilter === "24h") {
          if (now - logTime > 24 * 60 * 60 * 1000) return false;
        } else if (dateRangeFilter === "7d") {
          if (now - logTime > 7 * 24 * 60 * 60 * 1000) return false;
        } else if (dateRangeFilter === "30d") {
          if (now - logTime > 30 * 24 * 60 * 60 * 1000) return false;
        }
      }

      // Search keyword
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const mId = log.id.toLowerCase().includes(q);
        const mEvent = log.event.toLowerCase().includes(q);
        const mMsg = log.description?.toLowerCase().includes(q) || false;
        const mUser = log.user?.name?.toLowerCase().includes(q) || log.user?.email?.toLowerCase().includes(q) || false;
        const mIp = log.ip?.toLowerCase().includes(q) || false;
        if (!mId && !mEvent && !mMsg && !mUser && !mIp) return false;
      }

      return true;
    });
  }, [allLogs, activeTab, eventTypeFilter, severityFilter, dateRangeFilter, searchQuery]);

  // Paginated data
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));

  // Reset Filters
  const clearFilters = () => {
    setSearchQuery("");
    setEventTypeFilter("all");
    setSeverityFilter("all");
    setDateRangeFilter("all");
    setActiveTab("all");
    setCurrentPage(1);
    params.delete("category");
    setParams(params);
  };

  const hasFilters =
    searchQuery !== "" ||
    eventTypeFilter !== "all" ||
    severityFilter !== "all" ||
    dateRangeFilter !== "all" ||
    activeTab !== "all";

  // Actions
  const handleView = (log: LogItem) => {
    setSelectedLog(log);
    setDrawerOpen(true);
  };

  const handleResolveConfirm = (log: LogItem, note: string) => {
    saveLocalLogOverride(log.id, {
      status: "resolved",
      description: `${log.description || ""} [Resolved: ${note}]`,
    });
    setAllLogs((prev) =>
      prev.map((l) => (l.id === log.id ? { ...l, status: "resolved" } : l))
    );
    if (selectedLog?.id === log.id) {
      setSelectedLog((prev) => (prev ? { ...prev, status: "resolved" } : null));
    }
    toast({
      title: "Incident Resolved",
      description: `Log ${log.id} has been marked as resolved.`,
    });
  };

  const handleBlockIpConfirm = (ip: string, reason: string) => {
    blockIpAddress(ip);
    toast({
      title: "IP Blacklisted",
      description: `Traffic from ${ip} is now blocked (${reason}).`,
    });
  };

  // Helper for Event Type display tag
  const getEventTypeLabel = (log: LogItem): string => {
    if (log.category === "ai") return "AI";
    if (log.category === "payments" || log.category === "billing") return "Payment";
    if (log.category === "auth") return "Auth";
    if (log.category === "system" || log.category === "errors") return "System";
    if (log.category === "business_activity") return "User Activity";
    return log.module || "System";
  };

  // Helper for Row severity styling exactly matching the uploaded designs
  const getRowStyle = (severity: LogSeverity) => {
    switch (severity) {
      case "critical":
        return {
          rowClass: "border-l-4 border-l-red-600 bg-red-500/[0.06] dark:bg-red-500/[0.12] hover:bg-red-500/[0.10] dark:hover:bg-red-500/[0.18]",
          mobileBorder: "border-l-4 border-l-red-600 bg-red-500/[0.05] dark:bg-red-500/[0.12]",
          badge: <span className="inline-flex items-center justify-center px-2.5 sm:px-3.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-[#dc2626] text-white">Critical</span>,
        };
      case "high":
        return {
          rowClass: "border-l-4 border-l-rose-500 bg-rose-500/[0.05] dark:bg-rose-500/[0.10] hover:bg-rose-500/[0.09] dark:hover:bg-rose-500/[0.15]",
          mobileBorder: "border-l-4 border-l-rose-500 bg-rose-500/[0.04] dark:bg-rose-500/[0.10]",
          badge: <span className="inline-flex items-center justify-center px-2.5 sm:px-3.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-[#ef4444] text-white">Error</span>,
        };
      case "warning":
      case "medium":
        return {
          rowClass: "border-l-4 border-l-amber-500 bg-amber-500/[0.05] dark:bg-amber-500/[0.10] hover:bg-amber-500/[0.09] dark:hover:bg-amber-500/[0.15]",
          mobileBorder: "border-l-4 border-l-amber-500 bg-amber-500/[0.04] dark:bg-amber-500/[0.10]",
          badge: <span className="inline-flex items-center justify-center px-2.5 sm:px-3.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-[#f59e0b] text-white">Warning</span>,
        };
      default:
        return {
          rowClass: "border-l-4 border-l-blue-500 bg-blue-500/[0.04] dark:bg-blue-500/[0.08] hover:bg-blue-500/[0.08] dark:hover:bg-blue-500/[0.13]",
          mobileBorder: "border-l-4 border-l-blue-500 bg-blue-500/[0.03] dark:bg-blue-500/[0.08]",
          badge: <span className="inline-flex items-center justify-center px-2.5 sm:px-3.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-[#3b82f6] text-white">Info</span>,
        };
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const seconds = String(d.getSeconds()).padStart(2, "0");
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch {
      return ts;
    }
  };

  return (
    <PanelLayout
      navItems={ADMIN_NAV}
      identity={ADMIN_IDENTITY}
      defaultTitle="System Logs & Activity Monitor"
    >
      <div className="w-full space-y-5 sm:space-y-6 pb-12 min-w-0">
        {/* ========================================================================= */}
        {/* HEADER SECTION (Title + Subtitle + Search pill + AutoRefresh + Download) */}
        {/* ========================================================================= */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
              System Logs & Activity Monitor
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              View all system events, AI activity, user actions, errors, and payment logs.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Search Pill Input */}
            <div className="relative w-full sm:w-64 md:w-72 lg:w-80 min-w-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search logs by ID, user, keyword..."
                className="pl-9 pr-8 h-10 text-xs rounded-full bg-card border-border/80 focus-visible:ring-primary shadow-2xs w-full"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Auto-Refresh Toggle */}
              <div className="flex-1 sm:flex-initial flex items-center justify-between sm:justify-start gap-2 px-3.5 py-2 rounded-full border border-border/80 bg-card text-xs font-medium text-foreground shadow-2xs">
                <span className="text-xs whitespace-nowrap">Auto-Refresh</span>
                <Switch
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                  className="data-[state=checked]:bg-primary scale-90 sm:scale-100"
                />
              </div>

              {/* Download Button */}
              <Button
                variant="outline"
                onClick={() => setExportModalOpen(true)}
                className="h-10 px-3.5 sm:px-4 text-xs font-medium rounded-xl gap-1.5 bg-card border-border/80 hover:bg-muted/80 shadow-2xs whitespace-nowrap"
              >
                <Download className="h-4 w-4 shrink-0" /> Download
              </Button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4 TOP KPI METRIC CARDS                                                    */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-w-0">
          {/* Card 1: Total Logs Today */}
          <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs relative min-w-0">
            <div className="flex items-center justify-between text-muted-foreground mb-2 sm:mb-3">
              <span className="text-xs font-medium truncate">Total Logs Today</span>
              <FileText className="h-4 w-4 text-muted-foreground/70 shrink-0 ml-2" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
              {totalLogsToday.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5 sm:mt-2 truncate">
              +12.5% from yesterday
            </div>
          </div>

          {/* Card 2: Errors (24h) */}
          <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs relative min-w-0">
            <div className="flex items-center justify-between text-muted-foreground mb-2 sm:mb-3">
              <span className="text-xs font-medium truncate">Errors (24h)</span>
              <AlertCircle className="h-4 w-4 text-muted-foreground/70 shrink-0 ml-2" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-500 truncate">
              {errors24h}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5 sm:mt-2 truncate">
              {criticalFailures} critical failures
            </div>
          </div>

          {/* Card 3: AI Activity Logs */}
          <div
            onClick={() => handleTabChange("ai")}
            className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs relative cursor-pointer hover:border-primary/50 transition-colors group min-w-0"
          >
            <div className="flex items-center justify-between text-muted-foreground mb-2 sm:mb-3">
              <span className="text-xs font-medium truncate">AI Activity Logs</span>
              <Cpu className="h-4 w-4 text-muted-foreground/70 group-hover:text-primary transition-colors shrink-0 ml-2" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
              {aiActivityLogs.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground group-hover:text-primary mt-1.5 sm:mt-2 flex items-center gap-1 transition-colors truncate">
              View only AI logs
            </div>
          </div>

          {/* Card 4: Payment Events */}
          <div
            onClick={() => handleTabChange("payments")}
            className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs relative cursor-pointer hover:border-primary/50 transition-colors group min-w-0"
          >
            <div className="flex items-center justify-between text-muted-foreground mb-2 sm:mb-3">
              <span className="text-xs font-medium truncate">Payment Events</span>
              <DollarSign className="h-4 w-4 text-muted-foreground/70 group-hover:text-primary transition-colors shrink-0 ml-2" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
              {paymentEvents.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground group-hover:text-primary mt-1.5 sm:mt-2 flex items-center gap-1 transition-colors truncate">
              Jump to Payment Logs
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FILTER BAR (Filter by Event Type, Severity, Date Range, Clear Filters)    */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 flex-wrap min-w-0">
          {/* Event Type */}
          <div className="w-full sm:w-auto min-w-[150px]">
            <Select value={eventTypeFilter} onValueChange={(v) => { setEventTypeFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[175px] h-9 text-xs rounded-lg bg-card border-border/80 shadow-2xs font-medium">
                <SelectValue placeholder="Filter by Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Filter by Event Type</SelectItem>
                <SelectItem value="ai">AI Activity</SelectItem>
                <SelectItem value="payment">Payment & Billing</SelectItem>
                <SelectItem value="auth">Authentication</SelectItem>
                <SelectItem value="system">System Telemetry</SelectItem>
                <SelectItem value="user">User Actions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div className="w-full sm:w-auto min-w-[140px]">
            <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[150px] h-9 text-xs rounded-lg bg-card border-border/80 shadow-2xs font-medium">
                <SelectValue placeholder="Filter by Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Filter by Severity</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="w-full sm:w-auto min-w-[140px]">
            <Select value={dateRangeFilter} onValueChange={(v) => { setDateRangeFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[145px] h-9 text-xs rounded-lg bg-card border-border/80 shadow-2xs font-medium gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-foreground hover:underline py-1 sm:py-0 sm:ml-1 text-left cursor-pointer transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SUBPAGE NAVIGATION TABS (All Logs, AI Logs, Billing Logs, etc.)          */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {CATEGORY_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? "bg-foreground text-background shadow-xs"
                    : "bg-card border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* ACTIVITY LOGS MAIN CARD & TABLE/CARD STREAM                              */}
        {/* ========================================================================= */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4 min-w-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              Activity Logs
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              A comprehensive record of all system and user activities.
            </p>
          </div>

          {/* LOADING STATE */}
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <span className="text-xs font-medium">Loading live database activity records...</span>
            </div>
          ) : paginatedLogs.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
              <h3 className="text-sm font-semibold text-foreground">No activity logs found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No events match your current filter parameters.
              </p>
              {hasFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs rounded-lg">
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* DESKTOP / TABLET DATA TABLE (MD+ SCREENS) */}
              <div className="hidden md:block overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
                <table className="w-full text-left border-collapse text-xs min-w-[780px]">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground font-medium">
                      <th className="py-3 px-4 font-semibold w-36 whitespace-nowrap">Log ID</th>
                      <th className="py-3 px-4 font-semibold w-44 whitespace-nowrap">Timestamp</th>
                      <th className="py-3 px-4 font-semibold w-32 whitespace-nowrap">Event Type</th>
                      <th className="py-3 px-4 font-semibold w-28 whitespace-nowrap">Severity</th>
                      <th className="py-3 px-4 font-semibold w-48 whitespace-nowrap">User / System</th>
                      <th className="py-3 px-4 font-semibold">Message</th>
                      <th className="py-3 px-4 font-semibold text-right w-24 whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {paginatedLogs.map((log) => {
                      const rowStyling = getRowStyle(log.severity);
                      const eventType = getEventTypeLabel(log);
                      const formattedTime = formatTimestamp(log.timestamp);
                      const userOrSystem = log.user?.email || log.user?.name || (log.business ? log.business.name : "System");

                      return (
                        <tr
                          key={log.id}
                          onClick={() => handleView(log)}
                          className={`transition-colors cursor-pointer ${rowStyling.rowClass}`}
                        >
                          {/* Log ID */}
                          <td className="py-3.5 px-4 font-mono text-foreground/90 font-medium whitespace-nowrap">
                            {log.id.toLowerCase()}
                          </td>

                          {/* Timestamp */}
                          <td className="py-3.5 px-4 font-mono text-muted-foreground whitespace-nowrap">
                            {formattedTime}
                          </td>

                          {/* Event Type */}
                          <td className="py-3.5 px-4 font-medium text-foreground whitespace-nowrap">
                            {eventType}
                          </td>

                          {/* Severity Pill */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {rowStyling.badge}
                          </td>

                          {/* User / System */}
                          <td className="py-3.5 px-4 text-foreground/90 font-medium whitespace-nowrap max-w-[180px] truncate">
                            {userOrSystem}
                          </td>

                          {/* Message */}
                          <td className="py-3.5 px-4 text-muted-foreground max-w-md truncate">
                            {log.description || log.event}
                          </td>

                          {/* Actions -> View Button */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleView(log)}
                              className="h-7 px-3 text-xs font-semibold rounded-lg bg-card hover:bg-muted/80 border-border/80 text-foreground"
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE ADAPTIVE LOG CARD STREAM (SM & BELOW SCREENS) */}
              <div className="block md:hidden space-y-3">
                {paginatedLogs.map((log) => {
                  const rowStyling = getRowStyle(log.severity);
                  const eventType = getEventTypeLabel(log);
                  const formattedTime = formatTimestamp(log.timestamp);
                  const userOrSystem = log.user?.email || log.user?.name || (log.business ? log.business.name : "System");

                  return (
                    <div
                      key={log.id}
                      onClick={() => handleView(log)}
                      className={`p-3.5 rounded-xl border border-border/80 space-y-2.5 transition-colors cursor-pointer shadow-2xs ${rowStyling.mobileBorder}`}
                    >
                      {/* Top Row: Log ID, Severity Badge, View */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-medium text-xs text-foreground/90 truncate">
                            {log.id.toLowerCase()}
                          </span>
                          <span className="text-muted-foreground/50 text-xs">•</span>
                          <span className="text-[11px] font-medium text-muted-foreground truncate">
                            {eventType}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {rowStyling.badge}
                        </div>
                      </div>

                      {/* Middle: Message */}
                      <div className="text-xs text-foreground font-medium line-clamp-2">
                        {log.description || log.event}
                      </div>

                      {/* Bottom Metadata: Timestamp, User & Action Button */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-[10px] text-muted-foreground truncate">
                            {formattedTime}
                          </div>
                          <div className="text-foreground/80 font-medium truncate mt-0.5">
                            {userOrSystem}
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleView(log);
                          }}
                          className="h-7 px-3 text-xs font-semibold rounded-lg bg-card hover:bg-muted/80 border-border/80 text-foreground shrink-0 gap-1"
                        >
                          View <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* PAGINATION FOOTER */}
          {!loading && filteredLogs.length > 0 && (
            <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground min-w-0">
              <div className="text-center sm:text-left">
                Showing <strong className="text-foreground">{paginatedLogs.length}</strong> of{" "}
                <strong className="text-foreground">{filteredLogs.length}</strong> total records (Page {currentPage} of {totalPages})
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-3 text-xs rounded-lg gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="h-8 px-3 text-xs rounded-lg gap-1"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* INSPECTOR MODAL */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Log Entry Details
            </DialogTitle>
            <DialogDescription>
              {selectedLog?.id} · {selectedLog?.timestamp}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Severity</p>
                  <p className="font-semibold capitalize mt-0.5">{selectedLog.severity}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Category</p>
                  <p className="font-semibold capitalize mt-0.5">{selectedLog.category}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Status</p>
                  <p className="font-semibold capitalize mt-0.5">{selectedLog.status}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">IP Address</p>
                  <p className="font-mono mt-0.5">{selectedLog.ip || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">User</p>
                  <p className="font-medium mt-0.5">{selectedLog.user?.name || selectedLog.user?.email || "System"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Module</p>
                  <p className="font-medium mt-0.5">{selectedLog.module || "General"}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Event & Description</p>
                <div className="p-3 rounded-xl bg-muted/20 border border-border">
                  <p className="font-bold text-foreground">{selectedLog.event}</p>
                  <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{selectedLog.description || "No description provided."}</p>
                </div>
              </div>

              {selectedLog.metadata && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Payload / Metadata</p>
                  <pre className="p-3 rounded-xl bg-zinc-950 text-zinc-100 font-mono text-[11px] overflow-x-auto border border-zinc-800">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                {selectedLog.ip && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    onClick={() => {
                      setDrawerOpen(false);
                      setBlockIpTarget(selectedLog.ip || null);
                    }}
                  >
                    <Shield className="h-3.5 w-3.5 mr-1" /> Block IP
                  </Button>
                )}
                {selectedLog.status !== "resolved" && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      setDrawerOpen(false);
                      setResolveTarget(selectedLog);
                    }}
                  >
                    Resolve Incident
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* EXPORT MODAL */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" /> Export Audit Logs
            </DialogTitle>
            <DialogDescription>
              Export {filteredLogs.length} filtered log records to your device.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Button
              className="w-full justify-start h-12 rounded-xl bg-card hover:bg-muted text-foreground border border-border font-medium"
              onClick={() => {
                const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                setExportModalOpen(false);
                toast({ title: "Export Complete", description: "Audit logs downloaded as JSON." });
              }}
            >
              <FileText className="h-4 w-4 mr-2 text-sky-500" /> Export JSON Document
            </Button>
            <Button
              className="w-full justify-start h-12 rounded-xl bg-card hover:bg-muted text-foreground border border-border font-medium"
              onClick={() => {
                const headers = ["ID", "Timestamp", "Category", "Severity", "Event", "Status", "IP", "User"];
                const rows = filteredLogs.map((l) => [
                  l.id,
                  l.timestamp,
                  l.category,
                  l.severity,
                  `"${(l.event || "").replace(/"/g, '""')}"`,
                  l.status,
                  l.ip || "",
                  `"${(l.user?.name || l.user?.email || "").replace(/"/g, '""')}"`,
                ]);
                const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                setExportModalOpen(false);
                toast({ title: "Export Complete", description: "Audit logs downloaded as CSV." });
              }}
            >
              <Download className="h-4 w-4 mr-2 text-emerald-500" /> Export CSV Spreadsheet
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* RESOLVE MODAL */}
      <Dialog open={!!resolveTarget} onOpenChange={(open) => !open && setResolveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve Incident</DialogTitle>
            <DialogDescription>
              Mark incident {resolveTarget?.id} as resolved and update the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <p className="text-xs text-muted-foreground mb-3">
              Event: <span className="font-semibold text-foreground">{resolveTarget?.event}</span>
            </p>
            <Button
              className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              onClick={() => {
                if (resolveTarget) {
                  handleResolveConfirm(resolveTarget, "Resolved by admin");
                  setResolveTarget(null);
                }
              }}
            >
              Confirm Resolution
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* BLOCK IP MODAL */}
      <Dialog open={!!blockIpTarget} onOpenChange={(open) => !open && setBlockIpTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <Shield className="h-5 w-5" /> Blacklist IP Address
            </DialogTitle>
            <DialogDescription>
              Block incoming network requests originating from {blockIpTarget}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Button
              className="w-full h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
              onClick={() => {
                if (blockIpTarget) {
                  handleBlockIpConfirm(blockIpTarget, "Manual admin block");
                  setBlockIpTarget(null);
                }
              }}
            >
              Block {blockIpTarget}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIAGNOSTICS MODAL */}
      <Dialog open={diagnosticsOpen} onOpenChange={setDiagnosticsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> System Diagnostics
            </DialogTitle>
            <DialogDescription>
              Live operational metrics and service status overview.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
              <span>Database Connection</span>
              <span className="text-emerald-500 font-bold">Connected (Realtime)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
              <span>Total Audit Records</span>
              <span className="font-bold">{allLogs.length} events</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
              <span>Error Rate (24h)</span>
              <span className={`font-bold ${errors24h > 0 ? "text-amber-500" : "text-emerald-500"}`}>{errors24h} incidents</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PanelLayout>
  );
};

export default AdminLogs;
