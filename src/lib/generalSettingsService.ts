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

/**
 * @deprecated No local cache. Prefer fetchGeneralSettings().
 */
export function getCachedGeneralSettings(): PlatformGeneralSettings {
  return { ...DEFAULT_GENERAL_SETTINGS };
}

/**
 * @deprecated No local cache.
 */
export function setCachedGeneralSettings(settings: PlatformGeneralSettings) {
  notify(settings);
}

/**
 * Load general settings from Supabase only.
 * Stored at: platform_settings.alerts.general_settings
 */
export async function fetchGeneralSettings(): Promise<PlatformGeneralSettings> {
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("id, alerts")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("platform_settings fetch failed:", error.message);
      return { ...DEFAULT_GENERAL_SETTINGS };
    }

    const alerts = (data?.alerts as any) || {};
    const general = alerts.general_settings;
    if (general) {
      const normalized = normalizeSettings(general);
      notify(normalized);
      return normalized;
    }

    return { ...DEFAULT_GENERAL_SETTINGS };
  } catch (err) {
    console.error("fetchGeneralSettings exception:", err);
    return { ...DEFAULT_GENERAL_SETTINGS };
  }
}

/**
 * Save general settings to Supabase only (merge into platform_settings.alerts).
 */
export async function saveGeneralSettings(
  settings: PlatformGeneralSettings
): Promise<PlatformGeneralSettings> {
  const normalized = normalizeSettings(settings);

  try {
    const { data: row, error: readError } = await supabase
      .from("platform_settings")
      .select("id, alerts")
      .limit(1)
      .maybeSingle();

    if (readError) {
      console.error("platform_settings read failed:", readError.message);
      throw readError;
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
        throw updateError;
      }
    } else {
      const { error: insertError } = await supabase
        .from("platform_settings")
        .insert({ alerts: nextAlerts });

      if (insertError) {
        console.error("platform_settings insert failed:", insertError.message);
        throw insertError;
      }
    }

    notify(normalized);
    return normalized;
  } catch (err) {
    console.error("saveGeneralSettings exception:", err);
    throw err;
  }
}