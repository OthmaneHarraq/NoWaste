/**
 * Barcode reading from the live <video> (web only).
 *
 * Uses the browser's built-in BarcodeDetector when it exists (Chrome on Mac/Android/ChromeOS),
 * otherwise the ZXing library (pure JavaScript, works everywhere, e.g. Chrome on Windows).
 * Only grocery barcode formats are enabled: fewer formats = faster and fewer false reads.
 *
 * Small barcodes (water bottles, yogurt cups) need every pixel: an EAN-13 has 95 bars, so it
 * must be ~200+ px wide in the image to read. So we never shrink the guide-box area: each
 * scan alternates between
 *   1. the guide box in the middle of the picture, at the camera's full resolution
 *   2. the whole picture (capped at 1280 px wide) for barcodes held off-center
 */
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library'

export type BarcodeHit = { code: string; format: string }

const PRODUCT_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const
const FULL_FRAME_MAX_WIDTH = 1280

/**
 * The guide box, as fractions of the visible camera area (the Camera tab shows a 4:3 view,
 * cropped from the middle of a widescreen feed). CameraFeed draws the same box on screen.
 */
export const GUIDE_BOX = { width: 0.55, height: 0.5 }

type Region = { sx: number; sy: number; sw: number; sh: number; scale: number }

/** Where the guide box is in real video pixels. */
function guideRegion(video: HTMLVideoElement): Region {
  const vw = video.videoWidth
  const vh = video.videoHeight
  const visibleW = Math.min(vw, (vh * 4) / 3) // what the 4:3 preview shows
  const sw = Math.round(visibleW * GUIDE_BOX.width)
  const sh = Math.round(vh * GUIDE_BOX.height)
  return { sx: Math.round((vw - sw) / 2), sy: Math.round((vh - sh) / 2), sw, sh, scale: 1 }
}

function fullRegion(video: HTMLVideoElement): Region {
  const scale = Math.min(1, FULL_FRAME_MAX_WIDTH / video.videoWidth)
  return { sx: 0, sy: 0, sw: video.videoWidth, sh: video.videoHeight, scale }
}

type NativeDetector = { detect(source: CanvasImageSource): Promise<{ rawValue: string; format: string }[]> }

export async function createBarcodeReader(): Promise<{ engine: 'native' | 'zxing'; read(video: HTMLVideoElement): Promise<BarcodeHit | null> }> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  let pass = 0

  /** Copy the next region to scan onto the canvas. Alternates guide box / whole frame. */
  function drawNextRegion(video: HTMLVideoElement): boolean {
    if (video.readyState < 2 || !video.videoWidth) return false
    const r = pass++ % 2 === 0 ? guideRegion(video) : fullRegion(video)
    canvas.width = Math.round(r.sw * r.scale)
    canvas.height = Math.round(r.sh * r.scale)
    ctx.drawImage(video, r.sx, r.sy, r.sw, r.sh, 0, 0, canvas.width, canvas.height)
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
            if (!drawNextRegion(video)) return null
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
  hints.set(DecodeHintType.TRY_HARDER, true) // scans more rows + rotated; slower but finds small/tilted codes
  reader.setHints(hints)

  function decode(luminance: Uint8ClampedArray, width: number, height: number, Binarizer: typeof HybridBinarizer | typeof GlobalHistogramBinarizer) {
    try {
      const result = reader.decodeWithState(new BinaryBitmap(new Binarizer(new RGBLuminanceSource(luminance, width, height))))
      return { code: result.getText(), format: BarcodeFormat[result.getBarcodeFormat()].toLowerCase() }
    } catch {
      return null // not found / bad checksum → try again next frame
    } finally {
      reader.reset()
    }
  }

  return {
    engine: 'zxing',
    async read(video) {
      if (!drawNextRegion(video)) return null
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      // ZXing wants one brightness value per pixel
      const luminance = new Uint8ClampedArray(width * height)
      for (let i = 0, j = 0; j < luminance.length; i += 4, j++) {
        luminance[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8
      }
      // Hybrid handles uneven light; GlobalHistogram copes better with washed-out, low-contrast images
      return decode(luminance, width, height, HybridBinarizer) ?? decode(luminance, width, height, GlobalHistogramBinarizer)
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
