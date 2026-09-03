import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('client rows and product form remain touchable at 320px', async () => {
  const clients = await read('../clients-phonebook.css')
  const form = await read('../product-form.css')

  assert.match(clients, /min-height:\s*(?:44|48|58|62)px/)
  assert.match(clients, /@media\s*\(max-width:\s*640px\)/)
  assert.match(form, /@media\s*\(max-width:\s*640px\)/)
  assert.match(form, /@media\s*\(max-width:\s*640px\)[\s\S]*grid-template-columns:\s*1fr/s)
})

test('client addresses wrap instead of clipping on narrow screens', async () => {
  const clients = await read('../clients-phonebook.css')

  assert.match(clients, /@media\s*\(max-width:\s*640px\)[\s\S]*\.client-phonebook-address\s*\{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/s)
})

test('product list moves actions out of the compressed name column on narrow screens', async () => {
  const productCss = await read('../product-form.css')

  assert.match(productCss, /@media\s*\(max-width:\s*640px\)[\s\S]*\.product-row\s*\{[^}]*grid-template-columns:\s*38px\s+minmax\(0,\s*1fr\)/s)
  assert.match(productCss, /@media\s*\(max-width:\s*640px\)[\s\S]*\.product-row \.entity-actions\s*\{[^}]*grid-column:\s*1\s*\/\s*-1[^}]*flex-direction:\s*row/s)
  assert.match(productCss, /@media\s*\(max-width:\s*640px\)[\s\S]*\.product-row \.icon-button\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/s)
  assert.match(productCss, /@media\s*\(max-width:\s*640px\)[\s\S]*\.product-main strong\s*\{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/s)
})

test('client and product inputs expose mobile keyboard and autocomplete hints', async () => {
  const app = await read('../App.jsx')
  const productForm = await read('../components/ProductForm.jsx')

  assert.match(app, /<input[^>]*type="text"[^>]*autoComplete="name"[^>]*placeholder="Ex: Maria Silva"/)
  assert.match(app, /<input[^>]*type="tel"[^>]*inputMode="tel"[^>]*autoComplete="tel"/)
  assert.match(app, /<input[^>]*type="text"[^>]*autoComplete="street-address"[^>]*placeholder="Bairro ou endereço"/)
  assert.match(productForm, /inputMode="decimal"/)
})
