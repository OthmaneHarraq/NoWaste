import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useHousehold } from '@/household'
import { recordEvent } from '@/data/fridge'
import { colors } from '@/ui/theme'
import CameraFeed from '@/camera/CameraFeed'
import { useMotionDetector } from '@/camera/useMotionDetector'
import { MotionPanel, SENSITIVITY_THRESHOLDS, type Sensitivity } from '@/camera/MotionPanel'
import { DEFAULT_MOTION_SETTINGS, type MotionEvent } from '@/camera/motion'
import { useFrameRecorder } from '@/camera/useFrameRecorder'
import { detectItems } from '@/camera/detect'
import { DetectionPanel, type DetectionEntry } from '@/camera/DetectionPanel'
import { BarcodePanel } from '@/camera/BarcodePanel'

// OWNER: camera team. The fridge camera (runs in the browser; see src/camera/).
//
//   1. CameraFeed           live webcam (USB or built-in) → <video>
//   2. useMotionDetector    tiny frames ~7x/sec; notices when something moves
//   3. useFrameRecorder     keeps frames from before / during / after each movement
//   4. detectItems          sends 6 of them (before, 4 moving, after) to the detect-items Edge Function, which asks
//                           the vision AI and logs the result with record_event
//   5. DetectionPanel       "Added milk" with Undo / Fix; Fridge + Activity update live
//   +  BarcodePanel         packaged items: barcode → Open Food Facts → confirm. A movement
//                           handled by a barcode is not also sent to the AI.
//
// The "Simulate a detection" buttons still fake a detection for testing without a camera.

const SAMPLES: { label: string; action: 'in' | 'out'; confidence: number }[] = [
  { label: 'milk', action: 'in', confidence: 0.94 },
  { label: 'eggs', action: 'in', confidence: 0.88 },
  { label: 'strawberries', action: 'in', confidence: 0.81 },
  { label: 'plastic container', action: 'in', confidence: 0.42 },
  { label: 'milk', action: 'out', confidence: 0.9 },
]

export default function CameraScreen() {
  const { household } = useHousehold()
  const [log, setLog] = useState<string[]>([])

  // Step 2: motion detection on the live <video>
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const [sensitivity, setSensitivity] = useState<Sensitivity>('medium')
  const [motionEvents, setMotionEvents] = useState<MotionEvent[]>([])
  const settings = useMemo(
    () => ({ ...DEFAULT_MOTION_SETTINGS, motionThreshold: SENSITIVITY_THRESHOLDS[sensitivity] }),
    [sensitivity]
  )

  // Step 3: capture frames around each movement and ask the AI what it was
  const recorder = useFrameRecorder(video)
  const [sendToAI, setSendToAI] = useState(true)
  const [entries, setEntries] = useState<DetectionEntry[]>([])
  const busy = useRef(false) // one AI request at a time
  const nextId = useRef(1)
  const lastBarcodeAt = useRef(0)
  const [barcodeOn, setBarcodeOn] = useState(true)
  // Green flash + "Barcode read" badge on the preview for a moment after a successful read
  const [barcodeFlashAt, setBarcodeFlashAt] = useState(0)
  const flashing = barcodeFlashAt > 0
  useEffect(() => {
    if (!barcodeFlashAt) return
    const t = setTimeout(() => setBarcodeFlashAt(0), 1400)
    return () => clearTimeout(t)
  }, [barcodeFlashAt])

  const addEntry = (e: DetectionEntry) => setEntries(list => [e, ...list].slice(0, 4))
  const updateEntry = (id: number, patch: Partial<DetectionEntry>) =>
    setEntries(list => list.map(e => (e.id === id ? { ...e, ...patch } : e)))

  async function handleMotionEnd(event: MotionEvent) {
    setMotionEvents(list => [event, ...list].slice(0, 5))
    const frames = recorder.finishEvent()
    if (frames.length === 0) return

    const entry: DetectionEntry = { id: nextId.current++, at: Date.now(), frames, status: 'sending' }
    // The barcode scanner already logged this item → don't pay the AI to do it again
    if (Date.now() - lastBarcodeAt.current < 10_000) return addEntry({ ...entry, status: 'barcode' })
    if (!sendToAI || !household) return addEntry({ ...entry, status: 'captured' })
    if (busy.current) return addEntry({ ...entry, status: 'skipped' })

    addEntry(entry)
    busy.current = true
    try {
      const result = await detectItems(household.id, frames)
      if (result.kind === 'ok') updateEntry(entry.id, { status: 'ok', events: result.events, detections: result.detections })
      else if (result.kind === 'error') updateEntry(entry.id, { status: 'error', message: result.message })
      else updateEntry(entry.id, { status: 'not-deployed' })
    } finally {
      busy.current = false
    }
  }

  const { level, active } = useMotionDetector(video, settings, {
    onSample: recorder.onSample,
    onMotionEnd: handleMotionEnd,
  })

  async function simulate(s: (typeof SAMPLES)[number]) {
    if (!household) return
    const { data, error } = await recordEvent({ householdId: household.id, ...s, source: 'camera' })
    setLog(l => [error ? `Error: ${error}` : `Logged: ${data?.action} ${data?.item_name}`, ...l].slice(0, 6))
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {/* Green border while something is moving */}
      <View style={[styles.feedBorder, active && styles.feedBorderActive, flashing && styles.feedBorderRead]}>
        <CameraFeed onVideoReady={setVideo} showBarcodeGuide={barcodeOn} />
        {flashing && (
          <View pointerEvents="none" style={styles.readBadgeWrap}>
            <View style={styles.readBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.readBadgeText}>Barcode read</Text>
            </View>
          </View>
        )}
      </View>
      {Platform.OS === 'web' && (
        <BarcodePanel
          video={video}
          householdId={household?.id}
          enabled={barcodeOn}
          onEnabledChange={setBarcodeOn}
          onHandled={() => (lastBarcodeAt.current = Date.now())}
          onRead={() => setBarcodeFlashAt(Date.now())}
        />
      )}
      {Platform.OS === 'web' && (
        <MotionPanel
          level={level}
          active={active}
          threshold={settings.motionThreshold}
          sensitivity={sensitivity}
          onSensitivityChange={setSensitivity}
          events={motionEvents}
        />
      )}
      {Platform.OS === 'web' && (
        <DetectionPanel sendToAI={sendToAI} onSendToAIChange={setSendToAI} entries={entries} />
      )}
      <View style={{ height: 20 }} />

      <Text style={styles.heading}>Simulate a detection</Text>
      <Text style={styles.sub}>Pretends the AI saw something, so you can test the Fridge and Activity tabs.</Text>
      <View style={styles.grid}>
        {SAMPLES.map((s, i) => (
          <TouchableOpacity key={i} style={styles.chip} onPress={() => simulate(s)}>
            <Text style={styles.chipText}>{s.action === 'in' ? '↓' : '↑'} {s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {log.map((l, i) => <Text key={i} style={styles.log}>{l}</Text>)}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  // Small preview: it's for checking the aim, not for watching. Scanning still uses full resolution.
  feedBorder: { width: '100%', maxWidth: 340, alignSelf: 'center', borderRadius: 19, borderWidth: 3, borderColor: 'transparent' },
  feedBorderActive: { borderColor: colors.primary },
  feedBorderRead: { borderColor: '#22c55e', borderWidth: 5, borderRadius: 21 },
  readBadgeWrap: { position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center' },
  readBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#16a34a', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  readBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  heading: { fontSize: 17, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { color: colors.text, fontWeight: '500' },
  log: { fontSize: 13, color: colors.muted, marginTop: 2 },
})
