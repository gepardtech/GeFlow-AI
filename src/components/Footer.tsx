import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  Facebook,
  Instagram,
  Mail,
  Linkedin,
  Github,
  Youtube,
  Send,
  Loader2,
  CheckCircle2,
  Globe,
} from "lucide-react";
import { usePlatformSettings } from "@/components/PlatformSettingsProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  getCachedGeneralSettings,
  fetchGeneralSettings,
  SocialMediaLink,
  FooterCopyrightSettings,
} from "@/lib/generalSettingsService";
import { subscribeToNewsletter } from "@/lib/newsletterClientService";
import { useToast } from "@/hooks/use-toast";

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

function renderSocialIcon(platform: string, size = 16) {
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

const Footer = () => {
  const { settings } = usePlatformSettings();
  const { toast } = useToast();

  const [socialLinks, setSocialLinks] = useState<SocialMediaLink[]>([]);
  const [copyright, setCopyright] = useState<FooterCopyrightSettings>({
    text: "© 2026 GeFlow AI. All rights reserved. Powered by Gepard Techs.",
    wordUrls: [
      { id: "w_geflow", word: "GeFlow AI", url: "/", openInNewTab: false },
      { id: "w_gepard", word: "Gepard Techs", url: "https://gepardtechs.com", openInNewTab: true },
    ],
  });

  // Newsletter subscription
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    // Initial cached
    const cached = getCachedGeneralSettings();
    if (cached) {
      if (Array.isArray(cached.social_links)) setSocialLinks(cached.social_links.filter((l) => l.enabled));
      if (cached.footer_copyright) setCopyright(cached.footer_copyright);
    }

    // Refresh from API / Supabase
    fetchGeneralSettings().then((fresh) => {
      if (fresh) {
        if (Array.isArray(fresh.social_links)) setSocialLinks(fresh.social_links.filter((l) => l.enabled));
        if (fresh.footer_copyright) setCopyright(fresh.footer_copyright);
      }
    });

    // Event listener for live updates
    const handleUpdate = (e: any) => {
      if (Array.isArray(e.detail?.social_links)) setSocialLinks(e.detail.social_links.filter((l: any) => l.enabled));
      if (e.detail?.footer_copyright) setCopyright(e.detail.footer_copyright);
    };

    window.addEventListener("geflow:settings-updated", handleUpdate);

    // Supabase Realtime channel for cross-tab / cross-device live footer sync
    const channel = supabase
      .channel(`footer_settings_sync_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_settings" },
        (payload: any) => {
          const gen = payload?.new?.alerts?.general_settings;
          if (gen) {
            if (Array.isArray(gen.social_links)) setSocialLinks(gen.social_links.filter((l: any) => l.enabled));
            if (gen.footer_copyright) setCopyright(gen.footer_copyright);
          } else {
            fetchGeneralSettings().then((fresh) => {
              if (fresh) {
                if (Array.isArray(fresh.social_links)) setSocialLinks(fresh.social_links.filter((l) => l.enabled));
                if (fresh.footer_copyright) setCopyright(fresh.footer_copyright);
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("geflow:settings-updated", handleUpdate);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim();
    if (!clean || !clean.includes("@")) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const appName = settings?.app_name || "GeFlow AI";
      await subscribeToNewsletter(clean, "Landing Page Footer", appName);
      setSubscribed(true);
      setEmail("");
      toast({
        title: "Subscribed Successfully! 🎉",
        description: "Welcome! A confirmation email has been dispatched to your inbox.",
      });
    } catch (err: any) {
      toast({
        title: "Subscription Notice",
        description: err.message || "Failed to subscribe. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Render clickable dynamic copyright text
  const renderCopyrightText = () => {
    const fullText = copyright?.text || `© ${new Date().getFullYear()} GeFlow AI. All rights reserved. Powered by Gepard Techs.`;
    const wordUrls = copyright?.wordUrls || [];

    if (!wordUrls || wordUrls.length === 0) {
      return <span>{fullText}</span>;
    }

    // Sort wordUrls by word length descending so longer words match first
    const sortedWords = [...wordUrls].sort((a, b) => b.word.length - a.word.length);
    
    // Create regex pattern to split text safely
    const escapedWords = sortedWords
      .map((w) => w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .filter(Boolean);

    if (escapedWords.length === 0) {
      return <span>{fullText}</span>;
    }

    const regex = new RegExp(`(${escapedWords.join("|")})`, "g");
    const parts = fullText.split(regex);

    return parts.map((part, idx) => {
      const matched = sortedWords.find((w) => w.word.toLowerCase() === part.toLowerCase());
      if (matched && matched.url) {
        const isExternal = matched.url.startsWith("http://") || matched.url.startsWith("https://");
        if (isExternal || matched.openInNewTab) {
          return (
            <a
              key={idx}
              href={matched.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
            >
              {part}
            </a>
          );
        }
        return (
          <Link
            key={idx}
            to={matched.url}
            className="font-semibold text-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            {part}
          </Link>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <footer className="border-t border-border bg-background py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              {settings?.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt={settings?.app_name ?? "GeFlow"}
                  className="h-8 max-w-[150px] object-contain"
                />
              ) : (
                <>
                  <svg width="24" height="24" viewBox="0 0 28 28" fill="none" className="text-primary">
                    <path d="M14 2L4 8v12l10 6 10-6V8L14 2z" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M14 8l-5 3v6l5 3 5-3v-6l-5-3z" fill="currentColor" opacity="0.3" />
                  </svg>
                  <span className="font-bold text-lg text-primary">{settings?.app_name ?? "GeFlow"}</span>
                </>
              )}
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              GeFlow is a modern business operating system designed to manage inventory, sales, and profit tracking in real time.
            </p>
            
            {/* Dynamic Social Media Links */}
            <div className="flex flex-wrap gap-2">
              {socialLinks.length > 0 ? (
                socialLinks.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target={item.url.startsWith("http") ? "_blank" : undefined}
                    rel={item.url.startsWith("http") ? "noopener noreferrer" : undefined}
                    aria-label={item.label}
                    title={item.label}
                    className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:scale-110 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300"
                  >
                    {renderSocialIcon(item.platform, 16)}
                  </a>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">Follow our social channels</div>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-sm mb-4">Quick Links</h4>
            <div className="flex flex-col gap-2.5">
              <Link to="/" onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "instant" })} className="text-muted-foreground text-sm hover:text-primary transition-colors">Home</Link>
              <Link to="/how-it-works" onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "instant" })} className="text-muted-foreground text-sm hover:text-primary transition-colors">How It Works</Link>
              <Link to="/features" onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "instant" })} className="text-muted-foreground text-sm hover:text-primary transition-colors">Features</Link>
              <Link to="/pricing" onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "instant" })} className="text-muted-foreground text-sm hover:text-primary transition-colors">Pricing</Link>
              <Link to="/contact" onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "instant" })} className="text-muted-foreground text-sm hover:text-primary transition-colors">Contact</Link>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold text-sm mb-4">Legal</h4>
            <div className="flex flex-col gap-2.5">
              <Link to="/about" onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "instant" })} className="text-muted-foreground text-sm hover:text-primary transition-colors">About</Link>
              <Link to="/privacy" onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "instant" })} className="text-muted-foreground text-sm hover:text-primary transition-colors">Privacy Policy</Link>
              <Link to="/refund" onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "instant" })} className="text-muted-foreground text-sm hover:text-primary transition-colors">Refund Policy</Link>
              <Link to="/terms" onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "instant" })} className="text-muted-foreground text-sm hover:text-primary transition-colors">Terms of Service</Link>
              <Link to="/disclaimer" onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "instant" })} className="text-muted-foreground text-sm hover:text-primary transition-colors">Disclaimer</Link>
            </div>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="font-bold text-sm mb-4">Newsletter</h4>
            <p className="text-muted-foreground text-sm mb-3">Get our latest product features and release notes directly in your inbox.</p>
            {subscribed ? (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Thank you! You're on our list.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                  className="text-sm h-9 rounded-xl border-border bg-background"
                />
                <Button size="sm" type="submit" disabled={submitting} className="h-9 px-3 rounded-xl bg-primary text-primary-foreground">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight size={16} />}
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Dynamic Footer Copyright with interactive word links */}
        <div className="border-t border-border pt-6 text-center text-muted-foreground text-sm">
          {renderCopyrightText()}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
