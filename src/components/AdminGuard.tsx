import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  children: ReactNode;
}

/**
 * Wraps every /admin/* page and enforces the admin role server-side.
 * Non-admins are redirected before any admin UI is rendered.
 */
const AdminGuard = ({ children }: Props) => {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (active) navigate("/login", { replace: true });
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");

      if (!active) return;

      if (!roles || roles.length === 0) {
        toast({ title: "Access denied", description: "You are not an admin.", variant: "destructive" });
        navigate("/dashboard", { replace: true });
        return;
      }
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
