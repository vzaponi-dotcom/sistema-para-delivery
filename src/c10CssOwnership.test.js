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
  'dashboard.css': '7d87fc36e0049703c3a7cb54c235239be3053de19ed49bc2c5fb3ecc7fa6310f',
  'new-order.css': '62eddc47cc3ba273d2162e97294cf44d2c326aed91d0e8a7477ab77e7202017e',
  'client-duplicate.css': '28fca2cef6d7d3efd625ac1ee714fe9d15b2334a4e0a6cbde8b7cd71cc9a7985',
  'product-form.css': '3d0fb8ccd0180cda2b53a103dc3649f2faf71ffd999b989820844e9c2fddb2b1',
  'finance-mobile.css': '9b257fbd7c4fe7917db9e53cd7c249058cd2d8320d6d99252079481b8227dbdf',
  'print-queue.css': 'd1d27795db0021f456d93e8ec8777cf9489e3a3f6e7a9626450d3dbb965f53fd',
}

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('C10 keeps migrated CSS under the owning surface with approved byte snapshots', () => {
  const app = read('src/App.jsx')

  for (const [legacyName, ownerPath, consumerPath, importStatement] of surfaces) {
    assert.equal(fs.existsSync(path.join(root, ownerPath)), true, `${ownerPath} must exist`)
    assert.equal(fs.existsSync(path.join(root, `src/${legacyName}`)), false, `${legacyName} must leave src root`)
    const normalizedCss = read(ownerPath).replaceAll('\r\n', '\n')
    assert.equal(crypto.createHash('sha256').update(normalizedCss).digest('hex'), hashes[legacyName])
    assert.match(read(consumerPath), new RegExp(importStatement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.doesNotMatch(app, new RegExp(`['"]\./${legacyName}['"]`))
  }
})
