import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeReportingQuery,
  patchReportingQuery,
  reportingQueryToSearchParams,
} from './reportingQuery.js'

const normalize = (search = '') => normalizeReportingQuery(
  new URLSearchParams(search),
  { today: '2026-09-25' },
)

test('reporting query defaults to current business month and overview', () => {
  assert.deepEqual(normalize(), {
    view: 'overview',
    period: 'current-month',
    from: '2026-09-01',
    to: '2026-09-25',
    type: null,
    schedule: null,
    status: null,
    paymentMethod: null,
    category: null,
    product: null,
    customer: null,
    orderHourFrom: null,
    orderHourTo: null,
    operationalDeadline: null,
    search: '',
    sort: 'date-desc',
    page: 1,
    pageSize: 25,
  })
})

test('unknown reporting view falls back without discarding valid filters', () => {
  const query = normalize('view=unknown&type=Entrega&page=4&pageSize=50&category=Refei%C3%A7%C3%B5es')
  assert.equal(query.view, 'overview')
  assert.equal(query.type, 'Entrega')
  assert.equal(query.category, 'Refeições')
  assert.equal(query.page, 4)
  assert.equal(query.pageSize, 50)
})

test('reporting query serialization is deterministic and round-trippable', () => {
  const query = normalize('view=products&type=Entrega&schedule=scheduled&page=3&pageSize=50&search=maria')
  const serialized = reportingQueryToSearchParams(query).toString()
  assert.equal(
    serialized,
    'view=products&period=current-month&from=2026-09-01&to=2026-09-25&type=Entrega&schedule=scheduled&search=maria&sort=date-desc&page=3&pageSize=50',
  )
  assert.deepEqual(normalize(serialized), query)
})

test('population-changing reporting filters reset detail pagination', () => {
  const current = normalize('view=detail&type=Entrega&page=4&pageSize=50')
  const next = patchReportingQuery(current, { type: 'Retirada' })
  assert.equal(next.view, 'detail')
  assert.equal(next.type, 'Retirada')
  assert.equal(next.page, 1)
  assert.equal(next.pageSize, 50)
})

test('switching reporting view preserves active filters', () => {
  const current = normalize('view=overview&type=Entrega&category=Refei%C3%A7%C3%B5es&page=2')
  const next = patchReportingQuery(current, { view: 'products' })
  assert.equal(next.view, 'products')
  assert.equal(next.type, 'Entrega')
  assert.equal(next.category, 'Refeições')
})
