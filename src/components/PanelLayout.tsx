import { ReactNode, useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllContactSubmissions } from "@/lib/contactService";
import { Bell, ChevronLeft, ChevronDown, LogOut, RefreshCw, Search, Sun, Moon, Settings, LifeBuoy, LogIn, Lock, Menu, Sparkles, LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import AnnouncementBar from "@/components/AnnouncementBar";
import AIAssistant from "@/components/ai/AIAssistant";
import { usePlatformSettings } from "@/components/PlatformSettingsProvider";

export interface NavChild { label: string; to: string; }
export interface NavItem { label: string; to: string; icon: LucideIcon; children?: NavChild[]; }

interface Notification { id: string; title: string; description: string; createdAt: string; unread: boolean; }

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
  // Automatically treat any /admin route as an admin view
  const isPathAdmin = isAdmin || location.pathname.startsWith("/admin");
  const isLocked = (to: string) => lockedPaths.some((p) => to === p || to.startsWith(p + "/"));
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
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
      if (data.user) {
        setNotifications([
          { id: "welcome", title: "Welcome to GeFlow", description: "Your workspace is ready.", createdAt: data.user.created_at, unread: true },
        ]);
      }
    }
  }, [isPathAdmin]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

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

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
    window.dispatchEvent(new CustomEvent("panel:refresh"));
    toast({ title: "Refreshed", description: "Latest data loaded." });
    setTimeout(() => setRefreshing(false), 700);
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

  const BrandLogo = () => (
    <Link to={isAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2">
      {settings?.logo_url ? (
        <img src={settings.logo_url} alt={settings?.app_name ?? "Logo"} className="h-8 max-w-[140px] object-contain" />
      ) : (
        <>
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-sky-400 flex items-center justify-center text-white font-bold text-sm">G</div>
          <span className="font-bold text-lg bg-gradient-to-r from-violet-500 to-sky-400 bg-clip-text text-transparent">{settings?.app_name ?? "GeFlow"}</span>
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

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Desktop sidebar — fixed height, internal scroll only on nav */}
      <aside className={`${collapsed ? "w-20" : "w-64"} hidden md:flex flex-col border-r border-border bg-background transition-all duration-300`}>
        <div className="flex items-center justify-between p-4 border-b border-border h-16 flex-shrink-0">
          {!collapsed && <BrandLogo />}
          <button onClick={() => setCollapsed(!collapsed)} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

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

          <div className="flex-1 max-w-xl relative hidden sm:block">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search anything..."
              className="w-full h-10 pl-10 pr-4 bg-muted/40 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex items-center gap-1.5 ml-auto pl-2">
            {!isPathAdmin && (
              <button
                onClick={() => setAiOpen(true)}
                className="h-10 pl-2.5 pr-3 rounded-xl bg-gradient-to-r from-violet-500 to-sky-400 text-white flex items-center gap-1.5 text-xs font-bold transition-all hover:opacity-90 hover:scale-105 shadow-sm"
                aria-label="Open AI Assistant"
              >
                <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">AI Assistant</span>
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

            <Popover>
              <PopoverTrigger asChild>
                <button className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center relative transition-all hover:scale-105">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <p className="font-bold text-sm">Notifications</p>
                  <span className="text-[10px] font-bold tracking-widest text-sky-500">{unreadCount} NEW</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-6 text-center text-xs text-muted-foreground">No notifications</p>
                  ) : (
                    notifications.map((n) => (
                      <Link
                        key={n.id}
                        to={isAdmin ? "/admin/notifications" : "/dashboard/announcements/notifications"}
                        className={`block p-3 border-b border-border last:border-0 hover:bg-muted/40 transition-colors ${n.unread ? "bg-sky-400/5" : ""}`}
                      >
                        <p className="text-sm font-semibold">{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                      </Link>
                    ))
                  )}
                </div>
                <div className="p-3 border-t border-border space-y-2">
                  <Link
                    to={isAdmin ? "/admin/notifications" : "/dashboard/announcements/notifications"}
                    className="w-full h-9 rounded-xl bg-sky-400 hover:bg-sky-500 text-white text-xs font-bold transition-colors flex items-center justify-center"
                  >
                    View all notifications
                  </Link>
                  {!isAdmin && (
                    <Link
                      to="/dashboard/announcements"
                      className="w-full h-9 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-colors flex items-center justify-center"
                    >
                      View announcements
                    </Link>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <button
              onClick={handleRefresh}
              className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center transition-all hover:scale-105"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={handleLogout}
              className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center transition-all hover:scale-105"
              aria-label="Logout"
              title="Logout"
            >
              <LogIn className="h-4 w-4 rotate-180" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-bold text-sm ml-1 hover:scale-105 transition-transform">
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
