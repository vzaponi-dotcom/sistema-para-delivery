import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

test('legacy C6 finance API exports and utility owners are absent', async () => {
  const source = await readFile(new URL('./client.js', import.meta.url), 'utf8')
  for (const name of [
    'registerPayment',
    'registerTableTabPayment',
    'refundOrder',
    'createMovement',
    'updateMovement',
    'deleteMovement',
    'saveFinanceSettings',
    'updateOrderPaymentPromise',
  ]) {
    assert.doesNotMatch(source, new RegExp(`export\\s+const\\s+${name}\\b`), name)
  }

  for (const path of [
    './utils/paymentMethodOptions.js',
    './utils/financeCategoryOptions.js',
    './utils/finance.js',
    './utils/receivables.js',
    './utils/paymentWorkflow.js',
  ]) {
    await assert.rejects(access(new URL(path, import.meta.url)), /ENOENT/)
  }
})
