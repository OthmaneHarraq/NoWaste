import { useState } from 'react'
import { Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { SHELVES } from '../categories'
import { daysUntil } from '../freshness'
import type { FridgeItem } from '../types'
import { CARD_WIDTH, ItemCard } from './ItemCard'

export type SortMode = 'shelf' | 'expiry'

const GAP = 12
const PAD = 18

const byExpiry = (a: FridgeItem, b: FridgeItem) =>
  (daysUntil(a.expires_at) ?? 9999) - (daysUntil(b.expires_at) ?? 9999) || a.name.localeCompare(b.name)

/**
 * The inside of the fridge: items stand on glass shelves. "By shelf" puts each category
 * where it'd really live; "By expiry" lines everything up, use-first on the top shelf.
 */
export function FridgeShelves({ items, sort, filtered }: { items: FridgeItem[]; sort: SortMode; filtered: boolean }) {
  const [width, setWidth] = useState(0)
  const perRow = Math.max(1, Math.floor((width - PAD * 2 + GAP) / (CARD_WIDTH + GAP)))

  const shelves =
    sort === 'shelf'
      ? SHELVES.map(s => ({ title: s.title, items: items.filter(i => s.categories.includes(i.category)).sort(byExpiry) }))
          .filter(s => !filtered || s.items.length > 0)
      : [{ title: 'Use first', items: [...items].sort(byExpiry) }]

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

      {width > 0 && shelves.map((shelf, s) => {
        const rows: FridgeItem[][] = []
        for (let i = 0; i < shelf.items.length; i += perRow) rows.push(shelf.items.slice(i, i + perRow))
        if (rows.length === 0) rows.push([])
        return rows.map((row, r) => (
          <View key={`${shelf.title}-${r}`} style={{ paddingHorizontal: PAD, paddingTop: r === 0 ? 14 : 18 }}>
            {r === 0 && (
              <Text className="mb-2.5 text-[11px] font-bold uppercase tracking-[2px] text-mute">
                {shelf.title}
                {sort === 'expiry' && s === 0 ? '  →' : ''}
              </Text>
            )}
            <View className="flex-row items-end" style={{ gap: GAP, minHeight: row.length ? undefined : 64 }}>
              {row.map((item, i) => <ItemCard key={item.id} item={item} index={r * perRow + i} />)}
              {row.length === 0 && (
                <View className="flex-1 flex-row items-center justify-center gap-2 pb-3">
                  <MaterialCommunityIcons name="fridge-outline" size={16} color="#b7c6bf" />
                  <Text className="text-[13px] text-mute">Nothing on this shelf</Text>
                </View>
              )}
            </View>
            <GlassShelf />
          </View>
        ))
      })}

      {width > 0 && items.length === 0 && filtered && (
        <View className="items-center py-16">
          <Text className="text-mute">No items match this filter.</Text>
        </View>
      )}
      <View className="h-4" />
    </View>
  )
}

function GlassShelf() {
  return (
    <View style={{ marginHorizontal: -PAD + 4, marginTop: 6 }}>
      <View className="h-[3px] rounded-t-sm bg-white" />
      <View className="h-2 bg-glass" style={{ opacity: 0.85 }} />
      <View className="h-2.5 rounded-b-xl bg-[#e6efeb]" />
    </View>
  )
}
