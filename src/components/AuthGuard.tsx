import { ReactNode, useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FullWorkspaceSkeleton } from "@/components/ui/PageSkeletons";

interface Props {
  children: ReactNode;
}

/**
 * Inspects localStorage for an existing, unexpired Supabase auth session.
 * Enables synchronous session detection so authenticated users never experience
 * loading delay or spinners when navigating to user panel / workspace pages.
 */
function getStoredSessionUser(): { id: string; email?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const keys = ["sb-jwdztevnodxoeyhcmrnf-auth-token", "sb-gvkvljxhufsrgyfsqrkc-auth-token", "supabase.auth.token"];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const session = parsed?.currentSession || parsed;
      const user = session?.user;
      const expiresAt = session?.expires_at;

      if (user?.id) {
        return { id: user.id, email: user.email };
      }
    }
  } catch {
    /* ignore parse error */
  }
  return null;
}

let cachedAuthUserId: string | null = getStoredSessionUser()?.id ?? null;

/**
 * Wraps every authenticated route (/dashboard/*, /setup/*) and enforces a
 * valid session. Unauthenticated visitors are reliably routed to /login.
 * Avoids infinite reload loops and eliminates infinite spinner hang.
 */
const AuthGuard = ({ children }: Props) => {
  const [checking, setChecking] = useState<boolean>(() => !(getStoredSessionUser()?.id || cachedAuthUserId));
  const [allowed, setAllowed] = useState<boolean>(() => Boolean(getStoredSessionUser()?.id || cachedAuthUserId));
  const navigate = useNavigate();
  const location = useLocation();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    let active = true;

    const redirectToLogin = () => {
      if (hasRedirectedRef.current || !active) return;
      hasRedirectedRef.current = true;
      cachedAuthUserId = null;
      setAllowed(false);
      setChecking(false);

      // Retain tokens so background refresh can recover the session
      // Do not delete localStorage tokens here!

      // Do not redirect if already on login page
      if (location.pathname === "/login") return;

      const destination =
        location.pathname.startsWith("/auth/") || location.pathname === "/login"
          ? "/dashboard"
          : location.pathname;

      navigate(`/login?redirect=${encodeURIComponent(destination)}`, { replace: true });
    };

    // If verified active session in storage, grant access immediately
    const stored = getStoredSessionUser();
    if (stored?.id) {
      cachedAuthUserId = stored.id;
      setAllowed(true);
      setChecking(false);
    }

    // Safety fallback: if no stored user and session resolution hangs over 3.5s, route to login
    const safetyTimer = setTimeout(() => {
      if (active && !cachedAuthUserId && !getStoredSessionUser()) {
        redirectToLogin();
      }
    }, 3500);

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        redirectToLogin();
      } else if (session?.user) {
        cachedAuthUserId = session.user.id;
        setAllowed(true);
        setChecking(false);
      }
    });

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        if (session?.user) {
          cachedAuthUserId = session.user.id;
          setAllowed(true);
          setChecking(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!active) return;
        if (user) {
          cachedAuthUserId = user.id;
          setAllowed(true);
          setChecking(false);
          return;
        }

        // Definitely unauthenticated
        redirectToLogin();
      } catch {
        if (!active) return;
        if (!getStoredSessionUser()) {
          redirectToLogin();
        }
      }
    })();

    return () => {
      active = false;
      clearTimeout(safetyTimer);
      sub.subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  if (checking || !allowed) {
    return <FullWorkspaceSkeleton title="Loading workspace session..." />;
  }

  return <>{children}</>;
};

export default AuthGuard;

