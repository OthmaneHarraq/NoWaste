// OWNER: AI backend team (written for the phone Scan tab's "Read date" button).
//
// POST /functions/v1/read-expiry
//   Authorization: Bearer <user's access token>   (supabase.functions.invoke adds this)
//   { "image": "<base64 jpeg>", "today": "YYYY-MM-DD" }   // a close-up of the printed date
// → { "date": "YYYY-MM-DD" | null, "kind": "best_by" | "use_by" | "expires" | "sell_by" | "other" | null,
//     "text": "what was printed", "confidence": 0-1 }
//
// Secrets: ANTHROPIC_API_KEY (same as detect-items), optional VISION_MODEL.
// Deploy: npx supabase functions deploy read-expiry --project-ref <your project ref>
// Starting point only — not yet run against a real deployment.

import { createClient } from 'npm:@supabase/supabase-js@2'

const MODEL = Deno.env.get('VISION_MODEL') ?? 'claude-haiku-4-5-20251001'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function prompt(today: string) {
  return `This is a close-up photo of a food package. Find the printed expiration-type date
(BEST BY, BEST BEFORE, USE BY, EXP, SELL BY, or just a date stamped on the package).

Today is ${today}. Rules:
- US packaging: read ambiguous numeric dates as MONTH/DAY (10/12/26 = October 12, 2026).
- Two-digit years are 20xx. If the year is missing, use the next occurrence of that month/day on or after today.
- Ignore lot codes, times (like 14:32), prices and "packed on" dates.
- If several dates are printed, choose the use-by / best-by one.

Reply with ONLY JSON, no prose:
{"date": "YYYY-MM-DD", "kind": "best_by" | "use_by" | "expires" | "sell_by" | "other", "text": "exact text you read", "confidence": 0.0-1.0}
If no date is readable, reply {"date": null, "kind": null, "text": "", "confidence": 0}.`
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  // Only signed-in users may spend the AI budget
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'sign in first' }, 401)

  const { image, today } = await req.json().catch(() => ({}))
  if (typeof image !== 'string' || image.length < 100) return json({ error: 'need image (base64 jpeg)' }, 400)
  const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(today ?? '') ? today : new Date().toISOString().slice(0, 10)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY secret not set' }, 500)

  const ai = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image.replace(/^data:image\/\w+;base64,/, '') } },
          { type: 'text', text: prompt(todayStr) },
        ],
      }],
    }),
  })
  if (!ai.ok) return json({ error: `vision model error ${ai.status}`, detail: await ai.text() }, 502)

  const text: string = (await ai.json()).content?.find((c: any) => c.type === 'text')?.text ?? ''
  try {
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
    const date = typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null
    return json({ date, kind: date ? parsed.kind ?? 'other' : null, text: String(parsed.text ?? ''), confidence: Number(parsed.confidence) || 0 })
  } catch {
    return json({ error: 'could not parse model output', raw: text }, 502)
  }
  // The photo is never stored.
})
