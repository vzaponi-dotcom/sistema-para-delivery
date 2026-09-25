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

test('CSS fixes a 3x2 dark board, Inter typography, 720p contract and no page scroll', async () => {
  const css = await readFile(new URL('./kitchen-display.css', import.meta.url), 'utf8')
  assert.match(css, /--kds-bg:\s*#[0-9a-f]{6}/i)
  assert.match(css, /font-family:\s*Inter/i)
  assert.match(css, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(css, /grid-template-rows:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(css, /overflow:\s*hidden/)
  assert.match(css, /@media\s*\([^)]*max-height:\s*720px/)
  assert.doesNotMatch(css, /var\(--(?:color|theme|surface)-/)
})


const denseItems = (prefix = 'Produto') => Array.from({ length: 8 }, (_, index) => ({
  quantity: 1,
  name: `${prefix} ${index + 1}`,
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
  assert.equal(tall[0].props.style.gridRow, '1 / span 2')
  assert.equal(Number.isInteger(tall[0].props.style.gridColumn), true)
  assert.match(nodeText(renderer.root), /\+ 1 pedido fora da tela/)
  for (const card of cards) {
    assert.equal(Number.isInteger(card.props.style.gridColumn), true)
    assert.match(String(card.props.style.gridRow), /^(1|2|1 \/ span 2)$/)
  }
})

test('board positions multiple tall cards explicitly without creating a third grid row', async (t) => {
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
  assert.equal(cards.some((node) => String(node.props.style.gridRow).startsWith('3')), false)
  assert.match(nodeText(renderer.root), /\+ 1 pedido fora da tela/)
})

test('CSS gives tall cards a two-row contract without enabling implicit page growth', async () => {
  const css = await readFile(new URL('./kitchen-display.css', import.meta.url), 'utf8')
  assert.match(css, /\.kds-card--tall\s*\{[^}]*grid-row:/s)
  assert.match(css, /grid-template-rows:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  assert.doesNotMatch(css, /grid-auto-rows:\s*(?!0)/)
})


test('fullscreen recovery uses a dedicated safe toolbar instead of overlaying the Kitchen TV grid', async () => {
  const css = await readFile(new URL('./kitchen-display.css', import.meta.url), 'utf8')
  assert.match(css, /\.kds-shell--fullscreen-recovery\s*\{[^}]*grid-template-rows:\s*56px\s+minmax\(0,\s*1fr\)/s)
  assert.match(css, /\.kds-live-toolbar\s*\{[^}]*height:\s*56px/s)
  assert.doesNotMatch(css, /\.kds-fullscreen-action\s*\{[^}]*position:\s*fixed/s)
})
