import { Pressable, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { FadeIn } from '@/ui/motion'
import { displayName } from '../categories'
import { expiryLabel, freshnessOf } from '../freshness'
import { useFridge } from '../FridgeProvider'
import type { FridgeItem } from '../types'
import { CategoryIcon, FRESHNESS } from './visuals'

/** The core of the app: what to eat or bin today. Always visible on the dashboard. */
export function ActionNeededPanel() {
  const { actionNeeded, loading } = useFridge()
  const expired = actionNeeded.filter(i => freshnessOf(i) === 'expired').length
  const clear = !loading && actionNeeded.length === 0

  return (
    <View
      className={`overflow-hidden rounded-3xl border ${clear ? 'border-fresh-100 bg-fresh-50' : expired ? 'border-spoiled-100 bg-white' : 'border-soon-100 bg-white'}`}
      style={{ shadowColor: '#17251f', shadowOpacity: clear ? 0 : 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }}
    >
      <View className={`flex-row items-center gap-3 px-4 py-3.5 ${clear ? '' : expired ? 'bg-spoiled-50' : 'bg-soon-50'}`}>
        <View className={`h-9 w-9 items-center justify-center rounded-full ${clear ? 'bg-fresh-100' : expired ? 'bg-spoiled-100' : 'bg-soon-100'}`}>
          <MaterialCommunityIcons
            name={clear ? 'check' : expired ? 'alert-octagon-outline' : 'clock-alert-outline'}
            size={19}
            color={clear ? '#1b653b' : expired ? '#8a2419' : '#8a5806'}
          />
        </View>
        <View className="flex-1">
          <Text className="text-[17px] font-bold text-ink">
            {clear ? 'All clear' : `Action needed · ${actionNeeded.length}`}
          </Text>
          <Text className="text-[13px] text-ink-soft">
            {clear ? 'Nothing is close to its date. Nice.' : 'Use these first, or clear out what’s gone off.'}
          </Text>
        </View>
      </View>

      {actionNeeded.map((item, i) => <ActionRow key={item.id} item={item} index={i} last={i === actionNeeded.length - 1} />)}
    </View>
  )
}

function ActionRow({ item, index, last }: { item: FridgeItem; index: number; last: boolean }) {
  const { now, markUsed, markThrownAway } = useFridge()
  const freshness = freshnessOf(item, now)
  const f = FRESHNESS[freshness]
  const expired = freshness === 'expired'

  return (
    <FadeIn delay={index * 40} from={6}>
      <View className={`flex-row flex-wrap items-center gap-3 px-4 py-3 ${last ? '' : 'border-b border-line'}`}>
        <CategoryIcon category={item.category} size={36} />
        <View className="min-w-[110px] flex-1">
          <Text numberOfLines={1} className="text-[15px] font-semibold text-ink">{displayName(item.name)}</Text>
          <Text className={`text-[13px] font-semibold ${f.text}`}>
            {expiryLabel(item, now)}
            {item.location === 'freezer' ? <Text className="font-normal" style={{ color: '#4a7aa0' }}>  ·  ❄ Freezer</Text> : null}
            {item.source && item.category === 'takeout' ? <Text className="font-normal text-mute">  ·  {item.source}</Text> : null}
          </Text>
        </View>
        {expired ? (
          <Pressable onPress={() => markThrownAway(item)} className="flex-row items-center gap-1.5 rounded-xl bg-spoiled-500 px-3 py-2 active:bg-spoiled-600">
            <MaterialCommunityIcons name="trash-can-outline" size={15} color="#fff" />
            <Text className="text-[13px] font-semibold text-white">Thrown away</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => markUsed(item)} className="flex-row items-center gap-1.5 rounded-xl bg-fresh-600 px-3 py-2 active:bg-fresh-700">
            <MaterialCommunityIcons name="silverware-fork-knife" size={15} color="#fff" />
            <Text className="text-[13px] font-semibold text-white">Mark as used</Text>
          </Pressable>
        )}
      </View>
    </FadeIn>
  )
}
