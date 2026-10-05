import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(path), 'utf8')

test('client phonebook styling keeps rows compact', () => {
  const css = read('src/clients-phonebook.css')
  assert.match(css, /\.client-phonebook-row/)
  assert.match(css, /\.client-phonebook-main/)
})
