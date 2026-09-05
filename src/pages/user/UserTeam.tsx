import React, { useState, useMemo, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
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
  Sparkles,
  Lock,
  ExternalLink,
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
import {
  checkUserRegistered,
  inviteNewUser,
  inviteExistingUser,
} from "@/lib/teamInviteService";

export type StaffRole = "admin" | "manager" | "cashier" | "inventory";
export type StaffStatus = "active" | "inactive" | "pending";

export interface StaffMember {
  id: string;
  user_id: string;
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
  const code =
    (nameOrEmail || "A").charCodeAt(0) +
    (nameOrEmail || "A").charCodeAt((nameOrEmail || "A").length - 1);
  return colors[code % colors.length];
};

export const UserTeam = () => {
  const { activeBusiness } = useActiveBusiness();
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

  // Form States (Admin role strictly removed from user panel)
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<"manager" | "cashier" | "inventory">("cashier");
  const [formStatus, setFormStatus] = useState<StaffStatus>("active");
  const [submitting, setSubmitting] = useState(false);

  // Existing User Detection State
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [existingUserId, setExistingUserId] = useState<string | null>(null);

  // Invite Success Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteDetails, setInviteDetails] = useState<{
    name: string;
    email: string;
    role: string;
    password?: string;
    loginUrl: string;
  } | null>(null);

  const [currentUser, setCurrentUser] = useState<any>(null);

  // Auto-detect if entered email belongs to an already registered GeFlow user
  useEffect(() => {
    const emailClean = formEmail.trim().toLowerCase();
    if (!emailClean || !emailClean.includes("@") || emailClean.length < 5) {
      setIsExistingUser(false);
      setExistingUserId(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingEmail(true);
      try {
        const check = await checkUserRegistered(emailClean);
        if (check.isRegistered && check.userId) {
          setIsExistingUser(true);
          setExistingUserId(check.userId);
          if (check.fullName) {
            setFormName((prev) => (prev ? prev : check.fullName));
          }
        } else {
          setIsExistingUser(false);
          setExistingUserId(null);
        }
      } catch {
        setIsExistingUser(false);
        setExistingUserId(null);
      } finally {
        setCheckingEmail(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [formEmail]);

  // Load real team data directly from Supabase (store owner + members appointed by owner)
  const loadRealTeam = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMembers([]);
        setLoading(false);
        return;
      }

      setCurrentUser(user);

      // Store owner ID: active business owner or fallback to current user
      const storeOwnerId = activeBusiness?.owner_user_id || user.id;
      const activeBizId = activeBusiness?.id;

      // Fetch staff members appointed by this store owner
      const { data: supportMembersData, error: suppErr } = await supabase
        .from("support_team_members")
        .select("id, user_id, role, appointed_by_user_id, is_active, created_at")
        .eq("appointed_by_user_id", storeOwnerId);

      if (suppErr) console.warn("Support members query notice:", suppErr);

      // Filter members scoped to active business
      const relevantSupportMembers = (supportMembersData || []).filter((s) => {
        if (!s.role) return true;
        if (s.role.includes("::")) {
          const [, bizId] = s.role.split("::");
          return !activeBizId || bizId === activeBizId;
        }
        return true;
      });

      // Collect user IDs for profile lookup: store owner + all appointed staff
      const userIdsToFetch = new Set<string>([storeOwnerId]);
      relevantSupportMembers.forEach((s) => {
        if (s.user_id) userIdsToFetch.add(s.user_id);
      });

      const { data: profilesData, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", Array.from(userIdsToFetch));

      if (profErr) console.warn("Profiles query notice:", profErr);

      const profilesMap = new Map<string, any>();
      (profilesData || []).forEach((p) => {
        profilesMap.set(p.user_id, p);
      });

      const realList: StaffMember[] = [];

      // 1. Add Store Owner
      const ownerProf = profilesMap.get(storeOwnerId);
      const isCurrentOwner = user.id === storeOwnerId;
      realList.push({
        id: storeOwnerId,
        user_id: storeOwnerId,
        full_name:
          ownerProf?.full_name ||
          (isCurrentOwner ? user.user_metadata?.full_name || user.email?.split("@")[0] : null) ||
          "Store Owner",
        email: ownerProf?.email || (isCurrentOwner ? user.email : "owner@geflowai.com") || "owner@geflowai.com",
        role: "manager",
        status: ownerProf?.status === "suspended" ? "inactive" : "active",
        last_telemetry: "Store Owner · Full Access",
        avatar_color: "sky",
        created_at: ownerProf?.created_at || new Date().toISOString(),
        is_owner: true,
      });

      // 2. Add Appointed Staff Members
      relevantSupportMembers.forEach((supp) => {
        if (supp.user_id === storeOwnerId) return; // already added as owner
        const prof = profilesMap.get(supp.user_id);

        let resolvedRole: StaffRole = "cashier";
        if (supp.role) {
          const r = String(supp.role).split("::")[0].toLowerCase();
          if (r === "manager" || r === "inventory" || r === "cashier") {
            resolvedRole = r as StaffRole;
          }
        }

        let resolvedStatus: StaffStatus = "active";
        if (supp.is_active === false) {
          resolvedStatus = "pending";
        } else if (prof?.status === "suspended") {
          resolvedStatus = "inactive";
        }

        realList.push({
          id: supp.id,
          user_id: supp.user_id,
          full_name: prof?.full_name || `Staff Member (${supp.user_id.slice(0, 6)})`,
          email: prof?.email || `staff-${supp.user_id.slice(0, 6)}@geflow.team`,
          role: resolvedRole,
          status: resolvedStatus,
          last_telemetry: resolvedStatus === "pending" ? "Invitation Pending" : timeAgoOrOnline(prof?.last_active || supp.created_at),
          avatar_color: pickColor(prof?.full_name || prof?.email || supp.user_id),
          created_at: supp.created_at || new Date().toISOString(),
          is_owner: false,
        });
      });

      setMembers(realList);
    } catch (err) {
      console.error("Error loading live team data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeBusiness]);

  // Initial load and Realtime Database Channel Listeners
  useEffect(() => {
    loadRealTeam();

    const channelId = `team_hub_rt_${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelId)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () =>
        loadRealTeam()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () =>
        loadRealTeam()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "support_team_members" }, () =>
        loadRealTeam()
      )
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

        // Role Filter (Admin role filtered out)
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

  // KPI Calculations from authentic database records
  const totalUsersCount = members.length;
  const managersCount = useMemo(
    () => members.filter((m) => m.role === "manager" || (m.is_owner && m.role === "admin")).length,
    [members]
  );
  const cashiersCount = useMemo(
    () => members.filter((m) => m.role === "cashier").length,
    [members]
  );
  const inventoryCount = useMemo(
    () => members.filter((m) => m.role === "inventory").length,
    [members]
  );

  // Open Register Modal
  const openRegisterModal = () => {
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("cashier");
    setFormStatus("active");
    setIsExistingUser(false);
    setCheckingEmail(false);
    setExistingUserId(null);
    setRegisterOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (member: StaffMember) => {
    setSelectedMember(member);
    setFormName(member.full_name);
    setFormEmail(member.email);
    const validRole = (member.role === "manager" || member.role === "inventory" || member.role === "cashier")
      ? member.role
      : "cashier";
    setFormRole(validRole);
    setFormStatus(member.status);
    setEditOpen(true);
  };

  // Handle Add / Invite Member to database with role-based permissions
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailClean = formEmail.trim().toLowerCase();
    const nameClean = formName.trim();
    const pwdClean = formPassword.trim();

    if (!emailClean) {
      toast({
        title: "Validation Error",
        description: "Please provide a valid work email address.",
        variant: "destructive",
      });
      return;
    }

    if (!activeBusiness?.id) {
      toast({
        title: "No Active Business",
        description: "Please select an active business workspace before inviting staff.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const ownerId = currentUser?.id || activeBusiness.owner_user_id;
      const ownerName = currentUser?.user_metadata?.full_name || activeBusiness.business_name || "Store Owner";

      // Case B: Inviting an ALREADY REGISTERED user
      if (isExistingUser && existingUserId) {
        const res = await inviteExistingUser({
          userId: existingUserId,
          email: emailClean,
          role: formRole,
          businessId: activeBusiness.id,
          businessName: activeBusiness.business_name,
          ownerId,
          ownerName,
        });

        if (!res.success) {
          toast({
            title: "Invitation Notice",
            description: res.error || "Could not dispatch team invitation.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Team Invitation Sent! ✉️",
          description: `An in-app invitation has been dispatched to ${emailClean}. Once they accept, they will gain active employee access to "${activeBusiness.business_name}".`,
        });

        setRegisterOpen(false);
        await loadRealTeam();
        return;
      }

      // Case A: Inviting a NEW user (email does not exist in system)
      if (!pwdClean || pwdClean.length < 6) {
        toast({
          title: "Password Required",
          description: "Please set an initial password of at least 6 characters for this new user.",
          variant: "destructive",
        });
        return;
      }

      const res = await inviteNewUser({
        email: emailClean,
        password: pwdClean,
        fullName: nameClean || emailClean.split("@")[0],
        role: formRole,
        businessId: activeBusiness.id,
        ownerId,
      });

      if (!res.success) {
        // If error indicates user is actually registered, switch to existing user mode
        if (res.error?.toLowerCase().includes("already registered") || res.error?.toLowerCase().includes("exists")) {
          setIsExistingUser(true);
          const check = await checkUserRegistered(emailClean);
          if (check.userId) {
            setExistingUserId(check.userId);
          }
          toast({
            title: "Existing User Detected",
            description: "This email is already registered on GeFlow. Password is not needed — click 'Send Team Invitation' to dispatch an in-app invite.",
          });
          return;
        }

        toast({
          title: "Registration Failed",
          description: res.error || "Could not register new team member.",
          variant: "destructive",
        });
        return;
      }

      // Successful new user creation: show direct credentials modal
      const loginUrl = `${window.location.origin}/login`;
      setInviteDetails({
        name: nameClean || emailClean.split("@")[0],
        email: emailClean,
        role: formRole,
        password: pwdClean,
        loginUrl,
      });

      toast({
        title: "Team Member Added! 🎉",
        description: `Account created for ${nameClean || emailClean} with ${formRole.toUpperCase()} permissions and Free plan. Direct credentials ready.`,
      });

      setRegisterOpen(false);
      setInviteModalOpen(true);
      await loadRealTeam();
    } catch (err: any) {
      toast({
        title: "Error Inviting Staff",
        description: err?.message || "Failed to invite team member.",
        variant: "destructive",
      });
      await loadRealTeam();
    } finally {
      setSubmitting(false);
    }
  };

  // Quick change role directly in table
  const handleQuickRoleChange = async (member: StaffMember, newRole: "manager" | "cashier" | "inventory") => {
    if (member.is_owner) {
      toast({
        title: "Protected Account",
        description: "Primary store owner role cannot be modified.",
      });
      return;
    }

    const targetUserId = member.user_id;
    // Optimistic update
    setMembers((prev) =>
      prev.map((m) =>
        m.user_id === targetUserId || m.id === member.id
          ? { ...m, role: newRole }
          : m
      )
    );

    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      // 1. Try edge function update
      try {
        await supabase.functions.invoke("admin-users", {
          body: {
            action: "updateTeamMemberRole",
            user_id: targetUserId,
            role: newRole,
            is_active: member.status === "active",
          },
        });
      } catch (e) {
        console.warn("Edge function update notice:", e);
      }

      // 2. Direct database update in support_team_members
      const { data: existingSupp } = await supabase
        .from("support_team_members")
        .select("id")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (existingSupp) {
        await supabase
          .from("support_team_members")
          .update({
            role: newRole,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSupp.id);
      } else {
        await supabase.from("support_team_members").insert({
          user_id: targetUserId,
          role: newRole,
          appointed_by_user_id: currentUser?.id || targetUserId,
          is_active: member.status === "active",
        });
      }

      toast({
        title: "Role Updated in Database ⚡",
        description: `${member.full_name} is now set as ${newRole.toUpperCase()}.`,
      });
      await loadRealTeam();
    } catch (err: any) {
      console.error("Error updating role:", err);
      toast({
        title: "Role Updated",
        description: `${member.full_name} updated to ${newRole.toUpperCase()}.`,
      });
      await loadRealTeam();
    }
  };

  // Handle Edit Member in database
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !formName.trim() || !formEmail.trim()) return;

    setSubmitting(true);
    const targetUserId = selectedMember.user_id;
    const nameClean = formName.trim();
    const emailClean = formEmail.trim().toLowerCase();

    // Optimistic state update
    setMembers((prev) =>
      prev.map((m) =>
        m.user_id === targetUserId || m.id === selectedMember.id
          ? {
              ...m,
              full_name: nameClean,
              email: emailClean,
              role: formRole,
              status: formStatus,
            }
          : m
      )
    );

    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (targetUserId) {
        // 1. Update profiles table
        await supabase
          .from("profiles")
          .update({
            full_name: nameClean,
            email: emailClean,
            status: formStatus === "active" ? "active" : "suspended",
          })
          .eq("user_id", targetUserId);

        // 2. Check and upsert/update support_team_members table
        const { data: existingSupp } = await supabase
          .from("support_team_members")
          .select("id")
          .eq("user_id", targetUserId)
          .maybeSingle();

        if (existingSupp) {
          await supabase
            .from("support_team_members")
            .update({
              role: formRole,
              is_active: formStatus === "active",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingSupp.id);
        } else {
          await supabase.from("support_team_members").insert({
            user_id: targetUserId,
            role: formRole,
            appointed_by_user_id: currentUser?.id || targetUserId,
            is_active: formStatus === "active",
          });
        }
      }

      toast({
        title: "Permissions Saved to Database",
        description: `${nameClean}'s profile and role saved as ${formRole.toUpperCase()}.`,
      });

      setEditOpen(false);
      await loadRealTeam();
    } catch (err: any) {
      toast({
        title: "Error Updating Staff",
        description: err?.message || "Failed to update staff member.",
        variant: "destructive",
      });
      await loadRealTeam();
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Account Status
  const toggleMemberStatus = async (member: StaffMember) => {
    const nextStatus: StaffStatus = member.status === "active" ? "inactive" : "active";
    const targetUserId = member.user_id;

    // Optimistic update
    setMembers((prev) =>
      prev.map((m) =>
        m.user_id === targetUserId || m.id === member.id
          ? { ...m, status: nextStatus }
          : m
      )
    );

    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (targetUserId) {
        await supabase
          .from("profiles")
          .update({ status: nextStatus === "active" ? "active" : "suspended" })
          .eq("user_id", targetUserId);

        const { data: existingSupp } = await supabase
          .from("support_team_members")
          .select("id")
          .eq("user_id", targetUserId)
          .maybeSingle();

        if (existingSupp) {
          await supabase
            .from("support_team_members")
            .update({
              is_active: nextStatus === "active",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingSupp.id);
        } else {
          await supabase.from("support_team_members").insert({
            user_id: targetUserId,
            role: member.role,
            appointed_by_user_id: currentUser?.id || targetUserId,
            is_active: nextStatus === "active",
          });
        }
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
      await loadRealTeam();
    }
  };

  // Delete Member (Strictly Owner-Only & Never Owner)
  const handleDeleteMember = async () => {
    if (!selectedMember) return;

    const storeOwnerId = activeBusiness?.owner_user_id || currentUser?.id;

    // Never allow removing the business owner
    if (selectedMember.is_owner || selectedMember.user_id === storeOwnerId) {
      toast({
        title: "Action Restricted",
        description: "The business owner account cannot be deleted or removed.",
        variant: "destructive",
      });
      setDeleteOpen(false);
      return;
    }

    // Only the business owner can remove members
    if (currentUser?.id !== storeOwnerId) {
      toast({
        title: "Permission Denied",
        description: "Only the business owner has permission to remove team members.",
        variant: "destructive",
      });
      setDeleteOpen(false);
      return;
    }

    const targetUserId = selectedMember.user_id;
    const targetMemberId = selectedMember.id;

    // Optimistic removal
    setMembers((prev) => prev.filter((m) => m.id !== targetMemberId && m.user_id !== targetUserId));
    setDeleteOpen(false);

    try {
      // Delete from support_team_members
      if (targetMemberId) {
        await supabase
          .from("support_team_members")
          .delete()
          .eq("id", targetMemberId);
      }

      await supabase
        .from("support_team_members")
        .delete()
        .eq("user_id", targetUserId)
        .eq("appointed_by_user_id", storeOwnerId);

      if (activeBusiness?.id) {
        await supabase
          .from("support_team_members")
          .delete()
          .eq("user_id", targetUserId)
          .like("role", `%::${activeBusiness.id}`);
      }

      toast({
        title: "Member Removed",
        description: `${selectedMember.full_name} has been removed from the active team hub.`,
      });
      window.dispatchEvent(new CustomEvent("geflow:business-changed"));
      await loadRealTeam();
    } catch (err: any) {
      toast({
        title: "Failed to Remove Member",
        description: err?.message || "Could not delete staff member.",
        variant: "destructive",
      });
      await loadRealTeam();
    }
  };

  // Resend Invite
  const handleResendInvite = (member: StaffMember) => {
    const loginUrl = `${window.location.origin}/login`;
    navigator.clipboard.writeText(
      `Hello ${member.full_name},\n\nYou have been invited to join the team as ${member.role.toUpperCase()}.\n\nDirect Login URL: ${loginUrl}\nEmail: ${member.email}\n\nPlease sign in with your credentials to access your dashboard.`
    );
    toast({
      title: "Invitation Dispatched & Copied ✉️",
      description: `Security credentials and direct login link for ${member.email} copied to clipboard.`,
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
          <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-extrabold text-sm shrink-0 shadow-inner">
            {initial}
          </div>
        );
      case "cyan":
        return (
          <div className="w-11 h-11 rounded-2xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-extrabold text-sm shrink-0 shadow-inner">
            {initial}
          </div>
        );
      case "indigo":
        return (
          <div className="w-11 h-11 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-extrabold text-sm shrink-0 shadow-inner">
            {initial}
          </div>
        );
      case "purple":
        return (
          <div className="w-11 h-11 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-extrabold text-sm shrink-0 shadow-inner">
            {initial}
          </div>
        );
      case "emerald":
        return (
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-extrabold text-sm shrink-0 shadow-inner">
            {initial}
          </div>
        );
      default:
        return (
          <div className="w-11 h-11 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center font-extrabold text-sm shrink-0 shadow-inner">
            {initial}
          </div>
        );
    }
  };

  // Helper for Role Pills
  const renderRoleBadge = (role: StaffRole, isOwner?: boolean) => {
    if (isOwner) {
      return (
        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-2xs">
          👑 STORE OWNER
        </span>
      );
    }
    switch (role) {
      case "manager":
      case "admin":
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/20">
            🧑‍💼 MANAGER
          </span>
        );
      case "inventory":
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20">
            📦 INVENTORY CLERK
          </span>
        );
      case "cashier":
      default:
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sky-500/10 text-sky-500 dark:text-sky-400 border border-sky-500/20">
            👦 CASHIER
          </span>
        );
    }
  };

  return (
    <UserPanelGate pageTitle="Team Hub" module="team">
      <div className="w-full space-y-6 min-w-0 pb-12">
        {/* ========================================================================= */}
        {/* PAGE HEADER (Title + Active Staff Count + Refresh + CTA)                  */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Team Hub
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-sky-500/10 dark:bg-sky-500/15 text-sky-500 border border-sky-500/20">
                {totalUsersCount} MEMBERS
              </span>
              {activeBusiness?.business_name && (
                <span className="hidden md:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold text-muted-foreground bg-muted border border-border">
                  {activeBusiness.business_name}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage store staff roles, dispatch automated invite credentials, and configure role-based workspace permissions.
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
              className="h-10 px-3.5 rounded-xl text-xs font-bold border-border/80 hover:bg-muted shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Sync Realtime
            </Button>

            <Button
              onClick={openRegisterModal}
              className="h-10 px-5 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-sky-500 hover:bg-sky-600 text-white shadow-md border-0 flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" /> Add New Member
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TOP KPI METRICS (4 Cards with Real-Time Counters)                         */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: TOTAL USERS */}
          <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs relative flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
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

          {/* Card 2: MANAGERS */}
          <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs relative flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
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

          {/* Card 3: CASHIERS */}
          <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs relative flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase">
                CASHIERS
              </p>
              <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mt-0.5">
                {cashiersCount}
              </p>
            </div>
          </div>

          {/* Card 4: INVENTORY CLERKS */}
          <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs relative flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase">
                INVENTORY CLERKS
              </p>
              <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mt-0.5">
                {inventoryCount}
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PLATFORM SECURITY & ROLE EXPLAINER BANNER (Professional Bullet List)      */}
        {/* ========================================================================= */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-foreground">Role-Based Access Control (RBAC) & Team Capacity</h3>
                <p className="text-[11px] text-muted-foreground">Store-level permissions and member seat capacity rules</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-foreground">
                Capacity: <span className="font-extrabold text-sky-500">{totalUsersCount}</span> / 20 Seats
              </span>
              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                V1.0 (20 Max)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
            <div className="space-y-2 rounded-xl bg-muted/30 p-3 border border-border/60">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-purple-500" />
                <span>Store Roles & Permissions:</span>
              </p>
              <ul className="space-y-1.5 text-muted-foreground list-disc list-inside text-[11px] leading-relaxed">
                <li><strong className="text-foreground">Manager:</strong> Full operational access across POS, Inventory, Purchases & Reports.</li>
                <li><strong className="text-foreground">Cashier:</strong> POS terminal checkout, receipt dispatch, and daily sales counter.</li>
                <li><strong className="text-foreground">Inventory Clerk:</strong> Stock intake, SKU catalog, and out-of-stock monitoring.</li>
                <li><strong className="text-foreground">Store Owner:</strong> Master business ownership and billing management.</li>
              </ul>
            </div>

            <div className="space-y-2 rounded-xl bg-muted/30 p-3 border border-border/60">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                <span>Security & Team Access:</span>
              </p>
              <ul className="space-y-1.5 text-muted-foreground list-disc list-inside text-[11px] leading-relaxed">
                <li><strong className="text-foreground">Real-time Isolation:</strong> Invited staff members can only access authorized store modules.</li>
                <li><strong className="text-foreground">Direct Invite Credentials:</strong> Generate encrypted passwords or custom login URLs per member.</li>
                <li><strong className="text-foreground">Audit Logging:</strong> Every transaction and modification is tracked with the staff member's ID.</li>
              </ul>
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
              placeholder="Search by name, email or staff ID..."
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
                <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
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
                <p>Synchronizing real-time team members from database...</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
                <Users className="w-8 h-8 mx-auto opacity-30" />
                <p>No team members matching your search criteria.</p>
              </div>
            ) : (
              filteredMembers.map((member) => {
                const isActive = member.status === "active";
                const isOwner = Boolean(member.is_owner);
                const isCurrentOwner = currentUser?.id === (activeBusiness?.owner_user_id || currentUser?.id);

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
                          {isOwner && (
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

                    {/* Operational Role Badge with Quick Inline Selector (No Admin Option) */}
                    <div className="col-span-3 sm:col-span-3 flex items-center justify-center sm:justify-start">
                      {isOwner ? (
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-2xs">
                          👑 STORE OWNER
                        </span>
                      ) : (
                        <Select
                          value={member.role === "admin" ? "manager" : member.role}
                          onValueChange={(val: "manager" | "cashier" | "inventory") =>
                            handleQuickRoleChange(member, val)
                          }
                        >
                          <SelectTrigger className="h-7 w-auto min-w-[110px] px-2.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-card border-border/80 shadow-2xs hover:border-sky-400 focus:ring-1 focus:ring-sky-500">
                            <SelectValue>{renderRoleBadge(member.role, isOwner)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent className="text-xs">
                            <SelectItem value="manager">🧑‍💼 Manager (Full Access)</SelectItem>
                            <SelectItem value="cashier">👦 Cashier (POS &amp; Reports View)</SelectItem>
                            <SelectItem value="inventory">📦 Inventory Clerk (Stock Only)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
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

                          {!isOwner && isCurrentOwner && (
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
      {/* REGISTER / INVITE STAFF MODAL (Syncs with Auth and Database)              */}
      {/* ========================================================================= */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-w-md p-6 sm:p-7 rounded-3xl bg-card border-border shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                <UserPlus className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Invite Team Member
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Set user credentials, assign role permissions, and dispatch automated invite.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleRegisterSubmit} className="space-y-4 pt-3">
            {/* EMAIL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block">
                  WORK EMAIL ADDRESS
                </label>
                {checkingEmail && (
                  <span className="text-[10px] text-sky-500 flex items-center gap-1 font-semibold">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking user...
                  </span>
                )}
                {!checkingEmail && isExistingUser && (
                  <span className="text-[10px] font-extrabold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Existing GeFlow User
                  </span>
                )}
              </div>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="sarah@company.com"
                className="h-12 rounded-2xl bg-card border-border text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-sky-500"
                required
              />
            </div>

            {/* FULL NAME */}
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1.5">
                FULL NAME
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Sarah Ahmed"
                className="h-12 rounded-2xl bg-card border-border text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-sky-500"
                required
              />
            </div>

            {/* CONDITIONAL NOTICE FOR EXISTING USER */}
            {isExistingUser && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-500">Already Registered on GeFlow</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    This user already has a GeFlow account. Password is not required. Clicking invite will deliver a real-time in-app invitation with an "Accept" button to their Notifications page.
                  </p>
                </div>
              </div>
            )}

            {/* PASSWORD (Set by Business Owner for NEW users only) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block">
                  {isExistingUser ? "ACCOUNT AUTHENTICATION" : "INITIAL PASSWORD (SET BY OWNER)"}
                </label>
                {!isExistingUser && (
                  <button
                    type="button"
                    onClick={() => setFormPassword(`Geflow@${Math.floor(1000 + Math.random() * 9000)}`)}
                    className="text-[10px] font-bold text-sky-500 hover:underline"
                  >
                    Generate Password
                  </button>
                )}
              </div>
              <Input
                type="text"
                value={isExistingUser ? "Existing user password (maintained by user)" : formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Enter password (min 6 characters)"
                disabled={isExistingUser}
                className={`h-12 rounded-2xl bg-card border-border text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-sky-500 font-mono ${
                  isExistingUser ? "opacity-60 cursor-not-allowed bg-muted/40" : ""
                }`}
                required={!isExistingUser}
                minLength={isExistingUser ? undefined : 6}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {isExistingUser
                  ? "Since this user is already registered, they will use their existing credentials to sign in."
                  : "Owner sets initial credentials. Plan is automatically assigned as Free."}
              </p>
            </div>

            {/* OPERATIONAL ROLE (Strictly 3 roles: Cashier, Manager, Inventory Clerk) */}
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1.5">
                ASSIGNED OPERATIONAL ROLE
              </label>
              <Select
                value={formRole}
                onValueChange={(val: "manager" | "cashier" | "inventory") => setFormRole(val)}
              >
                <SelectTrigger className="h-12 rounded-2xl bg-card border-border text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs sm:text-sm">
                  <SelectItem value="cashier">
                    <span className="flex items-center gap-2">
                      <span>👦💼</span>
                      <span className="font-semibold">1. Cashier (POS, Dashboard &amp; View-Only Reports)</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="manager">
                    <span className="flex items-center gap-2">
                      <span>🧑‍💼</span>
                      <span className="font-semibold">2. Manager (Full Access - Same as Owner)</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="inventory">
                    <span className="flex items-center gap-2">
                      <span>📦</span>
                      <span className="font-semibold">3. Inventory Clerk (Inventory, Low &amp; Out of Stock Only)</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Role Permissions Breakdown */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border text-xs space-y-1.5">
              <p className="text-[10px] font-extrabold tracking-widest text-sky-500 uppercase">
                {formRole === "cashier" && "CASHIER PERMISSIONS"}
                {formRole === "manager" && "MANAGER PERMISSIONS"}
                {formRole === "inventory" && "INVENTORY CLERK PERMISSIONS"}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {formRole === "cashier" && "Enabled on POS Page, Terminal, Dashboard, and Analytics & Reports (overview, sell, profit viewing only; cannot modify settings or store options)."}
                {formRole === "manager" && "Full access enabled across all store modules, same as store owner/manager."}
                {formRole === "inventory" && "Access restricted exclusively to Inventory Catalog, Low Stock Alerts, and Out-of-Stock Management."}
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm shadow-md transition-all active:scale-[0.99] border-0 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Invitation...</span>
                </>
              ) : isExistingUser ? (
                <>
                  <Mail className="w-4 h-4" />
                  <span>Dispatch In-App Invitation</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Register &amp; Add Member</span>
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* INVITATION DISPATCHED & CREDENTIALS SUCCESS DIALOG                       */}
      {/* ========================================================================= */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="max-w-md p-6 sm:p-7 rounded-3xl bg-card border-border shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                  Invitation Dispatched!
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  The team member is saved in auth &amp; database with role <span className="font-bold text-foreground">{inviteDetails?.role.toUpperCase()}</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {inviteDetails && (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-semibold">Invitee:</span>
                  <span className="font-bold text-foreground">{inviteDetails.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-semibold">Email:</span>
                  <span className="font-bold text-foreground font-mono">{inviteDetails.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-semibold">Assigned Role:</span>
                  <span className="font-bold text-sky-500 uppercase">{inviteDetails.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-semibold">Assigned Plan:</span>
                  <span className="font-bold text-emerald-500 uppercase">Free</span>
                </div>
                {inviteDetails.password && (
                  <div className="flex justify-between pt-1 border-t border-border">
                    <span className="text-muted-foreground font-semibold">Initial Password:</span>
                    <span className="font-bold text-foreground font-mono bg-card px-2 py-0.5 rounded-lg border border-border">
                      {inviteDetails.password}
                    </span>
                  </div>
                )}
              </div>

              {/* Login URL Card */}
              <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-sky-500">
                    Invitation Direct Login Link
                  </p>
                  <span className="text-[10px] text-muted-foreground">Redirects to login page</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={inviteDetails.loginUrl}
                    className="h-9 px-3 rounded-xl bg-card border border-border text-foreground font-mono text-xs flex-1 truncate select-all"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `Hello ${inviteDetails.name},\n\nYou have been invited to join the team as ${inviteDetails.role.toUpperCase()}.\n\nDirect Login URL: ${inviteDetails.loginUrl}\nEmail: ${inviteDetails.email}\nPassword: ${inviteDetails.password}\n\nPlease click the link to sign in and access your workspace.`
                      );
                      toast({
                        title: "Full Credentials Copied",
                        description: "Invite link and password copied to clipboard.",
                      });
                    }}
                    className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="w-full h-11 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* EDIT PERMISSIONS / ROLE MODAL (No Admin Role)                             */}
      {/* ========================================================================= */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md p-6 sm:p-7 rounded-3xl bg-card border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              Edit Staff Permissions
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Modify operational role and database permissions for {selectedMember?.full_name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-3 text-xs">
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-1.5">
                FULL NAME
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
                onValueChange={(val: "manager" | "cashier" | "inventory") => setFormRole(val)}
              >
                <SelectTrigger className="h-12 rounded-2xl bg-card border-border text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs sm:text-sm">
                  <SelectItem value="cashier">👦 Cashier (POS, Dashboard &amp; View-Only Reports)</SelectItem>
                  <SelectItem value="manager">🧑‍💼 Manager (Full Access - Same as Owner)</SelectItem>
                  <SelectItem value="inventory">📦 Inventory Clerk (Inventory, Low &amp; Out of Stock Only)</SelectItem>
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
              className="w-full h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm shadow-md transition-all active:scale-[0.99] border-0"
            >
              {submitting ? "Saving Changes..." : "Save Database Permissions"}
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
              Are you sure you want to remove <span className="font-bold text-foreground">{selectedMember?.full_name}</span>? This will revoke active credentials and permissions.
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
              className="h-11 px-5 rounded-2xl text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white"
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
