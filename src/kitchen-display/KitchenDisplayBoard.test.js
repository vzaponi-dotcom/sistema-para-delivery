import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { nodeText, workspaceHarness } from '../test-support/renderWorkspace.js'

const timing = { scheduledPrepLeadMinutes: 50, scheduledLateGraceMinutes: 15, immediateLateAfterMinutes: 30, immediateVeryLateAfterMinutes: 60 }

test('board renders normative header, six-card ceiling, overflow and empty state', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayBoard } = await h.load('/src/kitchen-display/KitchenDisplayBoard.jsx')
  const orders = Array.from({ length: 7 }, (_, index) => ({
    id: `order-${index}`, orderNumber: 1040 + index, client: `Cliente ${index}`, type: 'Entrega', status: 'Em preparo', createdAt: '2026-09-22T19:50:00.000Z', items: [],
  }))
  const now = new Date('2026-09-22T20:00:00.000Z')
  const renderer = await h.render(KitchenDisplayBoard, { orders, timing, now, highlightedIds: new Set() })
  const text = nodeText(renderer.root)
  assert.match(text, /Cozinha/)
  assert.match(text, /Boas refeições\. Mais histórias\./)
  assert.match(text, /Em preparo7/)
  assert.match(text, /Atrasados0/)
  assert.match(text, /Agendados0/)
  assert.match(text, /\+ 1 pedido fora da tela/)
  assert.equal(renderer.root.findAll((node) => String(node.props?.className || '').split(' ').includes('kds-card')).length, 6)

  const empty = await h.render(KitchenDisplayBoard, { orders: [], timing, now, highlightedIds: new Set() })
  assert.match(nodeText(empty.root), /Nenhum pedido aguardando preparo\./)
})

test('CSS keeps the dark Kitchen TV contract, Inter typography, 720p support and no page scroll', async () => {
  const css = await readFile(new URL('./kitchen-display.css', import.meta.url), 'utf8')
  assert.match(css, /--kds-bg:\s*#[0-9a-f]{6}/i)
  assert.match(css, /font-family:\s*Inter/i)
  assert.match(css, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(css, /overflow:\s*hidden/)
  assert.match(css, /@media\s*\([^)]*max-height:\s*720px/)
  assert.doesNotMatch(css, /var\(--(?:color|theme|surface)-/)
})


const denseItems = (prefix = 'Produto') => Array.from({ length: 8 }, (_, index) => ({
  quantity: 1,
  name: `${prefix} Família Especial Completo ${index + 1}`,
  note: index % 2 === 0 ? `Observação ${index + 1}` : '',
}))

test('board renders one tall order across both rows and reduces visible orders to five', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayBoard } = await h.load('/src/kitchen-display/KitchenDisplayBoard.jsx')
  const orders = [
    { id: 'large-1', orderNumber: 2001, client: 'Pedido grande', type: 'Entrega', status: 'Em preparo', createdAt: '2026-09-22T19:40:00.000Z', items: denseItems('Grande') },
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `normal-${index + 1}`, orderNumber: 2010 + index, client: `Normal ${index + 1}`, type: 'Retirada', status: 'Em preparo', createdAt: '2026-09-22T19:41:00.000Z', items: [],
    })),
  ]
  const renderer = await h.render(KitchenDisplayBoard, { orders, timing, now: new Date('2026-09-22T20:00:00.000Z'), highlightedIds: new Set() })
  const cards = renderer.root.findAll((node) => String(node.props?.className || '').split(' ').includes('kds-card'))
  const tall = cards.filter((node) => String(node.props.className).split(' ').includes('kds-card--tall'))

  assert.equal(cards.length, 5)
  assert.equal(tall.length, 1)
  assert.equal(tall[0].props['data-layout-demand'], 'tall')
  assert.equal(tall[0].props.style.gridRow, '1 / span 6')
  assert.equal(Number.isInteger(tall[0].props.style.gridColumn), true)
  assert.match(nodeText(renderer.root), /\+ 1 pedido fora da tela/)
  for (const card of cards) {
    assert.equal(Number.isInteger(card.props.style.gridColumn), true)
    assert.match(String(card.props.style.gridRow), /^(1 \/ span 6|1 \/ span 3|4 \/ span 3)$/)
  }
})

test('board positions multiple tall cards explicitly without exceeding the focus micro-grid', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayBoard } = await h.load('/src/kitchen-display/KitchenDisplayBoard.jsx')
  const orders = [
    { id: 'large-1', orderNumber: 2101, client: 'Grande 1', type: 'Entrega', status: 'Em preparo', createdAt: '2026-09-22T19:40:00.000Z', items: denseItems('Grande A') },
    { id: 'normal-1', orderNumber: 2102, client: 'Normal 1', type: 'Entrega', status: 'Em preparo', createdAt: '2026-09-22T19:41:00.000Z', items: [] },
    { id: 'large-2', orderNumber: 2103, client: 'Grande 2', type: 'Entrega', status: 'Em preparo', createdAt: '2026-09-22T19:42:00.000Z', items: denseItems('Grande B') },
    { id: 'normal-2', orderNumber: 2104, client: 'Normal 2', type: 'Entrega', status: 'Em preparo', createdAt: '2026-09-22T19:43:00.000Z', items: [] },
    { id: 'normal-3', orderNumber: 2105, client: 'Normal 3', type: 'Entrega', status: 'Em preparo', createdAt: '2026-09-22T19:44:00.000Z', items: [] },
  ]
  const renderer = await h.render(KitchenDisplayBoard, { orders, timing, now: new Date('2026-09-22T20:00:00.000Z'), highlightedIds: new Set() })
  const cards = renderer.root.findAll((node) => String(node.props?.className || '').split(' ').includes('kds-card'))
  const tall = cards.filter((node) => String(node.props.className).split(' ').includes('kds-card--tall'))

  assert.equal(cards.length, 4)
  assert.equal(tall.length, 2)
  assert.equal(new Set(tall.map((node) => node.props.style.gridColumn)).size, 2)
  assert.equal(cards.every((node) => {
    const row = Number(String(node.props.style.gridRow).split(' ')[0])
    const span = Number(node.props['data-grid-span'])
    return row + span - 1 <= 6
  }), true)
  assert.match(nodeText(renderer.root), /\+ 1 pedido fora da tela/)
})

test('CSS keeps explicit profile tracks without enabling implicit page growth', async () => {
  const css = await readFile(new URL('./kitchen-display.css', import.meta.url), 'utf8')
  assert.match(css, /\.kds-card--tall\s*\{[^}]*grid-row:/s)
  assert.match(css, /data-layout-profile="focus"[\s\S]*grid-template-rows:\s*repeat\(6,/)
  assert.match(css, /data-layout-profile="balanced"[\s\S]*grid-template-rows:\s*repeat\(8,/)
  assert.match(css, /data-layout-profile="compact"[\s\S]*grid-template-rows:\s*repeat\(12,/)
  assert.doesNotMatch(css, /grid-auto-rows:\s*(?!0)/)
})


test('fullscreen recovery uses a dedicated safe toolbar instead of overlaying the Kitchen TV grid', async () => {
  const css = await readFile(new URL('./kitchen-display.css', import.meta.url), 'utf8')
  assert.match(css, /\.kds-shell--fullscreen-recovery\s*\{[^}]*grid-template-rows:\s*56px\s+minmax\(0,\s*1fr\)/s)
  assert.match(css, /\.kds-live-toolbar\s*\{[^}]*height:\s*56px/s)
  assert.doesNotMatch(css, /\.kds-fullscreen-action\s*\{[^}]*position:\s*fixed/s)
})


test('board renders compact 4x3 density with ten short orders on the approved large viewport', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayBoard } = await h.load('/src/kitchen-display/KitchenDisplayBoard.jsx')
  const orders = Array.from({ length: 10 }, (_, index) => ({
    id: `dense-${index + 1}`,
    orderNumber: 3001 + index,
    client: `Cliente ${index + 1}`,
    type: 'Entrega',
    status: 'Em preparo',
    createdAt: '2026-09-22T19:50:00.000Z',
    items: [{ quantity: 1, name: 'Marmita executiva', note: '' }],
  }))

  const renderer = await h.render(KitchenDisplayBoard, {
    orders,
    timing,
    now: new Date('2026-09-22T20:00:00.000Z'),
    highlightedIds: new Set(),
    viewportWidth: 1640,
    viewportHeight: 924,
  })
  const board = renderer.root.find((node) => node.props?.className === 'kds-board')
  const cards = renderer.root.findAll((node) => String(node.props?.className || '').split(' ').includes('kds-card'))

  assert.equal(board.props['data-layout-profile'], 'compact')
  assert.equal(cards.length, 10)
  assert.doesNotMatch(nodeText(renderer.root), /fora da tela/)
  assert.equal(cards.every((card) => Number(card.props['data-row-span']) === 1), true)
})

test('board renders balanced 4x2 density at 1366x768 and reports overflow beyond eight', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayBoard } = await h.load('/src/kitchen-display/KitchenDisplayBoard.jsx')
  const orders = Array.from({ length: 10 }, (_, index) => ({
    id: `balanced-${index + 1}`,
    orderNumber: 3101 + index,
    client: `Cliente ${index + 1}`,
    type: 'Retirada',
    status: 'Em preparo',
    createdAt: '2026-09-22T19:50:00.000Z',
    items: [{ quantity: 1, name: 'Marmita', note: '' }],
  }))

  const renderer = await h.render(KitchenDisplayBoard, {
    orders,
    timing,
    now: new Date('2026-09-22T20:00:00.000Z'),
    highlightedIds: new Set(),
    viewportWidth: 1366,
    viewportHeight: 768,
  })
  const board = renderer.root.find((node) => node.props?.className === 'kds-board')
  const cards = renderer.root.findAll((node) => String(node.props?.className || '').split(' ').includes('kds-card'))

  assert.equal(board.props['data-layout-profile'], 'balanced')
  assert.equal(cards.length, 8)
  assert.match(nodeText(renderer.root), /\+ 2 pedidos fora da tela/)
})

test('CSS defines explicit focus, balanced and compact grid contracts', async () => {
  const css = await readFile(new URL('./kitchen-display.css', import.meta.url), 'utf8')
  assert.match(css, /data-layout-profile="focus"[^}]*\.kds-grid|data-layout-profile="focus"/s)
  assert.match(css, /data-layout-profile="balanced"[\s\S]*grid-template-columns:\s*repeat\(4,[\s\S]*grid-template-rows:\s*repeat\(8,/)
  assert.match(css, /data-layout-profile="compact"[\s\S]*grid-template-columns:\s*repeat\(4,[\s\S]*grid-template-rows:\s*repeat\(12,/)
  assert.match(css, /\.kds-card--full\s*\{[^}]*grid-row:\s*1\s*\/\s*span\s*3/s)
})


test('four-column density increases item and note typography while reclaiming vertical card space', async () => {
  const css = await readFile(new URL('./kitchen-display.css', import.meta.url), 'utf8')

  assert.match(css, /data-layout-profile="balanced"[\s\S]*--kds-item-size:\s*clamp\(\.95rem,[^;]*1\.18rem\)/)
  assert.match(css, /data-layout-profile="balanced"[\s\S]*--kds-note-size:\s*\.84em/)
  assert.match(css, /data-layout-profile="compact"[\s\S]*--kds-item-size:\s*clamp\(\.95rem,[^;]*1\.15rem\)/)
  assert.match(css, /data-layout-profile="compact"[\s\S]*--kds-note-size:\s*\.8em/)
  assert.match(css, /data-layout-profile="compact"[\s\S]*grid-template-rows:\s*repeat\(12,/)
})
