import '../global.css'
import { Platform } from 'react-native'
import { Slot } from 'expo-router'
import * as Font from 'expo-font'
import { StatusBar } from 'expo-status-bar'
import { useFonts, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka'
import { AuthProvider } from '@/auth'
import { HouseholdProvider } from '@/household'
import { ThemeProvider, useTheme } from '@/ui/ThemeProvider'

// Display font for titles (className="font-display"). Text falls back to the system
// rounded/sans font for the moment it takes to load, so nothing waits on it.
const FONTS = { Fredoka_600SemiBold, Fredoka_700Bold }

// Web: expo-font injects the @font-face, then waits up to 12 s to *verify* it loaded and
// rejects if a slow dev server misses that, which useFonts leaves unhandled (a full-screen
// error overlay in dev). The font renders either way, so load it here and drop that rejection.
if (Platform.OS === 'web') Font.loadAsync(FONTS).catch(() => {})

// Root of the app. Providers go here; screens live in src/app/(tabs)/.
export default function RootLayout() {
  useFonts(Platform.OS === 'web' ? {} : FONTS)

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
