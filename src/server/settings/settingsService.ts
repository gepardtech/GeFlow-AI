import { serverSupabase } from "../supabase";
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
}

export interface PlatformGeneralSettings {
  parent_company?: string;
  social_links: SocialMediaLink[];
  footer_copyright: FooterCopyrightSettings;
  about_members: AboutPageMember[];
}

const DEFAULT_SETTINGS: PlatformGeneralSettings = {
  parent_company: "Gepard Techs",
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
  about_members: [
    {
      id: "mem_1",
      name: "SG Bilal",
      role: "Chairman & Chief Executive Officer",
      bio: "Founder of Gepard Techs — the parent ecosystem behind GeFlow — SG Bilal is a full-stack developer and applied AI specialist. He architected GeFlow's real-time POS, inventory, and analytics engine.",
      image_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=faces",
      order: 1,
      enabled: true,
      social_links: {
        facebook: "https://web.facebook.com/gepardweb/",
        instagram: "https://www.instagram.com/gepardweb/",
        twitter: "https://x.com/gepardweb",
        x: "https://x.com/gepardweb",
        linkedin: "https://www.linkedin.com/company/gepardweb",
        pinterest: "https://www.pinterest.com/gepardwebs",
        github: "https://github.com/gepardweb",
        email: "gepardwebs@gmail.com",
      },
    },
    {
      id: "mem_2",
      name: "Sarah Jenkins",
      role: "Chief Product Officer & Architecture Lead",
      bio: "Specializes in high-concurrency offline-first database synchronization and zero-latency retail checkout workflows across thousands of enterprise retail chains.",
      image_url: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=faces",
      order: 2,
      enabled: true,
      social_links: {
        linkedin: "https://linkedin.com/in/sarah-jenkins",
        twitter: "https://x.com/sarah_pos",
        x: "https://x.com/sarah_pos",
        email: "sarah@geflow.team",
      },
    },
    {
      id: "mem_3",
      name: "Alex Chen",
      role: "VP of Engineering & Systems",
      bio: "Cloud infrastructure architect dedicated to 99.999% uptime, microsecond ledger consistency, distributed replication, and automated failover.",
      image_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces",
      order: 3,
      enabled: true,
      social_links: {
        linkedin: "https://linkedin.com/in/alexchen",
        github: "https://github.com/alexchen",
        email: "alex@geflow.team",
      },
    },
    {
      id: "mem_4",
      name: "Elena Rostova",
      role: "Head of Merchant Success & Growth",
      bio: "Passionate advocate for merchant productivity, omni-channel scaling, customer retention, and onboarding multi-branch retail and pharmacy networks.",
      image_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=faces",
      order: 4,
      enabled: true,
      social_links: {
        linkedin: "https://linkedin.com/in/elenarostova",
        twitter: "https://x.com/elena_merchants",
        x: "https://x.com/elena_merchants",
        email: "elena@geflow.team",
      },
    },
  ],
};

const BACKUP_PATH = path.join(process.cwd(), "data", "general_settings.json");

function readBackupFile(): PlatformGeneralSettings | null {
  try {
    if (fs.existsSync(BACKUP_PATH)) {
      const raw = fs.readFileSync(BACKUP_PATH, "utf8");
      return JSON.parse(raw);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeBackupFile(settings: PlatformGeneralSettings) {
  try {
    const dir = path.dirname(BACKUP_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BACKUP_PATH, JSON.stringify(settings, null, 2), "utf8");
  } catch {
    /* ignore */
  }
}

class SettingsService {
  private cache: PlatformGeneralSettings = { ...DEFAULT_SETTINGS };
  private initialized = false;

  constructor() {
    const backup = readBackupFile();
    if (backup) {
      this.cache = backup;
    }
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
        const merged: PlatformGeneralSettings = {
          parent_company: gen.parent_company || alerts.parent_company || this.cache.parent_company || "Gepard Techs",
          social_links: Array.isArray(gen.social_links) 
            ? gen.social_links 
            : (Array.isArray(alerts.social_links) ? alerts.social_links : this.cache.social_links),
          footer_copyright: gen.footer_copyright || alerts.footer_copyright || this.cache.footer_copyright,
          about_members: Array.isArray(gen.about_members)
            ? (gen.about_members.length > 0 ? gen.about_members : (this.cache.about_members.length > 0 ? this.cache.about_members : DEFAULT_SETTINGS.about_members))
            : (Array.isArray(alerts.about_members) && alerts.about_members.length > 0 ? alerts.about_members : this.cache.about_members),
        };
        this.cache = merged;
        writeBackupFile(merged);
      }
      this.initialized = true;
    } catch (err) {
      console.warn("Supabase general settings sync notice:", err);
      this.initialized = true;
    }
  }

  private async persistToSupabase(settings: PlatformGeneralSettings): Promise<void> {
    writeBackupFile(settings);
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
        parent_company: settings.parent_company || "Gepard Techs",
        social_links: settings.social_links,
        footer_copyright: settings.footer_copyright,
        about_members: settings.about_members,
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

  public async updateAllSettings(updates: Partial<PlatformGeneralSettings>): Promise<PlatformGeneralSettings> {
    const merged: PlatformGeneralSettings = {
      parent_company: updates.parent_company !== undefined ? updates.parent_company : this.cache.parent_company,
      social_links: updates.social_links !== undefined ? updates.social_links : this.cache.social_links,
      footer_copyright: updates.footer_copyright !== undefined ? updates.footer_copyright : this.cache.footer_copyright,
      about_members: updates.about_members !== undefined ? updates.about_members : this.cache.about_members,
    };
    this.cache = merged;
    await this.persistToSupabase(merged);
    return merged;
  }

  public async updateSocialLinks(links: SocialMediaLink[]): Promise<PlatformGeneralSettings> {
    this.cache.social_links = links;
    await this.persistToSupabase(this.cache);
    return this.cache;
  }

  public async updateFooterCopyright(copyright: FooterCopyrightSettings): Promise<PlatformGeneralSettings> {
    this.cache.footer_copyright = copyright;
    await this.persistToSupabase(this.cache);
    return this.cache;
  }

  public async updateAboutMembers(members: AboutPageMember[]): Promise<PlatformGeneralSettings> {
    this.cache.about_members = members;
    await this.persistToSupabase(this.cache);
    return this.cache;
  }

  public async reloadFromSupabase(): Promise<PlatformGeneralSettings> {
    await this.syncFromSupabase();
    return this.cache;
  }

  public async purgeCache(hardReset: boolean = true): Promise<{ purgedFiles: string[]; timestamp: string }> {
    const purgedFiles: string[] = [];
    if (hardReset && fs.existsSync(BACKUP_PATH)) {
      try {
        fs.unlinkSync(BACKUP_PATH);
        purgedFiles.push(BACKUP_PATH);
      } catch (err) {
        console.warn("Notice deleting backup file during cache purge:", err);
      }
    }
    this.cache = { ...DEFAULT_SETTINGS };
    await this.syncFromSupabase();
    return {
      purgedFiles,
      timestamp: new Date().toISOString(),
    };
  }
}

export const settingsService = new SettingsService();
