import assert from 'node:assert/strict'
import test from 'node:test'
import { act } from 'react-test-renderer'

import { workspaceHarness, nodeText } from './test-support/renderWorkspace.js'
import { authenticatedSession, effectivePaymentConfig } from './test-support/appSessionFixtures.js'

const response = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => structuredClone(data),
})

async function renderDirectFinanceRoute(t, path) {
  const h = await workspaceHarness(t)
  h.localStorage.setItem('delivery-notifications:v1:amor-e-sabor', JSON.stringify({
    version: 1,
    knownIds: ['release-2026-09-operation-shell'],
    presentedIds: ['release-2026-09-operation-shell'],
    readIds: ['release-2026-09-operation-shell'],
  }))

  globalThis.fetch = async (url) => {
    const target = String(url)
    if (target === '/api/auth/session') return response(authenticatedSession)
    if (target.startsWith('/api/bootstrap')) return response({
      business: { id: 'amor-e-sabor', name: 'Amor & Sabor' },
      tables: [],
      tableTabs: [],
      orders: [],
      clients: [],
      products: [],
      movements: [],
      financeSettings: null,
      effectiveBusinessConfig: effectivePaymentConfig,
    })
    if (target.startsWith('/api/settings/effective')) return response(effectivePaymentConfig)
    if (target === '/api/printing/stations') return response({
      stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }],
      primary: { resource: 'stationPrimary', revision: 1, data: { primaryStationId: null }, meta: {} },
    })
    if (target === '/api/printing/jobs?limit=100') return response({ jobs: [] })
    if (target === '/api/printing/jobs/summary') return response({ summary: { safeBacklog: 0 } })
    if (target === '/api/printing/settings') return response({
      settings: {
        resource: 'printingPolicy',
        revision: 1,
        data: { orderDefaultCopies: 1, tableTabDefaultCopies: 1 },
        meta: {},
      },
    })
    if (target === '/api/orders') return response({ orders: [] })
    throw new Error(`Unexpected request: ${target}`)
  }

  const { default: App } = await h.load('/src/App.jsx')
  const { renderer, router } = await h.renderAdminApp(App, {}, { initialEntries: [path] })

  await act(async () => {
    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))
  })

  return { renderer, router }
}

test('Task 8 regression: direct authenticated reload renders A Receber', async (t) => {
  const { renderer, router } = await renderDirectFinanceRoute(t, '/financeiro/a-receber')
  assert.equal(router.state.location.pathname, '/financeiro/a-receber')
  assert.match(nodeText(renderer.root), /A receber/)
})

test('Task 8 regression: direct authenticated reload renders Movimentações', async (t) => {
  const { renderer, router } = await renderDirectFinanceRoute(t, '/financeiro/movimentacoes')
  assert.equal(router.state.location.pathname, '/financeiro/movimentacoes')
  assert.match(nodeText(renderer.root), /Fluxo de caixa|Movimentações/)
})
