import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as shared from '../../../shared/productCatalog.js'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const read = (path) => readFileSync(join(root, path), 'utf8')
const filesUnder = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name)
  return entry.isDirectory() ? filesUnder(path) : [path]
})

test('C8 Task 5 public entry is Node-safe and exposes only final external contracts', async () => {
  const catalog = await import('./index.js')
  assert.deepEqual(Object.keys(catalog).sort(), [
    'CatalogWorkspace', 'CATEGORY_ICON_NAMES', 'PRODUCT_CATEGORIES', 'categoryForUi', 'formatProductPresentation',
  ].sort())
  assert.equal(typeof catalog.CatalogWorkspace, 'function')
  assert.strictEqual(catalog.PRODUCT_CATEGORIES, shared.PRODUCT_CATEGORIES)
  assert.strictEqual(catalog.formatProductPresentation, shared.formatProductPresentation)
  assert.equal(catalog.categoryForUi('Categoria antiga'), 'Outros')
})

test('C8 removes legacy Products and ProductForm owners without compatibility facades', () => {
  for (const path of ['src/pages/Products.jsx', 'src/components/ProductForm.jsx']) {
    assert.equal(existsSync(join(root, path)), false, `Legacy owner still exists: ${path}`)
  }
  for (const path of ['src/domains/catalog/ui/Products.jsx', 'src/domains/catalog/ui/ProductForm.jsx', 'src/domains/catalog/ui/CatalogWorkspace.jsx']) {
    assert.equal(existsSync(join(root, path)), true, `Catalog UI owner is missing: ${path}`)
  }
})

test('C8 keeps only the cross-runtime product contracts in shared', () => {
  assert.deepEqual(Object.keys(shared).sort(), [
    'PRODUCT_CATEGORIES', 'deriveLegacySize', 'validateProductPresentation', 'formatProductPresentation',
  ].sort())
})

test('C8 Task 5 App and all Orders consumers use the Catalog public entry', () => {
  const app = read('src/App.jsx')
  assert.match(app, /from ['"]\.\/domains\/catalog\/index\.js['"]/)
  assert.match(app, /CatalogWorkspace/)
  assert.doesNotMatch(app, /\b(?:Products|ProductForm|ProductEditorDialog|useCatalogCommands|useProductEditor)\b/)
  assert.match(read('src/domains/orders/domain/orderCart.js'), /from ['"]\.\.\/\.\.\/catalog\/index\.js['"]/)
  assert.match(read('src/domains/orders/ui/components/OrderProductCatalog.jsx'), /from ['"]\.\.\/\.\.\/\.\.\/catalog\/index\.js['"]/)
  assert.match(read('src/domains/orders/ui/components/OrderCart.jsx'), /from ['"]\.\.\/\.\.\/\.\.\/catalog\/index\.js['"]/)
  assert.doesNotMatch(app, /updateCollection\s*\(\s*['"]products['"]/)
})

test('C8 rejects remaining production shared-product bypasses', () => {
  const bypasses = filesUnder(join(root, 'src'))
    .filter((path) => /\.(?:js|jsx|mjs)$/.test(path) && !/\.(?:test|spec)\./.test(path))
    .map((path) => relative(root, path).replaceAll('\\', '/'))
    .filter((path) => !path.startsWith('src/domains/catalog/') && /from\s+['"][^'"]*shared\/productCatalog\.js['"]/.test(read(path)))
  assert.deepEqual(bypasses, [], `Production consumers to migrate: ${bypasses.join(', ')}`)
})

test('C8 Task 5 removes product editor state, handlers and temporary composition from App', () => {
  const app = read('src/App.jsx')
  assert.match(app, /CatalogWorkspace/)
  for (const token of [
    'editingProductId', 'showProductForm', 'newProduct', 'emptyProduct', 'productPayload',
    'handleAddProduct', 'handleEditProduct', 'handleDeleteProduct', 'handleCancelProductEdit',
    'ProductEditorDialog', 'useProductEditor', 'useCatalogCommands',
  ]) {
    assert.doesNotMatch(app, new RegExp(`\\b${token}\\b`), `App still owns ${token}`)
  }
})
