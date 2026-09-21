const emptyStatus = () => ({
  code: 'no_primary',
  primaryStation: null,
  isLocalPrimary: false,
  source: 'none',
  physicalState: null,
})

const resolvePrimaryStation = (stations, localStation) => {
  const primary = Array.isArray(stations)
    ? stations.find((station) => station?.isPrimary)
    : null
  if (primary) return primary
  return localStation?.isPrimary ? localStation : null
}

const sameStation = (left, right) => {
  if (!left || !right) return false
  if (left.id && right.id) return left.id === right.id
  return left === right
}

const status = (code, primaryStation, isLocalPrimary, source, physicalState) => ({
  code,
  primaryStation,
  isLocalPrimary,
  source,
  physicalState: physicalState ?? null,
})

const remotePhysicalState = (primaryStation) => (
  primaryStation?.physicalState
  ?? primaryStation?.health?.physicalState
  ?? null
)

const localPhysicalState = (printerHealth, primaryStation) => (
  printerHealth?.state
  ?? remotePhysicalState(primaryStation)
)

export const derivePrintOperationalStatus = ({
  stations = [],
  localStation = null,
  transportKind = 'queue-only',
  printerState = null,
  qzConnected = false,
  configuredPrinterName = null,
  printerQueueFound = false,
  printerHealth = null,
} = {}) => {
  const primaryStation = resolvePrimaryStation(stations, localStation)
  if (!primaryStation) return emptyStatus()

  const isLocalPrimary = sameStation(primaryStation, localStation)

  if (isLocalPrimary && transportKind === 'qz') {
    const physicalState = localPhysicalState(printerHealth, primaryStation)
    const local = (code) => status(code, primaryStation, true, 'local', physicalState)

    const hasConfiguredPrinter = Boolean(String(configuredPrinterName || '').trim())

    // Once this station already has a configured printer, an unavailable QZ
    // connection remains an operational QZ outage even if a reconnect attempt
    // temporarily reports "connecting" or "verifying". This prevents polling
    // retries from flashing a neutral state over a known outage.
    if (!qzConnected && hasConfiguredPrinter) return local('qz_unavailable')
    if (printerState === 'connecting') return local('verifying')
    if (printerState === 'disconnected') return local('qz_unavailable')

    // On first-time setup there is no configured printer identity yet, so keep
    // the startup state neutral until QZ positively connects.
    if (!qzConnected) return local('verifying')

    if (!String(configuredPrinterName || '').trim()) return local('printer_unconfigured')
    if (!printerQueueFound) return local('printer_unavailable')

    if (physicalState === 'ready' || printerHealth?.ready === true) return local('ready')
    if (['printer_offline', 'printer_attention', 'printer_not_found', 'unconfigured', 'unsupported'].includes(physicalState)) {
      return local('printer_unavailable')
    }

    return local('verifying')
  }

  const health = primaryStation?.health
  const physicalState = remotePhysicalState(primaryStation)
  const remote = (code) => status(code, primaryStation, isLocalPrimary, 'heartbeat', physicalState)

  if (!health || typeof health.online !== 'boolean') return remote('verifying')
  if (!health.online) return remote('primary_offline')

  if (typeof health.qzReady !== 'boolean') return remote('verifying')
  if (!health.qzReady) return remote('qz_unavailable')

  if (typeof health.printerReady !== 'boolean') return remote('verifying')
  if (!health.printerReady) return remote('printer_unavailable')

  return remote('ready')
}
