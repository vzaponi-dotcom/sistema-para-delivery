const CHANNEL = 'mesiva-session-change'
const STORAGE_KEY = 'delivery-session-change'
export function createBrowserSessionCoordinator({ onInvalidate, windowObject = globalThis.window, channelFactory = (name) => windowObject?.BroadcastChannel ? new windowObject.BroadcastChannel(name) : null } = {}) {
  let channel = null, lastId = null
  try { channel = channelFactory(CHANNEL) } catch { /* storage events remain available */ }
  const receive = (event) => {
    const message = event?.data
    if (message?.type !== 'session-change' || typeof message.id !== 'string' || message.id === lastId) return
    lastId = message.id
    onInvalidate?.()
  }
  const receiveStorage = (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return
    try { receive({ data: JSON.parse(event.newValue) }) } catch { /* ignore invalid external storage */ }
  }
  if (channel) channel.onmessage = receive
  windowObject?.addEventListener?.('storage', receiveStorage)
  return {
    publish() {
      const message = { type: 'session-change', id: globalThis.crypto.randomUUID() }
      lastId = message.id
      try { channel?.postMessage(message) } catch { /* storage events remain available */ }
      try { windowObject?.localStorage?.setItem(STORAGE_KEY, JSON.stringify(message)) } catch { /* channel handles storage denial */ }
    },
    close() { channel?.close(); windowObject?.removeEventListener?.('storage', receiveStorage) },
  }
}
