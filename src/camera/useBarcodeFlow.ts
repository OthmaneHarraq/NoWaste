import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { recordEvent, undoEvent } from '@/data/fridge'
import type { FridgeEvent } from '@/types/db'
import { lookupBarcode, saveBarcode, type Product } from './productLookup'
import { normalizeBarcode } from './barcode'
import { barcodeReadFeedback } from './feedback'

const AUTO_CONFIRM_SECONDS = 5

export type PendingBarcode =
  | { code: string; stage: 'looking' }
  | { code: string; stage: 'found'; product: Product; action: 'in' | 'out'; secondsLeft: number }
  | { code: string; stage: 'unknown' }

/**
 * Everything that happens after a barcode is read, shared by the laptop fridge camera
 * (BarcodePanel) and the phone Scan tab:
 *
 *   look up (saved → Open Food Facts → ask) → guess in/out → confirm (auto after 5s) → record_event
 *
 * Direction guess: already in the fridge → "took out", otherwise "put in".
 */
export function useBarcodeFlow(householdId: string | undefined, options: { onLogged?: () => void } = {}) {
  const [pending, setPending] = useState<PendingBarcode | null>(null)
  const [recent, setRecent] = useState<FridgeEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  /** Time of the last successful read, for a quick "got it" flash in the UI. */
  const [readAt, setReadAt] = useState(0)
  const pendingRef = useRef(pending)
  pendingRef.current = pending
  const onLogged = useRef(options.onLogged)
  onLogged.current = options.onLogged

  /** Start handling a scanned code. Returns false if busy with another item (one at a time). */
  function submit(rawCode: string): boolean {
    if (pendingRef.current || !householdId) return false
    const code = normalizeBarcode(rawCode)
    if (code.length < 8) return false
    barcodeReadFeedback() // beep (web) / vibrate (phone)
    setReadAt(Date.now())
    handle(householdId, code)
    return true
  }

  async function handle(hid: string, code: string) {
    setError(null)
    setPending({ code, stage: 'looking' })
    const product = await lookupBarcode(hid, code)
    if (!product) {
      setPending({ code, stage: 'unknown' })
      return
    }
    const { count } = await supabase
      .from('inventory')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', hid)
      .eq('name', product.name)
    setPending({ code, stage: 'found', product, action: count ? 'out' : 'in', secondsLeft: AUTO_CONFIRM_SECONDS })
  }

  // Countdown → auto-confirm
  useEffect(() => {
    if (pending?.stage !== 'found') return
    if (pending.secondsLeft <= 0) {
      confirm(pending.product.name, pending.action)
      return
    }
    const t = setTimeout(() => setPending(p => (p?.stage === 'found' ? { ...p, secondsLeft: p.secondsLeft - 1 } : p)), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  async function confirm(name: string, action: 'in' | 'out') {
    if (!householdId) return
    setPending(null)
    onLogged.current?.()
    const { data, error } = await recordEvent({ householdId, label: name, action, source: 'camera', confidence: 1 })
    if (error) setError(error)
    else if (data) setRecent(list => [data, ...list].slice(0, 3))
  }

  async function nameUnknown(code: string, name: string, action: 'in' | 'out') {
    if (!householdId || !name.trim()) return
    await saveBarcode(householdId, code, name)
    confirm(name.trim().toLowerCase(), action)
  }

  async function undo(ev: FridgeEvent) {
    const { error } = await undoEvent(ev.id)
    if (error) setError(error)
    else setRecent(list => list.filter(e => e.id !== ev.id))
  }

  return { pending, recent, error, readAt, submit, confirm, nameUnknown, undo, cancel: () => setPending(null) }
}
