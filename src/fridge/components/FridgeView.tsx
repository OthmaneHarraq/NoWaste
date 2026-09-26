import { useState, type ReactNode } from 'react'
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { CATEGORIES, LOCATIONS, displayName } from '../categories'
import { PENDING_GRACE_MINUTES } from '../config'
import { daysUntil, expiryLabel, freshnessOf } from '../freshness'
import { useFridge } from '../FridgeProvider'
import type { FridgeItem, FridgeLocation } from '../types'
import { shadow } from '@/ui/theme'
import { FoodShape } from './FoodShape'
import { FRESHNESS, ICE } from './visuals'

// The illustrated "Fridge" view (web): a top-freezer fridge drawn open. Every item is a
// small shape (category) coloured by freshness, using the SAME freshnessOf() and palette
// as the card view, so the two views can never disagree. Hover an item for details.

const title = (id: FridgeLocation) => LOCATIONS.find(l => l.id === id)!.title

const byExpiry = (a: FridgeItem, b: FridgeItem) =>
  (daysUntil(a.expires_at) ?? 9999) - (daysUntil(b.expires_at) ?? 9999) || a.name.localeCompare(b.name)

// Web-only: square kitchen tiles behind the fridge.
const BACKSPLASH = Platform.OS === 'web'
  ? 'bg-[linear-gradient(#e6ece9_1px,transparent_1px),linear-gradient(90deg,#e6ece9_1px,transparent_1px)] bg-[length:48px_48px]'
  : ''

type Hover = { item: FridgeItem; rect: { left: number; top: number; bottom: number; width: number } } | null

/** Stable small number per item, for natural-looking tilt and spacing. */
function jitter(id: string, range: number) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 2 * range
}

export function FridgeView({ items, filtered }: { items: FridgeItem[]; filtered: boolean }) {
  const { width: screen } = useWindowDimensions()
  const [hover, setHover] = useState<Hover>(null)
  const [width, setWidth] = useState(0)
  const stacked = width > 0 && width < 720 // door goes under the shelves on narrow screens
  const scale = width >= 1100 ? 1.3 : width >= 800 ? 1.15 : 1

  const at = (loc: FridgeLocation) => items.filter(i => i.location === loc).sort(byExpiry)
  const shape = (item: FridgeItem) => <Item key={item.id} item={item} scale={scale} onHover={setHover} />

  return (
    <View className={`flex-1 overflow-hidden rounded-[28px] border border-line bg-[#f4f7f5] ${BACKSPLASH}`} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {/* Kitchen floor under the fridge */}
      <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 h-16 border-t border-[#e2e9e5] bg-[#eef2ef]" />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: 22, paddingBottom: 20, paddingHorizontal: 12 }} onScroll={() => setHover(null)} scrollEventThrottle={64}>
        <View style={{ width: '100%', maxWidth: 1120, alignSelf: 'center', paddingRight: 30, paddingLeft: 4 }}>
          {/* Cabinet */}
          <View
            className="rounded-[34px] border border-enamel-edge bg-enamel p-3"
            style={shadow.raised}
          >
            {/* Freezer */}
            <View>
              <Freezer items={at('freezer')} filtered={filtered}>{at('freezer').map(shape)}</Freezer>
              <Handle top={28} height={64} />
            </View>

            {/* Door seal between freezer and fridge */}
            <View className="my-2.5 h-1 rounded-full bg-enamel-edge" style={{ marginHorizontal: 24 }} />

            {/* Fridge */}
            <View>
              <View style={{ flexDirection: stacked ? 'column' : 'row', gap: 12 }}>
                <View
                  className="flex-1 overflow-hidden rounded-[24px] border border-[#e3ebe7] bg-[#f3f7f5]"
                  style={{ minHeight: 360 }}
                >
                  <InnerShade />
                  {/* Interior light */}
                  <View className="items-center pt-2.5">
                    <View className="h-1.5 w-28 rounded-full bg-white" style={{ shadowColor: '#fff6cf', shadowOpacity: 1, shadowRadius: 18 }} />
                  </View>
                  <Shelf label={title('top_shelf')} items={at('top_shelf')}>{at('top_shelf').map(shape)}</Shelf>
                  <Shelf label={title('middle_shelf')} items={at('middle_shelf')}>{at('middle_shelf').map(shape)}</Shelf>
                  <Drawer label={title('drawer')} items={at('drawer')}>{at('drawer').map(shape)}</Drawer>
                </View>
                <Door items={at('door')} wide={!stacked} render={shape} />
              </View>
              <Handle top={40} height={stacked ? 120 : 200} />
            </View>
          </View>
          {/* Feet */}
          <View className="flex-row justify-between" style={{ paddingHorizontal: 46 }}>
            <View className="h-2 w-12 rounded-b-lg bg-[#cdd6d2]" />
            <View className="h-2 w-12 rounded-b-lg bg-[#cdd6d2]" />
          </View>
          <View className="mx-auto mt-1 h-3 rounded-full bg-[#17251f]" style={{ width: '80%', opacity: 0.05 }} />

          <ShapeKey />
        </View>
      </ScrollView>

      {hover && <Tooltip hover={hover} screenWidth={screen} />}
    </View>
  )
}

/* ---------- Compartments ---------- */

function Label({ children, color = '#8a9a93', right }: { children: string; color?: string; right?: ReactNode }) {
  return (
    <View className="mb-2 flex-row items-center justify-between">
      <Text className="text-[10px] font-bold uppercase tracking-[2px]" style={{ color }}>{children}</Text>
      {right}
    </View>
  )
}

function Empty({ text, color = '#a9b7b1' }: { text: string; color?: string }) {
  return <Text className="self-center pb-3 text-xs" style={{ color }}>{text}</Text>
}

const ROW = { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: 14, rowGap: 12, minHeight: 72 } as const

/** A soft band under a compartment's top edge, so it reads as recessed. */
function InnerShade({ color = '#17251f' }: { color?: string }) {
  return <View pointerEvents="none" className="absolute left-0 right-0 top-0 h-3" style={{ backgroundColor: color, opacity: 0.035 }} />
}

/** Diagonal sheen that makes a panel read as glass. */
function Sheen({ left = '12%' }: { left?: `${number}%` }) {
  return (
    <View pointerEvents="none" className="absolute" style={{ left, top: -40, width: 26, height: '160%', backgroundColor: '#ffffff', opacity: 0.35, transform: [{ rotate: '24deg' }] }} />
  )
}

function Shelf({ label, items, children }: { label: string; items: FridgeItem[]; children: ReactNode }) {
  return (
    <View className="px-5 pt-3">
      <Label>{label}</Label>
      <View style={[ROW, { paddingHorizontal: 4 }]}>{items.length ? children : <Empty text="Empty shelf" />}</View>
      {/* Glass shelf: highlight, tinted pane, soft shadow */}
      <View style={{ marginHorizontal: -16, marginTop: 4 }}>
        <View className="h-[2px] rounded-t bg-white" />
        <View className="h-2 bg-[#cfe2db]" style={{ opacity: 0.8 }} />
        <View className="h-2 rounded-b-xl bg-[#e4ede9]" />
      </View>
    </View>
  )
}

function Drawer({ label, items, children }: { label: string; items: FridgeItem[]; children: ReactNode }) {
  return (
    <View className="px-3 pb-3 pt-3">
      <View className="px-2"><Label>{label}</Label></View>
      <View className="overflow-hidden rounded-2xl border border-white bg-[#e2eee9]">
        <View style={[ROW, { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18, minHeight: 92 }]}>
          {items.length ? children : <Empty text="Empty drawer" />}
        </View>
        {/* Frosted glass front, overlapping the bottom of what's inside */}
        <View
          pointerEvents="none"
          className="absolute bottom-0 left-0 right-0 h-8 items-center overflow-hidden border-t border-white"
          style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
        >
          <View className="mt-2 h-1.5 w-16 rounded-full bg-[#c9d6d0]" />
          <Sheen left="70%" />
        </View>
      </View>
    </View>
  )
}

function Door({ items, wide, render }: { items: FridgeItem[]; wide: boolean; render: (i: FridgeItem) => ReactNode }) {
  // Split door items across bins, at least three so it reads as a door.
  const perBin = wide ? 4 : 8
  const bins: FridgeItem[][] = []
  for (let i = 0; i < items.length; i += perBin) bins.push(items.slice(i, i + perBin))
  while (bins.length < 3) bins.push([])

  return (
    <View
      className="overflow-hidden rounded-[24px] border border-[#e3ebe7] px-3 pb-3 pt-3.5"
      style={[{ backgroundColor: '#eaf2ee', borderLeftWidth: 6, borderLeftColor: '#dfe8e3' }, wide ? { width: 250 } : null]}
    >
      {/* Glass-look door liner */}
      <View pointerEvents="none" className="absolute inset-0" style={{ backgroundColor: 'rgba(255,255,255,0.35)' }} />
      <Sheen left="18%" />
      <Sheen left="34%" />
      <InnerShade />
      <View className="px-1"><Label>{title('door')}</Label></View>
      <View className="gap-3">
        {bins.map((bin, b) => (
          <View key={b} className="overflow-hidden rounded-xl">
            <View style={[ROW, { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 12, minHeight: 80, columnGap: 10 }]}>
              {bin.map(render)}
            </View>
            {/* Clear bin front */}
            <View
              pointerEvents="none"
              className="absolute bottom-0 left-0 right-0 h-6 rounded-b-xl border border-white"
              style={{ backgroundColor: 'rgba(214,230,223,0.55)' }}
            />
          </View>
        ))}
      </View>
    </View>
  )
}

function Freezer({ items, filtered, children }: { items: FridgeItem[]; filtered: boolean; children: ReactNode }) {
  return (
    <View className="overflow-hidden rounded-[24px] border px-5 pb-4 pt-3.5" style={{ backgroundColor: ICE.bg, borderColor: ICE.line }}>
      <InnerShade color={ICE.text} />
      <Label
        color={ICE.text}
        right={
          <View className="flex-row items-center gap-1">
            <MaterialCommunityIcons name="thermometer-low" size={12} color={ICE.icon} />
            <Text className="text-[10px] font-semibold" style={{ color: ICE.text }}>−18 °C · keeps for months</Text>
          </View>
        }
      >
        ❄  Freezer
      </Label>
      <View style={[ROW, { paddingHorizontal: 4, minHeight: 64 }]}>
        {items.length ? children : <Empty text={filtered ? 'Nothing here matches' : 'Freezer’s empty'} color={ICE.text} />}
      </View>
      {/* Wire rack */}
      <View style={{ marginHorizontal: -8, marginTop: 6, gap: 3 }}>
        <View className="h-[2px] rounded-full" style={{ backgroundColor: ICE.glass }} />
        <View className="h-[2px] rounded-full" style={{ backgroundColor: ICE.line }} />
      </View>
    </View>
  )
}

function Handle({ top, height }: { top: number; height: number }) {
  return (
    <View pointerEvents="none" className="absolute" style={{ right: -34, top, height, width: 22 }}>
      {/* Standoffs fixing the bar to the door, so it reads as a handle */}
      <View className="absolute left-0 h-2 w-3 rounded-sm bg-[#c3cdc8]" style={{ top: 10 }} />
      <View className="absolute left-0 h-2 w-3 rounded-sm bg-[#c3cdc8]" style={{ bottom: 10 }} />
      {/* The bar: brushed metal */}
      <View
        className="absolute bottom-0 top-0 w-3 rounded-full border border-[#bfcac5] bg-[#dfe6e2]"
        style={{ left: 10, shadowColor: '#17251f', shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 2, height: 3 } }}
      >
        <View className="ml-[2px] mt-2 w-[3px] flex-1 rounded-full bg-white" style={{ marginBottom: 8, opacity: 0.9 }} />
      </View>
    </View>
  )
}

/* ---------- Items ---------- */

function Item({ item, scale, onHover }: { item: FridgeItem; scale: number; onHover: (h: Hover) => void }) {
  const { now } = useFridge()
  const [hovered, setHovered] = useState(false)
  const freshness = freshnessOf(item, now)
  const pending = item.status === 'pending_removal'
  // Standing things (bottles, cartons, jars) barely tilt; loose things lean more.
  const tilt = jitter(item.id, ['beverage', 'dairy', 'condiment'].includes(item.category) ? 2 : 7)
  const f = FRESHNESS[freshness]
  const flagged = freshness === 'soon' || freshness === 'expired'

  function show(e: GestureResponderEvent | { currentTarget?: unknown; nativeEvent?: unknown }) {
    setHovered(true)
    // Web: anchor to the item's box; fall back to the event target, then the pointer.
    type El = { getBoundingClientRect?: () => DOMRect }
    const ev = e as { currentTarget?: El; nativeEvent?: { target?: El; clientX?: number; clientY?: number } }
    const r = ev.currentTarget?.getBoundingClientRect?.() ?? ev.nativeEvent?.target?.getBoundingClientRect?.()
    if (r) onHover({ item, rect: { left: r.left, top: r.top, bottom: r.bottom, width: r.width } })
    else if (ev.nativeEvent?.clientX != null) {
      const { clientX: x, clientY: y = 0 } = ev.nativeEvent
      onHover({ item, rect: { left: x - 20, top: y - 20, bottom: y + 20, width: 40 } })
    }
  }
  function hide() {
    setHovered(false)
    onHover(null)
  }

  return (
    <Pressable
      onHoverIn={show}
      onHoverOut={hide}
      onPress={e => (hovered ? hide() : show(e))}
      accessibilityLabel={`${displayName(item.name)}, ${expiryLabel(item, now)}`}
      style={{
        marginLeft: jitter(item.id + 'x', 3) + 3,
        opacity: pending ? 0.4 : 1,
        transform: [{ translateY: hovered ? -4 : 0 }, { rotate: `${tilt}deg` }, { scale: hovered ? 1.08 : 1 }],
        ...(Platform.OS === 'web' ? ({ transition: 'transform 160ms ease', cursor: 'pointer' } as object) : null),
      }}
    >
      {/* Freshness halo behind things that need attention */}
      {flagged && !pending && (
        <View pointerEvents="none" className="absolute rounded-full" style={{ left: -3, right: -3, top: -2, bottom: 4, backgroundColor: f.hex, opacity: 0.12 }} />
      )}
      {/* The food itself, in its own colours */}
      <FoodShape name={item.name} category={item.category} scale={scale} />
      {item.quantity > 1 && (
        <View className="absolute -right-2 -top-1.5 rounded-full border border-line bg-white px-1.5">
          <Text className="text-[10px] font-bold text-ink-soft">×{item.quantity}</Text>
        </View>
      )}
      {freshness === 'expired' && !pending && (
        <View className="absolute -left-2 -top-1.5 h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-spoiled-500">
          <Text className="text-[9px] font-extrabold text-white">!</Text>
        </View>
      )}
      {/* Freshness base: the same green / amber / red as the card view's bottom stripe */}
      <View
        className="mx-auto rounded-full"
        style={{ width: '82%', height: 5, marginTop: 3, backgroundColor: pending ? 'transparent' : f.hex, borderWidth: pending ? 1 : 0, borderStyle: 'dashed', borderColor: '#8a9a93' }}
      />
    </Pressable>
  )
}

function Tooltip({ hover, screenWidth }: { hover: NonNullable<Hover>; screenWidth: number }) {
  const { now } = useFridge()
  const { item, rect } = hover
  const freshness = freshnessOf(item, now)
  const f = FRESHNESS[freshness]
  const W = 224
  const left = Math.min(Math.max(8, rect.left + rect.width / 2 - W / 2), screenWidth - W - 8)
  const below = rect.top < 150
  const date = item.expires_at
    ? new Date(item.expires_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : 'No date'
  const minsLeft = item.status === 'pending_removal' && item.removed_at
    ? Math.max(0, Math.ceil(PENDING_GRACE_MINUTES - (now.getTime() - new Date(item.removed_at).getTime()) / 60_000))
    : null

  return (
    <View
      pointerEvents="none"
      className="rounded-2xl border border-line bg-white px-3.5 py-3"
      style={{
        position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as 'absolute',
        left,
        width: W,
        zIndex: 50,
        ...(below ? { top: rect.bottom + 10 } : { top: rect.top - 10, transform: [{ translateY: '-100%' as unknown as number }] }),
        shadowColor: '#17251f', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
      }}
    >
      <Text className="text-[15px] font-bold text-ink" numberOfLines={2}>{displayName(item.name)}</Text>
      <Text className="mt-0.5 text-xs text-mute">
        {CATEGORIES[item.category].label}
        {item.source ? ` · ${item.source}` : ''}
        {item.quantity > 1 ? ` · ×${item.quantity}` : ''}
      </Text>
      <View className="mt-2.5 flex-row items-center gap-2">
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: f.hex }} />
        <Text className={`text-[13px] font-semibold ${f.text}`}>{expiryLabel(item, now)}</Text>
      </View>
      <Text className="ml-4 mt-0.5 text-xs text-ink-soft">Expires {date}</Text>
      {minsLeft !== null && (
        <Text className="mt-2 text-xs font-medium text-ink-soft">Taken out · {minsLeft} min to decide</Text>
      )}
    </View>
  )
}

function ShapeKey() {
  return (
    <View className="mt-5 flex-row flex-wrap items-center justify-center gap-x-5 gap-y-2 px-2">
      <Text className="text-xs font-semibold text-ink-soft">The line under each item:</Text>
      <View className="flex-row items-center gap-3">
        {(['fresh', 'soon', 'expired'] as const).map(k => (
          <View key={k} className="flex-row items-center gap-1.5">
            <View style={{ width: 16, height: 5, borderRadius: 3, backgroundColor: FRESHNESS[k].hex }} />
            <Text className="text-xs text-ink-soft">{k === 'fresh' ? 'Fresh' : k === 'soon' ? 'Use within 2 days' : 'Past its date'}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
