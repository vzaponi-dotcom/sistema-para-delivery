import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('C8 Task 5 leaves App with Catalog composition only', () => {
  const app = read('../../App.jsx')
  const forbidden = /\b(?:editingProductId|showProductForm|newProduct|emptyProduct|productPayload|handleAddProduct|handleEditProduct|handleDeleteProduct|handleCancelProductEdit|useProductEditor|useCatalogCommands|ProductEditorDialog|ProductForm|Products)\b/

  assert.doesNotMatch(app, forbidden)
  assert.match(app, /CatalogWorkspace/)
  assert.match(app, /visible=\{activeTab === ['"]products['"]\}/)
  assert.match(app, /products=\{products\}/)
  assert.match(app, /search=\{query\.products\.search\}/)
  assert.match(app, /queryState=\{query\.products\}/)
  assert.match(app, /canManageProducts=\{canManageProducts\}/)
  assert.match(app, /applyOfficialEffects=\{applyOfficialEffects\}/)
  assert.match(app, /setRequestKey=\{setRequestKey\}/)
  assert.match(app, /onSuccess=\{showSuccessMessage\}/)
  assert.match(app, /onError=\{showApiError\}/)
  assert.doesNotMatch(app, /activeTab === ['"]products['"]\s*&&\s*<CatalogWorkspace/)
  assert.doesNotMatch(app, /productEditor\.cancel\(\)/)
})
