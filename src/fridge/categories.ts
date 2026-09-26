import type { MaterialCommunityIcons } from '@expo/vector-icons'
import type { FoodCategory } from './types'

type IconName = keyof typeof MaterialCommunityIcons.glyphMap

// Category hues deliberately avoid green / amber / red, which mean freshness everywhere.
export const CATEGORIES: Record<FoodCategory, { label: string; icon: IconName; color: string; tint: string }> = {
  meat:      { label: 'Meat & fish', icon: 'food-drumstick',      color: '#8e5b8c', tint: '#f4ecf4' },
  dairy:     { label: 'Dairy',       icon: 'cheese',              color: '#3f7fb3', tint: '#eaf2f9' },
  produce:   { label: 'Produce',     icon: 'carrot',              color: '#2b8a93', tint: '#e6f4f5' },
  takeout:   { label: 'Takeout',     icon: 'food-takeout-box',    color: '#a0694a', tint: '#f6eee9' },
  beverage:  { label: 'Drinks',      icon: 'bottle-soda-classic', color: '#5967c0', tint: '#eceefa' },
  condiment: { label: 'Condiments',  icon: 'shaker-outline',      color: '#7a68a8', tint: '#f0edf7' },
  other:     { label: 'Other',       icon: 'food-variant',        color: '#627581', tint: '#eef1f3' },
}

export const CATEGORY_ORDER: FoodCategory[] = ['meat', 'dairy', 'produce', 'takeout', 'beverage', 'condiment', 'other']

/** The fridge's shelves, top to bottom. Used for the "By shelf" dashboard view. */
export const SHELVES: { title: string; categories: FoodCategory[] }[] = [
  { title: 'Top shelf', categories: ['dairy', 'other'] },
  { title: 'Middle shelf', categories: ['meat', 'takeout'] },
  { title: 'Crisper drawer', categories: ['produce'] },
  { title: 'Door', categories: ['beverage', 'condiment'] },
]

// Categories in the foods table (supabase/migrations) → dashboard categories.
const DB_CATEGORY: Record<string, FoodCategory> = {
  meat: 'meat',
  seafood: 'meat',
  dairy: 'dairy',
  produce: 'produce',
  prepared: 'takeout',
  drinks: 'beverage',
  condiment: 'condiment',
}

// Fallback when an item has no catalog match: guess from its name.
const KEYWORDS: [FoodCategory, RegExp][] = [
  ['takeout', /takeout|take-out|leftover|chipotle|pizza|burrito|sushi|thai|pad |curry|ramen|noodle|wings|fries|kebab|shawarma|burger|dumpling|to-go/],
  ['meat', /chicken|beef|pork|bacon|ham|turkey|steak|sausage|salami|fish|salmon|tuna|shrimp|deli/],
  ['dairy', /milk|cheese|yogh?urt|butter|cream|egg|kefir/],
  ['produce', /lettuce|spinach|kale|berr|apple|grape|carrot|broccoli|tomato|avocado|pepper|cucumber|onion|lemon|lime|herb|cilantro|basil|fruit|veg|salad|melon|mushroom/],
  ['beverage', /juice|soda|water|beer|wine|kombucha|coffee|tea|lemonade|drink/],
  ['condiment', /ketchup|mayo|mustard|sauce|sriracha|dressing|jam|salsa|relish|pickle/],
]

export function categorize(dbCategory: string | null | undefined, name: string): FoodCategory {
  if (dbCategory && DB_CATEGORY[dbCategory.toLowerCase()]) return DB_CATEGORY[dbCategory.toLowerCase()]
  const n = name.toLowerCase()
  return KEYWORDS.find(([, re]) => re.test(n))?.[0] ?? 'other'
}

/** "chipotle leftovers" → "Chipotle leftovers" (the database stores names lowercased). */
export function displayName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}
