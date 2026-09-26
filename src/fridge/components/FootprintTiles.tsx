import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { footprintTotals, roughNumber } from '@/fridge/footprint'
import type { FridgeItem } from '@/fridge/types'
import { CountUp } from '@/fridge/components/charts'
import { FadeIn } from '@/ui/motion'
import { useTheme } from '@/ui/ThemeProvider'
import { shadow } from '@/ui/theme'

/** Environmental framing of the Impact numbers. `items` = the page's window (last 30 days). */
export function FootprintTiles({ items, delay = 260 }: { items: FridgeItem[]; delay?: number }) {
  const { c } = useTheme()
  const f = footprintTotals(items)
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-4">
        <Tile delay={delay} icon="car-outline" iconColor={c.iceText} iconBg={c.iceBg} label="Car miles not driven">
          <CountUp value={f.carMilesAvoided} format={roughNumber} className="text-[26px] font-extrabold text-ink" />
          <Text className="text-xs text-mute">≈ {roughNumber(f.savedCo2Kg)} kg CO₂e of food eaten, not binned</Text>
        </Tile>
        <Tile delay={delay + 60} icon="water-outline" iconColor={c.ice} iconBg={c.iceBg} label="Water saved">
          <CountUp value={f.gallonsSaved} format={v => `${roughNumber(v)} gal`} className="text-[26px] font-extrabold text-ink" />
          <Text className="text-xs text-mute">that went into growing the food you ate</Text>
        </Tile>
        <Tile delay={delay + 120} icon="sprout-outline" iconColor={c.fresh} iconBg={c.freshTint} label="Methane avoided">
          <CountUp value={f.compostCo2AvoidedKg} format={v => `${roughNumber(v)} kg`} className="text-[26px] font-extrabold text-ink" />
          <Text className="text-xs text-mute">
            {f.compostedKg > 0
              ? `CO₂e, by composting ~${roughNumber(f.compostedKg)} kg instead of landfill`
              : 'Compost scraps instead of trashing them to start this one'}
          </Text>
        </Tile>
      </View>
      <Text className="px-1 text-[11px] leading-4 text-mute">
        Estimates from published per-category food footprints and typical pack sizes. Directionally right, not exact.
      </Text>
    </View>
  )
}

function Tile({ icon, iconColor, iconBg, label, delay, children }: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap
  iconColor: string
  iconBg: string
  label: string
  delay: number
  children: ReactNode
}) {
  return (
    <FadeIn delay={delay} style={{ flexGrow: 1, flexBasis: 170 }}>
      <View className="gap-1 rounded-3xl border border-line bg-surface p-4" style={shadow.card}>
        <View className="mb-1 flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: iconBg }}>
            <MaterialCommunityIcons name={icon} size={16} color={iconColor} />
          </View>
          <Text className="text-xs font-semibold text-ink-soft">{label}</Text>
          <Text className="ml-auto rounded-full bg-frost px-1.5 py-0.5 text-[10px] font-semibold text-mute">est.</Text>
        </View>
        {children}
      </View>
    </FadeIn>
  )
}
