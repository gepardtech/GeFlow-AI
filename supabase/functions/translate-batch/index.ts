import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Batch UI translation used by the live interface-language switcher.
 * Receives an array of short UI strings and returns the same array
 * translated into the target language, order preserved.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { texts, target } = await req.json();
    if (!Array.isArray(texts) || texts.length === 0 || typeof target !== 'string') {
      return new Response(JSON.stringify({ error: 'texts[] and target are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const items = texts.slice(0, 250).map((t: unknown) => String(t).slice(0, 400));

    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
      body: JSON.stringify({
        model: 'google/gemini-3.6-flash',
        messages: [
          {
            role: 'system',
            content:
              'You translate short software UI strings. Return ONLY a JSON array of strings, same length and order as the input array. Keep brand names (GeFlow, Gepard Techs), product codes, numbers, currency symbols and emails unchanged. Do not add quotes, notes or explanations.',
          },
          {
            role: 'user',
            content: `Target language: ${target}\nTranslate this JSON array:\n${JSON.stringify(items)}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return new Response(JSON.stringify({ error: 'translation failed', detail: body.slice(0, 400) }), {
        status: res.status === 429 || res.status === 402 ? res.status : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? '';
    const match = content.match(/\[[\s\S]*\]/);
    let out: string[] = items;
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length === items.length) out = parsed.map((s) => String(s));
      } catch {
        // keep originals
      }
    }

    return new Response(JSON.stringify({ translations: out }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
