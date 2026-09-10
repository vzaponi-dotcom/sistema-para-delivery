import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildKitchenItemSummary,
  buildKitchenTimingCopy,
  getKitchenItemNotes,
} from './kitchenTicket.js'

const order = {
  id: 'order-1048',
  items: [
    { id: 'item-1', name: 'Marmita', size: 'G', quantity: 1, note: ' sem cebola ' },
    { id: 'item-2', name: 'Suco', size: '500 ml', quantity: 1, note: 'sem gelo' },
    { id: 'item-3', name: 'Coca-Cola', size: '2L', quantity: 1, note: '' },
    { id: 'item-4', name: 'Pudim', quantity: 1, note: '' },
    { id: 'item-5', name: 'Batata', quantity: 1, note: '' },
  ],
}

test('summarizes all kitchen item lines while listing only the requested leading labels', () => {
  assert.equal(buildKitchenItemSummary(order, 3), '5 itens · Marmita G, Suco 500 ml, Coca-Cola 2L +2')
})

test('keeps every non-empty note associated with its own item without reading a generic order note', () => {
  assert.deepEqual(getKitchenItemNotes(order), [
    { key: 'item-1', itemLabel: 'Marmita G', note: 'sem cebola', text: 'Marmita G — sem cebola' },
    { key: 'item-2', itemLabel: 'Suco 500 ml', note: 'sem gelo', text: 'Suco 500 ml — sem gelo' },
  ])
  assert.deepEqual(getKitchenItemNotes({ items: [{ name: 'Pudim', note: '   ' }] }), [])
  assert.equal(Object.hasOwn(order, 'note'), false)
})

test('preserves the complete persisted item note in the kitchen view model', () => {
  const note = `sem molho ${'muito importante '.repeat(24)}`.trim()

  assert.equal(note.length > 300, true)
  assert.deepEqual(getKitchenItemNotes({ items: [{ id: 'item-long-note', name: 'Marmita', note }] }), [{
    key: 'item-long-note',
    itemLabel: 'Marmita',
    note,
    text: `Marmita — ${note}`,
  }])
})

test('builds scheduled, preparing, and overdue timing copy in the business timezone', () => {
  const now = new Date('2026-09-04T14:35:00.000Z')

  assert.deepEqual(buildKitchenTimingCopy({
    phase: 'scheduled',
    order: { createdAt: '2026-09-04T12:00:00.000Z', scheduledFor: '2026-09-04T15:50:00.000Z' },
  }, now), { primary: 'Preparo em 25 min', secondary: 'Desejado 12:50' })
  assert.deepEqual(buildKitchenTimingCopy({
    phase: 'preparing',
    timingState: 'on-time',
    order: { createdAt: '2026-09-04T14:17:00.000Z' },
  }, now), { primary: 'Em preparo há 18 min', secondary: '' })
  assert.deepEqual(buildKitchenTimingCopy({
    phase: 'preparing',
    timingState: 'late',
    order: { createdAt: '2026-09-04T12:00:00.000Z', scheduledFor: '2026-09-04T14:20:00.000Z' },
  }, new Date('2026-09-04T14:47:00.000Z')), { primary: 'Fora do prazo há 12 min', secondary: 'Desejado 11:20' })
})

test('keeps immediate overdue copy continuous when timing state becomes very-late', () => {
  const immediate = { createdAt: '2026-09-04T14:00:00.000Z' }

  assert.deepEqual(buildKitchenTimingCopy({ phase: 'preparing', timingState: 'late', order: immediate }, new Date('2026-09-04T14:39:00.000Z')), {
    primary: 'Fora do prazo há 9 min',
    secondary: '',
  })
  assert.deepEqual(buildKitchenTimingCopy({ phase: 'preparing', timingState: 'late', order: immediate }, new Date('2026-09-04T14:40:00.000Z')), {
    primary: 'Fora do prazo há 10 min',
    secondary: '',
  })
  assert.deepEqual(buildKitchenTimingCopy({ phase: 'preparing', timingState: 'very-late', order: immediate }, new Date('2026-09-04T14:41:00.000Z')), {
    primary: 'Fora do prazo há 11 min',
    secondary: '',
  })
})

test('formats kitchen elapsed durations as hours after 60 minutes', () => {
  const now = new Date('2026-09-05T18:00:00.000Z')
  const primaryFor = (minutes) => buildKitchenTimingCopy({
    phase: 'preparing',
    timingState: 'on-time',
    order: { createdAt: new Date(now.getTime() - (minutes * 60_000)).toISOString() },
  }, now).primary

  assert.equal(primaryFor(59), 'Em preparo há 59 min')
  assert.equal(primaryFor(60), 'Em preparo há 1 h')
  assert.equal(primaryFor(65), 'Em preparo há 1 h 5 min')
  assert.equal(primaryFor(120), 'Em preparo há 2 h')
  assert.equal(primaryFor(1546), 'Em preparo há 25 h 46 min')
})
