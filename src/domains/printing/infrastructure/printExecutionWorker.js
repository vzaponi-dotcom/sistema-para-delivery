let timer = null

const stop = () => {
  if (timer != null) clearInterval(timer)
  timer = null
}

self.onmessage = (event) => {
  const message = event?.data || {}
  if (message.type === 'stop') {
    stop()
    return
  }
  if (message.type !== 'start') return

  stop()
  const intervalMs = Math.max(250, Number(message.intervalMs) || 2000)
  timer = setInterval(() => {
    self.postMessage({ type: 'tick', at: Date.now() })
  }, intervalMs)
}
