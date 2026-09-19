import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const fileUrl = (relativePath) => new URL(relativePath, import.meta.url)
const source = (relativePath) => readFileSync(fileUrl(relativePath), 'utf8')

test('Task 6 exposes a minimal public quick-create customer command', () => {
  assert.equal(existsSync(fileUrl('./application/useQuickCreateCustomerCommand.js')), true)

  const publicEntry = source('./index.js')
  const command = source('./application/useQuickCreateCustomerCommand.js')

  assert.match(publicEntry, /useQuickCreateCustomerCommand/)
  assert.match(command, /name\.trim\(\)/)
  assert.match(command, /phone:\s*phone\s*\|\|\s*['"]['"]/)
  assert.match(command, /address:\s*['"]['"]/)
  assert.match(command, /quickCreateClient/)
})

test('Task 6 leaves App as composition only for New Order customer creation', () => {
  const app = source('../../App.jsx')

  assert.doesNotMatch(app, /handleQuickCreateClient/)
  assert.doesNotMatch(app, /useCustomerCommands/)
  assert.doesNotMatch(app, /customerCommands/)
  assert.match(app, /useQuickCreateCustomerCommand/)
  assert.match(app, /onCreateClient=\{quickCreateCustomer\}/)
})

test('Task 6 keeps Orders on the Customers public contract and preserves quick-create behavior', () => {
  const orders = source('../orders/ui/NewOrder.jsx')

  assert.match(orders, /from ['"]\.\.\/\.\.\/customers\/index\.js['"]/)
  assert.match(orders, /ClientDuplicateModal/)
  assert.match(orders, /findClientDuplicates/)
  assert.doesNotMatch(orders, /customers\/infrastructure|customersApi|customers\/application\/useCustomerCommands/)
  assert.match(orders, /Telefone já cadastrado para \$\{duplicate\.phone\.name\}\. Selecione esse cliente na busca acima\./)
  assert.match(orders, /handleUseExistingDuplicate/)
  assert.match(orders, /handleConfirmDuplicate/)
  assert.match(orders, /setSelectedClientId\(/)
  assert.match(orders, /closeQuickClient/)
  assert.match(orders, /setQuickClient\(\{ open: false, name: '', phone: '' \}\)/)
  assert.match(orders, /setQuickClientError\(''\)/)
  assert.match(orders, /setDuplicateClient\(null\)/)
})
