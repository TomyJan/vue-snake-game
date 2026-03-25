import { ref } from 'vue'

export function useSound() {
  const enabled = ref(true)
  let audioCtx: AudioContext | null = null

  function getAudioContext(): AudioContext {
    if (!audioCtx) {
      audioCtx = new AudioContext()
    }
    return audioCtx
  }

  function playTone(freq: number, duration: number, type: OscillatorType = 'square') {
    if (!enabled.value) return
    try {
      const ctx = getAudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + duration)
    } catch {
      // Audio not supported
    }
  }

  function playEat() {
    playTone(600, 0.1, 'square')
    setTimeout(() => playTone(800, 0.1, 'square'), 50)
  }

  function playHit() {
    playTone(200, 0.3, 'sawtooth')
  }

  function playStart() {
    playTone(400, 0.1, 'sine')
    setTimeout(() => playTone(500, 0.1, 'sine'), 100)
    setTimeout(() => playTone(600, 0.15, 'sine'), 200)
  }

  function toggleSound() {
    enabled.value = !enabled.value
  }

  return { enabled, toggleSound, playEat, playHit, playStart }
}
