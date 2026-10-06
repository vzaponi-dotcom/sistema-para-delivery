import test from 'node:test'
import assert from 'node:assert/strict'
import { createManagementFixture } from '../test-support/companyManagementDb.js'
import { prepareEligibleManagerAssertion } from './membershipEligibility.js'
import { commitIdentityStatements } from '../identity/transactions.js'

test('custom role with actual manage grant qualifies and last excluded manager does not', async t => {
  const f=await createManagementFixture(t)
  await assert.rejects(commitIdentityStatements(f.db,[await prepareEligibleManagerAssertion(f.db,f.businesses.A,{excludingUserId:f.members.aliceA})]))
  f.sqlite.prepare("INSERT INTO role_capabilities(business_id,role_id,capability) VALUES(?,?,'access.users.manage')").run(f.businesses.A,`${f.businesses.A}:operator`)
  await commitIdentityStatements(f.db,[await prepareEligibleManagerAssertion(f.db,f.businesses.A,{excludingUserId:f.members.aliceA})])
})
