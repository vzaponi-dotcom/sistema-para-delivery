import test from 'node:test'
import assert from 'node:assert/strict'
import { projectCatalogList } from './catalogList.js'

const products = [
  { id: 'a', name: 'Suco', category: 'Bebidas', price: 7.5, presentationType: 'volume', presentationValue: '350', presentationUnit: 'ml' },
  { id: 'b', name: 'Item antigo', category: 'Antiga', price: 8, size: 'Família' },
  { id: 'c', name: 'Água', category: 'Bebidas', price: 0, presentationType: 'unit' },
  { id: 'd', name: 'Pudim', category: 'Sobremesas', price: 9, presentationType: 'unit' },
]

test('admin search keeps price matching, category fallback and original order', () => {
  const result = projectCatalogList(products, { search: '  7.5 ', categoryFilter: 'Todos' })
  assert.equal(result.normalizedSearch, '7.5')
  assert.deepEqual(result.visibleProducts.map((product) => product.id), ['a'])
  assert.equal(projectCatalogList(products, { search: '7,50' }).visibleProducts.length, 0)

  const all = projectCatalogList(products)
  assert.deepEqual(all.groupedProducts.map((group) => [group.category, group.products.map((product) => product.id)]), [
    ['Bebidas', ['a', 'c']],
    ['Outros', ['b']],
    ['Sobremesas', ['d']],
  ])
  assert.strictEqual(all.visibleProducts[0], products[0])
  assert.deepEqual(products.map((product) => product.id), ['a', 'b', 'c', 'd'])
})

test('admin search preserves pt-BR lowercase semantics across name category and presentation', () => {
  assert.deepEqual(projectCatalogList(products, { search: '  SUCO ' }).visibleProducts.map((product) => product.id), ['a'])
  assert.deepEqual(projectCatalogList(products, { search: 'bebidas' }).visibleProducts.map((product) => product.id), ['a', 'c'])
  assert.deepEqual(projectCatalogList(products, { search: '350 ML' }).visibleProducts.map((product) => product.id), ['a'])
  assert.deepEqual(projectCatalogList(products, { search: 'família' }).visibleProducts.map((product) => product.id), ['b'])
  assert.deepEqual(projectCatalogList(products, { search: '0' }).visibleProducts.map((product) => product.id), ['a', 'c'])
})

test('admin category filter combines with search and legacy categories fall back to Outros', () => {
  assert.deepEqual(projectCatalogList(products, { categoryFilter: 'Bebidas' }).visibleProducts.map((product) => product.id), ['a', 'c'])
  assert.deepEqual(projectCatalogList(products, { categoryFilter: 'Outros' }).visibleProducts.map((product) => product.id), ['b'])
  assert.deepEqual(projectCatalogList(products, { search: 'suco', categoryFilter: 'Sobremesas' }).visibleProducts, [])
})

test('admin projection handles an empty collection without mutating inputs', () => {
  const input = []
  assert.deepEqual(projectCatalogList(input, { search: 'qualquer', categoryFilter: 'Todos' }), {
    normalizedSearch: 'qualquer',
    visibleProducts: [],
    groupedProducts: [],
  })
  assert.deepEqual(input, [])
})
