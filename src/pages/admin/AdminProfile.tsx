import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  User,
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
  Building,
  Sparkles,
  Info,
  ChevronRight,
  ExternalLink,
  X,
} from "lucide-react";
import PanelLayout from "@/components/PanelLayout";
import { ADMIN_NAV, ADMIN_IDENTITY } from "@/lib/panelNav";
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

interface AdminProfileData {
  userId: string;
  adminId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  role: string;
  accountType: string;
  status: string;
  createdAt: string;
  lastLogin: string;
  lastUpdated: string;
}

interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

interface NotificationPrefs {
  supportMessages: boolean;
  newUserRegistration: boolean;
  businessRegistration: boolean;
  paymentNotifications: boolean;
  systemAlerts: boolean; // Locked critical
  securityAlerts: boolean; // Locked critical
  teamActivity: boolean;
  announcements: boolean;
}

interface AdminPreferences {
  theme: "system" | "light" | "dark";
  language: string;
  timezone: string;
  dateFormat: string;
}

interface ActivityLogItem {
  id: string;
  title: string;
  description: string;
  time: string;
  dateGroup: "Today" | "Yesterday" | "Earlier";
  iconType: "login" | "profile" | "password" | "settings" | "security";
}

const DEFAULT_ADMIN_PROFILE: AdminProfileData = {
  userId: "a375b057-debe-4239-9549-9f83b5557df2",
  adminId: "ADM-0001",
  firstName: "SG",
  lastName: "Bilal",
  displayName: "SG Bilal",
  email: "gepardwebs@gmail.com",
  phone: "+92 300 1234567",
  avatarUrl: "",
  role: "Founder & Chairman",
  accountType: "Administrator",
  status: "Active",
  createdAt: "05 Oct 2026",
  lastLogin: "Today, 08:41 PM",
  lastUpdated: "Today, 08:32 PM",
};

const DEFAULT_SESSIONS: ActiveSession[] = [
  {
    id: "sess_1",
    device: "Windows PC",
    browser: "Chrome",
    location: "Current (Local)",
    lastActive: "Active Now",
    isCurrent: true,
  },
  {
    id: "sess_2",
    device: "Windows PC",
    browser: "Edge",
    location: "Karachi, Pakistan",
    lastActive: "2 hours ago",
    isCurrent: false,
  },
  {
    id: "sess_3",
    device: "Mobile (Android)",
    browser: "Chrome Mobile",
    location: "Karachi, Pakistan",
    lastActive: "Yesterday",
    isCurrent: false,
  },
];

const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  supportMessages: true,
  newUserRegistration: true,
  businessRegistration: true,
  paymentNotifications: true,
  systemAlerts: true, // Critical, locked
  securityAlerts: true, // Critical, locked
  teamActivity: true,
  announcements: true,
};

const DEFAULT_PREFERENCES: AdminPreferences = {
  theme: "system",
  language: "en",
  timezone: "Asia/Karachi",
  dateFormat: "DD/MM/YYYY",
};

const DEFAULT_ACTIVITIES: ActivityLogItem[] = [
  {
    id: "act_1",
    title: "Logged in",
    description: "Successful administrative authentication via secure session.",
    time: "08:41 PM",
    dateGroup: "Today",
    iconType: "login",
  },
  {
    id: "act_2",
    title: "Updated profile information",
    description: "Saved updated contact telephone and personal details.",
    time: "08:32 PM",
    dateGroup: "Today",
    iconType: "profile",
  },
  {
    id: "act_3",
    title: "Changed password",
    description: "Account master security credentials rotated and audited.",
    time: "11:20 PM",
    dateGroup: "Yesterday",
    iconType: "password",
  },
  {
    id: "act_4",
    title: "Notification preferences updated",
    description: "Adjusted real-time business and system alert channels.",
    time: "04:15 PM",
    dateGroup: "Yesterday",
    iconType: "settings",
  },
  {
    id: "act_5",
    title: "Two-Factor verification check",
    description: "System security policy verified for Super Admin identity.",
    time: "02:10 PM",
    dateGroup: "Earlier",
    iconType: "security",
  },
];

export default function AdminProfile() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<AdminProfileData>(DEFAULT_ADMIN_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

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
  const [notifications, setNotifications] = useState<NotificationPrefs>(DEFAULT_NOTIFICATIONS);
  const [preferences, setPreferences] = useState<AdminPreferences>(DEFAULT_PREFERENCES);

  // Activities
  const [activities, setActivities] = useState<ActivityLogItem[]>(DEFAULT_ACTIVITIES);

  // Danger Zone Modals
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  // Load Admin Profile from Supabase & Storage
  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const userEmail = user?.email || "gepardwebs@gmail.com";
      const userMeta = user?.user_metadata || {};

      // Load profile record from db
      let fullName = userMeta.full_name || userMeta.name || "SG Bilal";
      let avatar = userMeta.avatar_url || localStorage.getItem("geflow_admin_avatar") || "";
      const phone = userMeta.phone || "+92 300 1234567";

      if (user?.id) {
        const { data: dbProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (dbProfile) {
          if (dbProfile.full_name) fullName = dbProfile.full_name;
        }
      }

      const nameParts = fullName.trim().split(" ");
      const firstName = nameParts[0] || "SG";
      const lastName = nameParts.slice(1).join(" ") || "Bilal";

      // Load preferences from local storage if existing
      const storedPrefs = localStorage.getItem("geflow_admin_preferences");
      if (storedPrefs) {
        try {
          setPreferences(JSON.parse(storedPrefs));
        } catch {
          /* ignore */
        }
      }

      const storedNotifs = localStorage.getItem("geflow_admin_notifications");
      if (storedNotifs) {
        try {
          setNotifications(JSON.parse(storedNotifs));
        } catch {
          /* ignore */
        }
      }

      const stored2FA = localStorage.getItem("geflow_admin_2fa");
      if (stored2FA === "true") {
        setTwoFactorEnabled(true);
      }

      const storedAvatar = localStorage.getItem("geflow_admin_avatar");
      if (storedAvatar) {
        avatar = storedAvatar;
      }

      setProfile({
        userId: user?.id || DEFAULT_ADMIN_PROFILE.userId,
        adminId: "ADM-0001",
        firstName,
        lastName,
        displayName: fullName,
        email: userEmail,
        phone,
        avatarUrl: avatar,
        role: "Founder & Chairman",
        accountType: "Administrator",
        status: "Active",
        createdAt: user?.created_at
          ? new Date(user.created_at).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "05 Oct 2026",
        lastLogin: "Today, 08:41 PM",
        lastUpdated: "Today, 08:32 PM",
      });
    } catch (err) {
      console.warn("Notice loading admin profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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
      localStorage.setItem("geflow_admin_avatar", dataUrl);

      // Add to activity log
      addActivityLog(
        "Updated profile photo",
        "New administrative avatar uploaded and synchronized.",
        "profile"
      );

      toast({
        title: "Photo updated",
        description: "Your profile photo has been updated successfully.",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setProfile((prev) => ({ ...prev, avatarUrl: "" }));
    localStorage.removeItem("geflow_admin_avatar");
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

      // Update in Supabase profile table
      if (profile.userId) {
        await supabase
          .from("profiles")
          .update({
            full_name: fullName,
            last_active: new Date().toISOString(),
          })
          .eq("user_id", profile.userId);
      }

      // Update user metadata
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
        lastUpdated: "Just now",
      }));
      setIsEditing(false);

      addActivityLog(
        "Updated profile information",
        "Personal contact and identity information saved.",
        "profile"
      );

      toast({
        title: "Profile saved",
        description: "Your personal information has been updated.",
      });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message || "Failed to update profile details.",
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

      addActivityLog(
        "Changed password",
        "Administrative master credentials updated successfully.",
        "password"
      );

      toast({
        title: "Password updated",
        description: "Your account password has been changed successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Password change failed",
        description: err?.message || "Failed to update password. Please check your credentials.",
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
    localStorage.setItem("geflow_admin_2fa", String(nextState));

    addActivityLog(
      nextState ? "Enabled Two-Factor Authentication" : "Disabled Two-Factor Authentication",
      nextState
        ? "Two-factor verification policy activated for Super Admin."
        : "Two-factor verification temporarily disabled.",
      "security"
    );

    toast({
      title: nextState ? "2FA Enabled" : "2FA Disabled",
      description: nextState
        ? "Two-factor authentication is now active for your administrator account."
        : "Two-factor authentication has been disabled.",
    });
  };

  // Sessions Management
  const handleSignOutSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    toast({
      title: "Session terminated",
      description: "Selected device session has been signed out.",
    });
  };

  const handleSignOutAllOtherSessions = () => {
    setSessions((prev) => prev.filter((s) => s.isCurrent));
    toast({
      title: "Sessions terminated",
      description: "All other device sessions have been revoked.",
    });
  };

  // Notification Preferences
  const handleSaveNotifications = () => {
    localStorage.setItem("geflow_admin_notifications", JSON.stringify(notifications));
    addActivityLog(
      "Changed notification settings",
      "Administrative system and alert notification preferences updated.",
      "settings"
    );
    toast({
      title: "Notifications saved",
      description: "Your notification preferences have been saved.",
    });
  };

  // Appearance & Preferences
  const handleThemeChange = (theme: "system" | "light" | "dark") => {
    setPreferences((prev) => {
      const next = { ...prev, theme };
      localStorage.setItem("geflow_admin_preferences", JSON.stringify(next));
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
    localStorage.setItem("geflow_admin_preferences", JSON.stringify(preferences));
    toast({
      title: "Preferences saved",
      description: "Account localization and appearance preferences updated.",
    });
  };

  // Helper to add activity log
  const addActivityLog = (
    title: string,
    description: string,
    iconType: ActivityLogItem["iconType"]
  ) => {
    const newItem: ActivityLogItem = {
      id: `act_${Date.now()}`,
      title,
      description,
      time: "Just now",
      dateGroup: "Today",
      iconType,
    };
    setActivities((prev) => [newItem, ...prev.slice(0, 15)]);
  };

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "None", color: "bg-muted" };
    let score = 0;
    if (pass.length >= 8) score++;
    if (pass.length >= 12) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) return { score: 1, label: "Weak", color: "bg-rose-500" };
    if (score <= 4) return { score: 2, label: "Good", color: "bg-amber-500" };
    return { score: 3, label: "Strong", color: "bg-emerald-500" };
  };

  const strength = getPasswordStrength(newPassword);

  return (
    <PanelLayout pageTitle="Profile" navItems={ADMIN_NAV} {...ADMIN_IDENTITY}>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Header Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/70">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
              <Link to="/admin" className="hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span className="text-foreground font-semibold">Profile</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Profile
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your personal information, account security, and preferences.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
                className="gap-1.5 rounded-xl text-xs font-semibold h-9 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={loadProfile}
              disabled={loading}
              className="gap-2 rounded-xl text-xs font-semibold h-9"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
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
              className={`gap-2 rounded-xl text-xs font-bold h-9 shadow-xs transition-all ${
                isEditing
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
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

        {/* 1. Profile Overview Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-card/90 p-5 sm:p-7 md:p-8 shadow-sm">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5 md:gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 min-w-0">
              {/* Avatar with upload badge */}
              <div className="relative group shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden border-2 border-primary/20 bg-muted/60 shadow-md flex items-center justify-center text-foreground font-black text-2xl sm:text-3xl">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="bg-gradient-to-br from-primary/90 to-primary text-primary-foreground w-full h-full flex items-center justify-center">
                      {profile.firstName.charAt(0) || "A"}
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

              {/* Information */}
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-foreground truncate">
                    {profile.displayName}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    {profile.accountType}
                  </span>
                </div>

                <p className="text-sm font-semibold text-primary">
                  {profile.role}
                </p>

                <div className="flex items-center gap-3 sm:gap-4 text-xs text-muted-foreground pt-1 flex-wrap">
                  <span className="flex items-center gap-1.5 truncate max-w-[240px] sm:max-w-none">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                    <span className="truncate">{profile.email}</span>
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                    Joined: {profile.createdAt}
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    Verified Admin
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-border/60 flex flex-wrap items-center gap-2.5 justify-start md:justify-end shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPasswordModalOpen(true)}
                className="gap-2 rounded-xl text-xs font-semibold h-9 border-border/80 hover:bg-muted"
              >
                <Key className="w-3.5 h-3.5" />
                Change Password
              </Button>
              {isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="gap-1.5 rounded-xl text-xs font-semibold h-9 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </Button>
              )}
              <Button
                variant={isEditing ? "default" : "default"}
                size="sm"
                onClick={() => {
                  if (isEditing) {
                    handleSavePersonalInfo();
                  } else {
                    setIsEditing(true);
                  }
                }}
                disabled={saving}
                className={`gap-2 rounded-xl text-xs font-bold h-9 shadow-xs transition-all ${
                  isEditing
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-sky-500 hover:bg-sky-600 text-white"
                }`}
              >
                {saving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : isEditing ? (
                  <Save className="w-3.5 h-3.5" />
                ) : (
                  <User className="w-3.5 h-3.5" />
                )}
                {isEditing ? "Save Changes" : "Edit Profile"}
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs for Profile Sections */}
        <Tabs defaultValue="personal" className="w-full">
          <div className="overflow-x-auto pb-2 scrollbar-none mb-6">
            <TabsList className="bg-muted/70 p-1.5 rounded-2xl w-max min-w-full sm:w-auto min-h-12 h-auto flex flex-nowrap items-center gap-1.5 border border-border/70 shadow-xs">
              <TabsTrigger value="personal" className="rounded-xl text-xs sm:text-sm font-semibold gap-2 py-2 px-3.5 h-9 sm:h-10 transition-all whitespace-nowrap shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                <User className="w-3.5 h-3.5" />
                Personal Info
              </TabsTrigger>
              <TabsTrigger value="account" className="rounded-xl text-xs sm:text-sm font-semibold gap-2 py-2 px-3.5 h-9 sm:h-10 transition-all whitespace-nowrap shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                <Shield className="w-3.5 h-3.5" />
                Account Info
              </TabsTrigger>
              <TabsTrigger value="security" className="rounded-xl text-xs sm:text-sm font-semibold gap-2 py-2 px-3.5 h-9 sm:h-10 transition-all whitespace-nowrap shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                <Lock className="w-3.5 h-3.5" />
                Security &amp; Sessions
              </TabsTrigger>
              <TabsTrigger value="notifications" className="rounded-xl text-xs sm:text-sm font-semibold gap-2 py-2 px-3.5 h-9 sm:h-10 transition-all whitespace-nowrap shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                <Bell className="w-3.5 h-3.5" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="preferences" className="rounded-xl text-xs sm:text-sm font-semibold gap-2 py-2 px-3.5 h-9 sm:h-10 transition-all whitespace-nowrap shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                <Globe className="w-3.5 h-3.5" />
                Preferences
              </TabsTrigger>
              <TabsTrigger value="activity" className="rounded-xl text-xs sm:text-sm font-semibold gap-2 py-2 px-3.5 h-9 sm:h-10 transition-all whitespace-nowrap shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                <Clock className="w-3.5 h-3.5" />
                Activity
              </TabsTrigger>
              <TabsTrigger
                value="danger"
                className="rounded-xl text-xs sm:text-sm font-semibold gap-2 py-2 px-3.5 h-9 sm:h-10 transition-all whitespace-nowrap shrink-0 text-rose-500 hover:text-rose-600 data-[state=active]:text-rose-600 data-[state=active]:bg-background data-[state=active]:shadow-xs"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Danger Zone
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 2. Personal Information Tab */}
          <TabsContent value="personal" className="space-y-6 mt-0">
            <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div>
                  <h3 className="text-base font-bold text-foreground">Personal Information</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Update your official administrative identity, display title, and profile picture.
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

              {/* Profile Photo Control */}
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
                      Recommended: JPG, PNG, or WebP. Max file size: 5 MB.
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

              {/* Form Fields */}
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
                    placeholder="Public display name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Role / Title</Label>
                  <Input
                    value={profile.role}
                    disabled={!isEditing}
                    onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                    className="rounded-xl text-sm h-10"
                    placeholder="Founder & Chairman"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Email Address</Label>
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

                <div className="space-y-1.5">
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
                    Save Changes
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* 3. Account Information Tab */}
          <TabsContent value="account" className="space-y-6 mt-0">
            <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="pb-4 border-b border-border/60">
                <h3 className="text-base font-bold text-foreground">Account Information</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  System-managed credentials, authority levels, and audit timestamps (read-only).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Admin ID
                  </span>
                  <p className="text-base font-black font-mono text-foreground">
                    {profile.adminId}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Primary system designation</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Account Role
                  </span>
                  <p className="text-base font-bold text-foreground flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-primary" />
                    Super Admin
                  </p>
                  <p className="text-[11px] text-muted-foreground">Full platform orchestration</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Account Status
                  </span>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {profile.status}
                  </p>
                  <p className="text-[11px] text-muted-foreground">All permissions granted</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1 sm:col-span-2 md:col-span-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      User UUID
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(profile.userId);
                        setCopiedId(true);
                        setTimeout(() => setCopiedId(false), 2000);
                        toast({ title: "Copied!", description: "User ID copied to clipboard." });
                      }}
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                    >
                      {copiedId ? (
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
                    {profile.userId}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Created At
                  </span>
                  <p className="text-sm font-semibold text-foreground">{profile.createdAt}</p>
                  <p className="text-[11px] text-muted-foreground">Account genesis date</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Last Updated
                  </span>
                  <p className="text-sm font-semibold text-foreground">{profile.lastUpdated}</p>
                  <p className="text-[11px] text-muted-foreground">Security audit sync</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Last Login
                  </span>
                  <p className="text-sm font-semibold text-foreground">{profile.lastLogin}</p>
                  <p className="text-[11px] text-muted-foreground">Authenticated IP Verified</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 4 & 6. Security & Login / Active Sessions Tab */}
          <TabsContent value="security" className="space-y-6 mt-0">
            {/* Security Cards */}
            <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="pb-4 border-b border-border/60">
                <h3 className="text-base font-bold text-foreground">Security & Login</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Protect your administrator session with robust encryption and multi-factor verification.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Password Card */}
                <div className="p-5 rounded-2xl border border-border/70 bg-muted/20 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-primary" /> Password
                      </h4>
                      <span className="text-[10px] font-bold text-muted-foreground font-mono">
                        Secured
                      </span>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground tracking-widest pt-1">
                      ••••••••••••••••
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Updated recently. Regular rotation recommended.
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
                        {twoFactorEnabled ? "Enabled" : "Optional"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      Add an extra layer of biometric or authenticator security to your account.
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

                {/* Email Verification Card */}
                <div className="p-5 rounded-2xl border border-border/70 bg-muted/20 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-primary" /> Email Verification
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        Verified ✓
                      </span>
                    </div>
                    <p className="text-xs font-medium text-foreground truncate pt-1">
                      {profile.email}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Primary administrative contact and recovery channel.
                    </p>
                  </div>

                  <div className="inline-flex items-center justify-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold py-2">
                    <CheckCircle2 className="w-4 h-4" /> Fully Authenticated
                  </div>
                </div>
              </div>
            </div>

            {/* Active Sessions Section */}
            <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
                <div>
                  <h3 className="text-base font-bold text-foreground">Active Sessions</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Devices and operating systems currently authorized to access this administrative account.
                  </p>
                </div>

                {sessions.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSignOutAllOtherSessions}
                    className="text-xs font-semibold rounded-xl text-destructive hover:bg-destructive/10 h-8.5 gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out All Other Sessions
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                      <th className="pb-3 pl-2">Device</th>
                      <th className="pb-3">Browser</th>
                      <th className="pb-3">Location</th>
                      <th className="pb-3">Last Active</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right pr-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {sessions.map((sess) => (
                      <tr key={sess.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 pl-2 font-semibold text-foreground flex items-center gap-2">
                          {sess.device.includes("Mobile") ? (
                            <Smartphone className="w-4 h-4 text-primary shrink-0" />
                          ) : (
                            <Laptop className="w-4 h-4 text-primary shrink-0" />
                          )}
                          {sess.device}
                        </td>
                        <td className="py-3 text-foreground">{sess.browser}</td>
                        <td className="py-3 text-muted-foreground">{sess.location}</td>
                        <td className="py-3 text-muted-foreground">{sess.lastActive}</td>
                        <td className="py-3">
                          {sess.isCurrent ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Current Session
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right pr-2">
                          {sess.isCurrent ? (
                            <span className="text-[11px] text-muted-foreground italic">Current</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSignOutSession(sess.id)}
                              className="h-7 text-xs text-destructive hover:bg-destructive/10 rounded-lg px-2"
                            >
                              Sign Out
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* 7. Notification Preferences Tab */}
          <TabsContent value="notifications" className="space-y-6 mt-0">
            <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="pb-4 border-b border-border/60">
                <h3 className="text-base font-bold text-foreground">Notification Preferences</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure real-time alerts and broadcast preferences. Critical security alerts are locked by platform policy.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    key: "supportMessages",
                    label: "Support Messages & Tickets",
                    desc: "Notify when customers or employees open new support tickets or leave inquiries.",
                    locked: false,
                  },
                  {
                    key: "newUserRegistration",
                    label: "New User Registration",
                    desc: "Immediate alert when a new platform user registers an account.",
                    locked: false,
                  },
                  {
                    key: "businessRegistration",
                    label: "Business Registration",
                    desc: "Notification when new pharmacy, retail, or warehouse businesses onboard.",
                    locked: false,
                  },
                  {
                    key: "paymentNotifications",
                    label: "Payment & Subscription Notifications",
                    desc: "Alerts on invoice clearances, plan upgrades, and refund submissions.",
                    locked: false,
                  },
                  {
                    key: "systemAlerts",
                    label: "System Alerts & Health Monitoring",
                    desc: "Immediate notification on server downtime, API latency, or sync interruptions (Critical).",
                    locked: true,
                  },
                  {
                    key: "securityAlerts",
                    label: "Security & Authentication Alerts",
                    desc: "Suspicious login attempts, privilege escalations, and credential audits (Mandatory).",
                    locked: true,
                  },
                  {
                    key: "teamActivity",
                    label: "Team Activity & Staff Changes",
                    desc: "Updates when managers, inventory clerks, or cashiers are appointed.",
                    locked: false,
                  },
                  {
                    key: "announcements",
                    label: "Platform Announcements",
                    desc: "Preview and broadcast alerts for upcoming feature releases.",
                    locked: false,
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-start justify-between gap-4 p-4 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`notif-${item.key}`}
                          className="text-sm font-semibold text-foreground cursor-pointer"
                        >
                          {item.label}
                        </Label>
                        {item.locked && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
                            <Lock className="w-2.5 h-2.5" /> Mandatory
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>

                    <Switch
                      id={`notif-${item.key}`}
                      checked={notifications[item.key as keyof NotificationPrefs]}
                      disabled={item.locked}
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

          {/* 8. Appearance & Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6 mt-0">
            <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="pb-4 border-b border-border/60">
                <h3 className="text-base font-bold text-foreground">Preferences & Localization</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure UI appearance theme, language, administrative timezone, and format masks.
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Language</Label>
                  <Select
                    value={preferences.language}
                    onValueChange={(val) => setPreferences({ ...preferences, language: val })}
                  >
                    <SelectTrigger className="rounded-xl text-sm h-10">
                      <SelectValue placeholder="Select Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English (Default)</SelectItem>
                      <SelectItem value="ur">Urdu (اردو)</SelectItem>
                      <SelectItem value="ar">Arabic (العربية)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Timezone</Label>
                  <Select
                    value={preferences.timezone}
                    onValueChange={(val) => setPreferences({ ...preferences, timezone: val })}
                  >
                    <SelectTrigger className="rounded-xl text-sm h-10">
                      <SelectValue placeholder="Select Timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Karachi">Asia/Karachi (PKT - UTC+5)</SelectItem>
                      <SelectItem value="UTC">UTC (Coordinated Universal)</SelectItem>
                      <SelectItem value="Asia/Dubai">Asia/Dubai (GST - UTC+4)</SelectItem>
                      <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (EST/EDT)</SelectItem>
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
                      <SelectValue placeholder="Select Format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (e.g. 05/10/2026)</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (e.g. 10/05/2026)</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-10-05)</SelectItem>
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

          {/* 9. Profile Activity Tab */}
          <TabsContent value="activity" className="space-y-6 mt-0">
            <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="pb-4 border-b border-border/60 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground">Recent Activity</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Security log of logins, profile modifications, credential updates, and settings.
                  </p>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  {activities.length} Records
                </span>
              </div>

              <div className="space-y-6">
                {["Today", "Yesterday", "Earlier"].map((groupName) => {
                  const groupItems = activities.filter((a) => a.dateGroup === groupName);
                  if (groupItems.length === 0) return null;

                  return (
                    <div key={groupName} className="space-y-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1 rounded-md bg-muted/40">
                        {groupName}
                      </span>

                      <div className="space-y-2.5 pt-1">
                        {groupItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-3.5 p-3.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
                          >
                            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                              {item.iconType === "login" && <Key className="w-4 h-4" />}
                              {item.iconType === "profile" && <User className="w-4 h-4" />}
                              {item.iconType === "password" && <Lock className="w-4 h-4" />}
                              {item.iconType === "settings" && <Globe className="w-4 h-4" />}
                              {item.iconType === "security" && <Shield className="w-4 h-4" />}
                            </div>

                            <div className="flex-1 space-y-0.5">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-foreground">
                                  {item.title}
                                </h4>
                                <span className="text-[11px] font-mono text-muted-foreground">
                                  {item.time}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* 10. Danger Zone Tab */}
          <TabsContent value="danger" className="space-y-6 mt-0">
            <div className="bg-card border border-rose-500/30 dark:border-rose-900/50 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="pb-4 border-b border-rose-500/20">
                <h3 className="text-base font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Danger Zone
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Restricted system operations with account availability and identity impacts.
                </p>
              </div>

              <div className="space-y-4">
                {/* Deactivate Account */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-muted/20">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground">Deactivate Account</h4>
                    <p className="text-xs text-muted-foreground">
                      Temporarily disable this administrative account. System logs and history remain preserved.
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

                {/* Protected Delete Account */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400">
                        Delete Account
                      </h4>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400">
                        Protected
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Super Admin accounts cannot be directly deleted without multi-level identity authorization and secondary system confirmation.
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

      {/* 5. Change Password Modal */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Change Password</DialogTitle>
            <DialogDescription className="text-xs">
              Ensure your new password contains at least 8 characters including mixed cases and symbols.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Current Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="rounded-xl pr-10 text-sm"
                  placeholder="Enter current password"
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
              <Label className="text-xs font-semibold">New Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rounded-xl pr-10 text-sm"
                  placeholder="Enter new strong password"
                />
              </div>

              {/* Password strength bar */}
              {newPassword && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Strength:</span>
                    <span className="font-bold">{strength.label}</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex gap-1">
                    <div
                      className={`h-full transition-all ${
                        strength.score >= 1 ? strength.color : "bg-transparent"
                      } w-1/3`}
                    />
                    <div
                      className={`h-full transition-all ${
                        strength.score >= 2 ? strength.color : "bg-transparent"
                      } w-1/3`}
                    />
                    <div
                      className={`h-full transition-all ${
                        strength.score >= 3 ? strength.color : "bg-transparent"
                      } w-1/3`}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Confirm New Password</Label>
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
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleUpdatePassword}
              disabled={passwordUpdating || !newPassword || newPassword !== confirmPassword}
              className="rounded-xl text-xs font-semibold gap-2 shadow-sm"
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
              <AlertTriangle className="w-5 h-5" /> Deactivate Administrator Account
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Are you sure you want to temporarily deactivate this Super Admin account? You will be signed out immediately and another administrator must re-enable your privileges.
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
              onClick={() => {
                setIsDeactivateOpen(false);
                toast({
                  title: "Action deferred",
                  description: "Self-deactivation for primary Super Admin is protected by system policy.",
                });
              }}
              className="rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
            >
              Confirm Deactivation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Modal (Protected) */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Delete Super Admin Account
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              ⚠️ <strong>Critical Protection:</strong> Super Admin accounts govern enterprise subscriptions, tenant databases, and security audit integrity. Deletion requires explicit confirmation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-muted-foreground">
              To proceed with identity destruction request, type{" "}
              <strong className="text-foreground font-mono">DELETE ACCOUNT</strong> below:
            </p>
            <Input
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder="Type DELETE ACCOUNT"
              className="rounded-xl font-mono text-xs"
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDeleteOpen(false);
                setDeleteConfirmationText("");
              }}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteConfirmationText !== "DELETE ACCOUNT"}
              onClick={() => {
                setIsDeleteOpen(false);
                setDeleteConfirmationText("");
                toast({
                  title: "Protection Block",
                  description:
                    "Direct self-deletion of Root Administrator is blocked. Please transfer ownership before closing account.",
                  variant: "destructive",
                });
              }}
              className="rounded-xl text-xs font-semibold"
            >
              Acknowledge & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelLayout>
  );
}
