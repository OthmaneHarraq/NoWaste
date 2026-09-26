// Demo data: a realistic fridge plus three weeks of history, and a fake camera that
// adds / removes / returns things every so often. Everything lives in memory and
// resets on reload. Turn on with EXPO_PUBLIC_USE_MOCK_DATA=true.

import { categorize } from './categories'
import { PENDING_GRACE_MINUTES } from './config'
import { daysUntil } from './freshness'
import type { ActivityEntry, ActivityKind, FoodCategory, FridgeItem, FridgeSnapshot, FridgeSource } from './types'

const MIN = 60_000
const DAY = 86_400_000

let nextId = 1
const uid = (p: string) => `${p}-${nextId++}`

/** Midnight-based date `days` from today, so "2 days left" reads right all day. */
function dayOffset(days: number, from = new Date()) {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + days, 12).toISOString()
}
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

type Seed = [name: string, category: FoodCategory, source: string | null, expiresInDays: number | null, addedDaysAgo: number]

const IN_FRIDGE: Seed[] = [
  ['Chicken breast', 'meat', 'Bell & Evans', 1, 1],
  ['Chipotle burrito bowl', 'takeout', 'Chipotle', 1, 2],
  ['Pad see ew', 'takeout', 'Thai Basil', 0, 3],
  ['Strawberries', 'produce', 'Driscoll’s', -1, 6],
  ['Baby spinach', 'produce', 'Earthbound Farm', 2, 4],
  ['Greek yogurt', 'dairy', 'Fage', 6, 5],
  ['Sharp cheddar', 'dairy', 'Tillamook', 18, 9],
  ['Eggs', 'dairy', 'Vital Farms', 21, 7],
  ['Salmon fillet', 'meat', 'Whole Foods', 3, 0],
  ['Oat milk', 'beverage', 'Oatly', 9, 3],
  ['Sriracha', 'condiment', 'Huy Fong', 140, 40],
  ['Hummus', 'other', 'Sabra', 5, 2],
  ['Avocados', 'produce', null, 4, 1],
  ['Pizza slices', 'takeout', 'Joe’s Pizza', 3, 1],
]

const PENDING: [name: string, category: FoodCategory, source: string | null, expiresInDays: number, removedMinsAgo: number][] = [
  ['Orange juice', 'beverage', 'Tropicana', 4, 2],
  ['Leftover pasta', 'other', null, 1, Math.max(1, PENDING_GRACE_MINUTES - 3)],
]

// Things the fake camera may "see" going in.
const CAMERA_POOL: [string, FoodCategory, string | null, number][] = [
  ['Sushi platter', 'takeout', 'Sushi Nakazawa', 1],
  ['Whole milk', 'dairy', 'Horizon', 7],
  ['Blueberries', 'produce', null, 5],
  ['Ground beef', 'meat', 'Pat LaFrieda', 2],
  ['Kombucha', 'beverage', 'GT’s', 30],
  ['Butter', 'dairy', 'Kerrygold', 30],
  ['Pho', 'takeout', 'Pho Saigon', 2],
  ['Bell peppers', 'produce', null, 7],
  ['Dijon mustard', 'condiment', 'Maille', 180],
  ['Tofu', 'other', 'Nasoya', 5],
]

// Tiny deterministic PRNG so the history (and the charts) look the same every reload.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

function seedHistory(): FridgeItem[] {
  const rand = rng(42)
  const names: [string, FoodCategory, string | null][] = [
    ['Milk', 'dairy', 'Horizon'], ['Rotisserie chicken', 'meat', 'Costco'], ['Lettuce', 'produce', null],
    ['Sweetgreen salad', 'takeout', 'Sweetgreen'], ['Raspberries', 'produce', null], ['Yogurt cups', 'dairy', 'Chobani'],
    ['Pad thai', 'takeout', 'Thai Basil'], ['Deli turkey', 'meat', 'Boar’s Head'], ['Apple juice', 'beverage', 'Mott’s'],
    ['Cilantro', 'produce', null], ['Ramen', 'takeout', 'Ippudo'], ['Cream cheese', 'dairy', 'Philadelphia'],
    ['Broccoli', 'produce', null], ['Pesto', 'condiment', 'Rana'], ['Burrito', 'takeout', 'Chipotle'],
  ]
  const out: FridgeItem[] = []
  for (let day = 20; day >= 1; day--) {
    // Waste drops over time: the "the app is working" story for the Impact page.
    const wasteChance = day > 12 ? 0.42 : day > 5 ? 0.22 : 0.06
    const count = 1 + Math.floor(rand() * 3)
    for (let k = 0; k < count; k++) {
      const [name, category, source] = names[Math.floor(rand() * names.length)]
      const wasted = rand() < wasteChance
      const removed = new Date(Date.now() - day * DAY + Math.floor(rand() * 10) * 3_600_000)
      out.push({
        id: uid('h'),
        name, category, source,
        quantity: 1,
        added_at: new Date(removed.getTime() - (2 + Math.floor(rand() * 6)) * DAY).toISOString(),
        expires_at: dayOffset(wasted ? -1 - Math.floor(rand() * 3) : 1 + Math.floor(rand() * 4), removed),
        status: wasted ? (rand() < 0.5 ? 'thrown_away' : 'expired') : 'consumed',
        removed_at: removed.toISOString(),
        image_url: null,
      })
    }
  }
  return out
}

function activityFor(item: FridgeItem, kind: ActivityKind, at: string, via: ActivityEntry['via']): ActivityEntry {
  return {
    id: uid('a'),
    kind,
    itemName: item.name,
    category: item.category,
    source: item.source,
    at,
    via,
    quantity: item.quantity,
    confidence: via === 'camera' ? 0.82 + Math.random() * 0.16 : null,
    rawLabel: null,
    undone: false,
    eventId: `${item.id}|${kind}`,
  }
}

export function createMockSource(): FridgeSource {
  const items: FridgeItem[] = [
    ...IN_FRIDGE.map(([name, category, source, exp, added]): FridgeItem => ({
      id: uid('i'), name, category, source, quantity: 1,
      added_at: ago(added * DAY + 3_600_000 * (1 + (name.length % 7))),
      expires_at: exp === null ? null : dayOffset(exp),
      status: 'in_fridge', removed_at: null, image_url: null,
    })),
    ...PENDING.map(([name, category, source, exp, mins]): FridgeItem => ({
      id: uid('i'), name, category, source, quantity: 1,
      added_at: ago(2 * DAY), expires_at: dayOffset(exp),
      status: 'pending_removal', removed_at: ago(mins * MIN), image_url: null,
    })),
    ...seedHistory(),
  ]

  const activity: ActivityEntry[] = []
  for (const i of items) {
    activity.push(activityFor(i, 'added', i.added_at, 'camera'))
    if (i.status === 'pending_removal') activity.push(activityFor(i, 'removed', i.removed_at!, 'camera'))
    if (i.status === 'consumed' || i.status === 'expired' || i.status === 'thrown_away') {
      activity.push(activityFor(i, i.status, i.removed_at!, i.status === 'expired' ? 'system' : 'manual'))
    }
  }

  let listener: ((s: FridgeSnapshot) => void) | null = null
  let cameraOn = true
  const emit = () => {
    activity.sort((a, b) => b.at.localeCompare(a.at))
    listener?.({ items: items.map(i => ({ ...i })), activity: activity.map(a => ({ ...a })) })
  }
  const log = (item: FridgeItem, kind: ActivityKind, via: ActivityEntry['via']) =>
    activity.push(activityFor(item, kind, new Date().toISOString(), via))

  function resolve(item: FridgeItem, status: 'consumed' | 'thrown_away' | 'expired', via: ActivityEntry['via']) {
    item.status = status
    item.removed_at ??= new Date().toISOString()
    log(item, status, via)
  }

  // Pending items resolve on their own once the grace period passes.
  function sweep() {
    const cutoff = Date.now() - PENDING_GRACE_MINUTES * MIN
    for (const i of items) {
      if (i.status === 'pending_removal' && new Date(i.removed_at!).getTime() < cutoff) {
        resolve(i, (daysUntil(i.expires_at) ?? 0) < 0 ? 'expired' : 'consumed', 'system')
      }
    }
  }

  function simulateCamera() {
    const r = Math.random()
    const inFridge = items.filter(i => i.status === 'in_fridge')
    const pending = items.filter(i => i.status === 'pending_removal')
    if (r < 0.15 && pending.length) {
      const i = pending[Math.floor(Math.random() * pending.length)]
      i.status = 'in_fridge'
      i.removed_at = null
      log(i, 'returned', 'camera')
    } else if (r < 0.45 && inFridge.length > 8) {
      const fresh = inFridge.filter(i => (daysUntil(i.expires_at) ?? 9) >= 0)
      const i = fresh[Math.floor(Math.random() * fresh.length)]
      if (!i) return
      i.status = 'pending_removal'
      i.removed_at = new Date().toISOString()
      log(i, 'removed', 'camera')
    } else {
      const [name, category, source, days] = CAMERA_POOL[Math.floor(Math.random() * CAMERA_POOL.length)]
      const item: FridgeItem = {
        id: uid('i'), name, category, source, quantity: 1,
        added_at: new Date().toISOString(), expires_at: dayOffset(days),
        status: 'in_fridge', removed_at: null, image_url: null,
      }
      items.push(item)
      log(item, 'added', 'camera')
    }
  }

  const find = (id: string) => items.find(i => i.id === id)
  const done = () => {
    emit()
    return Promise.resolve(null)
  }

  return {
    subscribe(onChange, onConnection) {
      listener = onChange
      onConnection('demo')
      sweep()
      emit()
      const tick = setInterval(() => { sweep(); emit() }, 15_000)
      let cam: ReturnType<typeof setTimeout>
      const scheduleCamera = () => {
        cam = setTimeout(() => {
          if (cameraOn) { simulateCamera(); emit() }
          scheduleCamera()
        }, 18_000 + Math.random() * 14_000)
      }
      scheduleCamera()
      return () => {
        listener = null
        clearInterval(tick)
        clearTimeout(cam)
      }
    },

    markUsed(item) {
      const i = find(item.id)
      if (i) resolve(i, 'consumed', 'manual')
      return done()
    },

    markThrownAway(item) {
      const i = find(item.id)
      if (i) resolve(i, 'thrown_away', 'manual')
      return done()
    },

    putBack(item) {
      const i = find(item.id)
      if (i) {
        i.status = 'in_fridge'
        i.removed_at = null
        log(i, 'returned', 'manual')
      }
      return done()
    },

    addItem(name) {
      const category = categorize(null, name)
      const item: FridgeItem = {
        id: uid('i'), name: name.trim(), category, source: null, quantity: 1,
        added_at: new Date().toISOString(),
        expires_at: dayOffset({ meat: 2, takeout: 3, produce: 5, dairy: 10, beverage: 10, condiment: 90, other: 7 }[category]),
        status: 'in_fridge', removed_at: null, image_url: null,
      }
      items.push(item)
      log(item, 'added', 'manual')
      return done()
    },

    undo(entry) {
      const a = activity.find(x => x.id === entry.id)
      const item = entry.eventId && find(entry.eventId.split('|')[0])
      if (!a || !item) return Promise.resolve('This entry cannot be undone')
      a.undone = true
      a.eventId = null
      if (a.kind === 'added') {
        items.splice(items.indexOf(item), 1)
      } else if (a.kind === 'returned') {
        item.status = 'pending_removal'
        item.removed_at = new Date().toISOString()
      } else {
        item.status = 'in_fridge'
        item.removed_at = null
      }
      return done()
    },

    correct(entry, name) {
      const a = activity.find(x => x.id === entry.id)
      const item = entry.eventId && find(entry.eventId.split('|')[0])
      if (!a || !item) return Promise.resolve('This entry cannot be fixed')
      a.rawLabel = a.itemName
      a.itemName = item.name = name.trim()
      a.category = item.category = categorize(null, name)
      return done()
    },

    setSimulatedCamera(on) {
      cameraOn = on
    },
  }
}
