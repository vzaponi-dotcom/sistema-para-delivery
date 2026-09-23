const defaultCreateContext = () => {
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext
  return AudioContext ? new AudioContext() : null
}

export function createKitchenDisplayAudio({ createContext = defaultCreateContext } = {}) {
  let context
  const getContext = () => {
    if (context === undefined) context = createContext()
    return context
  }

  const unlock = async () => {
    try {
      const current = getContext()
      if (!current) return false
      if (current.state === 'suspended') await current.resume()
      return current.state !== 'suspended'
    } catch {
      return false
    }
  }

  const playArrival = async () => {
    if (!await unlock()) return false
    try {
      const current = getContext()
      const oscillator = current.createOscillator()
      const gain = current.createGain()
      oscillator.frequency.setValueAtTime(880, current.currentTime)
      gain.gain.setValueAtTime(0.08, current.currentTime)
      oscillator.connect(gain)
      gain.connect(current.destination)
      oscillator.start(current.currentTime)
      oscillator.stop(current.currentTime + 0.16)
      return true
    } catch {
      return false
    }
  }

  return { unlock, playArrival }
}
