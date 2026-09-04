import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readFinance = async () => readFile(new URL('./Finance.jsx', import.meta.url), 'utf8')
const readApp = async () => readFile(new URL('../App.jsx', import.meta.url), 'utf8')

test('finance owns transient movement correction state and only exposes edit/delete for manual rows', async () => {
  const source = await readFinance()
  assert.match(source, /MovementDialog/)
  assert.match(source, /editingMovement/)
  assert.match(source, /deletingMovement/)
  assert.match(source, /movement\.source === 'manual'/)
  assert.match(source, />Editar</)
  assert.match(source, />Excluir</)
  assert.match(source, /onUpdateMovement/)
  assert.match(source, /onDeleteMovement/)
})

test('delete confirmation shows the manual movement identity, date and value before destructive action', async () => {
  const source = await readFinance()
  assert.match(source, /ConfirmationDialog/)
  assert.match(source, /title="Excluir movimentação"/)
  assert.match(source, /deletingMovement\.description/)
  assert.match(source, /deletingMovement\.(movementDate|date)/)
  assert.match(source, /currency\(deletingMovement\.value\)/)
  assert.match(source, /confirmLabel="Excluir movimentação"/)
  assert.match(source, /confirmVariant="danger"/)
})

test('opening balance configuration is owned by Finance and distinguishes first setup from editing', async () => {
  const source = await readFinance()
  assert.match(source, /OpeningBalanceDialog/)
  assert.match(source, /openingDialogOpen/)
  assert.match(source, /Configurar saldo inicial/)
  assert.match(source, /Editar saldo inicial/)
  assert.match(source, /financeSettings/)
  assert.match(source, /currentBalance/)
  assert.match(source, /onSaveFinanceSettings/)
})

test('App owns persisted finance data and callbacks, not transient dialog state', async () => {
  const source = await readApp()
  assert.doesNotMatch(source, /movementDialogOpen|editingMovement|openingBalanceDialogOpen/)
  assert.doesNotMatch(source, /<MovementDialog|<OpeningBalanceDialog/)
  assert.match(source, /onCreateMovement=\{handleCreateMovement\}/)
  assert.match(source, /onUpdateMovement=\{handleUpdateMovement\}/)
  assert.match(source, /onDeleteMovement=\{handleDeleteMovement\}/)
  assert.match(source, /onSaveFinanceSettings=\{handleSaveFinanceSettings\}/)
  assert.match(source, /actionKey=\{requestKey\}/)
})
