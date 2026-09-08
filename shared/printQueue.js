export const PRINT_QUEUE_STATES = Object.freeze({
  QUEUED: 'queued',
  WAITING_STATION: 'waiting_station',
  PRINTING: 'printing',
  WAITING_SECOND_COPY: 'waiting_second_copy',
  PRINTED: 'printed',
  ATTENTION: 'attention',
  DISCARDED: 'discarded',
})

export const resolvePrintQueueState = () => {
  throw new Error('print queue state resolver not implemented')
}

export const getPrintQueueLabel = () => {
  throw new Error('print queue labels not implemented')
}

export const isPrintQueueTerminal = () => {
  throw new Error('print queue terminality not implemented')
}

export const canTransitionPrintQueueState = () => {
  throw new Error('print queue transition rules not implemented')
}
