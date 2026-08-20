import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import UserPanelGate from "@/components/UserPanelGate";
import {
  Bell, Loader2, Megaphone, LifeBuoy, PackageX, Search, Filter, ExternalLink,
} from "lucide-react";

type Kind = "announcement" | "ticket" | "stock";
interface Item {
  id: string; kind: Kind; title: string; description: string; createdAt: string;
  unread: boolean; to?: string; link?: string | null; linkLabel?: string | null;
}

const kindMeta: Record<Kind, { icon: typeof Bell; label: string; cls: string }> = {
  announcement: { icon: Megaphone, label: "Announcement", cls: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
  ticket: { icon: LifeBuoy, label: "Support", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  stock: { icon: PackageX, label: "Inventory", cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
};

const SEEN_KEY = "geflow.notifications.seenAt";

const UserNotifications = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Kind>("all");

  const load = useCallback(async () => {
    const seenAt = Number(localStorage.getItem(SEEN_KEY) || 0);
    const { data: { user } } = await supabase.auth.getUser();

    const [anns, tickets, lowStock] = await Promise.all([
      supabase.from("announcements").select("id, title, body, audience, link_url, link_label, created_at").order("created_at", { ascending: false }).limit(30),
      user
        ? supabase.from("support_tickets").select("id, ticket_number, subject, status, priority, updated_at").eq("owner_user_id", user.id).order("updated_at", { ascending: false }).limit(20)
        : Promise.resolve({ data: [] as any[] }),
      user
        ? supabase.from("products").select("id, name, stock_units, min_stock_alert, updated_at").eq("owner_user_id", user.id).order("updated_at", { ascending: false }).limit(100)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const rows: Item[] = [
      ...(anns.data ?? [])
        .filter((a: any) => a.audience === "all" || a.audience === "users")
        .map((a: any) => ({
          id: `ann-${a.id}`, kind: "announcement" as Kind, title: a.title, description: a.body,
          createdAt: a.created_at, unread: +new Date(a.created_at) > seenAt,
          to: "/dashboard/announcements", link: a.link_url, linkLabel: a.link_label,
        })),
      ...((tickets.data ?? []) as any[]).map((t: any) => ({
        id: `tkt-${t.id}`, kind: "ticket" as Kind,
        title: `${t.ticket_number} · ${t.subject}`,
        description: `Priority ${t.priority} · Status ${t.status}`,
        createdAt: t.updated_at, unread: +new Date(t.updated_at) > seenAt,
        to: "/dashboard/support",
      })),
      ...((lowStock.data ?? []) as any[])
        .filter((p: any) => Number(p.stock_units) <= Number(p.min_stock_alert))
        .slice(0, 15)
        .map((p: any) => ({
          id: `stk-${p.id}`, kind: "stock" as Kind,
          title: Number(p.stock_units) === 0 ? `${p.name} is out of stock` : `${p.name} hit the low-stock threshold`,
          description: `${p.stock_units} units remaining · alert at ${p.min_stock_alert}`,
          createdAt: p.updated_at, unread: +new Date(p.updated_at) > seenAt,
          to: Number(p.stock_units) === 0 ? "/dashboard/out-of-stock" : "/dashboard/low-stock",
        })),
    ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    setItems(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("user_notifications_page")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const markAllRead = () => {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
    window.dispatchEvent(new CustomEvent("geflow:notifications-seen"));
    load();
  };

  const filtered = useMemo(() => items.filter((i) => {
    if (filter !== "all" && i.kind !== filter) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return i.title.toLowerCase().includes(s) || i.description.toLowerCase().includes(s);
  }), [items, filter, q]);

  const unread = items.filter((i) => i.unread).length;

  return (
    <UserPanelGate pageTitle="Notifications">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1">Notifications</h1>
          <p className="text-sm text-muted-foreground">Announcements, support replies and inventory alerts for your workspace.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/dashboard/announcements" className="h-10 px-4 rounded-xl border border-border text-xs font-bold inline-flex items-center gap-2 hover:bg-muted transition-colors">
            <Megaphone className="h-4 w-4" /> Announcements
          </Link>
          <button onClick={markAllRead} className="h-10 px-4 rounded-xl bg-sky-400 hover:bg-sky-500 text-white text-xs font-bold transition-colors">
            Mark all read
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "TOTAL", value: items.length, cls: "text-foreground" },
          { label: "UNREAD", value: unread, cls: "text-sky-500" },
          { label: "SUPPORT", value: items.filter((i) => i.kind === "ticket").length, cls: "text-amber-500" },
          { label: "STOCK ALERTS", value: items.filter((i) => i.kind === "stock").length, cls: "text-rose-500" },
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
            {(["all", "announcement", "ticket", "stock"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`h-9 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${filter === f ? "bg-sky-400 text-white" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}>
                {f === "all" ? "All" : kindMeta[f].label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-bold">You're all caught up</p>
            <p className="text-sm text-muted-foreground mt-1">New notifications will land here instantly.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((n) => {
              const meta = kindMeta[n.kind];
              const Icon = meta.icon;
              return (
                <li key={n.id} className={`p-4 flex gap-4 hover:bg-muted/40 transition-colors ${n.unread ? "bg-sky-400/5" : ""}`}>
                  <div className={`h-10 w-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${meta.cls}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm">{n.title}</p>
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                      {n.unread && <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">New</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</p>
                      {n.to && <Link to={n.to} className="text-[11px] font-bold text-sky-500 hover:underline">Open</Link>}
                      {n.link && (
                        <a href={n.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-500 hover:underline">
                          {n.linkLabel || "Learn more"} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </UserPanelGate>
  );
};

export default UserNotifications;
