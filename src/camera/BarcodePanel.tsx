import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { recordEvent, undoEvent } from '@/data/fridge'
import { colors } from '@/ui/theme'
import type { FridgeEvent } from '@/types/db'
import { useBarcodeScanner } from './useBarcodeScanner'
import { lookupBarcode, saveBarcode, type Product } from './productLookup'

const AUTO_CONFIRM_SECONDS = 5

type Pending =
  | { code: string; stage: 'looking' }
  | { code: string; stage: 'found'; product: Product; action: 'in' | 'out'; secondsLeft: number }
  | { code: string; stage: 'unknown' }

type Props = {
  video: HTMLVideoElement | null
  householdId: string | undefined
  /** Tells the Camera tab a barcode handled this movement, so it doesn't also ask the AI. */
  onHandled?: () => void
}

/**
 * Barcode path: scan → look up → confirm (auto after 5s) → record_event.
 * Direction guess until motion direction exists: already in the fridge → "took out", else "put in".
 */
export function BarcodePanel({ video, householdId, onHandled }: Props) {
  const [enabled, setEnabled] = useState(true)
  const [pending, setPending] = useState<Pending | null>(null)
  const [recent, setRecent] = useState<FridgeEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef(pending)
  pendingRef.current = pending

  const { engine } = useBarcodeScanner(video, enabled && !!householdId, code => {
    if (pendingRef.current || !householdId) return // one item at a time
    onHandled?.()
    handleBarcode(householdId, code)
  })

  async function handleBarcode(hid: string, code: string) {
    setError(null)
    setPending({ code, stage: 'looking' })
    const product = await lookupBarcode(hid, code)
    if (!product) {
      setPending({ code, stage: 'unknown' })
      return
    }
    // Guess the direction: if we already have it, it's probably coming out
    const { count } = await supabase
      .from('inventory')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', hid)
      .eq('name', product.name)
    setPending({ code, stage: 'found', product, action: count ? 'out' : 'in', secondsLeft: AUTO_CONFIRM_SECONDS })
  }

  // Countdown → auto-confirm
  useEffect(() => {
    if (pending?.stage !== 'found') return
    if (pending.secondsLeft <= 0) {
      confirm(pending.product.name, pending.action)
      return
    }
    const t = setTimeout(() => setPending(p => (p?.stage === 'found' ? { ...p, secondsLeft: p.secondsLeft - 1 } : p)), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  async function confirm(name: string, action: 'in' | 'out') {
    if (!householdId) return
    setPending(null)
    onHandled?.()
    const { data, error } = await recordEvent({ householdId, label: name, action, source: 'camera', confidence: 1 })
    if (error) setError(error)
    else if (data) setRecent(list => [data, ...list].slice(0, 3))
  }

  async function nameUnknown(code: string, name: string, action: 'in' | 'out') {
    if (!householdId || !name.trim()) return
    await saveBarcode(householdId, code, name)
    confirm(name.trim().toLowerCase(), action)
  }

  async function undo(ev: FridgeEvent) {
    const { error } = await undoEvent(ev.id)
    if (error) setError(error)
    else setRecent(list => list.filter(e => e.id !== ev.id))
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="barcode-outline" size={22} color={colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Barcode scanning</Text>
          <Text style={styles.sub}>
            {enabled
              ? `Hold a package up with its barcode facing the camera${engine ? ` · ${engine === 'native' ? 'built-in' : 'ZXing'} reader` : ''}`
              : 'Off'}
          </Text>
        </View>
        <Switch value={enabled} onValueChange={setEnabled} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />
      </View>

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
            <TouchableOpacity onPress={() => setPending(null)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {pending?.stage === 'unknown' && (
        <UnknownBarcode code={pending.code} onSave={(name, action) => nameUnknown(pending.code, name, action)} onCancel={() => setPending(null)} />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {recent.map(ev => (
        <View key={ev.id} style={[styles.row, styles.recent]}>
          <Ionicons name={ev.action === 'in' ? 'arrow-down-circle' : 'arrow-up-circle'} size={20} color={ev.action === 'in' ? colors.primary : colors.warning} />
          <Text style={styles.recentText}>{ev.action === 'in' ? 'Added' : 'Took out'} {ev.item_name}</Text>
          <TouchableOpacity style={styles.chip} onPress={() => undo(ev)}><Text style={styles.chipText}>Undo</Text></TouchableOpacity>
        </View>
      ))}
    </View>
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
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
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
  chipText: { fontSize: 13, color: colors.text, fontWeight: '500' },
})
