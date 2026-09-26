// Recipe ideas that use up what's expiring in the next couple of days.
//
// Live mode first asks the suggest-recipes Edge Function (AI ideas, cached per household and
// only regenerated when the expiring list changes). If that isn't deployed, has no LLM key, or
// fails, and always in mock mode, it falls back to TheMealDB's free "filter by main ingredient"
// API, ranking meals that use more of the expiring items higher.
//
// TheMealDB: the test key "1" is allowed during development and for educational use; releasing
// publicly on an app store requires becoming a supporter (https://www.themealdb.com/api.php).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { EXPIRING_SOON_DAYS, USE_MOCK_DATA } from './config'
import { daysUntil } from './freshness'
import type { FoodCategory, FridgeItem } from './types'

export type Recipe = {
  id: string
  title: string
  /** Which expiring items it uses (lowercase names). */
  uses: string[]
  /** One line on how (AI ideas only). */
  summary?: string
  image?: string
  url?: string
}

export type RecipeState =
  | { status: 'empty' }
  | { status: 'loading'; expiring: string[] }
  | { status: 'ready'; expiring: string[]; recipes: Recipe[]; source: 'ai' | 'mealdb' }
  | { status: 'none'; expiring: string[] }   // looked, found nothing that fits
  | { status: 'error'; expiring: string[] }

type Expiring = { name: string; category: FoodCategory }

/** In-fridge items dated today through EXPIRING_SOON_DAYS, soonest first; not already expired. */
export function expiringItems(items: FridgeItem[], now = new Date()): Expiring[] {
  const seen = new Set<string>()
  return items
    .filter(i => i.status === 'in_fridge' && i.location !== 'freezer')
    .map(i => ({ name: i.name.toLowerCase(), category: i.category, d: daysUntil(i.expires_at, now) }))
    .filter((x): x is Expiring & { d: number } => x.d !== null && x.d >= 0 && x.d <= EXPIRING_SOON_DAYS)
    .sort((a, b) => a.d - b.d || a.name.localeCompare(b.name))
    .filter(x => !seen.has(x.name) && !!seen.add(x.name))
    .map(({ name, category }) => ({ name, category }))
}

// Ready-made food isn't an ingredient TheMealDB can search (the AI path still gets it: leftovers).
const COOKABLE = (c: FoodCategory) => c !== 'takeout' && c !== 'beverage' && c !== 'condiment'

// ---- TheMealDB fallback ----------------------------------------------------

const MEALDB = 'https://www.themealdb.com/api/json/v1/1'
const MAX_INGREDIENTS = 4
// Names TheMealDB only knows by a longer form.
const ALIAS: Record<string, string> = { cheddar: 'cheddar cheese', mozzarella: 'mozzarella', parmesan: 'parmesan cheese', 'sharp cheddar': 'cheddar cheese' }

type MealRef = { idMeal: string; strMeal: string; strMealThumb?: string }

async function getJson(url: string, ms = 8000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** "Baby spinach" → spinach, "Avocados" → avocado, "Sharp cheddar" → cheddar cheese. */
function candidates(name: string): string[] {
  const words = name.toLowerCase().replace(/[^a-z ]/g, ' ').trim().split(/\s+/).filter(Boolean)
  const full = words.join(' ')
  const last = words[words.length - 1] ?? ''
  const flip = (s: string) => (s.endsWith('s') ? s.slice(0, -1) : `${s}s`)
  const list = [ALIAS[full], full, flip(full), ALIAS[last], last, flip(last)]
  return [...new Set(list.filter((s): s is string => !!s && s.length > 2))].slice(0, 5)
}

// Per-session memo: ingredient → meals (null = TheMealDB doesn't know it).
const byIngredient = new Map<string, Promise<MealRef[] | null>>()

function mealsFor(name: string): Promise<MealRef[] | null> {
  if (!byIngredient.has(name)) {
    byIngredient.set(name, (async () => {
      for (const c of candidates(name)) {
        const data = await getJson(`${MEALDB}/filter.php?i=${encodeURIComponent(c.replace(/ /g, '_'))}`)
        if (Array.isArray(data?.meals) && data.meals.length) return data.meals as MealRef[]
      }
      return null
    })())
    // A network failure shouldn't be remembered as "no recipes".
    byIngredient.get(name)!.catch(() => byIngredient.delete(name))
  }
  return byIngredient.get(name)!
}

export async function mealDbRecipes(expiring: Expiring[]): Promise<Recipe[]> {
  const names = expiring.filter(e => COOKABLE(e.category)).map(e => e.name).slice(0, MAX_INGREDIENTS)
  if (!names.length) return []
  const results = await Promise.allSettled(names.map(mealsFor))
  if (results.every(r => r.status === 'rejected')) throw new Error('TheMealDB unreachable')

  // Score each meal by how many expiring items it uses; earlier (sooner-expiring) items break ties.
  const meals = new Map<string, { ref: MealRef; uses: string[]; first: number }>()
  results.forEach((r, idx) => {
    if (r.status !== 'fulfilled' || !r.value) return
    for (const ref of r.value) {
      const m = meals.get(ref.idMeal) ?? { ref, uses: [], first: idx }
      m.uses.push(names[idx])
      meals.set(ref.idMeal, m)
    }
  })
  // Prefer variety: at most one single-ingredient pick per expiring item.
  const ranked = [...meals.values()].sort((a, b) => b.uses.length - a.uses.length || a.first - b.first || a.ref.strMeal.localeCompare(b.ref.strMeal))
  const picked: typeof ranked = []
  const covered = new Set<string>()
  for (const m of ranked) {
    if (picked.length === 3) break
    if (m.uses.length === 1 && covered.has(m.uses[0])) continue
    picked.push(m)
    m.uses.forEach(u => covered.add(u))
  }
  for (const m of ranked) if (picked.length < 3 && !picked.includes(m)) picked.push(m)
  return picked.map(m => ({
    id: `mealdb:${m.ref.idMeal}`,
    title: m.ref.strMeal,
    uses: m.uses,
    image: m.ref.strMealThumb ? `${m.ref.strMealThumb}/small` : undefined,
    url: `https://www.themealdb.com/meal/${m.ref.idMeal}`,
  }))
}

// ---- AI ideas via Edge Function ----------------------------------------------

async function aiRecipes(householdId: string, expiring: string[]): Promise<Recipe[] | null> {
  const { data, error } = await supabase.functions.invoke('suggest-recipes', { body: { household_id: householdId, items: expiring } })
  if (error || !Array.isArray(data?.recipes)) return null
  const recipes = (data.recipes as any[])
    .filter(r => typeof r?.title === 'string')
    .slice(0, 3)
    .map((r, i): Recipe => ({
      id: `ai:${i}:${r.title}`,
      title: r.title,
      uses: Array.isArray(r.uses) ? r.uses.filter((u: unknown) => typeof u === 'string').map((u: string) => u.toLowerCase()) : [],
      summary: typeof r.summary === 'string' ? r.summary : undefined,
    }))
  return recipes.length ? recipes : null
}

// ---- Hook ------------------------------------------------------------------------

/** Recipe ideas for what's expiring soon. Refetches only when the expiring list changes. */
export function useRecipes(items: FridgeItem[], householdId: string | undefined, now: Date): RecipeState & { retry: () => void } {
  const expiringList = useMemo(() => expiringItems(items, now), [items, now])
  const key = expiringList.map(e => `${e.name}:${e.category}`).join('|')
  const expiring = useMemo(() => (key ? key.split('|').map(k => k.split(':')[0]) : []), [key])
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ key: string; value: RecipeState } | null>(null)

  // A result belongs to one expiring list and one attempt; anything else renders as loading.
  const request = `${key}#${attempt}`

  useEffect(() => {
    if (!key) return
    const list = key.split('|').map(k => { const [name, category] = k.split(':'); return { name, category: category as FoodCategory } })
    const names = list.map(e => e.name)
    let live = true
    ;(async () => {
      const ai = !USE_MOCK_DATA && householdId ? await aiRecipes(householdId, names).catch(() => null) : null
      if (ai) return { status: 'ready', expiring: names, recipes: ai, source: 'ai' } as const
      const found = await mealDbRecipes(list)
      return found.length
        ? ({ status: 'ready', expiring: names, recipes: found, source: 'mealdb' } as const)
        : ({ status: 'none', expiring: names } as const)
    })()
      .catch((): RecipeState => ({ status: 'error', expiring: names }))
      .then(value => { if (live) setState({ key: request, value }) })
    return () => { live = false }
  }, [key, request, householdId])

  const retry = useCallback(() => setAttempt(a => a + 1), [])
  if (!key) return { status: 'empty', retry }
  const value = state?.key === request ? state.value : { status: 'loading' as const, expiring }
  return { ...value, retry }
}
