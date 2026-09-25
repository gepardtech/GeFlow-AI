import { supabase } from "@/integrations/supabase/client";

export type EmailTemplateConfigMap = Record<string, Record<string, unknown>>;

const STORAGE_KEY = "pos_email_template_configs";

function getLocalConfigs(): EmailTemplateConfigMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

function setLocalConfigs(configs: EmailTemplateConfigMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch {
    /* ignore */
  }
}

/**
 * Load all email template custom configs.
 * Primary: /api/admin/email-template-configs (persisted in platform_settings.alerts.email_template_configs)
 * Fallback: supabase query or localStorage
 */
export async function fetchEmailTemplateConfigs(): Promise<EmailTemplateConfigMap> {
  const local = getLocalConfigs();

  // 1. Primary: Server endpoint (fast, elevated, schema-independent)
  try {
    const res = await fetch("/api/admin/email-template-configs");
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.configs && typeof data.configs === "object") {
        setLocalConfigs(data.configs);
        return data.configs as EmailTemplateConfigMap;
      }
    }
  } catch {
    /* continue to fallback */
  }

  // 2. Secondary: Supabase platform_settings alerts
  try {
    const { data: psRow } = await supabase
      .from("platform_settings")
      .select("alerts")
      .limit(1)
      .maybeSingle();

    const fromAlerts = (psRow?.alerts as any)?.email_template_configs;
    if (fromAlerts && typeof fromAlerts === "object" && Object.keys(fromAlerts).length > 0) {
      setLocalConfigs(fromAlerts);
      return fromAlerts as EmailTemplateConfigMap;
    }
  } catch {
    /* continue to fallback */
  }

  // 3. Fallback: LocalStorage
  return local;
}

/**
 * Upsert one template config.
 */
export async function saveEmailTemplateConfig(
  templateId: string,
  config: Record<string, unknown>
): Promise<boolean> {
  // Update local storage immediately for responsive UI
  const local = getLocalConfigs();
  local[templateId] = config;
  setLocalConfigs(local);

  // 1. Primary: Server endpoint
  try {
    const res = await fetch("/api/admin/email-template-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_id: templateId, config }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.success) return true;
    }
  } catch (err) {
    console.warn("Notice: server endpoint save failed, falling back:", err);
  }

  // 2. Secondary: Supabase platform_settings alerts
  try {
    const { data: row } = await supabase
      .from("platform_settings")
      .select("id, alerts")
      .limit(1)
      .maybeSingle();

    if (row?.id) {
      const alerts = row.alerts && typeof row.alerts === "object" ? { ...(row.alerts as any) } : {};
      alerts.email_template_configs = {
        ...(alerts.email_template_configs || {}),
        [templateId]: config,
      };
      await supabase
        .from("platform_settings")
        .update({ alerts, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      return true;
    }
  } catch {
    /* fallback to true since local storage is already updated */
  }

  return true;
}

/**
 * Upsert full config map (all templates).
 */
export async function saveAllEmailTemplateConfigs(
  configs: EmailTemplateConfigMap
): Promise<boolean> {
  // Update local storage immediately
  const local = { ...getLocalConfigs(), ...configs };
  setLocalConfigs(local);

  // 1. Primary: Server endpoint
  try {
    const res = await fetch("/api/admin/email-template-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configs }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.success) return true;
    }
  } catch (err) {
    console.warn("Notice: server endpoint bulk save failed, falling back:", err);
  }

  // 2. Secondary: Supabase platform_settings alerts
  try {
    const { data: row } = await supabase
      .from("platform_settings")
      .select("id, alerts")
      .limit(1)
      .maybeSingle();

    if (row?.id) {
      const alerts = row.alerts && typeof row.alerts === "object" ? { ...(row.alerts as any) } : {};
      alerts.email_template_configs = {
        ...(alerts.email_template_configs || {}),
        ...configs,
      };
      await supabase
        .from("platform_settings")
        .update({ alerts, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      return true;
    }
  } catch {
    /* ignore */
  }

  return true;
}
