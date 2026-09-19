import { isOrderPaid } from '../../../../domains/orders/index.js'

const PAYMENT_COLLECTIONS = ['orders', 'movements', 'tableTabs', 'tables']

export function settleTableTabPayment(owner, receipt) {
  if (!owner?.result || !receipt?.data) return { settled: false }
  if (!PAYMENT_COLLECTIONS.every((key) => receipt.applied?.includes(key))) return { settled: false }

  const receiptOrders = Array.isArray(receipt.data.orders) ? receipt.data.orders : []
  const receiptMovements = Array.isArray(receipt.data.movements) ? receipt.data.movements : []
  const receiptTabs = Array.isArray(receipt.data.tableTabs) ? receipt.data.tableTabs : []
  const nextTables = Array.isArray(receipt.data.tables) ? receipt.data.tables : []

  if (!receiptTabs.some((tab) => tab.id === owner.tabId && tab.status === 'closed')) return { settled: false }
  if (!(owner.result.orders || []).every((order) => receiptOrders.some((item) => item.id === order.id && isOrderPaid(item)))) {
    return { settled: false }
  }
  if (!(owner.result.movements || []).every((movement) => receiptMovements.some((item) => item.id === movement.id))) {
    return { settled: false }
  }

  const table = nextTables.find((item) => item.id === owner.tableId)
  const replaced = Boolean(table?.openTableTab?.id && table.openTableTab.id !== owner.tabId)
  if ((!replaced && table?.occupancy !== 'free') || nextTables.some((item) => item.openTableTab?.id === owner.tabId)) {
    return { settled: false }
  }

  return { settled: true, nextTables, replaced }
}
