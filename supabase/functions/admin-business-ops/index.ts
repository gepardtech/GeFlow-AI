// Admin business operations edge function.
// Actions: stats, suspend (delete business + all data), reset (wipe operational data).
// Only callable by users with the 'admin' role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const num = (n: unknown) => Number(n ?? 0) || 0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Admin only" }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    const action = body?.action as string;
    const businessId = body?.businessId as string;
    if (!businessId) return json({ error: "businessId required" }, 400);

    if (action === "stats") {
      const [{ data: biz }, live, total, { data: sales }] = await Promise.all([
        admin.from("businesses").select("usage, last_active, created_at").eq("id", businessId).maybeSingle(),
        admin.from("products").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "active"),
        admin.from("products").select("id", { count: "exact", head: true }).eq("business_id", businessId),
        admin.from("sales").select("total, status").eq("business_id", businessId),
      ]);
      const earning = (sales ?? [])
        .filter((s: any) => s.status !== "voided")
        .reduce((acc: number, s: any) => acc + num(s.total), 0);
      return json({
        liveProducts: live.count ?? 0,
        totalProducts: total.count ?? 0,
        totalEarning: +earning.toFixed(2),
        aiUsage: num(biz?.usage),
        lastActivity: biz?.last_active ?? biz?.created_at ?? null,
      });
    }

    if (action === "suspend") {
      // Full teardown: CASCADE removes products, sales, purchases, stock, line items.
      const { error } = await admin.from("businesses").delete().eq("id", businessId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "reset") {
      // Wipe all operational data but keep the business registration + billing.
      await admin.from("sales").delete().eq("business_id", businessId);
      await admin.from("purchases").delete().eq("business_id", businessId);
      await admin.from("products").delete().eq("business_id", businessId);
      await admin.from("stock_movements").delete().eq("business_id", businessId);
      const { error } = await admin
        .from("businesses")
        .update({ listed_products: 0, usage: 0 })
        .eq("id", businessId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("admin-business-ops error:", String(err));
    return json({ error: "Unexpected error" }, 500);
  }
});
