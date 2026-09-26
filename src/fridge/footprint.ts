// Environmental footprint of food that left the fridge. Fixed reference data, not user data,
// so it lives in code. Every number here is a rough, directionally-right estimate: the UI
// always labels these stats "est." and nothing should be read as precise.
//
// Sources (category averages, rounded):
//   kg CO2e / kg   Poore & Nemecek (2018), Science, via Our World in Data "Food: greenhouse
//                  gas emissions across the supply chain". Meat is a beef/pork/poultry/fish mix.
//   L water / kg   Mekonnen & Hoekstra (2010–2012), Water Footprint Network product totals.
//   kg per item    a typical pack: a chicken tray, a tub of yogurt, a bag of spinach…
//   Car miles      US EPA: a typical passenger vehicle emits ~400 g CO2 per mile.
//   Compost        US EPA WARM: food scraps composted instead of landfilled avoid roughly
//                  0.7 kg CO2e per kg, almost all of it landfill methane.

import { isWasted } from './freshness'
import type { FoodCategory, FridgeItem } from './types'

/** 'yes' = home or curbside compost. 'municipal' = only if the city's food-scrap
 *  program takes it (meat, dairy, cooked food attract pests in a home bin). 'no' = liquids. */
export type Compostable = 'yes' | 'municipal' | 'no'

export const FOOTPRINT: Record<FoodCategory, { co2PerKg: number; waterLPerKg: number; kgPerItem: number; compostable: Compostable }> = {
  meat:      { co2PerKg: 20,  waterLPerKg: 6000, kgPerItem: 0.5, compostable: 'municipal' },
  dairy:     { co2PerKg: 5,   waterLPerKg: 1500, kgPerItem: 0.5, compostable: 'municipal' },
  produce:   { co2PerKg: 0.8, waterLPerKg: 500,  kgPerItem: 0.4, compostable: 'yes' },
  takeout:   { co2PerKg: 4,   waterLPerKg: 2000, kgPerItem: 0.5, compostable: 'municipal' },
  beverage:  { co2PerKg: 1,   waterLPerKg: 800,  kgPerItem: 1,   compostable: 'no' },
  condiment: { co2PerKg: 2,   waterLPerKg: 1000, kgPerItem: 0.3, compostable: 'no' },
  other:     { co2PerKg: 2.5, waterLPerKg: 1500, kgPerItem: 0.4, compostable: 'yes' },
}

export const KG_CO2E_PER_CAR_MILE = 0.4
export const LITERS_PER_GALLON = 3.785
/** Composting instead of landfill, per kg of food. */
export const KG_CO2E_AVOIDED_PER_KG_COMPOSTED = 0.7

export const compostable = (category: FoodCategory) => FOOTPRINT[category].compostable

function footprintOf(item: FridgeItem) {
  const f = FOOTPRINT[item.category]
  const kg = f.kgPerItem * item.quantity
  return { kg, co2: kg * f.co2PerKg, water: kg * f.waterLPerKg }
}

export type FootprintTotals = {
  /** Eaten in time: the footprint that didn't go in the bin. */
  savedCo2Kg: number
  savedWaterL: number
  wastedCo2Kg: number
  wastedWaterL: number
  carMilesAvoided: number
  gallonsSaved: number
  /** Thrown-away items the household said went to compost. */
  compostedKg: number
  compostCo2AvoidedKg: number
}

/** Footprint of everything in `history` (pass the same window the Impact page uses). */
export function footprintTotals(history: FridgeItem[]): FootprintTotals {
  const t = { savedCo2Kg: 0, savedWaterL: 0, wastedCo2Kg: 0, wastedWaterL: 0, compostedKg: 0 }
  for (const item of history) {
    const f = footprintOf(item)
    if (item.status === 'consumed') {
      t.savedCo2Kg += f.co2
      t.savedWaterL += f.water
    } else if (isWasted(item)) {
      t.wastedCo2Kg += f.co2
      t.wastedWaterL += f.water
      if (item.composted) t.compostedKg += f.kg
    }
  }
  return {
    ...t,
    carMilesAvoided: t.savedCo2Kg / KG_CO2E_PER_CAR_MILE,
    gallonsSaved: t.savedWaterL / LITERS_PER_GALLON,
    compostCo2AvoidedKg: t.compostedKg * KG_CO2E_AVOIDED_PER_KG_COMPOSTED,
  }
}

/** Rounds to something that reads like an estimate: 3, 12, 140, 1,200. */
export function roughNumber(n: number): string {
  if (n < 10) return String(Math.round(n * 10) / 10).replace(/\.0$/, '')
  const digits = Math.floor(Math.log10(n)) - 1
  const step = 10 ** Math.max(0, digits)
  return (Math.round(n / step) * step).toLocaleString()
}
