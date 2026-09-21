import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const api = fs.readFileSync(new URL('./app/workflows/payments/paymentApi.js', import.meta.url), 'utf8')

test('frontend exposes the consolidated table tab payment API helper', () => {
  assert.match(api, /registerTableTabPayment: \(id, allocations\)/)
  assert.match(api, /\/api\/table-tabs\/\$\{encodeURIComponent\(id\)\}\/payment/)
  assert.match(api, /json\('POST', \{ allocations \}\)/)
})

test('legacy API no longer owns C5 table management or transfer commands', () => {
  for (const name of ['createTable', 'updateTable', 'reorderTables', 'transferTableTab', 'getTableTabDetail']) {
    assert.doesNotMatch(api, new RegExp(`export const ${name}\\b`))
  }
})
