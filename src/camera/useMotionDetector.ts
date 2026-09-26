import { useEffect, useRef, useState } from 'react'
import { DEFAULT_MOTION_SETTINGS, MotionTracker, frameDifference, toGrayscale, type MotionEvent, type MotionSettings } from './motion'

const SAMPLE_WIDTH = 64 // tiny frames are plenty for "did something move?" and cost almost nothing
const SAMPLE_HEIGHT = 48
const SAMPLE_EVERY_MS = 150

type Callbacks = {
  onMotionStart?: (at: number) => void
  onMotionEnd?: (event: MotionEvent) => void
  /** Called on every sample while the camera runs (step 3 uses this to capture frames). */
  onSample?: (info: { level: number; active: boolean; now: number }) => void
}

/**
 * Watches a <video> for movement. Pass the element from CameraFeed's onVideoReady.
 * Does nothing when video is null (e.g. on phones, where CameraFeed has no video).
 */
export function useMotionDetector(
  video: HTMLVideoElement | null,
  settings: MotionSettings = DEFAULT_MOTION_SETTINGS,
  callbacks: Callbacks = {}
) {
  const [level, setLevel] = useState(0)
  const [active, setActive] = useState(false)

  // Keep the latest callbacks/settings in refs so the sampling loop never needs restarting
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const trackerRef = useRef(new MotionTracker(settings))
  useEffect(() => trackerRef.current.setSettings(settings), [settings])

  useEffect(() => {
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE_WIDTH
    canvas.height = SAMPLE_HEIGHT
    // willReadFrequently tells the browser we'll call getImageData a lot (keeps it on the CPU, faster)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const tracker = trackerRef.current
    tracker.reset()
    let prev: Uint8Array | null = null

    const timer = setInterval(() => {
      if (video.readyState < 2) return // no frame yet
      ctx.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
      const gray = toGrayscale(ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data)
      const now = Date.now()

      const lv = prev ? frameDifference(prev, gray, settingsRef.current.pixelThreshold) : 0
      prev = gray

      const update = tracker.update(lv, now)
      if (update.type === 'start') {
        setActive(true)
        callbacksRef.current.onMotionStart?.(update.at)
      } else if (update.type === 'end') {
        setActive(false)
        callbacksRef.current.onMotionEnd?.(update.event)
      }
      setLevel(lv)
      callbacksRef.current.onSample?.({ level: lv, active: tracker.isActive, now })
    }, SAMPLE_EVERY_MS)

    return () => {
      clearInterval(timer)
      setActive(false)
      setLevel(0)
    }
  }, [video])

  return { level, active }
}
