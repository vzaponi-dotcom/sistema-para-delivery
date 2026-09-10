import { resolvePrintQueueState } from './printQueue.js'

export const FORCE_PRINT_REASONS = Object.freeze([
  'ORDER_FINALIZED_BEFORE_PRINT',
  'ORDER_CANCELLED_BEFORE_PRINT',
])

const RETRYABLE_ATTENTION_CODES = new Set([
  'QZ_CONNECTION_FAILED',
  'QZ_PRINTER_NOT_CONFIGURED',
  'QZ_PRINTER_NOT_FOUND',
  'QZ_PRINT_FAILED',
])

const REPRINTABLE_UNCERTAIN_ATTENTION_CODES = new Set([
  'PROCESSING_OUTCOME_UNKNOWN',
  'SERIAL_WRITE_UNCERTAIN',
])

const PRINT_OUTCOME_UNKNOWN = 'PRINT_OUTCOME_UNKNOWN'

const errorCode = (job) => String(job?.lastError?.code || job?.attentionReason || '').trim().toUpperCase()

export const isForcePrintReason = (jobOrReason) => {
  const reason = typeof jobOrReason === 'string' ? jobOrReason : errorCode(jobOrReason)
  return FORCE_PRINT_REASONS.includes(String(reason).trim().toUpperCase())
}

export const isRetryablePrintJob = (job) => {
  if (String(job?.status || '').trim().toLowerCase() === 'failed') return true
  const state = resolvePrintQueueState(job?.queueState || job?.status)
  if (state === 'failed') return true
  return state === 'attention' && RETRYABLE_ATTENTION_CODES.has(errorCode(job))
}

export const isReprintablePrintJob = (job, { order } = {}) => {
  if (job?.type !== 'order' || order?.status === 'Cancelado') return false
  const state = resolvePrintQueueState(job?.queueState || job?.status)
  if (state === 'printed' || state === 'discarded') return true
  return state === 'attention'
    && !isForcePrintReason(job)
    && !isRetryablePrintJob(job)
    && REPRINTABLE_UNCERTAIN_ATTENTION_CODES.has(errorCode(job))
}

export const getPrintJobActions = (job, options = {}) => {
  const state = resolvePrintQueueState(job?.queueState || job?.status)
  if (state === 'waiting_second_copy' && Number(job?.copiesRequested) === 2 && Number(job?.copiesPrinted) === 1) {
    return [{ key: 'requestSecondCopy', label: 'Imprimir 2ª via' }, { key: 'skipSecondCopy', label: 'Não imprimir 2ª via' }]
  }
  if (state === 'queued' || state === 'waiting_station') {
    return [
      ...(Number(job?.priority) === 1 ? [] : [{ key: 'printNow', label: 'Imprimir agora' }]),
      { key: 'discard', label: 'Descartar' },
    ]
  }
  if (state === 'attention') {
    if (errorCode(job) === PRINT_OUTCOME_UNKNOWN) {
      return [
        { key: 'confirmPrinted', label: 'A via foi impressa' },
        { key: 'confirmNotPrinted', label: 'N\u00e3o foi impressa \u2014 reenviar' },
      ]
    }
    if (isForcePrintReason(job)) return [{ key: 'forcePrint', label: 'Imprimir mesmo assim' }, { key: 'discard', label: 'Descartar' }]
    if (isRetryablePrintJob(job)) return [{ key: 'retry', label: 'Tentar novamente' }, { key: 'discard', label: 'Descartar' }]
    if (isReprintablePrintJob(job, options)) return [{ key: 'reprint', label: 'Reimprimir' }, { key: 'discard', label: 'Descartar' }]
    return [{ key: 'discard', label: 'Descartar' }]
  }
  if (isReprintablePrintJob(job, options)) return [{ key: 'reprint', label: 'Reimprimir' }]
  return []
}
