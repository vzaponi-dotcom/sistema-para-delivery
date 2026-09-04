import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const appSource = () => readFile(new URL('./App.jsx', import.meta.url), 'utf8')

test('App owns finance settings and merges authoritative finance write effects immediately', async () => {
  const app = await appSource()
  assert.match(app, /const DATA_COLLECTIONS = \[[^\]]*'financeSettings'/s)
  assert.match(app, /const \[financeSettings, setFinanceSettings\] = useState\(null\)/)
  assert.match(app, /data\?\.financeSettings \?\? null/)
  assert.match(app, /deletedMovementId/)
  assert.match(app, /removeById\(current, deletedMovementId\)/)
  assert.match(app, /setFinanceSettings\(financeSettings\)/)
  assert.match(app, /setMovements\(Array\.isArray\(data\?\.movements\) \? data\.movements : \[\]\)/)
})

test('legacy movement modal state is removed from App in favor of reviewed finance dialogs', async () => {
  const app = await appSource()
  assert.doesNotMatch(app, /showMovementModal/)
  assert.doesNotMatch(app, /newMovement/)
  assert.doesNotMatch(app, /movementReview/)
  assert.match(app, /MovementDialog/)
  assert.match(app, /OpeningBalanceDialog/)
})
