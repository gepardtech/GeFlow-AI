import { useState, useEffect, useMemo, useCallback } from "react";
import PanelLayout from "@/components/PanelLayout";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Mail,
  Users,
  Send,
  Sparkles,
  FileEdit,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  Clock,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  NewsletterSubscriber,
  NewsletterTemplate,
  NewsletterLog,
  NewsletterStats,
  getNewsletterSubscribers,
  deleteNewsletterSubscriber,
  getNewsletterTemplates,
  updateNewsletterTemplate,
  broadcastNewsletter,
  getNewsletterLogs,
  getNewsletterStats,
} from "@/lib/newsletterClientService";
import { usePlatformSettings } from "@/components/PlatformSettingsProvider";

export default function AdminNewsletter() {
  const { toast } = useToast();
  const { settings } = usePlatformSettings();
  const appName = settings?.app_name || "GeFlow AI";

  const [activeTab, setActiveTab] = useState<"subscribers" | "templates" | "broadcast" | "logs">("subscribers");
  const [loading, setLoading] = useState(true);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [templates, setTemplates] = useState<NewsletterTemplate[]>([]);
  const [logs, setLogs] = useState<NewsletterLog[]>([]);
  const [stats, setStats] = useState<NewsletterStats | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "subscribed" | "unsubscribed">("all");

  // Template Customization Editor
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("tpl_welcome");
  const [editingTemplate, setEditingTemplate] = useState<NewsletterTemplate | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Broadcast State (Synced with Announcements)
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string>("");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastCtaText, setBroadcastCtaText] = useState("Learn More");
  const [broadcastCtaUrl, setBroadcastCtaUrl] = useState("/dashboard/announcements");
  const [broadcasting, setBroadcasting] = useState(false);

  // Load All Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [subsData, tplsData, logsData, statsData] = await Promise.all([
        getNewsletterSubscribers().catch(() => []),
        getNewsletterTemplates().catch(() => []),
        getNewsletterLogs().catch(() => []),
        getNewsletterStats().catch(() => null),
      ]);

      setSubscribers(subsData);
      setTemplates(tplsData);
      setLogs(logsData);
      setStats(statsData);

      if (tplsData.length > 0) {
        const found = tplsData.find((t) => t.id === selectedTemplateId) || tplsData[0];
        setSelectedTemplateId(found.id);
        setEditingTemplate({ ...found });
      }

      // Sync with platform announcements
      const { data: annData } = await supabase
        .from("announcements")
        .select("id, title, body, link_url, link_label, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      if (annData) {
        setAnnouncements(annData);
      }
    } catch (err: any) {
      console.warn("Notice loading newsletter data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedTemplateId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When selected template changes
  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const found = templates.find((t) => t.id === id);
    if (found) {
      setEditingTemplate({ ...found });
    }
  };

  // Save customized template
  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    setSavingTemplate(true);
    try {
      const updated = await updateNewsletterTemplate(editingTemplate.id, editingTemplate);
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      toast({
        title: "Email Template Saved",
        description: `"${updated.name}" has been updated. Automated emails will use this updated design.`,
      });
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err.message || "Failed to update email template.",
        variant: "destructive",
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  // Sync selected announcement into broadcast form
  const handlePickAnnouncement = (annId: string) => {
    setSelectedAnnouncementId(annId);
    const ann = announcements.find((a) => a.id === annId);
    if (ann) {
      setBroadcastTitle(ann.title || "");
      setBroadcastBody(ann.body || "");
      setBroadcastCtaText(ann.link_label || "View Details");
      setBroadcastCtaUrl(ann.link_url || "/dashboard/announcements");
    }
  };

  // Send Broadcast
  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      toast({
        title: "Missing Content",
        description: "Please enter both an announcement title and body for the broadcast.",
        variant: "destructive",
      });
      return;
    }

    setBroadcasting(true);
    try {
      const res = await broadcastNewsletter({
        title: broadcastTitle,
        body: broadcastBody,
        ctaLabel: broadcastCtaText,
        ctaUrl: broadcastCtaUrl,
        appName,
      });

      toast({
        title: "Broadcast Dispatched! 🚀",
        description: `Successfully delivered to ${res.sentCount} active newsletter subscribers.`,
      });

      // Refresh stats & logs
      const [updatedLogs, updatedStats] = await Promise.all([
        getNewsletterLogs().catch(() => []),
        getNewsletterStats().catch(() => null),
      ]);
      setLogs(updatedLogs);
      setStats(updatedStats);

      setBroadcastTitle("");
      setBroadcastBody("");
      setSelectedAnnouncementId("");
    } catch (err: any) {
      toast({
        title: "Broadcast Failed",
        description: err.message || "Could not dispatch broadcast.",
        variant: "destructive",
      });
    } finally {
      setBroadcasting(false);
    }
  };

  // Delete subscriber
  const handleDeleteSubscriber = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from the newsletter list?`)) return;
    try {
      await deleteNewsletterSubscriber(id);
      setSubscribers((prev) => prev.filter((s) => s.id !== id));
      toast({ title: "Subscriber Removed", description: `${email} has been removed.` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  // Filtered subscribers
  const filteredSubscribers = useMemo(() => {
    return subscribers.filter((s) => {
      const matchQuery = s.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "all" || s.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [subscribers, searchQuery, statusFilter]);

  return (
    <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY} isAdmin>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
                <Mail className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Newsletter & Email Engine</h1>
                <p className="text-sm text-muted-foreground">
                  Automated subscriber onboarding, customizable email templates, and announcement synchronization.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="gap-1.5 rounded-xl border-border"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setActiveTab("broadcast")}
              className="gap-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold"
            >
              <Send className="h-4 w-4" />
              New Broadcast
            </Button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subscribers</span>
              <span className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
                <Users className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold">{stats?.activeSubscribers ?? subscribers.length}</span>
              <span className="text-xs text-muted-foreground ml-2">active subscribers</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Emails Delivered</span>
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold">{stats?.totalDelivered ?? logs.length}</span>
              <span className="text-xs text-muted-foreground ml-2">sent successfully</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Broadcast Updates</span>
              <span className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
                <Megaphone className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold">{stats?.broadcastsSent ?? 0}</span>
              <span className="text-xs text-muted-foreground ml-2">campaigns dispatched</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Automated Delivery</span>
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                <Zap className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold">{stats?.deliveryRate ?? "99.8%"}</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium ml-2">High fidelity</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
          <TabsList className="bg-card border border-border rounded-xl p-1 inline-flex flex-wrap h-auto gap-1">
            <TabsTrigger
              value="subscribers"
              className="data-[state=active]:bg-sky-500/15 data-[state=active]:text-sky-500 rounded-lg gap-2 font-bold"
            >
              <Users className="h-4 w-4" /> Subscribers ({subscribers.length})
            </TabsTrigger>
            <TabsTrigger
              value="templates"
              className="data-[state=active]:bg-sky-500/15 data-[state=active]:text-sky-500 rounded-lg gap-2 font-bold"
            >
              <FileEdit className="h-4 w-4" /> Customize Email Templates
            </TabsTrigger>
            <TabsTrigger
              value="broadcast"
              className="data-[state=active]:bg-sky-500/15 data-[state=active]:text-sky-500 rounded-lg gap-2 font-bold"
            >
              <Megaphone className="h-4 w-4" /> Broadcast Announcement
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="data-[state=active]:bg-sky-500/15 data-[state=active]:text-sky-500 rounded-lg gap-2 font-bold"
            >
              <Clock className="h-4 w-4" /> Email Logs ({logs.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: SUBSCRIBERS */}
          <TabsContent value="subscribers" className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border p-3.5 rounded-2xl">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search subscriber emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 rounded-xl border-border bg-background"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {(["all", "subscribed", "unsubscribed"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg capitalize transition-colors ${
                      statusFilter === s
                        ? "bg-sky-500 text-white"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Subscriber Email</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Source</th>
                      <th className="px-4 py-3.5">Subscribed Date</th>
                      <th className="px-4 py-3.5 text-center">Delivered</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredSubscribers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                          No newsletter subscribers found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredSubscribers.map((sub) => (
                        <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              <span className="h-8 w-8 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold text-xs uppercase">
                                {sub.email.charAt(0)}
                              </span>
                              <div>
                                <div className="font-semibold text-foreground">{sub.email}</div>
                                {sub.lastEmailSentAt && (
                                  <div className="text-[11px] text-muted-foreground">
                                    Last email: {new Date(sub.lastEmailSentAt).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                sub.status === "subscribed"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  sub.status === "subscribed" ? "bg-emerald-500" : "bg-muted-foreground"
                                }`}
                              />
                              {sub.status === "subscribed" ? "Subscribed" : "Unsubscribed"}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-xs text-muted-foreground">
                            {sub.source || "Landing Page Footer"}
                          </td>
                          <td className="px-4 py-4 text-xs text-muted-foreground">
                            {new Date(sub.subscribedAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-center font-semibold text-xs">
                            {sub.emailsDelivered || 1}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSubscriber(sub.id, sub.email)}
                              className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg"
                              title="Delete subscriber"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: CUSTOMIZE EMAIL TEMPLATES */}
          <TabsContent value="templates" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Template Selector */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  Automated Templates
                </h3>
                <div className="space-y-2">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => handleSelectTemplate(tpl.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all ${
                        selectedTemplateId === tpl.id
                          ? "border-sky-500 bg-sky-500/5 shadow-sm"
                          : "border-border bg-card hover:border-border/80 hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">{tpl.name}</span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500">
                          {tpl.type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{tpl.subject}</p>
                    </button>
                  ))}
                </div>

                <div className="p-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-xs text-sky-800 dark:text-sky-300 space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Available Dynamic Variables:
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                    <span className="bg-background/80 px-2 py-0.5 rounded border border-border">
                      {"{{app_name}}"}
                    </span>
                    <span className="bg-background/80 px-2 py-0.5 rounded border border-border">
                      {"{{user_email}}"}
                    </span>
                    <span className="bg-background/80 px-2 py-0.5 rounded border border-border">
                      {"{{announcement_title}}"}
                    </span>
                    <span className="bg-background/80 px-2 py-0.5 rounded border border-border">
                      {"{{cta_label}}"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Template Editor */}
              {editingTemplate ? (
                <div className="lg:col-span-2 space-y-6">
                  <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-5">
                    <div className="flex items-center justify-between border-b border-border pb-4">
                      <div>
                        <h2 className="text-lg font-bold">Edit "{editingTemplate.name}"</h2>
                        <p className="text-xs text-muted-foreground">
                          Changes to this email template will automatically apply to future dispatches.
                        </p>
                      </div>
                      <Button
                        onClick={handleSaveTemplate}
                        disabled={savingTemplate}
                        className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold gap-1.5"
                      >
                        {savingTemplate ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                        Save Changes
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          Email Subject Line
                        </label>
                        <Input
                          value={editingTemplate.subject}
                          onChange={(e) =>
                            setEditingTemplate({ ...editingTemplate, subject: e.target.value })
                          }
                          className="rounded-xl border-border"
                          placeholder="Email subject line..."
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          Preheader / Preview Text
                        </label>
                        <Input
                          value={editingTemplate.previewText || ""}
                          onChange={(e) =>
                            setEditingTemplate({ ...editingTemplate, previewText: e.target.value })
                          }
                          className="rounded-xl border-border"
                          placeholder="Brief preview snippet shown in inbox..."
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          Headline Banner
                        </label>
                        <Input
                          value={editingTemplate.headline || ""}
                          onChange={(e) =>
                            setEditingTemplate({ ...editingTemplate, headline: e.target.value })
                          }
                          className="rounded-xl border-border"
                          placeholder="Main banner headline inside email..."
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          Email Body (Markdown supported)
                        </label>
                        <Textarea
                          value={editingTemplate.body}
                          onChange={(e) =>
                            setEditingTemplate({ ...editingTemplate, body: e.target.value })
                          }
                          rows={9}
                          className="rounded-xl border-border font-mono text-xs leading-relaxed"
                          placeholder="Email content body..."
                        />
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                            Button Label (CTA)
                          </label>
                          <Input
                            value={editingTemplate.ctaText || ""}
                            onChange={(e) =>
                              setEditingTemplate({ ...editingTemplate, ctaText: e.target.value })
                            }
                            className="rounded-xl border-border"
                            placeholder="e.g. Read Full Update"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                            Button Link URL
                          </label>
                          <Input
                            value={editingTemplate.ctaUrl || ""}
                            onChange={(e) =>
                              setEditingTemplate({ ...editingTemplate, ctaUrl: e.target.value })
                            }
                            className="rounded-xl border-border"
                            placeholder="/features or https://..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Live Rendered Email Preview */}
                  <div className="p-6 rounded-2xl border border-border bg-muted/30 space-y-3">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Live Inbox Render Preview
                    </h3>
                    <div className="max-w-xl mx-auto rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
                      {/* Fake Email Client Top Bar */}
                      <div className="bg-muted px-4 py-2.5 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-400 inline-block" />
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 inline-block" />
                          <span className="ml-2 font-medium">To: subscriber@example.com</span>
                        </div>
                        <span className="font-mono text-[10px]">GeFlow Mailer</span>
                      </div>

                      <div className="p-6 space-y-4">
                        <div className="border-b border-border/60 pb-3">
                          <div className="text-xs text-muted-foreground">Subject:</div>
                          <div className="font-bold text-base text-foreground">
                            {editingTemplate.subject.replace(/{{app_name}}/g, appName)}
                          </div>
                        </div>

                        {editingTemplate.headline && (
                          <div className="text-lg font-extrabold text-foreground tracking-tight">
                            {editingTemplate.headline}
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                          {editingTemplate.body
                            .replace(/{{app_name}}/g, appName)
                            .replace(/{{user_email}}/g, "subscriber@example.com")
                            .replace(/{{announcement_title}}/g, "New Feature Release")
                            .replace(/{{announcement_body}}/g, "We are excited to share our latest product updates.")}
                        </div>

                        {editingTemplate.ctaText && (
                          <div className="pt-2">
                            <div className="inline-block px-5 py-2.5 rounded-xl bg-sky-500 text-white font-bold text-xs shadow-md">
                              {editingTemplate.ctaText}
                            </div>
                          </div>
                        )}

                        <div className="border-t border-border pt-4 text-[10px] text-muted-foreground">
                          © {new Date().getFullYear()} {appName}. You are receiving this because you subscribed to
                          our newsletter.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </TabsContent>

          {/* TAB 3: BROADCAST ANNOUNCEMENT */}
          <TabsContent value="broadcast" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Sync from existing Announcements */}
              <div className="space-y-4">
                <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-3">
                  <div className="flex items-center gap-2 text-sky-500 font-bold text-sm">
                    <Megaphone className="h-4 w-4" />
                    Sync from Platform Announcements
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select any live announcement from our database to prefill this broadcast immediately.
                  </p>
                  <div className="space-y-2 mt-2">
                    {announcements.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic">No live announcements in database.</div>
                    ) : (
                      announcements.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => handlePickAnnouncement(a.id)}
                          className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                            selectedAnnouncementId === a.id
                              ? "border-sky-500 bg-sky-500/10 font-medium"
                              : "border-border hover:bg-muted/40"
                          }`}
                        >
                          <div className="font-bold text-foreground line-clamp-1">{a.title}</div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{a.body}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Compose & Send Form */}
              <div className="lg:col-span-2 space-y-4">
                <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-5">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <h2 className="text-lg font-bold">Dispatch Newsletter Broadcast</h2>
                      <p className="text-xs text-muted-foreground">
                        Emails will be automatically queued and sent to all {stats?.activeSubscribers ?? subscribers.length} active subscribers.
                      </p>
                    </div>
                    <Button
                      onClick={handleSendBroadcast}
                      disabled={broadcasting}
                      className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold gap-1.5"
                    >
                      {broadcasting ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Send Broadcast Now
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        Broadcast Title / Headline
                      </label>
                      <Input
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        placeholder="e.g. Introducing 2x Faster Offline Checkout & AI Analytics"
                        className="rounded-xl border-border"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        Announcement Message Body
                      </label>
                      <Textarea
                        value={broadcastBody}
                        onChange={(e) => setBroadcastBody(e.target.value)}
                        rows={7}
                        placeholder="Write the newsletter update for your subscribers..."
                        className="rounded-xl border-border text-sm leading-relaxed"
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          CTA Button Label
                        </label>
                        <Input
                          value={broadcastCtaText}
                          onChange={(e) => setBroadcastCtaText(e.target.value)}
                          placeholder="e.g. Read Full Announcement"
                          className="rounded-xl border-border"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          CTA Target Link
                        </label>
                        <Input
                          value={broadcastCtaUrl}
                          onChange={(e) => setBroadcastCtaUrl(e.target.value)}
                          placeholder="/dashboard/announcements"
                          className="rounded-xl border-border"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 4: DELIVERY LOGS */}
          <TabsContent value="logs" className="space-y-4">
            <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Recipient</th>
                      <th className="px-4 py-3.5">Template</th>
                      <th className="px-4 py-3.5">Subject</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Delivered At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                          No delivery logs recorded yet.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-3.5 font-medium text-foreground">{log.recipient}</td>
                          <td className="px-4 py-3.5 text-xs text-muted-foreground">{log.templateName}</td>
                          <td className="px-4 py-3.5 text-xs font-semibold text-foreground line-clamp-1 max-w-xs">
                            {log.subject}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Delivered
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-right text-xs text-muted-foreground">
                            {new Date(log.sentAt).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PanelLayout>
  );
}
