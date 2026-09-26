import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Pressable, Text, View } from 'react-native'
import Svg, { G, Line, Path } from 'react-native-svg'
import { CATEGORIES } from '../categories'
import type { DayStat } from '../stats'
import type { FoodCategory } from '../types'
import { CategoryIcon } from './visuals'

// Chart colors: validated with the dataviz palette checker (CVD-safe via a lightness gap).
// The coral is under 3:1 on white, so every chart here also has value labels / tooltip / table.
export const SAVED = '#1f7a55'
export const WASTED = '#f0907a'
const GRID = '#e8eeeb'
const TRACK = '#f3f6f4'

/** Rect with only the top corners rounded (data end), flat on the baseline. */
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2)
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`
}

/** Saved vs wasted per day: stacked columns, saved on the baseline. */
export function SavedWastedChart({ data, height = 220 }: { data: DayStat[]; height?: number }) {
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)
  const grow = useRef(new Animated.Value(0)).current
  const [g, setG] = useState(0)

  useEffect(() => {
    const id = grow.addListener(({ value }) => setG(value))
    Animated.timing(grow, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
    return () => grow.removeListener(id)
  }, [grow])

  const max = Math.max(4, ...data.map(d => d.saved + d.wasted))
  const top = Math.ceil(max / 2) * 2
  const axisW = 22
  const plotW = Math.max(0, width - axisW)
  const slot = data.length ? plotW / data.length : 0
  const barW = Math.max(6, Math.min(26, slot * 0.58))
  const y = (v: number) => height - (v / top) * height * g
  const ticks = [0, top / 2, top]

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <View style={{ height: height + 26 }}>
          <Svg width={width} height={height + 2}>
            {ticks.map(t => (
              <Line key={t} x1={axisW} x2={width} y1={height - (t / top) * height} y2={height - (t / top) * height} stroke={GRID} strokeWidth={1} />
            ))}
            {data.map((d, i) => {
              const x = axisW + i * slot + (slot - barW) / 2
              const savedTop = y(d.saved)
              const wastedTop = y(d.saved + d.wasted)
              const dim = active !== null && active !== i ? 0.35 : 1
              return (
                <G key={i} opacity={dim}>
                  {d.saved > 0 && <Path d={d.wasted > 0 ? `M${x},${height} L${x},${savedTop} L${x + barW},${savedTop} L${x + barW},${height} Z` : topRounded(x, savedTop, barW, height - savedTop, 4)} fill={SAVED} />}
                  {/* 2px surface gap between stacked segments */}
                  {d.wasted > 0 && <Path d={topRounded(x, wastedTop, barW, Math.max(0, savedTop - wastedTop - (d.saved > 0 ? 2 : 0)), 4)} fill={WASTED} />}
                </G>
              )
            })}
            <Line x1={axisW} x2={width} y1={height} y2={height} stroke="#cfd9d4" strokeWidth={1} />
          </Svg>

          {/* y-axis labels */}
          {ticks.map(t => (
            <Text key={t} className="absolute text-[10px] text-mute" style={{ left: 0, top: height - (t / top) * height - 7 }}>{t}</Text>
          ))}
          {/* x-axis labels: every other day + today */}
          {data.map((d, i) => (i % 2 === (data.length - 1) % 2 ? (
            <Text key={i} className="absolute text-center text-[10px] text-mute" style={{ left: axisW + i * slot, width: slot, top: height + 8 }}>
              {i === data.length - 1 ? 'Today' : d.date.toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' })}
            </Text>
          ) : null))}

          {/* Hit targets: full column height, wider than the bar */}
          {data.map((d, i) => (
            <Pressable
              key={i}
              onHoverIn={() => setActive(i)}
              onHoverOut={() => setActive(a => (a === i ? null : a))}
              onPress={() => setActive(a => (a === i ? null : i))}
              style={{ position: 'absolute', left: axisW + i * slot, width: slot, top: 0, height }}
              accessibilityLabel={`${d.date.toDateString()}: ${d.saved} saved, ${d.wasted} wasted`}
            />
          ))}

          {active !== null && (
            <Tooltip
              left={Math.min(Math.max(0, axisW + active * slot + slot / 2 - 70), width - 140)}
              top={Math.max(0, y(data[active].saved + data[active].wasted) - 78)}
              title={data[active].date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              rows={[{ color: SAVED, label: 'Saved', value: data[active].saved }, { color: WASTED, label: 'Wasted', value: data[active].wasted }]}
            />
          )}
        </View>
      )}
    </View>
  )
}

function Tooltip({ left, top, title, rows }: { left: number; top: number; title: string; rows: { color: string; label: string; value: number }[] }) {
  return (
    <View pointerEvents="none" className="absolute w-[140px] rounded-xl border border-line bg-white px-3 py-2" style={{ left, top, shadowColor: '#17251f', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
      <Text className="mb-1 text-xs font-semibold text-ink">{title}</Text>
      {rows.map(r => (
        <View key={r.label} className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: r.color }} />
            <Text className="text-xs text-ink-soft">{r.label}</Text>
          </View>
          <Text className="text-xs font-semibold text-ink">{r.value}</Text>
        </View>
      ))}
    </View>
  )
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <View className="flex-row flex-wrap gap-4">
      {items.map(i => (
        <View key={i.label} className="flex-row items-center gap-1.5">
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: i.color }} />
          <Text className="text-xs font-medium text-ink-soft">{i.label}</Text>
        </View>
      ))}
    </View>
  )
}

/** Wasted items per category: horizontal bars, direct-labelled, biggest first. */
export function CategoryBars({ data }: { data: { category: FoodCategory; count: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.count))
  const grow = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(grow, { toValue: 1, duration: 800, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [grow])

  if (data.length === 0) return <Text className="py-6 text-center text-sm text-mute">Nothing wasted yet. Keep it up!</Text>

  return (
    <View className="gap-3">
      {data.map(d => (
        <View key={d.category} className="flex-row items-center gap-3">
          <CategoryIcon category={d.category} size={30} />
          <View className="flex-1 gap-1">
            <View className="flex-row justify-between">
              <Text className="text-[13px] font-semibold text-ink">{CATEGORIES[d.category].label}</Text>
              <Text className="text-[13px] font-semibold text-ink">{d.count}</Text>
            </View>
            <View className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: TRACK }}>
              <Animated.View
                style={{
                  height: '100%', borderRadius: 999, backgroundColor: WASTED,
                  width: grow.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${(d.count / max) * 100}%`] }),
                }}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}

/** Counts up from 0 on mount; the Impact page's "moment". */
export function CountUp({ value, format = v => String(Math.round(v)), className }: { value: number; format?: (v: number) => string; className?: string }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const v = new Animated.Value(0)
    const id = v.addListener(({ value: x }) => setShown(x))
    Animated.timing(v, { toValue: value, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
    return () => v.removeListener(id)
  }, [value])
  return <Text className={className}>{format(shown)}</Text>
}
