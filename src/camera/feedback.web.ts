/**
 * Browser: a short two-tone "beep-beep" when a barcode is read, made with the Web Audio API
 * (no sound file needed). Browsers only allow sound after the user has clicked the page once,
 * which is always true here since they had to allow the camera.
 */
let audio: AudioContext | null = null

export function barcodeReadFeedback() {
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext
    if (!Ctx) return
    audio ??= new Ctx()
    if (audio.state === 'suspended') audio.resume().catch(() => {})
    const now = audio.currentTime
    for (const [start, freq] of [[0, 1320], [0.11, 1760]] as const) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      // Quick fade in/out so it clicks less
      gain.gain.setValueAtTime(0, now + start)
      gain.gain.linearRampToValueAtTime(0.18, now + start + 0.01)
      gain.gain.linearRampToValueAtTime(0, now + start + 0.09)
      osc.connect(gain).connect(audio.destination)
      osc.start(now + start)
      osc.stop(now + start + 0.1)
    }
    navigator.vibrate?.(60) // phones/tablets using the web version
  } catch {
    // sound is a nice-to-have; never break scanning over it
  }
}
