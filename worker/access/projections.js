const has = (granted, capability) => granted instanceof Set && granted.has(capability)
const hasAny = (granted, capabilities) => capabilities.some((key) => has(granted, key))
const terminalStatuses = new Set(['Finalizado', 'Cancelado'])
const activeStatuses = new Set(['Em preparo', 'Agendado'])
const canReadMovements = (granted) => hasAny(granted, ['finance.movements', 'finance.movements.manage'])
const canReadReservations = (granted) => hasAny(granted, ['orders.view', 'orders.history', 'comandas.view'])
const PRINT_JOB_METADATA_KEYS = Object.freeze([
  'id', 'orderId', 'tableTabId', 'type', 'trigger', 'status', 'priority', 'parentJobId',
  'copiesRequested', 'copiesPrinted', 'stationId', 'createdAt', 'availableAt',
  'processingStartedAt', 'processedAt', 'discardedAt', 'attentionReason',
  'actionActorLabel', 'actionAt', 'secondCopyPromptedAt', 'secondCopyRequestedAt', 'secondCopySkippedAt',
])
export const projectPrintJobMetadata = (job) => job == null ? job : Object.fromEntries(
  PRINT_JOB_METADATA_KEYS.filter((key) => Object.hasOwn(job, key)).map((key) => [key, job[key]]),
)

// Shared by operational lists, mutation effects and print-document authorization.
export function canReadOrder(order, granted) {
  if (!order) return false
  if (terminalStatuses.has(order.status)) return has(granted, 'orders.history')
  return activeStatuses.has(order.status) && has(granted, 'orders.view')
}

export const projectOrderList = (orders, granted) => (Array.isArray(orders) ? orders : []).filter((order) => canReadOrder(order, granted))

const canReadReservation = (reservation, granted) => reservation && (has(granted, 'comandas.view') || canReadOrder({ status: reservation.orderStatus }, granted))
const projectTable = (table, granted) => {
  if (!table) return table
  const projected = { ...table }
  if (!has(granted, 'comandas.view')) {
    delete projected.openTableTab
    delete projected.openTableTabId
  }
  if (!canReadReservations(granted) || (table.nextReservation && !canReadReservation(table.nextReservation, granted))) delete projected.nextReservation
  return projected
}

export function projectBootstrap(payload, granted) {
  const projected = {}
  for (const key of ['business', 'effectiveBusinessConfig', 'effectiveConfigVersion']) {
    if (Object.hasOwn(payload, key)) projected[key] = payload[key]
  }
  for (const [key, capability] of [['clients', 'clients.view'], ['products', 'products.view'], ['tableTabs', 'comandas.view']]) {
    if (has(granted, capability) && Object.hasOwn(payload, key)) projected[key] = payload[key]
  }
  if (hasAny(granted, ['orders.view', 'orders.history']) && Object.hasOwn(payload, 'orders')) projected.orders = projectOrderList(payload.orders, granted)
  if (has(granted, 'tables.view') && Object.hasOwn(payload, 'tables')) projected.tables = payload.tables.map((table) => projectTable(table, granted))
  if (canReadMovements(granted) && Object.hasOwn(payload, 'movements')) projected.movements = payload.movements
  if (hasAny(granted, ['finance.overview', 'finance.movements', 'finance.movements.manage']) && Object.hasOwn(payload, 'financeSettings')) projected.financeSettings = payload.financeSettings
  return projected
}

export function projectMutationEffects(payload, granted) {
  const projected = projectBootstrap(payload, granted)
  if (Object.hasOwn(payload, 'order')) {
    if (canReadOrder(payload.order, granted)) projected.order = payload.order
    else if (payload.order?.id) projected.deletedOrderIds = [payload.order.id]
  }
  for (const [key, capability] of [['client', 'clients.view'], ['deletedClientId', 'clients.view'], ['product', 'products.view'], ['deletedProductId', 'products.view'], ['tableTab', 'comandas.view']]) {
    if (has(granted, capability) && Object.hasOwn(payload, key)) projected[key] = payload[key]
  }
  if (has(granted, 'tables.view') && Object.hasOwn(payload, 'table')) projected.table = projectTable(payload.table, granted)
  if (Object.hasOwn(payload, 'orders')) {
    const denied = payload.orders.filter((order) => !canReadOrder(order, granted)).map(({ id }) => id)
    if (denied.length) projected.deletedOrderIds = [...(projected.deletedOrderIds || []), ...denied]
  }
  for (const key of ['movement', 'deletedMovementId']) {
    if (canReadMovements(granted) && Object.hasOwn(payload, key)) projected[key] = payload[key]
  }
  if (canReadReservation(payload.reservation, granted)) projected.reservation = payload.reservation
  if (canReadReservations(granted) && Array.isArray(payload.reservations)) projected.reservations = payload.reservations.filter((reservation) => canReadReservation(reservation, granted))
  const canReadPrintDocument = has(granted, 'printing.execute') && canReadOrder(payload.order, granted)
    && (!payload.printJob || payload.printJob.orderId === payload.order.id)
  if (has(granted, 'printing.queue') || canReadPrintDocument) {
    if (Object.hasOwn(payload, 'printJob')) projected.printJob = canReadPrintDocument
      ? payload.printJob : projectPrintJobMetadata(payload.printJob)
    if (Object.hasOwn(payload, 'hasManualPrintHistory')) projected.hasManualPrintHistory = payload.hasManualPrintHistory
  }
  // These are confirmation of this operation, never the administrative receipt collection.
  if (has(granted, 'payments.receive') && (payload.payment || Array.isArray(payload.payments))) {
    for (const key of ['payment', 'payments', 'receipt', 'allocations']) if (Object.hasOwn(payload, key)) projected[key] = payload[key]
  }
  if (Object.hasOwn(payload, 'deleted')) projected.deleted = payload.deleted
  return projected
}
