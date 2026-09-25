import test from 'node:test'
import assert from 'node:assert/strict'

import { nodeText, workspaceHarness } from '../test-support/renderWorkspace.js'

const entry = (state, overrides = {}) => ({
  state, phase: state === 'scheduled' ? 'scheduled' : 'preparing', timingState: state === 'late' ? 'late' : 'on-time',
  operationalStartAt: new Date('2026-09-22T18:59:30.000Z'), lateAt: new Date('2026-09-22T19:30:00.000Z'),
  order: {
    id: 'order-1042', orderNumber: 1042, client: 'Ana Souza', type: 'Entrega', createdAt: '2026-09-22T18:59:30.000Z',
    items: [
      { quantity: 1, name: 'Burger Clássico', note: 'Sem cebola' },
      { quantity: 2, name: 'Batata Rústica', note: 'Bem crocante' },
      { quantity: 1, name: 'Suco Natural', note: 'Pouco gelo' },
      { quantity: 1, name: 'Pudim', note: '' },
      { quantity: 1, name: 'Café', note: '' },
    ],
    ...overrides,
  },
})

test('card shows every item and keeps each production note attached to its own product', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayCard, KITCHEN_DISPLAY_STATUS_LABELS } = await h.load('/src/kitchen-display/KitchenDisplayCard.jsx')
  assert.deepEqual(KITCHEN_DISPLAY_STATUS_LABELS, {
    new: 'NOVO PEDIDO', late: 'ATRASADO', 'near-limit': 'PRÓXIMO DO LIMITE', preparing: 'EM PREPARO', scheduled: 'AGENDADO',
  })
  const renderer = await h.render(KitchenDisplayCard, { entry: entry('new'), now: new Date('2026-09-22T19:00:02.000Z') })
  const text = nodeText(renderer.root)
  assert.ok(text.indexOf('Ana Souza') < text.indexOf('#1042'))
  assert.match(text, /NOVO PEDIDO/)
  assert.match(text, /0min/)
  for (const expected of ['Burger Clássico', 'Batata Rústica', 'Suco Natural', 'Pudim', 'Café']) assert.match(text, new RegExp(expected))
  for (const expected of ['Sem cebola', 'Bem crocante', 'Pouco gelo']) assert.match(text, new RegExp(expected))
  assert.doesNotMatch(text, /\+ \d+ itens|\+ \d+ observa/)
  const items = renderer.root.findByProps({ className: 'kds-card__items is-two-columns' }).findAllByType('li')
  assert.equal(items.length, 5)
  const noted = renderer.root.findAllByProps({ className: 'kds-card__item-note' })
  assert.equal(noted.length, 3)
  assert.match(nodeText(items[0]), /Burger Clássico.*Sem cebola/)
  assert.match(nodeText(items[1]), /Batata Rústica.*Bem crocante/)
  assert.match(nodeText(items[2]), /Suco Natural.*Pouco gelo/)
  assert.equal(renderer.root.findAllByProps({ className: 'kds-card__notes' }).length, 0)
  const primary = renderer.root.findByProps({ className: 'kds-card__main' })
  assert.ok(primary.findByProps({ className: 'kds-card__customer' }))
  assert.ok(primary.findByProps({ className: 'kds-card__timing' }))
  assert.doesNotMatch(text, /Finalizar|Cancelar|Imprimir|Novo pedido/)
})

test('large orders keep all items and opt into adaptive dense layout instead of truncating', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayCard } = await h.load('/src/kitchen-display/KitchenDisplayCard.jsx')
  const largeItems = Array.from({ length: 12 }, (_, index) => ({
    quantity: index + 1,
    name: `Produto ${index + 1}`,
    note: index % 2 === 0 ? `Observação ${index + 1}` : '',
  }))
  const renderer = await h.render(KitchenDisplayCard, {
    entry: entry('preparing', { items: largeItems }),
    now: new Date('2026-09-22T19:00:02.000Z'),
  })
  assert.match(renderer.root.findByType('article').props.className, /kds-card--content-dense/)
  assert.match(renderer.root.findByType('article').props.className, /kds-card--tall/)
  assert.equal(renderer.root.findByType('article').props['data-item-count'], 12)
  assert.equal(renderer.root.findByType('ul').props.className, 'kds-card__items')
  assert.equal(renderer.root.findByType('article').props['data-column-count'], 1)
  const text = nodeText(renderer.root)
  for (let index = 1; index <= 12; index += 1) assert.match(text, new RegExp(`Produto ${index}`))
  assert.doesNotMatch(text, /\+ \d+ itens/)
})

test('card preserves product variation without duplicating an existing suffix', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayCard } = await h.load('/src/kitchen-display/KitchenDisplayCard.jsx')
  const renderer = await h.render(KitchenDisplayCard, { entry: entry('preparing', {
    items: [
      { quantity: 1, name: 'Marmita', size: 'G', note: '' },
      { quantity: 1, name: 'Pizza Grande', size: 'Grande', note: '' },
    ],
  }), now: new Date('2026-09-22T19:00:02.000Z') })
  const text = nodeText(renderer.root)
  assert.match(text, /1xMarmita G/)
  assert.match(text, /1xPizza Grande/)
  assert.doesNotMatch(text, /Pizza Grande Grande/)
})

test('elapsed time uses minutes then hours while scheduled cards keep desired HH:mm with clock', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayCard } = await h.load('/src/kitchen-display/KitchenDisplayCard.jsx')
  const longEntry = { ...entry('preparing', { createdAt: '2026-09-22T17:00:00.000Z' }), operationalStartAt: new Date('2026-09-22T17:00:00.000Z') }
  const long = await h.render(KitchenDisplayCard, { entry: longEntry, now: new Date('2026-09-22T19:01:02.000Z') })
  assert.match(nodeText(long.root), /2h 1min/)
  const scheduled = await h.render(KitchenDisplayCard, { entry: entry('scheduled', { scheduledFor: '2026-09-22T22:00:00.000Z' }), now: new Date('2026-09-22T19:00:00.000Z') })
  assert.match(nodeText(scheduled.root), /19:00/)
  assert.ok(scheduled.root.findByProps({ 'data-icon': 'clock' }))
})


test('long product names trigger compact density before vertical clipping', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayCard } = await h.load('/src/kitchen-display/KitchenDisplayCard.jsx')
  const renderer = await h.render(KitchenDisplayCard, {
    entry: entry('preparing', {
      items: [
        { quantity: 1, name: 'Prato feito comercial Família', note: '' },
        { quantity: 1, name: '[TESTE] Marmita Frango P', note: '' },
        { quantity: 1, name: '[TESTE] Sanduíche de Frango Un', note: '' },
        { quantity: 1, name: '[TESTE] Prato Executivo Un', note: '' },
        { quantity: 1, name: '[TESTE] X-Bacon Un', note: '' },
        { quantity: 1, name: 'Marmita Churrasco M', note: '' },
      ],
    }),
    now: new Date('2026-09-22T19:00:02.000Z'),
  })
  assert.match(renderer.root.findByType('article').props.className, /kds-card--content-dense/)
  assert.equal(renderer.root.findByType('article').props['data-item-count'], 6)
  assert.equal(renderer.root.findAllByType('li').length, 6)
})


test('normal cards use two columns before consuming a second visual slot', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayCard } = await h.load('/src/kitchen-display/KitchenDisplayCard.jsx')
  const items = Array.from({ length: 8 }, (_, index) => ({
    quantity: 1,
    name: `Produto ${index + 1}`,
    note: '',
  }))
  const renderer = await h.render(KitchenDisplayCard, {
    entry: entry('preparing', { items }),
    now: new Date('2026-09-22T19:00:02.000Z'),
  })

  const article = renderer.root.findByType('article')
  assert.doesNotMatch(article.props.className, /kds-card--tall/)
  assert.equal(article.props['data-layout-demand'], 'normal')
  assert.equal(article.props['data-column-count'], 2)
  assert.equal(renderer.root.findByType('ul').props.className, 'kds-card__items is-two-columns')
})

test('extreme tall cards return to two columns only after one tall column is insufficient', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayCard } = await h.load('/src/kitchen-display/KitchenDisplayCard.jsx')
  const items = Array.from({ length: 12 }, (_, index) => ({
    quantity: 1,
    name: `Produto Família Especial Muito Completo ${index + 1}`,
    note: index % 2 === 0 ? 'Observação longa de produção em embalagem separada' : '',
  }))
  const renderer = await h.render(KitchenDisplayCard, {
    entry: entry('preparing', { items }),
    now: new Date('2026-09-22T19:00:02.000Z'),
  })

  const article = renderer.root.findByType('article')
  assert.match(article.props.className, /kds-card--tall/)
  assert.equal(article.props['data-layout-demand'], 'tall')
  assert.equal(article.props['data-column-count'], 2)
  assert.equal(renderer.root.findByType('ul').props.className, 'kds-card__items is-two-columns')
})
