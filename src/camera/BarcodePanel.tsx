import { StyleSheet, Switch, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/ui/theme'
import { useBarcodeScanner } from './useBarcodeScanner'
import { useBarcodeFlow } from './useBarcodeFlow'
import { BarcodeCards } from './BarcodeCards'

type Props = {
  video: HTMLVideoElement | null
  householdId: string | undefined
  enabled: boolean
  onEnabledChange: (on: boolean) => void
  /** Tells the Camera tab a barcode handled this movement, so it doesn't also ask the AI. */
  onHandled?: () => void
}

/** Laptop fridge camera: reads barcodes from the live <video>, then runs the shared barcode flow. */
export function BarcodePanel({ video, householdId, enabled, onEnabledChange: setEnabled, onHandled }: Props) {
  const flow = useBarcodeFlow(householdId, { onLogged: onHandled })

  const { engine } = useBarcodeScanner(video, enabled && !!householdId, code => {
    if (flow.submit(code)) onHandled?.()
  })

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="barcode-outline" size={22} color={colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Barcode scanning</Text>
          <Text style={styles.sub}>
            {enabled
              ? `Hold the barcode flat in the dashed box, filling most of it${engine ? ` · ${engine === 'native' ? 'built-in' : 'ZXing'} reader` : ''}`
              : 'Off'}
          </Text>
        </View>
        <Switch value={enabled} onValueChange={setEnabled} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />
      </View>
      <BarcodeCards flow={flow} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
})
