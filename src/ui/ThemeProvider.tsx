import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Uniwind, useUniwind } from 'uniwind'
import { palettes, type Palette } from './theme'

type Mode = 'light' | 'dark'
type ThemeValue = { mode: Mode; dark: boolean; c: Palette; setMode: (m: Mode) => void; toggle: () => void }

const KEY = 'nowaste:theme'
const ThemeContext = createContext<ThemeValue | null>(null)

/**
 * Light/dark switch. Uniwind swaps every Tailwind colour token (src/global.css); `c` is the
 * same palette as JS values for inline styles and SVG. The choice is remembered per device.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme } = useUniwind()
  const [mode, setModeState] = useState<Mode>(theme === 'dark' ? 'dark' : 'light')

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(saved => { if (saved === 'dark' || saved === 'light') apply(saved) })
      .catch(() => {})
  }, [])

  function apply(m: Mode) {
    setModeState(m)
    Uniwind.setTheme(m)
    // Web: native scrollbars, form controls etc. follow the theme too.
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.style.colorScheme = m
  }
  function setMode(m: Mode) {
    apply(m)
    AsyncStorage.setItem(KEY, m).catch(() => {})
  }

  const dark = mode === 'dark'
  return (
    <ThemeContext.Provider value={{ mode, dark, c: dark ? palettes.dark : palettes.light, setMode, toggle: () => setMode(dark ? 'light' : 'dark') }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
