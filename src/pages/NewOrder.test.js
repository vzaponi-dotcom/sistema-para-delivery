import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('new order uses one searchable client picker without phone in the selected label', () => {
  const page = source('./NewOrder.jsx')

  assert.match(page, /new-order-client-picker/)
  assert.match(page, /role="combobox"/)
  assert.match(page, /role="listbox"/)
  assert.doesNotMatch(page, />Buscar cliente</)
  assert.doesNotMatch(page, /\[client\.name, client\.phone\]/)
  assert.doesNotMatch(page, /client\.name\}\{client\.phone/)
})

test('quick client phone reuses the normal phone mask', () => {
  const page = source('./NewOrder.jsx')

  assert.match(page, /formatPhone/)
  assert.match(page, /phone: formatPhone\(event\.target\.value\)/)
})

test('product catalog uses a compact high-contrast add action with immediate feedback', () => {
  const catalog = source('../components/OrderProductCatalog.jsx')
  const css = source('../new-order.css')

  assert.match(catalog, /new-order-add-button/)
  assert.match(catalog, /Adicionado/)
  assert.match(catalog, /aria-live="polite"/)
  assert.match(css, /\.new-order-add-button/)
})

test('product form uses a BRL formatted text input', () => {
  const app = source('../App.jsx')

  assert.match(app, /formatBRLCurrencyInput/)
  assert.match(app, /parseBRLCurrencyInput/)
  assert.match(app, /inputMode="decimal"/)
  assert.doesNotMatch(app, /<span>Preço<\/span><input type="number"/)
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
  assert.match(cart, /Observação deste item/)
  assert.match(checkout, /Salvar pedido/)
  assert.match(checkout, /Salvar e receber/)
  assert.match(checkout, /Forma de pagamento/)
})
