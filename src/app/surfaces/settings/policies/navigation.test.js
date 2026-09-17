import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveSettingsPolicyNavigationDraft } from './navigation.js'

const resources = {
  operations: { dirty: true, status: 'ready' },
  paymentMethods: { dirty: true, status: 'ready' },
  cancellationReasons: { dirty: false, status: 'ready' },
  financeCategories: { dirty: true, status: 'saving' },
  printingPolicy: { dirty: true, status: 'ready', scopeId: 'station-1' },
}

test('operations and modalities resolve the shared operations policy draft', () => {
  const operations = resolveSettingsPolicyNavigationDraft(resources, 'settings-operations')
  const modalities = resolveSettingsPolicyNavigationDraft(resources, 'settings-modalities')

  assert.deepEqual(operations, {
    resourceKey: 'operations', resource: 'operations', scopeId: undefined,
    dirty: true, status: 'ready', destinations: new Set(['settings-operations', 'settings-modalities']),
  })
  assert.deepEqual(modalities, operations)
})

test('resolves each versioned settings policy and preserves its scope', () => {
  assert.equal(resolveSettingsPolicyNavigationDraft(resources, 'settings-payments').resourceKey, 'paymentMethods')
  assert.equal(resolveSettingsPolicyNavigationDraft(resources, 'settings-cancellations').resourceKey, 'cancellationReasons')
  assert.equal(resolveSettingsPolicyNavigationDraft(resources, 'settings-finance-categories').resourceKey, 'financeCategories')
  const printing = resolveSettingsPolicyNavigationDraft(resources, 'settings-printing')
  assert.equal(printing.resourceKey, 'printingPolicy')
  assert.equal(printing.scopeId, 'station-1')
})

test('device and home have no versioned policy draft and unload risk is outside this route map', () => {
  assert.equal(resolveSettingsPolicyNavigationDraft(resources, 'settings-device'), null)
  assert.equal(resolveSettingsPolicyNavigationDraft(resources, 'settings-home'), null)
  assert.equal(resolveSettingsPolicyNavigationDraft(resources, 'orders'), null)
})
