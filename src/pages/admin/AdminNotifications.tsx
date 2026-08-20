import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PanelLayout from "@/components/PanelLayout";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import {
  Bell, Loader2, Mail, MailOpen, LifeBuoy, Megaphone, CheckCheck, Search, Filter,
} from "lucide-react";

type Kind = "message" | "ticket" | "announcement";
interface Item {
  id: string; kind: Kind; title: string; description: string; createdAt: string; unread: boolean; to: string;
}

const kindMeta: Record<Kind, { icon: typeof Bell; label: string; cls: string }> = {
  message: { icon: Mail, label: "Contact", cls: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
  ticket: { icon: LifeBuoy, label: "Support", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  announcement: { icon: Megaphone, label: "Announcement", cls: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
};

const AdminNotifications = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [onlyUnread, setOnlyUnread] = useState(false);

  const load = useCallback(async () => {
    const [msgs, tickets, anns] = await Promise.all([
      supabase.from("contact_submissions").select("id, name, email, message, is_read, created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("support_tickets").select("id, ticket_number, subject, status, priority, created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("announcements").select("id, title, body, audience, created_at").order("created_at", { ascending: false }).limit(30),
    ]);

    const rows: Item[] = [
      ...(msgs.data ?? []).map((d: any) => ({
        id: `msg-${d.id}`, kind: "message" as Kind,
        title: `New message from ${d.name}`,
        description: `${d.email} — ${d.message ?? ""}`,
        createdAt: d.created_at, unread: !d.is_read, to: "/admin/support",
      })),
      ...(tickets.data ?? []).map((t: any) => ({
        id: `tkt-${t.id}`, kind: "ticket" as Kind,
        title: `${t.ticket_number} · ${t.subject}`,
        description: `Priority ${t.priority} · Status ${t.status}`,
        createdAt: t.created_at, unread: t.status === "open", to: "/admin/support",
      })),
      ...(anns.data ?? []).filter((a: any) => a.audience === "all" || a.audience === "admins").map((a: any) => ({
        id: `ann-${a.id}`, kind: "announcement" as Kind,
        title: a.title, description: a.body, createdAt: a.created_at, unread: false, to: "/admin/settings",
      })),
    ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    setItems(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("admin_notifications_page")
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_submissions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const markAllRead = async () => {
    await supabase.from("contact_submissions").update({ is_read: true }).eq("is_read", false);
    load();
  };

  const markRead = async (item: Item) => {
    if (item.kind !== "message" || !item.unread) return;
    await supabase.from("contact_submissions").update({ is_read: true }).eq("id", item.id.replace("msg-", ""));
    load();
  };

  const filtered = useMemo(() => items.filter((i) => {
    if (filter !== "all" && i.kind !== filter) return false;
    if (onlyUnread && !i.unread) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return i.title.toLowerCase().includes(s) || i.description.toLowerCase().includes(s);
  }), [items, filter, onlyUnread, q]);

  const unread = items.filter((i) => i.unread).length;

  return (
    <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY} isAdmin>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1">Notifications</h1>
          <p className="text-sm text-muted-foreground">Every inbound signal across the platform — contact messages, support tickets and announcements.</p>
        </div>
        <button onClick={markAllRead} className="h-10 px-4 rounded-xl bg-sky-400 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-2 transition-colors">
          <CheckCheck className="h-4 w-4" /> Mark all read
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "TOTAL", value: items.length, cls: "text-foreground" },
          { label: "UNREAD", value: unread, cls: "text-sky-500" },
          { label: "SUPPORT", value: items.filter((i) => i.kind === "ticket").length, cls: "text-amber-500" },
          { label: "ANNOUNCEMENTS", value: items.filter((i) => i.kind === "announcement").length, cls: "text-violet-500" },
        ].map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notifications..."
              className="w-full h-10 pl-10 pr-4 bg-muted/40 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(["all", "message", "ticket", "announcement"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`h-9 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${filter === f ? "bg-sky-400 text-white" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}>
                {f === "all" ? "All" : kindMeta[f].label}
              </button>
            ))}
            <button onClick={() => setOnlyUnread((v) => !v)}
              className={`h-9 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${onlyUnread ? "bg-violet-500 text-white" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}>
              Unread
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-bold">Nothing here</p>
            <p className="text-sm text-muted-foreground mt-1">No notifications match your filters.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((n) => {
              const meta = kindMeta[n.kind];
              const Icon = meta.icon;
              return (
                <li key={n.id}>
                  <Link to={n.to} onClick={() => markRead(n)}
                    className={`w-full text-left p-4 flex gap-4 hover:bg-muted/40 transition-colors ${n.unread ? "bg-sky-400/5" : ""}`}>
                    <div className={`h-10 w-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${meta.cls}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm truncate">{n.title}</p>
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                        {n.unread && <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">New</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-1.5">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                    {n.unread ? <Mail className="h-4 w-4 text-sky-500 flex-shrink-0" /> : <MailOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PanelLayout>
  );
};

export default AdminNotifications;
