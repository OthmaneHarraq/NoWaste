/**
 * Motion detection logic, with no browser code, so it's easy to test and tune.
 *
 * 1. frameDifference(): how much of the picture changed between two tiny grayscale frames (0–1).
 * 2. MotionTracker: turns that stream of numbers into "motion started" / "motion ended" events,
 *    ignoring flickers (too short) and brief pauses in the middle of a movement.
 */

export type MotionSettings = {
  /** How much a single pixel's brightness (0–255) must change to count as "changed". */
  pixelThreshold: number
  /** Fraction of pixels that must change for a frame to count as motion (0.04 = 4%). */
  motionThreshold: number
  /** Motion must last this long before we call it a real event (filters flickers, light changes). */
  minMotionMs: number
  /** The scene must be still this long before the event ends (hands pause mid-movement). */
  quietMs: number
  /** Give up and end an event after this long (someone standing in front of the camera). */
  maxEventMs: number
}

export const DEFAULT_MOTION_SETTINGS: MotionSettings = {
  pixelThreshold: 30,
  motionThreshold: 0.04,
  minMotionMs: 300,
  quietMs: 1500,
  maxEventMs: 15000,
}

/**
 * Compare two same-size grayscale frames (one byte per pixel).
 * Returns the fraction of pixels whose brightness changed by more than pixelThreshold.
 */
export function frameDifference(prev: Uint8Array, curr: Uint8Array, pixelThreshold: number): number {
  if (prev.length !== curr.length || curr.length === 0) return 0
  let changed = 0
  for (let i = 0; i < curr.length; i++) {
    if (Math.abs(curr[i] - prev[i]) > pixelThreshold) changed++
  }
  return changed / curr.length
}

/** RGBA pixels (from a canvas) → grayscale, one byte per pixel. */
export function toGrayscale(rgba: Uint8ClampedArray): Uint8Array {
  const gray = new Uint8Array(rgba.length / 4)
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    // Standard luminance weights: the eye is most sensitive to green
    gray[j] = (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114) | 0
  }
  return gray
}

export type MotionEvent = { startedAt: number; endedAt: number; durationMs: number; peak: number }

export type TrackerUpdate =
  | { type: 'none' }
  | { type: 'start'; at: number }
  | { type: 'end'; event: MotionEvent }

/**
 * State machine fed with one motion reading per sample:
 *
 *   idle ──(motion)──▶ candidate ──(still moving after minMotionMs)──▶ active
 *     ▲                    │                                            │
 *     └────(stopped)───────┘      ◀──(still for quietMs, or maxEventMs)─┘  → 'end'
 */
export class MotionTracker {
  private state: 'idle' | 'candidate' | 'active' = 'idle'
  private startedAt = 0
  private lastMotionAt = 0
  private peak = 0
  private settings: MotionSettings

  constructor(settings: MotionSettings = DEFAULT_MOTION_SETTINGS) {
    this.settings = settings
  }

  setSettings(settings: MotionSettings) {
    this.settings = settings
  }

  get isActive() {
    return this.state === 'active'
  }

  reset() {
    this.state = 'idle'
    this.peak = 0
  }

  update(level: number, now: number): TrackerUpdate {
    const s = this.settings
    const moving = level >= s.motionThreshold

    switch (this.state) {
      case 'idle':
        if (moving) {
          this.state = 'candidate'
          this.startedAt = now
          this.lastMotionAt = now
          this.peak = level
        }
        return { type: 'none' }

      case 'candidate':
        if (!moving) {
          this.state = 'idle' // just a flicker
          return { type: 'none' }
        }
        this.lastMotionAt = now
        this.peak = Math.max(this.peak, level)
        if (now - this.startedAt >= s.minMotionMs) {
          this.state = 'active'
          return { type: 'start', at: this.startedAt }
        }
        return { type: 'none' }

      case 'active':
        if (moving) {
          this.lastMotionAt = now
          this.peak = Math.max(this.peak, level)
        }
        if (now - this.lastMotionAt >= s.quietMs || now - this.startedAt >= s.maxEventMs) {
          const event: MotionEvent = {
            startedAt: this.startedAt,
            endedAt: now,
            durationMs: now - this.startedAt,
            peak: this.peak,
          }
          this.reset()
          return { type: 'end', event }
        }
        return { type: 'none' }
    }
  }
}
