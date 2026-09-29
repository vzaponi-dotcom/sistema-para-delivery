import assert from 'node:assert/strict'
import test from 'node:test'

const apiPromise = import('./kitchenTvControlApi.js').catch(() => ({}))

test('reads control state and sends page/hide/restore commands through same-origin requests', async (t) => {
  const {
    getKitchenTvControl,
    getKitchenTvOrderPrintDocument,
    setKitchenTvPage,
    setKitchenTvModality,
    hideKitchenTvOrder,
    restoreKitchenTvOrder,
  } = await apiPromise
  assert.equal(typeof getKitchenTvControl, 'function')
  assert.equal(typeof getKitchenTvOrderPrintDocument, 'function')
  assert.equal(typeof setKitchenTvPage, 'function')
  assert.equal(typeof setKitchenTvModality, 'function')
  assert.equal(typeof hideKitchenTvOrder, 'function')
  assert.equal(typeof restoreKitchenTvOrder, 'function')

  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  const calls = []
  globalThis.fetch = async (path, options = {}) => {
    calls.push([path, options])
    return new Response(JSON.stringify(
      path === '/api/kitchen-tv/control'
        ? {
            paired: true,
            control: { revision: 1, requestedPage: 2, updatedAt: '2026-09-28T21:00:00.000Z' },
            telemetry: null,
            hiddenOrderIds: [],
          }
        : { orderId: 'order/1', hidden: options.method === 'PUT' },
    ), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  await getKitchenTvControl()
  await getKitchenTvOrderPrintDocument('order/1')
  await setKitchenTvPage(3)
  await setKitchenTvModality('table')
  await hideKitchenTvOrder('order/1')
  await restoreKitchenTvOrder('order/1')

  assert.deepEqual(calls.map(([path, options]) => [
    path, options.method, options.credentials, options.body,
  ]), [
    ['/api/kitchen-tv/control', undefined, 'same-origin', undefined],
    ['/api/orders/order%2F1/print-document', undefined, 'same-origin', undefined],
    ['/api/kitchen-tv/control/page', 'PATCH', 'same-origin', JSON.stringify({ page: 3 })],
    ['/api/kitchen-tv/control/modality', 'PATCH', 'same-origin', JSON.stringify({ modality: 'table' })],
    ['/api/kitchen-tv/control/orders/order%2F1/hidden', 'PUT', 'same-origin', undefined],
    ['/api/kitchen-tv/control/orders/order%2F1/hidden', 'DELETE', 'same-origin', undefined],
  ])
})
