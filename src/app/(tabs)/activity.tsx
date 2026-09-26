import { useMemo, useState } from 'react'
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useFridge } from '@/fridge/FridgeProvider'
import { displayName } from '@/fridge/categories'
import { USE_MOCK_DATA } from '@/fridge/config'
import { FoodShape, FoodTile } from '@/fridge/components/FoodShape'
import type { ActivityEntry, ActivityKind, FoodCategory } from '@/fridge/types'
import { FadeIn } from '@/ui/motion'
import { shadow } from '@/ui/theme'

// OWNER: phone app team. Everything that went in or out, grouped by day, newest first,
// with one-tap Undo and Fix. Fixing a name teaches the household an alias.

type IconName = keyof typeof MaterialCommunityIcons.glyphMap

// Kind → look. Green = saved and red = wasted, same meaning as everywhere else; moves are neutral.
const KIND: Record<ActivityKind, { verb: string; icon: IconName; color: string; tint: string }> = {
  added:       { verb: 'Added',      icon: 'arrow-down-bold',       color: '#3f6a8f', tint: '#e3eff8' },
  removed:     { verb: 'Took out',   icon: 'arrow-up-bold',         color: '#4c5d55', tint: '#e8eeeb' },
  returned:    { verb: 'Put back',   icon: 'undo-variant',          color: '#6d5aa6', tint: '#ece8f6' },
  consumed:    { verb: 'Used up',    icon: 'silverware-fork-knife', color: '#1b653b', tint: '#d5eedc' },
  expired:     { verb: 'Expired',    icon: 'clock-remove-outline',  color: '#8a2419', tint: '#f8d3ce' },
  thrown_away: { verb: 'Threw away', icon: 'trash-can-outline',     color: '#8a2419', tint: '#f8d3ce' },
}

type Filter = 'all' | 'moves' | 'saved' | 'wasted'
const FILTERS: { key: Filter; label: string; icon: IconName; kinds: ActivityKind[] | null }[] = [
  { key: 'all', label: 'Everything', icon: 'format-list-bulleted', kinds: null },
  { key: 'moves', label: 'In & out', icon: 'swap-vertical', kinds: ['added', 'removed', 'returned'] },
  { key: 'saved', label: 'Saved', icon: 'silverware-fork-knife', kinds: ['consumed'] },
  { key: 'wasted', label: 'Wasted', icon: 'trash-can-outline', kinds: ['expired', 'thrown_away'] },
]

const WEB = Platform.OS === 'web'
// Web-only texture and gradient (plain colours elsewhere).
const DOTS = WEB ? 'bg-[radial-gradient(#dde6e1_1.2px,transparent_1.2px)] bg-[length:20px_20px]' : ''
const HERO_GRADIENT = WEB ? 'bg-[linear-gradient(125deg,#0f2e21_0%,#17442f_45%,#1f6b47_100%)]' : ''

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

function dayLabel(iso: string, now: Date) {
  const diff = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long' })
}

const counts = (entries: ActivityEntry[]) => {
  const c = { in: 0, out: 0, used: 0, wasted: 0 }
  for (const e of entries) {
    if (e.undone) continue
    if (e.kind === 'added' || e.kind === 'returned') c.in += e.quantity
    else if (e.kind === 'removed') c.out += e.quantity
    else if (e.kind === 'consumed') c.used += e.quantity
    else c.wasted += e.quantity
  }
  return c
}

export default function ActivityScreen() {
  const { activity, now, undo, correct } = useFridge()
  const { width } = useWindowDimensions()
  const [filter, setFilter] = useState<Filter>('all')
  const [fixing, setFixing] = useState<ActivityEntry | null>(null)
  const wide = width >= 1180
  const phone = width < 600

  const kinds = FILTERS.find(f => f.key === filter)!.kinds
  const entries = kinds ? activity.filter(a => kinds.includes(a.kind)) : activity
  const sections = useMemo(() => {
    const out: { key: string; title: string; date: Date; data: ActivityEntry[] }[] = []
    for (const e of entries) {
      const key = new Date(startOfDay(new Date(e.at))).toISOString()
      if (out.at(-1)?.key !== key) out.push({ key, title: dayLabel(e.at, now), date: new Date(e.at), data: [] })
      out.at(-1)!.data.push(e)
    }
    return out
  }, [entries, now])

  const today = counts(activity.filter(a => startOfDay(new Date(a.at)) === startOfDay(now)))
  const filterCount = (f: (typeof FILTERS)[number]) => (f.kinds ? activity.filter(a => f.kinds!.includes(a.kind)).length : activity.length)

  const timeline = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View className="mb-1 flex-row flex-wrap gap-2">
        {FILTERS.map(f => {
          const on = filter === f.key
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              className={`flex-row items-center gap-2 rounded-full border px-3.5 py-2 ${on ? 'border-ink bg-ink' : 'border-line bg-white active:bg-frost'}`}
              style={on ? undefined : shadow.card}
            >
              <MaterialCommunityIcons name={f.icon} size={15} color={on ? '#fff' : '#4c5d55'} />
              <Text className={`text-[13px] font-semibold ${on ? 'text-white' : 'text-ink'}`}>{f.label}</Text>
              <Text className={`text-xs ${on ? 'text-[#b7c6bf]' : 'text-mute'}`}>{filterCount(f)}</Text>
            </Pressable>
          )
        })}
      </View>

      {sections.map(section => (
        <View key={section.key}>
          <DayHeader title={section.title} date={section.date} entries={section.data} />
          {section.data.map((e, i) => (
            <TimelineRow
              key={e.id}
              entry={e}
              first={i === 0}
              last={i === section.data.length - 1}
              onUndo={() => undo(e)}
              onFix={() => setFixing(e)}
            />
          ))}
        </View>
      ))}
      {sections.length === 0 && <EmptyState filter={filter} />}
    </View>
  )

  return (
    <View className={`flex-1 bg-paper ${DOTS}`}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: phone ? 14 : 28, paddingBottom: 56 }}>
        <View style={{ width: '100%', maxWidth: 1240, alignSelf: 'center' }}>
          <Hero today={today} activity={activity} now={now} phone={phone} />
          {wide ? (
            <View className="mt-7 flex-row items-start gap-7">
              {timeline}
              <View className="w-[340px] gap-5">
                <WeekCard activity={activity} now={now} />
                <TopItems activity={activity} now={now} />
                <TipCard />
              </View>
            </View>
          ) : (
            <View className="mt-6 gap-6">
              {timeline}
              <WeekCard activity={activity} now={now} />
            </View>
          )}
        </View>
      </ScrollView>

      <FixModal
        entry={fixing}
        onClose={() => setFixing(null)}
        onSave={async (name, action) => {
          if (fixing) await correct(fixing, name, action)
          setFixing(null)
        }}
      />
    </View>
  )
}

/* ---------------- Hero ---------------- */

function Hero({ today, activity, now, phone }: { today: ReturnType<typeof counts>; activity: ActivityEntry[]; now: Date; phone: boolean }) {
  // Last 7 days: things in vs things out, for the little chart.
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = startOfDay(now) - (6 - i) * 86_400_000
    const c = counts(activity.filter(a => startOfDay(new Date(a.at)) === d))
    return { d: new Date(d), in: c.in, out: c.out + c.used + c.wasted }
  })
  const max = Math.max(1, ...days.map(d => Math.max(d.in, d.out)))

  const stats: { label: string; n: number; icon: IconName; color: string }[] = [
    { label: 'Added', n: today.in, icon: 'arrow-down-bold', color: '#9fd0f5' },
    { label: 'Taken out', n: today.out, icon: 'arrow-up-bold', color: '#cfe7d9' },
    { label: 'Used up', n: today.used, icon: 'silverware-fork-knife', color: '#5fd497' },
    { label: 'Wasted', n: today.wasted, icon: 'trash-can-outline', color: '#f7a596' },
  ]

  return (
    <FadeIn>
      <View className={`overflow-hidden rounded-[28px] bg-[#123526] ${HERO_GRADIENT}`} style={[{ padding: phone ? 20 : 28 }, shadow.raised]}>
        {/* Decorative shapes */}
        <MaterialCommunityIcons name="fridge-outline" size={220} color="#ffffff" style={{ position: 'absolute', right: -30, top: -30, opacity: 0.05, transform: [{ rotate: '8deg' }] }} />
        <MaterialCommunityIcons name="leaf" size={120} color="#ffffff" style={{ position: 'absolute', left: '42%', bottom: -40, opacity: 0.05, transform: [{ rotate: '-24deg' }] }} />

        <View className="flex-row flex-wrap items-end justify-between gap-6">
          <View style={{ minWidth: 260, flexGrow: 1, flexShrink: 1, flexBasis: 420 }}>
            <Text className="text-xs font-bold uppercase tracking-[3px] text-[#8fc9a8]">Activity</Text>
            <Text className={`${phone ? 'text-[28px]' : 'text-[36px]'} mt-1 font-extrabold tracking-tight text-white`}>Today in your fridge</Text>
            <Text className="mt-1 text-[14px] text-[#cfe7d9]">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>

            <View className="mt-6 flex-row flex-wrap gap-3">
              {stats.map(s => (
                <View key={s.label} style={{ flexGrow: 1, flexBasis: 112 }} className="min-w-[112px] rounded-2xl border border-[#2a5a43] bg-[#ffffff12] px-4 py-3">
                  <View className="flex-row items-center gap-2">
                    <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: s.color + '33' }}>
                      <MaterialCommunityIcons name={s.icon} size={15} color={s.color} />
                    </View>
                    <Text className="text-[12px] font-semibold text-[#cfe7d9]">{s.label}</Text>
                  </View>
                  <Text className="mt-1.5 text-[30px] font-extrabold leading-[34px] text-white">{s.n}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 7-day in/out chart */}
          <View className="rounded-2xl border border-[#2a5a43] bg-[#ffffff0d] p-4" style={{ minWidth: 280, flexGrow: 1, flexBasis: 320 }}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[12px] font-bold uppercase tracking-[2px] text-[#8fc9a8]">Last 7 days</Text>
              <View className="flex-row gap-3">
                <Key color="#9fd0f5" label="In" />
                <Key color="#5fd497" label="Out" />
              </View>
            </View>
            <View className="flex-row items-end gap-3" style={{ height: 96 }}>
              {days.map((d, i) => (
                <View key={i} className="flex-1 items-center gap-1.5">
                  <View className="w-full flex-row items-end justify-center gap-1" style={{ height: 76 }}>
                    <View className="w-2.5 rounded-t-md" style={{ height: d.in ? Math.max(3, (d.in / max) * 76) : 0, backgroundColor: '#9fd0f5' }} />
                    <View className="w-2.5 rounded-t-md" style={{ height: d.out ? Math.max(3, (d.out / max) * 76) : 0, backgroundColor: '#5fd497' }} />
                  </View>
                  <Text className={`text-[11px] ${i === 6 ? 'font-bold text-white' : 'text-[#8fc9a8]'}`}>
                    {i === 6 ? 'Today' : d.d.toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </FadeIn>
  )
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
      <Text className="text-[11px] text-[#cfe7d9]">{label}</Text>
    </View>
  )
}

/* ---------------- Timeline ---------------- */

function DayHeader({ title, date, entries }: { title: string; date: Date; entries: ActivityEntry[] }) {
  const c = counts(entries)
  const chips: { n: number; label: string; bg: string; fg: string }[] = [
    { n: c.in, label: 'in', bg: '#e3eff8', fg: '#3f6a8f' },
    { n: c.out, label: 'out', bg: '#e8eeeb', fg: '#4c5d55' },
    { n: c.used, label: 'used', bg: '#d5eedc', fg: '#1b653b' },
    { n: c.wasted, label: 'wasted', bg: '#f8d3ce', fg: '#8a2419' },
  ].filter(x => x.n > 0)

  return (
    <View className="mb-2 mt-8 flex-row items-center gap-4">
      {/* Calendar tile */}
      <View className="w-12 overflow-hidden rounded-xl border border-line bg-white" style={shadow.card}>
        <View className="items-center bg-fresh-600 py-0.5">
          <Text className="text-[9px] font-bold uppercase tracking-wider text-white">{date.toLocaleDateString(undefined, { month: 'short' })}</Text>
        </View>
        <Text className="py-1 text-center text-[19px] font-extrabold text-ink">{date.getDate()}</Text>
      </View>
      <View className="flex-1 gap-1.5">
        <Text className="text-[20px] font-extrabold tracking-tight text-ink">{title}</Text>
        <View className="flex-row flex-wrap gap-1.5">
          {chips.map(ch => (
            <View key={ch.label} className="rounded-full px-2 py-0.5" style={{ backgroundColor: ch.bg }}>
              <Text className="text-[11px] font-bold" style={{ color: ch.fg }}>{ch.n} {ch.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

function TimelineRow({ entry, first, last, onUndo, onFix }: {
  entry: ActivityEntry
  first: boolean
  last: boolean
  onUndo: () => void
  onFix: () => void
}) {
  const [hover, setHover] = useState(false)
  const k = KIND[entry.kind]
  const time = new Date(entry.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const canEdit = !entry.undone && entry.eventId

  return (
    <FadeIn from={4}>
      <View className="flex-row gap-3">
        {/* Rail + node */}
        <View className="w-12 items-center">
          <View className={`w-[2px] ${first ? 'bg-transparent' : 'bg-line'}`} style={{ height: 22 }} />
          <View className="h-9 w-9 items-center justify-center rounded-full border-[3px] border-paper" style={{ backgroundColor: k.color }}>
            <MaterialCommunityIcons name={k.icon} size={15} color="#fff" />
          </View>
          <View className={`w-[2px] flex-1 ${last ? 'bg-transparent' : 'bg-line'}`} />
        </View>

        <Pressable
          onHoverIn={() => setHover(true)}
          onHoverOut={() => setHover(false)}
          className={`my-1.5 flex-1 flex-row items-center gap-4 rounded-2xl border bg-white px-4 py-3 ${entry.undone ? 'opacity-45' : ''}`}
          style={[shadow.card, { borderColor: hover ? k.color + '55' : '#e2e9e5' }]}
        >
          {/* The food */}
          <View className="h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: k.tint }}>
            <FoodTile name={entry.itemName} category={entry.category} size={48} tint="transparent" />
          </View>

          <View className="flex-1 gap-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <View className="rounded-md px-1.5 py-0.5" style={{ backgroundColor: k.tint }}>
                <Text className="text-[11px] font-bold uppercase tracking-wide" style={{ color: k.color }}>{k.verb}</Text>
              </View>
              <Text className={`text-[16px] font-bold text-ink ${entry.undone ? 'line-through' : ''}`}>
                {displayName(entry.itemName)}{entry.quantity > 1 ? ` ×${entry.quantity}` : ''}
              </Text>
            </View>
            <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
              <Meta icon="clock-outline" text={time} />
              <Meta
                icon={entry.via === 'camera' ? 'cctv' : entry.via === 'manual' ? 'hand-back-right-outline' : 'robot-outline'}
                text={entry.via === 'camera' ? 'Camera' : entry.via === 'manual' ? 'By hand' : 'Automatic'}
              />
              {entry.source && <Meta icon="storefront-outline" text={entry.source} />}
              {entry.confidence != null && <Confidence value={entry.confidence} />}
              {entry.rawLabel && <Meta icon="comment-quote-outline" text={`AI said “${entry.rawLabel}”`} />}
              {entry.undone && <Meta icon="undo" text="Undone" />}
            </View>
          </View>

          {canEdit && (
            <View className="flex-row gap-1.5" style={{ opacity: hover || !WEB ? 1 : 0.55 }}>
              {(entry.kind === 'added' || entry.kind === 'removed') && <Chip icon="pencil-outline" label="Fix" onPress={onFix} />}
              <Chip icon="undo" label="Undo" onPress={onUndo} />
            </View>
          )}
        </Pressable>
      </View>
    </FadeIn>
  )
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <MaterialCommunityIcons name={icon} size={13} color="#8a9a93" />
      <Text className="text-[12px] text-ink-soft">{text}</Text>
    </View>
  )
}

function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? '#2f9e5b' : pct >= 60 ? '#e39a1b' : '#d9493a'
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="h-1.5 w-12 overflow-hidden rounded-full bg-[#e8eeeb]">
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 999 }} />
      </View>
      <Text className="text-[12px] text-ink-soft">{pct}% sure</Text>
    </View>
  )
}

function Chip({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 active:bg-frost">
      <MaterialCommunityIcons name={icon} size={13} color="#4c5d55" />
      <Text className="text-[13px] font-semibold text-ink">{label}</Text>
    </Pressable>
  )
}

function EmptyState({ filter }: { filter: Filter }) {
  const copy: Record<Filter, [string, string]> = {
    all: ['Nothing logged yet', 'Open the fridge and the camera will start the story.'],
    moves: ['No comings and goings', 'Items the camera sees go in or out show up here.'],
    saved: ['Nothing used up yet', 'Mark food as used and it’ll be celebrated here.'],
    wasted: ['Zero waste here', 'Nothing has been thrown out. Keep it that way!'],
  }
  return (
    <View className="mt-10 items-center rounded-3xl border border-dashed border-line bg-white px-6 py-12">
      <View className="flex-row items-end gap-2">
        <FoodShape name="apple" category="produce" scale={1.1} />
        <FoodShape name="milk" category="dairy" scale={0.9} />
        <FoodShape name="carrot" category="produce" scale={1.1} />
      </View>
      <Text className="mt-5 text-[18px] font-extrabold text-ink">{copy[filter][0]}</Text>
      <Text className="mt-1 text-center text-sm text-ink-soft">{copy[filter][1]}</Text>
    </View>
  )
}

/* ---------------- Side column ---------------- */

function WeekCard({ activity, now }: { activity: ActivityEntry[]; now: Date }) {
  const since = startOfDay(now) - 6 * 86_400_000
  const c = counts(activity.filter(a => new Date(a.at).getTime() >= since))
  const rows = [
    { label: 'Went in', n: c.in, color: '#6aaede' },
    { label: 'Taken out', n: c.out, color: '#9aa9a2' },
    { label: 'Used up', n: c.used, color: '#2f9e5b' },
    { label: 'Wasted', n: c.wasted, color: '#d9493a' },
  ]
  const max = Math.max(1, ...rows.map(r => r.n))
  return (
    <FadeIn delay={80}>
      <View className="rounded-3xl border border-line bg-white p-5" style={shadow.card}>
        <Text className="text-[17px] font-extrabold text-ink">This week</Text>
        <Text className="mb-4 text-[13px] text-mute">Every move the fridge saw</Text>
        <View className="gap-3">
          {rows.map(r => (
            <View key={r.label} className="gap-1">
              <View className="flex-row justify-between">
                <Text className="text-[13px] font-semibold text-ink">{r.label}</Text>
                <Text className="text-[13px] font-bold text-ink">{r.n}</Text>
              </View>
              <View className="h-2.5 overflow-hidden rounded-full bg-[#f1f5f3]">
                <View style={{ width: `${(r.n / max) * 100}%`, height: '100%', backgroundColor: r.color, borderRadius: 999 }} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </FadeIn>
  )
}

function TopItems({ activity, now }: { activity: ActivityEntry[]; now: Date }) {
  const since = startOfDay(now) - 13 * 86_400_000
  const tally = new Map<string, { name: string; category: FoodCategory; n: number }>()
  for (const a of activity) {
    if (a.undone || new Date(a.at).getTime() < since) continue
    const key = a.itemName.toLowerCase()
    const t = tally.get(key) ?? { name: a.itemName, category: a.category, n: 0 }
    t.n += 1
    tally.set(key, t)
  }
  const top = [...tally.values()].sort((a, b) => b.n - a.n).slice(0, 5)
  if (!top.length) return null
  return (
    <FadeIn delay={140}>
      <View className="rounded-3xl border border-line bg-white p-5" style={shadow.card}>
        <Text className="text-[17px] font-extrabold text-ink">Most handled</Text>
        <Text className="mb-3 text-[13px] text-mute">Last two weeks</Text>
        {top.map((t, i) => (
          <View key={t.name} className={`flex-row items-center gap-3 py-2 ${i ? 'border-t border-line' : ''}`}>
            <Text className="w-4 text-[13px] font-bold text-mute">{i + 1}</Text>
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-frost">
              <FoodTile name={t.name} category={t.category} size={40} tint="transparent" />
            </View>
            <Text className="flex-1 text-[14px] font-semibold text-ink" numberOfLines={1}>{displayName(t.name)}</Text>
            <Text className="text-[13px] font-bold text-ink-soft">{t.n}×</Text>
          </View>
        ))}
      </View>
    </FadeIn>
  )
}

function TipCard() {
  return (
    <FadeIn delay={200}>
      <View className="overflow-hidden rounded-3xl bg-soon-50 p-5" style={{ borderWidth: 1, borderColor: '#fcebc6' }}>
        <MaterialCommunityIcons name="lightbulb-on-outline" size={90} color="#fcebc6" style={{ position: 'absolute', right: -14, bottom: -14 }} />
        <Text className="text-[11px] font-bold uppercase tracking-[2px] text-soon-700">Tip</Text>
        <Text className="mt-1.5 text-[15px] font-bold leading-5 text-ink">Wrong item? Tap Fix.</Text>
        <Text className="mt-1 text-[13px] leading-5 text-ink-soft">
          NoWaste remembers the correction, so the next time the camera sees the same thing it gets it right.
        </Text>
      </View>
    </FadeIn>
  )
}

/* ---------------- Fix dialog ---------------- */

function FixModal({ entry, onClose, onSave }: {
  entry: ActivityEntry | null
  onClose: () => void
  onSave: (name: string, action: 'in' | 'out') => void
}) {
  const [name, setName] = useState('')
  const [action, setAction] = useState<'in' | 'out'>('in')

  return (
    <Modal
      visible={!!entry}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => { setName(entry?.itemName ?? ''); setAction(entry?.kind === 'removed' ? 'out' : 'in') }}
    >
      <View className="flex-1 items-center justify-center bg-black/35 p-6">
        <View className="w-full max-w-[420px] rounded-3xl bg-white p-5">
          <Text className="mb-3 text-lg font-bold text-ink">Fix this entry</Text>
          <Text className="mb-1.5 mt-2 text-[13px] font-semibold text-mute">What was it?</Text>
          <TextInput className="rounded-xl border border-line bg-paper p-3 text-[15px] text-ink" value={name} onChangeText={setName} autoFocus />
          {!USE_MOCK_DATA && (
            <>
              <Text className="mb-1.5 mt-3 text-[13px] font-semibold text-mute">Going</Text>
              <View className="flex-row gap-2">
                {(['in', 'out'] as const).map(a => (
                  <Pressable key={a} onPress={() => setAction(a)} className={`flex-1 items-center rounded-xl border p-2.5 ${action === a ? 'border-fresh-600 bg-fresh-600' : 'border-line'}`}>
                    <Text className={`font-medium ${action === a ? 'text-white' : 'text-ink'}`}>{a === 'in' ? 'Into fridge' : 'Out of fridge'}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <View className="mt-5 flex-row gap-2.5">
            <Pressable onPress={onClose} className="flex-1 items-center rounded-xl bg-frost p-3"><Text className="text-ink">Cancel</Text></Pressable>
            <Pressable onPress={() => name.trim() && onSave(name.trim(), action)} className="flex-1 items-center rounded-xl bg-ink p-3"><Text className="font-semibold text-white">Save</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
