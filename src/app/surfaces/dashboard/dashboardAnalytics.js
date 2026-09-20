import {
  filterOrdersByPeriod,
  getDashboardDateRange,
  getOrderItemDisplayName,
  getOrderItems,
  isOrderPaid,
} from '../../../domains/orders/index.js'

const safeMoney = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}
const safeQuantity = (value) => Math.max(1, Math.trunc(Number(value) || 1))
const dateLabel = (dateValue) => {
  const [, month, day] = String(dateValue).split('-')
  return `${day}/${month}`
}

export const calculatePeriodMetrics = (orders, period = '30d', now = new Date()) => {
  const selected = filterOrdersByPeriod(orders, period, now)
  const sales = selected.reduce((sum, order) => sum + safeMoney(order?.total), 0)
  const orderCount = selected.length
  return { sales, orderCount, averageTicket: orderCount ? sales / orderCount : 0 }
}

export const buildDailySeries = (orders, period = '30d', now = new Date()) => {
  const dates = getDashboardDateRange(period, now)
  const selected = filterOrdersByPeriod(orders, period, now)
  const grouped = new Map(dates.map((date) => [date, { sales: 0, orders: 0 }]))
  for (const order of selected) {
    const bucket = grouped.get(order.orderDate)
    if (!bucket) continue
    bucket.sales += safeMoney(order.total)
    bucket.orders += 1
  }
  return dates.map((date) => ({
    date,
    label: dateLabel(date),
    sales: grouped.get(date).sales,
    orders: grouped.get(date).orders,
  }))
}

export const getTopProducts = (orders, period = '30d', now = new Date(), limit = 5) => {
  const grouped = new Map()
  for (const order of filterOrdersByPeriod(orders, period, now)) {
    for (const item of getOrderItems(order)) {
      const label = getOrderItemDisplayName(item)
      const key = item.productId ? `id:${item.productId}` : `label:${label.toLocaleLowerCase('pt-BR')}`
      const current = grouped.get(key) ?? { key, label, quantity: 0 }
      current.quantity += safeQuantity(item.quantity)
      grouped.set(key, current)
    }
  }
  return [...grouped.values()]
    .sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label, 'pt-BR'))
    .slice(0, Math.max(0, Math.trunc(Number(limit) || 0)))
}

export const getPaymentMix = (orders, period = '30d', now = new Date()) => {
  const grouped = new Map()
  for (const order of filterOrdersByPeriod(orders, period, now)) {
    if (!isOrderPaid(order)) continue
    const method = order.paymentMethod || 'Não informado'
    const amount = safeMoney(order.paidAmount) || safeMoney(order.total)
    grouped.set(method, (grouped.get(method) ?? 0) + amount)
  }
  return [...grouped.entries()]
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount || a.method.localeCompare(b.method, 'pt-BR'))
}
