import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { CATEGORIES, displayName } from '@/fridge/categories'
import { useFridge } from '@/fridge/FridgeProvider'
import { shoppingSuggestions } from '@/fridge/insights'
import { wastePatterns } from '@/fridge/stats'
import { FadeIn } from '@/ui/motion'
import { useTheme } from '@/ui/ThemeProvider'
import { shadow } from '@/ui/theme'

/** A short checklist for the next shop: what to buy less of, smaller, or frozen. */
export function ShoppingCard({ delay = 240 }: { delay?: number }) {
  const { history, now } = useFridge()
  const { c } = useTheme()
  const suggestions = useMemo(() => shoppingSuggestions(wastePatterns(history, 30, now)), [history, now])
  // Ticked = "noted for next time". Just for this visit; it's a nudge, not a saved list.
  const [done, setDone] = useState<Set<string>>(() => new Set())
  const toggle = (name: string) => setDone(prev => {
    const next = new Set(prev)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    return next
  })

  return (
    <FadeIn delay={delay}>
      <View className="rounded-3xl border border-line bg-surface p-5" style={shadow.card}>
        <View className="mb-3 flex-row items-center gap-2">
          <MaterialCommunityIcons name="cart-outline" size={18} color={c.textSoft} />
          <View className="flex-1">
            <Text className="font-display text-[20px] text-ink">Shopping suggestions</Text>
            <Text className="text-[13px] text-mute">For your next shop, from the last 30 days</Text>
          </View>
        </View>

        {suggestions.length === 0 ? (
          <Text className="text-[13px] leading-5 text-mute">Nothing to change: everything that left the fridge was used in time.</Text>
        ) : (
          <View>
            {suggestions.map((s, i) => {
              const cat = CATEGORIES[s.category]
              const checked = done.has(s.name)
              return (
                <Pressable
                  key={s.name}
                  onPress={() => toggle(s.name)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={`${displayName(s.name)}: ${s.action}. ${s.detail}`}
                  className={`flex-row items-center gap-3 py-2.5 active:opacity-70 ${i > 0 ? 'border-t border-line' : ''}`}
                >
                  <MaterialCommunityIcons
                    name={checked ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                    size={20}
                    color={checked ? c.fresh : c.muted}
                  />
                  {/* bg-frost, not cat.tint: the category tints are light-only pastels. */}
                  <View className="h-8 w-8 items-center justify-center rounded-lg bg-frost">
                    <MaterialCommunityIcons name={cat.icon} size={16} color={cat.color} />
                  </View>
                  <View className="flex-1" style={{ opacity: checked ? 0.5 : 1 }}>
                    <Text className={`text-[14px] font-semibold text-ink ${checked ? 'line-through' : ''}`} numberOfLines={1}>{displayName(s.name)}</Text>
                    <Text className="text-xs text-mute" numberOfLines={1}>{s.detail}</Text>
                  </View>
                  <View className="rounded-full bg-frost px-2.5 py-1" style={{ opacity: checked ? 0.5 : 1 }}>
                    <Text className="text-[12px] font-semibold text-ink-soft">{s.action}</Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        )}
      </View>
    </FadeIn>
  )
}
