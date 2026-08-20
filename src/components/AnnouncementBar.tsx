import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, X, ChevronLeft, ChevronRight } from "lucide-react";

interface Announcement {
  id: string; title: string; body: string; variant: string; position: string;
  link_url: string | null; link_label: string | null; audience: string;
}

interface Props { audience: "public" | "users" | "admins"; position?: "top" | "bottom"; }

const variantClass = (v: string) => ({
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  promo: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
}[v] ?? "bg-sky-500/15 text-sky-700 border-sky-500/30");

const AnnouncementBar = ({ audience, position = "top" }: Props) => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [idx, setIdx] = useState(0);
  const [closed, setClosed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("announcements")
        .select("id, title, body, variant, position, link_url, link_label, audience")
        .eq("position", position)
        .order("created_at", { ascending: false });
      const filtered = (data ?? []).filter((a: any) =>
        a.audience === "all" || a.audience === audience
      );
      setItems(filtered as Announcement[]);
    };
    load();
    const ch = supabase.channel(`ann_${audience}_${position}_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [audience, position]);

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [items.length]);

  const visible = items.filter((i) => !closed.has(i.id));
  if (visible.length === 0) return null;
  const cur = visible[idx % visible.length];

  return (
    <div className={`w-full border-b ${variantClass(cur.variant)} ${position === "bottom" ? "border-t border-b-0" : ""}`}>
      <div className="container mx-auto px-4 py-2 flex items-center gap-3 text-xs md:text-sm">
        <Megaphone className="h-4 w-4 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-bold">{cur.title}:</span>{" "}
          <span className="opacity-90">{cur.body}</span>
          {cur.link_url && (
            <a href={cur.link_url} className="ml-2 underline font-bold">{cur.link_label || "Learn more"} →</a>
          )}
        </div>
        {visible.length > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={() => setIdx((i) => (i - 1 + visible.length) % visible.length)} className="h-6 w-6 rounded hover:bg-black/10 inline-flex items-center justify-center"><ChevronLeft className="h-3 w-3" /></button>
            <span className="text-[10px] font-bold tabular-nums">{(idx % visible.length) + 1}/{visible.length}</span>
            <button onClick={() => setIdx((i) => (i + 1) % visible.length)} className="h-6 w-6 rounded hover:bg-black/10 inline-flex items-center justify-center"><ChevronRight className="h-3 w-3" /></button>
          </div>
        )}
        <button onClick={() => setClosed((s) => new Set(s).add(cur.id))} className="h-6 w-6 rounded hover:bg-black/10 inline-flex items-center justify-center"><X className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
};

export default AnnouncementBar;
