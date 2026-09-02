import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const form = fs.readFileSync(new URL('./components/ProductForm.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('./product-form.css', import.meta.url), 'utf8')

test('selected product controls use check plus strong filled state', () => {
  assert.match(form, /product-selection-check/)
  assert.match(form, /name="check"/)
  assert.match(css, /\.product-selection-check/)
  assert.match(css, /\.product-category-option\.selected[\s\S]*box-shadow/)
  assert.match(css, /\.product-presentation-option\.selected[\s\S]*box-shadow/)
  assert.match(css, /\.product-size-option\.selected[\s\S]*box-shadow/)
  assert.match(css, /\.product-unit-option\.selected[\s\S]*box-shadow/)
})
