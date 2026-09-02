import { centsToMoney } from './validation.js'

const rows = (result) => Array.isArray(result?.results) ? result.results : []

export const mapClientRow = (row) => ({
  id: row.id,
  name: row.name,
  phone: row.phone || '',
  address: row.address || '',
})

export const mapProductRow = (row) => ({
  id: row.id,
  category: row.category,
  size: row.size || '',
  name: row.name,
  price: centsToMoney(row.price_cents),
})

export const mapOrderItemRow = (row) => ({
  id: row.id,
  productId: row.product_id ?? null,
  name: row.name_snapshot,
  category: row.category_snapshot || '',
  size: row.size_snapshot || '',
  quantity: Number(row.quantity) || 1,
  catalogPrice: centsToMoney(row.catalog_price_cents),
  unitPrice: centsToMoney(row.unit_price_cents),
  priceReason: row.price_reason || '',
})

export const mapOrderRow = (row, items = []) => {
  const firstItem = items[0] ?? null
  const paid = Boolean(row.payment_id)
  return {
    id: row.id,
    clientId: row.client_id ?? null,
    client: row.client_name_snapshot,
    type: row.type,
    status: row.status,
    productName: firstItem?.name ?? '',
    size: firstItem?.size ?? '',
    quantity: firstItem?.quantity ?? 1,
    subtotal: centsToMoney(row.subtotal_cents ?? row.total_cents),
    adjustment: {
      type: row.adjustment_type || 'none',
      mode: row.adjustment_mode || 'fixed',
      value: Number(row.adjustment_value) || 0,
      amount: centsToMoney(row.adjustment_amount_cents),
      reason: row.adjustment_reason || '',
    },
    total: centsToMoney(row.total_cents),
    orderDate: row.order_date,
    date: row.order_date,
    createdAt: row.created_at,
    finishedAt: row.finished_at ?? null,
    paymentStatus: paid ? 'Pago' : 'Pendente',
    paymentMethod: paid ? row.payment_method : null,
    paidAt: paid ? row.paid_at : null,
    paidAmount: paid ? centsToMoney(row.paid_amount_cents) : 0,
    items,
  }
}

export const mapMovementRow = (row) => ({
  id: row.id,
  type: row.type,
  category: row.category,
  description: row.description,
  value: centsToMoney(row.value_cents),
  source: row.source || 'manual',
  orderId: row.order_id ?? null,
  paymentId: row.payment_id ?? null,
  movementDate: row.movement_date,
  date: row.movement_date,
  createdAt: row.created_at,
})

export const loadBootstrap = async (db, businessId) => {
  const business = await db.prepare(
    'SELECT id, name FROM businesses WHERE id = ? LIMIT 1',
  ).bind(businessId).first()

  const clientsResult = await db.prepare(
    `SELECT id, name, phone, address
     FROM clients
     WHERE business_id = ?
     ORDER BY name COLLATE NOCASE ASC`,
  ).bind(businessId).all()

  const productsResult = await db.prepare(
    `SELECT id, category, size, name, price_cents
     FROM products
     WHERE business_id = ? AND active = 1
     ORDER BY name COLLATE NOCASE ASC`,
  ).bind(businessId).all()

  const ordersResult = await db.prepare(
    `SELECT o.id, o.client_id, o.client_name_snapshot, o.type, o.order_date, o.status,
            o.subtotal_cents, o.adjustment_type, o.adjustment_mode, o.adjustment_value,
            o.adjustment_amount_cents, o.adjustment_reason, o.total_cents,
            o.created_at, o.finished_at,
            p.id AS payment_id, p.method AS payment_method, p.paid_at,
            p.amount_cents AS paid_amount_cents
     FROM orders o
     LEFT JOIN payments p ON p.order_id = o.id AND p.business_id = o.business_id
     WHERE o.business_id = ?
     ORDER BY o.created_at DESC`,
  ).bind(businessId).all()

  const itemsResult = await db.prepare(
    `SELECT id, order_id, product_id, name_snapshot, category_snapshot, size_snapshot,
            quantity, catalog_price_cents, unit_price_cents, price_reason, created_at
     FROM order_items
     WHERE business_id = ?
     ORDER BY created_at ASC`,
  ).bind(businessId).all()

  const movementsResult = await db.prepare(
    `SELECT id, type, category, description, value_cents, source, order_id, payment_id,
            movement_date, created_at
     FROM movements
     WHERE business_id = ?
     ORDER BY created_at DESC`,
  ).bind(businessId).all()

  const itemsByOrder = new Map()
  for (const itemRow of rows(itemsResult)) {
    const mapped = mapOrderItemRow(itemRow)
    const current = itemsByOrder.get(itemRow.order_id) ?? []
    current.push(mapped)
    itemsByOrder.set(itemRow.order_id, current)
  }

  return {
    business: business ? { id: business.id, name: business.name } : { id: businessId, name: 'Amor & Sabor' },
    clients: rows(clientsResult).map(mapClientRow),
    products: rows(productsResult).map(mapProductRow),
    orders: rows(ordersResult).map((orderRow) => mapOrderRow(orderRow, itemsByOrder.get(orderRow.id) ?? [])),
    movements: rows(movementsResult).map(mapMovementRow),
  }
}
