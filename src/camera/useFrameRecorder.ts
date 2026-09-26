import { useCallback, useRef } from 'react'
import { grabFrame, pickFrames } from './frames'

const CAPTURE_EVERY_N_SAMPLES = 2 // motion samples come every 150ms → a frame every ~300ms
const PRE_BUFFER = 4 // frames kept from just BEFORE motion is confirmed (~1.2s)
const MAX_DURING = 50 // cap memory during very long events
const DURING_TO_SEND = 4 // + 1 before + 1 after = 6 photos per movement
/** A frame counts as "moving" if it changed at least this share of the event's peak. */
const MOVING_SHARE_OF_PEAK = 0.35

/**
 * Records frames around each motion event.
 *
 *   ...idle... [pre][pre][pre][pre] | [during][during]... | [final]
 *                  before       |   hand + item       | after the hand left
 *
 * Pass `onSample` to useMotionDetector, and call `finishEvent()` when motion ends
 * to get the frames to send to the AI.
 */
export function useFrameRecorder(video: HTMLVideoElement | null) {
  const pre = useRef<string[]>([])
  const during = useRef<{ frame: string; level: number; t: number }[]>([])
  const tick = useRef(0)

  const onSample = useCallback(
    ({ active, level, now }: { active: boolean; level: number; now: number }) => {
      if (!video) return
      tick.current++
      if (tick.current % CAPTURE_EVERY_N_SAMPLES !== 0) return
      const frame = grabFrame(video)
      if (!frame) return

      if (active) {
        during.current.push({ frame, level, t: now })
        if (during.current.length > MAX_DURING) {
          // Too long: drop the calmest frame so the busiest ones survive
          let calmest = 0
          during.current.forEach((d, i) => { if (d.level < during.current[calmest].level) calmest = i })
          during.current.splice(calmest, 1)
        }
      } else {
        pre.current.push(frame)
        if (pre.current.length > PRE_BUFFER) pre.current.shift()
      }
    },
    [video]
  )

  const finishEvent = useCallback((): string[] => {
    const final = video ? grabFrame(video) : null
    const before = pre.current[0] // oldest = most likely before the hand arrived
    const moving = during.current
    pre.current = []
    during.current = []

    // The item is visible while the picture is changing, so send 4 "during" frames spread
    // across the part of the event where things were actually moving (the end of an event
    // is 1.5s of stillness, which would waste frames):
    //   [before] [moving 1] [moving 2] [moving 3] [moving 4] [after]
    if (before && final && moving.length > 0) {
      return [before, ...pickMoving(moving, DURING_TO_SEND).map(m => m.frame), final]
    }
    // Very short events: just spread evenly over whatever we have
    return pickFrames([...(before ? [before] : []), ...moving.map(m => m.frame), ...(final ? [final] : [])], DURING_TO_SEND + 2)
  }, [video])

  return { onSample, finishEvent }
}

/**
 * Choose `count` frames that show the movement: keep frames with real motion (a share of the
 * event's peak), spread them evenly in time, and top up with the next-busiest if there are too few.
 */
function pickMoving<T extends { level: number; t: number }>(frames: T[], count: number): T[] {
  if (frames.length <= count) return frames
  const peak = Math.max(...frames.map(f => f.level))
  const active = frames.filter(f => f.level >= peak * MOVING_SHARE_OF_PEAK)
  if (active.length >= count) return pickFrames(active, count)
  const extra = frames
    .filter(f => !active.includes(f))
    .sort((a, b) => b.level - a.level)
    .slice(0, count - active.length)
  return [...active, ...extra].sort((a, b) => a.t - b.t)
}
