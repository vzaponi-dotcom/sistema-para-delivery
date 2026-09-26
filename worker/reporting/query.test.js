import test from 'node:test'
import assert from 'node:assert/strict'

const load = () => import('./query.js')

test('reporting query normalizes valid filters and rejects invalid ranges and pagination', async () => {
  const { parseReportingQuery } = await load()
  const now = new Date('2026-09-25T15:00:00.000Z')
  const query = parseReportingQuery(new URLSearchParams({
    view: 'detail', period: 'custom', from: '2026-09-01', to: '2026-09-25', type: 'Entrega', schedule: 'scheduled',
    orderHourFrom: '8', orderHourTo: '22', page: '2', pageSize: '50', search: '  Maria  ',
  }), { now })

  assert.deepEqual(query, {
    view: 'detail', period: 'custom', from: '2026-09-01', to: '2026-09-25', type: 'Entrega', schedule: 'scheduled',
    status: null, paymentMethod: null, category: null, product: null, productName: null, customer: null,
    orderHourFrom: 8, orderHourTo: 22, operationalDeadline: null, receivable: null, search: 'Maria', sort: null,
    page: 2, pageSize: 50,
  })

  for (const params of [
    { from: 'not-a-date' }, { from: '2026-09-25', to: '2026-09-01' },
    { from: '2025-01-01', to: '2026-09-25' }, { type: 'Outro' }, { schedule: 'later' },
    { orderHourFrom: '24' }, { page: '0' }, { pageSize: '40' },
    { period: 'current-month', from: '2026-09-02', to: '2026-09-25' },
  ]) assert.throws(() => parseReportingQuery(new URLSearchParams(params), { now }), { status: 400 })
})

test('reporting query defaults to the current Sao Paulo month and rejects unknown parameters', async () => {
  const { parseReportingQuery } = await load()
  const defaults = parseReportingQuery(new URLSearchParams(), { now: new Date('2026-09-25T15:00:00.000Z') })
  assert.equal(defaults.view, 'overview')
  assert.equal(defaults.period, 'current-month')
  assert.equal(defaults.from, '2026-09-01')
  assert.equal(defaults.to, '2026-09-25')
  assert.equal(defaults.page, 1)
  assert.equal(defaults.pageSize, 25)
  assert.throws(() => parseReportingQuery(new URLSearchParams({ madeUp: 'other' })), { status: 400, code: 'REPORTING_UNKNOWN_QUERY' })
})

test('reporting query rejects impossible calendar dates and unsupported filter combinations', async () => {
  const { parseReportingQuery } = await load()
  for (const from of ['2026-02-31', '2026-04-31', '2025-02-29', '0000-01-01']) {
    assert.throws(() => parseReportingQuery(new URLSearchParams({ from })), { status: 400 })
  }
  assert.equal(parseReportingQuery(new URLSearchParams({ from: '2024-02-29', to: '2024-02-29' })).from, '2024-02-29')
  for (const params of [
    { view: 'overview', search: 'Ana' },
    { view: 'sales', operationalDeadline: 'late' },
    { view: 'operation', paymentMethod: 'pix' },
    { view: 'products', status: 'Cancelado' },
    { view: 'overview', page: '2' },
    { view: 'detail', sort: 'total_cents; DROP TABLE orders' },
  ]) assert.throws(() => parseReportingQuery(new URLSearchParams(params)), { status: 400 })
})

test('reporting query accepts a named product filter separately from canonical identity', async () => {
  const { parseReportingQuery } = await load()
  const query = parseReportingQuery(new URLSearchParams({
    view: 'products', from: '2026-09-01', to: '2026-09-25', productName: '  X-Bacon  ',
  }), { now: new Date('2026-09-25T15:00:00Z') })
  assert.equal(query.productName, 'X-Bacon')
  assert.equal(query.product, null)
})
