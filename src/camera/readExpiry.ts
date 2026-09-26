import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type PrintedDate = { date: string; kind: string; text: string; confidence: number }

export type ReadDateResult =
  | { kind: 'ok'; result: PrintedDate }
  | { kind: 'no-date'; text: string }
  | { kind: 'not-deployed' }
  | { kind: 'error'; message: string }

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Ask the read-expiry Edge Function to read the "best by / use by" date in a photo.
 * `image` is a base64 JPEG (no data: prefix needed).
 */
export async function readPrintedDate(image: string): Promise<ReadDateResult> {
  const today = localToday()
  const { data, error } = await supabase.functions.invoke('read-expiry', { body: { image, today } })

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const response: Response | undefined = error.context
      if (response?.status === 404) return { kind: 'not-deployed' }
      let message = `Date reader error (${response?.status ?? '?'})`
      try {
        const body = await response?.json()
        if (body?.error) message = body.error
      } catch {}
      return { kind: 'error', message }
    }
    if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
      return { kind: 'error', message: 'Couldn’t reach the date reader. Check the internet connection, or deploy read-expiry.' }
    }
    return { kind: 'error', message: error.message ?? String(error) }
  }

  if (!data?.date) return { kind: 'no-date', text: data?.text ?? '' }

  // Sanity check: a fridge item's date is rarely more than 2 months past or 3 years ahead
  const days = (Date.parse(data.date) - Date.parse(today)) / 86_400_000
  if (Number.isNaN(days) || days < -60 || days > 3 * 365) {
    return { kind: 'no-date', text: `Read “${data.text}” but the date looks wrong. Try again closer.` }
  }
  return { kind: 'ok', result: { date: data.date, kind: data.kind ?? 'other', text: data.text ?? '', confidence: data.confidence ?? 0 } }
}

/** The most recently added inventory row for this item name (what "Read date" should update). */
export async function findInventoryId(householdId: string, name: string): Promise<string | null> {
  const { data } = await supabase
    .from('inventory')
    .select('id')
    .eq('household_id', householdId)
    .eq('name', name.toLowerCase())
    .order('added_at', { ascending: false })
    .limit(1)
  return data?.[0]?.id ?? null
}
