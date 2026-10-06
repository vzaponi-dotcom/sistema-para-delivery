import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlatformApi } from './platformApi.js'
test('platform requests preserve search, cursor, encoded identity and creation idempotency', async () => {
  const calls = [], api = createPlatformApi({ request: async (...args) => { calls.push(args); return {} } })
  await api.listBusinesses({ query: 'Cozinha A', cursor: 'cursor-A' })
  await api.getBusiness('company/A')
  await api.createBusiness({ name: 'A', managerName: 'Ana', managerEmail: 'ana@example.test' }, 'attempt-A')
  await api.resendFirstManagerInvitation('company/A')
  assert.match(calls[0][0], /query=Cozinha\+A&cursor=cursor-A/)
  assert.equal(calls[1][0], '/api/platform/businesses/company%2FA')
  assert.equal(new Headers(calls[2][1].headers).get('Idempotency-Key'), 'attempt-A')
  assert.deepEqual(JSON.parse(calls[2][1].body), { name: 'A', managerName: 'Ana', managerEmail: 'ana@example.test' })
  assert.equal(calls[3][0], '/api/platform/businesses/company%2FA/first-manager-invitation/resend')
})

test('management API encodes every resource and reconciliation only performs GET',async()=>{
  const calls=[],api=createPlatformApi({request:async(...args)=>{calls.push(args);return {}}})
  await api.manageBusiness({businessId:'company/A',operation:'membership.revoke',userId:'member/B'},{reason:'Saída da equipe',expectedRevision:3},'key')
  await api.getManagementAttempt('company/A','attempt/C')
  assert.equal(calls[0][0],'/api/platform/businesses/company%2FA/memberships/member%2FB/revoke')
  assert.equal(calls[0][1].method,'POST')
  assert.equal(new Headers(calls[0][1].headers).get('Idempotency-Key'),'key')
  assert.equal(calls[1][0],'/api/platform/businesses/company%2FA/management-attempts/attempt%2FC')
  assert.equal(calls[1][1]?.method,undefined)
})
