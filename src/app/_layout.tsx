import '../global.css'
import { Slot } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from '@/auth'
import { HouseholdProvider } from '@/household'

// Root of the app. Providers go here; screens live in src/app/(tabs)/.
export default function RootLayout() {
  return (
    <AuthProvider>
      <HouseholdProvider>
        <StatusBar style="dark" />
        <Slot />
      </HouseholdProvider>
    </AuthProvider>
  )
}
