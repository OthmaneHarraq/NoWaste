import type { FoodCategory, FridgeLocation } from './types'

// Rule-of-thumb shelf life in days, fridge vs freezer. Approximate and for demo purposes,
// not food-safety advice. Used when the backend has no date for an item, and always for
// the freezer (the catalog's shelf_days assumes the fridge).
export const SHELF_LIFE_DAYS: Record<FoodCategory, { fridge: number; freezer: number }> = {
  meat:      { fridge: 4,  freezer: 180 }, // ~6 months
  dairy:     { fridge: 10, freezer: 60 },  // ~2 months
  produce:   { fridge: 6,  freezer: 270 }, // ~9 months
  takeout:   { fridge: 3,  freezer: 60 },  // ~2 months
  beverage:  { fridge: 14, freezer: 120 }, // ~4 months
  condiment: { fridge: 30, freezer: 120 }, // ~4 months
  other:     { fridge: 7,  freezer: 90 },  // ~3 months
}

/** `location` is any fridge spot (or just 'fridge'), or 'freezer'. */
export function shelfLifeDays(category: FoodCategory, location: FridgeLocation | 'fridge'): number {
  const life = SHELF_LIFE_DAYS[category]
  return location === 'freezer' ? life.freezer : life.fridge
}

/**
 * Estimated expiry: `from` + shelf life for this category in this location.
 * `from` is normally the item's added_at; for something taken out of the freezer it's
 * the moment it came out (the thaw clock starts then). Dates land at local noon.
 */
export function estimateExpiry(category: FoodCategory, location: FridgeLocation | 'fridge', from: string | Date): string {
  const d = new Date(from)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + shelfLifeDays(category, location), 12).toISOString()
}
