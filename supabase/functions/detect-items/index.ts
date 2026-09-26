// OWNER: AI backend team.
//
// POST /functions/v1/detect-items
//   Authorization: Bearer <user's access token>   (supabase.functions.invoke adds this)
//   { "household_id": "...", "frames": ["<base64 jpeg>", ...] }   // up to 8 frames in time order (app sends 6)
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

const MIN_CONFIDENCE = 0.4 // below this, show the guess in the app but don't log it
const MAX_FRAMES = 8 // the app sends 6: before, 4 during, after

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROMPT = `You are the food-tracking camera for a household fridge. These frames come from one
camera, in time order, around a single movement:
  the FIRST frame = just BEFORE the movement
  the frames in between = DURING the movement (a hand is usually holding something)
  the LAST frame = just AFTER the movement

Task: name each food or drink item that a hand carries during the movement, and decide its direction:
  "in"      = the item arrives with the hand and is put down / left behind, or is carried off toward
              the fridge side and is gone in the last frame (it went into the fridge)
  "out"     = the item was sitting there in the first frame, or is taken from the fridge side, and leaves with the hand
  "unknown" = you can see the item but can't tell the direction
The fridge itself may not be visible (e.g. during testing at a desk). Use the before/after frames to decide.

Rules:
- Only food and drink (including packaged food, drinks, leftovers in containers). Ignore people, hands,
  phones, furniture and food that just sits in the background without being moved.
- Use short, common, lowercase names: "milk", "apple", "burger", "strawberries". Brand names are fine
  if clearly readable ("coke"). For an opaque container, say "plastic container".
- Always report what you see, even when unsure, and give an honest confidence from 0 to 1.
  A picture of food on a screen or paper counts as that food.
- quantity = how many of that item were carried (usually 1).

Reply with ONLY a JSON array, no prose, for example:
[{"item": "apple", "action": "in", "quantity": 1, "confidence": 0.85}]
If no food or drink appears in any frame, reply [].`

type Detection = { item: string; action: 'in' | 'out' | 'unknown'; quantity?: number; confidence?: number }

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

  // Frames are never stored. `detections` includes everything the AI saw (even what wasn't
  // logged: unknown direction or low confidence) so the app can show "AI saw: …".
  return json({ events, detections })
})
