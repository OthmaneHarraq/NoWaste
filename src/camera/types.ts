export type CameraFeedProps = {
  /** Called with the live <video> element once the camera is playing, and with null when it stops. Web only. */
  onVideoReady?: (video: HTMLVideoElement | null) => void
  /** 'environment' = back camera on phones (default), 'user' = selfie camera. */
  facing?: 'environment' | 'user'
}
