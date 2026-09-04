import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = () => readFile(new URL('./index.js', import.meta.url), 'utf8')

test('worker exposes protected manual movement CRUD and finance settings routes', async () => {
  const worker = await source()
  assert.match(worker, /parseManualMovementInput/)
  assert.match(worker, /parseFinanceSettingsInput/)
  assert.match(worker, /createManualMovement/)
  assert.match(worker, /updateManualMovement/)
  assert.match(worker, /softDeleteManualMovement/)
  assert.match(worker, /upsertFinanceSettings/)
  assert.match(worker, /request\.method === 'POST'/)
  assert.match(worker, /request\.method === 'PATCH'/)
  assert.match(worker, /request\.method === 'DELETE'/)
  assert.match(worker, /\/api\/finance-settings/)
  assert.match(worker, /request\.method === 'PUT'/)
  assert.match(worker, /deletedMovementId/)
  assert.match(worker, /MOVEMENT_NOT_FOUND/)
})
