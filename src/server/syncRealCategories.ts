import { serverSupabase } from "./supabase";
import { REAL_BUSINESS_CATEGORIES, REAL_PRODUCT_CATEGORIES } from "./categoriesData";

export async function syncRealCategoriesToDatabase() {
  console.log("Starting synchronization of 29 Business Categories and 96 Product Categories...");

  // 1. Clean up known fake / test categories
  await serverSupabase.from("business_categories").delete().ilike("name", "%Trace Test%");
  await serverSupabase.from("product_categories").delete().ilike("name", "%test%add%");

  // 2. Sync 29 Business Categories
  const adminId = "a375b057-debe-4239-9549-9f83b5557df2";
  const { data: existingBizCats } = await serverSupabase
    .from("business_categories")
    .select("id, name");

  const bizNameMap = new Map<string, string>();
  (existingBizCats || []).forEach((c) => {
    bizNameMap.set(c.name.trim().toLowerCase(), c.id);
  });

  for (const bc of REAL_BUSINESS_CATEGORIES) {
    const key = bc.name.trim().toLowerCase();
    const existingId = bizNameMap.get(key);

    const rowPayload = {
      name: bc.name,
      industry_type: bc.industry_type,
      currency: bc.currency,
      default_tax: bc.default_tax,
      stock_alert_limit: bc.stock_alert_limit,
      enabled_modules: bc.enabled_modules,
      status: "active",
      created_by_user_id: adminId,
      updated_at: new Date().toISOString(),
    };

    if (existingId) {
      await serverSupabase.from("business_categories").update(rowPayload).eq("id", existingId);
    } else {
      const { data: inserted } = await serverSupabase
        .from("business_categories")
        .insert(rowPayload)
        .select("id")
        .maybeSingle();
      if (inserted?.id) {
        bizNameMap.set(key, inserted.id);
      }
    }
  }

  // 3. Sync 96 Product Categories
  const { data: existingProdCats } = await serverSupabase
    .from("product_categories")
    .select("id, name, slug");

  const prodNameMap = new Map<string, string>();
  (existingProdCats || []).forEach((c) => {
    prodNameMap.set(c.name.trim().toLowerCase(), c.id);
  });

  // First pass: upsert all without parent_id
  for (const pc of REAL_PRODUCT_CATEGORIES) {
    const key = pc.name.trim().toLowerCase();
    const existingId = prodNameMap.get(key);

    const rowPayload = {
      name: pc.name,
      slug: pc.slug,
      industry_assignments: pc.industry_assignments,
      inherit_expiry: Boolean(pc.inherit_expiry),
      inherit_batch: Boolean(pc.inherit_batch),
      inherit_barcode: Boolean(pc.inherit_barcode),
      inherit_alerts: Boolean(pc.inherit_alerts),
      status: "active",
      created_by_user_id: adminId,
      updated_at: new Date().toISOString(),
    };

    if (existingId) {
      await serverSupabase.from("product_categories").update(rowPayload).eq("id", existingId);
    } else {
      const { data: inserted } = await serverSupabase
        .from("product_categories")
        .insert(rowPayload)
        .select("id")
        .maybeSingle();
      if (inserted?.id) {
        prodNameMap.set(key, inserted.id);
      }
    }
  }

  // Second pass: wire up parent_id
  for (const pc of REAL_PRODUCT_CATEGORIES) {
    if (pc.parent_name) {
      const childId = prodNameMap.get(pc.name.trim().toLowerCase());
      const parentId = prodNameMap.get(pc.parent_name.trim().toLowerCase());
      if (childId && parentId) {
        await serverSupabase
          .from("product_categories")
          .update({ parent_id: parentId })
          .eq("id", childId);
      }
    }
  }

  const [{ count: bCount }, { count: pCount }] = await Promise.all([
    serverSupabase.from("business_categories").select("id", { count: "exact", head: true }),
    serverSupabase.from("product_categories").select("id", { count: "exact", head: true }),
  ]);

  console.log(`Sync complete! Current database counts: ${bCount} business categories, ${pCount} product categories.`);
  return { businessCategories: bCount, productCategories: pCount };
}

if (process.argv[1]?.includes("syncRealCategories")) {
  syncRealCategoriesToDatabase()
    .then((res) => {
      console.log("Success:", res);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Sync error:", err);
      process.exit(1);
    });
}
