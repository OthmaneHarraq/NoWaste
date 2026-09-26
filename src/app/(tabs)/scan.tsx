import { useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { useIsFocused } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useHousehold } from '@/household'
import { useBarcodeFlow } from '@/camera/useBarcodeFlow'
import { BarcodeCards } from '@/camera/BarcodeCards'
import { findInventoryId, readPrintedDate, type PrintedDate } from '@/camera/readExpiry'
import { setExpiry } from '@/data/fridge'
import { colors } from '@/ui/theme'
import type { FridgeEvent } from '@/types/db'

// OWNER: camera team. Phone barcode scanner (runs in Expo Go).
// Phone cameras autofocus up close and read barcodes natively, which laptop webcams can't.
// Uses the same flow as the laptop fridge camera: look up → confirm → logged for the household.
// After adding an item, "Read date" photographs the printed best-by date and sets its expiry.

const SAME_CODE_COOLDOWN_MS = 8000
const DATE_PHOTO_WIDTH = 1280 // enough to read small print, small enough to upload fast

type DateMode =
  | { ev: FridgeEvent; stage: 'aim' }
  | { ev: FridgeEvent; stage: 'reading' }
  | { ev: FridgeEvent; stage: 'result'; result: PrintedDate }
  | { ev: FridgeEvent; stage: 'failed'; message: string }
  | { ev: FridgeEvent; stage: 'saved'; date: string }

function prettyDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ScanScreen() {
  const { household } = useHousehold()
  const [permission, requestPermission] = useCameraPermissions()
  const focused = useIsFocused() // only run the camera while this tab is open
  const flow = useBarcodeFlow(household?.id)
  const lastSeen = useRef(new Map<string, number>())
  const camera = useRef<CameraView>(null)
  const [dateMode, setDateMode] = useState<DateMode | null>(null)

  function onScanned({ data }: BarcodeScanningResult) {
    const now = Date.now()
    if (now - (lastSeen.current.get(data) ?? 0) < SAME_CODE_COOLDOWN_MS) return
    lastSeen.current.set(data, now)
    flow.submit(data)
  }

  async function captureDate() {
    if (dateMode?.stage !== 'aim' || !camera.current) return
    const ev = dateMode.ev
    setDateMode({ ev, stage: 'reading' })
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.8, shutterSound: false })
      if (!photo?.uri) throw new Error('No photo')
      // Shrink before upload: a full phone photo is several MB
      const rendered = await ImageManipulator.manipulate(photo.uri).resize({ width: DATE_PHOTO_WIDTH }).renderAsync()
      const small = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true })
      if (!small.base64) throw new Error('Could not prepare the photo')

      const res = await readPrintedDate(small.base64)
      if (res.kind === 'ok') setDateMode({ ev, stage: 'result', result: res.result })
      else if (res.kind === 'no-date') setDateMode({ ev, stage: 'failed', message: res.text || 'Couldn’t find a date. Fill the box with the printed date and try again.' })
      else if (res.kind === 'not-deployed') setDateMode({ ev, stage: 'failed', message: 'The date reader isn’t deployed yet (supabase/functions/read-expiry). You can still set the date on the Fridge tab.' })
      else setDateMode({ ev, stage: 'failed', message: res.message })
    } catch (e: any) {
      setDateMode({ ev, stage: 'failed', message: `Couldn’t take the photo: ${e?.message ?? e}` })
    }
  }

  async function saveDate(ev: FridgeEvent, date: string) {
    if (!household) return
    const id = await findInventoryId(household.id, ev.item_name)
    if (!id) return setDateMode({ ev, stage: 'failed', message: `${ev.item_name} isn’t in the fridge any more.` })
    const error = await setExpiry(id, date)
    if (error) return setDateMode({ ev, stage: 'failed', message: error })
    setDateMode({ ev, stage: 'saved', date })
    setTimeout(() => setDateMode(m => (m?.stage === 'saved' ? null : m)), 2500)
  }

  if (Platform.OS === 'web') {
    return <Message icon="phone-portrait-outline" text="The Scan tab is for the phone app. On a computer, use the Camera tab's barcode scanner." />
  }
  if (!permission) return <View style={styles.container} />
  if (!permission.granted) {
    return (
      <Message
        icon="camera-outline"
        text="NoWaste needs the camera to scan barcodes."
        action={permission.canAskAgain ? { label: 'Allow camera', onPress: requestPermission } : undefined}
        note={permission.canAskAgain ? undefined : 'Camera access is off. Turn it on for Expo Go in your phone’s Settings.'}
      />
    )
  }

  const readingDate = !!dateMode
  const aimLabel = readingDate
    ? dateMode.stage === 'aim' ? 'Fill the box with the printed date' : dateMode.stage === 'reading' ? 'Reading…' : ''
    : flow.pending ? 'Got it' : 'Point at a barcode'

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.cameraWrap}>
        {focused && (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            // No handler while a card is open or while reading a date = scanning paused
            onBarcodeScanned={flow.pending || readingDate ? undefined : onScanned}
          />
        )}
        <View pointerEvents="none" style={styles.aimWrap}>
          <View style={[styles.aim, readingDate && styles.aimDate]} />
          {!!aimLabel && <Text style={styles.aimText}>{aimLabel}</Text>}
        </View>
        {dateMode?.stage === 'aim' && (
          <TouchableOpacity style={styles.shutter} onPress={captureDate} accessibilityLabel="Take photo of the date">
            <View style={styles.shutterInner} />
          </TouchableOpacity>
        )}
        {dateMode?.stage === 'reading' && (
          <View style={styles.shutter}><ActivityIndicator color="#fff" /></View>
        )}
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={{ padding: 16, paddingTop: 4 }} keyboardShouldPersistTaps="handled">
        {dateMode ? (
          <DateCard mode={dateMode} onSave={saveDate} onRetake={() => setDateMode({ ev: dateMode.ev, stage: 'aim' })} onCancel={() => setDateMode(null)} />
        ) : (
          <>
            {!flow.pending && flow.recent.length === 0 && (
              <Text style={styles.hint}>Scan an item as you put it in or take it out. It shows up in everyone’s Fridge tab straight away.</Text>
            )}
            <BarcodeCards flow={flow} onReadDate={ev => setDateMode({ ev, stage: 'aim' })} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function DateCard({ mode, onSave, onRetake, onCancel }: {
  mode: DateMode
  onSave: (ev: FridgeEvent, date: string) => void
  onRetake: () => void
  onCancel: () => void
}) {
  const name = mode.ev.item_name
  return (
    <View style={styles.dateCard}>
      <Text style={styles.dateTitle}>Best-by date · <Text style={{ textTransform: 'capitalize' }}>{name}</Text></Text>

      {mode.stage === 'aim' && <Text style={styles.dateSub}>Hold the package so the printed date fills the box, then tap the button.</Text>}
      {mode.stage === 'reading' && <Text style={styles.dateSub}>Reading the date…</Text>}

      {mode.stage === 'result' && (
        <>
          <Text style={styles.dateValue}>{prettyDate(mode.result.date)}</Text>
          <Text style={styles.dateSub}>
            Read “{mode.result.text}”{mode.result.confidence ? ` · ${Math.round(mode.result.confidence * 100)}% sure` : ''}
          </Text>
          <View style={styles.dateActions}>
            <TouchableOpacity style={styles.primary} onPress={() => onSave(mode.ev, mode.result.date)}>
              <Text style={styles.primaryText}>Set date</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={onRetake}><Text style={styles.secondaryText}>Retake</Text></TouchableOpacity>
          </View>
        </>
      )}

      {mode.stage === 'failed' && (
        <>
          <Text style={[styles.dateSub, { color: colors.warning }]}>{mode.message}</Text>
          <View style={styles.dateActions}>
            <TouchableOpacity style={styles.primary} onPress={onRetake}><Text style={styles.primaryText}>Try again</Text></TouchableOpacity>
          </View>
        </>
      )}

      {mode.stage === 'saved' && (
        <View style={styles.saved}>
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
          <Text style={styles.savedText}>Use by {prettyDate(mode.date)}</Text>
        </View>
      )}

      {mode.stage !== 'saved' && (
        <TouchableOpacity onPress={onCancel} style={{ alignSelf: 'flex-end', padding: 6 }}>
          <Text style={{ color: colors.muted, fontWeight: '500' }}>{mode.stage === 'result' ? 'Skip' : 'Cancel'}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function Message({ icon, text, action, note }: {
  icon: keyof typeof Ionicons.glyphMap
  text: string
  action?: { label: string; onPress: () => void }
  note?: string
}) {
  return (
    <View style={[styles.container, styles.center]}>
      <Ionicons name={icon} size={40} color={colors.muted} />
      <Text style={styles.messageText}>{text}</Text>
      {action && (
        <TouchableOpacity style={styles.button} onPress={action.onPress}>
          <Text style={styles.buttonText}>{action.label}</Text>
        </TouchableOpacity>
      )}
      {note && <Text style={styles.note}>{note}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  cameraWrap: { height: '50%', backgroundColor: '#000', overflow: 'hidden' },
  aimWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  aim: { width: '75%', height: '38%', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 14 },
  aimDate: { width: '80%', height: '22%', borderColor: '#ffd36b' },
  aimText: { color: '#fff', fontWeight: '600', marginTop: 10, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  shutter: {
    position: 'absolute', bottom: 16, alignSelf: 'center', width: 64, height: 64, borderRadius: 32,
    borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)',
  },
  shutterInner: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff' },
  panel: { flex: 1 },
  hint: { color: colors.muted, textAlign: 'center', marginTop: 16, lineHeight: 20 },
  dateCard: { marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: colors.surface, gap: 6 },
  dateTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  dateValue: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
  dateSub: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  dateActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  primary: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryText: { color: colors.text, fontWeight: '600' },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  savedText: { fontSize: 15, fontWeight: '600', color: colors.text },
  messageText: { fontSize: 16, color: colors.text, textAlign: 'center' },
  button: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  note: { color: colors.muted, textAlign: 'center' },
})
