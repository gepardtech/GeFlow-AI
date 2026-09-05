import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import UserPanelGate from "@/components/UserPanelGate";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LifeBuoy,
  Plus,
  Loader2,
  Send,
  MessageSquare,
  ArrowLeft,
  Sparkles,
  Bot,
  CheckCircle2,
  HelpCircle,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Printer,
  Camera,
  RotateCcw,
  BookOpen,
  Headphones,
} from "lucide-react";
import SupportAIAssistant from "@/components/ai/SupportAIAssistant";

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
}

interface Message {
  id: string;
  ticket_id: string;
  author_user_id: string;
  is_admin: boolean;
  body: string;
  created_at: string;
}

const statusBadge = (s: string) => {
  switch (s.toLowerCase()) {
    case "open":
      return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
    case "pending":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "resolved":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "closed":
      return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const priorityBadge = (p: string) => {
  switch (p.toLowerCase()) {
    case "high":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    case "medium":
      return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
    case "low":
    default:
      return "bg-slate-500/10 text-slate-500 border-slate-500/20";
  }
};

const LIVE_TROUBLESHOOT_TOPICS = [
  {
    icon: Printer,
    title: "Thermal Printer & Receipts",
    desc: "80mm ESC/POS hardware setup, silent printing & logo settings",
    subject: "Thermal Printer & ESC/POS Configuration",
    category: "technical",
    message: "How do I configure my 80mm thermal receipt printer and enable automatic drawer kicks in the POS?",
    quickFix:
      "1. Go to Settings > POS & Receipts to set 80mm thermal width and receipt header/footer.\n2. Ensure your USB printer is set as default in browser print dialog with 'Silent Printing' enabled.\n3. Run a test print in POS > Receipt Preview to verify alignment.",
  },
  {
    icon: Camera,
    title: "Barcode Scanner & Vision AI",
    desc: "USB HID scanner emulation or live camera vision recognition",
    subject: "Barcode Scanner Integration",
    category: "technical",
    message: "My barcode scanner or camera vision is not recognizing barcodes in the POS terminal.",
    quickFix:
      "1. USB Scanners: Ensure scanner is set to HID Keyboard Mode with Auto-Enter suffix enabled.\n2. Camera Scanning: In POS terminal, switch mode to 'By Image' and allow camera access permissions.\n3. Make sure product SKUs and barcodes match the inventory master list.",
  },
  {
    icon: RotateCcw,
    title: "Returns & Stock Restocking",
    desc: "Process customer refunds and auto-revert inventory quantities",
    subject: "Refund and Stock Return Processing",
    category: "general",
    message: "How do I process a past order refund and return items to active stock?",
    quickFix:
      "1. Navigate to POS > Past Orders / Sales Ledger.\n2. Locate the sale record by Receipt ID or Customer Name.\n3. Click 'Initiate Return / Refund' and toggle 'Restock Items' to increment product stock units automatically.",
  },
  {
    icon: BookOpen,
    title: "Tax & Regional VAT Setup",
    desc: "Inclusive/exclusive tax calculation & currency decimals",
    subject: "Tax Rate & Regional Configuration",
    category: "general",
    message: "How do I set standard business tax percentage and decimal formatting?",
    quickFix:
      "1. Open Settings > Business & Regional Configuration.\n2. Adjust default tax percentage (0% to 100%) and select your currency.\n3. In Inventory, individual products can also specify custom tax rates if exempt.",
  },
];

const UserSupport = () => {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [active, setActive] = useState<Ticket | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"tickets" | "ai_assistant">("tickets");
  const [supportAiOpen, setSupportAiOpen] = useState(false);

  const [form, setForm] = useState({
    subject: "",
    category: "general",
    priority: "medium",
    message: "",
  });
  const [aiDiagnosing, setAiDiagnosing] = useState(false);
  const [aiSolution, setAiSolution] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const handleAiQuickAssist = () => {
    if (!form.subject.trim() && !form.message.trim()) {
      toast({ title: "Please enter a subject or issue description first", variant: "destructive" });
      return;
    }
    setAiDiagnosing(true);
    setTimeout(() => {
      const q = (form.subject + " " + form.message).toLowerCase();
      let sol = "Maryam AI Live Diagnostic Guide:\n\n";
      if (q.includes("printer") || q.includes("receipt") || q.includes("thermal")) {
        sol += "1. **Thermal Printer Configuration**: Open Settings > POS & Receipts to set 80mm ESC/POS layout.\n2. **Browser Print Dialog**: Enable 'Background graphics' and set default printer to your receipt device.\n3. **Quick Test**: Perform a test transaction on the POS screen to confirm receipt generation.";
      } else if (q.includes("barcode") || q.includes("scanner") || q.includes("sku") || q.includes("camera")) {
        sol += "1. **Barcode Scanner**: Connect USB scanner in HID Keyboard Emulation mode with carriage return (Enter).\n2. **Vision Mode**: Use the 'By Image' tab on POS to snap a photo or scan visual labels.\n3. **SKU Generator**: Use 'Auto SKU' in Inventory to auto-generate unique 8-character product codes.";
      } else if (q.includes("tax") || q.includes("vat") || q.includes("gst")) {
        sol += "1. **Store Tax Rate**: Configure global tax percentage in Settings > Regional & Currency.\n2. **Per-Item Overrides**: Set tax exemptions in Inventory > Edit Product.";
      } else if (q.includes("refund") || q.includes("return")) {
        sol += "1. **Returns Workflow**: Go to POS > Past Orders, click 'Return', and toggle restock checkbox.\n2. **Financial Sync**: Net sales and profit will automatically reflect the refund in real-time.";
      } else if (q.includes("business") || q.includes("branch") || q.includes("limit")) {
        sol += "1. **Store Switching**: Use the Workspace Switcher in the top sidebar to toggle between owned stores and staff roles.\n2. **Plan Limits**: Free: 1 Store | Standard: 3 Stores | Premium: 7 Stores | Lifetime: 10 Stores.";
      } else {
        sol += "1. **Workspace Sync**: Press the Refresh icon in the top navigation bar to synchronize real-time records.\n2. **Role Permissions**: Check Team Hub to verify that your staff user role (Manager, Cashier, Inventory) has permission for this module.\n3. **Human Staff Review**: Submit this ticket below for priority assistance from human support.";
      }
      setAiSolution(sol);
      setAiDiagnosing(false);
    }, 500);
  };

  const loadTickets = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("support_tickets")
      .select("id, ticket_number, subject, category, priority, status, created_at")
      .eq("owner_user_id", uid)
      .order("created_at", { ascending: false });
    setTickets((data as Ticket[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let ch: any = null;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      loadTickets(user.id);
      ch = supabase
        .channel(`user_tickets_rt_${user.id}_${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "support_tickets", filter: `owner_user_id=eq.${user.id}` },
          () => loadTickets(user.id)
        )
        .subscribe();
    })();
    return () => {
      if (ch) supabase.removeChannel(ch);
    };
  }, [loadTickets]);

  // Thread messages
  useEffect(() => {
    if (!active) return;
    const load = async () => {
      const { data } = await supabase
        .from("ticket_messages")
        .select("id, ticket_id, author_user_id, is_admin, body, created_at")
        .eq("ticket_id", active.id)
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) ?? []);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    };
    load();
    const ch = supabase
      .channel(`ticket_msgs_${active.id}_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${active.id}` },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [active]);

  const createTicket = async () => {
    if (!userId) return;
    if (!form.subject.trim() || !form.message.trim()) {
      toast({ title: "Subject and message are required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({
        owner_user_id: userId,
        subject: form.subject.trim(),
        category: form.category,
        priority: form.priority,
        source: "user_panel",
      })
      .select("id, ticket_number, subject, category, priority, status, created_at")
      .single();

    if (error || !ticket) {
      setSubmitting(false);
      toast({ title: "Could not create ticket", description: error?.message, variant: "destructive" });
      return;
    }
    await supabase.from("ticket_messages").insert({
      ticket_id: ticket.id,
      author_user_id: userId,
      is_admin: false,
      body: form.message.trim(),
    });
    setSubmitting(false);
    setOpen(false);
    setForm({ subject: "", category: "general", priority: "medium", message: "" });
    setAiSolution(null);
    toast({ title: "Ticket Submitted Successfully", description: `Reference number: ${ticket.ticket_number}` });
    loadTickets(userId);
  };

  const sendReply = async () => {
    if (!userId || !active || !reply.trim()) return;
    const body = reply.trim();
    setReply("");
    const { error } = await supabase
      .from("ticket_messages")
      .insert({ ticket_id: active.id, author_user_id: userId, is_admin: false, body });
    if (error) {
      toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
      setReply(body);
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSub = t.subject.toLowerCase().includes(q);
        const matchNum = t.ticket_number.toLowerCase().includes(q);
        const matchCat = t.category.toLowerCase().includes(q);
        if (!matchSub && !matchNum && !matchCat) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const openCount = tickets.filter((t) => t.status === "open").length;
    const pendingCount = tickets.filter((t) => t.status === "pending").length;
    const resolvedCount = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;
    return { total, openCount, pendingCount, resolvedCount };
  }, [tickets]);

  return (
    <UserPanelGate pageTitle="Support">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Support & Helpdesk
              </h1>
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-500 border border-sky-500/20">
                Live Support
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Submit support tickets, chat with human staff in real time, or use Support AI for instant technical and hardware resolution.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => setSupportAiOpen(true)}
              className="h-11 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs gap-2"
            >
              <LifeBuoy className="w-4 h-4" /> Ask Support AI
            </Button>
            <Button
              onClick={() => setOpen(true)}
              className="h-11 px-4 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-xs gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Ticket
            </Button>
          </div>
        </div>

        {/* Stats Metrics (3 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                  OPEN TICKETS
                </p>
                <p className="text-xl font-black text-foreground mt-0.5">{stats.openCount}</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-muted-foreground">{stats.total} Total</span>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                  PENDING REVIEW
                </p>
                <p className="text-xl font-black text-foreground mt-0.5">{stats.pendingCount}</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-amber-500">In Progress</span>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                  RESOLVED
                </p>
                <p className="text-xl font-black text-foreground mt-0.5">{stats.resolvedCount}</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-emerald-500">Completed</span>
          </div>
        </div>

        {/* Support AI Instant Self-Service Hub */}
        <div className="p-5 rounded-3xl bg-card border border-border shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-xs">
                <LifeBuoy className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-foreground">GeFlow Support AI — Technical Helpdesk</h3>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Hardware & Setup
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Instant guidance for thermal printing (ESC/POS), barcode scanners, POS returns, inventory restock & multi-tenant access.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setSupportAiOpen(true)}
              className="h-9 px-3.5 rounded-xl text-xs font-bold gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            >
              <LifeBuoy className="w-3.5 h-3.5" /> Launch Support AI Assistant
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {LIVE_TROUBLESHOOT_TOPICS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setForm({
                      subject: item.subject,
                      category: item.category,
                      priority: "medium",
                      message: item.message,
                    });
                    setAiSolution(item.quickFix);
                    setOpen(true);
                  }}
                  className="p-3.5 rounded-2xl bg-muted/30 hover:bg-muted/60 border border-border text-left transition flex flex-col justify-between group"
                >
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-background border border-border flex items-center justify-center text-foreground group-hover:text-sky-500 transition-colors mb-2.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="font-bold text-xs text-foreground leading-snug">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-sky-500 mt-2 flex items-center gap-1 group-hover:underline">
                    Quick solution & ticket →
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tickets Section: Controls & Search */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search tickets by subject or number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 pl-10 rounded-2xl bg-card border-border text-xs sm:text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11 w-40 rounded-2xl bg-card border-border text-xs font-semibold">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ticket Listing */}
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-sky-500" />
              <p className="text-xs text-muted-foreground mt-2">Loading support tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="bg-card border border-border rounded-3xl p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground mb-3">
                <LifeBuoy className="w-6 h-6" />
              </div>
              <p className="font-bold text-foreground">No Support Tickets Found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchQuery || statusFilter !== "all"
                  ? "No tickets match your active filter criteria."
                  : "Need help with hardware, reports, or account configuration? Create a ticket and our team will assist you."}
              </p>
              <Button
                onClick={() => setOpen(true)}
                className="mt-4 h-10 px-5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Ticket
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActive(t)}
                  className="w-full text-left bg-card border border-border rounded-2xl p-4 sm:p-5 hover:bg-muted/30 transition flex items-center gap-4 shadow-2xs group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-foreground text-sm truncate">{t.subject}</p>
                      <span className="font-mono text-[10px] font-extrabold bg-muted px-2 py-0.5 rounded-md border border-border text-foreground">
                        {t.ticket_number}
                      </span>
                    </div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">
                      {t.category} • {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${priorityBadge(
                        t.priority
                      )}`}
                    >
                      {t.priority}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusBadge(
                        t.status
                      )}`}
                    >
                      {t.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal: New Ticket Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg p-6 sm:p-7 rounded-3xl bg-card border-border shadow-2xl">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                    New Support Ticket
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Describe your question or issue and our team will respond rapidly.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                  SUBJECT
                </Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Printer thermal formatting issue"
                  className="h-11 rounded-2xl bg-card border-border text-xs sm:text-sm mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                    CATEGORY
                  </Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                  >
                    <SelectTrigger className="h-11 rounded-2xl bg-card border-border text-xs sm:text-sm mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="technical">Technical / POS Hardware</SelectItem>
                      <SelectItem value="inventory">Inventory & Stock</SelectItem>
                      <SelectItem value="billing">Billing & Subscription</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                    PRIORITY
                  </Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                  >
                    <SelectTrigger className="h-11 rounded-2xl bg-card border-border text-xs sm:text-sm mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High (Urgent)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                    DETAILED MESSAGE
                  </Label>
                  <button
                    type="button"
                    onClick={handleAiQuickAssist}
                    disabled={aiDiagnosing}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {aiDiagnosing ? "Diagnosing with Maryam AI..." : "Ask Maryam AI Quick Solution"}
                  </button>
                </div>
                <Textarea
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Explain what is happening or what assistance is required..."
                  className="rounded-2xl bg-card border-border text-xs sm:text-sm"
                />
              </div>

              {/* Instant AI Solution Preview */}
              {aiSolution && (
                <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-xs text-foreground space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between font-bold text-violet-700 dark:text-violet-300">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-violet-500" /> Maryam AI Live Recommendation
                    </span>
                    <button
                      type="button"
                      onClick={() => setAiSolution(null)}
                      className="text-muted-foreground hover:text-foreground text-xs p-1"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="prose prose-xs dark:prose-invert max-w-none text-[11px] text-muted-foreground leading-relaxed prose-headings:font-bold prose-headings:text-foreground prose-strong:text-foreground prose-strong:font-bold">
                    <ReactMarkdown>{aiSolution}</ReactMarkdown>
                  </div>
                </div>
              )}

              <Button
                onClick={createTicket}
                disabled={submitting}
                className="w-full h-11 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-xs"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {submitting ? "Submitting..." : "Submit Ticket to Support Team"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal: Ticket Conversation Thread */}
        <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
          <DialogContent className="max-w-xl p-0 overflow-hidden rounded-3xl bg-card border-border shadow-2xl">
            {active && (
              <>
                <DialogHeader className="p-4 sm:p-5 border-b border-border bg-muted/20">
                  <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                    <button
                      onClick={() => setActive(null)}
                      className="h-7 w-7 rounded-lg hover:bg-muted inline-flex items-center justify-center md:hidden"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    {active.subject}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-2 pt-1">
                    <span className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded border border-border text-foreground font-bold">
                      {active.ticket_number}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadge(
                        active.status
                      )}`}
                    >
                      {active.status}
                    </span>
                  </DialogDescription>
                </DialogHeader>

                <div className="max-h-[50vh] overflow-y-auto p-4 sm:p-5 space-y-3 bg-muted/10">
                  {messages.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-8">
                      No messages recorded in this conversation yet.
                    </p>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={`flex ${m.is_admin ? "justify-start" : "justify-end"}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs ${
                            m.is_admin
                              ? "bg-card border border-border text-foreground shadow-2xs"
                              : "bg-sky-500 text-white shadow-2xs"
                          }`}
                        >
                          <p className="text-[9px] font-extrabold uppercase tracking-widest opacity-80 mb-1">
                            {m.is_admin ? "GeFlow Support Team" : "You"}
                          </p>
                          <div className="prose prose-xs max-w-none text-xs leading-relaxed">
                            <ReactMarkdown>{m.body}</ReactMarkdown>
                          </div>
                          <p
                            className={`text-[9px] mt-1.5 ${
                              m.is_admin ? "text-muted-foreground" : "text-white/80"
                            }`}
                          >
                            {new Date(m.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={endRef} />
                </div>

                <div className="p-3 sm:p-4 border-t border-border flex items-center gap-2 bg-card">
                  <Input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                    placeholder="Type your reply to the support team..."
                    className="h-11 rounded-2xl bg-card border-border text-xs"
                  />
                  <Button
                    onClick={sendReply}
                    disabled={!reply.trim()}
                    className="h-11 px-4 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Persistent Floating Support AI Assistant Quick-Launch Button */}
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            onClick={() => setSupportAiOpen(true)}
            className="h-12 px-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2.5 border border-emerald-400/30"
          >
            <LifeBuoy className="w-4 h-4 animate-spin-slow text-emerald-200" />
            <span className="text-xs">Ask Support AI</span>
          </Button>
        </div>

        {/* Support AI Dedicated Assistant Modal */}
        <SupportAIAssistant open={supportAiOpen} onOpenChange={setSupportAiOpen} />
      </div>
    </UserPanelGate>
  );
};

export default UserSupport;
