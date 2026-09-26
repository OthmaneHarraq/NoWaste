import { CATEGORY_ORDER } from './categories'
import { isWasted } from './freshness'
import type { FoodCategory, FridgeItem } from './types'

const DAY = 86_400_000

export type DayStat = { date: Date; saved: number; wasted: number }

function dayStart(d: Date | string) {
  const x = new Date(d)
  return new Date(x.getFullYear(), x.getMonth(), x.getDate())
}

/** Saved (used in time) vs wasted items per day, oldest first, ending today. */
export function dailySeries(history: FridgeItem[], days: number, now = new Date()): DayStat[] {
  const today = dayStart(now).getTime()
  const series: DayStat[] = Array.from({ length: days }, (_, i) => ({ date: new Date(today - (days - 1 - i) * DAY), saved: 0, wasted: 0 }))
  for (const item of history) {
    if (!item.removed_at) continue
    const idx = days - 1 - Math.round((today - dayStart(item.removed_at).getTime()) / DAY)
    if (idx < 0 || idx >= days) continue
    if (isWasted(item)) series[idx].wasted += item.quantity
    else if (item.status === 'consumed') series[idx].saved += item.quantity
  }
  return series
}

export function wastedByCategory(history: FridgeItem[]): { category: FoodCategory; count: number }[] {
  const counts = new Map<FoodCategory, number>()
  for (const i of history) if (isWasted(i)) counts.set(i.category, (counts.get(i.category) ?? 0) + i.quantity)
  return CATEGORY_ORDER.map(category => ({ category, count: counts.get(category) ?? 0 }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count)
}

export function totals(history: FridgeItem[]) {
  let saved = 0
  let wasted = 0
  for (const i of history) {
    if (isWasted(i)) wasted += i.quantity
    else if (i.status === 'consumed') saved += i.quantity
  }
  const rate = saved + wasted === 0 ? null : saved / (saved + wasted)
  return { saved, wasted, rate }
}

/** Whole days since anything was wasted (null = never wasted anything). */
export function wasteFreeStreak(history: FridgeItem[], now = new Date()): number | null {
  const last = history
    .filter(i => isWasted(i) && i.removed_at)
    .reduce<number | null>((max, i) => Math.max(max ?? 0, new Date(i.removed_at!).getTime()), null)
  if (last === null) return null
  return Math.round((dayStart(now).getTime() - dayStart(new Date(last)).getTime()) / DAY)
}

/** Waste in the last 7 days vs the 7 before, e.g. -0.6 = 60% less waste. */
export function weekOverWeek(history: FridgeItem[], now = new Date()): number | null {
  const s = dailySeries(history, 14, now)
  const prev = s.slice(0, 7).reduce((n, d) => n + d.wasted, 0)
  const last = s.slice(7).reduce((n, d) => n + d.wasted, 0)
  if (prev === 0) return null
  return (last - prev) / prev
}

export type WastePatterns = {
  days: number
  saved: number
  wasted: number
  /** Most-wasted foods, worst first (at most 5). */
  items: { name: string; category: FoodCategory; wasted: number; saved: number }[]
  categories: { category: FoodCategory; count: number }[]
}

/** What keeps getting wasted over the last `days`: the input to purchasing insights. */
export function wastePatterns(history: FridgeItem[], days = 30, now = new Date()): WastePatterns {
  const since = dayStart(now).getTime() - (days - 1) * DAY
  const recent = history.filter(i => i.removed_at && new Date(i.removed_at).getTime() >= since)
  const byName = new Map<string, WastePatterns['items'][number]>()
  for (const i of recent) {
    const key = i.name.toLowerCase()
    const row = byName.get(key) ?? { name: key, category: i.category, wasted: 0, saved: 0 }
    if (isWasted(i)) row.wasted += i.quantity
    else if (i.status === 'consumed') row.saved += i.quantity
    byName.set(key, row)
  }
  const items = [...byName.values()]
    .filter(r => r.wasted > 0)
    .sort((a, b) => b.wasted - a.wasted || a.saved - b.saved || a.name.localeCompare(b.name))
    .slice(0, 5)
  const { saved, wasted } = totals(recent)
  return { days, saved, wasted, items, categories: wastedByCategory(recent) }
}
