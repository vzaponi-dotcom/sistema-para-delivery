import test from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import { readEmailConfig, deliverEmailChallenge } from './emailDelivery.js'

const env = {AUTH_EMAIL_ENABLED:'true',AUTH_EMAIL_FROM:'Mesiva <acesso@mesiva.com.br>',AUTH_PUBLIC_ORIGIN:'https://staging.mesiva.com.br',RESEND_API_KEY:'re_synthetic_test_key'}
const challenge = {challengeId:'11111111-1111-4111-8111-111111111111',purpose:'activation',token:'t'.repeat(43),email:'person@example.test',expiresAt:'2026-10-03T12:00:00.000Z',displayName:'Person',businessName:'Synthetic operation'}
const providerId = '22222222-2222-4222-8222-222222222222'
const accepted = () => Response.json({id:providerId})

test('configuration rejects missing secrets, unsafe origins and invalid sender without exposing values', () => {
  assert.equal(readEmailConfig(env).dailyLimit,80)
  for (const patch of [{RESEND_API_KEY:''},{AUTH_EMAIL_ENABLED:'false'},{AUTH_PUBLIC_ORIGIN:'http://staging.mesiva.com.br'},
    {AUTH_PUBLIC_ORIGIN:'https://staging.mesiva.com.br/path'},{AUTH_PUBLIC_ORIGIN:'https://staging.mesiva.com.br?token=unsafe'},
    {AUTH_PUBLIC_ORIGIN:'https://user:password@staging.mesiva.com.br'},{AUTH_PUBLIC_ORIGIN:'https://staging.mesiva.com.br#token=unsafe'},
    {AUTH_EMAIL_FROM:'Mesiva <invalid>'},{AUTH_EMAIL_FROM:'Mesiva\nInjected <acesso@mesiva.com.br>'},{AUTH_EMAIL_DAILY_LIMIT:'0'}]) {
    assert.throws(() => readEmailConfig({...env,...patch}), error => error.code==='EMAIL_CONFIG_UNAVAILABLE' && !error.message.includes(env.RESEND_API_KEY))
  }
})

test('delivery uses trusted origin and retries transient rejection with unchanged payload and idempotency key', async () => {
  const calls = []
  const result = await deliverEmailChallenge(env,challenge,{fetchImpl:async(url,options) => {calls.push({url,options});return calls.length===1 ? new Response(null,{status:429}) : accepted()}})
  assert.deepEqual(result,{status:'accepted',providerId})
  assert.equal(calls.length,2)
  assert.equal(calls[0].url,'https://api.resend.com/emails')
  assert.equal(calls[0].options.method,'POST')
  assert.equal(calls[0].options.redirect,'error')
  assert.equal(calls[0].options.headers.Authorization,`Bearer ${env.RESEND_API_KEY}`)
  assert.equal(calls[0].options.headers['Idempotency-Key'],calls[1].options.headers['Idempotency-Key'])
  assert.equal(calls[0].options.body,calls[1].options.body)
  const payload = JSON.parse(calls[0].options.body)
  assert.deepEqual(payload.to,['person@example.test'])
  assert.equal(payload.from,'Mesiva <acesso@mesiva.com.br>')
  assert.ok(payload.html.includes(`https://staging.mesiva.com.br/ativar-conta#token=${challenge.token}`))
  assert.match(payload.subject,/Ambiente de testes/)
  assert.equal(payload.click_tracking,undefined)
})

test('password recovery links use the recovery route and do not disclose the key in the email', async () => {
  let payload
  await deliverEmailChallenge(env,{...challenge,purpose:'password_reset'},{fetchImpl:async(_url,options) => {payload=JSON.parse(options.body);return accepted()}})
  assert.ok(payload.text.includes(`https://staging.mesiva.com.br/redefinir-senha#token=${challenge.token}`))
  assert.ok(!JSON.stringify(payload).includes(env.RESEND_API_KEY))
})

test('definitive provider rejection is not retried or returned verbatim', async () => {
  let calls = 0
  const result = await deliverEmailChallenge(env,challenge,{fetchImpl:async() => {calls++;return Response.json({message:env.RESEND_API_KEY+challenge.token},{status:422})}})
  assert.deepEqual(result,{status:'rejected'})
  assert.equal(calls,1)
})

test('two rate-limit responses stop attempts and return a safe rejection', async () => {
  let calls = 0
  assert.deepEqual(await deliverEmailChallenge(env,challenge,{fetchImpl:async() => {calls++;return new Response(null,{status:429})}}),{status:'rejected'})
  assert.equal(calls,2)
})

test('network uncertainty survives a later rejection because the first request could have been accepted', async () => {
  let calls = 0
  const result = await deliverEmailChallenge(env,challenge,{fetchImpl:async() => {calls++;if(calls===1) throw new Error(env.RESEND_API_KEY+challenge.token);return new Response(null,{status:401})}})
  assert.deepEqual(result,{status:'uncertain'})
  assert.equal(calls,2)
})

test('each stalled request is aborted at five seconds and delivery stops after two attempts', async t => {
  t.mock.timers.enable({apis:['setTimeout']})
  let calls = 0
  const pending = deliverEmailChallenge(env,challenge,{fetchImpl:async(_url,options) => {
    calls++
    return await new Promise((_resolve,reject) => options.signal.addEventListener('abort',() => reject(new Error('aborted')),{once:true}))
  }})
  assert.equal(calls,1)
  t.mock.timers.tick(5000); await setImmediate()
  assert.equal(calls,2)
  t.mock.timers.tick(5000)
  assert.deepEqual(await pending,{status:'uncertain'})
})

test('invalid configuration performs no external request', async () => {
  let calls = 0
  await assert.rejects(deliverEmailChallenge({},challenge,{fetchImpl:async() => {calls++;return accepted()}}),{code:'EMAIL_CONFIG_UNAVAILABLE'})
  assert.equal(calls,0)
})
