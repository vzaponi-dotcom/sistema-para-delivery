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
  const orders = await read('./pages/Orders.jsx')
  assert.match(orders, /ConfirmationDialog/)
  assert.match(orders, /finalizeCandidate/)
  assert.match(orders, /Confirmar finalização/)
  assert.match(orders, /onConfirm=/)
})

test('deleting a product requires confirmation before invoking the delete callback', async () => {
  const products = await read('./pages/Products.jsx')
  assert.match(products, /ConfirmationDialog/)
  assert.match(products, /deleteCandidate/)
  assert.match(products, /Confirmar exclusão/)
  assert.match(products, /onConfirm=/)
})

test('manual financial movement gets a review confirmation before persistence', async () => {
  const app = await read('./App.jsx')
  assert.match(app, /ConfirmationDialog/)
  assert.match(app, /movementReview/)
  assert.match(app, /Confirmar movimentação/)
  assert.match(app, /createMovementApi/)
})

test('successful client and product deletions show centered success feedback', async () => {
  const app = await read('./App.jsx')
  const clientDelete = app.slice(app.indexOf('const handleDeleteClient'), app.indexOf('const handleCancelClientEdit'))
  const productDelete = app.slice(app.indexOf('const handleDeleteProduct'), app.indexOf('const handleCancelProductEdit'))
  assert.match(clientDelete, /showSuccessMessage\(/)
  assert.match(productDelete, /showSuccessMessage\(/)
})
