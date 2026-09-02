import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as orderWorkflow from './utils/orderWorkflow.js'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')
const readOptional = (path) => read(path).catch(() => '')

test('elapsed duration switches to hours and minutes from one hour onward', () => {
  assert.equal(typeof orderWorkflow.formatElapsedDuration, 'function')
  assert.equal(orderWorkflow.formatElapsedDuration(0), 'agora')
  assert.equal(orderWorkflow.formatElapsedDuration(45), '45 min')
  assert.equal(orderWorkflow.formatElapsedDuration(60), '1h 00 min')
  assert.equal(orderWorkflow.formatElapsedDuration(65), '1h 05 min')
  assert.equal(orderWorkflow.formatElapsedDuration(347), '5h 47 min')
})

test('active order cards keep item details collapsed behind an accessible toggle', async () => {
  const source = await read('./pages/Orders.jsx')
  assert.match(source, /expandedOrderIds/)
  assert.match(source, /aria-expanded=/)
  assert.match(source, /Ver itens/)
  assert.match(source, /Ocultar itens/)
})

test('active order actions use one compact aligned action row', async () => {
  const source = await readOptional('./order-operations-compact.css')
  assert.match(source, /flex-wrap:\s*nowrap/)
  assert.match(source, /min-height:\s*38px/)
})

test('sidebar theme picker is a visual three-option segmented control with icons', async () => {
  const sidebar = await read('./components/Sidebar.jsx')
  assert.doesNotMatch(sidebar, /<select/)
  assert.match(sidebar, /theme-segmented-control/)
  assert.match(sidebar, /aria-pressed=/)
  assert.match(sidebar, /icon:\s*'sun'/)
  assert.match(sidebar, /icon:\s*'moon'/)
  assert.match(sidebar, /icon:\s*'system'/)
  assert.match(sidebar, /<Icon name=\{option\.icon\}/)
})

test('sidebar theme options fit narrow desktop width and mobile logout stays visible', async () => {
  const themeCss = await read('./theme-controls.css')
  const sidebar = await read('./components/Sidebar.jsx')

  assert.match(themeCss, /\.theme-option\s*\{[^}]*flex-direction:\s*column/s)
  assert.match(sidebar, /sidebar-mobile-logout/)
  assert.match(sidebar, /aria-label="Sair do sistema"/)
  assert.match(themeCss, /\.sidebar-mobile-logout\s*\{[^}]*display:\s*none/s)
  assert.match(themeCss, /@media\s*\(max-width:\s*820px\)[\s\S]*\.sidebar-mobile-logout\s*\{[^}]*display:\s*inline-flex/s)
  assert.match(themeCss, /@media\s*\(max-width:\s*820px\)[\s\S]*\.sidebar-nav\s*\{[^}]*overflow-x:\s*auto/s)
})
