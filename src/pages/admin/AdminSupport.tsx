import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllContactSubmissions, markLocalContactSubmissionRead, deleteLocalContactSubmission, ContactSubmissionRecord } from "@/lib/contactService";
import PanelLayout from "@/components/PanelLayout";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import {
  Search, MessageSquareReply, Megaphone, BookOpen, Users, Bot,
  LifeBuoy, Eye, Send, Plus, Pencil, Trash2, Loader2, X, Sparkles, Activity, Shield, Clock, Mail, CheckCircle2,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from "recharts";

type Ticket = {
  id: string; ticket_number: string; owner_user_id: string; subject: string;
  category: string; priority: string; status: string; created_at: string; updated_at: string;
  resolved_at: string | null;
  owner?: { full_name: string | null; email: string | null; plan: string | null } | null;
};

type Template = { id: string; title: string; body: string; category: string; is_default: boolean; created_at: string };
type Announcement = {
  id: string; title: string; body: string; audience: string; position: string; variant: string;
  link_url: string | null; link_label: string | null; starts_at: string; ends_at: string | null; is_active: boolean;
};
type KB = { id: string; question: string; answer: string; category: string; page_assignments: string[]; is_active: boolean; sort_order: number };
type Member = { id: string; user_id: string; role: string; is_active: boolean; created_at: string; profile?: { full_name: string | null; email: string | null } | null };
type Automation = {
  id: string; auto_reply_enabled: boolean; auto_reply_template_id: string | null;
  auto_feedback_reply_enabled: boolean; auto_feedback_template_ids: string[];
  ai_auto_reply_enabled: boolean; ai_auto_reply_after_hours: number;
};

const priorityClass = (p: string) => ({
  urgent: "bg-rose-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-blue-500 text-white",
  low: "bg-slate-400 text-white",
}[p] ?? "bg-slate-400 text-white");

const statusClass = (s: string) => ({
  open: "bg-emerald-400/15 text-emerald-500",
  in_progress: "bg-sky-400/15 text-sky-500",
  waiting: "bg-amber-400/15 text-amber-600",
  resolved: "bg-slate-400/15 text-slate-500",
  closed: "bg-slate-400/15 text-slate-500",
}[s] ?? "bg-slate-400/15 text-slate-500");

const AdminSupport = () => {
  const { toast } = useToast();

  // ---------- TICKETS ----------
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [contactSubmissions, setContactSubmissions] = useState<ContactSubmissionRecord[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [priorityF, setPriorityF] = useState("all");

  const loadTickets = useCallback(async () => {
    const [tktRes, contactMsgs] = await Promise.all([
      supabase.from("support_tickets").select("*").order("created_at", { ascending: false }),
      fetchAllContactSubmissions(),
    ]);
    setContactSubmissions(contactMsgs || []);
    const list = (tktRes.data ?? []) as any[];
    if (list.length === 0) { setTickets([]); setLoadingTickets(false); return; }
    const ids = Array.from(new Set(list.map((t) => t.owner_user_id)));
    const { data: profs } = await supabase.from("profiles").select("user_id, full_name, email, plan").in("user_id", ids);
    const map = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
    setTickets(list.map((t) => ({ ...t, owner: map.get(t.owner_user_id) ?? null })));
    setLoadingTickets(false);
  }, []);

  // ---------- TEMPLATES ----------
  const [templates, setTemplates] = useState<Template[]>([]);
  const loadTemplates = useCallback(async () => {
    const { data } = await supabase.from("reply_templates").select("*").order("created_at", { ascending: false });
    setTemplates((data as Template[]) ?? []);
  }, []);

  // ---------- ANNOUNCEMENTS ----------
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const loadAnnouncements = useCallback(async () => {
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    setAnnouncements((data as Announcement[]) ?? []);
  }, []);

  // ---------- KB ----------
  const [kb, setKb] = useState<KB[]>([]);
  const loadKb = useCallback(async () => {
    const { data } = await supabase.from("knowledge_base_articles").select("*").order("sort_order");
    setKb((data as KB[]) ?? []);
  }, []);

  // ---------- TEAM ----------
  const [team, setTeam] = useState<Member[]>([]);
  const loadTeam = useCallback(async () => {
    const { data } = await supabase.from("support_team_members").select("*").order("created_at", { ascending: false });
    const list = (data ?? []) as any[];
    if (list.length === 0) { setTeam([]); return; }
    const ids = Array.from(new Set(list.map((t) => t.user_id)));
    const { data: profs } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids);
    const map = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
    setTeam(list.map((t) => ({ ...t, profile: map.get(t.user_id) ?? null })));
  }, []);

  // ---------- AUTOMATION ----------
  const [automation, setAutomation] = useState<Automation | null>(null);
  const loadAutomation = useCallback(async () => {
    const { data } = await supabase.from("support_automation_settings").select("*").limit(1).maybeSingle();
    setAutomation(data as any);
  }, []);

  useEffect(() => {
    loadTickets(); loadTemplates(); loadAnnouncements(); loadKb(); loadTeam(); loadAutomation();
    const onSubChange = () => loadTickets();
    window.addEventListener("geflow:contact-submission-added", onSubChange);
    window.addEventListener("geflow:contact-submission-updated", onSubChange);
    window.addEventListener("geflow:contact-submission-deleted", onSubChange);
    const ch = supabase.channel("admin_support_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, loadTickets)
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_submissions" }, loadTickets)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_messages" }, loadTickets)
      .on("postgres_changes", { event: "*", schema: "public", table: "reply_templates" }, loadTemplates)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, loadAnnouncements)
      .on("postgres_changes", { event: "*", schema: "public", table: "knowledge_base_articles" }, loadKb)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_team_members" }, loadTeam)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_automation_settings" }, loadAutomation)
      .subscribe();
    return () => {
      window.removeEventListener("geflow:contact-submission-added", onSubChange);
      window.removeEventListener("geflow:contact-submission-updated", onSubChange);
      window.removeEventListener("geflow:contact-submission-deleted", onSubChange);
      supabase.removeChannel(ch);
    };
  }, [loadTickets, loadTemplates, loadAnnouncements, loadKb, loadTeam, loadAutomation]);

  // KPIs
  const kpis = useMemo(() => {
    const open = tickets.filter((t) => t.status === "open").length;
    const inProgress = tickets.filter((t) => t.status === "in_progress").length;
    const high = tickets.filter((t) => ["urgent", "high"].includes(t.priority) && t.status !== "resolved" && t.status !== "closed").length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const resolvedToday = tickets.filter((t) => t.resolved_at && new Date(t.resolved_at) >= today).length;
    const resolved = tickets.filter((t) => t.resolved_at);
    const avg = resolved.length
      ? (resolved.reduce((s, t) => s + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()), 0) / resolved.length / 3600000).toFixed(1)
      : "0.0";
    return { open, inProgress, high, resolvedToday, avg };
  }, [tickets]);

  const filteredTickets = useMemo(() => tickets.filter((t) => {
    if (statusF !== "all" && t.status !== statusF) return false;
    if (priorityF !== "all" && t.priority !== priorityF) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.ticket_number.toLowerCase().includes(q)
        && !t.subject.toLowerCase().includes(q)
        && !(t.owner?.full_name ?? "").toLowerCase().includes(q)
        && !(t.owner?.email ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  }), [tickets, statusF, priorityF, search]);

  // Ticket detail / reply dialog
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [selectedContact, setSelectedContact] = useState<ContactSubmissionRecord | null>(null);
  const [delTicket, setDelTicket] = useState<Ticket | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deleteTicket = async () => {
    if (!delTicket) return;
    setDeleting(true);
    await supabase.from("ticket_messages").delete().eq("ticket_id", delTicket.id);
    const { error } = await supabase.from("support_tickets").delete().eq("id", delTicket.id);
    setDeleting(false);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Ticket deleted" });
    setDelTicket(null);
    loadTickets();
  };

  // ---- popups ----
  const [tplOpen, setTplOpen] = useState(false);
  const [annOpen, setAnnOpen] = useState(false);

  // Insights data
  const volume = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const map: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
    tickets.forEach((t) => {
      const d = days[(new Date(t.created_at).getDay() + 6) % 7];
      map[d] += 1;
    });
    return days.map((d) => ({ day: d, value: map[d] }));
  }, [tickets]);

  const issueCats = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t) => { map[t.category] = (map[t.category] ?? 0) + 1; });
    const COLORS = ["#38bdf8", "#c084fc", "#10b981", "#f59e0b", "#6366f1", "#ef4444"];
    return Object.entries(map).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
  }, [tickets]);

  return (
    <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY} isAdmin>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1">Support Operations</h1>
          <p className="text-sm text-muted-foreground">Orchestrate user resolutions, agent workloads, and system-wide complaints.</p>
        </div>
        <div className="inline-flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/30 text-emerald-600 dark:text-emerald-400 px-3 py-2 rounded-xl">
          <Activity className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold tracking-widest">SYSTEM PULSE: HEALTHY</span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi icon={LifeBuoy} iconClass="text-emerald-500 bg-emerald-400/15" label="OPEN TICKETS" value={kpis.open} chip={`+${Math.min(kpis.open, 9)}`} chipClass="bg-muted text-muted-foreground" />
        <Kpi icon={Activity} iconClass="text-sky-500 bg-sky-400/15" label="IN PROGRESS" value={kpis.inProgress} chip="STABLE" chipClass="bg-muted text-muted-foreground" />
        <Kpi icon={Shield} iconClass="text-rose-500 bg-rose-400/15" label="HIGH PRIORITY" value={kpis.high} chip={`-${Math.max(1, Math.floor(kpis.high / 2))}`} chipClass="bg-muted text-muted-foreground" />
        <Kpi icon={Clock} iconClass="text-violet-500 bg-violet-400/15" label="AVG RESOLUTION" value={`${kpis.avg}h`} chip="OPTIMIZED" chipClass="bg-muted text-muted-foreground" />
      </div>

      {/* Top CTA */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID, User, or Subject..."
            className="h-12 w-full pl-11 pr-4 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <button onClick={() => setTplOpen(true)} className="h-12 px-5 rounded-xl bg-card border border-border text-sm font-bold inline-flex items-center gap-2 hover:bg-muted">
          <MessageSquareReply className="h-4 w-4" /> Reply Templates
        </button>
        <button onClick={() => setAnnOpen(true)} className="h-12 px-5 rounded-xl bg-sky-400 text-white text-sm font-bold inline-flex items-center gap-2 hover:bg-sky-500">
          <Megaphone className="h-4 w-4" /> Announcement
        </button>
      </div>

      <Tabs defaultValue="tickets">
        <TabsList className="bg-card border border-border rounded-xl p-1.5 inline-flex flex-wrap h-auto gap-1">
          <TabsTrigger value="tickets" className="data-[state=active]:bg-sky-400/15 data-[state=active]:text-sky-500 rounded-lg gap-2 font-bold"><LifeBuoy className="h-4 w-4" /> User Tickets</TabsTrigger>
          <TabsTrigger value="contacts" className="data-[state=active]:bg-sky-400/15 data-[state=active]:text-sky-500 rounded-lg gap-2 font-bold"><Mail className="h-4 w-4" /> Contact Messages ({contactSubmissions.filter(c => !c.is_read).length})</TabsTrigger>
          <TabsTrigger value="ann" className="rounded-lg gap-2 font-bold"><Megaphone className="h-4 w-4" /> Announcements</TabsTrigger>
          <TabsTrigger value="kb" className="rounded-lg gap-2 font-bold"><BookOpen className="h-4 w-4" /> Knowledge Base</TabsTrigger>
          <TabsTrigger value="team" className="rounded-lg gap-2 font-bold"><Users className="h-4 w-4" /> Support Team</TabsTrigger>
          <TabsTrigger value="auto" className="rounded-lg gap-2 font-bold"><Bot className="h-4 w-4" /> Automation</TabsTrigger>
          <TabsTrigger value="insights" className="rounded-lg gap-2 font-bold"><Sparkles className="h-4 w-4" /> Insights</TabsTrigger>
        </TabsList>

        {/* TICKETS */}
        <TabsContent value="tickets" className="mt-6">
          <div className="flex items-center gap-3 mb-4 justify-end flex-wrap">
            <Select value={statusF} onValueChange={setStatusF}>
              <SelectTrigger className="h-10 w-[160px] bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityF} onValueChange={setPriorityF}>
              <SelectTrigger className="h-10 w-[160px] bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border bg-muted/20">
                    <th className="text-left px-6 py-4">IDENTITY / ID</th>
                    <th className="text-left px-4 py-4">SUBJECT / CATEGORY</th>
                    <th className="text-center px-4 py-4">PRIORITY</th>
                    <th className="text-center px-4 py-4">STATUS</th>
                    <th className="text-right px-6 py-4">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingTickets ? (
                    <tr><td colSpan={5} className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
                  ) : filteredTickets.length === 0 ? (
                    <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">No support tickets yet.</td></tr>
                  ) : filteredTickets.map((t) => (
                    <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-sky-400/15 text-sky-500 flex items-center justify-center font-bold text-xs">
                            {(t.owner?.full_name ?? t.owner?.email ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold">{t.owner?.full_name ?? t.owner?.email ?? "Unknown"}</p>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                              {t.ticket_number} • {(t.owner?.plan ?? "free").toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold">{t.subject}</p>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">{t.category.replace("_", " ")}</p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${priorityClass(t.priority)}`}>{t.priority}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${statusClass(t.status)}`}>{t.status.replace("_", " ")}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-3">
                          <button onClick={() => setOpenTicket(t)} className="inline-flex items-center gap-1.5 text-sm font-bold text-sky-500 hover:underline">
                            <Eye className="h-4 w-4" /> View Detail
                          </button>
                          <button onClick={() => setDelTicket(t)} title="Delete ticket" className="h-8 w-8 rounded-lg hover:bg-rose-500/10 text-rose-500 inline-flex items-center justify-center">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* CONTACT MESSAGES */}
        <TabsContent value="contacts" className="mt-6">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border bg-muted/20">
                    <th className="text-left px-6 py-4">SENDER</th>
                    <th className="text-left px-4 py-4">MESSAGE PREVIEW</th>
                    <th className="text-center px-4 py-4">STATUS</th>
                    <th className="text-center px-4 py-4">RECEIVED</th>
                    <th className="text-right px-6 py-4">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {contactSubmissions.length === 0 ? (
                    <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">No contact messages received yet.</td></tr>
                  ) : contactSubmissions.filter((c) => {
                    if (!search) return true;
                    const q = search.toLowerCase();
                    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.message.toLowerCase().includes(q);
                  }).map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-sky-400/15 text-sky-500 flex items-center justify-center font-bold text-xs">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold flex items-center gap-1.5">
                              {c.name}
                              {!c.is_read && <span className="h-2 w-2 rounded-full bg-sky-500 inline-block" />}
                            </p>
                            <p className="text-xs text-muted-foreground">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 max-w-md">
                        <p className="text-sm line-clamp-2 text-foreground font-medium">{c.message}</p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                          c.is_read ? "bg-muted text-muted-foreground" : "bg-sky-500 text-white"
                        }`}>
                          {c.is_read ? "Read" : "New"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(c.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedContact(c);
                              markLocalContactSubmissionRead(c.id, true);
                              supabase.from("contact_submissions").update({ is_read: true }).eq("id", c.id);
                              loadTickets();
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-sky-400/15 text-sky-500 hover:bg-sky-400/25"
                          >
                            <Eye className="h-3.5 w-3.5" /> Read
                          </button>
                          <button
                            onClick={async () => {
                              deleteLocalContactSubmission(c.id);
                              await supabase.from("contact_submissions").delete().eq("id", c.id);
                              toast({ title: "Message removed" });
                              loadTickets();
                            }}
                            title="Delete message"
                            className="h-8 w-8 rounded-lg hover:bg-rose-500/10 text-rose-500 inline-flex items-center justify-center"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ANNOUNCEMENTS */}
        <TabsContent value="ann" className="mt-6">
          <AnnouncementsManager items={announcements} onChange={loadAnnouncements} openCreate={() => setAnnOpen(true)} />
        </TabsContent>

        {/* KB */}
        <TabsContent value="kb" className="mt-6">
          <KBManager items={kb} onChange={loadKb} />
        </TabsContent>

        {/* TEAM */}
        <TabsContent value="team" className="mt-6">
          <TeamManager items={team} onChange={loadTeam} />
        </TabsContent>

        {/* AUTOMATION */}
        <TabsContent value="auto" className="mt-6">
          <AutomationPanel value={automation} templates={templates} onChange={loadAutomation} />
        </TabsContent>

        {/* INSIGHTS */}
        <TabsContent value="insights" className="mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-2xl p-6">
              <p className="font-bold">Volume Velocity</p>
              <p className="text-sm text-muted-foreground mb-4">Daily support ticket influx.</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volume}>
                    <defs><linearGradient id="vv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8" stopOpacity={0.6} /><stop offset="100%" stopColor="#38bdf8" stopOpacity={0} /></linearGradient></defs>
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--foreground))" }} labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 700 }} itemStyle={{ color: "hsl(var(--foreground))" }} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
                    <Area dataKey="value" stroke="#38bdf8" fill="url(#vv)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6">
              <p className="font-bold">Issue Categorization</p>
              <p className="text-sm text-muted-foreground mb-4">Frequent architectural problems.</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={issueCats}>
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--foreground))" }} labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 700 }} itemStyle={{ color: "hsl(var(--foreground))" }} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {issueCats.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <TemplatesDialog open={tplOpen} onOpenChange={setTplOpen} templates={templates} onChange={loadTemplates} />
      <AnnouncementDialog open={annOpen} onOpenChange={setAnnOpen} onSaved={loadAnnouncements} />
      <TicketDialog open={!!openTicket} ticket={openTicket} templates={templates} onOpenChange={(o) => !o && setOpenTicket(null)} onUpdated={loadTickets} />

      <Dialog open={!!selectedContact} onOpenChange={(o) => !o && setSelectedContact(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-sky-400" />
              Contact Message from {selectedContact?.name}
            </DialogTitle>
            <DialogDescription>
              Received on {selectedContact?.created_at ? new Date(selectedContact.created_at).toLocaleString() : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted/40 rounded-xl border border-border flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Sender Email</p>
                <p className="font-semibold text-sm">{selectedContact?.email}</p>
              </div>
              <a
                href={`mailto:${selectedContact?.email}?subject=Regarding your message to GEFLOW`}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" /> Reply by Email
              </a>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Message Content</p>
              <div className="p-4 rounded-xl bg-card border border-border text-sm leading-relaxed whitespace-pre-wrap">
                {selectedContact?.message}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setSelectedContact(null)}
              className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-sm font-semibold"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delTicket} onOpenChange={(o) => !o && setDelTicket(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes ticket {delTicket?.ticket_number} and all of its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); deleteTicket(); }} disabled={deleting} className="bg-rose-500 hover:bg-rose-600 text-white">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Ticket"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PanelLayout>
  );
};

// ---------- KPI ----------
const Kpi = ({ icon: Icon, iconClass, label, value, chip, chipClass }: any) => (
  <div className="bg-card border border-border rounded-2xl p-5 relative">
    <div className="flex items-start justify-between">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${iconClass}`}><Icon className="h-4 w-4" /></div>
      <span className={`text-[10px] font-bold tracking-widest px-2 py-1 rounded-md ${chipClass}`}>{chip}</span>
    </div>
    <p className="text-[10px] font-bold tracking-widest text-muted-foreground mt-4">{label}</p>
    <p className="text-3xl font-bold mt-1">{value}</p>
  </div>
);

// ---------- TEMPLATES DIALOG (2-column) ----------
const TemplatesDialog = ({ open, onOpenChange, templates, onChange }: any) => {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Template | null>(null);
  const [form, setForm] = useState({ title: "", body: "", category: "general", is_default: false });
  const isNew = !sel;

  useEffect(() => {
    if (sel) setForm({ title: sel.title, body: sel.body, category: sel.category, is_default: sel.is_default });
    else setForm({ title: "", body: "", category: "general", is_default: false });
  }, [sel]);

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast({ title: "Title & body required", variant: "destructive" }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = { ...form, created_by_user_id: user.id };
    let error;
    if (sel) ({ error } = await supabase.from("reply_templates").update(payload).eq("id", sel.id));
    else ({ error } = await supabase.from("reply_templates").insert(payload));
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: sel ? "Template updated" : "Template created" });
    onChange(); setSel(null);
  };
  const del = async () => {
    if (!sel) return;
    await supabase.from("reply_templates").delete().eq("id", sel.id);
    toast({ title: "Template deleted" });
    onChange(); setSel(null);
  };

  const filtered = templates.filter((t: Template) => !q || t.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <DialogHeader className="p-5 border-b border-border"><DialogTitle>Reply Templates</DialogTitle><DialogDescription>Create canned responses agents can apply to tickets.</DialogDescription></DialogHeader>
        <div className="grid md:grid-cols-[280px_1fr] h-[520px]">
          <div className="border-r border-border flex flex-col min-h-0">
            <div className="p-3 border-b border-border">
              <div className="relative"><Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates..." className="h-9 w-full pl-9 pr-3 bg-muted/40 rounded-lg text-sm" /></div>
              <Button onClick={() => setSel(null)} variant="outline" size="sm" className="w-full mt-2 gap-1.5"><Plus className="h-3.5 w-3.5" /> New Template</Button>
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? <p className="p-4 text-xs text-muted-foreground text-center">No templates</p> :
                filtered.map((t: Template) => (
                  <button key={t.id} onClick={() => setSel(t)} className={`w-full text-left px-4 py-3 border-b border-border hover:bg-muted/40 ${sel?.id === t.id ? "bg-sky-400/10" : ""}`}>
                    <p className="text-sm font-bold truncate">{t.title}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{t.category}</p>
                  </button>
                ))
              }
            </div>
          </div>
          <div className="p-5 overflow-y-auto">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">{isNew ? "NEW TEMPLATE" : "EDIT TEMPLATE"}</p>
            <div className="space-y-3">
              <div><p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">TITLE</p><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></div>
              <div><p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">CATEGORY</p>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-10 bg-muted/40 border-0"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="general">General</SelectItem><SelectItem value="billing">Billing</SelectItem><SelectItem value="bug">Bug</SelectItem><SelectItem value="feature_request">Feature Request</SelectItem><SelectItem value="onboarding">Onboarding</SelectItem></SelectContent>
                </Select>
              </div>
              <div><p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">BODY</p><textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={8} className="w-full p-3 bg-muted/40 rounded-lg text-sm" /></div>
              <label className="flex items-center gap-2"><Switch checked={form.is_default} onCheckedChange={(v) => setForm((f) => ({ ...f, is_default: v }))} /><span className="text-xs font-bold">Use as default reply</span></label>
              <div className="flex gap-2 pt-2">
                <Button onClick={save} className="flex-1 bg-sky-400 hover:bg-sky-500 text-white"><Send className="h-4 w-4 mr-2" /> {isNew ? "Create" : "Save"}</Button>
                {!isNew && <Button onClick={del} variant="outline" className="text-rose-500"><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ---------- ANNOUNCEMENT DIALOG ----------
const AnnouncementDialog = ({ open, onOpenChange, onSaved, edit }: any) => {
  const { toast } = useToast();
  const [form, setForm] = useState<any>({ title: "", body: "", audience: "all", position: "top", variant: "info", link_url: "", link_label: "", starts_at: new Date().toISOString().slice(0, 16), ends_at: "", is_active: true });
  useEffect(() => {
    if (edit) setForm({
      title: edit.title, body: edit.body, audience: edit.audience, position: edit.position, variant: edit.variant,
      link_url: edit.link_url ?? "", link_label: edit.link_label ?? "",
      starts_at: edit.starts_at?.slice(0, 16) ?? "", ends_at: edit.ends_at?.slice(0, 16) ?? "", is_active: edit.is_active,
    });
    else setForm({ title: "", body: "", audience: "all", position: "top", variant: "info", link_url: "", link_label: "", starts_at: new Date().toISOString().slice(0, 16), ends_at: "", is_active: true });
  }, [edit, open]);
  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast({ title: "Title & body required", variant: "destructive" }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      title: form.title.trim(), body: form.body.trim(), audience: form.audience, position: form.position, variant: form.variant,
      link_url: form.link_url || null, link_label: form.link_label || null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      is_active: form.is_active, created_by_user_id: user.id,
    };
    let error;
    if (edit) ({ error } = await supabase.from("announcements").update(payload).eq("id", edit.id));
    else ({ error } = await supabase.from("announcements").insert(payload));
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: edit ? "Announcement updated" : "Announcement scheduled" });
    onSaved(); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{edit ? "Edit Announcement" : "New Announcement"}</DialogTitle><DialogDescription>Slide-style banner shown across selected audiences.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Lab label="TITLE"><input value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Lab>
          <Lab label="BODY"><textarea rows={3} value={form.body} onChange={(e) => setForm((f: any) => ({ ...f, body: e.target.value }))} className="w-full p-3 bg-muted/40 rounded-lg text-sm" /></Lab>
          <div className="grid grid-cols-3 gap-2">
            <Lab label="AUDIENCE"><Select value={form.audience} onValueChange={(v) => setForm((f: any) => ({ ...f, audience: v }))}><SelectTrigger className="h-10 bg-muted/40 border-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="public">Public Site</SelectItem><SelectItem value="users">User Panel</SelectItem><SelectItem value="admins">Admin Panel</SelectItem></SelectContent></Select></Lab>
            <Lab label="POSITION"><Select value={form.position} onValueChange={(v) => setForm((f: any) => ({ ...f, position: v }))}><SelectTrigger className="h-10 bg-muted/40 border-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="top">Top</SelectItem><SelectItem value="bottom">Bottom</SelectItem></SelectContent></Select></Lab>
            <Lab label="VARIANT"><Select value={form.variant} onValueChange={(v) => setForm((f: any) => ({ ...f, variant: v }))}><SelectTrigger className="h-10 bg-muted/40 border-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="info">Info</SelectItem><SelectItem value="success">Success</SelectItem><SelectItem value="warning">Warning</SelectItem><SelectItem value="promo">Promo</SelectItem></SelectContent></Select></Lab>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Lab label="LINK URL"><input value={form.link_url} onChange={(e) => setForm((f: any) => ({ ...f, link_url: e.target.value }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Lab>
            <Lab label="LINK LABEL"><input value={form.link_label} onChange={(e) => setForm((f: any) => ({ ...f, link_label: e.target.value }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Lab>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Lab label="STARTS AT"><input type="datetime-local" value={form.starts_at} onChange={(e) => setForm((f: any) => ({ ...f, starts_at: e.target.value }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Lab>
            <Lab label="ENDS AT (optional)"><input type="datetime-local" value={form.ends_at} onChange={(e) => setForm((f: any) => ({ ...f, ends_at: e.target.value }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Lab>
          </div>
          <label className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm((f: any) => ({ ...f, is_active: v }))} /><span className="text-xs font-bold">Active</span></label>
          <Button onClick={save} className="w-full bg-sky-400 hover:bg-sky-500 text-white">{edit ? "Save Changes" : "Schedule Announcement"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
const Lab = ({ label, children }: any) => (<div><p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">{label}</p>{children}</div>);

// ---------- TICKET REPLY DIALOG ----------
const TicketDialog = ({ open, ticket, templates, onOpenChange, onUpdated }: any) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");

  useEffect(() => {
    if (!ticket) return;
    setStatus(ticket.status); setPriority(ticket.priority); setReply("");
    (async () => {
      const { data } = await supabase.from("ticket_messages").select("*").eq("ticket_id", ticket.id).order("created_at");
      setMessages(data ?? []);
    })();
  }, [ticket]);

  const send = async () => {
    if (!reply.trim() || !ticket) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("ticket_messages").insert({ ticket_id: ticket.id, author_user_id: user.id, is_admin: true, body: reply.trim() });
    const updates: any = { status, priority };
    if (status === "resolved" && !ticket.resolved_at) updates.resolved_at = new Date().toISOString();
    await supabase.from("support_tickets").update(updates).eq("id", ticket.id);
    setReply(""); toast({ title: "Reply sent" });
    const { data } = await supabase.from("ticket_messages").select("*").eq("ticket_id", ticket.id).order("created_at");
    setMessages(data ?? []);
    onUpdated();
  };

  const saveMeta = async () => {
    if (!ticket) return;
    const updates: any = { status, priority };
    if (status === "resolved" && !ticket.resolved_at) updates.resolved_at = new Date().toISOString();
    await supabase.from("support_tickets").update(updates).eq("id", ticket.id);
    toast({ title: "Ticket updated" });
    onUpdated();
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-screen h-screen sm:rounded-none p-0 gap-0 flex flex-col border-0">
        {/* HEADER */}
        <DialogHeader className="px-5 md:px-8 py-4 border-b border-border bg-card shrink-0 text-left">
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-400/15 text-sky-500 flex items-center justify-center shrink-0">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg md:text-xl font-bold truncate">{ticket?.subject}</DialogTitle>
              <DialogDescription className="text-xs">
                {ticket?.ticket_number} • {ticket?.owner?.full_name ?? ticket?.owner?.email ?? "Unknown user"} •{" "}
                {ticket?.created_at ? new Date(ticket.created_at).toLocaleString() : ""}
              </DialogDescription>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full ${priorityClass(priority || ticket?.priority)}`}>
                {(priority || ticket?.priority || "").toUpperCase()}
              </span>
              <span className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full ${statusClass(status || ticket?.status)}`}>
                {(status || ticket?.status || "").replace("_", " ").toUpperCase()}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* CONVERSATION */}
          <div className="flex-1 min-w-0 flex flex-col bg-muted/20">
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
              {messages.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-16">No messages yet — your first reply starts the thread.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${m.is_admin ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] md:max-w-[65%] rounded-2xl px-4 py-3 border shadow-sm ${
                      m.is_admin ? "bg-sky-500 text-white border-sky-500 rounded-br-sm" : "bg-card text-foreground border-border rounded-bl-sm"
                    }`}>
                      <p className={`text-[10px] font-bold tracking-widest mb-1.5 ${m.is_admin ? "text-white/70" : "text-muted-foreground"}`}>
                        {m.is_admin ? "SUPPORT TEAM" : "CUSTOMER"} • {new Date(m.created_at).toLocaleString()}
                      </p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* COMPOSER */}
            <div className="border-t border-border bg-card px-4 md:px-8 py-4 space-y-3 shrink-0">
              <Select onValueChange={(id) => { const t = templates.find((x: any) => x.id === id); if (t) setReply(t.body); }}>
                <SelectTrigger className="h-9 w-full sm:w-[260px] bg-muted/40 border-0 text-xs"><SelectValue placeholder="Apply reply template..." /></SelectTrigger>
                <SelectContent>{templates.map((t: Template) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex items-end gap-3">
                <textarea
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Write a reply to the customer..."
                  className="flex-1 p-3 bg-muted/40 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-400/40 resize-none"
                />
                <Button onClick={send} disabled={!reply.trim()} className="h-11 px-5 bg-sky-500 hover:bg-sky-600 text-white">
                  <Send className="h-4 w-4 mr-2" /> Send
                </Button>
              </div>
            </div>
          </div>

          {/* SIDEBAR */}
          <aside className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card p-5 space-y-4 overflow-y-auto">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground">TICKET CONTROLS</p>
            <Lab label="STATUS">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 bg-muted/40 border-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem><SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem><SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </Lab>
            <Lab label="PRIORITY">
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9 bg-muted/40 border-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem><SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </Lab>
            <Button variant="outline" className="w-full" onClick={saveMeta}>Save changes</Button>

            <div className="pt-4 border-t border-border space-y-2 text-sm">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">CUSTOMER</p>
              <Row k="Name" v={ticket?.owner?.full_name ?? "—"} />
              <Row k="Email" v={ticket?.owner?.email ?? "—"} />
              <Row k="Plan" v={(ticket?.owner?.plan ?? "free").toUpperCase()} />
              <Row k="Category" v={ticket?.category ?? "—"} />
              <Row k="Source" v={ticket?.source ?? "panel"} />
              <Row k="Messages" v={String(messages.length)} />
              <Row k="Updated" v={ticket?.updated_at ? new Date(ticket.updated_at).toLocaleString() : "—"} />
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-xs text-muted-foreground">{k}</span>
    <span className="text-xs font-semibold text-right break-all">{v}</span>
  </div>
);

// ---------- ANNOUNCEMENTS MANAGER ----------
const AnnouncementsManager = ({ items, onChange, openCreate }: any) => {
  const { toast } = useToast();
  const [edit, setEdit] = useState<Announcement | null>(null);
  const del = async (id: string) => {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    onChange(); toast({ title: "Deleted" });
  };
  const toggle = async (a: Announcement) => {
    const next = !a.is_active;
    const { error } = await supabase.from("announcements").update({ is_active: next }).eq("id", a.id);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: next ? "Announcement activated" : "Announcement paused" });
    onChange();
  };
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {items.length === 0 ? <div className="p-12 text-center"><p className="text-muted-foreground text-sm">No announcements yet.</p><Button onClick={openCreate} className="mt-3 bg-sky-400 hover:bg-sky-500 text-white"><Plus className="h-4 w-4 mr-2" /> Create First</Button></div> :
        items.map((a: Announcement) => (
          <div key={a.id} className="border-b border-border last:border-0 p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap"><p className="font-bold">{a.title}</p>
                <span className="text-[10px] font-bold tracking-widest bg-muted px-2 py-0.5 rounded-full uppercase">{a.audience}</span>
                <span className="text-[10px] font-bold tracking-widest bg-muted px-2 py-0.5 rounded-full uppercase">{a.position}</span>
                <span className={`text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full ${a.is_active ? "bg-emerald-400/15 text-emerald-500" : "bg-muted text-muted-foreground"}`}>{a.is_active ? "ACTIVE" : "PAUSED"}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{a.body}</p>
              <p className="text-[10px] text-muted-foreground mt-1">From {new Date(a.starts_at).toLocaleString()}{a.ends_at ? ` → ${new Date(a.ends_at).toLocaleString()}` : ""}</p>
            </div>
            <Switch checked={a.is_active} onCheckedChange={() => toggle(a)} />
            <button onClick={() => setEdit(a)} className="h-8 w-8 rounded-lg hover:bg-muted inline-flex items-center justify-center"><Pencil className="h-3.5 w-3.5" /></button>
            <button onClick={() => del(a.id)} className="h-8 w-8 rounded-lg hover:bg-rose-500/10 text-rose-500 inline-flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))
      }
      <AnnouncementDialog open={!!edit} edit={edit} onOpenChange={(o: boolean) => !o && setEdit(null)} onSaved={onChange} />
    </div>
  );
};

// ---------- KB ----------
const KBManager = ({ items, onChange }: any) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<KB | null>(null);
  const [form, setForm] = useState<any>({ question: "", answer: "", category: "general", page_assignments: "", sort_order: 0, is_active: true });
  useEffect(() => {
    if (edit) setForm({ question: edit.question, answer: edit.answer, category: edit.category, page_assignments: (edit.page_assignments || []).join(", "), sort_order: edit.sort_order, is_active: edit.is_active });
    else setForm({ question: "", answer: "", category: "general", page_assignments: "", sort_order: 0, is_active: true });
  }, [edit, open]);
  const save = async () => {
    if (!form.question.trim() || !form.answer.trim()) { toast({ title: "Question & answer required", variant: "destructive" }); return; }
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const payload = {
      question: form.question.trim(), answer: form.answer.trim(), category: form.category,
      page_assignments: form.page_assignments.split(",").map((s: string) => s.trim()).filter(Boolean),
      sort_order: Number(form.sort_order), is_active: form.is_active, created_by_user_id: user.id,
    };
    let error;
    if (edit) ({ error } = await supabase.from("knowledge_base_articles").update(payload).eq("id", edit.id));
    else ({ error } = await supabase.from("knowledge_base_articles").insert(payload));
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: edit ? "Article updated" : "Article created" }); onChange(); setOpen(false); setEdit(null);
  };
  const del = async (id: string) => { await supabase.from("knowledge_base_articles").delete().eq("id", id); onChange(); toast({ title: "Deleted" }); };
  return (
    <div>
      <div className="flex justify-end mb-3"><Button onClick={() => { setEdit(null); setOpen(true); }} className="bg-sky-400 hover:bg-sky-500 text-white"><Plus className="h-4 w-4 mr-2" /> New Article</Button></div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {items.length === 0 ? <p className="p-12 text-center text-sm text-muted-foreground">No FAQ articles yet.</p> :
          items.map((k: KB) => (
            <div key={k.id} className="border-b border-border last:border-0 p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><p className="font-bold">{k.question}</p>
                  <span className="text-[10px] font-bold tracking-widest bg-muted px-2 py-0.5 rounded-full uppercase">{k.category}</span>
                  {(k.page_assignments || []).map((p) => <span key={p} className="text-[10px] font-bold tracking-widest bg-sky-400/15 text-sky-500 px-2 py-0.5 rounded-full">{p}</span>)}
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{k.answer}</p>
              </div>
              <Switch checked={k.is_active} onCheckedChange={async () => { await supabase.from("knowledge_base_articles").update({ is_active: !k.is_active }).eq("id", k.id); onChange(); }} />
              <button onClick={() => { setEdit(k); setOpen(true); }} className="h-8 w-8 rounded-lg hover:bg-muted inline-flex items-center justify-center"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => del(k.id)} className="h-8 w-8 rounded-lg hover:bg-rose-500/10 text-rose-500 inline-flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))
        }
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{edit ? "Edit Article" : "New FAQ Article"}</DialogTitle><DialogDescription>Assign to specific frontend pages by adding their slugs.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Lab label="QUESTION"><input value={form.question} onChange={(e) => setForm((f: any) => ({ ...f, question: e.target.value }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Lab>
            <Lab label="ANSWER"><textarea rows={5} value={form.answer} onChange={(e) => setForm((f: any) => ({ ...f, answer: e.target.value }))} className="w-full p-3 bg-muted/40 rounded-lg text-sm" /></Lab>
            <div className="grid grid-cols-2 gap-2">
              <Lab label="CATEGORY"><input value={form.category} onChange={(e) => setForm((f: any) => ({ ...f, category: e.target.value }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Lab>
              <Lab label="SORT"><input type="number" value={form.sort_order} onChange={(e) => setForm((f: any) => ({ ...f, sort_order: Number(e.target.value) }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Lab>
            </div>
            <Lab label="PAGE ASSIGNMENTS (comma separated, e.g. pricing, contact, features)"><input value={form.page_assignments} onChange={(e) => setForm((f: any) => ({ ...f, page_assignments: e.target.value }))} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Lab>
            <label className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm((f: any) => ({ ...f, is_active: v }))} /><span className="text-xs font-bold">Active</span></label>
            <Button onClick={save} className="w-full bg-sky-400 hover:bg-sky-500 text-white">{edit ? "Save Changes" : "Create Article"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ---------- TEAM ----------
const TeamManager = ({ items, onChange }: any) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [pickUser, setPickUser] = useState("");
  const [role, setRole] = useState("agent");
  useEffect(() => { (async () => { const { data } = await supabase.from("profiles").select("user_id, full_name, email").order("full_name"); setUsers(data ?? []); })(); }, [open]);
  const add = async () => {
    if (!pickUser) return;
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const { error } = await supabase.from("support_team_members").insert({ user_id: pickUser, role, appointed_by_user_id: user.id });
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Member appointed" }); onChange(); setOpen(false); setPickUser("");
  };
  const del = async (id: string) => { await supabase.from("support_team_members").delete().eq("id", id); onChange(); toast({ title: "Removed" }); };
  return (
    <div>
      <div className="flex justify-end mb-3"><Button onClick={() => setOpen(true)} className="bg-sky-400 hover:bg-sky-500 text-white"><Plus className="h-4 w-4 mr-2" /> Appoint Member</Button></div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {items.length === 0 ? <p className="p-12 text-center text-sm text-muted-foreground">No support team members yet.</p> :
          items.map((m: Member) => (
            <div key={m.id} className="border-b border-border last:border-0 p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-sky-400/15 text-sky-500 flex items-center justify-center font-bold">{(m.profile?.full_name ?? "?").charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0"><p className="font-bold">{m.profile?.full_name ?? "—"}</p><p className="text-xs text-muted-foreground">{m.profile?.email}</p></div>
              <span className="text-[10px] font-bold tracking-widest bg-muted px-2 py-0.5 rounded-full uppercase">{m.role}</span>
              <Switch checked={m.is_active} onCheckedChange={async () => { await supabase.from("support_team_members").update({ is_active: !m.is_active }).eq("id", m.id); onChange(); }} />
              <button onClick={() => del(m.id)} className="h-8 w-8 rounded-lg hover:bg-rose-500/10 text-rose-500 inline-flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))
        }
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Appoint Support Member</DialogTitle><DialogDescription>Promote a user to support agent.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Lab label="USER"><Select value={pickUser} onValueChange={setPickUser}><SelectTrigger className="h-10 bg-muted/40 border-0"><SelectValue placeholder="Pick user..." /></SelectTrigger><SelectContent>{users.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email}</SelectItem>)}</SelectContent></Select></Lab>
            <Lab label="ROLE"><Select value={role} onValueChange={setRole}><SelectTrigger className="h-10 bg-muted/40 border-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="agent">Agent</SelectItem><SelectItem value="lead">Lead</SelectItem><SelectItem value="manager">Manager</SelectItem></SelectContent></Select></Lab>
            <Button onClick={add} className="w-full bg-sky-400 hover:bg-sky-500 text-white">Appoint</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ---------- AUTOMATION ----------
const AutomationPanel = ({ value, templates, onChange }: any) => {
  const { toast } = useToast();
  const [v, setV] = useState<any>(null);
  useEffect(() => { setV(value); }, [value]);
  if (!v) return <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />;
  const save = async (patch: any) => {
    const next = { ...v, ...patch };
    setV(next);
    await supabase.from("support_automation_settings").update(patch).eq("id", v.id);
    toast({ title: "Automation updated" });
    onChange();
  };
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <AutoCard title="Auto Reply" icon={MessageSquareReply} desc="Instantly reply with a chosen template the moment a ticket is created.">
        <div className="flex items-center justify-between mb-3"><span className="text-xs font-bold">Enabled</span><Switch checked={v.auto_reply_enabled} onCheckedChange={(b) => save({ auto_reply_enabled: b })} /></div>
        <Lab label="TEMPLATE"><Select value={v.auto_reply_template_id ?? ""} onValueChange={(id) => save({ auto_reply_template_id: id })}><SelectTrigger className="h-10 bg-muted/40 border-0"><SelectValue placeholder="Pick template" /></SelectTrigger><SelectContent>{templates.map((t: Template) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent></Select></Lab>
      </AutoCard>
      <AutoCard title="Auto Feedback Reply" icon={Sparkles} desc="AI matches user feedback to one of the templates below and replies automatically.">
        <div className="flex items-center justify-between mb-3"><span className="text-xs font-bold">Enabled</span><Switch checked={v.auto_feedback_reply_enabled} onCheckedChange={(b) => save({ auto_feedback_reply_enabled: b })} /></div>
        <Lab label="TEMPLATE POOL">
          <div className="space-y-1.5 max-h-40 overflow-y-auto bg-muted/40 rounded-lg p-2">
            {templates.map((t: Template) => {
              const checked = v.auto_feedback_template_ids?.includes(t.id);
              return (
                <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={!!checked} onChange={() => {
                    const arr = new Set<string>(v.auto_feedback_template_ids ?? []);
                    if (checked) arr.delete(t.id); else arr.add(t.id);
                    save({ auto_feedback_template_ids: Array.from(arr) });
                  }} />
                  {t.title}
                </label>
              );
            })}
          </div>
        </Lab>
      </AutoCard>
      <AutoCard title="AI Powered Automation" icon={Bot} desc="If admins don't respond within the threshold, AI analyses the ticket and posts a best-guess reply.">
        <div className="flex items-center justify-between mb-3"><span className="text-xs font-bold">Enabled</span><Switch checked={v.ai_auto_reply_enabled} onCheckedChange={(b) => save({ ai_auto_reply_enabled: b })} /></div>
        <Lab label="REPLY AFTER (HOURS)"><input type="number" min={1} value={v.ai_auto_reply_after_hours} onChange={(e) => save({ ai_auto_reply_after_hours: Number(e.target.value) })} className="h-10 w-full px-3 bg-muted/40 rounded-lg text-sm" /></Lab>
      </AutoCard>
    </div>
  );
};
const AutoCard = ({ title, icon: Icon, desc, children }: any) => (
  <div className="bg-card border border-border rounded-2xl p-5">
    <div className="flex items-center gap-2 mb-1"><Icon className="h-4 w-4 text-sky-500" /><p className="font-bold">{title}</p></div>
    <p className="text-xs text-muted-foreground mb-4">{desc}</p>
    {children}
  </div>
);

export default AdminSupport;
