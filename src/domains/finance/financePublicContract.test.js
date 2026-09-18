import test from 'node:test'
import assert from 'node:assert/strict'

test('Finance exposes payment and finance-category public contracts', async () => {
  const finance = await import('./index.js')

  for (const name of [
    'paymentOptionsFromEffective',
    'paymentDefaultFromEffective',
    'paymentSelectionNeedsReview',
    'paymentOptionsWithSelection',
    'financeCategoryOptionsFromEffective',
    'financeCategoryRevisionFromEffective',
    'financeCategorySelectionNeedsReview',
    'financeCategoryOptionsWithSelection',
    'paymentMethodsPolicy',
    'financeCategoriesPolicy',
  ]) {
    assert.equal(
      typeof finance[name] === 'function' || typeof finance[name] === 'object',
      true,
      name,
    )
  }
})
