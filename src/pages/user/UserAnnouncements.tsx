import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import UserPanelGate from "@/components/UserPanelGate";
import {
  Megaphone,
  Loader2,
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
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Announcement {
  id: string;
  title: string;
  body: string;
  variant: string;
  link_url: string | null;
  link_label: string | null;
  audience: string;
  created_at: string;
}

const variantStyles = (v: string) => {
  switch (v) {
    case "success":
      return {
        cardBorder: "hover:border-emerald-500/50",
        badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        icon: CheckCircle2,
        iconBg: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
        btn: "bg-emerald-600 hover:bg-emerald-700 text-white",
        label: "Update",
      };
    case "warning":
      return {
        cardBorder: "hover:border-amber-500/50",
        badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
        icon: AlertTriangle,
        iconBg: "bg-amber-500/15 text-amber-600 border-amber-500/30",
        btn: "bg-amber-600 hover:bg-amber-700 text-white",
        label: "Notice",
      };
    case "promo":
      return {
        cardBorder: "hover:border-violet-500/50",
        badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
        icon: Sparkles,
        iconBg: "bg-violet-500/15 text-violet-600 border-violet-500/30",
        btn: "bg-violet-600 hover:bg-violet-700 text-white",
        label: "Special",
      };
    case "info":
    default:
      return {
        cardBorder: "hover:border-sky-500/50",
        badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
        icon: Info,
        iconBg: "bg-sky-500/15 text-sky-600 border-sky-500/30",
        btn: "bg-sky-500 hover:bg-sky-600 text-white",
        label: "Announcement",
      };
  }
};

const UserAnnouncements = () => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Announcement | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("announcements")
      .select("id, title, body, variant, link_url, link_label, audience, created_at")
      .order("created_at", { ascending: false });
    const filtered = (data ?? []).filter((a: any) => a.audience === "all" || a.audience === "users");
    setItems(filtered as Announcement[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("user_announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const handleRedirect = (url: string) => {
    if (!url) return;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = url;
    }
  };

  return (
    <UserPanelGate pageTitle="Announcements">
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Announcements</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Platform updates, system notices, and feature releases for your workspace.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
            <Megaphone className="h-6 w-6" />
          </div>
          <p className="font-bold text-foreground">No announcements yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            You're all caught up. Any new business updates or notices will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {items.map((a) => {
            const style = variantStyles(a.variant);
            const Icon = style.icon;
            return (
              <div
                key={a.id}
                className={`bg-card border border-border rounded-2xl p-4 sm:p-5 transition-all duration-200 ${style.cardBorder} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={`h-10 w-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${style.iconBg}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${style.badge}`}>
                        {style.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                        <Calendar className="h-3 w-3 opacity-70" />
                        {new Date(a.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-foreground leading-snug truncate">
                      {a.title}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                  <Button
                    type="button"
                    onClick={() => setSelectedItem(a)}
                    className={`h-9 px-4 text-xs font-bold rounded-xl transition-all shadow-xs ${style.btn}`}
                  >
                    <span>{a.link_label?.trim() || "View Details"}</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Announcement Detail Modal */}
      {selectedItem && (
        <Dialog
          open={!!selectedItem}
          onOpenChange={(open) => !open && setSelectedItem(null)}
        >
          <DialogContent className="max-w-lg p-0 overflow-hidden border border-border rounded-2xl shadow-xl">
            <div className={`p-5 sm:p-6 border-b border-border/70 ${variantStyles(selectedItem.variant).badge}`}>
              <div className="flex items-center gap-2.5 mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${variantStyles(selectedItem.variant).badge}`}>
                  {variantStyles(selectedItem.variant).label}
                </span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                  <Calendar className="h-3 w-3 opacity-70" />
                  {new Date(selectedItem.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-snug">
                {selectedItem.title}
              </DialogTitle>
            </div>

            <div className="p-5 sm:p-6 space-y-4 max-h-[55vh] overflow-y-auto text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {selectedItem.body}
            </div>

            <DialogFooter className="p-4 sm:p-5 bg-muted/30 border-t border-border flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedItem(null)}
                className="w-full sm:w-auto text-xs font-semibold rounded-xl"
              >
                Close
              </Button>

              {selectedItem.link_url ? (
                <Button
                  type="button"
                  onClick={() => {
                    handleRedirect(selectedItem.link_url!);
                    setSelectedItem(null);
                  }}
                  className={`w-full sm:w-auto text-xs font-bold rounded-xl px-5 gap-1.5 shadow-sm ${
                    variantStyles(selectedItem.variant).btn
                  }`}
                >
                  <span>{selectedItem.link_label?.trim() || "Proceed to Target Page"}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className={`w-full sm:w-auto text-xs font-bold rounded-xl px-5 shadow-sm ${
                    variantStyles(selectedItem.variant).btn
                  }`}
                >
                  Got It
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </UserPanelGate>
  );
};

export default UserAnnouncements;
