import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { correctEvent, recordEvent, undoEvent } from '@/data/fridge'
import type { FridgeEvent } from '@/types/db'
import { buildSnapshot, type InventoryRow, type Overrides } from './adapter'
import type { ConnectionState, FridgeSnapshot, FridgeSource } from './types'

const HISTORY_DAYS = 30

/** Live Supabase data for one household, kept fresh by Realtime. */
export function createLiveSource(householdId: string): FridgeSource {
  const overridesKey = `nowaste:overrides:${householdId}`
  let inventory: InventoryRow[] = []
  let events: FridgeEvent[] = []
  let catalog = new Map<string, string | null>()
  let overrides: Overrides = {}
  let listener: ((s: FridgeSnapshot) => void) | null = null

  const emit = () => listener?.(buildSnapshot({ inventory, events, catalog, overrides }))

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

  async function saveOverride(eventId: string | undefined, value: 'consumed' | 'thrown_away') {
    if (!eventId) return
    overrides = { ...overrides, [eventId]: value }
    emit()
    await AsyncStorage.setItem(overridesKey, JSON.stringify(overrides)).catch(() => {})
  }

  /** Remove one of an in-fridge item, remembering whether it was eaten or binned. */
  async function takeOut(name: string, value: 'consumed' | 'thrown_away') {
    const { data, error } = await recordEvent({ householdId, label: name, action: 'out', source: 'manual' })
    if (error) return error
    await saveOverride(data?.id, value)
    return null
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
        overrides = JSON.parse((await AsyncStorage.getItem(overridesKey).catch(() => null)) ?? '{}')
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
      if (item.status === 'pending_removal') return saveOverride(item.eventId, 'consumed').then(() => null)
      return takeOut(item.name, 'consumed')
    },

    async markThrownAway(item) {
      if (item.status === 'pending_removal') return saveOverride(item.eventId, 'thrown_away').then(() => null)
      return takeOut(item.name, 'thrown_away')
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
