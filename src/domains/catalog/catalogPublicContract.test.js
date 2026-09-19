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

test('C8 Task 1 public entry is Node-safe and exposes only the current external contracts', async () => {
  const catalog = await import('./index.js')
  assert.deepEqual(Object.keys(catalog).sort(), [
    'CATEGORY_ICON_NAMES', 'PRODUCT_CATEGORIES', 'categoryForUi', 'formatProductPresentation', 'Products', 'ProductForm', 'ProductEditorDialog', 'useCatalogCommands', 'useProductEditor',
  ].sort())
  assert.equal(typeof catalog.Products, 'function')
  assert.equal(typeof catalog.ProductForm, 'function')
  assert.equal(typeof catalog.ProductEditorDialog, 'function')
  assert.equal(typeof catalog.useProductEditor, 'function')
  assert.strictEqual(catalog.PRODUCT_CATEGORIES, shared.PRODUCT_CATEGORIES)
  assert.strictEqual(catalog.formatProductPresentation, shared.formatProductPresentation)
  assert.equal(catalog.categoryForUi('Categoria antiga'), 'Outros')
})

test('C8 Task 1 removes legacy Products and ProductForm owners without compatibility facades', () => {
  for (const path of ['src/pages/Products.jsx', 'src/components/ProductForm.jsx']) {
    assert.equal(existsSync(join(root, path)), false, `Legacy owner still exists: ${path}`)
  }
  for (const path of ['src/domains/catalog/ui/Products.jsx', 'src/domains/catalog/ui/ProductForm.jsx']) {
    assert.equal(existsSync(join(root, path)), true, `Catalog UI owner is missing: ${path}`)
  }
})

test('C8 Task 1 keeps only the cross-runtime product contracts in shared', () => {
  assert.deepEqual(Object.keys(shared).sort(), [
    'PRODUCT_CATEGORIES', 'deriveLegacySize', 'validateProductPresentation', 'formatProductPresentation',
  ].sort())
})

test('C8 Task 1 App and all Orders consumers use the Catalog public entry', () => {
  const app = read('src/App.jsx')
  assert.match(app, /from ['"]\.\/domains\/catalog\/index\.js['"]/)
  assert.doesNotMatch(app, /from ['"]\.\/(?:pages\/Products|components\/ProductForm)/)
  assert.match(read('src/domains/orders/domain/orderCart.js'), /from ['"]\.\.\/\.\.\/catalog\/index\.js['"]/)
  assert.match(read('src/domains/orders/ui/components/OrderProductCatalog.jsx'), /from ['"]\.\.\/\.\.\/\.\.\/catalog\/index\.js['"]/)
  assert.match(read('src/domains/orders/ui/components/OrderCart.jsx'), /from ['"]\.\.\/\.\.\/\.\.\/catalog\/index\.js['"]/)
  assert.match(app, /useCatalogCommands/)
  assert.match(app, /useProductEditor/)
  assert.match(app, /ProductEditorDialog/)
  assert.doesNotMatch(app, /updateCollection\s*\(\s*['\"]products['\"]/)
})

test('C8 Task 1 inventories and rejects remaining production shared-product bypasses', () => {
  const bypasses = filesUnder(join(root, 'src'))
    .filter((path) => /\.(?:js|jsx|mjs)$/.test(path) && !/\.(?:test|spec)\./.test(path))
    .map((path) => relative(root, path).replaceAll('\\', '/'))
    .filter((path) => !path.startsWith('src/domains/catalog/') && /from\s+['"][^'"]*shared\/productCatalog\.js['"]/.test(read(path)))
  assert.deepEqual(bypasses, [], `Production consumers to migrate: ${bypasses.join(', ')}`)
})


test('C8 Task 4 moves product editor state and payload ownership out of App', () => {
  const app = read('src/App.jsx')
  assert.match(app, /ProductEditorDialog/)
  assert.match(app, /useProductEditor/)
  for (const token of [
    'editingProductId',
    'showProductForm',
    'newProduct',
    'emptyProduct',
    'productPayload',
    'handleAddProduct',
    'handleEditProduct',
    'handleCancelProductEdit',
  ]) {
    assert.doesNotMatch(app, new RegExp(`\\b${token}\\b`), `App still owns ${token}`)
  }
})
