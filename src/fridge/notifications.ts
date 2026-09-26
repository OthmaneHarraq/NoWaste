import { Platform } from 'react-native'

// OS notifications for expired food: the browser Notification API on web. Phones use
// notifications.native.ts (expo-notifications, local only) with the same functions.
// Both are optional extras on top of the in-app toasts.

export type Permission = 'granted' | 'denied' | 'default' | 'unsupported'

const api = () => (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window ? window.Notification : null)

export async function getNotificationPermission(): Promise<Permission> {
  return api()?.permission ?? 'unsupported'
}

export async function requestNotificationPermission(): Promise<Permission> {
  const N = api()
  if (!N) return 'unsupported'
  try {
    return await N.requestPermission()
  } catch {
    return N.permission
  }
}

export function notify(title: string, body: string, tag?: string) {
  const N = api()
  if (!N || N.permission !== 'granted') return
  try {
    new N(title, { body, tag, icon: '/favicon.ico' })
  } catch {
    // Some browsers only allow notifications from a service worker; toasts still show.
  }
}
