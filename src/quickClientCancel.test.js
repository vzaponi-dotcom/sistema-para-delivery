import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('./pages/NewOrder.jsx', import.meta.url), 'utf8')
const customerStep = readFileSync(new URL('./components/NewOrderCustomerStep.jsx', import.meta.url), 'utf8')

test('quick client form has an explicit cancel action that clears only quick-client state', () => {
  const closeMatch = page.match(/const closeQuickClient = \(\) => \{([\s\S]*?)\n  \}/)
  assert.ok(closeMatch, 'closeQuickClient must exist')
  const body = closeMatch[1]

  assert.match(body, /setQuickClient\(\{ open: false, name: '', phone: '' \}\)/)
  assert.match(body, /setQuickClientError\(''\)/)
  assert.match(body, /setDuplicateClient\(null\)/)
  assert.doesNotMatch(body, /setItems|setType|setOrderDate|setDeliveryFee|setAdjustment/)
  assert.match(page, /onQuickClientCancel=\{closeQuickClient\}/)
  assert.match(customerStep, /<Button type="button" variant="secondary" onClick=\{onQuickClientCancel\}[^>]*>Cancelar<\/Button>/)
})
