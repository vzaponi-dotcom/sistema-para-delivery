export const createBrowserOrderAlertPlayer = ({ windowObject = globalThis.window } = {}) => {
  let context = null
  const ensureContext = () => {
    const AudioContextClass = windowObject?.AudioContext || windowObject?.webkitAudioContext
    if (!AudioContextClass) return null
    if (!context) context = new AudioContextClass()
    return context
  }

  const play = async () => {
    const audio = ensureContext()
    if (!audio) return false
    try {
      if (audio.state === 'suspended') await audio.resume()
      if (audio.state !== 'running') return false
      const tone = (frequency, delay) => {
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        const startsAt = audio.currentTime + delay
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, startsAt)
        gain.gain.setValueAtTime(0.0001, startsAt)
        gain.gain.exponentialRampToValueAtTime(0.14, startsAt + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.18)
        oscillator.connect(gain)
        gain.connect(audio.destination)
        oscillator.start(startsAt)
        oscillator.stop(startsAt + 0.2)
      }
      tone(784, 0)
      tone(988, 0.16)
      return true
    } catch {
      return false
    }
  }

  return Object.freeze({
    play,
    unlock: async () => {
      const audio = ensureContext()
      if (audio?.state === 'suspended') {
        try { await audio.resume() } catch { return false }
      }
      return audio?.state === 'running'
    },
    close: async () => {
      if (context?.close) await context.close()
      context = null
    },
  })
}
