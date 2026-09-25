import { getOperationalDurationMinutes, getOrderLateAt } from '../../shared/orderTiming.js'

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
  async operation(businessId, query) {
    const orders = await repository.listOperationalOrders(businessId, query)
    const eligible = orders.filter((order) => order.status !== 'Cancelado' && !order.is_backdated)
    const measured = []
    let legacyPolicyCount = 0
    for (const row of eligible) {
      const order = {
        ...row, createdAt: row.created_at, finishedAt: row.finished_at,
        scheduledFor: row.scheduled_for, timingPolicySnapshot: row.timing_policy_snapshot_json,
      }
      const duration = getOperationalDurationMinutes(order)
      if (duration == null) continue
      if (order.timingPolicySnapshot == null) legacyPolicyCount += 1
      const lateAt = getOrderLateAt(order)
      measured.push({ duration, onTime: Boolean(lateAt && new Date(order.finishedAt) <= lateAt), type: order.type })
    }
    const durations = measured.map(({ duration }) => duration).sort((a, b) => a - b)
    const median = durations.length ? (durations.length % 2 ? durations[(durations.length - 1) / 2] : (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2) : null
    const p90 = durations.length ? durations[Math.ceil(durations.length * 0.9) - 1] : null
    const average = durations.length ? Number((sum(measured, 'duration') / durations.length).toFixed(2)) : null
    return {
      data: {
        averageDurationMinutes: average, medianDurationMinutes: median, p90DurationMinutes: p90,
        withinDeadlineRate: measured.length ? Number(((measured.filter(({ onTime }) => onTime).length / measured.length) * 100).toFixed(2)) : null,
      },
      quality: { eligibleCount: eligible.length, measuredCount: measured.length, legacyPolicyCount, invalidCount: eligible.length - measured.length },
    }
  },
  async sales(businessId, query) {
    const source = await repository.loadSales(businessId, query)
    const commercial = source.orders.filter((order) => order.status !== 'Cancelado')
    const mix = new Map()
    for (const allocation of source.allocations) {
      const method = allocation.method_label || allocation.method_code || 'Não informado'
      mix.set(method, (mix.get(method) || 0) + Number(allocation.amount_cents || 0))
    }
    return {
      data: {
        salesCents: sum(commercial, 'total_cents'),
        receivedCents: sum(source.receipts, 'total_cents'),
        merchandiseRevenueCents: commercial.reduce((total, order) => total + Number(order.total_cents || 0) - Number(order.delivery_fee_cents || 0), 0),
        deliveryFeesCents: sum(commercial, 'delivery_fee_cents'),
        paymentMix: [...mix].map(([method, amountCents]) => ({ method, amountCents })).sort((left, right) => left.method.localeCompare(right.method)),
        refundsCents: sum(source.refunds, 'value_cents'),
      },
      quality: { receiptCount: source.receipts.length },
    }
  },
  async empty(_businessId, _query) {
    return { data: {}, quality: {} }
  },
})
