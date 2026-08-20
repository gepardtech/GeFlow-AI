import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import UserPanelGate from "@/components/UserPanelGate";
import { Megaphone, Loader2, ExternalLink, Info, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";

interface Announcement {
  id: string; title: string; body: string; variant: string;
  link_url: string | null; link_label: string | null; audience: string; created_at: string;
}

const variantMeta = (v: string) => ({
  info: { icon: Info, cls: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
  success: { icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  warning: { icon: AlertTriangle, cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  promo: { icon: Sparkles, cls: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
}[v] ?? { icon: Info, cls: "bg-sky-500/15 text-sky-500 border-sky-500/30" });

const UserAnnouncements = () => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

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
    const ch = supabase.channel("user_announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return (
    <UserPanelGate pageTitle="Announcements">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-1">Announcements</h1>
        <p className="text-sm text-muted-foreground">Platform updates, new features and important notices for your workspace.</p>
      </div>

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Megaphone className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-bold">No announcements yet</p>
          <p className="text-sm text-muted-foreground mt-1">You're all caught up. New updates will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const meta = variantMeta(a.variant);
            const Icon = meta.icon;
            return (
              <div key={a.id} className="bg-card border border-border rounded-2xl p-5 flex gap-4">
                <div className={`h-10 w-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${meta.cls}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold">{a.title}</p>
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${meta.cls}`}>{a.variant}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{a.body}</p>
                  {a.link_url && (
                    <a href={a.link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-sky-500 mt-2 hover:underline">
                      {a.link_label || "Learn more"} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-2">{new Date(a.created_at).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </UserPanelGate>
  );
};

export default UserAnnouncements;
