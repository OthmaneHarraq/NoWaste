// Real tables (supabase/migrations/*_nowaste_schema.sql) → the dashboard contract in ./types.ts.
// If the schema changes, this is the file to update (plus the queries in ./liveSource.ts).
//
// The schema has no status column, so statuses are derived from the events log:
//   inventory row                                   → in_fridge
//   camera "out" event, younger than the grace time → pending_removal (unless an "in" of
//                                                     the same item followed: it came back)
//   "out" event, grace over / manual                → consumed, or expired if it left the
//                                                     fridge after its date (= wasted)
//   user's explicit choice (Mark used / Thrown away) → kept in `overrides`

import type { FridgeEvent, InventoryItem } from '@/types/db'
import { categorize } from './categories'
import { PENDING_GRACE_MINUTES } from './config'
import type { ActivityEntry, FoodCategory, FridgeItem, FridgeSnapshot } from './types'

export type InventoryRow = InventoryItem & { foods: { category: string | null } | null }

/** eventId → what the user said happened to that item. */
export type Overrides = Record<string, 'consumed' | 'thrown_away'>

const GRACE_MS = PENDING_GRACE_MINUTES * 60_000

/** 'YYYY-MM-DD' → local midnight ISO, so day maths is in the household's timezone. */
function dateToIso(date: string | null): string | null {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toISOString()
}

function localDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function buildSnapshot(args: {
  inventory: InventoryRow[]
  events: FridgeEvent[]
  /** food name (lowercase) → catalog category */
  catalog: Map<string, string | null>
  overrides: Overrides
  now?: number
}): FridgeSnapshot {
  const { inventory, events, catalog, overrides } = args
  const now = args.now ?? Date.now()
  const categoryOf = (name: string, dbCategory?: string | null): FoodCategory =>
    categorize(dbCategory ?? catalog.get(name.toLowerCase()), name)

  const items: FridgeItem[] = inventory.map(row => ({
    id: row.id,
    name: row.name,
    category: categoryOf(row.name, row.foods?.category),
    source: null,
    quantity: row.quantity,
    added_at: row.added_at,
    expires_at: dateToIso(row.expires_on),
    status: 'in_fridge',
    removed_at: null,
    image_url: null,
  }))

  const applied = events
    .filter(e => e.status === 'applied')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const time = (e: FridgeEvent) => new Date(e.created_at).getTime()
  const sameItem = (a: FridgeEvent, b: FridgeEvent) => a.item_name.toLowerCase() === b.item_name.toLowerCase()

  // An "out" is undone in real life when the same item goes back in within the grace period.
  const returnedBy = new Map<string, FridgeEvent>() // out event id → the "in" that brought it back
  const returnIns = new Set<string>()
  for (const out of applied) {
    if (out.action !== 'out' || !out.matched) continue
    const back = applied.find(e =>
      e.action === 'in' && !returnIns.has(e.id) && sameItem(e, out) &&
      time(e) > time(out) && time(e) - time(out) <= GRACE_MS)
    if (back) {
      returnedBy.set(out.id, back)
      returnIns.add(back.id)
    }
  }

  const activity: ActivityEntry[] = []
  const entry = (e: FridgeEvent, over: Partial<ActivityEntry>): ActivityEntry => ({
    id: e.id,
    kind: 'added',
    itemName: e.item_name,
    category: categoryOf(e.item_name),
    source: null,
    at: e.created_at,
    via: e.source,
    quantity: e.quantity,
    confidence: e.confidence,
    rawLabel: e.raw_label && e.raw_label.toLowerCase() !== e.item_name.toLowerCase() ? e.raw_label : null,
    undone: e.status === 'undone',
    eventId: e.status === 'applied' ? e.id : null,
    ...over,
  })

  for (const e of events) {
    if (e.action === 'in') {
      activity.push(entry(e, { kind: returnIns.has(e.id) ? 'returned' : 'added' }))
      continue
    }
    if (e.status === 'undone' || !e.matched) {
      activity.push(entry(e, { kind: 'removed' }))
      continue
    }

    const override = overrides[e.id]
    const pending = e.source === 'camera' && !override && now - time(e) < GRACE_MS && !returnedBy.has(e.id)
    const leftExpired = !!e.expires_on && e.expires_on < localDate(e.created_at)
    const resolved = override ?? (leftExpired ? 'expired' : 'consumed')
    const lastIn = applied.filter(x => x.action === 'in' && sameItem(x, e) && time(x) <= time(e)).pop()

    if (!returnedBy.has(e.id)) {
      items.push({
        id: `out:${e.id}`,
        name: e.item_name,
        category: categoryOf(e.item_name),
        source: null,
        quantity: e.quantity,
        added_at: lastIn?.created_at ?? e.created_at,
        expires_at: dateToIso(e.expires_on),
        status: pending ? 'pending_removal' : resolved,
        removed_at: e.created_at,
        image_url: null,
        eventId: e.id,
      })
    }

    if (e.source === 'camera') {
      activity.push(entry(e, { kind: 'removed' }))
      if (!pending && !returnedBy.has(e.id)) {
        const at = override ? e.created_at : new Date(time(e) + GRACE_MS).toISOString()
        activity.push(entry(e, { id: `${e.id}:resolved`, kind: resolved, at, via: override ? 'manual' : 'system', eventId: null }))
      }
    } else {
      activity.push(entry(e, { kind: resolved }))
    }
  }

  activity.sort((a, b) => b.at.localeCompare(a.at))
  return { items, activity }
}
