import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatKitchenDisplayItemName,
  getKitchenCardContentMetrics,
  normalizeKitchenItemNote,
  packKitchenDisplaySlots,
  resolveKitchenViewportProfile,
} from './kitchenDisplayContentLayout.js'

const item = (name, note = '', size = '') => ({ quantity: 1, name, note, size })

test('three short items stay comfortable and require one visual slot', () => {
  const metrics = getKitchenCardContentMetrics([
    item('Arroz'),
    item('Feijão'),
    item('Batata frita'),
  ])

  assert.equal(metrics.density, 'comfortable')
  assert.equal(metrics.layoutDemand, 'normal')
  assert.equal(metrics.itemCount, 3)
  assert.ok(metrics.visualLines < 5)
})

test('five medium items become compact without requesting a tall card', () => {
  const metrics = getKitchenCardContentMetrics([
    item('Marmita de frango'),
    item('Marmita de carne'),
    item('Tilápia à milanesa'),
    item('Virado à paulista'),
    item('Omelete com queijo'),
  ])

  assert.equal(metrics.density, 'compact')
  assert.equal(metrics.layoutDemand, 'normal')
  assert.equal(metrics.itemCount, 5)
})

test('eight short items stay normal by using two columns when one column would not fit', () => {
  const metrics = getKitchenCardContentMetrics(
    Array.from({ length: 8 }, (_, index) => item(`Produto ${index + 1}`)),
    { viewportHeight: 720 },
  )

  assert.equal(metrics.density, 'dense')
  assert.equal(metrics.layoutDemand, 'normal')
  assert.equal(metrics.columnCount, 2)
  assert.equal(metrics.fitStrategy, 'normal-two-columns')
  assert.equal(metrics.itemCount, 8)
})

test('a request grows only after two columns no longer fit, then prefers one column while tall', () => {
  const metrics = getKitchenCardContentMetrics([
    item('[TESTE] Combo Individual Família Especial'),
    item('[TESTE] Sanduíche de Frango Especial Família'),
    item('[TESTE] Porção de Arroz Temperado Grande'),
    item('[TESTE] Calabresa Acebolada Especial Grande'),
    item('[TESTE] Marmita Frango Completa Família'),
    item('[TESTE] Mandioca Frita Crocante Grande'),
    item('[TESTE] Prato Executivo Completo Família'),
    item('[TESTE] Filé de Frango Grelhado Especial'),
  ], { viewportHeight: 720 })

  assert.equal(metrics.density, 'dense')
  assert.equal(metrics.layoutDemand, 'tall')
  assert.equal(metrics.columnCount, 1)
  assert.equal(metrics.fitStrategy, 'tall-one-column')
  assert.ok(metrics.visualLines >= 15)
  assert.ok(metrics.twoColumnVisualLines > metrics.normalLineCapacity)
  assert.ok(metrics.visualLines <= metrics.tallLineCapacity)
})

test('an extreme tall request returns to two columns only when one tall column is insufficient', () => {
  const metrics = getKitchenCardContentMetrics(
    Array.from({ length: 12 }, (_, index) => item(
      `Produto Família Especial Muito Completo ${index + 1}`,
      index % 2 === 0 ? 'Observação longa de produção em embalagem separada' : '',
    )),
    { viewportHeight: 720 },
  )

  assert.equal(metrics.layoutDemand, 'tall')
  assert.equal(metrics.columnCount, 2)
  assert.equal(metrics.fitStrategy, 'tall-two-columns')
  assert.ok(metrics.visualLines > metrics.tallLineCapacity)
})

test('shared item formatting normalizes whitespace and does not duplicate an existing size suffix', () => {
  assert.equal(formatKitchenDisplayItemName(item('  Marmita  ', '', ' G ')), 'Marmita G')
  assert.equal(formatKitchenDisplayItemName(item('Pizza Grande', '', 'Grande')), 'Pizza Grande')
  assert.equal(normalizeKitchenItemNote(item('X', '  sem   cebola  ')), 'sem cebola')
})


const normalEntry = (id) => ({
  order: {
    id,
    items: [item('Arroz'), item('Feijão')],
  },
})

const tallEntry = (id) => ({
  order: {
    id,
    items: Array.from({ length: 8 }, (_, index) => item(`Produto ${id}-${index + 1} Família Especial Completo`)),
  },
})

test('six normal cards consume the six visual slots without changing priority order', () => {
  const entries = Array.from({ length: 6 }, (_, index) => normalEntry(`n-${index + 1}`))
  const result = packKitchenDisplaySlots(entries)

  assert.equal(result.usedSlots, 6)
  assert.equal(result.remainingSlots, 0)
  assert.equal(result.overflow, 0)
  assert.deepEqual(result.cards.map((entry) => entry.order.id), entries.map((entry) => entry.order.id))
  assert.deepEqual(result.cards.map((entry) => entry.slotCost), [1, 1, 1, 1, 1, 1])
})

test('one tall card plus four normal cards fills six slots with five visible orders', () => {
  const entries = [tallEntry('t-1'), ...Array.from({ length: 5 }, (_, index) => normalEntry(`n-${index + 1}`))]
  const result = packKitchenDisplaySlots(entries)

  assert.equal(result.usedSlots, 6)
  assert.equal(result.cards.length, 5)
  assert.equal(result.overflow, 1)
  assert.deepEqual(result.cards.map((entry) => entry.order.id), ['t-1', 'n-1', 'n-2', 'n-3', 'n-4'])
  assert.deepEqual(result.cards.map((entry) => entry.slotCost), [2, 1, 1, 1, 1])
})

test('two tall cards plus two normal cards fill the board with four visible orders', () => {
  const entries = [
    tallEntry('t-1'),
    normalEntry('n-1'),
    tallEntry('t-2'),
    normalEntry('n-2'),
    normalEntry('n-3'),
  ]
  const result = packKitchenDisplaySlots(entries)

  assert.equal(result.usedSlots, 6)
  assert.equal(result.cards.length, 4)
  assert.equal(result.overflow, 1)
  assert.deepEqual(result.cards.map((entry) => entry.order.id), ['t-1', 'n-1', 't-2', 'n-2'])
})

test('three tall cards consume all six visual slots', () => {
  const entries = [tallEntry('t-1'), tallEntry('t-2'), tallEntry('t-3'), normalEntry('n-1')]
  const result = packKitchenDisplaySlots(entries)

  assert.equal(result.usedSlots, 6)
  assert.equal(result.cards.length, 3)
  assert.equal(result.overflow, 1)
  assert.deepEqual(result.cards.map((entry) => entry.order.id), ['t-1', 't-2', 't-3'])
  assert.deepEqual(result.cards.map((entry) => entry.layoutDemand), ['tall', 'tall', 'tall'])
})

test('packing never skips a higher-priority tall card to promote a lower-priority normal card', () => {
  const entries = [
    normalEntry('p-1'),
    normalEntry('p-2'),
    normalEntry('p-3'),
    normalEntry('p-4'),
    normalEntry('p-5'),
    tallEntry('p-6'),
    normalEntry('p-7'),
  ]
  const result = packKitchenDisplaySlots(entries)

  assert.equal(result.usedSlots, 5)
  assert.equal(result.remainingSlots, 1)
  assert.equal(result.overflow, 2)
  assert.deepEqual(result.cards.map((entry) => entry.order.id), ['p-1', 'p-2', 'p-3', 'p-4', 'p-5'])
  assert.equal(result.cards.some((entry) => entry.order.id === 'p-7'), false)
})

test('packing accepts a custom slot ceiling without changing the source array', () => {
  const entries = [tallEntry('t-1'), normalEntry('n-1'), normalEntry('n-2')]
  const snapshot = JSON.stringify(entries)
  const result = packKitchenDisplaySlots(entries, { maxSlots: 3 })

  assert.equal(result.usedSlots, 3)
  assert.equal(result.cards.length, 2)
  assert.equal(result.overflow, 1)
  assert.equal(JSON.stringify(entries), snapshot)
})


test('viewport profiles distinguish spacious, standard and constrained heights', () => {
  assert.equal(resolveKitchenViewportProfile(1080), 'spacious')
  assert.equal(resolveKitchenViewportProfile(720), 'standard')
  assert.equal(resolveKitchenViewportProfile(600), 'constrained')
  assert.equal(resolveKitchenViewportProfile(undefined), 'standard')
})

test('the same eight-line order adapts columns before consuming a second visual slot', () => {
  const items = Array.from({ length: 8 }, (_, index) => item(`Produto ${index + 1}`))
  const spacious = getKitchenCardContentMetrics(items, { viewportHeight: 1080 })
  const standard = getKitchenCardContentMetrics(items, { viewportHeight: 720 })

  assert.equal(spacious.density, 'dense')
  assert.equal(spacious.layoutDemand, 'normal')
  assert.equal(spacious.columnCount, 1)
  assert.equal(spacious.fitStrategy, 'normal-one-column')
  assert.equal(spacious.viewportProfile, 'spacious')
  assert.equal(standard.layoutDemand, 'normal')
  assert.equal(standard.columnCount, 2)
  assert.equal(standard.fitStrategy, 'normal-two-columns')
  assert.equal(standard.viewportProfile, 'standard')
})

test('constrained height still tries normal two-column fit before promoting to tall', () => {
  const items = Array.from({ length: 7 }, (_, index) => item(`Marmita Família Especial Completa ${index + 1}`))
  const spacious = getKitchenCardContentMetrics(items, { viewportHeight: 1080 })
  const constrained = getKitchenCardContentMetrics(items, { viewportHeight: 600 })

  assert.equal(spacious.layoutDemand, 'normal')
  assert.equal(spacious.columnCount, 2)
  assert.equal(constrained.layoutDemand, 'tall')
  assert.equal(constrained.columnCount, 1)
  assert.equal(constrained.fitStrategy, 'tall-one-column')
})

test('slot packing keeps six cards when two columns are enough and drops to five only when tall is necessary', () => {
  const adaptable = {
    order: {
      id: 'adaptive',
      items: Array.from({ length: 8 }, (_, index) => item(`Produto ${index + 1}`)),
    },
  }
  const trulyTall = {
    order: {
      id: 'tall',
      items: Array.from({ length: 8 }, (_, index) => item(`Produto Família Especial Completo ${index + 1}`)),
    },
  }
  const normals = Array.from({ length: 5 }, (_, index) => normalEntry(`n-${index + 1}`))

  const standardNormal = packKitchenDisplaySlots([adaptable, ...normals], { maxSlots: 6, viewportHeight: 720 })
  const standardTall = packKitchenDisplaySlots([trulyTall, ...normals], { maxSlots: 6, viewportHeight: 720 })

  assert.equal(standardNormal.cards.length, 6)
  assert.equal(standardNormal.cards[0].layoutDemand, 'normal')
  assert.equal(standardNormal.cards[0].contentMetrics.columnCount, 2)
  assert.equal(standardTall.cards.length, 5)
  assert.equal(standardTall.cards[0].layoutDemand, 'tall')
  assert.equal(standardTall.cards[0].contentMetrics.columnCount, 1)
})
