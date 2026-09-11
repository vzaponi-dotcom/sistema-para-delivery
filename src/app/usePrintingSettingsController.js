import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getPrintSettings, savePrintSettings } from '../api/client.js'
import { hasCapability } from './access.js'

const RESOURCE_KEYS = Object.freeze(['business-copies', 'station-config', 'local-printer'])

const resourceState = (confirmedValue = null) => ({
  status: 'idle',
  confirmedValue,
  error: '',
  revision: 0,
  owner: null,
})

const initialResources = (printing) => ({
  'business-copies': resourceState(),
  'station-config': resourceState(printing?.localStation ?? null),
  'local-printer': resourceState(printing?.configuredPrinterName ?? null),
})

const errorMessage = (error, fallback) => error?.message || fallback
const isUnconfirmedFailure = (error) => (
  !Number.isInteger(error?.status)
  || error.status === 408
  || error.status >= 500
)

export function usePrintingSettingsController({
  authenticated,
  sessionKey,
  printing,
  granted,
  onFeedback,
}) {
  const identityRef = useRef({ key: null, generation: 0 })
  const identityKey = `${authenticated ? 'authenticated' : 'anonymous'}:${String(sessionKey ?? '')}`
  const operationRef = useRef(0)
  const printingRef = useRef(printing)
  const feedbackRef = useRef(onFeedback)
  const businessGranted = hasCapability(granted, 'printing.settings')
  const stationGranted = hasCapability(granted, 'printing.station.configure')
  const [resources, setResources] = useState(() => initialResources(printing))
  const resourcesRef = useRef(resources)

  useLayoutEffect(() => {
    if (identityRef.current.key !== identityKey) {
      identityRef.current = { key: identityKey, generation: identityRef.current.generation + 1 }
    }
    printingRef.current = printing
    feedbackRef.current = onFeedback
  }, [identityKey, onFeedback, printing])

  const publish = useCallback((resource, update) => {
    const current = resourcesRef.current[resource]
    const next = typeof update === 'function' ? update(current) : update
    resourcesRef.current = { ...resourcesRef.current, [resource]: next }
    setResources(resourcesRef.current)
    return next
  }, [])

  const owns = useCallback((resource, owner) => {
    const current = resourcesRef.current[resource]
    return Boolean(
      owner
      && identityRef.current.generation === owner.generation
      && identityRef.current.key === owner.identityKey
      && current?.revision === owner.revision
      && current?.owner?.operationId === owner.operationId
    )
  }, [])

  const canUse = useCallback((resource) => {
    if (!authenticated) return false
    if (resource === 'business-copies') return businessGranted
    return stationGranted
  }, [authenticated, businessGranted, stationGranted])

  const readResource = useCallback(async (resource) => {
    if (resource === 'business-copies') {
      const result = await getPrintSettings()
      return result?.settings?.defaultCopies ?? null
    }
    if (resource === 'station-config') {
      const result = await printingRef.current?.refresh?.()
      const stationId = printingRef.current?.localStation?.id
      return result?.stations?.find((station) => station.id === stationId) ?? printingRef.current?.localStation ?? null
    }
    if (resource === 'local-printer') {
      await printingRef.current?.refreshPrinters?.()
      return printingRef.current?.readConfiguredPrinter?.() ?? printingRef.current?.configuredPrinterName ?? null
    }
    throw new Error('Recurso de configuração desconhecido.')
  }, [])

  const reload = useCallback(async (resource) => {
    if (!RESOURCE_KEYS.includes(resource) || !canUse(resource)) return false
    const previous = resourcesRef.current[resource]
    if (previous.status === 'saving') return false
    const owner = {
      identityKey: identityRef.current.key,
      generation: identityRef.current.generation,
      operationId: ++operationRef.current,
      revision: previous.revision + 1,
    }
    publish(resource, { ...previous, status: 'loading', error: '', revision: owner.revision, owner })
    try {
      const confirmedValue = await readResource(resource)
      if (!owns(resource, owner)) return false
      publish(resource, (current) => ({ ...current, status: 'idle', confirmedValue, error: '', owner: null }))
      return true
    } catch (error) {
      if (!owns(resource, owner)) return false
      if (error?.status === 401) feedbackRef.current?.(error)
      publish(resource, (current) => ({
        ...current,
        status: previous.status === 'unconfirmed' ? 'unconfirmed' : 'error',
        error: errorMessage(error, 'Não foi possível reconsultar esta configuração.'),
        owner: null,
      }))
      return false
    }
  }, [canUse, owns, publish, readResource])

  const saveResource = useCallback(async (resource, write, normalize, successMessage, { allowNull = false } = {}) => {
    if (!canUse(resource)) return false
    const previous = resourcesRef.current[resource]
    if (previous.status === 'saving' || previous.status === 'unconfirmed' || (!allowNull && previous.confirmedValue == null)) return false
    const owner = {
      identityKey: identityRef.current.key,
      generation: identityRef.current.generation,
      operationId: ++operationRef.current,
      revision: previous.revision + 1,
    }
    publish(resource, { ...previous, status: 'saving', error: '', revision: owner.revision, owner })
    try {
      const result = await write()
      if (!owns(resource, owner)) return false
      const confirmedValue = normalize(result)
      publish(resource, (current) => ({ ...current, status: 'idle', confirmedValue, error: '', owner: null }))
      feedbackRef.current?.(successMessage)
      return true
    } catch (error) {
      if (!owns(resource, owner)) return false
      if (error?.status === 401) {
        feedbackRef.current?.(error)
        return false
      }
      if (isUnconfirmedFailure(error)) {
        publish(resource, (current) => ({
          ...current,
          status: 'unconfirmed',
          error: errorMessage(error, 'O resultado da gravação não pôde ser confirmado.'),
          owner: null,
        }))
        feedbackRef.current?.('Configuração de impressão não confirmada. Reconsultando…')
        await reload(resource)
        return false
      }
      publish(resource, (current) => ({
        ...current,
        status: 'error',
        confirmedValue: previous.confirmedValue,
        error: errorMessage(error, 'Não foi possível salvar esta configuração.'),
        owner: null,
      }))
      feedbackRef.current?.(error)
      return false
    }
  }, [canUse, owns, publish, reload])

  const saveCopies = useCallback((value) => {
    const next = Number(value)
    if (next !== 1 && next !== 2) return Promise.resolve(false)
    return saveResource(
      'business-copies',
      () => savePrintSettings({ defaultCopies: next }),
      (result) => result?.settings?.defaultCopies ?? next,
      'Vias do negócio salvas para novos pedidos.',
    )
  }, [saveResource])

  const saveStation = useCallback((patch) => saveResource(
    'station-config',
    () => printingRef.current?.saveStationSettings?.(patch),
    (station) => station,
    'Configuração da estação salva.',
  ), [saveResource])

  const makePrimary = useCallback((stationId) => saveResource(
    'station-config',
    () => printingRef.current?.makePrimary?.(stationId),
    (station) => station,
    'Esta estação agora é a principal para impressão automática.',
  ), [saveResource])

  const selectPrinter = useCallback((name) => saveResource(
    'local-printer',
    () => printingRef.current?.selectPrinter?.(name),
    (printerName) => String(printerName || name).trim(),
    `Impressora ${String(name || '').trim()} configurada nesta estação.`,
    { allowNull: true },
  ), [saveResource])

  useEffect(() => {
    const next = initialResources(printingRef.current)
    resourcesRef.current = next
    setResources(next)
    if (authenticated && businessGranted) void reload('business-copies')
  }, [authenticated, businessGranted, identityKey, reload])

  useEffect(() => {
    const station = resourcesRef.current['station-config']
    if (!['saving', 'unconfirmed'].includes(station.status) && printing?.localStation !== undefined) {
      publish('station-config', (current) => ({ ...current, confirmedValue: printing.localStation ?? null }))
    }
    const printer = resourcesRef.current['local-printer']
    if (!['saving', 'unconfirmed'].includes(printer.status) && printing?.configuredPrinterName !== undefined) {
      publish('local-printer', (current) => ({ ...current, confirmedValue: printing.configuredPrinterName ?? null }))
    }
  }, [printing?.configuredPrinterName, printing?.localStation, publish])

  return { resources, reload, saveCopies, saveStation, makePrimary, selectPrinter }
}
