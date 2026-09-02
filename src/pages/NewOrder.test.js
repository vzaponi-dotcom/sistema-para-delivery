import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('new order uses one searchable client picker without phone in the selected label', () => {
  const page = source('./NewOrder.jsx')

  assert.match(page, /ClientPicker/)
  assert.match(page, /client\.name/)
  assert.doesNotMatch(page, /selectedClient.*phone/)
})

test('quick client phone reuses the normal phone mask', () => {
  const page = source('./NewOrder.jsx')

  assert.match(page, /formatPhone/)
  assert.match(page, /quickClient\.phone/)
})

test('product catalog keeps added state tied to the cart with readable white text', () => {
  const catalog = source('../components/OrderProductCatalog.jsx')
  const css = source('../new-order.css')

  assert.match(catalog, /addedProductIds/)
  assert.match(catalog, /Adicionado/)
  assert.match(css, /\.new-order-product-card\.is-added[\s\S]*color:\s*#fff/)
})

test('item note typing preserves spaces and commits normalization on blur', () => {
  const cart = source('../components/OrderCart.jsx')

  assert.match(cart, /updateItemNoteDraft/)
  assert.match(cart, /commitItemNote/)
  assert.match(cart, /onBlur/)
})

test('item observation stays collapsed until requested and collapses to a summary after editing', () => {
  const cart = source('../components/OrderCart.jsx')

  assert.match(cart, /showNote/)
  assert.match(cart, /Adicionar observação/)
  assert.match(cart, /Editar observação/)
})

test('cart item layout is horizontal and compact with quantity on the left', () => {
  const cart = source('../components/OrderCart.jsx')
  const css = source('../new-order.css')

  assert.match(cart, /new-order-cart-quantity/)
  assert.match(cart, /new-order-cart-content/)
  assert.match(cart, /new-order-cart-aside/)
  assert.match(css, /\.new-order-cart-line\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto/s)
})

test('product form uses a BRL formatted text input', () => {
  const app = source('../App.jsx')
  const form = source('../components/ProductForm.jsx')

  assert.match(form, /formatBRLCurrencyInput/)
  assert.match(app, /parseBRLCurrencyInput/)
  assert.match(form, /inputMode="decimal"/)
  assert.doesNotMatch(form, /<span>Preço<\/span>[\s\S]*<input type="number"/)
})

test('new order still exposes catalog, cart and both checkout actions', () => {
  const page = source('./NewOrder.jsx')
  const catalog = source('../components/OrderProductCatalog.jsx')
  const cart = source('../components/OrderCart.jsx')
  const checkout = source('../components/OrderCheckoutSummary.jsx')

  assert.match(page, /Nova venda/)
  assert.match(page, /\+ Novo cliente/)
  assert.match(catalog, /Buscar produto/)
  assert.match(catalog, /Categorias de produtos/)
  assert.match(cart, /Carrinho/)
  assert.match(checkout, /Salvar como pendente/)
  assert.match(checkout, /Finalizar e receber/)
})
