import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ChatMsg = { role: "user" | "assistant"; content: string };

const MODE_PROMPTS: Record<string, string> = {
  analyst:
    "You are in ANALYST MODE. Focus on business analysis: sales trends, profit analysis, inventory valuation, best/slow sellers, weak points, gross and net margins, and performance forecasts. Back every claim strictly with the verified numbers from the business context.",
  operator:
    "You are in OPERATOR MODE. Focus on getting things done: drafting purchase orders, summarising data for exports/reports, writing supplier/customer messages and outlining automations. Be concrete, crisp, and action-oriented.",
  knowledge:
    "You are in KNOWLEDGE MODE. Focus on teaching the owner how to use GeFlow features (Inventory, POS, Purchases, Reports, Businesses, Settings, Tax, Currency). Give clear step-by-step guidance.",
  advisor:
    "You are in ADVISOR MODE. Focus on strategic recommendations: cost & inventory optimisation, growth opportunities, reorder thresholds, risk alerts and smart suggestions. Be proactive and specific.",
};

const num = (n: unknown) => Number(n ?? 0) || 0;

async function buildContext(supabase: any, businessId: string) {
  if (!businessId) return "No business selected. Ask the user to select a business first.";

  const { data: biz } = await supabase
    .from("businesses")
    .select("id, business_name, currency, base_currency, default_tax, stock_alert_limit, status, category_id")
    .eq("id", businessId)
    .maybeSingle();

  if (!biz) return "Business not found or not accessible.";

  // Fetch Category info if available
  let categoryName = "General Commerce";
  if (biz.category_id) {
    const { data: cat } = await supabase
      .from("business_categories")
      .select("name, industry_type, currency, default_tax, stock_alert_limit")
      .eq("id", biz.category_id)
      .maybeSingle();
    if (cat?.name) categoryName = cat.name;
  }

  const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const [{ data: products }, { data: sales }, { data: saleItems }] = await Promise.all([
    supabase
      .from("products")
      .select("name, stock_units, min_stock_alert, retail_price, discount_price, purchase_cost, expiry_date, status")
      .eq("business_id", businessId),
    supabase
      .from("sales")
      .select("total, profit, created_at, status")
      .eq("business_id", businessId)
      .gte("created_at", since),
    supabase
      .from("sale_items")
      .select("product_name, quantity, unit_price, unit_cost")
      .limit(150),
  ]);

  const prods = products ?? [];
  const active = prods.filter((p: any) => p.status === "active");
  const fallbackAlert = num(biz.stock_alert_limit) || 10;
  const outOfStock = active.filter((p: any) => num(p.stock_units) <= 0);
  const lowStock = active.filter((p: any) => {
    const u = num(p.stock_units);
    const alert = num(p.min_stock_alert) > 0 ? num(p.min_stock_alert) : fallbackAlert;
    return u > 0 && u <= alert;
  });

  const now = Date.now();
  const in30Days = now + 30 * 24 * 3600 * 1000;
  const expiring = active.filter((p: any) => {
    if (!p.expiry_date) return false;
    const t = new Date(p.expiry_date).getTime();
    return t >= now && t <= in30Days;
  });

  const stockValue = active.reduce((s: number, p: any) => s + num(p.stock_units) * num(p.purchase_cost), 0);
  const retailValue = active.reduce((s: number, p: any) => s + num(p.stock_units) * num(p.discount_price ?? p.retail_price), 0);

  const dayAgo = now - 24 * 3600 * 1000;
  const weekAgo = now - 7 * 24 * 3600 * 1000;
  const monthAgo = now - 30 * 24 * 3600 * 1000;
  const salesList = (sales ?? []).filter((s: any) => s.status === "completed" || s.status !== "voided");
  const sum = (arr: any[], k: string) => arr.reduce((a: number, x: any) => a + num(x[k]), 0);
  const inRange = (from: number) => salesList.filter((s: any) => new Date(s.created_at).getTime() >= from);

  // Top products from sale items
  const itemMap: Record<string, { units: number; revenue: number }> = {};
  (saleItems ?? []).forEach((it: any) => {
    const n = it.product_name || "Unknown";
    const q = num(it.quantity) || 1;
    const p = num(it.unit_price) || 0;
    if (!itemMap[n]) itemMap[n] = { units: 0, revenue: 0 };
    itemMap[n].units += q;
    itemMap[n].revenue += p * q;
  });
  const topSellers = Object.entries(itemMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  const todayList = inRange(dayAgo);
  const weekList = inRange(weekAgo);
  const monthList = inRange(monthAgo);

  const monthRev = sum(monthList, "total");
  const monthProf = sum(monthList, "profit");
  const netMargin = monthRev > 0 ? (monthProf / monthRev) * 100 : 0;

  const ctx = {
    business: {
      name: biz.business_name,
      currency: biz.currency || biz.base_currency || "USD",
      tax_percent: biz.default_tax ?? 0,
      stock_alert_threshold: fallbackAlert,
      category: categoryName,
      status: biz.status,
    },
    inventory: {
      active_products_count: active.length,
      out_of_stock_count: outOfStock.length,
      low_stock_count: lowStock.length,
      expiring_soon_count: expiring.length,
      inventory_cost_value: +stockValue.toFixed(2),
      inventory_retail_value: +retailValue.toFixed(2),
      out_of_stock_items: outOfStock.slice(0, 15).map((p: any) => p.name),
      low_stock_items: lowStock.slice(0, 15).map((p: any) => ({
        name: p.name,
        units: num(p.stock_units),
        alert_at: num(p.min_stock_alert) || fallbackAlert,
      })),
      expiring_items: expiring.slice(0, 10).map((p: any) => ({
        name: p.name,
        expiry: p.expiry_date,
        units: num(p.stock_units),
      })),
    },
    sales_and_profit: {
      today: { transactions: todayList.length, revenue: +sum(todayList, "total").toFixed(2), profit: +sum(todayList, "profit").toFixed(2) },
      last_7_days: { transactions: weekList.length, revenue: +sum(weekList, "total").toFixed(2), profit: +sum(weekList, "profit").toFixed(2) },
      last_30_days: {
        transactions: monthList.length,
        revenue: +monthRev.toFixed(2),
        profit: +monthProf.toFixed(2),
        net_profit_margin_pct: +netMargin.toFixed(1),
        average_order_value: monthList.length > 0 ? +(monthRev / monthList.length).toFixed(2) : 0,
      },
      last_60_days: { transactions: salesList.length, revenue: +sum(salesList, "total").toFixed(2), profit: +sum(salesList, "profit").toFixed(2) },
      top_selling_items: topSellers,
    },
  };
  return JSON.stringify(ctx, null, 2);
}

// Step 1: Deep Business/Data Analysis with Gemini
async function analyzeWithGemini(system: string, messages: ChatMsg[], analysisDirective: string): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("no-gemini-key");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: `${system}\n\n${analysisDirective}` }] },
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
      }),
    },
  );
  if (!res.ok) throw new Error(`gemini-${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  if (!text) throw new Error("gemini-empty");
  return text;
}

// Step 2: Final Natural Synthesis with OpenAI (ChatGPT)
async function synthesizeWithOpenAI(system: string, messages: ChatMsg[], analysisSummary: string): Promise<string> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("no-openai-key");
  const lastUserMsg = messages[messages.length - 1]?.content || "";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.5,
      max_tokens: 1200,
      messages: [
        { role: "system", content: `${system}\n\n=== VERIFIED GEMINI BUSINESS ANALYSIS ===\n${analysisSummary}\n\nSynthesize this into a direct, executive, natural response strictly matching the user's language and tone.` },
        ...messages.slice(-6),
      ],
    }),
  });
  if (!res.ok) throw new Error(`openai-${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("openai-empty");
  return text;
}

// Managed AI Gateway fallback
async function callGateway(system: string, messages: ChatMsg[]): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("no-gateway-key");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`gateway-${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("gateway-empty");
  return text;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // User-scoped client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const messages: ChatMsg[] = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
    const mode: string = MODE_PROMPTS[body?.mode] ? body.mode : "analyst";
    const businessId: string = body?.businessId ?? "";
    if (messages.length === 0) return new Response(JSON.stringify({ error: "No messages" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const context = await buildContext(supabase, businessId);

    const system = [
      "You are GeFlow AI Assistant, powered by the GeCore AI engine — a Business Intelligence & Operations Assistant for the GeFlow inventory/POS platform.",
      "Never mention or reveal any underlying model, vendor or provider name. If asked what powers you, say you run on GeCore AI, GeFlow's own AI engine.",
      "You act like a seasoned virtual business manager: you understand the business, analyse real operational data, detect problems, calculate margins, suggest solutions and help the owner decide faster.",
      "You are NOT a generic chatbot. You answer based purely on the owner's real business data and GeFlow features.",
      MODE_PROMPTS[mode],
      "Style: keep answers clear, structured, and simple. Use bold for key numbers and amounts with the business currency symbol.",
      "Multilingual Capability: Detect the language of the user query automatically and reply in that EXACT language.",
      "- If user asks in Roman Urdu (e.g., 'mera profit kitna hai', 'stock kaisa hai', 'sales batao'), reply in natural, fluent Roman Urdu (not Hindi script or difficult formal Hindi).",
      "- If user asks in Urdu script, reply in Urdu script.",
      "- If user asks in Arabic, reply in Arabic.",
      "- If user asks in Spanish, reply in Spanish.",
      "- If user asks in English, reply in English.",
      "Never fabricate or invent random numbers. If sales or profit are 0, state that accurately.",
      "",
      "=== LIVE BUSINESS CONTEXT (JSON) ===",
      context,
    ].join("\n");

    let reply = "";
    let usedModel = "gecore";

    // 1. Try Two-Stage Pipeline (Gemini Analysis -> OpenAI Synthesis)
    try {
      const geminiAnalysis = await analyzeWithGemini(
        system,
        messages,
        "Analyze the user's question using the verified JSON business data. Calculate the exact metrics (profit, revenue, margins, stock units, out-of-stock items, taxes)."
      );

      try {
        reply = await synthesizeWithOpenAI(system, messages, geminiAnalysis);
      } catch (openaiErr) {
        console.debug("OpenAI synthesis unavailable, using direct Gemini response:", String(openaiErr));
        reply = geminiAnalysis;
      }
    } catch (pipelineErr) {
      console.debug("Two-stage pipeline failed, falling back to direct OpenAI/Gateway:", String(pipelineErr));
      try {
        reply = await synthesizeWithOpenAI(system, messages, "Use the live business context JSON directly.");
      } catch (_e) {
        try {
          reply = await callGateway(system, messages);
        } catch (gatewayErr) {
          console.error("All server-side AI engines failed:", String(gatewayErr));
          return new Response(
            JSON.stringify({ error: "GeCore AI is unavailable right now. Please try again shortly." }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    // Track AI usage per business
    if (businessId) {
      try {
        await supabase.rpc("increment_business_ai_usage", { _business_id: businessId });
      } catch (_) { /* non-fatal */ }
    }

    return new Response(JSON.stringify({ reply, model: usedModel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("geflow-ai-assistant error:", String(err));
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
