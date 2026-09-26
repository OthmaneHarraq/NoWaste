import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '@/ui/theme'
import type { CameraFeedProps } from './types'
import { GUIDE_BOX } from './barcode'

/**
 * Web camera preview (Metro picks this file on web; CameraFeed.tsx is the phone fallback).
 *
 * How it works:
 *  1. navigator.mediaDevices.getUserMedia asks the browser for the camera
 *     (only allowed on localhost or HTTPS).
 *  2. The returned MediaStream is attached to a <video> element, which plays it live.
 *  3. Once the video is playing we hand the element to the parent via onVideoReady,
 *     so motion detection / frame capture can read pixels from it.
 *  4. If there's more than one camera (laptop webcam + USB webcam), a picker appears.
 *     The choice is remembered in this browser.
 */

const STORAGE_KEY = 'nowaste.cameraDeviceId'

/**
 * Wait for real frames, then check whether the picture is one flat green colour (what some
 * virtual cameras send when they can't produce the requested resolution).
 */
async function isGreenScreen(video: HTMLVideoElement): Promise<boolean> {
  await new Promise(r => setTimeout(r, 900))
  if (video.readyState < 2 || !video.videoWidth) return false
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 12
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(video, 0, 0, 16, 12)
  const d = ctx.getImageData(0, 0, 16, 12).data
  let r = 0, g = 0, b = 0, spread = 0
  const n = d.length / 4
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] }
  r /= n; g /= n; b /= n
  for (let i = 0; i < d.length; i += 4) spread += Math.abs(d[i + 1] - g)
  // Strongly green on average, and almost no variation across the picture
  return g > 90 && g > r * 2 && g > b * 2 && spread / n < 8
}

// We save the camera's id AND its name: browsers sometimes hand out new ids
// (private windows, some browsers), but the name ("Logitech C270") stays the same.
type SavedCamera = { id: string; label: string }

// localStorage can be missing or blocked (private windows), so never let it crash the camera
function loadSavedCamera(): SavedCamera | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function saveCamera(cam: SavedCamera | null) {
  try { cam ? localStorage.setItem(STORAGE_KEY, JSON.stringify(cam)) : localStorage.removeItem(STORAGE_KEY) } catch {}
}
export default function CameraFeed({ onVideoReady, facing = 'environment', showBarcodeGuide = false }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [status, setStatus] = useState<'starting' | 'live' | 'error'>('starting')
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(() => loadSavedCamera()?.id ?? null)
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null)

  // Camera names are only visible after permission is granted, so we list them once the
  // camera starts, and again whenever a camera is plugged in or unplugged.
  async function refreshCameras(): Promise<MediaDeviceInfo[]> {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      const list = all.filter(d => d.kind === 'videoinput')
      setCameras(list)
      return list
    } catch {
      return []
    }
  }

  useEffect(() => {
    const md = navigator.mediaDevices
    if (!md?.addEventListener) return
    md.addEventListener('devicechange', refreshCameras)
    return () => md.removeEventListener('devicechange', refreshCameras)
  }, [])

  function chooseCamera(id: string) {
    const cam = cameras.find(c => c.deviceId === id)
    saveCamera(cam ? { id, label: cam.label } : null)
    setDeviceId(id || null)
  }

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    async function start() {
      setStatus('starting')
      setError(null)

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error')
        setError('This browser can’t use the camera here. Open the app on localhost or an https:// address.')
        return
      }

      try {
        // 1080p when the webcam supports it: barcodes need the detail (motion detection
        // and AI frames shrink it anyway, so there's no cost there)
        const size = { width: { ideal: 1920 }, height: { ideal: 1080 } }
        const open = async (id: string | null, withSize: boolean) =>
          navigator.mediaDevices.getUserMedia({
            // A chosen camera wins; otherwise "environment" = back camera on phones, default webcam on laptops
            video: {
              ...(id ? { deviceId: { exact: id } } : { facingMode: facing }),
              ...(withSize ? size : {}),
            },
            audio: false,
          })

        try {
          stream = await open(deviceId, true)
        } catch (e: any) {
          // The saved id no longer exists (unplugged, or the browser issued new ids) → start the default camera
          if (!deviceId || (e?.name !== 'OverconstrainedError' && e?.name !== 'NotFoundError')) throw e
          stream = await open(null, true)
        }
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        const startedId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? null
        setActiveDeviceId(startedId)
        const list = await refreshCameras()

        // Now that we can see camera names: if the saved camera is plugged in under a new id,
        // switch to it (this re-runs the effect once with the right id)
        const saved = loadSavedCamera()
        if (saved && startedId !== saved.id) {
          const match = list.find(c => c.label === saved.label)
          if (match && match.deviceId !== startedId) {
            saveCamera({ id: match.deviceId, label: match.label })
            if (!cancelled) setDeviceId(match.deviceId)
            return
          }
          if (!match) saveCamera(null) // that camera really is gone
        }
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()

        // Some virtual cameras (DroidCam, OBS, phone-as-webcam apps) only support their own
        // resolution and send a solid green picture when asked for 1080p. If that happens,
        // reopen the same camera and let it pick its own size.
        if (await isGreenScreen(video)) {
          stream.getTracks().forEach(t => t.stop())
          if (cancelled) return
          stream = await open(startedId, false).catch(() => open(null, false))
          if (cancelled) {
            stream.getTracks().forEach(t => t.stop())
            return
          }
          video.srcObject = stream
          await video.play()
          if (await isGreenScreen(video)) {
            if (cancelled) return
            setStatus('error')
            setError('This camera is sending a blank green picture. If it’s a phone-as-webcam app (DroidCam…), make sure the phone is connected in its app, then retry, or pick another camera.')
            refreshCameras()
            return
          }
        }
        if (cancelled) return
        setStatus('live')
        onVideoReady?.(video)
      } catch (e: any) {
        if (cancelled) return
        setStatus('error')
        setError(
          e?.name === 'NotAllowedError' ? 'Camera permission was blocked. Allow it in the address bar, then retry.'
          : e?.name === 'NotFoundError' ? 'No camera found on this device.'
          : e?.name === 'NotReadableError' ? 'The camera is in use by another app (Zoom, Teams…). Close it and retry.'
          : `Couldn’t start the camera: ${e?.message || e?.name || e}`
        )
      }
    }

    start()

    // Turn the camera off when leaving the tab, so the light goes off and other apps can use it
    return () => {
      cancelled = true
      stream?.getTracks().forEach(t => t.stop())
      onVideoReady?.(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, attempt, deviceId])

  return (
    <View style={styles.frame}>
      {/* A real DOM <video>: fine in a .web.tsx file because react-native-web renders to the DOM */}
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: status === 'live' ? 'block' : 'none' }}
      />
      {status === 'live' && showBarcodeGuide && (
        <View pointerEvents="none" style={styles.guideWrap}>
          <View style={styles.guide} />
          <Text style={styles.guideText}>Barcode here · fill most of the box</Text>
        </View>
      )}
      {status === 'live' && cameras.length > 1 && (
        <View style={styles.pickerWrap}>
          <select
            aria-label="Choose camera"
            value={activeDeviceId ?? ''}
            onChange={e => chooseCamera(e.target.value)}
            style={pickerStyle}
          >
            {cameras.map((c, i) => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </View>
      )}
      {status !== 'live' && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>{status === 'starting' ? 'Starting camera…' : error}</Text>
          {status === 'error' && (
            <TouchableOpacity style={styles.retry} onPress={() => setAttempt(a => a + 1)}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

// Plain DOM styles for the native <select> (RN StyleSheet doesn't apply to DOM elements)
const pickerStyle = {
  maxWidth: 260,
  padding: '6px 10px',
  borderRadius: 8,
  border: 'none',
  background: 'rgba(28, 42, 36, 0.8)',
  color: '#fff',
  fontSize: 13,
  cursor: 'pointer',
} as const

const styles = StyleSheet.create({
  guideWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  guide: {
    width: `${GUIDE_BOX.width * 100}%`,
    height: `${GUIDE_BOX.height * 100}%`,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  guideText: { position: 'absolute', bottom: '19%', color: '#fff', fontSize: 12, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  pickerWrap: { position: 'absolute', left: 10, bottom: 10, right: 10, alignItems: 'flex-start' },
  frame: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#1c2a24', borderRadius: 16, overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 24 },
  overlayText: { color: '#cfe0d8', textAlign: 'center', lineHeight: 20 },
  retry: { marginTop: 14, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9 },
  retryText: { color: '#fff', fontWeight: '600' },
})
