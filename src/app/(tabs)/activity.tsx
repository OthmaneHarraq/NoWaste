import { useState } from 'react'
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useHousehold } from '@/household'
import { correctEvent, undoEvent, useEvents } from '@/data/fridge'
import { colors } from '@/ui/theme'
import type { FridgeEvent } from '@/types/db'

// OWNER: phone app team. Everything the camera (or a person) logged, newest first,
// with one-tap Undo and Fix. Fixing a name teaches the household an alias.
export default function ActivityScreen() {
  const { household } = useHousehold()
  const { events, loading, error } = useEvents(household?.id)
  const [fixing, setFixing] = useState<FridgeEvent | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function undo(ev: FridgeEvent) {
    const { error } = await undoEvent(ev.id)
    setMessage(error)
  }

  return (
    <View style={styles.container}>
      {(message || error) && <Text style={styles.error}>{message || error}</Text>}
      <FlatList
        data={events}
        keyExtractor={e => e.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Loading…' : 'Nothing logged yet.'}</Text>}
        renderItem={({ item }) => <EventRow ev={item} onUndo={() => undo(item)} onFix={() => setFixing(item)} />}
      />
      <FixModal
        ev={fixing}
        onClose={() => setFixing(null)}
        onSave={async (name, action) => {
          if (!fixing) return
          const { error } = await correctEvent(fixing.id, name, action)
          setMessage(error)
          setFixing(null)
        }}
      />
    </View>
  )
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  return new Date(iso).toLocaleDateString()
}

function EventRow({ ev, onUndo, onFix }: { ev: FridgeEvent; onUndo: () => void; onFix: () => void }) {
  const isIn = ev.action === 'in'
  const undone = ev.status === 'undone'
  return (
    <View style={[styles.row, undone && { opacity: 0.45 }]}>
      <Ionicons
        name={isIn ? 'arrow-down-circle' : 'arrow-up-circle'}
        size={28}
        color={isIn ? colors.primary : colors.warning}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, undone && { textDecorationLine: 'line-through' }]}>
          {isIn ? 'Added' : 'Took out'} {ev.item_name}
          {ev.quantity > 1 ? ` ×${ev.quantity}` : ''}
        </Text>
        <Text style={styles.meta}>
          {timeAgo(ev.created_at)} · {ev.source}
          {ev.confidence != null ? ` · ${Math.round(ev.confidence * 100)}% sure` : ''}
          {!ev.matched ? ' · wasn’t in inventory' : ''}
          {ev.raw_label && ev.raw_label.toLowerCase() !== ev.item_name ? ` · AI said “${ev.raw_label}”` : ''}
        </Text>
      </View>
      {!undone && (
        <View style={styles.actions}>
          <TouchableOpacity onPress={onFix} style={styles.chip}><Text style={styles.chipText}>Fix</Text></TouchableOpacity>
          <TouchableOpacity onPress={onUndo} style={styles.chip}><Text style={styles.chipText}>Undo</Text></TouchableOpacity>
        </View>
      )}
    </View>
  )
}

function FixModal({ ev, onClose, onSave }: {
  ev: FridgeEvent | null
  onClose: () => void
  onSave: (name: string, action: 'in' | 'out') => void
}) {
  const [name, setName] = useState('')
  const [action, setAction] = useState<'in' | 'out'>('in')

  return (
    <Modal
      visible={!!ev}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => { setName(ev?.item_name ?? ''); setAction(ev?.action ?? 'in') }}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Fix this entry</Text>
          <Text style={styles.label}>What was it?</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} autoFocus />
          <Text style={styles.label}>Going</Text>
          <View style={styles.toggle}>
            {(['in', 'out'] as const).map(a => (
              <TouchableOpacity key={a} onPress={() => setAction(a)} style={[styles.toggleBtn, action === a && styles.toggleOn]}>
                <Text style={[styles.toggleText, action === a && { color: '#fff' }]}>{a === 'in' ? 'Into fridge' : 'Out of fridge'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.sheetButtons}>
            <TouchableOpacity onPress={onClose} style={[styles.button, styles.cancel]}><Text style={{ color: colors.text }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => name.trim() && onSave(name.trim(), action)} style={styles.button}><Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  error: { color: colors.danger, marginBottom: 8 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 8 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: colors.background, borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: colors.border, color: colors.text },
  toggle: { flexDirection: 'row', gap: 8 },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  toggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { color: colors.text, fontWeight: '500' },
  sheetButtons: { flexDirection: 'row', gap: 10, marginTop: 18 },
  button: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, padding: 13, alignItems: 'center' },
  cancel: { backgroundColor: colors.background },
})
