import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { FridgeEvent } from '@/types/db'

export type Detection = { item: string; action: 'in' | 'out'; quantity?: number; confidence?: number }

export type DetectResult =
  | { kind: 'ok'; events: FridgeEvent[]; detections: Detection[] }
  | { kind: 'not-deployed' }
  | { kind: 'error'; message: string }

/**
 * Send frames to the detect-items Edge Function (supabase/functions/detect-items).
 * It asks the vision AI what went in/out and logs it with record_event, so the
 * Fridge and Activity tabs update on their own. Contract is documented in that file.
 */
export async function detectItems(householdId: string, frames: string[]): Promise<DetectResult> {
  const { data, error } = await supabase.functions.invoke('detect-items', {
    body: { household_id: householdId, frames },
  })

  if (!error) {
    return { kind: 'ok', events: data?.events ?? [], detections: data?.detections ?? [] }
  }

  if (error instanceof FunctionsHttpError) {
    const response: Response | undefined = error.context
    if (response?.status === 404) return { kind: 'not-deployed' }
    let message = `AI function error (${response?.status ?? '?'})`
    try {
      const body = await response?.json()
      if (body?.error) message = body.error
    } catch {}
    return { kind: 'error', message }
  }
  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    return { kind: 'error', message: 'Couldn’t reach the AI function. Check your internet connection.' }
  }
  return { kind: 'error', message: error.message ?? String(error) }
}
