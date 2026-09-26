import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import type { BottomTabBarProps } from 'expo-router/js-tabs'
import { useFridge } from '@/fridge/FridgeProvider'
import { freshnessOf } from '@/fridge/freshness'
import { totals, wasteFreeStreak } from '@/fridge/stats'
import { useTheme } from './ThemeProvider'

type IconName = keyof typeof MaterialCommunityIcons.glyphMap

const NAV: Record<string, { label: string; icon: IconName; hint: string }> = {
  index:    { label: 'Fridge',   icon: 'fridge-outline',        hint: 'What’s inside' },
  activity: { label: 'Activity', icon: 'timeline-text-outline', hint: 'In, out, used' },
  impact:   { label: 'Impact',   icon: 'leaf',                  hint: 'Waste avoided' },
  camera:   { label: 'Camera',   icon: 'camera-outline',        hint: 'Detector' },
  settings: { label: 'Settings', icon: 'cog-outline',           hint: 'Fridge & account' },
}
const PRIMARY = ['index', 'activity', 'impact']

/**
 * Wide-screen navigation (web/tablet): brand, the three main destinations with room to
 * breathe, device links, and a small "how are we doing" card anchoring the bottom.
 */
export function Sidebar({ state, descriptors, navigation, fridgeName }: BottomTabBarProps & { fridgeName: string }) {
  const { actionNeeded, activity, history, now } = useFridge()

  const visible = state.routes.filter(r => {
    const style = descriptors[r.key]?.options.tabBarItemStyle as { display?: string } | undefined
    return NAV[r.name] && style?.display !== 'none' // href: null routes are hidden
  })
  const primary = visible.filter(r => PRIMARY.includes(r.name))
  const secondary = visible.filter(r => !PRIMARY.includes(r.name))

  const expired = actionNeeded.filter(i => freshnessOf(i, now) === 'expired').length
  const today = activity.filter(a => !a.undone && new Date(a.at).toDateString() === now.toDateString()).length
  const badges: Record<string, { n: number; tone: 'alert' | 'warn' | 'quiet' } | undefined> = {
    index: actionNeeded.length ? { n: actionNeeded.length, tone: expired ? 'alert' : 'warn' } : undefined,
    activity: today ? { n: today, tone: 'quiet' } : undefined,
  }

  const go = (routeKey: string, name: string, focused: boolean) => {
    const e = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true })
    if (!focused && !e.defaultPrevented) navigation.navigate(name)
  }
  const item = (r: (typeof state.routes)[number]) => {
    const focused = state.routes[state.index]?.key === r.key
    return <NavItem key={r.key} name={r.name} focused={focused} badge={badges[r.name]} onPress={() => go(r.key, r.name, focused)} />
  }

  return (
    <View className="h-full w-[264px] border-r border-line bg-surface" style={{ paddingTop: 22, paddingBottom: 18 }}>
      {/* Brand */}
      <View className="flex-row items-center gap-3 px-6">
        <View className="h-11 w-11 items-center justify-center rounded-[14px] bg-fresh-600" style={{ shadowColor: '#23804a', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
          <MaterialCommunityIcons name="leaf" size={24} color="#fff" style={{ transform: [{ rotate: '-12deg' }] }} />
        </View>
        <View className="flex-1">
          <Text className="font-display-bold text-[22px] tracking-tight text-ink">NoWaste</Text>
          <Text className="text-[13px] text-mute" numberOfLines={1}>{fridgeName}</Text>
        </View>
      </View>

      <View className="mx-6 mb-4 mt-7 h-px bg-line" />
      <Text className="mb-2 px-7 text-[11px] font-bold uppercase tracking-[2px] text-mute">Menu</Text>
      <View className="gap-2 px-4">{primary.map(item)}</View>

      {secondary.length > 0 && (
        <>
          <Text className="mb-2 mt-7 px-7 text-[11px] font-bold uppercase tracking-[2px] text-mute">Device</Text>
          <View className="gap-2 px-4">{secondary.map(item)}</View>
        </>
      )}

      <View className="flex-1" />
      <ScoreCard history={history} now={now} onPress={() => navigation.navigate('impact')} />
    </View>
  )
}

function NavItem({ name, focused, badge, onPress }: {
  name: string
  focused: boolean
  badge?: { n: number; tone: 'alert' | 'warn' | 'quiet' }
  onPress: () => void
}) {
  const [hover, setHover] = useState(false)
  const nav = NAV[name]
  const { c } = useTheme()
  const badgeStyle = badge?.tone === 'alert' ? 'bg-spoiled-500' : badge?.tone === 'warn' ? 'bg-soon-500' : 'bg-ink-soft'

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      className={`flex-row items-center gap-3.5 rounded-2xl px-3 py-3 ${focused ? 'bg-fresh-50' : hover ? 'bg-frost' : ''}`}
      style={{ transitionProperty: 'background-color', transitionDuration: '150ms' } as object}
    >
      {/* Active accent bar */}
      <View className={`absolute bottom-3 left-0 top-3 w-1 rounded-r-full ${focused ? 'bg-fresh-600' : 'bg-transparent'}`} />
      <View className={`h-10 w-10 items-center justify-center rounded-xl ${focused ? 'bg-fresh-600' : hover ? 'bg-surface' : 'bg-frost'}`}>
        <MaterialCommunityIcons name={nav.icon} size={22} color={focused ? '#ffffff' : c.textSoft} />
      </View>
      <View className="flex-1">
        <Text className={`text-[16px] font-bold ${focused ? 'text-fresh-700' : 'text-ink'}`}>{nav.label}</Text>
        <Text className={`text-[12px] ${focused ? 'text-fresh-600' : 'text-mute'}`}>{nav.hint}</Text>
      </View>
      {badge && (
        <View className={`min-w-[24px] items-center rounded-full px-2 py-0.5 ${badgeStyle}`}>
          <Text className="text-[12px] font-bold text-white">{badge.n}</Text>
        </View>
      )}
    </Pressable>
  )
}

/** Bottom-anchored: this month's waste-avoided rate and streak, tapping through to Impact. */
function ScoreCard({ history, now, onPress }: { history: ReturnType<typeof useFridge>['history']; now: Date; onPress: () => void }) {
  const { rate, streak } = useMemo(() => {
    const monthAgo = now.getTime() - 30 * 86_400_000
    const recent = history.filter(i => i.removed_at && new Date(i.removed_at).getTime() >= monthAgo)
    return { rate: totals(recent).rate, streak: wasteFreeStreak(history, now) }
  }, [history, now])
  const pct = rate === null ? null : Math.round(rate * 100)

  return (
    <Pressable onPress={onPress} className="mx-4 overflow-hidden rounded-3xl border border-[#23402f] bg-[#123526] p-4 active:opacity-90">
      <MaterialCommunityIcons name="leaf" size={110} color="#1b4a35" style={{ position: 'absolute', right: -22, bottom: -26, transform: [{ rotate: '-20deg' }] }} />
      <Text className="text-[11px] font-bold uppercase tracking-[2px] text-[#8fc9a8]">This month</Text>
      <View className="mt-1 flex-row items-end gap-2">
        <Text className="font-display-bold text-[36px] leading-[40px] text-white">{pct === null ? '—' : `${pct}%`}</Text>
        <Text className="mb-1.5 text-[12px] text-[#cfe7d9]">waste{'\n'}avoided</Text>
      </View>
      <View className="mt-3 h-2 flex-row overflow-hidden rounded-full bg-[#1d4a37]">
        {pct !== null && <View style={{ width: `${pct}%`, backgroundColor: '#5fd497' }} />}
      </View>
      <View className="mt-3 flex-row items-center gap-1.5">
        <MaterialCommunityIcons name="fire" size={15} color="#f6c177" />
        <Text className="text-[12px] text-[#cfe7d9]">
          {streak === null ? 'Nothing wasted yet' : <><Text className="font-bold text-white">{streak} day{streak === 1 ? '' : 's'}</Text> waste-free</>}
        </Text>
      </View>
    </Pressable>
  )
}
