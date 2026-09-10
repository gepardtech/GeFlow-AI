import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  fetchGeneralSettings,
  saveGeneralSettings,
  SocialMediaLink,
  FooterCopyrightSettings,
  WordUrlMapping,
} from "@/lib/generalSettingsService";
import {
  Facebook,
  Instagram,
  Mail,
  Linkedin,
  Github,
  Youtube,
  Send,
  Globe,
  Plus,
  Trash2,
  ExternalLink,
  Save,
  Loader2,
  CheckCircle2,
  Sparkles,
  Link as LinkIcon,
} from "lucide-react";

const PinterestIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345-.09.376-.293 1.193-.333 1.36-.052.218-.173.265-.4.16-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
  </svg>
);

const XIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const DiscordIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

const PLATFORM_PRESETS = [
  { value: "facebook", label: "Facebook", icon: Facebook, defaultUrl: "https://facebook.com/" },
  { value: "instagram", label: "Instagram", icon: Instagram, defaultUrl: "https://instagram.com/" },
  { value: "x", label: "X (Twitter)", icon: XIcon, defaultUrl: "https://x.com/" },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, defaultUrl: "https://linkedin.com/company/" },
  { value: "pinterest", label: "Pinterest", icon: PinterestIcon, defaultUrl: "https://pinterest.com/" },
  { value: "github", label: "GitHub", icon: Github, defaultUrl: "https://github.com/" },
  { value: "youtube", label: "YouTube", icon: Youtube, defaultUrl: "https://youtube.com/@" },
  { value: "discord", label: "Discord", icon: DiscordIcon, defaultUrl: "https://discord.gg/" },
  { value: "telegram", label: "Telegram", icon: Send, defaultUrl: "https://t.me/" },
  { value: "email", label: "Email / Newsletter", icon: Mail, defaultUrl: "mailto:support@geflow.ai" },
  { value: "custom", label: "Custom Website", icon: Globe, defaultUrl: "https://" },
];

function getPlatformIcon(platform: string, size = 16) {
  switch (platform) {
    case "facebook":
      return <Facebook size={size} />;
    case "instagram":
      return <Instagram size={size} />;
    case "x":
      return <XIcon size={size - 1} />;
    case "linkedin":
      return <Linkedin size={size} />;
    case "pinterest":
      return <PinterestIcon size={size} />;
    case "github":
      return <Github size={size} />;
    case "youtube":
      return <Youtube size={size} />;
    case "discord":
      return <DiscordIcon size={size} />;
    case "telegram":
      return <Send size={size - 2} />;
    case "email":
      return <Mail size={size} />;
    default:
      return <Globe size={size} />;
  }
}

export const AdminSocialAndFooterSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Social links state
  const [socialLinks, setSocialLinks] = useState<SocialMediaLink[]>([]);
  const [newPlatform, setNewPlatform] = useState("facebook");

  // Copyright state
  const [copyrightText, setCopyrightText] = useState(
    "© 2026 GeFlow AI. All rights reserved. Powered by Gepard Techs."
  );
  const [wordUrls, setWordUrls] = useState<WordUrlMapping[]>([
    { id: "w1", word: "GeFlow AI", url: "/", openInNewTab: false },
    { id: "w2", word: "Gepard Techs", url: "https://gepardtechs.com", openInNewTab: true },
  ]);

  // New Word Url row state
  const [newWord, setNewWord] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newOpenInNewTab, setNewOpenInNewTab] = useState(true);

  useEffect(() => {
    fetchGeneralSettings()
      .then((settings) => {
        if (settings) {
          if (settings.social_links) {
            setSocialLinks(settings.social_links);
          }
          if (settings.footer_copyright) {
            setCopyrightText(settings.footer_copyright.text);
            setWordUrls(settings.footer_copyright.wordUrls || []);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Save Social Links & Copyright to Database & Server
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const copyrightSettings: FooterCopyrightSettings = {
        text: copyrightText,
        wordUrls,
      };

      await saveGeneralSettings({
        social_links: socialLinks,
        footer_copyright: copyrightSettings,
      });

      toast({
        title: "Settings Saved & Synced",
        description: "Social media links and footer copyright are updated live on landing pages.",
      });
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err.message || "Failed to save settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Social Links Handlers
  const handleAddSocialLink = () => {
    const preset = PLATFORM_PRESETS.find((p) => p.value === newPlatform);
    const newLink: SocialMediaLink = {
      id: "soc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      platform: newPlatform as any,
      label: preset?.label || "Social Link",
      url: preset?.defaultUrl || "https://",
      enabled: true,
      order: socialLinks.length + 1,
    };

    setSocialLinks([...socialLinks, newLink]);
  };

  const handleUpdateSocialLink = (id: string, updates: Partial<SocialMediaLink>) => {
    setSocialLinks(socialLinks.map((l) => (l.id === id ? { ...l, ...updates } : l)));
  };

  const handleDeleteSocialLink = (id: string) => {
    setSocialLinks(socialLinks.filter((l) => l.id !== id));
  };

  // Word URL Handlers
  const handleAddWordUrl = () => {
    if (!newWord.trim() || !newUrl.trim()) {
      toast({
        title: "Missing Fields",
        description: "Please specify both the exact word and target URL.",
        variant: "destructive",
      });
      return;
    }

    // Check if word exists in copyrightText
    if (!copyrightText.toLowerCase().includes(newWord.trim().toLowerCase())) {
      toast({
        title: "Word not found in text",
        description: `The word "${newWord.trim()}" does not appear in your copyright text. Please ensure it matches a word or phrase in the text above.`,
        variant: "destructive",
      });
    }

    const mapping: WordUrlMapping = {
      id: "w_" + Date.now(),
      word: newWord.trim(),
      url: newUrl.trim(),
      openInNewTab: newOpenInNewTab,
    };

    setWordUrls([...wordUrls, mapping]);
    setNewWord("");
    setNewUrl("");
    setNewOpenInNewTab(true);
  };

  const handleDeleteWordUrl = (id: string) => {
    setWordUrls(wordUrls.filter((w) => w.id !== id));
  };

  const handleUpdateWordUrl = (id: string, updates: Partial<WordUrlMapping>) => {
    setWordUrls(wordUrls.map((w) => (w.id === id ? { ...w, ...updates } : w)));
  };

  // Render Interactive Live Preview
  const renderLivePreview = () => {
    if (!wordUrls || wordUrls.length === 0) {
      return <span>{copyrightText}</span>;
    }

    const sortedWords = [...wordUrls].sort((a, b) => b.word.length - a.word.length);
    const escapedWords = sortedWords
      .map((w) => w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .filter(Boolean);

    if (escapedWords.length === 0) return <span>{copyrightText}</span>;

    const regex = new RegExp(`(${escapedWords.join("|")})`, "g");
    const parts = copyrightText.split(regex);

    return parts.map((part, idx) => {
      const matched = sortedWords.find((w) => w.word.toLowerCase() === part.toLowerCase());
      if (matched && matched.url) {
        return (
          <span
            key={idx}
            className="font-bold text-sky-500 underline underline-offset-4 decoration-sky-400/50 hover:text-sky-600 transition-colors"
            title={`Links to: ${matched.url} (${matched.openInNewTab ? "New Tab" : "Same Window"})`}
          >
            {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        <p className="text-xs text-muted-foreground mt-2">Loading social links & footer configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* SECTION 1: Social Media Links */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Globe className="h-5 w-5 text-sky-500" />
              Landing Page Footer Social Media Links
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Add all social media options (Facebook, Instagram, X/Twitter, LinkedIn, Pinterest, GitHub, etc.). Fully synchronized with your database and public landing footer.
            </p>
          </div>
          <Button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl h-10 px-5 gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Social Links
          </Button>
        </div>

        {/* Existing Social Links Table / List */}
        <div className="space-y-3 mt-5">
          {socialLinks.map((link) => (
            <div
              key={link.id}
              className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors flex-wrap sm:flex-nowrap"
            >
              <div className="h-9 w-9 rounded-lg bg-card border border-border flex items-center justify-center text-foreground shrink-0 shadow-xs">
                {getPlatformIcon(link.platform, 18)}
              </div>

              <div className="w-32 shrink-0">
                <Select
                  value={link.platform}
                  onValueChange={(val: any) => {
                    const preset = PLATFORM_PRESETS.find((p) => p.value === val);
                    handleUpdateSocialLink(link.id, {
                      platform: val,
                      label: preset?.label || val,
                    });
                  }}
                >
                  <SelectTrigger className="h-9 text-xs font-semibold rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value} className="text-xs">
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-36 shrink-0">
                <Input
                  value={link.label}
                  onChange={(e) => handleUpdateSocialLink(link.id, { label: e.target.value })}
                  placeholder="Label"
                  className="h-9 text-xs rounded-lg"
                />
              </div>

              <div className="flex-1 min-w-[200px]">
                <Input
                  value={link.url}
                  onChange={(e) => handleUpdateSocialLink(link.id, { url: e.target.value })}
                  placeholder="https://..."
                  className="h-9 text-xs font-mono rounded-lg"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={link.enabled}
                  onCheckedChange={(checked) => handleUpdateSocialLink(link.id, { enabled: checked })}
                />
                <span className="text-[11px] text-muted-foreground w-12">
                  {link.enabled ? "Active" : "Hidden"}
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteSocialLink(link.id)}
                  className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 h-8 w-8 rounded-lg"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {socialLinks.length === 0 && (
            <div className="text-center py-6 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
              No social links configured yet. Click "Add Social Media" below to get started.
            </div>
          )}
        </div>

        {/* Add New Social Link Bar */}
        <div className="mt-4 pt-4 border-t border-border flex items-center gap-3 flex-wrap">
          <Select value={newPlatform} onValueChange={setNewPlatform}>
            <SelectTrigger className="w-52 h-9 text-xs rounded-lg font-medium">
              <SelectValue placeholder="Choose Platform" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORM_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddSocialLink}
            className="h-9 text-xs rounded-lg gap-1.5 font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Social Media Link
          </Button>
        </div>
      </div>

      {/* SECTION 2: Footer Copyright Text & Specific Word URLs */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-sky-500" />
              Footer Copyright Text &amp; Word URLs
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Customize the full copyright text and apply custom links to specific individual words (e.g., link "GeFlow AI" to <code className="text-xs bg-muted px-1 py-0.5 rounded">/</code> and "Gepard Techs" to <code className="text-xs bg-muted px-1 py-0.5 rounded">https://gepardtechs.com</code>).
            </p>
          </div>
          <Button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl h-10 px-5 gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Copyright &amp; Links
          </Button>
        </div>

        {/* Copyright Text Input */}
        <div className="space-y-2 mt-4">
          <Label className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Full Copyright Text
          </Label>
          <Input
            value={copyrightText}
            onChange={(e) => setCopyrightText(e.target.value)}
            placeholder="© 2026 GeFlow AI. All rights reserved. Powered by Gepard Techs."
            className="h-11 font-medium text-sm rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            Enter the exact complete sentence or copyright phrase.
          </p>
        </div>

        {/* Word URLs Mapping Section */}
        <div className="mt-6 pt-5 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-sm">Specific Word URL Mappings</h3>
              <p className="text-xs text-muted-foreground">
                Assign hyperlinks to specific single words or phrases inside the text above.
              </p>
            </div>
          </div>

          {/* List of Word URL mappings */}
          <div className="space-y-3">
            {wordUrls.map((mapping) => (
              <div
                key={mapping.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors flex-wrap sm:flex-nowrap"
              >
                <div className="w-48 shrink-0">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                    Specific Word / Phrase
                  </Label>
                  <Input
                    value={mapping.word}
                    onChange={(e) => handleUpdateWordUrl(mapping.id, { word: e.target.value })}
                    placeholder="e.g. GeFlow AI"
                    className="h-9 text-xs font-semibold rounded-lg"
                  />
                </div>

                <div className="flex-1 min-w-[200px]">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                    Target URL
                  </Label>
                  <Input
                    value={mapping.url}
                    onChange={(e) => handleUpdateWordUrl(mapping.id, { url: e.target.value })}
                    placeholder="e.g. https://gepardtechs.com or /"
                    className="h-9 text-xs font-mono rounded-lg"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-4 sm:pt-0">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <Switch
                      checked={mapping.openInNewTab}
                      onCheckedChange={(v) => handleUpdateWordUrl(mapping.id, { openInNewTab: v })}
                    />
                    <span>New Tab</span>
                  </label>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteWordUrl(mapping.id)}
                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 h-8 w-8 rounded-lg ml-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {wordUrls.length === 0 && (
              <div className="text-center py-5 border border-dashed border-border rounded-xl text-muted-foreground text-xs">
                No specific words linked yet. Add a word link below.
              </div>
            )}
          </div>

          {/* Add Word URL Input Row */}
          <div className="mt-4 p-4 rounded-xl bg-card border border-dashed border-border flex items-end gap-3 flex-wrap sm:flex-nowrap">
            <div className="w-full sm:w-48">
              <Label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                Target Word / Phrase
              </Label>
              <Input
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="e.g. Gepard Techs"
                className="h-9 text-xs rounded-lg"
              />
            </div>

            <div className="flex-1 min-w-[200px] w-full">
              <Label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                URL (e.g. https://... or /)
              </Label>
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://gepardtechs.com"
                className="h-9 text-xs font-mono rounded-lg"
              />
            </div>

            <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <Switch checked={newOpenInNewTab} onCheckedChange={setNewOpenInNewTab} />
                <span>New Tab</span>
              </label>

              <Button
                type="button"
                onClick={handleAddWordUrl}
                size="sm"
                className="h-9 text-xs rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-semibold gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Apply URL to Word
              </Button>
            </div>
          </div>
        </div>

        {/* Live Interactive Preview Box */}
        <div className="mt-6 p-4 rounded-xl bg-muted/40 border border-border">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-sky-500" />
            Live Footer Copyright Preview (Interactive)
          </p>
          <div className="p-3 bg-background rounded-lg border border-border text-sm text-center text-muted-foreground">
            {renderLivePreview()}
          </div>
        </div>
      </div>
    </div>
  );
};
