import test from 'node:test'
import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'

test('legacy C6 finance API exports and utility owners are absent', async () => {
  await assert.rejects(access(new URL('./client.js', import.meta.url)), (error) => error?.code === 'ENOENT')

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
