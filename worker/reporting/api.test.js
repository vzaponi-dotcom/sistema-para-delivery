import test from 'node:test'
import assert from 'node:assert/strict'
import { handleRequest } from '../index.js'
import { createSettingsDb } from '../test-support/settingsDb.js'

const request = (path, options = {}) => new Request(`https://delivery.test${path}`, {
  ...options, headers: { origin: 'https://delivery.test', ...(options.headers || {}) },
})
const context = (capabilities, businessId = 'business-a') => ({ businessId, granted: new Set(capabilities) })

test('reporting routes remain behind the global authenticated boundary', async () => {
  const response = await handleRequest(new Request('https://delivery.test/api/reporting/overview'), { DB: {} })
  assert.equal(response.status, 401)
  assert.equal((await response.json()).error.code, 'UNAUTHENTICATED')
})

test('reporting API authorizes read and export separately and ignores browser business authority', async () => {
  const { handleReportingApi } = await import('./api.js')
  const calls = []
  const env = { DB: {}, reportingService: {
    overview: async (businessId, query) => { calls.push([businessId, query]); return { data: {}, quality: {}, comparison: { available: false } } },
    exportModel: async (businessId, query) => { calls.push([businessId, query]); return { data: { rows: [], columns: [] }, quality: {} } },
  } }
  const allowed = await handleReportingApi(request('/api/reporting/overview?businessId=business-b'), env, context(['reports.view']), new URL('https://delivery.test/api/reporting/overview?businessId=business-b'))
  assert.equal(allowed.status, 200)
  const readable = await handleReportingApi(request('/api/reporting/overview'), env, context(['reports.view']), new URL('https://delivery.test/api/reporting/overview'))
  assert.equal(readable.status, 200)
  assert.equal(calls[0][0], 'business-a')
  await assert.rejects(handleReportingApi(request('/api/reporting/sales'), env, context([])), { status: 403 })
  await assert.rejects(handleReportingApi(request('/api/reporting/export-model', { method: 'POST', body: '{}' }), env, context(['reports.view'])), { status: 403 })
  const exported = await handleReportingApi(request('/api/reporting/export-model', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ view: 'sales', businessId: 'business-b' }) }), env, context(['reports.export']), new URL('https://delivery.test/api/reporting/export-model'))
  assert.equal(exported.status, 200)
  assert.equal(calls.at(-1)[0], 'business-a')
})

test('products, detail, drawer and export share one business-scoped SQLite recorte', async (t) => {
  const { handleReportingApi } = await import('./api.js')
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  sqlite.exec(`
    INSERT INTO businesses (id,slug,name,created_at,updated_at) VALUES ('a','a','A','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z');
    INSERT INTO orders (id,business_id,order_number,client_name_snapshot,order_date,type,status,subtotal_cents,delivery_fee_cents,adjustment_type,adjustment_mode,adjustment_value,adjustment_amount_cents,total_cents,created_at,finished_at) VALUES ('o1','a',1,'Ana','2026-09-10','Entrega','Finalizado',1000,0,'none','fixed',0,0,1000,'2026-09-10T12:00:00Z','2026-09-10T12:20:00Z');
    INSERT INTO order_items (id,business_id,order_id,name_snapshot,category_snapshot,size_snapshot,quantity,catalog_price_cents,unit_price_cents,created_at) VALUES ('i1','a','o1','X','Lanches','',1,1000,1000,'2026-09-10T12:00:00Z');
  `)
  const env = { DB: db }
  const authenticated = context(['reports.view', 'reports.export'], 'a')
  const query = 'from=2026-09-10&to=2026-09-10'
  const products = await handleReportingApi(request(`/api/reporting/products?${query}`), env, authenticated)
  assert.equal((await products.json()).data.unitsSold, 1)
  const detail = await handleReportingApi(request(`/api/reporting/orders?${query}`), env, authenticated)
  assert.equal((await detail.json()).data.total, 1)
  const drawer = await handleReportingApi(request('/api/reporting/orders/o1'), env, authenticated)
  assert.equal((await drawer.json()).data.items[0].name_snapshot, 'X')
  const exportResponse = await handleReportingApi(request('/api/reporting/export-model', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: { view: 'detail', from: '2026-09-10', to: '2026-09-10' }, columns: ['order_number', 'total_cents'] }) }), env, authenticated)
  const model = (await exportResponse.json()).data
  assert.equal(model.rowCount, 1)
  assert.deepEqual(model.rows, [[1, 1000]])
  await assert.rejects(handleReportingApi(request('/api/reporting/orders/o1'), env, context(['reports.view'], 'other')), { status: 404 })
  sqlite.exec(`
    INSERT INTO orders (id,business_id,order_number,client_name_snapshot,order_date,type,status,subtotal_cents,delivery_fee_cents,adjustment_type,adjustment_mode,adjustment_value,adjustment_amount_cents,total_cents,created_at,finished_at) VALUES
      ('late','a',2,'Bia','2026-09-10','Entrega','Finalizado',500,0,'none','fixed',0,0,500,'2026-09-10T12:00:00Z','2026-09-10T12:45:00Z'),
      ('cancel','a',3,'Cris','2026-09-10','Entrega','Cancelado',900,0,'none','fixed',0,0,900,'2026-09-10T12:00:00Z',NULL);
  `)
  const overview = (await (await handleReportingApi(request(`/api/reporting/overview?${query}`), env, authenticated)).json()).data.metrics
  const operation = (await (await handleReportingApi(request(`/api/reporting/operation?${query}`), env, authenticated)).json()).data
  const cancelled = (await (await handleReportingApi(request(`/api/reporting/orders?${query}&status=Cancelado`), env, authenticated)).json()).data
  const late = (await (await handleReportingApi(request(`/api/reporting/orders?${query}&operationalDeadline=late`), env, authenticated)).json()).data
  assert.equal(cancelled.total, 1)
  assert.equal(overview.cancellationRate, 33.33)
  assert.equal(operation.outsideDeadlineCount, late.total)
  const product = encodeURIComponent('["Lanches","X",""]')
  const productDetail = (await (await handleReportingApi(request(`/api/reporting/orders?${query}&product=${product}`), env, authenticated)).json()).data
  assert.equal(productDetail.total, 1)
  const pending = (await (await handleReportingApi(request(`/api/reporting/orders?${query}&receivable=unpaid`), env, authenticated)).json()).data
  assert.equal(pending.total, overview.receivableCount)
})


test('reporting export ignores null and empty optional query values instead of serializing them as text', async () => {
  const { handleReportingApi } = await import('./api.js')
  const calls = []
  const env = { DB: {}, reportingService: {
    exportModel: async (_businessId, query) => {
      calls.push(query)
      return { data: { rows: [], columns: [] }, quality: {} }
    },
  } }
  const response = await handleReportingApi(request('/api/reporting/export-model', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: {
        view: 'detail',
        period: 'custom',
        from: '2026-09-01',
        to: '2026-09-25',
        orderHourFrom: null,
        orderHourTo: null,
        paymentMethod: null,
        customer: '',
        page: 1,
        pageSize: 25,
        sort: 'date-desc',
      },
    }),
  }), env, context(['reports.export']), new URL('https://delivery.test/api/reporting/export-model'))
  assert.equal(response.status, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].orderHourFrom, null)
  assert.equal(calls[0].orderHourTo, null)
  assert.equal(calls[0].paymentMethod, null)
  assert.equal(calls[0].customer, null)
})
