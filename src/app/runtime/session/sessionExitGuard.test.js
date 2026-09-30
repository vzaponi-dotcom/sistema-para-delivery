import test from 'node:test'
import assert from 'node:assert/strict'
import { decideSessionExit } from './sessionExitGuard.js'

test('session exit waits for accepted payment and uncertain print before considering dirty draft', () => {
  for (const state of [{ checkoutPending: true }, { paymentPending: true }, { printPending: true }, { printPending: true, dirtyOrder: true }]) assert.equal(decideSessionExit(state), 'blocked')
  assert.equal(decideSessionExit({ dirtyOrder: true }), 'confirm-order')
  assert.equal(decideSessionExit({ policyDraft: { dirty: true } }), 'confirm-policy')
  assert.equal(decideSessionExit({}), 'exit')
})
