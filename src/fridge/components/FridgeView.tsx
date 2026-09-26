import { useState, type ReactNode } from 'react'
import { Image, Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { CATEGORIES, LOCATIONS, displayName } from '../categories'
import { PENDING_GRACE_MINUTES } from '../config'
import { daysUntil, expiryLabel, freshnessOf, timeAgo } from '../freshness'
import { useFridge } from '../FridgeProvider'
import type { FridgeItem, FridgeLocation } from '../types'
import { shadow } from '@/ui/theme'
import { useTheme } from '@/ui/ThemeProvider'
import { FoodShape, FoodTile } from './FoodShape'
import { FreshRing } from './FreshRing'
import { FRESHNESS, useFreshHex, useIce } from './visuals'

// The illustrated "Fridge" view (web): a top-freezer fridge drawn open, standing in a kitchen.
// Each item is its food illustration on a small plate, ringed by a "battery" that empties as
// it nears its date. Ring colour and all thresholds come from freshnessOf(), the same as the
// card view, so the two views can never disagree. Hover (or tap) an item for its details.

const WEB = Platform.OS === 'web'
const title = (id: FridgeLocation) => LOCATIONS.find(l => l.id === id)!.title

const byExpiry = (a: FridgeItem, b: FridgeItem) =>
  (daysUntil(a.expires_at) ?? 9999) - (daysUntil(b.expires_at) ?? 9999) || a.name.localeCompare(b.name)

// Web-only CSS finishes (native gets the flat colours underneath).
const CSS = {
  backsplash: WEB ? 'bg-[linear-gradient(#e6ece9_1px,transparent_1px),linear-gradient(90deg,#e6ece9_1px,transparent_1px)] bg-[length:48px_48px] dark:bg-[linear-gradient(#1c2521_1px,transparent_1px),linear-gradient(90deg,#1c2521_1px,transparent_1px)]' : '',
  // Soft white enamel / brushed stainless body
  body: WEB ? 'bg-[linear-gradient(160deg,#ffffff_0%,#f1f5f3_38%,#dde5e1_100%)] dark:bg-[linear-gradient(160deg,#34403b_0%,#27302c_40%,#1c2320_100%)]' : '',
  brushed: WEB ? 'bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.22)_0px,rgba(255,255,255,0.22)_1px,transparent_1px,transparent_5px)]' : '',
  interior: WEB ? 'bg-[linear-gradient(180deg,#f7faf9_0%,#eef4f1_100%)] dark:bg-[linear-gradient(180deg,#1b2320_0%,#161d1a_100%)]' : '',
  freezer: WEB ? 'bg-[linear-gradient(180deg,#f4f9fd_0%,#e4f0f9_100%)] dark:bg-[linear-gradient(180deg,#182835_0%,#122029_100%)]' : '',
  mist: WEB ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.85)_0%,rgba(255,255,255,0)_100%)] dark:bg-[linear-gradient(180deg,rgba(170,205,235,0.18)_0%,rgba(170,205,235,0)_100%)]' : '',
  frostCorners: WEB ? 'bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.95)_0px,rgba(255,255,255,0)_70px),radial-gradient(circle_at_100%_0%,rgba(255,255,255,0.9)_0px,rgba(255,255,255,0)_60px),radial-gradient(circle_at_0%_100%,rgba(255,255,255,0.8)_0px,rgba(255,255,255,0)_55px),radial-gradient(circle_at_100%_100%,rgba(255,255,255,0.85)_0px,rgba(255,255,255,0)_65px)] dark:bg-[radial-gradient(circle_at_0%_0%,rgba(168,205,234,0.28)_0px,rgba(168,205,234,0)_70px),radial-gradient(circle_at_100%_0%,rgba(168,205,234,0.24)_0px,rgba(168,205,234,0)_60px),radial-gradient(circle_at_0%_100%,rgba(168,205,234,0.2)_0px,rgba(168,205,234,0)_55px),radial-gradient(circle_at_100%_100%,rgba(168,205,234,0.24)_0px,rgba(168,205,234,0)_65px)]' : '',
  door: WEB ? 'bg-[linear-gradient(150deg,#fbfdfc_0%,#eef3f1_55%,#e3eae6_100%)] dark:bg-[linear-gradient(150deg,#2a3430_0%,#222b27_55%,#1b2320_100%)]' : '',
  handle: WEB ? 'bg-[linear-gradient(90deg,#c9d2ce_0%,#f7faf9_45%,#d8e0dc_70%,#b8c3be_100%)] dark:bg-[linear-gradient(90deg,#4b5853_0%,#8a9a93_45%,#5b6a64_70%,#3c4843_100%)]' : '',
  floorShadow: WEB ? 'bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0)_70%)]' : '',
}

type Detail = { item: FridgeItem; rect: { left: number; top: number; bottom: number; width: number } } | null

/** Stable small number per item, for natural-looking tilt and spacing. */
function jitter(id: string, range: number) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 2 * range
}

export function FridgeView({ items, filtered }: { items: FridgeItem[]; filtered: boolean }) {
  const { width: screen } = useWindowDimensions()
  const { c, dark } = useTheme()
  const [detail, setDetail] = useState<Detail>(null)
  const [width, setWidth] = useState(0)
  const stacked = width > 0 && width < 720 // door goes under the shelves on narrow screens
  const plate = width >= 1000 ? 62 : width >= 720 ? 56 : 50

  const at = (loc: FridgeLocation) => items.filter(i => i.location === loc).sort(byExpiry)
  const place = (item: FridgeItem) => <Item key={item.id} item={item} plate={plate} onDetail={setDetail} />
  const empty = items.length === 0

  return (
    <View className={`flex-1 overflow-hidden rounded-[28px] border border-line bg-frost ${CSS.backsplash}`} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {/* Kitchen floor */}
      <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 h-20 border-t border-line bg-paper" />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: 26, paddingBottom: 26, paddingHorizontal: 16 }} onScroll={() => setDetail(null)} scrollEventThrottle={64}>
        <View style={{ width: '100%', maxWidth: 1080, alignSelf: 'center', paddingRight: 34, paddingLeft: 6 }}>
          {/* ===== Appliance body ===== */}
          <View
            className={`rounded-[40px] border border-enamel-edge bg-enamel ${CSS.body}`}
            style={[shadow.raised, { padding: 14, shadowOpacity: 0.18, shadowRadius: 30, shadowOffset: { width: 0, height: 20 } }]}
          >
            {/* Brushed finish + a highlight along the top edge */}
            <View pointerEvents="none" className={`absolute inset-0 rounded-[40px] ${CSS.brushed}`} style={{ opacity: dark ? 0.12 : 0.5 }} />
            <View pointerEvents="none" className="absolute left-10 right-10 top-[3px] h-[2px] rounded-full bg-surface" style={{ opacity: 0.9 }} />

            {/* Freezer compartment */}
            <View>
              <Freezer items={at('freezer')} filtered={filtered}>{at('freezer').map(place)}</Freezer>
              <Handle top={26} height={70} />
            </View>

            {/* Seam: the gap between the freezer door and the fridge door */}
            <Seam />

            {/* Fridge body */}
            <View>
              <View style={{ flexDirection: stacked ? 'column' : 'row', gap: 14 }}>
                <View className={`flex-1 overflow-hidden rounded-[28px] border border-line bg-frost ${CSS.interior}`} style={{ minHeight: 380 }}>
                  <InnerShade />
                  {/* Interior light */}
                  <View className="items-center pt-2.5">
                    <View className="h-1.5 w-32 rounded-full bg-surface" style={{ shadowColor: '#fff4c2', shadowOpacity: 1, shadowRadius: 20 }} />
                  </View>
                  <Shelf label={title('top_shelf')} items={at('top_shelf')} filtered={filtered} art={['milk', 'cheese', 'yogurt']}>{at('top_shelf').map(place)}</Shelf>
                  <Shelf label={title('middle_shelf')} items={at('middle_shelf')} filtered={filtered} art={['pizza', 'drumstick', 'bowl']}>{at('middle_shelf').map(place)}</Shelf>
                  <Drawer label={title('drawer')} items={at('drawer')} filtered={filtered}>{at('drawer').map(place)}</Drawer>
                </View>
                <Door items={at('door')} wide={!stacked} filtered={filtered} render={place} />
              </View>
            </View>
          </View>

          {/* Feet + the shadow the whole unit casts on the floor */}
          <View className="flex-row justify-between" style={{ paddingHorizontal: 52 }}>
            <View className="h-2.5 w-14 rounded-b-xl" style={{ backgroundColor: c.metal }} />
            <View className="h-2.5 w-14 rounded-b-xl" style={{ backgroundColor: c.metal }} />
          </View>
          <View pointerEvents="none" className={`mx-auto -mt-1 h-7 rounded-full ${CSS.floorShadow}`} style={{ width: '92%', backgroundColor: WEB ? undefined : '#00000014' }} />

          <Legend />
        </View>
      </ScrollView>

      {empty && <WholeFridgeEmpty filtered={filtered} />}
      {detail && <DetailCard detail={detail} screenWidth={screen} />}
    </View>
  )
}

/* ---------------- Body parts ---------------- */

function Seam() {
  const { c } = useTheme()
  return (
    <View className="my-3" style={{ marginHorizontal: -14 }}>
      {/* A dark groove with a lit lip underneath, full width like a real door gap */}
      <View style={{ height: 3, backgroundColor: c.enamelEdge }} />
      <View style={{ height: 2, backgroundColor: '#000000', opacity: 0.12 }} />
      <View style={{ height: 1, backgroundColor: c.surface, opacity: 0.8 }} />
      {/* Hinge caps on the left edge */}
      <View className="absolute rounded-full" style={{ left: 8, top: -5, width: 7, height: 16, backgroundColor: c.metal }} />
    </View>
  )
}

/** A rounded vertical bar with standoffs, highlight and shadow: a real handle. */
function Handle({ top, height }: { top: number; height: number }) {
  const { c } = useTheme()
  return (
    <View pointerEvents="none" className="absolute" style={{ right: -40, top, height, width: 28 }}>
      <View className="absolute left-0 h-2.5 w-4 rounded-sm" style={{ top: 12, backgroundColor: c.metal }} />
      <View className="absolute left-0 h-2.5 w-4 rounded-sm" style={{ bottom: 12, backgroundColor: c.metal }} />
      <View
        className={`absolute bottom-0 top-0 w-[14px] rounded-full ${CSS.handle}`}
        style={{ left: 12, backgroundColor: c.metal, shadowColor: '#000000', shadowOpacity: 0.28, shadowRadius: 6, shadowOffset: { width: 3, height: 4 } }}
      >
        <View className="ml-[3px] mt-3 w-[3px] flex-1 rounded-full" style={{ marginBottom: 10, backgroundColor: c.metalHi, opacity: 0.85 }} />
      </View>
    </View>
  )
}

/** A soft band under a compartment's top edge, so it reads as recessed. */
function InnerShade({ color = '#000000' }: { color?: string }) {
  return <View pointerEvents="none" className="absolute left-0 right-0 top-0 h-4" style={{ backgroundColor: color, opacity: 0.045 }} />
}

/** Diagonal sheen that makes a panel read as glass. */
function Sheen({ left = '12%', opacity = 0.35 }: { left?: `${number}%`; opacity?: number }) {
  const { dark } = useTheme()
  return (
    <View pointerEvents="none" className="absolute" style={{ left, top: -40, width: 26, height: '160%', backgroundColor: '#ffffff', opacity: dark ? opacity * 0.25 : opacity, transform: [{ rotate: '24deg' }] }} />
  )
}

function Label({ children, color, right }: { children: string; color?: string; right?: ReactNode }) {
  const { c } = useTheme()
  return (
    <View className="mb-2.5 flex-row items-center justify-between">
      <Text className="text-[10px] font-bold uppercase tracking-[2px]" style={{ color: color ?? c.muted }}>{children}</Text>
      {right}
    </View>
  )
}

const ROW = { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: 14, rowGap: 14 } as const

function Shelf({ label, items, filtered, art, children }: { label: string; items: FridgeItem[]; filtered: boolean; art: string[]; children: ReactNode }) {
  const { c } = useTheme()
  return (
    <View className="px-5 pt-3">
      <Label right={items.length ? <Count n={items.length} /> : undefined}>{label}</Label>
      <View style={[ROW, { paddingHorizontal: 4, minHeight: 80 }]}>
        {items.length ? children : <EmptySpot art={art} text={filtered ? 'Nothing here matches' : 'Nothing here yet'} />}
      </View>
      {/* Glass shelf: lit edge, tinted pane, soft shadow */}
      <View style={{ marginHorizontal: -16, marginTop: 6 }}>
        <View className="h-[2px] rounded-t" style={{ backgroundColor: c.surface, opacity: 0.9 }} />
        <View className="h-2" style={{ backgroundColor: c.glass, opacity: 0.85 }} />
        <View className="h-2 rounded-b-xl" style={{ backgroundColor: c.frost }} />
      </View>
    </View>
  )
}

function Drawer({ label, items, filtered, children }: { label: string; items: FridgeItem[]; filtered: boolean; children: ReactNode }) {
  const { c, dark } = useTheme()
  return (
    <View className="px-3 pb-4 pt-3">
      <View className="px-2"><Label right={items.length ? <Count n={items.length} /> : undefined}>{label}</Label></View>
      <View className="overflow-hidden rounded-[22px] border" style={{ backgroundColor: dark ? '#1a2522' : '#e2eee9', borderColor: c.surface }}>
        <View style={[ROW, { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 26, minHeight: 104 }]}>
          {items.length ? children : <EmptySpot art={['apple', 'carrot', 'broccoli']} text={filtered ? 'Nothing here matches' : 'Crisper’s empty'} />}
        </View>
        {/* Frosted glass front, overlapping the bottom of what's inside */}
        <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 h-9 items-center overflow-hidden border-t" style={{ borderColor: c.surface, backgroundColor: dark ? 'rgba(40,52,47,0.72)' : 'rgba(255,255,255,0.55)' }}>
          <View className="mt-2.5 h-1.5 w-20 rounded-full" style={{ backgroundColor: c.metal }} />
          <Sheen left="70%" />
        </View>
      </View>
    </View>
  )
}

/** The open door: its own raised panel with a gasket, clear bins, and a handle on its edge. */
function Door({ items, wide, filtered, render }: { items: FridgeItem[]; wide: boolean; filtered: boolean; render: (i: FridgeItem) => ReactNode }) {
  const { c, dark } = useTheme()
  const perBin = wide ? 3 : 6
  const bins: FridgeItem[][] = []
  for (let i = 0; i < items.length; i += perBin) bins.push(items.slice(i, i + perBin))
  while (bins.length < 3) bins.push([])

  return (
    <View style={wide ? { width: 260 } : undefined}>
      <View
        className={`overflow-hidden rounded-[28px] border px-3.5 pb-4 pt-4 ${CSS.door}`}
        style={[{ backgroundColor: c.enamel, borderColor: c.enamelEdge, borderLeftWidth: 8, borderLeftColor: dark ? '#2b3632' : '#e4ebe8' }, shadow.card]}
      >
        <Sheen left="22%" opacity={0.3} />
        <Sheen left="40%" opacity={0.2} />
        <InnerShade />
        <View className="px-1"><Label right={items.length ? <Count n={items.length} /> : undefined}>{title('door')}</Label></View>
        <View className="gap-3.5">
          {bins.map((bin, b) => (
            <View key={b} className="overflow-hidden rounded-2xl">
              <View style={[ROW, { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 16, minHeight: 88, columnGap: 10 }]}>
                {bin.length ? bin.map(render) : b === 0 && items.length === 0 ? <EmptySpot art={['water', 'juice']} text={filtered ? 'No match' : 'Door’s empty'} compact /> : null}
              </View>
              {/* Clear bin front */}
              <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 h-7 rounded-b-2xl border" style={{ borderColor: c.surface, backgroundColor: dark ? 'rgba(47,63,56,0.6)' : 'rgba(214,230,223,0.6)' }} />
            </View>
          ))}
        </View>
      </View>
      {/* The door's handle sits on its outer edge */}
      <Handle top={60} height={wide ? 180 : 110} />
    </View>
  )
}

function Freezer({ items, filtered, children }: { items: FridgeItem[]; filtered: boolean; children: ReactNode }) {
  const ICE = useIce()
  return (
    <View className={`overflow-hidden rounded-[28px] border px-5 pb-5 pt-4 ${CSS.freezer}`} style={{ backgroundColor: ICE.bg, borderColor: ICE.line }}>
      {/* Cold: mist rolling off the top, frost gathering in the corners, condensation beads */}
      <View pointerEvents="none" className={`absolute left-0 right-0 top-0 h-16 ${CSS.mist}`} />
      <View pointerEvents="none" className={`absolute inset-0 ${CSS.frostCorners}`} />
      <Condensation />
      <InnerShade color={ICE.text} />

      <Label
        color={ICE.text}
        right={
          <View className="flex-row items-center gap-1.5 rounded-full px-2 py-0.5" style={{ backgroundColor: ICE.line }}>
            <MaterialCommunityIcons name="thermometer-low" size={12} color={ICE.icon} />
            <Text className="text-[10px] font-bold" style={{ color: ICE.text }}>−18 °C</Text>
          </View>
        }
      >
        ❄  Freezer
      </Label>
      <View style={[ROW, { paddingHorizontal: 4, minHeight: 80 }]}>
        {items.length ? children : <EmptySpot art={['ice cream', 'peas']} text={filtered ? 'Nothing here matches' : 'Freezer’s empty. Tap ❄ on a card to freeze something.'} color={ICE.text} />}
      </View>
      {/* Wire rack */}
      <View style={{ marginHorizontal: -8, marginTop: 8, gap: 3 }}>
        <View className="h-[2px] rounded-full" style={{ backgroundColor: ICE.glass }} />
        <View className="h-[2px] rounded-full" style={{ backgroundColor: ICE.line }} />
      </View>
    </View>
  )
}

/** Tiny beads along the freezer's edges, like condensation on a cold wall. */
function Condensation() {
  const ICE = useIce()
  const beads = Array.from({ length: 18 }, (_, i) => ({
    left: `${(i * 37) % 96 + 2}%` as `${number}%`,
    top: i % 2 ? 4 + ((i * 7) % 8) : undefined,
    bottom: i % 2 ? undefined : 4 + ((i * 5) % 10),
    size: 2 + (i % 3),
  }))
  return (
    <>
      {beads.map((b, i) => (
        <View key={i} pointerEvents="none" className="absolute rounded-full" style={{ left: b.left, top: b.top, bottom: b.bottom, width: b.size, height: b.size, backgroundColor: ICE.glass, opacity: 0.7 }} />
      ))}
      {[{ left: 10, top: 8, r: '-12deg' }, { right: 14, top: 10, r: '18deg' }, { right: 22, bottom: 14, r: '-8deg' }].map((p, i) => (
        <MaterialCommunityIcons key={i} name="snowflake-variant" size={i === 1 ? 16 : 12} color={ICE.glass} style={{ position: 'absolute', ...p, opacity: 0.8, transform: [{ rotate: p.r }] }} />
      ))}
    </>
  )
}

function Count({ n }: { n: number }) {
  return (
    <View className="rounded-full bg-surface px-1.5 py-px" style={{ opacity: 0.9 }}>
      <Text className="text-[10px] font-bold text-ink-soft">{n}</Text>
    </View>
  )
}

/* ---------------- Empty states ---------------- */

/** Faint "ghost" foods where things would sit, plus a friendly line. */
export function EmptySpot({ art, text, color, compact }: { art: string[]; text: string; color?: string; compact?: boolean }) {
  const { c } = useTheme()
  return (
    <View className={`flex-1 flex-row items-end ${compact ? 'gap-2' : 'gap-3'} pb-1`}>
      <View className="flex-row items-end gap-1.5" style={{ opacity: 0.22 }}>
        {art.slice(0, compact ? 2 : 3).map(name => <FoodShape key={name} name={name} category="other" scale={compact ? 0.55 : 0.7} />)}
      </View>
      <Text className="mb-1 flex-1 text-[12px] font-medium" style={{ color: color ?? c.muted }} numberOfLines={2}>{text}</Text>
    </View>
  )
}

export function WholeFridgeEmpty({ filtered }: { filtered: boolean }) {
  return (
    <View pointerEvents="none" className="absolute inset-0 items-center justify-center p-6">
      <View className="items-center rounded-[28px] border border-line bg-surface px-8 py-7" style={[shadow.raised, { maxWidth: 380 }]}>
        <View className="flex-row items-end gap-2">
          <FoodShape name="apple" category="produce" scale={1} />
          <FoodShape name="milk" category="dairy" scale={0.85} />
          <FoodShape name="broccoli" category="produce" scale={1} />
        </View>
        <Text className="mt-4 text-center font-display text-[22px] text-ink">{filtered ? 'Nothing matches' : 'Your fridge is empty'}</Text>
        <Text className="mt-1.5 text-center text-[13px] leading-5 text-ink-soft">
          {filtered ? 'Try another category, or show everything.' : 'Add something by hand above, or open the fridge and let the camera see what goes in.'}
        </Text>
      </View>
    </View>
  )
}

/* ---------------- Items ---------------- */

function Item({ item, plate, onDetail }: { item: FridgeItem; plate: number; onDetail: (d: Detail) => void }) {
  const { now } = useFridge()
  const { c } = useTheme()
  const [hovered, setHovered] = useState(false)
  const freshness = freshnessOf(item, now)
  const pending = item.status === 'pending_removal'
  const tilt = jitter(item.id, 5)

  function show(e: GestureResponderEvent | { currentTarget?: unknown; nativeEvent?: unknown }) {
    setHovered(true)
    type El = { getBoundingClientRect?: () => DOMRect }
    const ev = e as { currentTarget?: El; nativeEvent?: { target?: El; clientX?: number; clientY?: number } }
    const r = ev.currentTarget?.getBoundingClientRect?.() ?? ev.nativeEvent?.target?.getBoundingClientRect?.()
    if (r) onDetail({ item, rect: { left: r.left, top: r.top, bottom: r.bottom, width: r.width } })
    else if (ev.nativeEvent?.clientX != null) {
      const { clientX: x, clientY: y = 0 } = ev.nativeEvent
      onDetail({ item, rect: { left: x - 20, top: y - 20, bottom: y + 20, width: 40 } })
    }
  }
  function hide() {
    setHovered(false)
    onDetail(null)
  }

  return (
    <Pressable
      onHoverIn={show}
      onHoverOut={hide}
      onPress={e => (hovered ? hide() : show(e))}
      accessibilityLabel={`${displayName(item.name)}, ${expiryLabel(item, now)}`}
      style={{
        marginLeft: jitter(item.id + 'x', 3) + 2,
        opacity: pending ? 0.45 : 1,
        transform: [{ translateY: hovered ? -5 : 0 }, { scale: hovered ? 1.08 : 1 }],
        ...(WEB ? ({ transition: 'transform 160ms ease', cursor: 'pointer' } as object) : null),
      }}
    >
      <FreshRing item={item} freshness={freshness} size={plate} stroke={plate > 56 ? 3.5 : 3} dashed={pending}>
        {/* The plate the food sits on */}
        <View
          className="items-center justify-center rounded-full bg-surface"
          style={{ width: plate - 12, height: plate - 12, shadowColor: '#000000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }}
        >
          <View style={{ transform: [{ rotate: `${tilt}deg` }] }}>
            <FoodTile name={item.name} category={item.category} size={plate - 14} tint="transparent" />
          </View>
        </View>
      </FreshRing>
      {item.quantity > 1 && (
        <View className="absolute -right-1.5 -top-1 rounded-full border border-line bg-surface px-1.5">
          <Text className="text-[10px] font-bold text-ink-soft">×{item.quantity}</Text>
        </View>
      )}
      {freshness === 'expired' && !pending && (
        <View className="absolute -left-1 -top-1 h-[18px] w-[18px] items-center justify-center rounded-full border-2 bg-spoiled-500" style={{ borderColor: c.surface }}>
          <Text className="text-[10px] font-extrabold text-white">!</Text>
        </View>
      )}
      {pending && (
        <View className="absolute -left-1 -top-1 h-[18px] w-[18px] items-center justify-center rounded-full border-2 bg-ink-soft" style={{ borderColor: c.surface }}>
          <MaterialCommunityIcons name="arrow-up" size={10} color={c.surface} />
        </View>
      )}
    </Pressable>
  )
}

/** The expanded item card on hover / tap. */
function DetailCard({ detail, screenWidth }: { detail: NonNullable<Detail>; screenWidth: number }) {
  const { now } = useFridge()
  const { c } = useTheme()
  const hex = useFreshHex()
  const { item, rect } = detail
  const freshness = freshnessOf(item, now)
  const f = FRESHNESS[freshness]
  const days = daysUntil(item.expires_at, now)
  const W = 292
  const left = Math.min(Math.max(8, rect.left + rect.width / 2 - W / 2), screenWidth - W - 8)
  const below = rect.top < 280
  const date = item.expires_at ? new Date(item.expires_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'No date'
  const minsLeft = item.status === 'pending_removal' && item.removed_at
    ? Math.max(0, Math.ceil(PENDING_GRACE_MINUTES - (now.getTime() - new Date(item.removed_at).getTime()) / 60_000))
    : null
  const where = LOCATIONS.find(l => l.id === item.location)?.title ?? 'Fridge'

  return (
    <View
      pointerEvents="none"
      className="overflow-hidden rounded-3xl border border-line bg-surface"
      style={{
        position: (WEB ? 'fixed' : 'absolute') as 'absolute',
        left,
        width: W,
        zIndex: 50,
        ...(below ? { top: rect.bottom + 10 } : { top: rect.top - 10, transform: [{ translateY: '-100%' as unknown as number }] }),
        shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 10 },
      }}
    >
      {/* Freshness band across the top */}
      <View style={{ height: 4, backgroundColor: hex(freshness) }} />

      {/* Camera thumbnail, only when the detection kept one (none do yet: frames aren't stored) */}
      {item.image_url ? <Image source={{ uri: item.image_url }} style={{ width: '100%', height: 120 }} resizeMode="cover" accessibilityLabel="What the camera saw" /> : null}

      <View className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <FoodTile name={item.name} category={item.category} size={52} />
          <View className="flex-1">
            <Text className="font-display text-[19px] leading-6 text-ink" numberOfLines={2}>{displayName(item.name)}</Text>
            <Text className="text-[12px] text-mute" numberOfLines={1}>
              {item.source ? (item.category === 'takeout' ? `from ${item.source}` : item.source) : CATEGORIES[item.category].label}
              {item.quantity > 1 ? ` · ×${item.quantity}` : ''}
            </Text>
          </View>
          {/* Mini ring with the number of days inside */}
          <FreshRing item={item} freshness={freshness} size={50} stroke={4} dashed={item.status === 'pending_removal'}>
            <Text className="text-[15px] font-extrabold leading-4" style={{ color: hex(freshness) }}>
              {days === null ? '–' : days < 0 ? '!' : days}
            </Text>
            {days !== null && days >= 0 && <Text className="text-[8px] font-bold uppercase text-mute">{days === 1 ? 'day' : 'days'}</Text>}
          </FreshRing>
        </View>

        <View className={`flex-row items-center gap-2 self-start rounded-full border px-2.5 py-1 ${f.chip}`}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: hex(freshness) }} />
          <Text className={`text-[12px] font-bold ${f.text}`}>{expiryLabel(item, now)}</Text>
        </View>

        <View className="gap-1.5">
          <Fact icon="calendar-blank-outline" text={`Expires ${date}`} color={c.muted} />
          <Fact icon="clock-plus-outline" text={`Added ${timeAgo(item.added_at, now.getTime())}`} color={c.muted} />
          <Fact icon={item.location === 'freezer' ? 'snowflake' : 'fridge-outline'} text={where} color={c.muted} />
          {minsLeft !== null && <Fact icon="timer-sand" text={`Taken out · ${minsLeft} min to decide`} color={c.muted} />}
        </View>
      </View>
    </View>
  )
}

function Fact({ icon, text, color }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string; color: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <MaterialCommunityIcons name={icon} size={14} color={color} />
      <Text className="text-[13px] text-ink-soft">{text}</Text>
    </View>
  )
}

function Legend() {
  const hex = useFreshHex()
  const { c } = useTheme()
  const sample = { added_at: new Date(Date.now() - 6 * 86_400_000).toISOString(), expires_at: new Date(Date.now() + 4 * 86_400_000).toISOString() }
  return (
    <View className="mt-4 flex-row flex-wrap items-center justify-center gap-x-5 gap-y-2 px-2">
      <View className="flex-row items-center gap-2">
        <FreshRing item={sample} freshness="fresh" size={22} stroke={3} />
        <Text className="text-xs text-ink-soft">The ring empties as the date nears</Text>
      </View>
      {(['fresh', 'soon', 'expired'] as const).map(k => (
        <View key={k} className="flex-row items-center gap-1.5">
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: hex(k) }} />
          <Text className="text-xs text-ink-soft">{k === 'fresh' ? 'Fresh' : k === 'soon' ? 'Use within 2 days' : 'Past its date'}</Text>
        </View>
      ))}
      <View className="flex-row items-center gap-1.5">
        <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.muted }} />
        <Text className="text-xs text-ink-soft">Taken out</Text>
      </View>
    </View>
  )
}
