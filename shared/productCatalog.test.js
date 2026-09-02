import test from 'node:test'
import assert from 'node:assert/strict'
import {
  categoryForUi,
  formatProductPresentation,
  suggestPresentationType,
  validateProductPresentation,
} from './productCatalog.js'

test('categories use approved fallback and default presentation', () => {
  assert.equal(categoryForUi('Bebidas'), 'Bebidas')
  assert.equal(categoryForUi('Categoria antiga'), 'Outros')
  assert.equal(suggestPresentationType('Bebidas'), 'volume')
  assert.equal(suggestPresentationType('Refeições'), 'size')
})

test('volume and weight normalize comma and format pt-BR', () => {
  assert.deepEqual(validateProductPresentation({
    presentationType: 'volume', presentationValue: '1,5', presentationUnit: 'L',
  }), {
    ok: true,
    value: { presentationType: 'volume', presentationValue: '1.5', presentationUnit: 'L', size: '1,5 L' },
  })
  assert.equal(formatProductPresentation({ presentationType: 'weight', presentationValue: '0.5', presentationUnit: 'kg' }), '0,5 kg')
})

test('invalid presentation values are rejected', () => {
  assert.equal(validateProductPresentation({ presentationType: 'volume', presentationValue: '0', presentationUnit: 'ml' }).ok, false)
  assert.equal(validateProductPresentation({ presentationType: 'size', presentationValue: 'x'.repeat(25), presentationUnit: '' }).ok, false)
})
