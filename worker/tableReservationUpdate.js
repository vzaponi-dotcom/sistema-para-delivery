import { formatClientPhone } from '../shared/clientIdentity.js'
import { createOrderPrintDocument } from '../shared/orderPrintDocument.js'
import { resolveAutomaticOrderPrintAvailableAt } from '../shared/printContextPolicy.js'
import { formatProductPresentation } from '../shared/productCatalog.js'
import { getOperationalStartAt } from '../shared/orderTiming.js'
import { calculateCheckoutTotals } from './orderCheckout.js'
import { loadOperations } from './operationSettingsRepository.js'
import { preparePolicyGuards, readOrderModalityExpectation, rethrowPolicyChange } from './operationalPolicyGuards.js'
import { loadOrderById } from './repositories.js'
import { clearSettingsAssertions, prepareSettingsAssertion } from './settingsTransactions.js'
import { loadTableReservationById } from './tableReservationRepository.js'

const domainError = (status, code, message) => Object.assign(new Error(message), { status, code })
const rows = (result) => Array.isArray(result?.results) ? result.results : []

const productSnapshotSize = (row) => {
  const presentation = formatProductPresentation({
    id: row.id,
    category: row.category,
    size: row.size || '',
    name: row.name,
    price: Number(row.price_cents || 0) / 100,
    presentationType: row.presentation_type,
    presentationValue: row.presentation_value,
    presentationUnit: row.presentation_unit,
  })
  return presentation === 'Unidade' ? 'Un' : presentation
}

const validateInput = (input) => {
  if (!Number.isInteger(input?.expectedRevision) || input.expectedRevision < 1) {
    throw domainError(400, 'TABLE_RESERVATION_REVISION_REQUIRED', 'Atualize a reserva e tente novamente.')
  }
  if (input?.type !== 'Local' || input?.customerIdentity?.type !== 'table' || !input.customerIdentity.tableId) {
    throw domainError(400, 'TABLE_RESERVATION_UPDATE_INVALID', 'A edição da reserva precisa manter um pedido Local vinculado a uma mesa.')
  }
  if (!input?.scheduledFor || !input?.orderDate) {
    throw domainError(400, 'TABLE_RESERVATION_UPDATE_INVALID', 'Informe a nova data e horário da reserva.')
  }
  if (!Array.isArray(input?.items) || input.items.length === 0) {
    throw domainError(400, 'TABLE_RESERVATION_UPDATE_INVALID', 'Adicione pelo menos um item à reserva.')
  }
  if (Number(input.deliveryFeeCents || 0) !== 0) {
    throw domainError(400, 'TABLE_RESERVATION_UPDATE_INVALID', 'Reserva Local não aceita taxa de entrega.')
  }
}

const loadProduct = (db, businessId, productId) => db.prepare(`SELECT
    id, category, size, presentation_type, presentation_value, presentation_unit,
    name, price_cents, active
  FROM products
  WHERE id = ? AND business_id = ?
  LIMIT 1`).bind(productId, businessId).first()

const loadClient = (db, businessId, clientId) => clientId
  ? db.prepare('SELECT id, name, phone, address FROM clients WHERE id = ? AND business_id = ? LIMIT 1')
    .bind(clientId, businessId).first()
  : null

const loadTable = (db, businessId, tableId) => db.prepare(`SELECT id, name, is_active
  FROM tables
  WHERE id = ? AND business_id = ?
  LIMIT 1`).bind(tableId, businessId).first()

const loadAutomaticJob = (db, businessId, orderId) => db.prepare(`SELECT *
  FROM print_jobs
  WHERE business_id = ? AND order_id = ? AND type = 'order' AND trigger = 'automatic'
  LIMIT 1`).bind(businessId, orderId).first()

const hasManualHistory = async (db, businessId, orderId) => {
  const row = await db.prepare(`SELECT COUNT(*) AS count
    FROM print_jobs
    WHERE business_id = ? AND order_id = ? AND type = 'order' AND trigger = 'manual'`)
    .bind(businessId, orderId).first()
  return Number(row?.count || 0) > 0
}

export const updateTableReservation = async (
  db,
  businessId,
  reservationId,
  input,
  now = new Date(),
) => {
  validateInput(input)
  const reservation = await loadTableReservationById(db, businessId, reservationId)
  if (!reservation) throw domainError(404, 'TABLE_RESERVATION_NOT_FOUND', 'Reserva não encontrada.')
  if (reservation.status !== 'reserved') {
    throw domainError(409, 'TABLE_RESERVATION_ALREADY_CLOSED', 'Esta reserva já foi encerrada.')
  }
  if (reservation.revision !== input.expectedRevision) {
    throw domainError(409, 'TABLE_RESERVATION_CHANGED', 'A reserva foi alterada. Atualize os dados e tente novamente.')
  }

  const order = await loadOrderById(db, businessId, reservation.orderId)
  if (!order) throw domainError(404, 'ORDER_NOT_FOUND', 'Pedido da reserva não encontrado.')
  if (order.tableTabId || order.status !== 'Em preparo') {
    throw domainError(409, 'TABLE_RESERVATION_NOT_EDITABLE', 'Esta reserva não pode mais ser editada.')
  }

  const [operations, modalityExpectation] = await Promise.all([
    loadOperations(db, businessId),
    readOrderModalityExpectation(db, businessId, 'Local'),
  ])
  if (operations.revision !== modalityExpectation.revision) {
    throw domainError(409, 'POLICY_CHANGED', 'As configurações operacionais foram alteradas. Atualize e tente novamente.')
  }

  const currentOperationalStart = getOperationalStartAt({
    createdAt: order.createdAt,
    scheduledFor: reservation.scheduledFor,
  }, operations.data.timing)
  if (!currentOperationalStart || now >= currentOperationalStart) {
    throw domainError(409, 'TABLE_RESERVATION_NOT_EDITABLE', 'Esta reserva já entrou na janela de preparo e não pode mais ser editada.')
  }

  const table = await loadTable(db, businessId, input.customerIdentity.tableId)
  if (!table) throw domainError(404, 'TABLE_NOT_FOUND', 'Mesa não encontrada.')
  if (!table.is_active) throw domainError(409, 'TABLE_INACTIVE', 'A mesa está inativa.')

  const client = await loadClient(db, businessId, input.customerIdentity.clientId)
  if (input.customerIdentity.clientId && !client) {
    throw domainError(404, 'CLIENT_NOT_FOUND', 'Cliente não encontrado.')
  }

  const pricedItems = []
  for (const item of input.items) {
    const product = await loadProduct(db, businessId, item.productId)
    if (!product || product.active !== 1) throw domainError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.')
    pricedItems.push({ ...item, product, priceCents: Number(product.price_cents) })
  }

  const totals = calculateCheckoutTotals(pricedItems, 0, input.adjustment)
  const scheduledAt = new Date(input.scheduledFor)
  if (Number.isNaN(scheduledAt.getTime())) {
    throw domainError(400, 'TABLE_RESERVATION_UPDATE_INVALID', 'Horário agendado inválido.')
  }
  const endsAt = new Date(scheduledAt.getTime() + reservation.durationMinutes * 60_000).toISOString()
  const clientSnapshot = client?.name || table.name
  const clientPhoneSnapshot = client ? formatClientPhone(client.phone) : ''
  const clientAddressSnapshot = client?.address || ''
  const at = now.toISOString()
  const autoJob = await loadAutomaticJob(db, businessId, order.id)
  const manualPrintHistory = await hasManualHistory(db, businessId, order.id)
  const business = await db.prepare('SELECT name FROM businesses WHERE id = ? LIMIT 1').bind(businessId).first()

  const printDocument = createOrderPrintDocument({
    businessName: business?.name || 'Estabelecimento',
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderDate: input.orderDate,
    createdAt: order.createdAt,
    type: 'Local',
    scheduledFor: scheduledAt.toISOString(),
    scheduleLabel: 'RESERVA',
    customerIdentityType: 'table',
    tableIdentifier: table.name,
    hasOptionalClient: Boolean(client?.id),
    customer: {
      name: clientSnapshot,
      phone: clientPhoneSnapshot,
      address: clientAddressSnapshot,
    },
    items: pricedItems.map((item) => ({
      name: item.product.name,
      presentation: productSnapshotSize(item.product),
      quantity: item.quantity,
      note: item.note || '',
      unitPriceCents: Number(item.product.price_cents),
    })),
    subtotalCents: totals.subtotalCents,
    deliveryFeeCents: 0,
    adjustment: {
      type: input.adjustment?.type || 'none',
      amountCents: totals.adjustmentAmountCents,
      reason: input.adjustment?.reason || '',
    },
    totalCents: totals.totalCents,
    payment: { status: 'Pendente', method: '' },
  })
  const availableAt = resolveAutomaticOrderPrintAvailableAt({
    type: 'Local',
    customerIdentityType: 'table',
    orderDate: input.orderDate,
    createdAt: order.createdAt,
    scheduledFor: scheduledAt.toISOString(),
  }, operations.data.timing)

  const txId = crypto.randomUUID()
  const policyGuards = preparePolicyGuards(db, businessId, { operations: modalityExpectation }, txId)
  const reservationGuard = prepareSettingsAssertion(
    db,
    txId,
    'reservation',
    "EXISTS (SELECT 1 FROM table_reservations WHERE id = ? AND business_id = ? AND status = 'reserved' AND revision = ?)",
    [reservation.id, businessId, input.expectedRevision],
  )
  const tableGuard = prepareSettingsAssertion(
    db,
    txId,
    'table',
    'EXISTS (SELECT 1 FROM tables WHERE id = ? AND business_id = ? AND is_active = 1)',
    [table.id, businessId],
  )
  const productIds = [...new Set(pricedItems.map((item) => item.product.id))]
  const productPlaceholders = productIds.map(() => '?').join(', ')
  const productGuard = prepareSettingsAssertion(
    db,
    txId,
    'products',
    `(SELECT COUNT(*) FROM products
       WHERE business_id = ? AND active = 1 AND id IN (${productPlaceholders})) = ?`,
    [businessId, ...productIds, productIds.length],
  )
  const autoJobGuard = autoJob?.status === 'pending'
    ? prepareSettingsAssertion(
        db,
        txId,
        'automatic-print',
        "EXISTS (SELECT 1 FROM print_jobs WHERE id = ? AND business_id = ? AND order_id = ? AND trigger = 'automatic' AND status = 'pending' AND copies_requested = ?)",
        [autoJob.id, businessId, order.id, Number(autoJob.copies_requested)],
      )
    : null

  const updateOrder = db.prepare(`UPDATE orders
    SET client_id = ?,
      client_name_snapshot = ?,
      client_phone_snapshot = ?,
      client_address_snapshot = ?,
      order_date = ?,
      scheduled_for = ?,
      subtotal_cents = ?,
      delivery_fee_cents = 0,
      adjustment_type = ?,
      adjustment_mode = ?,
      adjustment_value = ?,
      adjustment_amount_cents = ?,
      adjustment_reason = ?,
      total_cents = ?
    WHERE id = ? AND business_id = ? AND table_tab_id IS NULL AND status = 'Em preparo'`).bind(
    client?.id || null,
    clientSnapshot,
    clientPhoneSnapshot,
    clientAddressSnapshot,
    input.orderDate,
    scheduledAt.toISOString(),
    totals.subtotalCents,
    input.adjustment?.type || 'none',
    input.adjustment?.mode || 'fixed',
    Number(input.adjustment?.storedValue) || 0,
    totals.adjustmentAmountCents,
    input.adjustment?.reason || '',
    totals.totalCents,
    order.id,
    businessId,
  )
  const deleteItems = db.prepare('DELETE FROM order_items WHERE business_id = ? AND order_id = ?')
    .bind(businessId, order.id)
  const updateReservation = db.prepare(`UPDATE table_reservations
    SET table_id = ?,
      table_name_snapshot = ?,
      scheduled_for = ?,
      ends_at = ?,
      updated_at = ?,
      revision = revision + 1
    WHERE id = ? AND business_id = ? AND status = 'reserved' AND revision = ?`).bind(
    table.id,
    table.name,
    scheduledAt.toISOString(),
    endsAt,
    at,
    reservation.id,
    businessId,
    input.expectedRevision,
  )

  const statements = [
    ...policyGuards,
    reservationGuard,
    tableGuard,
    productGuard,
    ...(autoJobGuard ? [autoJobGuard] : []),
    updateOrder,
    deleteItems,
  ]
  for (const item of pricedItems) {
    statements.push(db.prepare(`INSERT INTO order_items (
      id, business_id, order_id, product_id, name_snapshot, category_snapshot, size_snapshot,
      quantity, catalog_price_cents, unit_price_cents, price_reason, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`).bind(
      crypto.randomUUID(),
      businessId,
      order.id,
      item.product.id,
      item.product.name,
      item.product.category || '',
      productSnapshotSize(item.product),
      item.quantity,
      Number(item.product.price_cents),
      Number(item.product.price_cents),
      item.note || '',
      at,
    ))
  }
  statements.push(updateReservation)
  if (autoJob?.status === 'pending') {
    statements.push(db.prepare(`UPDATE print_jobs
      SET snapshot_json = ?, available_at = ?
      WHERE id = ? AND business_id = ? AND order_id = ?
        AND type = 'order' AND trigger = 'automatic' AND status = 'pending'`).bind(
      JSON.stringify(printDocument),
      availableAt,
      autoJob.id,
      businessId,
      order.id,
    ))
  }
  statements.push(clearSettingsAssertions(db, txId))

  try {
    await db.batch(statements)
  } catch (error) {
    const message = String(error?.message || '')
    if (message.includes('TABLE_RESERVATION_CONFLICT')) {
      throw domainError(409, 'TABLE_RESERVATION_CONFLICT', 'Esta mesa já possui uma reserva nesse horário. Escolha outra mesa ou outro horário.')
    }
    if (message.includes('POLICY_CHANGED')) rethrowPolicyChange(error)
    if (message.includes('SETTINGS_INVALID')) {
      const refreshed = await loadTableReservationById(db, businessId, reservationId)
      if (!refreshed) throw domainError(404, 'TABLE_RESERVATION_NOT_FOUND', 'Reserva não encontrada.')
      if (refreshed.status !== 'reserved') {
        throw domainError(409, 'TABLE_RESERVATION_ALREADY_CLOSED', 'Esta reserva já foi encerrada.')
      }
      if (refreshed.revision !== input.expectedRevision) {
        throw domainError(409, 'TABLE_RESERVATION_CHANGED', 'A reserva foi alterada. Atualize os dados e tente novamente.')
      }
      const currentTable = await loadTable(db, businessId, table.id)
      if (!currentTable || currentTable.is_active !== 1) {
        throw domainError(409, 'TABLE_INACTIVE', 'A mesa está inativa. Atualize os dados e tente novamente.')
      }
      for (const productId of productIds) {
        const currentProduct = await loadProduct(db, businessId, productId)
        if (!currentProduct || currentProduct.active !== 1) {
          throw domainError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.')
        }
      }
      if (autoJob?.status === 'pending') {
        const currentAuto = await loadAutomaticJob(db, businessId, order.id)
        if (!currentAuto || currentAuto.status !== 'pending' || Number(currentAuto.copies_requested) !== Number(autoJob.copies_requested)) {
          throw domainError(409, 'TABLE_RESERVATION_CHANGED', 'A reserva foi alterada. Atualize os dados e tente novamente.')
        }
      }
    }
    throw error
  }

  return {
    reservation: await loadTableReservationById(db, businessId, reservationId),
    order: await loadOrderById(db, businessId, order.id),
    hasManualPrintHistory: manualPrintHistory,
  }
}
