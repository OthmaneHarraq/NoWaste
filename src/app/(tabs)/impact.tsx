import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useFridge } from '@/fridge/FridgeProvider'
import { CATEGORIES, displayName } from '@/fridge/categories'
import { isWasted } from '@/fridge/freshness'
import { FoodShape } from '@/fridge/components/FoodShape'
import type { FridgeItem } from '@/fridge/types'
import { dailySeries, totals, wastedByCategory, wasteFreeStreak, weekOverWeek } from '@/fridge/stats'
import { CategoryBars, CountUp, Legend, SAVED, SavedWastedChart, WASTED } from '@/fridge/components/charts'
import { FootprintTiles } from '@/fridge/components/FootprintTiles'
import { FadeIn } from '@/ui/motion'
import { shadow } from '@/ui/theme'
import { useTheme } from '@/ui/ThemeProvider'
import { PAGE_BACKGROUND } from '@/ui/background'

// OWNER: phone app team. The "is this working?" page: food saved vs wasted over time.
export default function ImpactScreen() {
  const { history, now } = useFridge()
  const { width } = useWindowDimensions()
  const [showTable, setShowTable] = useState(false)
  const { c } = useTheme()

  const stats = useMemo(() => {
    const monthAgo = now.getTime() - 30 * 86_400_000
    const recent = history.filter(i => i.removed_at && new Date(i.removed_at).getTime() >= monthAgo)
    return {
      t: totals(recent),
      series: dailySeries(history, 14, now),
      byCategory: wastedByCategory(recent),
      recent,
      streak: wasteFreeStreak(history, now),
      wow: weekOverWeek(history, now),
    }
  }, [history, now])

  const { t, series, byCategory, streak, wow, recent } = stats
  const wide = width >= 1260
  const pct = t.rate === null ? null : Math.round(t.rate * 100)
  const worst = byCategory[0]

  return (
    <ScrollView className={`flex-1 bg-paper ${PAGE_BACKGROUND}`} contentContainerStyle={{ padding: width < 600 ? 14 : 24, paddingBottom: 48 }}>
      <View className="mb-5">
        <Text className="font-display-bold text-[34px] leading-[40px] text-ink">Your impact</Text>
        <Text className="mt-0.5 text-sm text-ink-soft">Last 30 days of this fridge</Text>
      </View>

      <View className={wide ? 'flex-row items-start gap-5' : 'gap-5'}>
        <View className="gap-5" style={wide ? { flex: 1.35 } : undefined}>
          {/* Hero */}
          <FadeIn>
            {/* Soft highlight tile, same treatment as the sidebar's ScoreCard. */}
            <View className="overflow-hidden rounded-3xl border border-fresh-100 p-6" style={{ backgroundColor: c.primaryLight }}>
              <MaterialCommunityIcons name="leaf" size={180} color={c.fresh} style={{ position: 'absolute', right: -24, top: -30, opacity: 0.12, transform: [{ rotate: '-18deg' }] }} />
              <Text className="text-xs font-bold uppercase tracking-[2px]" style={{ color: c.primary }}>Waste avoided</Text>
              <View className="mt-1 flex-row items-end gap-3">
                {pct === null
                  ? <Text className="font-display-bold text-[64px]" style={{ color: c.text }}>—</Text>
                  : <CountUp value={pct} format={v => `${Math.round(v)}%`} className="font-display-bold text-[68px] leading-[72px] text-ink" />}
                <Text className="mb-3 max-w-[220px] text-[15px] leading-5" style={{ color: c.textSoft }}>of the food that left your fridge got eaten, not binned</Text>
              </View>

              {/* Proportion strip: saved | wasted */}
              <View className="mt-4 h-3 flex-row overflow-hidden rounded-full" style={{ gap: 2, backgroundColor: c.glass }}>
                {t.saved > 0 && <View style={{ flex: t.saved, backgroundColor: c.fresh }} />}
                {t.wasted > 0 && <View style={{ flex: t.wasted, backgroundColor: WASTED }} />}
              </View>
              <View className="mt-2 flex-row gap-5">
                <Text className="text-[13px]" style={{ color: c.textSoft }}><Text className="font-bold" style={{ color: c.text }}>{t.saved}</Text> items saved</Text>
                <Text className="text-[13px]" style={{ color: c.textSoft }}><Text className="font-bold" style={{ color: c.text }}>{t.wasted}</Text> wasted</Text>
              </View>
            </View>
          </FadeIn>

          <View className="flex-row flex-wrap gap-4">
            <Tile delay={80} icon="fire" iconColor={c.soon} iconBg={c.soonTint} label="Waste-free streak">
              <CountUp value={streak ?? 0} format={v => `${Math.round(v)} day${Math.round(v) === 1 ? '' : 's'}`} className="text-[26px] font-extrabold text-ink" />
              <Text className="text-xs text-mute">{streak === null ? 'Nothing wasted, ever' : 'since anything was binned'}</Text>
            </Tile>
            <Tile delay={140} icon="silverware-fork-knife" iconColor={c.fresh} iconBg={c.freshTint} label="Eaten in time">
              <CountUp value={t.saved} className="text-[26px] font-extrabold text-ink" />
              <Text className="text-xs text-mute">items, last 30 days</Text>
            </Tile>
            <Tile delay={200} icon={wow !== null && wow <= 0 ? 'trending-down' : 'trending-up'} iconColor={c.textSoft} iconBg={c.frost} label="Waste vs last week">
              <Text className="text-[26px] font-extrabold text-ink">
                {wow === null ? '—' : `${Math.abs(Math.round(wow * 100))}%`}
              </Text>
              <Text className="text-xs text-mute">{wow === null ? 'not enough data yet' : wow <= 0 ? 'less food binned than last week' : 'more food binned than last week'}</Text>
            </Tile>
          </View>

          <FootprintTiles items={recent} />

          <Card
            title="Saved vs wasted"
            subtitle="Items leaving the fridge each day, last 14 days"
            right={
              <Pressable onPress={() => setShowTable(s => !s)} className="rounded-full border border-line px-2.5 py-1 active:bg-frost">
                <Text className="text-xs font-semibold text-ink-soft">{showTable ? 'Chart' : 'Table'}</Text>
              </Pressable>
            }
          >
            <Legend items={[{ color: SAVED, label: 'Saved (eaten in time)' }, { color: WASTED, label: 'Wasted (expired or thrown out)' }]} />
            <View className="mt-4">
              {showTable ? <DayTable series={series} /> : <SavedWastedChart data={series} />}
            </View>
          </Card>
        </View>

        <View className="gap-5" style={wide ? { flex: 1 } : undefined}>
          <Card title="What gets wasted most" subtitle="Items wasted by category, last 30 days">
            <CategoryBars data={byCategory} />
            {worst && (
              <View className="mt-5 flex-row gap-3 rounded-2xl bg-frost p-3.5">
                <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color={c.textSoft} />
                <Text className="flex-1 text-[13px] leading-5 text-ink-soft">
                  <Text className="font-semibold text-ink">{CATEGORIES[worst.category].label}</Text> is where most waste happens.{' '}
                  {TIPS[worst.category]}
                </Text>
              </View>
            )}
          </Card>
          <Card title="Every item that left your fridge" subtitle="One tile per item, oldest first, last 30 days">
            <Waffle items={recent} />
          </Card>
          <RescuedCard items={recent} />
        </View>
      </View>
    </ScrollView>
  )
}


/** Unit chart: every item that left the fridge is one tile, green if eaten, coral if wasted. */
function Waffle({ items }: { items: FridgeItem[] }) {
  const tiles = [...items]
    .filter(i => i.removed_at && (i.status === 'consumed' || isWasted(i)))
    .sort((a, b) => a.removed_at!.localeCompare(b.removed_at!))
    .flatMap(i => Array.from({ length: i.quantity }, (_, k) => ({ key: i.id + k, wasted: isWasted(i), name: i.name })))
  if (!tiles.length) return <Text className="py-6 text-center text-sm text-mute">Nothing has left the fridge yet.</Text>
  const wasted = tiles.filter(t => t.wasted).length
  return (
    <View>
      <View className="flex-row flex-wrap" style={{ gap: 5 }}>
        {tiles.map(t => (
          <View
            key={t.key}
            accessibilityLabel={`${displayName(t.name)}: ${t.wasted ? 'wasted' : 'saved'}`}
            style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: t.wasted ? WASTED : SAVED }}
          />
        ))}
      </View>
      <View className="mt-4 flex-row flex-wrap items-center justify-between gap-2">
        <Legend items={[{ color: SAVED, label: `Saved · ${tiles.length - wasted}` }, { color: WASTED, label: `Wasted · ${wasted}` }]} />
        <Text className="text-xs text-mute">{tiles.length} items</Text>
      </View>
    </View>
  )
}

/** The foods most often eaten in time, drawn with the same illustrations as the Fridge view. */
function RescuedCard({ items }: { items: FridgeItem[] }) {
  const { dark } = useTheme()
  const tally = new Map<string, { item: FridgeItem; n: number }>()
  for (const i of items) {
    if (i.status !== 'consumed') continue
    const k = i.name.toLowerCase()
    const t = tally.get(k) ?? { item: i, n: 0 }
    t.n += i.quantity
    tally.set(k, t)
  }
  const top = [...tally.values()].sort((a, b) => b.n - a.n).slice(0, 4)
  if (!top.length) return null
  return (
    <FadeIn delay={160}>
      <View className="overflow-hidden rounded-3xl bg-fresh-50 p-5" style={[shadow.card, { borderWidth: 1, borderColor: dark ? '#1b3a29' : '#d5eedc' }]}>
        <MaterialCommunityIcons name="trophy-outline" size={110} color={dark ? '#1b3a29' : '#d5eedc'} style={{ position: 'absolute', right: -16, top: -10, transform: [{ rotate: '12deg' }] }} />
        <Text className="text-[11px] font-bold uppercase tracking-[2px] text-fresh-700">Hall of fame</Text>
        <Text className="mb-4 mt-1 font-display text-[20px] text-ink">Rescued most often</Text>
        <View className="flex-row flex-wrap gap-3">
          {top.map(({ item, n }) => (
            <View key={item.name} className="min-w-[92px] flex-1 items-center rounded-2xl bg-surface px-2 py-3" style={shadow.card}>
              <View style={{ height: 50, justifyContent: 'flex-end' }}>
                <FoodShape name={item.name} category={item.category} scale={0.95} />
              </View>
              <Text className="mt-2 text-[13px] font-bold text-ink" numberOfLines={2} style={{ textAlign: 'center' }}>{displayName(item.name)}</Text>
              <Text className="text-xs font-semibold text-fresh-700">{n}× saved</Text>
            </View>
          ))}
        </View>
      </View>
    </FadeIn>
  )
}

const TIPS: Record<string, string> = {
  takeout: 'Leftovers last ~3 days. Put them front and center and plan one "leftovers night".',
  produce: 'Buy smaller amounts more often, and keep greens in the crisper with a paper towel.',
  meat: 'Freeze raw meat you won’t cook within 2 days. It keeps for months.',
  dairy: 'Check dates when you shop, and move older cartons to the front.',
  beverage: 'Opened juice lasts about a week. Smaller bottles waste less.',
  condiment: 'Opened sauces last a long time. Check before buying another.',
  other: 'Label containers with the day you made them.',
}

function Card({ title, subtitle, right, children }: { title: string; subtitle: string; right?: ReactNode; children: ReactNode }) {
  return (
    <FadeIn delay={120}>
      <View className="rounded-3xl border border-line bg-surface p-5" style={shadow.card}>
        <View className="mb-4 flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-display text-[20px] text-ink">{title}</Text>
            <Text className="mt-0.5 text-[13px] text-mute">{subtitle}</Text>
          </View>
          {right}
        </View>
        {children}
      </View>
    </FadeIn>
  )
}

function Tile({ icon, iconColor, iconBg, label, delay, children }: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap
  iconColor: string
  iconBg: string
  label: string
  delay: number
  children: ReactNode
}) {
  return (
    <FadeIn delay={delay} style={{ flexGrow: 1, flexBasis: 170 }}>
      <View className="gap-1 rounded-3xl border border-line bg-surface p-4" style={shadow.card}>
        <View className="mb-1 flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: iconBg }}>
            <MaterialCommunityIcons name={icon} size={16} color={iconColor} />
          </View>
          <Text className="text-xs font-semibold text-ink-soft">{label}</Text>
        </View>
        {children}
      </View>
    </FadeIn>
  )
}

function DayTable({ series }: { series: ReturnType<typeof dailySeries> }) {
  return (
    <View>
      <View className="flex-row border-b border-line pb-1.5">
        <Text className="flex-1 text-xs font-semibold text-mute">Day</Text>
        <Text className="w-16 text-right text-xs font-semibold text-mute">Saved</Text>
        <Text className="w-16 text-right text-xs font-semibold text-mute">Wasted</Text>
      </View>
      {[...series].reverse().map(d => (
        <View key={d.date.toISOString()} className="flex-row border-b border-line py-1.5">
          <Text className="flex-1 text-[13px] text-ink">{d.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
          <Text className="w-16 text-right text-[13px] text-ink">{d.saved}</Text>
          <Text className="w-16 text-right text-[13px] text-ink">{d.wasted}</Text>
        </View>
      ))}
    </View>
  )
}
