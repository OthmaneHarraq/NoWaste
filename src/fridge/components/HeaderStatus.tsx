import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { LiveDot } from '@/ui/motion'
import { useToast } from '@/ui/Toast'
import { getNotificationPermission, requestNotificationPermission, type Permission } from '../notifications'
import { useFridge } from '../FridgeProvider'

const CONNECTION = {
  live:       { label: 'Live',        dot: '#2f9e5b', text: 'text-fresh-700' },
  demo:       { label: 'Demo data',   dot: '#5967c0', text: 'text-ink-soft' },
  connecting: { label: 'Connecting…', dot: '#8a9a93', text: 'text-mute' },
  offline:    { label: 'Offline',     dot: '#d9493a', text: 'text-spoiled-700' },
}

/** Header: realtime connection state + opt-in for OS notifications (browser or phone). */
export function HeaderStatus() {
  const { connection } = useFridge()
  const toast = useToast()
  const [permission, setPermission] = useState<Permission>('unsupported')
  useEffect(() => {
    getNotificationPermission().then(setPermission)
  }, [])
  const c = CONNECTION[connection]

  async function enable() {
    const p = await requestNotificationPermission()
    setPermission(p)
    toast(p === 'granted'
      ? { tone: 'fresh', title: 'Alerts on', body: 'You’ll get a notification when something is about to go off.' }
      : { tone: 'info', title: 'Alerts blocked', body: 'In-app alerts will still show here.' })
  }

  return (
    <View className="flex-row items-center gap-2">
      {permission === 'default' && (
        <Pressable onPress={enable} accessibilityLabel="Enable alerts" className="flex-row items-center gap-1 rounded-full border border-line px-2.5 py-1 active:bg-frost">
          <MaterialCommunityIcons name="bell-ring-outline" size={14} color="#4c5d55" />
          <Text className="text-xs font-semibold text-ink-soft">Alerts</Text>
        </Pressable>
      )}
      <View className="flex-row items-center gap-1.5 rounded-full bg-frost px-2.5 py-1">
        {connection === 'live' ? <LiveDot color={c.dot} size={7} /> : <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.dot }} />}
        <Text className={`text-xs font-semibold ${c.text}`}>{c.label}</Text>
      </View>
    </View>
  )
}
