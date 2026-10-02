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
  let storageUnavailable = false
  try { if (!windowObject?.localStorage?.getItem) storageUnavailable = true; else windowObject.localStorage.getItem(STORAGE_KEY) } catch { storageUnavailable = true }
  const receiveFocus = () => { if (!channel && storageUnavailable) onInvalidate?.() }
  windowObject?.addEventListener?.('focus', receiveFocus)
  return {
    publish() {
      const message = { type: 'session-change', id: globalThis.crypto.randomUUID() }
      lastId = message.id
      try { channel?.postMessage(message) } catch { /* storage events remain available */ }
      try { windowObject?.localStorage?.setItem(STORAGE_KEY, JSON.stringify(message)) } catch { storageUnavailable = true }
    },
    close() { channel?.close(); windowObject?.removeEventListener?.('storage', receiveStorage); windowObject?.removeEventListener?.('focus', receiveFocus) },
  }
}
