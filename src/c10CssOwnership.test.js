import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const surfaces = [
  ['dashboard.css', 'src/app/surfaces/dashboard/dashboard.css', 'src/app/surfaces/dashboard/DashboardSurface.jsx', "import './dashboard.css'"],
  ['new-order.css', 'src/domains/orders/ui/new-order.css', 'src/domains/orders/ui/NewOrder.jsx', "import './new-order.css'"],
  ['client-duplicate.css', 'src/domains/customers/ui/client-duplicate.css', 'src/domains/customers/ui/CustomersWorkspace.jsx', "import './client-duplicate.css'"],
  ['product-form.css', 'src/domains/catalog/ui/product-form.css', 'src/domains/catalog/ui/CatalogWorkspace.jsx', "import './product-form.css'"],
  ['finance-mobile.css', 'src/domains/finance/ui/finance-mobile.css', 'src/domains/finance/ui/FinanceWorkspace.jsx', "import './finance-mobile.css'"],
  ['print-queue.css', 'src/domains/printing/ui/print-queue.css', 'src/domains/printing/ui/PrintQueue.jsx', "import './print-queue.css'"],
]

const hashes = {
  'dashboard.css': 'ea5e1a06085b92d30ba08a4dc6a935223c237640adc50c763b01ca0a31c9659b',
  'new-order.css': '9ead7a064dba979f968786bb36f0c85e97c12b6d65c4e37c931ea93c94dad5e2',
  'client-duplicate.css': '33d65415d08928620e18d2fbbff139ac846ed586ef6ca57c864e8d740f5037f0',
  'product-form.css': '5a54b8f1df9a4da21ce30c700e8fb209faa3c907b886d852ef86c945caccaa08',
  'finance-mobile.css': '8dfa97f5a5bfdc5466a5b6278f0298f26d4e3bcbc58f711902dc5f84f26f2d2a',
  'print-queue.css': '3fbd01dcda285cd5b07a79d978f5f5ae01ee33e317aaca6a03d25008c3eee8e6',
}

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('C10 assigns legacy CSS to the owning surface without byte changes', () => {
  const app = read('src/App.jsx')

  for (const [legacyName, ownerPath, consumerPath, importStatement] of surfaces) {
    assert.equal(fs.existsSync(path.join(root, ownerPath)), true, `${ownerPath} must exist`)
    assert.equal(fs.existsSync(path.join(root, `src/${legacyName}`)), false, `${legacyName} must leave src root`)
    assert.equal(crypto.createHash('sha256').update(read(ownerPath)).digest('hex'), hashes[legacyName])
    assert.match(read(consumerPath), new RegExp(importStatement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.doesNotMatch(app, new RegExp(`['"]\./${legacyName}['"]`))
  }
})
