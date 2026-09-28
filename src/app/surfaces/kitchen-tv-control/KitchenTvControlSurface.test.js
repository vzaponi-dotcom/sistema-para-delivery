import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { act } from 'react-test-renderer'
import { buttonNamed, nodeText, renderWithNavigation, workspaceHarness } from '../../../test-support/renderWorkspace.js'

const NOW = new Date('2026-09-28T21:10:05.000Z')

const orders = Array.from({ length: 10 }, (_, index) => ({
  id: `order-${index + 1}`,
  orderNumber: 501 + index,
  status: 'Em preparo',
  client: index === 0 ? 'Ana Carolina' : `Cliente ${index + 1}`,
  type: 'Entrega',
  createdAt: index === 0
    ? '2026-09-28T20:00:00.000Z'
    : index === 1
      ? '2026-09-28T20:45:00.000Z'
      : '2026-09-28T21:05:00.000Z',
  items: [{ name: `Item secreto ${index + 1}` }],
  total: 9999,
  phone: '11999999999',
  address: 'Rua que não deve aparecer',
}))

const freshState = {
  paired: true,
  control: { revision: 4, requestedPage: 2, updatedAt: '2026-09-28T21:10:00.000Z' },
  telemetry: {
    appliedRevision: 4,
    currentPage: 2,
    pageCount: 3,
    viewportWidth: 1920,
    viewportHeight: 1080,
    visibleOrderIds: ['order-1', 'order-2', 'order-3', 'order-4'],
    reportedAt: '2026-09-28T21:10:00.000Z',
  },
  hiddenOrderIds: ['order-10'],
}

async function render(t, {
  granted = new Set(['orders.view', 'orders.kitchen.control']),
  isOnline = true,
  state = freshState,
  apiOverrides = {},
} = {}) {
  const h = await workspaceHarness(t, { mobile: true })
  const calls = []
  const api = {
    getKitchenTvControl: async () => state,
    setKitchenTvPage: async (page) => {
      calls.push(['page', page])
      return {
        ...state,
        control: { ...state.control, revision: state.control.revision + 1, requestedPage: page },
      }
    },
    ...apiOverrides,
  }
  const { default: KitchenTvControlSurface } = await h.load('/src/app/surfaces/kitchen-tv-control/KitchenTvControlSurface.jsx')
  const screen = await renderWithNavigation(h, KitchenTvControlSurface, {
    activeTab: 'kitchen-tv-control',
    implemented: new Set(['orders', 'history', 'kitchen-tv-control']),
    orders,
    now: NOW,
    granted,
    isOnline,
    api,
    onNavigate: (id) => calls.push(['navigate', id]),
    onFeedback: (message) => calls.push(['feedback', message]),
  })
  await act(async () => {})
  return { h, screen, calls }
}

test('renders the approved compact two-column grid with ten cards and no sensitive/order-detail data', async (t) => {
  const { screen } = await render(t)
  const cards = screen.root.findAll((node) => node.props.className === 'kitchen-tv-control-order-card')
  assert.equal(cards.length, 10)

  const text = nodeText(screen.root)
  assert.match(text, /Controle da TV/)
  assert.match(text, /Tela 2 de 3/)
  assert.match(text, /Pedido #501/)
  assert.match(text, /Ana/)
  assert.match(text, /ATRASADO/)
  assert.match(text, /PRÓXIMO DO LIMITE/)
  assert.match(text, /Na TV/)
  assert.match(text, /Fora/)
  assert.match(text, /Retirado/)
  assert.doesNotMatch(text, /Item secreto|R\$|9999|11999999999|Rua que não deve aparecer/)

  const css = await readFile(new URL('./kitchenTvControl.css', import.meta.url), 'utf8')
  assert.match(css, /\.kitchen-tv-control-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
})

test('viewer keeps the surface readable but cannot send page commands', async (t) => {
  const { screen, calls } = await render(t, { granted: new Set(['orders.view']) })
  assert.match(nodeText(screen.root), /Somente leitura/)
  for (const label of ['Anterior', 'Início', 'Próxima']) {
    assert.equal(buttonNamed(screen.root, label).props.disabled, true)
  }
  await act(async () => buttonNamed(screen.root, 'Próxima').props.onClick?.())
  assert.deepEqual(calls, [])
})

test('fresh telemetry enables bounded page controls for a controller', async (t) => {
  const { screen, calls } = await render(t)
  assert.equal(buttonNamed(screen.root, 'Anterior').props.disabled, false)
  assert.equal(buttonNamed(screen.root, 'Início').props.disabled, false)
  assert.equal(buttonNamed(screen.root, 'Próxima').props.disabled, false)
  await act(async () => buttonNamed(screen.root, 'Próxima').props.onClick())
  assert.deepEqual(calls[0], ['page', 3])
  assert.match(nodeText(screen.root), /Atualizando TV/)
})

test('stale telemetry never claims current visibility and disables operational controls', async (t) => {
  const stale = {
    ...freshState,
    telemetry: { ...freshState.telemetry, reportedAt: '2026-09-28T21:09:40.000Z' },
  }
  const { screen } = await render(t, { state: stale })
  const text = nodeText(screen.root)
  assert.match(text, /TV sem sinal/)
  assert.doesNotMatch(text, /Na TV/)
  assert.match(text, /Retirado/)
  for (const label of ['Anterior', 'Início', 'Próxima']) {
    assert.equal(buttonNamed(screen.root, label).props.disabled, true)
  }
})

test('exposes loading without replacing the official order collection', async (t) => {
  const pending = new Promise(() => {})
  const loading = await render(t, { apiOverrides: { getKitchenTvControl: () => pending } })
  assert.match(nodeText(loading.screen.root), /Carregando controle da TV/)
})

test('exposes control read failures', async (t) => {
  const failed = await render(t, {
    apiOverrides: { getKitchenTvControl: async () => { throw new Error('Falha simulada') } },
  })
  assert.match(nodeText(failed.screen.root), /Falha simulada/)
})

test('exposes offline state without queueing TV commands', async (t) => {
  const offline = await render(t, { isOnline: false })
  assert.match(nodeText(offline.screen.root), /Sem conexão/)
})
