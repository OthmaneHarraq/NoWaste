import { Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useHousehold } from '@/household'
import { useFridge } from '@/fridge/FridgeProvider'
import { useInsights } from '@/fridge/insights'
import { FadeIn } from '@/ui/motion'
import { useTheme } from '@/ui/ThemeProvider'
import { shadow } from '@/ui/theme'

/** "You've wasted spinach 3 times this month…". Works with no AI at all (templated). */
export function InsightsCard({ delay = 120 }: { delay?: number }) {
  const { history, now } = useFridge()
  const { household } = useHousehold()
  const { c } = useTheme()
  const { lines, source } = useInsights(history, household?.id, now)

  return (
    <FadeIn delay={delay}>
      <View className="rounded-3xl border border-line bg-surface p-5" style={shadow.card}>
        <View className="mb-3 flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-display text-[20px] text-ink">Shopping insights</Text>
            <Text className="mt-0.5 text-[13px] text-mute">From what went to waste, last 30 days</Text>
          </View>
          {source === 'ai' && (
            <View className="flex-row items-center gap-1 rounded-full bg-frost px-2 py-1">
              <MaterialCommunityIcons name="creation-outline" size={12} color={c.textSoft} />
              <Text className="text-[11px] font-semibold text-ink-soft">AI</Text>
            </View>
          )}
        </View>
        <View className="gap-2.5">
          {lines.map(line => (
            <View key={line} className="flex-row gap-3 rounded-2xl bg-frost p-3.5">
              <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color={c.textSoft} />
              <Text className="flex-1 text-[13px] leading-5 text-ink-soft">{line}</Text>
            </View>
          ))}
        </View>
      </View>
    </FadeIn>
  )
}
