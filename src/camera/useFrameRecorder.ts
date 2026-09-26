import { useCallback, useRef } from 'react'
import { grabFrame, pickFrames } from './frames'

const CAPTURE_EVERY_N_SAMPLES = 3 // motion samples come every 150ms → a frame every ~450ms
const PRE_BUFFER = 3 // frames kept from just BEFORE motion is confirmed (~1.3s)
const MAX_DURING = 40 // cap memory during very long events
const FRAMES_TO_SEND = 4

/**
 * Records frames around each motion event.
 *
 *   ...idle... [pre][pre][pre] | [during][during]... | [final]
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

    // The item is visible when the picture is changing most, so send the 2 "during" frames
    // with the most motion (in time order). The end of an event is 1.5s of stillness,
    // so evenly spaced frames would often miss the item.
    //   [before] [busiest] [2nd busiest] [after]
    if (before && final && moving.length >= 2) {
      const busiest = [...moving].sort((x, y) => y.level - x.level).slice(0, 2).sort((x, y) => x.t - y.t)
      return [before, busiest[0].frame, busiest[1].frame, final]
    }
    // Short events: just spread evenly over whatever we have
    return pickFrames([...(before ? [before] : []), ...moving.map(m => m.frame), ...(final ? [final] : [])], FRAMES_TO_SEND)
  }, [video])

  return { onSample, finishEvent }
}
