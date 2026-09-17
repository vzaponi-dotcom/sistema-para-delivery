import assert from 'node:assert/strict'
import test from 'node:test'

import { createPolicyNavigationBridge } from './policyNavigationBridge.js'

test('navigation bridge delegates only its narrow contract to the current provider connection', () => {
  const bridge = createPolicyNavigationBridge()
  const first = {
    getNavigationDraft: (destination) => ({ destination, resourceKey: 'operations' }),
    discardNavigationDraft: (resourceKey) => resourceKey === 'operations',
    hasUnloadRisk: () => true,
  }
  const second = {
    getNavigationDraft: () => ({ resourceKey: 'paymentMethods' }),
    discardNavigationDraft: () => false,
    hasUnloadRisk: () => false,
  }

  assert.equal(bridge.getNavigationDraft('settings-operations'), null)
  assert.equal(bridge.discardNavigationDraft('operations'), false)
  assert.equal(bridge.hasUnloadRisk(), false)
  assert.equal(Object.hasOwn(bridge, 'resources'), false)

  bridge.connect(first)
  assert.deepEqual(bridge.getNavigationDraft('settings-operations'), { destination: 'settings-operations', resourceKey: 'operations' })
  assert.equal(bridge.discardNavigationDraft('operations'), true)
  assert.equal(bridge.hasUnloadRisk(), true)

  bridge.connect(second)
  bridge.disconnect(first)
  assert.deepEqual(bridge.getNavigationDraft('settings-payments'), { resourceKey: 'paymentMethods' })
  assert.equal(bridge.hasUnloadRisk(), false)

  bridge.disconnect(second)
  assert.equal(bridge.getNavigationDraft('settings-payments'), null)
  assert.equal(bridge.discardNavigationDraft('paymentMethods'), false)
  assert.equal(bridge.hasUnloadRisk(), false)
})
