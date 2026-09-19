import test from 'node:test'
import assert from 'node:assert/strict'
import {
  financeCategoryOptionsFromEffective,
  financeCategoryOptionsWithSelection,
  financeCategoryRevisionFromEffective,
  financeCategorySelectionNeedsReview,
} from './financeCategories.js'

const config = {
  revisions: { financeCategories: 7 },
  financeCategories: {
    items: [
      { id: 'sales', type: 'entrada', label: 'Vendas', active: true },
      { id: 'refunds', type: 'saida', label: 'Estornos', active: true },
      { id: 'disabled', type: 'saida', label: 'Legado', active: false },
      { id: '', type: 'saida', label: 'Inválida' },
    ],
  },
}

test('finance category projection preserves current effective-config contract', () => {
  assert.deepEqual(financeCategoryOptionsFromEffective(config, 'saida'), [
    { value: 'refunds', id: 'refunds', type: 'saida', label: 'Estornos' },
    { value: 'disabled', id: 'disabled', type: 'saida', label: 'Legado' },
  ])
  assert.equal(financeCategoryRevisionFromEffective(config), 7)
  assert.equal(financeCategoryRevisionFromEffective({}), null)
  assert.deepEqual(financeCategoryOptionsFromEffective(config, 'invalid'), [])
})

test('historical category selection can be surfaced for review without changing its identity', () => {
  const active = financeCategoryOptionsFromEffective(config, 'saida')
    .filter((option) => option.value !== 'disabled')

  assert.equal(financeCategorySelectionNeedsReview(active, 'saida', 'disabled'), true)
  assert.deepEqual(
    financeCategoryOptionsWithSelection(active, 'saida', 'disabled', 'Legado')[0],
    { value: 'disabled', id: 'disabled', type: 'saida', label: 'Legado (inativa)', inactive: true },
  )
})
