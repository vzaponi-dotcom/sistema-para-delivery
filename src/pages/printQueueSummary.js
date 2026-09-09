import { PRINT_QUEUE_STATES, resolvePrintQueueState } from '../../shared/printQueue.js'

const emptySummary = () => ({ queued: 0, waitingStation: 0, waitingSecondCopy: 0, attention: 0 })

export const buildPrintQueueSummary = (jobs = [], { stationReady = true } = {}) => jobs.reduce((summary, job) => {
  const state = job?.queueState
    ? resolvePrintQueueState(job.queueState)
    : resolvePrintQueueState(job?.status, { stationReady })
  if (state === PRINT_QUEUE_STATES.QUEUED) summary.queued += 1
  if (state === PRINT_QUEUE_STATES.WAITING_STATION) summary.waitingStation += 1
  if (state === PRINT_QUEUE_STATES.WAITING_SECOND_COPY) summary.waitingSecondCopy += 1
  if (state === PRINT_QUEUE_STATES.ATTENTION) summary.attention += 1
  return summary
}, emptySummary())

export const getPrintStationSummary = (station) => {
  const health = station?.health
  if (!health || typeof health.online !== 'boolean') {
    return { onlineLabel: 'Status indisponível', qzLabel: null, printerLabel: null }
  }
  return {
    onlineLabel: health.online ? 'Online' : 'Offline',
    qzLabel: typeof health.qzReady === 'boolean' ? (health.qzReady ? 'QZ conectado' : 'QZ desconectado') : null,
    printerLabel: typeof health.printerReady === 'boolean' ? (health.printerReady ? 'Fila encontrada' : 'Fila indisponível') : null,
  }
}
