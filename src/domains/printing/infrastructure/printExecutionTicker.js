const defaultWorkerFactory = () => {
  if (typeof Worker !== 'function') return null
  return new Worker(new URL('./printExecutionWorker.js', import.meta.url), {
    type: 'module',
    name: 'mesiva-print-execution',
  })
}

export const createPrintExecutionTicker = ({
  intervalMs,
  workerFactory = defaultWorkerFactory,
  setIntervalImpl = globalThis.setInterval?.bind(globalThis),
  clearIntervalImpl = globalThis.clearInterval?.bind(globalThis),
} = {}) => {
  const cadence = Math.max(250, Number(intervalMs) || 2000)
  let worker = null
  let timer = null
  let onTick = null
  let stopped = true

  const clearFallback = () => {
    if (timer != null) clearIntervalImpl?.(timer)
    timer = null
  }

  const clearWorker = () => {
    if (!worker) return
    try { worker.postMessage?.({ type: 'stop' }) } catch { /* worker may already be gone */ }
    try { worker.terminate?.() } catch { /* best effort cleanup */ }
    worker = null
  }

  const stop = () => {
    stopped = true
    clearFallback()
    clearWorker()
    onTick = null
  }

  const startFallback = () => {
    clearFallback()
    if (typeof setIntervalImpl !== 'function' || typeof onTick !== 'function' || stopped) return
    timer = setIntervalImpl(() => {
      if (!stopped) onTick?.()
    }, cadence)
  }

  const start = (callback) => {
    if (typeof callback !== 'function') throw new TypeError('print execution ticker requires a callback')
    stop()
    stopped = false
    onTick = callback

    try {
      worker = workerFactory?.() || null
    } catch {
      worker = null
    }

    if (worker) {
      worker.onmessage = (event) => {
        if (!stopped && event?.data?.type === 'tick') onTick?.()
      }
      worker.onerror = () => {
        if (stopped) return
        clearWorker()
        startFallback()
      }
      try {
        worker.postMessage({ type: 'start', intervalMs: cadence })
        return stop
      } catch {
        clearWorker()
      }
    }

    startFallback()
    return stop
  }

  return { start, stop }
}
