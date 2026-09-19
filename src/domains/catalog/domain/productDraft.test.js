import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createProductDraft,
  productPayloadFromDraft,
  productToDraft,
} from './productDraft.js'

test('product draft preserves the current new-product seed and exact payload semantics', () => {
  assert.deepEqual(createProductDraft(), {
    category: 'Refeições',
    presentationType: 'size',
    presentationValue: 'P',
    presentationUnit: '',
    name: '',
    price: 'R$ 32,00',
  })

  assert.deepEqual(productPayloadFromDraft({
    category: 'Bebidas',
    presentationType: 'volume',
    presentationValue: '1,5',
    presentationUnit: 'L',
    name: '  Suco  ',
    price: 'R$ 12,50',
  }), {
    category: 'Bebidas',
    presentationType: 'volume',
    presentationValue: '1,5',
    presentationUnit: 'L',
    name: 'Suco',
    price: 12.5,
  })
})

test('productToDraft preserves structured fields and legacy size fallbacks', () => {
  const cases = [
    [{ id: 'empty', category: 'Refeições', name: 'A', price: 1, size: '' }, ['unit', '', '']],
    [{ id: 'un', category: 'Refeições', name: 'A', price: 1, size: 'Un' }, ['unit', '', '']],
    [{ id: 'unidade', category: 'Refeições', name: 'A', price: 1, size: 'Unidade' }, ['unit', '', '']],
    [{ id: 'p', category: 'Refeições', name: 'A', price: 1, size: 'P' }, ['size', 'P', '']],
    [{ id: 'family', category: 'Refeições', name: 'A', price: 1, size: 'Família' }, ['size', 'Família', '']],
  ]

  for (const [product, expected] of cases) {
    const draft = productToDraft(product)
    assert.deepEqual([draft.presentationType, draft.presentationValue, draft.presentationUnit], expected)
    assert.equal(draft.price, 'R$ 1,00')
  }
})

test('productToDraft uses frontend category fallback and preserves nullish structured values exactly', () => {
  assert.deepEqual(productToDraft({
    id: 'structured',
    category: 'Categoria antiga',
    name: 'Suco',
    price: 12.5,
    size: 'legacy-size-must-not-win',
    presentationType: 'volume',
    presentationValue: '',
    presentationUnit: 'L',
  }), {
    category: 'Outros',
    presentationType: 'volume',
    presentationValue: '',
    presentationUnit: 'L',
    name: 'Suco',
    price: 'R$ 12,50',
  })
})
