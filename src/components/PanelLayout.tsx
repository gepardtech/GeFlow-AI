import { ReactNode, useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllContactSubmissions } from "@/lib/contactService";
import {
  Bell, ChevronLeft, ChevronDown, LogOut, RefreshCw, Search, Sun, Moon,
  Settings, LifeBuoy, LogIn, Lock, Menu, Sparkles, LucideIcon,
  Building2, Briefcase, Check, ChevronsUpDown, Store, UserCheck, Plus,
  UserPlus, CheckCircle2, X, Megaphone
} from "lucide-react";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import AnnouncementBar from "@/components/AnnouncementBar";
import AIAssistant from "@/components/ai/AIAssistant";
import { usePlatformSettings } from "@/components/PlatformSettingsProvider";
import { TopBusinessEmployeeDropdown } from "@/components/TopBusinessEmployeeDropdown";
import { getPendingInvitationsForUser, acceptInvitation, declineInvitation } from "@/lib/teamInviteService";

export interface NavChild { label: string; to: string; }
export interface NavItem { label: string; to: string; icon: LucideIcon; children?: NavChild[]; }

interface Notification {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  unread: boolean;
  type?: "team_invite" | "invite_accepted" | "general" | "announcement" | "contact";
  inviteId?: string;
  businessId?: string;
  businessName?: string;
  role?: string;
  ownerName?: string;
  link?: string;
}

interface Props {
  children: ReactNode;
  sidebarLabel: string;
  navItems: NavItem[];
  identityName: string;
  identityRole: string;
  identityBadgeClass?: string;
  initial: string;
  isAdmin?: boolean;
  lockedPaths?: string[];
}

const PanelLayout = ({ children, sidebarLabel, navItems, identityName, identityRole, identityBadgeClass = "bg-primary/10 text-primary", initial, isAdmin = false, lockedPaths = [] }: Props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    businesses,
    ownedBusinesses,
    staffBusinesses,
    workspaceMode,
    setWorkspaceMode,
    activeBusiness,
    activeId,
    setActive,
  } = useActiveBusiness();

  // Automatically treat any /admin route as an admin view
  const isPathAdmin = isAdmin || location.pathname.startsWith("/admin");
  const isLocked = (to: string) => lockedPaths.some((p) => to === p || to.startsWith(p + "/"));
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const { settings } = usePlatformSettings();

  useEffect(() => { setMounted(true); }, []);

  const isDark = mounted && (resolvedTheme === "dark" || theme === "dark" || (typeof document !== "undefined" && document.documentElement.classList.contains("dark")));

  // Listen to theme change events
  useEffect(() => {
    const handleThemeChange = (e: any) => {
      const newTheme = e.detail?.theme;
      if (newTheme) {
        setTheme(newTheme);
      }
    };
    window.addEventListener("geflow:theme-changed", handleThemeChange);
    return () => window.removeEventListener("geflow:theme-changed", handleThemeChange);
  }, [setTheme]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Auto-open groups containing the active route
  useEffect(() => {
    const initialGroups: Record<string, boolean> = {};
    navItems.forEach((item) => {
      if (item.children?.some((c) => location.pathname.startsWith(c.to)) || location.pathname === item.to) {
        if (item.children) initialGroups[item.to] = true;
      }
    });
    setOpenGroups((prev) => ({ ...initialGroups, ...prev }));
  }, [location.pathname, navItems]);

  const settingsPath = isPathAdmin ? "/admin/settings" : "/dashboard/workspace";
  const supportPath = isPathAdmin ? "/admin/support" : "/contact";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const fetchNotifications = useCallback(async () => {
    if (isPathAdmin) {
      try {
        const res = await fetch("/api/admin/notifications");
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.notifications) && json.notifications.length > 0) {
            setNotifications(json.notifications);
            return;
          }
        }
      } catch {
        /* fallback */
      }
      const data = await fetchAllContactSubmissions();
      setNotifications(
        (data ?? []).slice(0, 8).map((d: any) => ({
          id: d.id,
          title: `New message from ${d.name}`,
          description: d.message?.slice(0, 80) ?? "",
          createdAt: d.created_at,
          unread: !d.is_read,
        }))
      );
    } else {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (user) {
        try {
          const res = await fetch(`/api/user/notifications?email=${encodeURIComponent(user.email || "")}&userId=${user.id}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.notifications) && json.notifications.length > 0) {
              setNotifications(json.notifications);
              return;
            }
          }
        } catch {
          /* fallback */
        }

        const notifList: Notification[] = [];

        // 1. Fetch pending invitations with real business names
        try {
          const invites = await getPendingInvitationsForUser(user.id, user.email);
          invites.forEach((inv) => {
            notifList.push({
              id: `team-inv-${inv.id}`,
              title: `Team Invitation: ${inv.businessName}`,
              description: `${inv.ownerName} invited you to join "${inv.businessName}" as ${inv.role.toUpperCase()}.`,
              createdAt: inv.createdAt,
              unread: true,
              type: "team_invite",
              inviteId: inv.id,
              businessId: inv.businessId,
              businessName: inv.businessName,
              role: inv.role,
              ownerName: inv.ownerName,
            });
          });
        } catch (invErr) {
          console.warn("Notice loading pending invites in header:", invErr);
        }

        // 2. Fetch server team notifications (e.g. accepted notifications)
        try {
          const res = await fetch(`/api/team/notifications?email=${encodeURIComponent(user.email || "")}&userId=${user.id}`);
          if (res.ok) {
            const teamData = await res.json();
            if (teamData.success && Array.isArray(teamData.notifications)) {
              teamData.notifications.forEach((tn: any) => {
                if (!notifList.some((existing) => existing.inviteId === tn.inviteId || existing.id === tn.id)) {
                  notifList.push({
                    id: tn.id,
                    title: tn.title,
                    description: tn.description,
                    createdAt: tn.createdAt,
                    unread: tn.unread ?? true,
                    type: tn.type || "general",
                    inviteId: tn.inviteId,
                    businessName: tn.businessName,
                    role: tn.role,
                    ownerName: tn.ownerName,
                  });
                }
              });
            }
          }
        } catch {
          /* ignore */
        }

        // 3. Announcements
        try {
          const { data: anns } = await supabase
            .from("announcements")
            .select("id, title, body, created_at")
            .order("created_at", { ascending: false })
            .limit(5);

          (anns || []).forEach((a: any) => {
            notifList.push({
              id: `ann-${a.id}`,
              title: a.title,
              description: a.body?.slice(0, 80) || "",
              createdAt: a.created_at,
              unread: false,
              type: "announcement",
              link: "/dashboard/announcements",
            });
          });
        } catch {
          /* ignore */
        }

        if (notifList.length === 0) {
          notifList.push({
            id: "welcome",
            title: "Welcome to GeFlow",
            description: "Your workspace is live and synchronized.",
            createdAt: user.created_at,
            unread: false,
            type: "general",
          });
        }

        setNotifications(notifList);
      }
    }
  }, [isPathAdmin]);

  const handleAcceptInvite = async (inviteId: string, bizName?: string, role?: string) => {
    setActionLoadingId(inviteId);
    try {
      const res = await acceptInvitation(inviteId, bizName, role);
      if (res.success) {
        toast({
          title: "Invitation Accepted! 🎉",
          description: `You are now active in "${bizName || 'the store'}" as ${role?.toUpperCase() || 'staff'}.`,
        });
        setNotifPopoverOpen(false);
        await fetchNotifications();
        // Redirect to store workspace with proper role view
        const target = role === "cashier" ? "/dashboard/pos" : role === "inventory" ? "/dashboard/inventory" : "/dashboard";
        navigate(target);
      } else {
        toast({
          title: "Failed to Accept",
          description: res.error || "Could not accept invitation.",
          variant: "destructive",
        });
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    setActionLoadingId(inviteId);
    try {
      const res = await declineInvitation(inviteId);
      if (res.success) {
        toast({
          title: "Invitation Declined",
          description: "Invitation was removed.",
        });
        await fetchNotifications();
      } else {
        toast({
          title: "Failed to Decline",
          description: res.error || "Could not decline invitation.",
          variant: "destructive",
        });
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Realtime updates for all notifications & team invites
  useEffect(() => {
    const onNotifEvent = () => fetchNotifications();
    window.addEventListener("geflow:invitation-sent", onNotifEvent);
    window.addEventListener("geflow:invitation-resent", onNotifEvent);
    window.addEventListener("geflow:team-invite-accepted", onNotifEvent);
    window.addEventListener("panel:refresh", onNotifEvent);

    return () => {
      window.removeEventListener("geflow:invitation-sent", onNotifEvent);
      window.removeEventListener("geflow:invitation-resent", onNotifEvent);
      window.removeEventListener("geflow:team-invite-accepted", onNotifEvent);
      window.removeEventListener("panel:refresh", onNotifEvent);
    };
  }, [fetchNotifications]);

  // Realtime updates for admin
  useEffect(() => {
    if (!isPathAdmin) return;
    const onSubmissionChange = () => fetchNotifications();
    window.addEventListener("geflow:contact-submission-added", onSubmissionChange);
    window.addEventListener("geflow:contact-submission-updated", onSubmissionChange);
    window.addEventListener("geflow:contact-submission-deleted", onSubmissionChange);
    window.addEventListener("geflow:ai-report-created", onSubmissionChange);
    window.addEventListener("geflow:ai-restock-created", onSubmissionChange);
    const channel = supabase
      .channel("contact_notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_submissions" }, () => fetchNotifications())
      .subscribe();
    return () => {
      window.removeEventListener("geflow:contact-submission-added", onSubmissionChange);
      window.removeEventListener("geflow:contact-submission-updated", onSubmissionChange);
      window.removeEventListener("geflow:contact-submission-deleted", onSubmissionChange);
      window.removeEventListener("geflow:ai-report-created", onSubmissionChange);
      window.removeEventListener("geflow:ai-restock-created", onSubmissionChange);
      supabase.removeChannel(channel);
    };
  }, [isPathAdmin, fetchNotifications]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    window.dispatchEvent(new CustomEvent("panel:refresh"));
    window.dispatchEvent(new CustomEvent("geflow:data-refresh"));
    window.dispatchEvent(new CustomEvent("geflow:products-updated"));
    window.dispatchEvent(new CustomEvent("geflow:business-updated"));
    toast({ title: "Refreshed", description: "Workspace data and notifications refreshed." });
    setTimeout(() => setRefreshing(false), 600);
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  // Shared nav renderer — used by both the desktop sidebar and the mobile drawer.
  const NavList = ({ mini = false }: { mini?: boolean }) => (
    <ul className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isGroup = !!item.children?.length;
        const groupOpen = openGroups[item.to] ?? false;
        const active = location.pathname === item.to ||
          (isGroup && item.children!.some((c) => location.pathname === c.to));

        if (isGroup && !mini) {
          return (
            <li key={item.to}>
              <button
                onClick={() => setOpenGroups((s) => ({ ...s, [item.to]: !groupOpen }))}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active ? "bg-sky-400 text-white shadow-sm dark:bg-sky-500/90" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${groupOpen ? "rotate-180" : ""}`} />
              </button>
              {groupOpen && (
                <ul className="mt-1 ml-7 space-y-0.5 border-l border-border pl-2">
                  {item.children!.map((c) => {
                    const cActive = location.pathname === c.to;
                    return (
                      <li key={c.to}>
                        <Link
                          to={c.to}
                          className={`block px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            cActive ? "bg-sky-400/15 text-sky-600 dark:text-sky-300" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          }`}
                        >
                          {c.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        }

        const locked = isLocked(item.to);
        return (
          <li key={item.to}>
            <Link
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active ? "bg-sky-400 text-white shadow-sm dark:bg-sky-500/90" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              } ${locked ? "opacity-70" : ""}`}
              title={locked ? `${item.label} — Upgrade required` : item.label}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!mini && <span className="flex-1">{item.label}</span>}
              {!mini && locked && <Lock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [allBizCategories, setAllBizCategories] = useState<{ id: string; name: string; industry_type: string }[]>([]);

  useEffect(() => {
    fetch("/api/admin/business-categories")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.categories)) {
          setAllBizCategories(d.categories);
        } else {
          supabase
            .from("business_categories")
            .select("id, name, industry_type")
            .then(({ data }) => {
              if (data) setAllBizCategories(data as any);
            });
        }
      })
      .catch(() => {
        supabase
          .from("business_categories")
          .select("id, name, industry_type")
          .then(({ data }) => {
            if (data) setAllBizCategories(data as any);
          });
      });
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: { label: string; sub: string; to: string; badge?: string }[] = [];

    // 1. Navigation items
    navItems.forEach((item) => {
      if (item.label.toLowerCase().includes(q)) {
        results.push({ label: item.label, sub: "Navigation Page", to: item.to, badge: "PAGE" });
      }
      if (item.children) {
        item.children.forEach((c) => {
          if (c.label.toLowerCase().includes(q)) {
            results.push({ label: `${item.label} → ${c.label}`, sub: "Subpage", to: c.to, badge: "PAGE" });
          }
        });
      }
    });

    // 2. Business Categories (Admin or User)
    allBizCategories.forEach((cat) => {
      if (cat.name.toLowerCase().includes(q) || cat.industry_type?.toLowerCase().includes(q)) {
        results.push({
          label: cat.name,
          sub: `Category: ${cat.industry_type || "Retail"}`,
          to: isPathAdmin ? `/admin/business-categories?search=${encodeURIComponent(cat.name)}` : `/dashboard/inventory?category=${encodeURIComponent(cat.id)}`,
          badge: "CATEGORY",
        });
      }
    });

    // 3. Businesses / Stores
    businesses.forEach((b) => {
      if (b.business_name?.toLowerCase().includes(q)) {
        results.push({
          label: b.business_name,
          sub: `Store (${b.currency})`,
          to: isPathAdmin ? `/admin/businesses?search=${encodeURIComponent(b.business_name)}` : `/dashboard`,
          badge: "STORE",
        });
      }
    });

    // 4. Quick Shortcuts
    if ("pos terminal billing checkout counter".includes(q)) {
      results.push({ label: "POS Terminal", sub: "Point of Sale Checkout", to: "/dashboard/pos", badge: "POS" });
    }
    if ("inventory products stock catalog items".includes(q)) {
      results.push({ label: "Inventory Catalog", sub: "Stock & Products", to: isPathAdmin ? "/admin/products" : "/dashboard/inventory", badge: "STOCK" });
    }
    if ("users customers accounts signups".includes(q) && isPathAdmin) {
      results.push({ label: "Users & Accounts", sub: "Admin User Management", to: "/admin/users", badge: "USERS" });
    }
    if ("billing invoices pricing subscriptions".includes(q)) {
      results.push({ label: "Billing & Invoices", sub: "Plans & Revenue", to: isPathAdmin ? "/admin/billing" : "/dashboard/subscription", badge: "BILLING" });
    }

    return results.slice(0, 8);
  }, [searchQuery, navItems, allBizCategories, businesses, isPathAdmin]);

  const BrandLogo = () => (
    <Link to={isAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2.5 min-w-0 group">
      {settings?.logo_url ? (
        <img src={settings.logo_url} alt={settings?.app_name ?? "Logo"} className="h-9 max-w-[150px] object-contain" />
      ) : (
        <>
          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center p-1.5 shrink-0 shadow-xs overflow-hidden">
            <img src={settings?.favicon_url || "/favicon.ico"} alt="Logo" className="w-full h-full object-contain" onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-base bg-gradient-to-r from-violet-500 to-sky-400 bg-clip-text text-transparent truncate leading-none">
              {settings?.app_name ?? "GeFlow"}
            </span>
            {settings?.tagline && (
              <span className="text-[10px] text-muted-foreground font-medium truncate leading-tight mt-0.5 max-w-[130px]">
                {settings.tagline}
              </span>
            )}
          </div>
        </>
      )}
    </Link>
  );

  const IdentityFooter = () => (
    <div className="p-3 border-t border-border flex-shrink-0 bg-background">
      <div className="bg-muted/40 rounded-xl p-3 mb-2">
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground">IDENTITY</p>
        <p className="font-bold text-sm mt-1">{identityName}</p>
        <span className={`inline-block text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full mt-1.5 ${identityBadgeClass}`}>{identityRole}</span>
      </div>
      <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
        <LogOut className="h-4 w-4" /> Logout
      </button>
    </div>
  );

  const WorkspaceSwitcher = ({ mini = false }: { mini?: boolean }) => {
    if (isPathAdmin) return null;
    return (
      <div className="p-2.5 border-b border-border/80 bg-muted/10">
        <TopBusinessEmployeeDropdown variant="sidebar" collapsed={mini} />
      </div>
    );
  };

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Desktop sidebar — fixed height, internal scroll only on nav */}
      <aside className={`${collapsed ? "w-20" : "w-64"} hidden md:flex flex-col border-r border-border bg-background transition-all duration-300`}>
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} p-3 border-b border-border h-16 flex-shrink-0`}>
          {!collapsed ? (
            <BrandLogo />
          ) : (
            <Link to={isAdmin ? "/admin" : "/dashboard"} className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center p-1.5 shadow-xs overflow-hidden" title={settings?.app_name ?? "GeFlow"}>
              <img src={settings?.favicon_url || "/favicon.ico"} alt="Logo" className="w-full h-full object-contain" />
            </Link>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className={`h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors ${collapsed ? "ml-1" : ""}`}>
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

        <WorkspaceSwitcher mini={collapsed} />

        <nav className="flex-1 p-3 overflow-y-auto min-h-0">
          {!collapsed && <p className="text-[10px] font-bold tracking-widest text-muted-foreground px-3 mb-3 mt-2">{sidebarLabel}</p>}
          <NavList mini={collapsed} />
        </nav>

        {!collapsed && <IdentityFooter />}
      </aside>

      {/* Mobile / tablet drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col md:hidden">
          <div className="flex items-center p-4 border-b border-border h-16 flex-shrink-0">
            <BrandLogo />
          </div>
          <WorkspaceSwitcher />
          <nav className="flex-1 p-3 overflow-y-auto min-h-0">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground px-3 mb-3 mt-1">{sidebarLabel}</p>
            <NavList />
          </nav>
          <IdentityFooter />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <AnnouncementBar audience={isPathAdmin ? "admins" : "users"} />
        <header className="h-16 border-b border-border bg-background flex items-center gap-3 px-4 md:px-6 flex-shrink-0">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center transition-colors md:hidden flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1 max-w-xl relative hidden md:block">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 250)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchResults.length > 0) {
                  navigate(searchResults[0].to);
                  setSearchOpen(false);
                  setSearchQuery("");
                } else if (e.key === "Escape") {
                  setSearchOpen(false);
                }
              }}
              placeholder={isPathAdmin ? "Search categories, businesses, users, settings..." : "Search products, categories, pos, orders..."}
              className="w-full h-10 pl-10 pr-8 bg-muted/40 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-bold"
              >
                ✕
              </button>
            )}

            {/* Live Search Results Dropdown */}
            {searchOpen && searchQuery.trim().length > 0 && (
              <div
                className="absolute left-0 right-0 top-12 bg-popover/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 max-h-80 overflow-y-auto"
                onMouseDown={(e) => e.preventDefault()}
              >
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No results found for "<span className="font-semibold text-foreground">{searchQuery}</span>".
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold tracking-wider text-muted-foreground px-2.5 py-1">
                      MATCHING RESULTS ({searchResults.length})
                    </p>
                    {searchResults.map((r, idx) => (
                      <button
                        key={`${r.to}-${idx}`}
                        type="button"
                        onClick={() => {
                          navigate(r.to);
                          setSearchOpen(false);
                          setSearchQuery("");
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-muted text-left transition-colors group cursor-pointer"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                            {r.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {r.sub}
                          </p>
                        </div>
                        {r.badge && (
                          <span className="text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                            {r.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 ml-auto pl-2">
            {!isPathAdmin && (
              <button
                onClick={() => setAiOpen(true)}
                className="h-10 pl-2.5 pr-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-sky-500 text-white flex items-center gap-1.5 text-xs font-extrabold transition-all hover:opacity-90 hover:scale-105 shadow-sm active:scale-95"
                aria-label="Open Maryam AI"
              >
                <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Maryam AI</span>
              </button>
            )}
            <button
              onClick={() => {
                const next = isDark ? "light" : "dark";
                setTheme(next);
                localStorage.setItem("theme", next);
                localStorage.setItem("geflow_theme", next);
                if (typeof document !== "undefined") {
                  document.documentElement.classList.toggle("dark", next === "dark");
                  document.documentElement.classList.toggle("light", next === "light");
                }
                window.dispatchEvent(new CustomEvent("geflow:theme-changed", { detail: { theme: next } }));
              }}
              className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center transition-all hover:scale-105"
              aria-label="Toggle theme"
            >
              {mounted && (isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-foreground" />)}
            </button>

            <Popover open={notifPopoverOpen} onOpenChange={setNotifPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  className="h-10 w-10 rounded-xl hover:bg-muted/80 border border-border/50 hover:border-border flex items-center justify-center relative transition-all duration-200 cursor-pointer text-muted-foreground hover:text-foreground active:scale-95 shadow-2xs"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 rounded-full bg-rose-500 text-[10px] font-extrabold text-white flex items-center justify-center shadow-xs">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-88 sm:w-96 p-0 shadow-2xl rounded-2xl border border-border overflow-hidden bg-card">
                <div className="p-3.5 border-b border-border flex items-center justify-between bg-muted/40">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-sm leading-none text-foreground">Notifications</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Workspace Activity &amp; Alerts</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black tracking-wider px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {unreadCount} NEW
                  </span>
                </div>
                <div className="max-h-96 overflow-y-auto divide-y divide-border/60">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      <Bell className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="font-semibold">No notifications right now</p>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">You're all caught up!</p>
                    </div>
                  ) : (
                    notifications.map((n) => {
                      if (n.type === "team_invite" && n.inviteId) {
                        return (
                          <div
                            key={n.id}
                            className="p-3.5 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors border-l-4 border-l-emerald-500"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                  <Store className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                                  STORE INVITATION
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {new Date(n.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            <p className="text-xs font-bold text-foreground mt-2">
                              {n.businessName || "Store Workspace"}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                              {n.ownerName || "The store owner"} invited you to join this business as{" "}
                              <strong className="text-emerald-600 dark:text-emerald-400 uppercase font-black">
                                {n.role || "staff"}
                              </strong>
                              . Accept to activate your employee access.
                            </p>

                            <div className="flex items-center gap-2 mt-3">
                              <button
                                type="button"
                                disabled={actionLoadingId === n.inviteId}
                                onClick={() => handleAcceptInvite(n.inviteId!, n.businessName, n.role)}
                                className="flex-1 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {actionLoadingId === n.inviteId ? "Accepting..." : "Accept Invitation"}
                              </button>
                              <button
                                type="button"
                                disabled={actionLoadingId === n.inviteId}
                                onClick={() => handleDeclineInvite(n.inviteId!)}
                                className="h-8 px-3 rounded-lg border border-border hover:bg-muted text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <Link
                          key={n.id}
                          to={n.link || (isAdmin ? "/admin/notifications" : "/dashboard/announcements/notifications")}
                          onClick={() => setNotifPopoverOpen(false)}
                          className={`block p-3.5 hover:bg-muted/40 transition-colors ${
                            n.unread ? "bg-primary/5" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-foreground">{n.title}</p>
                            {n.unread && (
                              <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                            {n.description}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </Link>
                      );
                    })
                  )}
                </div>
                <div className="p-3 border-t border-border space-y-2 bg-muted/20">
                  <Link
                    to={isAdmin ? "/admin/notifications" : "/dashboard/announcements/notifications"}
                    onClick={() => setNotifPopoverOpen(false)}
                    className="w-full h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-2 shadow-xs hover:shadow-sm active:scale-[0.98] cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>View All Notifications &amp; Invites</span>
                  </Link>
                  {!isAdmin && (
                    <Link
                      to="/dashboard/announcements"
                      onClick={() => setNotifPopoverOpen(false)}
                      className="w-full h-9 rounded-xl border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-all flex items-center justify-center gap-2 hover:border-foreground/20 cursor-pointer"
                    >
                      <Megaphone className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Company Announcements</span>
                    </Link>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <button
              onClick={handleRefresh}
              className="h-10 w-10 rounded-xl hover:bg-muted border border-transparent hover:border-border/60 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={handleLogout}
              className="h-10 w-10 rounded-xl hover:bg-muted border border-transparent hover:border-border/60 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Logout"
              title="Logout"
            >
              <LogIn className="h-4 w-4 rotate-180" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-bold text-sm ml-1 transition-opacity hover:opacity-90">
                  {initial}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="font-bold">{identityName}</p>
                  <p className="text-[10px] font-bold tracking-widest text-muted-foreground mt-0.5">{identityRole}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(settingsPath)}>
                  <Settings className="h-4 w-4 mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(supportPath)}>
                  <LifeBuoy className="h-4 w-4 mr-2" /> Support
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 md:p-8 min-w-0 w-full">{children}</main>
      </div>
      {!isPathAdmin && <AIAssistant open={aiOpen} onOpenChange={setAiOpen} />}
    </div>
  );
};

export default PanelLayout;
