import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('new order uses one searchable client picker without phone in the selected label', () => {
  const customerStep = source('../components/NewOrderCustomerStep.jsx')

  assert.match(customerStep, /new-order-client-picker/)
  assert.match(customerStep, /role="combobox"/)
  assert.match(customerStep, /role="listbox"/)
  assert.doesNotMatch(customerStep, />Buscar cliente</)
  assert.doesNotMatch(customerStep, /\[client\.name, client\.phone\]/)
  assert.doesNotMatch(customerStep, /client\.name\}\{client\.phone/)
})

test('quick client phone reuses the normal phone mask', () => {
  const page = source('./NewOrder.jsx')
  const customerStep = source('../components/NewOrderCustomerStep.jsx')

  assert.match(page, /formatPhone/)
  assert.match(page, /phone: formatPhone\(patch\.phone\)/)
  assert.match(customerStep, /onQuickClientChange\(\{ phone: event\.target\.value \}\)/)
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

test('product catalog starts empty until a category is selected or search is typed', () => {
  const catalog = source('../components/OrderProductCatalog.jsx')

  assert.match(catalog, /const \[category, setCategory\] = useState\(null\)/)
  assert.doesNotMatch(catalog, /\['Todos',/)
  assert.match(catalog, /if \(!normalized && !category\) return \[\]/)
  assert.match(catalog, /Selecione uma categoria ou busque um produto/)
})

test('product search ignores the selected category and adding keeps the category active', () => {
  const catalog = source('../components/OrderProductCatalog.jsx')

  assert.match(catalog, /if \(normalized\) return matchesSearch/)
  assert.match(catalog, /return uiCategory === category/)
  assert.match(catalog, /onClick=\{\(\) => onAdd\(product\)\}/)
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

test('new order keeps money display formatted but normalizes preview and payload to numbers', () => {
  const page = source('./NewOrder.jsx')

  assert.match(page, /formatBRLCurrencyValue/)
  assert.match(page, /parseBRLCurrencyInput/)
  assert.match(page, /formatBRLCurrencyValue\(0\)/)
  assert.match(page, /numericDraft/)
  assert.match(page, /calculateOrderPreview\(numericDraft\)/)
  assert.match(page, /buildOrderPayload\(numericDraft, paymentMethod\)/)
})

test('new order still exposes catalog, cart and both checkout actions', () => {
  const page = source('./NewOrder.jsx')
  const customerStep = source('../components/NewOrderCustomerStep.jsx')
  const catalog = source('../components/OrderProductCatalog.jsx')
  const cart = source('../components/OrderCart.jsx')
  const checkout = source('../components/OrderCheckoutSummary.jsx')

  assert.match(page, /Nova venda/)
  assert.match(customerStep, /\+ Novo cliente/)
  assert.match(catalog, /Buscar produto/)
  assert.match(catalog, /Categorias de produtos/)
  assert.match(cart, /Carrinho/)
  assert.match(cart, /Observação deste item/)
  assert.match(checkout, /Salvar pedido/)
  assert.match(checkout, /Salvar e receber/)
  assert.match(checkout, /Forma de pagamento/)
})

test('wizard keeps checkout payload unchanged and never persists intermediate step metadata', () => {
  const page = source('./NewOrder.jsx')

  assert.match(page, /buildOrderPayload\(numericDraft, paymentMethod\)/)
  assert.match(page, /await onSubmit\(buildOrderPayload\(numericDraft, paymentMethod\)\)/)
  assert.doesNotMatch(page, /step:\s*currentStep/)
  assert.doesNotMatch(page, /currentStep:\s*currentStep/)
})
