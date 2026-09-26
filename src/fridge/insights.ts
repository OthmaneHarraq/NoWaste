// Purchasing insights: "You've thrown out spinach 3 times this month, try buying it frozen."
//
// The templated insights below are the default and need nothing external. In live mode the
// card also asks the generate-insights Edge Function, which returns AI-written sentences when
// an LLM key is configured there (and caches them server-side for hours). Any failure, no key,
// or the function not being deployed just keeps the templated version.

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CATEGORIES } from './categories'
import { USE_MOCK_DATA } from './config'
import { wastePatterns, type WastePatterns } from './stats'
import type { FoodCategory, FridgeItem } from './types'

export type Insights = { lines: string[]; source: 'template' | 'ai' }

// Produce that is sold frozen and cooks the same: worth suggesting the frozen version.
const SOLD_FROZEN = /spinach|kale|berr|peas|broccoli|corn|mango|pineapple|cherr|cauliflower|green beans|edamame/

const TIP: Record<FoodCategory, string> = {
  meat: 'If you won’t cook it within 2 days, freeze it the day you buy it.',
  dairy: 'Try a smaller size, and keep the open one at the front of the shelf.',
  produce: 'Try buying less at a time, or shopping for it twice a week instead of once.',
  takeout: 'Order a little less, or plan a leftovers night within 3 days.',
  beverage: 'Smaller bottles waste less once they’re opened.',
  condiment: 'Check the door before buying another. Opened sauces last a long time.',
  other: 'Label containers with the day you made them, and eat the oldest first.',
}

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`)

/** 1–3 short, specific sentences from the waste stats alone. */
export function templateInsights(p: WastePatterns): string[] {
  if (p.wasted === 0) {
    return p.saved > 0
      ? [`Nothing wasted in the last ${p.days} days, and ${p.saved} item${p.saved === 1 ? '' : 's'} eaten in time. Keep it up.`]
      : ['Insights show up once a few things have left the fridge.']
  }

  const lines: string[] = []
  const [top, second] = p.items
  if (top && top.wasted >= 2) {
    const tip = top.category === 'produce' && SOLD_FROZEN.test(top.name)
      ? (top.name.endsWith('s')
        ? 'Try buying them frozen: they keep for months and cook the same.'
        : 'Try buying it frozen: it keeps for months and cooks the same.')
      : TIP[top.category]
    lines.push(`You’ve wasted ${top.name} ${times(top.wasted)} in the last ${p.days} days. ${tip}`)
    if (second && second.wasted >= 2) {
      const tip = second.category === top.category ? '' : ` ${TIP[second.category]}`
      lines.push(`${cap(second.name)} went to waste ${times(second.wasted)} as well.${tip}`)
    }
  }

  const cat = p.categories[0]
  if (cat && cat.count >= 2 && (lines.length === 0 || cat.category !== top?.category)) {
    const share = Math.round((cat.count / p.wasted) * 100)
    lines.push(`${CATEGORIES[cat.category].label} ${share >= 50 ? 'is' : 'makes up'} ${share}% of what went to waste. ${TIP[cat.category]}`)
  }

  if (lines.length === 0) {
    lines.push(`${p.wasted} item${p.wasted === 1 ? '' : 's'} went to waste in the last ${p.days} days, with no repeat offenders. Nice.`)
  }
  return lines.slice(0, 3)
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// One Edge Function call per distinct set of stats per app session; the server caches too.
const aiCache = new Map<string, Promise<string[] | null>>()

function fetchAiInsights(householdId: string, patterns: WastePatterns, key: string) {
  if (!aiCache.has(key)) {
    aiCache.set(key, (async () => {
      const { data, error } = await supabase.functions.invoke('generate-insights', { body: { household_id: householdId, patterns } })
      const lines = !error && Array.isArray(data?.insights) ? (data.insights as unknown[]).filter(l => typeof l === 'string') as string[] : []
      return lines.length ? lines.slice(0, 3) : null
    })().catch(() => null))
  }
  return aiCache.get(key)!
}

/** Insights for the Impact page. Always returns something immediately (the template). */
export function useInsights(history: FridgeItem[], householdId: string | undefined, now: Date): Insights {
  // `now` ticks every minute; only recompute the key when the stats themselves change.
  const patterns = useMemo(() => wastePatterns(history, 30, now), [history, now])
  const key = JSON.stringify([householdId, patterns])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const template = useMemo(() => templateInsights(patterns), [key])
  const [ai, setAi] = useState<{ key: string; lines: string[] } | null>(null)

  useEffect(() => {
    // Nothing to explain → no call. Mock mode never talks to Supabase.
    if (USE_MOCK_DATA || !householdId || patterns.wasted === 0) return
    let live = true
    fetchAiInsights(householdId, patterns, key).then(lines => {
      if (live && lines) setAi({ key, lines })
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return ai?.key === key ? { lines: ai.lines, source: 'ai' } : { lines: template, source: 'template' }
}
