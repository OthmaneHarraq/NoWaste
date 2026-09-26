import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useHousehold } from './HouseholdProvider'
import { colors } from '@/ui/theme'

/** Shown after sign-in when the user isn't in any fridge yet: create one or join with a code. */
export function HouseholdSetup() {
  const { createHousehold, joinHousehold } = useHousehold()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(kind: 'create' | 'join') {
    setError(null)
    if (kind === 'join' && code.trim().length < 6) return setError('Enter the 6-character code.')
    setBusy(kind)
    const { error } = kind === 'create' ? await createHousehold(name) : await joinHousehold(code)
    setBusy(null)
    if (error) setError(error)
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Set up your fridge</Text>
        <Text style={styles.subtitle}>Create a new fridge, or join your housemates with their code.</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.label}>New fridge</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Apartment 4B"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
        />
        <TouchableOpacity style={styles.button} onPress={() => run('create')} disabled={!!busy}>
          {busy === 'create' ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create fridge</Text>}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.or}>or</Text>
          <View style={styles.line} />
        </View>

        <Text style={styles.label}>Join code</Text>
        <TextInput
          style={[styles.input, styles.code]}
          placeholder="A1B2C3"
          placeholderTextColor={colors.muted}
          value={code}
          onChangeText={t => setCode(t.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
        />
        <TouchableOpacity style={[styles.button, styles.secondary]} onPress={() => run('join')} disabled={!!busy}>
          {busy === 'join' ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.buttonText, { color: colors.primary }]}>Join fridge</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: { backgroundColor: colors.background, borderRadius: 10, padding: 14, fontSize: 15, borderWidth: 1, borderColor: colors.border, color: colors.text, marginBottom: 10 },
  code: { letterSpacing: 4, fontWeight: '700', textAlign: 'center' },
  button: { backgroundColor: colors.primary, borderRadius: 12, padding: 15, alignItems: 'center' },
  secondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { color: colors.muted },
  error: { color: colors.danger, backgroundColor: colors.dangerLight, padding: 10, borderRadius: 8, marginBottom: 14, textAlign: 'center' },
})
