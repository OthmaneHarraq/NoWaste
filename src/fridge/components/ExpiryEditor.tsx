import { useEffect, useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { displayName } from '../categories'
import { daysUntil } from '../freshness'
import { useFridge } from '../FridgeProvider'
import { useTheme } from '@/ui/ThemeProvider'
import type { FridgeItem } from '../types'

/** Local 'YYYY-MM-DD' for a Date. */
function toDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(base: Date, days: number) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, 12)
}

const QUICK: { label: string; days: number }[] = [
  { label: 'Today', days: 0 },
  { label: '+1 day', days: 1 },
  { label: '+3 days', days: 3 },
  { label: '+1 week', days: 7 },
  { label: '+2 weeks', days: 14 },
  { label: '+1 month', days: 30 },
]

/**
 * Set an item's expiry by hand: quick picks from today, a ±1 day stepper, or
 * "Use estimate" to go back to the automatic date.
 */
export function ExpiryEditor({ item, onClose }: { item: FridgeItem | null; onClose: () => void }) {
  const { now, setExpiry } = useFridge()
  const [date, setDate] = useState<Date>(() => new Date())

  // Start from the item's current date (or today) each time the editor opens
  useEffect(() => {
    if (item) setDate(item.expires_at ? new Date(item.expires_at) : now)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id])

  if (!item) return null
  // Freezer items always use the freezer estimate (see adapter.ts), so a hand-set date wouldn't stick
  const frozen = item.location === 'freezer'
  const d = daysUntil(date.toISOString(), now) ?? 0
  const relative = d === 0 ? 'today' : d === 1 ? 'tomorrow' : d === -1 ? 'yesterday' : d > 0 ? `in ${d} days` : `${-d} days ago`

  async function save(value: string | null) {
    onClose()
    await setExpiry(item!, value)
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/35 p-6" onPress={onClose}>
        {/* Inner Pressable swallows taps so they don't close the sheet */}
        <Pressable className="w-full max-w-[380px] gap-4 rounded-2xl bg-surface p-5" onPress={() => {}}>
          <View>
            <Text className="text-xs font-semibold uppercase tracking-wide text-mute">Use by</Text>
            <Text className="text-lg font-bold text-ink">{displayName(item.name)}</Text>
          </View>

          {frozen ? (
            <Text className="text-sm leading-5 text-ink-soft">
              This is in the freezer, so its date follows the freezer estimate. Move it back to the fridge to set a date by hand.
            </Text>
          ) : (
          <>
          <View className="flex-row items-center justify-between rounded-xl bg-frost px-2 py-3">
            <StepButton icon="minus" label="One day earlier" onPress={() => setDate(addDays(date, -1))} />
            <View className="items-center">
              <Text className="text-xl font-bold text-ink">
                {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
              <Text className="text-xs text-ink-soft">{relative}</Text>
            </View>
            <StepButton icon="plus" label="One day later" onPress={() => setDate(addDays(date, 1))} />
          </View>

          <View className="flex-row flex-wrap gap-2">
            {QUICK.map(q => (
              <Pressable
                key={q.label}
                onPress={() => setDate(addDays(now, q.days))}
                className="rounded-full border border-line bg-surface px-3 py-1.5 active:bg-frost"
              >
                <Text className="text-xs font-semibold text-ink">{q.label}</Text>
              </Pressable>
            ))}
          </View>

          </>
          )}

          <View className="flex-row items-center gap-2">
            {!frozen && (
            <Pressable onPress={() => save(null)} className="px-2 py-2.5">
              <Text className="text-sm font-medium text-mute">Use estimate</Text>
            </Pressable>
            )}
            <View className="flex-1" />
            <Pressable onPress={onClose} className="rounded-lg border border-line px-4 py-2.5 active:bg-frost">
              <Text className="text-sm font-semibold text-ink">Cancel</Text>
            </Pressable>
            {!frozen && (
            <Pressable onPress={() => save(toDateString(date))} className="rounded-lg bg-ink px-4 py-2.5 active:opacity-80">
              <Text className="text-sm font-semibold text-on-ink">Save</Text>
            </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function StepButton({ icon, label, onPress }: { icon: 'minus' | 'plus'; label: string; onPress: () => void }) {
  const { c } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      className="h-10 w-10 items-center justify-center rounded-full border border-line bg-surface active:bg-frost"
    >
      <MaterialCommunityIcons name={icon} size={20} color={c.text} />
    </Pressable>
  )
}
