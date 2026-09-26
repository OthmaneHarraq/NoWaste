import type { ReactNode } from 'react'
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg'
import { View } from 'react-native'
import { useTheme } from '@/ui/ThemeProvider'
import { CATEGORIES } from '../categories'
import type { FoodCategory } from '../types'

// Flat, recognisable food illustrations for the Fridge view, drawn in the food's own
// colours (a banana is yellow). Freshness is shown around the shape by FridgeView, in the
// same green/amber/red as everywhere else. Name match first (shapeFor), then a generic
// shape for the category. Sizes are px at scale 1.

type Shape = { w: number; h: number; art: ReactNode }

const HI = '#ffffff'
const STEM = '#6b4a2b'
const LEAF = '#43a047'
const hi = (cx: number, cy: number, rx: number, ry: number) => <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={HI} opacity={0.35} />
const leaf = (x: number, y: number, flip = false) => (
  <Path d={flip ? `M${x} ${y}c-4-5-10-4-11-2 3 4 8 4 11 2z` : `M${x} ${y}c4-5 10-4 11-2-3 4-8 4-11 2z`} fill={LEAF} />
)

/* ---------------- Fruit ---------------- */

const apple = (fill: string): Shape => ({
  w: 36, h: 38,
  art: (
    <>
      <Path d="M18 10C10 4 1 9 2 20c1 11 8 18 16 15 8 3 15-4 16-15 1-11-8-16-16-10z" fill={fill} />
      <Path d="M18 10q0-6 3-9" stroke={STEM} strokeWidth={2} fill="none" strokeLinecap="round" />
      {leaf(19, 6)}
      {hi(10, 18, 3, 5)}
    </>
  ),
})

const citrus = (fill: string, rind: string): Shape => ({
  w: 40, h: 30,
  art: (
    <>
      <Path d="M3 15C3 6 12 3 20 3s17 3 17 12-9 12-17 12S3 24 3 15z" fill={fill} />
      <Circle cx={2.5} cy={15} r={2} fill={fill} />
      <Circle cx={37.5} cy={15} r={2} fill={fill} />
      <G fill={rind} opacity={0.5}>
        <Circle cx={12} cy={12} r={0.9} /><Circle cx={20} cy={9} r={0.9} /><Circle cx={27} cy={14} r={0.9} /><Circle cx={16} cy={19} r={0.9} /><Circle cx={25} cy={20} r={0.9} />
      </G>
      {hi(12, 10, 5, 2.5)}
    </>
  ),
})

const SHAPES: Record<string, Shape> = {
  apple: apple('#e0473b'),
  greenApple: apple('#8cc63f'),
  banana: {
    w: 48, h: 32,
    art: (
      <>
        <Path d="M6 4c8 14 28 16 38 4-2-2-4-1-5 0-9 8-23 6-29-6z" fill="#f9df5d" />
        <Path d="M4 8c6 18 30 22 42 8-2-2-4-2-5-1-9 9-27 7-33-9z" fill="#f6d33c" stroke="#d4a017" strokeWidth={1} />
        <Path d="M3 2l5-1 2 4-5 2z" fill="#6b4a1f" />
        <Circle cx={46} cy={16} r={1.6} fill="#5c4033" />
        <Path d="M10 14c6 7 16 9 25 6" stroke={HI} strokeWidth={1.6} fill="none" opacity={0.4} strokeLinecap="round" />
      </>
    ),
  },
  orange: {
    w: 36, h: 36,
    art: (
      <>
        <Circle cx={18} cy={20} r={15} fill="#f5902a" />
        <G fill="#d9731a" opacity={0.45}>
          <Circle cx={11} cy={22} r={0.9} /><Circle cx={18} cy={27} r={0.9} /><Circle cx={25} cy={22} r={0.9} /><Circle cx={22} cy={14} r={0.9} /><Circle cx={13} cy={29} r={0.9} />
        </G>
        {leaf(18, 5)}
        <Circle cx={18} cy={5.5} r={1.6} fill={STEM} />
        {hi(11, 15, 3.5, 5)}
      </>
    ),
  },
  lemon: citrus('#f7d63e', '#c9a80f'),
  lime: citrus('#7cc242', '#4e8a1f'),
  avocado: {
    w: 32, h: 42,
    art: (
      <>
        <Path d="M16 2C9 2 7 12 5 20c-3 10 1 20 11 20s14-10 11-20C25 12 23 2 16 2z" fill="#3f6e2a" />
        <Path d="M16 5.5c-5.5 0-7 8-8.6 14.4-2.4 8 .8 16.1 8.6 16.1s11-8.1 8.6-16.1C23 13.5 21.5 5.5 16 5.5z" fill="#d7e59a" />
        <Path d="M16 9c-4 0-5 6-6.2 10.8-1.8 6 .6 12.1 6.2 12.1s8-6.1 6.2-12.1C21 15 20 9 16 9z" fill="#c2d977" />
        <Circle cx={16} cy={26} r={6.2} fill="#8b5a2b" />
        {hi(14, 24, 1.8, 2.4)}
      </>
    ),
  },
  peach: {
    w: 36, h: 36,
    art: (
      <>
        <Path d="M18 8C8 4 2 14 3 22c2 10 9 13 15 12 6 1 13-2 15-12 1-8-5-18-15-14z" fill="#f9a66c" />
        <Circle cx={12} cy={23} r={8} fill="#f47c5b" opacity={0.45} />
        <Path d="M18 9c-3 9-2 18 0 25" stroke="#e0784a" strokeWidth={1.5} fill="none" opacity={0.6} />
        {leaf(19, 7)}
        {hi(25, 16, 3, 4)}
      </>
    ),
  },
  pear: {
    w: 32, h: 42,
    art: (
      <>
        <Path d="M16 5c-4 0-5 5-5 9s-8 8-8 16c0 7 6 11 13 11s13-4 13-11c0-8-8-12-8-16s-1-9-5-9z" fill="#c5d94a" />
        <Circle cx={20} cy={30} r={6} fill="#a8c23a" opacity={0.6} />
        <Path d="M16 5q0-4 3-5" stroke={STEM} strokeWidth={2} fill="none" strokeLinecap="round" />
        {leaf(17, 3)}
        {hi(10, 26, 2.5, 5)}
      </>
    ),
  },
  grapes: {
    w: 34, h: 42,
    art: (
      <>
        <Path d="M17 8q0-5 4-7" stroke={STEM} strokeWidth={2} fill="none" strokeLinecap="round" />
        {leaf(18, 6)}
        <G fill="#7d4e9e">
          <Circle cx={9} cy={14} r={5.5} /><Circle cx={17} cy={13} r={5.5} /><Circle cx={25} cy={14} r={5.5} />
          <Circle cx={13} cy={22} r={5.5} /><Circle cx={21} cy={22} r={5.5} />
          <Circle cx={9} cy={30} r={5} /><Circle cx={17} cy={30} r={5.5} /><Circle cx={25} cy={29} r={5} />
          <Circle cx={17} cy={37} r={5} />
        </G>
        <G fill={HI} opacity={0.35}>
          <Circle cx={7.5} cy={12} r={1.5} /><Circle cx={15.5} cy={11} r={1.5} /><Circle cx={11.5} cy={20} r={1.5} /><Circle cx={15.5} cy={28} r={1.5} />
        </G>
      </>
    ),
  },
  strawberry: {
    w: 30, h: 36,
    art: (
      <>
        <Path d="M15 34C6 30 2 20 3 13c1-5 6-7 12-5 6-2 11 0 12 5 1 7-3 17-12 21z" fill="#e8333c" />
        <G fill="#ffe08a">
          <Ellipse cx={9} cy={15} rx={0.9} ry={1.3} /><Ellipse cx={15} cy={13} rx={0.9} ry={1.3} /><Ellipse cx={21} cy={15} rx={0.9} ry={1.3} />
          <Ellipse cx={11} cy={21} rx={0.9} ry={1.3} /><Ellipse cx={18} cy={21} rx={0.9} ry={1.3} /><Ellipse cx={14} cy={27} rx={0.9} ry={1.3} /><Ellipse cx={24} cy={20} rx={0.9} ry={1.3} />
        </G>
        <Path d="M6 9l4-5 3 4 2-6 2 6 3-4 4 5c-6 3-12 3-18 0z" fill="#3fa34d" />
      </>
    ),
  },
  watermelon: {
    w: 44, h: 26,
    art: (
      <>
        <Path d="M2 3a20 20 0 0 0 40 0z" fill="#3d8b37" />
        <Path d="M4 3a18 18 0 0 0 36 0z" fill="#d9f0c0" />
        <Path d="M6 3a16 16 0 0 0 32 0z" fill="#f0525a" />
        <G fill="#2b2b2b">
          <Ellipse cx={14} cy={8} rx={1} ry={1.6} /><Ellipse cx={22} cy={11} rx={1} ry={1.6} /><Ellipse cx={30} cy={8} rx={1} ry={1.6} /><Ellipse cx={18} cy={15} rx={1} ry={1.6} /><Ellipse cx={26} cy={15} rx={1} ry={1.6} />
        </G>
      </>
    ),
  },
  pineapple: {
    w: 30, h: 50,
    art: (
      <>
        <Path d="M15 20L8 2l5 9 2-11 2 11 5-9z" fill="#3fa34d" />
        <Path d="M15 20L5 8l6 11M15 20l10-12-6 11" fill="#2e7d32" />
        <Ellipse cx={15} cy={34} rx={11} ry={15} fill="#f0b429" />
        <G stroke="#c98a12" strokeWidth={1} opacity={0.7}>
          <Line x1={8} y1={24} x2={22} y2={44} /><Line x1={5} y1={32} x2={15} y2={48} /><Line x1={14} y1={20} x2={25} y2={38} />
          <Line x1={22} y1={24} x2={8} y2={44} /><Line x1={25} y1={32} x2={15} y2={48} /><Line x1={16} y1={20} x2={5} y2={38} />
        </G>
        {hi(10, 30, 2, 6)}
      </>
    ),
  },
  mango: {
    w: 40, h: 32,
    art: (
      <>
        <Path d="M6 18C4 8 16 2 26 4s13 12 9 19c-5 8-19 9-26 4-2-2-3-5-3-9z" fill="#f7a81b" />
        <Circle cx={13} cy={20} r={9} fill="#ef6c3a" opacity={0.5} />
        {leaf(27, 5)}
        {hi(24, 11, 5, 2.5)}
      </>
    ),
  },
  kiwi: {
    w: 36, h: 36,
    art: (
      <>
        <Circle cx={18} cy={18} r={16} fill="#8a6a3d" />
        <Circle cx={18} cy={18} r={13} fill="#8cc63f" />
        <Circle cx={18} cy={18} r={5} fill="#eef6c8" />
        <G fill="#2b2b1b">
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2
            return <Ellipse key={i} cx={18 + Math.cos(a) * 8.5} cy={18 + Math.sin(a) * 8.5} rx={0.9} ry={1.4} />
          })}
        </G>
      </>
    ),
  },
  cherries: {
    w: 38, h: 40,
    art: (
      <>
        <Path d="M12 28Q16 10 26 2M26 29Q25 12 26 2" stroke="#5b8a2d" strokeWidth={2} fill="none" strokeLinecap="round" />
        {leaf(26, 3)}
        <Circle cx={12} cy={30} r={8} fill="#c8102e" />
        <Circle cx={27} cy={31} r={8} fill="#b00d27" />
        {hi(9, 27, 2, 3)}
        {hi(24, 28, 2, 3)}
      </>
    ),
  },
  blueberries: {
    w: 40, h: 28,
    art: (
      <G>
        {[[8, 20], [19, 22], [30, 20], [13, 11], [24, 11], [34, 12]].map(([x, y], i) => (
          <G key={i}>
            <Circle cx={x} cy={y} r={6.5} fill={i % 2 ? '#3f51b5' : '#4a5fc1'} />
            <Circle cx={x} cy={y - 3} r={1.6} fill="#27336e" />
            <Circle cx={x - 2.5} cy={y + 1} r={1.3} fill={HI} opacity={0.3} />
          </G>
        ))}
      </G>
    ),
  },
  raspberries: {
    w: 36, h: 30,
    art: (
      <>
        {[[11, 17], [25, 15]].map(([x, y], b) => (
          <G key={b}>
            <Circle cx={x} cy={y} r={10} fill={b ? '#d63a6c' : '#e0457b'} />
            <G fill="#f07aa1">
              {[[-5, -4], [0, -6], [5, -4], [-6, 1], [0, 0], [6, 1], [-3, 5], [3, 5]].map(([dx, dy], i) => <Circle key={i} cx={x + dx} cy={y + dy} r={2.2} />)}
            </G>
          </G>
        ))}
      </>
    ),
  },
  mixedBerries: {
    w: 40, h: 32,
    art: (
      <>
        <Circle cx={12} cy={19} r={10} fill="#e0457b" />
        <G fill="#f07aa1">{[[-5, -4], [0, -6], [5, -4], [-5, 2], [1, 1], [-2, 6]].map(([dx, dy], i) => <Circle key={i} cx={12 + dx} cy={19 + dy} r={2.2} />)}</G>
        {[[26, 24], [33, 16], [24, 12]].map(([x, y], i) => (
          <G key={i}><Circle cx={x} cy={y} r={6} fill="#4a5fc1" /><Circle cx={x} cy={y - 3} r={1.4} fill="#27336e" /></G>
        ))}
      </>
    ),
  },

  /* ---------------- Vegetables ---------------- */

  carrot: {
    w: 40, h: 40,
    art: (
      <>
        <Path d="M31 9c-1-7 3-9 4-6M33 11c4-6 8-4 6-1M30 8c-5-4-8 0-5 2" stroke="#4caf50" strokeWidth={3} fill="none" strokeLinecap="round" />
        <Path d="M4 37c8-6 20-18 26-26 2-3 6-1 4 3-6 7-18 17-30 23z" fill="#f28c28" />
        <Path d="M14 28l3 2M20 22l3 2M25 16l2 2" stroke="#d06b12" strokeWidth={1.3} strokeLinecap="round" />
      </>
    ),
  },
  broccoli: {
    w: 36, h: 40,
    art: (
      <>
        <Path d="M14 22h8l-1 16h-6z" fill="#8bc34a" />
        <Circle cx={10} cy={18} r={8} fill="#2e7d32" />
        <Circle cx={26} cy={18} r={8} fill="#2e7d32" />
        <Circle cx={18} cy={11} r={9} fill="#388e3c" />
        <Circle cx={18} cy={21} r={7} fill="#2e7d32" />
        <G fill="#66bb6a" opacity={0.7}><Circle cx={15} cy={8} r={2} /><Circle cx={8} cy={15} r={1.8} /><Circle cx={24} cy={15} r={1.8} /></G>
      </>
    ),
  },
  leafy: {
    w: 40, h: 40,
    art: (
      <>
        <Path d="M20 36C8 30 3 17 9 6c6 6 10 18 11 30z" fill="#4caf50" />
        <Path d="M20 36c12-6 17-19 11-30-6 6-10 18-11 30z" fill="#66bb6a" />
        <Path d="M20 36c-6-12-6-26 0-34 6 8 6 22 0 34z" fill="#388e3c" />
        <Path d="M20 34V8M12 14l7 9M28 14l-7 9" stroke="#a5d6a7" strokeWidth={1} opacity={0.8} />
        <Rect x={16} y={31} width={8} height={4} rx={1} fill="#c9a66b" />
      </>
    ),
  },
  tomato: {
    w: 36, h: 34,
    art: (
      <>
        <Circle cx={18} cy={19} r={14} fill="#e53935" />
        <Path d="M18 6l-4 3-5-1 4 3-2 4 7-3 7 3-2-4 4-3-5 1z" fill={LEAF} />
        {hi(11, 15, 3, 4)}
      </>
    ),
  },
  pepper: {
    w: 34, h: 38,
    art: (
      <>
        <Path d="M8 12c-6 2-6 18 0 23 4 3 7 1 9-1 2 2 5 4 9 1 6-5 6-21 0-23-4-2-14-2-18 0z" fill="#e53935" />
        <Path d="M17 12v-6q1-3 4-2" stroke="#388e3c" strokeWidth={3} fill="none" strokeLinecap="round" />
        <Path d="M17 14v18" stroke="#b71c1c" strokeWidth={1.2} opacity={0.5} />
        {hi(10, 20, 2, 6)}
      </>
    ),
  },
  cucumber: {
    w: 46, h: 18,
    art: (
      <>
        <Rect x={2} y={2} width={42} height={14} rx={7} fill="#4e8a3a" />
        <Path d="M8 6h30M8 12h30" stroke="#7cb342" strokeWidth={1.5} opacity={0.6} />
        <G fill="#2f5d22"><Circle cx={12} cy={9} r={0.9} /><Circle cx={20} cy={9} r={0.9} /><Circle cx={28} cy={9} r={0.9} /><Circle cx={36} cy={9} r={0.9} /></G>
      </>
    ),
  },
  mushroom: {
    w: 36, h: 32,
    art: (
      <>
        <Rect x={13} y={14} width={10} height={16} rx={4} fill="#efe3cf" />
        <Path d="M3 17C3 5 33 5 33 17z" fill="#b07d56" />
        <G fill="#d4a57f"><Circle cx={11} cy={11} r={2} /><Circle cx={20} cy={9} r={1.6} /><Circle cx={26} cy={13} r={1.8} /></G>
      </>
    ),
  },
  onion: {
    w: 32, h: 38,
    art: (
      <>
        <Path d="M16 6C8 14 3 20 5 28c2 8 20 8 22 0 2-8-3-14-11-22z" fill="#e0a458" />
        <Path d="M16 8c-4 8-5 18-2 27M16 8c4 8 5 18 2 27" stroke="#b97b35" strokeWidth={1} fill="none" opacity={0.6} />
        <Path d="M16 7V1" stroke="#7cb342" strokeWidth={2} strokeLinecap="round" />
      </>
    ),
  },
  peas: {
    w: 44, h: 22,
    art: (
      <>
        <Path d="M2 12C10 2 34 2 42 10c-8 10-32 10-40 2z" fill="#7cb342" />
        <G fill="#aed581">{[10, 18, 26, 34].map(x => <Circle key={x} cx={x} cy={11} r={4.2} />)}</G>
        <Path d="M42 10q3-4 1-8" stroke="#558b2f" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      </>
    ),
  },
  produceMix: {
    w: 48, h: 40,
    art: (
      <>
        <Circle cx={14} cy={27} r={11} fill="#e0473b" />
        <Circle cx={34} cy={28} r={10} fill="#7cc242" />
        <Circle cx={24} cy={17} r={11} fill="#f5902a" />
        {leaf(24, 6)}
        {hi(10, 23, 2.5, 3.5)}{hi(20, 13, 2.5, 3.5)}
      </>
    ),
  },

  /* ---------------- Meat & fish ---------------- */

  steak: {
    w: 50, h: 34,
    art: (
      <>
        <Path d="M6 10C10 2 30 0 40 6c9 5 8 18-2 23-10 5-26 4-32-3C1 21 2 14 6 10z" fill="#b5433a" stroke="#f3d6c6" strokeWidth={3} />
        <Circle cx={34} cy={17} r={5.5} fill="#f5efe6" />
        <Path d="M12 14c4-2 8-1 11 2M11 21c5 1 9 0 12-3" stroke="#f3d6c6" strokeWidth={1.4} fill="none" opacity={0.7} />
      </>
    ),
  },
  drumstick: {
    w: 44, h: 40,
    art: (
      <>
        <Path d="M20 24L9 35" stroke="#f7f0e3" strokeWidth={5} strokeLinecap="round" />
        <Circle cx={7} cy={35} r={3.6} fill="#f7f0e3" /><Circle cx={10} cy={38} r={3.6} fill="#f7f0e3" />
        <Path d="M30 3c10 2 12 16 4 22-6 5-14 3-17-1-3-6 3-22 13-21z" fill="#f0b8a8" />
        <Path d="M32 8c5 2 6 9 2 13" stroke="#e38f80" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.7} />
        {hi(25, 10, 3, 4)}
      </>
    ),
  },
  fillet: {
    w: 48, h: 28,
    art: (
      <>
        <Path d="M3 14C10 4 34 2 44 8c2 6 0 12-4 16-10 4-28 4-37-10z" fill="#f7946b" />
        <Path d="M12 8c3 5 3 11 0 16M20 6c3 6 3 13 0 19M28 5c3 6 3 14 0 20M36 6c3 6 3 12 0 17" stroke="#ffd3c0" strokeWidth={1.6} fill="none" />
      </>
    ),
  },
  fish: {
    w: 48, h: 26,
    art: (
      <>
        <Path d="M36 13L47 3v20z" fill="#5e8fb8" />
        <Ellipse cx={20} cy={13} rx={18} ry={10} fill="#7fa7c9" />
        <Path d="M8 13c6-4 16-4 24 0" stroke="#b9d3e8" strokeWidth={1.5} fill="none" />
        <Circle cx={9} cy={10} r={1.8} fill="#1d2b36" />
      </>
    ),
  },
  bacon: {
    w: 46, h: 28,
    art: (
      <>
        {[4, 15].map((y, i) => (
          <G key={y}>
            <Path d={`M2 ${y + 2}q6-5 11 0t11 0 11 0 10 0v7q-5-5-10 0t-11 0-11 0-11 0z`} fill={i ? '#c9483f' : '#d9534f'} />
            <Path d={`M2 ${y + 5}q6-5 11 0t11 0 11 0 10 0`} stroke="#f8d7c7" strokeWidth={1.8} fill="none" />
          </G>
        ))}
      </>
    ),
  },
  sausage: {
    w: 44, h: 26,
    art: (
      <>
        <Rect x={2} y={3} width={38} height={9} rx={4.5} fill="#b5533c" />
        <Rect x={5} y={14} width={37} height={9} rx={4.5} fill="#a3472f" />
        <Path d="M8 6h24M11 17h24" stroke={HI} strokeWidth={1.4} opacity={0.3} strokeLinecap="round" />
      </>
    ),
  },
  groundMeat: {
    w: 46, h: 30,
    art: (
      <>
        <Rect x={2} y={10} width={42} height={18} rx={4} fill="#eef1f0" stroke="#cfd8d4" />
        <Path d="M6 20C6 9 40 7 40 20z" fill="#c9575a" />
        <G fill="#e7898b">{[[12, 16], [18, 13], [25, 15], [31, 14], [22, 18], [35, 18], [15, 19]].map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={1.3} />)}</G>
        <Path d="M8 12l30-4" stroke={HI} strokeWidth={1.5} opacity={0.6} />
      </>
    ),
  },
  deli: {
    w: 40, h: 32,
    art: (
      <>
        <Circle cx={16} cy={18} r={13} fill="#f2a0a8" />
        <Circle cx={24} cy={15} r={13} fill="#f7b8bf" stroke="#f2a0a8" strokeWidth={1.2} />
        <Path d="M18 10c4 2 8 3 12 2" stroke={HI} strokeWidth={1.2} opacity={0.5} fill="none" />
      </>
    ),
  },
  shrimp: {
    w: 40, h: 34,
    art: (
      <>
        <Path d="M30 8C20 2 6 8 6 20c0 8 8 12 14 10 4-1 4-6 0-7-4-1-7-3-6-7 1-4 8-6 14-3z" fill="#f79264" />
        <Path d="M11 12l4 3M9 18h5M11 24l4-2" stroke="#fbc3a3" strokeWidth={1.5} strokeLinecap="round" />
        <Path d="M30 8l7-3-2 7z" fill="#e8744a" />
      </>
    ),
  },

  /* ---------------- Dairy ---------------- */

  milk: {
    w: 34, h: 56,
    art: (
      <>
        <Rect x={11} y={1} width={12} height={5} rx={1} fill="#3b74b3" />
        <Path d="M3 17 11 6h12l8 11z" fill="#4a86c5" />
        <Path d="M3 17h28v35a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill="#fbfcfe" stroke="#cfd9e8" />
        <Rect x={7} y={26} width={20} height={14} rx={2.5} fill="#4a86c5" />
        <Path d="M17 29c-2 3-3 5-3 6a3 3 0 0 0 6 0c0-1-1-3-3-6z" fill="#fff" />
      </>
    ),
  },
  plantMilk: {
    w: 30, h: 56,
    art: (
      <>
        <Rect x={10} y={2} width={10} height={6} rx={2} fill="#2f4b7c" />
        <Path d="M4 12l6-5h10l6 5v40a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="#efe6d2" stroke="#d8ccb2" />
        <Rect x={4} y={22} width={22} height={16} fill="#2f4b7c" />
        <Path d="M9 30c3-4 9-4 12 0" stroke="#efe6d2" strokeWidth={2} fill="none" strokeLinecap="round" />
      </>
    ),
  },
  cheese: {
    w: 44, h: 34,
    art: (
      <>
        <Path d="M3 20L28 6l14 8-25 14z" fill="#ffe082" />
        <Path d="M3 20l14 8v6L3 26z" fill="#f5c518" />
        <Path d="M17 28l25-14v6L17 34z" fill="#ffca28" />
        <G fill="#e8b10e"><Circle cx={25} cy={25} r={2} /><Circle cx={33} cy={20} r={1.5} /><Circle cx={9} cy={25} r={1.6} /><Ellipse cx={24} cy={13} rx={2.2} ry={1.2} /></G>
      </>
    ),
  },
  yogurt: {
    w: 36, h: 38,
    art: (
      <>
        <Path d="M5 10h26l-3 26H8z" fill="#fbfcfe" stroke="#d6dde6" />
        <Rect x={3} y={5} width={30} height={6} rx={2} fill="#9c7bd6" />
        <Rect x={6.5} y={18} width={23} height={8} fill="#c5b3ec" />
        {hi(10, 28, 1.5, 4)}
      </>
    ),
  },
  eggs: {
    w: 46, h: 34,
    art: (
      <>
        {[8, 18, 28, 38].map((x, i) => <Ellipse key={x} cx={x} cy={i % 2 ? 15 : 16} rx={5} ry={7} fill="#fff8ee" stroke="#e8d9c0" />)}
        <Path d="M1 21h44l-3 11H4z" fill="#d8c3a5" />
        <Path d="M8 21v11M18 21v11M28 21v11M38 21v11" stroke="#c4ad8c" strokeWidth={1} />
      </>
    ),
  },
  butter: {
    w: 44, h: 26,
    art: (
      <>
        <Path d="M4 10l8-7h30l-8 7z" fill="#fff3b0" />
        <Path d="M34 10l8-7v14l-8 7z" fill="#f5d547" />
        <Rect x={4} y={10} width={30} height={14} fill="#ffe066" />
        <Rect x={4} y={14} width={30} height={6} fill="#f0b429" />
      </>
    ),
  },
  iceCream: {
    w: 38, h: 38,
    art: (
      <>
        <Path d="M5 12h28l-3 24H8z" fill="#fff" stroke="#e3d6dc" />
        <Rect x={3} y={7} width={32} height={7} rx={2.5} fill="#f48fb1" />
        <Rect x={6.5} y={19} width={25} height={9} fill="#fce4ec" />
        <Circle cx={19} cy={23.5} r={3} fill="#f48fb1" />
      </>
    ),
  },
  creamCheese: {
    w: 40, h: 26,
    art: (
      <>
        <Rect x={3} y={8} width={34} height={16} rx={4} fill="#fbfcfe" stroke="#d6dde6" />
        <Rect x={2} y={4} width={36} height={7} rx={3} fill="#90caf9" />
        <Rect x={9} y={14} width={22} height={6} rx={1.5} fill="#e3f2fd" />
      </>
    ),
  },

  /* ---------------- Takeout ---------------- */

  pail: {
    w: 44, h: 44,
    art: (
      <>
        <Path d="M13 13Q22-3 31 13" stroke="#9aa5a0" strokeWidth={2} fill="none" />
        <Path d="M4 16h36l-5 26H9z" fill="#fbfaf7" stroke="#d9d3c6" />
        <Path d="M4 16 11 8l11 6 11-6 7 8z" fill="#efebe2" stroke="#d9d3c6" />
        <Path d="M7 25h30l-1 6H8z" fill="#d9483b" />
      </>
    ),
  },
  pizza: {
    w: 44, h: 42,
    art: (
      <>
        <Path d="M4 7q18-7 36 0L22 41z" fill="#f6c453" />
        <Path d="M4 7q18-7 36 0l-2 4q-16-6-32 0z" fill="#d68a3c" />
        <G fill="#c0392b"><Circle cx={16} cy={15} r={3.5} /><Circle cx={28} cy={16} r={3.5} /><Circle cx={22} cy={26} r={3} /></G>
        <G fill="#7cb342"><Circle cx={21} cy={14} r={1.2} /><Circle cx={26} cy={23} r={1.2} /></G>
      </>
    ),
  },
  burrito: {
    w: 48, h: 26,
    art: (
      <>
        <Rect x={2} y={4} width={38} height={18} rx={9} fill="#c9ccd1" />
        <Path d="M10 6l3 14M18 5l2 16M26 5l2 16" stroke="#e7e9ec" strokeWidth={1.4} />
        <Ellipse cx={39} cy={13} rx={7} ry={9} fill="#e7c07a" />
        <G fill="#7a4a1d"><Circle cx={37} cy={10} r={1.3} /><Circle cx={41} cy={15} r={1.3} /></G>
        <G fill="#7cb342"><Circle cx={40} cy={9} r={1.1} /></G>
        <G fill="#d9483b"><Circle cx={37} cy={16} r={1.1} /></G>
      </>
    ),
  },
  sushi: {
    w: 50, h: 22,
    art: (
      <>
        {[10, 25, 40].map((x, i) => (
          <G key={x}>
            <Circle cx={x} cy={11} r={9} fill="#263238" />
            <Circle cx={x} cy={11} r={7} fill="#fafafa" />
            <Circle cx={x} cy={11} r={3.2} fill={i === 1 ? '#8bc34a' : '#f7946b'} />
          </G>
        ))}
      </>
    ),
  },
  noodles: {
    w: 46, h: 38,
    art: (
      <>
        <Path d="M30 2L18 20M36 3L22 21" stroke="#a0714f" strokeWidth={2} strokeLinecap="round" />
        <Path d="M8 17c2-4 4 0 6-4s4 0 6-4 4 0 6-4 4 0 6-2 3 2 6 1" stroke="#f3d17a" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Path d="M3 18c0 16 40 16 40 0z" fill="#e8eef5" />
        <Rect x={3} y={17} width={40} height={3.5} rx={1.5} fill="#4a86c5" />
      </>
    ),
  },
  bowl: {
    w: 46, h: 34,
    art: (
      <>
        <Path d="M4 14C4 2 42 2 42 14z" fill="#e8f1ec" opacity={0.85} stroke="#cfdcd5" />
        <G>
          <Circle cx={13} cy={11} r={3.5} fill="#7cb342" /><Circle cx={20} cy={9} r={3} fill="#f6d33c" />
          <Circle cx={27} cy={11} r={3.5} fill="#8d5a3b" /><Circle cx={33} cy={11} r={3} fill="#e53935" />
        </G>
        <Path d="M3 14h40l-4 16a3 3 0 0 1-3 2H10a3 3 0 0 1-3-2z" fill="#c8a47e" />
        <Path d="M9 21h28" stroke="#a88660" strokeWidth={1.4} opacity={0.6} />
      </>
    ),
  },
  salad: {
    w: 46, h: 32,
    art: (
      <>
        <Path d="M9 14c-3-8 6-12 10-6 2-6 12-6 12 1 5-4 11 1 7 5z" fill="#66bb6a" />
        <Circle cx={18} cy={11} r={3} fill="#e53935" /><Circle cx={30} cy={10} r={2.6} fill="#f6d33c" />
        <Path d="M3 14c0 16 40 16 40 0z" fill="#fbfcfe" stroke="#d6dde6" />
      </>
    ),
  },
  tub: {
    w: 38, h: 34,
    art: (
      <>
        <Rect x={3} y={3} width={32} height={7} rx={3} fill="#f7f9f8" stroke="#cfd8d4" />
        <Path d="M5 10h28l-2 21a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" fill="#e3e9e6" opacity={0.9} />
        <Path d="M6.2 16h25.6l-1.2 14a2 2 0 0 1-2 2H9.4a2 2 0 0 1-2-2z" fill="#b5533c" />
        <G fill="#d9785c"><Circle cx={13} cy={22} r={1.5} /><Circle cx={22} cy={25} r={1.5} /><Circle cx={27} cy={20} r={1.3} /></G>
      </>
    ),
  },
  dumplings: {
    w: 48, h: 26,
    art: (
      <>
        {[[12, 18], [26, 16], [38, 19]].map(([x, y], i) => (
          <G key={i}>
            <Path d={`M${x - 10} ${y + 4}c0-12 20-12 20 0z`} fill="#f3e9d2" stroke="#e0d2b2" />
            <Path d={`M${x - 5} ${y - 4}l1 3M${x} ${y - 5}v3M${x + 5} ${y - 4}l-1 3`} stroke="#d6c49c" strokeWidth={1.2} strokeLinecap="round" />
          </G>
        ))}
      </>
    ),
  },

  /* ---------------- Drinks ---------------- */

  bottle: {
    w: 26, h: 60,
    art: (
      <>
        <Rect x={9} y={0} width={8} height={6} rx={1.5} fill="#2f6f9f" />
        <Path d="M10 6h6v6c0 3 7 5 7 11v32a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V23c0-6 7-8 7-11z" fill="#bfe0f2" stroke="#9ccbe4" />
        <Rect x={3} y={30} width={20} height={12} fill="#2f6f9f" />
        {hi(7.5, 40, 1.3, 14)}
      </>
    ),
  },
  juice: {
    w: 30, h: 52,
    art: (
      <>
        <Rect x={17} y={1} width={7} height={6} rx={1.5} fill="#43a047" />
        <Path d="M3 14 9 6h16v8z" fill="#fbfaf7" stroke="#e3ddcf" />
        <Rect x={3} y={14} width={24} height={36} rx={2} fill="#f5902a" />
        <Circle cx={15} cy={31} r={7} fill="#ffd18a" />
        <Path d="M15 24v14M8 31h14M10 26l10 10M20 26L10 36" stroke="#f5902a" strokeWidth={1} />
      </>
    ),
  },
  can: {
    w: 26, h: 42,
    art: (
      <>
        <Rect x={3} y={4} width={20} height={36} rx={4} fill="#d62828" />
        <Ellipse cx={13} cy={5} rx={10} ry={3} fill="#c9ced3" />
        <Path d="M3 18q10 6 20 0" stroke="#fff" strokeWidth={2.5} fill="none" />
        {hi(7, 26, 1.3, 9)}
      </>
    ),
  },
  wine: {
    w: 20, h: 64,
    art: (
      <>
        <Rect x={7} y={0} width={6} height={14} rx={1.5} fill="#2b0f18" />
        <Path d="M7 14h6c0 6 6 7 6 14v32a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V28c0-7 6-8 6-14z" fill="#5a1f33" />
        <Rect x={1} y={36} width={18} height={14} fill="#f1e6cf" />
        {hi(5, 30, 1, 5)}
      </>
    ),
  },
  kombucha: {
    w: 24, h: 54,
    art: (
      <>
        <Rect x={6} y={0} width={12} height={6} rx={1.5} fill="#1d1d1d" />
        <Path d="M7 6h10v4c3 2 5 4 5 9v31a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V19c0-5 2-7 5-9z" fill="#c77d2e" />
        <Rect x={2} y={24} width={20} height={14} fill="#f7efe0" />
        {hi(6, 44, 1.2, 5)}
      </>
    ),
  },
  water: {
    w: 22, h: 56,
    art: (
      <>
        <Rect x={7} y={0} width={8} height={6} rx={1.5} fill="#1e88e5" />
        <Path d="M7 6h8v4c3 1 5 3 5 7v35a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V17c0-4 2-6 5-7z" fill="#d6ecfb" stroke="#a9d2f2" />
        <Path d="M2 26h18M2 36h18" stroke="#a9d2f2" strokeWidth={1.2} />
        <Rect x={2} y={28} width={18} height={6} fill="#64b5f6" />
      </>
    ),
  },

  /* ---------------- Condiments ---------------- */

  squeeze: {
    w: 22, h: 54,
    art: (
      <>
        <Path d="M9 0h4l2 8H7z" fill="#43a047" />
        <Rect x={5} y={8} width={12} height={6} rx={1.5} fill="#43a047" />
        <Path d="M4 14h14c2 0 3 2 3 4v31a4 4 0 0 1-4 4H5a4 4 0 0 1-4-4V18c0-2 1-4 3-4z" fill="#d62828" />
        <Rect x={3} y={26} width={16} height={12} rx={2} fill="#fbfaf7" />
        <Path d="M11 29l-2 6h4z" fill="#d62828" />
      </>
    ),
  },
  mustard: {
    w: 22, h: 54,
    art: (
      <>
        <Path d="M9 0h4l2 8H7z" fill="#d62828" />
        <Rect x={5} y={8} width={12} height={6} rx={1.5} fill="#d62828" />
        <Path d="M4 14h14c2 0 3 2 3 4v31a4 4 0 0 1-4 4H5a4 4 0 0 1-4-4V18c0-2 1-4 3-4z" fill="#f2c230" />
        {hi(6, 34, 1.3, 10)}
      </>
    ),
  },
  mayo: {
    w: 32, h: 38,
    art: (
      <>
        <Rect x={4} y={2} width={24} height={8} rx={2} fill="#1e5aa8" />
        <Rect x={2} y={9} width={28} height={28} rx={6} fill="#f7f2e0" stroke="#e3dcc4" />
        <Rect x={2} y={17} width={28} height={10} fill="#1e5aa8" />
      </>
    ),
  },
  peanutButter: {
    w: 32, h: 38,
    art: (
      <>
        <Rect x={4} y={2} width={24} height={8} rx={2} fill="#c62828" />
        <Rect x={2} y={9} width={28} height={28} rx={6} fill="#b7773a" />
        <Rect x={2} y={17} width={28} height={10} fill="#f7efe0" />
        <Ellipse cx={16} cy={22} rx={5} ry={3} fill="#b7773a" />
      </>
    ),
  },

  /* ---------------- Other ---------------- */

  tofu: {
    w: 42, h: 28,
    art: (
      <>
        <Rect x={2} y={4} width={38} height={22} rx={4} fill="#dfeef8" stroke="#a9cbe3" />
        <Rect x={7} y={8} width={28} height={14} rx={2} fill="#fbf7ea" />
        <Path d="M7 12h28" stroke={HI} strokeWidth={1.5} opacity={0.8} />
      </>
    ),
  },
  hummus: {
    w: 40, h: 28,
    art: (
      <>
        <Rect x={3} y={9} width={34} height={17} rx={4} fill="#fbfaf7" stroke="#e0d9ca" />
        <Ellipse cx={20} cy={9} rx={18} ry={5} fill="#e7cf9e" />
        <Path d="M10 9c4-3 16-3 20 0" stroke="#c9a86a" strokeWidth={1.4} fill="none" />
        <Circle cx={20} cy={8} r={1.8} fill="#6b8e23" />
      </>
    ),
  },
  container: {
    w: 46, h: 30,
    art: (
      <>
        <Rect x={19} y={0} width={8} height={4} rx={1} fill="#4a86c5" />
        <Rect x={1} y={3} width={44} height={8} rx={3} fill="#4a86c5" />
        <Path d="M4 11h38l-2.5 16a3 3 0 0 1-3 2.5H9.5a3 3 0 0 1-3-2.5z" fill="#e8eef2" stroke="#cfd9e0" />
        <Rect x={9} y={15} width={28} height={9} rx={2} fill="#d9a86c" opacity={0.85} />
      </>
    ),
  },
}

// Jars share a body; only the contents colour changes.
const jar = (contents: string, lid: string): Shape => ({
  w: 32, h: 40,
  art: (
    <>
      <Rect x={5} y={1} width={22} height={8} rx={2} fill={lid} />
      <Rect x={2} y={8} width={28} height={31} rx={7} fill="#eef3f1" stroke="#cfd9d4" />
      <Rect x={4.5} y={15} width={23} height={21.5} rx={5} fill={contents} />
      <Rect x={2} y={19} width={28} height={9} fill="#fbfaf7" opacity={0.92} />
      {hi(6, 30, 1.2, 4)}
    </>
  ),
})
Object.assign(SHAPES, {
  jar: jar('#d9a441', '#c9a227'),
  dijon: jar('#c9a227', '#2b2b2b'),
  jam: jar('#8e244d', '#d62828'),
  pesto: jar('#6a8f2f', '#2e7d32'),
  salsa: jar('#c0392b', '#f5902a'),
  pickles: jar('#7a9a3a', '#43a047'),
  olives: jar('#55642e', '#2b2b2b'),
  applesauce: jar('#f3d9a0', '#e0473b'),
  eggplant: {
    w: 44, h: 30,
    art: (
      <>
        <Path d="M10 8c8-6 22-4 30 4 5 6 3 14-4 16-8 2-16-2-22-8-4-4-7-9-4-12z" fill="#5e3b7a" />
        <Path d="M4 6l7-1 3 5-6 3z" fill="#43a047" />
        <Path d="M2 5l4 1" stroke="#43a047" strokeWidth={2.5} strokeLinecap="round" />
        {hi(24, 12, 7, 2.5)}
      </>
    ),
  },
  corn: {
    w: 40, h: 40,
    art: (
      <>
        <Path d="M8 34c6-10 16-22 26-28 3 5-4 20-14 27-5 3-9 3-12 1z" fill="#f6c946" />
        <G fill="#e0a918">{[[16, 26], [20, 21], [24, 16], [28, 11], [19, 28], [23, 23], [27, 18]].map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={1.6} />)}</G>
        <Path d="M4 38c2-10 8-18 12-20-1 8-5 16-12 20zM6 38c10-2 16-6 20-12-8 2-14 6-20 12z" fill="#7cb342" />
      </>
    ),
  },
  potato: {
    w: 42, h: 30,
    art: (
      <>
        <Path d="M6 16C4 7 16 3 26 4s14 8 12 15-10 10-20 9S7 22 6 16z" fill="#c9985c" />
        <G fill="#9a6d3a" opacity={0.7}><Circle cx={14} cy={12} r={1.2} /><Circle cx={25} cy={10} r={1.2} /><Circle cx={30} cy={19} r={1.2} /><Circle cx={18} cy={21} r={1.2} /></G>
        {hi(18, 9, 6, 2)}
      </>
    ),
  },
  bread: {
    w: 46, h: 30,
    art: (
      <>
        <Path d="M4 16C3 6 14 3 23 3s20 3 19 13v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="#d49a52" />
        <Path d="M12 7l4 8M21 5l4 9M30 6l4 8" stroke="#f3cf95" strokeWidth={2} strokeLinecap="round" />
        <Rect x={4} y={20} width={38} height={8} rx={2} fill="#b87a36" />
      </>
    ),
  },
  cake: {
    w: 40, h: 34,
    art: (
      <>
        <Path d="M4 16L30 6l6 4v6z" fill="#fbe3c2" />
        <Path d="M4 16h32v14H4z" fill="#f3c98b" />
        <Path d="M4 21h32" stroke="#fbe3c2" strokeWidth={3} />
        <Path d="M4 16h32" stroke="#fff5e6" strokeWidth={3} />
        <Circle cx={30} cy={6} r={3} fill="#d62828" />
      </>
    ),
  },
  soySauce: {
    w: 22, h: 52,
    art: (
      <>
        <Rect x={7} y={0} width={8} height={8} rx={2} fill="#d62828" />
        <Path d="M8 8h6v6c4 2 6 5 6 10v24a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V24c0-5 2-8 6-10z" fill="#3b2418" />
        <Rect x={2} y={28} width={18} height={10} fill="#f7efe0" />
      </>
    ),
  },
  dressing: {
    w: 22, h: 54,
    art: (
      <>
        <Rect x={7} y={0} width={8} height={7} rx={2} fill="#43a047" />
        <Path d="M8 7h6v5c4 2 6 5 6 10v27a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V22c0-5 2-8 6-10z" fill="#f3ead2" stroke="#e0d4b0" />
        <Rect x={2} y={28} width={18} height={11} fill="#43a047" />
      </>
    ),
  },
})

// Name → shape. First match wins, so the dish/container rules run before the
// ingredient rules: "strawberry jam" is a jar, "chicken soup" is a tub, "cherry
// tomatoes" are tomatoes, "Frank's hot sauce" is a sauce bottle.
const MATCH: [RegExp, string][] = [
  // Drinks and containers that name a fruit
  [/juice|\boj\b|lemonade/, 'juice'],
  [/peanut butter|almond butter|nut butter/, 'peanutButter'],
  [/ice cream|gelato|sorbet|popsicle/, 'iceCream'],
  [/cream cheese|sour cream|cottage/, 'creamCheese'],
  [/yogh?urt|kefir|skyr/, 'yogurt'],
  [/cream soda|root beer|ginger ale|soda|\bcola\b|\bcoke\b|sprite|seltzer|sparkling|\bbeer\b|lager|\bipa\b|iced coffee|cold brew|\bcan\b/, 'can'],
  [/kombucha/, 'kombucha'],
  [/wine|prosecco|champagne/, 'wine'],
  // Sauces, spreads, jars
  [/frank'?s|hot sauce|sriracha|ketchup|bbq sauce|barbecue sauce/, 'squeeze'],
  [/soy sauce|fish sauce|worcestershire|teriyaki|oyster sauce/, 'soySauce'],
  [/pasta sauce|tomato sauce|marinara|salsa/, 'salsa'],
  [/apple ?sauce/, 'applesauce'],
  [/dressing|ranch|vinaigrette/, 'dressing'],
  [/dijon/, 'dijon'],
  [/mustard/, 'mustard'],
  [/mayo|aioli/, 'mayo'],
  [/\bjam\b|jelly|preserves?\b|marmalade/, 'jam'],
  [/pesto/, 'pesto'],
  [/pickle/, 'pickles'],
  [/olive/, 'olives'],
  [/hummus|\bdip\b|tzatziki|guacamole/, 'hummus'],
  // Dishes and baked things
  // Takeout dishes named after a fruit or a bake: before the fruit and cake rules
  [/orange chicken|lemon chicken|general tso|sesame chicken|kung pao|sweet and sour/, 'pail'],
  [/pot pie|shepherd|casserole|hot ?pot/, 'tub'],
  [/cake|cheesecake|\bpie\b|brownie|cupcake|muffin/, 'cake'],
  [/bread|bagel|tortilla|\bbuns?\b|toast|pita|naan|croissant/, 'bread'],
  [/dumpling|gyoza|pierogi|\bbao\b|wonton/, 'dumplings'],
  [/pizza/, 'pizza'],
  [/sushi|maki|nigiri|sashimi/, 'sushi'],
  [/bowl|poke/, 'bowl'],
  [/burrito|\bwraps?\b|taco|quesadilla/, 'burrito'],
  [/ramen|\bpho\b|noodle|pasta|spaghetti|pad thai|pad see ew|lo mein|udon|lasagn|mac(aroni)? (and|&|n) cheese/, 'noodles'],
  [/soup|stew|curry|chili(?! pepper)|leftover|stir.?fry|fried rice/, 'tub'],
  [/salad/, 'salad'],
  [/nugget|tender|fries|wings? takeout/, 'pail'],
  [/burger|ground|mince|patt(y|ies)|meatball/, 'groundMeat'],
  [/tofu|tempeh/, 'tofu'],
  // Dairy
  [/oat milk|almond milk|soy milk|oatly|plant milk/, 'plantMilk'],
  [/pepper jack|cheese|cheddar|mozzarella|parmesan|brie|feta|gouda|halloumi|ricotta/, 'cheese'],
  [/\beggs?\b(?!plant)/, 'eggs'],
  [/butter(?!milk)/, 'butter'],
  [/milk|cream/, 'milk'],
  // Produce: tomatoes before cherries/grapes ("cherry tomatoes")
  [/tomato/, 'tomato'],
  [/pineapple/, 'pineapple'],
  [/watermelon|melon|cantaloupe|honeydew/, 'watermelon'],
  [/strawberr/, 'strawberry'],
  [/blueberr/, 'blueberries'],
  [/raspberr|blackberr/, 'raspberries'],
  [/berr/, 'mixedBerries'],
  [/grape(?!fruit)/, 'grapes'],
  [/cherr/, 'cherries'],
  [/green apple|granny smith/, 'greenApple'],
  [/apple/, 'apple'],
  [/banana|plantain/, 'banana'],
  [/orange|clementine|mandarin|tangerine|grapefruit/, 'orange'],
  [/lemon/, 'lemon'],
  [/\blime/, 'lime'],
  [/avocado/, 'avocado'],
  [/peach|nectarine|apricot|plum/, 'peach'],
  [/\bpears?\b/, 'pear'],
  [/mango|papaya/, 'mango'],
  [/kiwi/, 'kiwi'],
  [/eggplant|aubergine/, 'eggplant'],
  [/\bcorn\b|maize/, 'corn'],
  [/potato|yam\b/, 'potato'],
  [/carrot/, 'carrot'],
  [/broccoli|cauliflower/, 'broccoli'],
  [/lettuce|spinach|kale|greens|arugula|cilantro|parsley|basil|herb|chard|cabbage|bok choy|celery|scallion|green onion/, 'leafy'],
  [/bell pepper|peppers?\b(?!oni)|capsicum|jalape/, 'pepper'],
  [/cucumber|zucchini|courgette/, 'cucumber'],
  [/mushroom/, 'mushroom'],
  [/onion|shallot|garlic|leek/, 'onion'],
  [/\bpeas?\b|edamame|green bean|snap pea/, 'peas'],
  // Meat and fish
  [/chicken|drumstick|wings?\b|thighs?\b|poultry|rotisserie/, 'drumstick'],
  [/bacon/, 'bacon'],
  [/sausage|hot dog|bratwurst|chorizo|\bfranks?\b/, 'sausage'],
  [/deli|\bham\b|turkey|salami|prosciutto|bologna|pastrami/, 'deli'],
  [/shrimp|prawn|crab|lobster|scallop/, 'shrimp'],
  [/salmon|fillet|filet|cod\b|tilapia|trout|halibut/, 'fillet'],
  [/fish|tuna|mackerel|sardine/, 'fish'],
  [/steak|beef|pork|lamb|chops?\b|ribs?\b|veal/, 'steak'],
  // Plain drinks last (so "coconut water" etc. don't shadow anything above)
  [/water/, 'water'],
]

const FALLBACK: Record<FoodCategory, string> = {
  meat: 'steak',
  dairy: 'milk',
  produce: 'produceMix',
  takeout: 'pail',
  beverage: 'bottle',
  condiment: 'jar',
  other: 'container',
}

/** Which illustration to use: the item's name if we know it, else its category's generic shape. */
export function shapeFor(name: string, category: FoodCategory): string {
  const n = name.toLowerCase()
  return MATCH.find(([re]) => re.test(n))?.[1] ?? FALLBACK[category]
}

export function shapeSize(key: string, scale = 1) {
  const s = SHAPES[key] ?? SHAPES.container
  return { width: s.w * scale, height: s.h * scale }
}

/** One illustrated item. Pass a name to get the specific food; otherwise the category's shape. */
export function FoodShape({ name, category, scale = 1 }: { name?: string; category: FoodCategory; scale?: number }) {
  const s = SHAPES[name ? shapeFor(name, category) : FALLBACK[category]] ?? SHAPES.container
  return (
    <Svg width={s.w * scale} height={s.h * scale} viewBox={`-1 -1 ${s.w + 2} ${s.h + 2}`}>
      {s.art}
    </Svg>
  )
}

/** For the legend / tests: every shape key. */
export const SHAPE_KEYS = Object.keys(SHAPES)

/** The food's illustration fitted into a rounded square tile tinted by its category. */
export function FoodTile({ name, category, size = 40, tint }: { name: string; category: FoodCategory; size?: number; tint?: string }) {
  const s = SHAPES[shapeFor(name, category)] ?? SHAPES.container
  const scale = (size * 0.74) / Math.max(s.w, s.h)
  const { dark } = useTheme()
  return (
    <View
      accessibilityLabel={name}
      style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: tint ?? (dark ? CATEGORIES[category].tintDark : CATEGORIES[category].tint), alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={s.w * scale} height={s.h * scale} viewBox={`-1 -1 ${s.w + 2} ${s.h + 2}`}>{s.art}</Svg>
    </View>
  )
}
