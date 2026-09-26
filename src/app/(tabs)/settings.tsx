import { useEffect, useState } from 'react'
import { Alert, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth'
import { useHousehold } from '@/household'
import { colors } from '@/ui/theme'

// OWNER: accounts & demo. Fridge info, invite code, sign out.
export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const { household, leaveHousehold } = useHousehold()
  const [memberCount, setMemberCount] = useState<number | null>(null)

  useEffect(() => {
    if (!household) return
    supabase
      .from('household_members')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', household.id)
      .then(({ count }) => setMemberCount(count ?? null))
  }, [household])

  if (!household) return null

  function invite() {
    const message = `Join our fridge on NoWaste with code ${household!.join_code}`
    if (Platform.OS === 'web') Alert.alert('Invite code', household!.join_code)
    else Share.share({ message })
  }

  function confirm(title: string, action: () => void) {
    if (Platform.OS === 'web') {
      if (window.confirm(title)) action()
    } else {
      Alert.alert(title, undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Yes', style: 'destructive', onPress: action }])
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Fridge</Text>
        <Text style={styles.value}>{household.name}</Text>
        <Text style={styles.label}>Members</Text>
        <Text style={styles.value}>{memberCount ?? '…'}</Text>
        <Text style={styles.label}>Invite code</Text>
        <Text style={[styles.value, styles.code]} selectable>{household.join_code}</Text>
        <TouchableOpacity style={styles.button} onPress={invite}>
          <Text style={styles.buttonText}>Invite housemates</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{user?.email}</Text>
        <TouchableOpacity style={[styles.button, styles.outline]} onPress={() => signOut()}>
          <Text style={[styles.buttonText, { color: colors.text }]}>Sign out</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => confirm('Leave this fridge?', () => leaveHousehold())}>
          <Text style={styles.danger}>Leave fridge</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 16 },
  label: { fontSize: 12, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', marginTop: 8 },
  value: { fontSize: 16, color: colors.text, marginTop: 2 },
  code: { fontSize: 24, fontWeight: '800', letterSpacing: 5, color: colors.primary },
  button: { backgroundColor: colors.primary, borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 16 },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  danger: { color: colors.danger, textAlign: 'center', marginTop: 16, fontWeight: '500' },
})
