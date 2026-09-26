import { useState } from 'react'
import { Modal, Pressable, SectionList, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useFridge } from '@/fridge/FridgeProvider'
import { displayName } from '@/fridge/categories'
import { USE_MOCK_DATA } from '@/fridge/config'
import { CategoryIcon } from '@/fridge/components/visuals'
import type { ActivityEntry, ActivityKind } from '@/fridge/types'
import { FadeIn } from '@/ui/motion'
import { shadow } from '@/ui/theme'

// OWNER: phone app team. Everything that went in or out, grouped by day, newest first,
// with one-tap Undo and Fix. Fixing a name teaches the household an alias.

const KIND: Record<ActivityKind, { verb: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string; bg: string }> = {
  added:       { verb: 'Added',        icon: 'arrow-down',             color: '#17251f', bg: '#e8eeeb' },
  removed:     { verb: 'Took out',     icon: 'arrow-up',               color: '#4c5d55', bg: '#e8eeeb' },
  returned:    { verb: 'Put back',     icon: 'undo-variant',           color: '#4c5d55', bg: '#e8eeeb' },
  consumed:    { verb: 'Used up',      icon: 'silverware-fork-knife',  color: '#1b653b', bg: '#d5eedc' },
  expired:     { verb: 'Expired',      icon: 'clock-remove-outline',   color: '#8a2419', bg: '#f8d3ce' },
  thrown_away: { verb: 'Threw away',   icon: 'trash-can-outline',      color: '#8a2419', bg: '#f8d3ce' },
}

type Filter = 'all' | 'moves' | 'saved' | 'wasted'
const FILTERS: { key: Filter; label: string; kinds: ActivityKind[] | null }[] = [
  { key: 'all', label: 'Everything', kinds: null },
  { key: 'moves', label: 'In & out', kinds: ['added', 'removed', 'returned'] },
  { key: 'saved', label: 'Saved', kinds: ['consumed'] },
  { key: 'wasted', label: 'Wasted', kinds: ['expired', 'thrown_away'] },
]

function dayLabel(iso: string, now: Date) {
  const d = new Date(iso)
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((start(now) - start(d)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function ActivityScreen() {
  const { activity, now, undo, correct } = useFridge()
  const { width } = useWindowDimensions()
  const [filter, setFilter] = useState<Filter>('all')
  const [fixing, setFixing] = useState<ActivityEntry | null>(null)

  const kinds = FILTERS.find(f => f.key === filter)!.kinds
  const entries = kinds ? activity.filter(a => kinds.includes(a.kind)) : activity
  const sections: { title: string; data: ActivityEntry[] }[] = []
  for (const e of entries) {
    const title = dayLabel(e.at, now)
    if (sections.at(-1)?.title !== title) sections.push({ title, data: [] })
    sections.at(-1)!.data.push(e)
  }

  return (
    <View className="flex-1 bg-paper">
      <SectionList
        sections={sections}
        keyExtractor={e => e.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: width < 600 ? 14 : 24, paddingBottom: 48, width: '100%', maxWidth: 820, alignSelf: 'center' }}
        ListHeaderComponent={
          <View className="mb-2 gap-3">
            <Text className="text-[28px] font-extrabold tracking-tight text-ink">Activity</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {FILTERS.map(f => (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  className={`rounded-full border px-3 py-1.5 ${filter === f.key ? 'border-ink bg-ink' : 'border-line bg-white active:bg-frost'}`}
                >
                  <Text className={`text-[13px] font-semibold ${filter === f.key ? 'text-white' : 'text-ink'}`}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View className="mb-1 mt-5 flex-row items-baseline gap-2">
            <Text className="text-[15px] font-bold text-ink">{section.title}</Text>
            <Text className="text-xs text-mute">{section.data.length} event{section.data.length === 1 ? '' : 's'}</Text>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <TimelineRow
            entry={item}
            first={index === 0}
            last={index === section.data.length - 1}
            onUndo={() => undo(item)}
            onFix={() => setFixing(item)}
          />
        )}
        ListEmptyComponent={<Text className="mt-10 text-center text-mute">Nothing logged yet.</Text>}
      />
      <FixModal
        entry={fixing}
        onClose={() => setFixing(null)}
        onSave={async (name, action) => {
          if (fixing) await correct(fixing, name, action)
          setFixing(null)
        }}
      />
    </View>
  )
}

function TimelineRow({ entry, first, last, onUndo, onFix }: {
  entry: ActivityEntry
  first: boolean
  last: boolean
  onUndo: () => void
  onFix: () => void
}) {
  const k = KIND[entry.kind]
  const time = new Date(entry.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const canEdit = !entry.undone && entry.eventId

  return (
    <FadeIn from={4}>
      <View className="flex-row gap-3">
        {/* Rail + node */}
        <View className="w-9 items-center">
          <View className={`w-0.5 flex-1 ${first ? 'bg-transparent' : 'bg-line'}`} style={{ maxHeight: 14 }} />
          <View style={{ backgroundColor: k.bg }} className="h-9 w-9 items-center justify-center rounded-full">
            <MaterialCommunityIcons name={k.icon} size={17} color={k.color} />
          </View>
          <View className={`w-0.5 flex-1 ${last ? 'bg-transparent' : 'bg-line'}`} />
        </View>

        <View className={`my-1.5 flex-1 flex-row items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2.5 ${entry.undone ? 'opacity-45' : ''}`} style={shadow.card}>
          <CategoryIcon category={entry.category} size={34} />
          <View className="flex-1">
            <Text className={`text-[15px] text-ink ${entry.undone ? 'line-through' : ''}`}>
              <Text style={{ color: k.color }} className="font-semibold">{k.verb} </Text>
              <Text className="font-semibold">{displayName(entry.itemName)}</Text>
              {entry.quantity > 1 ? ` ×${entry.quantity}` : ''}
            </Text>
            <Text className="mt-0.5 text-xs text-mute">
              {time} · {entry.via === 'system' ? 'automatic' : entry.via}
              {entry.source ? ` · ${entry.source}` : ''}
              {entry.confidence != null ? ` · ${Math.round(entry.confidence * 100)}% sure` : ''}
              {entry.rawLabel ? ` · AI said “${entry.rawLabel}”` : ''}
            </Text>
          </View>
          {canEdit && (
            <View className="flex-row gap-1.5">
              {(entry.kind === 'added' || entry.kind === 'removed') && <Chip label="Fix" onPress={onFix} />}
              <Chip label="Undo" onPress={onUndo} />
            </View>
          )}
        </View>
      </View>
    </FadeIn>
  )
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="rounded-full border border-line px-3 py-1 active:bg-frost">
      <Text className="text-[13px] font-medium text-ink">{label}</Text>
    </Pressable>
  )
}

function FixModal({ entry, onClose, onSave }: {
  entry: ActivityEntry | null
  onClose: () => void
  onSave: (name: string, action: 'in' | 'out') => void
}) {
  const [name, setName] = useState('')
  const [action, setAction] = useState<'in' | 'out'>('in')

  return (
    <Modal
      visible={!!entry}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => { setName(entry?.itemName ?? ''); setAction(entry?.kind === 'removed' ? 'out' : 'in') }}
    >
      <View className="flex-1 items-center justify-center bg-black/35 p-6">
        <View className="w-full max-w-[420px] rounded-3xl bg-white p-5">
          <Text className="mb-3 text-lg font-bold text-ink">Fix this entry</Text>
          <Text className="mb-1.5 mt-2 text-[13px] font-semibold text-mute">What was it?</Text>
          <TextInput className="rounded-xl border border-line bg-paper p-3 text-[15px] text-ink" value={name} onChangeText={setName} autoFocus />
          {!USE_MOCK_DATA && (
            <>
              <Text className="mb-1.5 mt-3 text-[13px] font-semibold text-mute">Going</Text>
              <View className="flex-row gap-2">
                {(['in', 'out'] as const).map(a => (
                  <Pressable key={a} onPress={() => setAction(a)} className={`flex-1 items-center rounded-xl border p-2.5 ${action === a ? 'border-fresh-600 bg-fresh-600' : 'border-line'}`}>
                    <Text className={`font-medium ${action === a ? 'text-white' : 'text-ink'}`}>{a === 'in' ? 'Into fridge' : 'Out of fridge'}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <View className="mt-5 flex-row gap-2.5">
            <Pressable onPress={onClose} className="flex-1 items-center rounded-xl bg-frost p-3"><Text className="text-ink">Cancel</Text></Pressable>
            <Pressable onPress={() => name.trim() && onSave(name.trim(), action)} className="flex-1 items-center rounded-xl bg-ink p-3"><Text className="font-semibold text-white">Save</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
