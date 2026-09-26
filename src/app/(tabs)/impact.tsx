import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useFridge } from '@/fridge/FridgeProvider'
import { CATEGORIES } from '@/fridge/categories'
import { dailySeries, totals, wastedByCategory, wasteFreeStreak, weekOverWeek } from '@/fridge/stats'
import { CategoryBars, CountUp, Legend, SAVED, SavedWastedChart, WASTED } from '@/fridge/components/charts'
import { FadeIn } from '@/ui/motion'
import { shadow } from '@/ui/theme'

// OWNER: phone app team. The "is this working?" page: food saved vs wasted over time.
export default function ImpactScreen() {
  const { history, now } = useFridge()
  const { width } = useWindowDimensions()
  const [showTable, setShowTable] = useState(false)

  const stats = useMemo(() => {
    const monthAgo = now.getTime() - 30 * 86_400_000
    const recent = history.filter(i => i.removed_at && new Date(i.removed_at).getTime() >= monthAgo)
    return {
      t: totals(recent),
      series: dailySeries(history, 14, now),
      byCategory: wastedByCategory(recent),
      streak: wasteFreeStreak(history, now),
      wow: weekOverWeek(history, now),
    }
  }, [history, now])

  const { t, series, byCategory, streak, wow } = stats
  const wide = width >= 1260
  const pct = t.rate === null ? null : Math.round(t.rate * 100)
  const worst = byCategory[0]

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerStyle={{ padding: width < 600 ? 14 : 24, paddingBottom: 48 }}>
      <View className="mb-5">
        <Text className="text-[28px] font-extrabold tracking-tight text-ink">Your impact</Text>
        <Text className="mt-0.5 text-sm text-ink-soft">Last 30 days of this fridge</Text>
      </View>

      <View className={wide ? 'flex-row items-start gap-5' : 'gap-5'}>
        <View className="gap-5" style={wide ? { flex: 1.35 } : undefined}>
          {/* Hero */}
          <FadeIn>
            <View className="overflow-hidden rounded-3xl bg-[#123526] p-6">
              <MaterialCommunityIcons name="leaf" size={180} color="#1b4a35" style={{ position: 'absolute', right: -24, top: -30, transform: [{ rotate: '-18deg' }] }} />
              <Text className="text-xs font-bold uppercase tracking-[2px] text-[#8fc9a8]">Waste avoided</Text>
              <View className="mt-1 flex-row items-end gap-3">
                {pct === null
                  ? <Text className="text-[64px] font-extrabold text-white">—</Text>
                  : <CountUp value={pct} format={v => `${Math.round(v)}%`} className="text-[64px] font-extrabold leading-[70px] tracking-tighter text-white" />}
                <Text className="mb-3 max-w-[220px] text-[15px] leading-5 text-[#cfe7d9]">of the food that left your fridge got eaten, not binned</Text>
              </View>

              {/* Proportion strip: saved | wasted */}
              <View className="mt-4 h-3 flex-row overflow-hidden rounded-full bg-[#1d4a37]" style={{ gap: 2 }}>
                {t.saved > 0 && <View style={{ flex: t.saved, backgroundColor: '#5fd497' }} />}
                {t.wasted > 0 && <View style={{ flex: t.wasted, backgroundColor: WASTED }} />}
              </View>
              <View className="mt-2 flex-row gap-5">
                <Text className="text-[13px] text-[#cfe7d9]"><Text className="font-bold text-white">{t.saved}</Text> items saved</Text>
                <Text className="text-[13px] text-[#cfe7d9]"><Text className="font-bold text-white">{t.wasted}</Text> wasted</Text>
              </View>
            </View>
          </FadeIn>

          <View className="flex-row flex-wrap gap-4">
            <Tile delay={80} icon="fire" iconColor="#b8760a" iconBg="#fff7e8" label="Waste-free streak">
              <CountUp value={streak ?? 0} format={v => `${Math.round(v)} day${Math.round(v) === 1 ? '' : 's'}`} className="text-[26px] font-extrabold text-ink" />
              <Text className="text-xs text-mute">{streak === null ? 'Nothing wasted, ever' : 'since anything was binned'}</Text>
            </Tile>
            <Tile delay={140} icon="silverware-fork-knife" iconColor={SAVED} iconBg="#eef8f1" label="Eaten in time">
              <CountUp value={t.saved} className="text-[26px] font-extrabold text-ink" />
              <Text className="text-xs text-mute">items, last 30 days</Text>
            </Tile>
            <Tile delay={200} icon={wow !== null && wow <= 0 ? 'trending-down' : 'trending-up'} iconColor="#4c5d55" iconBg="#f1f6f4" label="Waste vs last week">
              <Text className="text-[26px] font-extrabold text-ink">
                {wow === null ? '—' : `${wow <= 0 ? '−' : '+'}${Math.abs(Math.round(wow * 100))}%`}
              </Text>
              <Text className="text-xs text-mute">{wow === null ? 'not enough data yet' : wow <= 0 ? 'less food binned' : 'more food binned'}</Text>
            </Tile>
          </View>

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
                <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color="#4c5d55" />
                <Text className="flex-1 text-[13px] leading-5 text-ink-soft">
                  <Text className="font-semibold text-ink">{CATEGORIES[worst.category].label}</Text> is where most waste happens.{' '}
                  {TIPS[worst.category]}
                </Text>
              </View>
            )}
          </Card>
        </View>
      </View>
    </ScrollView>
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
      <View className="rounded-3xl border border-line bg-white p-5" style={shadow.card}>
        <View className="mb-4 flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-[17px] font-bold text-ink">{title}</Text>
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
      <View className="gap-1 rounded-3xl border border-line bg-white p-4" style={shadow.card}>
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
