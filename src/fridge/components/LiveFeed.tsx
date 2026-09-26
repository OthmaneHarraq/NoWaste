import { Pressable, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { FadeIn, LiveDot } from '@/ui/motion'
import { shadow } from '@/ui/theme'
import { displayName } from '../categories'
import { timeAgo } from '../freshness'
import { useFridge } from '../FridgeProvider'
import type { ActivityEntry } from '../types'
import { FoodTile } from './FoodShape'

const VERB: Partial<Record<ActivityEntry['kind'], { text: string; icon: 'arrow-down' | 'arrow-up' | 'undo'; color: string }>> = {
  added:    { text: 'Just added', icon: 'arrow-down', color: '#23804a' },
  removed:  { text: 'Taken out',  icon: 'arrow-up',   color: '#4c5d55' },
  returned: { text: 'Put back',   icon: 'undo',       color: '#3f7fb3' },
}

/**
 * The latest in/out detections, straight off the same realtime stream as the dashboard.
 * The dark "viewport" stands in for a camera frame until the backend exposes one.
 */
export function LiveFeed() {
  const { activity, connection, now, simulatedCamera, setSimulatedCamera } = useFridge()
  const detections = activity.filter(a => VERB[a.kind] && !a.undone).slice(0, 5)
  const latest = detections[0]
  const on = connection === 'live' || (connection === 'demo' && simulatedCamera !== false)

  return (
    <View className="overflow-hidden rounded-3xl border border-line bg-white" style={shadow.card}>
      <View className="bg-[#14201b] px-4 pb-3 pt-3.5">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <LiveDot color={on ? '#4ade80' : '#6b7a73'} />
            <Text className="text-[11px] font-bold uppercase tracking-[2px] text-[#9fb5aa]">
              {connection === 'demo' ? 'Camera · simulated' : connection === 'live' ? 'Camera · live' : 'Camera · offline'}
            </Text>
          </View>
          {simulatedCamera !== null && (
            <Pressable onPress={() => setSimulatedCamera(!simulatedCamera)} hitSlop={8} className="rounded-full border border-[#2c3b35] px-2.5 py-1">
              <Text className="text-[11px] font-semibold text-[#9fb5aa]">{simulatedCamera ? 'Pause' : 'Resume'}</Text>
            </Pressable>
          )}
        </View>

        {/* Viewport: corner brackets + the most recent detection */}
        <View className="mt-3 h-[76px] justify-center rounded-xl border border-[#23322c] px-4">
          {(['top-1.5 left-1.5 border-l-2 border-t-2', 'top-1.5 right-1.5 border-r-2 border-t-2', 'bottom-1.5 left-1.5 border-b-2 border-l-2', 'bottom-1.5 right-1.5 border-b-2 border-r-2'] as const).map(c => (
            <View key={c} className={`absolute h-3 w-3 border-[#4ade80] ${c}`} style={{ opacity: 0.7 }} />
          ))}
          {latest ? (
            <FadeIn key={latest.id} from={4}>
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-[#6f8a7e]">{VERB[latest.kind]!.text}</Text>
              <Text numberOfLines={1} className="text-lg font-bold text-white">
                {displayName(latest.itemName)}
                {latest.confidence != null ? <Text className="text-sm font-medium text-[#4ade80]">  {Math.round(latest.confidence * 100)}%</Text> : null}
              </Text>
            </FadeIn>
          ) : (
            <Text className="text-sm text-[#6f8a7e]">Waiting for the fridge door…</Text>
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
                    <Text className="font-semibold" style={{ color: v.color }}>{v.text}: </Text>
                    {displayName(a.itemName)}
                  </Text>
                  <Text className="text-xs text-mute">{timeAgo(a.at, now.getTime())} · {a.via}</Text>
                </View>
                <MaterialCommunityIcons name={v.icon} size={16} color={v.color} />
              </View>
            </FadeIn>
          )
        })}
        {detections.length === 0 && <Text className="px-2 py-3 text-sm text-mute">No detections yet.</Text>}
      </View>
    </View>
  )
}
