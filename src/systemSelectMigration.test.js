import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const srcDir = dirname(fileURLToPath(import.meta.url))

const collectJsxFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await collectJsxFiles(fullPath))
    else if (entry.isFile() && entry.name.endsWith('.jsx')) files.push(fullPath)
  }
  return files
}

test('all app-facing JSX uses SystemSelect instead of native select', async () => {
  const files = await collectJsxFiles(srcDir)
  const offenders = []
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    if (/<select\b/.test(source)) offenders.push(file.slice(srcDir.length + 1))
  }
  assert.deepEqual(offenders, [])
})

test('order payment composition and Clients use the shared SystemSelect', async () => {
  const paymentDialog = await readFile(join(srcDir, 'app/workflows/payments/order/OrderPaymentDialog.jsx'), 'utf8')
  const paymentEditor = await readFile(join(srcDir, 'app/workflows/payments/PaymentCompositionEditor.jsx'), 'utf8')
  const clients = await readFile(join(srcDir, 'domains/customers/ui/Clients.jsx'), 'utf8')
  assert.match(paymentDialog, /import PaymentCompositionEditor/)
  assert.match(paymentDialog, /<PaymentCompositionEditor/)
  assert.match(paymentEditor, /import SystemSelect/)
  assert.match(clients, /import SystemSelect/)
})

test('App write selectors preserve blocked state and approved labels', async () => {
  const paymentDialog = await readFile(join(srcDir, 'app/workflows/payments/order/OrderPaymentDialog.jsx'), 'utf8')
  const paymentEditor = await readFile(join(srcDir, 'app/workflows/payments/PaymentCompositionEditor.jsx'), 'utf8')
  const movementDialog = await readFile(join(srcDir, 'domains/finance/ui/MovementDialog.jsx'), 'utf8')
  const financeWorkspace = await readFile(join(srcDir, 'domains/finance/ui/FinanceWorkspace.jsx'), 'utf8')
  assert.match(paymentDialog, /<PaymentCompositionEditor[\s\S]*disabled=\{dialog\.writesBlocked \|\| dialog\.submitting\}/)
  assert.match(paymentEditor, /label=\{label\}/)
  assert.match(paymentEditor, /disabled=\{disabled\}/)

  assert.match(financeWorkspace, /<MovementDialog[\s\S]*?disabled=\{writesBlocked\}/)
  for (const label of ['Tipo do movimento', 'Categoria']) {
    assert.match(movementDialog, new RegExp(`label="${label}"[\\s\\S]*?disabled=\\{locked\\}`))
  }

  const productForm = await readFile(join(srcDir, 'domains/catalog/ui/ProductForm.jsx'), 'utf8')
  assert.match(productForm, /product-category-grid/)
  assert.match(productForm, /disabled=\{disabled\}/)
})
