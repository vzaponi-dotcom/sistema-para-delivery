import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./pages/NewOrder.jsx', import.meta.url), 'utf8')

test('quick client form has an explicit cancel action that clears only quick-client state', () => {
  const closeMatch = source.match(/const closeQuickClient = \(\) => \{([\s\S]*?)\n  \}/)
  assert.ok(closeMatch, 'closeQuickClient must exist')
  const body = closeMatch[1]

  assert.match(body, /setQuickClient\(\{ open: false, name: '', phone: '' \}\)/)
  assert.match(body, /setQuickClientError\(''\)/)
  assert.match(body, /setDuplicateClient\(null\)/)
  assert.doesNotMatch(body, /setItems|setType|setOrderDate|setDeliveryFee|setAdjustment/)
  assert.match(source, /<Button type="button" variant="secondary" onClick=\{closeQuickClient\}[^>]*>Cancelar<\/Button>/)
})
