import assert from 'node:assert/strict'
import test from 'node:test'
import { validatePolicyScope } from './policyHttp.js'

test('generic policy transport keeps scope error contracts', () => {
  assert.throws(() => validatePolicyScope({ scoped: true }), { code: 'SETTINGS_SCOPE_REQUIRED' })
  assert.throws(() => validatePolicyScope({ scoped: false }, 'station-1'), { code: 'SETTINGS_SCOPE_INVALID' })
})
