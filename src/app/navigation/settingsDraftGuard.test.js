import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getSettingsDraftForDestination,
  shouldConfirmSettingsExit,
  hasSettingsUnloadRisk,
} from './settingsDraftGuard.js'

test('operações e modalidades compartilham o mesmo guard', () => {
  const draft = getSettingsDraftForDestination(
    { operations: { dirty: true, status: 'idle' } },
    'settings-operations',
  )
  assert.equal(draft.resourceKey, 'operations')
  assert.equal(shouldConfirmSettingsExit(draft, 'settings-operations', 'settings-modalities'), false)
  assert.equal(shouldConfirmSettingsExit(draft, 'settings-operations', 'settings-home'), true)
})

test('saving/unconfirmed mantém unload risk sem criar confirmação de navegação', () => {
  for (const status of ['saving', 'unconfirmed']) {
    const resources = { operations: { dirty: true, status } }
    const draft = getSettingsDraftForDestination(resources, 'settings-operations')
    assert.equal(shouldConfirmSettingsExit(draft, 'settings-operations', 'orders'), false)
    assert.equal(hasSettingsUnloadRisk(resources), true)
  }
})

test('guard preserva scopeId usado pelo discard de recursos escopados', () => {
  const draft = getSettingsDraftForDestination(
    { printingPolicy: { dirty: true, status: 'idle', scopeId: 'station-1' } },
    'settings-printing',
  )
  assert.equal(draft.resourceKey, 'printingPolicy')
  assert.equal(draft.scopeId, 'station-1')
})
