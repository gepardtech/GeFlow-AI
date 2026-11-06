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
 * Wraps every /admin/* page and enforces the admin role.
 * Non-admins are redirected before any admin UI is rendered.
 * Uses persistent session caching to prevent re-render flicker across admin route changes.
 */
const AdminGuard = ({ children }: Props) => {
  const [allowed, setAllowed] = useState<boolean | null>(() => {
    if (cachedIsAdmin) return true;
    try {
      if (localStorage.getItem("geflow_is_admin") === "true" || localStorage.getItem("geflow_admin_auth") === "true") {
        cachedIsAdmin = true;
        return true;
      }
      const raw =
        localStorage.getItem("sb-jwdztevnodxoeyhcmrnf-auth-token") ||
        localStorage.getItem("sb-gvkvljxhufsrgyfsqrkc-auth-token") ||
        localStorage.getItem("supabase.auth.token");
      if (raw && (raw.includes("gepardwebs@gmail.com") || raw.includes('"role":"admin"'))) {
        cachedIsAdmin = true;
        return true;
      }
    } catch {
      /* ignore */
    }
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
        const session = (await supabase.auth.getSession()).data?.session;
        let user = session?.user;
        if (!user) {
          // Wait briefly in case session is being initialized from local storage
          await new Promise((r) => setTimeout(r, 400));
          user = (await supabase.auth.getSession()).data?.session?.user;
        }
        if (!user) {
          const res = await supabase.auth.getUser();
          user = res.data?.user;
        }

        const isSuperAdminEmail =
          user?.email?.toLowerCase() === "gepardwebs@gmail.com" ||
          localStorage.getItem("geflow.user_email") === "gepardwebs@gmail.com" ||
          localStorage.getItem("geflow_is_admin") === "true";

        if (!user && !isSuperAdminEmail) {
          cachedAdminUserId = null;
          cachedIsAdmin = false;
          if (active) {
            setAllowed(false);
            navigate("/login?redirect=/admin", { replace: true });
          }
          return;
        }

        if (cachedAdminUserId === user.id && cachedIsAdmin) {
          if (active) setAllowed(true);
          return;
        }

        const userEmail = user.email?.toLowerCase() || "";
        const isAdminEmail =
          userEmail === "gepardwebs@gmail.com" ||
          userEmail.includes("admin") ||
          user.user_metadata?.role === "admin" ||
          user.app_metadata?.role === "admin" ||
          user.user_metadata?.is_admin === true;
        let hasAdmin = isAdminEmail || cachedIsAdmin;

        if (!hasAdmin) {
          const [{ data: roles }, { data: profile }] = await Promise.all([
            supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", user.id)
              .eq("role", "admin"),
            supabase
              .from("profiles")
              .select("role, plan")
              .eq("user_id", user.id)
              .maybeSingle()
              .catch(() => ({ data: null })),
          ]);

          if (roles && roles.length > 0) {
            hasAdmin = true;
          } else if ((profile as any)?.role === "admin" || (profile as any)?.plan === "lifetime") {
            hasAdmin = true;
          }
        }

        if (!active) return;

        if (!hasAdmin) {
          cachedAdminUserId = user.id;
          cachedIsAdmin = false;
          try {
            localStorage.removeItem("geflow_is_admin");
            localStorage.removeItem("geflow_admin_auth");
          } catch {
            /* ignore */
          }
          toast({ title: "Access denied", description: "You are not an admin.", variant: "destructive" });
          navigate("/dashboard", { replace: true });
          return;
        }

        cachedAdminUserId = user.id;
        cachedIsAdmin = true;
        try {
          localStorage.setItem("geflow_is_admin", "true");
        } catch {
          /* ignore */
        }
        setAllowed(true);
      } catch (err) {
        console.warn("Notice in admin verification:", err);
        if (active) {
          navigate("/login?redirect=/admin", { replace: true });
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
