import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('a reusable confirmation dialog is available for significant actions', async () => {
  const dialogUrl = new URL('./components/ConfirmationDialog.jsx', import.meta.url)
  assert.equal(existsSync(fileURLToPath(dialogUrl)), true, 'ConfirmationDialog.jsx must exist')
  const dialog = await read('./components/ConfirmationDialog.jsx')
  assert.match(dialog, /Modal/)
  assert.match(dialog, /confirmLabel/)
  assert.match(dialog, /onConfirm/)
})

test('finalizing an order requires a review confirmation before the write callback', async () => {
  const orders = await read('./domains/orders/ui/Orders.jsx')
  assert.match(orders, /ConfirmationDialog/)
  assert.match(orders, /finalizeCandidate/)
  assert.match(orders, /Confirmar finalização/)
  assert.match(orders, /onConfirm=/)
})

test('deleting a product requires confirmation before invoking the delete callback', async () => {
  const products = await read('./domains/catalog/ui/Products.jsx')
  assert.match(products, /ConfirmationDialog/)
  assert.match(products, /deleteCandidate/)
  assert.match(products, /Confirmar exclusão/)
  assert.match(products, /onConfirm=/)
})

test('manual financial movement gets a review confirmation before persistence', async () => {
  const [movementDialog, commands, workspace] = await Promise.all([
    read('./domains/finance/ui/MovementDialog.jsx'),
    read('./domains/finance/application/useFinanceCommands.js'),
    read('./domains/finance/ui/FinanceWorkspace.jsx'),
  ])
  assert.match(movementDialog, /ConfirmationDialog/)
  assert.match(movementDialog, /setReview/)
  assert.match(movementDialog, /Confirmar movimentação/)
  assert.match(movementDialog, /onSubmit\?\.\(review\)/)
  assert.match(commands, /api\.createMovement\(payload\)/)
  assert.match(workspace, /onSubmit=\{commands\.saveMovement\}/)
})

test('successful client and product deletions show centered success feedback', async () => {
  const [customerCommands, catalogCommands] = await Promise.all([
    read('./domains/customers/application/useCustomerCommands.js'),
    read('./domains/catalog/application/useCatalogCommands.js'),
  ])
  assert.match(customerCommands, /onSuccess\('Cliente excluído com sucesso'\)/)
  assert.match(catalogCommands, /onSuccess\('Produto excluído com sucesso'\)/)
})
