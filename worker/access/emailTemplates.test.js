import test from 'node:test'
import assert from 'node:assert/strict'
import { buildChallengeEmail } from './emailTemplates.js'

const input = {purpose:'activation',displayName:'Person',businessName:'Synthetic operation',expiresAt:'2026-10-03T12:00:00.000Z',link:`https://staging.mesiva.com.br/ativar-conta#token=${'t'.repeat(43)}`,isStaging:true}

test('activation email escapes account and operation data and includes branded HTML and text', () => {
  const result = buildChallengeEmail({...input,displayName:'<script>attack</script>',businessName:'A & B <img src=x>'})
  assert.ok(!result.html.includes('<script>'))
  assert.ok(!result.html.includes('<img src=x>'))
  assert.ok(result.html.includes('&lt;script&gt;attack&lt;/script&gt;'))
  assert.ok(result.html.includes('A &amp; B &lt;img src=x&gt;'))
  assert.ok(result.html.includes(input.link))
  assert.match(result.html,/Mesiva/)
  assert.match(result.text,/24 horas/)
  assert.match(result.text,/Ambiente de testes/)
  assert.match(result.subject,/Ambiente de testes/)
  assert.ok(result.text.includes(input.link))
})

test('recovery email explains expiry and that requesting recovery does not invalidate the current password', () => {
  const result = buildChallengeEmail({...input,purpose:'password_reset',link:input.link.replace('/ativar-conta','/redefinir-senha'),isStaging:false})
  assert.match(result.text,/30 minutos/)
  assert.match(result.text,/senha atual continua funcionando/)
  assert.match(result.html,/Redefinir minha senha/)
  assert.ok(!result.subject.includes('Ambiente de testes'))
})

test('templates reject foreign-purpose links, non-HTTPS links and malformed expiration', () => {
  for (const patch of [{purpose:'login'},{link:'javascript:alert(1)'},{link:input.link.replace('/ativar-conta','/redefinir-senha')},{expiresAt:'invalid'}]) {
    assert.throws(() => buildChallengeEmail({...input,...patch}),{code:'INVALID_EMAIL_INPUT'})
  }
})
