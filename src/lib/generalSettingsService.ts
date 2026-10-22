import { supabase } from "@/integrations/supabase/client";

export interface SocialMediaLink {
  id: string;
  platform:
    | "facebook"
    | "instagram"
    | "x"
    | "linkedin"
    | "pinterest"
    | "github"
    | "youtube"
    | "discord"
    | "telegram"
    | "email"
    | "other";
  label: string;
  url: string;
  enabled: boolean;
}

export interface CopyrightWordUrl {
  id: string;
  word: string;
  url: string;
  openInNewTab: boolean;
}

export interface FooterCopyrightSettings {
  text: string;
  wordUrls: CopyrightWordUrl[];
}

export interface AboutPageMember {
  id: string;
  name: string;
  role: string;
  bio?: string;
  image_url: string;
  imageUrl?: string;
  order: number;
  enabled?: boolean;
  social_links?: {
    linkedin?: string;
    twitter?: string;
    x?: string;
    github?: string;
    facebook?: string;
    pinterest?: string;
    email?: string;
  };
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    x?: string;
    github?: string;
    facebook?: string;
    pinterest?: string;
    email?: string;
  };
}

export interface PlatformGeneralSettings {
  parent_company?: string;
  social_links: SocialMediaLink[];
  footer_copyright: FooterCopyrightSettings;
  about_members: AboutPageMember[];
}

/**
 * Empty shell only — NO demo team members / social fluff.
 * Real values live in Supabase platform_settings.alerts.general_settings
 */
export const DEFAULT_GENERAL_SETTINGS: PlatformGeneralSettings = {
  parent_company: "",
  social_links: [],
  footer_copyright: {
    text: "",
    wordUrls: [],
  },
  about_members: [],
};

function normalizeSettings(raw: any): PlatformGeneralSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_GENERAL_SETTINGS };

  return {
    parent_company:
      typeof raw.parent_company === "string" ? raw.parent_company : "",
    social_links: Array.isArray(raw.social_links) ? raw.social_links : [],
    footer_copyright: {
      text:
        typeof raw.footer_copyright?.text === "string"
          ? raw.footer_copyright.text
          : "",
      wordUrls: Array.isArray(raw.footer_copyright?.wordUrls)
        ? raw.footer_copyright.wordUrls
        : [],
    },
    about_members: Array.isArray(raw.about_members) ? raw.about_members : [],
  };
}

function notify(settings: PlatformGeneralSettings) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("geflow:settings-updated", { detail: settings })
    );
  }
}

export const STORAGE_KEY = "geflow_general_settings_cache";

export function getCachedSettings(): PlatformGeneralSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return normalizeSettings(parsed);
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function getCachedGeneralSettings(): PlatformGeneralSettings {
  const cached = getCachedSettings();
  if (cached && (cached.about_members.length > 0 || cached.social_links.length > 0)) {
    return cached;
  }
  return { ...DEFAULT_GENERAL_SETTINGS };
}

export function setCachedGeneralSettings(settings: PlatformGeneralSettings) {
  setCachedSettings(settings);
  notify(settings);
}

export function setCachedSettings(settings: PlatformGeneralSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

/**
 * Load general settings from server backend, Supabase, or persistent cache.
 * Stored at: platform_settings.alerts.general_settings & /api/admin/general-settings
 */
export async function fetchGeneralSettings(): Promise<PlatformGeneralSettings> {
  const cached = getCachedSettings();

  // 1. Try server API first (which loads from database + file backup with full service role)
  try {
    const res = await fetch("/api/admin/general-settings");
    if (res.ok) {
      const json = await res.json();
      if (json?.settings) {
        const normalized = normalizeSettings(json.settings);
        // If server had empty members but cache had members, preserve cache
        if (normalized.about_members.length === 0 && cached && cached.about_members.length > 0) {
          normalized.about_members = cached.about_members;
        }
        setCachedSettings(normalized);
        notify(normalized);
        return normalized;
      }
    }
  } catch (apiErr) {
    console.warn("fetchGeneralSettings API notice:", apiErr);
  }

  // 2. Query Supabase
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("id, alerts")
      .limit(1)
      .maybeSingle();

    if (!error && data?.alerts) {
      const alerts = (data.alerts as any) || {};
      const general = alerts.general_settings;
      if (general) {
        const normalized = normalizeSettings(general);
        if (normalized.about_members.length === 0 && cached && cached.about_members.length > 0) {
          normalized.about_members = cached.about_members;
        }
        setCachedSettings(normalized);
        notify(normalized);
        return normalized;
      }
    }
  } catch (err) {
    console.warn("fetchGeneralSettings Supabase exception:", err);
  }

  if (cached) {
    notify(cached);
    return cached;
  }

  return { ...DEFAULT_GENERAL_SETTINGS };
}

/**
 * Save general settings with dual resilience:
 * 1. Primary: dedicated server endpoint `/api/admin/general-settings` (runs service-role, persists alerts & settingsService)
 * 2. Fallback: direct Supabase platform_settings mutation
 */
export async function saveGeneralSettings(
  settings: PlatformGeneralSettings
): Promise<PlatformGeneralSettings> {
  const normalized = normalizeSettings(settings);

  // Helper to sanitize any HTML responses (e.g. server warmup pages) into clean human text
  const sanitizeErrorMessage = (err: any): string => {
    const rawMsg = err?.message || String(err || "");
    if (rawMsg.includes("<!doctype") || rawMsg.includes("<html") || rawMsg.includes("Starting Server")) {
      return "The server is currently initializing. Please retry in a few moments.";
    }
    return rawMsg || "Failed to save settings.";
  };

  // Primary: Attempt direct server endpoint with service role
  try {
    const res = await fetch("/api/admin/general-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: normalized }),
    });

    if (res.ok) {
      const result = await res.json();
      if (result.success) {
        setCachedSettings(normalized);
        notify(normalized);
        return normalized;
      }
    }
  } catch (backendErr) {
    console.warn("Notice: server endpoint save failed, falling back to Supabase client:", backendErr);
  }

  // Fallback: direct Supabase client write
  try {
    const { data: row, error: readError } = await supabase
      .from("platform_settings")
      .select("id, alerts")
      .limit(1)
      .maybeSingle();

    if (readError) {
      console.error("platform_settings read failed:", readError.message);
      throw new Error(sanitizeErrorMessage(readError));
    }

    const existingAlerts =
      row?.alerts && typeof row.alerts === "object" ? { ...(row.alerts as any) } : {};

    const nextAlerts = {
      ...existingAlerts,
      general_settings: normalized,
    };

    if (row?.id) {
      const { error: updateError } = await supabase
        .from("platform_settings")
        .update({ alerts: nextAlerts, updated_at: new Date().toISOString() })
        .eq("id", row.id);

      if (updateError) {
        console.error("platform_settings update failed:", updateError.message);
        throw new Error(sanitizeErrorMessage(updateError));
      }
    } else {
      const { error: insertError } = await supabase
        .from("platform_settings")
        .insert({ alerts: nextAlerts });

      if (insertError) {
        console.error("platform_settings insert failed:", insertError.message);
        throw new Error(sanitizeErrorMessage(insertError));
      }
    }

    setCachedSettings(normalized);
    notify(normalized);
    return normalized;
  } catch (err: any) {
    const cleanErrorMsg = sanitizeErrorMessage(err);
    console.error("saveGeneralSettings exception:", cleanErrorMsg);
    throw new Error(cleanErrorMsg);
  }
}