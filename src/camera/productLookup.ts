import { supabase } from '@/lib/supabase'

export type Product = {
  code: string
  /** Lowercase name used in the inventory, e.g. "horizon organic 2% milk". */
  name: string
  source: 'saved' | 'openfoodfacts'
  brand?: string
  quantity?: string
  imageUrl?: string
}

/**
 * Barcode → product name.
 *   1. Barcodes this household already knows (saved as food_aliases: alias = barcode)
 *   2. Open Food Facts (free product database), then saved so we never look it up again
 *   3. null → the UI asks the user to name it, then calls saveBarcode()
 *
 * Open Food Facts allows ~15 lookups/minute per IP, which is why step 1 matters.
 */
export async function lookupBarcode(householdId: string, code: string): Promise<Product | null> {
  const { data: saved } = await supabase
    .from('food_aliases')
    .select('item_name')
    .eq('household_id', householdId)
    .eq('alias', code)
    .maybeSingle()
  if (saved) return { code, name: saved.item_name, source: 'saved' }

  const product = await fetchOpenFoodFacts(code)
  if (!product) return null
  await saveBarcode(householdId, code, product.name, product.shelfDays)
  return { code, name: product.name, source: 'openfoodfacts', brand: product.brand, quantity: product.quantity, imageUrl: product.imageUrl }
}

/** Remember what a barcode is (and optionally its fridge life) for the whole household. */
export async function saveBarcode(householdId: string, code: string, name: string, shelfDays?: number | null) {
  const item = name.trim().toLowerCase()
  await supabase.from('food_aliases').upsert({ household_id: householdId, alias: code, item_name: item })
  if (shelfDays) {
    // A household food with a shelf life makes record_event fill in the expiry date.
    // If the household already has this food, the insert fails on the unique name
    // rule and we keep their existing shelf life, which is what we want.
    await supabase.from('foods').insert({ household_id: householdId, name: item, shelf_days: shelfDays })
  }
}

type OffProduct = { name: string; brand?: string; quantity?: string; imageUrl?: string; shelfDays: number | null }

async function fetchOpenFoodFacts(code: string): Promise<OffProduct | null> {
  const fields = 'product_name,generic_name,brands,quantity,categories_tags,image_front_small_url'
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`)
    if (!res.ok) return null
    const body = await res.json()
    const p = body?.product
    if (body?.status !== 1 || !p) return null

    const brand: string | undefined = p.brands?.split(',')[0]?.trim() || undefined
    const baseName: string = (p.product_name || p.generic_name || '').trim()
    if (!baseName) return null
    // "Horizon" + "Organic 2% Milk" → "horizon organic 2% milk" (don't repeat the brand if it's already there)
    const name = brand && !baseName.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${baseName}` : baseName

    return {
      name: name.toLowerCase(),
      brand,
      quantity: p.quantity || undefined,
      imageUrl: p.image_front_small_url || undefined,
      shelfDays: shelfDaysFromCategories(p.categories_tags ?? []),
    }
  } catch {
    return null // offline, blocked, or unexpected reply: treat as unknown
  }
}

/**
 * Rough fridge life (days, once opened / typical) from Open Food Facts categories.
 * First match wins, so specific categories come before general ones.
 */
const SHELF_LIFE_RULES: [RegExp, number][] = [
  [/fish|seafood|shrimp/, 2],
  [/chicken|poultry|ground-meat|minced/, 2],
  [/meats|sausages|ham|bacon|deli/, 5],
  [/eggs/, 28],
  [/milks|milk-drinks|creams/, 7],
  [/yogurts|yoghurts|fermented-milk/, 14],
  [/cream-cheeses|fresh-cheeses|ricotta|cottage/, 10],
  [/cheeses/, 21],
  [/butters/, 30],
  [/juices|smoothies/, 7],
  [/hummus|dips|salads|prepared-meals|ready-meals/, 5],
  [/tofu/, 5],
  [/fresh-fruits|fresh-vegetables|fruits|vegetables/, 7],
  [/sauces|condiments|ketchup|mustard|mayonnaise|dressings|jams|pickles/, 90],
  [/beverages|sodas|waters/, 30],
]

export function shelfDaysFromCategories(tags: string[]): number | null {
  const joined = tags.join(' ')
  for (const [pattern, days] of SHELF_LIFE_RULES) if (pattern.test(joined)) return days
  return null
}
