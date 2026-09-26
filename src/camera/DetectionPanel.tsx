import { useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { undoEvent } from '@/data/fridge'
import { colors } from '@/ui/theme'
import type { FridgeEvent } from '@/types/db'
import type { DetectResult, Detection } from './detect'

export type DetectionEntry = {
  id: number
  at: number
  frames: string[]
  status: 'sending' | 'captured' | 'skipped' | 'barcode' | DetectResult['kind']
  events?: FridgeEvent[]
  /** Everything the AI reported, including guesses that weren't logged. */
  detections?: Detection[]
  message?: string
}

type Props = {
  sendToAI: boolean
  onSendToAIChange: (on: boolean) => void
  entries: DetectionEntry[]
}

/** What the camera captured and what the AI made of it, with Undo / Fix on each item. */
export function DetectionPanel({ sendToAI, onSendToAIChange, entries }: Props) {
  const latest = entries[0]

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Send to AI</Text>
          <Text style={styles.sub}>{sendToAI ? 'Each movement is identified and logged.' : 'Off: frames are captured but not sent (no API cost).'}</Text>
        </View>
        <Switch
          value={sendToAI}
          onValueChange={onSendToAIChange}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor="#fff"
        />
      </View>

      {latest && (
        <>
          <Text style={styles.label}>Last capture: what the AI sees</Text>
          <View style={styles.thumbs}>
            {latest.frames.map((f, i) => (
              <Image key={i} source={{ uri: f }} style={styles.thumb} />
            ))}
          </View>
        </>
      )}

      {entries.length === 0 && <Text style={styles.empty}>Move something in front of the camera to capture it.</Text>}
      {entries.map(e => <EntryRow key={e.id} entry={e} />)}
    </View>
  )
}

function EntryRow({ entry }: { entry: DetectionEntry }) {
  const time = new Date(entry.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })

  if (entry.status === 'ok') {
    const events = entry.events ?? []
    // What the AI saw but didn't log (direction unclear, or not confident enough)
    const logged = new Set(events.map(ev => `${ev.raw_label ?? ev.item_name}|${ev.action}`.toLowerCase()))
    const guesses = (entry.detections ?? []).filter(d => d?.item && !logged.has(`${d.item}|${d.action}`.toLowerCase()))
    if (events.length || guesses.length) {
      return (
        <View style={styles.entry}>
          <Text style={styles.time}>{time}</Text>
          {events.map(ev => <EventLine key={ev.id} ev={ev} />)}
          {guesses.map((d, i) => <GuessLine key={i} d={d} />)}
        </View>
      )
    }
  }

  const info: Record<Exclude<DetectionEntry['status'], 'ok'> | 'nothing', { icon: keyof typeof Ionicons.glyphMap; text: string; color: string }> = {
    sending: { icon: 'cloud-upload-outline', text: 'Asking the AI…', color: colors.muted },
    captured: { icon: 'images-outline', text: 'Captured (Send to AI is off)', color: colors.muted },
    skipped: { icon: 'pause-circle-outline', text: 'Skipped: still waiting on the previous answer', color: colors.warning },
    barcode: { icon: 'barcode-outline', text: 'Handled by the barcode scanner', color: colors.primary },
    nothing: { icon: 'eye-off-outline', text: 'Nothing clearly moved in or out', color: colors.muted },
    'not-deployed': { icon: 'construct-outline', text: 'Can’t reach the AI function: it’s probably not deployed yet (supabase/functions/detect-items)', color: colors.warning },
    error: { icon: 'alert-circle-outline', text: entry.message ?? 'Something went wrong', color: colors.danger },
  }
  const i = info[entry.status === 'ok' ? 'nothing' : entry.status]
  return (
    <View style={[styles.entry, styles.entryRow]}>
      {entry.status === 'sending' ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name={i.icon} size={18} color={i.color} />}
      <Text style={[styles.entryText, { color: i.color }]}>{i.text}</Text>
      <Text style={styles.time}>{time}</Text>
    </View>
  )
}

/** Something the AI saw but didn't log, so you can tell whether it recognised the food. */
function GuessLine({ d }: { d: Detection }) {
  const why = d.action === 'unknown' ? 'direction unclear' : `${d.action === 'in' ? 'going in' : 'coming out'}, not sure enough to log`
  const sure = d.confidence != null ? ` · ${Math.round(d.confidence * 100)}% sure` : ''
  return (
    <View style={styles.eventLine}>
      <Ionicons name="help-circle-outline" size={24} color={colors.muted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.guessText}>AI saw: {d.item}</Text>
        <Text style={styles.time}>{why}{sure}</Text>
      </View>
    </View>
  )
}

function EventLine({ ev }: { ev: FridgeEvent }) {
  const [undone, setUndone] = useState(false)
  const [busy, setBusy] = useState(false)
  const isIn = ev.action === 'in'

  async function undo() {
    setBusy(true)
    const { error } = await undoEvent(ev.id)
    setBusy(false)
    if (!error) setUndone(true)
  }

  return (
    <View style={[styles.eventLine, undone && { opacity: 0.45 }]}>
      <Ionicons name={isIn ? 'arrow-down-circle' : 'arrow-up-circle'} size={24} color={isIn ? colors.primary : colors.warning} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.eventText, undone && { textDecorationLine: 'line-through' }]}>
          {isIn ? 'Added' : 'Took out'} {ev.item_name}{ev.quantity > 1 ? ` ×${ev.quantity}` : ''}
        </Text>
        {ev.confidence != null && <Text style={styles.time}>{Math.round(ev.confidence * 100)}% sure</Text>}
      </View>
      {!undone && (
        <>
          <TouchableOpacity style={styles.chip} onPress={() => router.push('/activity')}>
            <Text style={styles.chipText}>Fix</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip} onPress={undo} disabled={busy}>
            <Text style={styles.chipText}>{busy ? '…' : 'Undo'}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  label: { fontSize: 12, fontWeight: '600', color: colors.muted, marginTop: 14, marginBottom: 6 },
  thumbs: { flexDirection: 'row', gap: 6 },
  thumb: { flex: 1, aspectRatio: 4 / 3, borderRadius: 6, backgroundColor: colors.background },
  empty: { fontSize: 13, color: colors.muted, marginTop: 12 },
  entry: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 10, paddingTop: 10 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryText: { flex: 1, fontSize: 13 },
  time: { fontSize: 11, color: colors.muted },
  eventLine: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  guessText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  eventText: { fontSize: 15, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '500' },
})
