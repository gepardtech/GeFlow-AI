import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Returns whether the current user has the admin role. */
export const useIsAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) { setIsAdmin(false); setLoading(false); } return; }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");
      if (active) { setIsAdmin((data?.length ?? 0) > 0); setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  return { isAdmin, loading };
};
