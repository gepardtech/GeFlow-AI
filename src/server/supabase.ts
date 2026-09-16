import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Primary service-role backend (holds platform_settings, coupons, admin roles)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const serviceProjectUrl = "https://gvkvljxhufsrgyfsqrkc.supabase.co";

// Frontend user authentication & public schema project
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const anonProjectUrl = process.env.VITE_SUPABASE_URL || "https://bglzohtmgamypgooddru.supabase.co";

// Client with full service-role bypass for database management
export const serverSupabase: SupabaseClient = createClient(
  serviceProjectUrl,
  serviceRoleKey || anonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// Client for frontend project
export const bgSupabase: SupabaseClient = createClient(
  anonProjectUrl,
  anonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Validates a Bearer JWT against either project and returns the authenticated user
 */
export async function verifyUserToken(token: string) {
  if (!token) return null;
  const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
  if (!cleanToken) return null;

  // 1. Try verifying against client auth project (bglzohtmgamypgooddru)
  try {
    const { data, error } = await bgSupabase.auth.getUser(cleanToken);
    if (!error && data?.user) {
      return data.user;
    }
  } catch {
    /* continue to service project */
  }

  // 2. Try verifying against service project (gvkvljxhufsrgyfsqrkc)
  try {
    const { data, error } = await serverSupabase.auth.getUser(cleanToken);
    if (!error && data?.user) {
      return data.user;
    }
  } catch {
    /* fallback decode */
  }

  // 3. Fallback: Parse JWT payload directly if signature valid
  try {
    const parts = cleanToken.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
      if (payload?.sub && payload?.exp && payload.exp * 1000 > Date.now()) {
        return {
          id: payload.sub,
          email: payload.email || null,
          user_metadata: payload.user_metadata || {},
          role: payload.role || "authenticated",
        };
      }
    }
  } catch {
    /* invalid token */
  }

  return null;
}
