import { ActivityIndicator, View, type ColorValue } from 'react-native'
import { Tabs } from 'expo-router/js-tabs'
import { Ionicons } from '@expo/vector-icons'
import { AuthScreen, ProfileMenu, useAuth } from '@/auth'
import { HouseholdSetup, useHousehold } from '@/household'
import { colors } from '@/ui/theme'

type IconName = keyof typeof Ionicons.glyphMap

function icon(name: IconName) {
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={size} color={color as string} />
  )
}

// Gate order: signed in? → in a fridge? → the app.
// To add a tab: create src/app/(tabs)/<name>.tsx and add a <Tabs.Screen> below.
export default function TabsLayout() {
  const { session, loading: authLoading } = useAuth()
  const { household, loading: householdLoading } = useHousehold()

  if (authLoading || (session && householdLoading)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }
  if (!session) return <AuthScreen title="NoWaste" />
  if (!household) return <HouseholdSetup />

  return (
    <Tabs
      screenOptions={{
        headerTitle: household.name,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerRight: () => (
          <View style={{ marginRight: 12 }}>
            <ProfileMenu />
          </View>
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Fridge', tabBarIcon: icon('file-tray-stacked') }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: icon('time') }} />
      <Tabs.Screen name="camera" options={{ title: 'Camera', tabBarIcon: icon('camera') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings') }} />
    </Tabs>
  )
}
