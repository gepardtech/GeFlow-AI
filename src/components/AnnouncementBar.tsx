import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Megaphone,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Calendar,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  variant: "info" | "success" | "warning" | "promo" | string;
  position: "top" | "bottom" | string;
  link_url: string | null;
  link_label: string | null;
  audience: string;
  created_at?: string;
}

interface Props {
  audience: "public" | "users" | "admins";
  position?: "top" | "bottom";
}

const variantStyles = (v: string) => {
  switch (v) {
    case "success":
      return {
        barBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200",
        badge: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
        icon: CheckCircle2,
        iconColor: "text-emerald-600 dark:text-emerald-400",
        btn: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs",
        label: "Update",
      };
    case "warning":
      return {
        barBg: "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200",
        badge: "bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30",
        icon: AlertTriangle,
        iconColor: "text-amber-600 dark:text-amber-400",
        btn: "bg-amber-600 hover:bg-amber-700 text-white shadow-xs",
        label: "Notice",
      };
    case "promo":
      return {
        barBg: "bg-violet-500/10 border-violet-500/30 text-violet-950 dark:text-violet-200",
        badge: "bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/30",
        icon: Sparkles,
        iconColor: "text-violet-600 dark:text-violet-400",
        btn: "bg-violet-600 hover:bg-violet-700 text-white shadow-xs",
        label: "Special",
      };
    case "info":
    default:
      return {
        barBg: "bg-sky-500/10 border-sky-500/30 text-sky-950 dark:text-sky-200",
        badge: "bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30",
        icon: Info,
        iconColor: "text-sky-600 dark:text-sky-400",
        btn: "bg-sky-500 hover:bg-sky-600 text-white shadow-xs",
        label: "Announcement",
      };
  }
};

export const AnnouncementBar = ({ audience, position = "top" }: Props) => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [idx, setIdx] = useState(0);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from("announcements")
          .select("id, title, body, variant, position, link_url, link_label, audience, created_at")
          .eq("position", position)
          .order("created_at", { ascending: false });
        const filtered = (data ?? []).filter(
          (a: any) => a.audience === "all" || a.audience === audience
        );
        setItems(filtered as Announcement[]);
      } catch (err) {
        console.warn("Failed to load announcements:", err);
      }
    };
    load();
    const ch = supabase
      .channel(`ann_${audience}_${position}_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [audience, position]);

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 7000);
    return () => clearInterval(t);
  }, [items.length]);

  const visible = items.filter((i) => !closed.has(i.id));
  if (visible.length === 0) return null;
  const cur = visible[idx % visible.length];
  const style = variantStyles(cur.variant);
  const IconComp = style.icon;

  const handleCtaClick = () => {
    setSelectedAnnouncement(cur);
  };

  const handleRedirect = (url: string) => {
    if (!url) return;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = url;
    }
  };

  return (
    <>
      <div
        className={`w-full border-b transition-all duration-300 ${style.barBg} ${
          position === "bottom" ? "border-t border-b-0" : ""
        }`}
      >
        <div className="container mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm">
          {/* Left: Icon, Category Badge & Title Only */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={`p-1 rounded-md ${style.badge} flex-shrink-0 flex items-center justify-center`}>
              <IconComp className="h-3.5 w-3.5" />
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <span className={`hidden sm:inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${style.badge}`}>
                {style.label}
              </span>
              <p className="font-semibold truncate text-foreground text-xs sm:text-sm">
                {cur.title}
              </p>
            </div>
          </div>

          {/* Right: Carousel Controls (if multi), CTA Button & Dismiss */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {visible.length > 1 && (
              <div className="hidden md:flex items-center gap-1 mr-1">
                <button
                  type="button"
                  onClick={() => setIdx((i) => (i - 1 + visible.length) % visible.length)}
                  className="h-6 w-6 rounded-md hover:bg-black/10 dark:hover:bg-white/10 inline-flex items-center justify-center transition-colors text-muted-foreground"
                  aria-label="Previous announcement"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground px-1">
                  {(idx % visible.length) + 1}/{visible.length}
                </span>
                <button
                  type="button"
                  onClick={() => setIdx((i) => (i + 1) % visible.length)}
                  className="h-6 w-6 rounded-md hover:bg-black/10 dark:hover:bg-white/10 inline-flex items-center justify-center transition-colors text-muted-foreground"
                  aria-label="Next announcement"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Clean, Prominent CTA Button */}
            <Button
              type="button"
              size="sm"
              onClick={handleCtaClick}
              className={`h-7 px-3 text-xs font-bold rounded-lg transition-all active:scale-95 ${style.btn}`}
            >
              <span>{cur.link_label?.trim() || "View Announcement"}</span>
              <ArrowRight className="h-3 w-3 ml-1.5 opacity-90" />
            </Button>

            {/* Close / Dismiss */}
            <button
              type="button"
              onClick={() => setClosed((s) => new Set(s).add(cur.id))}
              className="h-7 w-7 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss announcement"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Professional Announcement Detail Modal */}
      {selectedAnnouncement && (
        <Dialog
          open={!!selectedAnnouncement}
          onOpenChange={(open) => !open && setSelectedAnnouncement(null)}
        >
          <DialogContent className="max-w-lg p-0 overflow-hidden border border-border rounded-2xl shadow-xl">
            {/* Header with Variant Badge & Icon */}
            <div className={`p-5 sm:p-6 border-b border-border/70 ${variantStyles(selectedAnnouncement.variant).barBg}`}>
              <div className="flex items-center gap-2.5 mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${variantStyles(selectedAnnouncement.variant).badge}`}>
                  {variantStyles(selectedAnnouncement.variant).label}
                </span>
                {selectedAnnouncement.created_at && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                    <Calendar className="h-3 w-3 opacity-70" />
                    {new Date(selectedAnnouncement.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-snug">
                {selectedAnnouncement.title}
              </DialogTitle>
            </div>

            {/* Body Content */}
            <div className="p-5 sm:p-6 space-y-4 max-h-[55vh] overflow-y-auto text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {selectedAnnouncement.body}
            </div>

            {/* Footer with Primary Action CTA */}
            <DialogFooter className="p-4 sm:p-5 bg-muted/30 border-t border-border flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedAnnouncement(null)}
                className="w-full sm:w-auto text-xs font-semibold rounded-xl"
              >
                Close
              </Button>

              {selectedAnnouncement.link_url ? (
                <Button
                  type="button"
                  onClick={() => {
                    handleRedirect(selectedAnnouncement.link_url!);
                    setSelectedAnnouncement(null);
                  }}
                  className={`w-full sm:w-auto text-xs font-bold rounded-xl px-5 gap-1.5 shadow-sm ${
                    variantStyles(selectedAnnouncement.variant).btn
                  }`}
                >
                  <span>{selectedAnnouncement.link_label?.trim() || "Proceed to Target Page"}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => setSelectedAnnouncement(null)}
                  className={`w-full sm:w-auto text-xs font-bold rounded-xl px-5 shadow-sm ${
                    variantStyles(selectedAnnouncement.variant).btn
                  }`}
                >
                  Got It
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default AnnouncementBar;
