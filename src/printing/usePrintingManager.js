import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import qz from 'qz-tray'
import {
  acknowledgeSecondCopyPrompt as acknowledgeSecondCopyPromptApi,
  claimNextPrintJob,
  claimNextRecoveryPrintJob,
  claimPrintJob,
  completePrintJob,
  createPrintAttempt,
  createManualPrintJob,
  createManualTableTabPrintJob,
  createTestPrintJob,
  discardPendingPrintJobs,
  discardPrintJob,
  failPrintJob,
  forcePrintJob as forcePrintJobApi,
  getOrderPrintDocument,
  getTableTabPrintDocument,
  getPrintJobs,
  getPrintQueueSummary,
  getPrintStations,
  getQzCertificate,
  heartbeatPrintStation,
  makePrimaryPrintStation,
  markPrintAttemptSubmitting,
  prioritizePrintJob,
  reprintPrintJob,
  retryPrintJob,
  recordPrintAttemptEvent,
  resolvePrintOutcome,
  requestSecondCopy as requestSecondCopyApi,
  skipSecondCopy as skipSecondCopyApi,
  signQzPayload,
  setPrintStationRecovery,
  upsertPrintStation,
} from '../api/client.js'
import { renderEscPos58mm } from './escpos58mm.js'
import {
  detectPrintStationPlatform,
  getDefaultPrintStationName,
  getOrCreateLocalPrintStationId,
  getQzPrinterName,
  saveQzPrinterName,
} from './localPrintStation.js'
import { runClaimedPrintJob } from './printJobRunner.js'
import {
  canRunSingleRecoveryCopy,
  deriveRecoveryView,
  nextRecoveryState,
  runSingleRecoveryCopy,
} from './printRecoveryFlow.js'
import {
  configureQzSecurity,
  createQzReadinessController,
  deriveQzOperationalState,
  ensureQzConnected,
  listQzPrinters,
  printQzRawBytes,
  resolveQzPrinter,
} from './qzTrayTransport.js'
import { createQzStatusMonitor } from './qzStatusMonitor.js'

export const PRINT_JOB_POLL_MS = 2_000
export const PRINT_STATE_POLL_MS = 5_000
export const STATION_HEARTBEAT_MS = 15_000

const printerError = (code, message) => Object.assign(new Error(message), { code })
const visiblePage = () => typeof document === 'undefined' || document.visibilityState === 'visible'
const browserOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false
const QZ_BLOCKING_ERROR_CODES = new Set([
  'QZ_CONNECTION_FAILED',
  'QZ_PRINTER_NOT_CONFIGURED',
  'QZ_PRINTER_NOT_FOUND',
  'QZ_PRINT_FAILED',
])

export const getPrintingTransportKind = (platform) => {
  if (platform === 'windows') return 'qz'
  if (platform === 'android') return 'queue-only'
  return 'queue-only'
}

export const getRendererCompatibilityMode = (transportKind) => (
  transportKind === 'qz' ? 'mpt2-bitmap' : null
)

export const isPrintingTransportSupported = (platform) => getPrintingTransportKind(platform) === 'qz'

export const canConsumeAutomaticPrintJob = ({
  authenticated,
  isOnline,
  supported,
  visible,
  browserOnline: browserIsOnline,
  busyJobId,
  printerBlocked,
  transportReady,
  qzConnected = true,
  physicalReady = true,
  isQz = true,
  allowManual = false,
  station,
}) => Boolean(
  authenticated
  && isOnline
  && supported
  && visible
  && browserIsOnline
  && !busyJobId
  && !printerBlocked
  && transportReady
  && (!isQz || qzConnected)
  && physicalReady
  && isQz
  && station?.isPrimary
  && (station?.recoveryState ?? 'normal') === 'normal'
  && (allowManual || station?.autoPrintEnabled)
)

export const canExecuteSecondCopy = ({ isQz, station, job }) => Boolean(
  isQz
  && station?.isPrimary
  && station?.platform === 'windows'
  && job?.status === 'awaiting_second_copy'
  && Number(job?.copiesRequested) === 2
  && Number(job?.copiesPrinted) === 1
)

const isRecoveryAffinityJob = (station, job) => (
  ['active', 'deferred'].includes(station?.recoveryState)
  && Boolean(station?.recoveryJobId)
  && station.recoveryJobId === job?.id
)

export const canPresentSecondCopyPrompt = ({ isQz, transportReady, printerBlocked, station, job }) => (
  Boolean(transportReady)
  && !printerBlocked
  && ((station?.recoveryState ?? 'normal') === 'normal' || isRecoveryAffinityJob(station, job))
  && canExecuteSecondCopy({ isQz, station, job })
  && (!job?.secondCopyPromptedAt || isRecoveryAffinityJob(station, job))
)

export const canKeepSecondCopyPromptOpen = ({ isQz, transportReady, printerBlocked, station, job }) => (
  Boolean(transportReady)
  && !printerBlocked
  && ((station?.recoveryState ?? 'normal') === 'normal' || isRecoveryAffinityJob(station, job))
  && canExecuteSecondCopy({ isQz, station, job })
)

export const canInitializeBackgroundPhysicalTransport = ({
  authenticated,
  isOnline,
  isQz,
  station,
}) => Boolean(
  authenticated
  && isOnline
  && isQz
  && station?.isPrimary
  && station?.platform === 'windows'
)

export const initializeBackgroundPhysicalTransport = async ({
  authenticated,
  isOnline,
  isQz,
  station,
  initializeQz,
}) => {
  if (!canInitializeBackgroundPhysicalTransport({ authenticated, isOnline, isQz, station })) return false
  await initializeQz(station.id)
  return true
}

export const runExclusivePrintOperation = async ({ acquire, release, operation }) => {
  const owner = acquire()
  if (!owner) throw printerError('PRINT_OPERATION_BUSY', 'Outra impressão física já está em andamento.')
  try {
    return await operation()
  } finally {
    release(owner)
  }
}

const PHYSICAL_JOB_FAILURE_STATES = new Set(['failed', 'requires_attention'])

export const createPhysicalJobFailureNotifier = () => {
  const notified = new Set()
  const keyFor = (jobId, status) => `${jobId}:${status}`

  return {
    notify({ job, status, error, onNotify }) {
      if (!job?.id || !PHYSICAL_JOB_FAILURE_STATES.has(status) || typeof onNotify !== 'function') return false
      const key = keyFor(job.id, status)
      if (notified.has(key)) return false
      notified.add(key)
      onNotify(error, { jobId: job.id, status })
      return true
    },
    synchronize(currentJobs = []) {
      const currentFailureKeys = new Set(currentJobs
        .filter((job) => job?.id && PHYSICAL_JOB_FAILURE_STATES.has(job.status))
        .map((job) => keyFor(job.id, job.status)))
      for (const key of notified) {
        if (!currentFailureKeys.has(key)) notified.delete(key)
      }
    },
  }
}

export const claimAndExecuteSecondCopy = async ({
  isQz,
  transportReady,
  printerBlocked,
  station,
  job,
  claimJob,
  executeJob,
}) => {
  if (!canKeepSecondCopyPromptOpen({ isQz, transportReady, printerBlocked, station, job })) {
    throw printerError('PRINT_SECOND_COPY_NOT_READY', 'A segunda via não está disponível para este trabalho.')
  }
  const claimed = await claimJob(job.id, station.id)
  return executeJob(claimed.job)
}

export const canSendPrintStationHeartbeat = ({
  authenticated,
  isOnline,
  browserOnline: browserIsOnline,
  isQz,
  station,
}) => Boolean(
  authenticated
  && isOnline
  && browserIsOnline
  && isQz
  && station?.id
  && station?.isPrimary
  && station?.platform === 'windows'
)

export const buildPrintStationHeartbeatHealth = ({
  qzActive,
  transportReady,
  configuredPrinterName,
  printerHealth = {},
}) => {
  const physicalState = printerHealth.state === 'ready' ? 'ready' : (printerHealth.state || 'verifying')
  const physicalStatusText = printerHealth.statusText ?? null
  const physicalStatusCode = Number.isInteger(printerHealth.statusCode) ? printerHealth.statusCode : null
  const state = deriveQzOperationalState({
    qzConnected: qzActive,
    printerQueueConfigured: Boolean(String(configuredPrinterName || '').trim()),
    printerQueueFound: transportReady,
    physicalState,
  })
  return {
    qzReady: state.qzConnected,
    printerReady: state.operationalReady,
    physicalState,
    physicalStatusText,
    physicalStatusCode,
  }
}

export const usePrintingManager = ({ authenticated = false, isOnline = true, onPhysicalJobFailure } = {}) => {
  const platform = detectPrintStationPlatform()
  const transportKind = getPrintingTransportKind(platform)
  const supported = isPrintingTransportSupported(platform)
  const isQz = transportKind === 'qz'
  const [localStation, setLocalStation] = useState(null)
  const [stations, setStations] = useState([])
  const [jobs, setJobs] = useState([])
  const [printerState, setPrinterState] = useState(supported ? 'unconfigured' : 'unsupported')
  const [printerBlocked, setPrinterBlocked] = useState(false)
  const [busyJobId, setBusyJobId] = useState(null)
  const [lastError, setLastError] = useState(null)
  const [availablePrinters, setAvailablePrinters] = useState([])
  const [configuredPrinterName, setConfiguredPrinterName] = useState(null)
  const [qzConnected, setQzConnected] = useState(false)
  const [printerQueueFound, setPrinterQueueFound] = useState(false)
  const [transportReady, setTransportReady] = useState(false)
  const [printerHealth, setPrinterHealth] = useState({ state: 'verifying', ready: false, statusText: null, statusCode: null })
  const [recoveryPendingCount, setRecoveryPendingCount] = useState(0)

  const portRef = useRef(null)
  const localStationRef = useRef(null)
  const busyJobIdRef = useRef(null)
  const printerBlockedRef = useRef(false)
  const configuredPrinterNameRef = useRef(null)
  const qzConnectedRef = useRef(false)
  const printerQueueFoundRef = useRef(false)
  const transportReadyRef = useRef(false)
  const printerHealthRef = useRef({ state: 'verifying', ready: false, statusText: null, statusCode: null })
  const qzStatusMonitorRef = useRef(null)
  const qzStatusMonitorPrinterRef = useRef(null)
  const qzAttemptByNameRef = useRef(new Map())
  const qzSecurityConfiguredRef = useRef(false)
  const qzReadinessRef = useRef(createQzReadinessController())
  const initializationRef = useRef(0)
  const heartbeatInFlightRef = useRef(false)
  const heartbeatSequenceRef = useRef(0)
  const [physicalJobFailureNotifier] = useState(createPhysicalJobFailureNotifier)
  const recoveryView = deriveRecoveryView({
    recoveryState: localStation?.recoveryState,
    physicalReady: printerHealth.state === 'ready',
    safeBacklog: recoveryPendingCount,
  })
  const printOperationRef = useRef(null)
  const printOperationSequenceRef = useRef(0)

  const updateLocalStation = useCallback((station) => {
    localStationRef.current = station || null
    setLocalStation(station || null)
  }, [])

  const updateBlocked = useCallback((blocked) => {
    const value = Boolean(blocked)
    printerBlockedRef.current = value
    setPrinterBlocked(value)
  }, [])

  const updateBusyJob = useCallback((jobId) => {
    const value = jobId || null
    busyJobIdRef.current = value
    setBusyJobId(value)
  }, [])

  const acquirePrintOperation = useCallback(({ busyKey = null } = {}) => {
    if (printOperationRef.current) return null
    const owner = {
      token: ++printOperationSequenceRef.current,
      generation: initializationRef.current,
      busyKey,
    }
    printOperationRef.current = owner
    if (busyKey) updateBusyJob(busyKey)
    return owner
  }, [updateBusyJob])

  const ownsPrintOperation = useCallback((owner) => (
    printOperationRef.current?.token === owner?.token
    && initializationRef.current === owner?.generation
  ), [])

  const releasePrintOperation = useCallback((owner) => {
    if (!ownsPrintOperation(owner)) return
    printOperationRef.current = null
    if (owner.busyKey) updateBusyJob(null)
  }, [ownsPrintOperation, updateBusyJob])

  const updateConfiguredPrinterName = useCallback((printerName) => {
    const value = String(printerName || '').trim() || null
    configuredPrinterNameRef.current = value
    setConfiguredPrinterName(value)
  }, [])

  const updateQzConnected = useCallback((connected) => {
    const value = Boolean(connected)
    qzConnectedRef.current = value
    setQzConnected(value)
  }, [])

  const updatePrinterQueueFound = useCallback((found) => {
    const value = Boolean(found)
    printerQueueFoundRef.current = value
    setPrinterQueueFound(value)
  }, [])

  const updateTransportReady = useCallback((ready) => {
    const value = Boolean(ready)
    transportReadyRef.current = value
    setTransportReady(value)
  }, [])

  const updatePrinterHealth = useCallback((health = {}) => {
    const next = {
      state: health.state || 'verifying',
      ready: health.state === 'ready',
      statusText: health.statusText ?? null,
      statusCode: Number.isInteger(health.statusCode) ? health.statusCode : null,
    }
    printerHealthRef.current = next
    setPrinterHealth(next)
    return next
  }, [])

  const reportError = useCallback((error) => {
    setLastError(error || null)
  }, [])

  const notifyPhysicalJobFailure = useCallback((job, status, error) => (
    physicalJobFailureNotifier.notify({ job, status, error, onNotify: onPhysicalJobFailure })
  ), [onPhysicalJobFailure, physicalJobFailureNotifier])

  const ensureQzStatusMonitor = useCallback(async (printerName) => {
    if (qzStatusMonitorRef.current && qzStatusMonitorPrinterRef.current === printerName) return qzStatusMonitorRef.current
    await qzStatusMonitorRef.current?.stop?.()
    updatePrinterHealth({ state: 'verifying' })
    updateTransportReady(false)
    const monitor = createQzStatusMonitor({
      qzApi: qz,
      printerName,
      onPrinterStatus: (health) => {
        updatePrinterHealth(health)
        updateTransportReady(health.state === 'ready')
        setPrinterState(health.state === 'ready' ? 'connected' : health.state)
      },
      onJobStatus: (event) => {
        const tracked = qzAttemptByNameRef.current.get(event.jobName)
        if (!tracked || event.statusText === 'COMPLETE') return
        void recordPrintAttemptEvent(tracked.id, tracked.stationId, {
          type: event.statusText,
          jobName: event.jobName,
          ...(event.jobId != null ? { spoolJobId: event.jobId } : {}),
        }).catch(reportError)
      },
    })
    qzStatusMonitorRef.current = monitor
    qzStatusMonitorPrinterRef.current = printerName
    await monitor.start()
    return monitor
  }, [reportError, updatePrinterHealth, updateTransportReady])

  const configureQz = useCallback(() => {
    if (qzSecurityConfiguredRef.current) return
    configureQzSecurity({
      qzApi: qz,
      getCertificate: getQzCertificate,
      signPayload: signQzPayload,
    })
    qz.websocket?.setClosedCallbacks?.([
      () => {
        void qzStatusMonitorRef.current?.stop?.()
        qzStatusMonitorRef.current = null
        qzStatusMonitorPrinterRef.current = null
        qzReadinessRef.current.invalidate()
        updateQzConnected(false)
        updatePrinterQueueFound(false)
        updateTransportReady(false)
        updatePrinterHealth({ state: 'verifying' })
        setPrinterState('disconnected')
      },
    ])
    qzSecurityConfiguredRef.current = true
  }, [updatePrinterHealth, updatePrinterQueueFound, updateQzConnected, updateTransportReady])

  const refresh = useCallback(async ({ generation: expectedGeneration } = {}) => {
    if (!authenticated) return { stations: [], jobs: [] }
    const [stationPayload, jobPayload, summaryPayload] = await Promise.all([getPrintStations(), getPrintJobs({ limit: 100 }), getPrintQueueSummary()])
    const nextStations = Array.isArray(stationPayload?.stations) ? stationPayload.stations : []
    const nextJobs = Array.isArray(jobPayload?.jobs) ? jobPayload.jobs : []
    if (expectedGeneration !== undefined && expectedGeneration !== initializationRef.current) {
      return { stations: nextStations, jobs: nextJobs, summary: summaryPayload?.summary ?? {}, stale: true }
    }
    setStations(nextStations)
    setJobs(nextJobs)
    setRecoveryPendingCount(Math.max(0, Number(summaryPayload?.summary?.safeBacklog) || 0))
    physicalJobFailureNotifier.synchronize(nextJobs)
    const stationId = localStationRef.current?.id
    if (stationId) {
      const serverStation = nextStations.find((station) => station.id === stationId)
      if (serverStation) updateLocalStation(serverStation)
    }
    return { stations: nextStations, jobs: nextJobs, summary: summaryPayload?.summary ?? {} }
  }, [authenticated, physicalJobFailureNotifier, updateLocalStation])

  const resolveConfiguredQzPrinter = useCallback(async (stationId) => {
    if (!isQz || !stationId) return null
    configureQz()
    if (!transportReadyRef.current) setPrinterState('connecting')
    try {
      await ensureQzConnected(qz)
      updateQzConnected(Boolean(qz.websocket?.isActive?.()))
      const savedPrinterName = getQzPrinterName(globalThis.localStorage, stationId)
      updateConfiguredPrinterName(savedPrinterName)
      if (!savedPrinterName) {
        updatePrinterQueueFound(false)
        updateTransportReady(false)
        setPrinterState('unconfigured')
        return null
      }
      const resolvedPrinter = await qzReadinessRef.current.probe(
        () => resolveQzPrinter(qz, savedPrinterName),
      )
      updateConfiguredPrinterName(resolvedPrinter)
      updatePrinterQueueFound(true)
      await ensureQzStatusMonitor(resolvedPrinter)
      updateBlocked(false)
      setPrinterState(printerHealthRef.current.state === 'ready' ? 'connected' : 'verifying')
      setLastError(null)
      return resolvedPrinter
    } catch (error) {
      if (error?.code === 'QZ_STALE_PROBE') return null
      updateQzConnected(Boolean(qz.websocket?.isActive?.()))
      updatePrinterQueueFound(false)
      updateTransportReady(false)
      setPrinterState(error?.code === 'QZ_PRINTER_NOT_FOUND' ? 'unconfigured' : 'disconnected')
      if (QZ_BLOCKING_ERROR_CODES.has(error?.code)) updateBlocked(true)
      reportError(error)
      return null
    }
  }, [configureQz, ensureQzStatusMonitor, isQz, reportError, updateBlocked, updateConfiguredPrinterName, updatePrinterQueueFound, updateQzConnected, updateTransportReady])

  const refreshPrinters = useCallback(async () => {
    if (!isQz) return []
    configureQz()
    setPrinterState('connecting')
    try {
      await ensureQzConnected(qz)
      updateQzConnected(Boolean(qz.websocket?.isActive?.()))
      const printers = await listQzPrinters(qz)
      setAvailablePrinters(printers)
      const savedPrinterName = configuredPrinterNameRef.current || getQzPrinterName(globalThis.localStorage, localStationRef.current?.id)
      const found = Boolean(savedPrinterName && printers.includes(savedPrinterName))
      updatePrinterQueueFound(found)
      updateTransportReady(false)
      setPrinterState(savedPrinterName ? 'connected' : 'unconfigured')
      setLastError(null)
      return printers
    } catch (error) {
      updateQzConnected(Boolean(qz.websocket?.isActive?.()))
      updateTransportReady(false)
      setPrinterState('disconnected')
      if (QZ_BLOCKING_ERROR_CODES.has(error?.code)) updateBlocked(true)
      reportError(error)
      throw error
    }
  }, [configureQz, isQz, reportError, updateBlocked, updatePrinterQueueFound, updateQzConnected, updateTransportReady])

  const readConfiguredPrinter = useCallback(() => {
    const stationId = localStationRef.current?.id
    return stationId ? getQzPrinterName(globalThis.localStorage, stationId) : null
  }, [])

  const selectPrinter = useCallback(async (printerName) => {
    if (!isQz) throw printerError('QZ_UNAVAILABLE', 'A seleção de fila QZ está disponível apenas no Windows.')
    const stationId = localStationRef.current?.id
    if (!stationId) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')
    const requestedPrinter = String(printerName || '').trim()
    if (!requestedPrinter) throw printerError('QZ_PRINTER_NOT_CONFIGURED', 'Selecione a impressora desta estação.')

    const generation = initializationRef.current
    configureQz()
    updateTransportReady(false)
    setPrinterState('connecting')
    try {
      await ensureQzConnected(qz)
      if (generation !== initializationRef.current) return null
      updateQzConnected(Boolean(qz.websocket?.isActive?.()))
      const selectedPrinter = await resolveQzPrinter(qz, requestedPrinter)
      if (generation !== initializationRef.current) return null
      saveQzPrinterName(globalThis.localStorage, stationId, selectedPrinter)
      updateConfiguredPrinterName(selectedPrinter)
      updatePrinterQueueFound(true)
      try {
        await ensureQzStatusMonitor(selectedPrinter)
      } catch (error) {
        if (generation !== initializationRef.current) return null
        updateTransportReady(false)
        setPrinterState('disconnected')
        reportError(error)
        return selectedPrinter
      }
      updateBlocked(false)
      setPrinterState(printerHealthRef.current.state === 'ready' ? 'connected' : 'verifying')
      setLastError(null)
      return selectedPrinter
    } catch (error) {
      if (generation !== initializationRef.current) throw error
      updateQzConnected(Boolean(qz.websocket?.isActive?.()))
      updatePrinterQueueFound(false)
      updateTransportReady(false)
      setPrinterState(error?.code === 'QZ_PRINTER_NOT_FOUND' ? 'unconfigured' : 'disconnected')
      if (QZ_BLOCKING_ERROR_CODES.has(error?.code)) updateBlocked(true)
      reportError(error)
      throw error
    }
  }, [configureQz, ensureQzStatusMonitor, isQz, reportError, updateBlocked, updateConfiguredPrinterName, updatePrinterQueueFound, updateQzConnected, updateTransportReady])

  const connectPrinter = useCallback(async () => {
    const stationId = localStationRef.current?.id
    if (!stationId) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')

    if (isQz) {
      const printer = await resolveConfiguredQzPrinter(stationId)
      if (!printer) throw printerError('QZ_PRINTER_NOT_CONFIGURED', 'Selecione a impressora desta estação.')
      return null
    }

    throw printerError('PRINT_QUEUE_ONLY', 'Esta plataforma apenas cria e acompanha trabalhos na fila central. A impressão física ocorre no Windows com QZ Tray.')
  }, [isQz, resolveConfiguredQzPrinter])

  const getExplicitPort = useCallback(async () => {
    const stationId = localStationRef.current?.id
    if (!stationId) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')

    if (transportKind === 'qz') {
      if (!transportReadyRef.current) await resolveConfiguredQzPrinter(stationId)
      if (!transportReadyRef.current || !configuredPrinterNameRef.current) {
        throw printerError('QZ_PRINTER_NOT_CONFIGURED', 'Selecione a impressora desta estação.')
      }
      return null
    }

    throw printerError('PRINT_QUEUE_ONLY', 'Esta plataforma apenas cria e acompanha trabalhos na fila central. A impressão física ocorre no Windows com QZ Tray.')
  }, [resolveConfiguredQzPrinter, transportKind])

  const executeClaimedJob = useCallback(async (job, port, { clearBlockOnSuccess = false, preparePort } = {}) => {
    if (!job) return null
    updateBusyJob(job.id)
    try {
      const result = await runClaimedPrintJob({
        job,
        stationId: localStationRef.current?.id,
        port,
        completeJob: completePrintJob,
        failJob: failPrintJob,
        renderer: (document, options) => renderEscPos58mm(document, {
          ...options,
          compatibilityMode: getRendererCompatibilityMode(transportKind),
        }),
        transport: async (_selectedPort, bytes) => {
          if (typeof preparePort === 'function') await preparePort()
          if (transportKind === 'qz') return printQzRawBytes(qz, configuredPrinterNameRef.current, bytes)
          throw printerError('PRINT_QUEUE_ONLY', 'Esta estação não executa impressão física.')
        },
        qzAttempt: transportKind === 'qz' ? {
          createAttempt: async (jobId, stationId, copyNumber) => (await createPrintAttempt(jobId, stationId, copyNumber)).attempt,
          markSubmitting: async (attemptId, stationId) => (await markPrintAttemptSubmitting(attemptId, stationId)).attempt,
          sendBytes: async (bytes, { jobName }) => {
            if (typeof preparePort === 'function') await preparePort()
            return printQzRawBytes(qz, configuredPrinterNameRef.current, bytes, { jobName })
          },
          awaitOutcome: (jobName) => qzStatusMonitorRef.current
            ? qzStatusMonitorRef.current.awaitJobOutcome(jobName)
            : Promise.reject(printerError('QZ_OBSERVATION_LOST', 'O monitor QZ não está disponível.')),
          recordEvent: async (attemptId, stationId, event) => (await recordPrintAttemptEvent(attemptId, stationId, event)).attempt,
          trackAttempt: (attempt, stationId) => qzAttemptByNameRef.current.set(attempt.spoolJobName, { id: attempt.id, stationId }),
          untrackAttempt: (attempt) => qzAttemptByNameRef.current.delete(attempt.spoolJobName),
          markUnknown: async (attempt, stationId, error) => recordPrintAttemptEvent(attempt.id, stationId, {
            type: 'OFFLINE', jobName: attempt.spoolJobName, message: error?.message,
          }),
        } : null,
      })
      if (result.status === 'printed') {
        if (transportKind === 'qz') {
          updateQzConnected(Boolean(qz.websocket?.isActive?.()))
          updatePrinterQueueFound(true)
        }
        setPrinterState('connected')
        setLastError(null)
        if (clearBlockOnSuccess) updateBlocked(false)
      } else {
        updateTransportReady(false)
        if (transportKind === 'qz') updateQzConnected(Boolean(qz.websocket?.isActive?.()))
        setPrinterState('disconnected')
        if (
          ['SERIAL_OPEN_FAILED', 'PRINTER_NOT_AUTHORIZED'].includes(result.error?.code)
          || QZ_BLOCKING_ERROR_CODES.has(result.error?.code)
        ) updateBlocked(true)
        reportError(result.error)
        notifyPhysicalJobFailure(job, result.status, result.error)
      }
      return result
    } finally {
      updateBusyJob(null)
      try { await refresh() } catch (error) { reportError(error) }
    }
  }, [notifyPhysicalJobFailure, refresh, reportError, transportKind, updateBlocked, updateBusyJob, updatePrinterQueueFound, updateQzConnected, updateTransportReady])

  const saveStationSettings = useCallback(async (settings = {}) => {
    const current = localStationRef.current
    if (!current?.id) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')
    const payload = {
      name: String(settings.name ?? current.name ?? getDefaultPrintStationName(current.platform)).trim(),
      platform: settings.platform || current.platform || 'other',
      autoPrintEnabled: settings.autoPrintEnabled ?? current.autoPrintEnabled ?? false,
      defaultCopies: settings.defaultCopies ?? current.defaultCopies ?? 2,
    }
    const generation = initializationRef.current
    const response = await upsertPrintStation(current.id, payload)
    if (generation !== initializationRef.current) return response.station
    updateLocalStation(response.station)
    await refresh({ generation })
    return response.station
  }, [refresh, updateLocalStation])

  const makePrimary = useCallback(async (stationId = localStationRef.current?.id) => {
    if (!stationId) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')
    const generation = initializationRef.current
    const response = await makePrimaryPrintStation(stationId)
    if (generation !== initializationRef.current) return response.station
    await refresh({ generation })
    return response.station
  }, [refresh])

  const testPrint = useCallback(() => runExclusivePrintOperation({
    acquire: acquirePrintOperation,
    release: releasePrintOperation,
    operation: async () => {
      const station = localStationRef.current
      if (!station?.id) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')
      const port = await getExplicitPort()
      const created = await createTestPrintJob(station.id)
      const claimed = await claimPrintJob(created.job.id, station.id)
      return executeClaimedJob(claimed.job, port, { clearBlockOnSuccess: true })
    },
  }), [acquirePrintOperation, executeClaimedJob, getExplicitPort, releasePrintOperation])

  const printOrder = useCallback(async (orderId, copies = localStationRef.current?.defaultCopies || 2) => {
    const created = await createManualPrintJob(orderId, copies)
    try { await refresh() } catch (error) { reportError(error) }
    return created
  }, [refresh, reportError])

  const printSecondCopy = useCallback((job) => runExclusivePrintOperation({
    acquire: acquirePrintOperation,
    release: releasePrintOperation,
    operation: async () => {
      const station = localStationRef.current
      if (!station?.id) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')
      if (!job?.id) throw printerError('PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
      return claimAndExecuteSecondCopy({
        isQz,
        transportReady: transportReadyRef.current,
        printerBlocked: printerBlockedRef.current,
        station,
        job,
        claimJob: claimPrintJob,
        executeJob: (claimedJob) => executeClaimedJob(claimedJob, null, {
          clearBlockOnSuccess: true,
          preparePort: getExplicitPort,
        }),
      })
    },
  }), [acquirePrintOperation, executeClaimedJob, getExplicitPort, isQz, releasePrintOperation])

  const transitionRecovery = useCallback(async (action) => {
    const station = localStationRef.current
    if (!station?.id) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')
    const nextState = nextRecoveryState({ recoveryState: station.recoveryState, action })
    if (nextState === (station.recoveryState ?? 'normal')) return station
    const response = await setPrintStationRecovery(station.id, nextState)
    if (response?.station) updateLocalStation(response.station)
    return response?.station ?? station
  }, [updateLocalStation])

  const printNextRecovery = useCallback(() => runExclusivePrintOperation({
    acquire: acquirePrintOperation,
    release: releasePrintOperation,
    operation: async () => {
      const station = localStationRef.current
      const eligible = canRunSingleRecoveryCopy({
        recoveryState: station?.recoveryState,
        physicalReady: printerHealthRef.current.state === 'ready',
        busyJobId: busyJobIdRef.current,
      })
      if (!eligible || !station?.id) return null
      const result = await runSingleRecoveryCopy({
        recoveryState: station.recoveryState,
        physicalReady: printerHealthRef.current.state === 'ready',
        busyJobId: busyJobIdRef.current,
        claimNext: () => claimNextRecoveryPrintJob(station.id),
        executeJob: (job) => executeClaimedJob(job, null, {
          clearBlockOnSuccess: true,
          preparePort: getExplicitPort,
        }),
      })
      if (result) {
        const refreshed = await refresh()
        const recoveredJob = refreshed?.jobs?.find((job) => job.id === result.jobId) ?? null
        const current = localStationRef.current
        if (result.status === 'printed' && ['printed', 'discarded'].includes(recoveredJob?.status)
          && Number(refreshed?.summary?.safeBacklog || 0) === 0 && current?.id
          && current.recoveryState === 'deferred' && !current?.recoveryJobId) {
          const response = await setPrintStationRecovery(current.id, 'normal')
          if (response?.station) updateLocalStation(response.station)
        }
        return { ...result, job: recoveredJob }
      }

      const current = localStationRef.current
      if (current?.id && current.recoveryState === 'active' && !current.recoveryJobId) {
        const response = await setPrintStationRecovery(current.id, 'normal')
        if (response?.station) updateLocalStation(response.station)
      }
      await refresh()
      return null
    },
  }), [acquirePrintOperation, executeClaimedJob, getExplicitPort, refresh, releasePrintOperation, updateLocalStation])

  const startRecovery = useCallback(async () => {
    await transitionRecovery('start')
    return printNextRecovery()
  }, [printNextRecovery, transitionRecovery])

  const deferRecovery = useCallback(() => transitionRecovery('defer'), [transitionRecovery])

  const resumeRecovery = useCallback(() => transitionRecovery('resume'), [transitionRecovery])

  const discardRecoveryBacklog = useCallback(async () => {
    const station = localStationRef.current
    const response = await discardPendingPrintJobs()
    if (station?.id && (station.recoveryState ?? 'normal') !== 'normal') {
      const recovered = await setPrintStationRecovery(station.id, 'normal')
      if (recovered?.station) updateLocalStation(recovered.station)
    }
    await refresh()
    return response
  }, [refresh, updateLocalStation])

  const confirmUnknownPrinted = useCallback(async (job, attempt) => {
    if (!job?.id || !attempt?.id) throw printerError('PRINT_ATTEMPT_NOT_FOUND', 'A tentativa de impressão não foi encontrada.')
    const response = await resolvePrintOutcome(job.id, attempt.id, 'manual_printed')
    await refresh()
    return response
  }, [refresh])

  const confirmUnknownNotPrinted = useCallback(async (job, attempt) => {
    if (!job?.id || !attempt?.id) throw printerError('PRINT_ATTEMPT_NOT_FOUND', 'A tentativa de impressão não foi encontrada.')
    const response = await resolvePrintOutcome(job.id, attempt.id, 'manual_not_printed')
    await refresh()
    return response
  }, [refresh])

  const acknowledgeSecondCopyPrompt = useCallback(async (job) => {
    const station = localStationRef.current
    if (!station?.id || !canPresentSecondCopyPrompt({
      isQz,
      transportReady: transportReadyRef.current,
      printerBlocked: printerBlockedRef.current,
      station,
      job,
    })) return { promptPresented: false }
    return acknowledgeSecondCopyPromptApi(job.id, station.id)
  }, [isQz])

  const retryJob = useCallback((jobOrId) => runExclusivePrintOperation({
    acquire: acquirePrintOperation,
    release: releasePrintOperation,
    operation: async () => {
      const station = localStationRef.current
      if (!station?.id) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')
      const jobId = typeof jobOrId === 'string' ? jobOrId : jobOrId?.id
      if (!jobId) throw printerError('PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
      const port = await getExplicitPort()
      const reset = await retryPrintJob(jobId, station.id)
      const claimed = await claimPrintJob(reset.job.id, station.id)
      return executeClaimedJob(claimed.job, port, { clearBlockOnSuccess: true })
    },
  }), [acquirePrintOperation, executeClaimedJob, getExplicitPort, releasePrintOperation])

  const requestPrintNow = useCallback(async (jobOrId) => {
    const jobId = typeof jobOrId === 'string' ? jobOrId : jobOrId?.id
    if (!jobId) throw printerError('PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
    const response = await prioritizePrintJob(jobId)
    await refresh()
    return response
  }, [refresh])

  const requestRetry = useCallback(async (jobOrId) => {
    const jobId = typeof jobOrId === 'string' ? jobOrId : jobOrId?.id
    if (!jobId) throw printerError('PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
    const response = await retryPrintJob(jobId)
    await refresh()
    return response
  }, [refresh])

  const requestDiscard = useCallback(async (jobOrId) => {
    const jobId = typeof jobOrId === 'string' ? jobOrId : jobOrId?.id
    if (!jobId) throw printerError('PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
    const response = await discardPrintJob(jobId)
    await refresh()
    return response
  }, [refresh])

  const requestSecondCopy = useCallback(async (jobOrId) => {
    const jobId = typeof jobOrId === 'string' ? jobOrId : jobOrId?.id
    if (!jobId) throw printerError('PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
    const response = await requestSecondCopyApi(jobId)
    await refresh()
    return response
  }, [refresh])

  const skipSecondCopy = useCallback(async (jobOrId) => {
    const jobId = typeof jobOrId === 'string' ? jobOrId : jobOrId?.id
    if (!jobId) throw printerError('PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
    const response = await skipSecondCopyApi(jobId)
    await refresh()
    return response
  }, [refresh])

  const requestForcePrint = useCallback(async (jobOrId) => {
    const jobId = typeof jobOrId === 'string' ? jobOrId : jobOrId?.id
    if (!jobId) throw printerError('PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
    const response = await forcePrintJobApi(jobId)
    await refresh()
    return response
  }, [refresh])

  const requestReprint = useCallback(async (jobOrId, copies) => {
    const jobId = typeof jobOrId === 'string' ? jobOrId : jobOrId?.id
    if (!jobId) throw printerError('PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
    try {
      return await reprintPrintJob(jobId, copies)
    } finally {
      await refresh()
    }
  }, [refresh])

  const getPreviewDocument = useCallback(async (orderId) => {
    const response = await getOrderPrintDocument(orderId)
    return response.document
  }, [])

  const getTableTabPreviewDocument = useCallback(async (tableTabId) => {
    const response = await getTableTabPrintDocument(tableTabId)
    return response.document
  }, [])

  const printTableTab = useCallback((tableTabId) => createManualTableTabPrintJob(tableTabId), [])

  useEffect(() => {
    if (!authenticated) {
      initializationRef.current += 1
      printOperationRef.current = null
      void qzStatusMonitorRef.current?.stop?.()
      qzStatusMonitorRef.current = null
      qzStatusMonitorPrinterRef.current = null
      qzAttemptByNameRef.current.clear()
      updateLocalStation(null)
      setStations([])
      setJobs([])
      setAvailablePrinters([])
      portRef.current = null
      updateConfiguredPrinterName(null)
      updateQzConnected(false)
      updatePrinterQueueFound(false)
      updateTransportReady(false)
      updatePrinterHealth({ state: 'verifying' })
      setRecoveryPendingCount(0)
      updateBusyJob(null)
      updateBlocked(false)
      setPrinterState(supported ? 'unconfigured' : 'unsupported')
      return undefined
    }

    let cancelled = false
    const generation = ++initializationRef.current
    const initialize = async () => {
      try {
        const stationId = getOrCreateLocalPrintStationId()
        const stationPayload = await getPrintStations()
        if (cancelled || generation !== initializationRef.current) return
        const existingStations = Array.isArray(stationPayload?.stations) ? stationPayload.stations : []
        let station = existingStations.find((candidate) => candidate.id === stationId)
        if (!station) {
          const response = await upsertPrintStation(stationId, {
            name: getDefaultPrintStationName(platform),
            platform,
            autoPrintEnabled: false,
            defaultCopies: 2,
          })
          station = response.station
        }
        if (cancelled || generation !== initializationRef.current) return
        updateLocalStation(station)
        await refresh()
        if (cancelled || generation !== initializationRef.current) return
        await initializeBackgroundPhysicalTransport({
          authenticated,
          isOnline,
          isQz,
          station: localStationRef.current || station,
          initializeQz: resolveConfiguredQzPrinter,
        })
      } catch (error) {
        if (!cancelled) reportError(error)
      }
    }
    void initialize()
    return () => { cancelled = true }
  }, [authenticated, isOnline, isQz, platform, refresh, reportError, resolveConfiguredQzPrinter, supported, updateBlocked, updateBusyJob, updateConfiguredPrinterName, updateLocalStation, updatePrinterHealth, updatePrinterQueueFound, updateQzConnected, updateTransportReady])

  useEffect(() => {
    if (!authenticated || !isOnline) return undefined
    const sync = () => {
      if (!visiblePage()) return
      void refresh().catch(reportError)
      if (busyJobIdRef.current || !supported) return
      const station = localStationRef.current
      if (!station?.id || !getQzPrinterName(globalThis.localStorage, station.id)) return
      void initializeBackgroundPhysicalTransport({
        authenticated,
        isOnline,
        isQz,
        station,
        initializeQz: resolveConfiguredQzPrinter,
      }).catch(reportError)
    }
    const timer = globalThis.setInterval?.(sync, PRINT_STATE_POLL_MS)
    const handleVisibility = () => { if (visiblePage()) sync() }
    const handleFocus = () => sync()
    document?.addEventListener?.('visibilitychange', handleVisibility)
    globalThis.addEventListener?.('focus', handleFocus)
    return () => {
      if (timer) globalThis.clearInterval?.(timer)
      document?.removeEventListener?.('visibilitychange', handleVisibility)
      globalThis.removeEventListener?.('focus', handleFocus)
    }
  }, [authenticated, isOnline, isQz, refresh, reportError, resolveConfiguredQzPrinter, supported])

  useEffect(() => {
    const eligible = () => canSendPrintStationHeartbeat({
      authenticated,
      isOnline,
      browserOnline: browserOnline(),
      isQz,
      station: localStationRef.current,
    })
    if (!eligible()) return undefined

    let cancelled = false
    const heartbeat = async () => {
      const station = localStationRef.current
      if (!station || !eligible() || heartbeatInFlightRef.current) return
      heartbeatInFlightRef.current = true
      const sequence = ++heartbeatSequenceRef.current
      const health = buildPrintStationHeartbeatHealth({
        qzActive: qzConnectedRef.current,
        transportReady: transportReadyRef.current,
        configuredPrinterName: configuredPrinterNameRef.current,
        printerHealth: printerHealthRef.current,
      })
      try {
        const response = await heartbeatPrintStation(station.id, health)
        if (!cancelled && sequence === heartbeatSequenceRef.current && response?.station) updateLocalStation(response.station)
      } catch (error) {
        if (!cancelled && sequence === heartbeatSequenceRef.current) reportError(error)
      } finally {
        if (sequence === heartbeatSequenceRef.current) heartbeatInFlightRef.current = false
      }
    }

    void heartbeat()
    const timer = globalThis.setInterval?.(() => { void heartbeat() }, STATION_HEARTBEAT_MS)
    return () => {
      cancelled = true
      heartbeatSequenceRef.current += 1
      heartbeatInFlightRef.current = false
      if (timer) globalThis.clearInterval?.(timer)
    }
  }, [authenticated, configuredPrinterName, isOnline, isQz, localStation?.id, localStation?.isPrimary, localStation?.platform, reportError, transportReady, updateLocalStation])

  useEffect(() => {
    if (!authenticated || !isOnline || !supported || !isQz) return undefined
    const consumeNext = async () => {
      const station = localStationRef.current
      if (!canConsumeAutomaticPrintJob({
        authenticated,
        isOnline,
        supported,
        visible: visiblePage(),
        browserOnline: browserOnline(),
        busyJobId: busyJobIdRef.current,
        printerBlocked: printerBlockedRef.current,
        transportReady: transportReadyRef.current,
        qzConnected: qzConnectedRef.current,
        physicalReady: printerHealthRef.current.state === 'ready',
        isQz,
        allowManual: true,
        station,
      })) return

      const owner = acquirePrintOperation()
      if (!owner) return
      try {
        const response = await claimNextPrintJob(station.id)
        if (!response?.job) return
        await executeClaimedJob(response.job, null)
      } catch (error) {
        if (QZ_BLOCKING_ERROR_CODES.has(error?.code)) updateBlocked(true)
        updateTransportReady(false)
        reportError(error)
        try { await refresh() } catch { /* next state poll will recover */ }
      } finally {
        releasePrintOperation(owner)
      }
    }
    const timer = globalThis.setInterval?.(() => { void consumeNext() }, PRINT_JOB_POLL_MS)
    return () => { if (timer) globalThis.clearInterval?.(timer) }
  }, [acquirePrintOperation, authenticated, executeClaimedJob, isOnline, isQz, refresh, releasePrintOperation, reportError, supported, updateBlocked, updateTransportReady])

  const latestJobByOrderId = useMemo(() => {
    const latest = new Map()
    for (const job of jobs) {
      if (job?.orderId && !latest.has(job.orderId)) latest.set(job.orderId, job)
    }
    return latest
  }, [jobs])

  return {
    supported,
    transportKind,
    localStation,
    stations,
    jobs,
    latestJobByOrderId,
    printerState,
    printerBlocked,
    busyJobId,
    lastError,
    availablePrinters,
    configuredPrinterName,
    qzConnected,
    printerQueueFound,
    transportReady,
    printerHealth,
    recoveryState: recoveryView.recoveryState,
    recoveryPendingCount: recoveryView.recoveryPendingCount,
    recoveryPromptEligible: recoveryView.recoveryPromptEligible,
    refresh,
    refreshPrinters,
    readConfiguredPrinter,
    selectPrinter,
    connectPrinter,
    saveStationSettings,
    makePrimary,
    testPrint,
    printOrder,
    printSecondCopy,
    startRecovery,
    deferRecovery,
    resumeRecovery,
    printNextRecovery,
    discardRecoveryBacklog,
    confirmUnknownPrinted,
    confirmUnknownNotPrinted,
    acknowledgeSecondCopyPrompt,
    retryJob,
    requestPrintNow,
    requestRetry,
    requestDiscard,
    requestSecondCopy,
    skipSecondCopy,
    requestForcePrint,
    requestReprint,
    getPreviewDocument,
    getTableTabPreviewDocument,
    printTableTab,
  }
}
