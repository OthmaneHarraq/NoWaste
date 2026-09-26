import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useToast } from '@/ui/Toast'
import { displayName } from './categories'
import { USE_MOCK_DATA } from './config'
import { estimateExpiry } from './expiration'
import { expiryLabel, freshnessOf, isCurrent, needsAction, type Freshness } from './freshness'
import { notify } from './notifications'
import { createLiveSource } from './liveSource'
import { createMockSource } from './mockSource'
import type { ActivityEntry, ConnectionState, FridgeItem, FridgeSnapshot, FridgeSource } from './types'

type FridgeContextValue = {
  /** Everything in the fridge right now (in_fridge + pending_removal). */
  current: FridgeItem[]
  /** Items that left the fridge (consumed / expired / thrown_away). */
  history: FridgeItem[]
  /** Expiring soon or expired, worst first. */
  actionNeeded: FridgeItem[]
  activity: ActivityEntry[]
  loading: boolean
  connection: ConnectionState
  /** Ticks every minute so "2 days left" and countdowns stay right without new data. */
  now: Date
  markUsed: (item: FridgeItem) => Promise<void>
  markThrownAway: (item: FridgeItem) => Promise<void>
  putBack: (item: FridgeItem) => Promise<void>
  moveTo: (item: FridgeItem, where: 'freezer' | 'fridge') => Promise<void>
  addItem: (name: string) => Promise<boolean>
  undo: (entry: ActivityEntry) => Promise<void>
  correct: (entry: ActivityEntry, name: string, action: 'in' | 'out') => Promise<void>
  simulatedCamera: boolean | null
  setSimulatedCamera: (on: boolean) => void
}

const FridgeContext = createContext<FridgeContextValue | null>(null)

export function FridgeProvider({ householdId, children }: { householdId: string; children: ReactNode }) {
  const source = useMemo<FridgeSource>(
    () => (USE_MOCK_DATA ? createMockSource() : createLiveSource(householdId)),
    [householdId]
  )
  const [snapshot, setSnapshot] = useState<FridgeSnapshot | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [now, setNow] = useState(() => new Date())
  const [simulatedCamera, setSim] = useState<boolean | null>(source.setSimulatedCamera ? true : null)
  const toast = useToast()

  useEffect(() => source.subscribe(setSnapshot, setConnection), [source])
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const current = useMemo(() => snapshot?.items.filter(isCurrent) ?? [], [snapshot])
  const history = useMemo(() => snapshot?.items.filter(i => !isCurrent(i)) ?? [], [snapshot])
  const actionNeeded = useMemo(() => needsAction(current, now), [current, now])

  useExpiryAlerts(current, now, snapshot !== null)

  // Wrap every action so a failure always surfaces, and success gets a little feedback.
  async function run(p: Promise<string | null>, success?: { title: string; body?: string; tone?: 'fresh' | 'info' }) {
    const error = await p
    if (error) toast({ tone: 'expired', title: 'That didn’t work', body: error })
    else if (success) toast({ tone: success.tone ?? 'fresh', ...success })
    return !error
  }

  const value: FridgeContextValue = {
    current,
    history,
    actionNeeded,
    activity: snapshot?.activity ?? [],
    loading: snapshot === null,
    connection,
    now,
    markUsed: async item => {
      await run(source.markUsed(item), { title: `${displayName(item.name)} saved from the bin`, body: 'Counted toward your waste avoided.' })
    },
    markThrownAway: async item => {
      await run(source.markThrownAway(item), { tone: 'info', title: `${displayName(item.name)} tossed`, body: 'Logged so the stats stay honest.' })
    },
    putBack: async item => {
      await run(source.putBack(item), { tone: 'info', title: `${displayName(item.name)} is back in the fridge` })
    },
    moveTo: async (item, where) => {
      // Same estimate the sources use, just for the toast text.
      const until = new Date(where === 'freezer' ? estimateExpiry(item.category, 'freezer', item.added_at) : estimateExpiry(item.category, 'fridge', new Date()))
        .toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      await run(source.moveTo(item, where), where === 'freezer'
        ? { tone: 'info', title: `${displayName(item.name)} is in the freezer`, body: `Good until about ${until} now.` }
        : { tone: 'info', title: `${displayName(item.name)} is thawing in the fridge`, body: `Use it by about ${until}.` })
    },
    addItem: name => run(source.addItem(name)),
    undo: async entry => {
      await run(source.undo(entry))
    },
    correct: async (entry, name, action) => {
      await run(source.correct(entry, name, action))
    },
    simulatedCamera,
    setSimulatedCamera: on => {
      source.setSimulatedCamera?.(on)
      setSim(on)
    },
  }

  return <FridgeContext.Provider value={value}>{children}</FridgeContext.Provider>
}

export function useFridge(): FridgeContextValue {
  const ctx = useContext(FridgeContext)
  if (!ctx) throw new Error('useFridge must be used inside <FridgeProvider>')
  return ctx
}

/**
 * Toasts, plus OS notifications (browser on web, local expo-notifications on phones) when
 * an item crosses a threshold.
 * Runs on first load — so things that were already going off before the page opened
 * still get flagged — then on every realtime change and every minute.
 */
function useExpiryAlerts(items: FridgeItem[], now: Date, ready: boolean) {
  const toast = useToast()
  const seen = useRef<Map<string, Freshness> | null>(null)

  useEffect(() => {
    if (!ready) return
    const inFridge = items.filter(i => i.status === 'in_fridge')
    const states = new Map(inFridge.map(i => [i.id, freshnessOf(i, now)]))

    if (seen.current === null) {
      const expired = inFridge.filter(i => states.get(i.id) === 'expired')
      const soon = inFridge.filter(i => states.get(i.id) === 'soon')
      if (expired.length) {
        const names = listNames(expired.map(i => displayName(i.name)))
        toast({ tone: 'expired', title: `${expired.length} item${expired.length > 1 ? 's' : ''} past date`, body: `${names}. Time to check and clear ${expired.length > 1 ? 'them' : 'it'} out.` })
        notify('NoWaste: throw these out', names, 'nowaste-expired-summary')
      }
      if (soon.length) {
        const body = listNames(soon.map(i => displayName(i.name))) + '. Use them first!'
        toast({ tone: 'soon', title: `${soon.length} item${soon.length > 1 ? 's' : ''} expiring soon`, body })
        notify(`NoWaste: use ${soon.length > 1 ? 'these' : 'this'} soon`, body, 'nowaste-soon-summary')
      }
    } else {
      for (const item of inFridge) {
        const was = seen.current.get(item.id)
        const is = states.get(item.id)
        if (is === was || (is !== 'soon' && is !== 'expired')) continue
        if (was === 'expired') continue
        const name = displayName(item.name)
        if (is === 'expired') {
          toast({ tone: 'expired', title: `${name} has expired`, body: 'Give it a sniff test, or throw it out.' })
          notify(`${name} has expired`, 'Time to throw it out.', `nowaste-${item.id}`)
        } else {
          toast({ tone: 'soon', title: `${name} is expiring soon`, body: `${expiryLabel(item, now)}. Use it first!` })
          notify(`${name} is expiring soon`, `${expiryLabel(item, now)}. Use it first!`, `nowaste-soon-${item.id}`)
        }
      }
    }
    seen.current = states
  }, [items, now, ready, toast])
}

/** "A, B, C and 4 more": keeps the load-time summaries short. */
function listNames(names: string[], max = 3) {
  if (names.length <= max) return names.join(', ')
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`
}
