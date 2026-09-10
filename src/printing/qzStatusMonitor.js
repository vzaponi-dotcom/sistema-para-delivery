const qzObservationError = (cause) => Object.assign(
  new Error('A observação do status da impressora foi interrompida.'),
  { code: 'QZ_OBSERVATION_LOST', cause },
)

const text = (value) => {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

const statusCode = (value) => {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const eventValue = (event, key) => event?.[key] ?? event?.printer?.[key]

const normalizeQzStatusEvent = (event = {}) => ({
  printerName: text(event.printerName ?? event.printer?.name ?? event.printer),
  eventType: text(event.eventType ?? event.type)?.toUpperCase() ?? null,
  statusText: text(event.statusText ?? event.status ?? event.message),
  statusCode: statusCode(event.statusCode ?? event.code),
  severity: text(event.severity)?.toUpperCase() ?? null,
  jobId: eventValue(event, 'jobId') ?? null,
  jobName: text(eventValue(event, 'jobName')),
})

export const classifyQzPrinterStatus = (event) => {
  const normalized = normalizeQzStatusEvent(event)
  const signal = [normalized.statusText, normalized.severity].filter(Boolean).join(' ').toUpperCase()
  if (normalized.statusText?.toUpperCase() === 'OK') {
    return { state: 'ready', ready: true, statusText: normalized.statusText, statusCode: normalized.statusCode }
  }
  if (signal.includes('OFFLINE')) {
    return { state: 'printer_offline', ready: false, statusText: normalized.statusText, statusCode: normalized.statusCode }
  }
  if (/(PAPER|ERROR|INTERVENTION)/.test(signal)) {
    return { state: 'printer_attention', ready: false, statusText: normalized.statusText, statusCode: normalized.statusCode }
  }
  return { state: 'verifying', ready: false, statusText: normalized.statusText, statusCode: normalized.statusCode }
}

const printerKey = (printerName) => text(printerName)?.toLocaleLowerCase() ?? ''
const isGestaoDeliveryJob = (jobName) => /^GESTAO[\s_-]+DELIVERY:/i.test(String(jobName ?? '').trim())
const isConnectionLoss = (event) => event.eventType?.includes('CONNECTION')
  && (event.eventType.includes('LOST') || /(CLOSED|DISCONNECT|OFFLINE|LOST)/.test(event.statusText?.toUpperCase() ?? ''))

export const createQzStatusMonitor = ({ qzApi, printerName, onPrinterStatus, onJobStatus } = {}) => {
  const selectedPrinter = text(printerName)
  const selectedKey = printerKey(selectedPrinter)
  const waiters = new Map()
  let listening = false

  const failPending = (cause) => {
    const error = cause?.code === 'QZ_OBSERVATION_LOST' ? cause : qzObservationError(cause)
    for (const pending of waiters.values()) {
      for (const waiter of pending) waiter.reject(error)
    }
    waiters.clear()
  }

  const settle = (event) => {
    const pending = waiters.get(event.jobName)
    if (!pending) return
    waiters.delete(event.jobName)
    for (const waiter of pending) waiter.resolve(event)
  }

  const receive = (rawEvent) => {
    const event = normalizeQzStatusEvent(rawEvent)
    if (!event.printerName || printerKey(event.printerName) !== selectedKey) return
    if (isConnectionLoss(event)) {
      failPending()
      return
    }
    if (event.eventType === 'PRINTER') {
      onPrinterStatus?.(classifyQzPrinterStatus(event))
      return
    }
    if (event.eventType !== 'JOB' || !isGestaoDeliveryJob(event.jobName)) return
    onJobStatus?.(event)
    if (event.statusText?.toUpperCase() === 'COMPLETE') settle(event)
  }

  return {
    start: async () => {
      if (listening) return
      qzApi.printers.setPrinterCallbacks(receive)
      try {
        await qzApi.printers.startListening(selectedPrinter)
        listening = true
        const current = await qzApi.printers.getStatus()
        for (const event of Array.isArray(current) ? current : [current]) {
          if (event) receive(event)
        }
      } catch (error) {
        failPending(error)
        throw error
      }
    },
    stop: async () => {
      if (listening) await qzApi.printers.stopListening()
      listening = false
      failPending()
    },
    awaitJobOutcome: (jobName) => new Promise((resolve, reject) => {
      const key = text(jobName)
      const pending = waiters.get(key) || new Set()
      pending.add({ resolve, reject })
      waiters.set(key, pending)
    }),
    failPending,
  }
}
