const previousPeriod = ({ from, to }) => {
  const start = Date.parse(`${from}T00:00:00.000Z`)
  const end = Date.parse(`${to}T00:00:00.000Z`)
  const days = Math.round((end - start) / 86_400_000) + 1
  return {
    from: new Date(start - days * 86_400_000).toISOString().slice(0, 10),
    to: new Date(start - 86_400_000).toISOString().slice(0, 10),
  }
}

const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key] || 0), 0)

const metricsFor = ({ orders = [], payments = [], receipts = [], refunds = [] }) => {
  const commercial = orders.filter((order) => order.status !== 'Cancelado')
  const salesCents = sum(commercial, 'total_cents')
  const paidByOrder = new Map()
  for (const payment of payments) paidByOrder.set(payment.order_id, (paidByOrder.get(payment.order_id) || 0) + Number(payment.amount_cents || 0))
  const pending = commercial.filter((order) => !order.table_tab_id).map((order) => Math.max(0, Number(order.total_cents || 0) - (paidByOrder.get(order.id) || 0))).filter(Boolean)
  const ordersCount = commercial.length
  return {
    salesCents,
    ordersCount,
    averageTicketCents: ordersCount ? Math.round(salesCents / ordersCount) : null,
    receivedCents: sum(receipts, 'total_cents'),
    receivableCents: pending.reduce((total, amount) => total + amount, 0),
    receivableCount: pending.length,
    cancellationRate: orders.length ? Number(((orders.filter((order) => order.status === 'Cancelado').length / orders.length) * 100).toFixed(2)) : null,
    refundsCents: sum(refunds, 'value_cents'),
  }
}

export const createReportingService = (repository) => Object.freeze({
  async overview(businessId, query) {
    const current = await repository.loadOverview(businessId, query)
    const previous = await repository.loadOverview(businessId, { ...query, ...previousPeriod(query) })
    const data = { metrics: metricsFor(current) }
    const previousMetrics = metricsFor(previous)
    const hasComparisonPopulation = previousMetrics.ordersCount > 0
    return {
      data,
      comparison: hasComparisonPopulation ? { available: true, metrics: previousMetrics } : { available: false },
      quality: { commercialOrders: data.metrics.ordersCount, receiptCount: current.receipts.length },
    }
  },
  async empty(_businessId, _query) {
    return { data: {}, quality: {} }
  },
})
