import test from 'node:test'
import assert from 'node:assert/strict'
import { requireBusinessContext, requirePlatformContext } from './businessContext.js'

test('company context requires the authoritative marker before exposing any domain', () => {
  const context = { scope: 'business', contextId: 'trusted', businessId: 'A', userId: 'u', sessionId: 's' }
  for (const value of [null, 'old']) {
    const request = new Request('https://example.test/api/orders', { headers: value ? { 'X-Mesiva-Context': value } : {} })
    assert.throws(() => requireBusinessContext(request, context), { status: 409, code: 'SESSION_CONTEXT_CHANGED' })
  }
  const request = new Request('https://example.test/api/orders', { headers: { 'X-Mesiva-Context': 'trusted' } })
  assert.equal(requireBusinessContext(request, context), context)
  assert.throws(() => requireBusinessContext(request, { ...context, scope: 'platform' }), { status: 403 })
  assert.throws(() => requireBusinessContext(request, null), { status: 401 })
})

test('platform authorization uses explicit administrative grants and never a company manager role', () => {
  const request = new Request('https://example.test/api/platform/businesses', { headers: { 'X-Mesiva-Context': 'trusted' } })
  const context = { scope: 'platform', contextId: 'trusted', platformGranted: new Set(['platform.businesses.view']) }
  assert.equal(requirePlatformContext(request, context, 'platform.businesses.view'), context)
  assert.throws(() => requirePlatformContext(request, context, 'platform.businesses.create'), { status: 403 })
  assert.throws(() => requirePlatformContext(request, { ...context, scope: 'business', granted: new Set(['access.users.manage']) }, 'platform.businesses.view'), { status: 403 })
})
