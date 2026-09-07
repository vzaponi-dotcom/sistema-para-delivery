import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile compact controls stylesheet is wired from the application entrypoint', async () => {
  const main = await read('./main.jsx')

  assert.match(main, /import '\.\/mobile-compact-controls\.css'/)
})

test('order type choices stay three-across and compact on mobile', async () => {
  const css = await read('./mobile-compact-controls.css')

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-type-options(?:\s*,[^{}]+)?\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s)
  assert.match(css, /\.new-order-type-options\s*>\s*\.new-order-type-option(?:\s*,[^{}]+)?\s*\{[^}]*min-height:\s*var\(--mobile-touch-target,\s*44px\)[^}]*white-space:\s*normal/s)
})

test('local identity choices stay three-across and use semantic icons on mobile', async () => {
  const css = await read('./mobile-compact-controls.css')
  const customerStep = await read('./components/NewOrderCustomerStep.jsx')
  const icon = await read('./components/Icon.jsx')

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-local-identity-options\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s)
  assert.match(css, /\.new-order-local-identity-options\s*>\s*\.new-order-local-identity-option\s*\{[^}]*min-height:\s*var\(--mobile-touch-target,\s*44px\)[^}]*white-space:\s*normal/s)
  assert.match(css, /\.new-order-local-identity-options\s*>\s*\.new-order-local-identity-option\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*justify-content:\s*center/s)
  assert.match(customerStep, /import Icon from '\.\/Icon'/)
  assert.match(customerStep, /\{ value: 'guest_name', label: 'Nome', icon: 'client' \}/)
  assert.match(customerStep, /\{ value: 'table', label: 'Mesa', icon: 'table' \}/)
  assert.match(customerStep, /\{ value: 'registered_client', label: 'Cliente cadastrado', icon: 'clients' \}/)
  assert.match(customerStep, /<Icon name=\{option\.icon\} size=\{16\} \/>/)
  assert.match(icon, /\btable:\s*<>/)
})

test('kitchen header actions fill the mobile width with four controls and a very-narrow fallback', async () => {
  const css = await read('./mobile-compact-controls.css')

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.kitchen-page \.page-actions\s*\{[^}]*width:\s*100%/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.kitchen-page \.kitchen-header-actions\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s)
  assert.match(css, /\.kitchen-page \.kitchen-header-actions \.button\s*\{[^}]*min-width:\s*0[^}]*white-space:\s*normal/s)
  assert.match(css, /@media\s*\(max-width:\s*340px\)[\s\S]*\.kitchen-page \.kitchen-header-actions\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s)
})

test('mobile cart matches the approved compact icon-and-pill layout without changing cart actions', async () => {
  const css = await read('./mobile-compact-controls.css')
  const cart = await read('./components/OrderCart.jsx')

  assert.match(cart, /import Icon from '\.\/Icon'/)
  assert.match(cart, /import \{ CATEGORY_ICON_NAMES, categoryForUi \} from '\.\.\/\.\.\/shared\/productCatalog\.js'/)
  assert.match(cart, /className="new-order-cart-category-icon"/)
  assert.match(cart, /<Icon name=\{CATEGORY_ICON_NAMES\[categoryForUi\(item\.category\)\]\} size=\{22\} \/>/)

  assert.match(cart, /onUpdate\(item\.lineId, \{ quantity: Number\(item\.quantity \|\| 1\) - 1 \}\)/)
  assert.match(cart, /onUpdate\(item\.lineId, \{ quantity: Number\(item\.quantity \|\| 1\) \+ 1 \}\)/)
  assert.match(cart, /onClick=\{\(\) => onRemove\(item\.lineId\)\}/)
  assert.match(cart, /onNoteChange\(item\.lineId, event\.target\.value\)/)

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-cart-line\s*\{[^}]*grid-template-columns:\s*52px\s+minmax\(0,\s*1fr\)\s+auto[^}]*grid-template-areas:/s)
  assert.match(css, /\.new-order-cart-category-icon\s*\{[^}]*grid-area:\s*icon[^}]*display:\s*grid[^}]*width:\s*52px[^}]*height:\s*52px/s)
  assert.match(css, /\.new-order-cart-quantity\s*\{[^}]*grid-area:\s*quantity[^}]*justify-items:\s*start/s)
  assert.match(css, /\.new-order-cart-content\s*\{[^}]*grid-area:\s*content/s)
  assert.match(css, /\.new-order-cart-aside\s*\{[^}]*grid-area:\s*aside/s)
  assert.match(css, /\.new-order-quantity-control button\s*\{[^}]*width:\s*34px[^}]*height:\s*34px[^}]*min-width:\s*34px[^}]*min-height:\s*34px/s)
})
