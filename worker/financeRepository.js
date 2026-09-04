import { centsToMoney } from './validation.js'

const repositoryError = (status, code, message) => Object.assign(new Error(message), { status, code })

export const mapMovementRow = (row) => ({
  id: row.id,
  type: row.type,
  category: row.category,
  description: row.description,
  value: centsToMoney(row.value_cents),
  source: row.source || 'manual',
  orderId: row.order_id ?? null,
  paymentId: row.payment_id ?? null,
  paymentMethod: row.payment_method ?? null,
  movementDate: row.movement_date,
  date: row.movement_date,
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? row.created_at,
})

export const mapFinanceSettingsRow = (row) => row ? ({
  openingBalance: centsToMoney(row.opening_balance_cents),
  openingDate: row.opening_date,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
}) : null

export const loadFinanceSettings = async (db, businessId) => {
  const row = await db.prepare(`SELECT business_id, opening_balance_cents, opening_date, created_at, updated_at
    FROM finance_settings WHERE business_id = ? LIMIT 1`).bind(businessId).first()
  return mapFinanceSettingsRow(row)
}

const loadActiveMovementRow = (db, businessId, id) => db.prepare(`SELECT id, business_id, type, category, description, value_cents, source, order_id, payment_id,
  payment_method, movement_date, created_at, updated_at
  FROM movements
  WHERE id = ? AND business_id = ? AND deleted_at IS NULL
  LIMIT 1`).bind(id, businessId).first()

const assertManualMovement = (row) => {
  if (row?.source !== 'manual') {
    throw repositoryError(409, 'MOVEMENT_MANAGED_BY_SYSTEM', 'Movimentos gerados por pedidos não podem ser alterados pelo Financeiro.')
  }
}

export const createManualMovement = async (db, businessId, input, now = new Date()) => {
  const id = crypto.randomUUID()
  const timestamp = now.toISOString()
  await db.prepare(`INSERT INTO movements (
    id, business_id, type, category, description, value_cents,
    source, order_id, payment_id, payment_method, movement_date, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id,
    businessId,
    input.type,
    input.category,
    input.description,
    input.valueCents,
    'manual',
    null,
    null,
    input.paymentMethod,
    input.movementDate,
    timestamp,
    timestamp,
  ).run()
  return mapMovementRow({
    id,
    type: input.type,
    category: input.category,
    description: input.description,
    value_cents: input.valueCents,
    source: 'manual',
    order_id: null,
    payment_id: null,
    payment_method: input.paymentMethod,
    movement_date: input.movementDate,
    created_at: timestamp,
    updated_at: timestamp,
  })
}

export const updateManualMovement = async (db, businessId, id, input, now = new Date()) => {
  const current = await loadActiveMovementRow(db, businessId, id)
  if (!current) return null
  assertManualMovement(current)
  const updatedAt = now.toISOString()
  await db.prepare(`UPDATE movements SET type = ?, category = ?, description = ?, value_cents = ?, payment_method = ?, movement_date = ?, updated_at = ?
    WHERE id = ? AND business_id = ? AND deleted_at IS NULL`).bind(
    input.type,
    input.category,
    input.description,
    input.valueCents,
    input.paymentMethod,
    input.movementDate,
    updatedAt,
    id,
    businessId,
  ).run()
  return mapMovementRow({
    ...current,
    type: input.type,
    category: input.category,
    description: input.description,
    value_cents: input.valueCents,
    payment_method: input.paymentMethod,
    movement_date: input.movementDate,
    updated_at: updatedAt,
  })
}

export const softDeleteManualMovement = async (db, businessId, id, now = new Date()) => {
  const current = await loadActiveMovementRow(db, businessId, id)
  if (!current) return null
  assertManualMovement(current)
  const timestamp = now.toISOString()
  await db.prepare(`UPDATE movements SET deleted_at = ?, updated_at = ?
    WHERE id = ? AND business_id = ? AND deleted_at IS NULL`).bind(timestamp, timestamp, id, businessId).run()
  return id
}

export const upsertFinanceSettings = async (db, businessId, input, now = new Date()) => {
  const timestamp = now.toISOString()
  await db.prepare(`INSERT INTO finance_settings (business_id, opening_balance_cents, opening_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(business_id) DO UPDATE SET
      opening_balance_cents = excluded.opening_balance_cents,
      opening_date = excluded.opening_date,
      updated_at = excluded.updated_at`).bind(
    businessId,
    input.openingBalanceCents,
    input.openingDate,
    timestamp,
    timestamp,
  ).run()
  return loadFinanceSettings(db, businessId)
}
