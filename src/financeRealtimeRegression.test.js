import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('operational runtime owns finance settings and merges authoritative finance write effects immediately', async () => {
  const [app, runtime] = await Promise.all([
    read('./App.jsx'),
    read('./app/runtime/data/useOperationalDataRuntime.js'),
  ])
  assert.match(app, /financeSettings,/)
  assert.match(app, /applyOfficialEffects/)
  assert.match(runtime, /const DATA_COLLECTIONS = \[[^\]]*'financeSettings'/s)
  assert.match(runtime, /const \[financeSettings, setFinanceSettings\] = useState\(null\)/)
  assert.match(runtime, /data\?\.financeSettings \?\? null/)
  assert.match(runtime, /deletedMovementId/)
  assert.match(runtime, /removeById\(current, deletedMovementId\)/)
  assert.match(runtime, /setFinanceSettings\(nextFinanceSettings\)/)
  assert.match(runtime, /guard\.canApply\(token, 'movements'\)\) setMovements\(Array\.isArray\(data\?\.movements\) \? data\.movements : \[\]\)/)
})

test('legacy movement modal state is removed from App in favor of reviewed finance dialogs', async () => {
  const app = await read('./App.jsx')
  assert.doesNotMatch(app, /showMovementModal/)
  assert.doesNotMatch(app, /newMovement/)
  assert.doesNotMatch(app, /movementReview/)
  assert.match(app, /MovementDialog/)
  assert.match(app, /OpeningBalanceDialog/)
})
