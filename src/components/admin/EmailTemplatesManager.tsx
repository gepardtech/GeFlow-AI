import { useState } from "react";
import { EMAIL_TEMPLATES, EmailTemplate } from "@/lib/emailTemplates";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  Info,
  Mail,
  RotateCcw,
  Smartphone,
  Sparkles,
  Monitor,
} from "lucide-react";

export const EmailTemplatesManager = () => {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string>("magic_link");
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [deviceMode, setDeviceMode] = useState<"desktop" | "mobile">("desktop");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Editable state per template
  const [customTemplates, setCustomTemplates] = useState<Record<string, { subject: string; html: string }>>(() => {
    const initial: Record<string, { subject: string; html: string }> = {};
    EMAIL_TEMPLATES.forEach((t) => {
      initial[t.id] = { subject: t.defaultSubject, html: t.html };
    });
    return initial;
  });

  const currentTpl = EMAIL_TEMPLATES.find((t) => t.id === selectedId) || EMAIL_TEMPLATES[0];
  const activeSubject = customTemplates[selectedId]?.subject || currentTpl.defaultSubject;
  const activeHtml = customTemplates[selectedId]?.html || currentTpl.html;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast({
      title: `${label} Copied! 📋`,
      description: "Paste it directly into your Supabase Dashboard > Authentication > Email Templates.",
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleReset = () => {
    setCustomTemplates((prev) => ({
      ...prev,
      [selectedId]: { subject: currentTpl.defaultSubject, html: currentTpl.html },
    }));
    toast({ title: "Template Reset", description: "Reverted to default clean design." });
  };

  // Helper to replace Go template placeholders for live preview rendering
  const getRenderedHtml = () => {
    return activeHtml
      .replace(/\{\{\s*\.Token\s*\}\}/g, "849201")
      .replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, "https://geflow.io/auth/confirm?token=sample_token_849201")
      .replace(/\{\{\s*\.SiteURL\s*\}\}/g, "https://geflow.io")
      .replace(/\{\{\s*\.Email\s*\}\}/g, "customer@example.com");
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Guide */}
      <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 dark:bg-sky-500/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-sky-500/20 text-sky-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              Supabase Auth Email Customizer
              <Badge variant="outline" className="text-sky-500 border-sky-500/30 text-[10px] py-0">
                Ready-to-use HTML
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
              Customize modern, branded templates for <strong>Magic Link (1-Click & 6-Digit Code)</strong>, 
              <strong>Signup Confirmation</strong>, and <strong>Password Reset</strong>. Copy and paste into your Supabase Dashboard to upgrade from plain text emails.
            </p>
          </div>
        </div>

        <a
          href="https://supabase.com/dashboard/project/bglzohtmgamypgooddru/auth/templates"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs inline-flex items-center gap-2 transition-colors shadow-sm flex-shrink-0"
        >
          Open Supabase Email Templates <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Column: Template Picker & Editor */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Select Template
            </label>
            <div className="grid grid-cols-1 gap-2">
              {EMAIL_TEMPLATES.map((t) => {
                const isSelected = t.id === selectedId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-sky-500 bg-sky-500/10 dark:bg-sky-500/15 font-semibold"
                        : "border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">{t.name}</span>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {t.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject Line & Copy Controls */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Email Subject Line
                </label>
                <button
                  type="button"
                  onClick={() => handleCopy(activeSubject, "Subject")}
                  className="text-xs font-semibold text-sky-500 hover:underline inline-flex items-center gap-1"
                >
                  {copiedField === "Subject" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  Copy Subject
                </button>
              </div>
              <Input
                value={activeSubject}
                onChange={(e) =>
                  setCustomTemplates((prev) => ({
                    ...prev,
                    [selectedId]: { ...prev[selectedId], subject: e.target.value },
                  }))
                }
                className="h-10 text-sm font-medium"
              />
            </div>

            {/* Template Variables */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                Available Supabase Variables
              </label>
              <div className="flex flex-wrap gap-1.5">
                {currentTpl.variables.map((v) => (
                  <span
                    key={v.name}
                    title={v.desc}
                    onClick={() => handleCopy(v.name, v.name)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted text-[11px] font-mono font-semibold cursor-pointer hover:bg-sky-500/20 hover:text-sky-500 transition-colors"
                  >
                    {v.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="pt-2 flex flex-col gap-2">
              <Button
                onClick={() => handleCopy(activeHtml, "HTML Template")}
                className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs gap-2 shadow-sm"
              >
                {copiedField === "HTML Template" ? (
                  <>
                    <Check className="h-4 w-4" /> Copied HTML to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copy Full HTML Template
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={handleReset}
                size="sm"
                className="w-full h-9 rounded-xl text-xs gap-1.5 text-muted-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Reset to Default Design
              </Button>
            </div>
          </div>

          {/* Step-by-step Setup Guide */}
          <div className="bg-muted/40 border border-border/80 rounded-2xl p-5 space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Info className="h-4 w-4 text-sky-500" /> How to apply to Supabase:
            </h4>
            <ol className="text-xs text-muted-foreground space-y-2 list-decimal pl-4">
              <li>
                Click <strong>"Copy Full HTML Template"</strong> above.
              </li>
              <li>
                Open <strong>Supabase Dashboard → Authentication → Email Templates</strong>.
              </li>
              <li>
                Select <strong>{currentTpl.name}</strong> from the left menu.
              </li>
              <li>
                Paste the <strong>Subject Line</strong> and the <strong>HTML Body</strong> into Supabase and click <strong>Save</strong>.
              </li>
            </ol>
          </div>
        </div>

        {/* Right Column: Interactive Live Preview & Code Editor */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col h-full min-h-[640px]">
            {/* Preview Toolbar */}
            <div className="flex items-center justify-between pb-4 border-b border-border/70 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">Preview & Code</span>
                <span className="text-xs text-muted-foreground">• Live interactive output</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Desktop / Mobile Switch */}
                {viewMode === "preview" && (
                  <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
                    <button
                      type="button"
                      onClick={() => setDeviceMode("desktop")}
                      className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                        deviceMode === "desktop" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                      }`}
                    >
                      <Monitor className="h-3.5 w-3.5" /> Desktop
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeviceMode("mobile")}
                      className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                        deviceMode === "mobile" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5" /> Mobile
                    </button>
                  </div>
                )}

                {/* View Mode Switch (Preview vs Source) */}
                <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setViewMode("preview")}
                    className={`p-1.5 px-2.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      viewMode === "preview" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5 text-sky-500" /> Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("code")}
                    className={`p-1.5 px-2.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      viewMode === "code" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    <Code2 className="h-3.5 w-3.5" /> HTML Source
                  </button>
                </div>
              </div>
            </div>

            {/* Email Canvas */}
            <div className="flex-1 mt-4 flex items-center justify-center bg-muted/30 dark:bg-black/40 rounded-xl p-4 overflow-auto border border-border/50">
              {viewMode === "preview" ? (
                <div
                  className={`transition-all duration-300 w-full overflow-hidden shadow-2xl rounded-2xl border border-border bg-[#0c0f17] ${
                    deviceMode === "mobile" ? "max-w-[380px]" : "max-w-[620px]"
                  }`}
                >
                  {/* Email header mockup bar */}
                  <div className="bg-[#131825] px-4 py-2.5 border-b border-[#1e293b] flex items-center justify-between text-[11px] text-slate-400">
                    <div className="truncate font-semibold">
                      <span className="text-slate-500">Subject:</span> {activeSubject.replace("{{ .Token }}", "849201")}
                    </div>
                    <span className="text-emerald-400 font-mono text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      Preview Active
                    </span>
                  </div>

                  <iframe
                    title="Email Preview"
                    srcDoc={getRenderedHtml()}
                    className="w-full h-[540px] border-none bg-[#0c0f17]"
                  />
                </div>
              ) : (
                <div className="w-full h-[580px] flex flex-col">
                  <Textarea
                    value={activeHtml}
                    onChange={(e) =>
                      setCustomTemplates((prev) => ({
                        ...prev,
                        [selectedId]: { ...prev[selectedId], html: e.target.value },
                      }))
                    }
                    className="w-full flex-1 font-mono text-xs p-4 bg-background/90 resize-none border-border"
                    placeholder="Paste or edit HTML template here..."
                  />
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground pt-2">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-sky-500" /> Fully compatible with standard email clients (Gmail, Apple Mail, Outlook).
              </span>
              <span>GeFlow v2.4</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
