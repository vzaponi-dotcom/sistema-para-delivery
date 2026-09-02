import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile nav exposes four direct destinations plus Mais', async () => {
  const source = await read('./components/MobileNavigation.jsx')
  for (const label of ['Dashboard', 'Pedidos', 'Clientes', 'Produtos', 'Mais']) assert.match(source, new RegExp(label))
  assert.match(source, /aria-current=/)
  assert.match(source, /moreActive/)
})

test('Mais exposes secondary navigation theme and logout', async () => {
  const source = await read('./components/MobileNavigation.jsx')
  assert.match(source, /BottomSheet/)
  for (const label of ['A Receber', 'Financeiro', 'Claro', 'Escuro', 'Automático', 'Sair do sistema']) assert.match(source, new RegExp(label))
})

test('bottom bar is fixed safe-area aware and five columns wide', async () => {
  const css = await read('./mobile-navigation.css')
  assert.match(css, /position:\s*fixed/)
  assert.match(css, /safe-area-inset-bottom/)
  assert.match(css, /repeat\(5/)
  const touchTarget = css.match(/\.mobile-nav-item\s*\{[^}]*min-height:\s*(\d+)px/s)
  assert.ok(touchTarget)
  assert.ok(Number(touchTarget[1]) >= 44)
})

test('old mobile logout and horizontal sidebar scroll are removed', async () => {
  const sidebar = await read('./components/Sidebar.jsx')
  const css = await read('./theme-controls.css')
  assert.doesNotMatch(sidebar, /sidebar-mobile-logout/)
  assert.doesNotMatch(css, /sidebar-mobile-logout/)
  assert.doesNotMatch(css, /sidebar-nav[\s\S]*overflow-x:\s*auto/)
})
