/**
 * Centralized Application URL & Auth Redirection System
 * 
 * Provides a single canonical source of truth for application URLs across all environments:
 * - Production (Hostinger, Vercel, AWS, custom domain, etc.)
 * - Staging / Preview
 * - Development (localhost / container preview)
 * 
 * Ensures authentication emails (Confirmation, Password Reset, Magic Link, Invitations)
 * dynamically route to the active deployment domain rather than being permanently tied
 * to any specific IDE or build environment.
 */

/**
 * Returns the canonical base URL of the active application.
 * Priority order:
 * 1. Explicit environment variable: VITE_APP_URL or VITE_PUBLIC_APP_URL
 * 2. Active browser window origin (when running in client)
 * 3. Fallback default
 */
export function getAppUrl(): string {
  // Check explicit environment variables first
  const envUrl = (
    import.meta.env.VITE_APP_URL ||
    import.meta.env.VITE_PUBLIC_APP_URL ||
    ""
  ).trim();

  if (envUrl) {
    // Strip trailing slash if present
    return envUrl.replace(/\/+$/, "");
  }

  // If in a browser environment, use current window origin
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  // Safe universal fallback (production canonical domain)
  return "https://geflowai.com";
}

/**
 * Generates an absolute auth redirection URL for a specific application path.
 *
 * @param path - Relative path (e.g. "/auth/callback", "/reset-password")
 * @returns Fully-qualified URL (e.g. "https://example.com/auth/callback")
 */
export function getAuthRedirectUrl(path: string = "/auth/callback"): string {
  const baseUrl = getAppUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

/**
 * Convenience helper for the Supabase Auth Callback endpoint
 */
export function getAuthCallbackUrl(extraParams?: Record<string, string>): string {
  const base = getAuthRedirectUrl("/auth/callback");
  if (!extraParams || Object.keys(extraParams).length === 0) {
    return base;
  }
  const params = new URLSearchParams(extraParams);
  return `${base}?${params.toString()}`;
}

/**
 * Convenience helper for the Password Reset endpoint
 */
export function getPasswordResetRedirectUrl(): string {
  return getAuthRedirectUrl("/reset-password");
}

/**
 * Convenience helper for the Login endpoint
 */
export function getLoginRedirectUrl(): string {
  return getAuthRedirectUrl("/login");
}

/**
 * Validates a target redirect path/URL to prevent Open Redirect vulnerabilities.
 * Only allows safe internal relative paths or URLs matching the trusted application origin.
 *
 * @param target - The untrusted target path/URL provided in query parameters
 * @param fallback - Safe default fallback path if invalid (defaults to "/dashboard")
 * @returns Sanitized safe relative or absolute route path
 */
export function validateRedirectPath(target?: string | null, fallback: string = "/dashboard"): string {
  if (!target || typeof target !== "string") {
    return fallback;
  }

  const trimmed = target.trim();

  // Allow relative paths (e.g. "/dashboard", "/setup/business"), but reject protocol-relative (e.g. "//evil.com")
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    // Disallow javascript:, vbscript:, or data: in path queries
    const lower = trimmed.toLowerCase();
    if (lower.includes("javascript:") || lower.includes("data:") || lower.includes("vbscript:")) {
      return fallback;
    }
    return trimmed;
  }

  // Check if target is a full URL matching our trusted app origin
  try {
    const parsed = new URL(trimmed);
    const appOrigin = new URL(getAppUrl()).origin;
    if (parsed.origin === appOrigin) {
      return parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    // Malformed URL, fall through to fallback
  }

  return fallback;
}

/**
 * Configuration helper that exports all recommended Supabase Redirect URLs
 * for copying into Supabase Dashboard -> Authentication -> URL Configuration.
 */
export function getRecommendedSupabaseRedirectUrls(customDomain?: string): string[] {
  const base = customDomain ? customDomain.replace(/\/+$/, "") : getAppUrl();
  return [
    `${base}/*`,
    `${base}/auth/callback`,
    `${base}/auth/confirm`,
    `${base}/reset-password`,
    `${base}/update-password`,
    `${base}/login`,
    `${base}/setup/business`,
    `${base}/dashboard`,
  ];
}
