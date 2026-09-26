import { getBusinessDate } from '../../shared/finance.js'

const empty = () => ({ amountCents: 0, count: 0 })

export function calculateReceivables(orders, payments, today = getBusinessDate(new Date())) {
  const paid = new Set(payments.map((payment) => payment.order_id))
  const buckets = { overdue: empty(), today: empty(), upcoming: empty() }
  let amountCents = 0
  let count = 0
  for (const order of orders) {
    // Match the Finance receivables list: paid is the existence of a payment,
    // and an open table tab is not a standalone receivable.
    if (order.status === 'Cancelado' || paid.has(order.id)
      || (order.customer_identity_type === 'table' && order.table_tab_id)) continue
    const amount = Number(order.total_cents || 0)
    if (amount <= 0) continue
    const expectedDate = order.promised_payment_date || order.order_date || today
    const timing = expectedDate < today ? 'overdue' : expectedDate > today ? 'upcoming' : 'today'
    buckets[timing].amountCents += amount
    buckets[timing].count += 1
    amountCents += amount
    count += 1
  }
  return { amountCents, count, ...buckets }
}

export function groupCentsByDate(rows, dateOf, amountOf) {
  const byDate = new Map()
  for (const row of rows) {
    const date = dateOf(row)
    if (!date) continue
    byDate.set(date, (byDate.get(date) || 0) + Number(amountOf(row) || 0))
  }
  return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, cents]) => ({ date, cents }))
}
