import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FridgeEvent, InventoryItem } from '@/types/db'

// ---- Actions (wrap the SQL functions in the schema) ----------------------

type Result<T> = { data: T | null; error: string | null }

/** Log something going in or out. The camera's Edge Function calls the same SQL function. */
export async function recordEvent(args: {
  householdId: string
  label: string
  action: 'in' | 'out'
  confidence?: number
  quantity?: number
  source?: 'camera' | 'manual'
}): Promise<Result<FridgeEvent>> {
  const { data, error } = await supabase.rpc('record_event', {
    p_household_id: args.householdId,
    p_label: args.label,
    p_action: args.action,
    p_confidence: args.confidence ?? null,
    p_source: args.source ?? 'manual',
    p_quantity: args.quantity ?? 1,
  })
  return { data, error: error?.message ?? null }
}

export async function undoEvent(eventId: string): Promise<Result<FridgeEvent>> {
  const { data, error } = await supabase.rpc('undo_event', { p_event_id: eventId })
  return { data, error: error?.message ?? null }
}

/** Rename and/or flip in↔out. Renames are remembered for next time. */
export async function correctEvent(eventId: string, itemName: string, action?: 'in' | 'out'): Promise<Result<FridgeEvent>> {
  const { data, error } = await supabase.rpc('correct_event', {
    p_event_id: eventId,
    p_item_name: itemName,
    p_action: action ?? null,
  })
  return { data, error: error?.message ?? null }
}

// ---- Live data hooks -------------------------------------------------------

/** Re-runs `load` whenever `table` changes for this household (Supabase Realtime). */
function useLiveQuery<T>(table: 'inventory' | 'events', householdId: string | undefined, load: () => Promise<T[]>) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setRows(await load())
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }, [load])

  useEffect(() => {
    if (!householdId) return
    refresh()
    const channel = supabase
      .channel(`${table}:${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` }, refresh)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [householdId, table, refresh])

  return { rows, loading, error, refresh }
}

export function useInventory(householdId: string | undefined) {
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('household_id', householdId!)
      .order('expires_on', { ascending: true, nullsFirst: false })
    if (error) throw error
    return (data ?? []) as InventoryItem[]
  }, [householdId])
  const { rows, ...rest } = useLiveQuery<InventoryItem>('inventory', householdId, load)
  return { items: rows, ...rest }
}

export function useEvents(householdId: string | undefined, limit = 50) {
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('household_id', householdId!)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as FridgeEvent[]
  }, [householdId, limit])
  const { rows, ...rest } = useLiveQuery<FridgeEvent>('events', householdId, load)
  return { events: rows, ...rest }
}

// ---- Helpers ---------------------------------------------------------------

/** Days until expiry (negative = expired), or null when unknown. */
export function daysLeft(expiresOn: string | null): number | null {
  if (!expiresOn) return null
  const [y, m, d] = expiresOn.split('-').map(Number)
  const today = new Date()
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((Date.UTC(y, m - 1, d) - start) / 86_400_000)
}
