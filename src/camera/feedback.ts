import * as Haptics from 'expo-haptics'

/** Phone: a short "success" vibration when a barcode is read (works even when the phone is muted). */
export function barcodeReadFeedback() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
}
