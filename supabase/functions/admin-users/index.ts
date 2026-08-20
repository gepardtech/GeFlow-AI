// Admin user management edge function
// Actions: create, delete, resetPassword
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

    // Identify caller using their JWT
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

    // Verify admin role
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

    if (action === "create") {
      const { email, password, full_name, plan } = body;
      if (!email || !password) return json({ error: "Email and password required" }, 400);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, plan: plan ?? "free" },
      });
      if (cErr) return json({ error: cErr.message }, 400);

      // Update profile plan in case trigger raced
      await admin
        .from("profiles")
        .update({ plan: plan ?? "free", full_name, email })
        .eq("user_id", created.user!.id);

      return json({ ok: true, user_id: created.user!.id });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id required" }, 400);
      // Cleanup app data first
      await admin.from("user_roles").delete().eq("user_id", user_id);
      await admin.from("profiles").delete().eq("user_id", user_id);
      const { error: dErr } = await admin.auth.admin.deleteUser(user_id);
      if (dErr) return json({ error: dErr.message }, 400);
      return json({ ok: true });
    }

    if (action === "resetPassword") {
      const { email, redirect_to } = body;
      if (!email) return json({ error: "email required" }, 400);
      const { error: rErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: redirect_to },
      });
      if (rErr) return json({ error: rErr.message }, 400);
      return json({ ok: true });
    }

    if (action === "setRole") {
      const { user_id, role } = body;
      if (!user_id || !["admin", "user"].includes(role)) return json({ error: "Invalid role" }, 400);
      await admin.from("user_roles").delete().eq("user_id", user_id);
      const { error: rErr } = await admin.from("user_roles").insert({ user_id, role });
      if (rErr) return json({ error: rErr.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
