import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatKitchenDisplayItemName,
  getKitchenCardContentMetrics,
  normalizeKitchenItemNote,
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

test('eight or more items become dense and request a tall card', () => {
  const metrics = getKitchenCardContentMetrics(Array.from({ length: 8 }, (_, index) => item(`Produto ${index + 1}`)))

  assert.equal(metrics.density, 'dense')
  assert.equal(metrics.layoutDemand, 'tall')
  assert.equal(metrics.itemCount, 8)
})

test('six long item names become dense and request a tall card even below eight items', () => {
  const metrics = getKitchenCardContentMetrics([
    item('[TESTE] Combo Individual Família'),
    item('[TESTE] Sanduíche de Frango Especial'),
    item('[TESTE] Porção de Arroz Temperado Grande'),
    item('[TESTE] Calabresa Acebolada Especial G'),
    item('[TESTE] Marmita Frango Completa Família'),
    item('[TESTE] Mandioca Frita Crocante Grande'),
  ])

  assert.equal(metrics.density, 'dense')
  assert.equal(metrics.layoutDemand, 'tall')
  assert.ok(metrics.visualLines >= 10)
})

test('production notes contribute to visual demand and can promote a card to tall', () => {
  const metrics = getKitchenCardContentMetrics([
    item('X-Bacon', 'Retirar cebola e deixar o molho completamente separado'),
    item('X-Salada', 'Sem tomate e sem milho, adicionar bastante alface'),
    item('Marmita', 'Arroz sem alho e feijão em embalagem separada por favor'),
    item('Tilápia', 'Fritar bem passada e enviar o limão em pote separado'),
  ])

  assert.equal(metrics.density, 'dense')
  assert.equal(metrics.layoutDemand, 'tall')
  assert.ok(metrics.visualLines >= 10)
})

test('shared item formatting normalizes whitespace and does not duplicate an existing size suffix', () => {
  assert.equal(formatKitchenDisplayItemName(item('  Marmita  ', '', ' G ')), 'Marmita G')
  assert.equal(formatKitchenDisplayItemName(item('Pizza Grande', '', 'Grande')), 'Pizza Grande')
  assert.equal(normalizeKitchenItemNote(item('X', '  sem   cebola  ')), 'sem cebola')
})
