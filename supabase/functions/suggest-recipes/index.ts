// POST /functions/v1/suggest-recipes
//   Authorization: Bearer <user's access token>   (supabase.functions.invoke adds this)
//   { "household_id": "...", "items": ["spinach", "chicken breast", ...] }   // expiring soon
// → { "recipes": [{ "title", "uses": [...], "summary" }] | null, "cached": boolean }
//
// null = no LLM key, the call failed, or it's too soon to regenerate: the app falls back to
// TheMealDB (src/fridge/recipes.ts), which is a complete feature on its own.
// Cache: reused for 24 h while the expiring list is unchanged; a changed list regenerates,
// but at most every 30 min. Secrets and setup: see ../_shared/llm.ts. Needs the ai_cache migration.
//
// Deploy: `npx supabase functions deploy suggest-recipes`

import { ageMs, askGemini, callerFor, cleanName, cors, hasLlm, hashOf, json, readCache, writeCache } from '../_shared/llm.ts'

const REUSE_SAME_MS = 24 * 3_600_000
const MIN_REGEN_MS = 30 * 60_000
const MAX_ITEMS = 8

const SYSTEM = `You suggest simple home recipes that use up food that is about to expire.
Give 2 or 3 recipes. Prefer recipes that use several of the listed items together.
Assume common pantry staples (oil, salt, spices, flour, rice, pasta, onions, garlic) are available.
Each recipe: a short title, which listed items it uses (copy the names exactly), and one sentence on how to make it.`

const SCHEMA = {
  type: 'object',
  properties: {
    recipes: {
      type: 'array', minItems: 1, maxItems: 3,
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, uses: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
        required: ['title', 'uses', 'summary'],
      },
    },
  },
  required: ['recipes'],
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const { household_id, items } = await req.json().catch(() => ({}))
  const auth = await callerFor(req, household_id)
  if (auth.error) return auth.error
  const { supabase } = auth

  const names = [...new Set((Array.isArray(items) ? items : []).map(cleanName).filter(Boolean) as string[])].slice(0, MAX_ITEMS)
  if (!names.length) return json({ recipes: null, cached: false })

  const hash = await hashOf([...names].sort())
  const cached = await readCache(supabase, household_id, 'recipes')
  if (cached?.input_hash === hash && ageMs(cached) < REUSE_SAME_MS) {
    return json({ recipes: cached.payload?.recipes ?? null, cached: true })
  }
  // Different items but asked very recently: don't hit the LLM again; the app uses TheMealDB.
  if (!hasLlm() || (cached && ageMs(cached) < MIN_REGEN_MS)) return json({ recipes: null, cached: false })

  const answer = await askGemini(SYSTEM, `Expiring soon: ${names.join(', ')}`, SCHEMA)
  const recipes = (Array.isArray(answer?.recipes) ? answer.recipes : [])
    .filter((r: any) => typeof r?.title === 'string' && r.title.trim())
    .slice(0, 3)
    .map((r: any) => ({
      title: r.title.trim().slice(0, 80),
      uses: (Array.isArray(r.uses) ? r.uses : []).map(cleanName).filter((u: string | null) => u && names.includes(u)),
      summary: typeof r.summary === 'string' ? r.summary.trim().slice(0, 240) : '',
    }))
  if (!recipes.length) return json({ recipes: null, cached: false })

  await writeCache(supabase, household_id, 'recipes', hash, { recipes })
  return json({ recipes, cached: false })
})
