import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('payment promise is exposed through the API and App applies only the official returned order', async () => {
  const [app, api, worker] = await Promise.all([read('./App.jsx'), read('./api/client.js'), read('../worker/index.js')])
  assert.match(api, /export const updateOrderPaymentPromise = \(id, promisedPaymentDate\)/)
  assert.match(api, /\/payment-promise/)
  assert.match(worker, /payment-promise/)
  assert.match(worker, /updateOrderPaymentPromise\(/)
  assert.match(app, /updateOrderPaymentPromise as updateOrderPaymentPromiseApi/)
  assert.match(app, /await updateOrderPaymentPromiseApi\(orderId, promisedPaymentDate\)/)
  assert.match(app, /applyOfficialEffects\(\{ order \}\)/)
  assert.match(app, /onUpdatePaymentPromise=\{handleUpdatePaymentPromise\}/)
  assert.match(app, /activeTab === 'receivables'[\s\S]*disabled=\{writesBlocked\}/)
})
