import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as orderWorkflow from './utils/orderWorkflow.js'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

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
  const source = await read('./order-operations.css')
  assert.match(source, /flex-wrap:\s*nowrap/)
  assert.match(source, /min-height:\s*38px/)
})

test('sidebar theme picker is a visual three-option segmented control with icons', async () => {
  const sidebar = await read('./components/Sidebar.jsx')
  assert.doesNotMatch(sidebar, /<select/)
  assert.match(sidebar, /theme-segmented-control/)
  assert.match(sidebar, /aria-pressed=/)
  assert.match(sidebar, /name="sun"/)
  assert.match(sidebar, /name="moon"/)
  assert.match(sidebar, /name="system"/)
})
