import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const appSource = () => readFile(new URL('./App.jsx', import.meta.url), 'utf8')
const financeSource = () => readFile(new URL('./pages/Finance.jsx', import.meta.url), 'utf8')

test('App owns finance settings and merges authoritative finance write effects immediately', async () => {
  const app = await appSource()
  assert.match(app, /const DATA_COLLECTIONS = \[[^\]]*'financeSettings'/s)
  assert.match(app, /const \[financeSettings, setFinanceSettings\] = useState\(null\)/)
  assert.match(app, /data\?\.financeSettings \?\? null/)
  assert.match(app, /deletedMovementId/)
  assert.match(app, /removeById\(current, deletedMovementId\)/)
  assert.match(app, /setFinanceSettings\(financeSettings\)/)
  assert.match(app, /guard\.canApply\(token, 'movements'\)\) setMovements\(Array\.isArray\(data\?\.movements\) \? data\.movements : \[\]\)/)
})

test('App owns persisted finance writes while Finance owns reviewed dialog state', async () => {
  const [app, finance] = await Promise.all([appSource(), financeSource()])
  assert.doesNotMatch(app, /showMovementModal/)
  assert.doesNotMatch(app, /newMovement/)
  assert.doesNotMatch(app, /movementReview/)
  assert.doesNotMatch(app, /const \[movementDialogOpen, setMovementDialogOpen\]/)
  assert.doesNotMatch(app, /const \[editingMovement, setEditingMovement\]/)
  assert.doesNotMatch(app, /const \[openingBalanceDialogOpen, setOpeningBalanceDialogOpen\]/)
  assert.match(app, /handleCreateMovement/)
  assert.match(app, /handleUpdateMovement/)
  assert.match(app, /handleDeleteMovement/)
  assert.match(app, /handleSaveFinanceSettings/)
  assert.match(finance, /MovementDialog/)
  assert.match(finance, /OpeningBalanceDialog/)
})
