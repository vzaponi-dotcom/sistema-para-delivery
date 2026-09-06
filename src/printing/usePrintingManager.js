import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  claimNextPrintJob,
  claimPrintJob,
  completePrintJob,
  createManualPrintJob,
  createTestPrintJob,
  failPrintJob,
  getOrderPrintDocument,
  getPrintJobs,
  getPrintStations,
  makePrimaryPrintStation,
  retryPrintJob,
  upsertPrintStation,
} from '../api/client.js'
import { renderEscPos58mm } from './escpos58mm.js'
import {
  detectPrintStationPlatform,
  findAuthorizedPrinterPort,
  getDefaultPrintStationName,
  getOrCreateLocalPrintStationId,
  getPrinterFingerprint,
  savePrinterFingerprint,
} from './localPrintStation.js'
import { MTP5_PROFILE } from './mtp5Profile.js'
import { runClaimedPrintJob } from './printJobRunner.js'
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

export const getPrintingTransportKind = (platform) => (
  platform === 'android' ? 'rawbt' : 'web-serial'
)

export const isPrintingTransportSupported = (
  platform,
  serial = globalThis.navigator?.serial,
) => getPrintingTransportKind(platform) === 'rawbt' || isWebSerialSupported(serial)

export const canConsumeAutomaticPrintJob = ({
  authenticated,
  isOnline,
  supported,
  visible,
  browserOnline: browserIsOnline,
  busyJobId,
  printerBlocked,
  station,
}) => Boolean(
  authenticated
  && isOnline
  && supported
  && visible
  && browserIsOnline
  && !busyJobId
  && !printerBlocked
  && station?.isPrimary
  && station?.autoPrintEnabled
)

export const usePrintingManager = ({ authenticated = false, isOnline = true, onError } = {}) => {
  const platform = detectPrintStationPlatform()
  const transportKind = getPrintingTransportKind(platform)
  const supported = isPrintingTransportSupported(platform)
  const isRawBt = transportKind === 'rawbt'
  const [localStation, setLocalStation] = useState(null)
  const [stations, setStations] = useState([])
  const [jobs, setJobs] = useState([])
  const [printerState, setPrinterState] = useState(isRawBt ? 'driver-ready' : (supported ? 'unconfigured' : 'unsupported'))
  const [printerBlocked, setPrinterBlocked] = useState(false)
  const [busyJobId, setBusyJobId] = useState(null)
  const [lastError, setLastError] = useState(null)

  const portRef = useRef(null)
  const localStationRef = useRef(null)
  const busyJobIdRef = useRef(null)
  const printerBlockedRef = useRef(false)
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

  const reportError = useCallback((error) => {
    setLastError(error || null)
    if (typeof onError === 'function' && error) onError(error)
  }, [onError])

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

  const resolveAuthorizedPort = useCallback(async ({ probe = false } = {}) => {
    if (isRawBt || !supported) return null
    const stationId = localStationRef.current?.id
    if (!stationId) return null
    const fingerprint = getPrinterFingerprint(globalThis.localStorage, stationId)
    if (!fingerprint) {
      portRef.current = null
      setPrinterState('unconfigured')
      return null
    }
    const port = await findAuthorizedPrinterPort(globalThis.navigator?.serial, globalThis.localStorage, stationId)
    portRef.current = port || null
    if (!port) {
      setPrinterState('disconnected')
      return null
    }
    if (!probe || busyJobIdRef.current) return port

    setPrinterState('connecting')
    try {
      await probeSerialPort(port, MTP5_PROFILE.serial)
      setPrinterState('connected')
      setLastError(null)
      return port
    } catch (error) {
      portRef.current = null
      setPrinterState('disconnected')
      if (error?.code === 'SERIAL_OPEN_FAILED') updateBlocked(true)
      reportError(error)
      return null
    }
  }, [isRawBt, reportError, supported, updateBlocked])

  const connectPrinter = useCallback(async () => {
    const stationId = localStationRef.current?.id
    if (!stationId) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')

    if (isRawBt) {
      portRef.current = null
      setPrinterState('driver-ready')
      setLastError(null)
      updateBlocked(false)
      return null
    }

    if (!supported) throw printerError('WEB_SERIAL_UNSUPPORTED', 'Este navegador não oferece impressão Bluetooth compatível.')
    setPrinterState('connecting')
    try {
      const port = await requestPrinterPort(globalThis.navigator?.serial)
      await probeSerialPort(port, MTP5_PROFILE.serial)
      savePrinterFingerprint(globalThis.localStorage, stationId, port)
      portRef.current = port
      setPrinterState('connected')
      setLastError(null)
      updateBlocked(false)
      return port
    } catch (error) {
      portRef.current = null
      setPrinterState(getPrinterFingerprint(globalThis.localStorage, stationId) ? 'disconnected' : 'unconfigured')
      reportError(error)
      throw error
    }
  }, [isRawBt, reportError, supported, updateBlocked])

  const getExplicitPort = useCallback(async () => {
    if (isRawBt) return null
    let port = portRef.current || await resolveAuthorizedPort({ probe: true })
    if (port) return port
    try {
      port = await connectPrinter()
      return port
    } catch (error) {
      if (error?.code) throw error
      throw printerError('PRINTER_NOT_AUTHORIZED', 'Selecione e autorize a impressora antes de imprimir.')
    }
  }, [connectPrinter, isRawBt, resolveAuthorizedPort])

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
        renderer: renderEscPos58mm,
        transport: transportKind === 'rawbt'
          ? (_selectedPort, bytes) => dispatchRawBtBytes(bytes)
          : (selectedPort, bytes) => writeSerialBytes(selectedPort, bytes, MTP5_PROFILE.serial),
      })
      if (result.status === 'printed') {
        setPrinterState(isRawBt ? 'driver-ready' : 'connected')
        setLastError(null)
        if (clearBlockOnSuccess) updateBlocked(false)
      } else {
        setPrinterState(isRawBt ? 'driver-ready' : 'disconnected')
        if (['SERIAL_OPEN_FAILED', 'PRINTER_NOT_AUTHORIZED', 'RAWBT_LAUNCH_FAILED'].includes(result.error?.code)) updateBlocked(true)
        reportError(result.error)
      }
      return result
    } finally {
      updateBusyJob(null)
      try { await refresh() } catch (error) { reportError(error) }
    }
  }, [isRawBt, refresh, reportError, transportKind, updateBlocked, updateBusyJob])

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
    const station = localStationRef.current
    if (!station?.id) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')
    const port = await getExplicitPort()
    const created = await createManualPrintJob(orderId, copies)
    const claimed = await claimPrintJob(created.job.id, station.id)
    return executeClaimedJob(claimed.job, port)
  }, [executeClaimedJob, getExplicitPort])

  const printSecondCopy = useCallback(async (job) => {
    const station = localStationRef.current
    if (!station?.id) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')
    if (!job?.id) throw printerError('PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
    if (
      job.status !== 'printed'
      || Number(job.copiesRequested) !== 2
      || Number(job.copiesPrinted) !== 1
    ) {
      throw printerError('PRINT_SECOND_COPY_NOT_READY', 'A segunda via não está disponível para este trabalho.')
    }
    const port = await getExplicitPort()
    const claimed = await claimPrintJob(job.id, station.id)
    return executeClaimedJob(claimed.job, port, { clearBlockOnSuccess: true })
  }, [executeClaimedJob, getExplicitPort])

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
      portRef.current = null
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
          setPrinterState('driver-ready')
        } else if (supported) {
          await resolveAuthorizedPort({ probe: true })
        }
      } catch (error) {
        if (!cancelled) reportError(error)
      }
    }
    void initialize()
    return () => { cancelled = true }
  }, [authenticated, isRawBt, platform, refresh, reportError, resolveAuthorizedPort, supported, updateBlocked, updateBusyJob, updateLocalStation])

  useEffect(() => {
    if (!authenticated || !isOnline) return undefined
    const sync = () => {
      if (!visiblePage()) return
      void refresh().catch(reportError)
      if (!isRawBt && !busyJobIdRef.current && supported) void resolveAuthorizedPort({ probe: false }).catch(reportError)
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
  }, [authenticated, isOnline, isRawBt, refresh, reportError, resolveAuthorizedPort, supported])

  useEffect(() => {
    if (!authenticated || !isOnline || !localStation?.id) return undefined
    const heartbeat = async () => {
      const station = localStationRef.current
      if (!station) return
      try {
        const response = await upsertPrintStation(station.id, {
          name: station.name,
          platform: station.platform,
          autoPrintEnabled: station.autoPrintEnabled,
          defaultCopies: station.defaultCopies,
        })
        updateLocalStation(response.station)
      } catch (error) { reportError(error) }
    }
    const timer = globalThis.setInterval?.(() => { if (visiblePage()) void heartbeat() }, STATION_HEARTBEAT_MS)
    return () => { if (timer) globalThis.clearInterval?.(timer) }
  }, [authenticated, isOnline, localStation?.id, reportError, updateLocalStation])

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
        station,
      })) return

      if (transportKind === 'rawbt') {
        try {
          const response = await claimNextPrintJob(station.id)
          if (!response?.job) return
          await executeClaimedJob(response.job, null)
        } catch (error) {
          if (error?.code === 'RAWBT_LAUNCH_FAILED') updateBlocked(true)
          reportError(error)
          try { await refresh() } catch { /* next state poll will recover */ }
        }
        return
      }

      if (!getPrinterFingerprint(globalThis.localStorage, station.id)) {
        portRef.current = null
        setPrinterState('unconfigured')
        return
      }

      let port
      try {
        port = await findAuthorizedPrinterPort(globalThis.navigator?.serial, globalThis.localStorage, station.id)
      } catch (error) {
        reportError(error)
        return
      }
      if (!port) {
        portRef.current = null
        setPrinterState('disconnected')
        return
      }
      portRef.current = port

      try {
        const response = await claimNextPrintJob(station.id)
        if (!response?.job) return
        await executeClaimedJob(response.job, port)
      } catch (error) {
        if (error?.code === 'SERIAL_OPEN_FAILED') updateBlocked(true)
        reportError(error)
        try { await refresh() } catch { /* next state poll will recover */ }
      }
    }
    const timer = globalThis.setInterval?.(() => { void consumeNext() }, PRINT_JOB_POLL_MS)
    return () => { if (timer) globalThis.clearInterval?.(timer) }
  }, [authenticated, executeClaimedJob, isOnline, refresh, reportError, supported, transportKind, updateBlocked])

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
    refresh,
    connectPrinter,
    saveStationSettings,
    makePrimary,
    testPrint,
    printOrder,
    printSecondCopy,
    retryJob,
    getPreviewDocument,
  }
}
