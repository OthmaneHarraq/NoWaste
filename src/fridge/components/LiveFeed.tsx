import { Pressable, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { FadeIn, LiveDot } from '@/ui/motion'
import { shadow } from '@/ui/theme'
import { displayName } from '../categories'
import { timeAgo } from '../freshness'
import { useFridge } from '../FridgeProvider'
import type { ActivityEntry } from '../types'
import { FoodTile } from './FoodShape'
import { useTheme } from '@/ui/ThemeProvider'

const VERB: Partial<Record<ActivityEntry['kind'], { text: string; icon: 'arrow-down' | 'arrow-up' | 'undo'; color: 'primary' | 'textSoft' | 'ice' }>> = {
  added:    { text: 'Just added', icon: 'arrow-down', color: 'primary' },
  removed:  { text: 'Taken out',  icon: 'arrow-up',   color: 'textSoft' },
  returned: { text: 'Put back',   icon: 'undo',       color: 'ice' },
}

/**
 * The latest in/out detections, straight off the same realtime stream as the dashboard.
 * The bracketed "viewport" stands in for a camera frame until the backend exposes one.
 */
export function LiveFeed() {
  const { activity, connection, now, simulatedCamera, setSimulatedCamera } = useFridge()
  const detections = activity.filter(a => VERB[a.kind] && !a.undone).slice(0, 5)
  const latest = detections[0]
  const { c } = useTheme()
  const on = connection === 'live' || (connection === 'demo' && simulatedCamera !== false)

  return (
    <View className="overflow-hidden rounded-3xl border border-line bg-surface" style={shadow.card}>
      <View className="border-b border-line bg-frost px-4 pb-3 pt-3.5">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <LiveDot color={on ? c.primary : c.muted} />
            <Text className="text-[11px] font-bold uppercase tracking-[2px] text-ink-soft">
              {connection === 'demo' ? 'Camera · simulated' : connection === 'live' ? 'Camera · live' : 'Camera · offline'}
            </Text>
          </View>
          {simulatedCamera !== null && (
            <Pressable onPress={() => setSimulatedCamera(!simulatedCamera)} hitSlop={8} className="rounded-full border border-line bg-surface px-2.5 py-1">
              <Text className="text-[11px] font-semibold text-ink-soft">{simulatedCamera ? 'Pause' : 'Resume'}</Text>
            </Pressable>
          )}
        </View>

        {/* Viewport: corner brackets + the most recent detection */}
        <View className="mt-3 h-[76px] justify-center rounded-xl border border-line bg-surface px-4">
          {(['top-1.5 left-1.5 border-l-2 border-t-2', 'top-1.5 right-1.5 border-r-2 border-t-2', 'bottom-1.5 left-1.5 border-b-2 border-l-2', 'bottom-1.5 right-1.5 border-b-2 border-r-2'] as const).map(k => (
            <View key={k} className={`absolute h-3 w-3 ${k}`} style={{ borderColor: c.primary, opacity: 0.7 }} />
          ))}
          {latest ? (
            <FadeIn key={latest.id} from={4}>
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-mute">{VERB[latest.kind]!.text}</Text>
              <Text numberOfLines={1} className="text-lg font-bold text-ink">
                {displayName(latest.itemName)}
                {latest.confidence != null ? <Text className="text-sm font-medium" style={{ color: c.primary }}>  {Math.round(latest.confidence * 100)}%</Text> : null}
              </Text>
            </FadeIn>
          ) : (
            <Text className="text-sm text-mute">Waiting for the fridge door…</Text>
          )}
        </View>
      </View>

      <View className="px-2 py-1.5">
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
        {detections.length === 0 && <Text className="px-2 py-3 text-sm text-mute">No detections yet.</Text>}
      </View>
    </View>
  )
}
