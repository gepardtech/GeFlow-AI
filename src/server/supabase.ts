import { createClient, SupabaseClient } from "@supabase/supabase-js";

const PROJECT_URL = "https://gvkvljxhufsrgyfsqrkc.supabase.co";

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2a3ZsanhodWZzcmd5ZnNxcmtjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU5MDM0MywiZXhwIjoyMDk2MTY2MzQzfQ.LEwFjg1t256dibB7MaWlm3fnL6g6NCD7D-BceawDTLA";

    const ANON_KEY =
      process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2a3ZsanhodWZzcmd5ZnNxcmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTAzNDMsImV4cCI6MjA5NjE2NjM0M30.sef1DVX7ysCEXrNlptxJbht-RvsHxxVze6Op5o95NbE";

          export const serverSupabase: SupabaseClient = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
            });

            export const bgSupabase: SupabaseClient = createClient(PROJECT_URL, ANON_KEY, {
              auth: { persistSession: false, autoRefreshToken: false },
              });

              export async function verifyUserToken(token: string) {
                if (!token) return null;
                  const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
                    if (!cleanToken) return null;

                      try {
                          const { data, error } = await serverSupabase.auth.getUser(cleanToken);
                              if (!error && data?.user) return data.user;
                                } catch {}

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
                                                                                                                          } catch {}

                                                                                                                            return null;
                                                                                                                            }