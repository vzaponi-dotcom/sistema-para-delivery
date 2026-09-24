import test from 'node:test'
import assert from 'node:assert/strict'

import { installKitchenDisplayLegacyCompat } from './kitchenDisplayLegacyCompat.js'

test('legacy compat installs Object.fromEntries only when the browser lacks it', () => {
  const legacyObject = {}
  const scope = { Object: legacyObject }

  const installed = installKitchenDisplayLegacyCompat(scope)

  assert.equal(installed.fromEntries, true)
  assert.equal(installed.globalThis, true)
  assert.equal(scope.globalThis, scope)
  assert.deepEqual(scope.Object.fromEntries([['a', 1], ['b', 2]]), { a: 1, b: 2 })
})

test('legacy compat leaves modern browser implementations untouched', () => {
  const nativeFromEntries = () => 'native'
  const existingGlobal = {}
  const scope = { Object: { fromEntries: nativeFromEntries }, globalThis: existingGlobal }

  const installed = installKitchenDisplayLegacyCompat(scope)

  assert.deepEqual(installed, { globalThis: false, fromEntries: false })
  assert.equal(scope.Object.fromEntries, nativeFromEntries)
  assert.equal(scope.globalThis, existingGlobal)
})
