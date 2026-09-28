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

test('exposes offline state without queueing page or order commands', async (t) => {
  const mutations = []
  const offline = await render(t, {
    isOnline: false,
    apiOverrides: {
      setKitchenTvPage: async (page) => { mutations.push(['page', page]) },
      hideKitchenTvOrder: async (orderId) => { mutations.push(['hide', orderId]) },
    },
  })
  assert.match(nodeText(offline.screen.root), /Sem conexão/)
  const next = buttonNamed(offline.screen.root, 'Próxima')
  assert.equal(next.props.disabled, true)
  await act(async () => next.props.onClick())

  const card = offline.screen.root.findAllByType('button').find((node) => String(node.props['aria-label'] || '').startsWith('Pedido #501,'))
  await act(async () => card.props.onClick())
  const action = buttonNamed(offline.screen.root, 'Retirar da TV')
  assert.equal(action.props.disabled, true)
  await act(async () => action.props.onClick())
  assert.deepEqual(mutations, [])
})


test('tapping a card opens actions without mutating, then hide can be undone safely', async (t) => {
  let state = structuredClone(freshState)
  const mutations = []
  const { screen } = await render(t, {
    state,
    apiOverrides: {
      getKitchenTvControl: async () => state,
      hideKitchenTvOrder: async (orderId) => {
        mutations.push(['hide', orderId])
        state = { ...state, hiddenOrderIds: [...state.hiddenOrderIds, orderId] }
        return { orderId, hidden: true }
      },
      restoreKitchenTvOrder: async (orderId) => {
        mutations.push(['restore', orderId])
        state = { ...state, hiddenOrderIds: state.hiddenOrderIds.filter((id) => id !== orderId) }
        return { orderId, hidden: false }
      },
    },
  })
  const card = screen.root.findAllByType('button').find((node) => String(node.props['aria-label'] || '').startsWith('Pedido #501,'))
  await act(async () => card.props.onClick())
  assert.deepEqual(mutations, [])

  const sheet = screen.root.findByProps({ role: 'dialog' })
  assert.match(nodeText(sheet), /Pedido #501/)
  assert.match(nodeText(sheet), /Ana/)
  assert.match(nodeText(sheet), /Remove apenas do painel da TV\. O pedido continua em preparo no sistema\./)
  assert.ok(buttonNamed(sheet, 'Retirar da TV'))
  assert.ok(buttonNamed(sheet, 'Ver na Cozinha'))

  await act(async () => buttonNamed(sheet, 'Retirar da TV').props.onClick())
  assert.deepEqual(mutations, [['hide', 'order-1']])
  assert.match(nodeText(screen.root), /Retirado/)
  assert.ok(buttonNamed(screen.root, 'Desfazer'))

  await act(async () => buttonNamed(screen.root, 'Desfazer').props.onClick())
  assert.deepEqual(mutations, [['hide', 'order-1'], ['restore', 'order-1']])
  assert.match(nodeText(screen.root), /Na TV/)
})

test('a hidden preparing order can return to the TV from the action sheet', async (t) => {
  let state = structuredClone(freshState)
  const mutations = []
  const { screen } = await render(t, {
    state,
    apiOverrides: {
      getKitchenTvControl: async () => state,
      restoreKitchenTvOrder: async (orderId) => {
        mutations.push(['restore', orderId])
        state = { ...state, hiddenOrderIds: state.hiddenOrderIds.filter((id) => id !== orderId) }
        return { orderId, hidden: false }
      },
    },
  })
  const card = screen.root.findAllByType('button').find((node) => String(node.props['aria-label'] || '').startsWith('Pedido #510,'))
  await act(async () => card.props.onClick())
  const sheet = screen.root.findByProps({ role: 'dialog' })
  assert.ok(buttonNamed(sheet, 'Voltar para a TV'))

  await act(async () => buttonNamed(sheet, 'Voltar para a TV').props.onClick())
  assert.deepEqual(mutations, [['restore', 'order-10']])
  assert.doesNotMatch(String(card.props['aria-label']), /Retirado/)
})

test('hide failure rolls the optimistic card back to authoritative visibility and announces the error', async (t) => {
  let reads = 0
  const mutations = []
  const { screen } = await render(t, {
    apiOverrides: {
      getKitchenTvControl: async () => {
        reads += 1
        return freshState
      },
      hideKitchenTvOrder: async (orderId) => {
        mutations.push(['hide', orderId])
        throw new Error('Não foi possível retirar agora')
      },
    },
  })
  const card = screen.root.findAllByType('button').find((node) => String(node.props['aria-label'] || '').startsWith('Pedido #501,'))
  await act(async () => card.props.onClick())
  await act(async () => buttonNamed(screen.root, 'Retirar da TV').props.onClick())

  assert.deepEqual(mutations, [['hide', 'order-1']])
  assert.ok(reads >= 2)
  assert.match(nodeText(screen.root), /Não foi possível retirar agora/)
  const updated = screen.root.findAllByType('button').find((node) => String(node.props['aria-label'] || '').startsWith('Pedido #501,'))
  assert.match(updated.props['aria-label'], /Na TV/)
  assert.doesNotMatch(updated.props['aria-label'], /Retirado/)
})

test('read-only access keeps order actions visible but disabled', async (t) => {
  const viewer = await render(t, { granted: new Set(['orders.view']) })
  const viewerCard = viewer.screen.root.findAllByType('button').find((node) => String(node.props['aria-label'] || '').startsWith('Pedido #501,'))
  await act(async () => viewerCard.props.onClick())
  assert.equal(buttonNamed(viewer.screen.root, 'Retirar da TV').props.disabled, true)
})

test('stale TV state keeps order actions disabled and never queues a hidden mutation', async (t) => {
  const stale = {
    ...freshState,
    telemetry: { ...freshState.telemetry, reportedAt: '2026-09-28T21:09:40.000Z' },
  }
  const mutations = []
  const staleScreen = await render(t, {
    state: stale,
    apiOverrides: {
      hideKitchenTvOrder: async (orderId) => { mutations.push(['hide', orderId]) },
    },
  })
  const staleCard = staleScreen.screen.root.findAllByType('button').find((node) => String(node.props['aria-label'] || '').startsWith('Pedido #501,'))
  await act(async () => staleCard.props.onClick())
  const action = buttonNamed(staleScreen.screen.root, 'Retirar da TV')
  assert.equal(action.props.disabled, true)
  await act(async () => action.props.onClick())
  assert.deepEqual(mutations, [])
})

test('Ver na Cozinha navigates to the official kitchen without mutating the order', async (t) => {
  const mutations = []
  const { screen, calls } = await render(t, {
    apiOverrides: {
      hideKitchenTvOrder: async (orderId) => { mutations.push(['hide', orderId]) },
    },
  })
  const card = screen.root.findAllByType('button').find((node) => String(node.props['aria-label'] || '').startsWith('Pedido #501,'))
  await act(async () => card.props.onClick())
  await act(async () => buttonNamed(screen.root, 'Ver na Cozinha').props.onClick())
  assert.deepEqual(mutations, [])
  assert.ok(calls.some(([kind, value]) => kind === 'navigate' && value === 'orders'))
})

test('App wires navigation into the operational TV control surface', async () => {
  const appSource = await readFile(new URL('../../../App.jsx', import.meta.url), 'utf8')
  assert.match(appSource, /KitchenTvControlSurface[^\n]*onNavigate=\{requestNavigation\}/)
})
