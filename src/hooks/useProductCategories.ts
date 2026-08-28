import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProductCategory {
  id: string;
  name: string;
  parent_id: string | null;
  industry_assignments: string[];
  inherit_expiry: boolean;
  inherit_batch: boolean;
  inherit_barcode: boolean;
  inherit_alerts: boolean;
  status: string;
}

const relates = (a: string, b: string | null) => {
  if (!b) return false;
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x === y || x.includes(y) || y.includes(x);
};

/**
 * Loads admin-created product categories and filters them to only those
 * appointed to the active business's category (industry). Returns parent
 * categories and a helper to resolve subcategories for a parent.
 */
export const useProductCategories = (industryType: string | null, categoryName: string | null) => {
  const [all, setAll] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("product_categories")
        .select("id, name, parent_id, industry_assignments, inherit_expiry, inherit_batch, inherit_barcode, inherit_alerts, status")
        .eq("status", "active")
        .order("name");
      setAll((data as ProductCategory[]) ?? []);
    } catch (err) {
      console.warn("Failed to load product categories:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Categories appointed to this business's industry.
  const relevant = all.filter((c) =>
    (c.industry_assignments ?? []).some((a) => relates(a, industryType) || relates(a, categoryName)),
  );

  const parents = relevant.filter((c) => !c.parent_id);
  const subcategoriesOf = (parentId: string | null) =>
    parentId ? all.filter((c) => c.parent_id === parentId) : [];

  return { all, parents, subcategoriesOf, relevant, loading, reload: load };
};
