import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(path), 'utf8')

test('clients list uses compact full-row phonebook interactions without avatar action icons', () => {
  const source = read('src/pages/Clients.jsx')
  assert.match(source, /BottomSheet/)
  assert.match(source, /selectedClient/)
  assert.match(source, /client-phonebook-row/)
  assert.doesNotMatch(source, /entity-avatar/)
  assert.doesNotMatch(source, /className="entity-actions"/)
})

test('client action sheet offers edit and confirmed delete actions', () => {
  const source = read('src/pages/Clients.jsx')
  assert.match(source, /Editar cliente/)
  assert.match(source, /Excluir cliente/)
  assert.match(source, /confirmDelete|deleteConfirm/)
  assert.match(source, /Tem certeza|Confirmar exclusão|confirmar/i)
})

test('client phonebook styling keeps rows compact', () => {
  const css = read('src/App.css')
  assert.match(css, /\.client-phonebook-row/)
  assert.match(css, /\.client-phonebook-main/)
})
