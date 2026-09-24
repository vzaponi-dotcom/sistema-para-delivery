import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getKitchenDisplayCompatibilityIssues,
  installKitchenDisplayLegacyCompat,
  objectFromEntriesCompat,
} from './kitchenDisplayLegacyCompat.js'

test('legacy Object.fromEntries fallback preserves key/value pairs', () => {
  assert.deepEqual(objectFromEntriesCompat([['one', 1], ['two', 2]]), { one: 1, two: 2 })
})

test('legacy compatibility installs globalThis and Object.fromEntries before the KDS bundle loads', () => {
  function FakeObject() {}
  const root = {
    Object: FakeObject,
    Promise,
    Map,
    Set,
    Intl,
    fetch() {},
  }

  installKitchenDisplayLegacyCompat(root)

  assert.equal(root.globalThis, root)
  assert.equal(typeof root.Object.fromEntries, 'function')
  assert.deepEqual(getKitchenDisplayCompatibilityIssues(root), [])
})
