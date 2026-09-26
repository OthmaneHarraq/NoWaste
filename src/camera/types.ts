export type CameraFeedProps = {
  /** Called with the live <video> element once the camera is playing, and with null when it stops. Web only. */
  onVideoReady?: (video: HTMLVideoElement | null) => void
  /** 'environment' = back camera on phones (default), 'user' = selfie camera. */
  facing?: 'environment' | 'user'
  /** Draw the barcode guide box (see GUIDE_BOX in barcode.ts). Web only. */
  showBarcodeGuide?: boolean
}
