import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useFridge } from '@/fridge/FridgeProvider'
import { CATEGORIES, CATEGORY_ORDER } from '@/fridge/categories'
import { freshnessOf } from '@/fridge/freshness'
import type { FoodCategory } from '@/fridge/types'
import { ActionNeededPanel } from '@/fridge/components/ActionNeededPanel'
import { FridgeShelves, type SortMode } from '@/fridge/components/FridgeShelves'
import { LiveFeed } from '@/fridge/components/LiveFeed'

// OWNER: phone app team. The fridge dashboard: what's inside, what to use first, and what
// the camera just saw. Updates live (Supabase Realtime) — no refresh needed.
export default function FridgeScreen() {
  const { current, loading, now } = useFridge()
  const { width } = useWindowDimensions()
  const [category, setCategory] = useState<FoodCategory | 'all'>('all')
  const [sort, setSort] = useState<SortMode>('shelf')
  const [where, setWhere] = useState<Where>('all')
  const phone = width < 600

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
      <Segmented value={sort} onChange={setSort} options={SORT_OPTIONS} />
    </View>
  )
  // Phone: one swipeable row of chips instead of three wrapped rows.
  const filters = phone ? (
    <View className="gap-3">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 14 }} style={{ marginRight: -14 }}>
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

  const fridge = (
    <View className="gap-4">
      <View className="flex-row flex-wrap items-end justify-between gap-3">
        <View>
          <Text className={`${phone ? 'text-[24px]' : 'text-[28px]'} font-extrabold tracking-tight text-ink`}>What’s in the fridge</Text>
          <Text className="mt-0.5 text-sm text-ink-soft">
            {current.length} items · {fresh} fresh{frozen ? ` · ${frozen} frozen` : ''}{pending ? ` · ${pending} taken out` : ''}
          </Text>
        </View>
        <AddItem full={phone} />
      </View>

      {filters}

      <FridgeShelves items={visible} sort={sort} filtered={category !== 'all' || where !== 'all'} />
      <Legend />
    </View>
  )

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerStyle={{ padding: width < 600 ? 14 : 24, paddingBottom: 48 }}>
      {twoColumn ? (
        <View className="flex-row items-start gap-6">
          <View className="flex-1">{fridge}</View>
          <View className="w-[360px] gap-5">
            <ActionNeededPanel />
            <LiveFeed />
          </View>
        </View>
      ) : (
        <View className="gap-5">
          <ActionNeededPanel />
          {fridge}
          <LiveFeed />
        </View>
      )}
    </ScrollView>
  )
}

type Where = 'all' | 'fridge' | 'freezer'
const WHERE_OPTIONS: { v: Where; label: string }[] = [{ v: 'all', label: 'Everywhere' }, { v: 'fridge', label: 'Fridge' }, { v: 'freezer', label: 'Freezer' }]
const SORT_OPTIONS: { v: SortMode; label: string }[] = [{ v: 'shelf', label: 'By shelf' }, { v: 'expiry', label: 'By expiry' }]

function AddItem({ full }: { full: boolean }) {
  const { addItem } = useFridge()
  const [name, setName] = useState('')
  async function submit() {
    if (!name.trim()) return
    if (await addItem(name.trim())) setName('')
  }
  return (
    <View className={`flex-row items-center rounded-xl border border-line bg-white pl-3 ${full ? 'w-full' : ''}`}>
      <MaterialCommunityIcons name="plus" size={16} color="#8a9a93" />
      <TextInput
        value={name}
        onChangeText={setName}
        onSubmitEditing={submit}
        placeholder="Add by hand (e.g. milk)"
        placeholderTextColor="#8a9a93"
        returnKeyType="done"
        className={`${full ? 'flex-1' : 'w-48'} px-2 py-2.5 text-sm text-ink`}
        style={{ outlineStyle: 'none' } as object}
      />
      <Pressable onPress={submit} className="m-1 rounded-lg bg-ink px-3 py-1.5 active:opacity-80">
        <Text className="text-[13px] font-semibold text-white">Add</Text>
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
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${active ? 'border-ink bg-ink' : 'border-line bg-white active:bg-frost'}`}
    >
      {icon && <MaterialCommunityIcons name={icon} size={14} color={active ? '#fff' : color} />}
      <Text className={`text-[13px] font-semibold ${active ? 'text-white' : 'text-ink'}`}>{label}</Text>
      <Text className={`text-xs ${active ? 'text-[#b7c6bf]' : 'text-mute'}`}>{count}</Text>
    </Pressable>
  )
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; label: string }[] }) {
  return (
    <View className="flex-row rounded-xl bg-[#e8eeeb] p-0.5">
      {options.map(o => (
        <Pressable key={o.v} onPress={() => onChange(o.v)} className={`rounded-[10px] px-3 py-1.5 ${value === o.v ? 'bg-white' : ''}`}>
          <Text className={`text-[13px] font-semibold ${value === o.v ? 'text-ink' : 'text-ink-soft'}`}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

function Legend() {
  const rows = [
    { c: '#2f9e5b', t: 'Fresh' },
    { c: '#e39a1b', t: 'Use within 2 days' },
    { c: '#d9493a', t: 'Past its date' },
  ]
  return (
    <View className="flex-row flex-wrap gap-4 px-1">
      {rows.map(r => (
        <View key={r.t} className="flex-row items-center gap-1.5">
          <View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: r.c }} />
          <Text className="text-xs text-ink-soft">{r.t}</Text>
        </View>
      ))}
      <View className="flex-row items-center gap-1.5">
        <View style={{ width: 14, height: 10, borderRadius: 3, borderWidth: 1, borderStyle: 'dashed', borderColor: '#8a9a93' }} />
        <Text className="text-xs text-ink-soft">Taken out, waiting to see if it comes back</Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <MaterialCommunityIcons name="snowflake" size={12} color="#5b8fb9" />
        <Text className="text-xs text-ink-soft">Frozen: dated by freezer shelf life</Text>
      </View>
    </View>
  )
}
