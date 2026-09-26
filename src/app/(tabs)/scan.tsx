import { useRef } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { useIsFocused } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useHousehold } from '@/household'
import { useBarcodeFlow } from '@/camera/useBarcodeFlow'
import { BarcodeCards } from '@/camera/BarcodeCards'
import { colors } from '@/ui/theme'

// OWNER: camera team. Phone barcode scanner (runs in Expo Go).
// Phone cameras autofocus up close and read barcodes natively, which laptop webcams can't.
// Uses the same flow as the laptop fridge camera: look up → confirm → logged for the household.

const SAME_CODE_COOLDOWN_MS = 8000

export default function ScanScreen() {
  const { household } = useHousehold()
  const [permission, requestPermission] = useCameraPermissions()
  const focused = useIsFocused() // only run the camera while this tab is open
  const flow = useBarcodeFlow(household?.id)
  const lastSeen = useRef(new Map<string, number>())

  function onScanned({ data }: BarcodeScanningResult) {
    const now = Date.now()
    if (now - (lastSeen.current.get(data) ?? 0) < SAME_CODE_COOLDOWN_MS) return
    lastSeen.current.set(data, now)
    flow.submit(data)
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

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.cameraWrap}>
        {focused && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            // No handler while a card is open = scanning paused (one item at a time)
            onBarcodeScanned={flow.pending ? undefined : onScanned}
          />
        )}
        <View pointerEvents="none" style={styles.aimWrap}>
          <View style={styles.aim} />
          <Text style={styles.aimText}>{flow.pending ? 'Got it' : 'Point at a barcode'}</Text>
        </View>
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={{ padding: 16, paddingTop: 4 }} keyboardShouldPersistTaps="handled">
        {!flow.pending && flow.recent.length === 0 && (
          <Text style={styles.hint}>Scan an item as you put it in or take it out. It shows up in everyone’s Fridge tab straight away.</Text>
        )}
        <BarcodeCards flow={flow} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  aimText: { color: '#fff', fontWeight: '600', marginTop: 10, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  panel: { flex: 1 },
  hint: { color: colors.muted, textAlign: 'center', marginTop: 16, lineHeight: 20 },
  messageText: { fontSize: 16, color: colors.text, textAlign: 'center' },
  button: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  note: { color: colors.muted, textAlign: 'center' },
})
