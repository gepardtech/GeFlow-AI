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

    // Verify role of caller
    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isPlatformAdmin = Boolean(roleRow);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    const action = body?.action as string;

    // Team Member Creation by Workspace Owner (authenticated users)
    if (action === "createTeamMember") {
      const { email, password, full_name, role } = body;
      if (!email || !password || !full_name) {
        return json({ error: "Full name, email and password are required." }, 400);
      }

      // Restrict role to valid store-level roles only (NEVER admin)
      const allowedRoles = ["manager", "cashier", "inventory"];
      const cleanRole = allowedRoles.includes(role) ? role : "cashier";

      // 1. Create auth user with free plan
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: password.trim(),
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
          plan: "free",
          role: cleanRole,
          invited_by: userData.user.id,
        },
      });

      if (cErr) {
        // If user already exists in auth, find existing user
        return json({ error: cErr.message }, 400);
      }

      const targetUserId = created.user!.id;

      // 2. Ensure profile exists with plan = "free"
      await admin.from("profiles").upsert(
        {
          user_id: targetUserId,
          full_name: full_name.trim(),
          email: email.trim().toLowerCase(),
          plan: "free",
          status: "active",
        },
        { onConflict: "user_id" }
      );

      // 3. Insert or update support_team_members
      const { data: existSupport } = await admin
        .from("support_team_members")
        .select("id")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (existSupport) {
        await admin
          .from("support_team_members")
          .update({
            role: cleanRole,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existSupport.id);
      } else {
        await admin.from("support_team_members").insert({
          user_id: targetUserId,
          role: cleanRole,
          appointed_by_user_id: userData.user.id,
          is_active: true,
        });
      }

      // 4. Ensure user role is standard "user" (NEVER admin)
      const { data: existRole } = await admin
        .from("user_roles")
        .select("id")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (!existRole) {
        await admin.from("user_roles").insert({ user_id: targetUserId, role: "user" });
      }

      return json({ ok: true, user_id: targetUserId });
    }

    // Team Member Role Update
    if (action === "updateTeamMemberRole") {
      const { user_id, role, is_active } = body;
      if (!user_id) return json({ error: "user_id required" }, 400);

      const allowedRoles = ["manager", "cashier", "inventory"];
      const cleanRole = allowedRoles.includes(role) ? role : "cashier";

      const { data: existSupport } = await admin
        .from("support_team_members")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();

      if (existSupport) {
        await admin
          .from("support_team_members")
          .update({
            role: cleanRole,
            is_active: is_active !== false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existSupport.id);
      } else {
        await admin.from("support_team_members").insert({
          user_id,
          role: cleanRole,
          appointed_by_user_id: userData.user.id,
          is_active: is_active !== false,
        });
      }

      return json({ ok: true });
    }

    // All subsequent actions require Platform Super Admin
    if (!isPlatformAdmin) {
      return json({ error: "Platform Admin only" }, 403);
    }

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
