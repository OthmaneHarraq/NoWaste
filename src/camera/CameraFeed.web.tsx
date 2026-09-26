import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '@/ui/theme'
import type { CameraFeedProps } from './types'

/**
 * Web camera preview (Metro picks this file on web; CameraFeed.tsx is the phone fallback).
 *
 * How it works:
 *  1. navigator.mediaDevices.getUserMedia asks the browser for the camera
 *     (only allowed on localhost or HTTPS).
 *  2. The returned MediaStream is attached to a <video> element, which plays it live.
 *  3. Once the video is playing we hand the element to the parent via onVideoReady,
 *     so motion detection / frame capture can read pixels from it.
 */
export default function CameraFeed({ onVideoReady, facing = 'environment' }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [status, setStatus] = useState<'starting' | 'live' | 'error'>('starting')
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

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
        stream = await navigator.mediaDevices.getUserMedia({
          // "environment" = back camera on phones; laptops just use their webcam
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) return
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        setStatus('live')
        onVideoReady?.(video)
      } catch (e: any) {
        if (cancelled) return
        setStatus('error')
        setError(
          e?.name === 'NotAllowedError' ? 'Camera permission was blocked. Allow it in the address bar, then retry.'
          : e?.name === 'NotFoundError' ? 'No camera found on this device.'
          : e?.name === 'NotReadableError' ? 'The camera is in use by another app (Zoom, Teams…). Close it and retry.'
          : `Couldn’t start the camera: ${e?.message ?? e}`
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
  }, [facing, attempt])

  return (
    <View style={styles.frame}>
      {/* A real DOM <video>: fine in a .web.tsx file because react-native-web renders to the DOM */}
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: status === 'live' ? 'block' : 'none' }}
      />
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

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#1c2a24', borderRadius: 16, overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 24 },
  overlayText: { color: '#cfe0d8', textAlign: 'center', lineHeight: 20 },
  retry: { marginTop: 14, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9 },
  retryText: { color: '#fff', fontWeight: '600' },
})
