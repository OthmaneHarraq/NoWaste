// Shared by the AI Edge Functions (detect-items, read-expiry): send images + a prompt to a
// vision model and get its text answer back.
//
// Provider is picked by which secret is set (Supabase → Edge Functions → Secrets):
//   GEMINI_API_KEY     → Google Gemini (has a FREE tier: aistudio.google.com → Get API key)
//   ANTHROPIC_API_KEY  → Claude (paid, pay-as-you-go)
// If both are set, Gemini is used unless VISION_PROVIDER=anthropic.
// VISION_MODEL overrides the model (e.g. gemini-3-flash-preview for better accuracy).

const GEMINI_DEFAULT_MODEL = 'gemini-3.1-flash-lite' // free tier, stable, accepts images
const ANTHROPIC_DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

export type VisionResult = { ok: true; text: string } | { ok: false; status: number; error: string }

/** images: base64 JPEGs (a "data:image/jpeg;base64," prefix is fine). */
export async function askVision(images: string[], prompt: string, opts: { maxTokens?: number; json?: boolean } = {}): Promise<VisionResult> {
  const env = (k: string) => Deno.env.get(k)
  const gemini = env('GEMINI_API_KEY')
  const anthropic = env('ANTHROPIC_API_KEY')
  const provider = env('VISION_PROVIDER') ?? (gemini ? 'gemini' : anthropic ? 'anthropic' : null)
  const clean = images.map(i => i.replace(/^data:image\/\w+;base64,/, ''))

  if (provider === 'gemini' && gemini) return callGemini(gemini, env('VISION_MODEL') ?? GEMINI_DEFAULT_MODEL, clean, prompt, opts)
  if (provider === 'anthropic' && anthropic) return callAnthropic(anthropic, env('VISION_MODEL') ?? ANTHROPIC_DEFAULT_MODEL, clean, prompt, opts)
  return { ok: false, status: 500, error: 'No AI key set. Add GEMINI_API_KEY (free) in Supabase → Edge Functions → Secrets.' }
}

async function callGemini(key: string, model: string, images: string[], prompt: string, opts: { maxTokens?: number; json?: boolean }): Promise<VisionResult> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          ...images.map(data => ({ inlineData: { mimeType: 'image/jpeg', data } })),
          { text: prompt },
        ],
      }],
      generationConfig: {
        // Roomy limit: the docs don't say whether "thinking" counts against it.
        // Temperature left at the default, as Google recommends for Gemini 3.
        maxOutputTokens: Math.max(2048, opts.maxTokens ?? 0),
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
        // Gemini 3 Flash thinks hard by default; a quick photo question doesn't need that.
        // (Flash-Lite already defaults to minimal; 2.5 models don't take this setting.)
        ...(/^gemini-3/.test(model) && !/lite/.test(model) ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
      },
    }),
  })
  if (res.status === 429) return { ok: false, status: 429, error: 'Free AI limit reached. Wait a minute and try again.' }
  if (!res.ok) return { ok: false, status: 502, error: `Gemini error ${res.status}: ${(await res.text()).slice(0, 300)}` }
  const body = await res.json()
  const text = (body.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('')
  if (!text) return { ok: false, status: 502, error: `Gemini returned no text (${body.candidates?.[0]?.finishReason ?? body.promptFeedback?.blockReason ?? 'unknown'})` }
  return { ok: true, text }
}

async function callAnthropic(key: string, model: string, images: string[], prompt: string, opts: { maxTokens?: number }): Promise<VisionResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 400,
      messages: [{
        role: 'user',
        content: [
          ...images.map(data => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } })),
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })
  if (res.status === 429) return { ok: false, status: 429, error: 'AI rate limit reached. Wait a minute and try again.' }
  if (!res.ok) return { ok: false, status: 502, error: `Claude error ${res.status}: ${(await res.text()).slice(0, 300)}` }
  const text: string = (await res.json()).content?.find((c: any) => c.type === 'text')?.text ?? ''
  return { ok: true, text }
}
