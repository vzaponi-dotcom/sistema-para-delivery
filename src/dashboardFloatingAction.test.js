import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('dashboard moves new order into one floating action on desktop and mobile', () => {
  const page = source('./pages/Dashboard.jsx')
  const css = source('./dashboard.css')

  assert.doesNotMatch(page, /<Button[^>]*icon=["']plus["'][^>]*>Novo pedido<\/Button>/)
  assert.match(page, /className=["'][^"']*dashboard-new-order-fab[^"']*["']/)
  assert.match(page, /className=["'][^"']*button-primary[^"']*["']/)
  assert.match(page, /aria-label=["']Novo pedido["']/)
  assert.match(page, /title=["']Novo pedido["']/)
  assert.match(page, /onClick=\{onNewOrder\}/)
  assert.match(page, /disabled=\{writeDisabled\}/)
  assert.match(page, /<Icon name=["']plus["']/)

  assert.match(css, /\.dashboard-new-order-fab\s*\{[^}]*position:\s*fixed;[^}]*right:/s)
  assert.match(css, /\.dashboard-new-order-fab\s*\{[^}]*bottom:/s)
  assert.match(css, /\.dashboard-new-order-fab\s*\{[^}]*min-width:\s*56px;[^}]*min-height:\s*56px;/s)
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*\.dashboard-new-order-fab\s*\{/)
})
