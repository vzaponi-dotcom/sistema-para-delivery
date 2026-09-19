import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8')

test('App no longer owns Table Service implementation details', () => {
  const forbidden = [
    'comandaSelectionRef',
    'comandaIdentityRef',
    'const resolveOpenComanda =',
    'onTablesCommitted',
    'handleCreateTable',
    'handleRenameTable',
    'handleSetTableActive',
    'handleReorderTables',
    'handleTransferTableTab',
    'createTableApi',
    'updateTableApi',
    'reorderTablesApi',
    'transferTableTabApi',
    'getTableTabDetail',
  ]
  for (const token of forbidden) assert.equal(source.includes(token), false, token)
})

test('App no longer owns deferred table-tab payment implementation', () => {
  for (const token of [
    'handleRegisterTableTabPayment',
    'settleAcceptedPayment',
    'reconcileTableTabPayment',
    'registerTableTabPaymentApi',
    'paymentSyncRef',
    'tableTabPaymentRef',
  ]) {
    assert.equal(source.includes(token), false, token)
  }
  assert.equal(source.includes('useTableTabPaymentWorkflow'), true)
})
