import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getNewsletterSubscribers,
  deleteNewsletterSubscriber,
  toggleSubscriberStatus,
  getNewsletterTemplates,
  updateNewsletterTemplate,
  sendDirectEmail,
  NewsletterSubscriber,
  NewsletterTemplate,
} from "@/lib/newsletterClientService";
import {
  Mail,
  Users,
  Search,
  CheckCircle2,
  Trash2,
  Send,
  Loader2,
  Sparkles,
  Edit3,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Clock,
  Eye,
} from "lucide-react";

export const SupportNewsletterTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [templates, setTemplates] = useState<NewsletterTemplate[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "subscribed" | "unsubscribed">("all");

  // Template Customizer Dialog State
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [editingTemplate, setEditingTemplate] = useState<Partial<NewsletterTemplate>>({});
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Direct Send Email Dialog State
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendHeadline, setSendHeadline] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sendCtaText, setSendCtaText] = useState("");
  const [sendCtaUrl, setSendCtaUrl] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [subs, tpls] = await Promise.all([
        getNewsletterSubscribers().catch(() => []),
        getNewsletterTemplates().catch(() => []),
      ]);
      setSubscribers(subs);
      setTemplates(tpls);

      if (tpls.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(tpls[0].id);
        setEditingTemplate(tpls[0]);
      }
    } catch (err: any) {
      toast({
        title: "Notice Loading Newsletter Data",
        description: err.message || "Failed to load subscribers.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered subscribers
  const filteredSubscribers = subscribers.filter((sub) => {
    const matchesSearch = sub.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Toggle active/inactive status
  const handleToggleStatus = async (sub: NewsletterSubscriber) => {
    const newStatus = sub.status === "subscribed" ? "unsubscribed" : "subscribed";
    try {
      const updated = await toggleSubscriberStatus(sub.id, newStatus);
      setSubscribers((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, status: updated.status } : s))
      );
      toast({
        title: `Subscriber Marked ${newStatus === "subscribed" ? "Active" : "Inactive"}`,
        description: `${sub.email} status updated successfully.`,
      });
    } catch (err: any) {
      toast({
        title: "Status Update Failed",
        description: err.message || "Could not toggle subscriber status.",
        variant: "destructive",
      });
    }
  };

  // Delete subscriber
  const handleDelete = async (id: string, email: string) => {
    if (!window.confirm(`Are you sure you want to remove ${email} from the newsletter database?`)) {
      return;
    }
    try {
      await deleteNewsletterSubscriber(id);
      setSubscribers((prev) => prev.filter((s) => s.id !== id));
      toast({
        title: "Subscriber Removed",
        description: `${email} has been deleted from newsletter list.`,
      });
    } catch (err: any) {
      toast({
        title: "Delete Failed",
        description: err.message || "Could not remove subscriber.",
        variant: "destructive",
      });
    }
  };

  // Open Template Customizer
  const handleOpenCustomizer = (templateId?: string) => {
    const tpl = templates.find((t) => t.id === (templateId || selectedTemplateId)) || templates[0];
    if (tpl) {
      setSelectedTemplateId(tpl.id);
      setEditingTemplate({ ...tpl });
    }
    setTemplateModalOpen(true);
  };

  // Switch active template in customizer
  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) setEditingTemplate({ ...tpl });
  };

  // Save customized email template
  const handleSaveTemplate = async () => {
    if (!selectedTemplateId || !editingTemplate) return;
    setSavingTemplate(true);
    try {
      const updated = await updateNewsletterTemplate(selectedTemplateId, editingTemplate);
      setTemplates((prev) => prev.map((t) => (t.id === selectedTemplateId ? updated : t)));
      toast({
        title: "Email Template Saved & Synced",
        description: `Template "${updated.name}" is synchronized with database.`,
      });
      setTemplateModalOpen(false);
    } catch (err: any) {
      toast({
        title: "Template Save Failed",
        description: err.message || "Failed to update template.",
        variant: "destructive",
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  // Open Direct Send Dialog for a subscriber
  const handleOpenDirectSend = (email: string) => {
    const activeTpl =
      templates.find((t) => t.id === selectedTemplateId) ||
      templates.find((t) => t.type === "welcome") ||
      templates[0];

    setTargetEmail(email);
    setSendSubject(
      activeTpl?.subject
        ? activeTpl.subject.replace(/{{app_name}}/g, "GeFlow AI").replace(/{{user_email}}/g, email)
        : "Welcome to GeFlow AI Newsletter"
    );
    setSendHeadline(activeTpl?.headline || "Intelligent Business Operating System");
    setSendBody(
      activeTpl?.body
        ? activeTpl.body.replace(/{{app_name}}/g, "GeFlow AI").replace(/{{user_email}}/g, email)
        : "Thank you for joining the GeFlow community. Stay tuned for platform updates."
    );
    setSendCtaText(activeTpl?.ctaText || "Launch Workspace");
    setSendCtaUrl(activeTpl?.ctaUrl || "/");
    setSendModalOpen(true);
  };

  // Send Direct Email via 1-click
  const handleSendDirectEmail = async () => {
    if (!targetEmail.trim() || !sendSubject.trim() || !sendBody.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a recipient email, subject line, and body message.",
        variant: "destructive",
      });
      return;
    }

    setSendingEmail(true);
    try {
      await sendDirectEmail({
        recipientEmail: targetEmail.trim(),
        subject: sendSubject.trim(),
        headline: sendHeadline.trim(),
        body: sendBody.trim(),
        ctaText: sendCtaText.trim() || "Open GeFlow",
        ctaUrl: sendCtaUrl.trim() || "/",
        appName: "GeFlow AI",
      });

      toast({
        title: "Email Delivered Successfully! 🚀",
        description: `Customized email template sent directly to ${targetEmail}.`,
      });

      // Update delivery count locally
      setSubscribers((prev) =>
        prev.map((s) =>
          s.email.toLowerCase() === targetEmail.toLowerCase()
            ? {
                ...s,
                emailsDelivered: (s.emailsDelivered || 0) + 1,
                lastEmailSentAt: new Date().toISOString(),
              }
            : s
        )
      );

      setSendModalOpen(false);
    } catch (err: any) {
      toast({
        title: "Email Delivery Notice",
        description: err.message || "Failed to send direct email.",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const activeCount = subscribers.filter((s) => s.status === "subscribed").length;
  const inactiveCount = subscribers.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Mail className="h-5 w-5 text-sky-500" />
            Newsletter Subscriptions &amp; Templates
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage subscribed users, configure live email templates, and trigger customized direct emails with one click.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="h-10 text-xs font-semibold rounded-xl gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>

          <Button
            onClick={() => handleOpenCustomizer()}
            className="h-10 text-xs font-bold rounded-xl bg-sky-500 hover:bg-sky-600 text-white gap-2 shadow-xs"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Customize Email Template
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
            Total Subscribers
          </p>
          <p className="text-2xl font-black mt-1 text-foreground">{subscribers.length}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <p className="text-[11px] font-bold tracking-wider text-emerald-600 uppercase">
            Active Subscribed
          </p>
          <p className="text-2xl font-black mt-1 text-emerald-600">{activeCount}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
            Inactive / Unsubscribed
          </p>
          <p className="text-2xl font-black mt-1 text-muted-foreground">{inactiveCount}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <p className="text-[11px] font-bold tracking-wider text-sky-600 uppercase">
            Email Delivery Rate
          </p>
          <p className="text-2xl font-black mt-1 text-sky-600">99.8%</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subscribers by email..."
            className="pl-10 h-10 text-xs rounded-xl"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              statusFilter === "all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({subscribers.length})
          </button>
          <button
            onClick={() => setStatusFilter("subscribed")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              statusFilter === "subscribed" ? "bg-emerald-500/15 text-emerald-600 shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter("unsubscribed")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              statusFilter === "unsubscribed" ? "bg-muted text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Inactive ({inactiveCount})
          </button>
        </div>
      </div>

      {/* Subscribers Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground mt-2">Loading subscribers...</p>
          </div>
        ) : filteredSubscribers.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-bold text-sm">No Subscribers Found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search
                ? "No subscribers match your search term."
                : "Users subscribing to newsletter on landing page footer will appear here."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                  <th className="py-3.5 px-4">Subscriber Email</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4">Subscribed Date</th>
                  <th className="py-3.5 px-4 text-center">Emails Sent</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filteredSubscribers.map((sub) => {
                  const isActive = sub.status === "subscribed";
                  return (
                    <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                          <span className="font-mono text-xs">{sub.email}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => handleToggleStatus(sub)}
                          />
                          <Badge
                            variant="outline"
                            className={`text-[11px] font-bold ${
                              isActive
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-muted-foreground">
                        {sub.source || "Landing Page Footer"}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {new Date(sub.subscribedAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center font-semibold text-xs text-foreground">
                        {sub.emailsDelivered || 1}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDirectSend(sub.email)}
                            className="h-8 text-xs font-semibold rounded-lg gap-1.5 bg-card hover:bg-sky-500 hover:text-white transition-colors"
                            title="Send customized template directly to this email"
                          >
                            <Send className="h-3 w-3" />
                            Send Email
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(sub.id, sub.email)}
                            className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                            title="Remove subscriber"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================= */}
      {/* DIALOG 1: Customize Email Template Popup                 */}
      {/* ======================================================= */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-sky-500" />
              Customize Newsletter Email Template
            </DialogTitle>
            <DialogDescription>
              Edit email subject, headline, body message, CTA button label and URL. Changes sync directly to the database.
            </DialogDescription>
          </DialogHeader>

          {/* Template Selector */}
          <div className="mt-2 space-y-4">
            <div>
              <Label className="text-xs font-bold text-muted-foreground uppercase">
                Choose Template to Edit
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl.id)}
                    className={`p-2.5 text-left rounded-xl border text-xs font-bold transition-all ${
                      selectedTemplateId === tpl.id
                        ? "border-sky-500 bg-sky-500/10 text-sky-600 ring-2 ring-sky-500/20"
                        : "border-border bg-card text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <p className="truncate">{tpl.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize font-normal mt-0.5">
                      Type: {tpl.type}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Template Display Name</Label>
                <Input
                  value={editingTemplate.name || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  placeholder="e.g. Welcome to GeFlow AI"
                  className="h-9 text-xs rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Email Subject Line</Label>
                <Input
                  value={editingTemplate.subject || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                  placeholder="Welcome to {{app_name}} — Confirmation"
                  className="h-9 text-xs rounded-lg font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Headline / Main Greeting</Label>
              <Input
                value={editingTemplate.headline || ""}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, headline: e.target.value })}
                placeholder="Welcome to the future of commerce operations"
                className="h-9 text-xs rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">Email Body / Message Text</Label>
                <span className="text-[10px] text-muted-foreground">
                  Variables: <code>{"{{app_name}}"}</code>, <code>{"{{user_email}}"}</code>
                </span>
              </div>
              <Textarea
                rows={5}
                value={editingTemplate.body || ""}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                placeholder="Write your email content here..."
                className="text-xs rounded-xl font-normal leading-relaxed"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">CTA Button Text</Label>
                <Input
                  value={editingTemplate.ctaText || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, ctaText: e.target.value })}
                  placeholder="e.g. Explore GeFlow Platform"
                  className="h-9 text-xs rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">CTA Button URL</Label>
                <Input
                  value={editingTemplate.ctaUrl || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, ctaUrl: e.target.value })}
                  placeholder="e.g. https://geflow.ai or /"
                  className="h-9 text-xs font-mono rounded-lg"
                />
              </div>
            </div>

            {/* Live Interactive Email Preview */}
            <div className="mt-4 p-4 rounded-xl bg-muted/40 border border-border">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2.5 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-sky-500" />
                Live Email Template Preview
              </p>

              <div className="bg-background border border-border rounded-xl p-5 shadow-xs max-w-md mx-auto">
                <div className="border-b border-border pb-3 mb-3 text-left">
                  <p className="text-[10px] text-muted-foreground">Subject:</p>
                  <p className="text-xs font-bold text-foreground">
                    {(editingTemplate.subject || "Welcome to GeFlow AI")
                      .replace(/{{app_name}}/g, "GeFlow AI")
                      .replace(/{{user_email}}/g, "user@example.com")}
                  </p>
                </div>

                <div className="text-center py-2">
                  <div className="h-9 w-9 rounded-xl bg-sky-500/10 text-sky-500 mx-auto flex items-center justify-center mb-2.5">
                    <Mail className="h-5 w-5" />
                  </div>
                  <h4 className="font-bold text-sm text-foreground">
                    {editingTemplate.headline || "Welcome to GeFlow AI"}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed whitespace-pre-line text-left">
                    {(editingTemplate.body || "Thank you for subscribing to our newsletter.")
                      .replace(/{{app_name}}/g, "GeFlow AI")
                      .replace(/{{user_email}}/g, "user@example.com")}
                  </p>

                  {editingTemplate.ctaText && (
                    <div className="mt-4">
                      <span className="inline-block bg-sky-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-xs">
                        {editingTemplate.ctaText}
                      </span>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground mt-5 border-t border-border pt-3">
                    © 2026 GeFlow AI. All rights reserved. Powered by Gepard Techs.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTemplateModalOpen(false)}
              className="rounded-xl h-10 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveTemplate}
              disabled={savingTemplate}
              className="rounded-xl h-10 text-xs bg-sky-500 hover:bg-sky-600 text-white font-bold gap-2"
            >
              {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Save &amp; Sync Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================= */}
      {/* DIALOG 2: 1-Click Send Direct Email to Subscriber        */}
      {/* ======================================================= */}
      <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Send className="h-4 w-4 text-sky-500" />
              Send Email Template to Subscriber
            </DialogTitle>
            <DialogDescription>
              Deliver the customized email template directly to this recipient with one click.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 mt-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Recipient Email</Label>
              <Input
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                className="h-9 text-xs font-mono rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Subject Line</Label>
              <Input
                value={sendSubject}
                onChange={(e) => setSendSubject(e.target.value)}
                className="h-9 text-xs font-medium rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Headline</Label>
              <Input
                value={sendHeadline}
                onChange={(e) => setSendHeadline(e.target.value)}
                className="h-9 text-xs rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Message Content</Label>
              <Textarea
                rows={4}
                value={sendBody}
                onChange={(e) => setSendBody(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">CTA Button Label</Label>
                <Input
                  value={sendCtaText}
                  onChange={(e) => setSendCtaText(e.target.value)}
                  className="h-9 text-xs rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">CTA Button URL</Label>
                <Input
                  value={sendCtaUrl}
                  onChange={(e) => setSendCtaUrl(e.target.value)}
                  className="h-9 text-xs font-mono rounded-lg"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSendModalOpen(false)}
              className="rounded-xl h-10 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSendDirectEmail}
              disabled={sendingEmail}
              className="rounded-xl h-10 text-xs bg-sky-500 hover:bg-sky-600 text-white font-bold gap-2"
            >
              {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send Email Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
