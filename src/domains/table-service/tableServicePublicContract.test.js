import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getTransferDestinations,
  reconcileComandaSelection,
  resolveOpenComanda,
} from './index.js'

test('table-service public contract exposes canonical identity and transfer rules', () => {
  assert.equal(typeof resolveOpenComanda, 'function')
  assert.equal(typeof reconcileComandaSelection, 'function')
  assert.equal(typeof getTransferDestinations, 'function')
})
