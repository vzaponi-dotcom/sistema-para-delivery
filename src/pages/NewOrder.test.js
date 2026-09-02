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

test('product catalog keeps added state tied to the cart with readable white text', () => {
  const page = source('./NewOrder.jsx')
  const catalog = source('../components/OrderProductCatalog.jsx')
  const css = source('../new-order.css')

  assert.match(page, /items=\{items\}/)
  assert.match(catalog, /items\.some/)
  assert.match(catalog, /✓ Adicionado/)
  assert.doesNotMatch(catalog, /setTimeout/)
  assert.doesNotMatch(catalog, /useEffect/)
  assert.match(css, /\.new-order-add-button span\s*\{[^}]*color:\s*#fff/s)
})

test('item note typing preserves spaces and commits normalization on blur', () => {
  const page = source('./NewOrder.jsx')
  const cart = source('../components/OrderCart.jsx')

  assert.match(page, /editCartItemNote/)
  assert.match(page, /commitCartItemNote/)
  assert.match(cart, /onNoteChange/)
  assert.match(cart, /onNoteCommit/)
  assert.match(cart, /onChange=\{\(event\) => onNoteChange/)
  assert.match(cart, /onBlur=\{\(\) => \{[^}]*onNoteCommit\(item\.lineId\)/s)
})

test('item observation stays collapsed until requested and collapses to a summary after editing', () => {
  const cart = source('../components/OrderCart.jsx')

  assert.match(cart, /useState/)
  assert.match(cart, /Adicionar observação/)
  assert.match(cart, /Editar observação/)
  assert.match(cart, /new-order-note-summary/)
  assert.match(cart, /expandedNote/)
  assert.match(cart, /onBlur=\{\(\) => \{[^}]*onNoteCommit\(item\.lineId\)[^}]*closeNote/s)
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
  assert.match(cart, /Observação deste item/)
  assert.match(checkout, /Salvar pedido/)
  assert.match(checkout, /Salvar e receber/)
  assert.match(checkout, /Forma de pagamento/)
})
