import '../global.css'
import { Slot } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useFonts, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka'
import { AuthProvider } from '@/auth'
import { HouseholdProvider } from '@/household'
import { ThemeProvider, useTheme } from '@/ui/ThemeProvider'

// Root of the app. Providers go here; screens live in src/app/(tabs)/.
export default function RootLayout() {
  // Display font for titles (className="font-display"). Text falls back to the system
  // rounded/sans font for the moment it takes to load, so nothing waits on it.
  useFonts({ Fredoka_600SemiBold, Fredoka_700Bold })

  return (
    <ThemeProvider>
      <AuthProvider>
        <HouseholdProvider>
          <ThemedStatusBar />
          <Slot />
        </HouseholdProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

function ThemedStatusBar() {
  const { dark } = useTheme()
  return <StatusBar style={dark ? 'light' : 'dark'} />
}
