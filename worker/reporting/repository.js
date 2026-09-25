import { businessDateRangeUtc } from './businessDate.js'
import { buildOrderFilters } from './orderFilters.js'
import { getBusinessDate } from '../../shared/finance.js'
import { getOperationalDurationMinutes, getOrderLateAt } from '../../shared/orderTiming.js'

const hourInBusiness = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' })
const terminal = new Set(['Finalizado', 'Entregue', 'Despachado'])
const enrichDetail = (row) => {
  const order = {
    status: row.status, createdAt: row.created_at, finishedAt: row.finished_at,
    scheduledFor: row.scheduled_for, timingPolicySnapshot: row.timing_policy_snapshot_json,
  }
  const durationMinutes = terminal.has(row.status) && !row.is_backdated ? getOperationalDurationMinutes(order) : null
  const lateAt = durationMinutes === null ? null : getOrderLateAt(order)
  const onTime = lateAt ? new Date(row.finished_at) <= lateAt : null
  const paidCents = Number(row.paid_cents || 0)
  const pendingCents = row.status !== 'Cancelado' && row.paid_cents == null
    && !(row.customer_identity_type === 'table' && row.table_tab_id)
    ? Math.max(0, row.total_cents) : 0
  const created = new Date(row.created_at)
  return { ...row, durationMinutes, onTime, paidCents, pendingCents, businessDate: Number.isNaN(created.getTime()) ? null : getBusinessDate(created) }
}

const compareDetail = (sort) => (left, right) => {
  const direction = sort?.endsWith('-asc') ? 1 : -1
  const field = sort?.startsWith('total') ? 'total_cents' : sort?.startsWith('duration') ? 'durationMinutes' : 'order_date'
  const a = left[field] ?? -Infinity
  const b = right[field] ?? -Infinity
  const result = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
  return direction * result || (right.order_number || 0) - (left.order_number || 0) || String(right.id).localeCompare(String(left.id))
}

export function createReportingRepository(db) {
  return Object.freeze({
    async listOrders(businessId, { from, to }) {
      const { results } = await db.prepare(`
        SELECT id, order_number, order_date, type, status, total_cents
        FROM orders
        WHERE business_id = ? AND order_date >= ? AND order_date <= ?
        ORDER BY order_date ASC, order_number ASC, id ASC
      `).bind(businessId, from, to).all()
      return results
    },
    async loadOverview(businessId, query) {
      const [paidFrom, paidTo] = businessDateRangeUtc(query.from, query.to)
      const { sql, values } = buildOrderFilters(businessId, query)
      const { results: orders } = await db.prepare(`
        SELECT o.id, o.order_date, o.type, o.status, o.total_cents, o.table_tab_id,
          o.customer_identity_type, o.promised_payment_date, o.adjustment_type, o.adjustment_amount_cents
        FROM orders o WHERE ${sql}
      `).bind(...values).all()
      const { results: payments } = await db.prepare(`
        SELECT order_id, amount_cents FROM payments
        WHERE business_id = ? AND order_id IN (
          SELECT o.id FROM orders o WHERE ${sql}
        )
      `).bind(businessId, ...values).all()
      const { results: receipts } = await db.prepare(`
        SELECT total_cents FROM payment_receipts
        WHERE business_id = ? AND paid_at >= ? AND paid_at < ? ORDER BY paid_at, id
      `).bind(businessId, paidFrom, paidTo).all()
      const { results: refunds } = await db.prepare(`
        SELECT value_cents FROM movements
        WHERE business_id = ? AND source = 'order-refund' AND deleted_at IS NULL
          AND movement_date >= ? AND movement_date <= ?
      `).bind(businessId, query.from, query.to).all()
      return { orders, payments, receipts, refunds }
    },
    async listOperationalOrders(businessId, query) {
      const { sql, values } = buildOrderFilters(businessId, { ...query, paymentMethod: null, search: null })
      const { results } = await db.prepare(`
        SELECT o.id, o.order_date, o.type, o.status, o.scheduled_for, o.is_backdated,
          o.created_at, o.finished_at, o.timing_policy_snapshot_json
        FROM orders o WHERE ${sql}
      `).bind(...values).all()
      return results
    },
    async loadSales(businessId, query) {
      const [paidFrom, paidTo] = businessDateRangeUtc(query.from, query.to)
      const { sql, values } = buildOrderFilters(businessId, query)
      const { results: orders } = await db.prepare(`SELECT o.id, o.order_date, o.status, o.total_cents, o.delivery_fee_cents,
        o.table_tab_id, o.customer_identity_type, o.promised_payment_date, o.adjustment_type, o.adjustment_amount_cents
        FROM orders o WHERE ${sql}`).bind(...values).all()
      const methodWhere = query.paymentMethod ? 'AND (pa.method_code = ? OR pa.method_label = ? COLLATE NOCASE)' : ''
      const methodValues = query.paymentMethod ? [query.paymentMethod, query.paymentMethod] : []
      const { results: receipts } = query.paymentMethod
        ? await db.prepare(`SELECT r.id, r.paid_at,
          (SELECT SUM(pa.amount_cents) FROM payment_allocations pa
            WHERE pa.business_id = r.business_id AND pa.receipt_id = r.id ${methodWhere}) AS total_cents
          FROM payment_receipts r WHERE r.business_id = ? AND r.paid_at >= ? AND r.paid_at < ?
          AND EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.business_id = r.business_id
            AND pa.receipt_id = r.id ${methodWhere})`)
          .bind(...methodValues, businessId, paidFrom, paidTo, ...methodValues).all()
        : await db.prepare('SELECT id, total_cents, paid_at FROM payment_receipts WHERE business_id = ? AND paid_at >= ? AND paid_at < ?').bind(businessId, paidFrom, paidTo).all()
      const { results: allocations } = await db.prepare(`SELECT pa.receipt_id, pa.method_code, pa.method_label, pa.amount_cents
        FROM payment_allocations pa JOIN payment_receipts r ON r.business_id = pa.business_id AND r.id = pa.receipt_id
        WHERE pa.business_id = ? AND r.paid_at >= ? AND r.paid_at < ? ${methodWhere}`)
        .bind(businessId, paidFrom, paidTo, ...methodValues).all()
      const { results: payments } = await db.prepare(`SELECT order_id, amount_cents FROM payments WHERE business_id = ? AND order_id IN (SELECT o.id FROM orders o WHERE ${sql})`).bind(businessId, ...values).all()
      const { results: refunds } = await db.prepare("SELECT value_cents FROM movements WHERE business_id = ? AND source = 'order-refund' AND deleted_at IS NULL AND movement_date BETWEEN ? AND ?").bind(businessId, query.from, query.to).all()
      return { orders, receipts, allocations, payments, refunds }
    },
    async loadProductLines(businessId, query) {
      const { sql, values } = buildOrderFilters(businessId, { ...query, paymentMethod: null, search: null })
      const { results } = await db.prepare(`
        SELECT o.id AS order_id, o.order_date, o.status, o.total_cents, o.delivery_fee_cents,
          oi.id AS item_id, oi.product_id, oi.name_snapshot, oi.category_snapshot,
          oi.size_snapshot, oi.quantity, oi.unit_price_cents
        FROM orders o JOIN order_items oi ON oi.business_id = o.business_id AND oi.order_id = o.id
        WHERE ${sql} AND o.status <> 'Cancelado'
        ORDER BY o.order_date, o.id, oi.id
      `).bind(...values).all()
      return results
    },
    async listDetail(businessId, query) {
      const { sql, values } = buildOrderFilters(businessId, query)
      const select = `SELECT o.id, o.order_number, o.order_date, o.client_id,
        o.client_name_snapshot, o.client_phone_snapshot, o.type, o.status, o.total_cents,
        o.delivery_fee_cents, o.customer_identity_type, o.table_tab_id, o.promised_payment_date,
        o.scheduled_for, o.is_backdated, o.created_at, o.finished_at, o.timing_policy_snapshot_json,
        p.amount_cents AS paid_cents
        FROM orders o LEFT JOIN payments p ON p.business_id = o.business_id AND p.order_id = o.id
        WHERE ${sql}`
      const size = query.pageSize || 25
      const page = query.page || 1
      const complex = query.operationalDeadline || query.orderHourFrom != null || query.orderHourTo != null || query.sort?.startsWith('duration')
      if (!complex) {
        const total = Number(await db.prepare(`SELECT count(*) AS total FROM orders o WHERE ${sql}`).bind(...values).first('total') || 0)
        const orderBy = query.sort?.startsWith('total')
          ? `o.total_cents ${query.sort === 'total-asc' ? 'ASC' : 'DESC'}, o.order_date DESC, o.order_number DESC, o.id DESC`
          : `o.order_date ${query.sort === 'date-asc' ? 'ASC' : 'DESC'}, o.order_number DESC, o.id DESC`
        const { results } = await db.prepare(`${select} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
          .bind(...values, size, (page - 1) * size).all()
        return { total, items: results.map(enrichDetail) }
      }
      const { results } = await db.prepare(select).bind(...values).all()
      const filtered = results.map(enrichDetail).filter((row) => {
        if (query.operationalDeadline && (row.onTime === null || row.onTime !== (query.operationalDeadline === 'on-time'))) return false
        if (query.orderHourFrom == null && query.orderHourTo == null) return true
        if (!row.businessDate) return false
        const hour = Number(hourInBusiness.format(new Date(row.created_at)))
        return (query.orderHourFrom == null || hour >= query.orderHourFrom)
          && (query.orderHourTo == null || hour <= query.orderHourTo)
      }).sort(compareDetail(query.sort))
      return { total: filtered.length, items: filtered.slice((page - 1) * size, page * size) }
    },
    async getOrderDetail(businessId, id) {
      const row = await db.prepare(`SELECT o.id, o.order_number, o.order_date, o.client_name_snapshot,
        o.client_phone_snapshot, o.client_address_snapshot, o.type, o.status, o.total_cents,
        o.delivery_fee_cents, o.customer_identity_type, o.table_tab_id, o.promised_payment_date,
        o.scheduled_for, o.is_backdated, o.created_at, o.finished_at, o.timing_policy_snapshot_json,
        p.amount_cents AS paid_cents, p.receipt_id
        FROM orders o LEFT JOIN payments p ON p.business_id = o.business_id AND p.order_id = o.id
        WHERE o.business_id = ? AND o.id = ?`).bind(businessId, id).first()
      if (!row) return null
      const { results: items } = await db.prepare(`SELECT id, product_id, name_snapshot, category_snapshot,
        size_snapshot, quantity, unit_price_cents FROM order_items WHERE business_id = ? AND order_id = ? ORDER BY created_at, id`).bind(businessId, id).all()
      const { results: allocations } = row.receipt_id ? await db.prepare(`SELECT method_code, method_label, amount_cents
        FROM payment_allocations WHERE business_id = ? AND receipt_id = ? ORDER BY id`).bind(businessId, row.receipt_id).all() : { results: [] }
      return { ...enrichDetail(row), items, paymentAllocations: allocations }
    },
  })
}
