import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { CATEGORIES } from '../categories'
import type { Freshness } from '../freshness'
import type { FoodCategory } from '../types'
import { useTheme } from '@/ui/ThemeProvider'

// Freshness → classes/colors. The ONLY place green/amber/red are assigned meaning.
export const FRESHNESS = {
  fresh:   { label: 'Fresh',         hex: '#2f9e5b', text: 'text-fresh-700',   chip: 'bg-fresh-50 border-fresh-100',     stripe: 'bg-fresh-500' },
  soon:    { label: 'Expiring soon', hex: '#e39a1b', text: 'text-soon-700',    chip: 'bg-soon-50 border-soon-100',       stripe: 'bg-soon-500' },
  expired: { label: 'Expired',       hex: '#d9493a', text: 'text-spoiled-700', chip: 'bg-spoiled-50 border-spoiled-100', stripe: 'bg-spoiled-500' },
  unknown: { label: 'No date',       hex: '#8a9a93', text: 'text-ink-soft',    chip: 'bg-frost border-line',             stripe: 'bg-line' },
} satisfies Record<Freshness, unknown>

// Freezer accent, same values as the ice-* tokens in src/global.css. Blue = cold, never freshness.
// ICE is the light set (kept for static uses); components use useIce() so it follows dark mode.
export const ICE = { bg: '#eaf3fa', soft: '#f1f7fc', line: '#cfe1ef', glass: '#bcd6ea', icon: '#5b8fb9', text: '#3f6a8f' }

export function useIce() {
  const { c } = useTheme()
  return { bg: c.iceBg, soft: c.iceBg, line: c.iceLine, glass: c.iceGlass, icon: c.ice, text: c.iceText }
}

/** Freshness → hex for the current theme (dots, lines, rings). Same thresholds, brighter in dark. */
export function useFreshHex() {
  const { c } = useTheme()
  return (f: Freshness) => ({ fresh: c.fresh, soon: c.soon, expired: c.spoiled, unknown: c.unknown })[f]
}

export function CategoryIcon({ category, size = 40 }: { category: FoodCategory; size?: number }) {
  const c = CATEGORIES[category]
  const { dark } = useTheme()
  return (
    <View
      style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: dark ? c.tintDark : c.tint }}
      className="items-center justify-center"
      accessibilityLabel={c.label}
    >
      <MaterialCommunityIcons name={c.icon} size={size * 0.55} color={c.color} />
    </View>
  )
}

export function FreshnessChip({ freshness, label }: { freshness: Freshness; label: string }) {
  const f = FRESHNESS[freshness]
  const hex = useFreshHex()
  return (
    <View className={`flex-row items-center gap-1.5 self-start rounded-full border px-2 py-0.5 ${f.chip}`}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: hex(freshness) }} />
      <Text className={`text-xs font-semibold ${f.text}`}>{label}</Text>
    </View>
  )
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-[13px] font-bold uppercase tracking-widest text-mute">{children}</Text>
      {right}
    </View>
  )
}
