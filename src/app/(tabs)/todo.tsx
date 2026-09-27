import { ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useFridge } from '@/fridge/FridgeProvider'
import { freshnessOf } from '@/fridge/freshness'
import { ActionNeededPanel } from '@/fridge/components/ActionNeededPanel'
import { InsightsCard } from '@/fridge/components/InsightsCard'
import { RecipesCard } from '@/fridge/components/RecipesCard'
import { ShoppingCard } from '@/fridge/components/ShoppingCard'
import { FreshnessChip } from '@/fridge/components/visuals'
import { FadeIn } from '@/ui/motion'
import { NAV } from '@/ui/Sidebar'
import { PAGE_BACKGROUND } from '@/ui/background'

// OWNER: phone app team. Everything that needs a decision: what to eat or bin now, recipes
// that use up what's expiring, and what to buy differently next time.
export default function TodoScreen() {
  const { actionNeeded, now } = useFridge()
  const { width } = useWindowDimensions()
  // Same breakpoint as the Fridge tab: below it the sidebar leaves too little room for two columns.
  const twoColumn = width >= 1260
  const expired = actionNeeded.filter(i => freshnessOf(i, now) === 'expired').length
  const soon = actionNeeded.length - expired

  return (
    <ScrollView className={`flex-1 bg-paper ${PAGE_BACKGROUND}`} contentContainerStyle={{ padding: width < 600 ? 14 : 24, paddingBottom: 48 }}>
      <View className="mb-4">
        <View className="flex-row items-center gap-3">
          {/* Same icon and tile as the active To do entry in the sidebar. */}
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-fresh-600">
            <MaterialCommunityIcons name={NAV.todo.icon} size={22} color="#ffffff" />
          </View>
          <Text className="font-display-bold text-[34px] leading-[40px] text-ink">To do</Text>
        </View>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {actionNeeded.length === 0 && <FreshnessChip freshness="fresh" label="Nothing needs you right now" />}
          {expired > 0 && <FreshnessChip freshness="expired" label={`${expired} past date`} />}
          {soon > 0 && <FreshnessChip freshness="soon" label={`${soon} expiring soon`} />}
        </View>
      </View>
      <View className="mb-5 h-px bg-line" />

      <View className={twoColumn ? 'flex-row items-start gap-5' : 'gap-5'}>
        {/* Insights sit under Action needed, so stacked on a phone they come before recipes. */}
        <View className="gap-5" style={twoColumn ? { flex: 1.1 } : undefined}>
          <FadeIn>
            <ActionNeededPanel />
          </FadeIn>
          <InsightsCard delay={120} />
        </View>
        <View className="gap-5" style={twoColumn ? { flex: 1 } : undefined}>
          <RecipesCard delay={80} />
          <ShoppingCard delay={160} />
        </View>
      </View>
    </ScrollView>
  )
}

