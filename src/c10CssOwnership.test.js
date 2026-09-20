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
  'dashboard.css': '17f34866a7f5d0b02bd7f12f2e2e80a9e575afe61919bb09667047581bbdf9b6',
  'new-order.css': 'e9f7198f0c48fb9d29fb6b3e5c945b9cf4a3565429344267bffc3040d3429a94',
  'client-duplicate.css': '28fca2cef6d7d3efd625ac1ee714fe9d15b2334a4e0a6cbde8b7cd71cc9a7985',
  'product-form.css': 'b3864196ccdc1a074689a729ea75e34c601eb874e663cf0b2153b4fbc3dd86a1',
  'finance-mobile.css': '57fc021f88cc1bb69d82a0f3fff7d40de9366b2b9fe609436eb7041d8eaf7a22',
  'print-queue.css': 'de48b856a0ae8890b3e2f23119da303400418eda3ff64fbe6b453d8bce27e575',
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
