import test from 'node:test'
import assert from 'node:assert/strict'
import { PRODUCT_CATEGORIES } from '../../../../shared/productCatalog.js'

const expected = [
  ['Refeições', 'meal', 'size'],
  ['Lanches', 'snack', 'size'],
  ['Combos', 'combo', 'unit'],
  ['Porções', 'portion', 'size'],
  ['Bebidas', 'drink', 'volume'],
  ['Sobremesas', 'dessert', 'unit'],
  ['Adicionais', 'plus', 'unit'],
  ['Molhos', 'sauce', 'unit'],
  ['Outros', 'package', 'unit'],
]

test('Catalog owns the exact nine category icons, options and presentation suggestions', async () => {
  const { CATEGORY_ICON_NAMES, PRODUCT_CATEGORY_OPTIONS, categoryForUi, suggestPresentationType } = await import('./catalogPresentation.js')
  assert.deepEqual(PRODUCT_CATEGORIES, expected.map(([category]) => category))
  assert.deepEqual(PRODUCT_CATEGORY_OPTIONS, expected.map(([value]) => ({ value, label: value })))
  assert.deepEqual(Object.keys(CATEGORY_ICON_NAMES), PRODUCT_CATEGORIES)
  for (const [category, icon, suggestion] of expected) {
    assert.equal(CATEGORY_ICON_NAMES[category], icon)
    assert.equal(categoryForUi(category), category)
    assert.equal(suggestPresentationType(category), suggestion)
  }
})

test('Catalog preserves exact category matching and the legacy Outros fallback', async () => {
  const { categoryForUi, suggestPresentationType } = await import('./catalogPresentation.js')
  for (const category of [undefined, null, '', 'Marmita', 'bebidas', ' Bebidas ', 'Categoria antiga']) {
    assert.equal(categoryForUi(category), 'Outros')
    assert.equal(suggestPresentationType(category), 'unit')
  }
})
