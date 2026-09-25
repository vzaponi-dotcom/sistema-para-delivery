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
  })
}
