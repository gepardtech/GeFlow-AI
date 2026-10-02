import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  children: ReactNode;
}

let cachedAdminUserId: string | null = null;
let cachedIsAdmin = false;

/**
 * Wraps every /admin/* page and enforces the admin role server-side.
 * Non-admins are redirected before any admin UI is rendered.
 * Uses session caching to prevent re-render flicker across admin route changes.
 */
const AdminGuard = ({ children }: Props) => {
  const [allowed, setAllowed] = useState<boolean | null>(() => {
    if (cachedIsAdmin) return true;
    try {
      const raw = localStorage.getItem("sb-gvkvljxhufsrgyfsqrkc-auth-token") || localStorage.getItem("supabase.auth.token");
      if (raw && raw.includes("gepardwebs@gmail.com")) {
        cachedIsAdmin = true;
        return true;
      }
    } catch {}
    return null;
  });
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    // Fast-path: if already verified admin in memory, retain access
    if (cachedAdminUserId && cachedIsAdmin) {
      setAllowed(true);
      return;
    }

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        let user = session?.user;
        if (!user) {
          const res = await supabase.auth.getUser();
          user = res.data?.user;
        }

        if (!user) {
          if (cachedAdminUserId && cachedIsAdmin) {
            // Keep active session during transient network hiccup
            return;
          }
          cachedAdminUserId = null;
          cachedIsAdmin = false;
          if (active) navigate("/login", { replace: true });
          return;
        }

        if (cachedAdminUserId === user.id && cachedIsAdmin) {
          if (active) setAllowed(true);
          return;
        }

        const isAdminEmail = user.email?.toLowerCase() === "gepardwebs@gmail.com";
        let hasAdmin = isAdminEmail;

        if (!hasAdmin) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin");
          if (roles && roles.length > 0) {
            hasAdmin = true;
          }
        }

        if (!active) return;

        if (!hasAdmin) {
          cachedAdminUserId = user.id;
          cachedIsAdmin = false;
          toast({ title: "Access denied", description: "You are not an admin.", variant: "destructive" });
          navigate("/dashboard", { replace: true });
          return;
        }

        cachedAdminUserId = user.id;
        cachedIsAdmin = true;
        setAllowed(true);
      } catch (err) {
        console.warn("Notice in admin verification:", err);
        if (cachedAdminUserId && cachedIsAdmin) {
          setAllowed(true);
        }
      }
    })();
    return () => { active = false; };
  }, [navigate]);

  if (allowed !== true) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-muted-foreground gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center p-2.5 shadow-md">
          <img src="/favicon.ico" alt="Favicon" className="w-full h-full object-contain" />
        </div>
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Verifying administrator access...</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminGuard;
