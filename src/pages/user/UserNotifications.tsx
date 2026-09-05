import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import UserPanelGate from "@/components/UserPanelGate";
import {
  Bell, Loader2, Megaphone, LifeBuoy, PackageX, Search, Filter, ExternalLink, Sparkles, Truck, Trash2, CheckCheck,
  UserPlus, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStoredAIReports, getStoredRestockReports } from "@/lib/aiReportSchedulerService";
import { getPendingInvitationsForUser, acceptInvitation, declineInvitation, PendingInvitation } from "@/lib/teamInviteService";
import { useToast } from "@/hooks/use-toast";

type Kind = "announcement" | "ticket" | "stock" | "ai_report" | "ai_restock" | "team_invite";
interface Item {
  id: string; kind: Kind; title: string; description: string; createdAt: string;
  unread: boolean; to?: string; link?: string | null; linkLabel?: string | null;
  inviteId?: string; businessName?: string; role?: string;
}

const kindMeta: Record<Kind, { icon: typeof Bell; label: string; cls: string }> = {
  announcement: { icon: Megaphone, label: "Announcement", cls: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
  ticket: { icon: LifeBuoy, label: "Support", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  stock: { icon: PackageX, label: "Inventory", cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  ai_report: { icon: Sparkles, label: "AI Report", cls: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
  ai_restock: { icon: Truck, label: "AI Restock", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  team_invite: { icon: UserPlus, label: "Team Invitation", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
};

const SEEN_KEY = "geflow.notifications.seenAt";
const CLEARED_KEY = "geflow.notifications.clearedAt";
const DISMISSED_KEY = "geflow.notifications.dismissedIds";

const UserNotifications = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Kind>("all");

  const load = useCallback(async () => {
    const seenAt = Number(localStorage.getItem(SEEN_KEY) || 0);
    const clearedAt = Number(localStorage.getItem(CLEARED_KEY) || 0);
    let dismissedIds: string[] = [];
    try {
      dismissedIds = JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
    } catch {
      dismissedIds = [];
    }

    const { data: { user } } = await supabase.auth.getUser();

    const [anns, tickets, lowStock, businesses, pendingInvites] = await Promise.all([
      supabase.from("announcements").select("id, title, body, audience, link_url, link_label, created_at").order("created_at", { ascending: false }).limit(30),
      user
        ? supabase.from("support_tickets").select("id, ticket_number, subject, status, priority, updated_at").eq("owner_user_id", user.id).order("updated_at", { ascending: false }).limit(20)
        : Promise.resolve({ data: [] as any[] }),
      user
        ? supabase.from("products").select("id, name, stock_units, min_stock_alert, updated_at, business_id").eq("owner_user_id", user.id).order("updated_at", { ascending: false }).limit(100)
        : Promise.resolve({ data: [] as any[] }),
      user
        ? supabase.from("businesses").select("id, business_name").eq("owner_user_id", user.id)
        : Promise.resolve({ data: [] as any[] }),
      user
        ? getPendingInvitationsForUser(user.id)
        : Promise.resolve([] as PendingInvitation[]),
    ]);

    const inviteRows: Item[] = (pendingInvites || []).map((inv) => ({
      id: `team-inv-${inv.id}`,
      kind: "team_invite" as Kind,
      title: `Team Invitation: ${inv.businessName}`,
      description: `${inv.ownerName} has invited you to join "${inv.businessName}" as ${inv.role.toUpperCase()}. Click Accept to activate your access.`,
      createdAt: inv.createdAt,
      unread: true,
      inviteId: inv.id,
      businessName: inv.businessName,
      role: inv.role,
    }));

    // Collect all stored AI Reports and Restock Reports across active user businesses
    const allAIReports: Item[] = [];
    (businesses.data || []).forEach((b: any) => {
      const reps = getStoredAIReports(b.id);
      reps.forEach((r) => {
        allAIReports.push({
          id: `ai-rep-${r.id}`,
          kind: "ai_report" as Kind,
          title: `🤖 ${r.title} Compiled`,
          description: r.summary,
          createdAt: r.createdAt,
          unread: +new Date(r.createdAt) > seenAt,
          to: "/dashboard/reports?view=ai_reports",
        });
      });

      const restocks = getStoredRestockReports(b.id);
      restocks.forEach((rs) => {
        allAIReports.push({
          id: `ai-rstk-${rs.id}`,
          kind: "ai_restock" as Kind,
          title: `📦 ${rs.title}`,
          description: `${rs.itemsCount} products require immediate replenishment. Click to view supplier procurement sheet in Audit Ledger.`,
          createdAt: rs.createdAt,
          unread: +new Date(rs.createdAt) > seenAt,
          to: "/dashboard/reports?view=ai_restock",
        });
      });
    });

    const rows: Item[] = [
      ...inviteRows,
      ...allAIReports,
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
    ]
      .filter((item) => {
        if (dismissedIds.includes(item.id)) return false;
        if (clearedAt && +new Date(item.createdAt) <= clearedAt) return false;
        return true;
      })
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    setItems(rows);
    setLoading(false);
  }, []);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAccept = async (inviteId: string, bizName?: string, role?: string) => {
    setActionLoading(inviteId);
    try {
      const res = await acceptInvitation(inviteId);
      if (res.success) {
        toast({
          title: "Invitation Accepted! 🎉",
          description: `You now have active access to "${bizName || 'the store'}" as ${role?.toUpperCase() || 'staff'}.`,
        });
        await load();
      } else {
        toast({
          title: "Failed to Accept",
          description: res.error || "Could not accept invitation.",
          variant: "destructive",
        });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (inviteId: string) => {
    setActionLoading(inviteId);
    try {
      const res = await declineInvitation(inviteId);
      if (res.success) {
        toast({
          title: "Invitation Declined",
          description: "The team invitation has been declined and removed.",
        });
        await load();
      } else {
        toast({
          title: "Failed to Decline",
          description: res.error || "Could not decline invitation.",
          variant: "destructive",
        });
      }
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`user_notifications_page_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_team_members" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const markAllRead = () => {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
    window.dispatchEvent(new CustomEvent("geflow:notifications-seen"));
    toast({
      title: "All Caught Up",
      description: "All unread notifications marked as read.",
    });
    load();
  };

  const clearAllNotifications = async () => {
    const now = Date.now();
    localStorage.setItem(CLEARED_KEY, String(now));
    localStorage.setItem(SEEN_KEY, String(now));
    localStorage.removeItem(DISMISSED_KEY);
    
    // Also try to record clearance in user metadata
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.auth.updateUser({
          data: { notifications_cleared_at: now }
        });
      }
    } catch {
      /* ignore auth update failure */
    }

    setItems([]);
    window.dispatchEvent(new CustomEvent("geflow:notifications-seen"));
    toast({
      title: "Notifications Cleared 🧹",
      description: "All active notifications and audit alert entries have been cleared.",
    });
  };

  const dismissSingle = (id: string) => {
    try {
      const dismissedIds: string[] = JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
      if (!dismissedIds.includes(id)) {
        dismissedIds.push(id);
        localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissedIds));
      }
    } catch {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([id]));
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast({
      title: "Notification Dismissed",
      description: "Notification removed from your workspace feed.",
    });
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
          <p className="text-sm text-muted-foreground">Announcements, support replies, AI reports and inventory alerts for your workspace.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/dashboard/announcements" className="h-10 px-4 rounded-xl border border-border text-xs font-bold inline-flex items-center gap-2 hover:bg-muted transition-colors">
            <Megaphone className="h-4 w-4" /> Announcements
          </Link>
          {items.length > 0 && (
            <>
              <button onClick={markAllRead} className="h-10 px-4 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 text-xs font-bold transition-colors inline-flex items-center gap-1.5">
                <CheckCheck className="w-4 h-4" /> Mark all read
              </button>
              <button onClick={clearAllNotifications} className="h-10 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold transition-colors inline-flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Clear all
              </button>
            </>
          )}
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
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(["all", "team_invite", "announcement", "ticket", "stock", "ai_report", "ai_restock"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`h-9 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${filter === f ? "bg-sky-500 text-white" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}>
                {f === "all" ? "All" : kindMeta[f]?.label || f}
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
              const meta = kindMeta[n.kind] || { icon: Bell, label: "Notification", cls: "bg-muted text-foreground" };
              const Icon = meta.icon;
              return (
                <li key={n.id} className={`p-4 flex gap-4 hover:bg-muted/40 transition-colors ${n.unread ? "bg-sky-400/5" : ""}`}>
                  <div className={`h-10 w-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${meta.cls}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm">{n.title}</p>
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                        {n.unread && <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">New</span>}
                      </div>
                      <button
                        onClick={() => dismissSingle(n.id)}
                        className="text-muted-foreground hover:text-rose-500 p-1.5 rounded-lg hover:bg-muted transition"
                        title="Dismiss notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.description}</p>
                    {n.kind === "team_invite" && n.inviteId && (
                      <div className="flex items-center gap-2.5 mt-3 pt-2 border-t border-border/60">
                        <Button
                          size="sm"
                          onClick={() => handleAccept(n.inviteId!, n.businessName, n.role)}
                          disabled={actionLoading === n.inviteId}
                          className="h-8 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold gap-1.5 shadow-sm border-0"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {actionLoading === n.inviteId ? "Accepting..." : "Accept Invitation"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDecline(n.inviteId!)}
                          disabled={actionLoading === n.inviteId}
                          className="h-8 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-rose-500"
                        >
                          Decline
                        </Button>
                      </div>
                    )}
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
