import { Pressable, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { FadeIn, Pulse } from '@/ui/motion'
import { displayName } from '../categories'
import { PENDING_GRACE_MINUTES } from '../config'
import { expiryLabel, freshnessOf } from '../freshness'
import { useFridge } from '../FridgeProvider'
import type { FridgeItem } from '../types'
import { CategoryIcon, FRESHNESS, FreshnessChip } from './visuals'

export const CARD_WIDTH = 172

/** One item sitting on a shelf. Pending-removal items show as a ghost with Put back / Finished. */
export function ItemCard({ item, index = 0 }: { item: FridgeItem; index?: number }) {
  const { now, markUsed, markThrownAway, putBack } = useFridge()
  const freshness = freshnessOf(item, now)
  const f = FRESHNESS[freshness]
  const pending = item.status === 'pending_removal'
  const minsLeft = pending && item.removed_at
    ? Math.max(0, Math.ceil(PENDING_GRACE_MINUTES - (now.getTime() - new Date(item.removed_at).getTime()) / 60_000))
    : 0

  return (
    <FadeIn delay={Math.min(index, 12) * 35} style={{ width: CARD_WIDTH }}>
      <Pulse active={!pending && (freshness === 'soon' || freshness === 'expired')} color={f.hex}>
        <View
          className={`overflow-hidden rounded-2xl border bg-white ${pending ? 'border-dashed border-mute' : 'border-line'}`}
          style={[
            { minHeight: 176 },
            pending ? { opacity: 0.78 } : { shadowColor: '#17251f', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
          ]}
        >
          <View className="flex-1 gap-2 p-3">
            <View className="flex-row items-start justify-between">
              <CategoryIcon category={item.category} size={38} />
              {item.quantity > 1 && (
                <View className="rounded-full bg-frost px-2 py-0.5">
                  <Text className="text-xs font-bold text-ink-soft">×{item.quantity}</Text>
                </View>
              )}
            </View>

            <View className="flex-1">
              <Text numberOfLines={2} className="text-[15px] font-semibold leading-5 text-ink">{displayName(item.name)}</Text>
              {item.source ? (
                <Text numberOfLines={1} className="mt-0.5 text-xs text-mute">
                  {item.category === 'takeout' ? `from ${item.source}` : item.source}
                </Text>
              ) : null}
            </View>

            {pending ? (
              <View className="gap-2">
                <View className="flex-row items-center gap-1">
                  <MaterialCommunityIcons name="timer-sand" size={13} color="#4c5d55" />
                  <Text className="text-xs font-medium text-ink-soft">Taken out · {minsLeft} min to decide</Text>
                </View>
                <View className="flex-row gap-1.5">
                  <SmallButton label="Put back" onPress={() => putBack(item)} />
                  <SmallButton label="Finished" solid onPress={() => markUsed(item)} />
                </View>
              </View>
            ) : (
              <View className="flex-row items-center justify-between">
                <FreshnessChip freshness={freshness} label={expiryLabel(item, now)} />
                <View className="flex-row">
                  {freshness === 'expired' ? (
                    <IconButton icon="trash-can-outline" label={`Throw away ${item.name}`} onPress={() => markThrownAway(item)} />
                  ) : (
                    <IconButton icon="check" label={`Mark ${item.name} as used`} onPress={() => markUsed(item)} />
                  )}
                </View>
              </View>
            )}
          </View>
          {/* Freshness edge: reads at a glance from across the room. */}
          <View className={`h-1.5 ${pending ? 'bg-line' : f.stripe}`} />
        </View>
      </Pulse>
    </FadeIn>
  )
}

function SmallButton({ label, onPress, solid }: { label: string; onPress: () => void; solid?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 items-center rounded-lg py-1.5 ${solid ? 'bg-ink active:opacity-80' : 'border border-line bg-white active:bg-frost'}`}
    >
      <Text className={`text-xs font-semibold ${solid ? 'text-white' : 'text-ink'}`}>{label}</Text>
    </Pressable>
  )
}

function IconButton({ icon, label, onPress }: { icon: 'check' | 'trash-can-outline'; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6} className="h-7 w-7 items-center justify-center rounded-full active:bg-frost">
      <MaterialCommunityIcons name={icon} size={17} color="#8a9a93" />
    </Pressable>
  )
}
