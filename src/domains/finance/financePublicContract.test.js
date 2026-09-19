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

test('Finance publicly owns its Settings editors', async () => {
  const finance = await import('./index.js')
  assert.equal(typeof finance.PaymentSettings, 'function')
  assert.equal(typeof finance.FinanceCategorySettings, 'function')
})


test('Finance public entry excludes internal-only C6 rules', async () => {
  const finance = await import('./index.js')
  for (const name of [
    'financeCategorySelectionNeedsReview',
    'financeCategoryOptionsWithSelection',
    'calculateCurrentBalance',
    'filterFinanceHistory',
    'filterMovementsByPeriod',
    'getFinancePeriodRange',
    'hasFinanceSecondaryFilters',
    'summarizeFinancePeriod',
    'buildPendingReceivableEntries',
    'buildReceivablesForecast',
    'calculateReceivableSummary',
    'getDaysOverdue',
    'getExpectedPaymentDate',
    'getPaidReceivableOrders',
    'getPendingReceivableOrders',
    'getReceivableTiming',
    'groupPendingOrders',
    'sortReceivableEntries',
  ]) assert.equal(Object.hasOwn(finance, name), false, name)
})
