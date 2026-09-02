import test from 'node:test'
import assert from 'node:assert/strict'
import { mapProductRow } from './repositories.js'

test('product row exposes structured presentation and legacy size', () => {
  assert.deepEqual(mapProductRow({
    id: 'p1',
    category: 'Bebidas',
    size: '350 ml',
    name: 'Coca-Cola',
    price_cents: 600,
    presentation_type: 'volume',
    presentation_value: '350',
    presentation_unit: 'ml',
  }), {
    id: 'p1',
    category: 'Bebidas',
    size: '350 ml',
    name: 'Coca-Cola',
    price: 6,
    presentationType: 'volume',
    presentationValue: '350',
    presentationUnit: 'ml',
  })
})
