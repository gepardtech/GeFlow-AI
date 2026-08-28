// Resilient Supabase client with graceful offline/placeholder fallback
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const RAW_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const RAW_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const isPlaceholder =
  !RAW_SUPABASE_URL ||
  RAW_SUPABASE_URL.includes("placeholder-project") ||
  RAW_SUPABASE_URL.includes("example.supabase.co");

const SUPABASE_URL = RAW_SUPABASE_URL || "https://placeholder-project.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = RAW_SUPABASE_KEY || "placeholder-anon-key";

/**
 * Resilient fetch wrapper that intercepts unreachable or placeholder Supabase network calls,
 * preventing unhandled 'TypeError: Failed to fetch' exceptions in browser environments.
 */
const safeSupabaseFetch: typeof fetch = async (input, init) => {
  const urlString = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);

  const makeMockResponse = (body: any, status = 200, extraHeaders: Record<string, string> = {}) => {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        "content-range": "0-0/0",
        ...extraHeaders,
      },
    });
  };

  if (isPlaceholder) {
    if (urlString.includes("/auth/v1/")) {
      return makeMockResponse({ user: null, session: null, message: "No active cloud session" });
    }
    if (urlString.includes("/functions/v1/currency-rates")) {
      return makeMockResponse({
        rates: {
          USD: 1,
          EUR: 0.92,
          GBP: 0.79,
          MAD: 10.05,
          EGP: 48.5,
          SAR: 3.75,
          AED: 3.67,
          CAD: 1.36,
          AUD: 1.52,
          JPY: 155.0,
        },
      });
    }
    // For general database queries (/rest/v1/*), return empty collection
    return makeMockResponse([]);
  }

  try {
    return await fetch(input, init);
  } catch (err: any) {
    console.warn("Supabase network request failed, applying graceful fallback:", urlString, err?.message);
    if (urlString.includes("/auth/v1/")) {
      return makeMockResponse({ user: null, session: null });
    }
    if (urlString.includes("/functions/v1/currency-rates")) {
      return makeMockResponse({
        rates: { USD: 1, EUR: 0.92, GBP: 0.79, MAD: 10.05, EGP: 48.5, SAR: 3.75, AED: 3.67 },
      });
    }
    return makeMockResponse([]);
  }
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: !isPlaceholder,
    detectSessionInUrl: false,
  },
  global: {
    fetch: safeSupabaseFetch,
  },
  realtime: {
    params: {
      eventsPerSecond: 5,
    },
  },
});
