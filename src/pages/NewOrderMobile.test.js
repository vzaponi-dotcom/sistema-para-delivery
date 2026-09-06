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

test('schedule options keep the mobile touch target and two-column layout', async () => {
  const css = await read('../new-order.css')
  assert.match(css, /\.new-order-schedule-options\s*\{[^}]*grid-template-columns:\s*repeat\(2/s)
  assert.match(css, /\.new-order-schedule-option\s*\{[^}]*min-height:\s*var\(--mobile-touch-target,44px\)/s)
})

test('schedule choice has a themed selected state and scheduled time uses the numeric keyboard', async () => {
  const css = await read('../new-order.css')
  const customerStep = await read('../components/NewOrderCustomerStep.jsx')

  assert.match(css, /\.new-order-schedule-option\s*\{[^}]*border:\s*1px solid var\(--border\)[^}]*background:\s*var\(--surface\)[^}]*color:\s*var\(--text-soft\)/s)
  assert.match(css, /\.new-order-schedule-option\.selected\s*\{[^}]*border-color:\s*var\(--primary-border\)[^}]*background:\s*var\(--primary-soft\)[^}]*color:\s*var\(--primary\)/s)
  assert.doesNotMatch(customerStep, /type="time"/)
  assert.match(customerStep, /Horário desejado pelo cliente[\s\S]{0,400}type="text"[\s\S]{0,220}inputMode="numeric"/)
  assert.match(customerStep, /onScheduledTimeChange\(formatScheduledTimeInput\(event\.target\.value\)\)/)
})

test('new order mobile actions keep touch targets comfortable', async () => {
  const css = await read('../new-order.css')

  assert.match(css, /\.new-order-client-options button\s*\{[^}]*min-height:\s*(?:44px|var\(--mobile-touch-target\))/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-add-button\s*\{[^}]*min-height:\s*(?:44px|var\(--mobile-touch-target\))/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-quantity-control button\s*\{[^}]*min-width:\s*(?:44px|var\(--mobile-touch-target\))[^}]*min-height:\s*(?:44px|var\(--mobile-touch-target\))/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-note-toggle[^}]*min-height:\s*(?:44px|var\(--mobile-touch-target\))/s)
})

test('new order exposes mobile-friendly keyboards for phone and monetary values', async () => {
  const customerStep = await read('../components/NewOrderCustomerStep.jsx')
  const checkout = await read('../components/OrderCheckoutSummary.jsx')

  assert.match(customerStep, /type="tel"[\s\S]{0,180}inputMode="tel"/)
  assert.match(checkout, /Taxa de entrega[\s\S]{0,300}inputMode="decimal"/)
  assert.match(checkout, /<span>Valor<\/span>[\s\S]{0,300}inputMode="decimal"/)
})

test('new order checkout actions stack and remain tappable on narrow screens', async () => {
  const css = await read('../new-order.css')

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-checkout-actions[^}]*grid-template-columns:\s*1fr/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-checkout-actions\s+\.button[^}]*min-height:\s*48px/s)
})

test('products step keeps a mobile cart action above the bottom navigation safe area', async () => {
  const css = await read('../new-order.css')

  assert.match(css, /\.new-order-mobile-cart-action/)
  assert.match(css, /env\(safe-area-inset-bottom\)/)
  assert.match(css, /@media\s*\(max-width:\s*820px\)/)
})

test('wizard collapses review and type choices safely on narrow screens', async () => {
  const css = await read('../new-order.css')

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-step-indicator/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-type-options\s*\{[^}]*grid-template-columns:\s*1fr/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-review-layout\s*\{[^}]*grid-template-columns:\s*1fr/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-review-context\s*\{[^}]*grid-template-columns:\s*1fr/s)
})

test('wizard focus target and step controls keep the final narrow-screen contract', async () => {
  const css = await read('../new-order.css')

  assert.match(css, /\.new-order-step-content:focus\s*\{[^}]*outline:\s*none/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-step-tab\s*\{[^}]*min-width:\s*0[^}]*gap:\s*5px[^}]*padding:\s*6px[^}]*font-size:\s*\.76rem/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-step-number\s*\{[^}]*width:\s*22px[^}]*height:\s*22px[^}]*flex:\s*0\s+0\s+22px/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-review-layout\s*\{[^}]*grid-template-columns:\s*1fr[^}]*gap:\s*16px/s)
})
