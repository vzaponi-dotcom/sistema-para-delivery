import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('normal client form delegates duplicate validation and editor state to Customers', () => {
  const workspace = source('./domains/customers/ui/CustomersWorkspace.jsx')
  const editor = source('./domains/customers/application/useCustomerEditor.js')

  assert.match(editor, /findClientDuplicates/)
  assert.match(editor, /Telefone já cadastrado para/)
  assert.match(editor, /duplicateDialog/)
  assert.match(workspace, /ClientDuplicateModal/)
  assert.match(workspace, /CustomerEditorDialog/)
  assert.match(workspace, /useCustomerEditor/)
  assert.doesNotMatch(workspace, /duplicateClientDialog/)
  assert.doesNotMatch(workspace, /window\.confirm/)
  assert.doesNotMatch(editor, /phone:\s*draft\.phone\s*\|\|\s*['"]\(00\) 00000-0000['"]/)
})

test('quick client inside new order can use the existing client or continue duplicate-name registration', () => {
  const page = source('./domains/orders/ui/NewOrder.jsx')

  assert.match(page, /findClientDuplicates/)
  assert.match(page, /Telefone já cadastrado para/)
  assert.match(page, /ClientDuplicateModal/)
  assert.match(page, /duplicateClient/)
  assert.match(page, /handleUseExistingDuplicate/)
  assert.match(page, /handleConfirmDuplicate/)
  assert.doesNotMatch(page, /window\.confirm/)
  assert.match(page, /role="alert"/)
})

test('public duplicate client modal shows the existing client and all three choices', () => {
  const modal = source('./domains/customers/ui/ClientDuplicateModal.jsx')

  assert.match(modal, /Cancelar/)
  assert.match(modal, /Usar cliente existente/)
  assert.match(modal, /Cadastrar mesmo assim/)
  assert.match(modal, /Encontramos um cliente com este nome/)
})
