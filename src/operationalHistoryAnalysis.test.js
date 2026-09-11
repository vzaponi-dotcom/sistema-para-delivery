import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'

import { createQueryContext, patchQueryContext } from './app/queryContext.js'
import { calculateOperationalMetrics } from './utils/dashboardAnalytics.js'
import { nodeText, workspaceHarness } from './test-support/renderWorkspace.js'

const now = new Date(2026, 8, 11, 12, 0, 0)
const orders = [
  { id: 'fast', client: 'Ana', type: 'Entrega', status: 'Finalizado', orderDate: '2026-09-11', createdAt: '2026-09-11T10:00:00.000Z', finishedAt: '2026-09-11T10:20:00.000Z', total: 20, items: [] },
  { id: 'medium', client: 'Bia', type: 'Entrega', status: 'Finalizado', orderDate: '2026-09-11', createdAt: '2026-09-11T10:00:00.000Z', finishedAt: '2026-09-11T10:25:00.000Z', total: 25, items: [] },
  { id: 'slow', client: 'Caio', type: 'Retirada', status: 'Finalizado', orderDate: '2026-09-11', createdAt: '2026-09-11T10:00:00.000Z', finishedAt: '2026-09-11T10:35:00.000Z', total: 35, items: [] },
  { id: 'local', client: 'Dani', type: 'Local', status: 'Finalizado', orderDate: '2026-09-11', createdAt: '2026-09-11T10:00:00.000Z', finishedAt: '2026-09-11T10:50:00.000Z', total: 50, items: [] },
  { id: 'cancelled', client: 'Eva', type: 'Local', status: 'Cancelado', orderDate: '2026-09-11', createdAt: '2026-09-11T10:00:00.000Z', finishedAt: '2026-09-11T10:10:00.000Z', total: 10, items: [] },
]

const response = (payload) => ({ ok: true, status: 200, json: async () => payload })
const flush = () => new Promise((resolve) => setImmediate(resolve))

test('operational component preserves calculateOperationalMetrics results for the same sample instant and period', async (t) => {
  const expected = calculateOperationalMetrics(orders, 'today', now)
  assert.deepEqual(expected, {
    sampleSize: 4,
    averageMinutes: 32.5,
    fastestMinutes: 20,
    slowestMinutes: 50,
    bands: [1, 1, 1, 1],
    byType: { Entrega: 22.5, Retirada: 35, Local: 50 },
  })

  const h = await workspaceHarness(t)
  const { default: OperationalHistoryAnalysis } = await h.load('/src/components/OperationalHistoryAnalysis.jsx')
  const renderer = await h.render(OperationalHistoryAnalysis, { orders, period: 'today', onPeriodChange() {}, now })
  const text = nodeText(renderer.root)
  assert.match(text, /32,5 min/)
  assert.match(text, /20 min/)
  assert.match(text, /50 min/)
  assert.match(text, /Entrega22,5 min/)
  assert.match(text, /Retirada35 min/)
  assert.match(text, /Local50 min/)
  const bandChart = renderer.root.findByProps({ 'aria-label': 'Pedidos por faixa de tempo operacional' })
  assert.equal(bandChart.findAllByType('rect').length, 4)
  assert.equal(new Set(bandChart.findAllByType('rect').map((node) => node.props.height)).size, 1)
})

test('history list filter does not change the official collection used by operational analysis', async (t) => {
  const h = await workspaceHarness(t)
  const { default: OrderHistory } = await h.load('/src/pages/OrderHistory.jsx')
  const changes = []
  const renderer = await h.render(OrderHistory, {
    orders,
    queryState: { filter: 'cancelled', analysisPeriod: 'today' },
    onQueryChange: (patch) => changes.push(patch),
    canViewAnalysis: true,
    now,
  })
  assert.match(nodeText(renderer.root), /1 registro\(s\)/)
  assert.match(nodeText(renderer.root), /Tempo médio32,5 min/)
  const finalized = renderer.root.findAllByType('button').find((button) => nodeText(button) === 'Finalizados')
  await act(async () => finalized.props.onClick())
  assert.deepEqual(changes, [{ filter: 'finalized' }])
})

test('commercial and operational periods remain independent with 30d defaults and fixed options', async (t) => {
  const initial = createQueryContext()
  assert.equal(initial.dashboard.period, '30d')
  assert.equal(initial.history.analysisPeriod, '30d')
  const operational = patchQueryContext(initial, 'history', { analysisPeriod: '7d' })
  assert.equal(operational.dashboard.period, '30d')
  assert.equal(operational.history.analysisPeriod, '7d')
  const commercial = patchQueryContext(operational, 'dashboard', { period: 'today' })
  assert.equal(commercial.dashboard.period, 'today')
  assert.equal(commercial.history.analysisPeriod, '7d')

  const h = await workspaceHarness(t)
  const { default: OperationalHistoryAnalysis } = await h.load('/src/components/OperationalHistoryAnalysis.jsx')
  const changes = []
  const renderer = await h.render(OperationalHistoryAnalysis, { orders: [], period: '30d', onPeriodChange: (period) => changes.push(period), now })
  const buttons = renderer.root.findAllByType('button')
  assert.deepEqual(buttons.map(nodeText), ['Hoje', '7 dias', '30 dias'])
  assert.match(nodeText(renderer.root), /Sem pedidos concluídos elegíveis neste período/)
  await act(async () => buttons[0].props.onClick())
  assert.deepEqual(changes, ['today'])
})

test('real App gates history analysis with orders.analysis while keeping history accessible', async (t) => {
  const h = await workspaceHarness(t)
  globalThis.fetch = async (path) => {
    const url = String(path)
    if (url === '/api/auth/session') return response({ authenticated: true })
    if (url === '/api/bootstrap') return response({ tables: [], tableTabs: [], orders, clients: [], products: [], movements: [], financeSettings: null })
    if (url === '/api/printing/stations') return response({ stations: [] })
    if (url.startsWith('/api/printing/jobs?')) return response({ jobs: [] })
    if (url === '/api/printing/jobs/summary') return response({ summary: { safeBacklog: 0 } })
    throw new Error(`Unexpected request: ${url}`)
  }
  const { default: App } = await h.load('/src/App.jsx')

  const historyOnly = await h.render(App, { capabilities: new Set(['orders.history']) })
  await act(flush)
  assert.match(nodeText(historyOnly.root), /Histórico/)
  assert.doesNotMatch(nodeText(historyOnly.root), /Tempo operacional/)

  const withAnalysis = await h.render(App, { capabilities: new Set(['orders.history', 'orders.analysis']) })
  await act(flush)
  assert.match(nodeText(withAnalysis.root), /Histórico/)
  assert.match(nodeText(withAnalysis.root), /Tempo operacional/)
})
