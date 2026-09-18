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

test('App intentionally retains deferred payment ownership for C6', () => {
  for (const token of [
    'handleRegisterTableTabPayment',
    'settleAcceptedPayment',
    'registerTableTabPaymentApi',
  ]) {
    assert.equal(source.includes(token), true, token)
  }
})
