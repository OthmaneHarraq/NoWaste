import type { ReactNode } from 'react'
import { View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { useTheme } from '@/ui/ThemeProvider'
import { lifeLeft, type Freshness } from '../freshness'
import type { FridgeItem } from '../types'
import { useFreshHex } from './visuals'

/**
 * A thin "battery" ring that empties as the item nears its date. Colour = the same freshness
 * stage as everywhere else (freshnessOf); the arc length = share of its life left.
 * Expired items show a full red ring (their life is used up, and it needs to shout).
 */
export function FreshRing({ item, freshness, size, stroke = 3, children, dashed }: {
  item: Pick<FridgeItem, 'added_at' | 'expires_at'>
  freshness: Freshness
  size: number
  stroke?: number
  children?: ReactNode
  /** Taken-out items: dashed, no progress. */
  dashed?: boolean
}) {
  const hex = useFreshHex()
  const { c } = useTheme()
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const left = lifeLeft(item)
  // Items expiring soon keep at least a third of the arc, so the most urgent ones never
  // look like a bare grey ring (the detail card still shows the exact days left).
  const fraction = freshness === 'expired' ? 1 : freshness === 'soon' ? Math.max(0.35, left ?? 1) : left ?? 1
  const color = hex(freshness)

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Track */}
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.border} strokeWidth={stroke} fill="none" strokeDasharray={dashed ? '3 4' : undefined} />
        {/* Life left, starting at 12 o'clock and running clockwise */}
        {!dashed && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0.001, fraction) * circumference} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      {children}
    </View>
  )
}
