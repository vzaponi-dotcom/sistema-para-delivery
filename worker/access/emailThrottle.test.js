import test from 'node:test'
import assert from 'node:assert/strict'
import { emailAccessFixture, independentEmailClients, EMAIL_BUSINESS as businessId, EMAIL_NOW as now } from '../test-support/emailAccess.js'
import { reserveRecoveryRequest, reserveEmailDelivery } from './emailThrottle.js'

test('recovery counts unknown addresses and blocks the fourth request until 30 minutes elapse', async t => {
  const {db,sqlite} = await emailAccessFixture(t)
  const input = {businessId,email:'missing@example.test',originKey:'synthetic-origin',now}
  for (let i=0;i<3;i++) assert.equal((await reserveRecoveryRequest(db,input)).allowed,true)
  assert.equal((await reserveRecoveryRequest(db,input)).allowed,false)
  assert.equal((await reserveRecoveryRequest(db,{...input,now:new Date('2026-10-02T12:30:00.000Z')})).allowed,true)
  const stored = JSON.stringify(sqlite.prepare('SELECT * FROM auth_email_requests').all())
  assert.ok(!stored.includes(input.email)); assert.ok(!stored.includes(input.originKey))
})

test('recovery limits one origin to ten requests even for different email addresses', async t => {
  const {db} = await emailAccessFixture(t)
  for (let i=0;i<10;i++) assert.equal((await reserveRecoveryRequest(db,{businessId,email:`missing${i}@example.test`,originKey:'same',now})).allowed,true)
  assert.equal((await reserveRecoveryRequest(db,{businessId,email:'eleventh@example.test',originKey:'same',now})).allowed,false)
  assert.equal((await reserveRecoveryRequest(db,{businessId,email:'eleventh@example.test',originKey:'same',now:new Date('2026-10-02T12:15:00.000Z')})).allowed,true)
})

test('delivery cooldown prevents a new invitation before sixty seconds', async t => {
  const {db} = await emailAccessFixture(t)
  const input = {businessId,userId:'u1',now,challengeId:'first'}
  assert.equal((await reserveEmailDelivery(db,input)).allowed,true)
  assert.equal((await reserveEmailDelivery(db,{...input,challengeId:'second'})).allowed,false)
  assert.equal((await reserveEmailDelivery(db,{...input,challengeId:'third',now:new Date('2026-10-02T12:01:00.000Z')})).allowed,true)
})

test('budget blocks attempt eighty-one and resets at UTC midnight', async t => {
  const {db,sqlite} = await emailAccessFixture(t)
  const {first,second} = independentEmailClients(t,sqlite)
  const input = {businessId,userId:'u1',now,cooldownSeconds:0}
  const allowed = await Promise.all(Array.from({length:90},(_,i) => reserveEmailDelivery(i%2 ? first : second,{...input,challengeId:`delivery-${i}`})))
  assert.equal(allowed.filter(result => result.allowed).length,80)
  assert.equal((await reserveEmailDelivery(first,{...input,challengeId:'next-day',now:new Date('2026-10-03T00:00:00.000Z')})).allowed,true)
  assert.equal((await reserveEmailDelivery(db,{...input,challengeId:'separate-db'})).allowed,true)
})

test('independent database adapters share reservations and reject invalid limits', async t => {
  const {db,sqlite} = await emailAccessFixture(t)
  const {one,first,second} = independentEmailClients(t,sqlite)
  const input = {businessId,email:'shared@example.test',originKey:'same',now}
  const results = await Promise.all(Array.from({length:8},(_,i) => reserveRecoveryRequest(i%2 ? first : second,input)))
  assert.equal(results.filter(result => result.allowed).length,3)
  assert.equal(one.prepare('SELECT count(*) AS n FROM auth_email_requests').get().n,3)
  await assert.rejects(reserveEmailDelivery(db,{businessId,userId:'u1',challengeId:'invalid',now,dailyLimit:NaN}),{code:'EMAIL_CONFIG_UNAVAILABLE'})
})
