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
      const filters = [
        'business_id = ?', 'order_date >= ?', 'order_date <= ?',
      ]
      const values = [businessId, query.from, query.to]
      if (query.type) { filters.push('type = ?'); values.push(query.type) }
      if (query.status) { filters.push('status = ?'); values.push(query.status) }
      const { results: orders } = await db.prepare(`
        SELECT id, order_date, type, status, total_cents, table_tab_id
        FROM orders WHERE ${filters.join(' AND ')}
      `).bind(...values).all()
      const { results: payments } = await db.prepare(`
        SELECT order_id, amount_cents FROM payments
        WHERE business_id = ? AND order_id IN (
          SELECT id FROM orders WHERE ${filters.join(' AND ')}
        )
      `).bind(businessId, ...values).all()
      const { results: receipts } = await db.prepare(`
        SELECT total_cents FROM payment_receipts
        WHERE business_id = ? AND substr(paid_at, 1, 10) >= ? AND substr(paid_at, 1, 10) <= ?
      `).bind(businessId, query.from, query.to).all()
      const { results: refunds } = await db.prepare(`
        SELECT value_cents FROM movements
        WHERE business_id = ? AND source = 'order-refund' AND deleted_at IS NULL
          AND movement_date >= ? AND movement_date <= ?
      `).bind(businessId, query.from, query.to).all()
      return { orders, payments, receipts, refunds }
    },
    async listOperationalOrders(businessId, query) {
      const { results } = await db.prepare(`
        SELECT id, order_date, type, status, scheduled_for, is_backdated, created_at, finished_at, timing_policy_snapshot_json
        FROM orders WHERE business_id = ? AND order_date >= ? AND order_date <= ?
        ${query.type ? 'AND type = ?' : ''}
      `).bind(businessId, query.from, query.to, ...(query.type ? [query.type] : [])).all()
      return results
    },
    async loadSales(businessId, query) {
      const base = 'business_id = ? AND order_date >= ? AND order_date <= ?'
      const { results: orders } = await db.prepare(`SELECT id, status, total_cents, delivery_fee_cents, table_tab_id FROM orders WHERE ${base}`).bind(businessId, query.from, query.to).all()
      const { results: receipts } = await db.prepare('SELECT id, total_cents FROM payment_receipts WHERE business_id = ? AND substr(paid_at, 1, 10) BETWEEN ? AND ?').bind(businessId, query.from, query.to).all()
      const { results: allocations } = await db.prepare(`SELECT receipt_id, method_code, method_label, amount_cents FROM payment_allocations WHERE business_id = ? AND receipt_id IN (SELECT id FROM payment_receipts WHERE business_id = ? AND substr(paid_at, 1, 10) BETWEEN ? AND ?)`).bind(businessId, businessId, query.from, query.to).all()
      const { results: payments } = await db.prepare(`SELECT order_id, amount_cents FROM payments WHERE business_id = ? AND order_id IN (SELECT id FROM orders WHERE ${base})`).bind(businessId, businessId, query.from, query.to).all()
      const { results: refunds } = await db.prepare("SELECT value_cents FROM movements WHERE business_id = ? AND source = 'order-refund' AND deleted_at IS NULL AND movement_date BETWEEN ? AND ?").bind(businessId, query.from, query.to).all()
      return { orders, receipts, allocations, payments, refunds }
    },
    async listDetail(businessId, query) {
      const where = ['business_id = ?', 'order_date >= ?', 'order_date <= ?']
      const values = [businessId, query.from, query.to]
      if (query.status) { where.push('status = ?'); values.push(query.status) }
      if (query.type) { where.push('type = ?'); values.push(query.type) }
      if (query.search) { where.push('(client_name_snapshot LIKE ? OR CAST(order_number AS TEXT) LIKE ?)'); values.push(`%${query.search}%`, `%${query.search}%`) }
      const sql = where.join(' AND ')
      const total = await db.prepare(`SELECT count(*) AS total FROM orders WHERE ${sql}`).bind(...values).first('total')
      const { results: items } = await db.prepare(`SELECT id, order_number, order_date, client_name_snapshot, type, status, total_cents FROM orders WHERE ${sql} ORDER BY order_date DESC, order_number DESC, id DESC LIMIT ? OFFSET ?`).bind(...values, query.pageSize, (query.page - 1) * query.pageSize).all()
      return { total: Number(total || 0), items }
    },
  })
}
