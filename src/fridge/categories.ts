import type { MaterialCommunityIcons } from '@expo/vector-icons'
import type { FoodCategory, FridgeLocation } from './types'

type IconName = keyof typeof MaterialCommunityIcons.glyphMap

// Category hues deliberately avoid green / amber / red, which mean freshness everywhere.
// tint = the tile behind a category's icon/food; tintDark = the same hue as a deep wash for dark mode.
export const CATEGORIES: Record<FoodCategory, { label: string; icon: IconName; color: string; tint: string; tintDark: string }> = {
  meat:      { label: 'Meat & fish', icon: 'food-drumstick',      color: '#8e5b8c', tint: '#f4ecf4', tintDark: '#2a2130' },
  dairy:     { label: 'Dairy',       icon: 'cheese',              color: '#3f7fb3', tint: '#eaf2f9', tintDark: '#1b2733' },
  produce:   { label: 'Produce',     icon: 'carrot',              color: '#2b8a93', tint: '#e6f4f5', tintDark: '#172a2b' },
  takeout:   { label: 'Takeout',     icon: 'food-takeout-box',    color: '#a0694a', tint: '#f6eee9', tintDark: '#2b231d' },
  beverage:  { label: 'Drinks',      icon: 'bottle-soda-classic', color: '#5967c0', tint: '#eceefa', tintDark: '#1f2235' },
  condiment: { label: 'Condiments',  icon: 'shaker-outline',      color: '#7a68a8', tint: '#f0edf7', tintDark: '#252235' },
  other:     { label: 'Other',       icon: 'food-variant',        color: '#627581', tint: '#eef1f3', tintDark: '#212829' },
}

export const CATEGORY_ORDER: FoodCategory[] = ['meat', 'dairy', 'produce', 'takeout', 'beverage', 'condiment', 'other']

/** Every location, top to bottom (bottom-freezer fridge). Used for the "By shelf" view. */
export const LOCATIONS: { id: FridgeLocation; title: string }[] = [
  { id: 'top_shelf', title: 'Top shelf' },
  { id: 'middle_shelf', title: 'Middle shelf' },
  { id: 'drawer', title: 'Crisper drawer' },
  { id: 'door', title: 'Door' },
  { id: 'freezer', title: 'Freezer' },
]

// Where each category lives in the fridge. Nothing goes to the freezer by default.
const HOME: Record<FoodCategory, Exclude<FridgeLocation, 'freezer'>> = {
  dairy: 'top_shelf',
  other: 'top_shelf',
  meat: 'middle_shelf',
  takeout: 'middle_shelf',
  produce: 'drawer',
  beverage: 'door',
  condiment: 'door',
}

export const defaultLocation = (category: FoodCategory) => HOME[category]

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

// Fallback when an item has no catalog match: guess from its name. First match wins, so
// specific phrases come first (the same idea as FoodShape's MATCH list): a "… sauce" or
// "peanut butter" is a condiment before "fish"/"butter" can make it meat/dairy, prepared
// salads are takeout before "chicken"/"tuna" make them meat, and drinks come before
// produce so orange juice isn't a fruit.
const KEYWORDS: [FoodCategory, RegExp][] = [
  ['condiment', /\bsauce|ketchup|mayo|mustard|sriracha|dressing|ranch|vinaigrette|\bjam\b|jelly|marmalade|salsa|relish|pickle|pesto|peanut butter|almond butter|nut butter|\bhoney\b|syrup/],
  ['takeout', /takeout|take-out|leftover|chipotle|pizza|burrito|sushi|thai|pad |curry|ramen|noodle|wings|fries|kebab|shawarma|burger|dumpling|to-go|nugget|(chicken|tuna|egg|pasta|potato) salad/],
  ['beverage', /juice|soda|\bwater\b|beer|wine|kombucha|coffee|\btea\b|lemonade|drink|seltzer|\bcola\b|smoothie/],
  ['meat', /chicken|beef|pork|bacon|\bham\b|turkey|steak|sausage|salami|hot dog|\bfranks?\b|meatball|lamb|veal|chorizo|prosciutto|fish|salmon|tuna|\bcod\b|shrimp|prawn|crab|lobster|scallop|deli/],
  ['dairy', /milk|cheese|pepper jack|cheddar|mozzarella|parmesan|feta|brie|gouda|ricotta|halloumi|camembert|burrata|yogh?urt|skyr|kefir|butter|cream|\beggs?\b/],
  ['produce', /lettuce|spinach|kale|berr|apple|grape|carrot|broccoli|tomato|avocado|pepper|cucumber|onion|lemon|lime|herb|cilantro|basil|fruit|veg|salad|melon|mushroom|mango|peach|\bpears?\b|orange|banana|kiwi|plum|cherr|pineapple|nectarine|apricot|papaya|clementine|tangerine|mandarin|celery|scallion|zucchini|eggplant|aubergine|\bcorn\b|potato|garlic|leek|cabbage|cauliflower|\bpeas?\b/],
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
