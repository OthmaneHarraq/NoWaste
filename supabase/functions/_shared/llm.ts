// Shared by generate-insights and suggest-recipes: auth as the caller, the ai_cache table
// (migrations/*_ai_cache.sql), and one small Gemini call.
//
// Secrets (Supabase dashboard → Edge Functions → Secrets, or `npx supabase secrets set`):
//   GEMINI_API_KEY   optional. Google AI Studio key (aistudio.google.com → Get API key).
//                    Not set = the functions answer { ...: null } and the app keeps its
//                    templated insights / TheMealDB recipes. That's a normal mode, not an error.
//   GEMINI_MODEL     optional, defaults below.
// Free-tier limits are per project and shown in AI Studio (not fixed numbers), so callers
// cache answers for hours; see each function's cache policy.
// Free-tier note: Google may use unpaid-tier prompts to improve its products, and the free
// tier isn't offered in the EEA/UK/Switzerland. Only food names and counts are ever sent.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite'
const TIMEOUT_MS = 15_000

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

/** Supabase client acting as the signed-in caller, so RLS and is_member() apply. */
export async function callerFor(req: Request, householdId: unknown) {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: json({ error: 'sign in first' }, 401) }
  if (typeof householdId !== 'string') return { error: json({ error: 'need household_id' }, 400) }
  const { data: member } = await supabase.rpc('is_member', { hid: householdId })
  if (member !== true) return { error: json({ error: 'not a member of this household' }, 403) }
  return { supabase }
}

export async function hashOf(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export type CacheRow = { input_hash: string; payload: any; generated_at: string }

export async function readCache(supabase: SupabaseClient, householdId: string, kind: 'insights' | 'recipes'): Promise<CacheRow | null> {
  const { data } = await supabase.from('ai_cache').select('input_hash, payload, generated_at')
    .eq('household_id', householdId).eq('kind', kind).maybeSingle()
  return data ?? null
}

export async function writeCache(supabase: SupabaseClient, householdId: string, kind: 'insights' | 'recipes', hash: string, payload: unknown) {
  await supabase.rpc('save_ai_cache', { p_household_id: householdId, p_kind: kind, p_input_hash: hash, p_payload: payload })
}

export const ageMs = (row: CacheRow) => Date.now() - new Date(row.generated_at).getTime()

export const hasLlm = () => !!Deno.env.get('GEMINI_API_KEY')

/** One JSON-mode Gemini call. Returns the parsed object, or null on any failure. */
export async function askGemini(system: string, prompt: string, schema: object): Promise<any | null> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        // maxOutputTokens includes the model's thinking tokens, so leave headroom beyond the
        // short JSON answer (cut-off output fails to parse and falls back to the template).
        generationConfig: { temperature: 0.6, maxOutputTokens: 2048, responseMimeType: 'application/json', responseSchema: schema },
      }),
    })
    if (!res.ok) {
      console.error('gemini', res.status, (await res.text()).slice(0, 500))
      return null
    }
    const data = await res.json()
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('')
    return JSON.parse(text)
  } catch (e) {
    console.error('gemini failed', e)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Food names from the client: short plain strings only, so the prompt stays small and sane. */
export function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.toLowerCase().replace(/[^\p{L}\p{N} '&-]/gu, '').trim().slice(0, 60)
  return s || null
}
