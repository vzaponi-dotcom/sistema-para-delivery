import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readFinance = async () => readFile(new URL('./Finance.jsx', import.meta.url), 'utf8')
const readApp = async () => readFile(new URL('../App.jsx', import.meta.url), 'utf8')

test('finance exposes edit/delete only for manual rows', async () => {
  const source = await readFinance()
  assert.match(source, /deletingMovement/)
  assert.match(source, /movement\.source === 'manual'/)
  assert.match(source, />Editar</)
  assert.match(source, />Excluir</)
  assert.match(source, /onEditMovement/)
  assert.match(source, /onDeleteMovement/)
})

test('delete confirmation shows the manual movement identity, date and value before destructive action', async () => {
  const source = await readFinance()
  assert.match(source, /ConfirmationDialog/)
  assert.match(source, /title="Excluir movimentação"/)
  assert.match(source, /deletingMovement\.description/)
  assert.match(source, /deletingMovement\.movementDate\s*\|\|\s*deletingMovement\.date/)
  assert.match(source, /currency\(deletingMovement\.value\)/)
  assert.match(source, /confirmLabel="Excluir movimentação"/)
  assert.match(source, /confirmVariant="danger"/)
})

test('opening balance action distinguishes first setup from editing and shows configured context', async () => {
  const source = await readFinance()
  assert.match(source, /Configurar saldo inicial/)
  assert.match(source, /Editar saldo inicial/)
  assert.match(source, /onConfigureOpeningBalance/)
  assert.match(source, /financeSettings\.openingDate/)
  assert.match(source, /currentBalance/)
})

test('App wires reviewed movement/opening dialogs to authoritative finance callbacks', async () => {
  const source = await readApp()
  assert.match(source, /onAddMovement=\{openNewMovement\}/)
  assert.match(source, /onEditMovement=\{openEditMovement\}/)
  assert.match(source, /onDeleteMovement=\{handleDeleteMovement\}/)
  assert.match(source, /onConfigureOpeningBalance=\{openOpeningBalanceDialog\}/)
  assert.match(source, /<MovementDialog[\s\S]*onSubmit=\{handleSaveMovement\}/)
  assert.match(source, /<OpeningBalanceDialog[\s\S]*onSubmit=\{handleSaveFinanceSettings\}/)
})
