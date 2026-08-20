import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlatformSettings = Record<string, any>;

const RTL_LANGS = ["ar-SA", "ur-PK"];

/** Convert a hex color (#rrggbb) to an "h s% l%" string usable in CSS HSL vars. */
const hexToHslTriplet = (hex: string): string | null => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex ?? "").trim());
  if (!m) return null;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

const applyFavicon = (url: string | null) => {
  if (!url) return;
  document.querySelectorAll("link[rel*='icon']").forEach((el) => el.parentElement?.removeChild(el));
  const link = document.createElement("link");
  link.rel = "icon";
  link.href = url;
  document.head.appendChild(link);
};

/** Apply branding + language side-effects to the document. */
export const applyPlatformSettings = (s: PlatformSettings | null) => {
  if (!s) return;
  if (s.app_name) document.title = s.app_name;
  applyFavicon(s.favicon_url ?? null);
  const root = document.documentElement;
  const primary = s.primary_accent ? hexToHslTriplet(s.primary_accent) : null;
  const secondary = s.secondary_accent ? hexToHslTriplet(s.secondary_accent) : null;
  if (primary) {
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--ring", primary);
    root.style.setProperty("--sidebar-primary", primary);
  }
  if (secondary) root.style.setProperty("--secondary", secondary);
  // Language + direction
  const lang = s.interface_language ?? "en-US";
  root.setAttribute("lang", lang.split("-")[0]);
  root.setAttribute("dir", RTL_LANGS.includes(lang) ? "rtl" : "ltr");
};

interface Ctx { settings: PlatformSettings | null; loading: boolean; }
const PlatformSettingsContext = createContext<Ctx>({ settings: null, loading: true });

export const usePlatformSettings = () => useContext(PlatformSettingsContext);

export const PlatformSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // public_settings is a safe, public-readable mirror of platform_settings.
    // Reading it directly (instead of an RPC) lets us subscribe to realtime
    // changes so every visitor — signed-in or not — sees updates instantly.
    const load = async () => {
      const { data } = await supabase.from("public_settings").select("*").limit(1).maybeSingle();
      if (active && data) { setSettings(data); applyPlatformSettings(data); }
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`public_settings_global_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "public_settings" }, () => load())
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  return (
    <PlatformSettingsContext.Provider value={{ settings, loading }}>
      {children}
    </PlatformSettingsContext.Provider>
  );
};

export default PlatformSettingsProvider;
