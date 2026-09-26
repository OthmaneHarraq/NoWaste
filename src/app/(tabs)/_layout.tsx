import { ActivityIndicator, Platform, Text, View, useWindowDimensions, type ColorValue } from 'react-native'
import { Tabs } from 'expo-router/js-tabs'
import { Ionicons } from '@expo/vector-icons'
import { AuthScreen, ProfileMenu, useAuth } from '@/auth'
import { HouseholdSetup, useHousehold } from '@/household'
import { FridgeProvider } from '@/fridge/FridgeProvider'
import { USE_MOCK_DATA } from '@/fridge/config'
import { HeaderStatus } from '@/fridge/components/HeaderStatus'
import { ToastProvider } from '@/ui/Toast'
import { Brand } from '@/ui/Brand'
import { Sidebar } from '@/ui/Sidebar'
import { colors } from '@/ui/theme'

type IconName = keyof typeof Ionicons.glyphMap

function icon(name: IconName) {
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={size} color={color as string} />
  )
}

// Gate order: signed in? → in a fridge? → the app. Mock mode (EXPO_PUBLIC_USE_MOCK_DATA=true)
// skips both gates and shows the demo fridge.
// To add a tab: create src/app/(tabs)/<name>.tsx and add a <Tabs.Screen> below.
export default function TabsLayout() {
  const { session, loading: authLoading } = useAuth()
  const { household, loading: householdLoading } = useHousehold()
  const { width } = useWindowDimensions()
  const wide = width >= 900

  if (!USE_MOCK_DATA) {
    if (authLoading || (session && householdLoading)) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )
    }
    if (!session) return <AuthScreen title="NoWaste" />
    if (!household) return <HouseholdSetup />
  }

  const fridgeName = USE_MOCK_DATA ? 'Demo fridge' : household!.name
  const householdId = USE_MOCK_DATA ? 'demo' : household!.id

  return (
    <ToastProvider>
      <FridgeProvider householdId={householdId}>
        <Tabs
          // Wide screens: our own sidebar (brand, spaced nav, score card). Narrow: the stock bottom bar.
          tabBar={wide ? props => <Sidebar {...props} fridgeName={fridgeName} /> : undefined}
          screenOptions={{
            // The sidebar already shows the brand on wide screens, so the header shows the day.
            headerTitle: () => (wide ? <Today /> : <Brand fridge={fridgeName} compact={width < 420} />),
            headerStyle: { backgroundColor: colors.surface, borderBottomColor: colors.border },
            headerTitleStyle: { color: colors.text, fontWeight: '700' },
            headerShadowVisible: false,
            headerRight: () => (
              <View style={{ marginRight: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <HeaderStatus />
                {!USE_MOCK_DATA && <ProfileMenu />}
              </View>
            ),
            sceneStyle: { backgroundColor: colors.background },
            tabBarPosition: wide ? 'left' : 'bottom',
            tabBarVariant: wide ? 'material' : 'uikit',
            tabBarLabelPosition: wide ? 'beside-icon' : 'below-icon',
            // Web has no safe-area inset under the bar, so give icon + label explicit room.
            tabBarStyle: wide ? undefined : Platform.OS === 'web' ? { height: 72, paddingTop: 6, paddingBottom: 10 } : undefined,
            // ...and a real line height, or descenders (the y in Activity) get clipped.
            tabBarLabelStyle: Platform.OS === 'web' ? { fontSize: 11, lineHeight: 15 } : undefined,
            tabBarActiveTintColor: colors.primary,
            tabBarActiveBackgroundColor: wide ? colors.primaryLight : undefined,
            tabBarInactiveTintColor: colors.muted,
          }}
        >
          <Tabs.Screen name="index" options={{ title: 'Fridge', tabBarIcon: icon('file-tray-stacked') }} />
          <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: icon('time') }} />
          <Tabs.Screen name="impact" options={{ title: 'Impact', tabBarIcon: icon('leaf') }} />
          {/* Scan: phone only (the Camera tab has its own barcode scanner on a computer); needs a real household. */}
          <Tabs.Screen
            name="scan"
            options={{ title: 'Scan', tabBarIcon: icon('barcode'), href: USE_MOCK_DATA || Platform.OS === 'web' ? null : undefined }}
          />
          {/* Camera + Settings need a real household; hidden in mock mode. */}
          <Tabs.Screen name="camera" options={{ title: 'Camera', tabBarIcon: icon('camera'), href: USE_MOCK_DATA ? null : undefined }} />
          <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings'), href: USE_MOCK_DATA ? null : undefined }} />
        </Tabs>
      </FridgeProvider>
    </ToastProvider>
  )
}

function Today() {
  const d = new Date()
  return (
    <Text style={{ fontSize: 15, color: colors.muted, fontWeight: '500' }}>
      <Text style={{ color: colors.text, fontWeight: '800' }}>{d.toLocaleDateString(undefined, { weekday: 'long' })}</Text>
      {'  '}{d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
    </Text>
  )
}
