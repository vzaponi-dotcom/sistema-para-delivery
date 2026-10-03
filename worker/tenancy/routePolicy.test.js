import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyApiRoute } from './routePolicy.js'

test('known entry points distinguish public identity, TV device authentication, platform and operational scopes', () => {
  for (const path of ['/api/auth/login', '/api/auth/session', '/api/auth/password-recovery', '/api/auth/company-invitations/accept', '/api/access/me/password']) assert.equal(classifyApiRoute(path.endsWith('/session') ? 'GET' : 'POST', path), 'public-identity')
  for (const [method, path] of [['POST', '/api/kitchen-tv/pairing-request'], ['GET', '/api/kitchen-tv/state'], ['POST', '/api/kitchen-tv/report'], ['GET', '/api/kitchen-tv/pairing-status']]) assert.equal(classifyApiRoute(method, path), 'public-tv')
  assert.equal(classifyApiRoute('POST', '/api/platform/businesses'), 'platform')
  assert.equal(classifyApiRoute('GET', '/api/bootstrap'), 'business')
  assert.equal(classifyApiRoute('PATCH', '/api/kitchen-tv/control/page'), 'business')
  assert.equal(classifyApiRoute('POST', '/api/printing/qz/sign'), 'business')
  assert.equal(classifyApiRoute('POST', '/api/access/invitations/accept'), 'unknown')
  assert.equal(classifyApiRoute('GET', '/api/unknown'), 'unknown')
})
