import { supabase } from '@/lib/supabase'
import { correctEvent, recordEvent, setExpiry, setLocation, undoEvent, updateDisposition } from '@/data/fridge'
import type { Disposition, FridgeEvent } from '@/types/db'
import { buildSnapshot, type InventoryRow } from './adapter'
import type { FridgeItem, FridgeSnapshot, FridgeSource } from './types'

const HISTORY_DAYS = 30

// Until supabase/migrations/20260926120000_add_location_and_disposition.sql is applied, the
// new functions/params don't exist. Say so plainly instead of showing a PostgREST error.
const NEEDS_MIGRATION = 'This needs the latest database update. Ask whoever manages Supabase to apply the new migrations.'
const missingFunction = (error: string | null) => !!error && /could not find the function/i.test(error)
const explain = (error: string | null) => (missingFunction(error) ? NEEDS_MIGRATION : error)

/** Live Supabase data for one household, kept fresh by Realtime. */
export function createLiveSource(householdId: string): FridgeSource {
  let inventory: InventoryRow[] = []
  let events: FridgeEvent[] = []
  let catalog = new Map<string, string | null>()
  let listener: ((s: FridgeSnapshot) => void) | null = null
  // inventory id → the "out" event that just binned it, so "I composted it" can amend that
  // event even before Realtime has delivered it.
  const binnedBy = new Map<string, string>()

  const emit = () => listener?.(buildSnapshot({ inventory, events, catalog }))

  async function load() {
    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString()
    const [inv, ev] = await Promise.all([
      supabase.from('inventory').select('*, foods(category)').eq('household_id', householdId),
      supabase
        .from('events')
        .select('*')
        .eq('household_id', householdId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1000),
    ])
    if (inv.error) throw inv.error
    if (ev.error) throw ev.error
    inventory = (inv.data ?? []) as InventoryRow[]
    events = (ev.data ?? []) as FridgeEvent[]
    emit()
  }

  /** Say what happened to something that already left. Shown at once; Realtime confirms. */
  async function setDisposition(eventId: string | undefined, value: Disposition) {
    if (!eventId) return 'Nothing to update'
    events = events.map(e => (e.id === eventId ? { ...e, disposition: value } : e))
    emit()
    const { error } = await updateDisposition(eventId, value)
    if (error) load().catch(() => {})
    return explain(error)
  }

  /** Remove one of an in-fridge item, recording whether it was eaten or binned. */
  async function takeOut(item: FridgeItem, value: Disposition) {
    const location = inventory.find(r => r.id === item.id)?.location ?? undefined
    let { data, error } = await recordEvent({ householdId, label: item.name, action: 'out', source: 'manual', location, disposition: value })
    // Older database: a plain manual "out" already counts as eaten, so "Mark as used" still works.
    // Binned/composted would be recorded as eaten, so those wait for the migration instead.
    if (missingFunction(error) && value === 'consumed') {
      ;({ data, error } = await recordEvent({ householdId, label: item.name, action: 'out', source: 'manual' }))
    }
    if (data && value === 'thrown_away') binnedBy.set(item.id, data.id)
    return explain(error)
  }

  return {
    subscribe(onChange, onConnection) {
      listener = onChange
      onConnection('connecting')
      let debounce: ReturnType<typeof setTimeout> | undefined
      const refetch = () => {
        clearTimeout(debounce)
        debounce = setTimeout(() => load().catch(() => onConnection('offline')), 120)
      }

      ;(async () => {
        const { data } = await supabase.from('foods').select('name, category')
        catalog = new Map((data ?? []).map(f => [f.name.toLowerCase(), f.category]))
        await load()
      })().catch(() => onConnection('offline'))

      // Every camera write touches inventory and inserts an event; refetch on either.
      const channel = supabase
        .channel(`dashboard:${householdId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory', filter: `household_id=eq.${householdId}` }, refetch)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `household_id=eq.${householdId}` }, refetch)
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            onConnection('live')
            refetch() // catch anything that happened while (re)connecting
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            onConnection('offline')
          }
        })

      // Pending items turn into "consumed" when the grace period runs out, with no DB write.
      const tick = setInterval(emit, 20_000)

      return () => {
        listener = null
        clearTimeout(debounce)
        clearInterval(tick)
        supabase.removeChannel(channel)
      }
    },

    async markUsed(item) {
      if (item.status === 'pending_removal') return setDisposition(item.eventId, 'consumed')
      return takeOut(item, 'consumed')
    },

    async markThrownAway(item) {
      if (item.status === 'pending_removal') return setDisposition(item.eventId, 'thrown_away')
      return takeOut(item, 'thrown_away')
    },

    async markComposted(item) {
      const eventId = item.eventId ?? binnedBy.get(item.id)
      if (eventId) return setDisposition(eventId, 'composted')
      return takeOut(item, 'composted')
    },

    async moveTo(item, where) {
      if (item.status !== 'in_fridge') return 'Only items in the fridge can be moved'
      // null = back to its usual fridge spot for its category.
      const { data, error } = await setLocation(item.id, where === 'freezer' ? 'freezer' : null)
      if (error) return explain(error)
      if (data) {
        inventory = inventory.map(r => (r.id === data.id ? { ...r, ...data } : r))
        emit()
      }
      return null
    },

    async setExpiry(item, date) {
      if (item.status !== 'in_fridge') return 'Only items in the fridge have a date to change'
      // Show it straight away; Realtime then confirms with the saved row
      const now = new Date().toISOString()
      inventory = inventory.map(r => (r.id === item.id ? { ...r, expires_on: date, updated_at: now } : r))
      emit()
      const error = await setExpiry(item.id, date)
      if (error) load().catch(() => {})
      return error
    },

    async putBack(item) {
      if (!item.eventId) return 'Nothing to put back'
      return (await undoEvent(item.eventId)).error
    },

    async addItem(name) {
      return (await recordEvent({ householdId, label: name, action: 'in', source: 'manual' })).error
    },

    async undo(entry) {
      if (!entry.eventId) return 'This entry cannot be undone'
      return (await undoEvent(entry.eventId)).error
    },

    async correct(entry, name, action) {
      if (!entry.eventId) return 'This entry cannot be fixed'
      return (await correctEvent(entry.eventId, name, action)).error
    },
  }
}
