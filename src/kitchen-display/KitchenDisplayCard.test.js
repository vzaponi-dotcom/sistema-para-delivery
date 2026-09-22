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

test('card hierarchy, exact state labels and content limits match the TV contract', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayCard, KITCHEN_DISPLAY_STATUS_LABELS } = await h.load('/src/kitchen-display/KitchenDisplayCard.jsx')
  assert.deepEqual(KITCHEN_DISPLAY_STATUS_LABELS, {
    new: 'NOVO PEDIDO', late: 'ATRASADO', 'near-limit': 'PRÓXIMO DO LIMITE', preparing: 'EM PREPARO', scheduled: 'AGENDADO',
  })
  const renderer = await h.render(KitchenDisplayCard, { entry: entry('new'), now: new Date('2026-09-22T19:00:02.000Z') })
  const text = nodeText(renderer.root)
  assert.ok(text.indexOf('Ana Souza') < text.indexOf('#1042'))
  assert.match(text, /NOVO PEDIDO/)
  assert.match(text, /00:32/)
  assert.match(text, /1xBurger Clássico/)
  assert.match(text, /\+ 2 itens/)
  assert.match(text, /Sem cebola/)
  assert.match(text, /\+ 2 observações/)
  assert.equal(renderer.root.findByProps({ className: 'kds-card__items' }).findAllByType('li').length, 4)
  assert.equal(renderer.root.findByProps({ className: 'kds-card__notes' }).findAllByType('p').length, 2)
  const primary = renderer.root.findByProps({ className: 'kds-card__main' })
  assert.ok(primary.findByProps({ className: 'kds-card__customer' }))
  assert.ok(primary.findByProps({ className: 'kds-card__timing' }))
  assert.doesNotMatch(text, /Finalizar|Cancelar|Imprimir|Novo pedido/)
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

test('timer switches to H:MM:SS and scheduled cards show desired HH:mm with clock', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayCard } = await h.load('/src/kitchen-display/KitchenDisplayCard.jsx')
  const longEntry = { ...entry('preparing', { createdAt: '2026-09-22T17:00:00.000Z' }), operationalStartAt: new Date('2026-09-22T17:00:00.000Z') }
  const long = await h.render(KitchenDisplayCard, { entry: longEntry, now: new Date('2026-09-22T19:01:02.000Z') })
  assert.match(nodeText(long.root), /2:01:02/)
  const scheduled = await h.render(KitchenDisplayCard, { entry: entry('scheduled', { scheduledFor: '2026-09-22T22:00:00.000Z' }), now: new Date('2026-09-22T19:00:00.000Z') })
  assert.match(nodeText(scheduled.root), /19:00/)
  assert.ok(scheduled.root.findByProps({ 'data-icon': 'clock' }))
})
