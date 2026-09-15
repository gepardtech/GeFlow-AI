import { serverSupabase } from "../supabase";

export interface SocialMediaLink {
  id: string;
  platform: "facebook" | "instagram" | "x" | "linkedin" | "pinterest" | "github" | "youtube" | "discord" | "telegram" | "email" | "other";
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
  order: number;
  social_links?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    facebook?: string;
    email?: string;
  };
}

export interface PlatformGeneralSettings {
  social_links: SocialMediaLink[];
  footer_copyright: FooterCopyrightSettings;
  about_members: AboutPageMember[];
}

const DEFAULT_SETTINGS: PlatformGeneralSettings = {
  social_links: [
    { id: "soc_fb", platform: "facebook", label: "Facebook", url: "https://web.facebook.com/gepardweb/", enabled: true },
    { id: "soc_ig", platform: "instagram", label: "Instagram", url: "https://www.instagram.com/gepardweb/", enabled: true },
    { id: "soc_x", platform: "x", label: "X (Twitter)", url: "https://x.com/gepardweb", enabled: true },
    { id: "soc_in", platform: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/company/gepardweb", enabled: true },
    { id: "soc_pin", platform: "pinterest", label: "Pinterest", url: "https://www.pinterest.com/gepardwebs", enabled: true },
    { id: "soc_gh", platform: "github", label: "GitHub", url: "https://github.com/gepardweb", enabled: true },
    { id: "soc_yt", platform: "youtube", label: "YouTube", url: "https://youtube.com/@gepardweb", enabled: false },
    { id: "soc_disc", platform: "discord", label: "Discord", url: "https://discord.gg/geflow", enabled: false },
    { id: "soc_tg", platform: "telegram", label: "Telegram", url: "https://t.me/geflow", enabled: false },
    { id: "soc_mail", platform: "email", label: "Official Email", url: "mailto:gepardwebs@gmail.com", enabled: true },
  ],
  footer_copyright: {
    text: "© 2026 GeFlow AI. All rights reserved. Powered by Gepard Techs.",
    wordUrls: [
      { id: "w_geflow", word: "GeFlow AI", url: "/", openInNewTab: false },
      { id: "w_gepard", word: "Gepard Techs", url: "https://gepardtechs.com", openInNewTab: true },
    ],
  },
  about_members: [],
};

class SettingsService {
  private cache: PlatformGeneralSettings = { ...DEFAULT_SETTINGS };
  private initialized = false;

  constructor() {
    this.syncFromSupabase();
  }

  private async syncFromSupabase(): Promise<void> {
    try {
      const { data, error } = await serverSupabase
        .from("platform_settings")
        .select("alerts")
        .limit(1)
        .maybeSingle();

      if (!error && data?.alerts) {
        const alerts = data.alerts as any;
        const gen = alerts.general_settings || {};
        this.cache = {
          social_links: Array.isArray(gen.social_links) 
            ? gen.social_links 
            : (Array.isArray(alerts.social_links) ? alerts.social_links : this.cache.social_links),
          footer_copyright: gen.footer_copyright || alerts.footer_copyright || this.cache.footer_copyright,
          about_members: Array.isArray(gen.about_members) 
            ? gen.about_members 
            : (Array.isArray(alerts.about_members) ? alerts.about_members : this.cache.about_members),
        };
      }
      this.initialized = true;
    } catch (err) {
      console.warn("Supabase general settings sync notice:", err);
      this.initialized = true;
    }
  }

  private async persistToSupabase(settings: PlatformGeneralSettings): Promise<void> {
    try {
      const { data: existing } = await serverSupabase
        .from("platform_settings")
        .select("id, alerts")
        .limit(1)
        .maybeSingle();

      const existingAlerts = (existing?.alerts as any) || {};
      const updatedAlerts = {
        ...existingAlerts,
        general_settings: settings,
      };

      if (existing?.id) {
        await serverSupabase
          .from("platform_settings")
          .update({ alerts: updatedAlerts, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await serverSupabase
          .from("platform_settings")
          .upsert({ singleton: true, alerts: updatedAlerts });
      }
    } catch (err) {
      console.warn("Failed to persist general settings to Supabase:", err);
    }
  }

  public getSettings(): PlatformGeneralSettings {
    if (!this.initialized) {
      this.syncFromSupabase();
    }
    return this.cache;
  }

  public updateAllSettings(updates: Partial<PlatformGeneralSettings>): PlatformGeneralSettings {
    const merged: PlatformGeneralSettings = {
      social_links: updates.social_links ?? this.cache.social_links,
      footer_copyright: updates.footer_copyright ?? this.cache.footer_copyright,
      about_members: updates.about_members ?? this.cache.about_members,
    };
    this.cache = merged;
    this.persistToSupabase(merged);
    return merged;
  }

  public updateSocialLinks(links: SocialMediaLink[]): PlatformGeneralSettings {
    this.cache.social_links = links;
    this.persistToSupabase(this.cache);
    return this.cache;
  }

  public updateFooterCopyright(copyright: FooterCopyrightSettings): PlatformGeneralSettings {
    this.cache.footer_copyright = copyright;
    this.persistToSupabase(this.cache);
    return this.cache;
  }

  public updateAboutMembers(members: AboutPageMember[]): PlatformGeneralSettings {
    this.cache.about_members = members;
    this.persistToSupabase(this.cache);
    return this.cache;
  }

  public async reloadFromSupabase(): Promise<PlatformGeneralSettings> {
    await this.syncFromSupabase();
    return this.cache;
  }
}

export const settingsService = new SettingsService();
