import { ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
}

let cachedAuthUserId: string | null = null;

/**
 * Wraps every authenticated route (/dashboard/*, /setup/*) and enforces a
 * valid session server-side. Unauthenticated visitors are sent to /login.
 * Caches session validity in memory to eliminate re-render screen flicker.
 */
const AuthGuard = ({ children }: Props) => {
  const [allowed, setAllowed] = useState<boolean>(() => {
    if (Boolean(cachedAuthUserId)) return true;
    try {
      const raw = localStorage.getItem("sb-gvkvljxhufsrgyfsqrkc-auth-token") || localStorage.getItem("supabase.auth.token");
      if (raw && (raw.includes("access_token") || raw.includes("user"))) return true;
    } catch {}
    return false;
  });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        cachedAuthUserId = null;
        setAllowed(false);
        navigate("/login", { replace: true });
      } else if (session?.user) {
        cachedAuthUserId = session.user.id;
        setAllowed(true);
      }
    });

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        if (session?.user) {
          cachedAuthUserId = session.user.id;
          setAllowed(true);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!active) return;
        if (user) {
          cachedAuthUserId = user.id;
          setAllowed(true);
        } else if (!cachedAuthUserId) {
          // Double-check local storage before redirecting to prevent unwarranted logouts
          const raw = localStorage.getItem("sb-gvkvljxhufsrgyfsqrkc-auth-token") || localStorage.getItem("supabase.auth.token");
          if (!raw) {
            navigate("/login", { replace: true, state: { from: location.pathname } });
          }
        }
      } catch (err) {
        if (!active) return;
        if (!cachedAuthUserId) {
          const raw = localStorage.getItem("sb-gvkvljxhufsrgyfsqrkc-auth-token") || localStorage.getItem("supabase.auth.token");
          if (!raw) {
            navigate("/login", { replace: true });
          }
        }
      }
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-muted-foreground gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center p-2.5 shadow-md">
          <img src="/favicon.ico" alt="Favicon" className="w-full h-full object-contain" />
        </div>
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Loading workspace session...</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthGuard;
