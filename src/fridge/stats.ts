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
