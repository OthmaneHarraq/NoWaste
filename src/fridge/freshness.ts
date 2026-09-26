import { EXPIRING_SOON_DAYS } from './config'
import type { FridgeItem } from './types'

export type Freshness = 'fresh' | 'soon' | 'expired' | 'unknown'

const DAY = 86_400_000

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Calendar days until the date (0 = today, negative = past), or null when unknown. */
export function daysUntil(iso: string | null, now = new Date()): number | null {
  if (!iso) return null
  return Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / DAY)
}

export function freshnessOf(item: Pick<FridgeItem, 'expires_at'>, now = new Date()): Freshness {
  const d = daysUntil(item.expires_at, now)
  if (d === null) return 'unknown'
  if (d < 0) return 'expired'
  if (d <= EXPIRING_SOON_DAYS) return 'soon'
  return 'fresh'
}

/** "3 days left", "Expires today", "Expired 2 days ago". */
export function expiryLabel(item: Pick<FridgeItem, 'expires_at'>, now = new Date()): string {
  const d = daysUntil(item.expires_at, now)
  if (d === null) return 'No date'
  if (d === 0) return 'Expires today'
  if (d === 1) return 'Expires tomorrow'
  if (d > 1) return `${d} days left`
  if (d === -1) return 'Expired yesterday'
  return `Expired ${-d} days ago`
}

export const isCurrent = (i: FridgeItem) => i.status === 'in_fridge' || i.status === 'pending_removal'
export const isWasted = (i: FridgeItem) => i.status === 'expired' || i.status === 'thrown_away'

/** The items that need a human: expiring soon or already expired, worst first. */
export function needsAction(items: FridgeItem[], now = new Date()): FridgeItem[] {
  return items
    .filter(i => i.status === 'in_fridge')
    .filter(i => {
      const f = freshnessOf(i, now)
      return f === 'soon' || f === 'expired'
    })
    .sort((a, b) => (daysUntil(a.expires_at, now) ?? 0) - (daysUntil(b.expires_at, now) ?? 0))
}

export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  const days = Math.round(hrs / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

/**
 * How much of its life an item has left, 1 → 0 (added → expiry). Drives the Fridge view's
 * ring. Purely visual: freshness itself is still decided by freshnessOf() above.
 * null when the item has no date.
 */
export function lifeLeft(item: Pick<FridgeItem, 'added_at' | 'expires_at'>, now = new Date()): number | null {
  if (!item.expires_at) return null
  const start = new Date(item.added_at).getTime()
  const end = new Date(item.expires_at).getTime()
  if (end <= start) return 0
  return Math.min(1, Math.max(0, (end - now.getTime()) / (end - start)))
}
