import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('new order uses a single narrow-screen flow without horizontal pressure', async () => {
  const css = await read('../new-order.css')

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-layout\s*\{[^}]*grid-template-columns:\s*1fr/s)
  assert.match(css, /\.new-order-product\s*>\s*div:first-child\s*\{[^}]*min-width:\s*0/s)
  assert.match(css, /\.new-order-cart-line-heading\s*\{[^}]*min-width:\s*0/s)
  assert.match(css, /overflow-wrap:\s*anywhere/)
})

test('new order mobile actions keep touch targets comfortable', async () => {
  const css = await read('../new-order.css')

  assert.match(css, /\.new-order-client-options button\s*\{[^}]*min-height:\s*(?:44px|var\(--mobile-touch-target\))/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-add-button\s*\{[^}]*min-height:\s*(?:44px|var\(--mobile-touch-target\))/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-quantity-control button\s*\{[^}]*min-width:\s*(?:44px|var\(--mobile-touch-target\))[^}]*min-height:\s*(?:44px|var\(--mobile-touch-target\))/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-note-toggle[^}]*min-height:\s*(?:44px|var\(--mobile-touch-target\))/s)
})

test('new order exposes mobile-friendly keyboards for phone and monetary values', async () => {
  const page = await read('./NewOrder.jsx')
  const checkout = await read('../components/OrderCheckoutSummary.jsx')

  assert.match(page, /type="tel"[\s\S]{0,180}inputMode="tel"/)
  assert.match(checkout, /Taxa de entrega[\s\S]{0,300}inputMode="decimal"/)
  assert.match(checkout, /<span>Valor<\/span>[\s\S]{0,300}inputMode="decimal"/)
})

test('new order checkout actions stack and remain tappable on narrow screens', async () => {
  const css = await read('../new-order.css')

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-checkout-actions[^}]*grid-template-columns:\s*1fr/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-checkout-actions\s+\.button[^}]*min-height:\s*48px/s)
})
