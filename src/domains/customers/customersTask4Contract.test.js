import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const fileUrl = (relativePath) => new URL(relativePath, import.meta.url)
const source = (relativePath) => readFileSync(fileUrl(relativePath), 'utf8')

test('Task 4 moves the customer editor and duplicate modal behind the Customers public contract', () => {
  assert.equal(existsSync(fileUrl('./application/useCustomerEditor.js')), true)
  assert.equal(existsSync(fileUrl('./ui/CustomerEditorDialog.jsx')), true)
  assert.equal(existsSync(fileUrl('./ui/ClientDuplicateModal.jsx')), true)
  assert.equal(existsSync(fileUrl('../../components/ClientDuplicateModal.jsx')), false)

  const publicEntry = source('./index.js')
  assert.match(publicEntry, /useCustomerEditor/)
  assert.match(publicEntry, /CustomerEditorDialog/)
  assert.match(publicEntry, /ClientDuplicateModal/)

  const app = source('../../App.jsx')
  for (const legacyOwner of ['newClient', 'editingClientId', 'showClientForm', 'duplicateClientDialog']) {
    assert.doesNotMatch(app, new RegExp('\\b' + legacyOwner + '\\b'))
  }

  const orders = source('../orders/ui/NewOrder.jsx')
  assert.match(orders, /import\s*\{[^}]*ClientDuplicateModal[^}]*\}\s*from\s*['"]\.\.\/\.\.\/customers\/index\.js['"]/s)
  assert.doesNotMatch(orders, /components\/ClientDuplicateModal/)
  const clearStart = app.indexOf('const clearBusinessData = () =>')
  const clearEnd = app.indexOf('sessionRuntimeTargetsRef.current.clearApplicationState', clearStart)
  assert.notEqual(clearStart, -1)
  assert.notEqual(clearEnd, -1)
  assert.match(app.slice(clearStart, clearEnd), /customerEditor\.cancel\(\)/)
})

test('Task 4 preserves the customer editor labels, input semantics and actions', () => {
  const dialog = source('./ui/CustomerEditorDialog.jsx')

  assert.match(dialog, /title=\{editing\s*\?\s*['"]Editar cliente['"]\s*:\s*['"]Novo cliente['"]\}/)
  assert.match(dialog, /<span>Nome<\/span>/)
  assert.match(dialog, /type="text"/)
  assert.match(dialog, /autoComplete="name"/)
  assert.match(dialog, /placeholder="Ex: Maria Silva"/)
  assert.match(dialog, /<span>Telefone<\/span>/)
  assert.match(dialog, /type="tel"/)
  assert.match(dialog, /inputMode="tel"/)
  assert.match(dialog, /autoComplete="tel"/)
  assert.match(dialog, /placeholder="\(11\) 99999-9999"/)
  assert.match(dialog, /<span>Endereço<\/span>/)
  assert.match(dialog, /autoComplete="street-address"/)
  assert.match(dialog, /placeholder="Bairro ou endereço"/)
  assert.match(dialog, />Cancelar<\/Button>/)
  assert.match(dialog, /Salvar alterações/)
  assert.match(dialog, /Adicionar cliente/)
})
