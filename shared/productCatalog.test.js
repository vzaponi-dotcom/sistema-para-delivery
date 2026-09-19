import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PRODUCT_CATEGORIES,
  deriveLegacySize,
  formatProductPresentation,
  validateProductPresentation,
} from './productCatalog.js'

test('cross-runtime product catalog keeps the approved category contract', () => {
  assert.deepEqual(PRODUCT_CATEGORIES, [
    'Refeições', 'Lanches', 'Combos', 'Porções', 'Bebidas',
    'Sobremesas', 'Adicionais', 'Molhos', 'Outros',
  ])
})

test('volume and weight normalize comma and format pt-BR', () => {
  assert.deepEqual(validateProductPresentation({
    presentationType: 'volume', presentationValue: '1,5', presentationUnit: 'L',
  }), {
    ok: true,
    value: { presentationType: 'volume', presentationValue: '1.5', presentationUnit: 'L', size: '1,5 L' },
  })
  assert.equal(formatProductPresentation({ presentationType: 'weight', presentationValue: '0.5', presentationUnit: 'kg' }), '0,5 kg')
  assert.equal(deriveLegacySize({ presentationType: 'unit', presentationValue: '', presentationUnit: '' }), 'Un')
})

test('invalid presentation values are rejected', () => {
  assert.equal(validateProductPresentation({ presentationType: 'volume', presentationValue: '0', presentationUnit: 'ml' }).ok, false)
  assert.equal(validateProductPresentation({ presentationType: 'size', presentationValue: 'x'.repeat(25), presentationUnit: '' }).ok, false)
})
