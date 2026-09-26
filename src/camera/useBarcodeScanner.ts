import { useEffect, useRef, useState } from 'react'
import { createBarcodeReader, normalizeBarcode } from './barcode'

const SCAN_EVERY_MS = 300
const SAME_CODE_COOLDOWN_MS = 8000 // holding an item still shouldn't re-trigger it

/**
 * Looks for grocery barcodes in the live <video> while `enabled`.
 * Calls onBarcode(code) once per item (same code is ignored for 8s).
 */
export function useBarcodeScanner(video: HTMLVideoElement | null, enabled: boolean, onBarcode: (code: string) => void) {
  const [engine, setEngine] = useState<'native' | 'zxing' | null>(null)
  const onBarcodeRef = useRef(onBarcode)
  onBarcodeRef.current = onBarcode

  useEffect(() => {
    if (!video || !enabled) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const lastSeen = new Map<string, number>()

    createBarcodeReader().then(reader => {
      if (stopped) return
      setEngine(reader.engine)

      // A chain of timeouts (not setInterval) so a slow read never overlaps the next one
      const loop = async () => {
        if (stopped) return
        try {
          const hit = await reader.read(video)
          if (hit) {
            const code = normalizeBarcode(hit.code)
            const now = Date.now()
            if (code.length >= 8 && now - (lastSeen.get(code) ?? 0) > SAME_CODE_COOLDOWN_MS) {
              onBarcodeRef.current(code)
            }
            lastSeen.set(code, now) // still in view → keep extending the cooldown
          }
        } catch {
          // a bad frame is fine; try the next one
        }
        timer = setTimeout(loop, SCAN_EVERY_MS)
      }
      loop()
    })

    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [video, enabled])

  return { engine }
}
