import { Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { FadeIn, LiveDot } from '@/ui/motion'
import { shadow } from '@/ui/theme'
import { displayName } from '../categories'
import { timeAgo } from '../freshness'
import { useFridge } from '../FridgeProvider'
import type { ActivityEntry } from '../types'
import { FoodTile } from './FoodShape'
import { useTheme } from '@/ui/ThemeProvider'

// Web: a slim scrollbar in the theme's line colour rather than the browser's default gutter.
const WEB_THIN_SCROLLBAR = (color: string) =>
  (Platform.OS === 'web' ? { scrollbarWidth: 'thin', scrollbarColor: `${color} transparent` } : {}) as object

const VERB: Partial<Record<ActivityEntry['kind'], { text: string; icon: 'arrow-down' | 'arrow-up' | 'undo'; color: 'primary' | 'textSoft' | 'ice' }>> = {
  added:    { text: 'Just added', icon: 'arrow-down', color: 'primary' },
  removed:  { text: 'Taken out',  icon: 'arrow-up',   color: 'textSoft' },
  returned: { text: 'Put back',   icon: 'undo',       color: 'ice' },
}

/**
 * The latest in/out detections, straight off the same realtime stream as the dashboard.
 * The bracketed "viewport" stands in for a camera frame until the backend exposes one.
 *
 * `fill` (wide web): the card takes its column's full height, the header stays put and the
 * detections list scrolls on its own. Otherwise it hugs a short list, as on phones.
 */
export function LiveFeed({ fill = false }: { fill?: boolean }) {
  const { activity, connection, now, simulatedCamera, setSimulatedCamera } = useFridge()
  const detections = activity.filter(a => VERB[a.kind] && !a.undone).slice(0, fill ? 40 : 5)
  const latest = detections[0]
  const { c } = useTheme()
  const on = connection === 'live' || (connection === 'demo' && simulatedCamera !== false)

  return (
    <View className="overflow-hidden rounded-3xl border border-line bg-surface" style={fill ? [shadow.card, { flex: 1, minHeight: 0 }] : shadow.card}>
      {/* Same treatment as the sidebar's "This month" tile: theme tint, fresh border and accents. */}
      <View className="border-b border-fresh-100 px-4 pb-3 pt-3.5" style={{ backgroundColor: c.primaryLight }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <LiveDot color={on ? c.fresh : c.muted} />
            <Text className="text-[11px] font-bold uppercase tracking-[2px]" style={{ color: on ? c.primary : c.textSoft }}>
              {connection === 'demo' ? 'Camera · simulated' : connection === 'live' ? 'Camera · live' : 'Camera · offline'}
            </Text>
          </View>
          {simulatedCamera !== null && (
            <Pressable onPress={() => setSimulatedCamera(!simulatedCamera)} hitSlop={8} className="rounded-full border border-fresh-100 bg-surface px-2.5 py-1">
              <Text className="text-[11px] font-semibold" style={{ color: c.textSoft }}>{simulatedCamera ? 'Pause' : 'Resume'}</Text>
            </Pressable>
          )}
        </View>

        {/* Viewport: corner brackets + the most recent detection */}
        <View className="mt-3 h-[76px] justify-center rounded-xl border border-fresh-100 bg-surface px-4">
          {(['top-1.5 left-1.5 border-l-2 border-t-2', 'top-1.5 right-1.5 border-r-2 border-t-2', 'bottom-1.5 left-1.5 border-b-2 border-l-2', 'bottom-1.5 right-1.5 border-b-2 border-r-2'] as const).map(k => (
            <View key={k} className={`absolute h-3 w-3 ${k}`} style={{ borderColor: c.fresh, opacity: 0.7 }} />
          ))}
          {latest ? (
            <FadeIn key={latest.id} from={4}>
              <Text className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: c.textSoft }}>{VERB[latest.kind]!.text}</Text>
              <Text numberOfLines={1} className="text-lg font-bold" style={{ color: c.text }}>
                {displayName(latest.itemName)}
                {latest.confidence != null ? <Text className="text-sm font-medium" style={{ color: c.primary }}>  {Math.round(latest.confidence * 100)}%</Text> : null}
              </Text>
            </FadeIn>
          ) : (
            <Text className="text-sm" style={{ color: c.textSoft }}>Waiting for the fridge door…</Text>
          )}
        </View>
      </View>

      <View style={fill ? { flex: 1, minHeight: 0 } : undefined}>
        <ScrollView
          scrollEnabled={fill}
          style={fill ? [{ flex: 1, minHeight: 0 }, WEB_THIN_SCROLLBAR(c.border)] : undefined}
          contentContainerStyle={fill ? { flexGrow: 1, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 22 } : { paddingHorizontal: 8, paddingVertical: 6 }}
          showsVerticalScrollIndicator={fill}
        >
          {detections.map(a => {
            const v = VERB[a.kind]!
            return (
              <FadeIn key={a.id} from={-6}>
                <View className="flex-row items-center gap-3 rounded-xl px-2 py-2">
                  <FoodTile name={a.itemName} category={a.category} size={34} />
                  <View className="flex-1">
                    <Text numberOfLines={1} className="text-sm text-ink">
                      <Text className="font-semibold" style={{ color: c[v.color] }}>{v.text}: </Text>
                      {displayName(a.itemName)}
                    </Text>
                    <Text className="text-xs text-mute">{timeAgo(a.at, now.getTime())} · {a.via}</Text>
                  </View>
                  <MaterialCommunityIcons name={v.icon} size={16} color={c[v.color]} />
                </View>
              </FadeIn>
            )
          })}
          {detections.length === 0 && !fill && <Text className="px-2 py-3 text-sm text-mute">No detections yet.</Text>}
          {/* A tall card with a short list: a quiet note in the leftover space, not a blank box. */}
          {fill && detections.length < 8 && (
            <View className="flex-1 items-center justify-center gap-2 px-6 py-8" style={{ minHeight: 140 }}>
              <MaterialCommunityIcons name="cctv" size={26} color={c.muted} style={{ opacity: 0.6 }} />
              <Text className="text-center text-xs leading-5 text-mute">
                {detections.length === 0 ? 'No detections yet. Items show up here as the door camera sees them go in or out.' : 'New detections appear at the top as the door camera sees them.'}
              </Text>
            </View>
          )}
        </ScrollView>
        {/* Rows ease out under the card's bottom edge instead of being cut off. */}
        {fill && Platform.OS === 'web' && (
          <View pointerEvents="none" className="absolute bottom-0 left-0 right-3 h-7" style={{ backgroundImage: `linear-gradient(to top, ${c.surface}, transparent)` } as object} />
        )}
      </View>
    </View>
  )
}
