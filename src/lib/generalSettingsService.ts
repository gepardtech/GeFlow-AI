import { supabase } from "@/integrations/supabase/client";

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
  social_links: SocialMediaLink[];
  footer_copyright: FooterCopyrightSettings;
  about_members: AboutPageMember[];
}

export const DEFAULT_GENERAL_SETTINGS: PlatformGeneralSettings = {
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
      bio: "Founder of Gepard Tech — the parent ecosystem behind GeFlow — SG Bilal is a full-stack developer and applied AI specialist. He architected GeFlow's real-time POS, inventory, and analytics engine.",
      image_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=faces",
      imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=faces",
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
      socialLinks: {
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
      imageUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=faces",
      order: 2,
      enabled: true,
      social_links: {
        linkedin: "https://linkedin.com/in/sarah-jenkins",
        twitter: "https://x.com/sarah_pos",
        x: "https://x.com/sarah_pos",
        email: "sarah@geflow.team",
      },
      socialLinks: {
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
      imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces",
      order: 3,
      enabled: true,
      social_links: {
        linkedin: "https://linkedin.com/in/alexchen",
        github: "https://github.com/alexchen",
        email: "alex@geflow.team",
      },
      socialLinks: {
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
      imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=faces",
      order: 4,
      enabled: true,
      social_links: {
        linkedin: "https://linkedin.com/in/elenarostova",
        twitter: "https://x.com/elena_merchants",
        x: "https://x.com/elena_merchants",
        email: "elena@geflow.team",
      },
      socialLinks: {
        linkedin: "https://linkedin.com/in/elenarostova",
        twitter: "https://x.com/elena_merchants",
        x: "https://x.com/elena_merchants",
        email: "elena@geflow.team",
      },
    },
  ],
};

const CACHE_KEY = "geflow_platform_general_settings";

export function getCachedGeneralSettings(): PlatformGeneralSettings {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return DEFAULT_GENERAL_SETTINGS;
}

export function setCachedGeneralSettings(settings: PlatformGeneralSettings) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent("geflow:settings-updated", { detail: settings }));
  } catch {
    /* ignore */
  }
}

export async function fetchGeneralSettings(): Promise<PlatformGeneralSettings> {
  // 1. Try fetching from server API
  try {
    const res = await fetch("/api/settings/general");
    if (res.ok) {
      const data = await res.json();
      if (data?.settings) {
        setCachedGeneralSettings(data.settings);
        return data.settings;
      }
    }
  } catch (err) {
    console.warn("API general settings notice:", err);
  }

  // 2. Try fetching from Supabase platform_settings.alerts
  try {
    const { data } = await supabase
      .from("platform_settings")
      .select("alerts")
      .limit(1)
      .maybeSingle();

    if (data?.alerts) {
      const alerts = data.alerts as any;
      if (alerts.general_settings) {
        setCachedGeneralSettings(alerts.general_settings);
        return alerts.general_settings;
      }
    }
  } catch (err) {
    console.warn("Supabase general settings notice:", err);
  }

  return getCachedGeneralSettings();
}

export async function saveGeneralSettings(
  settings: PlatformGeneralSettings
): Promise<PlatformGeneralSettings> {
  // 1. Cache immediately and notify subscribers
  setCachedGeneralSettings(settings);

  // 2. Save to Server API
  try {
    await fetch("/api/settings/general", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
  } catch (err) {
    console.warn("Notice saving settings to API:", err);
  }

  // 3. Save to Supabase platform_settings
  try {
    const { data: row } = await supabase
      .from("platform_settings")
      .select("id, alerts")
      .limit(1)
      .maybeSingle();

    if (row?.id) {
      const currentAlerts = (row.alerts as any) || {};
      const updatedAlerts = {
        ...currentAlerts,
        general_settings: settings,
        social_links: settings.social_links,
        footer_copyright: settings.footer_copyright,
        about_members: settings.about_members,
      };

      await supabase
        .from("platform_settings")
        .update({ alerts: updatedAlerts })
        .eq("id", row.id);
    }
  } catch (err) {
    console.warn("Notice updating Supabase platform_settings:", err);
  }

  return settings;
}
