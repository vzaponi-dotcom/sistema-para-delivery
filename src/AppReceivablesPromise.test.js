import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('payment promise is owned by Orders and composed into the Receivables app surface', async () => {
  const [app, ordersApi, hook, surface, worker] = await Promise.all([
    read('./App.jsx'),
    read('./domains/orders/infrastructure/ordersApi.js'),
    read('./domains/orders/application/useOrderPaymentPromise.js'),
    read('./app/surfaces/finance/ReceivablesSurface.jsx'),
    read('../worker/index.js'),
  ])

  assert.match(ordersApi, /updatePaymentPromise/)
  assert.match(ordersApi, /\/payment-promise/)
  assert.match(worker, /payment-promise/)
  assert.match(worker, /updateOrderPaymentPromise\(/)
  assert.match(hook, /await api\.updatePaymentPromise\(orderId, promisedPaymentDate\)/)
  assert.match(hook, /applyOfficialEffects\(\{ order \}\)/)
  assert.match(surface, /useOrderPaymentPromise/)
  assert.match(surface, /onUpdatePaymentPromise=\{paymentPromise\.updatePaymentPromise\}/)
  assert.match(app, /activeTab === 'receivables'[\s\S]*<ReceivablesSurface/)
  assert.match(app, /disabled=\{writesBlocked\}/)
  assert.doesNotMatch(app, /updateOrderPaymentPromise as updateOrderPaymentPromiseApi/)
  assert.doesNotMatch(app, /handleUpdatePaymentPromise/)
})
