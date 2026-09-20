import test from 'node:test'
import assert from 'node:assert/strict'

test('C10 exposes only Orders contracts consumed outside the Orders domain', async () => {
  const orders = await import('./domains/orders/index.js')

  assert.deepEqual(Object.keys(orders).sort(), [
    'NewOrderRoute',
    'OrderDetail',
    'OrderHistory',
    'Orders',
    'cancellationOptionsFromEffective',
    'cancellationReasonsPolicy',
    'cancellationRevisionFromEffective',
    'canReceiveStandaloneOrder',
    'filterOrdersByPeriod',
    'formatCancellationDate',
    'formatOrderDate',
    'getDashboardDateRange',
    'getOrderItemDisplayName',
    'getOrderItems',
    'getOrderItemsSearchText',
    'getOrderItemsSummary',
    'getOrderRefundState',
    'getPendingAmount',
    'isOrderCancelled',
    'isOrderPaid',
    'operationsPolicy',
    'ordersApi',
    'toLocalDateValue',
    'useKitchenClock',
    'useNewOrderDraft',
    'useOrderArrivals',
    'useOrderCommands',
    'useOrderPaymentPromise',
  ].sort())
})

test('C10 exposes only Customers contracts consumed outside the Customers domain', async () => {
  const customers = await import('./domains/customers/index.js')

  assert.deepEqual(Object.keys(customers).sort(), [
    'ClientDuplicateModal',
    'CustomersWorkspace',
    'findClientDuplicates',
    'useQuickCreateCustomerCommand',
  ].sort())
})
