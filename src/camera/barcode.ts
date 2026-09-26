/**
 * Barcode reading from the live <video> (web only).
 *
 * Uses the browser's built-in BarcodeDetector when it exists (Chrome on Mac/Android/ChromeOS),
 * otherwise the ZXing library (pure JavaScript, works everywhere, e.g. Chrome on Windows).
 * Only grocery barcode formats are enabled: fewer formats = faster and fewer false reads.
 */
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
  RGBLuminanceSource,
} from '@zxing/library'

export type BarcodeHit = { code: string; format: string }

const PRODUCT_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const
const SCAN_WIDTH = 960 // barcodes need more detail than motion detection

type NativeDetector = { detect(source: CanvasImageSource): Promise<{ rawValue: string; format: string }[]> }

export async function createBarcodeReader(): Promise<{ engine: 'native' | 'zxing'; read(video: HTMLVideoElement): Promise<BarcodeHit | null> }> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  function drawFrame(video: HTMLVideoElement): boolean {
    if (video.readyState < 2 || !video.videoWidth) return false
    const scale = Math.min(1, SCAN_WIDTH / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return true
  }

  // 1. Built-in detector (fast, native code)
  const Native = (globalThis as any).BarcodeDetector
  if (Native) {
    try {
      const supported: string[] = await Native.getSupportedFormats()
      const formats = PRODUCT_FORMATS.filter(f => supported.includes(f))
      if (formats.length) {
        const detector: NativeDetector = new Native({ formats })
        return {
          engine: 'native',
          async read(video) {
            if (!drawFrame(video)) return null
            const found = await detector.detect(canvas)
            return found[0] ? { code: found[0].rawValue, format: found[0].format } : null
          },
        }
      }
    } catch {
      // fall through to ZXing
    }
  }

  // 2. ZXing
  const reader = new MultiFormatReader()
  const hints = new Map<DecodeHintType, unknown>()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E])
  reader.setHints(hints)

  return {
    engine: 'zxing',
    async read(video) {
      if (!drawFrame(video)) return null
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      // ZXing wants one brightness value per pixel
      const luminance = new Uint8ClampedArray(width * height)
      for (let i = 0, j = 0; j < luminance.length; i += 4, j++) {
        luminance[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8
      }
      try {
        const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, width, height)))
        const result = reader.decodeWithState(bitmap)
        return { code: result.getText(), format: BarcodeFormat[result.getBarcodeFormat()].toLowerCase() }
      } catch (e) {
        if (e instanceof NotFoundException) return null
        return null // checksum/format errors = not a clean read; try the next frame
      } finally {
        reader.reset()
      }
    },
  }
}

/**
 * UPC-A codes are EAN-13 codes with a leading 0. Normalize so the same product
 * always gets the same key no matter which reader or format caught it.
 */
export function normalizeBarcode(code: string): string {
  const digits = code.replace(/\D/g, '')
  return digits.length === 12 ? '0' + digits : digits
}
