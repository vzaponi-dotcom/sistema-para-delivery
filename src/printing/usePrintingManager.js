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
  retryPrintJob,
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

export const canPresentSecondCopyPrompt = ({ isQz, station, job }) => (
  canExecuteSecondCopy({ isQz, station, job }) && !job?.secondCopyPromptedAt
)

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
  const qzReady = Boolean(qzActive)
  return {
    qzReady,
    printerReady: Boolean(qzReady && transportReady && String(configuredPrinterName || '').trim()),
  }
}

export const usePrintingManager = ({ authenticated = false, isOnline = true, onError } = {}) => {
  const platform = detectPrintStationPlatform()
  const transportKind = getPrintingTransportKind(platform)
  const supported = isPrintingTransportSupported(platform)
  const isRawBt = transportKind === 'rawbt'
  const isQz = transportKind === 'qz'
  const [localStation, setLocalStation] = useState(null)
  const [stations, setStations] = useState([])
  const [jobs, setJobs] = useState([])
  const [printerState, setPrinterState] = useState(isRawBt ? 'driver-ready' : (supported ? 'unconfigured' : 'unsupported'))
  const [printerBlocked, setPrinterBlocked] = useState(false)
  const [busyJobId, setBusyJobId] = useState(null)
  const [lastError, setLastError] = useState(null)
  const [availablePrinters, setAvailablePrinters] = useState([])
  const [configuredPrinterName, setConfiguredPrinterName] = useState(null)
  const [transportReady, setTransportReady] = useState(isRawBt)

  const portRef = useRef(null)
  const localStationRef = useRef(null)
  const busyJobIdRef = useRef(null)
  const printerBlockedRef = useRef(false)
  const configuredPrinterNameRef = useRef(null)
  const transportReadyRef = useRef(isRawBt)
  const qzSecurityConfiguredRef = useRef(false)
  const initializationRef = useRef(0)

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

  const updateTransportReady = useCallback((ready) => {
    const value = Boolean(ready)
    transportReadyRef.current = value
    setTransportReady(value)
  }, [])

  const reportError = useCallback((error) => {
    setLastError(error || null)
    if (typeof onError === 'function' && error) onError(error)
  }, [onError])

  const configureQz = useCallback(() => {
    if (qzSecurityConfiguredRef.current) return
    configureQzSecurity({
      qzApi: qz,
      getCertificate: getQzCertificate,
      signPayload: signQzPayload,
    })
    qzSecurityConfiguredRef.current = true
  }, [])

  const refresh = useCallback(async () => {
    if (!authenticated) return { stations: [], jobs: [] }
    const [stationPayload, jobPayload] = await Promise.all([getPrintStations(), getPrintJobs({ limit: 100 })])
    const nextStations = Array.isArray(stationPayload?.stations) ? stationPayload.stations : []
    const nextJobs = Array.isArray(jobPayload?.jobs) ? jobPayload.jobs : []
    setStations(nextStations)
    setJobs(nextJobs)
    const stationId = localStationRef.current?.id
    if (stationId) {
      const serverStation = nextStations.find((station) => station.id === stationId)
      if (serverStation) updateLocalStation(serverStation)
    }
    return { stations: nextStations, jobs: nextJobs }
  }, [authenticated, updateLocalStation])

  const resolveConfiguredQzPrinter = useCallback(async (stationId) => {
    if (!isQz || !stationId) return null
    configureQz()
    updateTransportReady(false)
    setPrinterState('connecting')
    try {
      await ensureQzConnected(qz)
      const savedPrinterName = getQzPrinterName(globalThis.localStorage, stationId)
      updateConfiguredPrinterName(savedPrinterName)
      if (!savedPrinterName) {
        setPrinterState('unconfigured')
        return null
      }
      const resolvedPrinter = await resolveQzPrinter(qz, savedPrinterName)
      updateConfiguredPrinterName(resolvedPrinter)
      updateTransportReady(true)
      updateBlocked(false)
      setPrinterState('connected')
      setLastError(null)
      return resolvedPrinter
    } catch (error) {
      updateTransportReady(false)
      setPrinterState(error?.code === 'QZ_PRINTER_NOT_FOUND' ? 'unconfigured' : 'disconnected')
      if (QZ_BLOCKING_ERROR_CODES.has(error?.code)) updateBlocked(true)
      reportError(error)
      return null
    }
  }, [configureQz, isQz, reportError, updateBlocked, updateConfiguredPrinterName, updateTransportReady])

  const refreshPrinters = useCallback(async () => {
    if (!isQz) return []
    configureQz()
    setPrinterState('connecting')
    try {
      await ensureQzConnected(qz)
      const printers = await listQzPrinters(qz)
      setAvailablePrinters(printers)
      setPrinterState(transportReadyRef.current ? 'connected' : 'unconfigured')
      setLastError(null)
      return printers
    } catch (error) {
      updateTransportReady(false)
      setPrinterState('disconnected')
      if (QZ_BLOCKING_ERROR_CODES.has(error?.code)) updateBlocked(true)
      reportError(error)
      throw error
    }
  }, [configureQz, isQz, reportError, updateBlocked, updateTransportReady])

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
      const selectedPrinter = await resolveQzPrinter(qz, requestedPrinter)
      saveQzPrinterName(globalThis.localStorage, stationId, selectedPrinter)
      updateConfiguredPrinterName(selectedPrinter)
      updateTransportReady(true)
      updateBlocked(false)
      setPrinterState('connected')
      setLastError(null)
      return selectedPrinter
    } catch (error) {
      updateTransportReady(false)
      setPrinterState(error?.code === 'QZ_PRINTER_NOT_FOUND' ? 'unconfigured' : 'disconnected')
      if (QZ_BLOCKING_ERROR_CODES.has(error?.code)) updateBlocked(true)
      reportError(error)
      throw error
    }
  }, [configureQz, isQz, reportError, updateBlocked, updateConfiguredPrinterName, updateTransportReady])

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

  const executeClaimedJob = useCallback(async (job, port, { clearBlockOnSuccess = false } = {}) => {
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
        transport: transportKind === 'rawbt'
          ? (_selectedPort, bytes) => dispatchRawBtBytes(bytes)
          : transportKind === 'qz'
            ? (_selectedPort, bytes) => printQzRawBytes(qz, configuredPrinterNameRef.current, bytes)
            : (selectedPort, bytes) => writeSerialBytes(selectedPort, bytes, MTP5_PROFILE.serial),
      })
      if (result.status === 'printed') {
        if (transportKind === 'qz') updateTransportReady(true)
        if (transportKind === 'web-serial') updateTransportReady(true)
        setPrinterState(isRawBt ? 'driver-ready' : 'connected')
        setLastError(null)
        if (clearBlockOnSuccess) updateBlocked(false)
      } else {
        if (transportKind !== 'rawbt') updateTransportReady(false)
        setPrinterState(isRawBt ? 'driver-ready' : 'disconnected')
        if (
          ['SERIAL_OPEN_FAILED', 'PRINTER_NOT_AUTHORIZED', 'RAWBT_LAUNCH_FAILED'].includes(result.error?.code)
          || QZ_BLOCKING_ERROR_CODES.has(result.error?.code)
        ) updateBlocked(true)
        reportError(result.error)
      }
      return result
    } finally {
      updateBusyJob(null)
      try { await refresh() } catch (error) { reportError(error) }
    }
  }, [isRawBt, refresh, reportError, transportKind, updateBlocked, updateBusyJob, updateTransportReady])

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
    if (!canExecuteSecondCopy({ isQz, station, job })) {
      throw printerError('PRINT_SECOND_COPY_NOT_READY', 'A segunda via não está disponível para este trabalho.')
    }
    const port = await getExplicitPort()
    const claimed = await claimPrintJob(job.id, station.id)
    return executeClaimedJob(claimed.job, port, { clearBlockOnSuccess: true })
  }, [executeClaimedJob, getExplicitPort, isQz])

  const acknowledgeSecondCopyPrompt = useCallback(async (job) => {
    const station = localStationRef.current
    if (!station?.id || !canExecuteSecondCopy({ isQz, station, job })) return { promptPresented: false }
    const response = await acknowledgeSecondCopyPromptApi(job.id, station.id)
    await refresh()
    return response
  }, [isQz, refresh])

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
    if (!jobId) throw printerError('PRINT_JOB_NOT_FOUND', 'Trabalho de impressÃ£o nÃ£o encontrado.')
    const response = await prioritizePrintJob(jobId)
    await refresh()
    return response
  }, [refresh])

  const requestRetry = useCallback(async (jobOrId) => {
    const jobId = typeof jobOrId === 'string' ? jobOrId : jobOrId?.id
    if (!jobId) throw printerError('PRINT_JOB_NOT_FOUND', 'Trabalho de impressÃ£o nÃ£o encontrado.')
    const response = await retryPrintJob(jobId)
    await refresh()
    return response
  }, [refresh])

  const requestDiscard = useCallback(async (jobOrId) => {
    const jobId = typeof jobOrId === 'string' ? jobOrId : jobOrId?.id
    if (!jobId) throw printerError('PRINT_JOB_NOT_FOUND', 'Trabalho de impressÃ£o nÃ£o encontrado.')
    const response = await discardPrintJob(jobId)
    await refresh()
    return response
  }, [refresh])

  const requestForcePrint = useCallback(async (jobOrId) => {
    const jobId = typeof jobOrId === 'string' ? jobOrId : jobOrId?.id
    if (!jobId) throw printerError('PRINT_JOB_NOT_FOUND', 'Trabalho de impressÃ£o nÃ£o encontrado.')
    const response = await forcePrintJobApi(jobId)
    await refresh()
    return response
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
      updateTransportReady(isRawBt)
      updateBusyJob(null)
      updateBlocked(false)
      setPrinterState(isRawBt ? 'driver-ready' : (supported ? 'unconfigured' : 'unsupported'))
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
        if (isRawBt) {
          updateTransportReady(true)
          setPrinterState('driver-ready')
        } else if (isQz) {
          await resolveConfiguredQzPrinter(station.id)
        } else if (supported) {
          await resolveAuthorizedPort({ probe: true })
        }
      } catch (error) {
        if (!cancelled) reportError(error)
      }
    }
    void initialize()
    return () => { cancelled = true }
  }, [authenticated, isQz, isRawBt, platform, refresh, reportError, resolveAuthorizedPort, resolveConfiguredQzPrinter, supported, updateBlocked, updateBusyJob, updateConfiguredPrinterName, updateLocalStation, updateTransportReady])

  useEffect(() => {
    if (!authenticated || !isOnline) return undefined
    const sync = () => {
      if (!visiblePage()) return
      void refresh().catch(reportError)
      if (busyJobIdRef.current || !supported) return
      if (isQz) {
        const stationId = localStationRef.current?.id
        if (stationId && getQzPrinterName(globalThis.localStorage, stationId)) {
          void resolveConfiguredQzPrinter(stationId)
        }
      } else if (!isRawBt) {
        void resolveAuthorizedPort({ probe: false }).catch(reportError)
      }
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
  }, [authenticated, isOnline, isQz, isRawBt, refresh, reportError, resolveAuthorizedPort, resolveConfiguredQzPrinter, supported])

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
      if (!station || !eligible()) return
      const health = buildPrintStationHeartbeatHealth({
        qzActive: Boolean(qz.websocket?.isActive?.()),
        transportReady: transportReadyRef.current,
        configuredPrinterName: configuredPrinterNameRef.current,
      })
      try {
        const response = await heartbeatPrintStation(station.id, health)
        if (!cancelled && response?.station) updateLocalStation(response.station)
      } catch (error) {
        if (!cancelled) reportError(error)
      }
    }

    void heartbeat()
    const timer = globalThis.setInterval?.(() => { void heartbeat() }, STATION_HEARTBEAT_MS)
    return () => {
      cancelled = true
      if (timer) globalThis.clearInterval?.(timer)
    }
  }, [authenticated, configuredPrinterName, isOnline, isQz, localStation?.id, localStation?.isPrimary, localStation?.platform, reportError, transportReady, updateLocalStation])

  useEffect(() => {
    if (!authenticated || !isOnline || !supported) return undefined
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
        isQz,
        allowManual: true,
        station,
      })) return

      if (transportKind === 'rawbt' || transportKind === 'qz') {
        try {
          const response = await claimNextPrintJob(station.id)
          if (!response?.job) return
          await executeClaimedJob(response.job, null)
        } catch (error) {
          if (error?.code === 'RAWBT_LAUNCH_FAILED' || QZ_BLOCKING_ERROR_CODES.has(error?.code)) updateBlocked(true)
          if (transportKind === 'qz') updateTransportReady(false)
          reportError(error)
          try { await refresh() } catch { /* next state poll will recover */ }
        }
        return
      }

      if (!getPrinterFingerprint(globalThis.localStorage, station.id)) {
        portRef.current = null
        updateTransportReady(false)
        setPrinterState('unconfigured')
        return
      }

      let port
      try {
        port = await findAuthorizedPrinterPort(globalThis.navigator?.serial, globalThis.localStorage, station.id)
      } catch (error) {
        updateTransportReady(false)
        reportError(error)
        return
      }
      if (!port) {
        portRef.current = null
        updateTransportReady(false)
        setPrinterState('disconnected')
        return
      }
      portRef.current = port
      updateTransportReady(true)

      try {
        const response = await claimNextPrintJob(station.id)
        if (!response?.job) return
        await executeClaimedJob(response.job, port)
      } catch (error) {
        if (error?.code === 'SERIAL_OPEN_FAILED') updateBlocked(true)
        updateTransportReady(false)
        reportError(error)
        try { await refresh() } catch { /* next state poll will recover */ }
      }
    }
    const timer = globalThis.setInterval?.(() => { void consumeNext() }, PRINT_JOB_POLL_MS)
    return () => { if (timer) globalThis.clearInterval?.(timer) }
  }, [authenticated, executeClaimedJob, isOnline, isQz, refresh, reportError, supported, transportKind, updateBlocked, updateTransportReady])

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
    requestForcePrint,
    getPreviewDocument,
  }
}
