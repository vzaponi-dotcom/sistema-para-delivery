import { PRINT_QUEUE_STATES, resolvePrintQueueState } from '../../shared/printQueue.js'

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))

const getOperationalOrderNumber = (order = {}) => {
  const explicitNumber = [order.displayNumber, order.operationalNumber, order.orderNumber]
    .map((value) => String(value || '').trim())
    .find(Boolean)
  if (explicitNumber) return explicitNumber

  const snapshotNumber = String(order.number || '').trim()
  if (!snapshotNumber) return null
  if (isUuid(order.id) && String(order.id).endsWith(snapshotNumber)) return null
  return snapshotNumber
}

const getHumanIdentifiers = (job) => {
  const document = job?.document || {}
  const order = document.order || {}
  return [
    getOperationalOrderNumber(order),
    document.customer?.name,
    document.tableIdentifier,
    order.tableIdentifier,
    document.table?.identifier,
  ].filter(Boolean)
}

const normalizeSearch = (value) => String(value || '')
  .trim()
  .toLocaleLowerCase('pt-BR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

export const getPrintQueueSearchText = (job) => getHumanIdentifiers(job).map(normalizeSearch).join(' ')

export const filterPrintQueueJobs = (jobs, { search = '', status = 'all', origin = 'all', stationReady = true } = {}) => {
  const normalizedSearch = normalizeSearch(search)
  return jobs.filter((job) => {
    const jobState = resolvePrintQueueState(job?.queueState || job?.status, { stationReady })
    const searchMatches = !normalizedSearch || getPrintQueueSearchText(job).includes(normalizedSearch)
    const statusMatches = status === 'all' || jobState === status
    const originMatches = origin === 'all' || job?.trigger === origin
    return searchMatches && statusMatches && originMatches
  })
}

export const PRINT_QUEUE_STATUS_FILTERS = Object.freeze([
  { value: 'all', label: 'Todos' },
  { value: PRINT_QUEUE_STATES.QUEUED, label: 'Na fila' },
  { value: PRINT_QUEUE_STATES.WAITING_STATION, label: 'Aguardando estação' },
  { value: PRINT_QUEUE_STATES.PRINTING, label: 'Imprimindo' },
  { value: PRINT_QUEUE_STATES.WAITING_SECOND_COPY, label: 'Aguardando 2ª via' },
  { value: PRINT_QUEUE_STATES.ATTENTION, label: 'Requer atenção' },
  { value: PRINT_QUEUE_STATES.PRINTED, label: 'Impresso' },
  { value: PRINT_QUEUE_STATES.DISCARDED, label: 'Descartado' },
])

export const PRINT_QUEUE_ORIGIN_FILTERS = Object.freeze([
  { value: 'all', label: 'Todas' },
  { value: 'automatic', label: 'Automático' },
  { value: 'manual', label: 'Manual/Reimpressão' },
])
