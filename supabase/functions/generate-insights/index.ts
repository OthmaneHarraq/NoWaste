// POST /functions/v1/generate-insights
//   Authorization: Bearer <user's access token>   (supabase.functions.invoke adds this)
//   { "household_id": "...", "patterns": <WastePatterns from src/fridge/stats.ts> }
// → { "insights": ["...", "..."] | null, "cached": boolean }
//
// null = no LLM key configured, or the call failed: the app keeps its templated insights
// (src/fridge/insights.ts), which is a complete feature on its own.
// Cache: an answer is reused for 24 h while the stats are unchanged, and is never
// regenerated more than every 6 h even if they change, so a household costs at most
// ~4 LLM calls a day. Secrets and setup: see ../_shared/llm.ts. Needs the ai_cache migration.
//
// Deploy: `npx supabase functions deploy generate-insights`

import { ageMs, askGemini, callerFor, cleanName, cors, hasLlm, hashOf, json, readCache, writeCache } from '../_shared/llm.ts'

const REUSE_SAME_MS = 24 * 3_600_000
const MIN_REGEN_MS = 6 * 3_600_000

const SYSTEM = `You help a household waste less food. You get 30 days of stats on what they ate in time and what they threw away.
Write 2 or 3 short, specific, actionable sentences (at most 25 words each) about how they buy or store food.
Name the specific foods. Suggest concrete changes (buy frozen, buy smaller, freeze on the day, shop twice a week).
Only use the numbers given. No greetings, no praise padding, no emojis.`

const SCHEMA = {
  type: 'object',
  properties: { insights: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 } },
  required: ['insights'],
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const { household_id, patterns } = await req.json().catch(() => ({}))
  const auth = await callerFor(req, household_id)
  if (auth.error) return auth.error
  const { supabase } = auth

  // Keep only what the prompt needs, in a stable shape (also what the cache hash covers).
  const input = {
    days: Number(patterns?.days) || 30,
    saved: Math.max(0, Number(patterns?.saved) || 0),
    wasted: Math.max(0, Number(patterns?.wasted) || 0),
    items: (Array.isArray(patterns?.items) ? patterns.items : []).slice(0, 5)
      .map((i: any) => ({ name: cleanName(i?.name), category: cleanName(i?.category), wasted: Number(i?.wasted) || 0, saved: Number(i?.saved) || 0 }))
      .filter((i: any) => i.name),
    categories: (Array.isArray(patterns?.categories) ? patterns.categories : []).slice(0, 7)
      .map((c: any) => ({ category: cleanName(c?.category), count: Number(c?.count) || 0 }))
      .filter((c: any) => c.category),
  }
  if (input.wasted === 0) return json({ insights: null, cached: false })

  const hash = await hashOf(input)
  const cached = await readCache(supabase, household_id, 'insights')
  if (cached && ((cached.input_hash === hash && ageMs(cached) < REUSE_SAME_MS) || ageMs(cached) < MIN_REGEN_MS)) {
    return json({ insights: cached.payload?.insights ?? null, cached: true })
  }
  if (!hasLlm()) return json({ insights: null, cached: false })

  const answer = await askGemini(SYSTEM, `Stats for the last ${input.days} days:\n${JSON.stringify(input)}`, SCHEMA)
  const insights = Array.isArray(answer?.insights)
    ? answer.insights.filter((s: unknown) => typeof s === 'string' && s.trim()).map((s: string) => s.trim().slice(0, 240)).slice(0, 3)
    : []
  if (!insights.length) return json({ insights: null, cached: false })

  await writeCache(supabase, household_id, 'insights', hash, { insights })
  return json({ insights, cached: false })
})
