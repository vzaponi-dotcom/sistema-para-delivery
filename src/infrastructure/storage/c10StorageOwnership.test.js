import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8')

test('C10 isolates App browser storage behind explicit infrastructure adapters', () => {
  const app = read('src/App.jsx')
  assert.doesNotMatch(app, /localStorage/)
  assert.doesNotMatch(app, /sessionStorage/)
  assert.match(app, /kitchenSoundPreference/)
  assert.match(app, /getSessionStorage/)
  assert.equal(existsSync(new URL('./kitchenSoundPreference.js', import.meta.url)), true)
  assert.equal(existsSync(new URL('./sessionStorage.js', import.meta.url)), true)
})
