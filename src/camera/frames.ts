/**
 * Grabbing still frames from the live <video> for the AI (web only; used by the Camera tab).
 */

const FRAME_WIDTH = 640 // big enough for the AI to read labels, small enough to upload fast
const JPEG_QUALITY = 0.7

let canvas: HTMLCanvasElement | null = null

/** Current video picture as a JPEG data URL ("data:image/jpeg;base64,..."), or null if not ready. */
export function grabFrame(video: HTMLVideoElement): string | null {
  if (typeof document === 'undefined' || video.readyState < 2 || !video.videoWidth) return null
  canvas ??= document.createElement('canvas')
  const scale = Math.min(1, FRAME_WIDTH / video.videoWidth)
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

/**
 * Pick `count` frames evenly spread across the list, always keeping the first and last.
 * First = before the hand arrived, last = after it left, middle = the item in motion.
 */
export function pickFrames<T>(frames: T[], count: number): T[] {
  if (frames.length <= count) return frames
  const picked: T[] = []
  for (let i = 0; i < count; i++) {
    picked.push(frames[Math.round((i * (frames.length - 1)) / (count - 1))])
  }
  return picked
}
