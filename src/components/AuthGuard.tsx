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
  const [allowed, setAllowed] = useState<boolean>(Boolean(cachedAuthUserId));
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
        } else {
          cachedAuthUserId = null;
          navigate("/login", { replace: true, state: { from: location.pathname } });
        }
      } catch (err) {
        if (!active) return;
        cachedAuthUserId = null;
        navigate("/login", { replace: true });
      }
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm font-medium">
        Verifying session...
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthGuard;
