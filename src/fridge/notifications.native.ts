import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import type { Permission } from './notifications'

// Phone version of ./notifications.ts: LOCAL notifications via expo-notifications, fired
// by the app's own expiry check. No push token / FCM / APNs — Expo Go has no remote push
// since SDK 53, and nothing here needs a server.

// Show the banner even when the app is open (the in-app toast shows too).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

let channelReady: Promise<unknown> | null = null
function ensureChannel() {
  // Android 8+ needs a channel before anything shows.
  if (Platform.OS === 'android') {
    channelReady ??= Notifications.setNotificationChannelAsync('expiry', {
      name: 'Expiring food',
      importance: Notifications.AndroidImportance.HIGH,
    })
  }
  return channelReady
}

function toPermission(p: Notifications.NotificationPermissionsStatus): Permission {
  if (p.granted) return 'granted'
  return p.canAskAgain ? 'default' : 'denied'
}

export async function getNotificationPermission(): Promise<Permission> {
  try {
    return toPermission(await Notifications.getPermissionsAsync())
  } catch {
    return 'unsupported'
  }
}

export async function requestNotificationPermission(): Promise<Permission> {
  try {
    await ensureChannel()
    return toPermission(await Notifications.requestPermissionsAsync())
  } catch {
    return 'unsupported'
  }
}

export function notify(title: string, body: string, tag?: string) {
  ;(async () => {
    if (!(await Notifications.getPermissionsAsync()).granted) return
    await ensureChannel()
    await Notifications.scheduleNotificationAsync({
      identifier: tag,
      content: { title, body },
      trigger: Platform.OS === 'android' ? { channelId: 'expiry' } : null, // null = now
    })
  })().catch(() => {
    // Best effort; the in-app toast already told the user.
  })
}
