import { Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'

/** Header title: leaf mark + "NoWaste" + the fridge's name. */
export function Brand({ fridge, compact }: { fridge: string; compact?: boolean }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <View className="h-8 w-8 items-center justify-center rounded-[10px] bg-fresh-600">
        <MaterialCommunityIcons name="leaf" size={18} color="#fff" style={{ transform: [{ rotate: '-12deg' }] }} />
      </View>
      {!compact && <Text className="text-[17px] font-extrabold tracking-tight text-ink">NoWaste</Text>}
      {!compact && <View className="h-4 w-px bg-line" />}
      <Text className="text-[15px] font-semibold text-ink-soft" numberOfLines={1}>{fridge}</Text>
    </View>
  )
}
