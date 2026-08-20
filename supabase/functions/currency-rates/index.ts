import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Live FX rates with USD as the base.
 * Primary source: open.er-api.com (free, no key).
 * Fallback: Lovable AI (Gemini) asked for the current rate.
 * Results are cached in-memory for 1 hour per isolate.
 */
const CACHE_TTL_MS = 15 * 60 * 1000;
let cache: { at: number; rates: Record<string, number> } | null = null;

const fromGemini = async (codes: string[]): Promise<Record<string, number>> => {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) return {};
  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
    body: JSON.stringify({
      model: 'google/gemini-3.6-flash',
      messages: [
        { role: 'system', content: 'You are an FX rate service. Reply with JSON only.' },
        {
          role: 'user',
          content: `Give the latest approximate exchange rates with USD as base for these currencies: ${codes.join(', ')}. Respond as JSON: {"USD":1,"PKR":276.89,...} with no extra text.`,
        },
      ],
    }),
  });
  if (!res.ok) return {};
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    const parsed = JSON.parse(match[0]);
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[k.toUpperCase()] = n;
    }
    return out;
  } catch {
    return {};
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const wanted = [
    'USD', 'EUR', 'GBP', 'PKR', 'INR', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR',
    'TRY', 'EGP', 'NGN', 'ZAR', 'KES', 'CAD', 'AUD', 'NZD', 'CHF', 'SEK', 'NOK',
    'DKK', 'PLN', 'CZK', 'RUB', 'CNY', 'JPY', 'KRW', 'HKD', 'SGD', 'MYR', 'IDR',
    'THB', 'PHP', 'VND', 'BDT', 'LKR', 'AFN', 'BRL', 'MXN', 'ARS',
  ];

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return new Response(JSON.stringify({ base: 'USD', rates: cache.rates, cached: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let rates: Record<string, number> = {};
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    if (r.ok) {
      const j = await r.json();
      if (j?.rates) {
        for (const c of wanted) if (Number.isFinite(j.rates[c])) rates[c] = Number(j.rates[c]);
      }
    }
  } catch (_e) {
    // fall through to AI
  }

  if (Object.keys(rates).length < 3) {
    rates = { ...(await fromGemini(wanted)), ...rates };
  }

  rates.USD = 1;

  if (Object.keys(rates).length > 1) cache = { at: Date.now(), rates };

  return new Response(JSON.stringify({ base: 'USD', rates, cached: false }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
