import { supabase } from "@/integrations/supabase/client";

export type EmailTemplateConfigMap = Record<string, Record<string, unknown>>;

/**
 * Load all email template custom configs from Supabase.
 * Table: public.email_template_configs
 */
export async function fetchEmailTemplateConfigs(): Promise<EmailTemplateConfigMap> {
  try {
    const { data, error } = await supabase
      .from("email_template_configs")
      .select("template_id, config");

    if (error) {
      console.error("email_template_configs fetch failed:", error.message);
      return {};
    }

    const map: EmailTemplateConfigMap = {};
    for (const row of data || []) {
      if (row.template_id && row.config && typeof row.config === "object") {
        map[row.template_id] = row.config as Record<string, unknown>;
      }
    }
    return map;
  } catch (err) {
    console.error("fetchEmailTemplateConfigs exception:", err);
    return {};
  }
}

/**
 * Upsert one template config to Supabase.
 */
export async function saveEmailTemplateConfig(
  templateId: string,
  config: Record<string, unknown>
): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("email_template_configs").upsert(
      {
        template_id: templateId,
        config,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      },
      { onConflict: "template_id" }
    );

    if (error) {
      console.error("email_template_configs upsert failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("saveEmailTemplateConfig exception:", err);
    return false;
  }
}

/**
 * Upsert full config map (all templates).
 */
export async function saveAllEmailTemplateConfigs(
  configs: EmailTemplateConfigMap
): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const rows = Object.entries(configs).map(([template_id, config]) => ({
      template_id,
      config,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    }));

    if (rows.length === 0) return true;

    const { error } = await supabase
      .from("email_template_configs")
      .upsert(rows, { onConflict: "template_id" });

    if (error) {
      console.error("email_template_configs bulk upsert failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("saveAllEmailTemplateConfigs exception:", err);
    return false;
  }
}