import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8')

test('C10 isolates App browser storage behind explicit infrastructure adapters', () => {
  const app = read('src/App.jsx')
  assert.doesNotMatch(app, /\b(?:window|globalThis)\.(?:localStorage|sessionStorage)\b/)
  assert.match(app, /kitchenSoundPreference/)
  assert.match(app, /getSessionStorage/)
  assert.equal(existsSync(new URL('./kitchenSoundPreference.js', import.meta.url)), true)
  assert.equal(existsSync(new URL('./sessionStorage.js', import.meta.url)), true)
})

test('C10 keeps the kitchen sound key and session storage boundary explicit', () => {
  const kitchen = read('src/infrastructure/storage/kitchenSoundPreference.js')
  const session = read('src/infrastructure/storage/sessionStorage.js')
  const policyBoundary = read('src/app/surfaces/settings/SettingsPolicyBoundary.jsx')

  assert.match(kitchen, /kitchen-sound-enabled/)
  assert.match(kitchen, /getItem/)
  assert.match(kitchen, /setItem/)
  assert.match(session, /sessionStorage/)
  assert.match(policyBoundary, /storage/)
})
