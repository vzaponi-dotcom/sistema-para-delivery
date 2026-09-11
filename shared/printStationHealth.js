const OFFLINE_CODES = new Set([67108864, 0x4000000])
const OFFLINE_MARKERS = ['OFFLINE', 'DISCONNECTED', 'UNAVAILABLE']
const ATTENTION_MARKERS = [
  'PAPER',
  'ERROR',
  'INTERVENTION',
  'PAUSED',
  'JAM',
  'COVER',
]

const textOf = (status) => String(
  typeof status === 'string' ? status : status?.text ?? status?.statusText ?? status?.message ?? '',
).trim().toUpperCase()

const codeOf = (status) => {
  const code = typeof status === 'object' ? status?.code ?? status?.statusCode : undefined
  return Number.isFinite(Number(code)) ? Number(code) : null
}

const notReady = (state) => ({ state, ready: false })

export function normalizePrinterHealth(input = {}) {
  const qzConnected = input.qzConnected ?? input.qzReady ?? input.connected ?? false
  const queueFound = input.configuredQueueFound
    ?? input.configuredPrinterFound
    ?? input.printerFound
    ?? input.queueFound
    ?? false

  if (!qzConnected) return notReady('qz_unavailable')
  if (!queueFound) return notReady('unconfigured')

  const status = input.physicalStatus ?? input.physicalState ?? input.printerStatus ?? {
    text: input.statusText,
    code: input.statusCode,
  }
  const text = textOf(status)
  const code = codeOf(status)
  if (OFFLINE_CODES.has(code) || OFFLINE_MARKERS.some((marker) => text.includes(marker))) {
    return notReady('printer_offline')
  }
  if (ATTENTION_MARKERS.some((marker) => text.includes(marker))) {
    return notReady('printer_attention')
  }
  if (text === 'OK' || text === 'PRINTER OK') {
    return { state: 'ready', ready: true }
  }
  return notReady('verifying')
}
