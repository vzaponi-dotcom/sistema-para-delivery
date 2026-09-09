import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import qz from 'qz-tray'
import {
  acknowledgeSecondCopyPrompt as acknowledgeSecondCopyPromptApi,
  claimNextPrintJob,
  claimPrintJob,
  completePrintJob,
  createManualPrintJob,
  createTestPrintJob,
  discardPrintJob,
  failPrintJob,
  forcePrintJob as forcePrintJobApi,
  getOrderPrintDocument,
  getPrintJobs,
  getPrintStations,
  getQzCertificate,
  heartbeatPrintStation,
  makePrimaryPrintStation,
  prioritizePrintJob,
  reprintPrintJob,
  retryPrintJob,
  requestSecondCopy as requestSecondCopyApi,
  skipSecondCopy as skipSecondCopyApi,
  signQzPayload,
  upsertPrintStation,
} from '../api/client.js'
import { renderEscPos58mm } from './escpos58mm.js'
import {
  detectPrintStationPlatform,
  findAuthorizedPrinterPort,
  getDefaultPrintStationName,
  getOrCreateLocalPrintStationId,
  getPrinterFingerprint,
  getQzPrinterName,
  savePrinterFingerprint,
  saveQzPrinterName,
} from './localPrintStation.js'
import { MTP5_PROFILE } from './mtp5Profile.js'
import { runClaimedPrintJob } from './printJobRunner.js'
import {
  configureQzSecurity,
  createQzReadinessController,
  deriveQzOperationalState,
  ensureQzConnected,
  listQzPrinters,
  printQzRawBytes,
  resolveQzPrinter,
} from './qzTrayTransport.js'
import { dispatchRawBtBytes } from './rawBtTransport.js'
import {
  isWebSerialSupported,
  probeSerialPort,
  requestPrinterPort,
  writeSerialBytes,
} from './webSerialTransport.js'

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
  if (platform === 'android') return 'rawbt'
  if (platform === 'windows') return 'qz'
  return 'web-serial'
}

export const getRendererCompatibilityMode = (transportKind) => (
  ['rawbt', 'qz'].includes(transportKind) ? 'mpt2-bitmap' : null
)

export const isPrintingTransportSupported = (
  platform,
  serial = globalThis.navigator?.serial,
) => ['rawbt', 'qz'].includes(getPrintingTransportKind(platform)) || isWebSerialSupported(serial)

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
  && isQz
  && station?.isPrimary
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

export const canPresentSecondCopyPrompt = ({ isQz, transportReady, printerBlocked, station, job }) => (
  Boolean(transportReady)
  && !printerBlocked
  && canExecuteSecondCopy({ isQz, station, job })
  && !job?.secondCopyPromptedAt
)

export const canKeepSecondCopyPromptOpen = ({ isQz, transportReady, printerBlocked, station, job }) => (
  Boolean(transportReady)
  && !printerBlocked
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
}) => {
  const state = deriveQzOperationalState({
    qzConnected: qzActive,
    printerQueueConfigured: Boolean(String(configuredPrinterName || '').trim()),
    printerQueueFound: transportReady,
  })
  return {
    qzReady: state.qzConnected,
    printerReady: state.operationalReady,
  }
}

export const usePrintingManager = ({ authenticated = false, isOnline = true, onPhysicalJobFailure } = {}) => {
  const platform = detectPrintStationPlatform()
  const transportKind = getPrintingTransportKind(platform)
  const supported = isPrintingTransportSupported(platform)
  const isRawBt = transportKind === 'rawbt'
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

  const portRef = useRef(null)
  const localStationRef = useRef(null)
  const busyJobIdRef = useRef(null)
  const printerBlockedRef = useRef(false)
  const configuredPrinterNameRef = useRef(null)
  const qzConnectedRef = useRef(false)
  const printerQueueFoundRef = useRef(false)
  const transportReadyRef = useRef(false)
  const qzSecurityConfiguredRef = useRef(false)
  const qzReadinessRef = useRef(createQzReadinessController())
  const initializationRef = useRef(0)
  const heartbeatInFlightRef = useRef(false)
  const heartbeatSequenceRef = useRef(0)
  const [physicalJobFailureNotifier] = useState(createPhysicalJobFailureNotifier)

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

  const reportError = useCallback((error) => {
    setLastError(error || null)
  }, [])

  const notifyPhysicalJobFailure = useCallback((job, status, error) => (
    physicalJobFailureNotifier.notify({ job, status, error, onNotify: onPhysicalJobFailure })
  ), [onPhysicalJobFailure, physicalJobFailureNotifier])

  const configureQz = useCallback(() => {
    if (qzSecurityConfiguredRef.current) return
    configureQzSecurity({
      qzApi: qz,
      getCertificate: getQzCertificate,
      signPayload: signQzPayload,
    })
    qz.websocket?.setClosedCallbacks?.([
      () => {
        qzReadinessRef.current.invalidate()
        updateQzConnected(false)
        updatePrinterQueueFound(false)
        updateTransportReady(false)
        setPrinterState('disconnected')
      },
    ])
    qzSecurityConfiguredRef.current = true
  }, [updatePrinterQueueFound, updateQzConnected, updateTransportReady])

  const refresh = useCallback(async () => {
    if (!authenticated) return { stations: [], jobs: [] }
    const [stationPayload, jobPayload] = await Promise.all([getPrintStations(), getPrintJobs({ limit: 100 })])
    const nextStations = Array.isArray(stationPayload?.stations) ? stationPayload.stations : []
    const nextJobs = Array.isArray(jobPayload?.jobs) ? jobPayload.jobs : []
    setStations(nextStations)
    setJobs(nextJobs)
    physicalJobFailureNotifier.synchronize(nextJobs)
    const stationId = localStationRef.current?.id
    if (stationId) {
      const serverStation = nextStations.find((station) => station.id === stationId)
      if (serverStation) updateLocalStation(serverStation)
    }
    return { stations: nextStations, jobs: nextJobs }
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
      updateTransportReady(true)
      updateBlocked(false)
      setPrinterState('connected')
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
  }, [configureQz, isQz, reportError, updateBlocked, updateConfiguredPrinterName, updatePrinterQueueFound, updateQzConnected, updateTransportReady])

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
      updateTransportReady(found)
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

  const selectPrinter = useCallback(async (printerName) => {
    if (!isQz) throw printerError('QZ_UNAVAILABLE', 'A seleção de fila QZ está disponível apenas no Windows.')
    const stationId = localStationRef.current?.id
    if (!stationId) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')
    const requestedPrinter = String(printerName || '').trim()
    if (!requestedPrinter) throw printerError('QZ_PRINTER_NOT_CONFIGURED', 'Selecione a impressora desta estação.')

    configureQz()
    updateTransportReady(false)
    setPrinterState('connecting')
    try {
      await ensureQzConnected(qz)
      updateQzConnected(Boolean(qz.websocket?.isActive?.()))
      const selectedPrinter = await resolveQzPrinter(qz, requestedPrinter)
      saveQzPrinterName(globalThis.localStorage, stationId, selectedPrinter)
      updateConfiguredPrinterName(selectedPrinter)
      updatePrinterQueueFound(true)
      updateTransportReady(true)
      updateBlocked(false)
      setPrinterState('connected')
      setLastError(null)
      return selectedPrinter
    } catch (error) {
      updateQzConnected(Boolean(qz.websocket?.isActive?.()))
      updatePrinterQueueFound(false)
      updateTransportReady(false)
      setPrinterState(error?.code === 'QZ_PRINTER_NOT_FOUND' ? 'unconfigured' : 'disconnected')
      if (QZ_BLOCKING_ERROR_CODES.has(error?.code)) updateBlocked(true)
      reportError(error)
      throw error
    }
  }, [configureQz, isQz, reportError, updateBlocked, updateConfiguredPrinterName, updatePrinterQueueFound, updateQzConnected, updateTransportReady])

  const resolveAuthorizedPort = useCallback(async ({ probe = false } = {}) => {
    if (isRawBt || isQz || !supported) return null
    const stationId = localStationRef.current?.id
    if (!stationId) return null
    const fingerprint = getPrinterFingerprint(globalThis.localStorage, stationId)
    if (!fingerprint) {
      portRef.current = null
      updateTransportReady(false)
      setPrinterState('unconfigured')
      return null
    }
    const port = await findAuthorizedPrinterPort(globalThis.navigator?.serial, globalThis.localStorage, stationId)
    portRef.current = port || null
    if (!port) {
      updateTransportReady(false)
      setPrinterState('disconnected')
      return null
    }
    if (!probe || busyJobIdRef.current) {
      updateTransportReady(true)
      return port
    }

    setPrinterState('connecting')
    try {
      await probeSerialPort(port, MTP5_PROFILE.serial)
      updateTransportReady(true)
      updateBlocked(false)
      setPrinterState('connected')
      setLastError(null)
      return port
    } catch (error) {
      portRef.current = null
      updateTransportReady(false)
      setPrinterState('disconnected')
      if (error?.code === 'SERIAL_OPEN_FAILED') updateBlocked(true)
      reportError(error)
      return null
    }
  }, [isQz, isRawBt, reportError, supported, updateBlocked, updateTransportReady])

  const connectPrinter = useCallback(async () => {
    const stationId = localStationRef.current?.id
    if (!stationId) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')

    if (isRawBt) {
      portRef.current = null
      updateTransportReady(true)
      setPrinterState('driver-ready')
      setLastError(null)
      updateBlocked(false)
      return null
    }

    if (isQz) {
      const printer = await resolveConfiguredQzPrinter(stationId)
      if (!printer) throw printerError('QZ_PRINTER_NOT_CONFIGURED', 'Selecione a impressora desta estação.')
      return null
    }

    if (!supported) throw printerError('WEB_SERIAL_UNSUPPORTED', 'Este navegador não oferece impressão Bluetooth compatível.')
    updateTransportReady(false)
    setPrinterState('connecting')
    try {
      const port = await requestPrinterPort(globalThis.navigator?.serial)
      await probeSerialPort(port, MTP5_PROFILE.serial)
      savePrinterFingerprint(globalThis.localStorage, stationId, port)
      portRef.current = port
      updateTransportReady(true)
      setPrinterState('connected')
      setLastError(null)
      updateBlocked(false)
      return port
    } catch (error) {
      portRef.current = null
      updateTransportReady(false)
      setPrinterState(getPrinterFingerprint(globalThis.localStorage, stationId) ? 'disconnected' : 'unconfigured')
      reportError(error)
      throw error
    }
  }, [isQz, isRawBt, reportError, resolveConfiguredQzPrinter, supported, updateBlocked, updateTransportReady])

  const getExplicitPort = useCallback(async () => {
    if (isRawBt) return null
    const stationId = localStationRef.current?.id
    if (!stationId) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')

    if (transportKind === 'qz') {
      if (!transportReadyRef.current) await resolveConfiguredQzPrinter(stationId)
      if (!transportReadyRef.current || !configuredPrinterNameRef.current) {
        throw printerError('QZ_PRINTER_NOT_CONFIGURED', 'Selecione a impressora desta estação.')
      }
      return null
    }

    let port = portRef.current || await resolveAuthorizedPort({ probe: true })
    if (port) return port
    try {
      port = await connectPrinter()
      return port
    } catch (error) {
      if (error?.code) throw error
      throw printerError('PRINTER_NOT_AUTHORIZED', 'Selecione e autorize a impressora antes de imprimir.')
    }
  }, [connectPrinter, isRawBt, resolveAuthorizedPort, resolveConfiguredQzPrinter, transportKind])

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
        transport: async (selectedPort, bytes) => {
          const readyPort = typeof preparePort === 'function' ? await preparePort() : selectedPort
          if (transportKind === 'rawbt') return dispatchRawBtBytes(bytes)
          if (transportKind === 'qz') return printQzRawBytes(qz, configuredPrinterNameRef.current, bytes)
          return writeSerialBytes(readyPort, bytes, MTP5_PROFILE.serial)
        },
      })
      if (result.status === 'printed') {
        if (transportKind === 'qz') {
          updateQzConnected(Boolean(qz.websocket?.isActive?.()))
          updatePrinterQueueFound(true)
          updateTransportReady(true)
        }
        if (transportKind === 'web-serial') updateTransportReady(true)
        setPrinterState(isRawBt ? 'driver-ready' : 'connected')
        setLastError(null)
        if (clearBlockOnSuccess) updateBlocked(false)
      } else {
        if (transportKind !== 'rawbt') updateTransportReady(false)
        if (transportKind === 'qz') updateQzConnected(Boolean(qz.websocket?.isActive?.()))
        setPrinterState(isRawBt ? 'driver-ready' : 'disconnected')
        if (
          ['SERIAL_OPEN_FAILED', 'PRINTER_NOT_AUTHORIZED', 'RAWBT_LAUNCH_FAILED'].includes(result.error?.code)
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
  }, [isRawBt, notifyPhysicalJobFailure, refresh, reportError, transportKind, updateBlocked, updateBusyJob, updatePrinterQueueFound, updateQzConnected, updateTransportReady])

  const saveStationSettings = useCallback(async (settings = {}) => {
    const current = localStationRef.current
    if (!current?.id) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')
    const payload = {
      name: String(settings.name ?? current.name ?? getDefaultPrintStationName(current.platform)).trim(),
      platform: settings.platform || current.platform || 'other',
      autoPrintEnabled: settings.autoPrintEnabled ?? current.autoPrintEnabled ?? false,
      defaultCopies: settings.defaultCopies ?? current.defaultCopies ?? 2,
    }
    const response = await upsertPrintStation(current.id, payload)
    updateLocalStation(response.station)
    await refresh()
    return response.station
  }, [refresh, updateLocalStation])

  const makePrimary = useCallback(async (stationId = localStationRef.current?.id) => {
    if (!stationId) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')
    const response = await makePrimaryPrintStation(stationId)
    await refresh()
    return response.station
  }, [refresh])

  const testPrint = useCallback(async () => {
    const station = localStationRef.current
    if (!station?.id) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')
    const port = await getExplicitPort()
    const created = await createTestPrintJob(station.id)
    const claimed = await claimPrintJob(created.job.id, station.id)
    return executeClaimedJob(claimed.job, port, { clearBlockOnSuccess: true })
  }, [executeClaimedJob, getExplicitPort])

  const printOrder = useCallback(async (orderId, copies = localStationRef.current?.defaultCopies || 2) => {
    const created = await createManualPrintJob(orderId, copies)
    try { await refresh() } catch (error) { reportError(error) }
    return created
  }, [refresh, reportError])

  const printSecondCopy = useCallback(async (job) => {
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
  }, [executeClaimedJob, getExplicitPort, isQz])

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

  const retryJob = useCallback(async (jobOrId) => {
    const station = localStationRef.current
    if (!station?.id) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')
    const jobId = typeof jobOrId === 'string' ? jobOrId : jobOrId?.id
    if (!jobId) throw printerError('PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
    const port = await getExplicitPort()
    const reset = await retryPrintJob(jobId, station.id)
    const claimed = await claimPrintJob(reset.job.id, station.id)
    return executeClaimedJob(claimed.job, port, { clearBlockOnSuccess: true })
  }, [executeClaimedJob, getExplicitPort])

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

  useEffect(() => {
    if (!authenticated) {
      initializationRef.current += 1
      updateLocalStation(null)
      setStations([])
      setJobs([])
      setAvailablePrinters([])
      portRef.current = null
      updateConfiguredPrinterName(null)
      updateQzConnected(false)
      updatePrinterQueueFound(false)
      updateTransportReady(false)
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
  }, [authenticated, isOnline, isQz, platform, refresh, reportError, resolveConfiguredQzPrinter, supported, updateBlocked, updateBusyJob, updateConfiguredPrinterName, updateLocalStation, updatePrinterQueueFound, updateQzConnected, updateTransportReady])

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
        isQz,
        allowManual: true,
        station,
      })) return

      try {
        const response = await claimNextPrintJob(station.id)
        if (!response?.job) return
        await executeClaimedJob(response.job, null)
      } catch (error) {
        if (QZ_BLOCKING_ERROR_CODES.has(error?.code)) updateBlocked(true)
        updateTransportReady(false)
        reportError(error)
        try { await refresh() } catch { /* next state poll will recover */ }
      }
    }
    const timer = globalThis.setInterval?.(() => { void consumeNext() }, PRINT_JOB_POLL_MS)
    return () => { if (timer) globalThis.clearInterval?.(timer) }
  }, [authenticated, executeClaimedJob, isOnline, isQz, refresh, reportError, supported, updateBlocked, updateTransportReady])

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
    refresh,
    refreshPrinters,
    selectPrinter,
    connectPrinter,
    saveStationSettings,
    makePrimary,
    testPrint,
    printOrder,
    printSecondCopy,
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
  }
}
