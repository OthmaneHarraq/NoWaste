import { useState } from 'react'
import { Text, View, useWindowDimensions } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { LOCATIONS } from '../categories'
import { daysUntil } from '../freshness'
import type { FridgeItem } from '../types'
import { CARD_MIN_WIDTH, CARD_MIN_WIDTH_PHONE, ItemCard } from './ItemCard'

export type SortMode = 'shelf' | 'expiry'

const GAP = 12
const PAD = 18
const BORDER = 10 // 5px frame on each side

// Freezer palette: a cool blue that never means freshness (that's green/amber/red).
export const FROST = { bg: '#eaf3fa', line: '#cfe1ef', glass: '#bcd6ea', text: '#4a7aa0', icon: '#5b8fb9' }

const byExpiry = (a: FridgeItem, b: FridgeItem) =>
  (daysUntil(a.expires_at) ?? 9999) - (daysUntil(b.expires_at) ?? 9999) || a.name.localeCompare(b.name)

type Section = { title: string; items: FridgeItem[] }

/**
 * The inside of a bottom-freezer fridge: items stand on glass shelves in the fridge
 * compartment, and on frosted shelves in the freezer below the door seal. "By shelf"
 * groups by location; "By expiry" lines each compartment up, use-first on top.
 */
export function FridgeShelves({ items, sort, filtered }: { items: FridgeItem[]; sort: SortMode; filtered: boolean }) {
  const [width, setWidth] = useState(0)
  const { width: screen } = useWindowDimensions()
  const minCard = screen < 600 ? CARD_MIN_WIDTH_PHONE : CARD_MIN_WIDTH
  const pad = screen < 600 ? 12 : PAD
  const gap = screen < 600 ? 10 : GAP
  const perRow = Math.max(1, Math.floor((width - BORDER - pad * 2 + gap) / (minCard + gap)))
  // Stretch cards so each shelf row fills edge to edge (capped so few items don't balloon).
  const cardWidth = Math.min(220, Math.floor((width - BORDER - pad * 2 - gap * (perRow - 1)) / perRow))

  const fridgeItems = items.filter(i => i.location !== 'freezer')
  const freezerItems = items.filter(i => i.location === 'freezer').sort(byExpiry)

  const fridge: Section[] =
    sort === 'shelf'
      ? LOCATIONS.filter(l => l.id !== 'freezer')
          .map(l => ({ title: l.title, items: fridgeItems.filter(i => i.location === l.id).sort(byExpiry) }))
          .filter(s => !filtered || s.items.length > 0)
      : fridgeItems.length || !filtered ? [{ title: 'Use first  →', items: [...fridgeItems].sort(byExpiry) }] : []
  const showFreezer = !filtered || freezerItems.length > 0

  function renderSection(section: Section, frozen: boolean) {
    const rows: FridgeItem[][] = []
    for (let i = 0; i < section.items.length; i += perRow) rows.push(section.items.slice(i, i + perRow))
    if (rows.length === 0) rows.push([])
    return rows.map((row, r) => (
      <View key={`${section.title}-${r}`} style={{ paddingHorizontal: pad, paddingTop: r === 0 ? 14 : 18 }}>
        {r === 0 && !frozen && (
          <Text className="mb-2.5 text-[11px] font-bold uppercase tracking-[2px] text-mute">{section.title}</Text>
        )}
        <View className="flex-row items-end" style={{ gap, minHeight: row.length ? undefined : 64 }}>
          {row.map((item, i) => <ItemCard key={item.id} item={item} index={r * perRow + i} width={cardWidth} />)}
          {row.length === 0 && (
            <View className="flex-1 flex-row items-center justify-center gap-2 pb-3">
              <MaterialCommunityIcons name={frozen ? 'snowflake' : 'fridge-outline'} size={16} color={frozen ? FROST.glass : '#b7c6bf'} />
              <Text className="text-[13px]" style={{ color: frozen ? FROST.text : '#8a9a93' }}>
                {frozen ? 'Freezer’s empty. Use the ❄ on a card to freeze something.' : 'Nothing on this shelf'}
              </Text>
            </View>
          )}
        </View>
        <GlassShelf frozen={frozen} pad={pad} />
      </View>
    ))
  }

  return (
    <View
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      className="overflow-hidden rounded-[28px] border-[5px] border-[#e3ebe7] bg-frost"
      style={{ shadowColor: '#17251f', shadowOpacity: 0.06, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } }}
    >
      {/* Fridge light */}
      <View className="items-center pt-2">
        <View className="h-1.5 w-24 rounded-full bg-white" style={{ shadowColor: '#fff8d6', shadowOpacity: 1, shadowRadius: 14 }} />
      </View>

      {width > 0 && fridge.map(section => renderSection(section, false))}
      {width > 0 && fridge.length === 0 && !showFreezer && (
        <View className="items-center py-16">
          <Text className="text-mute">No items match this filter.</Text>
        </View>
      )}
      <View className="h-4" />

      {width > 0 && showFreezer && (
        <>
          {/* Door seal between compartments */}
          <View className="h-3 bg-[#e3ebe7]">
            <View className="mx-6 mt-1 h-1 rounded-full bg-[#d3ddd8]" />
          </View>
          <View style={{ backgroundColor: FROST.bg }}>
            <View className="flex-row items-center justify-between pt-3" style={{ paddingHorizontal: pad }}>
              <View className="flex-row items-center gap-1.5">
                <MaterialCommunityIcons name="snowflake" size={14} color={FROST.icon} />
                <Text className="text-[11px] font-bold uppercase tracking-[2px]" style={{ color: FROST.text }}>Freezer</Text>
              </View>
              <Text className="text-[11px]" style={{ color: FROST.text }}>
                {freezerItems.length ? `${freezerItems.length} item${freezerItems.length === 1 ? '' : 's'} · keeps for months` : 'keeps for months'}
              </Text>
            </View>
            <FrostEdge />
            {renderSection({ title: 'Freezer', items: freezerItems }, true)}
            <View className="h-4" />
          </View>
        </>
      )}
    </View>
  )
}

function GlassShelf({ frozen, pad }: { frozen: boolean; pad: number }) {
  return (
    <View style={{ marginHorizontal: -pad + 4, marginTop: 6 }}>
      <View className="h-[3px] rounded-t-sm bg-white" />
      <View className="h-2" style={{ backgroundColor: frozen ? FROST.glass : '#cfe2db', opacity: 0.85 }} />
      <View className="h-2.5 rounded-b-xl" style={{ backgroundColor: frozen ? FROST.line : '#e6efeb' }} />
    </View>
  )
}

/** A row of little frost crystals under the freezer label. */
function FrostEdge() {
  return (
    <View className="mt-1.5 flex-row justify-between overflow-hidden px-3" style={{ opacity: 0.55 }}>
      {Array.from({ length: 24 }, (_, i) => (
        <MaterialCommunityIcons key={i} name={i % 3 === 0 ? 'snowflake-variant' : 'circle-small'} size={i % 3 === 0 ? 10 : 8} color={FROST.glass} />
      ))}
    </View>
  )
}
