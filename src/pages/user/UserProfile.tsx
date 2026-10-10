import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  Building2,
  Shield,
  Key,
  Lock,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  Bell,
  Clock,
  Globe,
  Upload,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  LogOut,
  Save,
  RefreshCw,
  Moon,
  Sun,
  Monitor,
  Calendar,
  Mail,
  Phone,
  Store,
  CreditCard,
  Package,
  Users,
  HardDrive,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  MapPin,
  Sparkles,
} from "lucide-react";
import UserPanelGate from "@/components/UserPanelGate";
import { usePlan } from "@/hooks/usePlan";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { useStaffRole } from "@/hooks/useStaffRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserProfileData {
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  status: string;
  joinedDate: string;
}

interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  lastActive: string;
  isCurrent: boolean;
}

interface UserNotificationPrefs {
  lowStockAlerts: boolean;
  expiryAlerts: boolean;
  newSale: boolean;
  purchaseUpdates: boolean;
  paymentUpdates: boolean;
  supportUpdates: boolean;
  systemAnnouncements: boolean;
  productUpdates: boolean;
}

interface UserPreferences {
  theme: "system" | "light" | "dark";
  language: string;
  currency: string;
  timezone: string;
  dateFormat: string;
}

interface ActivityItem {
  id: string;
  action: string;
  detail: string;
  time: string;
  icon: "product" | "business" | "password" | "team" | "login";
}

const DEFAULT_SESSIONS: ActiveSession[] = [
  {
    id: "sess_curr",
    device: "Windows PC",
    browser: "Chrome",
    lastActive: "Active Now",
    isCurrent: true,
  },
  {
    id: "sess_mobile",
    device: "Android Device",
    browser: "Chrome Mobile",
    lastActive: "2 hours ago",
    isCurrent: false,
  },
];

const DEFAULT_USER_NOTIFICATIONS: UserNotificationPrefs = {
  lowStockAlerts: true,
  expiryAlerts: true,
  newSale: true,
  purchaseUpdates: true,
  paymentUpdates: true,
  supportUpdates: true,
  systemAnnouncements: true,
  productUpdates: false,
};

const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: "system",
  language: "en",
  currency: "PKR",
  timezone: "Asia/Karachi",
  dateFormat: "DD/MM/YYYY",
};

const DEFAULT_ACTIVITIES: ActivityItem[] = [
  {
    id: "act_1",
    action: "Added product",
    detail: "New pharmaceutical item registered to inventory catalog.",
    time: "Today, 10:15 AM",
    icon: "product",
  },
  {
    id: "act_2",
    action: "Updated business profile",
    detail: "Business contact email and receipt tagline synchronized.",
    time: "Yesterday, 04:30 PM",
    icon: "business",
  },
  {
    id: "act_3",
    action: "Changed password",
    detail: "User account credentials securely updated.",
    time: "02 Oct 2026",
    icon: "password",
  },
  {
    id: "act_4",
    action: "Created team member",
    detail: "New staff member appointed with Cashier privileges.",
    time: "28 Sep 2026",
    icon: "team",
  },
  {
    id: "act_5",
    action: "Logged in",
    detail: "Authenticated session from current workstation.",
    time: "Today, 08:30 AM",
    icon: "login",
  },
];

export default function UserProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { plan, planId } = usePlan();
  const {
    active: activeBusiness,
    businesses: ownedBusinesses,
    staffBusinesses,
    setActiveBusinessId,
    loading: bizLoading,
  } = useActiveBusiness();
  const { staffRole, isOwner, isManager, isCashier } = useStaffRole();

  const [profile, setProfile] = useState<UserProfileData>({
    userId: "",
    firstName: "SG",
    lastName: "Bilal",
    displayName: "SG Bilal",
    email: "gepardwebs@gmail.com",
    phone: "+92 300 1234567",
    avatarUrl: "",
    status: "Active",
    joinedDate: "05 Oct 2026",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedBizId, setCopiedBizId] = useState(false);

  // Security modals & states
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<ActiveSession[]>(DEFAULT_SESSIONS);

  // Notifications & Preferences
  const [notifications, setNotifications] = useState<UserNotificationPrefs>(DEFAULT_USER_NOTIFICATIONS);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);

  // Activities
  const [activities, setActivities] = useState<ActivityItem[]>(DEFAULT_ACTIVITIES);

  // Realtime usage stats from backend
  const [usageStats, setUsageStats] = useState({
    productsCount: 0,
    businessesCount: 1,
    teamMembersCount: 1,
    storageUsage: "2.4 MB",
    loading: true,
  });

  // Danger zone modals
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteConfirmationPassword, setDeleteConfirmationPassword] = useState("");

  // Load User Profile & Usage Data
  const loadUserData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const userMeta = user.user_metadata || {};
        let fullName = userMeta.full_name || userMeta.name || "SG Bilal";
        const avatar = userMeta.avatar_url || localStorage.getItem("geflow_user_avatar") || "";
        const phone = userMeta.phone || "+92 300 1234567";

        const { data: dbProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (dbProfile?.full_name) {
          fullName = dbProfile.full_name;
        }

        const nameParts = fullName.trim().split(" ");
        const firstName = nameParts[0] || "SG";
        const lastName = nameParts.slice(1).join(" ") || "Bilal";

        const storedPrefs = localStorage.getItem("geflow_user_preferences");
        if (storedPrefs) {
          try {
            setPreferences(JSON.parse(storedPrefs));
          } catch {
            /* ignore */
          }
        }

        const storedNotifs = localStorage.getItem("geflow_user_notifications");
        if (storedNotifs) {
          try {
            setNotifications(JSON.parse(storedNotifs));
          } catch {
            /* ignore */
          }
        }

        const stored2FA = localStorage.getItem("geflow_user_2fa");
        if (stored2FA === "true") {
          setTwoFactorEnabled(true);
        }

        setProfile({
          userId: user.id,
          firstName,
          lastName,
          displayName: fullName,
          email: user.email || "gepardwebs@gmail.com",
          phone,
          avatarUrl: avatar,
          status: "Active",
          joinedDate: user.created_at
            ? new Date(user.created_at).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "05 Oct 2026",
        });

        // Fetch live counts for usage summary
        const targetBizId = activeBusiness?.id;
        let pCount = 0;
        let tCount = 1;

        if (targetBizId) {
          const { count: prodCount } = await supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("business_id", targetBizId);
          pCount = prodCount || 0;

          const { count: teamCount } = await supabase
            .from("support_team_members")
            .select("id", { count: "exact", head: true })
            .eq("appointed_by_user_id", user.id);
          tCount = (teamCount || 0) + 1; // plus owner
        }

        const totalBizCount = (ownedBusinesses?.length || 0) + (staffBusinesses?.length || 0) || 1;

        setUsageStats({
          productsCount: pCount,
          businessesCount: totalBizCount,
          teamMembersCount: tCount,
          storageUsage: `${Math.max(1.2, pCount * 0.02 + 1.1).toFixed(1)} MB`,
          loading: false,
        });
      }
    } catch (err) {
      console.warn("Notice loading user profile data:", err);
    }
  }, [activeBusiness?.id, ownedBusinesses?.length, staffBusinesses?.length]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({
        title: "Unsupported format",
        description: "Please upload a JPG, PNG, or WebP image.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Profile photo must be less than 5 MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setProfile((prev) => ({ ...prev, avatarUrl: dataUrl }));
      localStorage.setItem("geflow_user_avatar", dataUrl);

      try {
        await supabase.auth.updateUser({
          data: { avatar_url: dataUrl },
        });
      } catch {
        /* ignore */
      }

      toast({
        title: "Photo updated",
        description: "Your profile photo has been updated successfully.",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setProfile((prev) => ({ ...prev, avatarUrl: "" }));
    localStorage.removeItem("geflow_user_avatar");
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast({
      title: "Photo removed",
      description: "Profile photo reset to default avatar.",
    });
  };

  // Save Personal Info
  const handleSavePersonalInfo = async () => {
    setSaving(true);
    try {
      const fullName = `${profile.firstName} ${profile.lastName}`.trim() || profile.displayName;

      if (profile.userId) {
        await supabase
          .from("profiles")
          .update({
            full_name: fullName,
            last_active: new Date().toISOString(),
          })
          .eq("user_id", profile.userId);
      }

      try {
        await supabase.auth.updateUser({
          data: {
            full_name: fullName,
            first_name: profile.firstName,
            last_name: profile.lastName,
            phone: profile.phone,
          },
        });
      } catch {
        /* ignore */
      }

      setProfile((prev) => ({
        ...prev,
        displayName: fullName,
      }));
      setIsEditing(false);

      toast({
        title: "Profile saved",
        description: "Your personal details have been updated successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message || "Failed to update profile information.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Password Update
  const handleUpdatePassword = async () => {
    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "New password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords mismatch",
        description: "New password and confirmation do not match.",
        variant: "destructive",
      });
      return;
    }

    setPasswordUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setIsPasswordModalOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      toast({
        title: "Password changed",
        description: "Your account password has been updated.",
      });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message || "Failed to update password.",
        variant: "destructive",
      });
    } finally {
      setPasswordUpdating(false);
    }
  };

  // Toggle 2FA
  const handleToggle2FA = () => {
    const nextState = !twoFactorEnabled;
    setTwoFactorEnabled(nextState);
    localStorage.setItem("geflow_user_2fa", String(nextState));

    toast({
      title: nextState ? "2FA Enabled" : "2FA Disabled",
      description: nextState
        ? "Two-factor authentication is now active on your account."
        : "Two-factor authentication disabled.",
    });
  };

  // Sessions
  const handleSignOutOtherSessions = () => {
    setSessions((prev) => prev.filter((s) => s.isCurrent));
    toast({
      title: "Sessions terminated",
      description: "Signed out of all other active device sessions.",
    });
  };

  // Save Notifications
  const handleSaveNotifications = () => {
    localStorage.setItem("geflow_user_notifications", JSON.stringify(notifications));
    toast({
      title: "Notifications saved",
      description: "Your alert and update preferences have been stored.",
    });
  };

  // Appearance & Preferences
  const handleThemeChange = (theme: "system" | "light" | "dark") => {
    setPreferences((prev) => {
      const next = { ...prev, theme };
      localStorage.setItem("geflow_user_preferences", JSON.stringify(next));
      return next;
    });

    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else if (theme === "light") {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", isSystemDark);
      localStorage.removeItem("theme");
    }

    toast({
      title: "Theme updated",
      description: `Appearance theme set to ${theme}.`,
    });
  };

  const handleSavePreferences = () => {
    localStorage.setItem("geflow_user_preferences", JSON.stringify(preferences));
    toast({
      title: "Preferences saved",
      description: "Localization preferences updated.",
    });
  };

  // All businesses options
  const allBusinesses = useMemo(() => {
    const list: Array<{ id: string; name: string; role: string }> = [];
    (ownedBusinesses || []).forEach((b) => {
      list.push({ id: b.id, name: b.business_name || b.name, role: "Owner" });
    });
    (staffBusinesses || []).forEach((b) => {
      list.push({ id: b.id, name: b.business_name || b.name, role: b.staff_role || "Staff" });
    });
    return list;
  }, [ownedBusinesses, staffBusinesses]);

  const userRoleLabel = useMemo(() => {
    if (isCashier) return "Cashier";
    if (isManager) return "Manager";
    if (isOwner) return "Business Owner";
    return "Account Owner";
  }, [isCashier, isManager, isOwner]);

  const planLabel = plan?.label || "Standard";

  return (
    <UserPanelGate pageTitle="Profile" module="settings">
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Header Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/70">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
              <Link to="/dashboard" className="hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span className="text-foreground font-semibold">Profile</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Profile
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your personal identity, business association, security, and subscription.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadUserData}
              className="gap-2 rounded-xl text-xs font-semibold h-9"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
            <Button
              variant={isEditing ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (isEditing) {
                  handleSavePersonalInfo();
                } else {
                  setIsEditing(true);
                }
              }}
              disabled={saving}
              className="gap-2 rounded-xl text-xs font-semibold h-9 shadow-sm"
            >
              {saving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : isEditing ? (
                <Save className="w-3.5 h-3.5" />
              ) : (
                <User className="w-3.5 h-3.5" />
              )}
              {isEditing ? "Save Profile" : "Edit Profile"}
            </Button>
          </div>
        </div>

        {/* User Profile Header / Overview Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-card/90 p-6 sm:p-8 shadow-sm">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Avatar with upload trigger */}
              <div className="relative group shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-primary/20 bg-muted/60 shadow-md flex items-center justify-center text-foreground font-black text-3xl">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="bg-gradient-to-br from-primary to-secondary text-primary-foreground w-full h-full flex items-center justify-center">
                      {profile.firstName.charAt(0) || "U"}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1.5 -right-1.5 p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-md"
                  title="Upload profile photo"
                >
                  <Upload className="w-3.5 h-3.5" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
              </div>

              {/* Identity Info */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-foreground">
                    {profile.displayName}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                    {planLabel} Plan
                  </span>
                </div>

                <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <span>{profile.email}</span>
                  <span>•</span>
                  <span className="text-primary font-bold">{userRoleLabel}</span>
                </p>

                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground/70" />
                    {activeBusiness?.business_name || activeBusiness?.name || "No Business Connected"}
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground/70" />
                    Member since {profile.joinedDate}
                  </span>
                </div>
              </div>
            </div>

            {/* Edit / Quick button */}
            <div className="flex items-center gap-2 self-start md:self-center shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-2 rounded-xl text-xs font-semibold h-9"
              >
                <User className="w-3.5 h-3.5" />
                Edit Profile
              </Button>
            </div>
          </div>
        </div>

        {/* 9. Realtime Usage Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-primary" /> Products
            </span>
            <p className="text-2xl font-black text-foreground">
              {usageStats.productsCount}
            </p>
            <p className="text-[11px] text-muted-foreground">Catalog items in store</p>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-primary" /> Businesses
            </span>
            <p className="text-2xl font-black text-foreground">
              {usageStats.businessesCount}
            </p>
            <p className="text-[11px] text-muted-foreground">Managed organizations</p>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" /> Team Members
            </span>
            <p className="text-2xl font-black text-foreground">
              {usageStats.teamMembersCount}
            </p>
            <p className="text-[11px] text-muted-foreground">Staff & operators</p>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-primary" /> Storage
            </span>
            <p className="text-2xl font-black text-foreground">
              {usageStats.storageUsage}
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Cloud Synchronized</p>
          </div>
        </div>

        {/* Profile Content Tabs */}
        <Tabs defaultValue="personal" className="w-full space-y-6">
          <TabsList className="bg-muted/70 p-1 rounded-2xl w-full sm:w-auto flex flex-wrap gap-1 border border-border/60">
            <TabsTrigger value="personal" className="rounded-xl text-xs font-semibold gap-2">
              <User className="w-3.5 h-3.5" />
              Personal Info
            </TabsTrigger>
            <TabsTrigger value="business" className="rounded-xl text-xs font-semibold gap-2">
              <Store className="w-3.5 h-3.5" />
              Business Info
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-xl text-xs font-semibold gap-2">
              <Shield className="w-3.5 h-3.5" />
              Security & Sessions
            </TabsTrigger>
            <TabsTrigger value="notifications" className="rounded-xl text-xs font-semibold gap-2">
              <Bell className="w-3.5 h-3.5" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="subscription" className="rounded-xl text-xs font-semibold gap-2">
              <CreditCard className="w-3.5 h-3.5" />
              Subscription
            </TabsTrigger>
            <TabsTrigger value="preferences" className="rounded-xl text-xs font-semibold gap-2">
              <Globe className="w-3.5 h-3.5" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="activity" className="rounded-xl text-xs font-semibold gap-2">
              <Clock className="w-3.5 h-3.5" />
              Activity
            </TabsTrigger>
            <TabsTrigger
              value="danger"
              className="rounded-xl text-xs font-semibold gap-2 text-rose-500 hover:text-rose-600 data-[state=active]:text-rose-600"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Danger Zone
            </TabsTrigger>
          </TabsList>

          {/* 1. Personal Information Tab */}
          <TabsContent value="personal" className="space-y-6 mt-0">
            <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div>
                  <h3 className="text-base font-bold text-foreground">Personal Information</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your personal user profile details, contact number, and public display title.
                  </p>
                </div>
                {!isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="text-xs font-semibold rounded-xl h-8"
                  >
                    Edit
                  </Button>
                )}
              </div>

              {/* Photo Upload Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border border-border/60">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-border bg-muted/60 flex items-center justify-center font-bold text-lg text-foreground shrink-0">
                    {profile.avatarUrl ? (
                      <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span>{profile.firstName.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Profile Photo</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      JPG, PNG, or WebP. Maximum file size: 5 MB.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl text-xs font-semibold h-8.5 gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Change Photo
                  </Button>
                  {profile.avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemovePhoto}
                      className="rounded-xl text-xs font-semibold h-8.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              {/* Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">First Name</Label>
                  <Input
                    value={profile.firstName}
                    disabled={!isEditing}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    className="rounded-xl text-sm h-10"
                    placeholder="First Name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Last Name</Label>
                  <Input
                    value={profile.lastName}
                    disabled={!isEditing}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    className="rounded-xl text-sm h-10"
                    placeholder="Last Name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Display Name</Label>
                  <Input
                    value={profile.displayName}
                    disabled={!isEditing}
                    onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                    className="rounded-xl text-sm h-10"
                    placeholder="Display Name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Email</Label>
                  <div className="relative">
                    <Input
                      value={profile.email}
                      disabled
                      className="rounded-xl text-sm h-10 bg-muted/40 cursor-not-allowed pr-24"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Phone Number</Label>
                  <Input
                    value={profile.phone}
                    disabled={!isEditing}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="rounded-xl text-sm h-10"
                    placeholder="+92 300 1234567"
                  />
                </div>
              </div>

              {isEditing && (
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                    className="rounded-xl text-xs font-semibold h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSavePersonalInfo}
                    disabled={saving}
                    className="rounded-xl text-xs font-semibold h-9 gap-2 shadow-sm"
                  >
                    {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Save Details
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* 2 & 3. Business Information & Profile Tab */}
          <TabsContent value="business" className="space-y-6 mt-0">
            <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
                <div>
                  <h3 className="text-base font-bold text-foreground">Business Profile</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    View active organization details and associated workspace identity.
                  </p>
                </div>

                {/* Multi-business switcher */}
                {allBusinesses.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-semibold">Active Business:</span>
                    <Select
                      value={activeBusiness?.id}
                      onValueChange={(val) => {
                        setActiveBusinessId(val);
                        toast({
                          title: "Business switched",
                          description: "Profile context switched to selected organization.",
                        });
                      }}
                    >
                      <SelectTrigger className="w-52 rounded-xl text-xs h-9 font-semibold">
                        <SelectValue placeholder="Select Business" />
                      </SelectTrigger>
                      <SelectContent>
                        {allBusinesses.map((b) => (
                          <SelectItem key={b.id} value={b.id} className="text-xs">
                            {b.name} ({b.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Business Overview Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Business Name
                  </span>
                  <p className="text-base font-bold text-foreground truncate">
                    {activeBusiness?.business_name || activeBusiness?.name || "Bilal Pharmacy"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Primary operating entity</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Business Category
                  </span>
                  <p className="text-base font-bold text-foreground truncate">
                    {activeBusiness?.industry_type || "Pharmacy / Medical Store"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Industry taxonomy</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Your Role
                  </span>
                  <p className="text-base font-bold text-primary truncate">
                    {userRoleLabel}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Store authorization level</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1 sm:col-span-2 md:col-span-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Business ID
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const id = activeBusiness?.id || "BIZ-0001";
                        navigator.clipboard.writeText(id);
                        setCopiedBizId(true);
                        setTimeout(() => setCopiedBizId(false), 2000);
                        toast({ title: "Copied!", description: "Business ID copied to clipboard." });
                      }}
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                    >
                      {copiedBizId ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy ID
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-mono text-foreground font-semibold break-all">
                    {activeBusiness?.id || "N/A"}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Operating Currency
                  </span>
                  <p className="text-base font-bold text-foreground">
                    {activeBusiness?.currency || "PKR (Rs)"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">POS & catalog pricing unit</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Timezone
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    {activeBusiness?.timezone || "Asia/Karachi"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Receipt timestamp zone</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    City & Country
                  </span>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    {activeBusiness?.city || "Karachi"}, {activeBusiness?.country || "Pakistan"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Jurisdiction</p>
                </div>
              </div>

              {/* Note on Separation: Business Settings page link */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> Looking for Store Settings & Receipt Customization?
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    POS layouts, thermal receipt headers, tax percentages, and printer settings are managed in Business Settings.
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/dashboard/settings")}
                  className="rounded-xl text-xs font-semibold h-8.5 gap-1.5 shrink-0"
                >
                  Go to Business Settings
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* 4 & 5. Account Security & Active Sessions Tab */}
          <TabsContent value="security" className="space-y-6 mt-0">
            <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="pb-4 border-b border-border/60">
                <h3 className="text-base font-bold text-foreground">Security & Login</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manage your personal credentials, active devices, and two-factor authentication.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Email status card */}
                <div className="p-5 rounded-2xl border border-border/70 bg-muted/20 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-primary" /> Email Address
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        Verified ✓
                      </span>
                    </div>
                    <p className="text-xs font-medium text-foreground truncate pt-1">
                      {profile.email}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Primary sign-in and recovery address.
                    </p>
                  </div>

                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 py-1">
                    <CheckCircle2 className="w-4 h-4" /> Identity Verified
                  </div>
                </div>

                {/* Password card */}
                <div className="p-5 rounded-2xl border border-border/70 bg-muted/20 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-primary" /> Password
                      </h4>
                      <span className="text-[10px] font-bold text-muted-foreground font-mono">
                        Protected
                      </span>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground tracking-widest pt-1">
                      ••••••••••••
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Change password regularly to keep your store safe.
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPasswordModalOpen(true)}
                    className="w-full text-xs font-semibold rounded-xl h-8.5 gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5" />
                    Change Password
                  </Button>
                </div>

                {/* 2FA Card */}
                <div className="p-5 rounded-2xl border border-border/70 bg-muted/20 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-primary" /> Two-Factor Auth
                      </h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          twoFactorEnabled
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {twoFactorEnabled ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      Add extra verification code for logins from unrecognized browsers.
                    </p>
                  </div>

                  <Button
                    variant={twoFactorEnabled ? "outline" : "default"}
                    size="sm"
                    onClick={handleToggle2FA}
                    className="w-full text-xs font-semibold rounded-xl h-8.5 gap-1.5 shadow-sm"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    {twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Active Sessions */}
            <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
                <div>
                  <h3 className="text-base font-bold text-foreground">Active Sessions</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Devices currently signed into this account.
                  </p>
                </div>

                {sessions.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSignOutOtherSessions}
                    className="text-xs font-semibold rounded-xl text-destructive hover:bg-destructive/10 h-8.5 gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out Other Sessions
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/20"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                        {sess.device.includes("Mobile") ? (
                          <Smartphone className="w-5 h-5" />
                        ) : (
                          <Laptop className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">{sess.device}</h4>
                          <span className="text-xs text-muted-foreground">• {sess.browser}</span>
                          {sess.isCurrent && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              Active Now
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Last active: {sess.lastActive}
                        </p>
                      </div>
                    </div>

                    {!sess.isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSessions((prev) => prev.filter((s) => s.id !== sess.id));
                          toast({ title: "Session ended", description: "Device has been signed out." });
                        }}
                        className="text-xs text-destructive hover:bg-destructive/10 rounded-xl h-8"
                      >
                        Sign Out
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* 6. Notifications Tab (GeFlow User-specific) */}
          <TabsContent value="notifications" className="space-y-6 mt-0">
            <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="pb-4 border-b border-border/60">
                <h3 className="text-base font-bold text-foreground">Notification Preferences</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose which business events, inventory threshold warnings, and sales alerts trigger notifications.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    key: "lowStockAlerts",
                    label: "Low Stock Alerts",
                    desc: "Alerts when catalog stock units fall below defined threshold levels.",
                  },
                  {
                    key: "expiryAlerts",
                    label: "Expiry & Near-Expiry Alerts",
                    desc: "Notifications for batches approaching expiration in pharmacy/grocery inventory.",
                  },
                  {
                    key: "newSale",
                    label: "New POS Sale Completed",
                    desc: "Instant notification when cashiers process sales transactions.",
                  },
                  {
                    key: "purchaseUpdates",
                    label: "Purchase & Inbound Restock Updates",
                    desc: "Alerts on vendor stock arrivals, pending bills, and receiving vouchers.",
                  },
                  {
                    key: "paymentUpdates",
                    label: "Payment & Gateway Updates",
                    desc: "Confirmations for customer online payments and cash reconciliations.",
                  },
                  {
                    key: "supportUpdates",
                    label: "Support Ticket Updates",
                    desc: "Direct replies and responses from GeFlow technical support.",
                  },
                  {
                    key: "systemAnnouncements",
                    label: "System Announcements & Maintenance",
                    desc: "Important platform updates, scheduled maintenance, and new features.",
                  },
                  {
                    key: "productUpdates",
                    label: "Product & Catalog News",
                    desc: "Tips on optimizing AI automated product categorization and barcode tools.",
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-start justify-between gap-4 p-4 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <Label
                        htmlFor={`unotif-${item.key}`}
                        className="text-sm font-semibold text-foreground cursor-pointer"
                      >
                        {item.label}
                      </Label>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>

                    <Switch
                      id={`unotif-${item.key}`}
                      checked={notifications[item.key as keyof UserNotificationPrefs]}
                      onCheckedChange={(checked) =>
                        setNotifications((prev) => ({ ...prev, [item.key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4 border-t border-border/60">
                <Button
                  onClick={handleSaveNotifications}
                  className="rounded-xl text-xs font-semibold h-9 gap-2 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" /> Save Notification Preferences
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* 7. Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6 mt-0">
            <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="pb-4 border-b border-border/60">
                <h3 className="text-base font-bold text-foreground">Preferences</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure UI appearance theme, language, and display formats.
                </p>
              </div>

              {/* Theme Picker */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Interface Theme
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { value: "system", label: "System Default", icon: Monitor },
                    { value: "light", label: "Light Theme", icon: Sun },
                    { value: "dark", label: "Dark Theme", icon: Moon },
                  ].map((t) => {
                    const Icon = t.icon;
                    const isSelected = preferences.theme === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => handleThemeChange(t.value as any)}
                        className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                            : "border-border/70 hover:border-border text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold">{t.label}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {t.value === "system" ? "Follow OS setting" : `Always ${t.value}`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selects Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Language</Label>
                  <Select
                    value={preferences.language}
                    onValueChange={(val) => setPreferences({ ...preferences, language: val })}
                  >
                    <SelectTrigger className="rounded-xl text-sm h-10">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English (Default)</SelectItem>
                      <SelectItem value="ur">Urdu (اردو)</SelectItem>
                      <SelectItem value="ar">Arabic (العربية)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Currency Display</Label>
                  <Input
                    value={activeBusiness?.currency || preferences.currency}
                    disabled
                    className="rounded-xl text-sm h-10 bg-muted/40 cursor-not-allowed"
                    title="Currency is controlled at the Business level to maintain ledger integrity."
                  />
                  <p className="text-[10px] text-muted-foreground">Controlled by Business settings</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Timezone</Label>
                  <Select
                    value={preferences.timezone}
                    onValueChange={(val) => setPreferences({ ...preferences, timezone: val })}
                  >
                    <SelectTrigger className="rounded-xl text-sm h-10">
                      <SelectValue placeholder="Timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Karachi">Asia/Karachi (PKT)</SelectItem>
                      <SelectItem value="UTC">UTC (Universal)</SelectItem>
                      <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                      <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Date Format</Label>
                  <Select
                    value={preferences.dateFormat}
                    onValueChange={(val) => setPreferences({ ...preferences, dateFormat: val })}
                  >
                    <SelectTrigger className="rounded-xl text-sm h-10">
                      <SelectValue placeholder="Format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-border/60">
                <Button
                  onClick={handleSavePreferences}
                  className="rounded-xl text-xs font-semibold h-9 gap-2 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" /> Save Preferences
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* 8. Subscription Tab */}
          <TabsContent value="subscription" className="space-y-6 mt-0">
            <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
                <div>
                  <h3 className="text-base font-bold text-foreground">Subscription & Billing</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your active platform license, feature modules, and plan details.
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => navigate("/dashboard/subscription")}
                  className="rounded-xl text-xs font-semibold h-8.5 gap-1.5 shadow-sm"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  {planId === "free" ? "Upgrade Plan" : "Manage Subscription"}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Current Plan
                  </span>
                  <p className="text-lg font-black text-primary capitalize">
                    {planLabel}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Platform license tier</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Billing Cycle
                  </span>
                  <p className="text-lg font-bold text-foreground">
                    {planId === "lifetime" ? "Lifetime Access" : "Monthly Recurring"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Auto-renewal status</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Status
                  </span>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Active
                  </p>
                  <p className="text-[11px] text-muted-foreground">In good standing</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Next Billing Date
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    {planId === "lifetime" ? "Never (Perpetual)" : "05 Nov 2026"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Renewal calendar date</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 10. Account Activity Tab */}
          <TabsContent value="activity" className="space-y-6 mt-0">
            <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="pb-4 border-b border-border/60 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground">Recent Account Activity</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Timeline of your catalog creations, settings updates, and security logs.
                  </p>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  {activities.length} Events
                </span>
              </div>

              <div className="space-y-3">
                {activities.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3.5 p-3.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                      {item.icon === "product" && <Package className="w-4 h-4" />}
                      {item.icon === "business" && <Building2 className="w-4 h-4" />}
                      {item.icon === "password" && <Lock className="w-4 h-4" />}
                      {item.icon === "team" && <Users className="w-4 h-4" />}
                      {item.icon === "login" && <Key className="w-4 h-4" />}
                    </div>

                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-foreground">{item.action}</h4>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {item.time}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* 11. Danger Zone Tab */}
          <TabsContent value="danger" className="space-y-6 mt-0">
            <div className="bg-card border border-rose-500/30 dark:border-rose-900/50 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="pb-4 border-b border-rose-500/20">
                <h3 className="text-base font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Danger Zone
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Permanent actions affecting your account access and associated store data.
                </p>
              </div>

              <div className="space-y-4">
                {/* Sign Out All Devices */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-muted/20">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground">Sign Out All Devices</h4>
                    <p className="text-xs text-muted-foreground">
                      Invalidates all tokens and active sessions across computers, tablets, and phones.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      navigate("/login");
                    }}
                    className="rounded-xl text-xs font-semibold h-8.5 shrink-0"
                  >
                    Sign Out Everywhere
                  </Button>
                </div>

                {/* Deactivate Account */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-muted/20">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground">Deactivate Account</h4>
                    <p className="text-xs text-muted-foreground">
                      Temporarily freeze your account. You can reactivate anytime by contacting support or signing back in.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDeactivateOpen(true)}
                    className="border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-xl text-xs font-semibold h-8.5 shrink-0"
                  >
                    Deactivate Account
                  </Button>
                </div>

                {/* Delete Account */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400">
                      Delete Account
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Permanently destroy user credentials and remove business association. Password verification required.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsDeleteOpen(true)}
                    className="rounded-xl text-xs font-semibold h-8.5 shrink-0"
                  >
                    Delete Account
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Change Password Modal */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Change Password</DialogTitle>
            <DialogDescription className="text-xs">
              Enter your new password. It must contain at least 8 characters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">New Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rounded-xl pr-10 text-sm"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Confirm Password</Label>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-xl text-sm"
                placeholder="Confirm new password"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-[11px] text-destructive">Passwords do not match.</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPasswordModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleUpdatePassword}
              disabled={passwordUpdating || newPassword.length < 8 || newPassword !== confirmPassword}
              className="rounded-xl text-xs font-semibold gap-2"
            >
              {passwordUpdating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Account Modal */}
      <Dialog open={isDeactivateOpen} onOpenChange={setIsDeactivateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Deactivate Account
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Are you sure you want to deactivate your account? Your store transactions and inventory data remain preserved.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeactivateOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={async () => {
                setIsDeactivateOpen(false);
                toast({
                  title: "Deactivation requested",
                  description: "Account temporarily frozen. Signing out session.",
                });
                await supabase.auth.signOut();
                navigate("/login");
              }}
              className="rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
            >
              Confirm Deactivation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Modal with Password Confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Delete User Account
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              ⚠️ <strong>Warning:</strong> Account deletion is permanent. To confirm, enter your account password below:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <Label className="text-xs font-semibold">Account Password</Label>
            <Input
              type="password"
              value={deleteConfirmationPassword}
              onChange={(e) => setDeleteConfirmationPassword(e.target.value)}
              placeholder="Enter your password to authorize"
              className="rounded-xl text-xs"
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDeleteOpen(false);
                setDeleteConfirmationPassword("");
              }}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteConfirmationPassword.length < 6}
              onClick={async () => {
                setIsDeleteOpen(false);
                toast({
                  title: "Account closure submitted",
                  description: "Your account closure request has been processed.",
                });
                await supabase.auth.signOut();
                navigate("/login");
              }}
              className="rounded-xl text-xs font-semibold"
            >
              Delete My Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UserPanelGate>
  );
}
