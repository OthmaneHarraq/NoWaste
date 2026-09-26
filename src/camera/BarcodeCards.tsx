import { useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/ui/theme'
import type { FridgeEvent } from '@/types/db'
import type { useBarcodeFlow } from './useBarcodeFlow'

type Flow = ReturnType<typeof useBarcodeFlow>

/**
 * The barcode confirm card (looking up / found with countdown / unknown → name it),
 * any error, and recently logged items with Undo. Shared by the laptop camera and the phone Scan tab.
 */
export function BarcodeCards({ flow, onReadDate }: { flow: Flow; onReadDate?: (ev: FridgeEvent) => void }) {
  const { pending, recent, error, confirm, nameUnknown, undo, cancel } = flow
  return (
    <>
      {pending?.stage === 'looking' && (
        <View style={[styles.pending, styles.row]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.pendingText}>Looking up {pending.code}…</Text>
        </View>
      )}

      {pending?.stage === 'found' && (
        <View style={styles.pending}>
          <View style={styles.row}>
            {pending.product.imageUrl ? (
              <Image source={{ uri: pending.product.imageUrl }} style={styles.productImage} />
            ) : (
              <View style={[styles.productImage, styles.imagePlaceholder]}><Ionicons name="cube-outline" size={22} color={colors.muted} /></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>{pending.product.name}</Text>
              <Text style={styles.sub}>
                {[pending.product.quantity, pending.product.source === 'saved' ? 'known barcode' : 'Open Food Facts'].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
          <Text style={styles.countdown}>
            {pending.action === 'in' ? 'Adding' : 'Taking out'} in {pending.secondsLeft}…
          </Text>
          <View style={styles.actions}>
            <ActionButton label="Put in" icon="arrow-down-circle" selected={pending.action === 'in'} onPress={() => confirm(pending.product.name, 'in')} />
            <ActionButton label="Took out" icon="arrow-up-circle" selected={pending.action === 'out'} onPress={() => confirm(pending.product.name, 'out')} />
            <TouchableOpacity onPress={cancel} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {pending?.stage === 'unknown' && (
        <UnknownBarcode code={pending.code} onSave={(name, action) => nameUnknown(pending.code, name, action)} onCancel={cancel} />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {recent.map(ev => (
        <View key={ev.id} style={[styles.row, styles.recent]}>
          <Ionicons name={ev.action === 'in' ? 'arrow-down-circle' : 'arrow-up-circle'} size={20} color={ev.action === 'in' ? colors.primary : colors.warning} />
          <Text style={styles.recentText}>{ev.action === 'in' ? 'Added' : 'Took out'} {ev.item_name}</Text>
          {onReadDate && ev.action === 'in' && (
            <TouchableOpacity style={[styles.chip, styles.chipAccent]} onPress={() => onReadDate(ev)}>
              <Text style={[styles.chipText, { color: colors.primary }]}>Read date</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.chip} onPress={() => undo(ev)}><Text style={styles.chipText}>Undo</Text></TouchableOpacity>
        </View>
      ))}
    </>
  )
}

function ActionButton({ label, icon, selected, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.actionBtn, selected && styles.actionOn]}>
      <Ionicons name={icon} size={16} color={selected ? '#fff' : colors.text} />
      <Text style={[styles.actionText, selected && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  )
}

function UnknownBarcode({ code, onSave, onCancel }: { code: string; onSave: (name: string, action: 'in' | 'out') => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  return (
    <View style={styles.pending}>
      <Text style={styles.productName}>New barcode: what is it?</Text>
      <Text style={styles.sub}>{code} isn’t in the product database. Name it once and it’s remembered.</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. oat milk"
        placeholderTextColor={colors.muted}
        value={name}
        onChangeText={setName}
        autoFocus
        onSubmitEditing={() => onSave(name, 'in')}
      />
      <View style={styles.actions}>
        <ActionButton label="Put in" icon="arrow-down-circle" selected onPress={() => onSave(name, 'in')} />
        <ActionButton label="Took out" icon="arrow-up-circle" selected={false} onPress={() => onSave(name, 'out')} />
        <TouchableOpacity onPress={onCancel} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pending: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: colors.primaryLight },
  pendingText: { color: colors.text },
  productImage: { width: 48, height: 48, borderRadius: 8, backgroundColor: colors.surface },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  productName: { fontSize: 16, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  countdown: { marginTop: 10, fontSize: 13, fontWeight: '600', color: colors.primary },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actionOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionText: { fontWeight: '600', color: colors.text },
  cancel: { marginLeft: 'auto', padding: 8 },
  cancelText: { color: colors.muted, fontWeight: '500' },
  input: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: colors.border, color: colors.text, marginTop: 10 },
  error: { color: colors.danger, marginTop: 10 },
  recent: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  recentText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  chipAccent: { borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '500' },
})
