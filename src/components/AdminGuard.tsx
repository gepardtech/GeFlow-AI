import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const [allowed, setAllowed] = useState<boolean | null>(cachedIsAdmin ? true : null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        cachedAdminUserId = null;
        cachedIsAdmin = false;
        if (active) navigate("/login", { replace: true });
        return;
      }

      // If user is already verified admin in memory, stay allowed
      if (cachedAdminUserId === user.id && cachedIsAdmin) {
        if (active) setAllowed(true);
        return;
      }

      const isAdminEmail = user.email?.toLowerCase() === "gepardwebs@gmail.com";
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");

      if (!active) return;

      const hasAdmin = isAdminEmail || (roles && roles.length > 0);
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
    })();
    return () => { active = false; };
  }, [navigate, toast]);

  if (allowed !== true) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Verifying access...
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminGuard;
