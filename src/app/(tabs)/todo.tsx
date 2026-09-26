import { Platform, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { useFridge } from '@/fridge/FridgeProvider'
import { freshnessOf } from '@/fridge/freshness'
import { ActionNeededPanel } from '@/fridge/components/ActionNeededPanel'
import { InsightsCard } from '@/fridge/components/InsightsCard'
import { RecipesCard } from '@/fridge/components/RecipesCard'
import { ShoppingCard } from '@/fridge/components/ShoppingCard'
import { FadeIn } from '@/ui/motion'

// OWNER: phone app team. Everything that needs a decision: what to eat or bin now, recipes
// that use up what's expiring, and what to buy differently next time.
export default function TodoScreen() {
  const { actionNeeded, now } = useFridge()
  const { width } = useWindowDimensions()
  // Same breakpoint as the Fridge tab: below it the sidebar leaves too little room for two columns.
  const twoColumn = width >= 1260
  const expired = actionNeeded.filter(i => freshnessOf(i, now) === 'expired').length
  const soon = actionNeeded.length - expired

  const summary = actionNeeded.length === 0
    ? 'Nothing needs you right now'
    : [expired && `${expired} past date`, soon && `${soon} expiring soon`].filter(Boolean).join(' · ')

  return (
    <ScrollView className={`flex-1 bg-paper ${DOTS}`} contentContainerStyle={{ padding: width < 600 ? 14 : 24, paddingBottom: 48 }}>
      <View className="mb-5">
        <Text className="font-display-bold text-[34px] leading-[40px] text-ink">To do</Text>
        <Text className="mt-0.5 text-sm text-ink-soft">{summary}</Text>
      </View>

      <View className={twoColumn ? 'flex-row items-start gap-5' : 'gap-5'}>
        <View style={twoColumn ? { flex: 1.1 } : undefined}>
          <FadeIn>
            <ActionNeededPanel />
          </FadeIn>
        </View>
        <View className="gap-5" style={twoColumn ? { flex: 1 } : undefined}>
          <RecipesCard delay={80} />
          <InsightsCard delay={160} />
          <ShoppingCard delay={240} />
        </View>
      </View>
    </ScrollView>
  )
}

// Web-only dot texture behind the page (matches Impact and Activity).
const DOTS = Platform.OS === 'web' ? 'bg-[radial-gradient(#cfdcd3_1.2px,transparent_1.2px)] bg-[length:20px_20px] dark:bg-[radial-gradient(#1f2a25_1.2px,transparent_1.2px)]' : ''
