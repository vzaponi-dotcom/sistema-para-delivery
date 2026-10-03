import test from 'node:test'
import assert from 'node:assert/strict'
import { createCompaniesApi } from './companiesApi.js'

test('company API captures its marker; public inspection and existing acceptance never send a password', async () => {
  const calls = []
  const api = createCompaniesApi({ request: async (path, options = {}) => { calls.push([path, options]); return {} } })
  await api.listBusinesses()
  await api.inspectInvitation({ token: 'fixture' })
  await api.acceptInvitation({ token: 'fixture' }, { contextId: 'A' })
  await api.selectBusiness('company-B')
  assert.equal(calls[0][0], '/api/auth/businesses')
  assert.equal(calls[1][0], '/api/auth/company-invitations/inspect')
  assert.deepEqual(JSON.parse(calls[2][1].body), { token: 'fixture' })
  assert.equal(new Headers(calls[2][1].headers).get('X-Mesiva-Context'), 'A')
  assert.deepEqual(JSON.parse(calls[3][1].body), { businessId: 'company-B' })
})
