// OWNER: AI backend team.
//
// POST /functions/v1/detect-items
//   Authorization: Bearer <user's access token>   (supabase.functions.invoke adds this)
//   { "household_id": "...", "frames": ["<base64 jpeg>", ...] }   // 1–4 frames in time order
// → { "events": [ ...rows from record_event... ], "detections": [...] }
//
// Secrets (Supabase dashboard → Edge Functions → Secrets, or `supabase secrets set`):
//   GEMINI_API_KEY      free (aistudio.google.com → Get API key), or ANTHROPIC_API_KEY (paid)
//   VISION_MODEL        optional (see supabase/functions/_shared/vision.ts)
// SUPABASE_URL / SUPABASE_ANON_KEY are provided automatically.
//
// Deploy: `npx supabase functions deploy detect-items`
// Starting point only — not yet run against a real deployment. Tune the prompt with real frames.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { askVision } from '../_shared/vision.ts'

const MIN_CONFIDENCE = 0.35 // below this, don't log anything
const MAX_FRAMES = 4

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROMPT = `These frames are in time order, from a camera beside a fridge door.
Identify food items being put INTO or taken OUT of the fridge.
A full hand moving toward the fridge then an empty hand leaving = "in"; the reverse = "out".
Use short, common, lowercase names ("milk", "eggs", "strawberries"). For opaque containers say "plastic container".
Reply with ONLY JSON, no prose:
[{"item": "milk", "action": "in", "quantity": 1, "confidence": 0.9}]
If nothing is clearly being moved, reply [].`

type Detection = { item: string; action: 'in' | 'out'; quantity?: number; confidence?: number }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  // Act as the signed-in user so RLS + record_event's membership check apply
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'sign in first' }, 401)

  const { household_id, frames } = await req.json().catch(() => ({}))
  if (!household_id || !Array.isArray(frames) || frames.length === 0) {
    return json({ error: 'need household_id and frames[]' }, 400)
  }

  // TODO: per-household rate limit (e.g. max N calls/hour) so a stuck camera can't run up the bill.

  const ai = await askVision(frames.slice(0, MAX_FRAMES), PROMPT, { maxTokens: 400, json: true })
  if (!ai.ok) return json({ error: ai.error }, ai.status)
  const text = ai.text
  let detections: Detection[] = []
  try {
    detections = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1))
  } catch {
    return json({ error: 'could not parse model output', raw: text }, 502)
  }

  const events = []
  for (const d of detections) {
    if (!d?.item || (d.action !== 'in' && d.action !== 'out')) continue
    if ((d.confidence ?? 1) < MIN_CONFIDENCE) continue
    const { data, error } = await supabase.rpc('record_event', {
      p_household_id: household_id,
      p_label: d.item,
      p_action: d.action,
      p_confidence: d.confidence ?? null,
      p_source: 'camera',
      p_quantity: Math.max(1, Math.round(d.quantity ?? 1)),
    })
    if (error) return json({ error: error.message }, 403)
    events.push(data)
  }

  // Frames are never stored.
  return json({ events, detections })
})
