import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const formUrl = new URL('./components/ProductForm.jsx', import.meta.url)
const products = fs.readFileSync(new URL('./pages/Products.jsx', import.meta.url), 'utf8')

test('product form contains category, presentation, preview and cancel', () => {
  assert.equal(fs.existsSync(formUrl), true)
  if (!fs.existsSync(formUrl)) return
  const form = fs.readFileSync(formUrl, 'utf8')
  assert.match(form, /PRODUCT_CATEGORIES/)
  assert.match(form, /presentationType/)
  assert.match(form, /formatProductPresentation/)
  assert.match(form, /Cancelar/)
})

test('products screen combines category filter and presentation display', () => {
  assert.match(products, /categoryFilter/)
  assert.match(products, /Todos/)
  assert.match(products, /categoryForUi/)
  assert.match(products, /formatProductPresentation/)
})
