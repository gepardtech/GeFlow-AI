import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Users,
  ShieldCheck,
  Briefcase,
  Activity,
  Search,
  SlidersHorizontal,
  MoreVertical,
  UserPlus,
  Mail,
  CheckCircle2,
  XCircle,
  Copy,
  Trash2,
  Edit2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import UserPanelGate from "@/components/UserPanelGate";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type StaffRole = "admin" | "manager" | "cashier" | "inventory";
export type StaffStatus = "active" | "inactive";

export interface StaffMember {
  id: string;
  user_id?: string;
  full_name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  last_telemetry: string;
  avatar_color: string;
  created_at: string;
  is_owner?: boolean;
}

const timeAgoOrOnline = (iso?: string | null) => {
  if (!iso) return "Invited Recently";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 5) return "Online Now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const pickColor = (nameOrEmail: string) => {
  const colors = ["sky", "blue", "cyan", "indigo", "purple", "emerald"];
  const code = (nameOrEmail || "A").charCodeAt(0) + (nameOrEmail || "A").charCodeAt((nameOrEmail || "A").length - 1);
  return colors[code % colors.length];
};

export const UserTeam = () => {
  const { activeId, activeBusiness } = useActiveBusiness();
  const { toast } = useToast();

  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "recent" | "role">("name");

  // Modal States
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<StaffMember | null>(null);

  // Form States
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<StaffRole>("cashier");
  const [formStatus, setFormStatus] = useState<StaffStatus>("active");
  const [submitting, setSubmitting] = useState(false);

  // Load real team data from Supabase (profiles, support_team_members, user_roles)
  const loadRealTeam = useCallback(async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      const [
        { data: profilesData },
        { data: rolesData },
        { data: supportMembersData },
      ] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: true }),
        supabase.from("user_roles").select("*"),
        supabase.from("support_team_members").select("*"),
      ]);

      const rolesMap = new Map<string, string>();
      (rolesData || []).forEach((r) => {
        rolesMap.set(r.user_id, r.role);
      });

      const supportMap = new Map<string, any>();
      (supportMembersData || []).forEach((s) => {
        supportMap.set(s.user_id, s);
      });

      const realList: StaffMember[] = [];
      const seenUserIds = new Set<string>();

      // 1. If we have currentUser, ensure they are listed as Workspace Admin / Owner
      if (currentUser) {
        const myProfile = (profilesData || []).find((p) => p.user_id === currentUser.id);
        const myRole = rolesMap.get(currentUser.id);
        const isOwnerAdmin = myRole === "admin" || true;

        realList.push({
          id: currentUser.id,
          user_id: currentUser.id,
          full_name: myProfile?.full_name || currentUser.user_metadata?.full_name || "Workspace Owner",
          email: myProfile?.email || currentUser.email || "owner@geflowai.com",
          role: isOwnerAdmin ? "admin" : "manager",
          status: (myProfile?.status === "suspended" ? "inactive" : "active") as StaffStatus,
          last_telemetry: "Online Now",
          avatar_color: "sky",
          created_at: myProfile?.created_at || currentUser.created_at || new Date().toISOString(),
          is_owner: true,
        });
        seenUserIds.add(currentUser.id);
      }

      // 2. Add other profiles registered in the system / business
      (profilesData || []).forEach((prof) => {
        if (seenUserIds.has(prof.user_id)) return;
        seenUserIds.add(prof.user_id);

        const assignedRole = rolesMap.get(prof.user_id);
        const supportInfo = supportMap.get(prof.user_id);

        let resolvedRole: StaffRole = "cashier";
        if (assignedRole === "admin" || supportInfo?.role === "admin") resolvedRole = "admin";
        else if (supportInfo?.role === "manager" || prof.plan === "premium" || prof.plan === "unlimited") resolvedRole = "manager";
        else if (supportInfo?.role === "inventory") resolvedRole = "inventory";
        else if (supportInfo?.role) resolvedRole = (supportInfo.role.toLowerCase() as StaffRole);

        const isInactive = prof.status === "suspended" || supportInfo?.is_active === false;

        realList.push({
          id: prof.user_id,
          user_id: prof.user_id,
          full_name: prof.full_name || prof.email?.split("@")[0] || "Team Member",
          email: prof.email || "member@geflowai.com",
          role: resolvedRole,
          status: isInactive ? "inactive" : "active",
          last_telemetry: timeAgoOrOnline(prof.last_active),
          avatar_color: pickColor(prof.full_name || prof.email || prof.user_id),
          created_at: prof.created_at || new Date().toISOString(),
          is_owner: false,
        });
      });

      // 3. Merge with any business-specific staff persisted in localStorage if needed as secondary fallback
      try {
        const localKey = `geflow_biz_staff_${activeId || "default"}`;
        const localSaved = localStorage.getItem(localKey);
        if (localSaved) {
          const localList: StaffMember[] = JSON.parse(localSaved);
          localList.forEach((lm) => {
            if (!realList.some((r) => r.id === lm.id || r.email.toLowerCase() === lm.email.toLowerCase())) {
              realList.push(lm);
            }
          });
        }
      } catch {
        // ignore
      }

      setMembers(realList);
    } catch (err) {
      console.error("Error loading team data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeId]);

  // Initial load and Realtime Database Subscription
  useEffect(() => {
    loadRealTeam();

    const channel = supabase
      .channel(`user_team_hub_rt_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadRealTeam())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => loadRealTeam())
      .on("postgres_changes", { event: "*", schema: "public", table: "support_team_members" }, () => loadRealTeam())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRealTeam]);

  // Filtered & Sorted Members
  const filteredMembers = useMemo(() => {
    return members
      .filter((m) => {
        // Search Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = m.full_name.toLowerCase().includes(q);
          const matchEmail = m.email.toLowerCase().includes(q);
          const matchId = m.id.toLowerCase().includes(q);
          const matchRole = m.role.toLowerCase().includes(q);
          if (!matchName && !matchEmail && !matchId && !matchRole) return false;
        }

        // Role Filter
        if (roleFilter !== "all" && m.role !== roleFilter) return false;

        // Status Filter
        if (statusFilter !== "all" && m.status !== statusFilter) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name") return a.full_name.localeCompare(b.full_name);
        if (sortBy === "recent")
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortBy === "role") return a.role.localeCompare(b.role);
        return 0;
      });
  }, [members, searchQuery, roleFilter, statusFilter, sortBy]);

  // KPI Calculations from live data
  const totalUsersCount = members.length;
  const activeStaffCount = members.filter((m) => m.status === "active").length;
  const adminsCount = members.filter((m) => m.role === "admin").length;
  const managersCount = members.filter((m) => m.role === "manager").length;

  // Open Register Modal
  const openRegisterModal = () => {
    setFormName("");
    setFormEmail("");
    setFormRole("cashier");
    setFormStatus("active");
    setRegisterOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (member: StaffMember) => {
    setSelectedMember(member);
    setFormName(member.full_name);
    setFormEmail(member.email);
    setFormRole(member.role);
    setFormStatus(member.status);
    setEditOpen(true);
  };

  // Handle Add Member
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide legal name and work email.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const emailClean = formEmail.trim().toLowerCase();
      const nameClean = formName.trim();
      const { data: { user } } = await supabase.auth.getUser();

      // Check if user profile already exists
      const { data: existingProf } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("email", emailClean)
        .maybeSingle();

      if (existingProf) {
        // Appoint/assign role in support_team_members or user_roles
        if (user) {
          await supabase.from("support_team_members").insert({
            user_id: existingProf.user_id,
            role: formRole,
            appointed_by_user_id: user.id,
            is_active: true,
          });
        }
      } else {
        // Persist new team member
        const newMember: StaffMember = {
          id: `staff-${Date.now().toString().slice(-6)}`,
          full_name: nameClean,
          email: emailClean,
          role: formRole,
          status: formStatus,
          last_telemetry: "Invited Just Now",
          avatar_color: pickColor(nameClean),
          created_at: new Date().toISOString(),
        };

        const localKey = `geflow_biz_staff_${activeId || "default"}`;
        const localSaved = localStorage.getItem(localKey);
        const existingList = localSaved ? JSON.parse(localSaved) : [];
        localStorage.setItem(localKey, JSON.stringify([newMember, ...existingList]));
      }

      toast({
        title: "Staff Member Registered",
        description: `Digital invitation and permissions dispatched to ${emailClean}.`,
      });

      setRegisterOpen(false);
      await loadRealTeam();
    } catch (err: any) {
      toast({
        title: "Error Registering Staff",
        description: err?.message || "Failed to register team member.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit Member
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !formName.trim() || !formEmail.trim()) return;

    setSubmitting(true);
    try {
      if (selectedMember.user_id) {
        await supabase
          .from("profiles")
          .update({
            full_name: formName.trim(),
            status: formStatus === "active" ? "active" : "suspended",
          })
          .eq("user_id", selectedMember.user_id);

        await supabase
          .from("support_team_members")
          .update({
            role: formRole,
            is_active: formStatus === "active",
          })
          .eq("user_id", selectedMember.user_id);
      }

      // Also update in local business staff storage if applicable
      const localKey = `geflow_biz_staff_${activeId || "default"}`;
      const localSaved = localStorage.getItem(localKey);
      if (localSaved) {
        const existingList: StaffMember[] = JSON.parse(localSaved);
        const updated = existingList.map((m) =>
          m.id === selectedMember.id
            ? { ...m, full_name: formName.trim(), email: formEmail.trim().toLowerCase(), role: formRole, status: formStatus }
            : m
        );
        localStorage.setItem(localKey, JSON.stringify(updated));
      }

      toast({
        title: "Permissions Updated",
        description: `${formName.trim()}'s architectural role updated to ${formRole.toUpperCase()}.`,
      });

      setEditOpen(false);
      await loadRealTeam();
    } catch (err: any) {
      toast({
        title: "Error Updating Staff",
        description: err?.message || "Failed to update staff member.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Account Status
  const toggleMemberStatus = async (member: StaffMember) => {
    const nextStatus: StaffStatus = member.status === "active" ? "inactive" : "active";
    try {
      if (member.user_id) {
        await supabase
          .from("profiles")
          .update({ status: nextStatus === "active" ? "active" : "suspended" })
          .eq("user_id", member.user_id);

        await supabase
          .from("support_team_members")
          .update({ is_active: nextStatus === "active" })
          .eq("user_id", member.user_id);
      }

      const localKey = `geflow_biz_staff_${activeId || "default"}`;
      const localSaved = localStorage.getItem(localKey);
      if (localSaved) {
        const existingList: StaffMember[] = JSON.parse(localSaved);
        const updated = existingList.map((m) =>
          m.id === member.id ? { ...m, status: nextStatus } : m
        );
        localStorage.setItem(localKey, JSON.stringify(updated));
      }

      toast({
        title: nextStatus === "active" ? "Staff Activated" : "Staff Suspended",
        description: `${member.full_name}'s status changed to ${nextStatus.toUpperCase()}.`,
      });
      await loadRealTeam();
    } catch (err: any) {
      toast({
        title: "Status Update Failed",
        description: err?.message || "Could not update status.",
        variant: "destructive",
      });
    }
  };

  // Delete Member
  const handleDeleteMember = async () => {
    if (!selectedMember) return;
    try {
      if (selectedMember.user_id) {
        await supabase
          .from("support_team_members")
          .delete()
          .eq("user_id", selectedMember.user_id);
      }

      const localKey = `geflow_biz_staff_${activeId || "default"}`;
      const localSaved = localStorage.getItem(localKey);
      if (localSaved) {
        const existingList: StaffMember[] = JSON.parse(localSaved);
        const updated = existingList.filter((m) => m.id !== selectedMember.id);
        localStorage.setItem(localKey, JSON.stringify(updated));
      }

      toast({
        title: "Member Decommissioned",
        description: `${selectedMember.full_name} removed from active network hub.`,
      });
      setDeleteOpen(false);
      await loadRealTeam();
    } catch (err: any) {
      toast({
        title: "Failed to Remove Member",
        description: err?.message || "Could not delete staff member.",
        variant: "destructive",
      });
    }
  };

  // Resend Invite
  const handleResendInvite = (member: StaffMember) => {
    toast({
      title: "Invitation Resent",
      description: `Security onboarding credentials dispatched to ${member.email}.`,
    });
  };

  // Copy ID
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast({
      title: "Copied to Clipboard",
      description: `Staff identity key copied: ${id}`,
    });
  };

  // Helper for Avatar styling
  const getAvatarBadge = (name: string, color: string) => {
    const initial = (name.trim()[0] || "U").toUpperCase();
    switch (color) {
      case "blue":
        return (
          <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-extrabold text-sm shrink-0">
            {initial}
          </div>
        );
      case "cyan":
        return (
          <div className="w-11 h-11 rounded-2xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-extrabold text-sm shrink-0">
            {initial}
          </div>
        );
      case "indigo":
        return (
          <div className="w-11 h-11 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-extrabold text-sm shrink-0">
            {initial}
          </div>
        );
      case "purple":
        return (
          <div className="w-11 h-11 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-extrabold text-sm shrink-0">
            {initial}
          </div>
        );
      case "emerald":
        return (
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-extrabold text-sm shrink-0">
            {initial}
          </div>
        );
      default:
        return (
          <div className="w-11 h-11 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center font-extrabold text-sm shrink-0">
            {initial}
          </div>
        );
    }
  };

  // Helper for Role Pills
  const renderRoleBadge = (role: StaffRole) => {
    switch (role) {
      case "admin":
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/20">
            ADMIN
          </span>
        );
      case "manager":
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sky-500/10 text-sky-500 dark:text-sky-400 border border-sky-500/20">
            MANAGER
          </span>
        );
      case "inventory":
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20">
            INVENTORY
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-muted/80 text-muted-foreground border border-border">
            CASHIER
          </span>
        );
    }
  };

  return (
    <UserPanelGate pageTitle="Team Hub" module="team">
      <div className="w-full space-y-6 min-w-0 pb-12">
        {/* ========================================================================= */}
        {/* PAGE HEADER (Title + Active Staff Badge + Refresh + CTA)                  */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Team Hub
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-sky-500/10 dark:bg-sky-500/15 text-sky-500 border border-sky-500/20">
                {activeStaffCount} ACTIVE STAFF
              </span>
              {activeBusiness?.business_name && (
                <span className="hidden md:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold text-muted-foreground bg-muted border border-border">
                  {activeBusiness.business_name}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Orchestrate organizational roles, permissions, and staff lifecycle in real-time.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRefreshing(true);
                loadRealTeam();
              }}
              disabled={refreshing}
              className="h-10 px-3.5 rounded-xl text-xs font-bold border-border/80 hover:bg-muted"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Sync Realtime
            </Button>

            <Button
              onClick={openRegisterModal}
              className="h-10 px-5 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-sky-400 hover:bg-sky-500 text-slate-950 shadow-md shadow-sky-400/20 border-0 flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" /> Add New Member
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TOP KPI METRICS (4 Cards with Green Status Dots)                          */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: TOTAL USERS */}
          <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs relative flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase">
                TOTAL USERS
              </p>
              <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mt-0.5">
                {totalUsersCount}
              </p>
            </div>
          </div>

          {/* Card 2: ADMINS */}
          <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs relative flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase">
                ADMINS
              </p>
              <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mt-0.5">
                {adminsCount}
              </p>
            </div>
          </div>

          {/* Card 3: MANAGERS */}
          <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs relative flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase">
                MANAGERS
              </p>
              <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mt-0.5">
                {managersCount}
              </p>
            </div>
          </div>

          {/* Card 4: ACTIVE STAFF */}
          <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs relative flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase">
                ACTIVE STATUS
              </p>
              <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mt-0.5">
                {activeStaffCount} / {totalUsersCount}
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SEARCH & REFINE GRID CONTROLS                                             */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email or ID..."
              className="h-12 pl-11 pr-4 rounded-2xl bg-card border-border/80 text-xs sm:text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-sky-500"
            />
          </div>

          {/* Refine Grid Filter Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-12 px-5 rounded-2xl bg-card border-border/80 hover:bg-muted/50 text-xs font-bold flex items-center gap-2 text-foreground shrink-0 shadow-xs"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Refine Grid
                {(roleFilter !== "all" || statusFilter !== "all" || sortBy !== "name") && (
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-4 space-y-3.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="font-bold text-foreground">Filter &amp; Sort Staff</span>
                <button
                  type="button"
                  onClick={() => {
                    setRoleFilter("all");
                    setStatusFilter("all");
                    setSortBy("name");
                  }}
                  className="text-[11px] text-sky-500 hover:underline font-semibold"
                >
                  Reset
                </button>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1">
                  Filter By Role
                </label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                    <SelectItem value="inventory">Inventory Clerk</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1">
                  Filter By Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1">
                  Sort Order
                </label>
                <Select
                  value={sortBy}
                  onValueChange={(val: any) => setSortBy(val)}
                >
                  <SelectTrigger className="rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="name">Full Legal Name (A-Z)</SelectItem>
                    <SelectItem value="recent">Most Recent Registration</SelectItem>
                    <SelectItem value="role">Operational Role</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* ========================================================================= */}
        {/* STAFF TEAM TABLE CARD CONTAINER                                          */}
        {/* ========================================================================= */}
        <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-xs overflow-hidden">
          {/* Table Header Row */}
          <div className="grid grid-cols-12 gap-4 pb-4 border-b border-border/60 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground px-2">
            <div className="col-span-5 sm:col-span-4">IDENTITY</div>
            <div className="col-span-3 sm:col-span-3 text-center sm:text-left">
              OPERATIONAL ROLE
            </div>
            <div className="hidden sm:block sm:col-span-2">ACCOUNT STATUS</div>
            <div className="hidden sm:block sm:col-span-2">LAST TELEMETRY</div>
            <div className="col-span-4 sm:col-span-1 text-right">ACTIONS</div>
          </div>

          {/* Table Body Rows */}
          <div className="divide-y divide-border/40">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground text-xs gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-sky-500" />
                <p>Synchronizing real-time team members...</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
                <Users className="w-8 h-8 mx-auto opacity-30" />
                <p>No team members matching your search criteria.</p>
              </div>
            ) : (
              filteredMembers.map((member) => {
                const isActive = member.status === "active";

                return (
                  <div
                    key={member.id}
                    className="grid grid-cols-12 gap-4 py-4 px-2 items-center hover:bg-muted/30 transition-colors rounded-2xl group"
                  >
                    {/* Identity Column (Avatar + Name + Email) */}
                    <div className="col-span-5 sm:col-span-4 flex items-center gap-3.5 min-w-0">
                      {getAvatarBadge(member.full_name, member.avatar_color)}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-foreground truncate">
                            {member.full_name}
                          </p>
                          {member.is_owner && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              Owner
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.email}
                        </p>
                      </div>
                    </div>

                    {/* Operational Role Badge */}
                    <div className="col-span-3 sm:col-span-3 flex items-center justify-center sm:justify-start">
                      {renderRoleBadge(member.role)}
                    </div>

                    {/* Account Status with Dot */}
                    <div className="hidden sm:flex sm:col-span-2 items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isActive ? "bg-emerald-500" : "bg-muted-foreground/60"
                        }`}
                      />
                      <span
                        className={`text-[11px] font-extrabold uppercase tracking-wider ${
                          isActive ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </div>

                    {/* Last Telemetry */}
                    <div className="hidden sm:block sm:col-span-2 text-xs text-muted-foreground truncate">
                      {member.last_telemetry}
                    </div>

                    {/* Actions Dropdown */}
                    <div className="col-span-4 sm:col-span-1 flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 text-xs">
                          <DropdownMenuItem
                            onClick={() => openEditModal(member)}
                            className="cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-2" />
                            Edit Permissions &amp; Role
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => toggleMemberStatus(member)}
                            className="cursor-pointer"
                          >
                            {isActive ? (
                              <>
                                <XCircle className="w-3.5 h-3.5 mr-2 text-amber-500" />
                                Suspend Account
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-emerald-500" />
                                Reactivate Account
                              </>
                            )}
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleResendInvite(member)}
                            className="cursor-pointer"
                          >
                            <Mail className="w-3.5 h-3.5 mr-2" />
                            Resend Digital Invite
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleCopyId(member.id)}
                            className="cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5 mr-2" />
                            Copy Staff ID
                          </DropdownMenuItem>

                          {!member.is_owner && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedMember(member);
                                  setDeleteOpen(true);
                                }}
                                className="text-rose-500 focus:text-rose-500 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Remove Member
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* REGISTER STAFF MODAL                                                      */}
      {/* ========================================================================= */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-w-md p-6 sm:p-7 rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-sky-400/15 text-sky-500 flex items-center justify-center shrink-0">
                <UserPlus className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Register Staff
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Define a new identity and assign architectural permissions.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleRegisterSubmit} className="space-y-4 pt-3">
            {/* FULL LEGAL NAME */}
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1.5">
                FULL LEGAL NAME
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Sarah Ahmed"
                className="h-12 rounded-2xl bg-card border-border text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-sky-500"
                required
              />
            </div>

            {/* WORK EMAIL IDENTITY */}
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1.5">
                WORK EMAIL IDENTITY
              </label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="sarah@company.com"
                className="h-12 rounded-2xl bg-card border-border text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-sky-500"
                required
              />
            </div>

            {/* OPERATIONAL ROLE */}
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1.5">
                OPERATIONAL ROLE
              </label>
              <Select
                value={formRole}
                onValueChange={(val: StaffRole) => setFormRole(val)}
              >
                <SelectTrigger className="h-12 rounded-2xl bg-card border-border text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs sm:text-sm">
                  <SelectItem value="cashier">
                    <span className="flex items-center gap-2">
                      <span>👦💼</span>
                      <span className="font-semibold">Cashier (Terminal Only)</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="manager">
                    <span className="flex items-center gap-2">
                      <span>🧑‍💼</span>
                      <span className="font-semibold">Manager (Full Access)</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-2">
                      <span>🛡️</span>
                      <span className="font-semibold">Administrator (System Admin)</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="inventory">
                    <span className="flex items-center gap-2">
                      <span>📦</span>
                      <span className="font-semibold">Inventory Clerk (Stock Only)</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ARCHITECTURE HINT */}
            <div className="p-4 rounded-2xl bg-sky-500/5 dark:bg-sky-500/10 border border-sky-500/20 text-xs space-y-1">
              <p className="text-[10px] font-extrabold tracking-widest text-sky-500 uppercase">
                ARCHITECTURE HINT
              </p>
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                &ldquo;Role assignment determines exactly which modules this user can see in their sidebar.&rdquo;
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-2xl bg-sky-400 hover:bg-sky-500 text-slate-950 font-bold text-sm shadow-md shadow-sky-400/20 transition-all active:scale-[0.99] border-0"
            >
              {submitting ? "Dispatching..." : "Send Digital Invite"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* EDIT PERMISSIONS / ROLE MODAL                                             */}
      {/* ========================================================================= */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md p-6 sm:p-7 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              Edit Staff Permissions
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Modify architectural role and account credentials for {selectedMember?.full_name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-3 text-xs">
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1.5">
                FULL LEGAL NAME
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="h-12 rounded-2xl text-xs sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1.5">
                WORK EMAIL
              </label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="h-12 rounded-2xl text-xs sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1.5">
                OPERATIONAL ROLE
              </label>
              <Select
                value={formRole}
                onValueChange={(val: StaffRole) => setFormRole(val)}
              >
                <SelectTrigger className="h-12 rounded-2xl text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs sm:text-sm">
                  <SelectItem value="cashier">Cashier (Terminal Only)</SelectItem>
                  <SelectItem value="manager">Manager (Full Access)</SelectItem>
                  <SelectItem value="admin">Administrator (System Admin)</SelectItem>
                  <SelectItem value="inventory">Inventory Clerk (Stock Only)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1.5">
                STATUS
              </label>
              <Select
                value={formStatus}
                onValueChange={(val: StaffStatus) => setFormStatus(val)}
              >
                <SelectTrigger className="h-12 rounded-2xl text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs sm:text-sm">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive / Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-2xl bg-sky-400 hover:bg-sky-500 text-slate-950 font-bold text-sm shadow-md shadow-sky-400/20 transition-all active:scale-[0.99] border-0"
            >
              {submitting ? "Saving Changes..." : "Save Architectural Permissions"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION DIALOG                                                */}
      {/* ========================================================================= */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md p-6 rounded-3xl">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-2">
              <Trash2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              Remove Team Member?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Are you sure you want to remove <span className="font-bold text-foreground">{selectedMember?.full_name}</span>? This will revoke all active security credentials and system sessions.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              className="h-11 px-5 rounded-2xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMember}
              className="h-11 px-5 rounded-2xl text-xs font-bold bg-rose-500 hover:bg-rose-600"
            >
              Confirm Removal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </UserPanelGate>
  );
};

export default UserTeam;
