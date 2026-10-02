import test from 'node:test'
import assert from 'node:assert/strict'
import { deliverIdentityMessage } from './emailMessages.js'

const env = { AUTH_EMAIL_ENABLED: 'true', AUTH_EMAIL_FROM: 'Mesiva <access@example.test>', AUTH_PUBLIC_ORIGIN: 'https://staging.example.test', RESEND_API_KEY: 're_synthetic_test_key' }
for (const [purpose, path] of [['activation', '/ativar-conta'], ['password_reset', '/redefinir-senha'], ['company_invitation', '/aceitar-convite']]) {
  test(`${purpose} mail uses its fragment route, stable retry key and no company fallback or tracking`, async () => {
    const calls = []
    const token = 't'.repeat(43)
    const result = await deliverIdentityMessage(env, { subjectId: '11111111-1111-4111-8111-111111111111', email: 'alice@example.test', token, purpose, displayName: 'Alice', expiresAt: '2026-10-03T12:00:00.000Z', ...(purpose === 'company_invitation' ? { businessName: 'Company A' } : {}) }, { fetchImpl: async (_url, options) => { calls.push(options); return calls.length === 1 ? new Response(null, { status: 429 }) : Response.json({ id: '22222222-2222-4222-8222-222222222222' }) } })
    assert.equal(result.status, 'accepted')
    assert.equal(calls.length, 2)
    assert.equal(calls[0].body, calls[1].body)
    assert.equal(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key'])
    const payload = JSON.parse(calls[0].body)
    assert.ok(payload.text.includes(`https://staging.example.test${path}#token=${token}`))
    assert.equal(payload.click_tracking, undefined)
    assert.equal(payload.open_tracking, undefined)
    assert.equal(payload.text.includes('Amor & Sabor'), false)
    if (purpose !== 'company_invitation') assert.equal(payload.text.includes('Operação:'), false)
  })
}
