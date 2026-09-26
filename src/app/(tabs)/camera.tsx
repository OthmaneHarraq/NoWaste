import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useHousehold } from '@/household'
import { recordEvent } from '@/data/fridge'
import { colors } from '@/ui/theme'
import CameraFeed from '@/camera/CameraFeed'

// OWNER: camera team.
//
// The plan (see README → "How detection works"):
//   1. Camera feed from the mounted phone (expo-camera, or a web page with getUserMedia)
//   2. Cheap motion detection wakes it up; grab 3–4 frames across the motion
//   3. Send frames to the `detect-items` Edge Function (supabase/functions/detect-items)
//   4. The function asks the vision AI what went in/out and calls record_event
//   5. The Activity tab shows it instantly with Undo / Fix
//
// Until that exists, the buttons below fake a camera detection so the rest of
// the team can build and demo against real data.

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

  async function simulate(s: (typeof SAMPLES)[number]) {
    if (!household) return
    const { data, error } = await recordEvent({ householdId: household.id, ...s, source: 'camera' })
    setLog(l => [error ? `Error: ${error}` : `Logged: ${data?.action} ${data?.item_name}`, ...l].slice(0, 6))
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <CameraFeed />
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
  heading: { fontSize: 17, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { color: colors.text, fontWeight: '500' },
  log: { fontSize: 13, color: colors.muted, marginTop: 2 },
})
