import { useState } from 'react'
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useHousehold } from '@/household'
import { daysLeft, recordEvent, useInventory } from '@/data/fridge'
import { colors } from '@/ui/theme'
import type { InventoryItem } from '@/types/db'

// OWNER: phone app team. What's in the fridge right now, soonest-expiring first.
// Updates live when the camera (or anyone in the household) logs something.
export default function FridgeScreen() {
  const { household } = useHousehold()
  const { items, loading, error } = useInventory(household?.id)
  const [newItem, setNewItem] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  async function addManually() {
    if (!household || !newItem.trim()) return
    const { error } = await recordEvent({ householdId: household.id, label: newItem, action: 'in' })
    setMessage(error ?? null)
    if (!error) setNewItem('')
  }

  async function takeOut(item: InventoryItem) {
    if (!household) return
    const { error } = await recordEvent({ householdId: household.id, label: item.name, action: 'out' })
    setMessage(error ?? null)
  }

  const expiringCount = items.filter(i => {
    const d = daysLeft(i.expires_on)
    return d !== null && d <= 2
  }).length

  return (
    <View style={styles.container}>
      {expiringCount > 0 && (
        <View style={styles.alert}>
          <Ionicons name="alert-circle" size={18} color={colors.warning} />
          <Text style={styles.alertText}>
            {expiringCount} item{expiringCount === 1 ? '' : 's'} expiring in the next 2 days
          </Text>
        </View>
      )}

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Add an item by hand (e.g. milk)"
          placeholderTextColor={colors.muted}
          value={newItem}
          onChangeText={setNewItem}
          onSubmitEditing={addManually}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addButton} onPress={addManually}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
      {(message || error) && <Text style={styles.error}>{message || error}</Text>}

      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.empty}>{loading ? 'Loading…' : 'The fridge is empty. Add something above or use the camera.'}</Text>
        }
        renderItem={({ item }) => <ItemRow item={item} onTakeOut={() => takeOut(item)} />}
      />
    </View>
  )
}

function ItemRow({ item, onTakeOut }: { item: InventoryItem; onTakeOut: () => void }) {
  const d = daysLeft(item.expires_on)
  const badge =
    d === null ? null
    : d < 0 ? { text: 'Expired', fg: colors.danger, bg: colors.dangerLight }
    : d === 0 ? { text: 'Today', fg: colors.danger, bg: colors.dangerLight }
    : d <= 2 ? { text: `${d}d left`, fg: colors.warning, bg: colors.warningLight }
    : { text: `${d}d left`, fg: colors.primary, bg: colors.primaryLight }

  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>Qty {item.quantity}</Text>
      </View>
      {badge && (
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.text}</Text>
        </View>
      )}
      <TouchableOpacity onPress={onTakeOut} style={styles.outButton} accessibilityLabel={`Take out ${item.name}`}>
        <Ionicons name="remove-circle-outline" size={24} color={colors.muted} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.warningLight, padding: 12, borderRadius: 10, marginBottom: 12 },
  alertText: { color: colors.text, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: colors.border, color: colors.text },
  addButton: { backgroundColor: colors.primary, borderRadius: 10, width: 48, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger, marginBottom: 8 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, paddingHorizontal: 24 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginTop: 8, gap: 10 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  outButton: { padding: 2 },
})
