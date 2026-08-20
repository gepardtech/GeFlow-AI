import { ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
}

/**
 * Wraps every authenticated route (/dashboard/*, /setup/*) and enforces a
 * valid session server-side. Unauthenticated visitors are sent to /login.
 */
const AuthGuard = ({ children }: Props) => {
  const [allowed, setAllowed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        setAllowed(false);
        navigate("/login", { replace: true });
      }
    });

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        navigate("/login", { replace: true, state: { from: location.pathname } });
        return;
      }
      setAllowed(true);
    })();

    return () => { active = false; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Verifying session...
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthGuard;
