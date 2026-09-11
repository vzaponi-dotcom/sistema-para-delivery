export const PRINT_QUEUE_STATES = Object.freeze({
  QUEUED: 'queued',
  WAITING_STATION: 'waiting_station',
  PRINTING: 'printing',
  WAITING_CONFIRMATION: 'waiting_confirmation',
  WAITING_SECOND_COPY: 'waiting_second_copy',
  PRINTED: 'printed',
  ATTENTION: 'attention',
  DISCARDED: 'discarded',
})

const {
  QUEUED,
  WAITING_STATION,
  PRINTING,
  WAITING_CONFIRMATION,
  WAITING_SECOND_COPY,
  PRINTED,
  ATTENTION,
  DISCARDED,
} = PRINT_QUEUE_STATES

const PRINT_QUEUE_LABELS = Object.freeze({
  [QUEUED]: 'Na fila',
  [WAITING_STATION]: 'Aguardando estação',
  [PRINTING]: 'Imprimindo',
  [WAITING_CONFIRMATION]: 'Aguardando confirma\u00e7\u00e3o',
  [WAITING_SECOND_COPY]: 'Aguardando 2ª via',
  [PRINTED]: 'Impresso',
  [ATTENTION]: 'Requer atenção',
  [DISCARDED]: 'Descartado',
})

const PRINT_QUEUE_STATE_ALIASES = Object.freeze({
  pending: QUEUED,
  queued: QUEUED,
  waiting_station: WAITING_STATION,
  processing: PRINTING,
  printing: PRINTING,
  awaiting_confirmation: WAITING_CONFIRMATION,
  awaiting_second_copy: WAITING_SECOND_COPY,
  waiting_second_copy: WAITING_SECOND_COPY,
  printed: PRINTED,
  failed: ATTENTION,
  requires_attention: ATTENTION,
  attention: ATTENTION,
  discarded: DISCARDED,
})

const PRINT_QUEUE_TRANSITIONS = Object.freeze({
  [QUEUED]: new Set([WAITING_STATION, PRINTING, ATTENTION, DISCARDED]),
  [WAITING_STATION]: new Set([QUEUED, PRINTING, ATTENTION, DISCARDED]),
  [PRINTING]: new Set([WAITING_CONFIRMATION, WAITING_SECOND_COPY, PRINTED, ATTENTION]),
  [WAITING_CONFIRMATION]: new Set([WAITING_SECOND_COPY, PRINTED, ATTENTION]),
  [WAITING_SECOND_COPY]: new Set([PRINTING, ATTENTION, DISCARDED]),
  [ATTENTION]: new Set([QUEUED, WAITING_STATION, DISCARDED]),
  [PRINTED]: new Set(),
  [DISCARDED]: new Set(),
})

function normalizeStatusKey(status) {
  return typeof status === 'string' ? status.trim().toLowerCase() : ''
}

function resolveKnownPrintQueueState(status) {
  return PRINT_QUEUE_STATE_ALIASES[normalizeStatusKey(status)] ?? null
}

export function resolvePrintQueueState(status, { stationReady = true } = {}) {
  const state = resolveKnownPrintQueueState(status) ?? ATTENTION
  if (state === QUEUED && !stationReady) return WAITING_STATION
  return state
}

export function getPrintQueueLabel(status, options) {
  return PRINT_QUEUE_LABELS[resolvePrintQueueState(status, options)]
}

export function isPrintQueueTerminal(status) {
  const state = resolvePrintQueueState(status)
  return state === PRINTED || state === DISCARDED
}

export function canTransitionPrintQueueState(from, to) {
  const fromState = resolveKnownPrintQueueState(from)
  const toState = resolveKnownPrintQueueState(to)
  if (!fromState || !toState) return false
  return PRINT_QUEUE_TRANSITIONS[fromState]?.has(toState) ?? false
}
