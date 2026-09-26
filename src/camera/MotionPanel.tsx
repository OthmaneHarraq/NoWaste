import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '@/ui/theme'
import type { MotionEvent } from './motion'

export type Sensitivity = 'low' | 'medium' | 'high'

/** Sensitivity → how much of the picture must change to count as motion. */
export const SENSITIVITY_THRESHOLDS: Record<Sensitivity, number> = {
  low: 0.08,
  medium: 0.04,
  high: 0.02,
}

type Props = {
  level: number
  active: boolean
  threshold: number
  sensitivity: Sensitivity
  onSensitivityChange: (s: Sensitivity) => void
  events: MotionEvent[]
}

/** Live motion meter + sensitivity switch + recent events. Useful for tuning camera placement. */
export function MotionPanel({ level, active, threshold, sensitivity, onSensitivityChange, events }: Props) {
  // Show 0–20% of the picture changing across the full bar width; bigger values just fill it
  const scale = (v: number) => `${Math.min(v / 0.2, 1) * 100}%` as const

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Motion</Text>
        <View style={[styles.pill, active ? styles.pillActive : styles.pillIdle]}>
          <View style={[styles.dot, { backgroundColor: active ? '#fff' : colors.primary }]} />
          <Text style={[styles.pillText, active && { color: '#fff' }]}>{active ? 'Movement detected' : 'Watching'}</Text>
        </View>
      </View>

      <View style={styles.meter}>
        <View style={[styles.meterFill, { width: scale(level), backgroundColor: level >= threshold ? colors.primary : '#a9c2b6' }]} />
        <View style={[styles.thresholdLine, { left: scale(threshold) }]} />
      </View>
      <Text style={styles.caption}>
        {(level * 100).toFixed(1)}% of the picture changed · triggers at {(threshold * 100).toFixed(0)}%
      </Text>

      <View style={styles.segment}>
        {(['low', 'medium', 'high'] as const).map(s => (
          <TouchableOpacity key={s} onPress={() => onSensitivityChange(s)} style={[styles.segmentBtn, sensitivity === s && styles.segmentOn]}>
            <Text style={[styles.segmentText, sensitivity === s && { color: '#fff' }]}>{s[0].toUpperCase() + s.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {events.length > 0 && (
        <View style={{ marginTop: 12 }}>
          {events.map(e => (
            <Text key={e.startedAt} style={styles.event}>
              {new Date(e.startedAt).toLocaleTimeString()} · {(e.durationMs / 1000).toFixed(1)}s · peak {(e.peak * 100).toFixed(0)}%
            </Text>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pillIdle: { backgroundColor: colors.primaryLight },
  pillActive: { backgroundColor: colors.primary },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  dot: { width: 7, height: 7, borderRadius: 4 },
  meter: { height: 10, backgroundColor: colors.background, borderRadius: 5, overflow: 'hidden' },
  meterFill: { height: 10, borderRadius: 5 },
  thresholdLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.text },
  caption: { fontSize: 12, color: colors.muted, marginTop: 6 },
  segment: { flexDirection: 'row', gap: 6, marginTop: 12 },
  segmentBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  segmentOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.text },
  event: { fontSize: 12, color: colors.muted, marginTop: 2 },
})
