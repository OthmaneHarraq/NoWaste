import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { FadeIn, Pulse } from '@/ui/motion'
import { displayName } from '../categories'
import { PENDING_GRACE_MINUTES } from '../config'
import { expiryLabel, freshnessOf } from '../freshness'
import { useFridge } from '../FridgeProvider'
import type { FridgeItem } from '../types'
import { FoodTile } from './FoodShape'
import { FreshnessChip, useFreshHex } from './visuals'
import { useTheme } from '@/ui/ThemeProvider'
import { ExpiryEditor } from './ExpiryEditor'

export const CARD_MIN_WIDTH = 164
export const CARD_MIN_WIDTH_PHONE = 146

/** One item sitting on a shelf. Pending-removal items show as a ghost with Put back / Finished. */
export function ItemCard({ item, index = 0, width = CARD_MIN_WIDTH }: { item: FridgeItem; index?: number; width?: number }) {
  const { now, markUsed, markThrownAway, putBack, moveTo } = useFridge()
  const [editingDate, setEditingDate] = useState(false)
  const freshness = freshnessOf(item, now)
  const hex = useFreshHex()
  const { c } = useTheme()
  const pending = item.status === 'pending_removal'
  const frozen = item.location === 'freezer'
  const minsLeft = pending && item.removed_at
    ? Math.max(0, Math.ceil(PENDING_GRACE_MINUTES - (now.getTime() - new Date(item.removed_at).getTime()) / 60_000))
    : 0

  return (
    <FadeIn delay={Math.min(index, 12) * 35} style={{ width }}>
      <Pulse active={!pending && (freshness === 'soon' || freshness === 'expired')} color={hex(freshness)}>
        <View
          className={`overflow-hidden rounded-2xl border bg-surface ${pending ? 'border-dashed border-mute' : frozen ? 'border-ice-200' : 'border-line'}`}
          style={[
            { minHeight: 176 },
            pending ? { opacity: 0.78 } : { shadowColor: '#000000', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
          ]}
        >
          <View className="flex-1 gap-2 p-3">
            <View className="flex-row items-start justify-between">
              <View>
                <FoodTile name={item.name} category={item.category} size={42} />
                {frozen && (
                  <View className="absolute -bottom-1 -right-1 h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-surface bg-ice-500">
                    <MaterialCommunityIcons name="snowflake" size={10} color="#fff" />
                  </View>
                )}
              </View>
              <View className="flex-row items-center">
                {item.quantity > 1 && (
                  <View className="mr-1 rounded-full bg-frost px-2 py-0.5">
                    <Text className="text-xs font-bold text-ink-soft">×{item.quantity}</Text>
                  </View>
                )}
                {!pending && (
                  <>
                    <IconButton
                      icon={frozen ? 'fridge-outline' : 'snowflake'}
                      label={frozen ? `Move ${item.name} to the fridge` : `Move ${item.name} to the freezer`}
                      onPress={() => moveTo(item, frozen ? 'fridge' : 'freezer')}
                    />
                    {freshness === 'expired' ? (
                      <IconButton icon="trash-can-outline" label={`Throw away ${item.name}`} onPress={() => markThrownAway(item)} />
                    ) : (
                      <IconButton icon="check" label={`Mark ${item.name} as used`} onPress={() => markUsed(item)} />
                    )}
                  </>
                )}
              </View>
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
                  <MaterialCommunityIcons name="timer-sand" size={13} color={c.textSoft} />
                  <Text className="text-xs font-medium text-ink-soft">Taken out · {minsLeft} min to decide</Text>
                </View>
                <View className="flex-row gap-1.5">
                  <SmallButton label="Put back" onPress={() => putBack(item)} />
                  <SmallButton label="Finished" solid onPress={() => markUsed(item)} />
                </View>
              </View>
            ) : (
              // Tap the date to change it
              <Pressable
                onPress={() => setEditingDate(true)}
                accessibilityLabel={`Change the expiry date of ${item.name}`}
                className="flex-row items-center gap-1 self-start active:opacity-70"
              >
                <FreshnessChip freshness={freshness} label={expiryLabel(item, now)} />
                <MaterialCommunityIcons name="pencil-outline" size={13} color={c.muted} />
              </Pressable>
            )}
          </View>
          <ExpiryEditor item={editingDate ? item : null} onClose={() => setEditingDate(false)} />
          {/* Freshness edge: reads at a glance from across the room. */}
          <View className="h-1.5" style={{ backgroundColor: pending ? c.border : hex(freshness) }} />
        </View>
      </Pulse>
    </FadeIn>
  )
}

function SmallButton({ label, onPress, solid }: { label: string; onPress: () => void; solid?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 items-center rounded-lg py-1.5 ${solid ? 'bg-ink active:opacity-80' : 'border border-line bg-surface active:bg-frost'}`}
    >
      <Text className={`text-xs font-semibold ${solid ? 'text-on-ink' : 'text-ink'}`}>{label}</Text>
    </Pressable>
  )
}

function IconButton({ icon, label, onPress }: { icon: 'check' | 'trash-can-outline' | 'snowflake' | 'fridge-outline'; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6} className="h-7 w-7 items-center justify-center rounded-full active:bg-frost">
      <MaterialCommunityIcons name={icon} size={17} color={useTheme().c.muted} />
    </Pressable>
  )
}
