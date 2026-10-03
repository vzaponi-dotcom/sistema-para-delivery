import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from '../test-support/settingsDb.js'
import { checkLoginThrottle, completeLoginAttempt } from './loginThrottle.js'
const now = new Date('2026-09-30T12:00:00.000Z')
const options = { businessId:'amor-e-sabor', normalizedLogin:'person', originKey:'192.0.2.1', now }
test('account reservations throttle concurrent attempts without blocking coworkers or storing raw keys', async (t) => {
  const { db,sqlite,close } = createSettingsDb(); t.after(close)
  const attempts = await Promise.all(Array.from({length:6},()=>checkLoginThrottle(db,options)))
  assert.equal(attempts.filter(a=>a.allowed).length,5)
  assert.equal(attempts.find(a=>!a.allowed).retryAfterSeconds,900)
  assert.equal((await checkLoginThrottle(db,{...options,normalizedLogin:'coworker'})).allowed,true)
  const stored = JSON.stringify(sqlite.prepare('SELECT * FROM login_attempts').all())
  assert.equal(stored.includes('person'),false); assert.equal(stored.includes('192.0.2.1'),false)
  assert.equal((await checkLoginThrottle(db,{...options,now:new Date('2026-09-30T12:15:00.000Z')})).allowed,true)
})
test('origin limit covers many accounts and successful reservations do not consume failure quota', async (t) => {
  const { db,close } = createSettingsDb(); t.after(close)
  for(let i=0;i<30;i++) assert.equal((await checkLoginThrottle(db,{...options,normalizedLogin:`unknown-${i}`})).allowed,true)
  assert.equal((await checkLoginThrottle(db,{...options,normalizedLogin:'new'})).allowed,false)
  const success = await checkLoginThrottle(db,{...options,originKey:'other-origin'})
  await completeLoginAttempt(db, success.attemptId, true)
  for(let i=0;i<5;i++) assert.equal((await checkLoginThrottle(db,{...options,originKey:'other-origin'})).allowed,true)
})
