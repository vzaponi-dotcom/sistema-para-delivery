import { centsToMoney } from './validation.js'

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
