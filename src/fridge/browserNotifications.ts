import { Platform } from 'react-native'

// Native OS notifications in the browser (web only, nice-to-have). The phone app would
// need expo-notifications for the same thing; in-app toasts cover it meanwhile.

type Permission = 'granted' | 'denied' | 'default' | 'unsupported'

const api = () => (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window ? window.Notification : null)

export function notificationPermission(): Permission {
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

export function notifyBrowser(title: string, body: string, tag?: string) {
  const N = api()
  if (!N || N.permission !== 'granted') return
  try {
    new N(title, { body, tag, icon: '/favicon.ico' })
  } catch {
    // Some browsers only allow notifications from a service worker; toasts still show.
  }
}
