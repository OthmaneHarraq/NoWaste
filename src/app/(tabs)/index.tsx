import { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useFridge } from '@/fridge/FridgeProvider'
import { CATEGORIES, CATEGORY_ORDER } from '@/fridge/categories'
import { freshnessOf } from '@/fridge/freshness'
import type { FoodCategory } from '@/fridge/types'
import { FridgeShelves, type SortMode } from '@/fridge/components/FridgeShelves'
import { FridgeView } from '@/fridge/components/FridgeView'
import { LiveFeed } from '@/fridge/components/LiveFeed'
import { useFreshHex, useIce } from '@/fridge/components/visuals'
import { useTheme } from '@/ui/ThemeProvider'

// OWNER: phone app team. The fridge dashboard: what's inside, what to use first, and what
// the camera just saw. Updates live (Supabase Realtime) — no refresh needed.
//
// Web: the page stays put and only the fridge (and the side panel) scroll, and there's a
// second, illustrated "Fridge" view. Phones keep the single scrolling card view.

const WEB = Platform.OS === 'web'
type ViewMode = 'normal' | 'fridge'
const VIEW_KEY = 'nowaste:view'
// Web-only dot texture behind the page (same as Activity and Impact).
const DOTS = WEB ? 'bg-[radial-gradient(#cfdcd3_1.2px,transparent_1.2px)] bg-[length:20px_20px] dark:bg-[radial-gradient(#1f2a25_1.2px,transparent_1.2px)]' : ''

function savedView(): ViewMode {
  try {
    return WEB && window.localStorage.getItem(VIEW_KEY) === 'fridge' ? 'fridge' : 'normal'
  } catch {
    return 'normal'
  }
}

export default function FridgeScreen() {
  const { current, loading, now } = useFridge()
  const { width, height } = useWindowDimensions()
  const [category, setCategory] = useState<FoodCategory | 'all'>('all')
  const [sort, setSort] = useState<SortMode>('shelf')
  const [where, setWhere] = useState<Where>('all')
  const [view, setView] = useState<ViewMode>(savedView)
  const phone = width < 600

  useEffect(() => {
    try {
      if (WEB) window.localStorage.setItem(VIEW_KEY, view)
    } catch {
      // Private mode etc.: the toggle still works, it just isn't remembered.
    }
  }, [view])

  // Sidebar tab bar eats ~200px; below this the side panels stack above/below the fridge.
  const twoColumn = width >= 1260

  const visible = current.filter(i =>
    (category === 'all' || i.category === category) &&
    (where === 'all' || (where === 'freezer') === (i.location === 'freezer')))
  const frozen = current.filter(i => i.location === 'freezer').length
  const counts = new Map<FoodCategory, number>()
  for (const i of current) counts.set(i.category, (counts.get(i.category) ?? 0) + 1)
  const fresh = current.filter(i => i.status === 'in_fridge' && freshnessOf(i, now) === 'fresh').length
  const pending = current.filter(i => i.status === 'pending_removal').length
  const filtered = category !== 'all' || where !== 'all'

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color="#2f9e5b" />
      </View>
    )
  }

  const chips = (
    <>
      <Chip label="All" count={current.length} active={category === 'all'} onPress={() => setCategory('all')} />
      {CATEGORY_ORDER.filter(c => counts.get(c)).map(c => (
        <Chip key={c} label={CATEGORIES[c].label} icon={CATEGORIES[c].icon} color={CATEGORIES[c].color} count={counts.get(c)!} active={category === c} onPress={() => setCategory(category === c ? 'all' : c)} />
      ))}
    </>
  )
  const controls = (
    <View className="flex-row flex-wrap gap-2">
      <Segmented value={where} onChange={setWhere} options={WHERE_OPTIONS} />
      {view === 'normal' && <Segmented value={sort} onChange={setSort} options={SORT_OPTIONS} />}
    </View>
  )
  // Phone: one swipeable row of chips instead of three wrapped rows.
  const filters = phone ? (
    <View className="gap-3">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 14 }} style={{ marginRight: -14, flexGrow: 0 }}>
        {chips}
      </ScrollView>
      {controls}
    </View>
  ) : (
    <View className="flex-row flex-wrap items-center justify-between gap-3">
      <View className="flex-1 flex-row flex-wrap gap-1.5" style={{ minWidth: 260 }}>{chips}</View>
      {controls}
    </View>
  )

  const header = (
    <View className="flex-row flex-wrap items-end justify-between gap-3">
      <View>
        <Text className={`${phone ? 'text-[28px]' : 'text-[34px]'} font-display-bold leading-[1.15] text-ink`}>What’s in the fridge</Text>
        <Text className="mt-0.5 text-sm text-ink-soft">
          {current.length} items · {fresh} fresh{frozen ? ` · ${frozen} frozen` : ''}{pending ? ` · ${pending} taken out` : ''}
        </Text>
      </View>
      <View className={`flex-row flex-wrap items-center gap-3 ${phone ? 'w-full' : ''}`}>
        {WEB && <ViewToggle value={view} onChange={setView} />}
        <AddItem full={phone} />
      </View>
    </View>
  )

  const contents = (scroll: boolean) =>
    view === 'fridge' && WEB
      ? <FridgeView items={visible} filtered={filtered} />
      : <FridgeShelves items={visible} sort={sort} filtered={filtered} scroll={scroll} />

  // Web, wide: a fixed page. Header + filters stay put; the fridge and the side panel scroll.
  if (WEB && twoColumn) {
    return (
      <View className={`flex-1 flex-row gap-6 bg-paper ${DOTS}`} style={{ padding: 24, paddingBottom: 16 }}>
        <View className="flex-1 gap-4" style={{ minHeight: 0 }}>
          {header}
          {filters}
          <View className="flex-1" style={{ minHeight: 0 }}>{contents(true)}</View>
          {view === 'normal' && <Legend />}
        </View>
        <ScrollView style={{ width: 360, flexGrow: 0 }} contentContainerStyle={{ gap: 20, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
          <LiveFeed />
        </ScrollView>
      </View>
    )
  }

  // Web, narrow (tablet): the page scrolls, but the fridge is a fixed-height window of its own.
  // Phones: one scrolling page, no nested scrolling (it fights touch scrolling).
  return (
    <ScrollView className={`flex-1 bg-paper ${DOTS}`} contentContainerStyle={{ padding: phone ? 14 : 24, paddingBottom: 48 }}>
      <View className="gap-5">
        <View className="gap-4">
          {header}
          {filters}
          {WEB ? <View style={{ height: Math.max(460, height * 0.72) }}>{contents(true)}</View> : contents(false)}
          {view === 'normal' && <Legend />}
        </View>
        <LiveFeed />
      </View>
    </ScrollView>
  )
}

type Where = 'all' | 'fridge' | 'freezer'
const WHERE_OPTIONS: { v: Where; label: string }[] = [{ v: 'all', label: 'Everywhere' }, { v: 'fridge', label: 'Fridge' }, { v: 'freezer', label: 'Freezer' }]
const SORT_OPTIONS: { v: SortMode; label: string }[] = [{ v: 'shelf', label: 'By shelf' }, { v: 'expiry', label: 'By expiry' }]

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const { c } = useTheme()
  const options: { v: ViewMode; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
    { v: 'normal', label: 'Normal', icon: 'view-grid-outline' },
    { v: 'fridge', label: 'Fridge', icon: 'fridge-outline' },
  ]
  return (
    <View className="flex-row rounded-xl border border-line bg-surface p-1" accessibilityRole="tablist">
      {options.map(o => {
        const on = value === o.v
        return (
          <Pressable
            key={o.v}
            onPress={() => onChange(o.v)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            className={`flex-row items-center gap-1.5 rounded-lg px-3 py-1.5 ${on ? 'bg-ink' : 'active:bg-frost'}`}
          >
            <MaterialCommunityIcons name={o.icon} size={15} color={on ? c.onInk : c.textSoft} />
            <Text className={`text-[13px] font-semibold ${on ? 'text-on-ink' : 'text-ink-soft'}`}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function AddItem({ full }: { full: boolean }) {
  const { addItem } = useFridge()
  const { c } = useTheme()
  const [name, setName] = useState('')
  async function submit() {
    if (!name.trim()) return
    if (await addItem(name.trim())) setName('')
  }
  return (
    <View className={`flex-row items-center rounded-xl border border-line bg-surface pl-3 ${full ? 'w-full' : ''}`}>
      <MaterialCommunityIcons name="plus" size={16} color={c.muted} />
      <TextInput
        value={name}
        onChangeText={setName}
        onSubmitEditing={submit}
        placeholder="Add by hand (e.g. milk)"
        placeholderTextColor={c.muted}
        returnKeyType="done"
        className={`${full ? 'flex-1' : 'w-48'} px-2 py-2.5 text-sm text-ink`}
        style={{ outlineStyle: 'none' } as object}
      />
      <Pressable onPress={submit} className="m-1 rounded-lg bg-ink px-3 py-1.5 active:opacity-80">
        <Text className="text-[13px] font-semibold text-on-ink">Add</Text>
      </Pressable>
    </View>
  )
}

function Chip({ label, count, active, onPress, icon, color }: {
  label: string
  count: number
  active: boolean
  onPress: () => void
  icon?: keyof typeof MaterialCommunityIcons.glyphMap
  color?: string
}) {
  const { c } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${active ? 'border-ink bg-ink' : 'border-line bg-surface active:bg-frost'}`}
    >
      {icon && <MaterialCommunityIcons name={icon} size={14} color={active ? c.onInk : color} />}
      <Text className={`text-[13px] font-semibold ${active ? 'text-on-ink' : 'text-ink'}`}>{label}</Text>
      <Text className={`text-xs ${active ? 'text-mute' : 'text-mute'}`}>{count}</Text>
    </Pressable>
  )
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; label: string }[] }) {
  return (
    <View className="flex-row rounded-xl bg-frost p-0.5">
      {options.map(o => (
        <Pressable key={o.v} onPress={() => onChange(o.v)} className={`rounded-[10px] px-3 py-1.5 ${value === o.v ? 'bg-surface' : ''}`}>
          <Text className={`text-[13px] font-semibold ${value === o.v ? 'text-ink' : 'text-ink-soft'}`}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

function Legend() {
  const hex = useFreshHex()
  const ice = useIce()
  const { c } = useTheme()
  return (
    <View className="flex-row flex-wrap gap-4 px-1">
      {(['fresh', 'soon', 'expired'] as const).map(k => (
        <View key={k} className="flex-row items-center gap-1.5">
          <View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: hex(k) }} />
          <Text className="text-xs text-ink-soft">{k === 'fresh' ? 'Fresh' : k === 'soon' ? 'Use within 2 days' : 'Past its date'}</Text>
        </View>
      ))}
      <View className="flex-row items-center gap-1.5">
        <View style={{ width: 14, height: 10, borderRadius: 3, borderWidth: 1, borderStyle: 'dashed', borderColor: c.muted }} />
        <Text className="text-xs text-ink-soft">Taken out, waiting to see if it comes back</Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <MaterialCommunityIcons name="snowflake" size={12} color={ice.icon} />
        <Text className="text-xs text-ink-soft">Frozen: dated by freezer shelf life</Text>
      </View>
    </View>
  )
}
