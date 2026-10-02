import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAccessEmail } from './accessEmail.js'

test('normalizes an email without collapsing plus aliases or dots', () => {
  assert.equal(normalizeAccessEmail('  Pessoa+Equipe@MESIVA.COM.BR '), 'pessoa+equipe@mesiva.com.br')
  assert.equal(normalizeAccessEmail('pessoa.equipe@mesiva.com.br'), 'pessoa.equipe@mesiva.com.br')
  assert.equal(normalizeAccessEmail("o'hara@sub.example.test"), "o'hara@sub.example.test")
})

for (const input of [null, undefined, 123, '', '   ', 'a@mesiva.com.br,b@mesiva.com.br',
  'Victor <a@mesiva.com.br>', 'a b@mesiva.com.br', 'a@mesiva.com.br\n', 'a\t@mesiva.com.br',
  'á@mesiva.com.br', 'a@mé siva.com.br', '@mesiva.com.br', 'a@', '.a@mesiva.com.br',
  'a.@mesiva.com.br', 'a..b@mesiva.com.br', '"a"@mesiva.com.br', 'a@-mesiva.com.br',
  'a@mesiva..com.br', 'a@localhost', 'a@mesiva.123', `${'a'.repeat(65)}@mesiva.com.br`,
  `a@${'a'.repeat(64)}.com.br`, `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(62)}`]) {
  test(`rejects invalid email ${JSON.stringify(input)}`, () => {
    assert.throws(() => normalizeAccessEmail(input), { code: 'INVALID_EMAIL' })
  })
}

test('accepts a valid address at the total length boundary', () => {
  const email = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`
  assert.equal(email.length, 254)
  assert.equal(normalizeAccessEmail(email), email)
})
