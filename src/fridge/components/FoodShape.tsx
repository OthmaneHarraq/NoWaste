import type { ReactNode } from 'react'
import Svg, { Circle, G, Path, Rect } from 'react-native-svg'
import type { Freshness } from '../freshness'
import type { FoodCategory } from '../types'
import { FRESHNESS_TONES } from './visuals'

// Flat illustrated items for the Fridge view. The SHAPE says what it is (category), the
// COLOR says how fresh it is (same tones as everywhere else). Sizes are in px at scale 1.

type Tones = { base: string; shade: string; light: string }
const HI = '#ffffff' // highlight

const SHAPES: Record<FoodCategory, { w: number; h: number; draw: (t: Tones) => ReactNode }> = {
  // Bottle
  beverage: {
    w: 26, h: 62,
    draw: t => (
      <>
        <Rect x={9} y={0} width={8} height={6} rx={1.5} fill={t.shade} />
        <Path d="M10 6h6v6c0 3 7 5 7 11v34a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V23c0-6 7-8 7-11z" fill={t.base} />
        <Rect x={3} y={31} width={20} height={13} fill={t.light} />
        <Rect x={3} y={31} width={20} height={2} fill={t.shade} opacity={0.25} />
        <Rect x={6.5} y={21} width={2.5} height={35} rx={1.25} fill={HI} opacity={0.35} />
      </>
    ),
  },
  // Gable-top carton
  dairy: {
    w: 34, h: 56,
    draw: t => (
      <>
        <Rect x={11} y={1} width={12} height={5} rx={1} fill={t.shade} />
        <Path d="M3 17 11 6h12l8 11z" fill={t.shade} />
        <Path d="M3 17h28v35a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill={t.base} />
        <Rect x={8} y={26} width={18} height={14} rx={2.5} fill={t.light} />
        <Circle cx={17} cy={33} r={3.2} fill={t.base} opacity={0.55} />
        <Rect x={5.5} y={19} width={2.5} height={32} rx={1.25} fill={HI} opacity={0.3} />
      </>
    ),
  },
  // Oyster-pail takeout box with wire handle
  takeout: {
    w: 44, h: 44,
    draw: t => (
      <>
        <Path d="M13 13Q22-3 31 13" stroke={t.shade} strokeWidth={2} fill="none" />
        <Path d="M4 16h36l-5 26H9z" fill={t.base} />
        <Path d="M4 16 11 8l11 6 11-6 7 8z" fill={t.shade} />
        <Path d="M7 25h30l-1 6H8z" fill={t.light} />
        <Rect x={9} y={18} width={2.5} height={21} rx={1.25} fill={HI} opacity={0.3} />
      </>
    ),
  },
  // Cut of meat: steak with a bone and fat rim
  meat: {
    w: 50, h: 34,
    draw: t => (
      <>
        <Path d="M6 10C10 2 30 0 40 6c9 5 8 18-2 23-10 5-26 4-32-3C1 21 2 14 6 10z" fill={t.base} stroke={t.light} strokeWidth={3} />
        <Circle cx={34} cy={17} r={5.5} fill={t.light} />
        <Circle cx={34} cy={17} r={2.2} fill={t.shade} opacity={0.5} />
        <Path d="M12 14c4-2 8-1 11 2M11 21c5 1 9 0 12-3" stroke={t.light} strokeWidth={1.4} fill="none" opacity={0.7} />
        <Path d="M10 9c5-3 11-4 17-3" stroke={HI} strokeWidth={2} fill="none" opacity={0.35} strokeLinecap="round" />
      </>
    ),
  },
  // Loose bundle of round produce with a leaf
  produce: {
    w: 48, h: 42,
    draw: t => (
      <>
        <Path d="M24 9c-2-6-9-8-13-5 3 4 8 6 13 5z" fill={t.shade} />
        <Path d="M24 9c1-5 6-8 10-6-2 4-6 6-10 6z" fill={t.shade} opacity={0.8} />
        <Circle cx={24} cy={19} r={10.5} fill={t.base} />
        <Circle cx={13} cy={29} r={10.5} fill={t.base} stroke={t.shade} strokeWidth={1} strokeOpacity={0.35} />
        <Circle cx={35} cy={29} r={10.5} fill={t.base} stroke={t.shade} strokeWidth={1} strokeOpacity={0.35} />
        <G fill={HI} opacity={0.4}>
          <Circle cx={20} cy={15} r={2.6} />
          <Circle cx={9} cy={25} r={2.6} />
          <Circle cx={31} cy={25} r={2.6} />
        </G>
      </>
    ),
  },
  // Jar with a lid
  condiment: {
    w: 32, h: 40,
    draw: t => (
      <>
        <Rect x={5} y={1} width={22} height={8} rx={2} fill={t.shade} />
        <Path d="M9 3v4M13 3v4M17 3v4M21 3v4" stroke={t.base} strokeWidth={1} opacity={0.5} />
        <Rect x={2} y={8} width={28} height={31} rx={7} fill={t.base} />
        <Rect x={2} y={17} width={28} height={12} fill={t.light} />
        <Rect x={5.5} y={11} width={2.5} height={25} rx={1.25} fill={HI} opacity={0.35} />
      </>
    ),
  },
  // Generic lidded container
  other: {
    w: 46, h: 30,
    draw: t => (
      <>
        <Rect x={19} y={0} width={8} height={4} rx={1} fill={t.shade} />
        <Rect x={1} y={3} width={44} height={8} rx={3} fill={t.shade} />
        <Path d="M4 11h38l-2.5 16a3 3 0 0 1-3 2.5H9.5a3 3 0 0 1-3-2.5z" fill={t.base} />
        <Rect x={10} y={15} width={26} height={8} rx={2} fill={t.light} opacity={0.8} />
        <Rect x={7} y={13} width={2.5} height={13} rx={1.25} fill={HI} opacity={0.35} />
      </>
    ),
  },
}

export function shapeSize(category: FoodCategory, scale = 1) {
  const s = SHAPES[category]
  return { width: s.w * scale, height: s.h * scale }
}

/** One illustrated item: category → shape, freshness → color. */
export function FoodShape({ category, freshness, scale = 1 }: { category: FoodCategory; freshness: Freshness; scale?: number }) {
  const s = SHAPES[category]
  return (
    <Svg width={s.w * scale} height={s.h * scale} viewBox={`-1 -1 ${s.w + 2} ${s.h + 2}`}>
      {s.draw(FRESHNESS_TONES[freshness])}
    </Svg>
  )
}
