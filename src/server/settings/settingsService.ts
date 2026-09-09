import fs from "fs";
import path from "path";

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

const SETTINGS_FILE = path.join(process.cwd(), "data", "platform_general_settings.json");

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
  private cache: PlatformGeneralSettings | null = null;

  private load(): PlatformGeneralSettings {
    try {
      if (!fs.existsSync(SETTINGS_FILE)) {
        const dir = path.dirname(SETTINGS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf-8");
        this.cache = DEFAULT_SETTINGS;
        return DEFAULT_SETTINGS;
      }
      const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
      this.cache = JSON.parse(raw);
      return this.cache!;
    } catch (err) {
      console.error("Error reading general settings:", err);
      return DEFAULT_SETTINGS;
    }
  }

  private save(settings: PlatformGeneralSettings): void {
    try {
      const dir = path.dirname(SETTINGS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
      this.cache = settings;
    } catch (err) {
      console.error("Error writing general settings:", err);
    }
  }

  public getSettings(): PlatformGeneralSettings {
    return this.load();
  }

  public updateAllSettings(updates: Partial<PlatformGeneralSettings>): PlatformGeneralSettings {
    const current = this.load();
    const merged: PlatformGeneralSettings = {
      social_links: updates.social_links ?? current.social_links,
      footer_copyright: updates.footer_copyright ?? current.footer_copyright,
      about_members: updates.about_members ?? current.about_members,
    };
    this.save(merged);
    return merged;
  }

  public updateSocialLinks(links: SocialMediaLink[]): PlatformGeneralSettings {
    const current = this.load();
    current.social_links = links;
    this.save(current);
    return current;
  }

  public updateFooterCopyright(copyright: FooterCopyrightSettings): PlatformGeneralSettings {
    const current = this.load();
    current.footer_copyright = copyright;
    this.save(current);
    return current;
  }

  public updateAboutMembers(members: AboutPageMember[]): PlatformGeneralSettings {
    const current = this.load();
    current.about_members = members;
    this.save(current);
    return current;
  }
}

export const settingsService = new SettingsService();
