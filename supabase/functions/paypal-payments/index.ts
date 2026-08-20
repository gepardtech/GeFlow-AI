// PayPal order create/capture + automatic plan activation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const DEFAULT_CLIENT_ID = "BAAxlkvHkBSK_FKe9MeTzSTeTyQGBrs3nTkbrWKlwRBgoy6iBFxfQtHQknHKoneEY_D-B22eJ1bjkX-LRo";
const DEFAULT_SECRET = "ENRaMOQHAN9R0m0zXhwNadzlveYSr4FHoxpM3NwytUwpOQ1ywPNHv9iZHco5GlG03r-kxYelpFSplgLK";

async function paypalConfig() {
  const { data } = await admin
    .from("payment_gateways")
    .select("enabled, mode, public_config, credentials")
    .eq("gateway_key", "paypal")
    .maybeSingle();

  const clientId = (data?.public_config as any)?.client_id || Deno.env.get("PAYPAL_CLIENT_ID") || DEFAULT_CLIENT_ID;
  const secret = (data?.credentials as any)?.secret || Deno.env.get("PAYPAL_SECRET") || DEFAULT_SECRET;
  const mode = data?.mode === "live" ? "live" : "sandbox";
  const base = mode === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
  return { clientId, secret, base, mode, enabled: data?.enabled !== false };
}

async function token() {
  const { clientId, secret, base, mode } = await paypalConfig();
  if (!clientId || !secret) throw new Error("PayPal credentials are not configured");

  // Attempt token generation on primary endpoint (sandbox or live)
  try {
    const res = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const body = await res.text();
    if (res.ok) {
      return { accessToken: JSON.parse(body).access_token as string, base };
    }
    console.warn(`PayPal auth failed on ${base} [${res.status}]: ${body}`);
  } catch (err) {
    console.warn(`PayPal auth request failed on ${base}:`, err);
  }

  // Fallback to alternative endpoint if sandbox/live mode is mismatched
  const altBase = mode === "sandbox" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const altRes = await fetch(`${altBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const altBody = await altRes.text();
  if (!altRes.ok) throw new Error(`PayPal authentication failed: ${altBody}`);
  return { accessToken: JSON.parse(altBody).access_token as string, base: altBase };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData } = await admin.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return json({ error: "Not authenticated" }, 401);

    const { action, orderId, plan = "standard", cycle = "monthly", amount = 0, currency = "USD", coupon = null } =
      await req.json();

    const { accessToken, base } = await token();

    if (action === "create") {
      const value = Math.max(Number(amount) || 0, 0.01).toFixed(2);
      const res = await fetch(`${base}/v2/checkout/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            custom_id: `${user.id}|${plan}|${cycle}`,
            description: `GeFlow ${plan} plan (${cycle})`,
            amount: { currency_code: currency, value },
          }],
          payment_source: {
            paypal: {
              experience_context: {
                shipping_preference: "NO_SHIPPING",
                user_action: "PAY_NOW",
                brand_name: "GeFlow",
              },
            },
          },
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        console.error("PayPal create order failed", res.status, text);
        return json({ error: "Could not start the PayPal payment", details: text }, res.status);
      }
      const order = JSON.parse(text);
      await admin.from("payment_transactions").insert({
        user_id: user.id, provider: "paypal", provider_order_id: order.id,
        plan, cycle, amount: Number(value), currency, status: "created",
        payer_email: user.email, raw: { coupon },
      });
      return json({ id: order.id });
    }

    if (action === "capture") {
      if (!orderId) return json({ error: "Missing order id" }, 400);
      const res = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });
      const text = await res.text();
      if (!res.ok) {
        console.error("PayPal capture failed", res.status, text);
        await admin.from("payment_transactions")
          .update({ status: "failed", raw: { error: text } })
          .eq("provider_order_id", orderId);
        return json({ error: "Payment could not be captured", details: text }, res.status);
      }
      const result = JSON.parse(text);
      const unit = result?.purchase_units?.[0];
      const capture = unit?.payments?.captures?.[0];
      const paid = Number(capture?.amount?.value ?? 0);
      const currencyCode = capture?.amount?.currency_code ?? currency;
      const payerEmail = result?.payer?.email_address ?? user.email;
      const method = result?.payment_source?.card
        ? `Card •••• ${result.payment_source.card.last_digits ?? "****"}`
        : `PayPal (${payerEmail})`;

      if (result.status !== "COMPLETED" && capture?.status !== "COMPLETED") {
        return json({ error: `Payment status: ${result.status}`, status: result.status }, 402);
      }

      await admin.from("payment_transactions").update({
        status: "completed",
        provider_capture_id: capture?.id ?? null,
        amount: paid, currency: currencyCode, payer_email: payerEmail,
        method, raw: result,
      }).eq("provider_order_id", orderId);

      // Activate the plan
      await admin.from("profiles").update({ plan, status: "active" }).eq("user_id", user.id);

      const next = new Date();
      if (cycle === "monthly") next.setMonth(next.getMonth() + 1);
      else if (cycle === "yearly") next.setFullYear(next.getFullYear() + 1);

      await admin.from("subscriptions").insert({
        owner_user_id: user.id, tier: plan, cycle, status: "active",
        amount: paid, next_billing_date: cycle === "lifetime" ? null : next.toISOString(),
      });

      const invoiceNumber = `INV-${(capture?.id ?? orderId).slice(-8).toUpperCase()}`;
      const { data: profile } = await admin.from("profiles")
        .select("full_name").eq("user_id", user.id).maybeSingle();

      await admin.from("invoices").insert({
        invoice_number: invoiceNumber,
        owner_user_id: user.id,
        client_name: profile?.full_name || payerEmail || "Customer",
        billing_email: user.email ?? payerEmail,
        plan, payment_method: method, amount: paid, status: "paid",
      });

      const { count } = await admin.from("businesses")
        .select("id", { count: "exact", head: true }).eq("owner_user_id", user.id);

      return json({
        status: "COMPLETED", plan, cycle, amount: paid, currency: currencyCode,
        method, payerEmail, invoiceNumber, hasBusiness: (count ?? 0) > 0,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("paypal-payments error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
