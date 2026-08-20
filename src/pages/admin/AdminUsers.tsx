import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PanelLayout from "@/components/PanelLayout";
import ExportReportDialog from "@/components/ExportReportDialog";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Filter, UserPlus, MoreVertical, Users as UsersIcon,
  UserCheck, Star, ShieldAlert, Eye, KeyRound, ShieldOff, ShieldCheck, Trash2, Pencil, Loader2,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface UserRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  plan: string;
  status: string;
  usage: number;
  listed_products: number;
  created_at: string;
  last_active: string;
}

const PLANS = ["free", "standard", "premium", "unlimited", "lifetime"];
const PLAN_STYLES: Record<string, string> = {
  free: "bg-slate-400/15 text-slate-500",
  standard: "bg-purple-400/15 text-purple-500",
  premium: "bg-sky-400/15 text-sky-500",
  unlimited: "bg-emerald-400/15 text-emerald-500",
  lifetime: "bg-amber-400/15 text-amber-500",
};
const STATUS_DOT: Record<string, string> = { active: "bg-emerald-500", suspended: "bg-rose-500", pending: "bg-amber-500" };

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min${m > 1 ? "s" : ""} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
};

const colorFromName = (name: string) => {
  const colors = ["bg-rose-400/20 text-rose-500", "bg-sky-400/20 text-sky-500", "bg-purple-400/20 text-purple-500", "bg-emerald-400/20 text-emerald-500", "bg-amber-400/20 text-amber-500", "bg-violet-400/20 text-violet-500"];
  return colors[(name?.charCodeAt(0) || 0) % colors.length];
};

const callAdmin = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
};

const AdminUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Modal state
  const [addOpen, setAddOpen] = useState(false);
  const [viewUser, setViewUser] = useState<UserRow | null>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [suspendUser, setSuspendUser] = useState<UserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: profs, error }, { data: roleRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name, email, plan, status, usage, listed_products, created_at, last_active")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (error) toast({ title: "Failed to load users", description: error.message, variant: "destructive" });
    setUsers((profs as UserRow[]) ?? []);
    const map: Record<string, string> = {};
    (roleRows ?? []).forEach((r: any) => { map[r.user_id] = r.role; });
    setRoles(map);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin_users_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, load)
      .subscribe();
    const onRefresh = () => load();
    window.addEventListener("panel:refresh", onRefresh);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("panel:refresh", onRefresh);
    };
  }, [load]);

  useEffect(() => {
    const f = params.get("filter");
    if (f === "active") setStatusFilter("active");
  }, [params]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (planFilter !== "all" && u.plan !== planFilter) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "active") {
          const isActive24h = Date.now() - new Date(u.last_active).getTime() < 24 * 60 * 60 * 1000 && u.status === "active";
          if (!isActive24h) return false;
        } else if (u.status !== statusFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (u.full_name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [users, search, planFilter, statusFilter]);

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "active").length;
  const premiumUsers = users.filter((u) => ["premium", "unlimited", "lifetime"].includes(u.plan)).length;
  const suspendedCount = users.filter((u) => u.status === "suspended").length;

  // Quick actions on profile row
  const updateProfile = async (userId: string, patch: Partial<UserRow>) => {
    const { error } = await supabase.from("profiles").update(patch).eq("user_id", userId);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return false;
    }
    return true;
  };

  // Export metrics shared with dashboard popup
  const exportMetrics = useMemo(() => {
    const PLAN_PRICES: Record<string, number> = { free: 0, standard: 29, premium: 79, unlimited: 0, lifetime: 0 };
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const active24h = users.filter((u) => new Date(u.last_active).getTime() >= dayAgo && u.status === "active").length;
    const mrr = users.reduce((s, u) => s + (PLAN_PRICES[u.plan] ?? 0), 0);
    return {
      totalUsers: users.length,
      activeUsers: active24h,
      mrr,
      aiUsage: users.reduce((s, u) => s + (u.usage ?? 0), 0),
      systemHealth: 99.98,
      openTickets: 0,
      usersCreatedAt: users.map((u) => u.created_at),
      usersLastActive: users.map((u) => u.last_active),
      ticketsCreatedAt: [] as string[],
      ticketsRead: [] as boolean[],
      usersUsage: users.map((u) => u.usage ?? 0),
      usersPlan: users.map((u) => u.plan),
    };
  }, [users]);

  const StatPill = ({ label, value, icon: Icon, accent }: any) => (
    <div className={`bg-card border border-border rounded-2xl p-5 hover:-translate-y-1 hover:shadow-xl ${accent} transition-all`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center"><Icon className="h-4 w-4" /></div>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );

  // ---------- Add User form ----------
  const [addForm, setAddForm] = useState({ full_name: "", email: "", plan: "free", password: "", confirm: "" });
  const resetAddForm = () => setAddForm({ full_name: "", email: "", plan: "free", password: "", confirm: "" });
  const submitAdd = async () => {
    if (!addForm.email || !addForm.password) { toast({ title: "Email and password required", variant: "destructive" }); return; }
    if (addForm.password.length < 6) { toast({ title: "Password must be 6+ characters", variant: "destructive" }); return; }
    if (addForm.password !== addForm.confirm) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
    setBusy(true);
    try {
      await callAdmin({ action: "create", email: addForm.email, password: addForm.password, full_name: addForm.full_name, plan: addForm.plan });
      toast({ title: "User created", description: `${addForm.email} is now active.` });
      setAddOpen(false); resetAddForm(); load();
    } catch (e: any) {
      toast({ title: "Create failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  // ---------- Edit Permission ----------
  const [editForm, setEditForm] = useState({ role: "user", plan: "free" });
  useEffect(() => {
    if (editUser) setEditForm({ role: roles[editUser.user_id] ?? "user", plan: editUser.plan });
  }, [editUser, roles]);
  const submitEdit = async () => {
    if (!editUser) return;
    setBusy(true);
    try {
      if (editForm.plan !== editUser.plan) await updateProfile(editUser.user_id, { plan: editForm.plan });
      if ((roles[editUser.user_id] ?? "user") !== editForm.role) {
        await callAdmin({ action: "setRole", user_id: editUser.user_id, role: editForm.role });
      }
      toast({ title: "Permissions updated" });
      setEditUser(null); load();
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  // ---------- Reset Password ----------
  const submitReset = async () => {
    if (!resetUser?.email) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetUser.email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      toast({ title: "Reset link sent", description: `An email was sent to ${resetUser.email}.` });
      setResetUser(null);
    } catch (e: any) {
      toast({ title: "Failed to send", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  // ---------- Suspend / Activate ----------
  const submitSuspend = async () => {
    if (!suspendUser) return;
    setBusy(true);
    const next = suspendUser.status === "suspended" ? "active" : "suspended";
    const ok = await updateProfile(suspendUser.user_id, { status: next });
    if (ok) toast({ title: next === "suspended" ? "Account suspended" : "Account activated" });
    setSuspendUser(null); setBusy(false);
  };

  // ---------- Delete ----------
  const submitDelete = async () => {
    if (!deleteUser) return;
    setBusy(true);
    try {
      await callAdmin({ action: "delete", user_id: deleteUser.user_id });
      toast({ title: "User deleted", description: `${deleteUser.email ?? deleteUser.user_id} removed.` });
      setDeleteUser(null); load();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <PanelLayout navItems={ADMIN_NAV} {...ADMIN_IDENTITY} isAdmin>
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1">Users Management</h1>
          <p className="text-sm text-muted-foreground">Monitor platform identity, access levels, and account lifecycle.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search identity..."
              className="h-10 w-64 pl-10 pr-3 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-10 px-4 rounded-xl bg-card border border-border text-sm font-bold inline-flex items-center gap-2 hover:bg-muted transition">
                <Filter className="h-4 w-4" /> Filter
                {(planFilter !== "all" || statusFilter !== "all") && (
                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-3">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">ACCOUNT STATUS</p>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 mb-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">SUBSCRIPTION PLAN</p>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="h-9 mb-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  {PLANS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <button
                onClick={() => { setPlanFilter("all"); setStatusFilter("all"); }}
                className="w-full h-9 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted transition"
              >Clear filters</button>
            </DropdownMenuContent>
          </DropdownMenu>

          <ExportReportDialog metrics={exportMetrics} filename="geflow-users-report" />

          <button
            onClick={() => setAddOpen(true)}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 text-white text-sm font-bold inline-flex items-center gap-2 hover:shadow-lg hover:shadow-sky-500/30 hover:-translate-y-0.5 transition-all"
          >
            <UserPlus className="h-4 w-4" /> Add New User
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatPill label="Total Users" value={totalUsers} icon={UsersIcon} accent="hover:shadow-blue-500/15" />
        <StatPill label="Active Users" value={activeUsers} icon={UserCheck} accent="hover:shadow-emerald-500/15" />
        <StatPill label="Premium Users" value={premiumUsers} icon={Star} accent="hover:shadow-purple-500/15" />
        <StatPill label="Suspended" value={suspendedCount} icon={ShieldAlert} accent="hover:shadow-rose-500/15" />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border">
                <th className="text-left px-6 py-4">USER</th>
                <th className="text-left px-4 py-4">PLAN</th>
                <th className="text-left px-4 py-4">STATUS</th>
                <th className="text-left px-4 py-4">JOINED</th>
                <th className="text-left px-4 py-4">LAST ACTIVE</th>
                <th className="text-right px-4 py-4">PRODUCTS</th>
                <th className="text-right px-6 py-4">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">Loading users...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">No users match your filters.</td></tr>
              ) : filtered.map((u) => {
                const initial = (u.full_name || u.email || "?").charAt(0).toUpperCase();
                const isSuspended = u.status === "suspended";
                return (
                  <tr key={u.user_id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold ${colorFromName(u.full_name || u.email || "")}`}>{initial}</div>
                        <div className="min-w-0">
                          <p className="font-bold">{u.full_name || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full uppercase ${PLAN_STYLES[u.plan] || PLAN_STYLES.free}`}>{u.plan}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold capitalize">
                        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[u.status] || "bg-slate-400"}`} />
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="px-4 py-4 text-xs text-muted-foreground">{timeAgo(u.last_active)}</td>
                    <td className="px-4 py-4 text-right font-bold">{u.listed_products}</td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center ml-auto"><MoreVertical className="h-4 w-4" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => setViewUser(u)}><Eye className="h-4 w-4 mr-2" /> View Profile</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditUser(u)}><Pencil className="h-4 w-4 mr-2" /> Edit Permission</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetUser(u)}><KeyRound className="h-4 w-4 mr-2" /> Reset Password</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setSuspendUser(u)}>
                            {isSuspended ? <><ShieldCheck className="h-4 w-4 mr-2" /> Activate Account</> : <><ShieldOff className="h-4 w-4 mr-2" /> Suspend Account</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteUser(u)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User dialog */}
      <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetAddForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Creates an authenticated account and profile.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Full Name</Label><Input value={addForm.full_name} onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })} placeholder="Jane Doe" /></div>
            <div><Label>Email</Label><Input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="user@example.com" /></div>
            <div>
              <Label>Subscription Plan</Label>
              <Select value={addForm.plan} onValueChange={(v) => setAddForm({ ...addForm, plan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLANS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Password</Label><Input type="password" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} /></div>
              <div><Label>Confirm</Label><Input type="password" value={addForm.confirm} onChange={(e) => setAddForm({ ...addForm, confirm: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submitAdd} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Profile */}
      <Dialog open={!!viewUser} onOpenChange={(v) => !v && setViewUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>User Profile</DialogTitle></DialogHeader>
          {viewUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`h-16 w-16 rounded-full flex items-center justify-center font-bold text-2xl ${colorFromName(viewUser.full_name || viewUser.email || "")}`}>
                  {(viewUser.full_name || viewUser.email || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-lg">{viewUser.full_name || "Unnamed"}</p>
                  <p className="text-sm text-muted-foreground">{viewUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/40 rounded-xl p-3"><p className="text-[10px] font-bold tracking-widest text-muted-foreground">PLAN</p><p className="font-bold capitalize mt-1">{viewUser.plan}</p></div>
                <div className="bg-muted/40 rounded-xl p-3"><p className="text-[10px] font-bold tracking-widest text-muted-foreground">STATUS</p><p className="font-bold capitalize mt-1">{viewUser.status}</p></div>
                <div className="bg-muted/40 rounded-xl p-3"><p className="text-[10px] font-bold tracking-widest text-muted-foreground">INVENTORY</p><p className="font-bold mt-1">{viewUser.listed_products} products</p></div>
                <div className="bg-muted/40 rounded-xl p-3"><p className="text-[10px] font-bold tracking-widest text-muted-foreground">JOINED</p><p className="font-bold mt-1">{new Date(viewUser.created_at).toLocaleDateString()}</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Permission */}
      <Dialog open={!!editUser} onOpenChange={(v) => !v && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Permission</DialogTitle>
            <DialogDescription>Assign role and subscription plan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Role</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plan</Label>
              <Select value={editForm.plan} onValueChange={(v) => setEditForm({ ...editForm, plan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLANS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={submitEdit} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password confirm */}
      <AlertDialog open={!!resetUser} onOpenChange={(v) => !v && setResetUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send password reset link?</AlertDialogTitle>
            <AlertDialogDescription>
              An email will be sent to <strong>{resetUser?.email}</strong> with a secure link to set a new password. After resetting they will be redirected to the login page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submitReset} disabled={busy}>Send Link</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend / Activate confirm */}
      <AlertDialog open={!!suspendUser} onOpenChange={(v) => !v && setSuspendUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{suspendUser?.status === "suspended" ? "Activate this account?" : "Suspend this account?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {suspendUser?.status === "suspended"
                ? `${suspendUser?.email} will regain access immediately.`
                : `${suspendUser?.email} will lose access until reactivated.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submitSuspend} disabled={busy}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteUser} onOpenChange={(v) => !v && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{deleteUser?.email}</strong>, their profile, role and authentication record. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submitDelete} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PanelLayout>
  );
};

export default AdminUsers;
