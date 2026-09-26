import { useEffect, useState, type ReactNode } from 'react'
import { Image, Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { CATEGORIES, LOCATIONS, displayName } from '../categories'
import { PENDING_GRACE_MINUTES } from '../config'
import { daysUntil, expiryLabel, freshnessOf, timeAgo } from '../freshness'
import { useFridge } from '../FridgeProvider'
import type { FridgeItem, FridgeLocation } from '../types'
import { FadeIn } from '@/ui/motion'
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
  backsplash: WEB ? 'bg-[linear-gradient(#d6dfd8_1px,transparent_1px),linear-gradient(90deg,#d6dfd8_1px,transparent_1px)] bg-[length:48px_48px] dark:bg-[linear-gradient(#1c2521_1px,transparent_1px),linear-gradient(90deg,#1c2521_1px,transparent_1px)]' : '',
  // Soft white enamel / brushed stainless body
  body: WEB ? 'bg-[linear-gradient(160deg,#ffffff_0%,#f1f5f3_38%,#dde5e1_100%)] dark:bg-[linear-gradient(160deg,#34403b_0%,#27302c_40%,#1c2320_100%)]' : '',
  brushed: WEB ? 'bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.22)_0px,rgba(255,255,255,0.22)_1px,transparent_1px,transparent_5px)]' : '',
  interior: WEB ? 'bg-[linear-gradient(180deg,#f7faf9_0%,#eef4f1_100%)] dark:bg-[linear-gradient(180deg,#1b2320_0%,#161d1a_100%)]' : '',
  // Same family as the interior, just tinted colder (the way dark mode already reads as one appliance).
  freezer: WEB ? 'bg-[linear-gradient(180deg,#f6fafb_0%,#e9f1f4_100%)] dark:bg-[linear-gradient(180deg,#182835_0%,#122029_100%)]' : '',
  mist: WEB ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.85)_0%,rgba(255,255,255,0)_100%)] dark:bg-[linear-gradient(180deg,rgba(170,205,235,0.18)_0%,rgba(170,205,235,0)_100%)]' : '',
  frostCorners: WEB ? 'bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.95)_0px,rgba(255,255,255,0)_70px),radial-gradient(circle_at_100%_0%,rgba(255,255,255,0.9)_0px,rgba(255,255,255,0)_60px),radial-gradient(circle_at_0%_100%,rgba(255,255,255,0.8)_0px,rgba(255,255,255,0)_55px),radial-gradient(circle_at_100%_100%,rgba(255,255,255,0.85)_0px,rgba(255,255,255,0)_65px)] dark:bg-[radial-gradient(circle_at_0%_0%,rgba(168,205,234,0.28)_0px,rgba(168,205,234,0)_70px),radial-gradient(circle_at_100%_0%,rgba(168,205,234,0.24)_0px,rgba(168,205,234,0)_60px),radial-gradient(circle_at_0%_100%,rgba(168,205,234,0.2)_0px,rgba(168,205,234,0)_55px),radial-gradient(circle_at_100%_100%,rgba(168,205,234,0.24)_0px,rgba(168,205,234,0)_65px)]' : '',
  door: WEB ? 'bg-[linear-gradient(150deg,#fbfdfc_0%,#eef3f1_55%,#e3eae6_100%)] dark:bg-[linear-gradient(150deg,#2a3430_0%,#222b27_55%,#1b2320_100%)]' : '',
  handle: WEB ? 'bg-[linear-gradient(90deg,#c9d2ce_0%,#f7faf9_45%,#d8e0dc_70%,#b8c3be_100%)] dark:bg-[linear-gradient(90deg,#4b5853_0%,#8a9a93_45%,#5b6a64_70%,#3c4843_100%)]' : '',
  floorShadow: WEB ? 'bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0)_70%)]' : '',
  // A classic scrollbar takes width from the right only, which pushed the centred appliance
  // left whenever the fridge scrolled. Reserve the gutter on both edges instead. (A class, not
  // a style prop: react-native-web drops style properties it doesn't know, like this one.)
  scrollGutter: WEB ? '[scrollbar-gutter:stable_both-edges]' : '',
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
  // quiet: the whole fridge is empty, so the big empty card speaks and the shelves stay blank
  const box = (loc: FridgeLocation) => ({ items: at(loc), plate, filtered, quiet: items.length === 0, onDetail: setDetail })
  const empty = items.length === 0

  return (
    <View className={`flex-1 overflow-hidden rounded-[28px] border border-line bg-frost ${CSS.backsplash}`} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <View className="flex-1" style={{ minHeight: 0 }}>
      <ScrollView
        className={`flex-1 ${CSS.scrollGutter}`}
        contentContainerStyle={{ paddingTop: 26, paddingBottom: 26, paddingHorizontal: 16 }}
        onScroll={() => setDetail(null)}
        scrollEventThrottle={64}
      >
        <View style={{ width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: 20 }}>
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
              <Freezer {...box('freezer')} />
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
                  <Shelf label={title('top_shelf')} art={['milk', 'cheese', 'yogurt']} {...box('top_shelf')} />
                  <Shelf label={title('middle_shelf')} art={['pizza', 'drumstick', 'bowl']} {...box('middle_shelf')} />
                  <Drawer {...box('drawer')} />
                </View>
                <Door wide={!stacked} {...box('door')} />
              </View>
            </View>
          </View>

          {/* Feet + the shadow the whole unit casts on the floor */}
          <View className="flex-row justify-between" style={{ paddingHorizontal: 52 }}>
            <View className="h-2.5 w-14 rounded-b-xl" style={{ backgroundColor: c.metal }} />
            <View className="h-2.5 w-14 rounded-b-xl" style={{ backgroundColor: c.metal }} />
          </View>
          <View pointerEvents="none" className={`mx-auto -mt-1 h-7 rounded-full ${CSS.floorShadow}`} style={{ width: '92%', backgroundColor: WEB ? undefined : '#00000014' }} />

        </View>
      </ScrollView>
      </View>

      {/* Legend: a footer inside the frame, always visible */}
      <View className="border-t border-line bg-surface px-4 py-3">
        <Legend />
      </View>

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

/* ---------- Item grid: layout, overflow and re-flow for every compartment ----------
 *
 * Every compartment (shelves, drawer, door, freezer) lays its items out through this one
 * component, so they all behave the same:
 *
 *   1. Items get explicit slots (row, col), filled left→right, top→bottom, most urgent first.
 *      Positions are absolute, so when an item leaves, the ones after it glide into its
 *      place (CSS transition on web) instead of leaving a hole — live, as data changes.
 *   2. Overflow, in this order:
 *        a. fit at full plate size within the compartment's row budget;
 *        b. else shrink one step (~80%, never below 44px, the smallest size where the
 *           food and its ring stay readable);
 *        c. else the last slot becomes a "+N" plate; tapping it expands just that
 *           compartment to show everything, with a "Less" slot to fold it back.
 *      Scrolling inside a compartment was ruled out (nested scroll inside the scrolling
 *      fridge, hidden items, fights the hover card), and so was wrapping without limit
 *      (a busy shelf would balloon and the fridge would stop looking like a fridge).
 *      Because items are sorted by expiry, what gets folded away is always the least urgent.
 */

const MIN_PLATE = 44
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

type Slot = { kind: 'item'; item: FridgeItem } | { kind: 'more'; n: number } | { kind: 'less' }

function ItemGrid({ items, plate, maxRows, minRows = 1, gap = 14, rowGap = 14, label, onDetail, rowDecor, empty }: {
  items: FridgeItem[]
  plate: number
  /** Rows the compartment shows before it compacts / folds. */
  maxRows: number
  /** Rows always drawn (the door always shows its three bins). */
  minRows?: number
  gap?: number
  rowGap?: number
  /** For accessibility labels: "Show 4 more on the Top shelf". */
  label: string
  onDetail: (d: Detail) => void
  /** Drawn behind each row (the door's bins). */
  rowDecor?: (row: number, top: number, size: number) => ReactNode
  /** Shown when there are no items. */
  empty: ReactNode
}) {
  const [width, setWidth] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const n = items.length
  const cols = (s: number) => Math.max(1, Math.floor((width + gap) / (s + gap)))
  const compact = Math.max(MIN_PLATE, Math.round(plate * 0.8))

  // Pick size and slots (see the rules above).
  let size = plate
  let perRow = cols(plate)
  let slots: Slot[] = items.map(item => ({ kind: 'item', item }))
  if (n > perRow * maxRows) {
    size = compact
    perRow = cols(compact)
    const cap = perRow * maxRows
    if (n > cap) {
      slots = expanded
        ? [...slots, { kind: 'less' }]
        : [...slots.slice(0, cap - 1), { kind: 'more', n: n - (cap - 1) }]
    }
  }
  const overflowing = n > perRow * maxRows
  useEffect(() => {
    if (!overflowing && expanded) setExpanded(false) // nothing left to fold away
  }, [overflowing, expanded])

  const rows = Math.max(minRows, Math.ceil(slots.length / perRow))
  const height = rows * size + (rows - 1) * rowGap
  const at = (i: number) => ({ left: (i % perRow) * (size + gap), top: Math.floor(i / perRow) * (size + rowGap) })
  const move = WEB ? ({ transition: `left 320ms ${EASE}, top 320ms ${EASE}` } as object) : null

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height: width ? height : plate, ...(WEB ? ({ transition: `height 320ms ${EASE}` } as object) : null) }}>
      {width > 0 && rowDecor && Array.from({ length: rows }, (_, r) => <View key={`decor-${r}`}>{rowDecor(r, r * (size + rowGap), size)}</View>)}
      {width > 0 && n === 0 && <View className="absolute left-0 right-0 top-0" style={{ height: size, justifyContent: 'flex-end' }}>{empty}</View>}
      {width > 0 && slots.map((s, i) => {
        const key = s.kind === 'item' ? s.item.id : s.kind
        return (
          <View key={key} className="absolute" style={{ ...at(i), width: size, height: size, ...move }}>
            {s.kind === 'item' ? (
              <FadeIn from={6}><Item item={s.item} plate={size} onDetail={onDetail} /></FadeIn>
            ) : (
              <FoldToggle size={size} more={s.kind === 'more' ? s.n : null} label={label} onPress={() => setExpanded(s.kind === 'more')} />
            )}
          </View>
        )
      })}
    </View>
  )
}

/** "+N" (expand) or "Less" (fold) — shaped like an item plate so it sits in the row naturally. */
function FoldToggle({ size, more, label, onPress }: { size: number; more: number | null; label: string; onPress: () => void }) {
  const { c } = useTheme()
  const [hover, setHover] = useState(false)
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      accessibilityRole="button"
      accessibilityLabel={more !== null ? `Show ${more} more on the ${label}` : `Show less on the ${label}`}
      className="items-center justify-center rounded-full"
      style={{
        width: size, height: size, borderWidth: 2, borderStyle: 'dashed',
        borderColor: hover ? c.textSoft : c.muted, backgroundColor: hover ? c.surface : c.frost,
        ...(WEB ? ({ cursor: 'pointer', transition: 'background-color 150ms' } as object) : null),
      }}
    >
      {more !== null ? (
        <>
          <Text className="font-display-bold leading-5 text-ink" style={{ fontSize: size > 50 ? 18 : 15 }}>+{more}</Text>
          <Text className="text-[9px] font-bold uppercase tracking-wide text-mute">more</Text>
        </>
      ) : (
        <>
          <MaterialCommunityIcons name="chevron-up" size={size > 50 ? 20 : 17} color={c.textSoft} />
          <Text className="text-[9px] font-bold uppercase tracking-wide text-mute">less</Text>
        </>
      )}
    </Pressable>
  )
}

type Compartment = { items: FridgeItem[]; plate: number; filtered: boolean; quiet?: boolean; onDetail: (d: Detail) => void }

function Shelf({ label, items, plate, filtered, quiet, onDetail, art }: Compartment & { label: string; art: string[] }) {
  const { c } = useTheme()
  return (
    <View className="px-5 pt-3">
      <Label right={items.length ? <Count n={items.length} /> : undefined}>{label}</Label>
      <View style={{ paddingHorizontal: 4, minHeight: 72, justifyContent: 'flex-end' }}>
        <ItemGrid items={items} plate={plate} maxRows={2} label={label} onDetail={onDetail}
          empty={quiet ? null : <EmptySpot art={art} text={filtered ? 'Nothing here matches' : 'Nothing here yet'} />} />
      </View>
      {/* Glass shelf: lit edge, tinted pane, soft shadow */}
      <View style={{ marginHorizontal: -16, marginTop: 10 }}>
        <View className="h-[2px] rounded-t" style={{ backgroundColor: c.surface, opacity: 0.9 }} />
        <View className="h-2" style={{ backgroundColor: c.glass, opacity: 0.85 }} />
        <View className="h-2 rounded-b-xl" style={{ backgroundColor: c.frost }} />
      </View>
    </View>
  )
}

function Drawer({ items, plate, filtered, quiet, onDetail }: Compartment) {
  const { c, dark } = useTheme()
  const label = title('drawer')
  return (
    <View className="px-3 pb-4 pt-3">
      <View className="px-2"><Label right={items.length ? <Count n={items.length} /> : undefined}>{label}</Label></View>
      <View className="overflow-hidden rounded-[22px] border" style={{ backgroundColor: dark ? '#1a2522' : '#e2eee9', borderColor: c.surface }}>
        {/* Bottom padding clears the frosted front (36 px), so the last row's rings stay fully visible */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40, minHeight: 104 }}>
          <ItemGrid items={items} plate={plate} maxRows={2} label={label} onDetail={onDetail}
            empty={quiet ? null : <EmptySpot art={['apple', 'carrot', 'broccoli']} text={filtered ? 'Nothing here matches' : 'Crisper’s empty'} />} />
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

/** The open door: its own raised panel with a gasket, three clear bins (one per row), and a handle. */
function Door({ items, plate, filtered, quiet, onDetail, wide }: Compartment & { wide: boolean }) {
  const { c, dark } = useTheme()
  const label = title('door')
  // One bin per row: a tray behind the items and a clear lip in front of their bottoms.
  const bin = (row: number, top: number, size: number) => (
    <>
      <View pointerEvents="none" className="absolute left-0 right-0 rounded-2xl" style={{ top: top - 8, height: size + 20, backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.35)' }} />
      <View pointerEvents="none" className="absolute rounded-b-2xl border" style={{ left: -4, right: -4, top: top + size - 12, height: 24, zIndex: 2, borderColor: c.surface, backgroundColor: dark ? 'rgba(47,63,56,0.6)' : 'rgba(214,230,223,0.6)' }} />
    </>
  )
  return (
    <View style={wide ? { width: 260 } : undefined}>
      <View
        className={`overflow-hidden rounded-[28px] border px-3.5 pb-6 pt-4 ${CSS.door}`}
        style={[{ backgroundColor: c.enamel, borderColor: c.enamelEdge, borderLeftWidth: 8, borderLeftColor: dark ? '#2b3632' : '#e4ebe8' }, shadow.card]}
      >
        <Sheen left="22%" opacity={0.3} />
        <Sheen left="40%" opacity={0.2} />
        <InnerShade />
        <View className="px-1"><Label right={items.length ? <Count n={items.length} /> : undefined}>{label}</Label></View>
        <View style={{ paddingHorizontal: 10, paddingTop: 10 }}>
          <ItemGrid items={items} plate={plate} maxRows={3} minRows={3} gap={10} rowGap={30} label={label} onDetail={onDetail} rowDecor={bin}
            empty={quiet ? null : <EmptySpot art={['water', 'juice']} text={filtered ? 'Nothing here matches' : 'Door’s empty'} compact />} />
        </View>
      </View>
      {/* The door's handle sits on its outer edge */}
      <Handle top={60} height={wide ? 180 : 110} />
    </View>
  )
}

function Freezer({ items, plate, filtered, quiet, onDetail }: Compartment) {
  const ICE = useIce()
  const { c, dark } = useTheme()
  return (
    <View className={`overflow-hidden rounded-[28px] border px-5 pb-5 pt-4 ${CSS.freezer}`} style={{ backgroundColor: dark ? ICE.bg : '#eef4f5', borderColor: dark ? ICE.line : c.border }}>
      {/* Cold: mist rolling off the top, frost gathering in the corners, condensation beads */}
      <View pointerEvents="none" className={`absolute left-0 right-0 top-0 h-16 ${CSS.mist}`} />
      <View pointerEvents="none" className={`absolute inset-0 ${CSS.frostCorners}`} />
      <Condensation />
      <InnerShade color={ICE.text} />

      <Label
        color={ICE.text}
        right={
          <View className="flex-row items-center gap-2">
            {items.length ? <Count n={items.length} /> : null}
            <View className="flex-row items-center gap-1.5 rounded-full px-2 py-0.5" style={{ backgroundColor: ICE.line }}>
              <MaterialCommunityIcons name="thermometer-low" size={12} color={ICE.icon} />
              <Text className="text-[10px] font-bold" style={{ color: ICE.text }}>−18 °C</Text>
            </View>
          </View>
        }
      >
        ❄  Freezer
      </Label>
      <View style={{ paddingHorizontal: 4, minHeight: 72, justifyContent: 'flex-end' }}>
        <ItemGrid items={items} plate={plate} maxRows={2} label={title('freezer')} onDetail={onDetail}
          empty={quiet ? null : <EmptySpot art={['ice cream', 'peas']} text={filtered ? 'Nothing here matches' : 'Freezer’s empty. Tap ❄ on a card to freeze something.'} color={ICE.text} />} />
      </View>
      {/* Wire rack */}
      <View style={{ marginHorizontal: -8, marginTop: 10, gap: 3 }}>
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
  const { c, dark } = useTheme()
  const hex = useFreshHex()
  const [hovered, setHovered] = useState(false)
  const freshness = freshnessOf(item, now)
  const urgent = item.status !== 'pending_removal' && (freshness === 'soon' || freshness === 'expired')
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
        opacity: pending ? 0.45 : 1,
        transform: [{ translateY: hovered ? -5 : 0 }, { scale: hovered ? 1.08 : 1 }],
        ...(WEB ? ({ transition: 'transform 160ms ease', cursor: 'pointer' } as object) : null),
      }}
    >
      {/* Soft glow behind things that need attention, so they stand out at a glance */}
      {urgent && (
        <View pointerEvents="none" className="absolute rounded-full" style={{ left: -5, top: -5, width: plate + 10, height: plate + 10, backgroundColor: hex(freshness), opacity: dark ? 0.22 : 0.18 }} />
      )}
      <FreshRing item={item} freshness={freshness} size={plate} stroke={plate > 56 ? 3.5 : 3} dashed={pending}>
        {/* The plate the food sits on */}
        <View
          className="items-center justify-center rounded-full"
          // Warm ceramic in light, slate in dark: sits apart from the interior without glaring
          style={{ width: plate - 12, height: plate - 12, backgroundColor: dark ? '#27302c' : '#f6f2ea', borderWidth: 1, borderColor: dark ? '#34403b' : '#ebe4d6', shadowColor: '#000000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }}
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
    <View className="flex-row flex-wrap items-center justify-center gap-x-5 gap-y-2">
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
