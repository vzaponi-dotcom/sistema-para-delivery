import test from 'node:test'
import assert from 'node:assert/strict'
import { hasPlatformCapability, sessionHasBusinessAccess } from './companyAccess.js'

test('platform grants are explicit and never confer business access', () => {
  assert.equal(hasPlatformCapability({ scope: 'platform', capabilities: ['platform.businesses.create'] }, 'platform.businesses.create'), true)
  assert.equal(hasPlatformCapability({ scope: 'business', capabilities: ['platform.businesses.create'] }, 'platform.businesses.create'), false)
  assert.equal(hasPlatformCapability({ scope: 'platform', capabilities: ['*'] }, 'platform.businesses.create'), false)
  assert.equal(sessionHasBusinessAccess({ scope: 'platform', businessId: 'A', userId: 'u', contextId: 'ctx' }), false)
  assert.equal(sessionHasBusinessAccess({ scope: 'identity' }), false)
  assert.equal(sessionHasBusinessAccess({ scope: 'business', businessId: 'A', userId: 'u', contextId: 'ctx' }), true)
  assert.equal(sessionHasBusinessAccess({ scope: 'business', businessId: 'A', userId: 'u' }), false)
})
