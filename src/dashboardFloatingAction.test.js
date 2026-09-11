import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('financial overview removes the duplicated new-order floating action', () => {
  const page = source('./pages/Dashboard.jsx')
  const css = source('./dashboard.css')

  assert.doesNotMatch(page, /Novo pedido|onNewOrder|dashboard-new-order-fab/)
  assert.doesNotMatch(css, /dashboard-new-order-fab/)
})
