// Demo data: a realistic fridge plus three weeks of history, and a fake camera that
// adds / removes / returns things every so often. Everything lives in memory and
// resets on reload. Turn on with EXPO_PUBLIC_USE_MOCK_DATA=true.

import { categorize, defaultLocation } from './categories'
import { PENDING_GRACE_MINUTES } from './config'
import { estimateExpiry } from './expiration'
import { daysUntil } from './freshness'
import type { ActivityEntry, ActivityKind, FoodCategory, FridgeItem, FridgeLocation, FridgeSnapshot, FridgeSource } from './types'

const MIN = 60_000
const DAY = 86_400_000

let nextId = 1
const uid = (p: string) => `${p}-${nextId++}`

/** Midnight-based date `days` from today, so "2 days left" reads right all day. */
function dayOffset(days: number, from = new Date()) {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + days, 12).toISOString()
}
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
/** Some time on the day `days` ago (an hour ago for today), varied per item. */
const addedAt = (days: number, name: string) =>
  days === 0 ? ago(3_600_000) : new Date(new Date(dayOffset(-days)).getTime() - (name.length % 4) * 3_600_000).toISOString()

// Items carry no hand-picked dates: expiry comes from estimateExpiry(category, location,
// added_at), same as live. "Added N days ago" is chosen so the fridge has a realistic mix
// (days left = shelf life − N), e.g. chicken: 4-day meat life, added 3 days ago → 1 day left.
type Seed = [name: string, category: FoodCategory, source: string | null, addedDaysAgo: number]

const IN_FRIDGE: Seed[] = [
  ['Chicken breast', 'meat', 'Bell & Evans', 3],          // 1 day left
  ['Chipotle burrito bowl', 'takeout', 'Chipotle', 2],    // 1 day left
  ['Pad see ew', 'takeout', 'Thai Basil', 3],             // today
  ['Strawberries', 'produce', 'Driscoll’s', 7],           // expired yesterday
  ['Baby spinach', 'produce', 'Earthbound Farm', 4],      // 2 days left
  ['Greek yogurt', 'dairy', 'Fage', 4],
  ['Sharp cheddar', 'dairy', 'Tillamook', 3],
  ['Eggs', 'dairy', 'Vital Farms', 2],
  ['Salmon fillet', 'meat', 'Whole Foods', 1],
  ['Oat milk', 'beverage', 'Oatly', 5],
  ['Sriracha', 'condiment', 'Huy Fong', 12],
  ['Hummus', 'other', 'Sabra', 2],
  ['Avocados', 'produce', null, 2],
  ['Pizza slices', 'takeout', 'Joe’s Pizza', 1],
]

// Freezer: months of shelf life, but the same "2 days before ITS date" rule applies.
const IN_FREEZER: Seed[] = [
  ['Vanilla ice cream', 'dairy', 'Jeni’s', 59],           // 2-month life → 1 day left
  ['Frozen peas', 'produce', 'Birds Eye', 120],
  ['Ground beef', 'meat', 'Pat LaFrieda', 40],
  ['Pork dumplings', 'other', 'Bibigo', 30],
  ['Leftover chili', 'takeout', null, 20],
  ['Mixed berries', 'produce', 'Wyman’s', 90],
]

const PENDING: [name: string, category: FoodCategory, source: string | null, addedDaysAgo: number, removedMinsAgo: number][] = [
  ['Orange juice', 'beverage', 'Tropicana', 10, 2],
  ['Leftover pasta', 'other', null, 6, Math.max(1, PENDING_GRACE_MINUTES - 3)],
]

// Things the fake camera may "see" going in.
const CAMERA_POOL: [string, FoodCategory, string | null][] = [
  ['Sushi platter', 'takeout', 'Sushi Nakazawa'],
  ['Whole milk', 'dairy', 'Horizon'],
  ['Blueberries', 'produce', null],
  ['Chicken thighs', 'meat', 'Bell & Evans'],
  ['Kombucha', 'beverage', 'GT’s'],
  ['Butter', 'dairy', 'Kerrygold'],
  ['Pho', 'takeout', 'Pho Saigon'],
  ['Bell peppers', 'produce', null],
  ['Dijon mustard', 'condiment', 'Maille'],
  ['Tofu', 'other', 'Nasoya'],
]

/** A fresh in-fridge item with its location and estimated expiry filled in. */
function makeItem(name: string, category: FoodCategory, source: string | null, added: string, location: FridgeLocation = defaultLocation(category)): FridgeItem {
  return {
    id: uid('i'), name, category, source, quantity: 1, location,
    added_at: added, expires_at: estimateExpiry(category, location, added),
    status: 'in_fridge', removed_at: null, image_url: null,
  }
}

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
        location: defaultLocation(category),
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
    ...IN_FRIDGE.map(([name, category, source, added]) => makeItem(name, category, source, addedAt(added, name))),
    ...IN_FREEZER.map(([name, category, source, added]) => makeItem(name, category, source, addedAt(added, name), 'freezer')),
    ...PENDING.map(([name, category, source, added, mins]): FridgeItem => ({
      ...makeItem(name, category, source, addedAt(added, name)),
      status: 'pending_removal', removed_at: ago(mins * MIN),
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
      const [name, category, source] = CAMERA_POOL[Math.floor(Math.random() * CAMERA_POOL.length)]
      const item = makeItem(name, category, source, new Date().toISOString())
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

    moveTo(item, where) {
      const i = find(item.id)
      if (i) {
        i.location = where === 'freezer' ? 'freezer' : defaultLocation(i.category)
        // Into the freezer: re-estimate from when it was bought. Out: it's thawing, clock starts now.
        i.expires_at = where === 'freezer'
          ? estimateExpiry(i.category, 'freezer', i.added_at)
          : estimateExpiry(i.category, 'fridge', new Date())
      }
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
      const item = makeItem(name.trim(), categorize(null, name), null, new Date().toISOString())
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
