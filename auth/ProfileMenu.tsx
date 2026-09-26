import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native'
import { useAuth } from './AuthProvider'

type Props = {
    /** Called after a successful sign-out (e.g. to show a toast). */
    onSignedOut?: () => void
    /** Called with the error message if sign-out fails. */
    onError?: (message: string) => void
}

/** Avatar button that opens a small profile card with the user's email and a Sign Out button. */
export function ProfileMenu({ onSignedOut, onError }: Props) {
    const { user, signOut } = useAuth()
    const [open, setOpen] = useState(false)
    const email = user?.email ?? ''
    const initial = email.charAt(0).toUpperCase()

    async function handleSignOut() {
        const { error } = await signOut()
        if (error) onError?.(error)
        else onSignedOut?.()
    }

    return (
        <>
            <TouchableOpacity style={styles.profileBtn} onPress={() => setOpen(true)}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initial}</Text>
                </View>
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setOpen(false)}>
                    <View style={styles.profileCard}>
                        <View style={styles.profileHeader}>
                            <View style={styles.avatarLarge}>
                                <Text style={styles.avatarLargeText}>{initial}</Text>
                            </View>
                            <Text style={styles.profileEmail}>{email}</Text>
                        </View>
                        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                            <Text style={styles.signOutText}>Sign Out</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    )
}

const styles = StyleSheet.create({
    profileBtn: { padding: 4 },
    avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#3498db', alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', alignItems: 'flex-end' },
    profileCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, margin: 16, marginTop: 60, minWidth: 220, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
    profileHeader: { alignItems: 'center', marginBottom: 16 },
    avatarLarge: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#3498db', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    avatarLargeText: { color: '#fff', fontWeight: '700', fontSize: 24 },
    profileEmail: { fontSize: 14, color: '#555', textAlign: 'center' },
    signOutBtn: { backgroundColor: '#fdedec', borderRadius: 8, padding: 12, alignItems: 'center' },
    signOutText: { color: '#e74c3c', fontWeight: '600', fontSize: 15 },
})
